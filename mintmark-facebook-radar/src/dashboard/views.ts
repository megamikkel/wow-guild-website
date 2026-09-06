import type { PostRow, PostView, Stats } from "../database/repositories.js";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const VIEW_LABELS: Record<PostView, string> = {
  relevant: "Relevante",
  irrelevant: "Irrelevante",
  all: "Alle",
  wrong: "Forkert klassificerede",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Ikke gennemgået",
  correct_hit: "✅ Korrekt hit",
  wrong_hit: "❌ Forkert hit",
  handled: "☑ Behandlet",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function formatPercent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)} %`;
}

export function renderStats(stats: Stats): string {
  const items: [string, string][] = [
    ["Analyserede opslag", String(stats.analyzed)],
    ["AI-hits", String(stats.aiHits)],
    ["Afventer review", String(stats.pendingHits)],
    ["True positives", String(stats.truePositives)],
    ["False positives", String(stats.falsePositives)],
    ["Precision", formatPercent(stats.precision)],
  ];
  return `<section class="stats">${items
    .map(([label, value]) => `<div class="stat"><div class="value">${escapeHtml(value)}</div><div class="label">${escapeHtml(label)}</div></div>`)
    .join("")}</section>`;
}

export function renderPostCard(post: PostRow): string {
  const status = STATUS_LABELS[post.review_status] ?? post.review_status;
  const confidence = post.confidence === null ? "–" : `${Math.round(post.confidence * 100)} %`;
  const classification = post.classification ?? (post.classification_error ? "FEJL" : "Ikke klassificeret");
  const badgeClass = post.relevant === 1 ? "badge relevant" : "badge";
  const link = post.post_url
    ? `<a class="fb-link" href="${escapeHtml(post.post_url)}" target="_blank" rel="noopener noreferrer">Åbn på Facebook ↗</a>`
    : `<span class="fb-link muted" title="Permalink kunne ikke findes">Intet link</span>`;
  const humanMark =
    post.human_relevant === 1 ? "Menneske: relevant" : post.human_relevant === 0 ? "Menneske: ikke relevant" : "Menneske: ikke vurderet";

  return `<article class="card ${post.review_status}" data-id="${post.id}">
  <header>
    <span class="${badgeClass}">${escapeHtml(classification)}</span>
    <span class="confidence" title="AI confidence">${escapeHtml(confidence)}</span>
    <span class="group">${escapeHtml(post.group_name)}</span>
    <span class="time" title="Første gang set af Radar: ${escapeHtml(formatDate(post.first_seen_at))}">${escapeHtml(post.post_time_text ?? formatDate(post.first_seen_at))}</span>
  </header>
  <p class="text">${escapeHtml(post.post_text).replace(/\n/g, "<br>")}</p>
  ${post.reason ? `<p class="reason">AI: ${escapeHtml(post.reason)}</p>` : ""}
  ${post.classification_error ? `<p class="reason error">Classification-fejl: ${escapeHtml(post.classification_error)}</p>` : ""}
  <footer>
    ${link}
    <span class="status">${escapeHtml(status)} · ${escapeHtml(humanMark)}</span>
    <span class="actions">
      <button data-status="correct_hit" title="AI'en har ret - opslaget er relevant">✅ Korrekt hit</button>
      <button data-status="wrong_hit" title="AI'en tog fejl - opslaget er ikke relevant">❌ Forkert hit</button>
      <button data-status="handled" title="Jeg har gjort noget ved opslaget">☑ Behandlet</button>
      <button data-status="pending" class="subtle" title="Nulstil review">↺</button>
    </span>
  </footer>
</article>`;
}

export function renderPage(options: { view: PostView; posts: PostRow[]; stats: Stats; lastScan: string | null }): string {
  const nav = (Object.keys(VIEW_LABELS) as PostView[])
    .map((v) => `<a href="/?view=${v}" class="${v === options.view ? "active" : ""}">${VIEW_LABELS[v]}</a>`)
    .join("");
  const cards = options.posts.length
    ? options.posts.map(renderPostCard).join("\n")
    : `<p class="empty">Ingen opslag i denne visning. Kør <code>npm run scan</code> for at hente nye.</p>`;

  return `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mintmark Facebook Radar</title>
<style>
  :root { color-scheme: light; --bg:#f5f4f0; --card:#fff; --ink:#1d1d1b; --muted:#6b6b66; --accent:#0f7b6c; --warn:#b3261e; --line:#e3e1da; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background:var(--bg); color:var(--ink); }
  header.top { display:flex; align-items:baseline; gap:1rem; padding:1rem 1.5rem; background:#fff; border-bottom:1px solid var(--line); flex-wrap:wrap; }
  header.top h1 { font-size:1.15rem; margin:0; }
  header.top .sub { color:var(--muted); font-size:.85rem; }
  nav { display:flex; gap:.25rem; padding:.75rem 1.5rem 0; flex-wrap:wrap; }
  nav a { padding:.4rem .8rem; border-radius:999px; text-decoration:none; color:var(--ink); border:1px solid var(--line); background:#fff; font-size:.9rem; }
  nav a.active { background:var(--accent); color:#fff; border-color:var(--accent); }
  .stats { display:grid; grid-template-columns: repeat(auto-fit, minmax(130px,1fr)); gap:.5rem; padding:.75rem 1.5rem; }
  .stat { background:#fff; border:1px solid var(--line); border-radius:10px; padding:.6rem .8rem; }
  .stat .value { font-size:1.4rem; font-weight:600; }
  .stat .label { font-size:.75rem; color:var(--muted); }
  main { padding: .5rem 1.5rem 3rem; display:grid; gap:.75rem; max-width:960px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:.9rem 1rem; }
  .card.correct_hit { border-left:4px solid var(--accent); }
  .card.wrong_hit { border-left:4px solid var(--warn); opacity:.85; }
  .card.handled { border-left:4px solid #999; opacity:.85; }
  .card header { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; font-size:.85rem; color:var(--muted); }
  .badge { font-weight:600; padding:.15rem .5rem; border-radius:6px; background:#eee; color:#333; font-size:.75rem; letter-spacing:.02em; }
  .badge.relevant { background:#dff3ee; color:var(--accent); }
  .text { white-space:normal; margin:.6rem 0 .3rem; line-height:1.45; }
  .reason { font-size:.85rem; color:var(--muted); margin:.2rem 0; }
  .reason.error { color:var(--warn); }
  .card footer { display:flex; gap:.75rem; align-items:center; flex-wrap:wrap; margin-top:.5rem; font-size:.85rem; }
  .fb-link { color:var(--accent); font-weight:600; text-decoration:none; }
  .muted { color:var(--muted); }
  .status { color:var(--muted); }
  .actions { margin-left:auto; display:flex; gap:.35rem; }
  button { font: inherit; font-size:.85rem; padding:.35rem .6rem; border-radius:8px; border:1px solid var(--line); background:#fff; cursor:pointer; }
  button:hover { border-color:#bbb; }
  button.subtle { color:var(--muted); }
  .empty { color:var(--muted); }
  code { background:#eee; padding:.1rem .3rem; border-radius:4px; }
</style>
</head>
<body>
<header class="top">
  <h1>Mintmark Facebook Radar</h1>
  <span class="sub">Read-only. Seneste scan: ${escapeHtml(options.lastScan ?? "ingen endnu")}</span>
</header>
${renderStats(options.stats)}
<nav>${nav}</nav>
<main>
${cards}
</main>
<script>
document.querySelectorAll(".card button[data-status]").forEach((button) => {
  button.addEventListener("click", async () => {
    const card = button.closest(".card");
    const id = card.dataset.id;
    button.disabled = true;
    try {
      const res = await fetch("/api/posts/" + id + "/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: button.dataset.status }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      location.reload();
    } catch (err) {
      alert("Kunne ikke gemme: " + err.message);
      button.disabled = false;
    }
  });
});
</script>
</body>
</html>`;
}
