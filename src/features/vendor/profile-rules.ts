// ─── What a crew profile still needs to reach L1 ("โปรไฟล์ครบ"). Pure; the server decides `profileComplete`. ───
import type { VendorProfileDto } from '@/shared/contract';

export const L1_MIN_PORTFOLIO = 3;

/** Short Thai items still missing for L1 (empty = complete): team size, ≥ 3 portfolio items, trades, provinces. */
export function profileMissing(p: Pick<VendorProfileDto, 'trades' | 'provinces' | 'crewSkilled' | 'crewLabourers' | 'portfolio'>): string[] {
    const out: string[] = [];
    if (p.trades.length === 0) out.push('ประเภทงานที่รับ');
    if (p.provinces.length === 0) out.push('จังหวัดที่รับงาน');
    if (p.crewSkilled === null && p.crewLabourers === null) out.push('จำนวนช่างและคนงาน');
    const more = L1_MIN_PORTFOLIO - p.portfolio.length;
    if (more > 0) out.push(`ผลงานอีก ${String(more)} รายการ`);
    return out;
}

/** Tools crews usually list (quick picks; free text is allowed too). */
export const TOOL_SUGGESTIONS = [
    'นั่งร้าน', 'โม่ผสมปูน', 'เครื่องตัดเหล็ก', 'ตู้เชื่อม', 'สว่านโรตารี่', 'เครื่องตัดกระเบื้อง', 'กล้องระดับ',
    'เลเซอร์วัดระดับ', 'เครื่องตบดิน', 'รถกระบะ', 'ปั๊มน้ำ', 'เครื่องพ่นสี',
] as const;
