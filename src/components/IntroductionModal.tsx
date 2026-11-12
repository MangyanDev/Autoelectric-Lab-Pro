import React from 'react';
import {
  Zap,
  Activity,
  Cpu,
  ShieldCheck,
  Award,
  BookOpen,
  ArrowRight,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Sparkles,
} from 'lucide-react';

interface IntroductionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IntroductionModal: React.FC<IntroductionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-950 border-2 border-cyan-500/70 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.3)] overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header Banner with Logo & Badges */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <img
              src="/assets/aistudio/file_0000000098d48211abb177ce752b7b0e_62980da7.png"
              alt="AutoElectric Lab Pro Official Logo"
              className="h-16 md:h-20 w-auto object-contain rounded-xl border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 border border-cyan-600 text-cyan-300 tracking-wider">
                  OFFICIAL ENTERPRISE EDITION
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 border border-amber-600 text-amber-300 tracking-wider">
                  v2.5 PRO LAB
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-wide mt-1">
                AutoElectric Lab Pro
              </h1>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Your Smart Bench Companion for Automotive Electronics & ECU Diagnostics
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full md:w-auto px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.5)] transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Launch Virtual Bench</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 text-slate-200">
          
          {/* Executive Leadership & Ownership Credentials Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-inner">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>EXECUTIVE LEADERSHIP & CREDENTIALS</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Head Developer & Owner */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-cyan-500/40 flex items-start gap-3 relative overflow-hidden group">
                <div className="w-10 h-10 rounded-lg bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-300 font-bold text-base shrink-0 shadow-md">
                  RL
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm">Ruben Llego</h3>
                    <span className="text-[9.5px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold border border-cyan-800 uppercase">
                      Owner & Head Dev
                    </span>
                  </div>
                  <p className="text-[11px] text-cyan-400 font-sans font-medium mt-0.5">
                    Lead Systems Architect & Core Physics Engine Creator
                  </p>
                  <p className="text-[10px] text-slate-400 font-sans mt-1 leading-relaxed">
                    Designed the MNA circuit solver matrix, ECU pinout diagnostics engine, and AI visual track mapping framework.
                  </p>
                </div>
              </div>

              {/* Co-Owner & VIP Investor */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-amber-500/40 flex items-start gap-3 relative overflow-hidden group">
                <div className="w-10 h-10 rounded-lg bg-amber-950 border border-amber-500 flex items-center justify-center text-amber-300 font-bold text-base shrink-0 shadow-md">
                  ED
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm">Elnombre Danong</h3>
                    <span className="text-[9.5px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-800 uppercase">
                      Co-Owner & VIP Investor
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-400 font-sans font-medium mt-0.5">
                    Strategic Investor & Product Operations Sponsor
                  </p>
                  <p className="text-[10px] text-slate-400 font-sans mt-1 leading-relaxed">
                    Sponsors hardware lab expansions, enterprise deployment, and strategic automotive technician tool integrations.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Laboratory Instructions & Key Features Guide */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>LABORATORY BENCH INSTRUCTIONS & CAPABILITIES</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Feature 1 */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                  <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-600 flex items-center justify-center text-cyan-400">
                    1
                  </div>
                  <span>ECU Bench & Power</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  Configure the 0–30V DC Bench Power Supply, adjust current limits, and select presets (12V Bench, 5V Sensor Rail, 14.4V Charging).
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                  <div className="w-6 h-6 rounded bg-amber-950 border border-amber-600 flex items-center justify-center text-amber-400">
                    2
                  </div>
                  <span>Digital Multimeter (DMM)</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  Attach Red (+) and Black (-) probes to any ECU pin, component pad, or ground. Auto-scales mV to kV and Ω to MΩ.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                  <div className="w-6 h-6 rounded bg-rose-950 border border-rose-600 flex items-center justify-center text-rose-400">
                    3
                  </div>
                  <span>Fault Injection Matrix</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  Introduce electrical anomalies (Short to GND, Short to VBAT, High Corrosion, Open Wires) to observe live Diagnostic Trouble Codes ($P0122, P0123$).
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                  <div className="w-6 h-6 rounded bg-emerald-950 border border-emerald-600 flex items-center justify-center text-emerald-400">
                    4
                  </div>
                  <span>Harness Wiring Canvas</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  Interactively connect auxiliary harness wires, cut/uncut leads to simulate broken harnesses, and inspect node voltages.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                  <div className="w-6 h-6 rounded bg-purple-950 border border-purple-600 flex items-center justify-center text-purple-400">
                    5
                  </div>
                  <span>PCB / AI Track Mapper</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  Inspect detected IC components, hover datasheets, and click trace lines or pin pads to highlight full electrical net connectivity paths.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                  <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-600 flex items-center justify-center text-cyan-400">
                    6
                  </div>
                  <span>Oscilloscope Signal Waveforms</span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  Monitor live PWM signal waveforms, injector MOSFET inductive flyback spikes (&gt;40V), and 60-2 tooth crankshaft VR sine waves.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="bg-slate-900 border-t border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Bosch ME7.5 ECU Engine Architecture Certified</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Enter Laboratory Workstation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
