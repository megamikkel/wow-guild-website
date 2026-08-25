import { ROLE_ICON, ROLE_MEANING, roleKey } from "@/components/icons/roles";

/**
 * The role chip. Icon plus label in a barely-there frame — on a white roster
 * it should read as part of the row, not as a button sitting on top of one.
 *
 * The tint is the same faint navy for all three rather than one colour per
 * role: the marks already tell them apart, and three tinted pills in a column
 * would fight the class colours that carry the actual meaning in this table.
 */
export function RoleBadge({
  role,
  size = 20,
  labelHidden = false,
  className = "",
}: {
  role: string;
  size?: number;
  /**
   * Icon only, for layouts too tight for the word. The name still reaches
   * assistive tech and hover through the icon's own title.
   */
  labelHidden?: boolean;
  className?: string;
}) {
  const key = roleKey(role);
  const Icon = ROLE_ICON[key];
  const { label, line } = ROLE_MEANING[key];
  const tooltip = `${label} — "${line}"`;

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-[9px] border px-2 py-1 whitespace-nowrap ${className}`}
      style={{
        borderColor: "color-mix(in srgb, var(--color-role-navy) 14%, transparent)",
        background: "color-mix(in srgb, var(--color-role-navy) 3.5%, transparent)",
      }}
    >
      <Icon size={size} title={labelHidden ? tooltip : undefined} />
      {labelHidden ? null : (
        <span className="font-display text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
          {label}
        </span>
      )}
    </span>
  );
}
