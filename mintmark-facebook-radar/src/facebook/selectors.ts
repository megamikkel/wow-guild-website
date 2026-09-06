/**
 * ALLE Facebook-specifikke DOM-selectors samles her, så de er nemme at
 * reparere når Facebook ændrer markup. Ingen andre filer må indeholde
 * Facebook-selectors.
 *
 * Bemærk: Facebooks klassenavne er obfuskerede og skifter ofte. Brug derfor
 * kun ARIA-roller, data-attributter og URL-mønstre - aldrig klassenavne.
 */
export const SELECTORS = {
  /** Feed-containeren i en gruppe */
  feed: '[role="feed"]',
  /** Hvert opslag (og desværre også kommentarer) er role="article" */
  article: '[role="article"]',
  /** Selve opslagsteksten (Facebooks egen markering af "message"-blokken) */
  postText: '[data-ad-preview="message"], [data-ad-comet-preview="message"]',
  /** Fallback: tekstblokke, hvis message-markeringen mangler */
  textBlocks: 'div[dir="auto"]',
  /** Ankre der kan være permalinks til opslaget */
  anchors: "a[href]",
  /** Knappen der folder lang tekst ud. Kun udvidelse af tekst - ingen anden interaktion. */
  seeMoreButton: 'div[role="button"], span[role="button"]',
  seeMoreTexts: ["se mere", "see more", "vis mere"],

  /** Login-formular = ikke logget ind */
  loginForm: 'form[action*="login"], input[name="email"], #email',
  /** Tegn på at man er logget ind */
  loggedInHints: [
    '[role="feed"]',
    '[aria-label="Din profil"]',
    '[aria-label="Your profile"]',
    '[aria-label="Konto"]',
    '[aria-label="Account"]',
    '[aria-label="Beskeder"]',
    '[aria-label="Messenger"]',
    'a[href*="/notifications"]',
  ],
} as const;

/** URL-mønstre der betyder at Facebook kræver manuel handling af brugeren. */
export const CHECKPOINT_URL_PATTERN = /\/(checkpoint|login|recover|two_step_verification|confirmemail|help\/contact)\b/i;

/** URL-mønstre der identificerer permalinks til opslag i grupper. */
export const PERMALINK_PATTERNS: readonly string[] = [
  "/groups/[^/]+/posts/",
  "/groups/[^/]+/permalink/",
  "/posts/",
  "/permalink/",
  "story_fbid=",
  "multi_permalinks=",
];
