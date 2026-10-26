import { describe, expect, it } from 'vitest';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import { ALUMINIUM, doorWindow, slotRows, WOOD } from '.';

const ctx = { outputs: () => undefined };

describe('ประตู-หน้าต่าง blank project', () => {
    it('starts with an empty schedule; defaults() is still the Excel sample', () => {
        expect(doorWindow.blank?.()).toEqual({ doors: [], windows: [] });
        expect(doorWindow.defaults().doors).toHaveLength(9);
        expect(doorWindow.defaults().windows).toHaveLength(4);
    });

    it('computes finite zeros: every opening group, R191 and both BOQ slots empty', () => {
        const input = doorWindow.blank?.() ?? doorWindow.defaults();
        const out = doorWindow.compute(input, ctx);
        for (const [k, v] of Object.entries(out)) {
            expect(Number.isFinite(v), k).toBe(true);
            expect(v, k).toBe(0);
        }
        expect(Object.keys(out).filter(k => k.startsWith('opening|')).length).toBeGreaterThan(0);
        expect(slotRows(input, ALUMINIUM)).toEqual([]);
        expect(slotRows(input, WOOD)).toEqual([]);
    });

    it('a blank project puts no door / window rows into BOQ 24 and 30, and 0 frames into R191', () => {
        const res = computeProject(createProject('blank'), [doorWindow]);
        for (const no of [24, 30]) {
            const items = (res.boq.sections.find(s => s.no === no)?.rows ?? [])
                .filter((r): r is BoqItemRow => r.type === 'item' && r.key.startsWith('door-window:'));
            expect(items, `section ${no}`).toEqual([]);
        }
        const r191 = res.boq.sections.flatMap(s => s.rows).find(r => r.key === 'R191') as BoqItemRow | undefined;
        expect(r191?.qty).toBe(0);
    });
});
