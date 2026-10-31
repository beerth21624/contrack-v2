import { describe, expect, it } from 'vitest';
import { businessDateSchema } from '../erp/common';
import { MODULE_REGISTRY, dependencyClosure, dependentsOf } from '../module-registry';
import { MODULE_IDS } from '../modules';

describe('MODULE_REGISTRY', () => {
    it('has every ModuleId, keyed by its own id; legacy modules need no entitlement and have no trial', () => {
        expect(Object.keys(MODULE_REGISTRY).sort()).toEqual([...MODULE_IDS].sort());
        for (const id of MODULE_IDS) expect(MODULE_REGISTRY[id].id).toBe(id);
        for (const id of ['subcontracting', 'materials', 'owner-leads', 'ai-assist', 'workforce'] as const) {
            expect(MODULE_REGISTRY[id]).toMatchObject({ kind: 'legacy', entitlement: 'none', trialDays: 0, dependsOn: [] });
        }
    });

    it('dependencyClosure lists roots first (and never the module itself)', () => {
        expect(dependencyClosure('labour')).toEqual(['project-hub', 'boq-control', 'site-diary', 'workforce']);
        expect(dependencyClosure('billing')).toEqual(['project-hub', 'boq-control', 'contracts']);
        expect(dependencyClosure('project-hub')).toEqual([]);
        for (const id of MODULE_IDS) {
            const closure = dependencyClosure(id);
            expect(closure).not.toContain(id);
            closure.forEach((m, i) => expect(dependencyClosure(m).every(d => closure.indexOf(d) < i)).toBe(true));
        }
    });

    it('dependentsOf is the inverse, in MODULE_IDS order', () => {
        expect(dependentsOf('contracts')).toEqual(['billing', 'variations', 'handover']);
        expect(dependentsOf('workforce')).toEqual(['labour']);
        expect(dependentsOf('project-hub')).toEqual(MODULE_IDS.filter(m => MODULE_REGISTRY[m].kind === 'erp' && m !== 'project-hub'));
    });
});

describe('businessDateSchema', () => {
    it('accepts real calendar days only', () => {
        expect(businessDateSchema.safeParse('2028-02-29').success).toBe(true);
        expect(businessDateSchema.safeParse('2026-02-29').success).toBe(false);
        expect(businessDateSchema.safeParse('2026-04-31').success).toBe(false);
        expect(businessDateSchema.safeParse('2026-4-01').success).toBe(false);
    });
});
