import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Globe, Save, CheckCircle2, RefreshCw, Zap, Server, Key, PhoneCall, Radio, AlertCircle } from 'lucide-react';
import { ServiceItem } from '../types';

interface ServicesManagerProps {
  lang: 'bn' | 'en';
  botId?: string;
  botName?: string;
}

export const ServicesManager: React.FC<ServicesManagerProps> = ({ lang, botId, botName }) => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // SMS Panel config states
  const [baseUrl, setBaseUrl] = useState('https://minosms.com');
  const [apiKey, setApiKey] = useState('');
  const [botToken, setBotToken] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  // API test state
  const [testingApi, setTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // New service inputs
  const [newServiceName, setNewServiceName] = useState('');
  const [selectedServiceIndex, setSelectedServiceIndex] = useState<number>(0);
  const [newRangeValue, setNewRangeValue] = useState('');
  const [newCountryName, setNewCountryName] = useState('');

  const fetchConfig = async () => {
    try {
      const url = botId ? `/api/bots/${botId}/sms-config` : '/api/sms-config';
      const res = await fetch(url);
      const data = await res.json();
      if (data.baseUrl) setBaseUrl(data.baseUrl);
      if (data.apiKey) setApiKey(data.apiKey);
      if (data.token) setBotToken(data.token);
    } catch {
      // Ignore
    }
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const url = botId ? `/api/services?botId=${botId}` : '/api/services';
      const res = await fetch(url);
      const data = await res.json();
      if (data.services && Array.isArray(data.services)) {
        setServices(data.services);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchConfig();
  }, [botId]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const url = botId ? `/api/bots/${botId}/sms-config` : '/api/sms-config';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey, token: botToken, botId })
      });
      const data = await res.json();
      if (data.success) {
        setConfigSuccess(true);
        setTimeout(() => setConfigSuccess(false), 3000);
      }
    } catch {
      // Ignore
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestApi = async () => {
    setTestingApi(true);
    setTestResult(null);
    try {
      const url = botId ? `/api/bots/${botId}/test-sms-api` : '/api/test-sms-api';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey, botId })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTestingApi(false);
    }
  };

  const handleResetDefaultServices = async () => {
    if (!window.confirm(lang === 'bn' ? 'সকল ৯টি মূল সার্ভিস ও টেস্টেড কান্ট্রি রেঞ্জ লোড করতে চান?' : 'Restore all default 9 services and active country ranges?')) return;
    setLoading(true);
    try {
      const url = botId ? `/api/bots/${botId}/services/reset-default` : '/api/services/reset-default';
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (data.services) {
        setServices(data.services);
        setSelectedServiceIndex(0);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServices = async (updatedList: ServiceItem[]) => {
    setSaving(true);
    try {
      const url = botId ? `/api/services?botId=${botId}` : '/api/services';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: updatedList })
      });
      const data = await res.json();
      if (data.success) {
        setServices(updatedList);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {
      // Ignore
    } finally {
      setSaving(false);
    }
  };

  const handleAddService = () => {
    if (!newServiceName.trim()) return;
    const name = newServiceName.trim().toUpperCase();
    if (services.some(s => s.sid === name)) return;
    const updated = [...services, { sid: name, ranges: [] }];
    handleSaveServices(updated);
    setNewServiceName('');
    setSelectedServiceIndex(updated.length - 1);
  };

  const handleDeleteService = (index: number) => {
    const updated = services.filter((_, i) => i !== index);
    handleSaveServices(updated);
    if (selectedServiceIndex >= updated.length) {
      setSelectedServiceIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleAddRange = () => {
    if (!newRangeValue.trim()) return;
    const current = services[selectedServiceIndex];
    if (!current) return;

    let country = newCountryName.trim();
    if (!country) {
      if (newRangeValue.startsWith('237')) country = '🇨🇲 Cameroon';
      else if (newRangeValue.startsWith('225')) country = '🇨🇮 Ivory Coast';
      else if (newRangeValue.startsWith('261')) country = '🇲🇬 Madagascar';
      else if (newRangeValue.startsWith('40')) country = '🇷🇴 Romania';
      else if (newRangeValue.startsWith('228')) country = '🇹🇬 Togo';
      else if (newRangeValue.startsWith('1')) country = '🇺🇸 United States';
      else country = '🌍 International';
    }

    const updated = [...services];
    updated[selectedServiceIndex] = {
      ...current,
      ranges: [...current.ranges, { range: newRangeValue.trim().toUpperCase(), country }]
    };
    handleSaveServices(updated);
    setNewRangeValue('');
    setNewCountryName('');
  };

  const handleDeleteRange = (rangeIdx: number) => {
    const current = services[selectedServiceIndex];
    if (!current) return;
    const updated = [...services];
    updated[selectedServiceIndex] = {
      ...current,
      ranges: current.ranges.filter((_, i) => i !== rangeIdx)
    };
    handleSaveServices(updated);
  };

  const activeService = services[selectedServiceIndex];

  return (
    <div className="space-y-6">
      {/* Top Banner: SMS Panel & Site API Gateway */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0088cc]/10 flex items-center justify-center text-[#0088cc]">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#1e293b]">
                  {lang === 'bn' ? 'এসএমএস প্যানেল সাইট ও এপিআই কানেকশন' : 'SMS Panel Site & API Gateway'}
                </h3>
                {botName && (
                  <span className="px-2 py-0.5 rounded-full bg-[#0088cc]/10 text-[#0088cc] text-[11px] font-semibold">
                    {botName}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                {lang === 'bn'
                  ? 'আপনার এসএমএস সাইটের বেসিক URL ও API Key দিন যাতে গেট নাম্বারে ক্লিক করলেই টেলিগ্রাম বটে নাম্বার চলে আসে।'
                  : 'Configure Base URL and API Key for instant Get Number allocation in Telegram.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaultServices}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>{lang === 'bn' ? '🔄 অল সার্ভিস ফিক্স ও রিসেট' : 'Reset All Services'}</span>
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1.5">
              {lang === 'bn' ? 'সাইটের বেসিক URL' : 'Site Base URL'}
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-[#94a3b8] absolute left-3 top-2.5" />
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://minosms.com"
                className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#1e293b] font-mono focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
              />
            </div>
            <div className="flex gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => setBaseUrl('https://minosms.com')}
                className="text-[10px] px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b] hover:text-[#0088cc] cursor-pointer"
              >
                minosms.com
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1.5">
              {lang === 'bn' ? 'প্যানেল এপিআই কি (API Key)' : 'Panel API Key'}
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-[#94a3b8] absolute left-3 top-2.5" />
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="mino_live_..."
                className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#1e293b] font-mono focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1.5">
              {lang === 'bn' ? 'টেলিগ্রাম বট টোকেন' : 'Telegram Bot Token'}
            </label>
            <div className="relative">
              <Radio className="w-4 h-4 text-[#94a3b8] absolute left-3 top-2.5" />
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="8814477083:AAH_..."
                className="w-full pl-9 pr-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#1e293b] font-mono focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="px-4 py-2 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingConfig ? (lang === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...') : (lang === 'bn' ? '💾 সাইট কনফিগ সেভ ও রিস্টার্ট' : 'Save & Restart Bot')}</span>
            </button>

            <button
              onClick={handleTestApi}
              disabled={testingApi}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <PhoneCall className={`w-3.5 h-3.5 ${testingApi ? 'animate-bounce' : ''}`} />
              <span>{testingApi ? (lang === 'bn' ? 'নাম্বার টেস্ট হচ্ছে...' : 'Testing...') : (lang === 'bn' ? '⚡ টেস্ট এসএমএস এপিআই ও গেট নাম্বার' : 'Test Live API & Get Number')}</span>
            </button>
          </div>

          {configSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              {lang === 'bn' ? 'কনফিগারেশন সফলভাবে সেভ ও বটের সাথে লিঙ্ক করা হয়েছে!' : 'Config successfully saved!'}
            </span>
          )}
        </div>

        {/* Live Test Diagnostic Output Box */}
        {testResult && (
          <div className={`mt-4 p-4 rounded-xl border text-xs ${testResult.success ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
            <div className="flex items-center justify-between font-bold mb-2">
              <span className="flex items-center gap-1.5">
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                {testResult.success ? (lang === 'bn' ? '✅ এসএমএস এপিআই টেস্ট সফল! গেট নাম্বার সক্রিয়।' : 'SMS API Working!') : (lang === 'bn' ? '⚠️ এপিআই এরর' : 'API Test Error')}
              </span>
              {testResult.latencyMs && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-white/80 border border-emerald-200 text-emerald-700">
                  Latency: {testResult.latencyMs}ms
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2 font-mono">
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                <span className="text-[10px] uppercase text-[#64748b] block">Allocated Number:</span>
                <span className="text-sm font-bold text-[#1e293b]">{testResult.number || 'No number'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                <span className="text-[10px] uppercase text-[#64748b] block">Tested Range:</span>
                <span className="text-xs font-bold text-[#1e293b]">{testResult.testRange || '23762XXX'}</span>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                <span className="text-[10px] uppercase text-[#64748b] block">OTP Feed Status:</span>
                <span className="text-xs font-bold text-emerald-700">
                  {testResult.otpFeedOk ? `🟢 Active (${testResult.otpCount} OTPs)` : '⚪ Checking'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#64748b] mt-1">{testResult.message}</p>
          </div>
        )}
      </div>

      {/* Services & Number Ranges Management */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#0088cc]/10 flex items-center justify-center text-[#0088cc]">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1e293b]">
                {lang === 'bn' ? 'বটের অল সার্ভিস তালিকা ও নাম্বার রেঞ্জ' : 'Custom Services & Number Ranges'}
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                {lang === 'bn'
                  ? 'টেলিগ্রামে ইউজার যে সার্ভিসেই ক্লিক করবে (WhatsApp, Telegram, Facebook, etc.) সেই দেশের রেঞ্জ থেকে নাম্বার বরাদ্দ হবে।'
                  : 'Configure supported apps and country phone prefixes for Telegram user clicks.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'সংরক্ষিত!' : 'Saved!'}
              </span>
            )}
            <button
              onClick={fetchServices}
              disabled={loading}
              className="p-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] border border-[#e2e8f0] transition-all cursor-pointer"
              title="Reload services"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Services List */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748b] mb-3">
              {lang === 'bn' ? 'সার্ভিস তালিকা' : 'Active Services'} ({services.length})
            </h4>

            {/* Add New Service Box */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder={lang === 'bn' ? 'যেমন: NETFLIX' : 'e.g. NETFLIX'}
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="flex-1 bg-white border border-[#e2e8f0] rounded-xl px-3 py-2 text-xs text-[#1e293b] uppercase placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
              />
              <button
                onClick={handleAddService}
                disabled={!newServiceName.trim() || saving}
                className="px-3.5 py-2 bg-[#0088cc] hover:bg-[#0077b5] text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'যোগ' : 'Add'}</span>
              </button>
            </div>

            {/* Service items */}
            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {services.map((svc, idx) => (
                <div
                  key={svc.sid}
                  onClick={() => setSelectedServiceIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedServiceIndex === idx
                      ? 'bg-white border-[#0088cc] text-[#0088cc] font-semibold shadow-xs ring-1 ring-[#0088cc]'
                      : 'bg-white border-[#e2e8f0] text-[#1e293b] hover:border-[#cbd5e1]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⚡</span>
                    <span className="text-xs font-mono font-bold">{svc.sid}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#64748b] font-semibold">
                      {svc.ranges.length} {lang === 'bn' ? 'রেঞ্জ' : 'ranges'}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteService(idx);
                    }}
                    className="text-[#94a3b8] hover:text-rose-600 p-1 transition-colors"
                    title="Delete service"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Ranges for Selected Service */}
          <div className="lg:col-span-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-5">
            {activeService ? (
              <div>
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e2e8f0]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#1e293b] flex items-center gap-2">
                    <span className="text-[#0088cc] font-mono text-sm">{activeService.sid}</span>
                    <span className="text-[#64748b] font-normal">
                      ({activeService.ranges.length} {lang === 'bn' ? 'রেঞ্জ উপলব্ধ' : 'ranges available'})
                    </span>
                  </h4>
                </div>

                {/* Add Range Input */}
                <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 mb-4 shadow-xs">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#64748b] mb-2.5">
                    {lang === 'bn' ? 'নতুন নাম্বার রেঞ্জ ও দেশ যোগ করুন:' : 'Add New Number Range & Country:'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      placeholder="Range (e.g. 23762XXX)"
                      value={newRangeValue}
                      onChange={(e) => setNewRangeValue(e.target.value)}
                      className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2 text-xs text-[#1e293b] uppercase placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc] font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Country (e.g. 🇨🇲 Cameroon)"
                      value={newCountryName}
                      onChange={(e) => setNewCountryName(e.target.value)}
                      className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-3 py-2 text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
                    />
                    <button
                      onClick={handleAddRange}
                      disabled={!newRangeValue.trim() || saving}
                      className="bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold text-xs rounded-xl px-4 py-2 flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-[#0088cc]/20 disabled:opacity-50 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'রেঞ্জ সংরক্ষণ' : 'Add Range'}</span>
                    </button>
                  </div>
                </div>

                {/* Ranges List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {activeService.ranges.length === 0 ? (
                    <p className="text-xs text-[#94a3b8] py-8 text-center col-span-2">
                      {lang === 'bn' ? 'এই সার্ভিসে এখনও কোনো রেঞ্জ যোগ করা হয়নি।' : 'No number ranges added yet for this service.'}
                    </p>
                  ) : (
                    activeService.ranges.map((r, rIdx) => (
                      <div
                        key={`${r.range}-${rIdx}`}
                        className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#e2e8f0] hover:border-[#cbd5e1] shadow-xs transition-colors"
                      >
                        <div>
                          <div className="text-xs font-mono font-bold text-[#1e293b]">{r.range}</div>
                          <div className="text-[11px] text-[#64748b] mt-0.5">{r.country}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteRange(rIdx)}
                          className="text-[#94a3b8] hover:text-rose-600 p-1 transition-colors"
                          title="Delete range"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-[#94a3b8] text-xs">
                {lang === 'bn' ? 'বামপাশ থেকে একটি সার্ভিস নির্বাচন করুন।' : 'Select a service from the left list.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
