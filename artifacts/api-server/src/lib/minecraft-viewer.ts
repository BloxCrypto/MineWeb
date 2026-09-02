import { createRequire } from "node:module";
import type { Server } from "node:http";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import type { Express, Request, Response } from "express";
import httpProxy from "http-proxy";
import type { Bot } from "mineflayer";
import { logger } from "./logger";

const require = createRequire(import.meta.url);
const prismarineViewer = require("prismarine-viewer") as typeof import("prismarine-viewer");
const viewerProxy = httpProxy.createProxyServer({ ws: true });
const VIEWER_PORT = 8091;
const VIEWER_TARGET = `http://127.0.0.1:${VIEWER_PORT}`;
const VIEWER_PATH = "/api/viewer";
const supportedViewerVersions = prismarineViewer.supportedVersions as string[];
const viewerPackageRoot = dirname(require.resolve("prismarine-viewer"));
const mobileOptimizedViewerClient = readFileSync(
  join(viewerPackageRoot, "public/index.js"),
  "utf8",
).replace(
  "setPixelRatio(window.devicePixelRatio||1)",
  "setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))",
);

let viewerStarted = false;
let viewerClose: (() => void) | null = null;

function proxyError(error: Error, res?: Response) {
  logger.warn({ err: error }, "Prismarine viewer proxy unavailable");
  if (res && !res.headersSent) {
    res.status(503).json({ error: "The live viewer is not ready yet." });
  }
}

export function registerViewerProxy(app: Express, server: Server) {
  app.use(VIEWER_PATH, (req: Request, res: Response) => {
    if (!viewerStarted) {
      res.status(503).json({ error: "Connect the bot to start the live viewer." });
      return;
    }

    if (req.path === "/index.js") {
      res.type("application/javascript").set("Cache-Control", "no-cache").send(mobileOptimizedViewerClient);
      return;
    }

    viewerProxy.web(
      req,
      res,
      { target: VIEWER_TARGET },
      (error: Error) => proxyError(error, res),
    );
  });

  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith(`${VIEWER_PATH}/socket.io`)) return;
    if (!viewerStarted) {
      socket.destroy();
      return;
    }

    req.url = req.url.slice(VIEWER_PATH.length) || "/";
    viewerProxy.ws(
      req,
      socket,
      head,
      { target: VIEWER_TARGET },
      (error: Error) => {
        logger.warn({ err: error }, "Prismarine viewer WebSocket unavailable");
        socket.destroy();
      },
    );
  });
}

function getCompatibleViewerVersion(botVersion: string) {
  if (supportedViewerVersions.includes(botVersion)) return botVersion;

  const sameMajorMinor = botVersion.match(/^(\d+\.\d+)/)?.[1];
  if (sameMajorMinor) {
    const matchingVersions = supportedViewerVersions.filter((version) =>
      version.startsWith(`${sameMajorMinor}.`),
    );
    if (matchingVersions.length > 0) {
      return matchingVersions[matchingVersions.length - 1];
    }
  }

  return supportedViewerVersions[supportedViewerVersions.length - 1] ?? null;
}

export function startPrismarineViewer(bot: Bot): string | null {
  stopPrismarineViewer();

  try {
    const viewerVersion = getCompatibleViewerVersion(bot.version);
    if (!viewerVersion) {
      logger.warn({ botVersion: bot.version }, "No compatible Prismarine viewer version found");
      return null;
    }

    if (viewerVersion !== bot.version) {
      logger.warn(
        { botVersion: bot.version, viewerVersion },
        "Using closest supported Prismarine viewer version",
      );
    }

    // Prismarine Viewer reads bot.version when the browser connects. Keep the
    // real Mineflayer bot untouched and expose only a compatible version to
    // the viewer's event handlers.
    const viewerBot = Object.create(bot) as Bot & {
      version: string;
      viewer?: { close?: () => void };
    };
    viewerBot.version = viewerVersion;

    prismarineViewer.mineflayer(viewerBot, {
      port: VIEWER_PORT,
      viewDistance: 4,
      firstPerson: false,
    });
    viewerClose = viewerBot.viewer?.close ?? null;
    viewerStarted = true;
    logger.info({ port: VIEWER_PORT, viewerVersion }, "Prismarine viewer started");
    return viewerVersion;
  } catch (error) {
    viewerStarted = false;
    viewerClose = null;
    logger.error({ err: error }, "Unable to start Prismarine viewer");
    return null;
  }
}

export function stopPrismarineViewer() {
  if (viewerClose) {
    viewerClose();
  }
  viewerClose = null;
  viewerStarted = false;
}

export function isPrismarineViewerStarted() {
  return viewerStarted;
}