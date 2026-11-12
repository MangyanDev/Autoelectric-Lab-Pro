import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Send,
  Bot,
  WifiOff,
  Sparkles,
  BookOpen,
  Cpu,
  Layers,
  Activity,
  Database,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import {
  AssistantCitation,
  LiveBenchContext,
  OfflineDiagnosticChatbot,
} from '../services/offlineChatbotEngine';
import { SavedBenchSession, SavedDiagnosticLog } from '../services/benchStorageService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: AssistantCitation[];
  suggestedPrompts?: string[];
  timestamp: number;
}

interface OfflineAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveContext: LiveBenchContext;
  savedLogs: SavedDiagnosticLog[];
  savedSessions: SavedBenchSession[];
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
  onNavigateTab: (
    tab: 'BENCH_LAB' | 'WIRING_DIAGRAM' | 'ECU_PINOUT' | 'OSCILLOSCOPE' | 'PCB_SCANNER' | 'REPAIR_GUIDE',
    pinId?: string
  ) => void;
}

const STARTER_PROMPTS = [
  'Diagnose my current bench',
  'Hitachi MEC11 K-Line wakeup pins',
  'Marelli IAW 5NF TLE9135PD jumper',
  'Toyota 1KD P0093 CPU #2 fast flashing',
  'How to test CAN Bus 60 Ohm?',
  'Bosch ME7.5 boot pin 65 recovery',
];

export const OfflineAssistantModal: React.FC<OfflineAssistantModalProps> = ({
  isOpen,
  onClose,
  liveContext,
  savedLogs,
  savedSessions,
  initialPrompt,
  onClearInitialPrompt,
  onNavigateTab,
}) => {
  const [input, setInput] = useState('');
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Build / refresh MiniSearch index locally whenever project or saved DB records update
  const botEngine = useMemo(
    () => new OfflineDiagnosticChatbot(savedLogs, savedSessions),
    [savedLogs, savedSessions]
  );

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Offline Diagnostic Guide ready (powered by MiniSearch open-source local engine — zero internet or API key required).\n\nI have indexed all **${botEngine.indexedCount} knowledge records** from AutoElectric Lab Pro: 9 OEM ECU pinout profiles, 21 PCB component hotspots, 9 repair manuals, live MNA bench playbooks, and your saved Firestore diagnostic logs.\n\nAsk me about any DTC, pinout, PCB component, or click **"Diagnose my current bench"** to inspect your live circuit.`,
      suggestedPrompts: STARTER_PROMPTS.slice(0, 4),
      timestamp: Date.now(),
    },
  ]);

  const MAX_CHAT_MESSAGES = 60;

  useEffect(() => {
    if (isOpen && initialPrompt && initialPrompt.trim()) {
      const trimmed = initialPrompt.trim();
      const reply = botEngine.ask(trimmed, liveContext);
      setMessages((prev) =>
        [
          ...prev,
          {
            id: `u_${Date.now()}`,
            role: 'user' as const,
            text: trimmed,
            timestamp: Date.now(),
          },
          {
            id: `b_${Date.now() + 1}`,
            role: 'assistant' as const,
            text: reply.answer,
            citations: reply.citations,
            suggestedPrompts: reply.suggestedPrompts,
            timestamp: Date.now(),
          },
        ].slice(-MAX_CHAT_MESSAGES)
      );
      onClearInitialPrompt?.();
    }
  }, [isOpen, initialPrompt, botEngine, liveContext, onClearInitialPrompt]);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const sendQuery = (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };

    const reply = botEngine.ask(trimmed, liveContext);

    const botMsg: ChatMessage = {
      id: `b_${Date.now() + 1}`,
      role: 'assistant',
      text: reply.answer,
      citations: reply.citations,
      suggestedPrompts: reply.suggestedPrompts,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, botMsg].slice(-MAX_CHAT_MESSAGES));
    setInput('');
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        text: `Chat cleared. Local MiniSearch index has **${botEngine.indexedCount} records** loaded and ready offline.`,
        suggestedPrompts: STARTER_PROMPTS.slice(0, 4),
        timestamp: Date.now(),
      },
    ]);
  };

  const renderBadgeIcon = (kind: AssistantCitation['kind']) => {
    switch (kind) {
      case 'OEM_MANUAL':
        return <BookOpen className="w-3 h-3 text-amber-400" />;
      case 'ECU_PINOUT':
        return <Cpu className="w-3 h-3 text-cyan-400" />;
      case 'PCB_HOTSPOT':
        return <Layers className="w-3 h-3 text-purple-400" />;
      case 'SAVED_DB_LOG':
      case 'SAVED_BENCH':
        return <Database className="w-3 h-3 text-emerald-400" />;
      default:
        return <Activity className="w-3 h-3 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl h-[88vh] flex flex-col hud-panel rounded-2xl shadow-2xl overflow-hidden font-mono text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 hud-header shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/60 flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-hud font-bold text-slate-100 tracking-wide uppercase">
                  Offline ECU Diagnostic Assistant
                </h2>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5" />
                  100% OFFLINE · MiniSearch (MIT)
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                {botEngine.indexedCount} Project Records Indexed (Manuals, 9 ECU Pinouts, PCB Hotspots{savedLogs.length + savedSessions.length > 0 ? `, + ${savedLogs.length + savedSessions.length} Saved DB Items` : ''})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleResetChat}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Reset Chat"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live MNA Bench Context Bar */}
        <div className="px-4 py-1.5 bg-slate-900/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] shrink-0">
          <div className="flex items-center gap-3 flex-wrap text-slate-300">
            <span>
              LIVE PSU:{' '}
              <strong className={liveContext.powerSupply.isOutputEnabled ? 'text-emerald-400' : 'text-rose-400'}>
                {liveContext.powerSupply.isOutputEnabled ? `${liveContext.powerSupply.voltageSetting.toFixed(1)}V ON` : 'OFF'}
              </strong>
            </span>
            <span>
              DRAW: <strong className="text-amber-300">{liveContext.supplyCurrentDrawAmps.toFixed(2)}A</strong>
            </span>
            <span>
              ACTIVE DTCs:{' '}
              <strong className={liveContext.activeDTCs.length > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {liveContext.activeDTCs.length > 0
                  ? liveContext.activeDTCs.map((d) => d.code).join(', ')
                  : 'NONE'}
              </strong>
            </span>
          </div>

          <button
            onClick={() => sendQuery('Diagnose my current bench')}
            className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-300 font-bold flex items-center gap-1 transition"
          >
            <Sparkles className="w-3 h-3" />
            <span>Diagnose Live Bench</span>
          </button>
        </div>

        {/* Quick Topic Chips */}
        <div className="px-4 py-2 bg-[#080b12] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          {STARTER_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => sendQuery(p)}
              className="text-[10px] px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/60 text-slate-300 hover:text-emerald-300 whitespace-nowrap transition"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#030712]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-2 max-w-[92%] ${
                msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <div
                className={`rounded-xl px-3.5 py-2.5 text-xs font-sans leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-cyan-700 text-white rounded-br-none shadow-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.text}
              </div>

              {/* Matched Knowledge Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="w-full flex flex-col gap-1.5 mt-0.5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">
                    Matched Knowledge Sources ({msg.citations.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {msg.citations.slice(0, 4).map((cit) => (
                      <div
                        key={cit.id}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col justify-between gap-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {renderBadgeIcon(cit.kind)}
                            <span className="text-[10px] font-bold text-slate-200 truncate">
                              {cit.title}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono shrink-0">
                            {cit.kind.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-sans line-clamp-2">
                          {cit.snippet}
                        </p>
                        {cit.actionTab && (
                          <button
                            onClick={() => {
                              onNavigateTab(cit.actionTab!, cit.targetPinId);
                              onClose();
                            }}
                            className="self-start text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono font-semibold"
                          >
                            <span>Open {cit.actionTab.replace('_', ' ')}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Follow-ups */}
              {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {msg.suggestedPrompts.map((sp, i) => (
                    <button
                      key={i}
                      onClick={() => sendQuery(sp)}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-emerald-300 transition font-sans"
                    >
                      {sp}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={scrollEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuery(input);
          }}
          className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask offline about DTCs, ECU pins, PCB components (R701, TLE9135PD), or live bench faults..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
};
