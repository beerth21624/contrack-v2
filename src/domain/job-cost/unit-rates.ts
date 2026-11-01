// ─── Unit rate history: the latest actual unit rates per BOQ line key (docs/erp/02-domain-model.md §11, WP-55) ───
// Pure. Per line key: the plain mean of the rates of the `perKey` most recent projects (by observed date; one
// observation per project, the latest), material and labour separately.
import { round2 } from '../money';

export interface UnitRateObservationRow {
    projectId: string;
    lineKey: string;
    descTh: string;
    unit: string;
    qty: number;
    actualMatUnit: number;
    actualLabUnit: number;
    observedDate: string;
}

export interface UnitRateAverage {
    lineKey: string;
    descTh: string;
    unit: string;
    matUnit: number;
    labUnit: number;
    projectCount: number;
    lastObservedDate: string;
}

export const UNIT_RATE_PROJECTS = 3;

export function averageUnitRates(rows: readonly UnitRateObservationRow[], perKey = UNIT_RATE_PROJECTS): UnitRateAverage[] {
    const byKey = new Map<string, UnitRateObservationRow[]>();
    for (const r of rows) byKey.set(r.lineKey, [...(byKey.get(r.lineKey) ?? []), r]);
    const out: UnitRateAverage[] = [];
    for (const [lineKey, list] of byKey) {
        const sorted = [...list].sort((a, b) => b.observedDate.localeCompare(a.observedDate));
        const seen = new Set<string>();
        const picked: UnitRateObservationRow[] = [];
        for (const r of sorted) {
            if (seen.has(r.projectId)) continue;
            seen.add(r.projectId);
            picked.push(r);
            if (picked.length >= perKey) break;
        }
        const first = picked[0];
        if (first === undefined) continue;
        const mean = (f: (r: UnitRateObservationRow) => number): number => round2(picked.reduce((s, r) => s + f(r), 0) / picked.length);
        out.push({
            lineKey, descTh: first.descTh, unit: first.unit, matUnit: mean(r => r.actualMatUnit), labUnit: mean(r => r.actualLabUnit),
            projectCount: picked.length, lastObservedDate: first.observedDate,
        });
    }
    return out.sort((a, b) => a.lineKey.localeCompare(b.lineKey));
}
