import { describe, expect, it } from 'vitest';
import { JOURNEY_LEVELS } from '../levels';
import { missingRequirements, requiredFields, STEPS_WITH_REQUIREMENTS } from '../requirements';
import { createProject, type Project } from '../../project';
import type { CalculatorDef } from '../../calculators/types';
import { brick } from '../../calculators/brick';
import { ceiling } from '../../calculators/ceiling';
import { demolition, DEMOLITION_FIXED_ITEMS, type DemolitionLine } from '../../calculators/demolition';
import { ALUMINIUM, doorWindow, openingRow } from '../../calculators/door-window';
import { fill, type FillInput } from '../../calculators/fill';
import { floorTile } from '../../calculators/floor-tile';
import { footing, newFootingRow } from '../../calculators/footing';
import { pedestal } from '../../calculators/pedestal';
import { roofing } from '../../calculators/roofing';

const blank = () => createProject('blank');
const sample = () => createProject('sample');
const withCalc = <I,>(p: Project, def: CalculatorDef<I>, input: I): Project => ({ ...p, calculators: { ...p.calculators, [def.id]: input } });
const labels = (id: string, p: Project) => missingRequirements(id, p).map(m => m.label);
const IDS = JOURNEY_LEVELS.map(l => l.id);

/** Decision table for a blank project (docs/rebuild/REQUIRED_FIELDS.md): what each level still asks for. */
const BLANK_MISSING: Record<string, string[]> = {
    'project-info': ['ชื่อโครงการ'],
    'land-inspection': [],
    demolition: [],
    fill: [],
    'temp-utilities': [],
    'site-camp': [],
    layout: [],
    piles: [],
    footing: ['เพิ่มฐานรากอย่างน้อย 1 รายการ'],
    pedestal: [],
    'ground-beam': ['เพิ่มคานคอดินอย่างน้อย 1 รายการ'],
    'slab-on-grade': ['เพิ่มพื้นหล่อในที่อย่างน้อย 1 ผืน'],
    'precast-slab': [],
    column: ['เพิ่มเสาอย่างน้อย 1 รายการ'],
    'roof-beam': ['เพิ่มคานดาดฟ้า / คานหลังคาอย่างน้อย 1 รายการ'],
    'roof-slab': [],
    stair: [],
    'column-plates': [],
    roofing: ['พื้นที่หลังคาตามแนวราบ', 'ความชันหลังคา'],
    'roof-structure': [],
    'door-window': ['เพิ่มประตูหรือหน้าต่างอย่างน้อย 1 รายการ'],
    brick: ['เพิ่มผนังก่ออิฐอย่างน้อย 1 รายการ'],
    plaster: [],
    'electrical-pipe': ['เพิ่มวงจรไฟฟ้าอย่างน้อย 1 วงจร'],
    'electrical-cable': [],
    'load-center': ['ระบุอุปกรณ์ตู้ควบคุมไฟฟ้าพร้อมจำนวนอย่างน้อย 1 รายการ'],
    'electrical-equipment': ['ระบุอุปกรณ์ไฟฟ้าพร้อมจำนวนอย่างน้อย 1 รายการ'],
    'waste-pipe': ['กรอกความยาวท่อน้ำทิ้งอย่างน้อย 1 แนว'],
    'water-pipe': ['กรอกความยาวท่อน้ำดีอย่างน้อย 1 แนว'],
    'sanitary-system': [],
    'sanitary-ware': ['ระบุสุขภัณฑ์พร้อมจำนวนอย่างน้อย 1 รายการ'],
    ceiling: ['เพิ่มฝ้าเพดานอย่างน้อย 1 ห้อง'],
    'floor-tile': ['เพิ่มพื้นปูกระเบื้องอย่างน้อย 1 ห้อง'],
    'toilet-tile': [],
    'wall-finishing': [],
    paint: [],
    misc: [],
};

/** Levels the decision table marks "—" (nothing is required). */
const NO_REQUIREMENT = [
    'land-inspection', 'temp-utilities', 'site-camp', 'layout', 'column-plates', 'roof-structure', 'plaster', 'sanitary-system', 'paint', 'misc',
];

describe('requirements edge — the decision table, all 37 levels', () => {
    it('the table covers exactly the 37 journey levels', () => {
        expect(Object.keys(BLANK_MISSING)).toEqual(IDS);
    });

    it.each(IDS)('blank project, level %s asks for exactly what the table says', id => {
        expect(labels(id, blank())).toEqual(BLANK_MISSING[id]);
    });

    it.each(IDS)('sample project, level %s: nothing missing (the sample satisfies every requirement)', id => {
        expect(missingRequirements(id, sample())).toEqual([]);
    });

    it('27 levels have a rule and the 10 "—" levels have none', () => {
        expect(STEPS_WITH_REQUIREMENTS).toHaveLength(27);
        expect([...STEPS_WITH_REQUIREMENTS].sort()).toEqual(IDS.filter(id => !NO_REQUIREMENT.includes(id)).sort());
        expect(NO_REQUIREMENT).toHaveLength(10);
        for (const id of STEPS_WITH_REQUIREMENTS) expect(IDS, id).toContain(id);
    });

    it.each(NO_REQUIREMENT)('"—" level %s never asks for anything and marks no field', id => {
        expect(missingRequirements(id, blank())).toEqual([]);
        expect(missingRequirements(id, sample())).toEqual([]);
        expect(requiredFields(id).size).toBe(0);
    });

    it('"—" levels stay clear even with absurd values in their calculators', () => {
        let p = blank();
        p = { ...p, calculators: {
            ...p.calculators,
            'land-inspection': { items: [], checklist: [] },
            'temp-utilities': { waterDistance: -5, powerDistance: NaN, waterPoints: Infinity },
            'site-camp': { workerRooms: -1, materials: [] },
            layout: { points: -3, stakes: NaN, materials: [] },
        } };
        for (const id of ['land-inspection', 'temp-utilities', 'site-camp', 'layout']) expect(missingRequirements(id, p), id).toEqual([]);
    });

    it('the optional (skippable) levels of the blank project ask for nothing until started', () => {
        for (const l of JOURNEY_LEVELS.filter(x => x.optional === true)) expect(missingRequirements(l.id, blank()), l.id).toEqual([]);
    });

    it('requirements are not listed for a level in the "at least one" family twice (no duplicate labels)', () => {
        for (const id of IDS) {
            const ls = labels(id, blank());
            expect(new Set(ls).size, id).toBe(ls.length);
        }
    });
});

describe('requirements edge — skipped levels (state: not in this project)', () => {
    it('with every level skipped, no level asks for anything', () => {
        const p: Project = { ...blank(), journey: Object.fromEntries(IDS.map(id => [id, 'skipped' as const])) };
        for (const id of IDS) expect(missingRequirements(id, p), id).toEqual([]);
    });

    it('only the skipped level is exempt; its neighbours are still checked', () => {
        const p: Project = { ...blank(), journey: { footing: 'skipped' } };
        expect(missingRequirements('footing', p)).toEqual([]);
        expect(labels('ground-beam', p)).toEqual(BLANK_MISSING['ground-beam']);
        expect(labels('project-info', p)).toEqual(['ชื่อโครงการ']);
    });

    it('"done" does not exempt a level; un-skipping brings the requirements back', () => {
        const done: Project = { ...blank(), journey: { footing: 'done' } };
        expect(labels('footing', done)).toEqual(BLANK_MISSING.footing);
        const skippedP: Project = { ...blank(), journey: { footing: 'skipped' } };
        const back: Project = { ...skippedP, journey: {} };
        expect(missingRequirements('footing', skippedP)).toEqual([]);
        expect(labels('footing', back)).toEqual(BLANK_MISSING.footing);
    });

    it('a project without a journey map at all is handled', () => {
        const p: Project = { ...blank() };
        delete (p as { journey?: unknown }).journey;
        expect(labels('footing', p)).toEqual(BLANK_MISSING.footing);
    });

    it('electrical-cable is exempt when its source level (electrical-pipe) is skipped', () => {
        expect(missingRequirements('electrical-cable', { ...sample(), journey: { 'electrical-pipe': 'skipped' } })).toEqual([]);
    });
});

describe('requirements edge — project-info (ชื่อโครงการ)', () => {
    const named = (name: string): Project => ({ ...blank(), meta: { ...blank().meta, projectName: name } });

    it('empty, spaces, tab and newline count as empty', () => {
        for (const name of ['', ' ', '   ', '\t', '\n', ' \t\n ']) expect(labels('project-info', named(name)), JSON.stringify(name)).toEqual(['ชื่อโครงการ']);
    });

    it('any visible text counts, including one character, Thai, emoji and very long text', () => {
        for (const name of ['a', '0', 'บ้านคุณสมชาย', '🏠', ' x ', 'ก'.repeat(5000)]) expect(missingRequirements('project-info', named(name)), name.slice(0, 10)).toEqual([]);
    });

    it('reports the field key and label so the screen can highlight it', () => {
        expect(missingRequirements('project-info', blank())).toEqual([{ label: 'ชื่อโครงการ', field: 'ชื่อโครงการ', fieldKey: 'projectName' }]);
        expect([...requiredFields('project-info')]).toEqual(['projectName']);
    });

    it('other header fields (address, owner, date, prepared-by) are optional', () => {
        const p = named('x');
        expect(missingRequirements('project-info', { ...p, meta: { ...p.meta, siteAddress: '', ownerName: '', documentDate: '', preparedBy: '', revision: '' } })).toEqual([]);
    });

    it('the sample project has a name', () => {
        expect(sample().meta.projectName.trim()).not.toBe('');
    });
});

describe('requirements edge — demolition (each item with a quantity has a rate)', () => {
    const items = (over: Record<number, Partial<DemolitionLine>>): DemolitionLine[] =>
        DEMOLITION_FIXED_ITEMS.map((i, k) => ({ ...i, qty: 0, rate: 0, ...over[k] }));
    const run = (over: Record<number, Partial<DemolitionLine>>) => missingRequirements('demolition', withCalc(blank(), demolition, { items: items(over) }));

    it('quantity without rate: reports the row with its name, index and field key', () => {
        expect(run({ 2: { qty: 30 } })).toEqual([{
            label: 'รื้อถอนท่อระบายน้ำ — ค่ารื้อต่อหน่วย', item: 'รื้อถอนท่อระบายน้ำ', field: 'ค่ารื้อต่อหน่วย',
            listKey: 'items', itemIndex: 2, fieldKey: 'rate',
        }]);
    });

    it('boundaries of "filled": qty 0.0001 is started; qty 0, negative, NaN, Infinity are not', () => {
        expect(run({ 0: { qty: 0.0001 } })).toHaveLength(1);
        for (const qty of [0, -1, NaN, Infinity, -Infinity]) expect(run({ 0: { qty } }), String(qty)).toEqual([]);
    });

    it('a rate that is 0, negative or NaN does not satisfy the requirement; 0.01 does', () => {
        for (const rate of [0, -5, NaN, Infinity]) expect(run({ 1: { qty: 3, rate } }), String(rate)).toHaveLength(1);
        expect(run({ 1: { qty: 3, rate: 0.01 } })).toEqual([]);
    });

    it('several incomplete rows are all reported, in row order', () => {
        const m = run({ 0: { qty: 5 }, 3: { qty: 2 }, 6: { qty: 1, rate: 100 } });
        expect(m.map(x => x.itemIndex)).toEqual([0, 3]);
    });

    it('rows added by the user: a blank name gets "รายการที่ n"; whitespace-only name too', () => {
        const extra: DemolitionLine[] = [
            { label: '', unit: 'งาน', qty: 1, rate: 0, check: '' },
            { label: '   ', unit: 'งาน', qty: 2, rate: 0, check: '' },
            { label: ' ขุดตอไม้ ', unit: 'งาน', qty: 3, rate: 0, check: '' },
        ];
        const m = missingRequirements('demolition', withCalc(blank(), demolition, { items: extra }));
        expect(m.map(x => x.item)).toEqual(['รายการที่ 1', 'รายการที่ 2', 'ขุดตอไม้']);
    });

    it('empty table and 1-row table: nothing missing / one row complete', () => {
        expect(missingRequirements('demolition', withCalc(blank(), demolition, { items: [] }))).toEqual([]);
        expect(missingRequirements('demolition', withCalc(blank(), demolition, { items: [{ label: 'a', unit: 'u', qty: 1, rate: 1, check: '' }] }))).toEqual([]);
    });

    it('is checked even though the level is optional (only "skipped" exempts it)', () => {
        expect(run({ 0: { qty: 1 } })).toHaveLength(1);
        expect(missingRequirements('demolition', { ...withCalc(blank(), demolition, { items: items({ 0: { qty: 1 } }) }), journey: { demolition: 'skipped' } })).toEqual([]);
    });

    it('marks the rate field with *', () => {
        expect([...requiredFields('demolition')]).toEqual(['rate']);
    });
});

describe('requirements edge — fill (กว้าง, ยาว, ความสูงถม once started)', () => {
    const run = (over: Partial<FillInput>) => labels('fill', withCalc(blank(), fill, { ...(fill.blank?.() ?? fill.defaults()), ...over }));
    const W = 'ความกว้างพื้นที่ถม';
    const L = 'ความยาวพื้นที่ถม';
    const H = 'ความสูงถม';

    it('untouched form (all 0) is ignored; settlement or material alone do not start it', () => {
        expect(run({})).toEqual([]);
        expect(run({ settlementPct: 50, material: 'ดินลูกรัง' })).toEqual([]);
    });

    it('each single value started asks for the other two', () => {
        expect(run({ width: 5 })).toEqual([L, H]);
        expect(run({ length: 5 })).toEqual([W, H]);
        expect(run({ height: 0.5 })).toEqual([W, L]);
    });

    it('two values started ask for the third', () => {
        expect(run({ width: 5, length: 5 })).toEqual([H]);
        expect(run({ width: 5, height: 1 })).toEqual([L]);
        expect(run({ length: 5, height: 1 })).toEqual([W]);
    });

    it('all three filled: complete (tiny values count)', () => {
        expect(run({ width: 5, length: 5, height: 0.5 })).toEqual([]);
        expect(run({ width: 0.001, length: 0.001, height: 0.001 })).toEqual([]);
    });

    it('negative, NaN and Infinity are not "filled": they neither start the form nor complete it', () => {
        expect(run({ width: -5 })).toEqual([]);
        expect(run({ width: NaN, length: Infinity, height: -1 })).toEqual([]);
        expect(run({ width: 5, length: -5, height: 1 })).toEqual([L]);
        expect(run({ width: 5, length: Infinity, height: 1 })).toEqual([L]);
    });

    it('reports fieldKeys width / length / height and marks them with *', () => {
        const m = missingRequirements('fill', withCalc(blank(), fill, { ...fill.defaults(), width: 5, length: 0, height: 0 }));
        expect(m.map(x => x.fieldKey)).toEqual(['length', 'height']);
        expect([...requiredFields('fill')].sort()).toEqual(['height', 'length', 'width']);
    });

    it('the Excel sample fill (20 × 20 × 0.45) is complete', () => {
        expect(missingRequirements('fill', sample())).toEqual([]);
    });
});

describe('requirements edge — half-filled rows in other steps (error guessing)', () => {
    it('footing: only a count typed → the other four values are asked, in table order', () => {
        const row = { ...newFootingRow([]), count: 4 };
        expect(labels('footing', withCalc(blank(), footing, { rows: [row] }))).toEqual([
            'ฐานราก F1 — ความกว้าง', 'ฐานราก F1 — ความยาว', 'ฐานราก F1 — ความหนาฐาน', 'ฐานราก F1 — ความลึกหลุมขุด',
        ]);
    });

    it('footing: a complete second row does not hide an incomplete first row', () => {
        const [f1] = footing.defaults().rows;
        if (!f1) throw new Error('sample');
        const bad = { ...newFootingRow([]), name: 'F9', width: 1 };
        const m = missingRequirements('footing', withCalc(blank(), footing, { rows: [bad, f1] }));
        expect(m.every(x => x.itemIndex === 0)).toBe(true);
        expect(m.length).toBeGreaterThan(0);
    });

    it('footing: two rows with the same name get their position so the user can tell them apart', () => {
        const a = { ...newFootingRow([]), name: 'F1', width: 1 };
        const b = { ...newFootingRow([]), name: 'F1', length: 1 };
        const m = missingRequirements('footing', withCalc(blank(), footing, { rows: [a, b] }));
        expect(m.some(x => x.item === 'ฐานราก F1 (ลำดับที่ 1)')).toBe(true);
        expect(m.some(x => x.item === 'ฐานราก F1 (ลำดับที่ 2)')).toBe(true);
    });

    it('pedestal: the footing must exist — a pointer past the end, negative or fractional is missing', () => {
        const base = { ...(pedestal.defaults().rows[0] ?? ({} as never)), name: 'C1', count: 1, width: 0.2, length: 0.2, height: 0.6 };
        const footings = footing.defaults().rows.length;
        const check = (idx: number) => labels('pedestal', withCalc(sample(), pedestal, { rows: [{ ...base, footing: idx }] }));
        expect(check(0)).toEqual([]);
        expect(check(footings - 1)).toEqual([]);
        for (const idx of [footings, -1, 1.5, NaN]) expect(check(idx), String(idx)).toEqual(['เสาตอม่อ C1 — ตั้งอยู่บนฐานราก']);
        // A blank project has no footing at all: any pointer is dangling.
        expect(labels('pedestal', withCalc(blank(), pedestal, { rows: [{ ...base, footing: 0 }] }))).toEqual(['เสาตอม่อ C1 — ตั้งอยู่บนฐานราก']);
    });

    it('roofing: area without pitch, pitch without area, negative or non-finite values', () => {
        const base = roofing.defaults();
        const run = (planArea: number, slopeDeg: number) => labels('roofing', withCalc(blank(), roofing, { ...base, planArea, slopeDeg }));
        expect(run(120, 0)).toEqual(['ความชันหลังคา']);
        expect(run(0, 30)).toEqual(['พื้นที่หลังคาตามแนวราบ']);
        expect(run(0, 0)).toEqual(['พื้นที่หลังคาตามแนวราบ', 'ความชันหลังคา']);
        expect(run(-5, 30)).toEqual(['พื้นที่หลังคาตามแนวราบ']);
        expect(run(120, NaN)).toEqual(['ความชันหลังคา']);
        expect(run(Infinity, 30)).toEqual(['พื้นที่หลังคาตามแนวราบ']);
        expect(run(0.01, 0.01)).toEqual([]);
    });

    it('brick: a wall whose length is typed needs its height; a copied height alone is not a wall', () => {
        const wall = { wallPart: 'ผนัง', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 5, height: 0 };
        expect(labels('brick', withCalc(blank(), brick, { walls: [wall] }))).toEqual(['ผนังที่ 1 — ความสูง']);
        expect(labels('brick', withCalc(blank(), brick, { walls: [{ ...wall, length: 0, height: 3 }] }))).toEqual(['เพิ่มผนังก่ออิฐอย่างน้อย 1 รายการ']);
        expect(labels('brick', withCalc(blank(), brick, { walls: [{ ...wall, height: 3 }, { ...wall, length: 0, height: 3 }] }))).toEqual([]);
        expect(labels('brick', withCalc(blank(), brick, { walls: [] }))).toEqual(['เพิ่มผนังก่ออิฐอย่างน้อย 1 รายการ']);
    });

    it('door-window: a door and a window together satisfy "at least one"; each is checked on its own', () => {
        const d = openingRow({ name: 'D1-', type: ALUMINIUM, count: 1, width: 0.9, height: 2.1 });
        const w = openingRow({ name: 'W1-', type: ALUMINIUM, count: 1, width: 1.2, height: 0 });
        expect(labels('door-window', withCalc(blank(), doorWindow, { doors: [d], windows: [] }))).toEqual([]);
        expect(labels('door-window', withCalc(blank(), doorWindow, { doors: [d], windows: [w] }))).toEqual(['หน้าต่าง W1 — ความสูง']);
        expect(labels('door-window', withCalc(blank(), doorWindow, { doors: [], windows: [] }))).toEqual(['เพิ่มประตูหรือหน้าต่างอย่างน้อย 1 รายการ']);
    });

    it('ceiling: row with a type but no size is not an item; with a size and no type it asks for the type only', () => {
        const room = { code: 'C1' as const, width: 0, length: 0, location: 'ห้องนอน', paint: '' as const };
        expect(labels('ceiling', withCalc(blank(), ceiling, { rows: [room] }))).toEqual(['เพิ่มฝ้าเพดานอย่างน้อย 1 ห้อง']);
        expect(labels('ceiling', withCalc(blank(), ceiling, { rows: [{ ...room, code: '', width: 3, length: 4 }] }))).toEqual(['ห้องนอน — ชนิดฝ้า']);
        expect(labels('ceiling', withCalc(blank(), ceiling, { rows: [{ ...room, width: 3 }] }))).toEqual(['ห้องนอน — ยาว']);
    });

    it('floor-tile: one filled room completes the step; a half-filled extra room is still reported', () => {
        const ok = { code: 'F1' as const, width: 3, length: 4, location: 'ห้องนั่งเล่น' };
        const half = { code: 'F1' as const, width: 3, length: 0, location: 'ครัว' };
        expect(labels('floor-tile', withCalc(blank(), floorTile, { rows: [ok] }))).toEqual([]);
        expect(labels('floor-tile', withCalc(blank(), floorTile, { rows: [ok, half] }))).toEqual(['ครัว — ยาว']);
    });
});

describe('requirements edge — requiredFields (the * marks)', () => {
    it('unknown, empty and "—" levels return an empty set', () => {
        for (const id of ['nope', '', ...NO_REQUIREMENT]) expect(requiredFields(id).size, id).toBe(0);
    });

    it('known keys of the steps in this group', () => {
        expect([...requiredFields('footing')].sort()).toEqual(['count', 'depth', 'excavationDepth', 'length', 'width']);
        expect([...requiredFields('roofing')].sort()).toEqual(['planArea', 'slopeDeg']);
        expect([...requiredFields('brick')].sort()).toEqual(['height', 'length']);
        expect([...requiredFields('waste-pipe')]).toEqual([]);
    });

    it('every field key a blank-project requirement points at is marked with *', () => {
        for (const id of IDS) {
            for (const m of missingRequirements(id, blank())) {
                if (m.fieldKey !== undefined) expect(requiredFields(id).has(m.fieldKey), `${id}.${m.fieldKey}`).toBe(true);
            }
        }
    });

    it('unknown level in missingRequirements is empty rather than an error', () => {
        expect(missingRequirements('nope', blank())).toEqual([]);
        expect(missingRequirements('', sample())).toEqual([]);
    });
});
