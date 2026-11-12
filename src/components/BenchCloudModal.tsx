import React, { useEffect, useState } from 'react';
import {
  X,
  Save,
  FolderOpen,
  Trash2,
  LogIn,
  LogOut,
  FileText,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Plus,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  SavedBenchSession,
  SavedDiagnosticLog,
  saveBenchSession,
  subscribeBenchSessions,
  deleteBenchSession,
  saveDiagnosticLog,
  subscribeDiagnosticLogs,
  deleteDiagnosticLog,
} from '../services/benchStorageService';
import {
  BenchComponent,
  DiagnosticTroubleCode,
  InjectedFault,
  PowerSupplyState,
  WireConnection,
} from '../types/ecu';

interface BenchCloudModalProps {
  isOpen: boolean;
  onClose: () => void;
  powerSupply: PowerSupplyState;
  wires: WireConnection[];
  faults: InjectedFault[];
  components: BenchComponent[];
  activeDTCs: DiagnosticTroubleCode[];
  supplyCurrentDrawAmps: number;
  onLoadBenchSession: (session: SavedBenchSession) => void;
}

export const BenchCloudModal: React.FC<BenchCloudModalProps> = ({
  isOpen,
  onClose,
  powerSupply,
  wires,
  faults,
  components,
  activeDTCs,
  supplyCurrentDrawAmps,
  onLoadBenchSession,
}) => {
  const { user, authReady, isSigningIn, authError, signInWithGoogle, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'BENCH_SESSIONS' | 'DIAGNOSTIC_LOGS'>('BENCH_SESSIONS');

  // Saved items
  const [sessions, setSessions] = useState<SavedBenchSession[]>([]);
  const [logs, setLogs] = useState<SavedDiagnosticLog[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Save Bench Session form
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [ecuLabel, setEcuLabel] = useState('Universal ECU Bench');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // New Diagnostic Note form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDtc, setNoteDtc] = useState('');
  const [noteEcu, setNoteEcu] = useState('');
  const [noteSummary, setNoteSummary] = useState('');

  useEffect(() => {
    if (!isOpen || !authReady || !user) {
      setSessions([]);
      setLogs([]);
      return;
    }

    setLoadError(null);
    const unsubSessions = subscribeBenchSessions(
      user.uid,
      (items) => setSessions(items),
      (err) => setLoadError(err.message)
    );
    const unsubLogs = subscribeDiagnosticLogs(
      user.uid,
      (items) => setLogs(items),
      (err) => setLoadError(err.message)
    );

    return () => {
      unsubSessions();
      unsubLogs();
    };
  }, [isOpen, authReady, user]);

  if (!isOpen) return null;

  const handleSaveCurrentBench = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !sessionTitle.trim()) return;
    setIsSaving(true);
    setSaveSuccess(null);
    setLoadError(null);
    try {
      await saveBenchSession(user.uid, {
        title: sessionTitle,
        notes: sessionNotes,
        ecuProfileLabel: ecuLabel,
        powerSupply,
        wires,
        faults,
        components,
        activeDtcs: activeDTCs.map((d) => d.code),
        supplyCurrentDrawAmps,
      });
      setSessionTitle('');
      setSessionNotes('');
      setSaveSuccess('Bench workspace saved to your profile.');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Unable to save bench session.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDiagnosticNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !noteTitle.trim() || !noteSummary.trim()) return;
    setIsSaving(true);
    setSaveSuccess(null);
    setLoadError(null);
    try {
      await saveDiagnosticLog(user.uid, {
        title: noteTitle,
        dtcCode: noteDtc,
        ecuModel: noteEcu,
        sourceType: 'BENCH_SNAPSHOT',
        summary: noteSummary,
        sources: [],
      });
      setNoteTitle('');
      setNoteDtc('');
      setNoteEcu('');
      setNoteSummary('');
      setSaveSuccess('Diagnostic log entry recorded.');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Unable to save diagnostic log.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-950 border border-cyan-800/80 rounded-2xl shadow-2xl overflow-hidden font-mono text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center">
              <Save className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 tracking-wide">
                Saved Bench Sessions & Diagnostic Case Logs
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Save custom harness wiring, fault scenarios, and grounded TSB notes across sessions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px]">
                <span className="text-emerald-400 font-semibold truncate max-w-[180px]">
                  {user.displayName || user.email}
                </span>
                <button
                  onClick={signOutUser}
                  className="text-slate-400 hover:text-rose-300 flex items-center gap-1 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#080b12] flex flex-col gap-4">
          {!user ? (
            <div className="my-auto flex flex-col items-center justify-center text-center p-8 bg-slate-900/70 border border-slate-800 rounded-xl gap-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-600/50 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  Sign In to Save Your Bench Workspaces
                </h3>
                <p className="text-xs text-slate-400 font-sans mt-1.5 leading-relaxed">
                  Authenticate with your Google account to save wiring configurations, injected fault scenarios, and diagnostic TSB bookmarks securely to your personal workbench profile.
                </p>
              </div>

              {authError && (
                <div className="w-full p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-sans">
                  {authError}
                </div>
              )}

              <button
                onClick={signInWithGoogle}
                disabled={isSigningIn}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-md transition"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSigningIn ? 'Signing in...' : 'Sign In with Google'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Sign Out + Tab Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setActiveTab('BENCH_SESSIONS')}
                    className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'BENCH_SESSIONS'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Bench Workspaces ({sessions.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('DIAGNOSTIC_LOGS')}
                    className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'DIAGNOSTIC_LOGS'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Diagnostic & TSB Logs ({logs.length})</span>
                  </button>
                </div>

                <button
                  onClick={signOutUser}
                  className="sm:hidden text-xs text-slate-400 hover:text-rose-300 flex items-center gap-1 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>

              {saveSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              {loadError && (
                <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{loadError}</span>
                </div>
              )}

              {/* TAB 1: SAVED BENCH SESSIONS */}
              {activeTab === 'BENCH_SESSIONS' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left: Save Current Bench Snapshot */}
                  <form
                    onSubmit={handleSaveCurrentBench}
                    className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3 h-fit"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <Plus className="w-4 h-4" />
                        Save Current Live Bench State
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {wires.length} Wires · {faults.length} Faults
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] flex flex-wrap gap-3 text-slate-300">
                      <span>
                        PSU: <strong className="text-amber-300">{powerSupply.voltageSetting.toFixed(1)}V</strong>
                      </span>
                      <span>
                        Draw: <strong className="text-cyan-300">{supplyCurrentDrawAmps.toFixed(2)}A</strong>
                      </span>
                      <span>
                        DTCs: <strong className={activeDTCs.length > 0 ? 'text-rose-400' : 'text-emerald-400'}>{activeDTCs.length}</strong>
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 uppercase">Session Title *</label>
                      <input
                        type="text"
                        required
                        maxLength={120}
                        value={sessionTitle}
                        onChange={(e) => setSessionTitle(e.target.value)}
                        placeholder="e.g., TPS Short-to-GND Training Case"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 uppercase">ECU Profile / Unit</label>
                      <input
                        type="text"
                        maxLength={120}
                        value={ecuLabel}
                        onChange={(e) => setEcuLabel(e.target.value)}
                        placeholder="e.g., Hitachi MEC11-251 / Universal"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 uppercase">Technician Notes</label>
                      <textarea
                        rows={3}
                        maxLength={1000}
                        value={sessionNotes}
                        onChange={(e) => setSessionNotes(e.target.value)}
                        placeholder="Observations, expected DMM measurements, or test sequence..."
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSaving || !sessionTitle.trim()}
                      className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'Saving...' : 'Save Bench Snapshot'}</span>
                    </button>
                  </form>

                  {/* Right: Saved Bench Sessions List */}
                  <div className="lg:col-span-7 flex flex-col gap-2.5">
                    {sessions.length === 0 ? (
                      <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-xl text-center text-xs text-slate-400 font-sans">
                        No saved bench workspaces yet. Capture your current harness, sensor values, and faults on the left.
                      </div>
                    ) : (
                      sessions.map((sess) => (
                        <div
                          key={sess.id}
                          className="bg-slate-900 border border-slate-800 hover:border-cyan-700/80 rounded-xl p-3.5 flex flex-col gap-2 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-slate-100">{sess.title}</h4>
                              <span className="text-[10px] text-cyan-400">{sess.ecuProfileLabel}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  onLoadBenchSession(sess);
                                  onClose();
                                }}
                                className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-800 border border-cyan-600 text-cyan-200 text-[11px] font-bold flex items-center gap-1 transition"
                              >
                                <Wrench className="w-3 h-3" />
                                <span>Load Bench</span>
                              </button>
                              <button
                                onClick={() => deleteBenchSession(user.uid, sess.id)}
                                className="p-1.5 rounded bg-slate-950 hover:bg-rose-950 border border-slate-800 hover:border-rose-700 text-slate-400 hover:text-rose-300 transition"
                                title="Delete Workspace"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {sess.notes && (
                            <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                              {sess.notes}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 text-[10px] pt-1 border-t border-slate-800/80 text-slate-400">
                            <span>PSU: {sess.powerSupply?.voltageSetting?.toFixed(1) ?? '12.6'}V</span>
                            <span>·</span>
                            <span>{sess.wires?.length ?? 0} Wires</span>
                            <span>·</span>
                            <span>{sess.faults?.length ?? 0} Faults</span>
                            {sess.activeDtcs?.length > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-rose-400 font-bold">
                                  DTCs: {sess.activeDtcs.join(', ')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: DIAGNOSTIC & TSB LOGS */}
              {activeTab === 'DIAGNOSTIC_LOGS' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left: Add Diagnostic Log Entry */}
                  <form
                    onSubmit={handleSaveDiagnosticNote}
                    className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3 h-fit"
                  >
                    <div className="border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <Plus className="w-4 h-4" />
                        Record Diagnostic Case Note
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 uppercase">Case Title *</label>
                      <input
                        type="text"
                        required
                        maxLength={160}
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="e.g., MEC22-251 R701 Shunt Open Fix"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 uppercase">DTC Code</label>
                        <input
                          type="text"
                          maxLength={32}
                          value={noteDtc}
                          onChange={(e) => setNoteDtc(e.target.value)}
                          placeholder="P0201"
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 uppercase"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-400 uppercase">ECU Model</label>
                        <input
                          type="text"
                          maxLength={120}
                          value={noteEcu}
                          onChange={(e) => setNoteEcu(e.target.value)}
                          placeholder="MEC22-251"
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 uppercase">Diagnostic Findings *</label>
                      <textarea
                        rows={4}
                        required
                        maxLength={12000}
                        value={noteSummary}
                        onChange={(e) => setNoteSummary(e.target.value)}
                        placeholder="Measured shunt resistance, oscilloscope waveform findings, or repair verification..."
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSaving || !noteTitle.trim() || !noteSummary.trim()}
                      className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'Saving...' : 'Save Diagnostic Log'}</span>
                    </button>
                  </form>

                  {/* Right: Saved Logs & Grounded TSB Bookmarks */}
                  <div className="lg:col-span-7 flex flex-col gap-2.5">
                    {logs.length === 0 ? (
                      <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-xl text-center text-xs text-slate-400 font-sans">
                        No diagnostic logs or bookmarked TSBs yet. Record notes here or save Google Search Grounding results directly.
                      </div>
                    ) : (
                      logs.map((log) => (
                        <div
                          key={log.id}
                          className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold">
                                  {log.sourceType.replace('_', ' ')}
                                </span>
                                {log.dtcCode && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-300 font-bold">
                                    {log.dtcCode}
                                  </span>
                                )}
                                {log.ecuModel && (
                                  <span className="text-[10px] text-slate-400">{log.ecuModel}</span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold text-slate-100">{log.title}</h4>
                            </div>

                            <button
                              onClick={() => deleteDiagnosticLog(user.uid, log.id)}
                              className="p-1.5 rounded bg-slate-950 hover:bg-rose-950 border border-slate-800 hover:border-rose-700 text-slate-400 hover:text-rose-300 transition shrink-0"
                              title="Delete Log"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-300 font-sans whitespace-pre-wrap max-h-40 overflow-y-auto bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                            {log.summary}
                          </div>

                          {log.sources && log.sources.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {log.sources.map((src, idx) => (
                                <a
                                  key={idx}
                                  href={src.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500 text-cyan-300 flex items-center gap-1 transition"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span className="truncate max-w-[160px]">{src.title}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
