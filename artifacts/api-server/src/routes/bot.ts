import { Router, type IRouter } from "express";
import {
  ConnectBotBody,
  GetBotLogsResponse,
  GetBotPlayersResponse,
  GetBotStatusResponse,
  RunBotCommandBody,
  RunBotCommandResponse,
  SendBotChatBody,
} from "@workspace/api-zod";
import {
  connectBot,
  disconnectBot,
  getBotLogs,
  getBotPlayers,
  getBotStatus,
  runBotCommand,
  sendBotChat,
} from "../lib/minecraft-bot";

const router: IRouter = Router();

router.get("/bot/status", (_req, res) => {
  res.json(GetBotStatusResponse.parse(getBotStatus()));
});

router.get("/bot/logs", (_req, res) => {
  res.json(GetBotLogsResponse.parse(getBotLogs()));
});

router.get("/bot/players", (_req, res) => {
  res.json(GetBotPlayersResponse.parse(getBotPlayers()));
});

router.post("/bot/connect", (req, res) => {
  const parsed = ConnectBotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the host, port, username, and authentication settings." });
    return;
  }

  try {
    res.json(GetBotStatusResponse.parse(connectBot(parsed.data)));
  } catch (error) {
    res.status(409).json({
      error: error instanceof Error ? error.message : "Bot is already active.",
    });
  }
});

router.post("/bot/disconnect", (_req, res) => {
  res.json(GetBotStatusResponse.parse(disconnectBot()));
});

router.post("/bot/chat", (req, res) => {
  const parsed = SendBotChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a chat message up to 256 characters." });
    return;
  }

  try {
    res.json(GetBotStatusResponse.parse(sendBotChat(parsed.data.message)));
  } catch (error) {
    res.status(409).json({
      error: error instanceof Error ? error.message : "Bot is not connected.",
    });
  }
});

router.post("/bot/command", (req, res) => {
  const parsed = RunBotCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a supported bot command up to 256 characters." });
    return;
  }

  try {
    res.json(RunBotCommandResponse.parse(runBotCommand(parsed.data.command)));
  } catch (error) {
    res.status(409).json({
      error: error instanceof Error ? error.message : "The bot could not run that command.",
    });
  }
});

export default router;