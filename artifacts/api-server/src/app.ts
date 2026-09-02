import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { registerViewerProxy } from "./lib/minecraft-viewer";
import { createServer } from "node:http";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

// The preview starts this package, so serve the built Vite app from the same port.
const frontendDist = path.resolve(import.meta.dirname, "../../minecraft-bot/dist/public");
app.use(express.static(frontendDist));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(frontendDist, "index.html"), (error) => {
    if (error) next(error);
  });
});

export const httpServer = createServer(app);
registerViewerProxy(app, httpServer);

export default app;
