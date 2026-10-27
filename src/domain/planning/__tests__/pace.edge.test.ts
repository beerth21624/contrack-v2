// QA edge tests for the project-pace gauge: thresholds (boundary values), decision table, empty/degenerate series.
import { describe, expect, it } from 'vitest';
import {
    ageExplanation, ageText, computeManDay, computePace, defaultPlanningInput, equivalentPlanWeek, computeSchedule,
    PACE_STATUS_LABEL, PACE_THRESHOLDS, paceFromSchedule, paceText, requiredPaceText, type ProjectPace,
} from '../index';
import type { BoqResult } from '../../boq/types';

/** Linear 10-week plan: 10 %, 20 % ... 100 % (week index 0..9). */
const PLAN = Array.from({ length: 10 }, (_, i) => (i + 1) / 10);
/** Actual series reported only at week index `week` (earlier weeks reported proportionally so velocity is not 0). */
const upTo = (week: number, value: number, plan = PLAN): (number | null)[] =>
    plan.map((_, i) => (i < week ? (value * (i + 1)) / (week + 1) : i === week ? value : null));

function badNumber(v: unknown, path = ''): string | null {
    if (typeof v === 'number') return Number.isFinite(v) ? null : `${path}=${v}`;
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const b = badNumber(v[i], `${path}[${i}]`); if (b) return b; } }
    else if (typeof v === 'object' && v !== null) { for (const [k, x] of Object.entries(v)) { const b = badNumber(x, `${path}.${k}`); if (b) return b; } }
    return null;
}

describe('status thresholds (pace = actual / plan at the latest reported week)', () => {
    // plan at week 4 is 0.5, so actual = pace x 0.5
    it.each([
        // pace, status, why
        [1.05, 'ahead'], [1.0499, 'on-track'], [1, 'on-track'], [0.9, 'on-track'], [0.8999, 'slightly-behind'],
        [0.7, 'slightly-behind'], [0.6999, 'behind'], [0.3, 'behind'], [1.5, 'ahead'],
    ] as const)('pace %d -> %s', (pace, status) => {
        const p = computePace({ plan: PLAN, actual: upTo(4, pace * 0.5) });
        expect(p.status).toBe(status);
        expect(p.pace).toBeCloseTo(pace, 9);
    });

    it('threshold constants are 1.05 / 0.90 / 0.70', () => {
        expect(PACE_THRESHOLDS).toEqual({ ahead: 1.05, onTrack: 0.9, slightlyBehind: 0.7 });
    });

    it('every status has a Thai label', () => {
        for (const s of ['ahead', 'on-track', 'slightly-behind', 'behind', 'stalled', 'not-started'] as const) {
            expect(PACE_STATUS_LABEL[s].length).toBeGreaterThan(0);
        }
    });
});

describe('degenerate series', () => {
    it('no data at all (empty arrays): not started, no NaN', () => {
        const p = computePace({ plan: [], actual: [] });
        expect(p.status).toBe('not-started');
        expect(p.latestReported).toBeNull();
        expect(p.pace).toBeNull();
        expect(badNumber(p)).toBeNull();
    });

    it('plan but no report: not started, requiredPace = plan pace, week readings null', () => {
        const p = computePace({ plan: PLAN, actual: PLAN.map(() => null) });
        expect(p.status).toBe('not-started');
        expect(p.reportedWeeks).toBe(0);
        expect(p.planPace).toBeCloseTo(0.1, 12);
        expect(p.requiredPace).toBeCloseTo(0.1, 12);
        expect(p.projectedFinishWeek).toBeNull();
        expect(p.equivalentPlanWeek).toBeNull();
    });

    it('plan all zero: pace null; actual > 0 is "ahead", actual 0 is "on-track"', () => {
        const zero = [0, 0, 0, 0];
        expect(computePace({ plan: zero, actual: [0.1, 0.2, null, null] }).status).toBe('ahead');
        expect(computePace({ plan: zero, actual: [0, 0, null, null] }).status).toBe('on-track');
        expect(computePace({ plan: zero, actual: [0.1, null, null, null] }).pace).toBeNull();
    });

    it('NaN / Infinity in the series are treated as 0 / unreported', () => {
        const p = computePace({ plan: [Number.NaN, 0.5, 1], actual: [Number.NaN, 0.4, Infinity] });
        expect(badNumber(p)).toBeNull();
    });

    it('a single reported week works (no velocity window crash, no projection)', () => {
        const p = computePace({ plan: PLAN, actual: [0.1, null, null, null, null, null, null, null, null, null] });
        expect(p.reportedWeeks).toBe(1);
        expect(p.pace).toBeCloseTo(1, 12);
        expect(p.projectedFinishWeek).toBeNull();
        expect(p.acceleration).toBeNull();
        expect(p.velocity?.weeks).toBe(1);
    });

    it('window 0 / negative / fractional is clamped to at least 1', () => {
        for (const w of [0, -3, 0.2]) expect(badNumber(computePace({ plan: PLAN, actual: upTo(5, 0.5), window: w }))).toBeNull();
    });

    it('reports with gaps carry the last value forward and count only reported weeks', () => {
        const p = computePace({ plan: PLAN, actual: [0.1, null, null, 0.35, null, null, null, null, null, null] });
        expect(p.reportedWeeks).toBe(2);
        expect(p.latestReported).toBe(3);
        expect(p.actualPct).toBeCloseTo(0.35, 12);
    });

    it('"now" before the latest report is raised to the latest report; later "now" is kept', () => {
        const a = upTo(4, 0.5);
        expect(computePace({ plan: PLAN, actual: a, currentWeek: 1 }).currentWeek).toBe(4);
        expect(computePace({ plan: PLAN, actual: a, currentWeek: 8 }).currentWeek).toBe(8);
        expect(computePace({ plan: PLAN, actual: a, currentWeek: 8 }).ageWeeks).toBeCloseTo(8 - 4, 9);
    });
});

describe('stalled and complete', () => {
    it('work stopped while the plan keeps growing is "stalled" even though pace is low', () => {
        const actual: (number | null)[] = [0.1, 0.2, 0.3, 0.3, 0.3, 0.3, 0.3, null, null, null];
        expect(computePace({ plan: PLAN, actual }).status).toBe('stalled');
    });

    it('a flat actual while the plan is also flat is not stalled', () => {
        const plan = [0.1, 0.2, 0.2, 0.2, 0.2, 0.2];
        const p = computePace({ plan, actual: [0.1, 0.2, 0.2, 0.2, 0.2, 0.2] });
        expect(p.status).not.toBe('stalled');
    });

    it('100 % reached before the plan finish week: ahead; on the plan week: on-track; after it: behind', () => {
        const ahead = computePace({ plan: PLAN, actual: [0.2, 0.5, 1, null, null, null, null, null, null, null] });
        expect(ahead).toMatchObject({ isComplete: true, status: 'ahead', projectedFinishWeek: 2 });
        const onPlan = computePace({ plan: PLAN, actual: [0.1, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99, 1] });
        expect(onPlan).toMatchObject({ isComplete: true, status: 'on-track', projectedFinishWeek: 9 });
        const quick = [0.5, 0.7, 0.9, 1, 1, 1, 1, 1, 1, 1];
        expect(computePace({ plan: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 1, 1, 1], actual: quick.map((v, i) => (i < 4 ? v : null)) }).status).toBe('ahead');
        const late = computePace({ plan: [0.5, 1, 1, 1], actual: [0.1, 0.4, 0.7, 1] });
        expect(late).toMatchObject({ isComplete: true, status: 'behind' });
    });

    it('actual above 100 % counts as complete and does not produce NaN or a required pace', () => {
        const p = computePace({ plan: PLAN, actual: [0.5, 1.2, null, null, null, null, null, null, null, null] });
        expect(p.isComplete).toBe(true);
        expect(p.requiredPace).toBeNull();
        expect(badNumber(p)).toBeNull();
    });

    it('a plan that never reaches 100 % has no finish week and no finish delta', () => {
        const p = computePace({ plan: [0.1, 0.2, 0.3], actual: [0.1, 0.2, null] });
        expect(p.planFinishWeek).toBeNull();
        expect(p.finishDeltaWeeks).toBeNull();
        expect(p.requiredPace).toBeNull();
    });
});

describe('projection, velocity, acceleration', () => {
    it('projected finish = latest week + remaining % / velocity; late when slower than plan', () => {
        const p = computePace({ plan: PLAN, actual: [0.05, 0.1, 0.15, 0.2, 0.25, null, null, null, null, null] });
        // 5 % per week -> remaining 75 % takes 15 weeks after week 4
        expect(p.projectedFinishWeek).toBeCloseTo(4 + 0.75 / 0.05, 9);
        expect(p.finishDeltaWeeks).toBeCloseTo(4 + 15 - 9, 9);
        expect(p.velocity?.actual).toBeCloseTo(0.05, 12);
        expect(p.velocity?.plan).toBeCloseTo(0.1, 12);
        expect(p.status).toBe('behind');
    });

    it('velocity <= 0 means no projection (ยังประเมินไม่ได้)', () => {
        const p = computePace({ plan: PLAN, actual: [0.1, 0.2, 0.3, 0.3, 0.3, 0.3, null, null, null, null], window: 2 });
        expect(p.projectedFinishWeek).toBeNull();
    });

    it('acceleration: faster recent window = up, slower = down, within 0.5 pt / week = steady', () => {
        const up = computePace({ plan: PLAN, actual: [0.01, 0.02, 0.03, 0.04, 0.1, 0.2, 0.3, 0.4, null, null], window: 4 });
        expect(up.acceleration?.trend).toBe('up');
        const down = computePace({ plan: PLAN, actual: [0.1, 0.2, 0.3, 0.4, 0.41, 0.42, 0.43, 0.44, null, null], window: 4 });
        expect(down.acceleration?.trend).toBe('down');
        const steady = computePace({ plan: PLAN, actual: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, null, null], window: 4 });
        expect(steady.acceleration?.trend).toBe('steady');
        expect(steady.acceleration?.delta).toBeCloseTo(0, 12);
    });

    it('required pace = remaining % / weeks to the plan finish, null once the plan week has passed', () => {
        const p = computePace({ plan: PLAN, actual: upTo(4, 0.4) });
        expect(p.requiredPace).toBeCloseTo(0.6 / 5, 12);
        const past = computePace({ plan: PLAN, actual: upTo(4, 0.4), currentWeek: 12 });
        expect(past.requiredPace).toBeCloseTo(0.6 / 5, 12);   // measured from the latest report, not "now"
        const afterPlan = computePace({ plan: [0.5, 1], actual: [0.2, 0.4] });
        expect(afterPlan.requiredPace).toBeNull();
    });
});

describe('equivalentPlanWeek', () => {
    it('interpolates between plan weeks', () => {
        expect(equivalentPlanWeek(PLAN, 0.15)).toBeCloseTo(0.5, 12);
        expect(equivalentPlanWeek(PLAN, 0.5)).toBeCloseTo(4, 12);
        expect(equivalentPlanWeek(PLAN, 0.55)).toBeCloseTo(4.5, 12);
    });
    it('at or beyond the plan final value: the first week that reaches it', () => {
        expect(equivalentPlanWeek(PLAN, 1)).toBe(9);
        expect(equivalentPlanWeek(PLAN, 5)).toBe(9);
        expect(equivalentPlanWeek([0.5, 1, 1, 1], 1)).toBe(1);
    });
    it('before the first week is negative; empty plan is null; actual 0 is before the plan starts', () => {
        expect(equivalentPlanWeek(PLAN, 0.05)).toBeCloseTo(-0.5, 12);
        expect(equivalentPlanWeek([], 0.5)).toBeNull();
        expect(equivalentPlanWeek(PLAN, 0)).toBeCloseTo(-1, 12);
    });
});

describe('Thai texts', () => {
    it.each([
        [null, 'ยังไม่มีแผนในช่วงนี้'], [1, 'ตามแผนพอดี'], [0.996, 'ตามแผนพอดี'], [0.72, 'ช้ากว่าแผน 28%'],
        [1.12, 'เร็วกว่าแผน 12%'], [0, 'ช้ากว่าแผน 100%'], [2, 'เร็วกว่าแผน 100%'],
    ])('paceText(%s) = %s', (pace, text) => {
        expect(paceText(pace)).toBe(text);
    });

    it.each([
        [null, 'ยังไม่มีรายงานผลงาน'], [0, 'อายุตามแผนพอดี'], [0.4, 'อายุตามแผนพอดี'], [4, 'แก่กว่าแผน 4 สัปดาห์'], [-2, 'เด็กกว่าแผน 2 สัปดาห์'],
    ])('ageText(%s) = %s', (age, text) => {
        expect(ageText(age)).toBe(text);
    });

    it('ageExplanation: no report, week 0, same week, and different weeks (1-based)', () => {
        const base = computePace({ plan: PLAN, actual: [] });
        expect(ageExplanation(base)).toContain('เมื่อมีรายงานผลงาน');
        const fake = (eq: number, now: number): ProjectPace => ({ ...base, equivalentPlanWeek: eq, currentWeek: now });
        expect(ageExplanation(fake(2, 6))).toBe('งานที่ทำได้เท่ากับแผนสัปดาห์ที่ 3 แต่ตอนนี้คือสัปดาห์ที่ 7');
        expect(ageExplanation(fake(5, 5))).toContain('สัปดาห์นี้พอดี');
        expect(ageExplanation(fake(-1, 3))).toContain('ยังไม่มีผลงานเทียบเท่าแผนสัปดาห์แรก');
    });

    it('requiredPaceText: formatted with one decimal, or null', () => {
        const p = computePace({ plan: PLAN, actual: upTo(4, 0.4) });
        expect(requiredPaceText(p)).toBe('ต้องทำ 12.0% ต่อสัปดาห์เพื่อเสร็จตามแผน');
        expect(requiredPaceText({ ...p, requiredPace: null })).toBeNull();
    });
});

describe('paceFromSchedule', () => {
    const boq: BoqResult = {
        sections: Array.from({ length: 32 }, (_, no) => ({
            no, title: '', calculators: [], inConstructionTotal: no !== 0, rows: [], matTotal: 6000, labTotal: 4000, total: 10000,
        })),
        constructionTotal: 310000, preConstructionTotal: 10000,
    };
    const sched = (edit: (i: ReturnType<typeof defaultPlanningInput>) => void = () => undefined) => {
        const i = defaultPlanningInput();
        edit(i);
        return computeSchedule(i.schedule, computeManDay(i.manday, boq));
    };

    it('a schedule without actuals reads "not started" with null labels', () => {
        const p = paceFromSchedule(sched(i => { for (const t of Object.values(i.schedule.tasks)) delete t.actual; }));
        expect(p.status).toBe('not-started');
        expect(p.labels.current).toBeNull();
        expect(p.labels.latestReported).toBeNull();
        expect(p.labels.planFinish).not.toBeNull();
        expect(badNumber(p)).toBeNull();
    });

    it('the sample schedule (task 1.1 actual) reports a week label like "W2 ม.ค.-26"', () => {
        const p = paceFromSchedule(sched());
        expect(p.labels.latestReported).toMatch(/^W[1-4] ม\.ค\.-26$/);
        expect(p.reportedWeeks).toBe(2);   // buckets W1 and W2 of January (last update 2026-01-10)
        expect(badNumber(p)).toBeNull();
    });

    it('"today" later than the report moves the current week but not the reported one', () => {
        const base = paceFromSchedule(sched());
        const later = paceFromSchedule(sched(), { today: '2026-03-15' });
        expect(later.latestReported).toBe(base.latestReported);
        expect(later.currentWeek ?? 0).toBeGreaterThan(base.currentWeek ?? 0);
    });

    it('"today" before the axis or invalid is ignored safely', () => {
        const base = paceFromSchedule(sched());
        expect(paceFromSchedule(sched(), { today: '2020-01-01' }).currentWeek).toBe(base.currentWeek);
        expect(paceFromSchedule(sched(), { today: 'garbage' }).currentWeek).toBe(base.currentWeek);
    });

    it('a projection beyond the axis still gets a label (axis extended)', () => {
        const p = paceFromSchedule(sched());
        if (p.projectedFinishWeek !== null) expect(p.labels.projectedFinish).not.toBeNull();
    });
});
