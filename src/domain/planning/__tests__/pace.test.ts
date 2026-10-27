// Project pace ("อายุโครงการ"): pace, velocity, acceleration, age, projected finish and status, with the
// thresholds of pace.ts (ahead ≥ 1.05 · on-track ≥ 0.90 · slightly-behind ≥ 0.70 · behind · stalled · not-started).
import { describe, expect, it } from 'vitest';
import { computeBoq } from '../../boq/engine';
import { BOQ_TEMPLATE_V5 } from '../../boq/template.v5';
import { blankPlanningInput, computePlanning, defaultPlanningInput } from '..';
import {
    ACCELERATION_STEADY, PACE_THRESHOLDS, ageExplanation, ageText, computePace, equivalentPlanWeek, paceFromSchedule, paceText,
    requiredPaceText,
} from '../pace';

/** A 10-week plan: 10 % per week. */
const PLAN10 = Array.from({ length: 10 }, (_, i) => (i + 1) / 10);

describe('equivalentPlanWeek', () => {
    it('interpolates inside a week and ties go to the later week (nothing planned yet is not "behind")', () => {
        expect(equivalentPlanWeek(PLAN10, 0.25)).toBeCloseTo(1.5, 12);   // end of W2 = 20 %, halfway to W3 = 30 %
        expect(equivalentPlanWeek(PLAN10, 0.1)).toBe(0);
        expect(equivalentPlanWeek(PLAN10, 0)).toBe(-1);                   // before the first week
        expect(equivalentPlanWeek([0, 0, 0.2, 0.5, 1], 0)).toBe(1);        // weeks 1–2 planned nothing
        expect(equivalentPlanWeek([0, 0.5, 1, 1, 1], 1)).toBe(2);          // 100 % is reached at week 3
        expect(equivalentPlanWeek([0, 0.5, 1, 1, 1], 1.2)).toBe(2);        // beyond 100 %
        expect(equivalentPlanWeek([], 0.3)).toBeNull();
    });
});

describe('computePace — readings', () => {
    it('pace, velocity, age and projected finish on a plan of 10 % per week', () => {
        // Reported 4 weeks: 5, 12, 20, 28 % → pace 28/40 = 0.7; velocity 7 %/wk vs plan 10 %/wk.
        const p = computePace({ plan: PLAN10, actual: [0.05, 0.12, 0.2, 0.28] });
        expect(p.status).toBe('slightly-behind');
        expect(p.latestReported).toBe(3);
        expect(p.currentWeek).toBe(3);
        expect(p.reportedWeeks).toBe(4);
        expect(p.actualPct).toBeCloseTo(0.28, 12);
        expect(p.planPct).toBeCloseTo(0.4, 12);
        expect(p.pace).toBeCloseTo(0.7, 12);
        expect(p.velocity?.actual).toBeCloseTo(0.07, 12);
        expect(p.velocity?.plan).toBeCloseTo(0.1, 12);
        expect(p.velocity?.weeks).toBe(4);
        // Acceleration: two 2-week windows → (28−12)/2 = 8 %/wk vs (12−0)/2 = 6 %/wk → +2 pt → up.
        expect(p.acceleration?.delta).toBeCloseTo(0.02, 12);
        expect(p.acceleration?.trend).toBe('up');
        expect(p.acceleration?.weeks).toBe(2);
        // Age: 28 % is plan week 2.8 (0-based 1.8) while now is week 4 (0-based 3) → 1.2 weeks older.
        expect(p.equivalentPlanWeek).toBeCloseTo(1.8, 12);
        expect(p.ageWeeks).toBeCloseTo(1.2, 12);
        // Projected finish: 3 + 72 % ÷ 7 %/wk = 13.29 (0-based) vs plan finish 9 → 4.29 weeks late.
        expect(p.planFinishWeek).toBe(9);
        expect(p.projectedFinishWeek).toBeCloseTo(3 + 0.72 / 0.07, 9);
        expect(p.finishDeltaWeeks).toBeCloseTo(3 + 0.72 / 0.07 - 9, 9);
        // Required from now: 72 % over the 6 remaining weeks.
        expect(p.requiredPace).toBeCloseTo(0.12, 12);
        expect(p.planPace).toBeCloseTo(0.1, 12);
        expect(p.weekly.map(w => (w === null ? null : Number(w.toFixed(9))))).toEqual([0.5, 0.6, 0.666666667, 0.7]);
    });

    it('window is shorter when the project is younger, and `window` is configurable', () => {
        const p = computePace({ plan: PLAN10, actual: [0.1, 0.25] });
        expect(p.velocity).toEqual({ actual: 0.125, plan: 0.1, weeks: 2 });
        expect(p.acceleration?.delta).toBeCloseTo(0.05, 12);   // 15 vs 10 %/wk
        expect(p.acceleration?.trend).toBe('up');
        expect(p.acceleration?.weeks).toBe(1);
        const w = computePace({ plan: PLAN10, actual: [0.05, 0.12, 0.2, 0.28, 0.35], window: 2 });
        expect(w.velocity?.actual).toBeCloseTo(0.075, 12);
        expect(w.velocity?.plan).toBeCloseTo(0.1, 12);
        expect(w.velocity?.weeks).toBe(2);
    });

    it('acceleration: steady within ±0.5 pt per week, down when slowing', () => {
        expect(ACCELERATION_STEADY).toBe(0.005);
        const steady = computePace({ plan: PLAN10, actual: [0.1, 0.2, 0.3, 0.404] });  // 10.2 vs 10 %/wk
        expect(steady.acceleration?.trend).toBe('steady');
        const down = computePace({ plan: PLAN10, actual: [0.1, 0.2, 0.25, 0.3] });    // 5 vs 10 %/wk
        expect(down.acceleration?.delta).toBeCloseTo(-0.05, 12);
        expect(down.acceleration?.trend).toBe('down');
        expect(down.acceleration?.weeks).toBe(2);
        expect(computePace({ plan: PLAN10, actual: [0.1] }).acceleration).toBeNull();
    });

    it('currentWeek past the latest report ages the project; it never moves before the report', () => {
        const p = computePace({ plan: PLAN10, actual: [0.1, 0.2, 0.3], currentWeek: 6 });
        expect(p.currentWeek).toBe(6);
        expect(p.latestReported).toBe(2);
        expect(p.pace).toBeCloseTo(1, 12);   // pace is read at the latest report
        expect(p.ageWeeks).toBeCloseTo(4, 12); // 30 % = plan week 3 (0-based 2) vs week 7 (0-based 6)
        expect(ageExplanation(p)).toBe('งานที่ทำได้เท่ากับแผนสัปดาห์ที่ 3 แต่ตอนนี้คือสัปดาห์ที่ 7');
        expect(computePace({ plan: PLAN10, actual: [0.1, 0.2, 0.3], currentWeek: 0 }).currentWeek).toBe(2);
    });

    it('weeks with no report are unknown, not 0: velocity carries the last report forward', () => {
        const p = computePace({ plan: PLAN10, actual: [0.1, null, null, 0.4] });
        expect(p.reportedWeeks).toBe(2);
        expect(p.latestReported).toBe(3);
        expect(p.velocity).toEqual({ actual: 0.1, plan: 0.1, weeks: 4 });
        expect(p.weekly).toEqual([1, null, null, 1]);
        expect(p.status).toBe('on-track');
        // A trailing unreported week does not count as "now".
        expect(computePace({ plan: PLAN10, actual: [0.1, 0.2, null] }).latestReported).toBe(1);
    });
});

describe('computePace — status thresholds', () => {
    const at = (pace: number) => computePace({ plan: PLAN10, actual: [0.1 * pace, 0.2 * pace, 0.3 * pace, 0.4 * pace] }).status;

    it('ahead ≥ 1.05 · on-track ≥ 0.90 · slightly-behind ≥ 0.70 · behind below', () => {
        expect(PACE_THRESHOLDS).toEqual({ ahead: 1.05, onTrack: 0.9, slightlyBehind: 0.7 });
        expect(at(1.3)).toBe('ahead');
        expect(at(1.05)).toBe('ahead');
        expect(at(1.0)).toBe('on-track');
        expect(at(0.9)).toBe('on-track');
        expect(at(0.89)).toBe('slightly-behind');
        expect(at(0.7)).toBe('slightly-behind');
        expect(at(0.69)).toBe('behind');
        expect(at(0.2)).toBe('behind');
    });

    it('not-started: no report at all', () => {
        const p = computePace({ plan: PLAN10, actual: [] });
        expect(p.status).toBe('not-started');
        expect(p.pace).toBeNull();
        expect(p.velocity).toBeNull();
        expect(p.ageWeeks).toBeNull();
        expect(p.projectedFinishWeek).toBeNull();
        expect(p.requiredPace).toBeCloseTo(0.1, 12);      // the plan's own pace: 10 % per week
        expect(requiredPaceText(p)).toBe('ต้องทำ 10.0% ต่อสัปดาห์เพื่อเสร็จตามแผน');
        expect(computePace({ plan: PLAN10, actual: [null, null] }).status).toBe('not-started');
        expect(ageText(p.ageWeeks)).toBe('ยังไม่มีรายงานผลงาน');
    });

    it("the user's case: actual 0 % for 3 weeks → stalled, 2–3 weeks older than the plan, finish unknown", () => {
        // Plan like the sample: nothing in W1, then growing.
        const plan = [0, 0.0656, 0.0713, 0.1761, 0.2261, 0.2907, 0.3421, 0.4048, 0.4838, 0.5309, 1];
        const p = computePace({ plan, actual: [0, 0, 0] });
        expect(p.status).toBe('stalled');
        expect(p.pace).toBe(0);
        expect(p.velocity?.actual).toBe(0);
        expect(p.velocity?.plan).toBeCloseTo(0.0713 / 3, 12);
        expect(p.velocity?.weeks).toBe(3);
        expect(p.equivalentPlanWeek).toBe(0);          // 0 % = end of W1 (the plan had nothing in W1)
        expect(p.ageWeeks).toBe(2);
        expect(ageText(p.ageWeeks)).toBe('แก่กว่าแผน 2 สัปดาห์');
        expect(ageExplanation(p)).toBe('งานที่ทำได้เท่ากับแผนสัปดาห์ที่ 1 แต่ตอนนี้คือสัปดาห์ที่ 3');
        expect(p.projectedFinishWeek).toBeNull();     // ยังประเมินไม่ได้
        expect(p.finishDeltaWeeks).toBeNull();
        expect(p.acceleration).toEqual({ delta: 0, trend: 'steady', weeks: 1 });
        expect(paceText(p.pace)).toBe('ช้ากว่าแผน 100%');
        // With one more week and a plan that starts at 0 the age is 3 weeks.
        const q = computePace({ plan: [0, 0, 0.1, 0.2, 1], actual: [0, 0, 0, 0] });
        expect(q.status).toBe('stalled');
        expect(q.ageWeeks).toBe(2);                   // weeks 1–2 planned nothing: equivalent plan week is W2
        const r = computePace({ plan: [0.05, 0.1, 0.2, 0.3, 1], actual: [0, 0, 0] });
        expect(r.ageWeeks).toBe(3);                   // plan started at once: 0 % = before W1
    });

    it('stalled only when the plan moved in the window: a planned pause is not a stall', () => {
        const paused = computePace({ plan: [0.2, 0.2, 0.2, 0.5], actual: [0.2, 0.2, 0.2] });
        expect(paused.status).toBe('on-track');
        const flat = computePace({ plan: [0.2, 0.3, 0.4, 0.5], actual: [0.2, 0.2, 0.2] });
        expect(flat.status).toBe('stalled');
        // A single reported week at 0 % cannot be "stalled" yet: it is behind.
        expect(computePace({ plan: PLAN10, actual: [0] }).status).toBe('behind');
        expect(computePace({ plan: PLAN10, actual: [0] }).projectedFinishWeek).toBeNull();   // < 2 reported weeks
    });

    it('nothing planned yet at the reported week: ahead if any work, else on-track; pace is null', () => {
        const early = computePace({ plan: [0, 0, 0.3, 1], actual: [0.05] });
        expect(early.pace).toBeNull();
        expect(early.status).toBe('ahead');
        expect(paceText(early.pace)).toBe('ยังไม่มีแผนในช่วงนี้');
        expect(computePace({ plan: [0, 0, 0.3, 1], actual: [0] }).status).toBe('on-track');
    });

    it('plan 100 % reached: ahead / on-track / behind by the week the actual got there', () => {
        const plan = [0.25, 0.5, 0.75, 1, 1, 1];
        const early = computePace({ plan, actual: [0.4, 0.8, 1] });
        expect(early.isComplete).toBe(true);
        expect(early.status).toBe('ahead');
        expect(early.projectedFinishWeek).toBe(2);
        expect(early.finishDeltaWeeks).toBe(-1);
        expect(early.requiredPace).toBeNull();
        expect(early.ageWeeks).toBeCloseTo(-1, 12);
        expect(computePace({ plan, actual: [0.3, 0.6, 0.8, 1] }).status).toBe('on-track');
        const late = computePace({ plan, actual: [0.2, 0.4, 0.6, 0.8, 0.9, 1] });
        expect(late.status).toBe('behind');
        expect(late.finishDeltaWeeks).toBe(2);
        expect(late.ageWeeks).toBeCloseTo(2, 12);
    });

    it('actual reported beyond the plan end: the plan is held at its last value', () => {
        const p = computePace({ plan: [0.5, 1], actual: [0.2, 0.4, 0.6, 0.7] });
        expect(p.planPct).toBe(1);
        expect(p.pace).toBeCloseTo(0.7, 12);
        expect(p.status).toBe('slightly-behind');
        expect(p.velocity?.plan).toBeCloseTo(0.25, 12);   // (1 − 0) over 4 weeks
        expect(p.requiredPace).toBeNull();                // the plan's finish week has passed
        expect(p.ageWeeks).toBeCloseTo(3 - 0.4, 12);      // 70 % = plan week 1.4 (0-based 0.4)
        expect(ageText(p.ageWeeks)).toBe('แก่กว่าแผน 3 สัปดาห์');
    });

    it('a plan that never reaches 100 % has no finish week, pace and required pace are null-safe', () => {
        const p = computePace({ plan: [0.2, 0.4], actual: [0.1, 0.2] });
        expect(p.planFinishWeek).toBeNull();
        expect(p.finishDeltaWeeks).toBeNull();
        expect(p.requiredPace).toBeNull();
        expect(p.planPace).toBeNull();
        expect(p.projectedFinishWeek).toBeCloseTo(1 + 0.8 / 0.1, 9);
    });
});

describe('Thai readings', () => {
    it('paceText / ageText', () => {
        expect(paceText(0.72)).toBe('ช้ากว่าแผน 28%');
        expect(paceText(1.12)).toBe('เร็วกว่าแผน 12%');
        expect(paceText(1.004)).toBe('ตามแผนพอดี');
        expect(ageText(4)).toBe('แก่กว่าแผน 4 สัปดาห์');
        expect(ageText(-1.6)).toBe('เด็กกว่าแผน 2 สัปดาห์');
        expect(ageText(0.3)).toBe('อายุตามแผนพอดี');
    });
});

describe('paceFromSchedule (the Excel v5 sample)', () => {
    const boq = computeBoq({ sections: BOQ_TEMPLATE_V5 });

    it('sample project: one report of 7,000 บาท in W2 ม.ค.-26 → far behind, about one week older', () => {
        const s = computePlanning(defaultPlanningInput(), boq).schedule;
        const p = paceFromSchedule(s);
        expect(p.latestReported).toBe(1);
        expect(p.labels.latestReported).toBe('W2 ม.ค.-26');
        expect(p.labels.current).toBe('W2 ม.ค.-26');
        expect(p.actualPct).toBeCloseTo(7000 / s.budget, 12);
        expect(p.planPct).toBeCloseTo(s.planCumulative[1] ?? 0, 12);
        expect(p.pace).toBeCloseTo((7000 / s.budget) / (s.planCumulative[1] ?? 1), 12);
        expect(p.status).toBe('behind');
        expect(p.reportedWeeks).toBe(2);
        expect(p.velocity?.weeks).toBe(2);
        expect(p.ageWeeks).toBeGreaterThan(0.9);
        expect(p.ageWeeks).toBeLessThan(1);
        expect(p.planFinishWeek).toBe(19);
        expect(p.labels.planFinish).toBe('W4 พ.ค.-26');
        // 99.6 % left at 0.19 %/wk: far beyond the 12-month axis, label extended past it.
        expect(p.projectedFinishWeek).toBeGreaterThan(400);
        expect(p.labels.projectedFinish).toMatch(/^W[1-4] /);
        expect(p.weekly[0]).toBeNull();
        expect(p.weekly[1]).toBeCloseTo((7000 / s.budget) / (s.planCumulative[1] ?? 1), 12);
        expect(p.weekly[2]).toBeNull();
    });

    it('blank project: not started, shows the plan’s required pace', () => {
        const s = computePlanning(blankPlanningInput(), boq).schedule;
        const p = paceFromSchedule(s);
        expect(p.status).toBe('not-started');
        expect(p.labels.latestReported).toBeNull();
        expect(p.planStartWeek).toBe(1);
        expect(p.planFinishWeek).toBe(19);
        expect(p.requiredPace).toBeCloseTo(1 / 19, 12);
        expect(requiredPaceText(p)).toBe('ต้องทำ 5.3% ต่อสัปดาห์เพื่อเสร็จตามแผน');
    });

    it('`today` moves "now" past the last report; the stalled sample (cost 0 for 3 weeks)', () => {
        const input = defaultPlanningInput();
        const t = input.schedule.tasks['1.1'];
        if (t) t.actual = { start: '2026-01-16', days: 1, cost: 0 };
        const s = computePlanning(input, boq).schedule;
        const p = paceFromSchedule(s);
        expect(p.latestReported).toBe(2);
        expect(p.status).toBe('stalled');
        expect(p.ageWeeks).toBe(2);
        expect(p.projectedFinishWeek).toBeNull();
        expect(p.labels.projectedFinish).toBeNull();
        const later = paceFromSchedule(s, { today: '2026-02-10' });
        expect(later.currentWeek).toBe(5);
        expect(later.labels.current).toBe('W2 ก.พ.-26');
        expect(later.ageWeeks).toBe(5);
    });
});
