import { IS_STATIC_EXPORT } from "@/lib/render-mode";

/**
 * Shown only in the static preview build. A file host cannot run the server,
 * so sign-in, the member and officer areas, and form submission are absent —
 * visitors should know that rather than discover it by clicking.
 */
export function PreviewBanner() {
  if (!IS_STATIC_EXPORT) return null;
  return (
    <div className="bg-papi-indigo px-4 py-2 text-center text-xs text-white">
      <strong className="font-display tracking-[0.12em] uppercase">Forhåndsvisning</strong>
      <span className="mx-2 opacity-50">·</span>
      Demodata. Login, medlemssiden og officer-værktøjerne kræver en server og er
      ikke med i denne udgave.
    </div>
  );
}
