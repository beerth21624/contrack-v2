// ─── Money a level puts into the BOQ ───
import type { BoqItemRow } from '../boq/types';
import type { ProjectResult } from '../project';
import { getCalculator } from '../calculators/registry';
import type { JourneyLevel } from './levels';

/**
 * BOQ (Home) rows a level fills: for a calculator, the lines it links plus its slot rows; for a BOQ level,
 * every item row of its sections.
 */
export function levelRows(level: JourneyLevel, result: ProjectResult): BoqItemRow[] {
    const sections = result.boq.sections.filter(s => level.sections.includes(s.no));
    const items = sections.flatMap(s => s.rows.filter((r): r is BoqItemRow => r.type === 'item'));
    if (level.kind.type === 'boq') return items;
    if (level.kind.type === 'meta') return [];
    const def = getCalculator(level.kind.calc);
    if (!def) return [];
    const linked = new Set(def.boqLinks.map(l => l.line));
    const prefix = `${def.id}:`;
    return items.filter(r => linked.has(r.key) || r.key.startsWith(prefix));
}

export function levelTotal(level: JourneyLevel, result: ProjectResult): number {
    return levelRows(level, result).reduce((sum, r) => sum + r.total, 0);
}
