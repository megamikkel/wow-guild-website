import { signOut } from "@/lib/auth";

/**
 * Isolated because it defines a server action. The static preview build
 * (scripts/build-static-preview.mjs) swaps this file for a stub, since a file
 * host cannot execute actions and their mere presence fails an export build.
 */
export function SignOutButton({ title }: { title?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="hidden rounded px-2 py-2 text-xs text-ink-muted transition-colors hover:text-ink md:block"
        title={title}
      >
        Sign out
      </button>
    </form>
  );
}
