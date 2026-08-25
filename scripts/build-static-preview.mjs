/**
 * Builds a static preview of the PUBLIC site for GitHub Pages.
 *
 * GitHub Pages serves files, not a Node server, so anything needing a request
 * at runtime cannot ship: authentication, server actions, route handlers and
 * middleware. This script removes those routes from a throwaway copy of the
 * app tree, points Next at a static-export config, and builds the public
 * pages with the demo fixtures baked in.
 *
 * It is destructive to the working tree by design — it runs in CI on a fresh
 * checkout. Locally it refuses unless the tree is clean, so an accidental run
 * can always be undone with `git checkout .`.
 *
 * Result: ./out — home, progression, roster (+ a page per character), raids
 * (+ a page per raid), recruitment and the application form. The form renders
 * but cannot submit, and member/officer areas are absent entirely; both are
 * stated on the preview banner.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

/** Routes that require a server and therefore cannot be exported. */
const SERVER_ONLY = [
  "src/middleware.ts",
  "src/app/api",
  "src/app/admin",
  "src/app/dashboard",
  "src/app/login",
  // Route handlers, not pages: under output:export they need explicit static
  // segment configs. The preview writes plain files instead (see below).
  "src/app/robots.ts",
  "src/app/sitemap.ts",
];

function assertSafeToRun() {
  // The guard protects a developer's working tree. Every build host runs on a
  // fresh checkout where there is nothing to lose, so skip it there — and skip
  // it for the lockfile alone, which an install step may legitimately touch.
  const inCI = ["CI", "WORKERS_CI", "CF_PAGES", "GITHUB_ACTIONS", "VERCEL"].some(
    (v) => process.env[v],
  );
  if (inCI) return;

  const dirty = execSync("git status --porcelain", { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((line) => line && !line.endsWith("package-lock.json"));
  if (dirty.length > 0) {
    console.error(
      "Refusing to run: this script deletes route directories and the working\n" +
        "tree has uncommitted changes. Commit or stash them first.\n\n" +
        dirty.join("\n"),
    );
    process.exit(1);
  }
}

function stripServerOnlyRoutes() {
  for (const path of SERVER_ONLY) {
    const full = join(root, path);
    if (existsSync(full)) {
      rmSync(full, { recursive: true, force: true });
      console.log(`  removed ${path}`);
    }
  }
}

/**
 * A project page is served from /<repo>, so every asset and link needs that
 * prefix. Image optimisation needs a server, so it is turned off — the badge
 * assets are already sized for their use.
 */
/**
 * `export const dynamic` must be a literal — Next statically analyses it, so
 * it cannot read a build flag. The public pages declare "force-dynamic" for
 * normal operation; a static export needs them pre-rendered instead.
 */
function forceStaticRendering() {
  const pages = execSync('find "src/app/(public)" -name page.tsx', {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const page of pages) {
    const before = readFileSync(page, "utf8");
    const after = before.replace(
      'export const dynamic = "force-dynamic";',
      'export const dynamic = "force-static";',
    );
    if (after !== before) {
      writeFileSync(page, after);
      console.log(`  pre-render ${page}`);
    }
  }
}

/**
 * Server actions cannot exist at all in an export build — their presence
 * fails it, not just their use. Two live in the public tree: the sign-out
 * button and the application form. Both are replaced with static stubs that
 * keep the pages and their design intact.
 */
function replaceServerActions() {
  writeFileSync(
    join(root, "src/components/SignOutButton.tsx"),
    `export function SignOutButton(_: { title?: string }) {
  return null;
}
`,
  );
  rmSync(join(root, "src/app/(public)/apply"), { recursive: true, force: true });
  mkdirSync(join(root, "src/app/(public)/apply"), { recursive: true });
  writeFileSync(
    join(root, "src/app/(public)/apply/page.tsx"),
    `import type { Metadata } from "next";

import { CtaLink } from "@/components/ui";
import { guildConfig } from "@/config/guild";

export const metadata: Metadata = { title: "Apply" };

export default function ApplyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="banner mb-4">Recruitment</p>
      <h1 className="display-heading text-5xl text-papi-indigo">Apply to PAPI</h1>
      <div className="stripe mt-6 mb-8 w-40" aria-hidden />
      <p className="text-lg text-ink-muted">
        The application form needs a server to receive and store what you send,
        so it is not part of this preview. On the live site this is a five
        minute form; for now, come say hello in Discord and an officer will
        pick it up from there.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={guildConfig.socials.discordInvite}
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-papi-indigo px-5 py-3 font-display text-sm font-bold tracking-[0.1em] text-white uppercase transition-colors hover:bg-papi-purple"
        >
          Join our Discord
        </a>
        <CtaLink href="/recruitment" variant="secondary">
          See what we need
        </CtaLink>
      </div>
    </div>
  );
}
`,
  );
  console.log("  stubbed server actions (sign-out, application form)");
}

function writeStaticConfig(basePath) {
  writeFileSync(
    join(root, "next.config.ts"),
    `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: ${JSON.stringify(basePath)},
  images: { unoptimized: true },
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: { "/**": ["./drizzle/**"] },
};

export default nextConfig;
`,
  );
  console.log(`  wrote static next.config.ts (basePath ${basePath || "/"})`);
}

const basePath = process.env.PAPI_BASE_PATH ?? "";

assertSafeToRun();
console.log("Building static preview…");
stripServerOnlyRoutes();
forceStaticRendering();
replaceServerActions();
writeStaticConfig(basePath);

execSync("npx next build", {
  stdio: "inherit",
  env: {
    ...process.env,
    PAPI_STATIC_EXPORT: "true",
    // Prefixes asset URLs that Next does not rewrite for basePath itself.
    NEXT_PUBLIC_BASE_PATH: basePath,
    PAPI_DEMO_MODE: "true",
    AUTH_SECRET: "static-preview-build-only",
  },
});

// Static hosts serve files, so the security headers declared in
// next.config.ts — which Next applies at request time — never run. Cloudflare
// Pages and Netlify both read a _headers file; hosts that do not simply
// ignore it, so emitting it is safe everywhere.
mkdirSync(join(root, "out"), { recursive: true });
writeFileSync(
  join(root, "out/_headers"),
  `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/brand/*
  Cache-Control: public, max-age=86400
`,
);

// The preview should not compete with the real site in search results, and a
// preview of demo data has nothing worth indexing.
writeFileSync(join(root, "out/robots.txt"), "User-agent: *\nDisallow: /\n");

// Tells GitHub Pages to serve the files as-is rather than running them
// through Jekyll, which ignores directories beginning with an underscore
// (_next holds every script and stylesheet).
mkdirSync(join(root, "out"), { recursive: true });
writeFileSync(join(root, "out/.nojekyll"), "");

console.log("\nStatic preview written to ./out");
