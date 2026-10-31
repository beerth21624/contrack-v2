import { describe, expect, it } from 'vitest';
import { PROJECT_TYPES, PROJECT_TYPE_DEFAULTS, defaultProjectTypeFor, resolveSettings } from '../profiles';

describe('profiles', () => {
    it('every milestone template adds up to 100% (or is empty)', () => {
        for (const type of PROJECT_TYPES) {
            const t = PROJECT_TYPE_DEFAULTS[type].milestoneTemplate;
            if (t.length > 0) expect(t.reduce((s, m) => s + m.pct, 0)).toBeCloseTo(1, 9);
        }
    });

    it('resolves project > company > built-in', () => {
        const gov = resolveSettings('government', {}, {});
        expect(gov).toMatchObject({ retentionPct: 0.05, customerWhtRate: 0.01, quotationFormat: 'government', billingMode: 'milestone' });
        expect(resolveSettings('government', { government: { retentionPct: 0.1 } }, {}).retentionPct).toBe(0.1);
        expect(resolveSettings('government', { government: { retentionPct: 0.1 } }, { retentionPct: 0 }).retentionPct).toBe(0);
    });

    it('picks a start type from the business profiles', () => {
        expect(defaultProjectTypeFor([])).toBe('residential_new');
        expect(defaultProjectTypeFor(['commercial', 'government'])).toBe('government');
    });
});
