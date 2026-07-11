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

export default app;
