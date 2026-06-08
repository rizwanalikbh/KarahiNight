import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const otpSessionsTable = pgTable("otp_sessions", {
  id: serial("id").primaryKey(),
  mobile: text("mobile").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OtpSession = typeof otpSessionsTable.$inferSelect;
