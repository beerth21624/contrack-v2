import { asWorkspaceId } from '../../../../shared/domain/ids';
import { WorkspaceName } from '../value-objects/workspace-name.value-object';
import { Workspace } from './workspace.entity';

const id = asWorkspaceId('00000000-0000-4000-8000-000000000001');
const createdAt = new Date('2026-01-01T00:00:00.000Z');

describe('Workspace', () => {
    it('creates a company workspace', () => {
        const w = Workspace.create({ id, name: WorkspaceName.rehydrate('Acme'), kind: 'company', createdAt });
        expect(w.id).toBe(id);
        expect(w.name.value).toBe('Acme');
        expect(w.kind).toBe('company');
        expect(w.isPersonal).toBe(false);
        expect(w.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('knows a personal workspace', () => {
        const w = Workspace.create({ id, name: WorkspaceName.rehydrate('Me (ส่วนตัว)'), kind: 'personal', createdAt });
        expect(w.isPersonal).toBe(true);
    });

    it('renames', () => {
        const w = Workspace.create({ id, name: WorkspaceName.rehydrate('Acme'), kind: 'company', createdAt });
        w.rename(WorkspaceName.rehydrate('Acme Group'));
        expect(w.name.value).toBe('Acme Group');
        expect(w.toProps().name.value).toBe('Acme Group');
    });

    it('does not leak its dates', () => {
        const input = new Date(createdAt.getTime());
        const w = Workspace.create({ id, name: WorkspaceName.rehydrate('Acme'), kind: 'company', createdAt: input });
        input.setFullYear(2000);
        w.createdAt.setFullYear(2000);
        expect(w.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('rehydrates from props', () => {
        const w = Workspace.rehydrate({ id, name: WorkspaceName.rehydrate('Acme'), kind: 'company', createdAt });
        expect(w.toProps()).toEqual({ id, name: WorkspaceName.rehydrate('Acme'), kind: 'company', createdAt });
    });
});
