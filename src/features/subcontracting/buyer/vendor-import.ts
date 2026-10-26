// ─── Vendor list import: CSV / Excel table → ImportVendorListRequest rows (pure; parsed on the client) ───
// Columns are found by their header (ชื่อ, เบอร์, ประเภทงาน, จังหวัด, LINE); a table without a header row is read in
// that order. Bad phones are left for the server to report (it answers per row), empty rows are skipped.
import type { ImportVendorListRequest, TradeId } from '@/shared/contract';
import { phoneSchema } from '@/shared/contract';
import { TRADES } from '@/domain/subcontracting/trades';
import { normalizeProvince } from './provinces';

export type ImportRow = ImportVendorListRequest['rows'][number];

export interface ParsedImport {
    rows: ImportRow[];
    /** Sheet row number (1-based) of each entry of `rows`, to point at the source when the server reports a row. */
    sourceRows: number[];
    /** Rows with a name but no phone, or a phone but no name. */
    incomplete: number[];
    /** Rows beyond the 1000 the API takes at once. */
    truncated: number;
}

export const IMPORT_MAX_ROWS = 1000;

type Field = 'displayName' | 'phone' | 'trades' | 'province' | 'lineId';

const HEADERS: Record<Field, readonly string[]> = {
    displayName: ['ชื่อ', 'ชื่อทีม', 'ชื่อทีมช่าง', 'ชื่อผู้รับเหมา', 'name'],
    phone: ['เบอร์', 'เบอร์โทร', 'เบอร์โทรศัพท์', 'โทร', 'โทรศัพท์', 'phone', 'tel', 'mobile'],
    trades: ['ประเภทงาน', 'ประเภท', 'งาน', 'trade', 'trades'],
    province: ['จังหวัด', 'province'],
    lineId: ['line', 'lineid', 'line id', 'ไลน์', 'ไอดีไลน์'],
};

const DEFAULT_ORDER: readonly Field[] = ['displayName', 'phone', 'trades', 'province', 'lineId'];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function fieldOfHeader(cell: string): Field | undefined {
    const h = norm(cell).replace(/[*:]/g, '').trim();
    if (h === '') return undefined;
    return (Object.keys(HEADERS) as Field[]).find(f => HEADERS[f].some(alias => h === alias || h.replace(/ /g, '') === alias.replace(/ /g, '')));
}

/** Column index per field from a header row, or null when the row is not a header. */
function headerMap(row: readonly string[]): Map<Field, number> | null {
    const map = new Map<Field, number>();
    row.forEach((cell, i) => {
        const f = fieldOfHeader(cell);
        if (f !== undefined && !map.has(f)) map.set(f, i);
    });
    return map.has('displayName') || map.has('phone') ? map : null;
}

/** Keywords that name a trade in a free-text cell (Thai labels split into their parts, plus common words). */
const TRADE_WORDS: Record<TradeId, readonly string[]> = {
    'site-prep': ['เตรียมพื้นที่', 'รื้อถอน', 'ถมดิน', 'วางผัง'],
    'temp-utilities': ['น้ำไฟชั่วคราว', 'น้ำ-ไฟชั่วคราว', 'ไฟชั่วคราว'],
    piling: ['เสาเข็ม', 'เข็ม'],
    structure: ['โครงสร้าง', 'ค.ส.ล.', 'คสล', 'ฐานราก'],
    'roof-structure': ['โครงหลังคา'],
    roofing: ['มุงหลังคา', 'หลังคา'],
    masonry: ['ก่ออิฐ', 'ฉาบปูน', 'ก่อฉาบ', 'ปูน'],
    electrical: ['ไฟฟ้า', 'ช่างไฟ', 'ไฟ'],
    plumbing: ['ประปา', 'สุขาภิบาล', 'สุขภัณฑ์'],
    ceiling: ['ฝ้า', 'ฝ้าเพดาน'],
    tiling: ['กระเบื้อง', 'ปูกระเบื้อง'],
    painting: ['ทาสี', 'สี'],
    'doors-windows': ['ประตู', 'หน้าต่าง', 'อลูมิเนียม'],
    misc: ['เบ็ดเตล็ด'],
};

/** "ไฟฟ้า, ประปา" / "electrical;plumbing" / "ก่ออิฐ-ฉาบปูน" → trade ids (in TRADES order, no duplicates). */
export function parseTrades(text: string): TradeId[] {
    const tokens = text.split(/[,;|/\n、]+/).map(t => norm(t)).filter(t => t !== '');
    const found = new Set<TradeId>();
    for (const token of tokens) {
        const exact = TRADES.find(t => t.id === token || norm(t.label) === token);
        if (exact !== undefined) { found.add(exact.id); continue; }
        // Longest keyword wins, so "โครงหลังคา" is roof structure and not roofing, "ไฟฟ้า" is not "ไฟชั่วคราว".
        let best: { id: TradeId; len: number } | undefined;
        for (const t of TRADES) {
            for (const w of TRADE_WORDS[t.id]) {
                if (token.includes(w) && (best === undefined || w.length > best.len)) best = { id: t.id, len: w.length };
            }
        }
        if (best !== undefined) found.add(best.id);
    }
    return TRADES.map(t => t.id).filter(id => found.has(id));
}

/** A phone typed in a sheet: Excel drops the leading 0 of "0812345678" (stored as a number) — put it back. */
export function phoneFromCell(text: string): string {
    const t = text.trim();
    const digits = t.replace(/[\s\-().]/g, '');
    const fixed = /^[1-9]\d{7,8}$/.test(digits) ? `0${digits}` : t;
    const parsed = phoneSchema.safeParse(fixed);
    return parsed.success ? parsed.data : fixed;
}

/** Rows of cells (already text) → import rows. */
export function rowsFromTable(table: readonly (readonly string[])[]): ParsedImport {
    const firstFilled = table.findIndex(r => r.some(c => c.trim() !== ''));
    const header = firstFilled < 0 ? null : headerMap(table[firstFilled] ?? []);
    const columns = header ?? new Map(DEFAULT_ORDER.map((f, i) => [f, i] as const));
    const start = header === null ? 0 : firstFilled + 1;
    const out: ParsedImport = { rows: [], sourceRows: [], incomplete: [], truncated: 0 };
    const cell = (row: readonly string[], f: Field) => {
        const i = columns.get(f);
        return i === undefined ? '' : (row[i] ?? '').trim();
    };
    for (let r = start; r < table.length; r++) {
        const row = table[r] ?? [];
        const name = cell(row, 'displayName');
        const phone = cell(row, 'phone');
        if (name === '' && phone === '') continue;
        if (name === '' || phone === '') { out.incomplete.push(r + 1); continue; }
        if (out.rows.length >= IMPORT_MAX_ROWS) { out.truncated++; continue; }
        out.rows.push({
            displayName: name.slice(0, 120),
            phone: phoneFromCell(phone).slice(0, 30),
            trades: parseTrades(cell(row, 'trades')),
            province: normalizeProvince(cell(row, 'province')).slice(0, 60),
            lineId: cell(row, 'lineId').slice(0, 60),
        });
        out.sourceRows.push(r + 1);
    }
    return out;
}

/** Minimal CSV reader: quotes, escaped quotes, commas / semicolons / tabs, CRLF, a UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
    const src = text.replace(/^﻿/, '');
    const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
    const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t'
        : firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src.charAt(i);
        if (quoted) {
            if (ch === '"') {
                if (src.charAt(i + 1) === '"') { field += '"'; i++; } else quoted = false;
            } else field += ch;
            continue;
        }
        if (ch === '"' && field === '') quoted = true;
        else if (ch === delimiter) { row.push(field); field = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src.charAt(i + 1) === '\n') i++;
            row.push(field); rows.push(row); row = []; field = '';
        } else field += ch;
    }
    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
}
