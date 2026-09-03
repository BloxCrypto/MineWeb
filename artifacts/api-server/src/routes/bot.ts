import { Router, type IRouter, type Request } from "express";
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
} from "../lib/minecraft-bot";
import {
  createMinecraftAccount,
  deleteMinecraftAccount,
  getMinecraftAccountCredentials,
  listMinecraftAccounts,
} from "../lib/minecraft-accounts";

const router: IRouter = Router();

function getOwnerId(req: Request): string {
  const authenticatedUserId = req.user?.id;
  if (authenticatedUserId) return authenticatedUserId;
  const clientId = req.header("x-client-id")?.trim();
  return clientId && /^[a-zA-Z0-9_-]{16,100}$/.test(clientId) ? `device:${clientId}` : "default";
}

router.get("/bot/accounts", async (req, res) => {
  try {
    res.json(await listMinecraftAccounts(getOwnerId(req)));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Saved accounts are unavailable.",
    });
  }
});

router.post("/bot/accounts", async (req, res) => {
  const parsed = CreateBotAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a label, username, and valid authentication settings." });
    return;
  }

  if (parsed.data.auth === "microsoft" && parsed.data.password) {
    res.status(400).json({ error: "Microsoft accounts use device-code sign-in, not a password." });
    return;
  }

  try {
    res.status(201).json(await createMinecraftAccount({ ...parsed.data, ownerId: getOwnerId(req) }));
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "The account could not be saved.",
    });
  }
});

router.delete("/bot/accounts/:accountId", async (req, res) => {
  try {
    const deleted = await deleteMinecraftAccount(req.params.accountId, getOwnerId(req));
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

router.get("/bot/logs", async (_req, res) => {
  try {
    res.json(GetBotLogsResponse.parse(await getBotLogs()));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Bot logs are unavailable." });
  }
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
      ? await getMinecraftAccountCredentials(accountId, getOwnerId(req))
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