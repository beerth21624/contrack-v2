// ─── Man-Day wage sets ↔ the company rate-card library (ชุดค่าแรงของบริษัท) ───
// Pure helpers between a project's wage sets (src/domain/planning/wage-sets.ts) and the workspace rate cards
// (src/shared/contract/rate-cards.ts). docs/workforce/00-crew-management-design.md §2.
//
// Picking a card copies its name and rates into the project (a snapshot): a later change to the card does not change
// the project. Saving a project set creates a card; cards keep whole baht per day, so fractional rates are rounded.
import { WAGE_SET_LIMITS, type WageSet } from '@/domain/planning';
import { RATE_CARD_NAME_MAX, RATE_CARD_RATE_MAX, type CreateRateCardRequest, type RateCardDto } from '@/shared/contract';

/** Names compare trimmed and case-insensitive (as the server's unique name rule does). */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The fields of a new project set made from a card (for addWageSet). */
export function cardToWageSet(card: Pick<RateCardDto, 'name' | 'skilledRate' | 'labourerRate'>): Omit<WageSet, 'id'> {
    return { name: card.name.trim().slice(0, WAGE_SET_LIMITS.maxNameLength), skilled: card.skilledRate, labourer: card.labourerRate };
}

/** The project set that already holds this card (same name and rates), if any. */
export function findSetOfCard(sets: readonly WageSet[], card: Pick<RateCardDto, 'name' | 'skilledRate' | 'labourerRate'>): WageSet | undefined {
    return sets.find(s => sameName(s.name, card.name) && s.skilled === card.skilledRate && s.labourer === card.labourerRate);
}

export type SetToCardResult =
    | { ok: true; body: CreateRateCardRequest; rounded: boolean }
    | { ok: false; message: string };

/** A daily rate as a card keeps it: whole baht, or null when it can't be one (not a number, < 0, > the maximum). */
function wholeBaht(v: number): number | null {
    if (!Number.isFinite(v)) return null;
    const r = Math.round(v);
    return r < 0 || r > RATE_CARD_RATE_MAX ? null : r;
}

/**
 * The create request for saving a project set to the company library, or a Thai message saying why it can't be saved.
 * Fractional rates are rounded to whole baht (`rounded` tells the caller to say so); the project set itself is unchanged.
 */
export function wageSetToCard(set: Pick<WageSet, 'name' | 'skilled' | 'labourer'>): SetToCardResult {
    const name = set.name.trim();
    if (name === '') return { ok: false, message: 'ตั้งชื่อชุดก่อนบันทึกเป็นชุดของบริษัท' };
    if (name.length > RATE_CARD_NAME_MAX) return { ok: false, message: `ชื่อชุดของบริษัทยาวได้ไม่เกิน ${String(RATE_CARD_NAME_MAX)} ตัวอักษร` };
    const skilledRate = wholeBaht(set.skilled);
    const labourerRate = wholeBaht(set.labourer);
    if (skilledRate === null || labourerRate === null) {
        return { ok: false, message: `ค่าแรงต้องอยู่ระหว่าง 0 ถึง ${RATE_CARD_RATE_MAX.toLocaleString('th-TH')} บาท/วัน` };
    }
    return { ok: true, body: { name, skilledRate, labourerRate }, rounded: skilledRate !== set.skilled || labourerRate !== set.labourer };
}

/** The company card that already holds this set (same name and the rates it would be saved with), if any. */
export function findCardOfSet(cards: readonly RateCardDto[], set: Pick<WageSet, 'name' | 'skilled' | 'labourer'>): RateCardDto | undefined {
    const req = wageSetToCard(set);
    if (!req.ok) return undefined;
    return cards.find(c => sameName(c.name, req.body.name) && c.skilledRate === req.body.skilledRate && c.labourerRate === req.body.labourerRate);
}
