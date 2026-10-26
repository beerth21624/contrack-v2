// ─── Required plan values of each journey step (docs/rebuild/REQUIRED_FIELDS.md, decision 2026-10-26) ───
// A value is required only when leaving it empty makes the BOQ silently wrong. Two kinds of requirement:
//  1. "at least one item" in steps every house has (footings, columns, walls …);
//  2. "complete rows": a row / card that holds any plan value must have its few key values.
// A row with no plan value at all (just added) is ignored: it is not incomplete, and it is not an item either.
// "Holds a plan value" follows each journey card's own started test (values pre-filled or copied from the previous
// row, e.g. a standard bar size or the previous wall's height, do not count), so the list matches the red cards.
// Pure: the UI shows the list, marks `*` on `requiredFields`, and highlights cards by `listKey` / `itemIndex` / `fieldKey`.
import { calculatorInput, type Project } from '../project';
import { brick } from '../calculators/brick';
import { ceiling, type CeilingRow } from '../calculators/ceiling';
import { column } from '../calculators/column';
import { demolition } from '../calculators/demolition';
import { doorWindow, itemCode, type OpeningRow } from '../calculators/door-window';
import { cableRows, electricalCable, WIRE_SIZES } from '../calculators/electrical-cable';
import { electricalEquipment } from '../calculators/electrical-equipment';
import { electricalPipe } from '../calculators/electrical-pipe';
import { fill } from '../calculators/fill';
import { floorTile } from '../calculators/floor-tile';
import { footing } from '../calculators/footing';
import { groundBeam } from '../calculators/ground-beam';
import { loadCenter } from '../calculators/load-center';
import { pedestal } from '../calculators/pedestal';
import { piles } from '../calculators/piles';
import { precastSlab } from '../calculators/precast-slab';
import { roofBeam } from '../calculators/roof-beam';
import { roofSlab } from '../calculators/roof-slab';
import { roofing } from '../calculators/roofing';
import { sanitaryWare } from '../calculators/sanitary-ware';
import { boqRows, type PickListInput } from '../calculators/shared/pick-list';
import { slabOnGrade } from '../calculators/slab-on-grade';
import { stair } from '../calculators/stair';
import { bathroomGroups, toiletRowKind, toiletTile } from '../calculators/toilet-tile';
import { wallFinishing, wallFinishingKind, wallFinishingLength } from '../calculators/wall-finishing';
import { runLength, type PipeRunsInput } from '../calculators/waste-pipe/pipe-runs';
import { wastePipe } from '../calculators/waste-pipe';
import { waterPipe } from '../calculators/water-pipe';
import type { CalculatorDef } from '../calculators/types';

/** One required value that is still empty (or a missing "at least one" item). */
export interface MissingValue {
    /** Short professional Thai shown in the list: "ฐานราก F2 — จำนวนฐานแบบนี้", "เพิ่มฐานรากอย่างน้อย 1 รายการ". */
    label: string;
    /** Name of the card / row (as its card title), when the value belongs to one. */
    item?: string;
    /** Field label as shown on the card. */
    field?: string;
    /** Input list that holds the row (e.g. 'rows', 'beams', 'doors', 'windows', 'circuits'). */
    listKey?: string;
    /** 0-based index of the row in that list. */
    itemIndex?: number;
    /** Stable id of the row where rows have one (the circuit id on the cable step). */
    itemKey?: string;
    /** Key of the input field (e.g. 'count', 'width', 'projectName'). Absent on "at least one" items. */
    fieldKey?: string;
}

// ─── Helpers ───

/** A dimension or count is filled when it is a finite number > 0. */
const filled = (v: number | undefined): boolean => v !== undefined && Number.isFinite(v) && v > 0;
/** A text is filled when it is not blank. */
const hasText = (s: string | undefined): boolean => s !== undefined && s.trim() !== '';

interface Check { fieldKey: string; field: string; ok: boolean }
const check = (fieldKey: string, field: string, ok: boolean): Check => ({ fieldKey, field, ok });

/** Required values of a single form (no rows): label = the field label. */
function formMissing(checks: readonly Check[]): MissingValue[] {
    return checks.filter(c => !c.ok).map(c => ({ label: c.field, field: c.field, fieldKey: c.fieldKey }));
}

interface RowRef { listKey: string; itemIndex: number; item: string; itemKey?: string }

function rowMissing(ref: RowRef, checks: readonly Check[]): MissingValue[] {
    return checks.filter(c => !c.ok).map(c => ({
        label: `${ref.item} — ${c.field}`,
        item: ref.item,
        field: c.field,
        listKey: ref.listKey,
        itemIndex: ref.itemIndex,
        ...(ref.itemKey === undefined ? {} : { itemKey: ref.itemKey }),
        fieldKey: c.fieldKey,
    }));
}

/** Card titles made unique: a title used by more than one row gets its position ("คาน B5 (ลำดับที่ 2)"). */
function uniqueTitles(titles: readonly string[]): string[] {
    const count = new Map<string, number>();
    for (const t of titles) count.set(t, (count.get(t) ?? 0) + 1);
    return titles.map((t, i) => ((count.get(t) ?? 0) > 1 ? `${t} (ลำดับที่ ${String(i + 1)})` : t));
}

interface ListRule<R> {
    listKey: string;
    rows: readonly R[];
    /** Card title of a row (as the journey card shows it). */
    title: (r: R, i: number) => string;
    /** The row holds a plan value typed by the user (else it is ignored). */
    started: (r: R) => boolean;
    checks: (r: R, i: number) => Check[];
}

interface ListResult { missing: MissingValue[]; items: number }

/** Complete-rows rule over one list; `items` = rows that count as an item (started). */
function listMissing<R>(rule: ListRule<R>): ListResult {
    const titles = uniqueTitles(rule.rows.map(rule.title));
    let items = 0;
    const missing = rule.rows.flatMap((r, i) => {
        if (!rule.started(r)) return [];
        items++;
        return rowMissing({ listKey: rule.listKey, itemIndex: i, item: titles[i] ?? '' }, rule.checks(r, i));
    });
    return { missing, items };
}

/** Complete rows, plus "at least one" when no row counts as an item. */
function atLeastOne<R>(label: string, rule: ListRule<R>): MissingValue[] {
    const r = listMissing(rule);
    return r.items === 0 ? [{ label }] : r.missing;
}

/** A card title: `prefix + name`, or `fallback n` while the row has no name. */
const named = (name: string, i: number, fallback: string, prefix = ''): string =>
    (name.trim() === '' ? `${fallback} ${String(i + 1)}` : `${prefix}${name.trim()}`);

const input = <I>(project: Project, def: CalculatorDef<I>): I => calculatorInput(project, def);

/** Pick-list steps: at least one row with an item and a quantity > 0 (a row that reaches the BOQ). */
const pickListMissing = (list: PickListInput, label: string): MissingValue[] =>
    (boqRows(list.items).length > 0 ? [] : [{ label }]);

/** Pipe-run steps: at least one run (fixed or extra row) with a length > 0. */
const pipeRunsMissing = (runs: PipeRunsInput, label: string): MissingValue[] =>
    (runs.runs.some(r => filled(runLength(r))) ? [] : [{ label }]);

// ─── Rules per step ───

interface StepRule {
    /** Field keys marked `*` on screen. */
    fields: readonly string[];
    missing(project: Project): MissingValue[];
}

const WIRE_SIZE_SET: ReadonlySet<string> = new Set(WIRE_SIZES);

const RULES: Record<string, StepRule> = {
    'project-info': {
        fields: ['projectName'],
        missing: p => formMissing([check('projectName', 'ชื่อโครงการ', hasText(p.meta.projectName))]),
    },

    // Optional step. Each item with a quantity has a rate (else it costs 0).
    demolition: {
        fields: ['rate'],
        missing: p => listMissing({
            listKey: 'items',
            rows: input(p, demolition).items,
            title: (l, i) => (l.label.trim() === '' ? `รายการที่ ${String(i + 1)}` : l.label.trim()),
            started: l => filled(l.qty),
            checks: l => [check('rate', 'ค่ารื้อต่อหน่วย', filled(l.rate))],
        }).missing,
    },

    // Optional step, one form: an untouched form is ignored like an empty row.
    fill: {
        fields: ['width', 'length', 'height'],
        missing: p => {
            const f = input(p, fill);
            if (![f.width, f.length, f.height].some(filled)) return [];
            return formMissing([
                check('width', 'ความกว้างพื้นที่ถม', filled(f.width)),
                check('length', 'ความยาวพื้นที่ถม', filled(f.length)),
                check('height', 'ความสูงถม', filled(f.height)),
            ]);
        },
    },

    // Optional step, one form (labels as `missingPileSpec`).
    piles: {
        fields: ['pileType', 'section', 'length', 'count'],
        missing: p => {
            const f = input(p, piles);
            if (!(hasText(f.pileType) || hasText(f.section) || filled(f.length) || filled(f.count))) return [];
            return formMissing([
                check('pileType', 'ชนิดเสาเข็ม', hasText(f.pileType)),
                check('section', 'หน้าตัด/รูปทรง', hasText(f.section)),
                check('length', 'ความยาว', filled(f.length)),
                check('count', 'จำนวนต้น', filled(f.count)),
            ]);
        },
    },

    footing: {
        fields: ['count', 'width', 'length', 'depth', 'excavationDepth'],
        missing: p => atLeastOne('เพิ่มฐานรากอย่างน้อย 1 รายการ', {
            listKey: 'rows',
            rows: input(p, footing).rows,
            title: (r, i) => `ฐานราก ${named(r.name, i, 'แบบที่')}`,
            started: r => [r.count, r.width, r.length, r.depth, r.excavationDepth, r.shortBarCount, r.longBarCount, r.ringBarCount].some(filled),
            checks: r => [
                check('count', 'จำนวนฐานแบบนี้', filled(r.count)),
                check('width', 'ความกว้าง', filled(r.width)),
                check('length', 'ความยาว', filled(r.length)),
                check('depth', 'ความหนาฐาน', filled(r.depth)),
                check('excavationDepth', 'ความลึกหลุมขุด', filled(r.excavationDepth)),
            ],
        }),
    },

    // No "at least one": each pedestal type is complete (count starts from its footing's count).
    pedestal: {
        fields: ['footing', 'count', 'width', 'length', 'height'],
        missing: p => {
            const footings = input(p, footing).rows.length;
            return listMissing({
                listKey: 'rows',
                rows: input(p, pedestal).rows,
                title: (r, i) => `เสาตอม่อ ${named(r.name, i, 'แบบที่')}`,
                started: r => [r.width, r.length, r.height, r.mainBarCount].some(filled),
                checks: r => [
                    check('footing', 'ตั้งอยู่บนฐานราก', Number.isInteger(r.footing) && r.footing >= 0 && r.footing < footings),
                    check('count', 'จำนวนต้น', filled(r.count)),
                    check('width', 'ความกว้าง', filled(r.width)),
                    check('length', 'ความยาว', filled(r.length)),
                    check('height', 'ความสูง', filled(r.height)),
                ],
            }).missing;
        },
    },

    'ground-beam': {
        fields: ['width', 'depth', 'length'],
        missing: p => atLeastOne('เพิ่มคานคอดินอย่างน้อย 1 รายการ', {
            listKey: 'beams',
            rows: input(p, groundBeam).beams,
            title: (r, i) => `คานคอดิน ${named(r.name, i, 'แบบที่')}`,
            started: r => [r.length, r.width, r.depth, r.mainCount].some(filled),
            checks: r => [
                check('width', 'ความกว้าง', filled(r.width)),
                check('depth', 'ความลึก', filled(r.depth)),
                check('length', 'ความยาวรวมทุกช่วง', filled(r.length)),
            ],
        }),
    },

    // A new panel copies the previous thickness, so it counts once a size is typed.
    'slab-on-grade': {
        fields: ['width', 'length', 'thickness'],
        missing: p => atLeastOne('เพิ่มพื้นหล่อในที่อย่างน้อย 1 ผืน', {
            listKey: 'slabs',
            rows: input(p, slabOnGrade).slabs,
            title: (_, i) => `ผืนที่ ${String(i + 1)}`,
            started: r => filled(r.width) || filled(r.length),
            checks: r => [
                check('width', 'ความกว้าง', filled(r.width)),
                check('length', 'ความยาว', filled(r.length)),
                check('thickness', 'ความหนา', filled(r.thickness)),
            ],
        }),
    },

    'precast-slab': {
        fields: ['width', 'length'],
        missing: p => listMissing({
            listKey: 'panels',
            rows: input(p, precastSlab).panels,
            title: (_, i) => `ช่วงที่ ${String(i + 1)}`,
            started: r => filled(r.width) || filled(r.length),
            checks: r => [
                check('width', 'ความกว้างช่วง', filled(r.width)),
                check('length', 'ความยาวช่วง', filled(r.length)),
            ],
        }).missing,
    },

    // A new column type copies the previous height, so it counts once count or size is typed.
    column: {
        fields: ['count', 'width', 'depth', 'height'],
        missing: p => atLeastOne('เพิ่มเสาอย่างน้อย 1 รายการ', {
            listKey: 'columns',
            rows: input(p, column).columns,
            title: (r, i) => `เสา ${named(r.name, i, 'แบบที่')}`,
            started: r => [r.count, r.width, r.depth].some(filled),
            checks: r => [
                check('count', 'จำนวนต้น', filled(r.count)),
                check('width', 'ความกว้าง', filled(r.width)),
                check('depth', 'ความยาว', filled(r.depth)),
                check('height', 'ความสูงเสา', filled(r.height)),
            ],
        }),
    },

    'roof-beam': {
        fields: ['width', 'depth', 'length'],
        missing: p => atLeastOne('เพิ่มคานดาดฟ้า / คานหลังคาอย่างน้อย 1 รายการ', {
            listKey: 'rows',
            rows: input(p, roofBeam).rows,
            title: (r, i) => named(r.name, i, 'คานที่', 'คาน '),
            started: r => [r.length, r.width, r.depth, r.mainCount].some(filled),
            checks: r => [
                check('width', 'ความกว้าง', filled(r.width)),
                check('depth', 'ความลึก', filled(r.depth)),
                check('length', 'ความยาวรวม', filled(r.length)),
            ],
        }),
    },

    'roof-slab': {
        fields: ['width', 'length', 'thickness'],
        missing: p => listMissing({
            listKey: 'rows',
            rows: input(p, roofSlab).rows,
            title: (_, i) => `ผืนที่ ${String(i + 1)}`,
            started: r => filled(r.width) || filled(r.length),
            checks: r => [
                check('width', 'ความกว้าง', filled(r.width)),
                check('length', 'ความยาว', filled(r.length)),
                check('thickness', 'ความหนา', filled(r.thickness)),
            ],
        }).missing,
    },

    stair: {
        fields: ['steps', 'width'],
        missing: p => listMissing({
            listKey: 'rows',
            rows: input(p, stair).rows,
            title: (r, i) => named(r.name, i, 'บันได'),
            started: r => [r.steps, r.riser, r.tread, r.width, r.waist, r.rise, r.run].some(filled),
            checks: r => [
                check('steps', 'จำนวนขั้น', filled(r.steps)),
                check('width', 'ความกว้างบันได', filled(r.width)),
            ],
        }).missing,
    },

    // Every house has a roof: the roof size and pitch are always required.
    roofing: {
        fields: ['planArea', 'slopeDeg'],
        missing: p => {
            const f = input(p, roofing);
            return formMissing([
                check('planArea', 'พื้นที่หลังคาตามแนวราบ', filled(f.planArea)),
                check('slopeDeg', 'ความชันหลังคา', filled(f.slopeDeg)),
            ]);
        },
    },

    // Doors and windows are two lists of one schedule; "at least one opening" counts both.
    'door-window': {
        fields: ['width', 'height', 'count'],
        missing: p => {
            const dw = input(p, doorWindow);
            const block = (listKey: 'doors' | 'windows', noun: string) => listMissing<OpeningRow>({
                listKey,
                rows: dw[listKey],
                title: (r, i) => {
                    const code = itemCode(r.name);
                    return code === '' ? `${noun}ที่ ${String(i + 1)}` : `${noun} ${code}`;
                },
                // A new opening starts with 1 บาน, so it counts once a size is typed.
                started: r => filled(r.width) || filled(r.height),
                checks: r => [
                    check('width', 'ความกว้าง', filled(r.width)),
                    check('height', 'ความสูง', filled(r.height)),
                    check('count', 'จำนวน', filled(r.count)),
                ],
            });
            const doors = block('doors', 'ประตู');
            const windows = block('windows', 'หน้าต่าง');
            return doors.items + windows.items === 0
                ? [{ label: 'เพิ่มประตูหรือหน้าต่างอย่างน้อย 1 รายการ' }]
                : [...doors.missing, ...windows.missing];
        },
    },

    // A new wall copies the previous height, so it counts once its length is typed.
    brick: {
        fields: ['length', 'height'],
        missing: p => atLeastOne('เพิ่มผนังก่ออิฐอย่างน้อย 1 รายการ', {
            listKey: 'walls',
            rows: input(p, brick).walls,
            title: (_, i) => `ผนังที่ ${String(i + 1)}`,
            started: w => filled(w.length),
            checks: w => [
                check('length', 'ความยาว', filled(w.length)),
                check('height', 'ความสูง', filled(w.height)),
            ],
        }),
    },

    // A new circuit has its kind's vertical run preset, so it counts once a horizontal run or a point is typed.
    'electrical-pipe': {
        fields: ['mainH'],
        missing: p => atLeastOne('เพิ่มวงจรไฟฟ้าอย่างน้อย 1 วงจร', {
            listKey: 'circuits',
            rows: input(p, electricalPipe).circuits,
            title: (c, i) => (c.name.trim() === '' ? `วงจรที่ ${String(i + 1)}` : c.name.trim()),
            started: c => filled(c.mainH) || filled(c.deviceH) || filled(c.points),
            checks: c => [check('mainH', 'ท่อสายเมน', filled(c.mainH))],
        }),
    },

    // Every circuit with conduit has its cable chosen: no metres left unassigned (cableRows' `unassigned`).
    'electrical-cable': {
        fields: ['mainSize', 'deviceSize', 'conductors'],
        missing: p => {
            if (p.journey?.['electrical-pipe'] === 'skipped') return [];
            const circuits = input(p, electricalPipe).circuits;
            const pipeOutputs = electricalPipe.compute({ circuits }, { outputs: () => undefined });
            const rows = cableRows(input(p, electricalCable), { outputs: id => (id === electricalPipe.id ? pipeOutputs : undefined) });
            const byId = new Map(rows.map(r => [r.id, r]));
            const titles = uniqueTitles(circuits.map((c, i) => (c.name.trim() === '' ? `วงจรที่ ${String(i + 1)}` : c.name.trim())));
            return circuits.flatMap((c, i) => {
                const r = byId.get(c.id);
                if (r === undefined || !filled(r.main + r.device) || !(r.unassigned > 0)) return [];
                return rowMissing({ listKey: 'circuits', itemIndex: i, itemKey: c.id, item: titles[i] ?? '' }, [
                    check('mainSize', 'สายเมนวงจร', !filled(r.main) || WIRE_SIZE_SET.has(r.wiring.mainSize.trim())),
                    check('deviceSize', 'สายเข้าโคม / จุด', !filled(r.device) || WIRE_SIZE_SET.has(r.wiring.deviceSize.trim())),
                    check('conductors', 'จำนวนสาย', filled(r.wiring.conductors)),
                ]);
            });
        },
    },

    'load-center': {
        fields: ['item', 'qty'],
        missing: p => pickListMissing(input(p, loadCenter), 'ระบุอุปกรณ์ตู้ควบคุมไฟฟ้าพร้อมจำนวนอย่างน้อย 1 รายการ'),
    },
    'electrical-equipment': {
        fields: ['item', 'qty'],
        missing: p => pickListMissing(input(p, electricalEquipment), 'ระบุอุปกรณ์ไฟฟ้าพร้อมจำนวนอย่างน้อย 1 รายการ'),
    },

    // "At least one run": no single field is required, so the * goes on the section title (PipeRunsJourney).
    'waste-pipe': {
        fields: [],
        missing: p => pipeRunsMissing(input(p, wastePipe), 'กรอกความยาวท่อน้ำทิ้งอย่างน้อย 1 แนว'),
    },
    'water-pipe': {
        fields: [],
        missing: p => pipeRunsMissing(input(p, waterPipe), 'กรอกความยาวท่อน้ำดีอย่างน้อย 1 แนว'),
    },

    'sanitary-ware': {
        fields: ['item', 'qty'],
        missing: p => pickListMissing(input(p, sanitaryWare), 'ระบุสุขภัณฑ์พร้อมจำนวนอย่างน้อย 1 รายการ'),
    },

    // A new room already has a type, so it counts once a size is typed. The eaves (C3) use the card's own words.
    ceiling: {
        fields: ['code', 'width', 'length'],
        missing: p => atLeastOne('เพิ่มฝ้าเพดานอย่างน้อย 1 ห้อง', {
            listKey: 'rows',
            rows: input(p, ceiling).rows,
            title: (r, i) => (r.location.trim() === '' ? `ห้องที่ ${String(i + 1)}` : r.location.trim()),
            started: r => filled(r.width) || filled(r.length),
            checks: (r: CeilingRow) => [
                check('code', 'ชนิดฝ้า', r.code !== ''),
                check('width', r.code === 'C3' ? 'ระยะยื่นชายคา' : 'กว้าง', filled(r.width)),
                check('length', r.code === 'C3' ? 'ความยาวรอบชายคา' : 'ยาว', filled(r.length)),
            ],
        }),
    },

    'floor-tile': {
        fields: ['code', 'width', 'length'],
        missing: p => atLeastOne('เพิ่มพื้นปูกระเบื้องอย่างน้อย 1 ห้อง', {
            listKey: 'rows',
            rows: input(p, floorTile).rows,
            title: (r, i) => (r.location.trim() === '' ? `ห้องที่ ${String(i + 1)}` : r.location.trim()),
            started: r => filled(r.width) || filled(r.length),
            checks: r => [
                check('code', 'ชนิดพื้น', r.code !== ''),
                check('width', 'กว้าง', filled(r.width)),
                check('length', 'ยาว', filled(r.length)),
            ],
        }),
    },

    // One card per bathroom (rows sharing a ตำแหน่ง): once any of its rows has a size, its floor rows need
    // width and length and its wall rows the room perimeter and tile height.
    'toilet-tile': {
        fields: ['width', 'length', 'height'],
        missing: p => {
            const t = input(p, toiletTile);
            return bathroomGroups(t).flatMap((g, gi) => {
                const rows = g.rows.flatMap(i => {
                    const r = t.rows[i];
                    return r === undefined ? [] : [{ r, i }];
                });
                if (!rows.some(({ r }) => [r.width, r.length, r.height].some(filled))) return [];
                const item = g.name === '' ? `ห้องน้ำที่ ${String(gi + 1)}` : g.name;
                return rows.flatMap(({ r, i }) => {
                    const ref = { listKey: 'rows', itemIndex: i, item };
                    const kind = toiletRowKind(r);
                    if (kind === 'floor') {
                        return rowMissing(ref, [
                            check('width', 'ความกว้างพื้น', filled(r.width)),
                            check('length', 'ความยาวพื้น', filled(r.length)),
                        ]);
                    }
                    if (kind === 'wall') {
                        return rowMissing(ref, [
                            check('length', 'ความยาวรอบห้อง', filled(r.length)),
                            check('height', 'ความสูงกระเบื้องผนัง', filled(r.height)),
                        ]);
                    }
                    return [];
                });
            });
        },
    },

    // Optional step. A moulding needs its length (F = D + E), a slat wall its width and height (D × E).
    'wall-finishing': {
        fields: ['width', 'length'],
        missing: p => {
            const rows = input(p, wallFinishing).rows;
            const nth = { moulding: 0, slat: 0, other: 0 };
            const titles = uniqueTitles(rows.map(r => {
                const kind = wallFinishingKind(r);
                nth[kind]++;
                if (r.location.trim() !== '') return r.location.trim();
                return `${kind === 'moulding' ? 'บัวที่' : kind === 'slat' ? 'ผนังระแนงที่' : 'รายการที่'} ${String(nth[kind])}`;
            }));
            return rows.flatMap((r, i) => {
                if (!(filled(r.width) || filled(r.length))) return [];
                const ref = { listKey: 'rows', itemIndex: i, item: titles[i] ?? '' };
                const kind = wallFinishingKind(r);
                if (kind === 'moulding') return rowMissing(ref, [check('length', 'ความยาว', filled(wallFinishingLength(r) ?? 0))]);
                if (kind === 'slat') {
                    return rowMissing(ref, [
                        check('width', 'กว้าง', filled(r.width)),
                        check('length', 'สูง', filled(r.length)),
                    ]);
                }
                return [];
            });
        },
    },
};

const NO_FIELDS: ReadonlySet<string> = new Set();
const FIELD_SETS = new Map<string, ReadonlySet<string>>(Object.entries(RULES).map(([id, r]) => [id, new Set(r.fields)]));

/**
 * What still has to be filled before the step can be completed (`[]` = it can be completed). A step marked
 * "ไม่มีในโครงการนี้" (skipped) has no requirements; so does a step the decision table lists none for.
 */
export function missingRequirements(levelId: string, project: Project): MissingValue[] {
    if (project.journey?.[levelId] === 'skipped') return [];
    const rule = RULES[levelId];
    return rule === undefined ? [] : rule.missing(project);
}

/** Field keys of the step's input to mark with `*` (empty for a step with no requirement). */
export function requiredFields(levelId: string): ReadonlySet<string> {
    return FIELD_SETS.get(levelId) ?? NO_FIELDS;
}

/** Steps that have requirements (the decision table rows that are not "—"). */
export const STEPS_WITH_REQUIREMENTS: readonly string[] = Object.keys(RULES);
