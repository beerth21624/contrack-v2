import { JOURNEY_LEVELS } from '@contrack/domain/journey/levels';
import { LevelId } from './level-id.value-object';
import { PROJECT_NAME_MAX, ProjectName } from './project-name.value-object';
import { REVISION_LABEL_MAX, REVISION_NOTE_MAX, RevisionLabel, revisionNote } from './revision-label.value-object';

describe('ProjectName', () => {
    it('trims and accepts 1–160 characters', () => {
        const r = ProjectName.create('  บ้านคุณสมชาย  ');
        expect(r.ok && r.value.value).toBe('บ้านคุณสมชาย');
        expect(ProjectName.create('x'.repeat(PROJECT_NAME_MAX)).ok).toBe(true);
    });

    it('refuses empty and too long names', () => {
        const empty = ProjectName.create('   ');
        expect(!empty.ok && empty.error.code).toBe('validation_failed');
        expect(ProjectName.create('x'.repeat(PROJECT_NAME_MAX + 1)).ok).toBe(false);
    });

    it('compares by value', () => {
        const a = ProjectName.create('A');
        const b = ProjectName.create(' A ');
        expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });
});

describe('RevisionLabel / note', () => {
    it('label: trimmed, 1–40 characters', () => {
        const r = RevisionLabel.create(' Rev 01 ');
        expect(r.ok && r.value.value).toBe('Rev 01');
        expect(RevisionLabel.create('').ok).toBe(false);
        expect(RevisionLabel.create('x'.repeat(REVISION_LABEL_MAX + 1)).ok).toBe(false);
    });

    it('note: empty → null, too long refused', () => {
        expect(revisionNote(undefined)).toEqual({ ok: true, value: null });
        expect(revisionNote('  ')).toEqual({ ok: true, value: null });
        expect(revisionNote(' ส่งลูกค้า ')).toEqual({ ok: true, value: 'ส่งลูกค้า' });
        expect(revisionNote('x'.repeat(REVISION_NOTE_MAX + 1)).ok).toBe(false);
    });
});

describe('LevelId', () => {
    it('accepts every journey level and nothing else', () => {
        for (const l of JOURNEY_LEVELS) expect(LevelId.create(l.id).ok).toBe(true);
        const r = LevelId.create('no-such-level');
        expect(!r.ok && r.error.code).toBe('unprocessable');
    });
});
