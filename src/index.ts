import express, { Application, Express } from "express";
import { ChattyServer } from "./setup/setupServer";
import connectDatabase from "./setup/setupDatabase";
import { config } from "./config/config";

class ChattyApplication {
  public async initialize(): Promise<void> {
    this.loadConfig();
    await connectDatabase();
    const app: Express = express();
    const server = new ChattyServer(app);
    await server.start();
  }

  private loadConfig(): void {
    config.validateConfig();
  }
}

const application: ChattyApplication = new ChattyApplication();
application.initialize().then();
