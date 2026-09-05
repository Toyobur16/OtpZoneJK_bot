import React, { useState, useEffect } from 'react';
import { X, Package, Download, CheckCircle2, AlertCircle, RefreshCw, Terminal } from 'lucide-react';

interface PipManagerModalProps {
  onClose: () => void;
  lang: 'bn' | 'en';
}

const COMMON_PACKAGES = [
  { name: 'python-telegram-bot', desc: 'Modern async Telegram Bot framework' },
  { name: 'telebot', desc: 'pyTelegramBotAPI (synchronous & easy)' },
  { name: 'aiogram', desc: 'High-performance async framework' },
  { name: 'httpx', desc: 'Next-gen HTTP client for Python' },
  { name: 'requests', desc: 'Classic HTTP library for Python' },
  { name: 'pyotp', desc: 'Two-Factor Authentication & OTP generator' },
  { name: 'pillow', desc: 'Python Imaging Library for image processing' },
  { name: 'beautifulsoup4', desc: 'Web scraping and HTML parsing' },
  { name: 'pymongo', desc: 'MongoDB database connector' }
];

export const PipManagerModal: React.FC<PipManagerModalProps> = ({ onClose, lang }) => {
  const [packages, setPackages] = useState<{ name: string; version: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [pkgInput, setPkgInput] = useState('');
  const [installing, setInstalling] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pip/packages');
      const data = await res.json();
      if (data.packages) {
        setPackages(data.packages);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleInstall = async (pkgName: string) => {
    if (!pkgName.trim()) return;
    setInstalling(true);
    setError(null);
    setOutput(null);

    try {
      const res = await fetch('/api/pip/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: pkgName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setOutput(data.output || 'Package installed successfully!');
        setPkgInput('');
        fetchPackages();
      } else {
        setError(data.error || 'Failed to install package');
        if (data.output) setOutput(data.output);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 max-w-2xl w-full shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#f1f5f9] mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0088cc]/10 flex items-center justify-center text-[#0088cc]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1e293b]">
                {lang === 'bn' ? 'পাইথন প্যাকেজ ম্যানেজার (pip)' : 'Python Package Manager (pip)'}
              </h3>
              <p className="text-xs text-[#64748b]">
                {lang === 'bn'
                  ? 'আপনার টেলিগ্রাম বটের প্রয়োজনীয় যেকোনো লাইব্রেরি ফ্রিতে ইনস্টল করুন।'
                  : 'Install any Python library needed for your Telegram bots.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#1e293b] p-1.5 rounded-lg hover:bg-[#f8fafc] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Install Input */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-[#1e293b] mb-1.5">
            {lang === 'bn' ? 'প্যাকেজের নাম লিখুন' : 'Package Name to Install'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pkgInput}
              onChange={(e) => setPkgInput(e.target.value)}
              placeholder="e.g. telebot, aiogram, requests..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs font-mono text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleInstall(pkgInput);
                }
              }}
            />
            <button
              onClick={() => handleInstall(pkgInput)}
              disabled={!pkgInput.trim() || installing}
              className="px-4 py-2.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-sm shadow-[#0088cc]/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{installing ? (lang === 'bn' ? 'ইনস্টল হচ্ছে...' : 'Installing...') : (lang === 'bn' ? 'ইনস্টল করুন' : 'Install')}</span>
            </button>
          </div>
        </div>

        {/* Quick Suggestions */}
        <div className="mb-4">
          <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider block mb-1.5">
            {lang === 'bn' ? 'জনপ্রিয় টেলিগ্রাম লাইব্রেরি:' : 'Popular Telegram Bot Libraries:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_PACKAGES.map((p) => {
              const isInstalled = packages.some((pkg) => pkg.name.toLowerCase() === p.name.toLowerCase());
              return (
                <button
                  key={p.name}
                  onClick={() => handleInstall(p.name)}
                  disabled={installing}
                  title={p.desc}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1 cursor-pointer ${
                    isInstalled
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#1e293b] border border-[#e2e8f0]'
                  }`}
                >
                  {isInstalled && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Install Console Output */}
        {output && (
          <div className="mb-4 p-3 rounded-xl bg-[#0f172a] text-[#f8fafc] font-mono text-[11px] max-h-36 overflow-y-auto">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1 border-b border-slate-800 pb-1 text-[10px]">
              <Terminal className="w-3 h-3 text-[#0088cc]" />
              <span>pip output</span>
            </div>
            <pre className="whitespace-pre-wrap">{output}</pre>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Installed Packages List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#1e293b]">
              {lang === 'bn' ? `ইনস্টলকৃত প্যাকেজসমূহ (${packages.length})` : `Installed Packages (${packages.length})`}
            </span>
            <button
              onClick={fetchPackages}
              disabled={loading}
              className="text-xs text-[#0088cc] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-xl border border-[#e2e8f0] divide-y divide-[#f1f5f9] bg-[#f8fafc]">
            {packages.map((pkg, idx) => (
              <div key={idx} className="px-3 py-1.5 flex items-center justify-between text-xs font-mono">
                <span className="text-[#1e293b] font-medium">{pkg.name}</span>
                <span className="text-[#64748b] bg-white px-2 py-0.5 rounded border border-[#e2e8f0] text-[11px]">
                  {pkg.version}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] text-xs font-semibold border border-[#e2e8f0] cursor-pointer"
          >
            {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
