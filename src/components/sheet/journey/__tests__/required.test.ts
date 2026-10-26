import { describe, expect, it } from 'vitest';
import type { MissingValue } from '@/domain/journey';
import { createProject, type Project } from '@/domain/project';
import { missingRequirements } from '@/domain/journey';
import { footing, newFootingRow } from '@/domain/calculators/footing';
import {
    NO_TARGETS, cardTargetId, fieldTargetId, highlightTargets, missingSummary, scopeOf, targetOf, targetSelectors,
} from '../required';

const rowField: MissingValue = {
    label: 'ฐานราก F2 — จำนวนฐานแบบนี้', item: 'ฐานราก F2', field: 'จำนวนฐานแบบนี้',
    listKey: 'rows', itemIndex: 1, fieldKey: 'count',
};
const formField: MissingValue = { label: 'ชื่อโครงการ', field: 'ชื่อโครงการ', fieldKey: 'projectName' };
const keyedField: MissingValue = {
    label: 'ห้องนอน — สายเมนวงจร', item: 'ห้องนอน', field: 'สายเมนวงจร',
    listKey: 'circuits', itemIndex: 3, itemKey: 'c7', fieldKey: 'mainSize',
};
const atLeastOne: MissingValue = { label: 'เพิ่มฐานรากอย่างน้อย 1 รายการ' };
const wholeRow: MissingValue = { label: 'ผนังที่ 2', listKey: 'walls', itemIndex: 1 };

describe('target ids', () => {
    it('names a row by list and position, or by its stable key', () => {
        expect(cardTargetId({ listKey: 'rows', itemIndex: 2 })).toBe('rows#2');
        expect(cardTargetId({ listKey: 'circuits', itemIndex: 0, itemKey: 'c7' })).toBe('circuits@c7');
    });
    it('names a field inside its row, or by its key alone on a one-form step', () => {
        expect(fieldTargetId({ listKey: 'rows', itemIndex: 2 }, 'width')).toBe('rows#2.width');
        expect(fieldTargetId(undefined, 'projectName')).toBe('projectName');
    });
    it('reads the row of a missing value', () => {
        expect(scopeOf(rowField)).toEqual({ listKey: 'rows', itemIndex: 1 });
        expect(scopeOf(keyedField)).toEqual({ listKey: 'circuits', itemIndex: 3, itemKey: 'c7' });
        expect(scopeOf(formField)).toBeUndefined();
        expect(scopeOf(atLeastOne)).toBeUndefined();
    });
});

describe('targetOf: MissingValue → what to highlight', () => {
    it('a row field → the field, inside its card', () => {
        expect(targetOf(rowField)).toEqual({ kind: 'field', id: 'rows#1.count', cardId: 'rows#1' });
    });
    it('a keyed row field → ids by the row key (the cable step follows the circuit id)', () => {
        expect(targetOf(keyedField)).toEqual({ kind: 'field', id: 'circuits@c7.mainSize', cardId: 'circuits@c7' });
    });
    it('a one-form field → the field alone', () => {
        expect(targetOf(formField)).toEqual({ kind: 'field', id: 'projectName' });
    });
    it('a row without a field key → its card', () => {
        expect(targetOf(wholeRow)).toEqual({ kind: 'card', id: 'walls#1' });
    });
    it('"at least one" → the add button', () => {
        expect(targetOf(atLeastOne)).toEqual({ kind: 'add' });
    });
});

describe('highlightTargets', () => {
    it('is empty for nothing missing', () => {
        expect(highlightTargets([])).toBe(NO_TARGETS);
    });
    it('collects fields, their cards and the add flag', () => {
        const t = highlightTargets([rowField, formField, keyedField, wholeRow, atLeastOne]);
        expect([...t.fields].sort()).toEqual(['circuits@c7.mainSize', 'projectName', 'rows#1.count']);
        expect([...t.cards].sort()).toEqual(['circuits@c7', 'rows#1', 'walls#1']);
        expect(t.addItem).toBe(true);
    });
    it('matches the ids the cards render for a real half-filled footing', () => {
        const p0 = createProject('blank');
        const first = { ...newFootingRow([]), width: 1.2, length: 1.2, depth: 0.3, excavationDepth: 1.5, count: 4 };
        const second = { ...newFootingRow([first]), width: 1 };
        const p: Project = { ...p0, calculators: { ...p0.calculators, [footing.id]: { ...footing.blank?.(), rows: [first, second] } } };
        const t = highlightTargets(missingRequirements('footing', p));
        expect(t.addItem).toBe(false);
        expect(t.cards).toEqual(new Set(['rows#1']));
        expect([...t.fields].sort()).toEqual(['rows#1.count', 'rows#1.depth', 'rows#1.excavationDepth', 'rows#1.length']);
    });
});

describe('targetSelectors', () => {
    it('tries the field, then its card', () => {
        expect(targetSelectors(targetOf(rowField))).toEqual(['[data-req-field="rows#1.count"]', '[data-req-card="rows#1"]']);
        expect(targetSelectors(targetOf(formField))).toEqual(['[data-req-field="projectName"]']);
    });
    it('a missing first item goes to the first card, else the add button', () => {
        expect(targetSelectors(targetOf(atLeastOne))).toEqual(['[data-req-card]', '[data-req-add]']);
    });
    it('escapes quotes in ids', () => {
        expect(targetSelectors({ kind: 'card', id: 'circuits@a"b' })).toEqual(['[data-req-card="circuits@a\\"b"]']);
    });
});

describe('missingSummary', () => {
    const many = ['ก', 'ข', 'ค', 'ง', 'จ'].map(label => ({ label }));
    it('shows the first few labels and counts the rest', () => {
        expect(missingSummary(many)).toEqual({ count: 5, shown: ['ก', 'ข', 'ค'], more: 2 });
    });
    it('shows all when few', () => {
        expect(missingSummary(many.slice(0, 2))).toEqual({ count: 2, shown: ['ก', 'ข'], more: 0 });
    });
});
