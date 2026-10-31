// ─── Module registry: kind, dependencies, entitlement and trial of every ModuleId (docs/erp/01-architecture.md §4.2) ───
// Used by the backend (switch rules, `active`) and the web app (module page, menus). Adding a ModuleId to MODULE_IDS
// without an entry here fails the typecheck (Record<ModuleId, ModuleDef>).
import { MODULE_IDS, type ModuleId } from './modules';

export interface ModuleDef {
    id: ModuleId;
    /** `legacy` = release-1 modules (behave as before entitlements existed); `erp` = ERP modules. */
    kind: 'legacy' | 'erp';
    /** Must be active before this one can be switched on (direct dependencies only, not transitive). */
    dependsOn: readonly ModuleId[];
    /** `none` = no entitlement needed (legacy modules). */
    entitlement: 'none' | 'required';
    /** Length of a self-started trial; 0 = no trial. */
    trialDays: number;
}

const legacy = (id: ModuleId): ModuleDef => ({ id, kind: 'legacy', dependsOn: [], entitlement: 'none', trialDays: 0 });
const erp = (id: ModuleId, dependsOn: readonly ModuleId[]): ModuleDef => ({ id, kind: 'erp', dependsOn, entitlement: 'required', trialDays: 30 });

export const MODULE_REGISTRY: Readonly<Record<ModuleId, ModuleDef>> = {
    subcontracting: legacy('subcontracting'),
    materials: legacy('materials'),
    'owner-leads': legacy('owner-leads'),
    'ai-assist': legacy('ai-assist'),
    workforce: legacy('workforce'),
    'project-hub': erp('project-hub', []),
    portal: erp('portal', ['project-hub']),
    'boq-control': erp('boq-control', ['project-hub']),
    // Built from boq_version_lines, which exist only while boq-control is active (D-51).
    quotations: erp('quotations', ['boq-control']),
    contracts: erp('contracts', ['boq-control']),
    billing: erp('billing', ['contracts']),
    variations: erp('variations', ['contracts']),
    procurement: erp('procurement', ['boq-control']),
    'site-diary': erp('site-diary', ['boq-control']),
    labour: erp('labour', ['site-diary', 'workforce']),
    'job-cost': erp('job-cost', ['boq-control']),
    payables: erp('payables', ['project-hub']),
    handover: erp('handover', ['contracts']),
};

/**
 * Every module `id` depends on, transitively, without `id` itself; roots first: a depth-first walk of `dependsOn` in
 * its declared order that lists each module after its own dependencies (and once).
 * `dependencyClosure('labour')` = project-hub, boq-control, site-diary, workforce.
 */
export function dependencyClosure(id: ModuleId): ModuleId[] {
    const out: ModuleId[] = [];
    const visit = (m: ModuleId, path: ReadonlySet<ModuleId>): void => {
        for (const d of MODULE_REGISTRY[m].dependsOn) {
            if (path.has(d)) throw new Error(`Module dependency cycle at ${d}`);
            if (out.includes(d)) continue;
            visit(d, new Set(path).add(d));
            out.push(d);
        }
    };
    visit(id, new Set([id]));
    return out;
}

/** Every module that depends on `id`, transitively, without `id` itself; in MODULE_IDS order. */
export function dependentsOf(id: ModuleId): ModuleId[] {
    return MODULE_IDS.filter(m => m !== id && dependencyClosure(m).includes(id));
}
