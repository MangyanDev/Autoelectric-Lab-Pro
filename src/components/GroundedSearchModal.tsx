import React from 'react';
import { X, Globe } from 'lucide-react';
import { GroundedSearchPanel } from './GroundedSearchPanel';

interface GroundedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  initialDtc?: string;
  initialEcu?: string;
}

export const GroundedSearchModal: React.FC<GroundedSearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery,
  initialDtc,
  initialEcu,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-950 border border-cyan-800/80 rounded-2xl shadow-2xl overflow-hidden font-mono text-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-cyan-950 border border-cyan-500/60 flex items-center justify-center">
              <Globe className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 tracking-wide">
                Live Google Search Grounding · ECU Technical Bulletins & Pinouts
              </h2>
              <p className="text-[10px] text-slate-400 font-sans">
                Real-time web intelligence grounded via Gemini 4 Hydrogen and Google Search
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close Search Modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with GroundedSearchPanel */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-[#080b12]">
          <GroundedSearchPanel
            initialQuery={initialQuery}
            initialDtc={initialDtc}
            initialEcu={initialEcu}
            className="border-slate-800/80"
          />
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-sans">
          <span>Bench Verification: Always confirm wiring pinouts with physical multimeter measurements before powering up.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
