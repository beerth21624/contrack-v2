// Sheet "สายไฟ_Electrical Cable" (Excel v5 sheet 09) → BOQ (Home) section 18, rows 193–195.
// R196 วัสดุอุปกรณ์และของใช้สิ้นเปลือง (15 %) is a BOQ template rule. The circuits (B วงจร, C ขนาด CB) and the
// lengths G/H come from the conduit sheet (`electrical-pipe`): one shared circuit list (oddity D4); this sheet
// keeps only the wire settings D/E/F of each circuit, keyed by the circuit id.
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §5 (oddities D4, D6, D7, D8).
import { defineCalculator, type CalcContext } from '../types';
import { circuitLengths, type CircuitLengths } from '../electrical-pipe';

/** Dropdown D6:E28 (verbatim). */
export const WIRE_SIZES = ['THW 1.5', 'THW 2.5', 'THW 4', 'THW 6'] as const;
export type WireSize = (typeof WIRE_SIZES)[number];
/** Dropdown F6:F28. */
export const CONDUCTOR_COUNTS = [2, 3] as const;

/** Columns I–L, and the BOQ row each total I4–L4 feeds (THW 6 has none — oddity D7). */
export const WIRE_BUCKETS: readonly { size: WireSize; column: string; line?: string }[] = [
    { size: 'THW 1.5', column: 'I', line: 'R193' },
    { size: 'THW 2.5', column: 'J', line: 'R194' },
    { size: 'THW 4', column: 'K', line: 'R195' },
    { size: 'THW 6', column: 'L' },
];

/** Wire settings of one circuit. '' / 0 = blank cell (counts nothing, like Excel). */
export interface CircuitWiring {
    mainSize: string;    // D ขนาดสาย วงจรย่อย (สายเมน)
    deviceSize: string;  // E ขนาดสาย เข้าอุปกรณ์
    conductors: number;  // F จำนวนสาย (เส้น)
}

export interface ElectricalCableInput {
    /** By circuit id of the conduit sheet. A circuit with no entry has blank D/E/F. */
    wiring: Record<string, CircuitWiring>;
}

export const BLANK_WIRING: CircuitWiring = { mainSize: '', deviceSize: '', conductors: 0 };

/** Output key of the total length of one wire size (I4–L4). */
export const sizeKey = (size: string) => `size|${size}`;

const num = (v: number) => (Number.isFinite(v) ? v : 0);

export interface CableRow extends CircuitLengths {
    wiring: CircuitWiring;
    /** I–L: metres of each wire size. */
    bySize: Record<WireSize, number>;
    /** Run length (G and/or H) with no wire size or no conductor count chosen — counted in no column (oddity D8). */
    unassigned: number;
}

/** `IF(D="THW x", G×F, 0) + IF(E="THW x", H×F, 0)` for each size, per circuit of the conduit sheet. */
export function cableRows(input: ElectricalCableInput, ctx: CalcContext): CableRow[] {
    return circuitLengths(ctx).map(len => {
        const wiring = input.wiring[len.id] ?? BLANK_WIRING;
        const f = num(wiring.conductors);
        const main = wiring.mainSize.trim();
        const device = wiring.deviceSize.trim();
        const bySize = Object.fromEntries(WIRE_SIZES.map(s => [
            s, (main === s ? len.main * f : 0) + (device === s ? len.device * f : 0),
        ])) as Record<WireSize, number>;
        const known = (s: string) => (WIRE_SIZES as readonly string[]).includes(s);
        const unassigned = f === 0 ? len.main + len.device
            : (known(main) ? 0 : len.main) + (known(device) ? 0 : len.device);
        return { ...len, wiring, bySize, unassigned };
    });
}

/** Default D/E/F of the 14 Excel circuits (ids c1…c14 of the conduit sheet defaults). */
const sampleWiring = (): Record<string, CircuitWiring> => {
    const w = (mainSize: string, deviceSize: string, conductors: number): CircuitWiring => ({ mainSize, deviceSize, conductors });
    const rows: CircuitWiring[] = [
        w('THW 2.5', 'THW 1.5', 2), // 1 แสงสว่าง : ห้องนอน , ห้องน้ำ
        w('THW 2.5', 'THW 1.5', 2), // 2 แสงสว่าง : ห้องนั้งเล่น …
        w('THW 4', 'THW 2.5', 3),   // 3 เต้ารับไฟฟ้า : ห้องนอน 1,2,3
        w('THW 4', 'THW 2.5', 3),   // 4
        w('THW 4', 'THW 2.5', 3),   // 5
        w('THW 4', '', 3),          // 6 เครื่องทำน้ำอุ่น : ห้องน้ำ 1 (E blank)
        w('THW 4', '', 3),          // 7
        w('THW 4', '', 3),          // 8 เครื่องปรับอากาศ…
        w('THW 4', '', 3),          // 9
        w('THW 4', '', 3),          // 10
        w('THW 4', '', 3),          // 11
        w('THW 4', '', 3),          // 12
        w('THW 4', '', 3),          // 13 เครื่องปั้มน้ำ
        w('THW 4', 'THW 2.5', 3),   // 14 เต้ารับไฟฟ้า : ห้องครัว
    ];
    return Object.fromEntries(rows.map((r, i) => [`c${i + 1}`, r]));
};

export const electricalCable = defineCalculator<ElectricalCableInput>({
    id: 'electrical-cable',
    sheetName: 'สายไฟ_Electrical Cable',
    title: 'โปรแกรมถอดแบบ – งานสายไฟ Electrical Cable',
    titleEn: 'Electrical Cable',
    sections: [18],
    deps: ['electrical-pipe'],
    defaults: () => ({ wiring: sampleWiring() }),
    compute: (input, ctx) => {
        // I4:L4 = SUM(I6:I28) …; every circuit of the conduit sheet is counted (Excel links G/H on rows 6–19 only — D6).
        const rows = cableRows(input, ctx);
        const out: Record<string, number> = {
            'circuit.count': rows.length,
            unassigned: rows.reduce((s, r) => s + r.unassigned, 0),
        };
        for (const b of WIRE_BUCKETS) {
            const total = rows.reduce((s, r) => s + r.bySize[b.size], 0);
            out[sizeKey(b.size)] = total;
            if (b.line) out[b.line] = total;
        }
        return out;
    },
    boqLinks: WIRE_BUCKETS.flatMap(b => (b.line ? [{ line: b.line, field: 'qty' as const, output: b.line }] : [])),
});
