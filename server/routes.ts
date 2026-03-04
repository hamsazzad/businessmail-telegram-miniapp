import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, initializeDefaults } from "./storage";
import { sendTelegramMessage, checkChannelMembership, setWebhook, setChatMenuButton, generateRandomEmail } from "./telegram";
import { log } from "./index";

const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || "";
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || "@aamoviesofficial";
const DOMAIN_NAME = process.env.DOMAIN_NAME || "filmcity.online";

function isAdmin(telegramId: string): boolean {
  return String(telegramId) === ADMIN_TELEGRAM_ID && ADMIN_TELEGRAM_ID !== "";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await initializeDefaults();

  app.post("/api/auth", async (req, res) => {
    try {
      const { telegramId, username, firstName } = req.body;
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });
      const user = await storage.getOrCreateUser(String(telegramId), username, firstName);
      const emails = await storage.getEmailsByUserId(user.id);
      const activeEmails = emails.filter(e => new Date(e.expiresAt) > new Date());
      const settings = await storage.getAllSettings();
      const settingsMap = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);
      res.json({
        user,
        emails: activeEmails,
        isAdmin: isAdmin(String(telegramId)),
        settings: {
          max_emails_per_user: settingsMap.max_emails_per_user || "10",
          default_email_days: settingsMap.default_email_days || "7",
          extension_days: settingsMap.extension_days || "2",
          extension_cost: settingsMap.extension_cost || "10",
          gem_per_ad: settingsMap.gem_per_ad || "0.2",
        },
      });
    } catch (err: any) {
      log(`Auth error: ${err.message}`, "api");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/generate-email", async (req, res) => {
    try {
      const { telegramId, customName, subdomain } = req.body;
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });
      const user = await storage.getUserByTelegramId(String(telegramId));
      if (!user) return res.status(404).json({ error: "User not found" });

      if (!isAdmin(String(telegramId))) {
        const isMember = await checkChannelMembership(String(telegramId), CHANNEL_USERNAME);
        if (!isMember) {
          return res.status(403).json({ error: "Please join our channel first to create emails", requireJoin: true });
        }
      }

      const existingEmails = await storage.getEmailsByUserId(user.id);
      const activeEmails = existingEmails.filter(e => new Date(e.expiresAt) > new Date());

      if (!isAdmin(String(telegramId))) {
        const globalMaxStr = await storage.getSetting("max_emails_per_user") || "10";
        const globalMax = parseInt(globalMaxStr);
        const userMax = user.maxEmails !== null ? user.maxEmails : globalMax;
        const gemBonus = Math.floor(user.gems || 0);
        const effectiveMax = userMax + gemBonus;

        if (activeEmails.length >= effectiveMax) {
          return res.status(400).json({
            error: `You've reached your email limit (${effectiveMax}). ${gemBonus > 0 ? `Includes ${gemBonus} gem bonus.` : "Earn gems by watching ads for extra slots."}`,
            limit: effectiveMax,
          });
        }
      }

      const userDays = user.maxEmailDays;
      const globalDaysStr = await storage.getSetting("default_email_days") || "7";
      const days = userDays !== null ? userDays : parseInt(globalDaysStr);
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      let emailAddress: string;
      if (customName) {
        const name = customName.toLowerCase().replace(/[^a-z0-9._-]/g, "");
        if (!name || name.length < 2 || name.length > 30) {
          return res.status(400).json({ error: "Name must be 2-30 characters (letters, numbers, dots, hyphens)" });
        }
        const domain = subdomain
          ? `${subdomain.toLowerCase().replace(/[^a-z0-9-]/g, "")}.${DOMAIN_NAME}`
          : DOMAIN_NAME;
        emailAddress = `${name}@${domain}`;
      } else {
        const domain = subdomain
          ? `${subdomain.toLowerCase().replace(/[^a-z0-9-]/g, "")}.${DOMAIN_NAME}`
          : DOMAIN_NAME;
        emailAddress = generateRandomEmail(domain);
      }

      const existing = await storage.getEmailByAddress(emailAddress);
      if (existing) {
        return res.status(400).json({ error: "This email address is already taken. Try a different name." });
      }

      const email = await storage.createEmail({ emailAddress, userId: user.id, expiresAt });
      res.json({ email });
    } catch (err: any) {
      log(`Generate email error: ${err.message}`, "api");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.delete("/api/delete-email/:emailId", async (req, res) => {
    try {
      const { telegramId } = req.body;
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });
      const user = await storage.getUserByTelegramId(String(telegramId));
      if (!user) return res.status(404).json({ error: "User not found" });
      const emailId = parseInt(req.params.emailId);
      await storage.deleteEmail(emailId, user.id);
      res.json({ success: true });
    } catch (err: any) {
      log(`Delete email error: ${err.message}`, "api");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/verify-join", async (req, res) => {
    try {
      const { telegramId } = req.body;
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });
      const user = await storage.getUserByTelegramId(String(telegramId));
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.joinRewardClaimed) return res.json({ user, already_claimed: true });

      const isMember = await checkChannelMembership(String(telegramId), CHANNEL_USERNAME);
      if (!isMember) return res.json({ user, joined: false });

      const rewardStr = await storage.getSetting("join_reward_tokens") || "20";
      const reward = parseInt(rewardStr);
      await storage.updateUserJoinStatus(String(telegramId), true, true);
      const updated = await storage.updateUserTokens(String(telegramId), reward);
      res.json({ user: updated, joined: true, reward });
    } catch (err: any) {
      log(`Verify join error: ${err.message}`, "api");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/daily-checkin", async (req, res) => {
    try {
      const { telegramId } = req.body;
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });
      const user = await storage.getUserByTelegramId(String(telegramId));
      if (!user) return res.status(404).json({ error: "User not found" });

      const today = new Date().toISOString().split("T")[0];
      if (user.lastCheckinDate === today) {
        return res.json({ user, already_checked_in: true });
      }

      const rewardStr = await storage.getSetting("checkin_tokens") || "6";
      const reward = parseInt(rewardStr);
      await storage.updateUserCheckinDate(String(telegramId), today);
      const updated = await storage.updateUserTokens(String(telegramId), reward);
      res.json({ user: updated, reward });
    } catch (err: any) {
      log(`Checkin error: ${err.message}`, "api");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/reward-ad", async (req, res) => {
    try {
      const { telegramId } = req.body;
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });
      const user = await storage.getUserByTelegramId(String(telegramId));
      if (!user) return res.status(404).json({ error: "User not found" });

      const rewardStr = await storage.getSetting("ad_reward_tokens") || "20";
      const reward = parseInt(rewardStr);
      const updated = await storage.updateUserTokens(String(telegramId), reward);

      const gemPerAdStr = await storage.getSetting("gem_per_ad") || "0.2";
      const gemPerAd = parseFloat(gemPerAdStr);
      const updatedWithGems = await storage.updateUserGems(String(telegramId), gemPerAd);

      res.json({ user: updatedWithGems || updated, reward, gemsEarned: gemPerAd });
    } catch (err: any) {
      log(`Ad reward error: ${err.message}`, "api");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/redeem-gem", async (req, res) => {
    try {
      const { telegramId } = req.body;
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });
      const user = await storage.getUserByTelegramId(String(telegramId));
      if (!user) return res.status(404).json({ error: "User not found" });
      if ((user.gems || 0) < 1) return res.status(400).json({ error: "Not enough gems. You need at least 1 gem." });

      const updated = await storage.redeemGem(String(telegramId));
      res.json({ user: updated, success: true });
    } catch (err: any) {
      log(`Redeem gem error: ${err.message}`, "api");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/extend-limit", async (req, res) => {
    try {
      const { telegramId, emailId } = req.body;
      if (!telegramId || !emailId) return res.status(400).json({ error: "telegramId and emailId required" });
      const user = await storage.getUserByTelegramId(String(telegramId));
      if (!user) return res.status(404).json({ error: "User not found" });

      if (!isAdmin(String(telegramId))) {
        const costStr = await storage.getSetting("extension_cost") || "10";
        const cost = parseInt(costStr);
        if (user.tokens < cost) return res.status(400).json({ error: "Not enough tokens", required: cost });
        await storage.updateUserTokens(String(telegramId), -cost);
      }

      let extensionHours: number;
      const daysStr = await storage.getSetting("extension_days");
      if (daysStr) {
        extensionHours = parseInt(daysStr) * 24;
      } else {
        const hoursStr = await storage.getSetting("extension_hours") || "48";
        extensionHours = parseInt(hoursStr);
      }
      const hours = extensionHours;
      const updatedEmail = await storage.extendEmailExpiry(emailId, hours);
      if (!updatedEmail) return res.status(404).json({ error: "Email not found" });

      const updated = await storage.getUserByTelegramId(String(telegramId));
      res.json({ user: updated, email: updatedEmail });
    } catch (err: any) {
      log(`Extend error: ${err.message}`, "api");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/inbox/:emailAddress", async (req, res) => {
    try {
      const emails = await storage.getReceivedEmailsByAddress(req.params.emailAddress);
      res.json({ emails });
    } catch (err: any) {
      log(`Inbox error: ${err.message}`, "api");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/email/:id", async (req, res) => {
    try {
      const email = await storage.getReceivedEmailById(parseInt(req.params.id));
      if (!email) return res.status(404).json({ error: "Email not found" });
      res.json({ email });
    } catch (err: any) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/webhook/email", async (req, res) => {
    try {
      const { to, from, subject, body } = req.body;
      if (!to) return res.status(400).json({ error: "Missing 'to' field" });
      const emailAddress = to.toLowerCase().trim();
      await storage.saveReceivedEmail({
        emailAddress,
        fromAddress: from || "unknown",
        subject: subject || "(No Subject)",
        body: body || "",
      });
      log(`Received email for ${emailAddress} from ${from}`, "webhook");
      res.json({ success: true });
    } catch (err: any) {
      log(`Webhook error: ${err.message}`, "webhook");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/telegram-webhook", async (req, res) => {
    try {
      const update = req.body;
      if (update.message?.text === "/start") {
        const chatId = update.message.chat.id;
        const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "";
        const webAppUrl = `https://${replitDomain}`;
        await sendTelegramMessage(String(chatId),
          "Welcome to <b>BusinessMail</b>! Your private Business email service.\n\nTap the button below to open the app.",
          {
            reply_markup: {
              inline_keyboard: [[{
                text: "Open Mini App",
                web_app: { url: webAppUrl }
              }]]
            }
          }
        );
      }
      res.json({ ok: true });
    } catch (err: any) {
      log(`Telegram webhook error: ${err.message}`, "telegram");
      res.json({ ok: true });
    }
  });

  app.get("/api/admin/stats", async (req, res) => {
    try {
      const { adminId } = req.query;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });
      const allUsers = await storage.getAllUsers();
      const settings = await storage.getAllSettings();
      res.json({
        totalUsers: allUsers.length,
        totalTokens: allUsers.reduce((sum, u) => sum + u.tokens, 0),
        totalGems: Math.round(allUsers.reduce((sum, u) => sum + (u.gems || 0), 0) * 100) / 100,
        channelMembers: allUsers.filter(u => u.hasJoinedChannel).length,
        settings: settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {}),
      });
    } catch (err: any) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    try {
      const { adminId } = req.query;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });
      const allUsers = await storage.getAllUsers();
      const usersWithEmails = await Promise.all(
        allUsers.map(async (u) => {
          const emails = await storage.getEmailsByUserId(u.id);
          const activeEmails = emails.filter(e => new Date(e.expiresAt) > new Date());
          return { ...u, activeEmails: activeEmails.length, emails: activeEmails.map(e => e.emailAddress) };
        })
      );
      res.json({ users: usersWithEmails });
    } catch (err: any) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/admin/gift-tokens", async (req, res) => {
    try {
      const { adminId, telegramId, amount } = req.body;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });
      const tokens = parseInt(amount);
      if (isNaN(tokens) || tokens === 0) return res.status(400).json({ error: "Invalid amount" });

      const user = await storage.getUserByTelegramId(String(telegramId));
      if (!user) return res.status(404).json({ error: "User not found" });
      const updated = await storage.updateUserTokens(String(telegramId), tokens);
      res.json({ success: true, user: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/admin/gift-all", async (req, res) => {
    try {
      const { adminId, amount } = req.body;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });
      const tokens = parseInt(amount);
      if (isNaN(tokens) || tokens === 0) return res.status(400).json({ error: "Invalid amount" });

      const allUsers = await storage.getAllUsers();
      let count = 0;
      for (const user of allUsers) {
        await storage.updateUserTokens(user.telegramId, tokens);
        count++;
      }
      res.json({ success: true, count });
    } catch (err: any) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/admin/set-user-limits", async (req, res) => {
    try {
      const { adminId, telegramId, maxEmails, maxEmailDays } = req.body;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });

      const user = await storage.getUserByTelegramId(String(telegramId));
      if (!user) return res.status(404).json({ error: "User not found" });

      if (maxEmails !== undefined) {
        if (maxEmails === null || maxEmails === "") {
          await storage.setUserMaxEmails(String(telegramId), null);
        } else {
          const val = parseInt(maxEmails);
          if (isNaN(val) || val < 0) return res.status(400).json({ error: "Max emails must be a non-negative number or empty for global" });
          await storage.setUserMaxEmails(String(telegramId), val);
        }
      }
      if (maxEmailDays !== undefined) {
        if (maxEmailDays === null || maxEmailDays === "") {
          await storage.setUserMaxEmailDays(String(telegramId), null);
        } else {
          const val = parseInt(maxEmailDays);
          if (isNaN(val) || val < 1) return res.status(400).json({ error: "Email days must be at least 1 or empty for global" });
          await storage.setUserMaxEmailDays(String(telegramId), val);
        }
      }

      const updated = await storage.getUserByTelegramId(String(telegramId));
      res.json({ success: true, user: updated });
    } catch (err: any) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/admin/broadcast", async (req, res) => {
    try {
      const { adminId, message } = req.body;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });
      if (!message || !message.trim()) return res.status(400).json({ error: "Message is required" });

      const allUsers = await storage.getAllUsers();
      let sent = 0;
      let failed = 0;
      for (const user of allUsers) {
        try {
          await sendTelegramMessage(user.telegramId, message, {});
          sent++;
        } catch {
          failed++;
        }
      }
      res.json({ success: true, sent, failed, total: allUsers.length });
    } catch (err: any) {
      log(`Broadcast error: ${err.message}`, "api");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/admin/settings", async (req, res) => {
    try {
      const { adminId, key, value } = req.body;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });
      await storage.setSetting(key, String(value));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/admin/settings/bulk", async (req, res) => {
    try {
      const { adminId, settings } = req.body;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });
      for (const [key, value] of Object.entries(settings)) {
        await storage.setSetting(key, String(value));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/setup/telegram-webhook", async (req, res) => {
    try {
      const { adminId } = req.body;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });
      const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "";
      const webhookUrl = `https://${replitDomain}/api/telegram-webhook`;
      const result = await setWebhook(webhookUrl);
      const webAppUrl = `https://${replitDomain}`;
      await setChatMenuButton(webAppUrl);
      res.json({ success: true, webhookUrl, result });
    } catch (err: any) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.post("/api/setup/deploy-github", async (req, res) => {
    try {
      const { adminId } = req.body;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });

      const ghToken = process.env.GITHUB_TOKEN;
      const ghUsername = process.env.GITHUB_USERNAME;
      if (!ghToken || !ghUsername) return res.status(400).json({ error: "Missing GitHub credentials" });

      const repoName = "temp-mail-miniapp";
      const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "";
      const apiBase = replitDomain ? `https://${replitDomain}` : "";

      const ghHeaders = {
        Authorization: `token ${ghToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      };

      let repoExists = false;
      const checkRepo = await fetch(`https://api.github.com/repos/${ghUsername}/${repoName}`, { headers: ghHeaders });
      if (checkRepo.ok) repoExists = true;

      if (!repoExists) {
        const createRes = await fetch("https://api.github.com/user/repos", {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({ name: repoName, private: false, auto_init: true }),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          return res.status(400).json({ error: "Failed to create repo", details: err });
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BusinessMail - Telegram Mini App</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--tg-theme-bg-color,#fff);color:var(--tg-theme-text-color,#000);display:flex;align-items:center;justify-content:center;min-height:100vh}
.container{text-align:center;padding:2rem}
.loader{width:48px;height:48px;border:4px solid var(--tg-theme-hint-color,#ccc);border-top-color:var(--tg-theme-button-color,#3390ec);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1.5rem}
@keyframes spin{to{transform:rotate(360deg)}}
p{color:var(--tg-theme-hint-color,#999);font-size:14px}
</style>
</head>
<body>
<div class="container">
<div class="loader"></div>
<p>Redirecting to BusinessMail...</p>
</div>
<script>
window.Telegram.WebApp.ready();
window.Telegram.WebApp.expand();
window.location.href = "${apiBase}?tg=" + encodeURIComponent(JSON.stringify(window.Telegram.WebApp.initDataUnsafe));
</script>
</body>
</html>`;

      const content = Buffer.from(indexHtml).toString("base64");

      let sha: string | undefined;
      const getFile = await fetch(`https://api.github.com/repos/${ghUsername}/${repoName}/contents/index.html`, { headers: ghHeaders });
      if (getFile.ok) {
        const fileData = await getFile.json();
        sha = fileData.sha;
      }

      const putFile = await fetch(`https://api.github.com/repos/${ghUsername}/${repoName}/contents/index.html`, {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({
          message: "Deploy BusinessMail Mini App",
          content,
          ...(sha ? { sha } : {}),
        }),
      });

      if (!putFile.ok) {
        const err = await putFile.json();
        return res.status(400).json({ error: "Failed to push file", details: err });
      }

      const pagesRes = await fetch(`https://api.github.com/repos/${ghUsername}/${repoName}/pages`, {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ source: { branch: "main", path: "/" } }),
      });
      const pagesData = await pagesRes.json();

      const pagesUrl = `https://${ghUsername}.github.io/${repoName}/`;

      res.json({
        success: true,
        repoUrl: `https://github.com/${ghUsername}/${repoName}`,
        pagesUrl,
        pagesSetup: pagesData,
      });
    } catch (err: any) {
      log(`Deploy GitHub error: ${err.message}`, "api");
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/setup/deploy-worker", async (req, res) => {
    try {
      const { adminId } = req.body;
      if (!isAdmin(String(adminId))) return res.status(403).json({ error: "Unauthorized" });
      
      const replitDomain = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "";
      const webhookUrl = `https://${replitDomain.replace(/^https?:\/\//, '')}/api/webhook/email`;
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN;
      const zoneId = process.env.CLOUDFLARE_ZONE_ID;

      if (!accountId || !apiToken || !zoneId) {
        return res.status(400).json({ error: "Missing Cloudflare credentials" });
      }

      const workerScript = `
export default {
  async email(message, env, ctx) {
    try {
      const to = message.to;
      const from = message.from;
      const subject = message.headers.get("subject") || "(No Subject)";
      
      const rawEmail = new Response(message.raw);
      const body = await rawEmail.text();
      
      let plainBody = body;
      const contentType = message.headers.get("content-type") || "";
      if (contentType.includes("multipart")) {
        const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/);
        if (boundaryMatch) {
          const boundary = boundaryMatch[1];
          const parts = body.split("--" + boundary);
          for (const part of parts) {
            if (part.toLowerCase().includes("content-type: text/plain")) {
              const idx = part.indexOf("\\r\\n\\r\\n");
              if (idx > -1) { plainBody = part.substring(idx + 4).replace(/--$/, "").trim(); break; }
            }
          }
          if (plainBody === body) {
            for (const part of parts) {
              if (part.toLowerCase().includes("content-type: text/html")) {
                const idx = part.indexOf("\\r\\n\\r\\n");
                if (idx > -1) { plainBody = part.substring(idx + 4).replace(/--$/, "").trim(); break; }
              }
            }
          }
        }
      } else {
        const headerEnd = body.indexOf("\\r\\n\\r\\n");
        if (headerEnd > -1) { plainBody = body.substring(headerEnd + 4).trim(); }
      }
      
      const resp = await fetch("${webhookUrl}", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, from, subject, body: plainBody }),
      });
      if (!resp.ok) { console.error("Webhook failed:", resp.status); }
    } catch (err) {
      console.error("Email worker error:", err);
    }
  }
};`;

      const formData = new FormData();
      const metadata = JSON.stringify({
        main_module: "worker.js",
        compatibility_date: "2024-01-01",
      });
      formData.append("metadata", new Blob([metadata], { type: "application/json" }));
      formData.append("worker.js", new Blob([workerScript], { type: "application/javascript+module" }), "worker.js");

      const workerName = "tempmail-email-worker";
      const deployRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${apiToken}` },
          body: formData,
        }
      );
      const deployData = await deployRes.json();

      let routingResult = null;
      try {
        const routingRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: "TempMail Catch-All",
              enabled: true,
              matchers: [{ type: "all" }],
              actions: [{ type: "worker", value: [workerName] }],
            }),
          }
        );
        routingResult = await routingRes.json();
      } catch (err: any) {
        routingResult = { error: err.message };
      }

      res.json({
        success: deployData.success,
        worker: deployData,
        routing: routingResult,
      });
    } catch (err: any) {
      log(`Deploy worker error: ${err.message}`, "api");
      res.status(500).json({ error: err.message });
    }
  });

  setTimeout(async () => {
    try {
      const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN || "";
      if (replitDomain) {
        const webhookUrl = `https://${replitDomain}/api/telegram-webhook`;
        await setWebhook(webhookUrl);
        const webAppUrl = `https://${replitDomain}`;
        await setChatMenuButton(webAppUrl);
        log(`Auto-configured Telegram webhook: ${webhookUrl}`, "startup");
      }
    } catch (err) {
      log(`Auto webhook setup failed: ${err}`, "startup");
    }
  }, 3000);

  return httpServer;
}
