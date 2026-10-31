import { ROLES, type Role } from '@contrack/contract';
import { checkWorkspaceDeletion } from './workspace-deletion.policy';

const outcome = (role: Role, kind: 'company' | 'personal'): string => {
    const r = checkWorkspaceDeletion({ kind, role });
    return r.ok ? 'ok' : r.error.code;
};

const COMPANY: Record<Role, string> = {
    owner: 'ok', admin: 'forbidden', estimator: 'forbidden', viewer: 'forbidden',
    pm: 'forbidden', purchasing: 'forbidden', accounting: 'forbidden', foreman: 'forbidden',
};

describe('checkWorkspaceDeletion', () => {
    it.each(ROLES)('company: %s', role => {
        expect(outcome(role, 'company')).toBe(COMPANY[role]);
    });

    it.each(ROLES)('personal: %s → personal_workspace', role => {
        expect(outcome(role, 'personal')).toBe('personal_workspace');
    });
});
