import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import { eq } from "drizzle-orm";

import { env } from "@/lib/env";
import { getDb, tables } from "@/lib/db";
import { hasRole, isPapiRole, mapDiscordRolesToPapiRole, type PapiRole } from "@/lib/rbac";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      role: PapiRole;
      discordId?: string;
      dbUserId?: number;
    };
  }
}

/**
 * Discord is the primary identity. After OAuth we check membership of the
 * guild's Discord server (guilds.members.read) and translate Discord roles
 * into PAPI roles via DISCORD_ROLE_MAP. In demo mode a credentials provider
 * offers three demo accounts instead — it is never registered outside demo.
 */

const DEMO_ACCOUNTS: Record<
  string,
  { discordId: string; name: string; username: string; role: PapiRole }
> = {
  member: { discordId: "demo-member", name: "Frost", username: "frostmage", role: "RAIDER" },
  officer: { discordId: "demo-officer", name: "Luna", username: "luminara", role: "OFFICER" },
  admin: { discordId: "demo-admin", name: "Mikkel", username: "mikkel", role: "ADMIN" },
};

async function resolveDiscordRole(accessToken: string): Promise<PapiRole> {
  const guildId = env.discord.guildId;
  if (!guildId) return "PUBLIC";
  const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return "PUBLIC"; // not in the guild's Discord
  if (!res.ok) return "PUBLIC";
  const member = (await res.json()) as { roles?: string[] };
  return mapDiscordRolesToPapiRole(member.roles ?? [], env.discord.roleMap, {
    isGuildMember: true,
  });
}

async function upsertUser(input: {
  discordId: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  role: PapiRole;
}): Promise<number | undefined> {
  try {
    const db = await getDb();
    const existing = await db
      .select()
      .from(tables.users)
      .where(eq(tables.users.discordId, input.discordId))
      .limit(1);
    if (existing[0]) {
      await db
        .update(tables.users)
        .set({
          discordUsername: input.username,
          displayName: input.displayName ?? existing[0].displayName,
          avatarUrl: input.avatarUrl ?? existing[0].avatarUrl,
          role: input.role,
          lastLoginAt: new Date(),
        })
        .where(eq(tables.users.id, existing[0].id));
      return existing[0].id;
    }
    const inserted = await db
      .insert(tables.users)
      .values({
        discordId: input.discordId,
        discordUsername: input.username,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        role: input.role,
        lastLoginAt: new Date(),
      })
      .returning({ id: tables.users.id });
    return inserted[0]?.id;
  } catch (err) {
    console.error("[auth] user upsert failed", err);
    return undefined;
  }
}

const providers = [];

if (env.discord.clientId && env.discord.clientSecret) {
  providers.push(
    Discord({
      clientId: env.discord.clientId,
      clientSecret: env.discord.clientSecret,
      authorization: { params: { scope: "identify guilds.members.read" } },
    }),
  );
}

if (env.isDemoMode) {
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo account",
      credentials: { account: { label: "Account", type: "text" } },
      async authorize(credentials) {
        const account = DEMO_ACCOUNTS[String(credentials?.account ?? "")];
        if (!account) return null;
        return {
          id: account.discordId,
          name: account.name,
          // Piggyback role/username through the user object; consumed in jwt().
          email: `${account.username}@demo.papi`,
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  secret:
    process.env.AUTH_SECRET ?? (env.isDemoMode ? "papi-demo-secret-do-not-use-in-prod" : undefined),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, account, user, profile }) {
      // Initial sign-in only — afterwards the token carries the role.
      if (account?.provider === "discord") {
        const discordProfile = profile as { id?: string; username?: string } | null;
        const discordId = discordProfile?.id ?? token.sub ?? "";
        const role = account.access_token
          ? await resolveDiscordRole(account.access_token)
          : "PUBLIC";
        token.role = role;
        token.discordId = discordId;
        token.dbUserId = await upsertUser({
          discordId,
          username: discordProfile?.username ?? user?.name ?? "unknown",
          displayName: user?.name,
          avatarUrl: user?.image,
          role,
        });
      } else if (account?.provider === "demo" && user) {
        const demo = Object.values(DEMO_ACCOUNTS).find((a) => a.discordId === user.id);
        if (demo) {
          token.role = demo.role;
          token.discordId = demo.discordId;
          token.name = demo.name;
          token.dbUserId = await upsertUser({
            discordId: demo.discordId,
            username: demo.username,
            displayName: demo.name,
            role: demo.role,
          });
        }
      }
      if (!isPapiRole(token.role)) token.role = "PUBLIC";
      return token;
    },
    async session({ session, token }) {
      session.user.role = isPapiRole(token.role) ? token.role : "PUBLIC";
      session.user.discordId = typeof token.discordId === "string" ? token.discordId : undefined;
      session.user.dbUserId = typeof token.dbUserId === "number" ? token.dbUserId : undefined;
      return session;
    },
  },
});

/**
 * Server-side guard for pages and server actions.
 * Throws a redirect-friendly error object when the requirement isn't met.
 */
export async function requireRole(required: PapiRole) {
  const session = await auth();
  const role = session?.user?.role ?? "PUBLIC";
  if (!hasRole(role, required)) {
    const err = new Error("FORBIDDEN") as Error & { status: number };
    err.status = session ? 403 : 401;
    throw err;
  }
  return session!;
}
