import { describe, expect, it } from 'vitest';
import {
    AI_FINDING_KIND_LABEL, AI_REVIEW_ERROR, AI_REVIEW_WARN, type AiFinding, type BoqReviewFinding, type BoqReviewRow,
} from '@/shared/contract/ai-assist';
import { aiPercent, aiSeverity, aiToFindings, countBySeverity, mergeFindings, targetsDerivedValue } from '../merge';

const row = (key: string, desc: string): BoqReviewRow => ({
    key, section: 'งานโครงสร้าง', desc, unit: 'ลบ.ม.', qty: 10, grossQty: 11, wastePct: 10, matUnit: 2500, labUnit: 500,
    note: '', derived: { qty: false, mat: false, lab: false },
});
const rows = [row('R43', 'คอนกรีตโครงสร้าง'), row('R44', 'เหล็กเสริม DB12'), row('R45', '  ')];

const ai = (key: string, kind: AiFinding['kind'], probability: number): AiFinding => ({ key, kind, probability, kindConfidence: 0.8 });
const rule = (key: string, kind: string, severity: BoqReviewFinding['severity'], message = `${key} ${kind}`): BoqReviewFinding =>
    ({ key, source: 'rule', severity, kind, message });

describe('aiSeverity', () => {
    it('maps probability to error / warn / dropped at the contract thresholds', () => {
        expect(aiSeverity(AI_REVIEW_ERROR)).toBe('error');
        expect(aiSeverity(0.95)).toBe('error');
        expect(aiSeverity(AI_REVIEW_WARN)).toBe('warn');
        expect(aiSeverity(0.8)).toBe('warn');
        expect(aiSeverity(AI_REVIEW_WARN - 0.001)).toBeUndefined();
        expect(aiSeverity(0)).toBeUndefined();
    });
});

describe('aiToFindings', () => {
    it('names the row and the kind, keeps the probability, marks the source', () => {
        const [f] = aiToFindings([ai('R43', 'waste', 0.91)], rows);
        expect(f).toEqual({
            key: 'R43', source: 'ai', severity: 'error', kind: 'waste', probability: 0.91,
            message: `คอนกรีตโครงสร้าง — ${AI_FINDING_KIND_LABEL.waste}`,
        });
    });
    it('drops findings below AI_REVIEW_WARN and keeps the server order of the rest', () => {
        const out = aiToFindings([ai('R43', 'price', 0.75), ai('R44', 'qty', 0.6), ai('R44', 'unit', 0.7)], rows);
        expect(out.map(f => `${f.key}:${f.kind}:${f.severity}`)).toEqual(['R43:price:warn', 'R44:unit:warn']);
    });
    it('drops findings about values the engine derived from other rows', () => {
        const tieWire: BoqReviewRow = { ...row('R45', '- ลวดผูกเหล็ก'), qty: 0, derived: { qty: true, mat: false, lab: false } };
        const consumables: BoqReviewRow = { ...row('R87', 'วัสดุสิ้นเปลือง'), derived: { qty: false, mat: true, lab: false } };
        const concrete = row('R43', 'คอนกรีตโครงสร้าง');
        const list = [tieWire, consumables, concrete];
        expect(targetsDerivedValue(ai('R45', 'qty', 0.9), tieWire)).toBe(true);
        expect(targetsDerivedValue(ai('R45', 'unit', 0.9), tieWire)).toBe(false);
        expect(targetsDerivedValue(ai('R87', 'price', 0.9), consumables)).toBe(true);
        expect(targetsDerivedValue(ai('R43', 'qty', 0.9), concrete)).toBe(false);
        expect(targetsDerivedValue(ai('R99', 'qty', 0.9), undefined)).toBe(false);
        const out = aiToFindings([ai('R45', 'qty', 0.9), ai('R45', 'unit', 0.8), ai('R87', 'price', 0.95), ai('R43', 'qty', 0.9)], list);
        expect(out.map(f => `${f.key}:${f.kind}`)).toEqual(['R45:unit', 'R43:qty']);
    });

    it('falls back to the key when the row is unknown or its description is blank', () => {
        const out = aiToFindings([ai('R99', 'note', 0.8), ai('R45', 'note', 0.8)], rows);
        expect(out[0]?.message).toBe(`R99 — ${AI_FINDING_KIND_LABEL.note}`);
        expect(out[1]?.message).toBe(`R45 — ${AI_FINDING_KIND_LABEL.note}`);
    });
});

describe('mergeFindings', () => {
    it('puts errors before warnings and keeps rules before model findings inside a severity', () => {
        const rules = [rule('R10', 'price-zero', 'warn'), rule('R20', 'qty-negative', 'error')];
        const aiFs = aiToFindings([ai('R43', 'waste', 0.95), ai('R44', 'unit', 0.75)], rows);
        const out = mergeFindings(rules, aiFs);
        expect(out.map(f => `${f.source}:${f.key}:${f.severity}`)).toEqual([
            'rule:R20:error', 'ai:R43:error', 'rule:R10:warn', 'ai:R44:warn',
        ]);
    });
    it('shows the same row + kind once, keeping the most severe', () => {
        const out = mergeFindings(
            [rule('R43', 'waste', 'warn', 'rule first'), rule('R43', 'waste', 'error', 'rule later but worse')],
            aiToFindings([ai('R43', 'waste', 0.8)], rows),
        );
        expect(out).toHaveLength(1);
        expect(out[0]?.message).toBe('rule later but worse');
    });
    it('keeps a rule and a model finding of a different kind on the same row', () => {
        const out = mergeFindings([rule('R43', 'waste-high', 'warn')], aiToFindings([ai('R43', 'waste', 0.8)], rows));
        expect(out).toHaveLength(2);
    });
    it('is empty when nothing was found', () => {
        expect(mergeFindings([], [])).toEqual([]);
    });
});

describe('counts and tags', () => {
    it('counts per severity', () => {
        expect(countBySeverity([rule('a', 'x', 'error'), rule('b', 'y', 'warn'), rule('c', 'z', 'warn')])).toEqual({ errors: 1, warns: 2 });
    });
    it('formats the AI probability as a rounded percentage', () => {
        expect(aiPercent(0.91)).toBe('AI 91%');
        expect(aiPercent(0.705)).toBe('AI 71%');
    });
});
