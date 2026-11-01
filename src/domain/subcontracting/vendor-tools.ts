// ─── Tools crews usually list on their profile (quick picks; free text is allowed too) ───
// The stored value is the Thai name; the English interface shows the English name next to it.
import type { Locale } from '@/i18n/config';

export const TOOL_SUGGESTIONS = [
    'นั่งร้าน', 'โม่ผสมปูน', 'เครื่องตัดเหล็ก', 'ตู้เชื่อม', 'สว่านโรตารี่', 'เครื่องตัดกระเบื้อง', 'กล้องระดับ',
    'เลเซอร์วัดระดับ', 'เครื่องตบดิน', 'รถกระบะ', 'ปั๊มน้ำ', 'เครื่องพ่นสี',
] as const;

const TOOL_NAMES_EN: Readonly<Record<string, string>> = {
    'นั่งร้าน': 'Scaffolding',
    'โม่ผสมปูน': 'Concrete mixer',
    'เครื่องตัดเหล็ก': 'Rebar cutter',
    'ตู้เชื่อม': 'Welding machine',
    'สว่านโรตารี่': 'Rotary hammer drill',
    'เครื่องตัดกระเบื้อง': 'Tile cutter',
    'กล้องระดับ': 'Level instrument',
    'เลเซอร์วัดระดับ': 'Laser level',
    'เครื่องตบดิน': 'Plate compactor',
    'รถกระบะ': 'Pickup truck',
    'ปั๊มน้ำ': 'Water pump',
    'เครื่องพ่นสี': 'Paint sprayer',
};

/** Display name of a stored tool: the English name in the English interface, else the text itself. */
export function toolLabel(tool: string, locale: Locale): string {
    return locale === 'en' ? TOOL_NAMES_EN[tool] ?? tool : tool;
}
