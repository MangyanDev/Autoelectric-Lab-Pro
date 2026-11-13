import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  auth,
  clearCachedWorkspaceToken,
  getCachedWorkspaceToken,
  googleProvider,
  setCachedWorkspaceToken,
  validateFirestoreConnection,
} from '../lib/firebase';
import { syncUserProfile } from '../services/benchStorageService';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  workspaceToken: string | null;
  needsWorkspaceAuth: boolean;
  signInWithGoogle: () => Promise<string | null>;
  signOutUser: () => Promise<void>;
  invalidateWorkspaceToken: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  authReady: false,
  isSigningIn: false,
  authError: null,
  workspaceToken: null,
  needsWorkspaceAuth: true,
  signInWithGoogle: async () => null,
  signOutUser: async () => {},
  invalidateWorkspaceToken: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(() => getCachedWorkspaceToken());

  useEffect(() => {
    validateFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) {
        setWorkspaceToken(getCachedWorkspaceToken());
        if (currentUser.email) {
          try {
            await syncUserProfile(currentUser.uid, currentUser.email, currentUser.displayName);
          } catch (err) {
            console.error('Failed to sync profile:', err);
          }
        }
      } else {
        clearCachedWorkspaceToken();
        setWorkspaceToken(null);
      }
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken ?? null;
      if (accessToken) {
        setCachedWorkspaceToken(accessToken);
        setWorkspaceToken(accessToken);
      } else {
        clearCachedWorkspaceToken();
        setWorkspaceToken(null);
      }
      return accessToken;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      setAuthError(msg);
      return null;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
      clearCachedWorkspaceToken();
      setWorkspaceToken(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-out failed';
      setAuthError(msg);
    }
  }, []);

  const invalidateWorkspaceToken = useCallback(() => {
    clearCachedWorkspaceToken();
    setWorkspaceToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isSigningIn,
        authError,
        workspaceToken,
        needsWorkspaceAuth: !user || !workspaceToken,
        signInWithGoogle,
        signOutUser,
        invalidateWorkspaceToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
