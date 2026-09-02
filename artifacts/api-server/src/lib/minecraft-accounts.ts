import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, minecraftAccountsTable, type MinecraftAccount } from "@workspace/db";

export type MinecraftAccountAuth = "offline" | "microsoft";

export interface MinecraftAccountSummary {
  id: string;
  label: string;
  username: string;
  auth: MinecraftAccountAuth;
  hasPassword: boolean;
  createdAt: string;
}

export interface MinecraftAccountCredentials {
  summary: MinecraftAccountSummary;
  password: string | null;
}

function getEncryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured to save Minecraft accounts.");
  }
  return scryptSync(secret, "minecraft-account-passwords", 32);
}

function encryptPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptPassword(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Saved account password is corrupted.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function accountAuth(value: string): MinecraftAccountAuth {
  if (value === "offline" || value === "microsoft") return value;
  throw new Error("Saved account has an invalid authentication mode.");
}

function toSummary(account: MinecraftAccount): MinecraftAccountSummary {
  return {
    id: account.id,
    label: account.label,
    username: account.username,
    auth: accountAuth(account.auth),
    hasPassword: Boolean(account.encryptedPassword),
    createdAt: account.createdAt.toISOString(),
  };
}

export async function listMinecraftAccounts() {
  const accounts = await db
    .select()
    .from(minecraftAccountsTable)
    .orderBy(desc(minecraftAccountsTable.createdAt));
  return accounts.map(toSummary);
}

export async function createMinecraftAccount(input: {
  label: string;
  username: string;
  auth: MinecraftAccountAuth;
  password?: string;
}) {
  if (input.auth === "offline" && !input.password) {
    throw new Error("Offline accounts need a server password.");
  }
  if (input.auth === "microsoft" && input.password) {
    throw new Error("Microsoft accounts use device-code sign-in, not a password.");
  }

  const [account] = await db
    .insert(minecraftAccountsTable)
    .values({
      label: input.label.trim(),
      username: input.username.trim(),
      auth: input.auth,
      encryptedPassword: input.password ? encryptPassword(input.password) : null,
    })
    .returning();

  if (!account) throw new Error("The account could not be saved.");
  return toSummary(account);
}

export async function deleteMinecraftAccount(id: string) {
  const deleted = await db
    .delete(minecraftAccountsTable)
    .where(eq(minecraftAccountsTable.id, id))
    .returning({ id: minecraftAccountsTable.id });
  return deleted.length > 0;
}

export async function getMinecraftAccountCredentials(id: string): Promise<MinecraftAccountCredentials> {
  const [account] = await db
    .select()
    .from(minecraftAccountsTable)
    .where(eq(minecraftAccountsTable.id, id))
    .limit(1);

  if (!account) throw new Error("Saved Minecraft account was not found.");

  return {
    summary: toSummary(account),
    password: account.encryptedPassword ? decryptPassword(account.encryptedPassword) : null,
  };
}