export interface VoiceAssistantState {
  isSupported: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  hasSpeechRecognition: boolean;
  hasSpeechSynthesis: boolean;
  autoSpeakReplies: boolean;
  selectedVoiceName: string | null;
  error: string | null;
}

export type VoiceStateListener = (state: VoiceAssistantState) => void;

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

/**
 * 100% Free, Offline-Capable Voice Assistant Controller
 * Built on standard W3C Web Speech API (SpeechRecognition / webkitSpeechRecognition + SpeechSynthesis).
 * Zero cloud dependency, zero external API key, zero latency, zero quota.
 */
class OfflineVoiceAssistantService {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private listeners: Set<VoiceStateListener> = new Set();
  private autoSpeak = true;
  private isListening = false;
  private isSpeaking = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private lastError: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const win = window as unknown as IWindowWithSpeech;
      const RecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (RecognitionClass) {
        try {
          this.recognition = new RecognitionClass();
          this.recognition.continuous = false;
          this.recognition.interimResults = false;
          this.recognition.lang = 'en-US';

          this.recognition.onstart = () => {
            this.isListening = true;
            this.lastError = null;
            this.emitState();
          };

          this.recognition.onend = () => {
            this.isListening = false;
            this.emitState();
          };

          this.recognition.onerror = (event: any) => {
            this.isListening = false;
            // 'no-speech' is a normal timeout event when user stays quiet
            if (event.error !== 'no-speech') {
              this.lastError = `Voice input notice: ${event.error}`;
            }
            this.emitState();
          };
        } catch (e) {
          console.warn('SpeechRecognition initialization error:', e);
          this.recognition = null;
        }
      }

      if ('speechSynthesis' in window) {
        this.synthesis = window.speechSynthesis;
        this.initVoice();
        if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
          window.speechSynthesis.onvoiceschanged = () => this.initVoice();
        }
      }
    }
  }

  private initVoice() {
    if (!this.synthesis) return;
    const voices = this.synthesis.getVoices();
    if (!voices || voices.length === 0) return;

    // Prefer high-clarity natural English automotive/technical voice
    const preferred =
      voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Enhanced'))) ||
      voices.find((v) => v.lang.startsWith('en') && v.default) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0];

    this.selectedVoice = preferred || null;
    this.emitState();
  }

  public getState(): VoiceAssistantState {
    const hasRec = Boolean(this.recognition);
    const hasSyn = Boolean(this.synthesis);
    return {
      isSupported: hasRec || hasSyn,
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      hasSpeechRecognition: hasRec,
      hasSpeechSynthesis: hasSyn,
      autoSpeakReplies: this.autoSpeak,
      selectedVoiceName: this.selectedVoice?.name || null,
      error: this.lastError,
    };
  }

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitState() {
    const s = this.getState();
    this.listeners.forEach((fn) => fn(s));
  }

  public toggleAutoSpeak(): boolean {
    this.autoSpeak = !this.autoSpeak;
    if (!this.autoSpeak) {
      this.stopSpeaking();
    }
    this.emitState();
    return this.autoSpeak;
  }

  public setAutoSpeak(enabled: boolean) {
    this.autoSpeak = enabled;
    if (!enabled) this.stopSpeaking();
    this.emitState();
  }

  /**
   * Listen for user speech and invoke callback with final recognized automotive query.
   */
  public startListening(onResult: (spokenText: string) => void) {
    if (!this.recognition) {
      this.lastError = 'Browser speech recognition not supported. Try Chrome, Edge, or Safari.';
      this.emitState();
      return;
    }

    // Stop speaking first so assistant doesn't hear itself
    this.stopSpeaking();

    try {
      this.recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript && typeof transcript === 'string' && transcript.trim()) {
          onResult(transcript.trim());
        }
      };
      this.recognition.start();
    } catch (e: any) {
      // If already started, restart
      if (e?.name === 'InvalidStateError') {
        try {
          this.recognition.stop();
          setTimeout(() => {
            try {
              this.recognition.start();
            } catch {}
          }, 100);
        } catch {}
      } else {
        console.warn('Speech recognition start failed:', e);
      }
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  /**
   * Cleans technical markdown / bullet symbols for clear, natural speech synthesis.
   */
  public cleanTextForSpeech(rawMarkdown: string): string {
    return rawMarkdown
      .replace(/---/g, ' ')
      .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/•\s+/g, '. ')
      .replace(/-\s+/g, '. ')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/Ω/g, ' Ohms ')
      .replace(/µF/g, ' microfarads ')
      .replace(/µ/g, ' micro ')
      .replace(/KL30/g, ' K L 30 ')
      .replace(/KL15/g, ' K L 15 ')
      .replace(/KL31/g, ' K L 31 chassis ground ')
      .replace(/DTC/g, ' D T C ')
      .replace(/ECU/g, ' E C U ')
      .replace(/TPS/g, ' T P S ')
      .replace(/ECT/g, ' E C T ')
      .replace(/CAN_H/g, ' C A N high ')
      .replace(/CAN_L/g, ' C A N low ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Speak a concise automotive voice response (summarizes the essential diagnostic lead first).
   */
  public speak(text: string, force = false) {
    if (!this.synthesis || (!this.autoSpeak && !force)) return;

    this.stopSpeaking();

    const clean = this.cleanTextForSpeech(text);
    if (!clean) return;

    // Limit spoke utterance to first 2-3 essential diagnostic sentences to keep conversational turnaround fast
    const sentences = clean.split(/(?<=[.?!])\s+/).filter(Boolean);
    const spokenSlice = sentences.slice(0, 3).join(' ').slice(0, 320);

    try {
      const utterance = new SpeechSynthesisUtterance(spokenSlice);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = 1.05; // Slightly brisk, confident technician pacing
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.emitState();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.emitState();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        this.emitState();
      };

      this.synthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis speak error:', e);
      this.isSpeaking = false;
      this.emitState();
    }
  }

  public stopSpeaking() {
    if (this.synthesis) {
      try {
        this.synthesis.cancel();
      } catch {}
      this.isSpeaking = false;
      this.emitState();
    }
  }
}

export const offlineVoiceAssistant = new OfflineVoiceAssistantService();
