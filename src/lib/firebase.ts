import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const typedFirebaseConfig = firebaseConfig as typeof firebaseConfig & {
  firestoreDatabaseId?: string;
};

export const db = getFirestore(
  app,
  typedFirebaseConfig.firestoreDatabaseId ||
    'ai-studio-remixuntitled-66f9a2de-0f15-49ad-9833-ca26ce3d87e6'
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

WORKSPACE_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory only OAuth access token cache (never persisted to localStorage/sessionStorage)
let cachedWorkspaceAccessToken: string | null = null;

export function setCachedWorkspaceToken(token: string | null): void {
  cachedWorkspaceAccessToken = token;
}

export function getCachedWorkspaceToken(): string | null {
  return cachedWorkspaceAccessToken;
}

export function clearCachedWorkspaceToken(): void {
  cachedWorkspaceAccessToken = null;
}

// Validate Firestore connection cleanly on startup
export async function validateFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore appears offline. Please verify Firebase configuration.');
    }
  }
}
