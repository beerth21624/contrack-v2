// Builders for common BOQ slot rows, matching how Excel's BOQ (Home) lays them out.
import type { BoqItemTemplate } from './types';

export const REBAR_SIZES = ['RB6', 'RB9', 'DB12', 'DB16', 'DB20'] as const;
export type RebarSize = typeof REBAR_SIZES[number];

/** kg per metre (Excel SWITCH table used by every structural sheet). */
export const REBAR_KG_PER_M: Record<RebarSize, number> = {
    RB6: 0.222, RB9: 0.499, DB12: 0.888, DB16: 1.58, DB20: 2.47,
};

/**
 * BOQ waste per bar size. Excel: RB6 6 %, RB9 9 %, DB12 12 % (roof beam has RB6/DB12 swapped — fixed, D1);
 * DB16/DB20 have no example → 12 % like DB12 (D12).
 */
export const REBAR_WASTE: Record<RebarSize, number> = {
    RB6: 0.06, RB9: 0.09, DB12: 0.12, DB16: 0.12, DB20: 0.12,
};

/** Excel BOQ: tie wire = 3 % of the block's rebar quantity incl. waste. */
export const TIE_WIRE_RATIO = 0.03;

type Row = Omit<BoqItemTemplate, 'excelRow'>;

/**
 * Rebar rows for one structural element: one `- เหล็ก <size>` row per size with weight > 0
 * (Excel's FILTER spill), followed by `- ลวดผูกเหล็ก` = 3 % of their gross weight.
 * `weights` are net kg per size from the element's bar schedule.
 */
export function rebarSlotRows(
    weights: Partial<Record<RebarSize, number>>,
    opts: { mat?: number; lab?: number; wireMat?: number; tieWire?: boolean } = {},
): Row[] {
    const { mat = 25, lab = 15, wireMat = 50, tieWire = true } = opts;
    const rows: Row[] = REBAR_SIZES
        .filter(size => (weights[size] ?? 0) > 0)
        .map(size => ({
            type: 'item', key: size, desc: `- เหล็ก ${size}`, unit: 'กก.',
            qty: { kind: 'input', value: weights[size] ?? 0 },
            waste: REBAR_WASTE[size], gross: 'std', mat, lab,
            materialBasis: 'gross', labourBasis: 'net',
        }));
    if (tieWire && rows.length > 0) {
        rows.push({
            type: 'item', key: 'tie-wire', desc: '- ลวดผูกเหล็ก', unit: 'กก.',
            qty: { kind: 'none' }, waste: 0,
            gross: { kind: 'tieWire', refs: rows.map(r => r.key), ratio: TIE_WIRE_RATIO },
            mat: wireMat, lab: 0, materialBasis: 'gross', labourBasis: 'gross',
        });
    }
    return rows;
}
