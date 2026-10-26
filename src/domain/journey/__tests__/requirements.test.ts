import { describe, expect, it } from 'vitest';
import { JOURNEY_LEVELS } from '../levels';
import { missingRequirements, requiredFields, STEPS_WITH_REQUIREMENTS, type MissingValue } from '../requirements';
import { createProject, type Project } from '../../project';
import type { CalculatorDef } from '../../calculators/types';
import { brick } from '../../calculators/brick';
import { ceiling } from '../../calculators/ceiling';
import { column, newColumnRow } from '../../calculators/column';
import { demolition, DEMOLITION_FIXED_ITEMS } from '../../calculators/demolition';
import { ALUMINIUM, doorWindow, openingRow } from '../../calculators/door-window';
import { electricalCable, KIND_WIRING } from '../../calculators/electrical-cable';
import { electricalEquipment } from '../../calculators/electrical-equipment';
import { electricalPipe, newCircuitOfKind, type Circuit } from '../../calculators/electrical-pipe';
import { fill } from '../../calculators/fill';
import { floorTile } from '../../calculators/floor-tile';
import { footing, newFootingRow } from '../../calculators/footing';
import { groundBeam, newGroundBeamRow } from '../../calculators/ground-beam';
import { loadCenter } from '../../calculators/load-center';
import { newPedestalRow, pedestal } from '../../calculators/pedestal';
import { piles } from '../../calculators/piles';
import { newPrecastPanel, precastSlab } from '../../calculators/precast-slab';
import { roofBeam } from '../../calculators/roof-beam';
import { newRoofSlabRow, roofSlab } from '../../calculators/roof-slab';
import { roofing } from '../../calculators/roofing';
import { sanitaryWare } from '../../calculators/sanitary-ware';
import { emptyPickRow, pickRow } from '../../calculators/shared/pick-list';
import { newSlabRow, slabOnGrade } from '../../calculators/slab-on-grade';
import { newStairRow, stair } from '../../calculators/stair';
import { newBathroomRows, toiletTile } from '../../calculators/toilet-tile';
import { newMouldingRow, newSlatRow, wallFinishing } from '../../calculators/wall-finishing';
import { wastePipe } from '../../calculators/waste-pipe';
import { waterPipe } from '../../calculators/water-pipe';

const blank = () => createProject('blank');
const sample = () => createProject('sample');

function withCalc<I>(p: Project, def: CalculatorDef<I>, input: I): Project {
    return { ...p, calculators: { ...p.calculators, [def.id]: input } };
}

const labels = (levelId: string, p: Project) => missingRequirements(levelId, p).map(m => m.label);

/** Labels of every step that misses something. */
function allMissing(p: Project): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const l of JOURNEY_LEVELS) {
        const m = labels(l.id, p);
        if (m.length > 0) out[l.id] = m;
    }
    return out;
}

/** Every field key the cases below report, by step (checked against `requiredFields`). */
const reported = new Map<string, Set<string>>();
function missing(levelId: string, p: Project): MissingValue[] {
    const out = missingRequirements(levelId, p);
    for (const m of out) {
        if (m.fieldKey === undefined) continue;
        const set = reported.get(levelId) ?? new Set<string>();
        set.add(m.fieldKey);
        reported.set(levelId, set);
    }
    return out;
}
const missingLabels = (levelId: string, p: Project) => missing(levelId, p).map(m => m.label);

describe('required fields — the Excel sample', () => {
    it('meets every requirement of every step', () => {
        expect(allMissing(sample())).toEqual({});
    });
});

describe('required fields — a blank project', () => {
    it('misses exactly the "at least one" items (and the always-required values) of the non-optional steps', () => {
        const p = blank();
        const found = allMissing(p);
        expect(found).toEqual({
            'project-info': ['ชื่อโครงการ'],
            footing: ['เพิ่มฐานรากอย่างน้อย 1 รายการ'],
            'ground-beam': ['เพิ่มคานคอดินอย่างน้อย 1 รายการ'],
            'slab-on-grade': ['เพิ่มพื้นหล่อในที่อย่างน้อย 1 ผืน'],
            column: ['เพิ่มเสาอย่างน้อย 1 รายการ'],
            'roof-beam': ['เพิ่มคานดาดฟ้า / คานหลังคาอย่างน้อย 1 รายการ'],
            roofing: ['พื้นที่หลังคาตามแนวราบ', 'ความชันหลังคา'],
            'door-window': ['เพิ่มประตูหรือหน้าต่างอย่างน้อย 1 รายการ'],
            brick: ['เพิ่มผนังก่ออิฐอย่างน้อย 1 รายการ'],
            'electrical-pipe': ['เพิ่มวงจรไฟฟ้าอย่างน้อย 1 วงจร'],
            'load-center': ['ระบุอุปกรณ์ตู้ควบคุมไฟฟ้าพร้อมจำนวนอย่างน้อย 1 รายการ'],
            'electrical-equipment': ['ระบุอุปกรณ์ไฟฟ้าพร้อมจำนวนอย่างน้อย 1 รายการ'],
            'waste-pipe': ['กรอกความยาวท่อน้ำทิ้งอย่างน้อย 1 แนว'],
            'water-pipe': ['กรอกความยาวท่อน้ำดีอย่างน้อย 1 แนว'],
            'sanitary-ware': ['ระบุสุขภัณฑ์พร้อมจำนวนอย่างน้อย 1 รายการ'],
            ceiling: ['เพิ่มฝ้าเพดานอย่างน้อย 1 ห้อง'],
            'floor-tile': ['เพิ่มพื้นปูกระเบื้องอย่างน้อย 1 ห้อง'],
        });
        // Only non-optional steps; "at least one" items point at no row or field.
        for (const id of Object.keys(found)) expect(JOURNEY_LEVELS.find(l => l.id === id)?.optional, id).toBeUndefined();
        for (const m of missingRequirements('footing', p)) expect(m).toEqual({ label: 'เพิ่มฐานรากอย่างน้อย 1 รายการ' });
        expect(missingRequirements('roofing', p)).toEqual([
            { label: 'พื้นที่หลังคาตามแนวราบ', field: 'พื้นที่หลังคาตามแนวราบ', fieldKey: 'planArea' },
            { label: 'ความชันหลังคา', field: 'ความชันหลังคา', fieldKey: 'slopeDeg' },
        ]);
    });
});

describe('required fields — skipped steps and unknown ids', () => {
    it('a step marked "ไม่มีในโครงการนี้" has no requirements', () => {
        const p: Project = { ...blank(), journey: { footing: 'skipped', roofing: 'skipped' } };
        expect(missingRequirements('footing', p)).toEqual([]);
        expect(missingRequirements('roofing', p)).toEqual([]);
        const half = withCalc(p, fill, { ...fill.blank?.() ?? fill.defaults(), width: 10 });
        expect(missingRequirements('fill', half)).not.toEqual([]);
        expect(missingRequirements('fill', { ...half, journey: { fill: 'skipped' } })).toEqual([]);
    });

    it('a step marked done is still checked (the list is what the screen shows before moving on)', () => {
        expect(missingRequirements('footing', { ...blank(), journey: { footing: 'done' } })).toHaveLength(1);
    });

    it('an unknown level has none', () => {
        expect(missingRequirements('nope', blank())).toEqual([]);
        expect(requiredFields('nope').size).toBe(0);
    });
});

describe('required fields — rules, one failing and one passing case each', () => {
    it('project-info: ชื่อโครงการ (blank text counts as empty)', () => {
        const p = blank();
        expect(missing('project-info', { ...p, meta: { ...p.meta, projectName: '   ' } }))
            .toEqual([{ label: 'ชื่อโครงการ', field: 'ชื่อโครงการ', fieldKey: 'projectName' }]);
        expect(missing('project-info', { ...p, meta: { ...p.meta, projectName: 'บ้านคุณเอ' } })).toEqual([]);
    });

    it('demolition: an item with a quantity has a rate', () => {
        const items = DEMOLITION_FIXED_ITEMS.map(i => ({ ...i, qty: 0, rate: 0 }));
        const withQty = items.map((l, i) => (i === 1 ? { ...l, qty: 4 } : l));
        expect(missing('demolition', withCalc(blank(), demolition, { items: withQty }))).toEqual([{
            label: 'รื้อถอนต้นไม้ — ค่ารื้อต่อหน่วย', item: 'รื้อถอนต้นไม้', field: 'ค่ารื้อต่อหน่วย',
            listKey: 'items', itemIndex: 1, fieldKey: 'rate',
        }]);
        const priced = withQty.map((l, i) => (i === 1 ? { ...l, rate: 1500 } : l));
        expect(missing('demolition', withCalc(blank(), demolition, { items: priced }))).toEqual([]);
        // A rate with no quantity costs nothing either way.
        expect(missing('demolition', withCalc(blank(), demolition, { items: items.map(l => ({ ...l, rate: 99 })) }))).toEqual([]);
    });

    it('fill: กว้าง, ยาว, ความสูงถม once the form is started', () => {
        const base = fill.defaults();
        const half = withCalc(blank(), fill, { ...base, width: 12, length: 0, height: 0 });
        expect(missingLabels('fill', half)).toEqual(['ความยาวพื้นที่ถม', 'ความสูงถม']);
        expect(missing('fill', withCalc(blank(), fill, base))).toEqual([]);
        expect(missing('fill', blank())).toEqual([]);
    });

    it('piles: ชนิด, ขนาด, ความยาว, จำนวนต้น once the form is started', () => {
        const base = piles.defaults();
        const half = withCalc(blank(), piles, { ...base, pileType: '', section: '', length: 0, count: 21 });
        expect(missingLabels('piles', half)).toEqual(['ชนิดเสาเข็ม', 'หน้าตัด/รูปทรง', 'ความยาว']);
        expect(missing('piles', withCalc(blank(), piles, base))).toEqual([]);
        expect(missing('piles', blank())).toEqual([]);
    });

    it('footing: at least one; each has size, thickness, count and pit depth (stable label and keys)', () => {
        const [f1] = footing.defaults().rows;
        if (!f1) throw new Error('sample footing');
        const f2 = { ...newFootingRow([f1]), width: 0.8, length: 0.8, depth: 0.5, excavationDepth: 1.2 };
        expect(f2.name).toBe('F2');
        expect(missing('footing', withCalc(blank(), footing, { rows: [f1, f2] }))).toEqual([{
            label: 'ฐานราก F2 — จำนวนฐานแบบนี้', item: 'ฐานราก F2', field: 'จำนวนฐานแบบนี้',
            listKey: 'rows', itemIndex: 1, fieldKey: 'count',
        }]);
        const partial = { ...newFootingRow([]), width: 0.6 };
        expect(missingLabels('footing', withCalc(blank(), footing, { rows: [partial] }))).toEqual([
            'ฐานราก F1 — จำนวนฐานแบบนี้', 'ฐานราก F1 — ความยาว', 'ฐานราก F1 — ความหนาฐาน', 'ฐานราก F1 — ความลึกหลุมขุด',
        ]);
        expect(missing('footing', withCalc(blank(), footing, { rows: [{ ...f2, count: 4 }] }))).toEqual([]);
    });

    it('an empty new row is ignored: not incomplete, and not an item either', () => {
        const sampleRows = footing.defaults().rows;
        expect(missing('footing', withCalc(sample(), footing, { rows: [...sampleRows, newFootingRow(sampleRows)] }))).toEqual([]);
        expect(missingLabels('footing', withCalc(blank(), footing, { rows: [newFootingRow([])] })))
            .toEqual(['เพิ่มฐานรากอย่างน้อย 1 รายการ']);
    });

    it('pedestal: sits on a footing, count and size (no "at least one")', () => {
        const footings = footing.defaults().rows;
        const row = { ...newPedestalRow([], footings), name: 'C1', width: 0.2, length: 0.2, height: 0.6, footing: 3 };
        expect(missingLabels('pedestal', withCalc(sample(), pedestal, { rows: [row] }))).toEqual(['เสาตอม่อ C1 — ตั้งอยู่บนฐานราก']);
        expect(missing('pedestal', withCalc(sample(), pedestal, { rows: [{ ...row, footing: 0 }] }))).toEqual([]);
        // A pedestal added on a footing already counts its pedestals, but holds no plan value yet: ignored.
        expect(missing('pedestal', withCalc(sample(), pedestal, { rows: [newPedestalRow([], footings)] }))).toEqual([]);
        expect(missing('pedestal', blank())).toEqual([]);
    });

    it('ground-beam: at least one; each has width, depth and total length', () => {
        const beams = groundBeam.defaults().beams.slice(0, 1);
        const copy = newGroundBeamRow(beams);   // section and bars copied, length empty
        expect(missingLabels('ground-beam', withCalc(blank(), groundBeam, { beams: [...beams, copy] })))
            .toEqual(['คานคอดิน B2 — ความยาวรวมทุกช่วง']);
        expect(missing('ground-beam', withCalc(blank(), groundBeam, { beams: [...beams, { ...copy, length: 12 }] }))).toEqual([]);
    });

    it('slab-on-grade: at least one; each has width, length, thickness (copied thickness alone is not a value)', () => {
        const slabs = slabOnGrade.defaults().slabs;
        expect(missing('slab-on-grade', withCalc(blank(), slabOnGrade, { slabs: [...slabs, newSlabRow(slabs[0])] }))).toEqual([]);
        const half = { ...newSlabRow(), width: 2 };
        expect(missingLabels('slab-on-grade', withCalc(blank(), slabOnGrade, { slabs: [half] })))
            .toEqual(['ผืนที่ 1 — ความยาว', 'ผืนที่ 1 — ความหนา']);
        expect(missing('slab-on-grade', withCalc(blank(), slabOnGrade, { slabs: [{ ...half, length: 3, thickness: 0.1 }] }))).toEqual([]);
        expect(missingLabels('slab-on-grade', withCalc(blank(), slabOnGrade, { slabs: [newSlabRow()] })))
            .toEqual(['เพิ่มพื้นหล่อในที่อย่างน้อย 1 ผืน']);
    });

    it('precast-slab: each span has width and length', () => {
        expect(missingLabels('precast-slab', withCalc(blank(), precastSlab, { panels: [{ ...newPrecastPanel(), length: 3 }] })))
            .toEqual(['ช่วงที่ 1 — ความกว้างช่วง']);
        expect(missing('precast-slab', withCalc(blank(), precastSlab, { panels: [{ ...newPrecastPanel(), width: 2, length: 3 }] }))).toEqual([]);
        expect(missing('precast-slab', withCalc(blank(), precastSlab, { panels: [newPrecastPanel()] }))).toEqual([]);
    });

    it('column: at least one; each has count, width, length, height', () => {
        const half = { ...newColumnRow(), name: 'C2', count: 8 };
        expect(missingLabels('column', withCalc(blank(), column, { columns: [half] })))
            .toEqual(['เสา C2 — ความกว้าง', 'เสา C2 — ความยาว', 'เสา C2 — ความสูงเสา']);
        expect(missing('column', withCalc(blank(), column, { columns: [{ ...half, width: 0.2, depth: 0.2, height: 3 }] }))).toEqual([]);
        // A new column copies the previous height: not a value of its own.
        expect(missingLabels('column', withCalc(blank(), column, { columns: [{ ...newColumnRow(), height: 3 }] })))
            .toEqual(['เพิ่มเสาอย่างน้อย 1 รายการ']);
    });

    it('roof-beam: at least one; each has width, depth, total length; repeated names get their position', () => {
        const [a, b] = roofBeam.defaults().rows;
        if (!a || !b) throw new Error('sample roof beams');
        const p = withCalc(blank(), roofBeam, { rows: [a, { ...b, length: 0 }] });
        expect(missing('roof-beam', p)).toEqual([{
            label: 'คาน B5 (ลำดับที่ 2) — ความยาวรวม', item: 'คาน B5 (ลำดับที่ 2)', field: 'ความยาวรวม',
            listKey: 'rows', itemIndex: 1, fieldKey: 'length',
        }]);
        expect(missing('roof-beam', withCalc(blank(), roofBeam, { rows: [a, b] }))).toEqual([]);
    });

    it('roof-slab: each panel has width, length, thickness', () => {
        expect(missingLabels('roof-slab', withCalc(blank(), roofSlab, { rows: [{ ...newRoofSlabRow(), width: 1, length: 2 }] })))
            .toEqual(['ผืนที่ 1 — ความหนา']);
        expect(missing('roof-slab', withCalc(blank(), roofSlab, { rows: [{ ...newRoofSlabRow(), width: 1, length: 2, thickness: 0.1 }] }))).toEqual([]);
    });

    it('stair: each stair has width and number of steps', () => {
        const half = { ...newStairRow(), name: 'บันไดหน้าบ้าน', riser: 0.15, tread: 0.3 };
        expect(missingLabels('stair', withCalc(blank(), stair, { rows: [half] })))
            .toEqual(['บันไดหน้าบ้าน — จำนวนขั้น', 'บันไดหน้าบ้าน — ความกว้างบันได']);
        expect(missing('stair', withCalc(blank(), stair, { rows: [{ ...half, steps: 3, width: 1.2 }] }))).toEqual([]);
        expect(missing('stair', withCalc(blank(), stair, { rows: [newStairRow()] }))).toEqual([]);
    });

    it('roofing: roof plan area and pitch', () => {
        const base = roofing.defaults();
        expect(missingLabels('roofing', withCalc(blank(), roofing, { ...base, slopeDeg: 0 }))).toEqual(['ความชันหลังคา']);
        expect(missing('roofing', withCalc(blank(), roofing, base))).toEqual([]);
    });

    it('door-window: at least one opening (doors or windows); each has width, height, count', () => {
        const w1 = openingRow({ name: 'W1-บานเลื่อนสลับ', type: ALUMINIUM, count: 0, width: 1.3, height: 1.2 });
        const p = withCalc(blank(), doorWindow, { doors: [], windows: [w1] });
        expect(missing('door-window', p)).toEqual([{
            label: 'หน้าต่าง W1 — จำนวน', item: 'หน้าต่าง W1', field: 'จำนวน', listKey: 'windows', itemIndex: 0, fieldKey: 'count',
        }]);
        expect(missing('door-window', withCalc(blank(), doorWindow, { doors: [], windows: [{ ...w1, count: 2 }] }))).toEqual([]);
        const d = openingRow({ name: '', type: ALUMINIUM, count: 1, width: 0, height: 2 });
        expect(missingLabels('door-window', withCalc(blank(), doorWindow, { doors: [d], windows: [] }))).toEqual(['ประตูที่ 1 — ความกว้าง']);
        const empty = openingRow({ name: 'D1-', type: ALUMINIUM, count: 1, width: 0, height: 0 });
        expect(missingLabels('door-window', withCalc(blank(), doorWindow, { doors: [empty], windows: [] })))
            .toEqual(['เพิ่มประตูหรือหน้าต่างอย่างน้อย 1 รายการ']);
    });

    it('brick: at least one wall; each has length and height', () => {
        const wall = { wallPart: 'ผนังรอบบ้าน', brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length: 8, height: 0 };
        expect(missingLabels('brick', withCalc(blank(), brick, { walls: [wall] }))).toEqual(['ผนังที่ 1 — ความสูง']);
        expect(missing('brick', withCalc(blank(), brick, { walls: [{ ...wall, height: 3 }] }))).toEqual([]);
        // A new wall copies the previous height: ignored until its length is typed.
        expect(missingLabels('brick', withCalc(blank(), brick, { walls: [{ ...wall, length: 0, height: 3 }] })))
            .toEqual(['เพิ่มผนังก่ออิฐอย่างน้อย 1 รายการ']);
    });

    it('electrical-pipe: at least one circuit; each has its main run', () => {
        const fresh = newCircuitOfKind([], 'light');   // vertical run preset only
        expect(missingLabels('electrical-pipe', withCalc(blank(), electricalPipe, { circuits: [fresh] })))
            .toEqual(['เพิ่มวงจรไฟฟ้าอย่างน้อย 1 วงจร']);
        const c: Circuit = { ...fresh, id: 'k1', name: 'แสงสว่าง : ห้องนอน', points: 4, deviceV: 9.2 };
        expect(missing('electrical-pipe', withCalc(blank(), electricalPipe, { circuits: [c] }))).toEqual([{
            label: 'แสงสว่าง : ห้องนอน — ท่อสายเมน', item: 'แสงสว่าง : ห้องนอน', field: 'ท่อสายเมน',
            listKey: 'circuits', itemIndex: 0, fieldKey: 'mainH',
        }]);
        expect(missing('electrical-pipe', withCalc(blank(), electricalPipe, { circuits: [{ ...c, mainH: 20 }] }))).toEqual([]);
    });

    it('electrical-cable: every circuit with conduit has its cable chosen', () => {
        const light: Circuit = { ...newCircuitOfKind([], 'light'), id: 'L1', name: 'แสงสว่าง : ห้องนอน', mainH: 20, points: 4, deviceV: 9.2 };
        const heater: Circuit = { ...newCircuitOfKind([], 'heater'), id: 'H1', name: 'เครื่องทำน้ำอุ่น', mainH: 10 };
        const noRun: Circuit = { ...newCircuitOfKind([], 'socket'), id: 'S1', name: 'เต้ารับ', mainV: 0 };
        const p = withCalc(blank(), electricalPipe, { circuits: [noRun, light, heater] });
        expect(missing('electrical-cable', withCalc(p, electricalCable, { wiring: {} }))).toEqual([
            { label: 'แสงสว่าง : ห้องนอน — สายเมนวงจร', item: 'แสงสว่าง : ห้องนอน', field: 'สายเมนวงจร', listKey: 'circuits', itemIndex: 1, itemKey: 'L1', fieldKey: 'mainSize' },
            { label: 'แสงสว่าง : ห้องนอน — สายเข้าโคม / จุด', item: 'แสงสว่าง : ห้องนอน', field: 'สายเข้าโคม / จุด', listKey: 'circuits', itemIndex: 1, itemKey: 'L1', fieldKey: 'deviceSize' },
            { label: 'แสงสว่าง : ห้องนอน — จำนวนสาย', item: 'แสงสว่าง : ห้องนอน', field: 'จำนวนสาย', listKey: 'circuits', itemIndex: 1, itemKey: 'L1', fieldKey: 'conductors' },
            { label: 'เครื่องทำน้ำอุ่น — สายเมนวงจร', item: 'เครื่องทำน้ำอุ่น', field: 'สายเมนวงจร', listKey: 'circuits', itemIndex: 2, itemKey: 'H1', fieldKey: 'mainSize' },
            { label: 'เครื่องทำน้ำอุ่น — จำนวนสาย', item: 'เครื่องทำน้ำอุ่น', field: 'จำนวนสาย', listKey: 'circuits', itemIndex: 2, itemKey: 'H1', fieldKey: 'conductors' },
        ]);
        const sizesOnly = { L1: { mainSize: 'THW 2.5', deviceSize: 'THW 1.5', conductors: 0 }, H1: { mainSize: 'THW 4', deviceSize: '', conductors: 3 } };
        expect(missingLabels('electrical-cable', withCalc(p, electricalCable, { wiring: sizesOnly }))).toEqual(['แสงสว่าง : ห้องนอน — จำนวนสาย']);
        const wired = { L1: { ...(KIND_WIRING.light ?? sizesOnly.L1) }, H1: { ...(KIND_WIRING.heater ?? sizesOnly.H1) } };
        expect(missing('electrical-cable', withCalc(p, electricalCable, { wiring: wired }))).toEqual([]);
        // No circuits (or none with conduit): nothing to wire.
        expect(missing('electrical-cable', blank())).toEqual([]);
    });

    it('pick-list steps: at least one row with an item and a quantity > 0', () => {
        const cases = [
            { id: 'load-center', def: loadCenter, item: 'ตู้ Consumer Unit ชนาด 18 ช่อง' },
            { id: 'electrical-equipment', def: electricalEquipment, item: 'โคมไฟดาวน์ไลท์' },
            { id: 'sanitary-ware', def: sanitaryWare, item: 'ชักโครกนั่งราบ' },
        ] as const;
        for (const c of cases) {
            const noQty = withCalc(blank(), c.def, { items: [pickRow(c.item, 0, 'ชุด'), { ...emptyPickRow(), qty: 3 }] });
            expect(missing(c.id, noQty), c.id).toHaveLength(1);
            expect(missing(c.id, withCalc(blank(), c.def, { items: [pickRow(c.item, 1, 'ชุด')] })), c.id).toEqual([]);
        }
    });

    it('pipe-run steps: at least one run (fixed or extra) with a length', () => {
        const waste = wastePipe.blank?.() ?? wastePipe.defaults();
        expect(missingLabels('waste-pipe', withCalc(blank(), wastePipe, waste))).toEqual(['กรอกความยาวท่อน้ำทิ้งอย่างน้อย 1 แนว']);
        const vertical = { runs: waste.runs.map((r, i) => (i === 2 ? { ...r, vertical: 3 } : r)) };
        expect(missing('waste-pipe', withCalc(blank(), wastePipe, vertical))).toEqual([]);
        const extra = { runs: [...waste.runs, { label: '', size: 'PVC 2"', horizontal: 5, vertical: 0 }] };
        expect(missing('waste-pipe', withCalc(blank(), wastePipe, extra))).toEqual([]);
        const water = waterPipe.blank?.() ?? waterPipe.defaults();
        expect(missing('water-pipe', withCalc(blank(), waterPipe, water))).toHaveLength(1);
        expect(missing('water-pipe', withCalc(blank(), waterPipe, { runs: water.runs.map(r => ({ ...r, horizontal: 10 })) }))).toEqual([]);
    });

    it('ceiling: at least one room; each has a type, width and length', () => {
        const room = { code: '' as const, width: 3, length: 3, location: 'ห้องนอน 1', paint: '' as const };
        expect(missingLabels('ceiling', withCalc(blank(), ceiling, { rows: [room] }))).toEqual(['ห้องนอน 1 — ชนิดฝ้า']);
        const eaves = { code: 'C3' as const, width: 0, length: 62, location: '', paint: 'ภายนอก' as const };
        expect(missingLabels('ceiling', withCalc(blank(), ceiling, { rows: [eaves] }))).toEqual(['ห้องที่ 1 — ระยะยื่นชายคา']);
        expect(missing('ceiling', withCalc(blank(), ceiling, { rows: [{ ...room, code: 'C1' }] }))).toEqual([]);
        expect(missingLabels('ceiling', withCalc(blank(), ceiling, { rows: [{ ...room, code: 'C1', width: 0, length: 0 }] })))
            .toEqual(['เพิ่มฝ้าเพดานอย่างน้อย 1 ห้อง']);
    });

    it('floor-tile: at least one room; each has a type, width and length', () => {
        const room = { code: 'F1' as const, width: 3, length: 0, location: 'ครัว' };
        expect(missingLabels('floor-tile', withCalc(blank(), floorTile, { rows: [room] }))).toEqual(['ครัว — ยาว']);
        expect(missingLabels('floor-tile', withCalc(blank(), floorTile, { rows: [{ ...room, code: '', length: 3 }] }))).toEqual(['ครัว — ชนิดพื้น']);
        expect(missing('floor-tile', withCalc(blank(), floorTile, { rows: [{ ...room, length: 3 }] }))).toEqual([]);
    });

    it('toilet-tile: each started bathroom has its floor and wall sizes', () => {
        const [floorRow, wallRow] = newBathroomRows('ห้องน้ำ 1');
        if (!floorRow || !wallRow) throw new Error('bathroom rows');
        expect(missing('toilet-tile', withCalc(blank(), toiletTile, { rows: [floorRow, wallRow] }))).toEqual([]);
        const half = { rows: [{ ...floorRow, width: 2 }, wallRow] };
        expect(missing('toilet-tile', withCalc(blank(), toiletTile, half))).toEqual([
            { label: 'ห้องน้ำ 1 — ความยาวพื้น', item: 'ห้องน้ำ 1', field: 'ความยาวพื้น', listKey: 'rows', itemIndex: 0, fieldKey: 'length' },
            { label: 'ห้องน้ำ 1 — ความยาวรอบห้อง', item: 'ห้องน้ำ 1', field: 'ความยาวรอบห้อง', listKey: 'rows', itemIndex: 1, fieldKey: 'length' },
            { label: 'ห้องน้ำ 1 — ความสูงกระเบื้องผนัง', item: 'ห้องน้ำ 1', field: 'ความสูงกระเบื้องผนัง', listKey: 'rows', itemIndex: 1, fieldKey: 'height' },
        ]);
        const full = { rows: [{ ...floorRow, width: 2, length: 3 }, { ...wallRow, length: 10, height: 2.4 }] };
        expect(missing('toilet-tile', withCalc(blank(), toiletTile, full))).toEqual([]);
    });

    it('wall-finishing: a moulding has its length, a slat wall its width and height', () => {
        expect(missing('wall-finishing', withCalc(blank(), wallFinishing, { rows: [newMouldingRow(), newSlatRow()] }))).toEqual([]);
        const slat = { ...newSlatRow(), width: 1.5 };
        expect(missingLabels('wall-finishing', withCalc(blank(), wallFinishing, { rows: [newMouldingRow(), slat] })))
            .toEqual(['ผนังระแนงที่ 1 — สูง']);
        expect(missing('wall-finishing', withCalc(blank(), wallFinishing, { rows: [{ ...newMouldingRow(), length: 13 }, { ...slat, length: 2 }] }))).toEqual([]);
    });
});

describe('requiredFields', () => {
    const NONE = ['land-inspection', 'temp-utilities', 'site-camp', 'layout', 'column-plates', 'roof-structure', 'plaster',
        'sanitary-system', 'paint', 'misc'];

    it('names only steps of the journey', () => {
        const ids = new Set(JOURNEY_LEVELS.map(l => l.id));
        for (const id of STEPS_WITH_REQUIREMENTS) expect(ids.has(id), id).toBe(true);
    });

    it('returns keys only for steps with requirements', () => {
        for (const l of JOURNEY_LEVELS) {
            const fields = requiredFields(l.id);
            if (NONE.includes(l.id)) expect(fields.size, l.id).toBe(0);
            else expect(fields.size, l.id).toBeGreaterThan(0);
        }
        expect([...requiredFields('footing')]).toEqual(['count', 'width', 'length', 'depth', 'excavationDepth']);
        expect([...requiredFields('project-info')]).toEqual(['projectName']);
    });

    it('covers every field key a missing value points at', () => {
        expect(reported.size).toBeGreaterThan(10);
        for (const [id, keys] of reported) for (const k of keys) expect(requiredFields(id).has(k), `${id}.${k}`).toBe(true);
    });
});
