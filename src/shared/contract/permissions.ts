// ─── Who may do what inside a workspace: one matrix for every module, shared by the server and the web ───
// The server always decides; the web reads the same table to hide what would fail (docs/erp/01-architecture.md §5).
import type { Role } from './common';

/** Every permission, grouped by module. ERP permissions are declared up front even before their module exists. */
export const PERMISSIONS = [
    'workspace.read', 'workspace.rename', 'workspace.delete',
    'members.read', 'members.invite', 'members.changeRole', 'members.remove',
    'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete',
    'revisions.create', 'levels.assign',
    // module switches
    'modules.manage',
    // subcontracting, buyer side (docs/marketplace/01 §10); some are widened by workspace settings in the use case
    'sc.read', 'sc.readPrices', 'sc.vendors.manage', 'sc.packages.manage', 'sc.award',
    'sc.claims.inspect', 'sc.claims.approve', 'sc.payments.record', 'sc.settings',
    // subcontracting, vendor side (the crew's own workspace)
    'vendor.read', 'vendor.bid.draft', 'vendor.bid.submit', 'vendor.contract.act', 'vendor.profile.edit',
    'rateCards.read', 'rateCards.create', 'rateCards.edit', 'rateCards.archive',
    // Crews and people (business module `workforce`): read the lists; manage people and crews; assign crews to
    // planned tasks and name site supervisors; see a person's daily wage; see a crew's daily cost.
    'workforce.read', 'workforce.manage', 'workforce.assign', 'workforce.seeWages', 'workforce.seeCrewCost',
    // ── ERP (docs/erp/01-architecture.md §5.2) ──
    'company.read', 'company.manage',
    'customers.read', 'customers.manage',
    'boq.baseline.lock', 'boq.baseline.unlock',
    'quotations.read', 'quotations.manage', 'quotations.issue', 'quotations.seeMargins',
    'contracts.read', 'contracts.manage',
    'billing.read', 'billing.manage', 'billing.receive',
    'variations.read', 'variations.manage',
    'procurement.read', 'procurement.request', 'procurement.manage', 'procurement.receive',
    'suppliers.read', 'suppliers.manage',
    'site.read', 'site.report',
    'labour.read', 'labour.record', 'labour.pay',
    'cost.read', 'cost.manage',
    'payables.read', 'payables.manage', 'payables.pay',
    'tax.reports',
    'handover.read', 'handover.manage',
    'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Every ERP permission (owner and admin hold them all). */
const ERP_ALL: readonly Permission[] = PERMISSIONS.slice(PERMISSIONS.indexOf('company.read'));

const BASE_ADMIN: readonly Permission[] = [
    'workspace.read', 'workspace.rename',
    'members.read', 'members.invite', 'members.changeRole', 'members.remove',
    'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete',
    'revisions.create', 'levels.assign',
    'modules.manage',
    'sc.read', 'sc.readPrices', 'sc.vendors.manage', 'sc.packages.manage', 'sc.award',
    'sc.claims.inspect', 'sc.claims.approve', 'sc.payments.record', 'sc.settings',
    'vendor.read', 'vendor.bid.draft', 'vendor.bid.submit', 'vendor.contract.act', 'vendor.profile.edit',
    'rateCards.read', 'rateCards.create', 'rateCards.edit', 'rateCards.archive',
    'workforce.read', 'workforce.manage', 'workforce.assign', 'workforce.seeWages', 'workforce.seeCrewCost',
];

// Estimators price jobs, so they may add a rate card; changing or archiving the company's cards is for admins.
// They plan jobs too: they assign crews and see a crew's daily cost, but not a person's own wage.
const BASE_ESTIMATOR: readonly Permission[] = [
    'workspace.read', 'members.read',
    'projects.read', 'projects.create', 'projects.edit', 'projects.archive',
    'revisions.create',
    'sc.read', 'sc.readPrices', 'sc.vendors.manage', 'sc.packages.manage', 'sc.claims.inspect',
    'vendor.read', 'vendor.bid.draft',
    'rateCards.read', 'rateCards.create',
    'workforce.read', 'workforce.assign', 'workforce.seeCrewCost',
];

/** What every rank-1 ERP role (purchasing, accounting, foreman) keeps of the older modules. */
const BASE_READ: readonly Permission[] = [
    'workspace.read', 'members.read', 'projects.read', 'sc.read', 'rateCards.read', 'workforce.read', 'vendor.read',
];

/** ERP permissions that everyone except the foreman reads (the foreman works on site, not with customers). */
const ERP_VIEWER: readonly Permission[] = [
    'company.read', 'customers.read', 'quotations.read', 'contracts.read', 'billing.read', 'variations.read',
    'procurement.read', 'suppliers.read', 'site.read', 'labour.read', 'handover.read',
];

const set = (...lists: (readonly Permission[])[]): ReadonlySet<Permission> => new Set(lists.flat());

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
    owner: set(BASE_ADMIN, ['workspace.delete'], ERP_ALL),
    admin: set(BASE_ADMIN, ERP_ALL),
    estimator: set(BASE_ESTIMATOR, ERP_VIEWER, [
        'customers.manage',
        'quotations.manage', 'quotations.issue', 'quotations.seeMargins',
        'variations.manage',
        'procurement.request',
        'cost.read',
    ]),
    viewer: set(
        ['workspace.read', 'members.read', 'projects.read', 'sc.read', 'vendor.read', 'rateCards.read', 'workforce.read'],
        ERP_VIEWER,
    ),
    // pm: the estimator's rights in the older modules plus awarding, approving claims and managing crews
    pm: set(BASE_ESTIMATOR, ['levels.assign', 'sc.award', 'sc.claims.approve', 'workforce.manage'], ERP_VIEWER, [
        'customers.manage',
        'boq.baseline.lock',
        'quotations.manage', 'quotations.issue', 'quotations.seeMargins',
        'contracts.manage',
        'billing.manage',
        'variations.manage',
        'procurement.request', 'procurement.manage', 'procurement.receive',
        'suppliers.manage',
        'site.report',
        'labour.record',
        'cost.read', 'cost.manage',
        'payables.read',
        'handover.manage',
        'audit.read',
    ]),
    purchasing: set(BASE_READ, ['sc.readPrices', 'sc.vendors.manage'], [
        'company.read', 'customers.read', 'contracts.read', 'variations.read',
        'procurement.read', 'procurement.request', 'procurement.manage', 'procurement.receive',
        'suppliers.read', 'suppliers.manage',
        'site.read', 'cost.read', 'payables.read', 'handover.read',
    ]),
    accounting: set(BASE_READ, ['sc.readPrices', 'sc.payments.record', 'workforce.seeWages', 'workforce.seeCrewCost'], ERP_VIEWER, [
        'customers.manage',
        'quotations.seeMargins',
        'contracts.manage',
        'billing.manage', 'billing.receive',
        'suppliers.manage',
        'labour.pay',
        'cost.read',
        'payables.read', 'payables.manage', 'payables.pay',
        'tax.reports',
        'audit.read',
    ]),
    foreman: set(BASE_READ, ['sc.claims.inspect', 'workforce.assign'], [
        'company.read', 'contracts.read', 'variations.read',
        'procurement.read', 'procurement.request', 'procurement.receive',
        'suppliers.read',
        'site.read', 'site.report',
        'labour.read', 'labour.record',
        'handover.read', 'handover.manage',
    ]),
};

/** Whether `role` holds `permission` (no role = not a member = nothing). */
export function can(role: Role | undefined, permission: Permission): boolean {
    return role !== undefined && MATRIX[role].has(permission);
}

/** Strength of a role (owner 3, admin 2, the working roles 1, viewer 0): nobody changes or removes someone stronger. */
export function roleRank(role: Role): number {
    switch (role) {
        case 'owner': return 3;
        case 'admin': return 2;
        case 'estimator':
        case 'pm':
        case 'purchasing':
        case 'accounting':
        case 'foreman':
            return 1;
        case 'viewer': return 0;
    }
}
