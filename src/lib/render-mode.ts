/**
 * True when this bundle was produced by the static preview build
 * (scripts/build-static-preview.mjs) for GitHub Pages.
 *
 * Evaluated at build time, so each bundle ships with one value compiled in;
 * nothing is decided per request. Used to skip the pieces a file host cannot
 * serve — session lookups, sign-out actions — and to show the preview banner.
 *
 * Note: a page's `export const dynamic` cannot read this. Next statically
 * analyses that export, so it must stay a literal; the build script rewrites
 * those literals instead.
 */
export const IS_STATIC_EXPORT = process.env.PAPI_STATIC_EXPORT === "true";
