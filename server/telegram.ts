import { log } from "./index";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendTelegramMessage(chatId: string, text: string, options?: any) {
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...options }),
    });
    return await res.json();
  } catch (err) {
    log(`Failed to send Telegram message: ${err}`, "telegram");
  }
}

export async function checkChannelMembership(userId: string, channelUsername: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channelUsername, user_id: userId }),
    });
    const data = await res.json();
    if (!data.ok) return false;
    const status = data.result?.status;
    return ["creator", "administrator", "member"].includes(status);
  } catch {
    return false;
  }
}

export async function setWebhook(url: string) {
  try {
    const res = await fetch(`${API_BASE}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    log(`Webhook set: ${JSON.stringify(data)}`, "telegram");
    return data;
  } catch (err) {
    log(`Failed to set webhook: ${err}`, "telegram");
  }
}

export async function setChatMenuButton(webAppUrl: string) {
  try {
    const res = await fetch(`${API_BASE}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "Open Mail",
          web_app: { url: webAppUrl },
        },
      }),
    });
    const data = await res.json();
    log(`Menu button set: ${JSON.stringify(data)}`, "telegram");
  } catch (err) {
    log(`Failed to set menu button: ${err}`, "telegram");
  }
}

export function generateRandomEmail(domain: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let prefix = "";
  for (let i = 0; i < 8; i++) {
    prefix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}@${domain}`;
}
