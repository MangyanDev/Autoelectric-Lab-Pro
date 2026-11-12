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
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  AssistantCitation,
  LiveBenchContext,
  OfflineDiagnosticChatbot,
} from '../services/offlineChatbotEngine';
import { SavedBenchSession, SavedDiagnosticLog } from '../services/benchStorageService';
import {
  offlineVoiceAssistant,
  VoiceAssistantState,
} from '../services/offlineVoiceService';
import { EcuPin } from '../types/ecu';
import { parseAndExecuteVoiceCommand, LabTab } from '../utils/voiceCommandParser';

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
  pins: EcuPin[];
  onSetVoltage: (volts: number) => void;
  onResetLab: () => void;
  onAttachProbeToPin: (pinId: string, label: string) => void;
  onSetPowerSupplyOutput: (enabled: boolean) => void;
  onNavigateTab: (tab: LabTab, pinId?: string) => void;
}

const STARTER_PROMPTS = [
  'Set voltage to 12 volts',
  'Attach probe to pin 7',
  'Reset lab',
  'Diagnose my current bench',
  'Turn power supply on',
  'Open oscilloscope',
  'Open PCB scanner',
  'How to test CAN Bus 60 Ohm?',
];

export const OfflineAssistantModal: React.FC<OfflineAssistantModalProps> = ({
  isOpen,
  onClose,
  liveContext,
  savedLogs,
  savedSessions,
  initialPrompt,
  onClearInitialPrompt,
  pins,
  onSetVoltage,
  onResetLab,
  onAttachProbeToPin,
  onSetPowerSupplyOutput,
  onNavigateTab,
}) => {
  const [input, setInput] = useState('');
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Build / refresh MiniSearch index locally whenever project or saved DB records update
  const botEngine = useMemo(
    () => new OfflineDiagnosticChatbot(savedLogs, savedSessions),
    [savedLogs, savedSessions]
  );

  const [voiceState, setVoiceState] = useState<VoiceAssistantState>(() =>
    offlineVoiceAssistant.getState()
  );

  // Subscribe to offline voice assistant state changes
  useEffect(() => {
    const unsub = offlineVoiceAssistant.subscribe((s) => setVoiceState(s));
    return () => {
      unsub();
      offlineVoiceAssistant.stopSpeaking();
      offlineVoiceAssistant.stopListening();
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Offline Diagnostic & Voice Command Bridge ready (powered by Web Speech API & MiniSearch — zero internet or API key required).\n\nSpeak or type commands like:\n• **"Set voltage to 12 volts"**\n• **"Attach probe to pin 7"**\n• **"Reset lab"**\n• **"Open oscilloscope"**\n• **"Diagnose my current bench"**\n\nI have indexed all **${botEngine.indexedCount} knowledge records** from AutoElectric Lab Pro.`,
      suggestedPrompts: STARTER_PROMPTS.slice(0, 4),
      timestamp: Date.now(),
    },
  ]);

  const MAX_CHAT_MESSAGES = 60;

  useEffect(() => {
    if (isOpen && initialPrompt && initialPrompt.trim()) {
      const trimmed = initialPrompt.trim();
      sendQuery(trimmed, true);
      onClearInitialPrompt?.();
    }
  }, [isOpen, initialPrompt, onClearInitialPrompt]);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const sendQuery = (queryText: string, triggerSpeech = true) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };

    // 1. First, check if this is a direct lab voice command (voltage, reset, probe, power, tab navigation)
    const commandResult = parseAndExecuteVoiceCommand(trimmed, pins, {
      setVoltage: onSetVoltage,
      resetLab: onResetLab,
      attachProbeToPin: onAttachProbeToPin,
      setPowerSupplyOutput: onSetPowerSupplyOutput,
      switchTab: (tab) => onNavigateTab(tab),
    });

    if (commandResult.matched) {
      const botMsg: ChatMessage = {
        id: `b_${Date.now() + 1}`,
        role: 'assistant',
        text: `⚡ **Voice Command Executed**: ${commandResult.actionDescription}\n\n${commandResult.spokenReply}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg, botMsg].slice(-MAX_CHAT_MESSAGES));
      setInput('');
      if (triggerSpeech) {
        offlineVoiceAssistant.speak(commandResult.spokenReply);
      }
      return;
    }

    // 2. Otherwise, fallback to MiniSearch RAG knowledge query
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

    if (triggerSpeech) {
      offlineVoiceAssistant.speak(reply.answer);
    }
  };

  const handleToggleVoiceInput = () => {
    if (voiceState.isListening) {
      offlineVoiceAssistant.stopListening();
    } else {
      offlineVoiceAssistant.startListening((spokenText) => {
        if (spokenText) {
          sendQuery(spokenText, true);
        }
      });
    }
  };

  const handleToggleAutoSpeak = () => {
    offlineVoiceAssistant.toggleAutoSpeak();
  };

  const handleSpeakMessage = (text: string) => {
    if (voiceState.isSpeaking) {
      offlineVoiceAssistant.stopSpeaking();
    } else {
      offlineVoiceAssistant.speak(text, true);
    }
  };

  const handleResetChat = () => {
    offlineVoiceAssistant.stopSpeaking();
    offlineVoiceAssistant.stopListening();
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        text: `Chat cleared. Local MiniSearch index has **${botEngine.indexedCount} records** loaded and voice command bridge active.`,
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
                  Offline Assistant & Voice Command Bridge
                </h2>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5" />
                  100% OFFLINE
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-cyan-400" />
                  Voice-to-Command Active
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                {botEngine.indexedCount} Records Indexed · Commands: "Set voltage to 12V", "Attach probe to pin 7", "Reset lab"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Auto-Speak Toggle */}
            <button
              onClick={handleToggleAutoSpeak}
              className={`p-1.5 rounded-lg border transition flex items-center gap-1 text-[11px] font-mono ${
                voiceState.autoSpeakReplies
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title={
                voiceState.autoSpeakReplies
                  ? 'Voice Assistant Speech Output ON (Click to Mute)'
                  : 'Voice Assistant Speech Output Muted (Click to Enable)'
              }
            >
              {voiceState.autoSpeakReplies ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              <span className="hidden sm:inline text-[10px]">
                {voiceState.autoSpeakReplies ? 'Voice ON' : 'Muted'}
              </span>
            </button>

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

        {/* Quick Voice Command Chips */}
        <div className="px-4 py-2 bg-[#080b12] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          {STARTER_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => sendQuery(p)}
              className="text-[10px] px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 whitespace-nowrap transition"
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
              <div className="flex items-center gap-2">
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs font-sans leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-cyan-700 text-white rounded-br-none shadow-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>

                {msg.role === 'assistant' && voiceState.hasSpeechSynthesis && (
                  <button
                    onClick={() => handleSpeakMessage(msg.text)}
                    className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition shrink-0"
                    title={voiceState.isSpeaking ? 'Stop speaking' : 'Read message aloud (offline voice)'}
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${voiceState.isSpeaking ? 'text-emerald-400' : ''}`} />
                  </button>
                )}
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
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-cyan-300 transition font-sans"
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

        {/* Voice Listening Wave Indicator */}
        {voiceState.isListening && (
          <div className="px-4 py-1.5 bg-cyan-950/90 border-t border-cyan-500/40 flex items-center justify-between text-[11px] text-cyan-200 shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-bold">Listening for voice command or query...</span>
              <span className="text-slate-400 font-sans text-[10px]">
                (Try: "Set voltage to 12 volts", "Attach probe to pin 7", "Reset lab")
              </span>
            </div>
            <button
              onClick={() => offlineVoiceAssistant.stopListening()}
              className="text-[10px] text-rose-300 hover:text-white px-2 py-0.5 rounded bg-rose-950 border border-rose-700"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Input Form with Offline Voice Mic Button */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuery(input);
          }}
          className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0"
        >
          {voiceState.hasSpeechRecognition && (
            <button
              type="button"
              onClick={handleToggleVoiceInput}
              className={`p-2 rounded-lg border transition flex items-center justify-center ${
                voiceState.isListening
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] animate-pulse'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50'
              }`}
              title={
                voiceState.isListening
                  ? 'Listening... Click to stop voice input'
                  : 'Click to speak lab command hands-free (Web Speech Voice)'
              }
            >
              {voiceState.isListening ? (
                <Mic className="w-4 h-4 text-slate-950" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              voiceState.isListening
                ? 'Listening to your voice command...'
                : 'Type or speak command ("Set voltage to 12V", "Attach probe to pin 7", "Reset lab")...'
            }
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
