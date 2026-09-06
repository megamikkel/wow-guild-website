import { configureLogger, log } from "./logger.js";
import { loadConfig } from "./config/config.js";
import { openDatabase } from "./database/db.js";
import { startDashboard } from "./dashboard/server.js";

const config = loadConfig();
configureLogger({ level: config.logLevel, dir: config.logDir });

const db = openDatabase(config.dbPath);
const server = startDashboard(db, config.dashboardPort);

const shutdown = () => {
  log.info("Lukker dashboard");
  server.close();
  db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
