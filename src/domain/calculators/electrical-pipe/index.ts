// Sheet "ท่อร้อยสายไฟ_Electrical Pipe" (Excel v5 sheet 08) → BOQ (Home) section 17, row 185.
// R186 วัสดุอุปกรณ์และของใช้สิ้นเปลือง (15 % of J185 + L185) is a BOQ template rule.
// The circuit list kept here is also the circuit list of the cable sheet (sheet 09, calculator `electrical-cable`),
// which reads each circuit's lengths from the outputs below (Excel: Cable!G r = Pipe!E r + G r, H r = F r + H r).
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §4 (oddities D3, D4, D6).
import { defineCalculator, type CalcContext } from '../types';

/** C ขนาด CB — dropdown C6:C29 (informational, no effect on any formula). */
export const BREAKER_SIZES = ['16A.', '20A.', '32A.', '40A.'] as const;
/** D ชนิดท่อ — dropdown D6:D29. I4 adds every circuit whatever the pipe type (oddity D3). */
export const PIPE_TYPES = ['PVC 1/2"', 'PVC 3/4"'] as const;
/** The pipe type BOQ row 185 describes (` - ท่อร้อยสายไฟ ท่อ PVC 1/2"`). */
export const BOQ_PIPE_TYPE = 'PVC 1/2"';

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
): Circuit => ({ id: `c${n}`, name, breaker, pipeType: 'PVC 1/2"', mainH, deviceH, mainV, deviceV });

export const electricalPipe = defineCalculator<ElectricalPipeInput>({
    id: 'electrical-pipe',
    sheetName: 'ท่อร้อยสายไฟ_Electrical Pipe',
    title: 'โปรแกรมถอดแบบ – งานท่อร้อยสายไฟ Electrical Pipe',
    titleEn: 'Electrical Conduit',
    sections: [17],
    deps: [],
    defaults: () => ({
        // Rows 6–19 verbatim (typos included). Rows 20–29 of the Excel are blank and not carried over.
        // G/H: the yellow cells hold arithmetic; their values are the defaults (Excel formula in the comment):
        // "points × drop height" (2.3 m lights / kitchen sockets, 3.2 m sockets) and "1.5 + rise to the device".
        circuits: [
            circuit(1, 'แสงสว่าง : ห้องนอน , ห้องน้ำ', '16A.', 22.4, 25.6, 1.5, 16.1),                        // H =7*2.3
            circuit(2, 'แสงสว่าง : ห้องนั้งเล่น , ห้องทานอาหาร , ครัว , ภายนอก', '16A.', 24.5, 27.5, 1.5, 25.3), // H =11*2.3
            circuit(3, 'เต้ารับไฟฟ้า : ห้องนอน 1,2,3', '20A.', 27.4, 0, 1.5, 28.8),                           // H =9*3.2
            circuit(4, 'เต้ารับไฟฟ้า : ห้องนั่งเล่น , ห้องทานอาหาร', '20A.', 21, 0, 1.5, 12.8),                   // H =4*3.2
            circuit(5, 'เต้ารับไฟฟ้า : ห้องน้ำ , เครื่องซักผ้า , ภายนอก', '20A.', 20, 0, 1.5, 6.4),               // H =2*3.2
            circuit(6, 'เครื่องทำน้ำอุ่น : ห้องน้ำ 1', '20A.', 12, 0, 3, 0),                                    // G =1.5+(1*1.5)
            circuit(7, 'เครื่องทำน้ำอุ่น : ห้องน้ำ 2', '20A.', 3, 0, 3, 0),                                     // G =1.5+(1*1.5)
            circuit(8, 'เครื่องปรับอากาศห้องนอน 1 (12,000 BTU)', '20A.', 17, 0, 2.4, 0),                         // G =1.5+(1*0.9)
            circuit(9, 'เครื่องปรับอากาคห้องนอน 2 (12,000 BTU)', '20A.', 11, 0, 2.4, 0),                         // G =1.5+(1*0.9)
            circuit(10, 'เครื่องปรับอากาคห้องนอน 3 (9,000 BTU)', '20A.', 7, 0, 2.4, 0),                          // G =1.5+(1*0.9)
            circuit(11, 'เครื่องปรับอากาคห้องรับแขก (15,000 BTU)', '20A.', 7, 0, 1.8, 0),                        // G =1.5+(1*0.3)
            circuit(12, 'เครื่องปรับอากาคห้องทานอาหาร (9,000 BTบ)', '20A.', 8, 0, 1.8, 0),                       // G =1.5+(1*0.3)
            circuit(13, 'เครื่องปั้มน้ำ', '20A.', 5, 0, 4.4, 0),                                               // G =1.5+(1*2.9)
            circuit(14, 'เต้ารับไฟฟ้า : ห้องครัว', '20A.', 5, 0, 1.5, 6.9),                                     // H =3*2.3
        ],
    }),
    compute: (input) => {
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
        return out;
    },
    boqLinks: [{ line: 'R185', field: 'qty', output: 'R185' }],
});
