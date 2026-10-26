// Wall parts as the guided journey asks them (door-window, brick and plaster steps share the wording).
import { BRICK_THICKNESSES, BRICK_TYPES } from '@/domain/calculators/door-window';

/** What each wall part means (the plaster step plasters them by these rules). */
export const WALL_PART_HINTS: Record<string, string> = {
    'ผนังรอบบ้าน': 'ผนังภายนอกของตัวบ้าน (ฉาบด้านใน 1 ด้าน ด้านนอก 1 ด้าน)',
    'ผนังภายในบ้าน': 'ผนังกั้นห้องในบ้าน (ฉาบด้านในทั้ง 2 ด้าน)',
    'ผนังภายนอกบ้าน': 'ผนังนอกตัวบ้าน เช่น ผนังส่วนซักล้าง รั้ว (ฉาบด้านนอกทั้ง 2 ด้าน)',
    'ผนังรอบบ้าน-พิเศษ': 'ผนังพิเศษของตัวบ้าน เช่น ผนังจั่วสามเหลี่ยมใต้หลังคา',
};

/** The wall parts in the order a plan is read (the most common first), as choice buttons. */
export const WALL_PART_CHOICES = ['ผนังรอบบ้าน', 'ผนังภายในบ้าน', 'ผนังภายนอกบ้าน', 'ผนังรอบบ้าน-พิเศษ']
    .map(value => ({ value, label: value, hint: WALL_PART_HINTS[value] }));

export const BRICK_CHOICES = BRICK_TYPES.map(value => ({ value: value as string, label: value as string }));
export const THICKNESS_CHOICES = BRICK_THICKNESSES.map(value => ({ value: value as string, label: value as string }));
