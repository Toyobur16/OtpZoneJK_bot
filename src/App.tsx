import React, { useState, useEffect } from 'react';
import { Layers, Terminal, FileCode, Globe, Users, Cloud, Radio, ShieldCheck, X, Plus } from 'lucide-react';
import { Header } from './components/Header';
import { BotList } from './components/BotList';
import { LiveConsole } from './components/LiveConsole';
import { ScriptEditor } from './components/ScriptEditor';
import { ServicesManager } from './components/ServicesManager';
import { UsersManager } from './components/UsersManager';
import { HostingGuide } from './components/HostingGuide';
import { BroadcastModal } from './components/BroadcastModal';
import { NewBotModal } from './components/NewBotModal';
import { PipManagerModal } from './components/PipManagerModal';
import { HostedBot, LogEntry } from './types';

export default function App() {
  const [bots, setBots] = useState<HostedBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bots' | 'terminal' | 'script' | 'services' | 'users' | 'guide'>('bots');
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [showNewBotModal, setShowNewBotModal] = useState(false);
  const [showPipModal, setShowPipModal] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [tokenModalData, setTokenModalData] = useState<any>(null);

  // Fetch bots list
  const fetchBots = async () => {
    try {
      const res = await fetch('/api/bots');
      const data = await res.json();
      if (data.bots && Array.isArray(data.bots)) {
        setBots(data.bots);
        if (!selectedBotId && data.bots.length > 0) {
          setSelectedBotId(data.bots[0].id);
        }
      }
    } catch {
      // Ignore
    }
  };

  // Fetch logs for the selected bot
  const fetchLogs = async (botId: string | null) => {
    if (!botId) return;
    try {
      const res = await fetch(`/api/bots/${botId}/logs?limit=400`);
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      fetchLogs(selectedBotId);
    }
    const interval = setInterval(() => {
      fetchBots();
      if (selectedBotId) {
        fetchLogs(selectedBotId);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedBotId]);

  const selectedBot = bots.find((b) => b.id === selectedBotId) || bots[0];

  const handleStartBot = async (botId: string) => {
    setLoading(true);
    try {
      await fetch(`/api/bots/${botId}/start`, { method: 'POST' });
      await fetchBots();
      await fetchLogs(botId);
    } finally {
      setLoading(false);
    }
  };

  const handleStopBot = async (botId: string) => {
    setLoading(true);
    try {
      await fetch(`/api/bots/${botId}/stop`, { method: 'POST' });
      await fetchBots();
      await fetchLogs(botId);
    } finally {
      setLoading(false);
    }
  };

  const handleRestartBot = async (botId: string) => {
    setLoading(true);
    try {
      await fetch(`/api/bots/${botId}/restart`, { method: 'POST' });
      await fetchBots();
      await fetchLogs(botId);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBot = async (botId: string) => {
    setLoading(true);
    try {
      await fetch(`/api/bots/${botId}`, { method: 'DELETE' });
      const nextBots = bots.filter((b) => b.id !== botId);
      setBots(nextBots);
      if (selectedBotId === botId) {
        setSelectedBotId(nextBots.length > 0 ? nextBots[0].id : null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!selectedBotId) return;
    try {
      await fetch(`/api/bots/${selectedBotId}/clear-logs`, { method: 'POST' });
      setLogs([]);
    } catch {
      // Ignore
    }
  };

  const handleTestToken = async () => {
    if (!selectedBot) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bots/${selectedBot.id}/test-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setTokenModalData(data);
    } catch (e: any) {
      setTokenModalData({ ok: false, description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBotCreated = (newBot: HostedBot) => {
    setBots((prev) => [...prev, newBot]);
    setSelectedBotId(newBot.id);
    setActiveTab('terminal');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] flex flex-col font-sans selection:bg-[#0088cc]/20">
      {/* Top Header Bar */}
      <Header
        bots={bots}
        selectedBotId={selectedBotId}
        onSelectBot={(id) => setSelectedBotId(id)}
        onOpenNewBotModal={() => setShowNewBotModal(true)}
        onOpenPipModal={() => setShowPipModal(true)}
        onTestToken={handleTestToken}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-[#e2e8f0] shadow-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab('bots')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'bots'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'হোস্টকৃত বটসমূহ' : 'Hosted Bots'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'bots' ? 'bg-white/20 text-white' : 'bg-[#e2e8f0] text-[#64748b]'
              }`}>
                {bots.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'terminal'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'টার্মিনাল ও লগ' : 'Terminal & Logs'}</span>
            </button>

            <button
              onClick={() => setActiveTab('script')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'script'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'কোড ও ফাইল আপলোড' : 'Code & Files'}</span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'services'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'সার্ভিস ও রেঞ্জ' : 'Services & Rates'}</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ইউজার ও পেমেন্ট' : 'Users & Balances'}</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-[#0088cc] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0088cc] hover:bg-[#f8fafc]'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? '২৪/৭ ফ্রি নির্দেশিকা' : '24/7 Free Guide'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBroadcast(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0088cc]/10 hover:bg-[#0088cc]/15 text-[#0088cc] border border-[#0088cc]/20 transition-all cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-[#0088cc]" />
              <span>{lang === 'bn' ? 'ব্রডকাস্ট নোটিশ' : 'Broadcast Notice'}</span>
            </button>
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === 'bots' && (
          <BotList
            bots={bots}
            selectedBotId={selectedBotId}
            onSelectBot={(id) => {
              setSelectedBotId(id);
              setActiveTab('terminal');
            }}
            onStartBot={handleStartBot}
            onStopBot={handleStopBot}
            onRestartBot={handleRestartBot}
            onDeleteBot={handleDeleteBot}
            onOpenNewBotModal={() => setShowNewBotModal(true)}
            lang={lang}
          />
        )}

        {activeTab === 'terminal' && (
          <LiveConsole
            logs={logs}
            onClear={handleClearLogs}
            lang={lang}
            botName={selectedBot?.name}
            botStatus={selectedBot?.status}
            onStart={() => selectedBot && handleStartBot(selectedBot.id)}
            onStop={() => selectedBot && handleStopBot(selectedBot.id)}
            onRestart={() => selectedBot && handleRestartBot(selectedBot.id)}
            loading={loading}
          />
        )}

        {activeTab === 'script' && (
          <ScriptEditor
            lang={lang}
            botId={selectedBot?.id}
            botName={selectedBot?.name}
            onFileSaved={() => {
              fetchBots();
              if (selectedBotId) fetchLogs(selectedBotId);
            }}
          />
        )}

        {activeTab === 'services' && (
          <ServicesManager
            lang={lang}
            botId={selectedBot?.id}
            botName={selectedBot?.name}
          />
        )}

        {activeTab === 'users' && (
          <UsersManager lang={lang} />
        )}

        {activeTab === 'guide' && (
          <HostingGuide
            lang={lang}
            botId={selectedBot?.id}
            botName={selectedBot?.name}
          />
        )}
      </main>

      {/* New Bot Modal */}
      {showNewBotModal && (
        <NewBotModal
          onClose={() => setShowNewBotModal(false)}
          onCreated={handleBotCreated}
          lang={lang}
        />
      )}

      {/* Pip Manager Modal */}
      {showPipModal && (
        <PipManagerModal
          onClose={() => setShowPipModal(false)}
          lang={lang}
        />
      )}

      {/* Broadcast Modal */}
      <BroadcastModal
        isOpen={showBroadcast}
        onClose={() => setShowBroadcast(false)}
        lang={lang}
      />

      {/* Token Verification Modal */}
      {tokenModalData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9] mb-4">
              <h3 className="text-sm font-bold text-[#1e293b] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0088cc]" />
                {lang === 'bn' ? 'টেলিগ্রাম বট টোকেন যাচাই' : 'Telegram Bot API Test'}
              </h3>
              <button onClick={() => setTokenModalData(null)} className="text-[#94a3b8] hover:text-[#1e293b] p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {tokenModalData.ok ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
                  <span>✅ Token is Active & Valid!</span>
                </div>
                <div className="space-y-1.5 bg-[#f8fafc] p-3.5 rounded-xl font-mono text-[11px] text-[#1e293b] border border-[#e2e8f0]">
                  <div>Bot Name: <span className="text-[#1e293b] font-bold">{tokenModalData.result?.first_name}</span></div>
                  <div>Username: <span className="text-[#0088cc] font-semibold">@{tokenModalData.result?.username}</span></div>
                  <div>ID: <span className="text-[#64748b]">{tokenModalData.result?.id}</span></div>
                  <div>Can Join Groups: <span className="text-emerald-600 font-semibold">{String(tokenModalData.result?.can_join_groups)}</span></div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <p className="font-bold">❌ Connection Failed:</p>
                <p className="mt-1 font-mono text-[11px] text-rose-700">{tokenModalData.description || tokenModalData.error || 'Invalid token'}</p>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setTokenModalData(null)}
                className="px-4 py-2 bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] text-xs font-semibold rounded-xl border border-[#e2e8f0] cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="px-8 py-3.5 bg-white border-t border-[#e2e8f0] text-[#94a3b8] text-xs flex flex-wrap items-center justify-between gap-2">
        <span>&copy; BotHost Live • Free Unlimited Telegram Bot & Python Script Cloud Host</span>
        <span>Platform Engine: <span className="text-emerald-600 font-bold uppercase tracking-wider">Multi-Process Active (24/7)</span></span>
      </footer>
    </div>
  );
}
