import { Router, type IRouter } from "express";
import {
  CreateBotAccountBody,
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
  getAntiAfkEnabled,
  setAntiAfkEnabled,
  reconnectBot,
} from "../lib/minecraft-bot";
import {
  createMinecraftAccount,
  deleteMinecraftAccount,
  getMinecraftAccountCredentials,
  listMinecraftAccounts,
} from "../lib/minecraft-accounts";

const router: IRouter = Router();

router.get("/bot/settings", (_req, res) => {
  res.json({ antiAfk: getAntiAfkEnabled() });
});

router.post("/bot/settings", (req, res) => {
  if (typeof req.body?.antiAfk !== "boolean") {
    res.status(400).json({ error: "antiAfk must be a boolean." });
    return;
  }
  res.json({ antiAfk: setAntiAfkEnabled(req.body.antiAfk) });
});

router.post("/bot/reconnect", (_req, res) => {
  try {
    res.json(GetBotStatusResponse.parse(reconnectBot()));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Unable to reconnect bot." });
  }
});

router.get("/bot/accounts", async (_req, res) => {
  if (!_req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to view saved Minecraft accounts." });
    return;
  }
  try {
    res.json(await listMinecraftAccounts(_req.user.id));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Saved accounts are unavailable.",
    });
  }
});

router.post("/bot/accounts", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to save Minecraft accounts." });
    return;
  }
  const parsed = CreateBotAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a label, username, auth mode, and valid password." });
    return;
  }

  if (parsed.data.auth === "offline" && !parsed.data.password) {
    res.status(400).json({ error: "Offline accounts need a server password." });
    return;
  }
  if (parsed.data.auth === "microsoft" && parsed.data.password) {
    res.status(400).json({ error: "Microsoft accounts use device-code sign-in, not a password." });
    return;
  }

  try {
    res.status(201).json(await createMinecraftAccount({ ...parsed.data, ownerId: req.user.id }));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "The account could not be saved.",
    });
  }
});

router.delete("/bot/accounts/:accountId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to delete saved Minecraft accounts." });
    return;
  }
  try {
    const deleted = await deleteMinecraftAccount(req.params.accountId, req.user.id);
    if (!deleted) {
      res.status(404).json({ error: "Saved Minecraft account was not found." });
      return;
    }
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "The account could not be deleted.",
    });
  }
});

router.get("/bot/status", (_req, res) => {
  res.json(GetBotStatusResponse.parse(getBotStatus()));
});

router.get("/bot/logs", (_req, res) => {
  res.json(GetBotLogsResponse.parse(getBotLogs()));
});

router.get("/bot/players", (_req, res) => {
  res.json(GetBotPlayersResponse.parse(getBotPlayers()));
});

router.post("/bot/connect", async (req, res) => {
  const parsed = ConnectBotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the host, port, username, and authentication settings." });
    return;
  }

  try {
    const { accountId, ...connectionInput } = parsed.data;
    const account = accountId
      ? req.isAuthenticated()
        ? await getMinecraftAccountCredentials(accountId, req.user.id)
        : (() => {
            throw new Error("Sign in to use a saved Minecraft account.");
          })()
      : null;
    const connectionSettings = {
      ...connectionInput,
      ...(account
        ? {
            username: account.summary.username,
            auth: account.summary.auth,
            offlinePassword: account.password,
          }
        : {}),
    };
    res.json(GetBotStatusResponse.parse(connectBot(connectionSettings)));
  } catch (error) {
    res.status(error instanceof Error && error.message.includes("not found") ? 404 : 409).json({
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
