import { describe, expect, it } from 'vitest';
import { getCalculator } from '../../calculators/registry';
import { JOURNEY, JOURNEY_LEVELS, getLevel, phaseOf } from '../levels';

/** The 37 levels in the order a contractor fills them in (docs/rebuild/JOURNEY_UX.md). */
const ORDER = [
    // เตรียมงาน
    'project-info', 'land-inspection', 'demolition', 'fill', 'temp-utilities', 'site-camp', 'layout',
    // ฐานราก
    'piles', 'footing', 'pedestal', 'ground-beam',
    // พื้น เสา คาน
    'slab-on-grade', 'precast-slab', 'column', 'roof-beam', 'roof-slab', 'stair', 'column-plates',
    // หลังคา
    'roofing', 'roof-structure',
    // ผนัง ประตู หน้าต่าง
    'door-window', 'brick', 'plaster',
    // งานระบบ
    'electrical-pipe', 'electrical-cable', 'load-center', 'electrical-equipment', 'waste-pipe', 'water-pipe', 'sanitary-system', 'sanitary-ware',
    // งานตกแต่ง
    'ceiling', 'floor-tile', 'toilet-tile', 'wall-finishing', 'paint', 'misc',
];

const PHASES: [string, string, number][] = [
    ['prepare', 'เตรียมงาน', 7],
    ['foundation', 'ฐานราก', 4],
    ['structure', 'พื้น เสา คาน', 7],
    ['roof', 'หลังคา', 2],
    ['walls', 'ผนัง ประตู หน้าต่าง', 3],
    ['systems', 'งานระบบไฟฟ้า-ประปา', 8],
    ['finishes', 'งานตกแต่ง', 6],
];

const OPTIONAL = ['demolition', 'fill', 'piles', 'precast-slab', 'roof-slab', 'stair', 'wall-finishing'];

describe('journey levels — order and ids', () => {
    it('has exactly 37 levels in the documented order', () => {
        expect(ORDER).toHaveLength(37);
        expect(JOURNEY_LEVELS.map(l => l.id)).toEqual(ORDER);
    });

    it('flat list equals the phases concatenated', () => {
        expect(JOURNEY_LEVELS).toEqual(JOURNEY.flatMap(p => p.levels));
    });

    it('ids are unique, non-empty, kebab-case', () => {
        const ids = JOURNEY_LEVELS.map(l => l.id);
        expect(new Set(ids).size).toBe(37);
        for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    });

    it('titles are unique non-empty Thai text, every level has a plan hint', () => {
        const titles = JOURNEY_LEVELS.map(l => l.title);
        expect(new Set(titles).size).toBe(37);
        for (const l of JOURNEY_LEVELS) {
            expect(l.title.trim(), l.id).not.toBe('');
            expect(l.planHint.trim().length, l.id).toBeGreaterThan(10);
        }
    });

    it('7 phases with the documented ids, titles and sizes', () => {
        expect(JOURNEY.map(p => [p.id, p.title, p.levels.length])).toEqual(PHASES);
    });

    it('every phase is non-empty and phase ids are unique', () => {
        expect(new Set(JOURNEY.map(p => p.id)).size).toBe(JOURNEY.length);
        for (const p of JOURNEY) expect(p.levels.length, p.id).toBeGreaterThan(0);
    });

    it('the first level is the project info, the last is misc', () => {
        expect(JOURNEY_LEVELS[0]?.id).toBe('project-info');
        expect(JOURNEY_LEVELS[36]?.id).toBe('misc');
    });

    it('paint comes after every level whose area it reads (plaster, ceiling, wall-finishing)', () => {
        const at = (id: string) => ORDER.indexOf(id);
        for (const before of ['plaster', 'ceiling', 'wall-finishing', 'door-window', 'brick']) {
            expect(at(before), before).toBeLessThan(at('paint'));
        }
        expect(at('door-window')).toBeLessThan(at('brick'));
        expect(at('roofing')).toBeLessThan(at('roof-structure'));
        expect(at('electrical-pipe')).toBeLessThan(at('electrical-cable'));
    });
});

describe('journey levels — lookups', () => {
    it('getLevel finds each level by id and returns undefined for unknown / empty / wrong case', () => {
        for (const id of ORDER) expect(getLevel(id)?.id).toBe(id);
        expect(getLevel('nope')).toBeUndefined();
        expect(getLevel('')).toBeUndefined();
        expect(getLevel('Footing')).toBeUndefined();
        expect(getLevel(' footing')).toBeUndefined();
    });

    it('phaseOf places each level in the phase that lists it', () => {
        let i = 0;
        for (const [id, , n] of PHASES) {
            for (let k = 0; k < n; k++) expect(phaseOf(ORDER[i + k] ?? '')?.id, ORDER[i + k]).toBe(id);
            i += n;
        }
        expect(phaseOf('nope')).toBeUndefined();
    });

    it('the footing level is in the foundation phase, and its phase title equals the level title (ฐานราก)', () => {
        expect(phaseOf('footing')?.id).toBe('foundation');
        expect(phaseOf('footing')?.title).toBe(getLevel('footing')?.title);
    });
});

describe('journey levels — kinds, sections, optional, extra rows', () => {
    it('only project-info is a meta level and only column-plates is a BOQ-rows level', () => {
        expect(JOURNEY_LEVELS.filter(l => l.kind.type === 'meta').map(l => l.id)).toEqual(['project-info']);
        expect(JOURNEY_LEVELS.filter(l => l.kind.type === 'boq').map(l => l.id)).toEqual(['column-plates']);
        expect(getLevel('column-plates')?.kind).toEqual({ type: 'boq', sections: [14] });
        expect(getLevel('project-info')?.sections).toEqual([]);
    });

    it('the other 35 levels are calculator levels whose calculator id equals the level id and exists in the registry', () => {
        const calcLevels = JOURNEY_LEVELS.filter(l => l.kind.type === 'calc');
        expect(calcLevels).toHaveLength(35);
        for (const l of calcLevels) {
            if (l.kind.type !== 'calc') continue;
            expect(l.kind.calc, l.id).toBe(l.id);
            expect(getCalculator(l.kind.calc), l.id).toBeDefined();
        }
    });

    it('exactly the 7 optional levels can be marked "ไม่มีในโครงการนี้"', () => {
        expect(JOURNEY_LEVELS.filter(l => l.optional === true).map(l => l.id)).toEqual(
            ORDER.filter(id => OPTIONAL.includes(id)),
        );
        expect(OPTIONAL).toHaveLength(7);
        // Levels every house has are never optional.
        for (const id of ['footing', 'column', 'brick', 'roofing', 'paint', 'misc', 'project-info', 'layout', 'site-camp', 'temp-utilities']) {
            expect(getLevel(id)?.optional, id).toBeUndefined();
        }
    });

    it('extraRows: only layout (R32) and roof-structure (R158) own typed lump-sum lines', () => {
        const withExtra = JOURNEY_LEVELS.filter(l => l.extraRows !== undefined).map(l => [l.id, l.extraRows]);
        expect(withExtra).toEqual([['layout', ['R32']], ['roof-structure', ['R158']]]);
    });

    it('prepare levels feed the documented BOQ sections', () => {
        const sections = Object.fromEntries(JOURNEY[0]?.levels.map(l => [l.id, l.sections]) ?? []);
        expect(sections).toEqual({
            'project-info': [], 'land-inspection': [0], demolition: [1], fill: [1], 'temp-utilities': [2], 'site-camp': [3], layout: [4],
        });
    });

    it('sections are non-negative integers and every level except project-info feeds at least one', () => {
        for (const l of JOURNEY_LEVELS) {
            for (const s of l.sections) {
                expect(Number.isInteger(s) && s >= 0 && s <= 31, `${l.id} section ${String(s)}`).toBe(true);
            }
            if (l.id !== 'project-info') expect(l.sections.length, l.id).toBeGreaterThan(0);
        }
    });
});
