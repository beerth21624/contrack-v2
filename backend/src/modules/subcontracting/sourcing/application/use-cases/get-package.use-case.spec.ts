import { createProject } from '@contrack/domain/project';
import { subcontractableRows } from '@contrack/domain/subcontracting';
import { PROJECT_ID, SAMPLE_BOQ, SourcingKit, USERS, codeOf, describeBuyerAuthorization, valueOf } from '../../testing/sourcing-test-kit';
import { GetPackageUseCase } from './get-package.use-case';

describe('GetPackageUseCase', () => {
    it('returns the buyer view with estimates for a role that reads prices', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const dto = valueOf(await kit.get(GetPackageUseCase).execute({ actorId: USERS.estimator, packageId: draft.id as never }));
        expect(dto.lines.every(l => l.estTotal >= 0)).toBe(true);
        expect(dto.estimateTotal).toBe(draft.estimateTotal);
        expect(dto.estimateTotal).toBeGreaterThan(0);
    });

    it('zeroes every estimate for a viewer', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const dto = valueOf(await kit.get(GetPackageUseCase).execute({ actorId: USERS.viewer, packageId: draft.id as never }));
        expect(dto.estimateTotal).toBe(0);
        expect(dto.lines.every(l => l.estTotal === 0 && l.estLabUnit === 0 && l.estMatUnit === 0)).toBe(true);
    });

    it('reports BOQ drift when a quantity changed in the live BOQ', async () => {
        const kit = await SourcingKit.create();
        const key = subcontractableRows(SAMPLE_BOQ).find(r => r.row.editable.qty && r.row.qty !== 12345)?.row.key ?? '';
        const draft = await kit.draft({ lineKeys: [key] });
        const read = kit.projects.byId.get(PROJECT_ID);
        if (read === undefined) throw new Error('no project');
        const changed = createProject('sample');
        changed.boqOverrides = { ...changed.boqOverrides, [key]: { ...(changed.boqOverrides[key] ?? {}), qty: 12345 } };
        kit.projects.add({ ...read, project: changed });
        const dto = valueOf(await kit.get(GetPackageUseCase).execute({ actorId: USERS.owner, packageId: draft.id as never }));
        expect(dto.boqDrift).toEqual([expect.objectContaining({ idx: 0, now: 12345 })]);
    });

    it('unknown package → not_found', async () => {
        const kit = await SourcingKit.create();
        expect(codeOf(await kit.get(GetPackageUseCase).execute({ actorId: USERS.owner, packageId: '00000000-0000-4000-8000-0000000000ff' as never })))
            .toBe('not_found');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator', 'viewer'], k => k.draft(),
        (k, user, d) => k.get(GetPackageUseCase).execute({ actorId: user, packageId: d.id as never }));
});
