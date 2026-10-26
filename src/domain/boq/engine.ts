import type {
    BoqHeadingTemplate, BoqItemTemplate, BoqLineKey, BoqLineOverride, BoqResult, BoqRow, BoqSectionTemplate,
    LinkedValues, PriceRule, SlotLines,
} from './types';

/** Replaces each slot with the rows its calculator supplied (or the Excel fallback rows). */
export function expandSlots(lines: BoqSectionTemplate['lines'], slots: SlotLines): (BoqItemTemplate | BoqHeadingTemplate)[] {
    return lines.flatMap(l => (l.type === 'slot' ? (slots[`${l.calc}.${l.slot}`] ?? l.fallback) : [l]));
}

const EPS = 1e-9;

/** Excel ROUNDUP(x, 0) for non-negative x, tolerant of float noise (34.100000000000001 → 35, 35.0000000001 → 35). */
export function roundUp(x: number): number {
    return Math.ceil(x - EPS) + 0;   // + 0 turns -0 (from ceil(-1e-9)) into 0
}

/** Excel CEILING(x, step). */
export function ceilingTo(x: number, step: number): number {
    return Math.ceil(x / step - EPS) * step + 0;
}

export interface ComputeBoqInput {
    sections: BoqSectionTemplate[];
    /** Edits made on the BOQ page — win over everything. */
    overrides?: Record<BoqLineKey, BoqLineOverride | undefined>;
    /** Values supplied by calculator sheets — win over the template's Excel sample. */
    linked?: LinkedValues;
    /** Rows supplied for variable-length runs (see BoqSlotTemplate). */
    slots?: SlotLines;
}

interface LineCalc {
    net: number;
    gross: number | null;
    matUnit: number;
    labUnit: number;
    matTotal: number;
    labTotal: number;
}

/**
 * Evaluates the BOQ (Home) sheet: every line's E/H/I/J/K/L/M, section sub-totals and the
 * construction total. Pure — the same input always gives the same result.
 *
 * Sub-totals sum every item row of the section (decision D1 fixes Excel's short ranges at
 * J14/L14/M14 — section 1 leaves out row 12 demolition —, J95/L95, J216/L216, L243). Sections whose Excel
 * ranges already cover every row are unchanged.
 */
export function computeBoq({ sections: rawSections, overrides = {}, linked = {}, slots = {} }: ComputeBoqInput): BoqResult {
    const sections = rawSections.map(s => ({ ...s, lines: expandSlots(s.lines, slots) }));
    const items = new Map<BoqLineKey, BoqItemTemplate>();
    for (const s of sections) for (const l of s.lines) if (l.type === 'item') items.set(l.key, l);

    const memo = new Map<BoqLineKey, Partial<LineCalc>>();
    const inProgress = new Set<string>();

    const get = (key: BoqLineKey): BoqItemTemplate => {
        const t = items.get(key);
        if (!t) throw new Error(`BOQ line ${key} not found`);
        return t;
    };
    const slot = (key: BoqLineKey) => {
        let m = memo.get(key);
        if (!m) { m = {}; memo.set(key, m); }
        return m;
    };
    const guard = <T>(id: string, fn: () => T): T => {
        if (inProgress.has(id)) throw new Error(`Circular BOQ reference at ${id}`);
        inProgress.add(id);
        try { return fn(); } finally { inProgress.delete(id); }
    };

    const net = (key: BoqLineKey): number => {
        const m = slot(key);
        if (m.net !== undefined) return m.net;
        return guard(`${key}.net`, () => {
            const t = get(key);
            const ov = overrides[key];
            const fromCalc = linked[key]?.qty;
            let v: number;
            switch (t.qty.kind) {
                case 'input': v = ov?.qty ?? fromCalc ?? t.qty.value; break;
                case 'calc': v = ov?.qty ?? fromCalc ?? t.qty.fallback; break;
                case 'line': v = t.qty.factor * net(t.qty.ref); break;
                case 'sumLines': v = t.qty.refs.reduce((s, r) => s + net(r), 0); break;
                case 'none': v = 0; break;
            }
            m.net = Number.isFinite(v) ? v : 0;
            return m.net;
        });
    };

    const waste = (key: BoqLineKey) => overrides[key]?.waste ?? get(key).waste;

    const gross = (key: BoqLineKey): number | null => {
        const m = slot(key);
        if (m.gross !== undefined) return m.gross;
        return guard(`${key}.gross`, () => {
            const t = get(key);
            const g = t.gross;
            let v: number | null;
            if (g === 'none') v = null;
            else if (g === 'std') v = net(key) * (1 + waste(key));
            else if (g === 'ceilInt') v = roundUp(net(key) * (1 + waste(key)));
            // Excel MAX(1, CEILING(x, 0.25)) orders 1 m³ even when there is no concrete; no quantity stays 0 (D1).
            else if (g === 'concrete') v = net(key) <= 0 ? 0 : Math.max(1, ceilingTo(net(key) * (1 + waste(key)), 0.25));
            else v = g.refs.reduce((s, r) => s + (gross(r) ?? net(r)), 0) * g.ratio;
            m.gross = v;
            return v;
        });
    };

    const price = (key: BoqLineKey, field: 'mat' | 'lab'): number => {
        const m = slot(key);
        const cacheKey = field === 'mat' ? 'matUnit' : 'labUnit';
        const cached = m[cacheKey];
        if (cached !== undefined) return cached;
        return guard(`${key}.${field}`, () => {
            const t = get(key);
            const ov = overrides[key]?.[field] ?? linked[key]?.[field];
            const rule: PriceRule = t[field];
            let v: number;
            if (ov !== undefined) v = ov;
            else if (typeof rule === 'number') v = rule;
            else if (rule.kind === 'linePrice') v = price(rule.ref, field) * rule.factor;
            else v = rule.refs.reduce((s, r) => s + matTotal(r) + labTotal(r), 0) * rule.pct;
            m[cacheKey] = v;
            return v;
        });
    };

    const matTotal = (key: BoqLineKey): number => {
        const m = slot(key);
        if (m.matTotal !== undefined) return m.matTotal;
        const t = get(key);
        const basis = t.materialBasis === 'net' ? net(key) : (gross(key) ?? net(key));
        m.matTotal = price(key, 'mat') * basis;
        return m.matTotal;
    };

    const labTotal = (key: BoqLineKey): number => {
        const m = slot(key);
        if (m.labTotal !== undefined) return m.labTotal;
        const t = get(key);
        const basis = t.labourBasis === 'gross' ? (gross(key) ?? net(key)) : net(key);
        m.labTotal = price(key, 'lab') * basis;
        return m.labTotal;
    };

    let constructionTotal = 0;
    let preConstructionTotal = 0;

    const sectionResults = sections.map(s => {
        let mat = 0, lab = 0;
        const rows: BoqRow[] = s.lines.map(l => {
            if (l.type === 'heading') {
                return { type: 'heading', key: l.key, excelRow: l.excelRow, itemNo: l.itemNo, desc: l.desc };
            }
            const ov = overrides[l.key];
            const j = matTotal(l.key);
            const k = labTotal(l.key);
            mat += j; lab += k;
            return {
                type: 'item',
                key: l.key,
                excelRow: l.excelRow,
                itemNo: l.itemNo,
                desc: ov?.desc ?? linked[l.key]?.desc ?? l.desc,
                unit: linked[l.key]?.unit ?? l.unit,
                note: ov?.note ?? linked[l.key]?.note ?? l.note,
                qty: net(l.key),
                qtySource: l.qty.kind,
                waste: waste(l.key),
                grossQty: gross(l.key),
                matUnit: price(l.key, 'mat'),
                matTotal: j,
                labUnit: price(l.key, 'lab'),
                labTotal: k,
                total: j + k,
                materialBasis: l.materialBasis,
                labourBasis: l.labourBasis,
                editable: { qty: l.qty.kind === 'input' || l.qty.kind === 'calc' },
                fromCalc: {
                    qty: ov?.qty === undefined && linked[l.key]?.qty !== undefined,
                    mat: ov?.mat === undefined && linked[l.key]?.mat !== undefined,
                    lab: ov?.lab === undefined && linked[l.key]?.lab !== undefined,
                },
            };
        });
        const total = mat + lab;
        if (s.inConstructionTotal) constructionTotal += total;
        else preConstructionTotal += total;
        return {
            no: s.no, title: s.title, calculators: s.calculators,
            inConstructionTotal: s.inConstructionTotal,
            rows, matTotal: mat, labTotal: lab, total,
        };
    });

    return { sections: sectionResults, constructionTotal, preConstructionTotal };
}
