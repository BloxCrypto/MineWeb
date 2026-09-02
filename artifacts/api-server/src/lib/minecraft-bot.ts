import * as mineflayer from "mineflayer";
import type { Bot } from "mineflayer";
import pathfinderPackage from "mineflayer-pathfinder";
import { logger } from "./logger";
import { startPrismarineViewer, stopPrismarineViewer } from "./minecraft-viewer";

const { Movements, goals, pathfinder } = pathfinderPackage;

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

export interface BotPlayer {
  username: string;
  displayName: string | null;
}

export interface BotCommandResult {
  output: string;
  status: BotStatus;
}

export interface BotConnectSettings {
  host: string;
  port: number;
  username: string;
  version?: string | null;
  auth: "offline" | "microsoft";
  offlinePassword?: string | null;
}

const MAX_LOGS = 200;

let bot: Bot | null = null;
let settings: BotConnectSettings | null = null;
let state: BotState = "offline";
let lastEvent: string | null = null;
let updatedAt = new Date().toISOString();
let sequence = 0;
const logs: BotLog[] = [];
let offlineAuthTimers: ReturnType<typeof setTimeout>[] = [];

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

function clearOfflineAuthTimers() {
  for (const timer of offlineAuthTimers) clearTimeout(timer);
  offlineAuthTimers = [];
}

function scheduleOfflineAuth(currentBot: Bot, password: string | null | undefined) {
  if (settings?.auth !== "offline" || !password) return;

  const registerTimer = setTimeout(() => {
    if (bot !== currentBot || state !== "online") return;
    currentBot.chat(`/register ${password} ${password}`);
    addLog("info", "Sent automatic offline account registration check");

    const loginTimer = setTimeout(() => {
      if (bot !== currentBot || state !== "online") return;
      currentBot.chat(`/login ${password}`);
      addLog("info", "Sent automatic offline account login");
    }, 1400);
    offlineAuthTimers.push(loginTimer);
  }, 1800);

  offlineAuthTimers.push(registerTimer);
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
  clearOfflineAuthTimers();
  state = "connecting";
  touch();
  addLog(
    "info",
    `Connecting ${nextSettings.username} to ${nextSettings.host}:${nextSettings.port}`,
  );

  try {
    const currentBot = mineflayer.createBot({
      host: nextSettings.host,
      port: nextSettings.port,
      username: nextSettings.username,
      auth: nextSettings.auth,
      ...(nextSettings.version ? { version: nextSettings.version } : {}),
      hideErrors: true,
    });
    bot = currentBot;
    currentBot.loadPlugin(pathfinder);

    currentBot.once("login", () => {
      if (bot !== currentBot) return;
      state = "connecting";
      addLog("info", `Authenticated as ${currentBot.username ?? nextSettings.username}`);
    });

    currentBot.once("spawn", () => {
      if (bot !== currentBot) return;
      state = "online";
      addLog(
        "success",
        `Bot spawned in ${currentBot.version ?? nextSettings.version ?? "server world"}`,
      );
      if (currentBot.pathfinder) {
        currentBot.pathfinder.setMovements(new Movements(currentBot));
        addLog("info", "Pathfinder ready for coordinate navigation");
      }
      const viewerVersion = startPrismarineViewer(currentBot);
      if (viewerVersion) {
        addLog(
          "success",
          `Live world viewer ready at /api/viewer/ (assets: ${viewerVersion})`,
        );
      } else {
        addLog("warning", "Live world viewer could not start for this server version");
      }
      scheduleOfflineAuth(currentBot, nextSettings.offlinePassword);
    });

    currentBot.on("chat", (username, message) => {
      if (bot !== currentBot) return;
      addLog("chat", `${username}: ${message}`);
    });

    currentBot.on("health", () => {
      if (bot !== currentBot) return;
      touch();
    });

    currentBot.on("move", () => {
      if (bot !== currentBot) return;
      touch();
    });

    currentBot.on("kicked", (reason) => {
      if (bot !== currentBot) return;
      state = "error";
      addLog("warning", `Kicked: ${String(reason)}`);
    });

    currentBot.on("error", (error) => {
      if (bot !== currentBot) return;
      state = "error";
      addLog("error", error.message || "Mineflayer reported an unknown error");
    });

    currentBot.on("end", (reason) => {
      if (bot !== currentBot) return;
      if (state !== "error") state = "offline";
      addLog("warning", reason ? `Connection ended: ${reason}` : "Connection ended");
      stopPrismarineViewer();
      clearOfflineAuthTimers();
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
    stopPrismarineViewer();
    clearOfflineAuthTimers();
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

export function getBotPlayers(): BotPlayer[] {
  if (!bot || state !== "online") return [];
  return Object.values(bot.players)
    .map((player) => ({
      username: player.username,
      displayName: player.displayName ? player.displayName.toString() : null,
    }))
    .sort((a, b) => a.username.localeCompare(b.username));
}

function requireOnlineBot(): Bot {
  if (!bot || state !== "online") {
    throw new Error("Bot is not connected");
  }
  return bot;
}

export function runBotCommand(command: string): BotCommandResult {
  const currentBot = requireOnlineBot();
  const normalized = command.trim().replace(/^!/, "");
  const [name, ...args] = normalized.split(/\s+/);

  if (name === "help") {
    return {
      output: "!say <message> · !goto <x> <y> <z> · !serverlist · !help",
      status: getBotStatus(),
    };
  }

  if (name === "serverlist") {
    const players = getBotPlayers();
    return {
      output:
        players.length > 0
          ? `Visible players (${players.length}): ${players.map((player) => player.username).join(", ")}`
          : "No players are synchronized yet.",
      status: getBotStatus(),
    };
  }

  if (name === "say") {
    const message = args.join(" ").trim();
    if (!message) throw new Error("Usage: !say <message>");
    currentBot.chat(message);
    addLog("chat", `${currentBot.username}: ${message}`);
    return { output: `Sent to chat: ${message}`, status: getBotStatus() };
  }

  if (name === "goto") {
    if (args.length !== 2 && args.length !== 3) {
      throw new Error("Usage: !goto <x> <z> or !goto <x> <y> <z>");
    }

    const numbers = args.map(Number);
    if (numbers.some((value) => !Number.isFinite(value))) {
      throw new Error("Coordinates must be numbers.");
    }

    const x = numbers[0];
    const z = args.length === 3 ? numbers[2] : numbers[1];
    const y = args.length === 3 ? numbers[1] : currentBot.entity.position.y;
    const target = {
      x: Math.floor(x),
      y: Math.floor(y),
      z: Math.floor(z),
    };

    if (!currentBot.pathfinder) {
      throw new Error("Pathfinder is not ready yet.");
    }

    void currentBot.pathfinder
      .goto(new goals.GoalBlock(target.x, target.y, target.z))
      .then(() => addLog("success", `Arrived at (${target.x}, ${target.y}, ${target.z})`))
      .catch((error: unknown) =>
        addLog(
          "error",
          `Pathfinder failed: ${error instanceof Error ? error.message : "unknown error"}`,
        ),
      );

    const output = `Navigating to (${target.x}, ${target.y}, ${target.z})`;
    addLog("info", output);
    return { output, status: getBotStatus() };
  }

  throw new Error("Unknown command. Try !help.");
}