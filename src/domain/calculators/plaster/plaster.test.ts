import { describe, expect, it } from 'vitest';
import { plaster, plasterRowArea, STRUCTURAL_WALL, type PlasterInput } from '.';
import { brick, type BrickInput } from '../brick';
import { doorWindow } from '../door-window';
import type { CalcContext } from '../types';
import golden from '../../boq/__tests__/golden.v5.json';

const none: CalcContext = { outputs: () => undefined };
const dwOut = doorWindow.compute(doorWindow.defaults(), none);

/** ctx with the brick outputs of `b` (openings from the Excel sample door/window schedule). */
function ctxFor(b: BrickInput = brick.defaults()): CalcContext {
    const brickOut = brick.compute(b, { outputs: id => (id === 'door-window' ? dwOut : undefined) });
    return { outputs: id => (id === 'brick' ? brickOut : undefined) };
}

describe('ฉาบปูน_Plaster (sheet 14)', () => {
    it('Excel sample: E5…E11', () => {
        const ctx = ctxFor();
        const areas = plaster.defaults().rows.map(r => plasterRowArea(r, ctx));
        const expected = [114.1325, 114.1325, 171.7, 17.5, 28.95, 28.95, 31.24];
        expect(areas).toHaveLength(expected.length);
        expected.forEach((e, i) => expect(areas[i]).toBeCloseTo(e, 9));
    });

    it('outputs E189 / E190 = golden BOQ; exterior / interior for the paint sheet', () => {
        const out = plaster.compute(plaster.defaults(), ctxFor());
        expect(out.R189).toBeCloseTo(golden.lines.R189.E, 9);
        expect(out.R190).toBeCloseTo(golden.lines.R190.E, 9);
        expect(out.exterior).toBe(out.R189);
        expect(out.interior).toBe(out.R190);
        expect(out.total).toBeCloseTo(506.605, 9);
    });

    it('a wall part sums every brick row of that part × faces (brick type / thickness ignored)', () => {
        const b = brick.defaults();
        b.walls.push({ wallPart: 'ผนังภายในบ้าน', brickType: 'อิฐมวลเบา', thickness: 'เต็มแผ่น', length: 4, height: 3 });
        const out = plaster.compute(plaster.defaults(), ctxFor(b));
        expect(out.R190).toBeCloseTo(314.7825 + 2 * 12, 9);   // row 7: ผนังภายในบ้าน × 2 faces
        expect(out.R189).toBeCloseTo(191.8225, 9);
    });

    it('the structure row uses its typed area per side; added rows compute; blank rows are 0', () => {
        const input = plaster.defaults();
        input.rows = input.rows.map(r => (r.wallPart === STRUCTURAL_WALL ? { ...r, manualArea: 40, sides: 2 } : r));
        input.rows.push({ wallPart: 'ผนังภายนอกบ้าน', kind: 'ฉาบภายใน', sides: 1 });
        input.rows.push({ wallPart: '', kind: 'ฉาบภายใน', sides: 2 });
        input.rows.push({ wallPart: STRUCTURAL_WALL, kind: '', sides: 1, manualArea: 10 });
        const out = plaster.compute(input, ctxFor());
        expect(out.R189).toBeCloseTo(191.8225 - 31.24 + 80, 9);
        expect(out.R190).toBeCloseTo(314.7825 + 8.75, 9);
    });

    it('the Excel trailing-space value "ฉาบภายใน " still counts as inside plaster', () => {
        const input: PlasterInput = { rows: [{ wallPart: 'ผนังรอบบ้าน', kind: 'ฉาบภายใน ', sides: 1 }] };
        expect(plaster.compute(input, ctxFor()).R190).toBeCloseTo(114.1325, 9);
    });
});
