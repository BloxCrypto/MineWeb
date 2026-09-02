import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const minecraftAccountsTable = pgTable("minecraft_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  label: text("label").notNull(),
  username: text("username").notNull(),
  auth: text("auth").notNull(),
  encryptedPassword: text("encrypted_password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MinecraftAccount = typeof minecraftAccountsTable.$inferSelect;
export type NewMinecraftAccount = typeof minecraftAccountsTable.$inferInsert;