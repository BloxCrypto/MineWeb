import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const minecraftAccountsTable = pgTable("minecraft_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: varchar("owner_id").notNull(),
  label: text("label").notNull(),
  username: text("username").notNull(),
  auth: text("auth").notNull(),
  encryptedPassword: text("encrypted_password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MinecraftAccount = typeof minecraftAccountsTable.$inferSelect;
export type NewMinecraftAccount = typeof minecraftAccountsTable.$inferInsert;