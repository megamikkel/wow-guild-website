import { ROLE_ICON, ROLE_MEANING, roleKey } from "@/components/icons/roles";

/**
 * The role chip. Icon plus label in a barely-there frame — on a white roster
 * it should read as part of the row, not as a button sitting on top of one.
 *
 * The tint is the same faint navy for all three rather than one colour per
 * role: the marks already tell them apart, and three tinted pills in a column
 * would fight the class colours that carry the actual meaning in this table.
 *
 * The whole chip is one labelled image to assistive tech, so hiding the word
 * at a narrow breakpoint costs nothing — `display: none` would otherwise take
 * the label out of the accessibility tree along with the pixels.
 */
export function RoleBadge({
  role,
  size = 20,
  labelHidden = false,
  labelClassName = "",
  className = "",
}: {
  role: string;
  size?: number;
  /** Icon only, everywhere. For a responsive version pass labelClassName. */
  labelHidden?: boolean;
  /** e.g. "hidden sm:inline" — drop the word only where space is tight. */
  labelClassName?: string;
  className?: string;
}) {
  const key = roleKey(role);
  const Icon = ROLE_ICON[key];
  const { label, line } = ROLE_MEANING[key];
  const tooltip = `${label} — "${line}"`;

  return (
    <span
      role="img"
      aria-label={tooltip}
      title={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-[9px] border px-2 py-1 whitespace-nowrap ${className}`}
      style={{
        borderColor: "color-mix(in srgb, var(--color-role-navy) 14%, transparent)",
        background: "color-mix(in srgb, var(--color-role-navy) 3.5%, transparent)",
      }}
    >
      <Icon size={size} />
      {labelHidden ? null : (
        <span
          aria-hidden
          className={`font-display text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase ${labelClassName}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
