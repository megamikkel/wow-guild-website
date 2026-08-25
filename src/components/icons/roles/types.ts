/**
 * The Dad Trinity — PAPI's own role marks.
 *
 * Tank is a ribbed undershirt, healer a roll of duct tape, DPS a cordless
 * drill: "jeg tager den", "det kan repareres", "problemet skal væk". They are
 * drawn on one 24×24 grid with the same weights so they read as one family,
 * and each carries a single accent so the colour never has to do the work of
 * telling them apart.
 */
export type RoleIconProps = {
  size?: number;
  /**
   * Drop the accent colour and draw the whole mark in currentColor, for
   * places that tint the icon themselves — inline lists, dark chrome, a
   * future dashboard. Depth survives as opacity rather than hue.
   */
  monochrome?: boolean;
  className?: string;
  /**
   * Icons are decorative wherever a visible label sits beside them; the badge
   * passes a title only when the label is hidden.
   */
  title?: string;
};

export const NAVY = "var(--color-role-navy, #07065f)";
export const RED = "var(--color-role-red, #ed3026)";
export const BLUE = "var(--color-role-blue, #397cef)";
export const PAPER = "var(--color-canvas, #ffffff)";
