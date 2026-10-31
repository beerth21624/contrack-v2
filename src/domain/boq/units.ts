// ─── English names of the BOQ units (docs/erp/03-i18n.md §6) ───
// Every unit the v5 template and the slot rows use (template.v5.ts, slots.ts, pick lists, door/window schedule).
// A unit typed by the user that is not here prints as typed (`unitEn` returns the Thai text unchanged).

export const UNIT_EN: Readonly<Record<string, string>> = {
    'ตร.ม.': 'sq.m',
    'ชุด': 'set',
    'กก.': 'kg',
    'ลบ.ม.': 'cu.m',
    'ม.': 'm',
    'เหมา': 'lump sum',
    'แผ่น': 'sheet',
    'ลบ.ฟ.': 'cu.ft',
    'ท่อน': 'length',
    'ตัว': 'pc',
    'ห้อง': 'room',
    'ต้น': 'pc',
    'จุด': 'point',
    'ม้วน': 'roll',
};

/** The unit in English when known, otherwise the unit as written (trimmed). */
export function unitEn(unit: string): string {
    const u = unit.trim();
    return Object.prototype.hasOwnProperty.call(UNIT_EN, u) ? (UNIT_EN[u] ?? u) : u;
}
