// Readings of the project pace in the UI language (the Thai wording lives in messages/th/planning.json "pace").
// Mirrors paceText / ageText / PACE_STATUS_LABEL of src/domain/planning/pace.ts, which stay as the Thai reference.
import type { PaceStatus } from '@/domain/planning';
import type { PlanningT } from '../text';

export function paceStatusLabel(status: PaceStatus, t: PlanningT): string {
    switch (status) {
        case 'ahead': return t('pace.status.ahead');
        case 'on-track': return t('pace.status.onTrack');
        case 'slightly-behind': return t('pace.status.slightlyBehind');
        case 'behind': return t('pace.status.behind');
        case 'stalled': return t('pace.status.stalled');
        case 'not-started': return t('pace.status.notStarted');
    }
}

/** "Behind plan 28%" / "Ahead of plan 12%" / "On plan"; null pace → "No plan for this period". */
export function paceReading(pace: number | null, t: PlanningT): string {
    if (pace === null) return t('pace.noPlan');
    const d = Math.round((pace - 1) * 100);
    if (d === 0) return t('pace.onPlan');
    return d < 0 ? t('pace.behindBy', { pct: -d }) : t('pace.aheadBy', { pct: d });
}

/** "Running 4 weeks behind plan" / "Running 2 weeks ahead of plan" / "Exactly on plan". */
export function ageReading(ageWeeks: number | null, t: PlanningT): string {
    if (ageWeeks === null) return t('pace.noReport');
    const r = Math.round(ageWeeks);
    if (r === 0) return t('pace.ageOnPlan');
    const n = Math.round(Math.abs(r));
    return r > 0 ? t('pace.older', { n }) : t('pace.younger', { n });
}
