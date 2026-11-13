import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  FileText,
  LogOut,
  PencilLine,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  appendToGoogleDoc,
  buildBenchReportText,
  createBenchReportDoc,
  getGoogleDoc,
  GoogleDriveDocItem,
  GoogleWorkspaceAuthError,
  listGoogleDocs,
  ParsedGoogleDoc,
  replaceGoogleDocBody,
  trashGoogleDoc,
} from '../services/googleDocsService';
import {
  EcuPin,
  InjectedFault,
  MultimeterState,
  PowerSupplyState,
  WireConnection,
} from '../types/ecu';
import { CircuitSolution } from '../utils/circuitSolver';

interface GoogleDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  powerSupply: PowerSupplyState;
  pins: EcuPin[];
  wires: WireConnection[];
  faults: InjectedFault[];
  multimeter: MultimeterState;
  circuitSolution: CircuitSolution;
}

type PendingMutation =
  | {
      kind: 'APPEND';
      docId: string;
      docTitle: string;
      payloadText: string;
    }
  | {
      kind: 'OVERWRITE';
      docId: string;
      docTitle: string;
      payloadText: string;
    }
  | {
      kind: 'TRASH';
      docId: string;
      docTitle: string;
    };

export const GoogleDocsModal: React.FC<GoogleDocsModalProps> = ({
  isOpen,
  onClose,
  powerSupply,
  pins,
  wires,
  faults,
  multimeter,
  circuitSolution,
}) => {
  const {
    user,
    isSigningIn,
    authError,
    workspaceToken,
    needsWorkspaceAuth,
    signInWithGoogle,
    signOutUser,
    invalidateWorkspaceToken,
  } = useAuth();

  const [docs, setDocs] = useState<GoogleDriveDocItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [selectedDocMeta, setSelectedDocMeta] = useState<GoogleDriveDocItem | null>(null);
  const [activeDoc, setActiveDoc] = useState<ParsedGoogleDoc | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);

  const [rightMode, setRightMode] = useState<'CREATE_REPORT' | 'VIEW_EDIT'>('CREATE_REPORT');
  const [newDocTitle, setNewDocTitle] = useState(
    () => `ECU Bench Report - ${new Date().toISOString().slice(0, 10)}`
  );
  const [ecuProfileLabel, setEcuProfileLabel] = useState('Universal ECU Bench');
  const [techNotes, setTechNotes] = useState('');

  const [appendText, setAppendText] = useState('');
  const [includeMnaInAppend, setIncludeMnaInAppend] = useState(true);
  const [overwriteDraft, setOverwriteDraft] = useState('');
  const [editSubTab, setEditSubTab] = useState<'READER' | 'APPEND' | 'OVERWRITE'>('READER');

  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    docUrl?: string;
  } | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingMutation | null>(null);

  const liveMnaReportPreview = useMemo(
    () =>
      buildBenchReportText({
        ecuProfileLabel,
        powerSupply,
        pins,
        wires,
        faults,
        multimeter,
        circuitSolution,
        technicianNotes: techNotes,
      }),
    [ecuProfileLabel, powerSupply, pins, wires, faults, multimeter, circuitSolution, techNotes]
  );

  const handleApiError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof GoogleWorkspaceAuthError) {
        invalidateWorkspaceToken();
        setStatusMessage({ type: 'error', text: err.message });
        return;
      }
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : fallback,
      });
    },
    [invalidateWorkspaceToken]
  );

  const refreshDocList = useCallback(
    async (tokenOverride?: string, queryOverride?: string) => {
      const token = tokenOverride || workspaceToken;
      if (!token) return;
      setIsLoadingList(true);
      try {
        const items = await listGoogleDocs(token, queryOverride ?? searchQuery);
        setDocs(items);
      } catch (err) {
        handleApiError(err, 'Failed to load Google Docs from Drive.');
      } finally {
        setIsLoadingList(false);
      }
    },
    [workspaceToken, searchQuery, handleApiError]
  );

  useEffect(() => {
    if (isOpen && workspaceToken && user) {
      refreshDocList(workspaceToken);
    }
  }, [isOpen, workspaceToken, user, refreshDocList]);

  const handleGoogleLogin = async () => {
    setStatusMessage(null);
    const freshToken = await signInWithGoogle();
    if (freshToken) {
      await refreshDocList(freshToken);
    }
  };

  const handleOpenDocument = async (item: GoogleDriveDocItem) => {
    if (!workspaceToken) return;
    setSelectedDocMeta(item);
    setRightMode('VIEW_EDIT');
    setEditSubTab('READER');
    setIsLoadingDoc(true);
    setStatusMessage(null);
    try {
      const parsed = await getGoogleDoc(workspaceToken, item.id);
      setActiveDoc(parsed);
      setOverwriteDraft(parsed.plainText);
    } catch (err) {
      handleApiError(err, 'Unable to read Google Doc content.');
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceToken) return;
    setIsExecuting(true);
    setStatusMessage(null);
    try {
      const created = await createBenchReportDoc(
        workspaceToken,
        newDocTitle,
        liveMnaReportPreview
      );
      setStatusMessage({
        type: 'success',
        text: `Created Google Doc "${created.title}" with live MNA bench telemetry.`,
        docUrl: created.webViewLink,
      });
      await refreshDocList(workspaceToken);
      const parsed = await getGoogleDoc(workspaceToken, created.documentId);
      setSelectedDocMeta({
        id: created.documentId,
        name: created.title,
        webViewLink: created.webViewLink,
      });
      setActiveDoc(parsed);
      setOverwriteDraft(parsed.plainText);
      setRightMode('VIEW_EDIT');
      setEditSubTab('READER');
    } catch (err) {
      handleApiError(err, 'Failed to create Google Doc report.');
    } finally {
      setIsExecuting(false);
    }
  };

  const requestAppendConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc) return;
    const parts: string[] = [];
    if (includeMnaInAppend) {
      parts.push(liveMnaReportPreview.trim());
    }
    if (appendText.trim()) {
      parts.push(`Technician Addendum (${new Date().toLocaleString()}):\n${appendText.trim()}`);
    }
    const combined = parts.join('\n\n').trim();
    if (!combined) return;

    setPendingMutation({
      kind: 'APPEND',
      docId: activeDoc.documentId,
      docTitle: activeDoc.title,
      payloadText: combined,
    });
  };

  const requestOverwriteConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc || !overwriteDraft.trim()) return;
    setPendingMutation({
      kind: 'OVERWRITE',
      docId: activeDoc.documentId,
      docTitle: activeDoc.title,
      payloadText: overwriteDraft,
    });
  };

  const requestTrashConfirmation = (item: { id: string; name: string }) => {
    setPendingMutation({
      kind: 'TRASH',
      docId: item.id,
      docTitle: item.name,
    });
  };

  const executeConfirmedMutation = async () => {
    if (!pendingMutation || !workspaceToken) return;
    const action = pendingMutation;
    setPendingMutation(null);
    setIsExecuting(true);
    setStatusMessage(null);

    try {
      if (action.kind === 'APPEND') {
        const updated = await appendToGoogleDoc(
          workspaceToken,
          action.docId,
          action.payloadText
        );
        setActiveDoc(updated);
        setOverwriteDraft(updated.plainText);
        setAppendText('');
        setEditSubTab('READER');
        setStatusMessage({
          type: 'success',
          text: `Appended telemetry & notes to "${action.docTitle}".`,
          docUrl: `https://docs.google.com/document/d/${action.docId}/edit`,
        });
      } else if (action.kind === 'OVERWRITE') {
        const updated = await replaceGoogleDocBody(
          workspaceToken,
          action.docId,
          action.payloadText
        );
        setActiveDoc(updated);
        setOverwriteDraft(updated.plainText);
        setEditSubTab('READER');
        setStatusMessage({
          type: 'success',
          text: `Updated document contents of "${action.docTitle}".`,
          docUrl: `https://docs.google.com/document/d/${action.docId}/edit`,
        });
      } else if (action.kind === 'TRASH') {
        await trashGoogleDoc(workspaceToken, action.docId);
        if (activeDoc?.documentId === action.docId) {
          setActiveDoc(null);
          setSelectedDocMeta(null);
          setRightMode('CREATE_REPORT');
        }
        setStatusMessage({
          type: 'success',
          text: `Moved "${action.docTitle}" to Google Drive Trash.`,
        });
        await refreshDocList(workspaceToken);
      }
    } catch (err) {
      handleApiError(err, 'Unable to update Google Doc.');
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl h-[88vh] flex flex-col hud-panel rounded-2xl shadow-2xl overflow-hidden font-mono text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 hud-header shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-500/50 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-hud font-bold text-slate-100 tracking-wide uppercase">
                Google Docs — OEM Diagnostic Reports & Lab Notes
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Export live MNA bench telemetry into Google Docs or read and update your repair documents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && !needsWorkspaceAuth && (
              <div className="hidden sm:flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px]">
                <span className="text-emerald-400 font-semibold truncate max-w-[180px]">
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={signOutUser}
                  className="text-slate-400 hover:text-rose-300 flex items-center gap-1 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-[#080b12] flex flex-col">
          {needsWorkspaceAuth ? (
            <div className="m-auto flex flex-col items-center justify-center text-center p-8 bg-slate-900/75 border border-slate-800 rounded-xl gap-4 max-w-md">
              <div className="w-12 h-12 rounded-xl bg-blue-950 border border-blue-500/50 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  {user ? 'Authorize Google Docs Session' : 'Connect Google Docs & Drive'}
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-1.5 leading-relaxed">
                  {user
                    ? 'Your session token is cleared on reload for security. Sign in with Google to browse, create, and update diagnostic reports in Google Docs.'
                    : 'Sign in with Google to generate live MNA ECU Bench Diagnostic Reports in Google Docs, inspect existing documents, and append repair notes.'}
                </p>
              </div>

              {(authError || statusMessage?.type === 'error') && (
                <div className="w-full p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-sans">
                  {statusMessage?.text || authError}
                </div>
              )}

              <GoogleSignInButton
                onClick={handleGoogleLogin}
                disabled={isSigningIn}
                label={isSigningIn ? 'Signing in...' : 'Sign in with Google'}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {statusMessage && (
                <div
                  className={`mx-4 mt-3 p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 shrink-0 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-800 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {statusMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="truncate font-sans">{statusMessage.text}</span>
                  </div>
                  {statusMessage.docUrl && (
                    <a
                      href={statusMessage.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded bg-emerald-900/70 hover:bg-emerald-800 border border-emerald-600 text-emerald-100 text-[11px] font-bold flex items-center gap-1 shrink-0 transition"
                    >
                      <span>Open in Docs</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-hidden">
                {/* Left Column: Google Docs Library */}
                <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-slate-800 flex flex-col gap-2 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-blue-300 uppercase tracking-wide">
                        Your Google Docs ({docs.length})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setRightMode('CREATE_REPORT');
                            setStatusMessage(null);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 border transition ${
                            rightMode === 'CREATE_REPORT'
                              ? 'bg-cyan-600 border-cyan-400 text-white'
                              : 'bg-slate-950 border-slate-700 text-cyan-300 hover:bg-slate-800'
                          }`}
                        >
                          <FilePlus2 className="w-3 h-3" />
                          <span>New Report</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => refreshDocList()}
                          disabled={isLoadingList}
                          className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
                          title="Refresh Google Docs list"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        refreshDocList(undefined, searchQuery);
                      }}
                      className="flex gap-1.5"
                    >
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search Google Docs..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] font-bold text-slate-200 transition"
                      >
                        Find
                      </button>
                    </form>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-2">
                    {isLoadingList ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        Loading documents from Google Drive...
                      </div>
                    ) : docs.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 font-sans">
                        No Google Docs matched. Create a new MNA Diagnostic Report on the right.
                      </div>
                    ) : (
                      docs.map((item) => {
                        const isSelected = selectedDocMeta?.id === item.id && rightMode === 'VIEW_EDIT';
                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-2.5 transition flex items-start justify-between gap-2 ${
                              isSelected
                                ? 'bg-blue-950/50 border-blue-500/70'
                                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenDocument(item)}
                              className="flex-1 text-left min-w-0"
                            >
                              <div className="text-xs font-bold text-slate-100 truncate">
                                {item.name}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {item.modifiedTime
                                  ? `Updated ${new Date(item.modifiedTime).toLocaleString()}`
                                  : 'Google Doc'}
                              </div>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              {item.webViewLink && (
                                <a
                                  href={item.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-blue-300 transition"
                                  title="Open in Google Docs"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => requestTrashConfirmation(item)}
                                className="p-1 rounded bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-700 text-slate-400 hover:text-rose-300 transition"
                                title="Move to Trash"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Create Live Report OR View/Update Selected Doc */}
                <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col overflow-hidden">
                  {rightMode === 'CREATE_REPORT' ? (
                    <form
                      onSubmit={handleCreateReport}
                      className="flex-1 flex flex-col overflow-hidden"
                    >
                      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
                        <div>
                          <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-1.5">
                            <FilePlus2 className="w-4 h-4" />
                            Generate Google Doc from Live MNA Bench State
                          </h3>
                          <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                            Exports live power supply telemetry, DMM probe readings, OBD-II DTCs, and 16-pin MNA node voltages
                          </p>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-400 uppercase">
                              Google Doc Title *
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={160}
                              value={newDocTitle}
                              onChange={(e) => setNewDocTitle(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-sans"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-400 uppercase">
                              ECU Unit / Bench Profile
                            </label>
                            <input
                              type="text"
                              maxLength={120}
                              value={ecuProfileLabel}
                              onChange={(e) => setEcuProfileLabel(e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 font-sans"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 uppercase">
                            Technician Repair & Diagnostic Notes (Optional)
                          </label>
                          <textarea
                            rows={2}
                            value={techNotes}
                            onChange={(e) => setTechNotes(e.target.value)}
                            placeholder="Add bench troubleshooting notes, root cause findings, or parts replaced..."
                            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans resize-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1 flex-1 min-h-[200px]">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] text-slate-400 uppercase">
                              Live MNA Report Preview
                            </label>
                            <span className="text-[10px] text-emerald-400">
                              PSU {powerSupply.voltageSetting.toFixed(1)}V · {circuitSolution.supplyCurrentDrawAmps.toFixed(2)}A · {circuitSolution.activeDTCs.length} DTC(s)
                            </span>
                          </div>
                          <pre className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                            {liveMnaReportPreview}
                          </pre>
                        </div>
                      </div>

                      <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2 shrink-0">
                        <button
                          type="submit"
                          disabled={isExecuting || !newDocTitle.trim()}
                          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition"
                        >
                          <FilePlus2 className="w-4 h-4" />
                          <span>{isExecuting ? 'Creating Google Doc...' : 'Create Google Doc Report'}</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Selected Doc Header */}
                      <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-slate-100 truncate">
                            {activeDoc?.title || selectedDocMeta?.name || 'Document'}
                          </h3>
                          <span className="text-[10px] text-slate-400">
                            ID: {activeDoc?.documentId || selectedDocMeta?.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setEditSubTab('READER')}
                            className={`px-2.5 py-1 rounded font-bold transition ${
                              editSubTab === 'READER'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Read
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditSubTab('APPEND')}
                            className={`px-2.5 py-1 rounded font-bold transition ${
                              editSubTab === 'APPEND'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Append MNA / Notes
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditSubTab('OVERWRITE')}
                            className={`px-2.5 py-1 rounded font-bold transition ${
                              editSubTab === 'OVERWRITE'
                                ? 'bg-amber-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Edit Body
                          </button>
                        </div>
                      </div>

                      {isLoadingDoc ? (
                        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                          Fetching Google Doc structure...
                        </div>
                      ) : !activeDoc ? (
                        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                          Select a document on the left to inspect or update.
                        </div>
                      ) : editSubTab === 'READER' ? (
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/60 font-sans text-xs text-slate-200 space-y-2.5 leading-relaxed">
                          {activeDoc.blocks.length === 0 ? (
                            <p className="text-slate-500 italic">This Google Doc is currently empty.</p>
                          ) : (
                            activeDoc.blocks.map((block, idx) => {
                              if (block.type === 'HEADING') {
                                return (
                                  <h4
                                    key={idx}
                                    className={`font-bold text-cyan-300 pt-1 ${
                                      block.level === 1 ? 'text-base border-b border-slate-800 pb-1' : 'text-sm'
                                    }`}
                                  >
                                    {block.text}
                                  </h4>
                                );
                              }
                              if (block.type === 'BULLET') {
                                return (
                                  <div key={idx} className="pl-4 flex gap-2">
                                    <span className="text-cyan-400">•</span>
                                    <span>{block.text}</span>
                                  </div>
                                );
                              }
                              if (block.type === 'TABLE' && block.rows) {
                                return (
                                  <div key={idx} className="overflow-x-auto my-2">
                                    <table className="w-full border-collapse border border-slate-800 text-[11px] font-mono">
                                      <tbody>
                                        {block.rows.map((row, rIdx) => (
                                          <tr key={rIdx} className="border-b border-slate-800">
                                            {row.map((cell, cIdx) => (
                                              <td key={cIdx} className="px-2.5 py-1.5 border-r border-slate-800">
                                                {cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              }
                              return (
                                <p key={idx} className="whitespace-pre-wrap">
                                  {block.text}
                                </p>
                              );
                            })
                          )}
                        </div>
                      ) : editSubTab === 'APPEND' ? (
                        <form
                          onSubmit={requestAppendConfirmation}
                          className="flex-1 flex flex-col overflow-hidden p-4 gap-3"
                        >
                          <label className="flex items-center gap-2 text-xs text-cyan-200 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={includeMnaInAppend}
                              onChange={(e) => setIncludeMnaInAppend(e.target.checked)}
                              className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                            />
                            <span>Include live MNA bench telemetry snapshot (PSU, DMM, DTCs, 16-pin voltages)</span>
                          </label>

                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[10px] text-slate-400 uppercase">
                              Additional Bench / Repair Notes to Append
                            </label>
                            <textarea
                              rows={6}
                              value={appendText}
                              onChange={(e) => setAppendText(e.target.value)}
                              placeholder="Enter oscilloscope measurements, repair verification, or technician findings..."
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans resize-none"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={isExecuting || (!includeMnaInAppend && !appendText.trim())}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Review & Append to Doc</span>
                            </button>
                          </div>
                        </form>
                      ) : (
                        <form
                          onSubmit={requestOverwriteConfirmation}
                          className="flex-1 flex flex-col overflow-hidden p-4 gap-3"
                        >
                          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-700/60 text-amber-200 text-[11px] font-sans flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>
                              Editing here replaces the document body text upon confirmation. Formatting in existing tables may be simplified.
                            </span>
                          </div>
                          <textarea
                            value={overwriteDraft}
                            onChange={(e) => setOverwriteDraft(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono resize-none"
                          />
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={isExecuting || !overwriteDraft.trim()}
                              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition"
                            >
                              <PencilLine className="w-3.5 h-3.5" />
                              <span>Review & Replace Document Body</span>
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mandatory Explicit User Confirmation Modal for All Mutating / Destructive Operations */}
        {pendingMutation && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-slate-900 border border-amber-500/60 rounded-2xl shadow-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    pendingMutation.kind === 'TRASH'
                      ? 'bg-rose-950 border-rose-600 text-rose-400'
                      : 'bg-amber-950 border-amber-600 text-amber-400'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-100">
                    {pendingMutation.kind === 'APPEND' &&
                      `Append to "${pendingMutation.docTitle}"?`}
                    {pendingMutation.kind === 'OVERWRITE' &&
                      `Replace contents of "${pendingMutation.docTitle}"?`}
                    {pendingMutation.kind === 'TRASH' &&
                      `Move "${pendingMutation.docTitle}" to Google Drive Trash?`}
                  </h3>
                  <p className="text-xs text-slate-300 font-sans mt-1 leading-relaxed">
                    {pendingMutation.kind === 'APPEND' &&
                      'This will modify your Google Doc by inserting the previewed telemetry and notes at the end of the document.'}
                    {pendingMutation.kind === 'OVERWRITE' &&
                      'This will replace the existing body text of this Google Doc with your edited content.'}
                    {pendingMutation.kind === 'TRASH' &&
                      'This will move the selected Google Doc into your Google Drive Trash.'}
                  </p>
                </div>
              </div>

              {'payloadText' in pendingMutation && (
                <pre className="max-h-40 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-300 font-mono whitespace-pre-wrap">
                  {pendingMutation.payloadText.slice(0, 1200)}
                  {pendingMutation.payloadText.length > 1200 ? '\n... (truncated preview)' : ''}
                </pre>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPendingMutation(null)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedMutation}
                  className={`px-4 py-2 rounded-lg text-white text-xs font-bold transition ${
                    pendingMutation.kind === 'TRASH'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  {pendingMutation.kind === 'TRASH' ? 'Confirm Move to Trash' : 'Confirm Update'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
