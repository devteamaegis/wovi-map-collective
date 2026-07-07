// Shared visual encoding for the relationship graph (GraphView + GraphSnapshot),
// so the palette lives in one place and can't drift between the two. Node radius
// is intentionally left per-component (the dashboard snapshot renders smaller).

// Node fill by org kind (people are lighter). Pairs with the on-canvas legend.
export const NODE_COLOR: Record<string, string> = {
  buyer: "#6e93b6",
  supplier: "#74b08f",
  broker: "#b297cf",
  facility: "#c9b487",
  person: "#9fb0c0",
};

// Link base color by relationship kind (RGB tuple for alpha blending by consent).
export const LINK_RGB: Record<string, [number, number, number]> = {
  knows: [150, 168, 188],
  introduced_by: [110, 147, 182],
  brokered_intro: [143, 176, 208],
  sources_from: [74, 110, 146],
  supplies: [116, 176, 143],
};

// Dash pattern encoding consent strength (solid = double opt-in).
export function linkConsentDash(consent: string): number[] | null {
  if (consent === "double_opt_in") return null; // solid
  if (consent === "one_sided") return [5, 4]; // dashed
  return [1, 4]; // faint dotted
}
