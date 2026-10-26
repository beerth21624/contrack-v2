import { describe, expect, it } from 'vitest';
import { misc } from '.';
import { computeProject, createProject } from '../../project';

describe('misc — blank project', () => {
    it('starts with an empty list: compute is finite and 0, no BOQ rows', () => {
        const blank = misc.blank?.();
        expect(blank).toEqual({ items: [] });
        const input = blank ?? { items: [] };
        const ctx = { outputs: () => undefined };
        expect(misc.compute(input, ctx)).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(misc.boqSlots?.(input, ctx)).toEqual({ items: [] });
        const res = computeProject(createProject('blank'), [misc]);
        const rows = res.boq.sections.find(x => x.no === 28)?.rows ?? [];
        expect(rows.filter(r => r.key.startsWith('misc:'))).toEqual([]);
    });
});