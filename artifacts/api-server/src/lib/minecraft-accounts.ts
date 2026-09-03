import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
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

interface StoredAccount {
  id: string;
  ownerId: string;
  label: string;
  username: string;
  auth: MinecraftAccountAuth;
  encryptedPassword: string | null;
  createdAt: string;
  updatedAt: string;
}

const ACCOUNTS_FILE = path.resolve(process.cwd(), "artifacts/api-server/data/accounts.json");

function loadAccountsFromFile(): StoredAccount[] {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[minecraft-accounts] Error reading accounts file:", err);
  }
  return [];
}

function saveAccountsToFile(accounts: StoredAccount[]) {
  try {
    const dir = path.dirname(ACCOUNTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf-8");
  } catch (err) {
    console.error("[minecraft-accounts] Error saving accounts file:", err);
  }
}

function getEncryptionKey() {
  const secret = process.env.SESSION_SECRET || "minecraft-server-accounts-secure-storage-key-salt";
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

function toSummary(account: StoredAccount | MinecraftAccount): MinecraftAccountSummary {
  return {
    id: account.id,
    label: account.label,
    username: account.username,
    auth: accountAuth(account.auth),
    hasPassword: Boolean(account.encryptedPassword),
    createdAt: typeof account.createdAt === "string" ? account.createdAt : account.createdAt.toISOString(),
  };
}

export async function listMinecraftAccounts(ownerId = "default"): Promise<MinecraftAccountSummary[]> {
  const fileAccounts = loadAccountsFromFile();

  if (process.env.DATABASE_URL) {
    try {
      const accounts = await db
        .select()
        .from(minecraftAccountsTable)
        .where(eq(minecraftAccountsTable.ownerId, ownerId))
        .orderBy(desc(minecraftAccountsTable.createdAt));
      return accounts.map(toSummary);
    } catch (err) {
      throw new Error("The account database is unavailable.");
    }
  }

  return fileAccounts.filter((item) => item.ownerId === ownerId).map(toSummary);
}

export async function createMinecraftAccount(input: {
  ownerId?: string;
  label: string;
  username: string;
  auth: MinecraftAccountAuth;
  password?: string;
}): Promise<MinecraftAccountSummary> {
  if (input.auth === "microsoft" && input.password) {
    throw new Error("Microsoft accounts use device-code sign-in, not a password.");
  }

  const now = new Date().toISOString();
  const newAccount: StoredAccount = {
    id: randomUUID(),
    ownerId: input.ownerId || "default",
    label: input.label.trim(),
    username: input.username.trim(),
    auth: input.auth,
    encryptedPassword: input.password ? encryptPassword(input.password) : null,
    createdAt: now,
    updatedAt: now,
  };

  if (process.env.DATABASE_URL) {
    try {
      await db.insert(minecraftAccountsTable).values({
        id: newAccount.id,
        ownerId: newAccount.ownerId,
        label: newAccount.label,
        username: newAccount.username,
        auth: newAccount.auth,
        encryptedPassword: newAccount.encryptedPassword,
        createdAt: new Date(newAccount.createdAt),
        updatedAt: new Date(newAccount.updatedAt),
      });
    } catch (err) {
      throw new Error("The account could not be saved to the database.");
    }
  } else {
    const accounts = loadAccountsFromFile();
    accounts.unshift(newAccount);
    saveAccountsToFile(accounts);
  }

  return toSummary(newAccount);
}

export async function deleteMinecraftAccount(id: string, ownerId = "default"): Promise<boolean> {
  if (process.env.DATABASE_URL) {
    try {
      const deleted = await db
        .delete(minecraftAccountsTable)
        .where(and(eq(minecraftAccountsTable.id, id), eq(minecraftAccountsTable.ownerId, ownerId)))
        .returning({ id: minecraftAccountsTable.id });
      return deleted.length > 0;
    } catch (err) {
      throw new Error("The account could not be deleted from the database.");
    }
  }

  const accounts = loadAccountsFromFile();
  const filtered = accounts.filter((acc) => acc.id !== id || acc.ownerId !== ownerId);
  const deleted = filtered.length !== accounts.length;
  if (deleted) saveAccountsToFile(filtered);
  return deleted;
}

export async function getMinecraftAccountCredentials(
  id: string,
  ownerId = "default",
): Promise<MinecraftAccountCredentials> {
  const accounts = loadAccountsFromFile();
  let account: StoredAccount | null = accounts.find((acc) => acc.id === id && acc.ownerId === ownerId) ?? null;

  if (!account && process.env.DATABASE_URL) {
    try {
      const [dbAccount] = await db
        .select()
        .from(minecraftAccountsTable)
        .where(and(eq(minecraftAccountsTable.id, id), eq(minecraftAccountsTable.ownerId, ownerId)))
        .limit(1);
      if (dbAccount) {
        account = {
          id: dbAccount.id,
          ownerId: dbAccount.ownerId,
          label: dbAccount.label,
          username: dbAccount.username,
          auth: accountAuth(dbAccount.auth),
          encryptedPassword: dbAccount.encryptedPassword,
          createdAt: dbAccount.createdAt.toISOString(),
          updatedAt: dbAccount.updatedAt.toISOString(),
        };
      }
    } catch (err) {
      console.warn("[minecraft-accounts] Database credentials lookup failed:", err);
    }
  }

  if (!account) throw new Error("Saved Minecraft account was not found.");

  return {
    summary: toSummary(account),
    password: account.encryptedPassword ? decryptPassword(account.encryptedPassword) : null,
  };
}