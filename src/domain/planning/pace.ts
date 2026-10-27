// ─── Project pace ("อายุโครงการ") ────────────────────────────────────────────
// How fast the project really moves against its plan, read off the same cumulative plan / actual
// series as the S-curve (schedule.planCumulative row 87, schedule.actualCumulative row 91). Pure.
//
// Series: `plan[i]` and `actual[i]` are cumulative shares (0–1) at the END of week bucket i.
// `actual[i] === null` means "no report for that week" (unknown, not 0). The latest reported week
// is the last non-null actual; "now" (`currentWeek`) defaults to it.
//
// Readings
//   pace          = actual ÷ plan at the latest reported week (1 = on plan; 0.72 = "ช้ากว่าแผน 28%").
//   velocity      = actual % per week over the last `window` reported weeks (4 by default, fewer when
//                   the project is younger) vs the plan's % per week over the same weeks.
//   acceleration  = velocity of that window − velocity of the window before it.
//   age           = the plan week whose cumulative % equals today's actual % ("งานที่ทำได้เท่ากับแผน
//                   สัปดาห์ที่ 3 ทั้งที่อยู่สัปดาห์ที่ 7" → ageWeeks = +4, older than the plan).
//   projectedFinish = latest reported week + remaining % ÷ velocity; "ยังประเมินไม่ได้" (null) when
//                   velocity ≤ 0 or fewer than 2 reported weeks.
//
// Status thresholds (on the pace ratio, in this order)
//   not-started      no reported week at all.
//   (complete)       actual ≥ 100 %: ahead / on-track / behind by the week it was reached vs the plan finish.
//   stalled          ≥ 2 reported weeks, the plan grew since the report `window` weeks ago (or the first
//                    report, if younger) but the actual did not.
//   plan still 0 %   nothing planned yet: ahead when actual > 0, otherwise on-track.
//   ahead            pace ≥ 1.05
//   on-track         0.90 ≤ pace < 1.05
//   slightly-behind  0.70 ≤ pace < 0.90
//   behind           pace < 0.70
// Acceleration trend: |Δvelocity| < 0.5 percentage point per week = steady.
import { buildWeekBuckets, bucketIndexOf, isoToSerial, type WeekBucket } from './calendar';
import type { ScheduleResult } from './schedule';

export type PaceStatus = 'ahead' | 'on-track' | 'slightly-behind' | 'behind' | 'stalled' | 'not-started';
export type PaceTrend = 'up' | 'steady' | 'down';

export const PACE_THRESHOLDS = { ahead: 1.05, onTrack: 0.9, slightlyBehind: 0.7 } as const;
/** Velocity change (share per week) below which the acceleration reads as "steady". */
export const ACCELERATION_STEADY = 0.005;
export const DEFAULT_PACE_WINDOW = 4;

export interface PaceInput {
    /** Cumulative plan share per week bucket (0–1). */
    plan: number[];
    /** Cumulative actual share per week bucket; null = no report for that week. */
    actual: (number | null)[];
    /** "Now" as a bucket index; defaults to the latest reported week. */
    currentWeek?: number;
    /** Weeks in the velocity window (default 4). */
    window?: number;
}

export interface PaceVelocity {
    /** Actual share per week over the window. */
    actual: number;
    /** Plan share per week over the same weeks. */
    plan: number;
    /** Window length actually used (≤ `window`). */
    weeks: number;
}

export interface PaceAcceleration {
    /** Actual velocity of the last window − that of the window before (share per week). */
    delta: number;
    trend: PaceTrend;
    /** Length of each of the two windows. */
    weeks: number;
}

export interface ProjectPace {
    status: PaceStatus;
    /** Actual reached 100 %. */
    isComplete: boolean;
    /** Number of weeks with a report (nulls excluded) up to the latest reported week. */
    reportedWeeks: number;
    /** Bucket index of the latest reported week; null before the first report. */
    latestReported: number | null;
    /** "Now" bucket index (defaults to latestReported); null before the first report. */
    currentWeek: number | null;
    /** Cumulative actual / plan at the latest reported week (0–1). */
    actualPct: number;
    planPct: number;
    /** actualPct ÷ planPct; null when nothing is planned yet or nothing is reported. */
    pace: number | null;
    velocity: PaceVelocity | null;
    acceleration: PaceAcceleration | null;
    /** The (fractional, 0-based) plan week whose cumulative % equals actualPct. */
    equivalentPlanWeek: number | null;
    /** currentWeek − equivalentPlanWeek: > 0 the project is older (behind) than the plan, < 0 younger (ahead). */
    ageWeeks: number | null;
    /** First bucket where the plan reaches 100 %; null when it never does. */
    planFinishWeek: number | null;
    /** First bucket where the plan is > 0 (the plan's first working week). */
    planStartWeek: number | null;
    /** Fractional bucket index where the actual reaches 100 % at the current velocity; null = ยังประเมินไม่ได้. */
    projectedFinishWeek: number | null;
    /** projectedFinishWeek − planFinishWeek (> 0 late). */
    finishDeltaWeeks: number | null;
    /** The plan's average share per week over its working weeks. */
    planPace: number | null;
    /** Share per week needed from now to finish on the plan's week; null when the plan week has passed. */
    requiredPace: number | null;
    /** Pace per reported week (actual ÷ plan at that week); null where unreported or nothing planned. */
    weekly: (number | null)[];
}

const EPS = 1e-9;

const finite = (x: number | null | undefined): number | null => (x === null || x === undefined || !Number.isFinite(x) ? null : x);

/** Last reported actual at or before index i (carried forward over gaps); 0 before the first report. */
function actualAtOrBefore(actual: (number | null)[], i: number): number {
    for (let k = Math.min(i, actual.length - 1); k >= 0; k--) {
        const v = finite(actual[k]);
        if (v !== null) return v;
    }
    return 0;
}

const planAt = (plan: number[], i: number): number => (i < 0 ? 0 : (finite(plan[Math.min(i, plan.length - 1)]) ?? 0));

/** Share per week between the end of week `from` (exclusive) and the end of week `to` (inclusive). */
function slope(series: (i: number) => number, from: number, to: number): number {
    const weeks = to - from;
    return weeks <= 0 ? 0 : (series(to) - series(from)) / weeks;
}

/**
 * The fractional 0-based week at whose end the plan's cumulative share equals `value`: the last week where the
 * plan is still ≤ value, then linear interpolation towards the next week. −1 = before the first week.
 */
export function equivalentPlanWeek(plan: number[], value: number): number | null {
    if (plan.length === 0) return null;
    const last = plan.length - 1;
    if (value >= planAt(plan, last) - EPS) {
        // At or beyond the plan's final value: the first week that reaches it.
        for (let i = 0; i <= last; i++) if (planAt(plan, i) >= planAt(plan, last) - EPS) return i;
        return last;
    }
    let k = -1;
    for (let i = 0; i <= last; i++) if (planAt(plan, i) <= value + EPS) k = i;
    const lo = planAt(plan, k);
    const hi = planAt(plan, k + 1);
    const frac = hi - lo <= EPS ? 0 : (value - lo) / (hi - lo);
    return k + Math.min(1, Math.max(0, frac));
}

function trendOf(delta: number): PaceTrend {
    return delta >= ACCELERATION_STEADY ? 'up' : delta <= -ACCELERATION_STEADY ? 'down' : 'steady';
}

export function computePace(input: PaceInput): ProjectPace {
    const plan = input.plan.map(v => finite(v) ?? 0);
    const actual = input.actual.map(v => finite(v));
    const window = Math.max(1, Math.round(input.window ?? DEFAULT_PACE_WINDOW));

    const planFinishWeek = (() => { const i = plan.findIndex(v => v >= 1 - EPS); return i < 0 ? null : i; })();
    const planStartWeek = (() => { const i = plan.findIndex(v => v > EPS); return i < 0 ? null : i; })();
    const planPace = planFinishWeek === null || planStartWeek === null ? null : 1 / (planFinishWeek - planStartWeek + 1);

    let latestReported: number | null = null;
    for (let i = 0; i < actual.length; i++) if (actual[i] !== null) latestReported = i;
    const reportedWeeks = actual.filter(v => v !== null).length;

    const weekly = actual.map((v, i) => (v === null || planAt(plan, i) <= EPS ? null : v / planAt(plan, i)));

    if (latestReported === null) {
        return {
            status: 'not-started', isComplete: false, reportedWeeks: 0, latestReported: null, currentWeek: null,
            actualPct: 0, planPct: 0, pace: null, velocity: null, acceleration: null,
            equivalentPlanWeek: null, ageWeeks: null, planFinishWeek, planStartWeek,
            projectedFinishWeek: null, finishDeltaWeeks: null, planPace, requiredPace: planPace, weekly,
        };
    }

    const latest: number = latestReported;
    const currentWeek = Math.max(latest, Math.round(finite(input.currentWeek) ?? latest));
    const actualPct = actualAtOrBefore(actual, latest);
    const planPct = planAt(plan, latest);
    const pace = planPct <= EPS ? null : actualPct / planPct;
    const isComplete = actualPct >= 1 - EPS;

    // Velocity over the last `window` weeks ending at the latest report (fewer when the project is younger).
    const n = Math.min(window, latest + 1);
    const aAt = (i: number) => actualAtOrBefore(actual, i);
    const pAt = (i: number) => planAt(plan, i);
    const velocity: PaceVelocity = { actual: slope(aAt, latest - n, latest), plan: slope(pAt, latest - n, latest), weeks: n };

    // Acceleration: two back-to-back windows of equal length (≥ 2 reported weeks).
    let acceleration: PaceAcceleration | null = null;
    if (latest + 1 >= 2) {
        const m = Math.min(window, Math.floor((latest + 1) / 2));
        const now = slope(aAt, latest - m, latest);
        const before = slope(aAt, latest - 2 * m, latest - m);
        const delta = now - before;
        acceleration = { delta, trend: trendOf(delta), weeks: m };
    }

    // Stall check: change between the report `window` weeks back (or the first report) and the latest one.
    const m0 = Math.min(window, latest);
    const stalled = latest >= 1 && slope(pAt, latest - m0, latest) > EPS && slope(aAt, latest - m0, latest) <= EPS;

    const eq = equivalentPlanWeek(plan, actualPct);
    const ageWeeks = eq === null ? null : currentWeek - eq;

    let projectedFinishWeek: number | null = null;
    if (isComplete) {
        for (let i = 0; i <= latest; i++) if (aAt(i) >= 1 - EPS) { projectedFinishWeek = i; break; }
    } else if (latest + 1 >= 2 && velocity.actual > EPS) {
        projectedFinishWeek = latest + (1 - actualPct) / velocity.actual;
    }
    const finishDeltaWeeks = projectedFinishWeek === null || planFinishWeek === null ? null : projectedFinishWeek - planFinishWeek;

    const requiredPace = isComplete || planFinishWeek === null || planFinishWeek <= latest
        ? null
        : (1 - actualPct) / (planFinishWeek - latest);

    let status: PaceStatus;
    if (isComplete) {
        const done = projectedFinishWeek ?? latest;
        status = planFinishWeek === null || done < planFinishWeek ? 'ahead' : done === planFinishWeek ? 'on-track' : 'behind';
    } else if (stalled) {
        status = 'stalled';
    } else if (pace === null) {
        status = actualPct > EPS ? 'ahead' : 'on-track';
    } else if (pace + EPS >= PACE_THRESHOLDS.ahead) {
        status = 'ahead';
    } else if (pace + EPS >= PACE_THRESHOLDS.onTrack) {
        status = 'on-track';
    } else if (pace + EPS >= PACE_THRESHOLDS.slightlyBehind) {
        status = 'slightly-behind';
    } else {
        status = 'behind';
    }

    return {
        status, isComplete, reportedWeeks, latestReported: latest, currentWeek, actualPct, planPct, pace,
        velocity, acceleration, equivalentPlanWeek: eq, ageWeeks, planFinishWeek, planStartWeek,
        projectedFinishWeek, finishDeltaWeeks, planPace, requiredPace, weekly,
    };
}

// ─── Thai readings ────────────────────────────────────────────────────────────

export const PACE_STATUS_LABEL: Record<PaceStatus, string> = {
    'ahead': 'เร็วกว่าแผน',
    'on-track': 'ตามแผน',
    'slightly-behind': 'ช้ากว่าแผนเล็กน้อย',
    'behind': 'ช้ากว่าแผน',
    'stalled': 'งานหยุดนิ่ง',
    'not-started': 'ยังไม่เริ่มรายงาน',
};

const pct = (v: number, digits = 0): string => `${(v * 100).toFixed(digits)}%`;
const weeksText = (w: number): string => `${Math.round(Math.abs(w))} สัปดาห์`;

/** "ช้ากว่าแผน 28%" / "เร็วกว่าแผน 12%" / "ตามแผนพอดี"; null pace → "ยังไม่มีแผนในช่วงนี้". */
export function paceText(pace: number | null): string {
    if (pace === null) return 'ยังไม่มีแผนในช่วงนี้';
    const d = Math.round((pace - 1) * 100);
    if (d === 0) return 'ตามแผนพอดี';
    return d < 0 ? `ช้ากว่าแผน ${-d}%` : `เร็วกว่าแผน ${d}%`;
}

/** "แก่กว่าแผน 4 สัปดาห์" (behind) / "เด็กกว่าแผน 2 สัปดาห์" (ahead) / "ตามแผนพอดี". */
export function ageText(ageWeeks: number | null): string {
    if (ageWeeks === null) return 'ยังไม่มีรายงานผลงาน';
    const r = Math.round(ageWeeks);
    if (r === 0) return 'อายุตามแผนพอดี';
    return r > 0 ? `แก่กว่าแผน ${weeksText(r)}` : `เด็กกว่าแผน ${weeksText(r)}`;
}

/** "งานที่ทำได้เท่ากับแผนสัปดาห์ที่ 3 แต่ตอนนี้คือสัปดาห์ที่ 7" (1-based week numbers). */
export function ageExplanation(p: ProjectPace): string {
    if (p.equivalentPlanWeek === null || p.currentWeek === null) return 'เมื่อมีรายงานผลงาน จะเทียบได้ว่างานที่ทำได้เท่ากับแผนสัปดาห์ที่เท่าไร';
    const eq = Math.max(0, Math.round(p.equivalentPlanWeek + 1));
    const now = p.currentWeek + 1;
    if (eq === 0) return `ยังไม่มีผลงานเทียบเท่าแผนสัปดาห์แรก ทั้งที่ตอนนี้คือสัปดาห์ที่ ${now}`;
    if (eq === now) return `งานที่ทำได้เท่ากับแผนสัปดาห์ที่ ${eq} ซึ่งคือสัปดาห์นี้พอดี`;
    return `งานที่ทำได้เท่ากับแผนสัปดาห์ที่ ${eq} แต่ตอนนี้คือสัปดาห์ที่ ${now}`;
}

export const TREND_LABEL: Record<PaceTrend, string> = { up: 'เร่งขึ้น', steady: 'คงที่', down: 'ช้าลง' };

/** "ต้องทำ 3.1% ต่อสัปดาห์เพื่อเสร็จตามแผน". */
export function requiredPaceText(p: ProjectPace): string | null {
    if (p.requiredPace === null) return null;
    return `ต้องทำ ${pct(p.requiredPace, 1)} ต่อสัปดาห์เพื่อเสร็จตามแผน`;
}

// ─── From the schedule result ─────────────────────────────────────────────────

export interface SchedulePace extends ProjectPace {
    /** Week bucket labels ("W3 มี.ค.-26") of the readings; null where the reading is null. */
    labels: {
        current: string | null;
        latestReported: string | null;
        planFinish: string | null;
        projectedFinish: string | null;
    };
}

const label = (b: WeekBucket | undefined): string | null => (b ? `${b.weekLabel} ${b.monthLabel}` : null);

/** Bucket at index i, extending the axis past its end when a projection lands beyond it. */
function bucketAt(schedule: ScheduleResult, i: number | null): WeekBucket | undefined {
    if (i === null || !Number.isFinite(i)) return undefined;
    const idx = Math.max(0, Math.ceil(i - EPS));
    const b = schedule.buckets[idx];
    if (b !== undefined) return b;
    const first = schedule.buckets[0];
    if (first === undefined) return undefined;
    return buildWeekBuckets(first.startSerial, Math.floor(idx / 4) + 1)[idx];
}

/**
 * Pace of a computed schedule. The actual series counts as reported up to the bucket of the last update
 * (status.lastUpdate, Excel Q4); later buckets are unreported. `today` (ISO) moves "now" past the last report.
 */
export function paceFromSchedule(schedule: ScheduleResult, opts: { today?: string; window?: number } = {}): SchedulePace {
    const lastSerial = isoToSerial(schedule.status.lastUpdate);
    const until = lastSerial === null ? -1 : bucketIndexOf(schedule.buckets, lastSerial);
    const actual = schedule.actualCumulative.map((v, i) => (i <= until ? v : null));
    const todaySerial = isoToSerial(opts.today);
    const todayIdx = todaySerial === null ? undefined : Math.max(0, bucketIndexOf(schedule.buckets, todaySerial));
    const p = computePace({ plan: schedule.planCumulative, actual, currentWeek: todayIdx, window: opts.window });
    return {
        ...p,
        labels: {
            current: label(bucketAt(schedule, p.currentWeek)),
            latestReported: label(bucketAt(schedule, p.latestReported)),
            planFinish: label(bucketAt(schedule, p.planFinishWeek)),
            projectedFinish: label(bucketAt(schedule, p.projectedFinishWeek)),
        },
    };
}
