// Revision, LevelAssignment and ActivityEntry (small immutable entities).
import { createProject } from '@contrack/domain/project';
import { asProjectId, asRevisionId, asUserId, asWorkspaceId } from '../../../../shared/domain';
import { LevelId } from '../value-objects/level-id.value-object';
import { RevisionLabel } from '../value-objects/revision-label.value-object';
import { ActivityEntry } from './activity-entry.entity';
import { LevelAssignment } from './level-assignment.entity';
import { Revision } from './revision.entity';

const projectId = asProjectId('00000000-0000-4000-8000-000000000001');
const workspaceId = asWorkspaceId('00000000-0000-4000-8000-0000000000aa');
const user = asUserId('00000000-0000-4000-8000-0000000000bb');
const now = new Date('2026-01-01T00:00:00.000Z');

describe('Revision', () => {
    it('keeps label, note, snapshot and totals; round-trips', () => {
        const label = RevisionLabel.create('Rev 01');
        if (!label.ok) throw new Error('label');
        const totals = { constructionTotal: 5, preConstructionTotal: 1, levelsDone: 0, levelsTotal: 40 };
        const r = Revision.create({
            id: asRevisionId('00000000-0000-4000-8000-000000000009'), projectId, workspaceId, label: label.value,
            note: null, snapshot: createProject('blank'), totals, createdBy: user, now,
        });
        expect(r.label).toBe('Rev 01');
        expect(r.totals).toEqual(totals);
        expect(Revision.rehydrate(r.toProps()).toProps()).toEqual(r.toProps());
    });
});

describe('LevelAssignment', () => {
    it('assigns a journey level; round-trips', () => {
        const level = LevelId.create('footing');
        if (!level.ok) throw new Error('level');
        const a = LevelAssignment.assign({ projectId, workspaceId, levelId: level.value, userId: user, assignedBy: user, now });
        expect(a.levelId).toBe('footing');
        expect(a.assignedAt).toEqual(now);
        expect(LevelAssignment.rehydrate(a.toProps()).toProps()).toEqual(a.toProps());
    });
});

describe('ActivityEntry', () => {
    it('records without an id; a stored entry has a positive bigint id', () => {
        const draft = ActivityEntry.record({ workspaceId, projectId, userId: user, action: 'project.created', at: now });
        expect(draft.docKey).toBeNull();
        const stored = ActivityEntry.rehydrate({ ...draft, id: 5n });
        expect(stored.id).toBe(5n);
        expect(() => ActivityEntry.rehydrate({ ...draft, id: 0n })).toThrow();
    });
});
