// ─── Words the vendor-list import recognises in a pasted sheet (Thai and English headers, trade keywords) ───
// This is input vocabulary, not interface text: the sheets people paste are mostly in Thai.
import type { TradeId } from '../../shared/contract/subcontracting/common';

export type ImportField = 'displayName' | 'phone' | 'trades' | 'province' | 'lineId';

export const IMPORT_HEADERS: Record<ImportField, readonly string[]> = {
    displayName: ['ชื่อ', 'ชื่อทีม', 'ชื่อทีมช่าง', 'ชื่อผู้รับเหมา', 'name'],
    phone: ['เบอร์', 'เบอร์โทร', 'เบอร์โทรศัพท์', 'โทร', 'โทรศัพท์', 'phone', 'tel', 'mobile'],
    trades: ['ประเภทงาน', 'ประเภท', 'งาน', 'trade', 'trades'],
    province: ['จังหวัด', 'province'],
    lineId: ['line', 'lineid', 'line id', 'ไลน์', 'ไอดีไลน์'],
};

/** Keywords that name a trade in a free-text cell (Thai labels split into their parts, plus common words). */
export const IMPORT_TRADE_WORDS: Record<TradeId, readonly string[]> = {
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
