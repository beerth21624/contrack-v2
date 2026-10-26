import { describe, expect, it } from 'vitest';
import { floorTile, floorTileRowArea, STAIR_RUN } from '.';
import golden from '../../boq/__tests__/golden.v5.json';

const ctx = { outputs: () => undefined };

describe('ปูกระเบื้องพื้น_Floor Tile (sheet 16)', () => {
    it('Excel sample: F5…F25', () => {
        const areas = floorTile.defaults().rows.map(floorTileRowArea);
        const expected = [
            9, 9, 15, 2.4, 1.8, 12.25, 1.8, 12, 9,
            3.5, 4, 3, 1, 14, 4.5,
            4.455, 2.7, 3.915,          // บันได: D × (0.9+0.45)
            1, 14, 4.5,
        ];
        expect(areas).toHaveLength(expected.length);
        areas.forEach((a, i) => expect(a).toBeCloseTo(expected[i] ?? NaN, 9));
        expect(STAIR_RUN).toBeCloseTo(1.35, 12);
    });

    it('outputs E205–E207 = golden BOQ', () => {
        const out = floorTile.compute(floorTile.defaults(), ctx);
        expect(out.R205).toBeCloseTo(golden.lines.R205.E, 9);
        expect(out.R206).toBeCloseTo(golden.lines.R206.E, 9);
        expect(out.R207).toBeCloseTo(golden.lines.R207.E, 9);
        expect(out.total).toBeCloseTo(72.25 + 41.07 + 19.5, 9);
    });

    it('added rows count by code; uncoded rows feed nothing; editing a length recomputes', () => {
        const input = floorTile.defaults();
        input.rows.push({ code: 'F4', width: 2, length: 2.5, location: 'ดาดฟ้า ค.ส.ล. (4)' });
        input.rows.push({ code: '', width: 3, length: 3, location: '' });
        input.rows = input.rows.map((r, i) => (i === 15 ? { ...r, length: 1.5 } : r));   // บันได (1): 3.3 × 1.5 = 4.95 (was 4.455)
        const out = floorTile.compute(input, ctx);
        expect(out.R205).toBeCloseTo(72.25, 9);
        expect(out.R206).toBeCloseTo(41.07 - 4.455 + 4.95, 9);
        expect(out.R207).toBeCloseTo(19.5 + 5, 9);
        expect(out.total).toBeCloseTo(72.25 + 41.07 - 4.455 + 4.95 + 19.5 + 5 + 9, 9);
    });
});
