import http from "node:http";
import type Database from "better-sqlite3";
import { log } from "../logger.js";
import { createRequestHandler } from "./routes.js";

/**
 * Minimal lokal webserver uden frameworks. Lytter kun på localhost.
 */
export function startDashboard(db: Database.Database, port: number, host = "127.0.0.1"): http.Server {
  const handler = createRequestHandler(db);
  const server = http.createServer((req, res) => {
    void handler(req, res);
  });
  server.listen(port, host, () => {
    log.info("Dashboard kører", { url: `http://localhost:${port}` });
    console.log(`\n  Mintmark Facebook Radar dashboard: http://localhost:${port}\n`);
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      log.error(`Port ${port} er optaget. Sæt RADAR_PORT til en anden port.`);
    } else {
      log.error("Dashboard kunne ikke starte", { error: err.message });
    }
    process.exitCode = 1;
  });
  return server;
}
