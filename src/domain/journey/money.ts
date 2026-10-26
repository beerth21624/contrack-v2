// ─── Money a level puts into the BOQ ───
import type { BoqItemRow, BoqItemTemplate, BoqLineKey } from '../boq/types';
import { BOQ_TEMPLATE_V5 } from '../boq/template.v5';
import type { ProjectResult } from '../project';
import { getCalculator } from '../calculators/registry';
import type { JourneyLevel } from './levels';

const TEMPLATE_ITEMS = new Map<BoqLineKey, BoqItemTemplate>(
    BOQ_TEMPLATE_V5.flatMap(s => s.lines.flatMap(l => (l.type === 'item' ? [[l.key, l] as const] : []))),
);

/** Lines a template row is computed from (qty, gross and price rules), apart from consumables. */
function plainRefs(t: BoqItemTemplate): BoqLineKey[] {
    const refs: BoqLineKey[] = [];
    if (t.qty.kind === 'line') refs.push(t.qty.ref);
    if (t.qty.kind === 'sumLines') refs.push(...t.qty.refs);
    if (typeof t.gross === 'object') refs.push(...t.gross.refs);
    for (const p of [t.mat, t.lab]) if (typeof p === 'object' && p.kind === 'linePrice') refs.push(p.ref);
    return refs;
}

function consumableRefs(t: BoqItemTemplate): BoqLineKey[] {
    return [t.mat, t.lab].flatMap(p => (typeof p === 'object' && p.kind === 'consumables' ? p.refs : []));
}

/**
 * BOQ (Home) rows a level fills: for a calculator, the lines it links plus its slot rows, plus rows computed
 * only from those (e.g. fittings 50 % of the pipe, tie wire); for a BOQ level, every item row of its sections.
 */
export function levelRows(level: JourneyLevel, result: ProjectResult): BoqItemRow[] {
    const itemsOf = (all: boolean) => result.boq.sections.filter(s => all || level.sections.includes(s.no))
        .flatMap(s => s.rows.filter((r): r is BoqItemRow => r.type === 'item'));
    if (level.kind.type === 'boq') return itemsOf(false);
    if (level.kind.type === 'meta') return [];
    // A calculator's rows can sit outside its own sections (column rebar goes into section 6), so look everywhere.
    const items = itemsOf(true);
    const def = getCalculator(level.kind.calc);
    if (!def) return [];
    const own = new Set(def.boqLinks.map(l => l.line));
    const prefix = `${def.id}:`;
    for (const r of items) if (r.key.startsWith(prefix)) own.add(r.key);
    // Rows whose every source line belongs to the level belong to it too (repeat until nothing changes).
    for (let changed = true; changed;) {
        changed = false;
        for (const r of items) {
            const t = TEMPLATE_ITEMS.get(r.key);
            if (!t || own.has(r.key) || consumableRefs(t).length > 0) continue;
            const refs = plainRefs(t);
            if (refs.length > 0 && refs.every(k => own.has(k))) { own.add(r.key); changed = true; }
        }
    }
    return items.filter(r => own.has(r.key));
}

/**
 * The level's money: its rows, plus its share of consumables rows ("วัสดุสิ้นเปลือง x %") in proportion to the
 * level's part of the lines they are taken from.
 */
export function levelTotal(level: JourneyLevel, result: ProjectResult): number {
    const rows = levelRows(level, result);
    const own = new Map(rows.map(r => [r.key, r]));
    let total = rows.reduce((sum, r) => sum + r.total, 0);
    if (level.kind.type !== 'calc') return total;
    const items = new Map(result.boq.sections.flatMap(s => s.rows.flatMap(r => (r.type === 'item' ? [[r.key, r] as const] : []))));
    for (const r of items.values()) {
        const t = TEMPLATE_ITEMS.get(r.key);
        if (!t || own.has(r.key)) continue;
        const refs = consumableRefs(t);
        if (refs.length === 0) continue;
        const base = (k: BoqLineKey) => { const x = items.get(k); return x ? x.matTotal + x.labTotal : 0; };
        const all = refs.reduce((s, k) => s + base(k), 0);
        const mine = refs.filter(k => own.has(k)).reduce((s, k) => s + base(k), 0);
        if (all > 0) total += r.total * (mine / all);
    }
    return total;
}
