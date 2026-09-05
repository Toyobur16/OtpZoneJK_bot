import React, { useState, useEffect } from 'react';
import { FileCode, Save, Upload, RotateCw, CheckCircle2, AlertCircle, Sliders, FileText, Plus, Trash2 } from 'lucide-react';

interface ScriptEditorProps {
  lang: 'bn' | 'en';
  botId?: string;
  botName?: string;
  onFileSaved?: () => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ lang, botId, botName, onFileSaved }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('bot.py');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoRestart, setAutoRestart] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);

  // Quick config fields extracted from bot.py
  const [botToken, setBotToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showConfigHelper, setShowConfigHelper] = useState(true);

  const fetchFiles = async () => {
    try {
      const url = botId ? `/api/bots/${botId}/files` : '/api/files';
      const res = await fetch(url);
      const data = await res.json();
      if (data.files && Array.isArray(data.files)) {
        setFiles(data.files);
        if (!data.files.includes(selectedFile) && data.files.length > 0) {
          setSelectedFile(data.files[0]);
        }
      }
    } catch {
      // Ignore
    }
  };

  const loadFileContent = async (filename: string) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const url = botId
        ? `/api/bots/${botId}/file?name=${encodeURIComponent(filename)}`
        : `/api/files/read?name=${encodeURIComponent(filename)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.content !== undefined) {
        setContent(data.content);
        if (filename === 'bot.py' || filename.endsWith('.py')) {
          extractVariables(data.content);
        }
      } else {
        setErrorMessage(data.error || 'Failed to load file');
      }
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const extractVariables = (code: string) => {
    const tokenMatch = code.match(/BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([^"']+)["']/);
    if (tokenMatch) setBotToken(tokenMatch[1]);
    const apiMatch = code.match(/API_KEY\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([^"']+)["']/);
    if (apiMatch) setApiKey(apiMatch[1]);
    const urlMatch = code.match(/BASE_URL\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([^"']+)["']/);
    if (urlMatch) setBaseUrl(urlMatch[1]);
  };

  useEffect(() => {
    fetchFiles();
  }, [botId]);

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile);
    }
  }, [selectedFile, botId]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');

    try {
      const url = botId ? `/api/bots/${botId}/file` : '/api/files/save';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile,
          content,
          restart: autoRestart
        })
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        if (onFileSaved) onFileSaved();
      } else {
        setErrorMessage(data.error || 'Failed to save');
      }
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setSaving(false);
    }
  };

  const applyQuickConfig = () => {
    let updated = content;
    if (botToken) {
      updated = updated.replace(
        /(BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["'])([^"']+)(["'])/,
        `$1${botToken}$3`
      );
    }
    if (apiKey) {
      updated = updated.replace(
        /(API_KEY\s*=\s*(?:os\.getenv\([^,]+,\s*)?["'])([^"']+)(["'])/,
        `$1${apiKey}$3`
      );
    }
    if (baseUrl) {
      updated = updated.replace(
        /(BASE_URL\s*=\s*(?:os\.getenv\([^,]+,\s*)?["'])([^"']+)(["'])/,
        `$1${baseUrl}$3`
      );
    }
    setContent(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Upload a file directly into this bot
  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    const text = await file.text();

    setSaving(true);
    try {
      const url = botId ? `/api/bots/${botId}/file` : '/api/files/save';
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content: text,
          restart: false
        })
      });
      await fetchFiles();
      setSelectedFile(file.name);
      setContent(text);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Create empty file
  const handleCreateNewFile = async () => {
    if (!newFileName.trim()) return;
    const safe = newFileName.trim();
    setSaving(true);
    try {
      const url = botId ? `/api/bots/${botId}/file` : '/api/files/save';
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: safe,
          content: `# ${safe}\n`,
          restart: false
        })
      });
      setNewFileName('');
      setShowNewFileInput(false);
      await fetchFiles();
      setSelectedFile(safe);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete file
  const handleDeleteFile = async (fn: string) => {
    if (!botId) return;
    if (!confirm(lang === 'bn' ? `আপনি কি '${fn}' ফাইলটি ডিলিট করতে চান?` : `Delete file '${fn}'?`)) return;
    try {
      await fetch(`/api/bots/${botId}/delete-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fn })
      });
      await fetchFiles();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-xs">
      {/* Editor Header */}
      <div className="bg-[#fcfdfe] px-5 py-3.5 border-b border-[#f1f5f9] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-7 h-7 rounded-xl bg-[#0088cc]/10 flex items-center justify-center text-[#0088cc]">
            <FileCode className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#1e293b]">
                {botName ? `${botName} • ` : ''}{lang === 'bn' ? 'ফাইল এডিটর' : 'Script & File Editor'}
              </span>
              <select
                value={selectedFile}
                onChange={(e) => setSelectedFile(e.target.value)}
                className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl px-2.5 py-1 text-xs font-mono font-semibold text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0088cc] cursor-pointer"
              >
                {files.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>

              {/* Upload file button */}
              <label
                htmlFor="editor-file-upload"
                className="p-1.5 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] border border-[#e2e8f0] cursor-pointer transition-colors"
                title={lang === 'bn' ? 'ফাইল আপলোড করুন' : 'Upload file to bot'}
              >
                <Upload className="w-3.5 h-3.5" />
                <input
                  id="editor-file-upload"
                  type="file"
                  onChange={handleDirectUpload}
                  className="hidden"
                />
              </label>

              {/* Add file button */}
              <button
                onClick={() => setShowNewFileInput(!showNewFileInput)}
                className="p-1.5 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] border border-[#e2e8f0] cursor-pointer transition-colors"
                title={lang === 'bn' ? 'নতুন ফাইল তৈরি করুন' : 'Create new file'}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {/* Delete file button (if more than 1 file) */}
              {files.length > 1 && selectedFile !== 'bot.py' && (
                <button
                  onClick={() => handleDeleteFile(selectedFile)}
                  className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer transition-colors"
                  title={lang === 'bn' ? 'ফাইল মুছুন' : 'Delete file'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Actions on Top Right */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-[#64748b] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRestart}
              onChange={(e) => setAutoRestart(e.target.checked)}
              className="rounded text-[#0088cc] border-[#cbd5e1] focus:ring-[#0088cc]"
            />
            <span>{lang === 'bn' ? 'সেভ করার পর স্বয়ংক্রিয় রিস্টার্ট' : 'Auto-restart on save'}</span>
          </label>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-1.5 bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm shadow-[#0088cc]/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{lang === 'bn' ? 'সেভ করুন' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* New file input popup */}
      {showNewFileInput && (
        <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-5 py-3 flex items-center gap-2">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="filename.py or config.json"
            className="px-3 py-1.5 rounded-xl bg-white border border-[#e2e8f0] text-xs font-mono text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0088cc]"
          />
          <button
            onClick={handleCreateNewFile}
            className="px-3 py-1.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold cursor-pointer"
          >
            {lang === 'bn' ? 'তৈরি করুন' : 'Create'}
          </button>
          <button
            onClick={() => setShowNewFileInput(false)}
            className="px-3 py-1.5 rounded-xl bg-white border border-[#e2e8f0] text-[#64748b] text-xs cursor-pointer"
          >
            {lang === 'bn' ? 'বাতিল' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Success or Error Alert */}
      {saveSuccess && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{lang === 'bn' ? 'ফাইল সফলভাবে সেভ হয়েছে!' : 'File successfully saved!'}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Quick Config Helper Drawer */}
      {showConfigHelper && (selectedFile === 'bot.py' || selectedFile.endsWith('.py')) && botToken && (
        <div className="bg-[#f8fafc] border-b border-[#e2e8f0] p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0088cc] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'বট দ্রুত কনফিগারেশন হেল্পার' : 'Fast Bot Credentials Config'}
            </h4>
            <span className="text-[11px] text-[#64748b]">
              {lang === 'bn' ? 'কোড পরিবর্তন ছাড়াই সরাসরি সেভ করতে পারেন' : 'Directly update credentials in script'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1">
                Telegram BOT_TOKEN
              </label>
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="e.g. 8814477083:AAH_G8v9..."
                className="w-full bg-white border border-[#e2e8f0] rounded-xl px-3 py-1.5 text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc] font-mono"
              />
            </div>

            {apiKey && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1">
                  Mino Panel API_KEY
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. mino_live_..."
                  className="w-full bg-white border border-[#e2e8f0] rounded-xl px-3 py-1.5 text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc] font-mono"
                />
              </div>
            )}
          </div>

          <div className="mt-2.5 flex justify-end">
            <button
              onClick={applyQuickConfig}
              className="px-3.5 py-1.5 bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              {lang === 'bn' ? 'কোডে প্রয়োগ করুন' : 'Apply to Code'}
            </button>
          </div>
        </div>
      )}

      {/* Code Textarea */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          className="w-full h-[460px] bg-[#0f172a] text-slate-200 p-5 font-mono text-xs leading-relaxed focus:outline-none resize-none selection:bg-[#0088cc]/40"
          placeholder="Loading code..."
        />
      </div>

      <div className="bg-[#fcfdfe] px-5 py-2.5 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
        <span className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-[#94a3b8]" />
          <span className="font-semibold text-[#1e293b]">{selectedFile}</span>
          <span>•</span>
          <span>{content.split('\n').length} {lang === 'bn' ? 'লাইন' : 'lines'}</span>
        </span>
        <span className="font-mono text-[#94a3b8]">UTF-8 • Python 3.10</span>
      </div>
    </div>
  );
};
