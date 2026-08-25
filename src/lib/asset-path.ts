/**
 * Prefixes a public asset path with the deployment's base path.
 *
 * Next rewrites links and its own bundle URLs for `basePath`, but not string
 * `src` values on unoptimised images, nor asset URLs in the metadata export.
 * The static preview is served from /<repo> on GitHub Pages, so those paths
 * must be prefixed explicitly or they resolve against the domain root.
 *
 * Empty for the normal deployment, which is served from /.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function assetPath(path: string): string {
  return `${BASE}${path}`;
}
