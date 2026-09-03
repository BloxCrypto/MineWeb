import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const botLogsTable = pgTable("bot_logs", {
  id: varchar("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  level: varchar("level").notNull(),
  message: text("message").notNull(),
});

export type BotLog = typeof botLogsTable.$inferSelect;