// ─── BOQ (Home) domain types ─────────────────────────────────────────────────
// Mirrors the Excel sheet "BOQ (Home)" (Training Edition v5).
// Per item row:  H = gross qty (E × (1+G), with per-row rounding)
//                J = I × H (material; a few rows use I × E)
//                L = K × E (labour on NET qty; pipe/cable/frame rows use K × H)
//                M = J + L
// See docs/excel-spec/01-boq-home-and-steps-00-05.md §A.3.

/** Stable id of a BOQ line. Template lines use the Excel row, e.g. "R43". */
export type BoqLineKey = string;

/** Where a line's net quantity (Excel column E) comes from. */
export type QtyRule =
    /** Typed by the user (yellow cell in Excel). `value` is the v5 sample. */
    | { kind: 'input'; value: number }
    /** Output of a calculator sheet. Until that calculator exists, behaves like an input with `fallback`. */
    | { kind: 'calc'; calc: string; output: string; fallback: number }
    /** factor × another line's net qty (e.g. ไม้คร่าว = 0.6 × ไม้แบบ). */
    | { kind: 'line'; ref: BoqLineKey; factor: number }
    /** Sum of other lines' net qty (e.g. เสาเอ็น = Σ ก่ออิฐ). */
    | { kind: 'sumLines'; refs: BoqLineKey[] }
    /** No net qty; only a gross qty (tie-wire rows). */
    | { kind: 'none' };

/** How gross qty (Excel column H) is derived from net qty. */
export type GrossRule =
    | 'std'                                    // E × (1+G)
    | 'ceilInt'                                // ROUNDUP(E × (1+G), 0)
    | 'concrete'                               // MAX(1, CEILING(E × (1+G), 0.25))
    | 'none'                                   // no H column (material on net qty)
    | { kind: 'tieWire'; refs: BoqLineKey[]; ratio: number };  // Σ gross of refs × ratio

/** Unit price (Excel I or K). */
export type PriceRule =
    | number
    /** pct × Σ(material + labour totals) of the referenced lines ("วัสดุอุปกรณ์และของใช้สิ้นเปลือง"). */
    | { kind: 'consumables'; refs: BoqLineKey[]; pct: number }
    /** factor × the same price of another line (e.g. อิฐเต็มแผ่น = ครึ่งแผ่น × 2). */
    | { kind: 'linePrice'; ref: BoqLineKey; factor: number };

export interface BoqItemTemplate {
    type: 'item';
    key: BoqLineKey;
    excelRow: number;
    itemNo?: string;
    desc: string;
    unit: string;
    qty: QtyRule;
    waste: number;                     // fraction, 0.1 = 10 %
    gross: GrossRule;
    mat: PriceRule;
    lab: PriceRule;
    materialBasis: 'gross' | 'net';    // J = I×H | I×E
    labourBasis: 'net' | 'gross';      // L = K×E | K×H
    note?: string;
}

export interface BoqHeadingTemplate {
    type: 'heading';
    key: BoqLineKey;
    excelRow: number;
    itemNo?: string;
    desc: string;
}

export type BoqLineTemplate = BoqItemTemplate | BoqHeadingTemplate;

export interface BoqSectionTemplate {
    no: number;                        // 0–31, Excel column B
    title: string;                     // Excel column C of the header row
    /** Calculator sheets this section links to (ids planned in docs/excel-spec/00-rebuild-design.md §4). */
    calculators: string[];
    /** false for section 0 (land inspection): Excel M310 leaves it out of the construction total (decision D2). */
    inConstructionTotal: boolean;
    lines: BoqLineTemplate[];
}

/** What the user changed on the BOQ page. Anything omitted falls back to the template. */
export interface BoqLineOverride {
    qty?: number;          // only honoured for 'input' / 'calc' qty rules
    waste?: number;
    mat?: number;
    lab?: number;
    desc?: string;
    note?: string;
}

/** Values calculators supply to BOQ cells (resolved from their `boqLinks`). */
export type LinkedValues = Record<BoqLineKey, { qty?: number; mat?: number; lab?: number } | undefined>;

// ─── Computed results ────────────────────────────────────────────────────────

export interface BoqItemRow {
    type: 'item';
    key: BoqLineKey;
    excelRow: number;
    itemNo?: string;
    desc: string;
    unit: string;
    note?: string;
    qty: number;               // E (net)
    qtySource: QtyRule['kind'];
    waste: number;             // G
    grossQty: number | null;   // H (null when the row has no H)
    matUnit: number;           // I
    matTotal: number;          // J
    labUnit: number;           // K
    labTotal: number;          // L
    total: number;             // M
    editable: { qty: boolean };
    /** Which cells currently show a value supplied by a calculator (not edited on the BOQ page). */
    fromCalc: { qty: boolean; mat: boolean; lab: boolean };
}

export interface BoqHeadingRow {
    type: 'heading';
    key: BoqLineKey;
    excelRow: number;
    itemNo?: string;
    desc: string;
}

export type BoqRow = BoqItemRow | BoqHeadingRow;

export interface BoqSectionResult {
    no: number;
    title: string;
    calculators: string[];
    inConstructionTotal: boolean;
    rows: BoqRow[];
    matTotal: number;
    labTotal: number;
    total: number;
}

export interface BoqResult {
    sections: BoqSectionResult[];
    /** Σ sections with inConstructionTotal (Excel M310). */
    constructionTotal: number;
    /** Σ sections left out of the construction total (section 0). */
    preConstructionTotal: number;
}
