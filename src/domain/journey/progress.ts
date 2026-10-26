// ─── Which levels are done, which one is next, which are still locked ───
import { JOURNEY_LEVELS, type JourneyLevel } from './levels';

/** What the user marked: a level passed ("done") or marked as not in this project ("skipped"). */
export type LevelMark = 'done' | 'skipped';

/** Stored in the project. Levels not listed are not passed yet. */
export type JourneyProgress = Record<string, LevelMark>;

export type LevelState = LevelMark | 'current' | 'locked';

/**
 * Levels unlock in order: the first level not passed yet is "current", the ones after it are locked.
 * Passed levels stay open for editing; reopening one makes it current again without locking later ones
 * that were already passed.
 */
export function levelStates(progress: JourneyProgress, levels: JourneyLevel[] = JOURNEY_LEVELS): Record<string, LevelState> {
    const out: Record<string, LevelState> = {};
    let currentFound = false;
    for (const l of levels) {
        const mark = progress[l.id];
        if (mark) out[l.id] = mark;
        else if (!currentFound) { out[l.id] = 'current'; currentFound = true; }
        else out[l.id] = 'locked';
    }
    return out;
}

/** The level to continue with, or undefined when every level is passed. */
export function currentLevel(progress: JourneyProgress, levels: JourneyLevel[] = JOURNEY_LEVELS): JourneyLevel | undefined {
    return levels.find(l => !progress[l.id]);
}

export function isUnlocked(levelId: string, progress: JourneyProgress, levels: JourneyLevel[] = JOURNEY_LEVELS): boolean {
    const state = levelStates(progress, levels)[levelId];
    return state !== undefined && state !== 'locked';
}

export function journeyComplete(progress: JourneyProgress, levels: JourneyLevel[] = JOURNEY_LEVELS): boolean {
    return levels.every(l => progress[l.id] !== undefined);
}

/** Passed levels / all levels, 0–1. */
export function journeyRatio(progress: JourneyProgress, levels: JourneyLevel[] = JOURNEY_LEVELS): number {
    if (levels.length === 0) return 1;
    return levels.filter(l => progress[l.id] !== undefined).length / levels.length;
}

/** Level after `levelId` in journey order (undefined after the last one). */
export function nextLevel(levelId: string, levels: JourneyLevel[] = JOURNEY_LEVELS): JourneyLevel | undefined {
    const i = levels.findIndex(l => l.id === levelId);
    return i < 0 ? undefined : levels[i + 1];
}

export function previousLevel(levelId: string, levels: JourneyLevel[] = JOURNEY_LEVELS): JourneyLevel | undefined {
    const i = levels.findIndex(l => l.id === levelId);
    return i <= 0 ? undefined : levels[i - 1];
}
