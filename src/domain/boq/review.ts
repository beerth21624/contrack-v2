// ─── BOQ review: rows for the AI reviewer and deterministic sanity rules ─────
// Two pure helpers over a computed BoqResult:
//  • toReviewRows  — the engine output (E/H/G/I/K) as the AI request rows, with `derived` flags so the model
//                    does not flag quantities / prices the engine computes from other rows.
//  • reviewBoqRules — rule-based findings (source 'rule'), no AI: zero prices, outlier prices, high waste,
//                    empty sections, untouched sample sections, rebar/concrete and paint/area sanity ratios.
// Messages are short professional Thai: "<desc> — <what is wrong>", like the journey required-field list.
import type { BoqReviewFinding, BoqReviewRow } from '@/shared/contract';
import { computeBoq, expandSlots } from './engine';
import type {
    BoqItemRow, BoqItemTemplate, BoqLineKey, BoqResult, BoqSectionResult, BoqSectionTemplate, PriceRule, QtyRule,
} from './types';

// ─── Derived flags ───

/** Net qty computed from other rows (`line`, `sumLines`) or absent (`none`): the engine, not the user, owns it. */
export const isDerivedQty = (kind: QtyRule['kind']): boolean => kind === 'line' || kind === 'sumLines' || kind === 'none';

/** Unit price computed from other rows (`consumables`, `linePrice`). */
export const isDerivedPrice = (rule: PriceRule): boolean => typeof rule !== 'number';

/** Template item rows by key, slots expanded to their Excel fallback rows. */
function templateItems(template: readonly BoqSectionTemplate[]): Map<BoqLineKey, BoqItemTemplate> {
    const map = new Map<BoqLineKey, BoqItemTemplate>();
    for (const s of template) for (const l of expandSlots(s.lines, {})) if (l.type === 'item') map.set(l.key, l);
    return map;
}

/** Round to 2 decimals without float noise (10.000000000000002 → 10). */
const round2 = (v: number): number => Math.round(v * 100) / 100;

// ─── Rows for the AI reviewer ───

/**
 * Every computed item row (headings skipped, order kept) as a review row. `derived` comes from the template rule
 * of the same key; rows a calculator supplied for a slot (not in the template) fall back to their own `qtySource`
 * and never claim a derived price.
 */
export function toReviewRows(result: BoqResult, template: readonly BoqSectionTemplate[]): BoqReviewRow[] {
    const items = templateItems(template);
    const rows: BoqReviewRow[] = [];
    for (const s of result.sections) {
        for (const r of s.rows) {
            if (r.type !== 'item') continue;
            const t = items.get(r.key);
            rows.push({
                key: r.key,
                section: s.title,
                desc: r.desc,
                unit: r.unit,
                qty: r.qty,
                grossQty: r.grossQty,
                wastePct: round2(r.waste * 100),
                matUnit: r.matUnit,
                labUnit: r.labUnit,
                note: r.note ?? '',
                derived: t
                    ? { qty: isDerivedQty(t.qty.kind), mat: isDerivedPrice(t.mat), lab: isDerivedPrice(t.lab) }
                    : { qty: isDerivedQty(r.qtySource), mat: false, lab: false },
            });
        }
    }
    return rows;
}

// ─── Rule-based review ───

export interface BoqReviewContext {
    /** Usable (floor) area of the house in m²; enables the paint-area rule. */
    usableAreaSqm?: number;
}

/** Rule ids, in the order their findings are listed within a row. */
export const BOQ_REVIEW_RULES = [
    'price-zero', 'price-outlier', 'waste-high', 'section-empty', 'sample-values', 'rebar-ratio', 'area-ratio',
] as const;
export type BoqReviewRule = typeof BOQ_REVIEW_RULES[number];

/** Price ratio against the template beyond which a price is an outlier (×3 either way). */
export const PRICE_OUTLIER_RATIO = 3;
/** Waste above this is suspicious when the template allowed less; above WASTE_MAX it is always suspicious. */
export const WASTE_HIGH = 0.30;
export const WASTE_MAX = 0.5;
/** Rebar per m³ of concrete expected in a house structure (kg/m³). */
export const REBAR_KG_PER_M3 = { min: 50, max: 300 } as const;
/** One coat of paint (walls + ceilings) relative to the usable area: 3–6× is typical. */
export const PAINT_AREA_RATIO = { min: 0.5, max: 12 } as const;
/** Sections whose rows are the concrete structure (footing … stair). */
const STRUCTURE_SECTIONS = { from: 6, to: 13 } as const;
/** `sample-values` needs this many untouched sample quantities in a section (1-row sections are not noise-worthy). */
const SAMPLE_MIN_ITEMS = 3;

/** Thai-style number: thousands separated, at most 2 decimals ("2,500", "1,234.5"). */
export function formatNumber(v: number): string {
    const r = round2(v);
    const [int = '0', frac] = Math.abs(r).toFixed(2).replace(/\.?0+$/, '').split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${r < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

const pct = (fraction: number): string => `${formatNumber(fraction * 100)}%`;

/** Section totals of the untouched template (sample values), memoised per template array. */
const sampleTotals = new WeakMap<readonly BoqSectionTemplate[], Map<number, number>>();
function sampleSectionTotals(template: readonly BoqSectionTemplate[]): Map<number, number> {
    let totals = sampleTotals.get(template);
    if (!totals) {
        const r = computeBoq({ sections: [...template] });
        totals = new Map(r.sections.map(s => [s.no, s.total]));
        sampleTotals.set(template, totals);
    }
    return totals;
}

/** Sample (Excel) net qty of an editable template row; undefined for derived rows. */
function sampleQty(t: BoqItemTemplate): number | undefined {
    if (t.qty.kind === 'input') return t.qty.value;
    if (t.qty.kind === 'calc') return t.qty.fallback;
    return undefined;
}

const itemRows = (s: BoqSectionResult): BoqItemRow[] => s.rows.filter((r): r is BoqItemRow => r.type === 'item');

/** Finding plus its position, so the final list is errors first, then section / row order. */
interface Positioned { finding: BoqReviewFinding; section: number; row: number }

/**
 * Deterministic review of a computed BOQ against its template. Pure: no AI, no I/O.
 * Findings are ordered errors first, then by section and row; one finding per (key, kind).
 */
export function reviewBoqRules(
    result: BoqResult,
    template: readonly BoqSectionTemplate[],
    ctx: BoqReviewContext = {},
): BoqReviewFinding[] {
    const items = templateItems(template);
    const templateSections = new Map(template.map(s => [s.no, s]));
    const out: Positioned[] = [];
    const seen = new Set<string>();
    const add = (section: number, row: number, severity: BoqReviewFinding['severity'], kind: BoqReviewRule, key: BoqLineKey, message: string) => {
        const id = `${key}\u0000${kind}`;
        if (seen.has(id)) return;
        seen.add(id);
        out.push({ finding: { key, source: 'rule', severity, kind, message }, section, row });
    };

    // Structural sanity accumulators (sections 6–13).
    let rebarKg = 0;
    let concreteM3 = 0;
    let firstConcrete: { key: BoqLineKey; section: number; row: number } | undefined;
    // Paint: one coat = the largest per-section paint area (the sample paints the same surfaces three times).
    let paintArea = 0;
    let firstPaint: { key: BoqLineKey; section: number; row: number } | undefined;

    result.sections.forEach((s, si) => {
        const rows = itemRows(s);
        const tSection = templateSections.get(s.no);
        const inStructure = s.no >= STRUCTURE_SECTIONS.from && s.no <= STRUCTURE_SECTIONS.to;
        let sectionPaint = 0;

        // Per-row rules
        s.rows.forEach((r, ri) => {
            if (r.type !== 'item') return;
            const t = items.get(r.key);
            const derivedMat = t ? isDerivedPrice(t.mat) : false;
            const derivedLab = t ? isDerivedPrice(t.lab) : false;

            // price-zero: typed row with a quantity but no price, where the Excel sample had one.
            if (t && r.qty > 0 && !derivedMat && !derivedLab && r.matUnit === 0 && r.labUnit === 0
                && ((typeof t.mat === 'number' && t.mat !== 0) || (typeof t.lab === 'number' && t.lab !== 0))) {
                add(si, ri, 'error', 'price-zero', r.key, `${r.desc} — ไม่มีราคาวัสดุและค่าแรง`);
            }

            // price-outlier: more than ×3 away from the template price.
            if (t) {
                const parts: string[] = [];
                const check = (label: string, value: number, rule: PriceRule) => {
                    if (typeof rule !== 'number' || rule === 0 || value === 0) return;
                    const ratio = value / rule;
                    if (ratio > PRICE_OUTLIER_RATIO || ratio < 1 / PRICE_OUTLIER_RATIO) {
                        parts.push(`${label} ${formatNumber(value)} ต่างจากค่าอ้างอิง ${formatNumber(rule)} เกิน ${formatNumber(PRICE_OUTLIER_RATIO)} เท่า`);
                    }
                };
                check('ราคาวัสดุ', r.matUnit, t.mat);
                check('ค่าแรง', r.labUnit, t.lab);
                if (parts.length > 0) add(si, ri, 'warn', 'price-outlier', r.key, `${r.desc} — ${parts.join(' และ ')}`);
            }

            // waste-high: raised above the template's allowance past 30 %, or above 50 % anywhere (tie wire excluded).
            const tieWire = t !== undefined && typeof t.gross === 'object';   // the only object gross rule is tieWire
            if (!tieWire) {
                const raised = t !== undefined && t.waste <= WASTE_HIGH && r.waste > WASTE_HIGH;
                if (raised || r.waste > WASTE_MAX) {
                    add(si, ri, 'warn', 'waste-high', r.key, `${r.desc} — เผื่อเสีย ${pct(r.waste)} สูงผิดปกติ`);
                }
            }

            // Structural accumulators
            if (inStructure) {
                if (r.unit === 'กก.' && r.desc.includes('เหล็ก')) rebarKg += r.qty;
                if (r.unit === 'ลบ.ม.' && r.desc.includes('คอนกรีต')) {
                    concreteM3 += r.qty;
                    firstConcrete ??= { key: r.key, section: si, row: ri };
                }
            }
            // Paint accumulators
            if (r.unit === 'ตร.ม.' && r.desc.startsWith('ทาสี')) {
                sectionPaint += r.qty;
                firstPaint ??= { key: r.key, section: si, row: ri };
            }
        });
        paintArea = Math.max(paintArea, sectionPaint);

        const first = rows[0];
        if (!first || s.no === 0) return;

        // section-empty: a costed section that has rows but no value (unless Excel's sample is empty there too).
        if (s.inConstructionTotal && s.total === 0 && (sampleSectionTotals(template).get(s.no) ?? 0) !== 0) {
            add(si, 0, 'warn', 'section-empty', first.key, `หมวด ${s.title} — ยังไม่มีรายการใดมีมูลค่า`);
        }

        // sample-values: every editable row still shows the Excel sample (no edit, no calculator), ≥ 3 of them > 0.
        if (tSection && tSection.calculators.length > 0) {
            let untouched = 0;
            let touched = false;
            for (const r of rows) {
                if (!r.editable.qty) continue;
                const t = items.get(r.key);
                const sample = t ? sampleQty(t) : undefined;
                if (sample === undefined || r.fromCalc.qty || r.qty !== sample) { touched = true; break; }
                if (sample > 0) untouched++;
            }
            if (!touched && untouched >= SAMPLE_MIN_ITEMS) {
                add(si, 0, 'warn', 'sample-values', first.key, `หมวด ${s.title} — ยังเป็นค่าตัวอย่างจาก Excel`);
            }
        }
    });

    // rebar-ratio: kg of rebar per m³ of concrete across the structure.
    if (firstConcrete && rebarKg > 0 && concreteM3 > 0) {
        const ratio = rebarKg / concreteM3;
        if (ratio < REBAR_KG_PER_M3.min || ratio > REBAR_KG_PER_M3.max) {
            add(firstConcrete.section, firstConcrete.row, 'warn', 'rebar-ratio', firstConcrete.key,
                `โครงสร้าง — เหล็กเสริม ${formatNumber(rebarKg)} กก. ต่อคอนกรีต ${formatNumber(concreteM3)} ลบ.ม. (${formatNumber(ratio)} กก./ลบ.ม.) ${ratio < REBAR_KG_PER_M3.min ? 'น้อย' : 'มาก'}ผิดปกติ`);
        }
    }

    // area-ratio: one coat of paint against the usable area.
    const area = ctx.usableAreaSqm;
    if (firstPaint && area !== undefined && area > 0 && paintArea > 0) {
        const ratio = paintArea / area;
        if (ratio > PAINT_AREA_RATIO.max || ratio < PAINT_AREA_RATIO.min) {
            add(firstPaint.section, firstPaint.row, 'warn', 'area-ratio', firstPaint.key,
                `งานทาสี — พื้นที่ทาสี ${formatNumber(paintArea)} ตร.ม. เทียบพื้นที่ใช้สอย ${formatNumber(area)} ตร.ม. (${formatNumber(ratio)} เท่า) ${ratio < PAINT_AREA_RATIO.min ? 'น้อย' : 'มาก'}ผิดปกติ`);
        }
    }

    const rank = (p: Positioned) => (p.finding.severity === 'error' ? 0 : 1);
    return out
        .sort((a, b) => rank(a) - rank(b) || a.section - b.section || a.row - b.row)
        .map(p => p.finding);
}
