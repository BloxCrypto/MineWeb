import { createRequire } from "node:module";
import type { Server } from "node:http";
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

export function startPrismarineViewer(bot: Bot) {
  stopPrismarineViewer();

  try {
    prismarineViewer.mineflayer(bot, {
      port: VIEWER_PORT,
      viewDistance: 6,
      firstPerson: false,
    });
    viewerClose = (bot as Bot & { viewer?: { close?: () => void } }).viewer?.close ?? null;
    viewerStarted = true;
    logger.info({ port: VIEWER_PORT }, "Prismarine viewer started");
  } catch (error) {
    viewerStarted = false;
    viewerClose = null;
    logger.error({ err: error }, "Unable to start Prismarine viewer");
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