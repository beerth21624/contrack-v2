// ─── Where a required value lives on screen (pure; docs/rebuild/REQUIRED_FIELDS.md, "How it behaves") ───
// `missingRequirements` names a value by input list, row and field key. The journey cards tag their DOM with the
// same ids, so a failed "ยืนยัน" can ring exactly those fields and scroll to the first one.
import { missingLabel, type MissingValue } from '@/domain/journey';

/** One row of an input list as a journey card shows it (by its stable key where the row has one). */
export interface RowScope {
    listKey: string;
    itemIndex: number;
    itemKey?: string;
}

/** Id of a card (row): `rows#2`, or `circuits@c7` when the row has a stable key. */
export const cardTargetId = (s: RowScope): string =>
    (s.itemKey === undefined ? `${s.listKey}#${String(s.itemIndex)}` : `${s.listKey}@${s.itemKey}`);

/** Id of a field: `rows#2.width` inside a card, the plain key (`projectName`) on a one-form step. */
export const fieldTargetId = (scope: RowScope | undefined, fieldKey: string): string =>
    (scope === undefined ? fieldKey : `${cardTargetId(scope)}.${fieldKey}`);

/** The row a missing value belongs to (undefined for a one-form field or an "at least one" item). */
export function scopeOf(m: MissingValue): RowScope | undefined {
    if (m.listKey === undefined || m.itemIndex === undefined) return undefined;
    return m.itemKey === undefined
        ? { listKey: m.listKey, itemIndex: m.itemIndex }
        : { listKey: m.listKey, itemIndex: m.itemIndex, itemKey: m.itemKey };
}

/** What to bring into view for one missing value: its field, else its card, else the step's "เพิ่ม…" button. */
export type HighlightTarget =
    | { kind: 'field'; id: string; cardId?: string }
    | { kind: 'card'; id: string }
    | { kind: 'add' };

export function targetOf(m: MissingValue): HighlightTarget {
    const scope = scopeOf(m);
    if (m.fieldKey !== undefined) {
        const id = fieldTargetId(scope, m.fieldKey);
        return scope === undefined ? { kind: 'field', id } : { kind: 'field', id, cardId: cardTargetId(scope) };
    }
    return scope === undefined ? { kind: 'add' } : { kind: 'card', id: cardTargetId(scope) };
}

/** Everything to mark after a failed confirm: field ids, card ids, and whether an item has to be added. */
export interface HighlightTargets {
    fields: ReadonlySet<string>;
    cards: ReadonlySet<string>;
    addItem: boolean;
}

export const NO_TARGETS: HighlightTargets = { fields: new Set(), cards: new Set(), addItem: false };

export function highlightTargets(missing: readonly MissingValue[]): HighlightTargets {
    if (missing.length === 0) return NO_TARGETS;
    const fields = new Set<string>();
    const cards = new Set<string>();
    let addItem = false;
    for (const m of missing) {
        const t = targetOf(m);
        if (t.kind === 'field') {
            fields.add(t.id);
            if (t.cardId !== undefined) cards.add(t.cardId);
        } else if (t.kind === 'card') cards.add(t.id);
        else addItem = true;
    }
    return { fields, cards, addItem };
}

/**
 * CSS selectors to try, in order, for bringing a target into view: the field, else its card. A missing first item
 * goes to the first (untouched) card when the list has one, else to the "เพิ่ม…" button or empty state.
 */
export function targetSelectors(t: HighlightTarget): string[] {
    const q = (attr: string, id: string) => `[${attr}="${id.replace(/["\\]/g, '\\$&')}"]`;
    if (t.kind === 'field') return [q('data-req-field', t.id), ...(t.cardId === undefined ? [] : [q('data-req-card', t.cardId)])];
    if (t.kind === 'card') return [q('data-req-card', t.id)];
    return ['[data-req-card]', '[data-req-add]'];
}

/** The short list under the bottom bar: the first few labels and how many more. */
export function missingSummary(missing: readonly MissingValue[], max = 3, locale = 'th'): { count: number; shown: string[]; more: number } {
    const shown = missing.slice(0, max).map(m => missingLabel(m, locale));
    return { count: missing.length, shown, more: Math.max(0, missing.length - shown.length) };
}
