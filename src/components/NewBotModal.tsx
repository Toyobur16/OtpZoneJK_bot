import React, { useState } from 'react';
import { X, Upload, FileCode, CheckCircle2, AlertCircle, Plus, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';
import { HostedBot } from '../types';

interface NewBotModalProps {
  onClose: () => void;
  onCreated: (bot: HostedBot) => void;
  lang: 'bn' | 'en';
}

const TEMPLATES = [
  {
    id: 'echo',
    name: 'Telegram Echo Bot',
    entry: 'bot.py',
    code: `# Telegram Echo Bot - Simple & Fast
import os
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters

BOT_TOKEN = os.getenv("BOT_TOKEN", "")

logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await update.message.reply_text(f"👋 হ্যালো {user.first_name}! আমি টেলিগ্রাম বট, BotHost Cloud এ সক্রিয়ভাবে হোস্ট করা।")

async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    await update.message.reply_text(f"📢 You said: {text}")

if __name__ == '__main__':
    print("🚀 Telegram Bot starting...")
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))
    print("✅ Bot is online and listening!")
    app.run_polling()
`
  },
  {
    id: 'buttons',
    name: 'Inline Buttons & Menu Bot',
    entry: 'bot.py',
    code: `# Telegram Interactive Button Bot
import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, ContextTypes

BOT_TOKEN = os.getenv("BOT_TOKEN", "")

logging.basicConfig(level=logging.INFO)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("🌐 Visit Website", url="https://telegram.org")],
        [InlineKeyboardButton("⚡ Server Status", callback_data="status"), InlineKeyboardButton("ℹ️ Help", callback_data="help")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("👋 স্বাগতম! যেকোনো অপশন সিলেক্ট করুন:", reply_markup=reply_markup)

async def button_click(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if query.data == "status":
        await query.edit_message_text(text="🟢 সার্ভার স্ট্যাটাস: 24/7 লাইভ ও সক্রিয়!")
    elif query.data == "help":
        await query.edit_message_text(text="ℹ️ নির্দেশিকা: এই বটটি BotHost ক্লাউডে লাইভ হোস্ট করা।")

if __name__ == '__main__':
    print("🚀 Button Bot starting...")
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_click))
    print("✅ Button Bot polling active!")
    app.run_polling()
`
  },
  {
    id: 'blank',
    name: 'Custom Python Script',
    entry: 'main.py',
    code: `# Custom Python Script / Bot
import time
import sys

print("🚀 Custom Python process started on BotHost Cloud!")
counter = 0

while True:
    counter += 1
    print(f"[{time.strftime('%X')}] Process alive & running... tick #{counter}")
    sys.stdout.flush()
    time.sleep(10)
`
  }
];

export const NewBotModal: React.FC<NewBotModalProps> = ({ onClose, onCreated, lang }) => {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://minosms.com');
  const [apiKey, setApiKey] = useState('');
  const [showSmsPanelOptions, setShowSmsPanelOptions] = useState(false);
  const [entryFile, setEntryFile] = useState('bot.py');
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [code, setCode] = useState(TEMPLATES[0].code);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [zipBase64, setZipBase64] = useState<string | null>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);
  const [autoStart, setAutoStart] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenTesting, setTokenTesting] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ ok: boolean; username?: string; error?: string } | null>(null);

  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    const readList: { name: string; content: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Handle ZIP file
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          const chunkSize = 8192;
          for (let j = 0; j < bytes.length; j += chunkSize) {
            const chunk = bytes.subarray(j, j + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64 = btoa(binary);
          setZipBase64(base64);
          setZipFileName(file.name);
          if (!name) {
            const suggested = file.name.replace(/\.zip$/i, '').replace(/[_\-\(\)]+/g, ' ').trim();
            setName(suggested ? suggested.charAt(0).toUpperCase() + suggested.slice(1) : 'Telegram Bot');
          }
        } catch (err: any) {
          setError(lang === 'bn' ? 'জিপ ফাইল পড়তে সমস্যা হয়েছে: ' + err.message : 'Error reading zip file: ' + err.message);
        }
        continue;
      }

      // Handle regular text / script files
      try {
        const text = await file.text();
        readList.push({ name: file.name, content: text });

        // If python file and no name set, suggest bot name
        if (file.name.toLowerCase().endsWith('.py')) {
          setEntryFile(file.name);
          if (!name) {
            const suggested = file.name.replace(/\.py$/i, '').replace(/[_\-\(\)]+/g, ' ').trim();
            setName(suggested ? suggested.charAt(0).toUpperCase() + suggested.slice(1) : 'Telegram Bot');
          }
          // Check for BOT_TOKEN inside the script
          const match = text.match(/BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([0-9]{8,12}:[a-zA-Z0-9_-]{30,45})["']/);
          if (match && match[1] && !token) {
            setToken(match[1]);
          }
        }
      } catch (err: any) {
        console.error('File read error:', err);
      }
    }

    setUploadedFiles(readList);
  };

  // Test token with Telegram
  const handleTestToken = async () => {
    if (!token.trim()) return;
    setTokenTesting(true);
    setTokenInfo(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
      const data = await res.json();
      if (data.ok) {
        setTokenInfo({ ok: true, username: data.result.username });
      } else {
        setTokenInfo({ ok: false, error: data.description || 'Invalid token' });
      }
    } catch (err: any) {
      setTokenInfo({ ok: false, error: err.message });
    } finally {
      setTokenTesting(false);
    }
  };

  // Deploy bot
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(lang === 'bn' ? 'বটের একটি নাম দিন।' : 'Bot name is required.');
      return;
    }

    let filesToSend: { name: string; content: string }[] = [];

    if (inputMode === 'upload') {
      if (uploadedFiles.length === 0 && !zipBase64) {
        setError(lang === 'bn' ? 'অনুগ্রহ করে পাইথন (.py) বা জিপ (.zip) ফাইল আপলোড করুন অথবা কোড পেস্ট করুন।' : 'Please upload a .py file or zip archive.');
        return;
      }
      filesToSend = uploadedFiles;
    } else {
      filesToSend = [{ name: entryFile || 'bot.py', content: code }];
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          entryFile: entryFile.trim() || 'bot.py',
          token: token.trim(),
          baseUrl: baseUrl.trim() || 'https://minosms.com',
          apiKey: apiKey.trim(),
          files: filesToSend,
          zipBase64: zipBase64 || undefined,
          autoStart
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to deploy bot');
      }

      onCreated(data.bot);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 max-w-2xl w-full shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#f1f5f9] mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0088cc]/10 flex items-center justify-center text-[#0088cc]">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1e293b]">
                {lang === 'bn' ? 'নতুন টেলিগ্রাম বট হোস্ট করুন' : 'Deploy New Telegram Bot'}
              </h3>
              <p className="text-xs text-[#64748b]">
                {lang === 'bn'
                  ? 'আপনার যেকোনো ফাইল আপলোড করুন এবং তাৎক্ষণিক লাইভ চালান।'
                  : 'Upload any bot files (.py) and run live instantly on the cloud.'}
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

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bot Name & Entry Script */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1e293b] mb-1.5">
                {lang === 'bn' ? 'বটের নাম *' : 'Bot Name *'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === 'bn' ? 'যেমন: SMS OTP Bot, Music Bot' : 'e.g. My Support Bot'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1e293b] mb-1.5">
                {lang === 'bn' ? 'এন্ট্রি স্ক্রিপ্ট ফাইল' : 'Main Script File'}
              </label>
              <input
                type="text"
                value={entryFile}
                onChange={(e) => setEntryFile(e.target.value)}
                placeholder="bot.py"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs font-mono text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
              />
            </div>
          </div>

          {/* Telegram Bot Token with Verification */}
          <div>
            <label className="block text-xs font-semibold text-[#1e293b] mb-1.5">
              {lang === 'bn' ? 'টেলিগ্রাম বট টোকেন (ঐচ্ছিক)' : 'Telegram Bot Token (Optional)'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:ABCDefghIJKLmnOPQRstuvWXyz..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs font-mono text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
              />
              <button
                type="button"
                onClick={handleTestToken}
                disabled={!token.trim() || tokenTesting}
                className="px-3.5 py-2.5 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#0088cc] border border-[#e2e8f0] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {tokenTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{lang === 'bn' ? 'যাচাই করুন' : 'Verify'}</span>
              </button>
            </div>

            {tokenInfo && (
              <div className={`mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                tokenInfo.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {tokenInfo.ok ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {lang === 'bn' ? `টোকেন সঠিক! বট ইউজারনেম: ` : `Valid Token! Bot: `}
                      <b>@{tokenInfo.username}</b>
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{tokenInfo.error}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* SMS Panel & API Key Configuration (Optional) */}
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5">
            <button
              type="button"
              onClick={() => setShowSmsPanelOptions(!showSmsPanelOptions)}
              className="w-full flex items-center justify-between text-xs font-semibold text-[#1e293b] cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🌐</span>
                <span>{lang === 'bn' ? 'এসএমএস প্যানেল ও এপিআই কি কনফিগারেশন (ঐচ্ছিক)' : 'SMS Panel & API Gateway Setup (Optional)'}</span>
              </div>
              <span className="text-[11px] text-[#0088cc] font-mono">
                {showSmsPanelOptions ? (lang === 'bn' ? 'লুকান ▲' : 'Hide ▲') : (lang === 'bn' ? 'দেখুন ▼' : 'Configure ▼')}
              </span>
            </button>

            {showSmsPanelOptions && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#e2e8f0]">
                <div>
                  <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                    {lang === 'bn' ? 'সাইটের বেসিক URL' : 'Site Base URL'}
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://minosms.com"
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e2e8f0] text-xs font-mono text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
                  />
                  <span className="text-[10px] text-[#94a3b8] mt-0.5 block">Default: https://minosms.com</span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                    {lang === 'bn' ? 'প্যানেল API Key' : 'SMS API Key'}
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="mino_live_..."
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e2e8f0] text-xs font-mono text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
                  />
                  <span className="text-[10px] text-[#94a3b8] mt-0.5 block">কোডে থাকা কী-এর পরিবর্তে এটি ব্যবহৃত হবে</span>
                </div>
              </div>
            )}
          </div>

          {/* Mode Tabs: Upload vs Paste */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-[#1e293b]">
                {lang === 'bn' ? 'বট ফাইল যুক্ত করুন' : 'Bot Code & Files'}
              </label>
              <div className="flex bg-[#f8fafc] p-1 rounded-xl border border-[#e2e8f0]">
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    inputMode === 'upload' ? 'bg-white text-[#0088cc] shadow-xs' : 'text-[#64748b]'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 inline mr-1" />
                  {lang === 'bn' ? 'ফাইল আপলোড' : 'Upload File'}
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('paste')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    inputMode === 'paste' ? 'bg-white text-[#0088cc] shadow-xs' : 'text-[#64748b]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 inline mr-1" />
                  {lang === 'bn' ? 'কোড পেস্ট বা টেমপ্লেট' : 'Paste Code'}
                </button>
              </div>
            </div>

            {inputMode === 'upload' ? (
              <div className="border-2 border-dashed border-[#cbd5e1] hover:border-[#0088cc] rounded-2xl p-6 text-center transition-colors bg-[#f8fafc]/50">
                <input
                  type="file"
                  id="bot-file-input"
                  multiple
                  accept=".py,.json,.txt,.env,.zip"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="bot-file-input" className="cursor-pointer flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#0088cc]/10 text-[#0088cc] flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-[#1e293b]">
                    {lang === 'bn' ? 'আপনার ফাইল বা জিপ (.zip) নির্বাচন করুন বা এখানে টেনে আনুন' : 'Click to select or drag & drop files / .zip archive'}
                  </span>
                  <span className="text-[11px] text-[#64748b] mt-1">
                    {lang === 'bn' ? 'সাপোর্টেড: .py (Python স্ক্রিপ্ট), .zip (সম্পূর্ণ প্রজেক্ট), .json, .txt' : 'Supports: .py (Python script), .zip (bot archive), .json, requirements.txt'}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium mt-1">
                    {lang === 'bn' ? '⚡ প্যাকেজ (telebot, httpx, requests, aiogram ইত্যাদি) স্বয়ংক্রিয়ভাবে ইনস্টল হবে' : '⚡ Required packages (telebot, httpx, requests, aiogram) auto-install'}
                  </span>
                </label>

                {(uploadedFiles.length > 0 || zipFileName) && (
                  <div className="mt-4 pt-3 border-t border-[#e2e8f0] text-left">
                    <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider block mb-2">
                      {lang === 'bn' ? 'আপলোডকৃত ফাইলসমূহ:' : 'Selected Files:'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {zipFileName && (
                        <div className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-700 flex items-center gap-1.5 font-semibold">
                          <FileCode className="w-3.5 h-3.5 text-emerald-600" />
                          <span>📦 {zipFileName}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">ZIP Archive</span>
                        </div>
                      )}
                      {uploadedFiles.map((f, i) => (
                        <div key={i} className="px-2.5 py-1 rounded-lg bg-white border border-[#e2e8f0] text-xs font-mono text-[#0088cc] flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-[#64748b]" />
                          <span>{f.name}</span>
                          <span className="text-[10px] text-[#94a3b8]">({(f.content.length / 1024).toFixed(1)} KB)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Template picker */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-xs text-[#64748b] font-medium shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    {lang === 'bn' ? 'রেডিমেড টেমপ্লেট:' : 'Quick Starters:'}
                  </span>
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setCode(t.code);
                        setEntryFile(t.entry);
                        if (!name) setName(t.name);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#1e293b] border border-[#e2e8f0] text-xs font-medium shrink-0 cursor-pointer"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>

                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={8}
                  className="w-full p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs font-mono text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
                  placeholder="# Paste your python bot code here..."
                />
              </div>
            )}
          </div>

          {/* Auto start check */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="auto-start"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="w-4 h-4 rounded text-[#0088cc] border-[#cbd5e1] focus:ring-[#0088cc] cursor-pointer"
            />
            <label htmlFor="auto-start" className="text-xs text-[#475569] font-medium cursor-pointer">
              {lang === 'bn' ? 'হোস্ট হওয়ার সাথে সাথে বট চালু করুন (Start live immediately)' : 'Start running live immediately after deploying'}
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#f1f5f9]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] text-xs font-semibold border border-[#e2e8f0] cursor-pointer transition-colors"
            >
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold shadow-sm shadow-[#0088cc]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{lang === 'bn' ? 'হোস্ট এবং চালু করুন' : 'Deploy & Run Live'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
