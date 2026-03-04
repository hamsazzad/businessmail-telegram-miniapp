import { eq, and, lte, gte, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  users, generatedEmails, receivedEmails, adminSettings,
  type User, type InsertUser, type GeneratedEmail, type InsertGeneratedEmail,
  type ReceivedEmail, type InsertReceivedEmail, type AdminSetting
} from "@shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  getOrCreateUser(telegramId: string, username?: string, firstName?: string): Promise<User>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  updateUserTokens(telegramId: string, amount: number): Promise<User | undefined>;
  setUserTokens(telegramId: string, tokens: number): Promise<User | undefined>;
  updateUserGems(telegramId: string, amount: number): Promise<User | undefined>;
  redeemGem(telegramId: string): Promise<User | undefined>;
  updateUserJoinStatus(telegramId: string, joined: boolean, claimed: boolean): Promise<User | undefined>;
  updateUserCheckinDate(telegramId: string, date: string): Promise<User | undefined>;
  setUserMaxEmails(telegramId: string, maxEmails: number | null): Promise<User | undefined>;
  setUserMaxEmailDays(telegramId: string, maxEmailDays: number | null): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  createEmail(email: InsertGeneratedEmail): Promise<GeneratedEmail>;
  getEmailsByUserId(userId: number): Promise<GeneratedEmail[]>;
  getEmailByAddress(address: string): Promise<GeneratedEmail | undefined>;
  deleteEmail(emailId: number, userId: number): Promise<void>;
  extendEmailExpiry(emailId: number, hours: number): Promise<GeneratedEmail | undefined>;
  deleteExpiredEmails(): Promise<void>;

  saveReceivedEmail(email: InsertReceivedEmail): Promise<ReceivedEmail>;
  getReceivedEmailsByAddress(address: string): Promise<ReceivedEmail[]>;
  getReceivedEmailById(id: number): Promise<ReceivedEmail | undefined>;

  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<AdminSetting[]>;
}

export class DatabaseStorage implements IStorage {
  async getOrCreateUser(telegramId: string, username?: string, firstName?: string): Promise<User> {
    const existing = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
    if (existing.length > 0) return existing[0];
    const [user] = await db.insert(users).values({
      telegramId,
      username: username || null,
      firstName: firstName || null,
      tokens: 0,
      gems: 0,
      hasJoinedChannel: false,
      joinRewardClaimed: false,
      lastCheckinDate: null,
      maxEmails: null,
      maxEmailDays: null,
    }).returning();
    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
    return result[0];
  }

  async updateUserTokens(telegramId: string, amount: number): Promise<User | undefined> {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return undefined;
    const newTokens = Math.max(0, user.tokens + amount);
    const [updated] = await db.update(users)
      .set({ tokens: newTokens })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async setUserTokens(telegramId: string, tokens: number): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ tokens: Math.max(0, tokens) })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async updateUserGems(telegramId: string, amount: number): Promise<User | undefined> {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user) return undefined;
    const newGems = Math.max(0, Math.round(((user.gems || 0) + amount) * 100) / 100);
    const [updated] = await db.update(users)
      .set({ gems: newGems })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async redeemGem(telegramId: string): Promise<User | undefined> {
    const user = await this.getUserByTelegramId(telegramId);
    if (!user || (user.gems || 0) < 1) return undefined;
    const newGems = Math.round(((user.gems || 0) - 1) * 100) / 100;
    const [updated] = await db.update(users)
      .set({ gems: newGems })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async updateUserJoinStatus(telegramId: string, joined: boolean, claimed: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ hasJoinedChannel: joined, joinRewardClaimed: claimed })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async updateUserCheckinDate(telegramId: string, date: string): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ lastCheckinDate: date })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async setUserMaxEmails(telegramId: string, maxEmails: number | null): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ maxEmails })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async setUserMaxEmailDays(telegramId: string, maxEmailDays: number | null): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ maxEmailDays })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createEmail(email: InsertGeneratedEmail): Promise<GeneratedEmail> {
    const [created] = await db.insert(generatedEmails).values(email).returning();
    return created;
  }

  async getEmailsByUserId(userId: number): Promise<GeneratedEmail[]> {
    return db.select().from(generatedEmails).where(eq(generatedEmails.userId, userId));
  }

  async getEmailByAddress(address: string): Promise<GeneratedEmail | undefined> {
    const result = await db.select().from(generatedEmails).where(eq(generatedEmails.emailAddress, address)).limit(1);
    return result[0];
  }

  async deleteEmail(emailId: number, userId: number): Promise<void> {
    await db.delete(generatedEmails).where(and(eq(generatedEmails.id, emailId), eq(generatedEmails.userId, userId)));
  }

  async extendEmailExpiry(emailId: number, hours: number): Promise<GeneratedEmail | undefined> {
    const existing = await db.select().from(generatedEmails).where(eq(generatedEmails.id, emailId)).limit(1);
    if (!existing[0]) return undefined;
    const newExpiry = new Date(existing[0].expiresAt.getTime() + hours * 60 * 60 * 1000);
    const [updated] = await db.update(generatedEmails)
      .set({ expiresAt: newExpiry })
      .where(eq(generatedEmails.id, emailId))
      .returning();
    return updated;
  }

  async deleteExpiredEmails(): Promise<void> {
    await db.delete(generatedEmails).where(lte(generatedEmails.expiresAt, new Date()));
  }

  async saveReceivedEmail(email: InsertReceivedEmail): Promise<ReceivedEmail> {
    const [created] = await db.insert(receivedEmails).values(email).returning();
    return created;
  }

  async getReceivedEmailsByAddress(address: string): Promise<ReceivedEmail[]> {
    return db.select().from(receivedEmails)
      .where(eq(receivedEmails.emailAddress, address))
      .orderBy(desc(receivedEmails.receivedAt));
  }

  async getReceivedEmailById(id: number): Promise<ReceivedEmail | undefined> {
    const result = await db.select().from(receivedEmails).where(eq(receivedEmails.id, id)).limit(1);
    return result[0];
  }

  async getSetting(key: string): Promise<string | undefined> {
    const result = await db.select().from(adminSettings).where(eq(adminSettings.key, key)).limit(1);
    return result[0]?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await db.select().from(adminSettings).where(eq(adminSettings.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(adminSettings).set({ value }).where(eq(adminSettings.key, key));
    } else {
      await db.insert(adminSettings).values({ key, value });
    }
  }

  async getAllSettings(): Promise<AdminSetting[]> {
    return db.select().from(adminSettings);
  }
}

export const storage = new DatabaseStorage();

export async function initializeDefaults() {
  const defaults: Record<string, string> = {
    default_email_days: "7",
    ad_reward_tokens: "20",
    extension_cost: "10",
    join_reward_tokens: "20",
    checkin_tokens: "6",
    extension_days: "2",
    extension_limit: "5",
    max_emails_per_user: "10",
    gem_per_ad: "0.2",
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await storage.getSetting(key);
    if (!existing) {
      await storage.setSetting(key, value);
    }
  }
}
