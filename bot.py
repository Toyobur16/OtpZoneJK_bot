import asyncio
import io
import re
import json
import html
import os
import httpx
import pyotp
import random
import string
from datetime import datetime, timedelta
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters, CallbackQueryHandler

# ==================== CONFIG SECTION ====================
BOT_TOKEN = os.getenv("BOT_TOKEN", "8814477083:AAH_G8v9gg3YRyVUyYvVRZ65Y_ZIT2nffJM")
API_KEY = os.getenv("API_KEY", "mino_live_bfde1ae6289d122dfae7e3f6ff10a9c8")
BASE_URL = os.getenv("BASE_URL", "https://mino-sms-panel.xyz")

USER_DATA_FILE = "users.json"
PAID_SMS_FILE = "paid_sms.json"
STATS_FILE = "user_stats.json"
REFERRAL_DATA_FILE = "referral_data.json"
BANNED_USERS_FILE = "banned_users.json"
WITHDRAW_DATA_FILE = "withdraw_requests.json"
ACTIVITY_LOGS_FILE = "activity_logs.json"
DATA_RANGE_FILE = "datarange.json"
CUSTOM_SERVICES_FILE = "custom_services.json"

ADMINS = [6130692829]
OTP_GROUP_ID = -1003989722688

WELCOME_MESSAGE = """⚡ 𝗠𝗜𝗡𝗢 𝗦𝗠𝗦 𝗣𝗔𝗡𝗘𝗟 𝗕𝗢𝗧 ⚡ 
━━━━━━━━━━━━━━━━━━━━━━
🟢 𝗣𝗿𝗲𝗺𝗶𝘂𝗺 & ⚡ 𝗙𝗮𝘀𝘁 𝗦𝗲𝗿𝘃𝗶𝗰𝗲 🟢"""

OTP_RATE = 0.00
REFERRAL_PRICE = 0
MIN_WITHDRAW = 50
MAX_WITHDRAW = 10000
SUPPORT_LINK = "https://t.me/MinoXSupport0"

request_queue = asyncio.Queue()
active_numbers = {}
last_range = {}
CHECK_INTERVAL = 0.2

client_async = httpx.AsyncClient(
    http2=False,
    timeout=httpx.Timeout(connect=5.0, read=30.0, write=5.0, pool=15.0),
    headers={
        "X-API-Key": API_KEY,
        "api-key": API_KEY,
        "Authorization": f"Bearer {API_KEY}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MinoBot/1.0",
        "Accept": "application/json, text/plain, */*"
    }
)

def get_bangladesh_time():
    return datetime.utcnow() + timedelta(hours=6)

def normalize_number(number):
    if not number:
        return ""
    return re.sub(r'\D', '', str(number))

def mask_number(number):
    num_str = str(number)
    if len(num_str) <= 6:
        return num_str
    return num_str[:4] + "****" + num_str[-2:]

def is_valid_bangladesh_number(number):
    clean = re.sub(r'\D', '', str(number))
    if len(clean) == 11 and clean.startswith("01"):
        return True
    if len(clean) == 13 and clean.startswith("8801"):
        return True
    return False

def format_balance(balance):
    try:
        return f"{float(balance):.2f}"
    except:
        return "0.00"

def get_date_reset_time():
    bd_now = get_bangladesh_time()
    return datetime(bd_now.year, bd_now.month, bd_now.day)

def extract_link_and_otp(full_sms):
    if not full_sms:
        return None, None
    otp_match = re.search(r'\b\d{4,8}\b', full_sms)
    otp = otp_match.group(0) if otp_match else None
    link_match = re.search(r'https?://[^\s]+', full_sms)
    link = link_match.group(0) if link_match else None
    return otp, link

def numbers_match(num1, num2):
    n1 = re.sub(r'\D', '', str(num1))
    n2 = re.sub(r'\D', '', str(num2))
    if not n1 or not n2:
        return False
    return n1 in n2 or n2 in n1

def make_bold_unicode(text):
    out = []
    for char in text:
        cp = ord(char)
        if 65 <= cp <= 90:
            out.append(chr(cp - 65 + 0x1D5D4))
        elif 97 <= cp <= 122:
            out.append(chr(cp - 97 + 0x1D5EE))
        elif 48 <= cp <= 57:
            out.append(chr(cp - 48 + 0x1D7EC))
        else:
            out.append(char)
    return "".join(out)

def normalize_stylized_text(text):
    if not text:
        return ""
    out = []
    for char in text:
        cp = ord(char)
        if 0x1D5D4 <= cp <= 0x1D5ED:
            out.append(chr(cp - 0x1D5D4 + 65))
        elif 0x1D5EE <= cp <= 0x1D607:
            out.append(chr(cp - 0x1D5EE + 97))
        elif 0x1D7EC <= cp <= 0x1D7F5:
            out.append(chr(cp - 0x1D7EC + 48))
        else:
            out.append(char)
    return "".join(out)

def is_admin(user_id):
    return user_id in ADMINS

def load_data(filename=USER_DATA_FILE):
    if not os.path.exists(filename):
        with open(filename, "w", encoding="utf-8") as f:
            json.dump({}, f)
        return {}
    try:
        with open(filename, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_data(data, filename=USER_DATA_FILE):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

def get_country_info(number):
    number = str(number).strip()
    country_map = {
        "237": ("🇨🇲", "Cameroon"),
        "225": ("🇨🇮", "Ivory Coast"),
        "261": ("🇲🇬", "Madagascar"),
        "40": ("🇷🇴", "Romania"),
        "44": ("🇬🇧", "United Kingdom"),
        "1": ("🇺🇸", "United States"),
        "7": ("🇷🇺", "Russia"),
        "91": ("🇮🇳", "India"),
        "92": ("🇵🇰", "Pakistan"),
        "880": ("🇧🇩", "Bangladesh"),
        "20": ("🇪🇬", "Egypt"),
        "234": ("🇳🇬", "Nigeria"),
        "254": ("🇰🇪", "Kenya"),
        "212": ("🇲🇦", "Morocco"),
    }
    clean_num = str(number).replace('+', '').replace(' ', '').replace('-', '').strip()
    for prefix in sorted(country_map.keys(), key=len, reverse=True):
        if clean_num.startswith(prefix):
            return country_map[prefix]
    return ("🌍", "Unknown")

def detect_service(full_sms):
    if not full_sms:
        return "SMS SERVICE"
    sms_lower = full_sms.lower()
    keywords = {
        "facebook": "FACEBOOK", "fb": "FACEBOOK",
        "whatsapp": "WHATSAPP", "telegram": "TELEGRAM",
        "instagram": "INSTAGRAM", "tiktok": "TIKTOK",
        "google": "GOOGLE", "gmail": "GOOGLE",
        "twitter": "TWITTER", "snapchat": "SNAPCHAT"
    }
    for k, v in keywords.items():
        if k in sms_lower:
            return v
    return "SMS SERVICE"

def load_custom_services():
    if not os.path.exists(CUSTOM_SERVICES_FILE):
        default_services = [
            {
                "sid": "FACEBOOK",
                "ranges": [
                    {"range": "23762XXX", "country": "🇨🇲 Cameroon"},
                    {"range": "4077XXX", "country": "🇷🇴 Romania"}
                ]
            },
            {
                "sid": "WHATSAPP",
                "ranges": [
                    {"range": "22501XXX", "country": "🇨🇮 Ivory Coast"},
                    {"range": "26132XXX", "country": "🇲🇬 Madagascar"}
                ]
            },
            {
                "sid": "TELEGRAM",
                "ranges": [
                    {"range": "23765XXX", "country": "🇨🇲 Cameroon"}
                ]
            }
        ]
        save_data(default_services, CUSTOM_SERVICES_FILE)
        return default_services
    try:
        with open(CUSTOM_SERVICES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []

def main_keyboard(user_id):
    keyboard = [
        [KeyboardButton(text=f"📞 {make_bold_unicode('GET NUMBER')}")],
        [
            KeyboardButton(text=f"👥 {make_bold_unicode('REFER AND EARN')}"),
            KeyboardButton(text=f"👤 {make_bold_unicode('PROFILE')}")
        ],
        [KeyboardButton(text=f"🏆 {make_bold_unicode('LEADERBOARD')}")]
    ]
    if is_admin(user_id):
        keyboard.append([KeyboardButton(text=f"⚙️ {make_bold_unicode('ADMIN PANEL')} ⚙️")])
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    users = load_data(USER_DATA_FILE)
    if str(uid) not in users:
        users[str(uid)] = {
            "user_id": str(uid),
            "username": update.effective_user.username or "",
            "full_name": update.effective_user.full_name or "",
            "balance": 0.0,
            "created_at": datetime.utcnow().isoformat()
        }
        save_data(users, USER_DATA_FILE)
    await update.message.reply_text(WELCOME_MESSAGE, reply_markup=main_keyboard(uid))

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return
    uid = update.effective_user.id
    raw = update.message.text.strip()
    clean = normalize_stylized_text(raw).upper()

    if "GET NUMBER" in clean:
        services = load_custom_services()
        buttons = []
        for i, s in enumerate(services):
            buttons.append([InlineKeyboardButton(f"🚀 {s.get('sid', 'Service')}", callback_data=f"svc_{i}")])
        await update.message.reply_text(
            "📞 <b>GET NUMBER</b>\n\nSelect a service from below:",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(buttons)
        )
    elif "PROFILE" in clean:
        users = load_data(USER_DATA_FILE)
        u = users.get(str(uid), {"balance": 0.0})
        await update.message.reply_text(
            f"👤 <b>PROFILE</b>\n🆔 ID: <code>{uid}</code>\n💰 Balance: <code>{u.get('balance', 0):.2f} BDT</code>",
            parse_mode="HTML"
        )
    elif "LEADERBOARD" in clean:
        await update.message.reply_text("🏆 <b>LEADERBOARD</b>\nNo records yet.", parse_mode="HTML")
    else:
        await update.message.reply_text("🔹 Please choose an option:", reply_markup=main_keyboard(uid))

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    if data.startswith("svc_"):
        idx = int(data.split("_")[1])
        services = load_custom_services()
        if idx < len(services):
            svc = services[idx]
            ranges = svc.get("ranges", [])
            btns = []
            for r in ranges:
                btns.append([InlineKeyboardButton(f"🌐 {r.get('country', '')} - {r.get('range', '')}", callback_data="num_req")])
            await query.message.edit_text(f"Selected: <b>{svc.get('sid')}</b>", parse_mode="HTML", reply_markup=InlineKeyboardMarkup(btns))
    elif data == "num_req":
        await query.message.edit_text("⏳ Requesting number from SMS Panel... (Connected to Mino API)", parse_mode="HTML")

async def monitor_loop(app):
    print("📡 SMS Monitor loop started...")
    while True:
        try:
            # Polling SMS panel
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            break
        except Exception as e:
            await asyncio.sleep(5)

async def post_init(application):
    asyncio.create_task(monitor_loop(application))

def main():
    print(f"🚀 Initializing Telegram Bot with token: {BOT_TOKEN[:10]}...")
    try:
        app = ApplicationBuilder().token(BOT_TOKEN).post_init(post_init).build()
        app.add_handler(CommandHandler("start", start_command))
        app.add_handler(CallbackQueryHandler(button_callback))
        app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))
        print("✅ Telegram Bot is running in polling mode!")
        app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)
    except Exception as e:
        print(f"❌ Failed to start bot: {e}")

if __name__ == "__main__":
    main()
