import { describe, expect, it } from 'vitest';
import { ceiling } from '@/domain/calculators/ceiling';
import { floorTile, floorTileRowArea } from '@/domain/calculators/floor-tile';
import { roomsFromCeiling } from '../fromCeiling';

describe('roomsFromCeiling', () => {
    it('copies the sample ceiling rooms without eaves and bathrooms', () => {
        const res = roomsFromCeiling(ceiling.defaults().rows, []);
        expect(res.skippedEaves).toBe(1);
        expect(res.skippedBathrooms).toBe(2);
        expect(res.skippedExisting).toBe(0);
        expect(res.rows).toHaveLength(14);
        // Plain gypsum rooms → granito; veranda (C2, C4) → non-slip granito, like the floor sample.
        expect(res.rows.filter(r => r.code === 'F1').map(r => r.location)).toEqual([
            'ทานอาหาร', 'ครัว', 'รับแขก', 'โถงทางเดิน (1)', 'โถงทางเดิน (2)', 'ห้องนอน 1 (1)', 'ห้องนอน 1 (2)', 'ห้องนอน 2', 'ห้องนอน 3',
        ]);
        expect(res.rows.filter(r => r.code === 'F3')).toHaveLength(5);
        // Sizes are the plan sizes (no slope factor): same F1 area as the floor sample.
        const f1 = (rows: { code: string; width: number; length: number; location: string }[]) =>
            rows.filter(r => r.code === 'F1').reduce((s, r) => s + floorTileRowArea({ ...r, code: 'F1' }), 0);
        expect(f1(res.rows)).toBeCloseTo(f1(floorTile.defaults().rows), 9);
    });

    it('skips rooms the floor list already has and empty rows', () => {
        const res = roomsFromCeiling(
            [
                { code: 'C1', width: 3, length: 4, location: 'ห้องนอน 1', paint: 'ภายใน' },
                { code: 'C1', width: 3, length: 3, location: 'ครัว', paint: 'ภายใน' },
                { code: '', width: 0, length: 0, location: '', paint: '' },
                { code: '', width: 2, length: 2, location: '', paint: '' },
            ],
            [{ code: 'F1', width: 3, length: 4, location: ' ห้องนอน 1 ' }],
        );
        expect(res.skippedExisting).toBe(1);
        expect(res.rows).toEqual([
            { code: 'F1', width: 3, length: 3, location: 'ครัว' },
            { code: 'F1', width: 2, length: 2, location: '' },
        ]);
    });
});
