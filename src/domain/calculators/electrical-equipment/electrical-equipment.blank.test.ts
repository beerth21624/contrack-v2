import { describe, expect, it } from 'vitest';
import { electricalEquipment } from '.';
import { computeProject, createProject } from '../../project';

describe('electrical-equipment — blank project', () => {
    it('starts with an empty list: compute is finite and 0, no BOQ rows', () => {
        const blank = electricalEquipment.blank?.();
        expect(blank).toEqual({ items: [] });
        const input = blank ?? { items: [] };
        const ctx = { outputs: () => undefined };
        expect(electricalEquipment.compute(input, ctx)).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(electricalEquipment.boqSlots?.(input, ctx)).toEqual({ items: [] });
        const res = computeProject(createProject('blank'), [electricalEquipment]);
        const rows = res.boq.sections.find(x => x.no === 26)?.rows ?? [];
        expect(rows.filter(r => r.key.startsWith('electrical-equipment:'))).toEqual([]);
    });
});