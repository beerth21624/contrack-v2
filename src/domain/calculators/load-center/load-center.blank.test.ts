import { describe, expect, it } from 'vitest';
import { loadCenter } from '.';
import { computeProject, createProject } from '../../project';

describe('load-center — blank project', () => {
    it('starts with an empty list: compute is finite and 0, no BOQ rows', () => {
        const blank = loadCenter.blank?.();
        expect(blank).toEqual({ items: [] });
        const input = blank ?? { items: [] };
        const ctx = { outputs: () => undefined };
        expect(loadCenter.compute(input, ctx)).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(loadCenter.boqSlots?.(input, ctx)).toEqual({ items: [] });
        const res = computeProject(createProject('blank'), [loadCenter]);
        const rows = res.boq.sections.find(x => x.no === 26)?.rows ?? [];
        expect(rows.filter(r => r.key.startsWith('load-center:'))).toEqual([]);
    });
});