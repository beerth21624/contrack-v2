// ─── Which levels are done, which ones can be worked on now, which are still waiting ───
import { JOURNEY_LEVELS, type JourneyLevel } from './levels';

/** What the user marked: a level passed ("done") or marked as not in this project ("skipped"). */
export type LevelMark = 'done' | 'skipped';

/** Stored in the project. Levels not listed are not passed yet. */
export type JourneyProgress = Record<string, LevelMark>;

/** A marked level keeps its mark; an unmarked one is "current" (can be worked on now) or "locked" (waiting). */
export type LevelState = LevelMark | 'current' | 'locked';

/** Done and "ไม่มีในโครงการนี้" both count as passed. */
const isPassed = (progress: JourneyProgress, levelId: string): boolean => progress[levelId] !== undefined;

const prerequisitesPassed = (level: JourneyLevel, progress: JourneyProgress): boolean =>
    level.after.every(id => isPassed(progress, id));

/**
 * Levels open by prerequisites: an unmarked level is "current" once every level in its `after` list is passed,
 * else "locked". Several levels can be current at once (work done side by side). Passed levels stay open for
 * editing; reopening one (clearing its mark) never locks later levels that were already passed.
 */
export function levelStates(progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): Record<string, LevelState> {
    const out: Record<string, LevelState> = {};
    for (const l of levels) {
        const mark = progress[l.id];
        out[l.id] = mark ?? (prerequisitesPassed(l, progress) ? 'current' : 'locked');
    }
    return out;
}

/** Levels that can be worked on now (unmarked, every prerequisite passed), in journey order. */
export function availableLevels(progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): JourneyLevel[] {
    return levels.filter(l => !isPassed(progress, l.id) && prerequisitesPassed(l, progress));
}

/** The level to continue with (the first one available, in journey order), or undefined when every level is passed. */
export function currentLevel(progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): JourneyLevel | undefined {
    return availableLevels(progress, levels)[0];
}

/** The prerequisites of `levelId` not passed yet (what it waits for, "รอ: …"), in journey order. */
export function blockingLevels(levelId: string, progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): JourneyLevel[] {
    const level = levels.find(l => l.id === levelId);
    if (level === undefined) return [];
    return levels.filter(l => level.after.includes(l.id) && !isPassed(progress, l.id));
}

/**
 * The available level to do first on the way to `levelId`: the earliest of its unpassed prerequisites, direct or
 * indirect (it is available itself, since its own prerequisites come earlier). The level itself when it is open.
 */
export function firstStepToward(levelId: string, progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): JourneyLevel | undefined {
    const level = levels.find(l => l.id === levelId);
    if (level === undefined) return undefined;
    if (isPassed(progress, level.id) || prerequisitesPassed(level, progress)) return level;
    const needed = new Set<string>();
    const visit = (l: JourneyLevel) => {
        for (const id of l.after) {
            if (needed.has(id)) continue;
            needed.add(id);
            const dep = levels.find(x => x.id === id);
            if (dep !== undefined) visit(dep);
        }
    };
    visit(level);
    const states = levelStates(progress, levels);
    return levels.find(l => needed.has(l.id) && states[l.id] === 'current') ?? currentLevel(progress, levels);
}

export function isUnlocked(levelId: string, progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): boolean {
    const state = levelStates(progress, levels)[levelId];
    return state !== undefined && state !== 'locked';
}

export function journeyComplete(progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): boolean {
    return levels.every(l => isPassed(progress, l.id));
}

/** Passed levels / all levels, 0–1. */
export function journeyRatio(progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): number {
    if (levels.length === 0) return 1;
    return levels.filter(l => isPassed(progress, l.id)).length / levels.length;
}

/**
 * Where "ยืนยันและไปขั้นตอนถัดไป" leads once `levelId` is passed: the next available level after it in journey
 * order, else the first available one before it (work left behind), else undefined (every level passed).
 * `levelId` counts as passed here even when it is not marked yet (the button marks it).
 */
export function nextLevel(levelId: string, progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): JourneyLevel | undefined {
    const i = levels.findIndex(l => l.id === levelId);
    if (i < 0) return undefined;
    const once: JourneyProgress = isPassed(progress, levelId) ? progress : { ...progress, [levelId]: 'done' };
    const available = availableLevels(once, levels);
    return available.find(l => levels.indexOf(l) > i) ?? available[0];
}

/** The nearest open level (passed or available) after `levelId`, for stepping through the journey. */
export function nextOpenLevel(levelId: string, progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): JourneyLevel | undefined {
    const i = levels.findIndex(l => l.id === levelId);
    if (i < 0) return undefined;
    const states = levelStates(progress, levels);
    return levels.slice(i + 1).find(l => states[l.id] !== 'locked');
}

/** The nearest open level (passed or available) before `levelId`; locked levels in between are passed over. */
export function previousLevel(levelId: string, progress: JourneyProgress, levels: readonly JourneyLevel[] = JOURNEY_LEVELS): JourneyLevel | undefined {
    const i = levels.findIndex(l => l.id === levelId);
    if (i <= 0) return undefined;
    const states = levelStates(progress, levels);
    return levels.slice(0, i).reverse().find(l => states[l.id] !== 'locked');
}
