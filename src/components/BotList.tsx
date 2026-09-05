import React, { useState } from 'react';
import { Play, Square, RotateCw, Trash2, Download, Terminal, Radio, Check, Copy, AlertCircle, Plus, FileCode, CheckCircle2 } from 'lucide-react';
import { HostedBot } from '../types';

interface BotListProps {
  bots: HostedBot[];
  selectedBotId: string | null;
  onSelectBot: (botId: string) => void;
  onStartBot: (botId: string) => void;
  onStopBot: (botId: string) => void;
  onRestartBot: (botId: string) => void;
  onDeleteBot: (botId: string) => void;
  onOpenNewBotModal: () => void;
  lang: 'bn' | 'en';
}

export const BotList: React.FC<BotListProps> = ({
  bots,
  selectedBotId,
  onSelectBot,
  onStartBot,
  onStopBot,
  onRestartBot,
  onDeleteBot,
  onOpenNewBotModal,
  lang
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const handleCopyPing = (e: React.MouseEvent, botId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/api/keepalive/${botId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(botId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-base font-bold text-[#1e293b] flex items-center gap-2">
            {lang === 'bn' ? 'হোস্টকৃত টেলিগ্রাম বটসমূহ' : 'Hosted Telegram Bots'}
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#0088cc]/10 text-[#0088cc] border border-[#0088cc]/20 font-semibold">
              {bots.length} {lang === 'bn' ? 'টি বট' : 'Bots'}
            </span>
          </h2>
          <p className="text-xs text-[#64748b] mt-0.5">
            {lang === 'bn'
              ? 'এখানে আপনার সমস্ত বট ২৪/৭ ক্লাউডে রান হচ্ছে। নতুন যেকোনো ফাইল বা বট যোগ করতে ডানপাশের বাটনে ক্লিক করুন।'
              : 'All your bots running 24/7 on cloud runner. Click "+ Deploy New Bot" to host any script.'}
          </p>
        </div>

        <button
          onClick={onOpenNewBotModal}
          className="px-4 py-2.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold shadow-sm shadow-[#0088cc]/20 flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'bn' ? '+ নতুন বট হোস্ট করুন' : '+ Deploy New Bot'}</span>
        </button>
      </div>

      {/* Bots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bots.map((bot) => {
          const isSelected = bot.id === selectedBotId;
          const isRunning = bot.status === 'running';
          const isStarting = bot.status === 'starting';

          return (
            <div
              key={bot.id}
              onClick={() => onSelectBot(bot.id)}
              className={`bg-white border rounded-2xl p-5 shadow-xs transition-all cursor-pointer flex flex-col justify-between relative ${
                isSelected
                  ? 'border-[#0088cc] ring-2 ring-[#0088cc]/20'
                  : 'border-[#e2e8f0] hover:border-[#cbd5e1]'
              }`}
            >
              <div>
                {/* Header: Name & Status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#1e293b] truncate" title={bot.name}>
                        {bot.name}
                      </h3>
                      {isSelected && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#0088cc] text-white shrink-0">
                          {lang === 'bn' ? 'সক্রিয়' : 'Selected'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-[#64748b] flex items-center gap-1">
                        <FileCode className="w-3.5 h-3.5 text-[#94a3b8]" />
                        {bot.entryFile}
                      </span>
                      {bot.botUsername && (
                        <span className="text-[11px] font-semibold text-[#0088cc] flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-[#0088cc]" />
                          @{bot.botUsername}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0 ${
                      isRunning
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isStarting
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isRunning ? 'bg-emerald-500 animate-pulse' : isStarting ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                    ></span>
                    {isRunning
                      ? (lang === 'bn' ? 'লাইভ' : 'LIVE')
                      : isStarting
                      ? (lang === 'bn' ? 'শুরু হচ্ছে' : 'STARTING')
                      : (lang === 'bn' ? 'বন্ধ' : 'STOPPED')}
                  </span>
                </div>

                {/* Meta details */}
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-2.5 text-xs text-[#64748b] space-y-1 mb-4">
                  <div className="flex items-center justify-between">
                    <span>{lang === 'bn' ? 'আপটাইম:' : 'Uptime:'}</span>
                    <span className="font-mono text-[#1e293b] font-semibold">
                      {isRunning ? formatUptime(bot.uptimeSeconds) : '0s'}
                    </span>
                  </div>
                  {bot.pid && (
                    <div className="flex items-center justify-between">
                      <span>PID:</span>
                      <span className="font-mono text-[#1e293b]">{bot.pid}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span>{lang === 'bn' ? 'ফাইল সংখ্যা:' : 'Files:'}</span>
                    <span className="font-mono text-[#1e293b]">{bot.fileCount || 1} files</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1">
                  {isRunning ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStopBot(bot.id);
                      }}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                      title={lang === 'bn' ? 'বট বন্ধ করুন' : 'Stop Bot'}
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartBot(bot.id);
                      }}
                      className="p-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white shadow-xs transition-colors cursor-pointer"
                      title={lang === 'bn' ? 'বট চালু করুন' : 'Start Bot'}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestartBot(bot.id);
                    }}
                    className="p-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] transition-colors cursor-pointer"
                    title={lang === 'bn' ? 'রিস্টার্ট করুন' : 'Restart Bot'}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  <a
                    href={`/api/bots/${bot.id}/export/zip`}
                    onClick={(e) => e.stopPropagation()}
                    download
                    className="p-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] transition-colors cursor-pointer"
                    title={lang === 'bn' ? 'জিপ ডাউনলোড করুন' : 'Download Zip'}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={(e) => handleCopyPing(e, bot.id)}
                    className="p-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0] transition-colors cursor-pointer"
                    title={lang === 'bn' ? '24/7 KeepAlive Ping URL কপি করুন' : 'Copy 24/7 KeepAlive Ping URL'}
                  >
                    {copiedId === bot.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Radio className="w-3.5 h-3.5 text-[#0088cc]" />}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBot(bot.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0088cc]/10 text-[#0088cc]'
                        : 'bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b]'
                    }`}
                  >
                    {lang === 'bn' ? 'ম্যানেজ ও লগ' : 'Console'}
                  </button>

                  {bots.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(lang === 'bn' ? `আপনি কি সত্যিই '${bot.name}' মুছে ফেলতে চান?` : `Delete bot '${bot.name}'?`)) {
                          onDeleteBot(bot.id);
                        }
                      }}
                      className="p-2 rounded-xl hover:bg-rose-50 text-[#94a3b8] hover:text-rose-600 transition-colors cursor-pointer"
                      title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete Bot'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
