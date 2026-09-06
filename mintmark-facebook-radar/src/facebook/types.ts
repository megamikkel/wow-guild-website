/** Et opslag som det ser ud lige efter udtræk fra DOM'en. */
export interface ScrapedPost {
  /** Facebooks post-id (numerisk eller pfbid...). null hvis det ikke kunne findes. */
  facebookPostId: string | null;
  /** Fuldt permalink uden tracking-parametre, hvis fundet. */
  permalink: string | null;
  /** Opslagets tekst (uden kommentarer). */
  text: string;
  /** Synlig tidstekst, fx "3 t" eller "12. maj". null hvis ikke fundet. */
  timeText: string | null;
}

/** Rå kandidat som udtrækkes i browser-konteksten, før den valideres. */
export interface RawPostCandidate {
  index: number;
  permalink: string | null;
  timeText: string | null;
  text: string;
  hasNestedArticles: boolean;
}

export type AuthState = "logged_in" | "logged_out" | "checkpoint" | "unknown";

export class AuthRequiredError extends Error {
  constructor(
    public readonly state: AuthState,
    message: string,
  ) {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export interface GroupScanSummary {
  groupId: string;
  groupName: string;
  found: number;
  parseErrors: number;
  posts: ScrapedPost[];
}
