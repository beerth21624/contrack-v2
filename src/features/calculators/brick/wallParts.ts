// Wall parts as the guided journey asks them (door-window, brick and plaster steps share the wording).
import { BRICK_THICKNESSES, BRICK_TYPES } from '@/domain/calculators/door-window';
import type { CalcT } from '../text';

/* eslint-disable no-restricted-syntax -- the Thai wall-part names are stored values (domain data), not UI text */
/** What each wall part means (the plaster step plasters them by these rules). */
export const wallPartHints = (t: CalcT): Record<string, string> => ({
    'ผนังรอบบ้าน': t('brick.exteriorWallOfTheHouse'),
    'ผนังภายในบ้าน': t('brick.partitionWallInsideTheHouse'),
    'ผนังภายนอกบ้าน': t('brick.wallOutsideTheHouseE'),
    'ผนังรอบบ้าน-พิเศษ': t('brick.specialWallOfTheHouse'),
});

/** The wall parts in the order a plan is read (the most common first), as choice buttons. */
export const wallPartChoices = (t: CalcT) => ['ผนังรอบบ้าน', 'ผนังภายในบ้าน', 'ผนังภายนอกบ้าน', 'ผนังรอบบ้าน-พิเศษ']
    .map(value => ({ value, label: value, hint: wallPartHints(t)[value] }));

/* eslint-enable no-restricted-syntax */

export const BRICK_CHOICES = BRICK_TYPES.map(value => ({ value: value as string, label: value as string }));
export const THICKNESS_CHOICES = BRICK_THICKNESSES.map(value => ({ value: value as string, label: value as string }));
