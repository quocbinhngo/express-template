import * as mongoose from "mongoose";
import * as process from "process";
import { config } from "../config/config";
import Logger from "bunyan";

const log: Logger = config.createLogger("database");

export default async () => {
  const connect = async () => {
    try {
      mongoose.set("strictQuery", false);
      await mongoose.connect(config.DATABASE_URL!);
      log.info("Connected to the database");
    } catch (error) {
      log.error("Cannot connected to the database");
      log.error(error);
      return process.exit(1);
    }
  };

  await connect();
  // mongoose.connection.on("disconnected", connect);
};
