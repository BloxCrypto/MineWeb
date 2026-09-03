import path from "node:path";
import fs from "node:fs";
import express from "express";
import app, { httpServer } from "./artifacts/api-server/src/app";
import { createServer as createViteServer } from "vite";
import { logger } from "./artifacts/api-server/src/lib/logger";

const PORT = 3000;
const isProd = process.env.NODE_ENV === "production";

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), "artifacts/minecraft-bot/vite.config.ts"),
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    let distPath = path.resolve(process.cwd(), "artifacts/minecraft-bot/dist/public");
    if (!fs.existsSync(distPath)) {
      distPath = path.resolve(process.cwd(), "artifacts/minecraft-bot/dist");
    }
    app.use(express.static(distPath));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
   });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info({ port: PORT }, `Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});
startServer().catch((err) => {
  logger.error(err, "Failed to start server");
  process.exit(1);
});
