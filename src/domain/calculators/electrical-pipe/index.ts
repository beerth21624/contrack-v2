// Sheet "ท่อร้อยสายไฟ_Electrical Pipe" (Excel v5 sheet 08) → BOQ (Home) section 17, row 185.
// R186 วัสดุอุปกรณ์และของใช้สิ้นเปลือง (15 % of J185 + L185) is a BOQ template rule.
// The circuit list kept here is also the circuit list of the cable sheet (sheet 09, calculator `electrical-cable`),
// which reads each circuit's lengths from the outputs below (Excel: Cable!G r = Pipe!E r + G r, H r = F r + H r).
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §4 (oddities D3, D4, D6).
import { defineCalculator, type CalcContext } from '../types';
import { NO_TRACE } from '../../trace/tracer';
import { ELECTRICAL_PIPE_TRACE_LABELS } from './trace.labels';

/** C ขนาด CB — dropdown C6:C29 (informational, no effect on any formula). */
export const BREAKER_SIZES = ['16A.', '20A.', '32A.', '40A.'] as const;
/** D ชนิดท่อ — dropdown D6:D29. I4 adds every circuit whatever the pipe type (oddity D3). */
export const PIPE_TYPES = ['PVC 1/2"', 'PVC 3/4"'] as const;
/** The pipe type BOQ row 185 describes (` - ท่อร้อยสายไฟ ท่อ PVC 1/2"`). */
export const BOQ_PIPE_TYPE = 'PVC 1/2"';

/** Circuit kinds of the guided journey (not an Excel column: they only preset breaker and vertical runs). */
export type CircuitKind = 'light' | 'socket' | 'kitchen-socket' | 'heater' | 'ac' | 'pump' | 'other';

/** One circuit (one row of sheet 08 = the same row of sheet 09). */
export interface Circuit {
    /** Stable key; the cable sheet stores its wire settings under it. Not an Excel column. */
    id: string;
    name: string;      // B วงจร
    breaker: string;   // C ขนาด CB
    pipeType: string;  // D ชนิดท่อ
    mainH: number;     // E แนวราบ · วงจรย่อย (ม.) (สายเมน)
    deviceH: number;   // F แนวราบ · เข้าอุปกรณ์ (ม.)
    mainV: number;     // G แนวดิ่ง · วงจรย่อย (ม.) (สายเมน)
    deviceV: number;   // H แนวดิ่ง · เข้าอุปกรณ์ (ม.)
    // ── Helpers of the guided journey (no effect on any formula; H stays the value that counts) ──
    /** Circuit kind chosen in the journey (missing = guessed from the name, see `circuitKind`). */
    kind?: CircuitKind;
    /** Number of wall drops (switches / sockets): H = points × dropEach (Excel's typed `=7*2.3`). */
    points?: number;
    /** Drop height per point (ม.): 2.3 switches / counter sockets, 3.2 sockets in the Excel sample. */
    dropEach?: number;
}

export interface CircuitKindInfo {
    kind: CircuitKind;
    label: string;
    /** Name a new circuit of this kind starts with (the Excel sample's wording). */
    name: string;
    breaker: string;
    /** G: 1.5 m at the load centre + the rise to a single appliance (Excel sample `=1.5+(1*x)`). */
    mainV: number;
    /** Drop per point for H; undefined = a single appliance (its vertical run is in G, H = 0). */
    dropEach?: number;
    /** What the points of this kind are (plain words for the journey). */
    pointLabel?: string;
}

/** Presets taken from the Excel v5 sample rows (lights 16A, the rest 20A; G and H rules of thumb of column G/H). */
export const CIRCUIT_KINDS: readonly CircuitKindInfo[] = [
    { kind: 'light', label: 'ไฟแสงสว่าง', name: 'แสงสว่าง : ', breaker: '16A.', mainV: 1.5, dropEach: 2.3, pointLabel: 'สวิตช์' },
    { kind: 'socket', label: 'เต้ารับ', name: 'เต้ารับไฟฟ้า : ', breaker: '20A.', mainV: 1.5, dropEach: 3.2, pointLabel: 'เต้ารับ' },
    { kind: 'kitchen-socket', label: 'เต้ารับเหนือเคาน์เตอร์', name: 'เต้ารับไฟฟ้า : ห้องครัว', breaker: '20A.', mainV: 1.5, dropEach: 2.3, pointLabel: 'เต้ารับ' },
    { kind: 'heater', label: 'เครื่องทำน้ำอุ่น', name: 'เครื่องทำน้ำอุ่น : ', breaker: '20A.', mainV: 1.5 + 1 * 1.5 },
    { kind: 'ac', label: 'เครื่องปรับอากาศ', name: 'เครื่องปรับอากาศ ', breaker: '20A.', mainV: 1.5 + 1 * 0.9 },
    { kind: 'pump', label: 'ปั๊มน้ำ', name: 'เครื่องปั๊มน้ำ', breaker: '20A.', mainV: 1.5 + 1 * 2.9 },
    { kind: 'other', label: 'อื่น ๆ', name: '', breaker: '20A.', mainV: 1.5 },
];

export const kindInfo = (kind: CircuitKind | undefined): CircuitKindInfo | undefined =>
    CIRCUIT_KINDS.find(k => k.kind === kind);

/** Kind read from a circuit name (the Excel sample's names, typos included: "ปรับอากาค", "ปั้ม"). */
export function guessCircuitKind(name: string): CircuitKind | undefined {
    const n = name.replace(/\s+/g, '');
    if (n.includes('แสงสว่าง')) return 'light';
    if (n.includes('เต้ารับ') || n.includes('ปลั๊ก')) return n.includes('ครัว') ? 'kitchen-socket' : 'socket';
    if (n.includes('น้ำอุ่น')) return 'heater';
    if (n.includes('ปรับอากา') || n.includes('แอร์')) return 'ac';
    if (n.includes('ปั๊ม') || n.includes('ปั้ม')) return 'pump';
    return undefined;
}

export interface ElectricalPipeInput {
    /** Excel rows 6–29 (24 lines, 14 used, only 6–19 summed — oddity D6); decision D5: unlimited, all summed. */
    circuits: Circuit[];
}

const num = (v: number) => (Number.isFinite(v) ? v : 0);

/** I รวม (ม.) = SUM(E:H). */
export const circuitTotal = (c: Circuit) => num(c.mainH) + num(c.deviceH) + num(c.mainV) + num(c.deviceV);
/** Cable sheet G ความยาวสาย วงจรย่อย (สายเมน) = Pipe E + G. */
export const circuitMainLength = (c: Circuit) => num(c.mainH) + num(c.mainV);
/** Cable sheet H ความยาวสาย เข้าอุปกรณ์ = Pipe F + H. */
export const circuitDeviceLength = (c: Circuit) => num(c.deviceH) + num(c.deviceV);

/** Output keys of one circuit (read by the cable sheet). */
export const circuitKey = (id: string, field: 'main' | 'device' | 'total') => `circuit|${id}|${field}`;
const CIRCUIT_KEY = /^circuit\|(.+)\|(main|device)$/;

/** Conduit length by pipe type (output key). */
export const pipeTypeKey = (type: string) => `pipe|${type.trim()}`;

/**
 * An id not used by any of `circuits`. Random rather than sequential, so a new circuit never picks up the cable
 * settings the cable sheet still holds for a deleted one.
 */
export function newCircuitId(circuits: readonly Circuit[]): string {
    const used = new Set(circuits.map(c => c.id));
    let id = '';
    while (id === '' || used.has(id)) id = `c-${Math.random().toString(36).slice(2, 10)}`;
    return id;
}

/** A blank circuit row (like Excel rows 20–29), with a fresh id. */
export const newCircuit = (circuits: readonly Circuit[]): Circuit => ({
    id: newCircuitId(circuits), name: '', breaker: '', pipeType: '', mainH: 0, deviceH: 0, mainV: 0, deviceV: 0,
});

/** The circuit's kind: chosen, else guessed from its name. */
export const circuitKind = (c: Circuit): CircuitKind | undefined => c.kind ?? guessCircuitKind(c.name);

/** Does this circuit count wall drops (points × drop)? Single appliances do not. */
export const hasPoints = (c: Circuit): boolean => {
    const k = circuitKind(c);
    return k === undefined || kindInfo(k)?.dropEach !== undefined || c.points !== undefined;
};

/** Sets the number of points; H = points × drop per point (drop: the row's, else its kind's, else 0). */
export function setPoints(c: Circuit, points: number): Circuit {
    const dropEach = c.dropEach ?? kindInfo(circuitKind(c))?.dropEach ?? 0;
    return { ...c, points, dropEach, deviceV: num(points) * num(dropEach) };
}

/** Sets the drop per point; H follows when the number of points is known. */
export function setDropEach(c: Circuit, dropEach: number): Circuit {
    return c.points === undefined ? { ...c, dropEach } : { ...c, dropEach, deviceV: num(c.points) * num(dropEach) };
}

/** Types H directly: the points helper no longer describes it, so it is dropped. */
export function setDeviceV(c: Circuit, deviceV: number): Circuit {
    const { points: _points, ...rest } = c;
    return { ...rest, deviceV };
}

/**
 * Chooses a kind: breaker, G and the drop per point follow the preset (H recomputed from the points);
 * a single appliance has no wall drops (H = 0). An empty name gets the kind's name.
 */
export function applyKind(c: Circuit, kind: CircuitKind): Circuit {
    const k = kindInfo(kind);
    if (!k) return c;
    // A name that is still only a kind's preset name follows the new kind.
    const presetName = c.name.trim() === '' || CIRCUIT_KINDS.some(x => x.name.trim() !== '' && x.name.trim() === c.name.trim());
    const base: Circuit = { ...c, kind, breaker: k.breaker, mainV: k.mainV, name: presetName ? k.name : c.name };
    if (k.dropEach === undefined) {
        const { points: _points, dropEach: _dropEach, ...rest } = base;
        return { ...rest, deviceV: 0 };
    }
    const next = { ...base, dropEach: k.dropEach };
    return next.points === undefined ? next : setPoints(next, next.points);
}

/** Circuits per breaker size, and wall points of light circuits (switches) and socket circuits (sockets). */
export function circuitSummary(circuits: readonly Circuit[]): { byBreaker: Record<string, number>; switches: number; sockets: number } {
    const byBreaker: Record<string, number> = {};
    let switches = 0, sockets = 0;
    for (const c of circuits) {
        const b = c.breaker.trim();
        if (b !== '') byBreaker[b] = (byBreaker[b] ?? 0) + 1;
        const k = circuitKind(c);
        const p = num(c.points ?? 0);
        if (k === 'light') switches += p;
        else if (k === 'socket' || k === 'kitchen-socket') sockets += p;
    }
    return { byBreaker, switches, sockets };
}

/** A new circuit of a kind (journey "+ เพิ่มวงจร…"): lengths 0, presets of the kind. */
export const newCircuitOfKind = (circuits: readonly Circuit[], kind: CircuitKind): Circuit =>
    applyKind({ ...newCircuit(circuits), pipeType: BOQ_PIPE_TYPE }, kind);

export interface CircuitLengths {
    id: string;
    main: number;    // Cable G
    device: number;  // Cable H
}

/** Each circuit's cable lengths, in circuit order, from the pipe sheet's outputs (none → []). */
export function circuitLengths(ctx: CalcContext): CircuitLengths[] {
    const byId = new Map<string, CircuitLengths>();
    for (const [k, v] of Object.entries(ctx.outputs('electrical-pipe') ?? {})) {
        const m = CIRCUIT_KEY.exec(k);
        if (!m) continue;
        const [, id = '', field] = m;
        const row = byId.get(id) ?? { id, main: 0, device: 0 };
        if (field === 'main') row.main = num(v); else row.device = num(v);
        byId.set(id, row);
    }
    return [...byId.values()];
}

const circuit = (
    n: number, name: string, breaker: string, mainH: number, deviceH: number, mainV: number, deviceV: number,
    /** [points, drop per point] of H's typed arithmetic `=points*drop` (journey helper; H keeps the Excel value). */
    drops?: readonly [number, number],
): Circuit => ({
    id: `c${n}`, name, breaker, pipeType: 'PVC 1/2"', mainH, deviceH, mainV, deviceV,
    ...(drops ? { points: drops[0], dropEach: drops[1] } : {}),
});

export const electricalPipe = defineCalculator<ElectricalPipeInput>({
    id: 'electrical-pipe',
    sheetName: 'ท่อร้อยสายไฟ_Electrical Pipe',
    title: 'โปรแกรมถอดแบบ – งานท่อร้อยสายไฟ Electrical Pipe',
    titleEn: 'Electrical Conduit',
    sections: [17],
    deps: [],
    // A real project starts with no circuits: they are read off the electrical plan / load schedule.
    blank: () => ({ circuits: [] }),
    defaults: () => ({
        // Rows 6–19 verbatim (typos included). Rows 20–29 of the Excel are blank and not carried over.
        // G/H: the yellow cells hold arithmetic; their values are the defaults (Excel formula in the comment):
        // "points × drop height" (2.3 m lights / kitchen sockets, 3.2 m sockets) and "1.5 + rise to the device".
        circuits: [
            circuit(1, 'แสงสว่าง : ห้องนอน , ห้องน้ำ', '16A.', 22.4, 25.6, 1.5, 16.1, [7, 2.3]),                     // H =7*2.3
            circuit(2, 'แสงสว่าง : ห้องนั้งเล่น , ห้องทานอาหาร , ครัว , ภายนอก', '16A.', 24.5, 27.5, 1.5, 25.3, [11, 2.3]), // H =11*2.3
            circuit(3, 'เต้ารับไฟฟ้า : ห้องนอน 1,2,3', '20A.', 27.4, 0, 1.5, 28.8, [9, 3.2]),                         // H =9*3.2
            circuit(4, 'เต้ารับไฟฟ้า : ห้องนั่งเล่น , ห้องทานอาหาร', '20A.', 21, 0, 1.5, 12.8, [4, 3.2]),                 // H =4*3.2
            circuit(5, 'เต้ารับไฟฟ้า : ห้องน้ำ , เครื่องซักผ้า , ภายนอก', '20A.', 20, 0, 1.5, 6.4, [2, 3.2]),             // H =2*3.2
            circuit(6, 'เครื่องทำน้ำอุ่น : ห้องน้ำ 1', '20A.', 12, 0, 3, 0),                                    // G =1.5+(1*1.5)
            circuit(7, 'เครื่องทำน้ำอุ่น : ห้องน้ำ 2', '20A.', 3, 0, 3, 0),                                     // G =1.5+(1*1.5)
            circuit(8, 'เครื่องปรับอากาศห้องนอน 1 (12,000 BTU)', '20A.', 17, 0, 2.4, 0),                         // G =1.5+(1*0.9)
            circuit(9, 'เครื่องปรับอากาคห้องนอน 2 (12,000 BTU)', '20A.', 11, 0, 2.4, 0),                         // G =1.5+(1*0.9)
            circuit(10, 'เครื่องปรับอากาคห้องนอน 3 (9,000 BTU)', '20A.', 7, 0, 2.4, 0),                          // G =1.5+(1*0.9)
            circuit(11, 'เครื่องปรับอากาคห้องรับแขก (15,000 BTU)', '20A.', 7, 0, 1.8, 0),                        // G =1.5+(1*0.3)
            circuit(12, 'เครื่องปรับอากาคห้องทานอาหาร (9,000 BTบ)', '20A.', 8, 0, 1.8, 0),                       // G =1.5+(1*0.3)
            circuit(13, 'เครื่องปั้มน้ำ', '20A.', 5, 0, 4.4, 0),                                               // G =1.5+(1*2.9)
            circuit(14, 'เต้ารับไฟฟ้า : ห้องครัว', '20A.', 5, 0, 1.5, 6.9, [3, 2.3]),                                   // H =3*2.3
        ],
    }),
    compute: (input, _ctx, tr = NO_TRACE) => {
        // I4 = SUM(I6:I29); every circuit is summed (Excel has no I formula on rows 20–29 — D1/D6).
        const total = input.circuits.reduce((s, c) => s + circuitTotal(c), 0);
        const out: Record<string, number> = { total, R185: total, 'circuit.count': input.circuits.length };
        for (const c of input.circuits) {
            out[circuitKey(c.id, 'main')] = circuitMainLength(c);
            out[circuitKey(c.id, 'device')] = circuitDeviceLength(c);
            out[circuitKey(c.id, 'total')] = circuitTotal(c);
            const t = pipeTypeKey(c.pipeType);
            out[t] = (out[t] ?? 0) + circuitTotal(c);
        }
        if (tr.enabled) {
            const per = input.circuits.map((c, i) => tr.row(i, c.name || `#${i + 1}`, () => {
                const ops = { mainH: num(c.mainH), deviceH: num(c.deviceH), mainV: num(c.mainV), deviceV: num(c.deviceV) };
                tr.step('mainLen', circuitMainLength(c), { mainH: ops.mainH, mainV: ops.mainV });
                tr.step('deviceLen', circuitDeviceLength(c), { deviceH: ops.deviceH, deviceV: ops.deviceV });
                const v = circuitTotal(c);
                tr.step('circuitTotal', v, ops);
                return v;
            }));
            tr.step('total', total, { circuitTotal: per });
            tr.step('toBoq', total, { total });
            tr.step('count', input.circuits.length, {});
            const types = [...new Set(input.circuits.map(c => c.pipeType.trim()))];
            for (const type of types) {
                tr.step('pipeType', out[pipeTypeKey(type)] ?? 0,
                    { circuitTotal: per.filter((_, i) => input.circuits[i]?.pipeType.trim() === type) }, { params: { type: type || '-' } });
            }
        }
        return out;
    },
    traceLabels: ELECTRICAL_PIPE_TRACE_LABELS,
    boqLinks: [{ line: 'R185', field: 'qty', output: 'R185' }],
});
