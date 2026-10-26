import { describe, expect, it } from 'vitest';
import { brick, BRICK_BOQ_ROWS, netByPartKey, WALL_PARTS } from '.';
import { doorWindow } from '../door-window';
import type { CalcContext } from '../types';

const none: CalcContext = { outputs: () => undefined };
const blankInput = () => brick.blank?.() ?? brick.defaults();
const withDoorWindow = (dw: Record<string, number>): CalcContext => ({ outputs: id => (id === 'door-window' ? dw : undefined) });

describe('ก่ออิฐ blank project', () => {
    it('starts with no walls; defaults() is still the Excel sample', () => {
        expect(brick.blank?.()).toEqual({ walls: [] });
        expect(brick.defaults().walls).toHaveLength(6);
    });

    it('no walls and no openings: every output is a finite 0 (BOQ 179–182 and the plaster sums)', () => {
        const dwBlank = doorWindow.compute(doorWindow.blank?.() ?? doorWindow.defaults(), none);
        for (const ctx of [none, withDoorWindow(dwBlank)]) {
            const out = brick.compute(blankInput(), ctx);
            for (const [k, v] of Object.entries(out)) {
                expect(Number.isFinite(v), k).toBe(true);
                expect(v, k).toBe(0);
            }
            for (const b of BRICK_BOQ_ROWS) expect(out[b.line]).toBe(0);
        }
    });

    it('openings typed before any wall are reported as not deducted, and nothing goes negative', () => {
        const dw = doorWindow.compute(doorWindow.defaults(), none);
        const out = brick.compute(blankInput(), withDoorWindow(dw));
        expect(out.unmatchedOpenings).toBeCloseTo(34.6175 + 7.6, 9);
        expect(out.openings).toBe(0);
        for (const b of BRICK_BOQ_ROWS) expect(out[b.line]).toBe(0);
        for (const w of WALL_PARTS) expect(out[netByPartKey(w)] ?? 0).toBe(0);
    });
});
