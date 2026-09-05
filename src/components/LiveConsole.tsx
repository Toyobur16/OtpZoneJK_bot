import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Copy, Check, Search, Pause, Play, Square, RotateCw } from 'lucide-react';
import { LogEntry } from '../types';

interface LiveConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
  lang: 'bn' | 'en';
  botName?: string;
  botStatus?: 'running' | 'stopped' | 'starting' | 'error';
  onStart?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  loading?: boolean;
}

export const LiveConsole: React.FC<LiveConsoleProps> = ({
  logs,
  onClear,
  lang,
  botName,
  botStatus = 'stopped',
  onStart,
  onStop,
  onRestart,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  const isRunning = botStatus === 'running';

  const filteredLogs = logs.filter(log =>
    log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.level.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (autoScroll && consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = () => {
    const text = filteredLogs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLogBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'otp':
        return <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded text-[10px] font-bold">OTP</span>;
      case 'error':
        return <span className="text-rose-400 bg-rose-950/60 border border-rose-800/60 px-1.5 py-0.5 rounded text-[10px] font-bold">ERROR</span>;
      case 'warn':
        return <span className="text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded text-[10px] font-bold">WARN</span>;
      case 'system':
        return <span className="text-purple-400 bg-purple-950/60 border border-purple-800/60 px-1.5 py-0.5 rounded text-[10px] font-bold">SYS</span>;
      default:
        return <span className="text-sky-400 bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.5 rounded text-[10px] font-mono">INFO</span>;
    }
  };

  const getTextColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'otp': return 'text-emerald-300 font-semibold';
      case 'error': return 'text-rose-300';
      case 'warn': return 'text-amber-300';
      case 'system': return 'text-purple-300 font-mono';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-xs flex flex-col h-[560px]">
      {/* Console Top Toolbar */}
      <div className="bg-[#fcfdfe] px-5 py-3 border-b border-[#f1f5f9] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-[#0088cc]/10 flex items-center justify-center text-[#0088cc]">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#1e293b]">
                {botName ? botName : (lang === 'bn' ? 'লাইভ টার্মিনাল' : 'Live Terminal')}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isRunning
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                {isRunning ? (lang === 'bn' ? 'চালু' : 'RUNNING') : (lang === 'bn' ? 'বন্ধ' : 'STOPPED')}
              </span>
              <span className="text-[11px] text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded-full font-medium">
                {filteredLogs.length} {lang === 'bn' ? 'লাইন' : 'lines'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Process Controls */}
        <div className="flex items-center gap-2">
          {onStart && onStop && (
            isRunning ? (
              <button
                onClick={onStop}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold flex items-center gap-1.5 text-xs transition-all cursor-pointer disabled:opacity-50"
                title="Stop process"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>{lang === 'bn' ? 'বন্ধ' : 'Stop'}</span>
              </button>
            ) : (
              <button
                onClick={onStart}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold flex items-center gap-1.5 text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Start process"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{lang === 'bn' ? 'চালু' : 'Start'}</span>
              </button>
            )
          )}

          {onRestart && (
            <button
              onClick={onRestart}
              disabled={loading}
              className="p-1.5 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] border border-[#e2e8f0] transition-all cursor-pointer disabled:opacity-50"
              title="Restart process"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}

          <div className="h-4 w-px bg-[#e2e8f0]"></div>

          {/* Search & Action Buttons */}
          <div className="relative w-36 sm:w-48">
            <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={lang === 'bn' ? 'লগ খুঁজুন...' : 'Filter logs...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc] focus:border-transparent transition-all"
            />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              autoScroll 
                ? 'bg-[#0088cc]/10 border-[#0088cc]/30 text-[#0088cc]' 
                : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9]'
            }`}
            title={autoScroll ? "Auto-scroll ON" : "Auto-scroll PAUSED"}
          >
            {autoScroll ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] transition-all cursor-pointer"
            title="Copy logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClear}
            className="p-1.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal View Body */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#0f172a] font-mono text-[12.5px] leading-relaxed select-text space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-12">
            <Terminal className="w-8 h-8 mb-2 opacity-40 text-slate-400" />
            <p className="text-slate-400">{lang === 'bn' ? 'কোনো লগ ডাটা নেই বা বট এখনও চালু হয়নি।' : 'No logs captured yet. Start the bot to see real-time output.'}</p>
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'bn' ? 'উপরে "চালু" বাটনে ক্লিক করুন।' : 'Click "Start" above to launch the process.'}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5 hover:bg-slate-800/40 px-2 py-0.5 rounded transition-colors group">
              <span className="text-slate-500 select-none text-[11px] pt-0.5 whitespace-nowrap">
                {log.timestamp}
              </span>
              <span className="select-none pt-0.5">
                {getLogBadge(log.level)}
              </span>
              <span className={`flex-1 break-all whitespace-pre-wrap ${getTextColor(log.level)}`}>
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={consoleBottomRef} />
      </div>
    </div>
  );
};
