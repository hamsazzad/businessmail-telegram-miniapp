import { pgTable, text, integer, boolean, timestamp, serial, varchar, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  tokens: integer("tokens").notNull().default(0),
  gems: real("gems").notNull().default(0),
  hasJoinedChannel: boolean("has_joined_channel").notNull().default(false),
  joinRewardClaimed: boolean("join_reward_claimed").notNull().default(false),
  lastCheckinDate: text("last_checkin_date"),
  maxEmails: integer("max_emails"),
  maxEmailDays: integer("max_email_days"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const generatedEmails = pgTable("generated_emails", {
  id: serial("id").primaryKey(),
  emailAddress: text("email_address").notNull().unique(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const receivedEmails = pgTable("received_emails", {
  id: serial("id").primaryKey(),
  emailAddress: text("email_address").notNull(),
  fromAddress: text("from_address").notNull(),
  subject: text("subject").notNull().default("(No Subject)"),
  body: text("body").notNull().default(""),
  receivedAt: timestamp("received_at").defaultNow(),
});

export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertEmailSchema = createInsertSchema(generatedEmails).omit({ id: true, createdAt: true });
export const insertReceivedEmailSchema = createInsertSchema(receivedEmails).omit({ id: true, receivedAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type GeneratedEmail = typeof generatedEmails.$inferSelect;
export type InsertGeneratedEmail = z.infer<typeof insertEmailSchema>;
export type ReceivedEmail = typeof receivedEmails.$inferSelect;
export type InsertReceivedEmail = z.infer<typeof insertReceivedEmailSchema>;
export type AdminSetting = typeof adminSettings.$inferSelect;
