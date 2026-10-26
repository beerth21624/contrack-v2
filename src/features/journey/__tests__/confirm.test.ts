import { describe, expect, it } from 'vitest';
import { JOURNEY_LEVELS, missingRequirements, type MissingValue } from '@/domain/journey';
import { createProject } from '@/domain/project';
import { confirmOutcome, incompleteDoneCount } from '../confirm';

const missing: MissingValue[] = [{ label: 'ชื่อโครงการ', field: 'ชื่อโครงการ', fieldKey: 'projectName' }];

describe('confirmOutcome: the step primary button', () => {
    it('completes an open step with nothing missing', () => {
        expect(confirmOutcome(undefined, [])).toEqual({ kind: 'complete' });
    });
    it('blocks an open step with something missing, and hands the list on', () => {
        expect(confirmOutcome(undefined, missing)).toEqual({ kind: 'blocked', missing });
    });
    it('only moves on from a step already decided (a done step is never un-marked)', () => {
        expect(confirmOutcome('done', missing)).toEqual({ kind: 'move' });
        expect(confirmOutcome('done', [])).toEqual({ kind: 'move' });
        expect(confirmOutcome('skipped', [])).toEqual({ kind: 'move' });
    });
    it('a blank project cannot complete the project-info step until it has a name', () => {
        const p = createProject('blank');
        expect(confirmOutcome(undefined, missingRequirements('project-info', p)).kind).toBe('blocked');
        const named = { ...p, meta: { ...p.meta, projectName: 'บ้านคุณสมชาย' } };
        expect(confirmOutcome(undefined, missingRequirements('project-info', named)).kind).toBe('complete');
    });
    it('the sample house completes every step', () => {
        const p = createProject('sample');
        for (const l of JOURNEY_LEVELS) expect(confirmOutcome(undefined, missingRequirements(l.id, p)).kind, l.id).toBe('complete');
    });
});

describe('incompleteDoneCount: the quiet note on a done step', () => {
    it('counts only for a done step', () => {
        expect(incompleteDoneCount('done', missing)).toBe(1);
        expect(incompleteDoneCount('done', [])).toBe(0);
        expect(incompleteDoneCount(undefined, missing)).toBe(0);
        expect(incompleteDoneCount('skipped', missing)).toBe(0);
    });
});
