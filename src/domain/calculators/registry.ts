// All calculator sheets. Add a calculator here once its domain module exists.
import type { CalculatorDef } from './types';
import { landInspection } from './land-inspection';
import { demolition } from './demolition';
import { fill } from './fill';
import { tempUtilities } from './temp-utilities';
import { siteCamp } from './site-camp';
import { layout } from './layout';
import { piles } from './piles';

export const CALCULATORS: CalculatorDef[] = [
    landInspection,
    demolition,
    fill,
    tempUtilities,
    siteCamp,
    layout,
    piles,
];

export function getCalculator(id: string): CalculatorDef | undefined {
    return CALCULATORS.find(c => c.id === id);
}

/** Calculators in dependency order (a calculator comes after everything in its `deps`). */
export function calculatorsInOrder(list: CalculatorDef[] = CALCULATORS): CalculatorDef[] {
    const byId = new Map(list.map(c => [c.id, c]));
    const done = new Set<string>();
    const visiting = new Set<string>();
    const out: CalculatorDef[] = [];
    const visit = (c: CalculatorDef) => {
        if (done.has(c.id)) return;
        if (visiting.has(c.id)) throw new Error(`Circular calculator dependency at ${c.id}`);
        visiting.add(c.id);
        for (const d of c.deps) {
            const dep = byId.get(d);
            if (dep) visit(dep);
        }
        visiting.delete(c.id);
        done.add(c.id);
        out.push(c);
    };
    list.forEach(visit);
    return out;
}
