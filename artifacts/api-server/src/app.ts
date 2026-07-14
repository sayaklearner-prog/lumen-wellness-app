import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { contextEngine } from "./core";

const app: Express = express();

app.use((req: Request, res: Response, next: NextFunction) => {
  contextEngine.run({
    userAgent: req.get("User-Agent"),
    ip: req.ip,
  }, next);
});

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
app.use(cors());
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ extended: true, limit: "150mb" }));

app.use("/api", router);

// Serve compiled static frontend client in production
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mobileDist = path.resolve(__dirname, "../../mobile/dist");
const wellnessDist = path.resolve(__dirname, "../../wellness/dist");

let staticPath = "";
if (fs.existsSync(mobileDist)) {
  staticPath = mobileDist;
} else if (fs.existsSync(wellnessDist)) {
  staticPath = wellnessDist;
}

if (staticPath) {
  logger.info({ staticPath }, "Serving static front-end assets");
  app.use(express.static(staticPath));
  app.get("*", (req: Request, res: Response) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
}

export default app;
