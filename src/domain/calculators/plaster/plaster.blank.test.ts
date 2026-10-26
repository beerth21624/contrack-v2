import { describe, expect, it } from 'vitest';
import { plaster, STRUCTURAL_WALL, STRUCTURAL_WALL_DEFAULT_AREA } from '.';
import { brick } from '../brick';
import { doorWindow } from '../door-window';
import { computeProject, createProject } from '../../project';
import type { CalcContext } from '../types';

const none: CalcContext = { outputs: () => undefined };
const blankInput = () => plaster.blank?.() ?? plaster.defaults();

describe('ฉาบปูน blank project', () => {
    it('keeps the plaster rules of the sheet; only the typed structure-wall area is empty', () => {
        const sample = plaster.defaults();
        const blank = blankInput();
        expect(blank.rows).toHaveLength(sample.rows.length);
        blank.rows.forEach((r, i) => {
            const s = sample.rows[i];
            expect(r.wallPart).toBe(s?.wallPart);
            expect(r.kind).toBe(s?.kind);
            expect(r.sides).toBe(s?.sides);
            expect(r.manualArea ?? 0).toBe(r.wallPart === STRUCTURAL_WALL ? 0 : (s?.manualArea ?? 0));
        });
        expect(sample.rows.find(r => r.wallPart === STRUCTURAL_WALL)?.manualArea).toBe(STRUCTURAL_WALL_DEFAULT_AREA);
    });

    it('no brick walls → exterior / interior (paint) and BOQ 189 / 190 are finite 0', () => {
        const brickBlank = brick.compute(brick.blank?.() ?? brick.defaults(), none);
        for (const ctx of [none, { outputs: (id: string) => (id === 'brick' ? brickBlank : undefined) }]) {
            const out = plaster.compute(blankInput(), ctx);
            expect(out).toEqual({ exterior: 0, interior: 0, total: 0, R189: 0, R190: 0 });
        }
    });

    it('in a blank project plaster follows brick: 0 with no walls, the wall area once a wall is typed', () => {
        const project = createProject('blank');
        const calcs = [doorWindow, brick, plaster];
        expect(computeProject(project, calcs).calcOutputs.plaster?.total).toBe(0);
        project.calculators.brick = {
            walls: [{ wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 10, height: 3 }],
        };
        const out = computeProject(project, calcs).calcOutputs.plaster;
        expect(out?.exterior).toBeCloseTo(30, 9);   // ผนังรอบบ้าน ฉาบภายนอก 1 ด้าน
        expect(out?.interior).toBeCloseTo(30, 9);   // ผนังรอบบ้าน ฉาบภายใน 1 ด้าน
    });
});
