// ─── Shared Helpers & Constants ─────────────────────────────────────────────
// Extracted from the original steps-engine.ts. Used by all step calc modules.

/** Round to 2 decimal places */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Rebar unit weight (kg per linear meter) — from Excel SWITCH table */
export const REBAR_WEIGHT_PER_M: Record<string, number> = {
  RB6: 0.222, RB9: 0.499,
  DB12: 0.888, DB16: 1.58, DB20: 2.47,
};

/**
 * Excavation / lean / sand working-margin per side (m).
 * Excel ฐานราก_Footing sheet uses +0.40 each side.
 */
export const EXCAVATION_MARGIN = 0.40;

/**
 * Sand bedding extra waste multiplier (25%).
 * Excel ฐานราก_Footing sheet: ×(100%+25%).
 */
export const SAND_WASTE_FACTOR = 1.25;

/** Calculate rebar weight from bar type and total length */
export function rebarWeight(barType: string, totalLength: number): number {
  const w = REBAR_WEIGHT_PER_M[barType];
  return w ? r2(totalLength * w) : 0;
}
