// ─── What a role may do (mirrors the server's matrix; the server always decides, the UI only hides what would fail) ───
import type { Role } from '@/shared/contract';

export type Permission =
    | 'workspace.read' | 'workspace.rename' | 'workspace.delete'
    | 'members.read' | 'members.invite' | 'members.changeRole' | 'members.remove'
    | 'projects.read' | 'projects.create' | 'projects.edit' | 'projects.archive' | 'projects.delete'
    | 'revisions.create' | 'levels.assign';

const MATRIX: Record<Role, readonly Permission[]> = {
    owner: [
        'workspace.read', 'workspace.rename', 'workspace.delete',
        'members.read', 'members.invite', 'members.changeRole', 'members.remove',
        'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete',
        'revisions.create', 'levels.assign',
    ],
    admin: [
        'workspace.read', 'workspace.rename',
        'members.read', 'members.invite', 'members.changeRole', 'members.remove',
        'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete',
        'revisions.create', 'levels.assign',
    ],
    estimator: ['workspace.read', 'members.read', 'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'revisions.create'],
    viewer: ['workspace.read', 'members.read', 'projects.read'],
};

export function can(role: Role | undefined, permission: Permission): boolean {
    return role !== undefined && MATRIX[role].includes(permission);
}

export function roleRank(role: Role): number {
    switch (role) {
        case 'owner': return 3;
        case 'admin': return 2;
        case 'estimator': return 1;
        case 'viewer': return 0;
    }
}

export const ROLE_LABEL: Record<Role, string> = {
    owner: 'เจ้าของ',
    admin: 'ผู้ดูแล',
    estimator: 'ผู้ถอดแบบ/ประมาณราคา',
    viewer: 'ดูอย่างเดียว',
};

export const ROLE_HINT: Record<Role, string> = {
    owner: 'ทำได้ทุกอย่าง รวมถึงลบพื้นที่ทำงาน',
    admin: 'เชิญ/ลบสมาชิก มอบหมายด่าน ลบโครงการ',
    estimator: 'สร้างและกรอกโครงการ ออก Revision',
    viewer: 'ดูและส่งออก BOQ ได้ แก้ไขไม่ได้',
};

/** Roles `actor` may give to someone (an invitation or a role change). Only an owner hands out ownership. */
export function grantableRoles(actor: Role, includeOwner: boolean): Role[] {
    const all: Role[] = includeOwner ? ['owner', 'admin', 'estimator', 'viewer'] : ['admin', 'estimator', 'viewer'];
    return all.filter(r => (r === 'owner' ? actor === 'owner' : roleRank(r) <= roleRank(actor)));
}

/** Whether `actor` may change or remove a member with role `target` (an admin never touches an owner). */
export function canManage(actor: Role, target: Role): boolean {
    if (!can(actor, 'members.changeRole')) return false;
    return actor === 'owner' || roleRank(target) < roleRank('owner');
}
