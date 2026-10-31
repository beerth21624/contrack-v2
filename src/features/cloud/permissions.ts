// ─── What a role may do (the server's own matrix from the contract; the server always decides, the UI only hides what would fail) ───
import { can, roleRank, type Role } from '@/shared/contract';

export { PERMISSIONS, can, roleRank, type Permission } from '@/shared/contract';

export const ROLE_LABEL: Record<Role, string> = {
    owner: 'เจ้าของ',
    admin: 'ผู้ดูแล',
    estimator: 'ผู้ถอดแบบ/ประมาณราคา',
    viewer: 'ดูอย่างเดียว',
    pm: 'ผู้จัดการโครงการ',
    purchasing: 'จัดซื้อ',
    accounting: 'บัญชี-การเงิน',
    foreman: 'โฟร์แมน',
};

export const ROLE_HINT: Record<Role, string> = {
    owner: 'ทำได้ทุกอย่าง รวมถึงลบพื้นที่ทำงาน',
    admin: 'เชิญ/ลบสมาชิก มอบหมายผู้รับผิดชอบ ลบโครงการ',
    estimator: 'สร้างและกรอกโครงการ ออกฉบับแก้ไข',
    viewer: 'ดูและส่งออก BOQ ได้ แก้ไขไม่ได้',
    pm: 'ดูแลโครงการ งบประมาณ จัดซื้อ งานหน้างาน และอนุมัติงานผู้รับเหมาช่วง',
    purchasing: 'ขอซื้อ สั่งซื้อ รับของ และดูแลผู้ขาย',
    accounting: 'วางบิล รับเงิน จ่ายเงิน ภาษี และรายงานการเงิน',
    foreman: 'รายงานประจำวัน บันทึกค่าแรง และรับของที่หน้างาน',
};

/** The ERP working roles: offered only while the ERP (`project-hub`) is active for the workspace. */
export const ERP_ROLES: readonly Role[] = ['pm', 'purchasing', 'accounting', 'foreman'];

/**
 * Roles `actor` may give to someone (an invitation or a role change). Only an owner hands out ownership.
 * `includeErp` adds the ERP roles (between estimator and viewer); without it the list is release 1's.
 */
export function grantableRoles(actor: Role, includeOwner: boolean, includeErp = false): Role[] {
    const all: Role[] = [
        ...(includeOwner ? ['owner' as const] : []),
        'admin', 'estimator',
        ...(includeErp ? ERP_ROLES : []),
        'viewer',
    ];
    return all.filter(r => (r === 'owner' ? actor === 'owner' : roleRank(r) <= roleRank(actor)));
}

/** Whether `actor` may change or remove a member with role `target` (an admin never touches an owner). */
export function canManage(actor: Role, target: Role): boolean {
    if (!can(actor, 'members.changeRole')) return false;
    return actor === 'owner' || roleRank(target) < roleRank('owner');
}
