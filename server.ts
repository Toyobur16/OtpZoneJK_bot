import express from "express";
import path from "path";
import fs from "fs";
import { spawn, ChildProcess, execSync } from "child_process";
import { createServer as createViteServer } from "vite";

interface LogItem {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'otp' | 'system';
  message: string;
}

interface HostedBot {
  id: string;
  name: string;
  entryFile: string;
  token?: string;
  botUsername?: string;
  status: 'running' | 'stopped' | 'starting' | 'error';
  pid: number | null;
  uptimeSeconds: number;
  startTime: string | null;
  createdAt: string;
  autoRestart: boolean;
  fileCount?: number;
  error?: string;
  env?: Record<string, string>;
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const HOSTED_BOTS_DIR = path.join(process.cwd(), "hosted_bots");
const REGISTRY_FILE = path.join(HOSTED_BOTS_DIR, "registry.json");
const MAX_LOGS = 1000;

const activeProcesses = new Map<string, ChildProcess>();
const botLogsMap = new Map<string, LogItem[]>();
const startTimes = new Map<string, Date>();
let hostedBots: HostedBot[] = [];

// Helper to add logs to specific bot
function addBotLog(botId: string, level: LogItem['level'], message: string) {
  if (!botLogsMap.has(botId)) {
    botLogsMap.set(botId, []);
  }
  const logs = botLogsMap.get(botId)!;
  const item: LogItem = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp: new Date().toLocaleTimeString(),
    level,
    message: message.trimEnd()
  };
  logs.push(item);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

// Save registry to disk
function saveRegistry() {
  try {
    if (!fs.existsSync(HOSTED_BOTS_DIR)) {
      fs.mkdirSync(HOSTED_BOTS_DIR, { recursive: true });
    }
    const cleanList = hostedBots.map(b => ({
      id: b.id,
      name: b.name,
      entryFile: b.entryFile,
      token: b.token || "",
      botUsername: b.botUsername || "",
      status: activeProcesses.has(b.id) ? 'running' : 'stopped',
      createdAt: b.createdAt,
      autoRestart: b.autoRestart !== false,
      env: b.env || {}
    }));
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(cleanList, null, 2), "utf-8");
  } catch (err: any) {
    console.error("Error saving registry:", err.message);
  }
}

// Initialize hosted bots
function initHostedBots() {
  try {
    if (!fs.existsSync(HOSTED_BOTS_DIR)) {
      fs.mkdirSync(HOSTED_BOTS_DIR, { recursive: true });
    }

    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
      hostedBots = data.map((b: any) => ({
        ...b,
        status: 'stopped',
        pid: null,
        uptimeSeconds: 0,
        startTime: null,
        autoRestart: b.autoRestart !== false
      }));
    } else {
      // Seed default bot if bot.py exists in root
      const rootBotPy = path.join(process.cwd(), "bot.py");
      if (fs.existsSync(rootBotPy)) {
        const defaultBotId = "sms-panel-bot";
        const defaultBotDir = path.join(HOSTED_BOTS_DIR, defaultBotId);
        if (!fs.existsSync(defaultBotDir)) {
          fs.mkdirSync(defaultBotDir, { recursive: true });
        }
        
        // Copy existing files
        const filesToCopy = [
          "bot.py",
          "requirements.txt",
          "custom_services.json",
          "users.json",
          "withdraw_requests.json",
          "banned_users.json",
          "datarange.json",
          "activity_logs.json"
        ];
        for (const file of filesToCopy) {
          const src = path.join(process.cwd(), file);
          const dst = path.join(defaultBotDir, file);
          if (fs.existsSync(src) && !fs.existsSync(dst)) {
            try {
              fs.copyFileSync(src, dst);
            } catch {}
          }
        }

        hostedBots = [
          {
            id: defaultBotId,
            name: "Mino SMS Panel Bot",
            entryFile: "bot.py",
            token: "8814477083:AAH_G8v9gg3YRyVUyYvVRZ65Y_ZIT2nffJM",
            status: 'stopped',
            pid: null,
            uptimeSeconds: 0,
            startTime: null,
            createdAt: new Date().toISOString(),
            autoRestart: true
          }
        ];
        saveRegistry();
      }
    }

    // Auto-start bots configured to auto-restart
    for (const bot of hostedBots) {
      if (bot.autoRestart) {
        startBot(bot.id);
      }
    }
  } catch (err: any) {
    console.error("Init hosted bots error:", err.message);
  }
}

// Ensure required dependencies for a bot are installed
function ensureBotDependencies(botDir: string, botId: string): void {
  try {
    // 1. Check requirements.txt
    const reqFile = path.join(botDir, "requirements.txt");
    if (fs.existsSync(reqFile)) {
      const content = fs.readFileSync(reqFile, "utf-8");
      if (content.trim()) {
        try {
          execSync(`python3 -m pip install -r "${reqFile}" --break-system-packages`, {
            cwd: botDir,
            timeout: 45000,
            stdio: "ignore"
          });
        } catch {}
      }
    }

    // 2. Scan python files for common imports
    const files = fs.readdirSync(botDir).filter(f => f.endsWith('.py'));
    const neededPackages = new Set<string>();

    for (const f of files) {
      try {
        const code = fs.readFileSync(path.join(botDir, f), 'utf-8');
        if (code.includes('import telebot') || code.includes('from telebot')) neededPackages.add('pyTelegramBotAPI');
        if (code.includes('import aiogram') || code.includes('from aiogram')) neededPackages.add('aiogram');
        if (code.includes('import requests') || code.includes('from requests')) neededPackages.add('requests');
        if (code.includes('import aiohttp') || code.includes('from aiohttp')) neededPackages.add('aiohttp');
        if (code.includes('import pyotp') || code.includes('from pyotp')) neededPackages.add('pyotp');
        if (code.includes('http2=True') || code.includes('http2 = True')) {
          neededPackages.add('h2');
          neededPackages.add('httpx[http2]');
        }
        if (code.includes('import bs4') || code.includes('from bs4')) neededPackages.add('beautifulsoup4');
        if (code.includes('import PIL') || code.includes('from PIL')) neededPackages.add('pillow');
        if (code.includes('import schedule') || code.includes('from schedule')) neededPackages.add('schedule');
        if (code.includes('import pytz') || code.includes('from pytz')) neededPackages.add('pytz');
        if (code.includes('import fake_useragent') || code.includes('from fake_useragent')) neededPackages.add('fake-useragent');
        if (code.includes('import cloudscraper') || code.includes('from cloudscraper')) neededPackages.add('cloudscraper');
        if (code.includes('import qrcode') || code.includes('from qrcode')) neededPackages.add('qrcode');
        if (code.includes('import websockets') || code.includes('from websockets')) neededPackages.add('websockets');
      } catch {}
    }

    for (const pkg of neededPackages) {
      try {
        execSync(`python3 -m pip install ${pkg} --break-system-packages`, {
          timeout: 25000,
          stdio: "ignore"
        });
      } catch {}
    }
  } catch (err: any) {
    console.error(`[Dependency Resolver] Error checking dependencies for ${botId}:`, err.message);
  }
}

// Default services with active live ranges
const DEFAULT_SERVICES = [
  {
    sid: "TELEGRAM",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "23765XXX", country: "🇨🇲 Cameroon" },
      { range: "4077XXX", country: "🇷🇴 Romania" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" },
      { range: "22897XXX", country: "🇹🇬 Togo" }
    ]
  },
  {
    sid: "WHATSAPP",
    ranges: [
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" },
      { range: "26132XXX", country: "🇲🇬 Madagascar" },
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "22897XXX", country: "🇹🇬 Togo" }
    ]
  },
  {
    sid: "FACEBOOK",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "4077XXX", country: "🇷🇴 Romania" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" },
      { range: "26132XXX", country: "🇲🇬 Madagascar" }
    ]
  },
  {
    sid: "TIKTOK",
    ranges: [
      { range: "22505XXX", country: "🇨🇮 Ivory Coast" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" },
      { range: "26132XXX", country: "🇲🇬 Madagascar" },
      { range: "23762XXX", country: "🇨🇲 Cameroon" }
    ]
  },
  {
    sid: "IMO",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" },
      { range: "4077XXX", country: "🇷🇴 Romania" }
    ]
  },
  {
    sid: "GOOGLE / GMAIL",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "4077XXX", country: "🇷🇴 Romania" },
      { range: "26132XXX", country: "🇲🇬 Madagascar" }
    ]
  },
  {
    sid: "TWITTER / X",
    ranges: [
      { range: "22897XXX", country: "🇹🇬 Togo" },
      { range: "4077XXX", country: "🇷🇴 Romania" },
      { range: "23762XXX", country: "🇨🇲 Cameroon" }
    ]
  },
  {
    sid: "INSTAGRAM",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "4077XXX", country: "🇷🇴 Romania" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" }
    ]
  },
  {
    sid: "SNAPCHAT",
    ranges: [
      { range: "23762XXX", country: "🇨🇲 Cameroon" },
      { range: "22501XXX", country: "🇨🇮 Ivory Coast" }
    ]
  }
];

// Automatically fix bot scripts, URLs, services, and credentials
function patchAndValidateBotCode(botDir: string, botId: string, customBaseUrl?: string, customApiKey?: string, customToken?: string): void {
  try {
    const servicesPath = path.join(botDir, "custom_services.json");
    if (!fs.existsSync(servicesPath) || fs.readFileSync(servicesPath, "utf-8").trim() === "[]" || fs.readFileSync(servicesPath, "utf-8").trim() === "") {
      fs.writeFileSync(servicesPath, JSON.stringify(DEFAULT_SERVICES, null, 2), "utf-8");
      addBotLog(botId, 'system', `✅ স্বয়ংক্রিয়ভাবে ৯টি অল সার্ভিস এবং কান্ট্রি রেঞ্জ কনফিগার করা হয়েছে।`);
    }

    const pyFiles = fs.readdirSync(botDir).filter(f => f.endsWith('.py'));
    for (const file of pyFiles) {
      const p = path.join(botDir, file);
      let content = fs.readFileSync(p, "utf-8");
      let changed = false;

      // Fix deprecated domain
      if (content.includes("mino-sms-panel.xyz")) {
        content = content.replace(/https?:\/\/mino-sms-panel\.xyz/g, (customBaseUrl || "https://minosms.com").replace(/\/+$/, ''));
        changed = true;
        addBotLog(botId, 'system', `🔧 অকার্যকর ডোমেন mino-sms-panel.xyz কে সচল ডোমেন https://minosms.com এ রূপান্তর করা হয়েছে।`);
      }

      // Fix double minus in OTP_GROUP_ID
      if (content.includes("OTP_GROUP_ID = --")) {
        content = content.replace(/OTP_GROUP_ID\s*=\s*--/g, "OTP_GROUP_ID = -");
        changed = true;
      }

      // Update API_KEY if provided
      if (customApiKey && content.includes("API_KEY =")) {
        content = content.replace(/API_KEY\s*=\s*["'][^"']+["']/, `API_KEY = "${customApiKey.trim()}"`);
        changed = true;
      }

      // Update BASE_URL if provided
      if (customBaseUrl && content.includes("BASE_URL =")) {
        content = content.replace(/BASE_URL\s*=\s*["'][^"']+["']/, `BASE_URL = "${customBaseUrl.trim().replace(/\/+$/, '')}"`);
        changed = true;
      }

      // Update BOT_TOKEN if provided
      if (customToken && content.includes("BOT_TOKEN =")) {
        content = content.replace(/BOT_TOKEN\s*=\s*["'][^"']+["']/, `BOT_TOKEN = "${customToken.trim()}"`);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(p, content, "utf-8");
      }
    }
  } catch (err: any) {
    console.error(`[PatchBotCode] Error for ${botId}:`, err.message);
  }
}

// Start a bot process
function startBot(botId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const bot = hostedBots.find(b => b.id === botId);
    if (!bot) {
      resolve(false);
      return;
    }

    const botDir = path.join(HOSTED_BOTS_DIR, bot.id);
    if (!fs.existsSync(botDir)) {
      addBotLog(botId, 'error', `Directory not found: ${botDir}`);
      bot.status = 'error';
      bot.error = "Bot directory missing";
      resolve(false);
      return;
    }

    // Check if already running
    const existingProc = activeProcesses.get(botId);
    if (existingProc && !existingProc.killed) {
      addBotLog(botId, 'warn', `Bot is already running (PID: ${existingProc.pid})`);
      resolve(true);
      return;
    }

    // Resolve entry file if needed (e.g. user renamed or uploaded different file)
    let entryFile = bot.entryFile;
    let scriptPath = path.join(botDir, entryFile);
    if (!fs.existsSync(scriptPath)) {
      const allFiles = fs.readdirSync(botDir);
      const candidate = allFiles.find(f => f.toLowerCase() === 'bot.py' || f.toLowerCase() === 'main.py' || f.toLowerCase() === 'app.py') || allFiles.find(f => f.endsWith('.py'));
      if (candidate) {
        entryFile = candidate;
        bot.entryFile = candidate;
        scriptPath = path.join(botDir, candidate);
        saveRegistry();
      } else {
        addBotLog(botId, 'error', `Entry script not found: ${bot.entryFile}`);
        bot.status = 'error';
        bot.error = `Entry script ${bot.entryFile} not found`;
        resolve(false);
        return;
      }
    }

    // Prevent Telegram Token Conflict: If another bot is running with this exact same token, stop it
    if (bot.token && bot.token.trim()) {
      for (const other of hostedBots) {
        if (other.id !== botId && other.token === bot.token && activeProcesses.has(other.id)) {
          addBotLog(botId, 'warn', `⚠️ পূর্ববর্তী বট '${other.name}' একই টেলিগ্রাম টোকেন ব্যবহার করছিল। টেলিগ্রাম কনফ্লিক্ট এড়াতে পূর্ববর্তী প্রসেসটি বন্ধ করা হয়েছে।`);
          stopBot(other.id);
        }
      }
    }

    // Auto-patch bot code and services
    patchAndValidateBotCode(botDir, botId, bot.env?.BASE_URL, bot.env?.API_KEY, bot.token);

    // Automatically check and resolve any missing python dependencies before start
    ensureBotDependencies(botDir, botId);

    bot.status = 'starting';
    addBotLog(botId, 'system', `🚀 Starting bot '${bot.name}' (python3 "${entryFile}")...`);

    const botEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      ...(bot.token ? { BOT_TOKEN: bot.token } : {}),
      ...(bot.env?.BASE_URL ? { BASE_URL: bot.env.BASE_URL } : { BASE_URL: "https://minosms.com" }),
      ...(bot.env?.API_KEY ? { API_KEY: bot.env.API_KEY } : {}),
      ...(bot.env || {})
    };

    try {
      const proc = spawn("python3", [entryFile], {
        cwd: botDir,
        env: botEnv
      });

      activeProcesses.set(botId, proc);
      startTimes.set(botId, new Date());
      bot.pid = proc.pid || null;
      bot.status = 'running';
      bot.startTime = new Date().toISOString();
      bot.error = undefined;

      proc.stdout?.on("data", (data) => {
        const text = data.toString();
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          let level: LogItem['level'] = 'info';
          if (line.includes('OTP') || line.includes('SUCCESSFUL')) level = 'otp';
          else if (line.includes('ERROR') || line.includes('Fail') || line.includes('Traceback')) level = 'error';
          else if (line.includes('WARNING') || line.includes('WARN')) level = 'warn';
          addBotLog(botId, level, line);
        }
      });

      let hasConflictError = false;

      proc.stderr?.on("data", (data) => {
        const text = data.toString();
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          addBotLog(botId, 'error', line);

          // Auto-detect missing module and install it!
          const modMatch = line.match(/No module named ['"]([^'"]+)['"]/);
          if (modMatch && modMatch[1]) {
            const missingMod = modMatch[1];
            addBotLog(botId, 'system', `📦 অনুপস্থিত পাইথন মডিউল '${missingMod}' শনাক্ত হয়েছে। স্বয়ংক্রিয়ভাবে ইনস্টল করা হচ্ছে...`);
            try {
              const pkgMap: Record<string, string> = {
                'telebot': 'pyTelegramBotAPI',
                'PIL': 'pillow',
                'bs4': 'beautifulsoup4',
                'dotenv': 'python-dotenv',
                'telegram': 'python-telegram-bot'
              };
              const pkgToInstall = pkgMap[missingMod] || missingMod;
              execSync(`python3 -m pip install ${pkgToInstall} --break-system-packages`, { timeout: 35000, stdio: "ignore" });
              addBotLog(botId, 'system', `✅ '${missingMod}' ইনস্টল সম্পন্ন। বট রিস্টার্ট হচ্ছে...`);
              setTimeout(() => {
                restartBot(botId);
              }, 1000);
            } catch (err: any) {
              addBotLog(botId, 'error', `মডিউল ইনস্টল ত্রুটি: ${err.message}`);
            }
          }

          if (line.includes("Using http2=True, but the 'h2' package is not installed")) {
            addBotLog(botId, 'system', `📦 'h2' প্যাকেজ ইনস্টল করা হচ্ছে...`);
            try {
              execSync(`python3 -m pip install "httpx[http2]" h2 --break-system-packages`, { timeout: 35000, stdio: "ignore" });
              addBotLog(botId, 'system', `✅ 'h2' সফলভাবে ইনস্টল হয়েছে!`);
              setTimeout(() => {
                restartBot(botId);
              }, 1000);
            } catch {}
          }

          if (line.includes("Conflict: terminated by other getUpdates request")) {
            hasConflictError = true;
            addBotLog(botId, 'warn', `⚠️ টেলিগ্রাম কনফ্লিক্ট এরর: এই একই টোকেন দিয়ে টেলিগ্রামের সাথে অন্য একটি অ্যাপ বা স্ক্রিপ্ট কানেক্ট করা আছে। একই সাথে একাধিক প্রসেস টেলিগ্রাম এলাও করে না।`);
          }
        }
      });

      proc.on("error", (err) => {
        addBotLog(botId, 'error', `Process execution error: ${err.message}`);
        bot.status = 'error';
        bot.error = err.message;
      });

      proc.on("close", (code, signal) => {
        addBotLog(botId, 'system', `Process exited with code ${code ?? signal}`);
        activeProcesses.delete(botId);
        startTimes.delete(botId);
        bot.status = code === 0 ? 'stopped' : 'error';
        bot.pid = null;
        bot.startTime = null;

        // Auto restart if configured and unexpected exit (unless it was a Telegram conflict loop)
        if (bot.autoRestart && code !== 0 && code !== null) {
          const delay = hasConflictError ? 12000 : 3000;
          if (hasConflictError) {
            addBotLog(botId, 'warn', `কনফ্লিক্ট থামার অপেক্ষায় ১২ সেকেন্ড পর পুনরায় চেষ্টা করা হবে...`);
          } else {
            addBotLog(botId, 'warn', `Bot exited. Auto-restarting in 3 seconds...`);
          }
          setTimeout(() => {
            if (bot.status !== 'running') {
              startBot(botId);
            }
          }, delay);
        }
      });

      resolve(true);
    } catch (err: any) {
      addBotLog(botId, 'error', `Failed to spawn python process: ${err.message}`);
      bot.status = 'error';
      bot.error = err.message;
      resolve(false);
    }
  });
}

// Stop a bot process
function stopBot(botId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const bot = hostedBots.find(b => b.id === botId);
    if (bot) {
      bot.autoRestart = false; // Disable auto-restart when explicitly stopped by user
    }

    const proc = activeProcesses.get(botId);
    if (!proc || proc.killed) {
      activeProcesses.delete(botId);
      startTimes.delete(botId);
      if (bot) {
        bot.status = 'stopped';
        bot.pid = null;
        bot.startTime = null;
      }
      resolve(true);
      return;
    }

    addBotLog(botId, 'system', `Stopping bot process (PID: ${proc.pid})...`);
    proc.kill("SIGTERM");

    setTimeout(() => {
      if (proc && !proc.killed) {
        try {
          proc.kill("SIGKILL");
        } catch {}
      }
      activeProcesses.delete(botId);
      startTimes.delete(botId);
      if (bot) {
        bot.status = 'stopped';
        bot.pid = null;
        bot.startTime = null;
      }
      addBotLog(botId, 'system', `Bot process terminated successfully.`);
      resolve(true);
    }, 1200);
  });
}

// Restart a bot
async function restartBot(botId: string): Promise<boolean> {
  const bot = hostedBots.find(b => b.id === botId);
  if (bot) {
    bot.autoRestart = true;
  }
  await stopBot(botId);
  await new Promise(r => setTimeout(r, 600));
  return await startBot(botId);
}

// Get bot uptime seconds
function getBotUptime(botId: string): number {
  const st = startTimes.get(botId);
  if (!st || !activeProcesses.has(botId)) return 0;
  return Math.floor((Date.now() - st.getTime()) / 1000);
}

// Count files in bot dir
function getBotFileCount(botId: string): number {
  try {
    const dir = path.join(HOSTED_BOTS_DIR, botId);
    if (fs.existsSync(dir)) {
      return fs.readdirSync(dir).length;
    }
  } catch {}
  return 0;
}

// ==================== API ROUTES ====================

// Health check
app.get("/api/health", (req, res) => {
  const runningCount = Array.from(activeProcesses.values()).filter(p => !p.killed).length;
  res.json({
    status: "ok",
    totalBots: hostedBots.length,
    runningBots: runningCount,
    pythonVersion: "Python 3.10.12",
    timestamp: new Date().toISOString()
  });
});

// 24/7 Keep-Alive ping
app.get("/api/ping", (req, res) => {
  res.send("PONG 200 OK - BotHost Cloud Running 24/7");
});

app.get("/api/keepalive/:botId", (req, res) => {
  const { botId } = req.params;
  const bot = hostedBots.find(b => b.id === botId);
  const isRunning = activeProcesses.has(botId);
  res.json({
    ok: true,
    botId,
    botName: bot?.name || "Unknown Bot",
    status: isRunning ? "running" : (bot?.status || "stopped"),
    uptime: getBotUptime(botId),
    timestamp: new Date().toISOString()
  });
});

// List all hosted bots
app.get("/api/bots", (req, res) => {
  const list = hostedBots.map(b => {
    const isRunning = activeProcesses.has(b.id);
    return {
      ...b,
      status: isRunning ? 'running' : b.status,
      pid: isRunning ? activeProcesses.get(b.id)?.pid || null : null,
      uptimeSeconds: getBotUptime(b.id),
      fileCount: getBotFileCount(b.id)
    };
  });
  res.json({ bots: list, total: list.length });
});

// Create / Deploy a new bot
app.post("/api/bots", async (req, res) => {
  try {
    const { name, entryFile = "bot.py", token = "", baseUrl = "https://minosms.com", apiKey = "", files = [], autoStart = true, env = {}, zipBase64 } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: "Bot name is required" });
    }

    if (baseUrl) {
      env.BASE_URL = baseUrl.replace(/\/+$/, '');
    }
    if (apiKey) {
      env.API_KEY = apiKey.trim();
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "bot";
    const botId = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
    const botDir = path.join(HOSTED_BOTS_DIR, botId);

    fs.mkdirSync(botDir, { recursive: true });

    // Handle ZIP archive if provided
    if (zipBase64 && typeof zipBase64 === 'string') {
      try {
        const zipPath = path.join(botDir, "upload.zip");
        fs.writeFileSync(zipPath, Buffer.from(zipBase64, 'base64'));
        execSync(`unzip -o -q "${zipPath}" -d "${botDir}"`, { timeout: 20000 });
        try { fs.unlinkSync(zipPath); } catch {}
      } catch (err: any) {
        addBotLog(botId, 'error', `Failed to unzip archive: ${err.message}`);
      }
    }

    // Write all uploaded or templated files
    let hasEntryFile = false;
    if (Array.isArray(files) && files.length > 0) {
      for (const f of files) {
        if (f.name && f.content !== undefined) {
          const safeName = path.basename(f.name);
          fs.writeFileSync(path.join(botDir, safeName), f.content, "utf-8");
          if (safeName === entryFile) hasEntryFile = true;
        }
      }
    }

    // Auto-detect entry file if needed
    let finalEntryFile = entryFile;
    const existingFiles = fs.readdirSync(botDir);
    if (!existingFiles.includes(finalEntryFile)) {
      const candidate = existingFiles.find(f => f.toLowerCase() === 'bot.py' || f.toLowerCase() === 'main.py' || f.toLowerCase() === 'app.py') || existingFiles.find(f => f.endsWith('.py'));
      if (candidate) {
        finalEntryFile = candidate;
        hasEntryFile = true;
      }
    } else {
      hasEntryFile = true;
    }

    // If entry file not present, create a starter bot
    if (!hasEntryFile) {
      const defaultScript = `# Telegram Bot - ${name}
import os
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

BOT_TOKEN = os.getenv("BOT_TOKEN", "${token}")

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await update.message.reply_text(f"Hello {user.first_name}! I am ${name}, hosted live on BotHost Cloud ⚡")

async def ping(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Pong! Bot is 24/7 online & running.")

if __name__ == '__main__':
    print("🚀 Initializing ${name}...")
    if not BOT_TOKEN:
        print("⚠️ Warning: BOT_TOKEN is not configured.")
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("ping", ping))
    print("✅ Bot polling started successfully!")
    app.run_polling()
`;
      fs.writeFileSync(path.join(botDir, finalEntryFile), defaultScript, "utf-8");
    }

    // Also write a default requirements.txt if not created
    const reqPath = path.join(botDir, "requirements.txt");
    if (!fs.existsSync(reqPath)) {
      fs.writeFileSync(reqPath, "python-telegram-bot>=20.0\nhttpx\npyTelegramBotAPI\nrequests\n", "utf-8");
    }

    // Auto-detect Telegram token if not explicitly provided
    let detectedToken = token.trim();
    if (!detectedToken) {
      try {
        const pyFiles = fs.readdirSync(botDir).filter(f => f.endsWith('.py'));
        for (const py of pyFiles) {
          const content = fs.readFileSync(path.join(botDir, py), 'utf-8');
          const m = content.match(/BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([0-9]{8,12}:[a-zA-Z0-9_-]{30,45})["']/);
          if (m && m[1]) {
            detectedToken = m[1];
            break;
          }
        }
      } catch {}
    }

    const newBot: HostedBot = {
      id: botId,
      name,
      entryFile: finalEntryFile,
      token: detectedToken,
      status: 'stopped',
      pid: null,
      uptimeSeconds: 0,
      startTime: null,
      createdAt: new Date().toISOString(),
      autoRestart: autoStart,
      env
    };

    hostedBots.unshift(newBot);
    saveRegistry();

    // Auto-fix bot scripts, credentials and ensure all services are ready
    patchAndValidateBotCode(botDir, botId, baseUrl, apiKey, detectedToken);

    addBotLog(botId, 'system', `✨ Bot instance created: ${name} (ID: ${botId})`);

    // Verify token if provided
    if (token) {
      try {
        const tRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const tData = await tRes.json();
        if (tData.ok && tData.result?.username) {
          newBot.botUsername = tData.result.username;
          addBotLog(botId, 'info', `Connected to Telegram bot: @${tData.result.username}`);
          saveRegistry();
        }
      } catch {}
    }

    if (autoStart) {
      await startBot(botId);
    }

    res.json({
      success: true,
      bot: {
        ...newBot,
        status: activeProcesses.has(botId) ? 'running' : newBot.status,
        fileCount: getBotFileCount(botId)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single bot controls
app.post("/api/bots/:id/start", async (req, res) => {
  const ok = await startBot(req.params.id);
  const bot = hostedBots.find(b => b.id === req.params.id);
  res.json({ success: ok, bot });
});

app.post("/api/bots/:id/stop", async (req, res) => {
  const ok = await stopBot(req.params.id);
  const bot = hostedBots.find(b => b.id === req.params.id);
  res.json({ success: ok, bot });
});

app.post("/api/bots/:id/restart", async (req, res) => {
  const ok = await restartBot(req.params.id);
  const bot = hostedBots.find(b => b.id === req.params.id);
  res.json({ success: ok, bot });
});

app.delete("/api/bots/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await stopBot(id);
    hostedBots = hostedBots.filter(b => b.id !== id);
    saveRegistry();

    // Delete directory
    const botDir = path.join(HOSTED_BOTS_DIR, id);
    if (fs.existsSync(botDir)) {
      fs.rmSync(botDir, { recursive: true, force: true });
    }

    botLogsMap.delete(id);
    res.json({ success: true, message: `Bot ${id} deleted` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bot logs
app.get("/api/bots/:id/logs", (req, res) => {
  const { id } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 300;
  const logs = botLogsMap.get(id) || [];
  res.json({ logs: logs.slice(-limit) });
});

app.post("/api/bots/:id/clear-logs", (req, res) => {
  const { id } = req.params;
  if (botLogsMap.has(id)) {
    botLogsMap.set(id, []);
  }
  addBotLog(id, 'system', 'Console logs cleared.');
  res.json({ success: true });
});

// Bot files
app.get("/api/bots/:id/files", (req, res) => {
  const { id } = req.params;
  const botDir = path.join(HOSTED_BOTS_DIR, id);
  try {
    if (!fs.existsSync(botDir)) return res.json({ files: [] });
    const all = fs.readdirSync(botDir);
    const files = all.filter(f => !f.startsWith('.git') && f !== '__pycache__');
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/bots/:id/file", (req, res) => {
  const { id } = req.params;
  const name = req.query.name as string;
  if (!name) return res.status(400).json({ error: "Missing filename" });
  try {
    const filePath = path.join(HOSTED_BOTS_DIR, id, path.basename(name));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ filename: name, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bots/:id/file", async (req, res) => {
  const { id } = req.params;
  const { filename, content, restart } = req.body;
  if (!filename || content === undefined) {
    return res.status(400).json({ error: "Missing filename or content" });
  }
  try {
    const safeName = path.basename(filename);
    const filePath = path.join(HOSTED_BOTS_DIR, id, safeName);
    fs.writeFileSync(filePath, content, "utf-8");
    addBotLog(id, 'system', `File saved: ${safeName}`);

    // If saving entry file or token, check token
    const bot = hostedBots.find(b => b.id === id);
    if (bot && safeName === bot.entryFile) {
      const match = content.match(/BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([^"']+)["']/);
      if (match && match[1]) {
        bot.token = match[1];
        saveRegistry();
      }
    }

    if (restart && activeProcesses.has(id)) {
      await restartBot(id);
    }

    res.json({ success: true, filename: safeName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/bots/:id/delete-file", (req, res) => {
  const { id } = req.params;
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: "Filename required" });
  try {
    const filePath = path.join(HOSTED_BOTS_DIR, id, path.basename(filename));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      addBotLog(id, 'system', `Deleted file: ${filename}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Test bot token against Telegram official API
app.post("/api/bots/:id/test-token", async (req, res) => {
  const { id } = req.params;
  const bot = hostedBots.find(b => b.id === id);
  const token = req.body.token || bot?.token;
  if (!token) {
    return res.status(400).json({ ok: false, error: "No BOT_TOKEN provided" });
  }
  try {
    const fetchRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await fetchRes.json();
    if (data.ok && data.result?.username && bot) {
      bot.token = token;
      bot.botUsername = data.result.username;
      saveRegistry();
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Export zip for a specific bot
app.get("/api/bots/:id/export/zip", (req, res) => {
  const { id } = req.params;
  const botDir = path.join(HOSTED_BOTS_DIR, id);
  if (!fs.existsSync(botDir)) {
    return res.status(404).json({ error: "Bot not found" });
  }

  try {
    const zipName = `${id}_pack.zip`;
    const zipPath = path.join(process.cwd(), zipName);
    
    // Use Python's built-in zipfile to zip the directory cleanly
    const pyZipScript = `
import zipfile, os
bot_dir = r"${botDir}"
zip_path = r"${zipPath}"
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(bot_dir):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, bot_dir)
            z.write(full, rel)
`;
    const tmpPy = path.join(process.cwd(), `_zip_${id}.py`);
    fs.writeFileSync(tmpPy, pyZipScript, "utf-8");
    execSync(`python3 "${tmpPy}"`);
    try { fs.unlinkSync(tmpPy); } catch {}

    if (fs.existsSync(zipPath)) {
      res.download(zipPath, `${id}_deploy.zip`, () => {
        try { fs.unlinkSync(zipPath); } catch {}
      });
    } else {
      res.status(500).json({ error: "Failed to generate zip" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Pip Package Manager endpoints
app.get("/api/pip/packages", (req, res) => {
  try {
    const output = execSync("python3 -m pip list --format=json", { encoding: "utf-8" });
    const packages = JSON.parse(output);
    res.json({ packages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/pip/install", (req, res) => {
  const { package: pkg } = req.body;
  if (!pkg || typeof pkg !== 'string') {
    return res.status(400).json({ error: "Package name required" });
  }
  // Sanitize package name
  const safePkg = pkg.trim().replace(/[^a-zA-Z0-9_\-\[\]<>=.]+/g, "");
  try {
    const output = execSync(`python3 -m pip install ${safePkg}`, { encoding: "utf-8" });
    res.json({ success: true, output });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, output: err.stdout || err.stderr });
  }
});

// Legacy backward-compatibility routes for existing components
app.get("/api/bot/status", (req, res) => {
  const activeBot = hostedBots[0];
  if (!activeBot) {
    return res.json({
      status: 'stopped',
      pid: null,
      uptimeSeconds: 0,
      startTime: null,
      pythonVersion: "Python 3.10.12",
      logSummary: { totalLogs: 0, lastLogTime: null }
    });
  }
  const isRunning = activeProcesses.has(activeBot.id);
  const logs = botLogsMap.get(activeBot.id) || [];
  res.json({
    status: isRunning ? 'running' : activeBot.status,
    pid: isRunning ? activeProcesses.get(activeBot.id)?.pid || null : null,
    uptimeSeconds: getBotUptime(activeBot.id),
    startTime: activeBot.startTime,
    pythonVersion: "Python 3.10.12",
    botInfo: {
      ok: true,
      username: activeBot.botUsername
    },
    logSummary: {
      totalLogs: logs.length,
      lastLogTime: logs.length > 0 ? logs[logs.length - 1].timestamp : null
    }
  });
});

app.post("/api/bot/start", async (req, res) => {
  const activeBot = hostedBots[0];
  if (!activeBot) return res.status(404).json({ error: "No bot found" });
  const ok = await startBot(activeBot.id);
  res.json({ success: ok, status: activeBot.status });
});

app.post("/api/bot/stop", async (req, res) => {
  const activeBot = hostedBots[0];
  if (!activeBot) return res.status(404).json({ error: "No bot found" });
  const ok = await stopBot(activeBot.id);
  res.json({ success: ok, status: activeBot.status });
});

app.post("/api/bot/restart", async (req, res) => {
  const activeBot = hostedBots[0];
  if (!activeBot) return res.status(404).json({ error: "No bot found" });
  const ok = await restartBot(activeBot.id);
  res.json({ success: ok, status: activeBot.status });
});

app.get("/api/bot/logs", (req, res) => {
  const activeBot = hostedBots[0];
  const logs = activeBot ? botLogsMap.get(activeBot.id) || [] : [];
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 300;
  res.json({ logs: logs.slice(-limit) });
});

app.post("/api/bot/clear-logs", (req, res) => {
  const activeBot = hostedBots[0];
  if (activeBot && botLogsMap.has(activeBot.id)) {
    botLogsMap.set(activeBot.id, []);
  }
  res.json({ success: true });
});

app.get("/api/files", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : process.cwd();
  try {
    const files = fs.readdirSync(dir).filter(f => !f.startsWith('.git') && f !== '__pycache__');
    res.json({ files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/files/read", (req, res) => {
  const filename = req.query.name as string;
  if (!filename) return res.status(400).json({ error: "Missing filename" });
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : process.cwd();
  try {
    const filePath = path.join(dir, path.basename(filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ filename, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/files/save", (req, res) => {
  const { filename, content, restart } = req.body;
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : process.cwd();
  try {
    const safeName = path.basename(filename);
    const filePath = path.join(dir, safeName);
    fs.writeFileSync(filePath, content, "utf-8");
    if (restart && activeBot && activeProcesses.has(activeBot.id)) {
      restartBot(activeBot.id);
    }
    res.json({ success: true, filename: safeName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/services", (req, res) => {
  const botId = (req.query.botId as string) || (hostedBots[0]?.id);
  const dir = botId ? path.join(HOSTED_BOTS_DIR, botId) : process.cwd();
  try {
    const p = path.join(dir, "custom_services.json");
    if (!fs.existsSync(p) || fs.readFileSync(p, "utf-8").trim() === "[]" || fs.readFileSync(p, "utf-8").trim() === "") {
      fs.writeFileSync(p, JSON.stringify(DEFAULT_SERVICES, null, 2), "utf-8");
      return res.json({ services: DEFAULT_SERVICES });
    }
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    res.json({ services: Array.isArray(data) && data.length > 0 ? data : DEFAULT_SERVICES });
  } catch (err: any) {
    res.json({ services: DEFAULT_SERVICES });
  }
});

app.post("/api/services", (req, res) => {
  const botId = (req.query.botId as string) || (hostedBots[0]?.id);
  const dir = botId ? path.join(HOSTED_BOTS_DIR, botId) : process.cwd();
  try {
    const p = path.join(dir, "custom_services.json");
    const list = Array.isArray(req.body.services) && req.body.services.length > 0 ? req.body.services : DEFAULT_SERVICES;
    fs.writeFileSync(p, JSON.stringify(list, null, 2), "utf-8");
    if (botId) {
      addBotLog(botId, 'system', `💾 সার্ভিস লিস্ট সেভ করা হয়েছে (${list.length}টি সার্ভিস একটিভ)।`);
    }
    res.json({ success: true, services: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset services to default 9 services
app.post(["/api/services/reset-default", "/api/bots/:id/services/reset-default"], (req, res) => {
  const botId = req.params.id || (req.query.botId as string) || (hostedBots[0]?.id);
  const dir = botId ? path.join(HOSTED_BOTS_DIR, botId) : process.cwd();
  try {
    const p = path.join(dir, "custom_services.json");
    fs.writeFileSync(p, JSON.stringify(DEFAULT_SERVICES, null, 2), "utf-8");
    if (botId) {
      addBotLog(botId, 'system', `🔄 অল সার্ভিস এবং কান্ট্রি রেঞ্জ সম্পূর্ণ রিকনফিগার করা হয়েছে।`);
    }
    res.json({ success: true, services: DEFAULT_SERVICES });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get bot SMS panel configuration
app.get(["/api/bots/:id/sms-config", "/api/sms-config"], (req, res) => {
  const botId = req.params.id || (req.query.botId as string) || (hostedBots[0]?.id);
  const bot = hostedBots.find(b => b.id === botId) || hostedBots[0];
  if (!bot) return res.status(404).json({ error: "Bot not found" });

  const botDir = path.join(HOSTED_BOTS_DIR, bot.id);
  let baseUrl = bot.env?.BASE_URL || "https://minosms.com";
  let apiKey = bot.env?.API_KEY || "";
  let token = bot.token || "";

  if (fs.existsSync(botDir)) {
    const pyFiles = fs.readdirSync(botDir).filter(f => f.endsWith('.py'));
    for (const f of pyFiles) {
      const code = fs.readFileSync(path.join(botDir, f), "utf-8");
      const mUrl = code.match(/BASE_URL\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([^"']+)["']/);
      if (mUrl && mUrl[1]) baseUrl = mUrl[1];
      const mKey = code.match(/API_KEY\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([a-zA-Z0-9_-]+)["']/);
      if (mKey && mKey[1]) apiKey = mKey[1];
      const mToken = code.match(/BOT_TOKEN\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([0-9]{8,12}:[a-zA-Z0-9_-]{30,45})["']/);
      if (mToken && mToken[1]) token = mToken[1];
    }
  }

  let servicesCount = DEFAULT_SERVICES.length;
  try {
    const sPath = path.join(botDir, "custom_services.json");
    if (fs.existsSync(sPath)) {
      const s = JSON.parse(fs.readFileSync(sPath, "utf-8"));
      if (Array.isArray(s)) servicesCount = s.length;
    }
  } catch {}

  res.json({
    botId: bot.id,
    botName: bot.name,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    token,
    servicesCount
  });
});

// Update SMS panel config (Base URL, API Key, Token)
app.post(["/api/bots/:id/sms-config", "/api/sms-config"], async (req, res) => {
  const botId = req.params.id || (req.body.botId as string) || (hostedBots[0]?.id);
  const bot = hostedBots.find(b => b.id === botId) || hostedBots[0];
  if (!bot) return res.status(404).json({ error: "Bot not found" });

  const { baseUrl, apiKey, token } = req.body;
  const botDir = path.join(HOSTED_BOTS_DIR, bot.id);

  bot.env = bot.env || {};
  if (baseUrl) {
    bot.env.BASE_URL = baseUrl.trim().replace(/\/+$/, '');
  }
  if (apiKey !== undefined) {
    bot.env.API_KEY = apiKey.trim();
  }
  if (token) {
    bot.token = token.trim();
  }

  patchAndValidateBotCode(botDir, bot.id, baseUrl, apiKey, token);
  saveRegistry();

  if (activeProcesses.has(bot.id)) {
    await restartBot(bot.id);
    addBotLog(bot.id, 'system', `🔄 নতুন এসএমএস প্যানেল সাইট (${baseUrl}) ও এপিআই কি সেভ করে বট রিস্টার্ট করা হয়েছে।`);
  }

  res.json({ success: true, message: "কনফিগারেশন সফলভাবে সেভ হয়েছে!" });
});

// Live Test SMS Panel API (Get Number & Success OTP Check)
app.post(["/api/bots/:id/test-sms-api", "/api/test-sms-api"], async (req, res) => {
  const botId = req.params.id || (req.body.botId as string) || (hostedBots[0]?.id);
  const bot = hostedBots.find(b => b.id === botId) || hostedBots[0];
  const botDir = bot ? path.join(HOSTED_BOTS_DIR, bot.id) : process.cwd();

  let baseUrl = req.body.baseUrl || bot?.env?.BASE_URL || "https://minosms.com";
  let apiKey = req.body.apiKey || bot?.env?.API_KEY || "";

  if (!apiKey && fs.existsSync(botDir)) {
    const pyFiles = fs.readdirSync(botDir).filter(f => f.endsWith('.py'));
    for (const f of pyFiles) {
      const code = fs.readFileSync(path.join(botDir, f), "utf-8");
      const m = code.match(/API_KEY\s*=\s*(?:os\.getenv\([^,]+,\s*)?["']([a-zA-Z0-9_-]+)["']/);
      if (m && m[1]) {
        apiKey = m[1];
        break;
      }
    }
  }

  baseUrl = baseUrl.replace(/\/+$/, '');

  try {
    const testRange = req.body.range || "23762XXX";
    const startTime = Date.now();
    const getNumberUrl = `${baseUrl}/getnumber?api_key=${apiKey}&rid=${testRange}&range=${testRange}`;

    const fetchRes = await fetch(getNumberUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
      }
    });

    const latency = Date.now() - startTime;
    const text = await fetchRes.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}

    // Check OTP stream
    let otpFeedOk = false;
    let otpCount = 0;
    try {
      const otpRes = await fetch(`${baseUrl}/success_otp?api_key=${apiKey}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const otpData: any = await otpRes.json();
      if (otpData?.status === 'success' || Array.isArray(otpData?.data)) {
        otpFeedOk = true;
        otpCount = Array.isArray(otpData?.data) ? otpData.data.length : 0;
      }
    } catch {}

    const success = fetchRes.status === 200 && json && !json.error;
    const allocatedNumber = json?.number || null;

    res.json({
      success: fetchRes.status === 200,
      statusCode: fetchRes.status,
      latencyMs: latency,
      baseUrl,
      testRange,
      apiKeyMasked: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : "None",
      number: allocatedNumber,
      message: json?.msg || json?.message || (fetchRes.status === 200 ? "নাম্বার রিসিভ টেস্ট সফল হয়েছে!" : "সার্ভার এরর"),
      rawResponse: json || text,
      otpFeedOk,
      otpCount
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, baseUrl });
  }
});

app.get("/api/users", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : process.cwd();
  try {
    const uPath = path.join(dir, "users.json");
    const bPath = path.join(dir, "banned_users.json");
    const users = fs.existsSync(uPath) ? JSON.parse(fs.readFileSync(uPath, "utf-8")) : {};
    const banned: string[] = fs.existsSync(bPath) ? JSON.parse(fs.readFileSync(bPath, "utf-8")) : [];
    const list = Object.values(users).map((u: any) => ({
      ...u,
      is_banned: banned.includes(String(u.user_id))
    }));
    res.json({ users: list, totalCount: list.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users/balance", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : process.cwd();
  try {
    const { userId, amount } = req.body;
    const uPath = path.join(dir, "users.json");
    const users = fs.existsSync(uPath) ? JSON.parse(fs.readFileSync(uPath, "utf-8")) : {};
    const uStr = String(userId);
    if (!users[uStr]) users[uStr] = { user_id: uStr, balance: 0.0 };
    users[uStr].balance = Math.max(0, (users[uStr].balance || 0) + Number(amount));
    fs.writeFileSync(uPath, JSON.stringify(users, null, 2), "utf-8");
    res.json({ success: true, balance: users[uStr].balance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users/ban", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : process.cwd();
  try {
    const { userId, ban } = req.body;
    const bPath = path.join(dir, "banned_users.json");
    let banned: string[] = fs.existsSync(bPath) ? JSON.parse(fs.readFileSync(bPath, "utf-8")) : [];
    const uStr = String(userId);
    if (ban) {
      if (!banned.includes(uStr)) banned.push(uStr);
    } else {
      banned = banned.filter(id => id !== uStr);
    }
    fs.writeFileSync(bPath, JSON.stringify(banned, null, 2), "utf-8");
    res.json({ success: true, is_banned: ban });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/withdraws", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : process.cwd();
  try {
    const p = path.join(dir, "withdraw_requests.json");
    const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
    res.json({ withdraws: Object.values(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/withdraws/action", (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : process.cwd();
  try {
    const { paymentId, status } = req.body;
    const p = path.join(dir, "withdraw_requests.json");
    const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : {};
    if (data[paymentId]) {
      data[paymentId].status = status;
      fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/broadcast", async (req, res) => {
  const activeBot = hostedBots[0];
  const dir = activeBot ? path.join(HOSTED_BOTS_DIR, activeBot.id) : process.cwd();
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });
  try {
    const token = activeBot?.token || "8814477083:AAH_G8v9gg3YRyVUyYvVRZ65Y_ZIT2nffJM";
    const uPath = path.join(dir, "users.json");
    const users = fs.existsSync(uPath) ? JSON.parse(fs.readFileSync(uPath, "utf-8")) : {};
    const uids = Object.keys(users);

    (async () => {
      let sent = 0;
      for (const uid of uids) {
        try {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: uid,
              text: `📢 <b>ADMIN NOTICE</b>\n\n${message}`,
              parse_mode: "HTML"
            })
          });
          sent++;
        } catch {}
      }
      if (activeBot) {
        addBotLog(activeBot.id, 'system', `Broadcast sent to ${sent}/${uids.length} users.`);
      }
    })();

    res.json({ success: true, totalRecipients: uids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/export/zip", (req, res) => {
  const activeBot = hostedBots[0];
  if (activeBot) {
    return res.redirect(`/api/bots/${activeBot.id}/export/zip`);
  }
  res.status(404).json({ error: "No bot to export" });
});

// Vite middleware & server startup
async function startServer() {
  initHostedBots();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BotHost Cloud Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
