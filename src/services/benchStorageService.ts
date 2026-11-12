import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  BenchComponent,
  InjectedFault,
  PowerSupplyState,
  WireConnection,
} from '../types/ecu';
import { GroundedSearchSource } from './groundedSearchService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface SavedBenchSession {
  id: string;
  ownerId: string;
  title: string;
  notes: string;
  ecuProfileLabel: string;
  powerSupply: PowerSupplyState;
  wires: WireConnection[];
  faults: InjectedFault[];
  componentStates: Record<string, Record<string, number | boolean | string>>;
  activeDtcs: string[];
  supplyCurrentDrawAmps: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SavedDiagnosticLog {
  id: string;
  ownerId: string;
  title: string;
  dtcCode: string;
  ecuModel: string;
  sourceType: 'GROUNDED_TSB' | 'BENCH_SNAPSHOT' | 'PINOUT_NOTE';
  summary: string;
  sources: GroundedSearchSource[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
}

/**
 * Ensure user profile document exists in Firestore under /users/{uid}.
 */
export async function syncUserProfile(
  uid: string,
  email: string,
  displayName?: string | null
): Promise<void> {
  const path = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(userRef);
    const safeEmail = email.slice(0, 254);
    const safeName = (displayName || '').slice(0, 120);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        email: safeEmail,
        displayName: safeName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        userRef,
        {
          email: safeEmail,
          displayName: safeName,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Save a full ECU bench workspace snapshot (wires, faults, power supply, sensor states, DTCs).
 */
export async function saveBenchSession(
  uid: string,
  payload: {
    title: string;
    notes?: string;
    ecuProfileLabel?: string;
    powerSupply: PowerSupplyState;
    wires: WireConnection[];
    faults: InjectedFault[];
    components: BenchComponent[];
    activeDtcs: string[];
    supplyCurrentDrawAmps: number;
  }
): Promise<string> {
  const sessionId = makeSafeId('bench');
  const path = `users/${uid}/benchSessions/${sessionId}`;

  const componentStates: Record<string, Record<string, number | boolean | string>> = {};
  for (const comp of payload.components) {
    if (comp.state && Object.keys(comp.state).length > 0) {
      componentStates[comp.id] = { ...comp.state };
    }
  }

  const sanitizedWires = payload.wires.slice(0, 50).map((w) => ({
    id: String(w.id).slice(0, 64),
    sourcePinId: String(w.sourcePinId).slice(0, 64),
    targetPinId: String(w.targetPinId).slice(0, 64),
    color: String(w.color).slice(0, 32),
    label: String(w.label).slice(0, 120),
    isCut: Boolean(w.isCut),
    resistance: Number(w.resistance) || 0.05,
  }));

  const sanitizedFaults = payload.faults.slice(0, 20).map((f) => ({
    pinId: String(f.pinId).slice(0, 64),
    faultType: String(f.faultType).slice(0, 48),
    description: String(f.description).slice(0, 240),
    timestamp: Number(f.timestamp) || Date.now(),
  }));

  const sanitizedDtcs = payload.activeDtcs
    .slice(0, 20)
    .map((code) => String(code).slice(0, 32));

  try {
    await setDoc(doc(db, 'users', uid, 'benchSessions', sessionId), {
      id: sessionId,
      ownerId: uid,
      title: payload.title.trim().slice(0, 120) || 'ECU Bench Snapshot',
      notes: (payload.notes || '').trim().slice(0, 1000),
      ecuProfileLabel: (payload.ecuProfileLabel || 'Universal ECU Bench').trim().slice(0, 120),
      powerSupply: {
        voltageSetting: Number(payload.powerSupply.voltageSetting),
        currentLimit: Number(payload.powerSupply.currentLimit),
        isOutputEnabled: Boolean(payload.powerSupply.isOutputEnabled),
        preset: String(payload.powerSupply.preset).slice(0, 32),
      },
      wires: sanitizedWires,
      faults: sanitizedFaults,
      componentStates,
      activeDtcs: sanitizedDtcs,
      supplyCurrentDrawAmps: Number(payload.supplyCurrentDrawAmps) || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return sessionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeBenchSessions(
  uid: string,
  onData: (sessions: SavedBenchSession[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `users/${uid}/benchSessions`;
  const q = query(
    collection(db, 'users', uid, 'benchSessions'),
    where('ownerId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedBenchSession[] = snapshot.docs
        .map((d) => d.data() as SavedBenchSession)
        .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        if (onError && e instanceof Error) onError(e);
      }
    }
  );
}

export async function deleteBenchSession(uid: string, sessionId: string): Promise<void> {
  const path = `users/${uid}/benchSessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'benchSessions', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Save a Diagnostic Log or Google Search Grounding TSB/Pinout Bookmark.
 */
export async function saveDiagnosticLog(
  uid: string,
  payload: {
    title: string;
    dtcCode?: string;
    ecuModel?: string;
    sourceType: 'GROUNDED_TSB' | 'BENCH_SNAPSHOT' | 'PINOUT_NOTE';
    summary: string;
    sources?: GroundedSearchSource[];
  }
): Promise<string> {
  const logId = makeSafeId('diag');
  const path = `users/${uid}/diagnosticLogs/${logId}`;

  const sanitizedSources = (payload.sources || []).slice(0, 20).map((s) => ({
    title: String(s.title).slice(0, 200),
    uri: String(s.uri).slice(0, 1000),
    domain: String(s.domain).slice(0, 120),
  }));

  try {
    await setDoc(doc(db, 'users', uid, 'diagnosticLogs', logId), {
      id: logId,
      ownerId: uid,
      title: payload.title.trim().slice(0, 160) || 'Diagnostic Note',
      dtcCode: (payload.dtcCode || '').trim().slice(0, 32),
      ecuModel: (payload.ecuModel || '').trim().slice(0, 120),
      sourceType: payload.sourceType,
      summary: payload.summary.trim().slice(0, 12000) || 'Diagnostic summary recorded.',
      sources: sanitizedSources,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return logId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeDiagnosticLogs(
  uid: string,
  onData: (logs: SavedDiagnosticLog[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = `users/${uid}/diagnosticLogs`;
  const q = query(
    collection(db, 'users', uid, 'diagnosticLogs'),
    where('ownerId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedDiagnosticLog[] = snapshot.docs
        .map((d) => d.data() as SavedDiagnosticLog)
        .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (e) {
        if (onError && e instanceof Error) onError(e);
      }
    }
  );
}

export async function deleteDiagnosticLog(uid: string, logId: string): Promise<void> {
  const path = `users/${uid}/diagnosticLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'diagnosticLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchBenchSessionCount(uid: string): Promise<number> {
  const path = `users/${uid}/benchSessions`;
  try {
    const q = query(
      collection(db, 'users', uid, 'benchSessions'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
