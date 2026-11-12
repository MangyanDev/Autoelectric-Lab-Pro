import React, { useState } from 'react';
import {
  Search,
  ExternalLink,
  Globe,
  Cpu,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Copy,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import {
  performGroundedSearch,
  GroundedSearchResult,
  GroundedSearchSource,
} from '../services/groundedSearchService';

interface GroundedSearchPanelProps {
  initialQuery?: string;
  initialDtc?: string;
  initialEcu?: string;
  onApplyPinTarget?: (pinId: string) => void;
  className?: string;
}

const PRESET_QUERIES = [
  {
    label: 'Nissan MEC11/MEC22 K-Line Wakeup',
    query: 'Hitachi MEC11-251 MEC22-251 Nissan N16 QG16 bench pinout K-line Pin 88 wake-up wiring',
    ecu: 'Hitachi MEC11-251 / MEC22-251',
    dtc: 'K-LINE / NO-COMM',
  },
  {
    label: 'Toyota 1KD-FTV P0093 & Dual-CPU',
    query: 'Toyota Hilux 1KD-FTV 2KD-FTV DTC P0093 fuel leak CPU 2 fast flashing engine light crystal oscillator',
    ecu: 'Denso 1KD/2KD Dual-CPU',
    dtc: 'P0093',
  },
  {
    label: 'Marelli 5NF TLE9135PD Jumper',
    query: 'Magneti Marelli IAW 5NF TLE9135PD pin 10 water temperature sensor jumper pin 35 36 1R resistor',
    ecu: 'Magneti Marelli IAW 5NF',
    dtc: 'IAW-5NF-TEMP',
  },
  {
    label: 'P0122 TPS Low Voltage Bench Test',
    query: 'DTC P0122 Throttle Position Sensor Circuit Low Input bench diagnostic voltage 5V reference ground test',
    ecu: 'Universal Bench Testing',
    dtc: 'P0122',
  },
  {
    label: 'CAN Bus 60Ω Termination Fault',
    query: 'CAN Bus 60 Ohm split termination 120 ohm resistance fault U0100 bench diagnostic oscilloscope',
    ecu: 'High-Speed Powertrain CAN',
    dtc: 'U0100',
  },
  {
    label: 'Bosch ME7.5 Boot Pin 65 Recovery',
    query: 'Bosch ME7.5 C167 ST10 boot mode pin 65 1k ohm ground bench flash K-Line recovery',
    ecu: 'Bosch ME7.5 / ME7.1.1',
    dtc: 'P0606',
  },
  {
    label: 'Ford SID208 18V FEPS Protocol',
    query: 'Ford Ranger SID208 PCM bench flashing 18V FEPS Pin B12 programming voltage HS-CAN',
    ecu: 'Ford Continental SID208',
    dtc: 'P0215',
  },
];

export const GroundedSearchPanel: React.FC<GroundedSearchPanelProps> = ({
  initialQuery = '',
  initialDtc = '',
  initialEcu = '',
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [ecuModel, setEcuModel] = useState(initialEcu);
  const [dtcCode, setDtcCode] = useState(initialDtc);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GroundedSearchResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async (queryText?: string, ecuOverride?: string, dtcOverride?: string) => {
    const q = queryText !== undefined ? queryText : searchQuery;
    const ecu = ecuOverride !== undefined ? ecuOverride : ecuModel;
    const dtc = dtcOverride !== undefined ? dtcOverride : dtcCode;

    if (!q.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const res = await performGroundedSearch({
        query: q.trim(),
        ecuModel: ecu.trim() || undefined,
        dtcCode: dtc.trim() || undefined,
        contextType: 'ECU_BENCH_TESTING',
      });
      setResult(res);
    } catch (err: unknown) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_QUERIES[0]) => {
    setSearchQuery(preset.query);
    setEcuModel(preset.ecu);
    setDtcCode(preset.dtc);
    handleSearch(preset.query, preset.ecu, preset.dtc);
  };

  const handleCopyReport = () => {
    if (!result?.answer) return;
    navigator.clipboard.writeText(result.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md font-mono ${className}`}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-inner">
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-slate-100 tracking-wide">
                Google Search Grounded OEM Diagnostic Intel
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-950/80 border border-blue-600 text-blue-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-400" />
                Gemini 4 Hydrogen + Search Tool
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Live retrieval of factory service bulletins, OEM pinouts, verified failure patterns & real-world repair data
            </p>
          </div>
        </div>

        {result && (
          <button
            onClick={handleCopyReport}
            className="self-start sm:self-auto flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Intel</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Query Preset Badges */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
          Automotive Bench Presets (Click to Search Live Google Grounding):
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(preset)}
              disabled={isLoading}
              className="text-[10px] px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/70 hover:text-cyan-300 text-slate-300 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Search Input Form */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSearch();
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ECU part number, DTC code, pinout wiring, or failure mode..."
            disabled={isLoading}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
          />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={ecuModel}
            onChange={e => setEcuModel(e.target.value)}
            placeholder="ECU (Optional)"
            disabled={isLoading}
            className="w-32 sm:w-36 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-center font-mono"
          />

          <input
            type="text"
            value={dtcCode}
            onChange={e => setDtcCode(e.target.value)}
            placeholder="DTC (Opt)"
            disabled={isLoading}
            className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-amber-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-center font-mono uppercase"
          />

          <button
            type="submit"
            disabled={isLoading || !searchQuery.trim()}
            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
          >
            {isLoading ? (
              <>
                <Radio className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Searching Google...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Search Live</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Loading state indicator */}
      {isLoading && (
        <div className="p-6 rounded-lg bg-slate-950/80 border border-cyan-800/50 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin flex items-center justify-center">
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-slate-200">Executing Google Search Grounding with Gemini 4 Hydrogen</p>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Querying OEM automotive databases, technical service bulletins, and bench wiring specifications...
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {result?.status === 'ERROR' && (
        <div className="p-3.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-bold">Google Grounding Query Notice:</span>
            <span className="font-sans text-[11px]">{result.error || result.answer}</span>
          </div>
        </div>
      )}

      {/* Grounding Results Display */}
      {result?.status === 'SUCCESS' && (
        <div className="flex flex-col gap-3">
          {/* Grounding Metadata Pill Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[10px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400">GROUNDING ENGINE:</span>
              <span className="text-cyan-400 font-bold">{result.model}</span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">SEARCH SOURCES:</span>
              <span className="text-emerald-400 font-bold">{result.sources.length} Verified Web Sources</span>
            </div>
            {result.searchQueries.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500">QUERIES:</span>
                {result.searchQueries.map((q, idx) => (
                  <span
                    key={idx}
                    className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-mono text-[9px]"
                  >
                    "{q}"
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Web Sources Grid (Grounding Links) */}
          {result.sources.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <ExternalLink className="w-3 h-3 text-cyan-400" />
                <span>Verified OEM & Automotive Technical Sources:</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {result.sources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-950 hover:bg-slate-800/80 p-2.5 rounded-lg border border-slate-800 hover:border-cyan-500/60 transition flex flex-col justify-between gap-1 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-sans font-semibold text-xs text-slate-200 group-hover:text-cyan-300 line-clamp-1">
                        {source.title}
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0 mt-0.5" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono truncate">{source.domain}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Diagnostic Answer / Technical Guide Body */}
          <div className="bg-slate-950 p-4 rounded-xl border border-cyan-900/60 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-xs text-slate-200 uppercase tracking-wider">
                  Grounding Diagnostic Analysis & Bench Procedures
                </span>
              </div>
              <span className="text-[10px] text-slate-500">
                Retrieved: {new Date(result.timestamp).toLocaleTimeString()}
              </span>
            </div>

            {/* Structured Markdown Rendering */}
            <div className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap break-words selection:bg-cyan-900">
              {result.answer}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
