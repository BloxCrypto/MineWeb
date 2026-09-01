import * as mineflayer from "mineflayer";
import type { Bot } from "mineflayer";
import { logger } from "./logger";

export type BotState = "offline" | "connecting" | "online" | "error";
export type BotLogLevel = "info" | "success" | "warning" | "error" | "chat";

export interface BotPosition {
  x: number;
  y: number;
  z: number;
}

export interface BotStatus {
  state: BotState;
  username: string | null;
  host: string | null;
  port: number | null;
  version: string | null;
  health: number | null;
  position: BotPosition | null;
  lastEvent: string | null;
  updatedAt: string;
}

export interface BotLog {
  id: string;
  timestamp: string;
  level: BotLogLevel;
  message: string;
}

export interface BotConnectSettings {
  host: string;
  port: number;
  username: string;
  version?: string | null;
  auth: "offline" | "microsoft";
}

const MAX_LOGS = 200;

let bot: Bot | null = null;
let settings: BotConnectSettings | null = null;
let state: BotState = "offline";
let lastEvent: string | null = null;
let updatedAt = new Date().toISOString();
let sequence = 0;
const logs: BotLog[] = [];

function touch() {
  updatedAt = new Date().toISOString();
}

function addLog(level: BotLogLevel, message: string) {
  const entry: BotLog = {
    id: `${Date.now()}-${sequence++}`,
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  lastEvent = message;
  touch();
  logger.info({ level, message }, "Mineflayer bot event");
}

function safePosition(currentBot: Bot): BotPosition | null {
  const position = currentBot.entity?.position;
  if (!position) return null;
  return {
    x: Number(position.x.toFixed(2)),
    y: Number(position.y.toFixed(2)),
    z: Number(position.z.toFixed(2)),
  };
}

export function getBotStatus(): BotStatus {
  return {
    state,
    username: settings?.username ?? bot?.username ?? null,
    host: settings?.host ?? null,
    port: settings?.port ?? null,
    version: settings?.version ?? bot?.version ?? null,
    health: bot && state === "online" ? Number(bot.health.toFixed(1)) : null,
    position: bot && state === "online" ? safePosition(bot) : null,
    lastEvent,
    updatedAt,
  };
}

export function getBotLogs(): BotLog[] {
  return logs;
}

export function connectBot(nextSettings: BotConnectSettings): BotStatus {
  if (state === "connecting" || state === "online") {
    throw new Error("Bot is already connecting or connected");
  }

  settings = nextSettings;
  state = "connecting";
  touch();
  addLog(
    "info",
    `Connecting ${nextSettings.username} to ${nextSettings.host}:${nextSettings.port}`,
  );

  try {
    bot = mineflayer.createBot({
      host: nextSettings.host,
      port: nextSettings.port,
      username: nextSettings.username,
      auth: nextSettings.auth,
      ...(nextSettings.version ? { version: nextSettings.version } : {}),
      hideErrors: true,
    });

    bot.once("login", () => {
      state = "connecting";
      addLog("info", `Authenticated as ${bot?.username ?? nextSettings.username}`);
    });

    bot.once("spawn", () => {
      state = "online";
      addLog(
        "success",
        `Bot spawned in ${bot?.version ?? nextSettings.version ?? "server world"}`,
      );
    });

    bot.on("chat", (username, message) => {
      addLog("chat", `${username}: ${message}`);
    });

    bot.on("health", () => {
      touch();
    });

    bot.on("move", () => {
      touch();
    });

    bot.on("kicked", (reason) => {
      state = "error";
      addLog("warning", `Kicked: ${String(reason)}`);
    });

    bot.on("error", (error) => {
      state = "error";
      addLog("error", error.message || "Mineflayer reported an unknown error");
    });

    bot.on("end", (reason) => {
      if (state !== "error") state = "offline";
      addLog("warning", reason ? `Connection ended: ${reason}` : "Connection ended");
      bot = null;
      touch();
    });
  } catch (error) {
    state = "error";
    bot = null;
    addLog(
      "error",
      error instanceof Error ? error.message : "Unable to create Mineflayer bot",
    );
  }

  return getBotStatus();
}

export function disconnectBot(): BotStatus {
  if (bot) {
    addLog("info", "Disconnecting bot");
    bot.quit("Disconnected from the control console");
    bot = null;
  } else {
    addLog("info", "Bot is already offline");
  }
  state = "offline";
  touch();
  return getBotStatus();
}

export function sendBotChat(message: string): BotStatus {
  if (!bot || state !== "online") {
    throw new Error("Bot is not connected");
  }
  bot.chat(message);
  addLog("chat", `${bot.username}: ${message}`);
  return getBotStatus();
}