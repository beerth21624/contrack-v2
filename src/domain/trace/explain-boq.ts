// ─── explainBoq: why every BOQ number is what it is (dev mode, docs/dev-mode/README.md §4) ───
// Walks the same declarative rules as computeBoq (src/domain/boq/engine.ts) and the same input, but takes every
// number from computeBoq's own result, so an explanation can never disagree with the BOQ page. computeBoq is not
// changed. The precedence below mirrors engine.ts — when engine.ts changes its precedence, change it here too.
import { computeBoq, expandSlots, type ComputeBoqInput } from '../boq/engine';
import type { BoqItemRow, BoqItemTemplate, BoqLineKey, BoqResult } from '../boq/types';
import type {
    BoqCellExplanation, BoqCellField, BoqExplanation, BoqGrossExplanation, BoqLineExplanation, BoqLinkOrigin,
    BoqNetSource, BoqPriceExplanation, BoqPriceSource,
} from './types';

export interface ExplainBoqInput extends ComputeBoqInput {
    /** Which step output filled each linked cell (projectBoqInput().origins). Without it a linked value says "a step". */
    origins?: Record<BoqLineKey, Partial<Record<'qty' | 'mat' | 'lab', BoqLinkOrigin>> | undefined>;
    /** Lines forced to quantity 0 ("not in this project") → the step that caused it, when known. */
    zeroed?: ReadonlyMap<BoqLineKey, string | undefined>;
}

const finite = (v: number | undefined): number | undefined => (v !== undefined && Number.isFinite(v) ? v : undefined);

/** Explains every item line. Pass `result` when computeBoq already ran on the same input (saves a recompute). */
export function explainBoq(input: ExplainBoqInput, result: BoqResult = computeBoq(input)): BoqExplanation {
    const { overrides = {}, linked = {}, slots = {}, origins = {}, zeroed = new Map<BoqLineKey, string | undefined>() } = input;

    const rows = new Map<BoqLineKey, BoqItemRow>();
    const sectionOf = new Map<BoqLineKey, number>();
    for (const s of result.sections) for (const r of s.rows) if (r.type === 'item') { rows.set(r.key, r); sectionOf.set(r.key, s.no); }

    const templates = new Map<BoqLineKey, BoqItemTemplate>();
    for (const s of input.sections) for (const l of expandSlots(s.lines, slots)) if (l.type === 'item') templates.set(l.key, l);

    // Rows a calculator supplied for a slot → which calculator and slot.
    const slotOf = new Map<BoqLineKey, { calc: string; slot: string }>();
    for (const [id, list] of Object.entries(slots)) {
        const dot = id.indexOf('.');
        const calc = dot < 0 ? id : id.slice(0, dot);
        const slot = dot < 0 ? '' : id.slice(dot + 1);
        for (const l of list ?? []) slotOf.set(l.key, { calc, slot });
    }

    const row = (key: BoqLineKey): BoqItemRow | undefined => rows.get(key);
    const netOf = (key: BoqLineKey) => row(key)?.qty ?? 0;

    const lines: Record<BoqLineKey, BoqLineExplanation> = {};
    const order: BoqLineKey[] = [];

    for (const [key, r] of rows) {
        const t = templates.get(key);
        if (!t) continue;
        const ov = overrides[key];
        const ln = linked[key];

        // ── net (computeBoq `net`)
        let netSource: BoqNetSource;
        let raw: number;
        switch (t.qty.kind) {
            case 'input':
            case 'calc': {
                const tv = t.qty.kind === 'input' ? t.qty.value : t.qty.fallback;
                raw = ov?.qty ?? ln?.qty ?? tv;
                if (ov?.qty !== undefined) netSource = { kind: 'override' };
                else if (ln?.qty !== undefined) {
                    if (zeroed.has(key)) {
                        const calc = zeroed.get(key);
                        netSource = calc === undefined ? { kind: 'skipped' } : { kind: 'skipped', calc };
                    } else {
                        const o = origins[key]?.qty;
                        netSource = o ? { kind: 'calc', calc: o.calc, output: o.output } : { kind: 'calc' };
                    }
                } else {
                    const s = slotOf.get(key);
                    netSource = s ? { kind: 'slot', ...s } : { kind: 'template' };
                }
                break;
            }
            case 'line': {
                const refValue = netOf(t.qty.ref);
                raw = t.qty.factor * refValue;
                netSource = { kind: 'line', ref: t.qty.ref, factor: t.qty.factor, refValue };
                break;
            }
            case 'sumLines': {
                const refs = t.qty.refs.map(l => ({ line: l, value: netOf(l) }));
                raw = refs.reduce((s, x) => s + x.value, 0);
                netSource = { kind: 'sumLines', refs };
                break;
            }
            case 'none':
                raw = 0;
                netSource = { kind: 'none' };
                break;
        }

        // ── waste / gross (computeBoq `waste`, `gross`)
        const wasteSource: 'override' | 'template' = finite(ov?.waste) !== undefined ? 'override' : 'template';
        const g = t.gross;
        let grossRule: BoqGrossExplanation;
        if (g === 'none') grossRule = { kind: 'none' };
        else if (g === 'std') grossRule = { kind: 'std', net: r.qty, waste: r.waste };
        else if (g === 'ceilInt') grossRule = { kind: 'ceilInt', net: r.qty, waste: r.waste, unrounded: r.qty * (1 + r.waste) };
        else if (g === 'concrete') grossRule = { kind: 'concrete', net: r.qty, waste: r.waste, unrounded: r.qty * (1 + r.waste) };
        else {
            grossRule = {
                kind: 'tieWire', ratio: g.ratio,
                refs: g.refs.map(l => ({ line: l, value: row(l)?.grossQty ?? netOf(l) })),
            };
        }

        // ── unit prices (computeBoq `price`)
        const priceOf = (field: 'mat' | 'lab'): { source: BoqPriceSource; cleaned: boolean } => {
            const rule = t[field];
            const ovF = finite(ov?.[field]);
            const lnF = finite(ln?.[field]);
            if (ovF !== undefined) return { source: { kind: 'override' }, cleaned: false };
            if (lnF !== undefined) {
                const o = origins[key]?.[field];
                return { source: o ? { kind: 'calc', calc: o.calc, output: o.output } : { kind: 'calc' }, cleaned: false };
            }
            if (typeof rule === 'number') {
                const s = slotOf.get(key);
                return { source: s ? { kind: 'slot', ...s } : { kind: 'template' }, cleaned: !Number.isFinite(rule) };
            }
            if (rule.kind === 'linePrice') {
                const ref = row(rule.ref);
                const refValue = (field === 'mat' ? ref?.matUnit : ref?.labUnit) ?? 0;
                return { source: { kind: 'linePrice', ref: rule.ref, factor: rule.factor, refValue }, cleaned: !Number.isFinite(refValue * rule.factor) };
            }
            const refs = rule.refs.map(l => ({ line: l, value: (row(l)?.matTotal ?? 0) + (row(l)?.labTotal ?? 0) }));
            const sum = refs.reduce((s, x) => s + x.value, 0);
            return { source: { kind: 'consumables', refs, pct: rule.pct }, cleaned: !Number.isFinite(sum * rule.pct) };
        };

        const matBasisGross = t.materialBasis !== 'net' && r.grossQty !== null;
        const labBasisGross = t.labourBasis === 'gross' && r.grossQty !== null;
        const mp = priceOf('mat');
        const lp = priceOf('lab');
        const mat: BoqPriceExplanation = {
            unit: r.matUnit, ...mp,
            basis: matBasisGross ? 'gross' : 'net', basisValue: matBasisGross ? (r.grossQty ?? r.qty) : r.qty, total: r.matTotal,
        };
        const lab: BoqPriceExplanation = {
            unit: r.labUnit, ...lp,
            basis: labBasisGross ? 'gross' : 'net', basisValue: labBasisGross ? (r.grossQty ?? r.qty) : r.qty, total: r.labTotal,
        };

        const e: BoqLineExplanation = {
            key, section: sectionOf.get(key) ?? 0, desc: r.desc, unit: r.unit,
            net: { value: r.qty, source: netSource, cleaned: !Number.isFinite(raw) },
            waste: { value: r.waste, source: wasteSource },
            gross: { value: r.grossQty, rule: grossRule },
            mat, lab, total: r.total,
        };
        if (r.itemNo !== undefined) e.itemNo = r.itemNo;
        lines[key] = e;
        order.push(key);
    }
    return { lines, order };
}

/** One number cell of a line (the "Explain this cell" panel). Undefined for an unknown line. */
export function explainCell(expl: BoqExplanation, key: BoqLineKey, field: BoqCellField): BoqCellExplanation | undefined {
    const line = expl.lines[key];
    if (!line) return undefined;
    const value: number | null = {
        qty: line.net.value, waste: line.waste.value, gross: line.gross.value,
        matUnit: line.mat.unit, matTotal: line.mat.total, labUnit: line.lab.unit, labTotal: line.lab.total, total: line.total,
    }[field];
    return { line, field, value };
}
