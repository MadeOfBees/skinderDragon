/** Ore UI segmented-button variant class: green when active, stone otherwise. */
export const seg = (active: boolean): string =>
  active ? "mc-btn-green" : "mc-btn-stone";

/** Join class names, dropping falsy values. */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ");
