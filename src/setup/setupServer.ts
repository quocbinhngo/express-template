import {
  Application,
  json,
  Response,
  urlencoded,
  Request,
  NextFunction,
} from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import cookieSession from "cookie-session";
import { createClient } from "redis";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import "express-async-errors";
import compression from "compression";
import { config } from "../config/config";
import * as process from "process";
import setupRoutes from "../routes/routes";
import routes from "../routes/routes";
import HTTP_STATUS from "http-status-codes";
import { CustomError, IErrorResponse } from "../globals/helpers/error-handler";
import Logger from "bunyan";

const SERVER_PORT = 8000;
const log: Logger = config.createLogger("server");

export class ChattyServer {
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  private securityMiddleware(app: Application): void {
    // @ts-ignore
    app.use(
      cookieSession({
        name: "session",
        keys: [config.SECRET_KEY_ONE!, config.SECRET_KEY_TWO!],
        maxAge: 24 * 7 * 360000,
        secure: config.NODE_ENV !== "development",
      })
    );
    app.use(hpp());
    app.use(helmet());
    app.use(
      cors({
        origin: config.CLIENT_URL,
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      })
    );
  }

  private standardMiddleware(app: Application): void {
    app.use(compression());
    app.use(json({ limit: "50mb" }));
    app.use(urlencoded({ extended: true, limit: "50mb" }));
  }

  private routesMiddleware(app: Application): void {
    setupRoutes(app);
  }

  private globalErrorHandler(app: Application): void {
    app.all("*", async (req: Request, res: Response) => {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json({ message: `${req.originalUrl} not found` });
    });

    app.use(
      (
        error: IErrorResponse,
        req: Request,
        res: Response,
        next: NextFunction
      ) => {
        log.error(error);
        if (error instanceof CustomError) {
          return res.status(error.statusCode).json(error.serializeErrors());
        }

        next();
      }
    );
  }

  private async startServer(app: Application): Promise<void> {
    try {
      const httpServer: http.Server = new http.Server(app);
      const socketIO: Server = await this.createSocketIO(httpServer);
      await this.startHttpServer(httpServer);
      this.socketIOConnections(socketIO);
    } catch (error) {
      log.error(error);
    }
  }

  private async createSocketIO(httpServer: http.Server): Promise<Server> {
    const io: Server = new Server(httpServer, {
      cors: {
        origin: config.CLIENT_URL,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      },
    });

    const pubClient = createClient({ url: config.REDIS_HOST });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    return io;
  }

  private socketIOConnections(io: Server): void {}

  private async startHttpServer(httpServer: http.Server) {
    log.info(`Server has started with process ${process.pid}`);
    httpServer.listen(SERVER_PORT, () => {
      log.info(`Listening on port ${SERVER_PORT}`);
    });
  }

  public async start() {
    this.securityMiddleware(this.app);
    this.standardMiddleware(this.app);
    this.routesMiddleware(this.app);
    this.globalErrorHandler(this.app);
    await this.startServer(this.app);
  }
}
