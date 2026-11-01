// ─── English overlay of calculator option values (docs/erp/03-i18n.md §9) ───
// The Thai strings of the calculator domain (wall parts, brick types, circuit kinds …) are stored values: they stay
// Thai in the project and in the BOQ. This table gives what the screen shows in English. Pure; text with no entry
// shows as it is (BOQ item names are translated by the BOQ overlay, `boqLineEn`).
import { boqLineEn } from '../boq/template.v5.en';
import { unitEn } from '../boq/units';

export const DOMAIN_EN: Readonly<Record<string, string>> = {
    // wall parts, bricks, thickness (door-window, brick, plaster)
    'ผนังรอบบ้าน': 'House perimeter wall',
    'ผนังภายในบ้าน': 'Interior partition wall',
    'ผนังภายนอกบ้าน': 'Exterior wall outside the house',
    'ผนังรอบบ้าน-พิเศษ': 'House perimeter wall - special',
    'อิฐมวลเบา': 'Lightweight brick',
    'อิฐมอญ': 'Clay brick',
    'ครึ่งแผ่น': 'Half brick',
    'เต็มแผ่น': 'Full brick',
    'สี่เหลี่ยม': 'Rectangle',
    'สามเหลี่ยม': 'Triangle',
    'บานไม้': 'Wooden leaf',
    'บานอลูมิเนียม': 'Aluminium leaf',
    'ฉาบภายนอก': 'Exterior plaster',
    'ฉาบภายใน': 'Interior plaster',
    // electrical circuit kinds and their points
    'ไฟแสงสว่าง': 'Lighting',
    'เต้ารับ': 'Socket outlet',
    'เต้ารับเหนือเคาน์เตอร์': 'Counter-top socket outlet',
    'เครื่องทำน้ำอุ่น': 'Water heater',
    'เครื่องปรับอากาศ': 'Air conditioner',
    'ปั๊มน้ำ': 'Water pump',
    'อื่น ๆ': 'Other',
    'สวิตช์': 'Switch',
    // piles, stairs, misc enumerations
    'เสาเข็มตอก': 'Driven pile',
    'เสาเข็มเจาะ': 'Bored pile',
    'เสาเข็มไมโครไพล์': 'Micropile',
    'บันไดข้างบ้าน': 'Side stair',
    'บันไดหน้าบ้าน': 'Front stair',
    'บันไดหลังบ้าน': 'Rear stair',
    'ภายใน': 'Interior',
    'ภายนอก': 'Exterior',
    'ไม้ระแนง': 'Wood slats',
    'พื้น': 'Floor',
    'ผนัง': 'Wall',
};

/** English text of a domain value; BOQ item names go through the BOQ overlay; '' when there is none. */
export function domainEn(th: string): string {
    const t = th.trim();
    return Object.prototype.hasOwnProperty.call(DOMAIN_EN, t) ? (DOMAIN_EN[t] ?? '') : boqLineEn('', t);
}

/** The text to show in a locale: English when there is a translation, else the Thai as it is. */
export const domainText = (th: string, locale: string): string => (locale === 'en' ? domainEn(th) || th : th);

/** A unit in a locale. */
export const domainUnit = (unit: string, locale: string): string => (locale === 'en' ? unitEn(unit) : unit);
