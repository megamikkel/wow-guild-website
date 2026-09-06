import type { IncomingMessage, ServerResponse } from "node:http";
import type Database from "better-sqlite3";
import { isReviewStatus, PostRepository, ScanRepository, type PostView } from "../database/repositories.js";
import { errorMeta, log } from "../logger.js";
import { renderPage } from "./views.js";

const VIEWS: readonly PostView[] = ["relevant", "irrelevant", "all", "wrong"];

function parseView(value: string | null): PostView {
  return VIEWS.includes(value as PostView) ? (value as PostView) : "relevant";
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 64 * 1024) throw new Error("Body for stor");
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

export function createRequestHandler(db: Database.Database) {
  const posts = new PostRepository(db);
  const scans = new ScanRepository(db);

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";

    try {
      if (method === "GET" && url.pathname === "/") {
        const view = parseView(url.searchParams.get("view"));
        const latest = scans.latest();
        const lastScan = latest
          ? `${new Date(latest.started_at).toLocaleString("da-DK")} (${latest.posts_new} nye af ${latest.posts_found}, ${latest.status})`
          : null;
        sendHtml(res, 200, renderPage({ view, posts: posts.list(view), stats: posts.stats(), lastScan }));
        return;
      }

      if (method === "GET" && url.pathname === "/api/stats") {
        sendJson(res, 200, posts.stats());
        return;
      }

      if (method === "GET" && url.pathname === "/api/posts") {
        sendJson(res, 200, posts.list(parseView(url.searchParams.get("view"))));
        return;
      }

      const reviewMatch = url.pathname.match(/^\/api\/posts\/(\d+)\/review$/);
      if (method === "POST" && reviewMatch) {
        const id = Number(reviewMatch[1]);
        const body = (await readJsonBody(req)) as { status?: unknown };
        if (!isReviewStatus(body.status)) {
          sendJson(res, 400, { error: "Ugyldig status" });
          return;
        }
        const updated = posts.setReview(id, body.status);
        if (!updated) {
          sendJson(res, 404, { error: "Opslag findes ikke" });
          return;
        }
        log.info("Review gemt", { postId: id, status: body.status });
        sendJson(res, 200, updated);
        return;
      }

      if (method === "GET" && url.pathname === "/healthz") {
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: "Ikke fundet" });
    } catch (err) {
      log.error("Dashboard-fejl", { path: url.pathname, ...errorMeta(err) });
      sendJson(res, 500, { error: "Intern fejl" });
    }
  };
}
