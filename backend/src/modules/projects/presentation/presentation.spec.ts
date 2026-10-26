// Route parameter parsing and the DTO mappers the controllers return.
import {
    activityDtoSchema, levelAssignmentDtoSchema, projectDetailDtoSchema, projectDtoSchema, revisionDetailDtoSchema,
} from '@contrack/contract';
import {
    activityToDto, assignmentToDto, projectDetailToDto, projectToDto, revisionToDetailDto,
} from '../application/project-dto.mapper';
import { ESTIMATOR, OWNER, SAMPLE_DOCS, WS_A, projectsKit } from '../testing/projects-test-kit';
import { parseDocKeyParam, parseLevelIdParam } from './route-params';

describe('route params', () => {
    it('docKey: decoded once more when still escaped, checked with the contract schema (422 otherwise)', () => {
        expect(parseDocKeyParam('calc:footing')).toEqual({ ok: true, value: 'calc:footing' });
        expect(parseDocKeyParam('calc%3Afooting')).toEqual({ ok: true, value: 'calc:footing' });
        expect(parseDocKeyParam('boq:R13')).toEqual({ ok: true, value: 'boq:R13' });
        for (const bad of ['', 'calc:', 'nope', 'calc:Footing', '%E0%A4%A', 'meta/x']) {
            const r = parseDocKeyParam(bad);
            expect(!r.ok && r.error.code).toBe('unprocessable');
        }
    });

    it('levelId: checked with the contract schema', () => {
        expect(parseLevelIdParam('footing')).toEqual({ ok: true, value: 'footing' });
        expect(parseLevelIdParam('Footing!').ok).toBe(false);
    });
});

describe('DTO mappers', () => {
    it('every DTO matches its contract schema (ISO dates, string activity ids)', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject({ docs: [SAMPLE_DOCS.fill] });
        await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, archived: true });
        const project = await kit.projects.findInWorkspace(WS_A, p.id);
        if (project === undefined) throw new Error('missing');
        const docs = await kit.docs.listByProject(WS_A, p.id);

        const dto = projectToDto(project);
        expect(projectDtoSchema.parse(dto)).toEqual(dto);
        expect(dto.archivedAt).toBe(kit.clock.now().toISOString());
        expect(projectDetailDtoSchema.safeParse(projectDetailToDto(project, docs)).success).toBe(true);

        await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, archived: false });
        const rev = await kit.createRevision.execute({ userId: OWNER, projectId: p.id, label: 'R1' });
        if (!rev.ok) throw new Error(rev.error.message);
        expect(revisionDetailDtoSchema.safeParse(revisionToDetailDto(rev.value)).success).toBe(true);

        const assigned = await kit.putAssignment.execute({ userId: OWNER, projectId: p.id, levelId: 'footing', assigneeId: ESTIMATOR });
        if (!assigned.ok || assigned.value === null) throw new Error('assign');
        expect(levelAssignmentDtoSchema.safeParse(assignmentToDto(assigned.value)).success).toBe(true);

        const [entry] = await kit.activity.list(WS_A, p.id, { limit: 1 });
        if (entry === undefined) throw new Error('activity');
        const activity = activityToDto(entry);
        expect(typeof activity.id).toBe('string');
        expect(activity.id).toBe(entry.id.toString());
        expect(activityDtoSchema.safeParse(activity).success).toBe(true);
    });
});
