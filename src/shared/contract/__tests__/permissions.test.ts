import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { can as webCan, roleRank as webRoleRank, grantableRoles } from '@/features/cloud/permissions';
import { PERMISSIONS, ROLES, can, roleRank, type Permission, type Role } from '@/shared/contract';

// The web and the server read one matrix (`src/shared/contract/permissions.ts`): the web module re-exports it, and so
// does the server's `backend/src/shared/domain/permissions.ts` (checked from its source: vitest cannot load the
// backend's `@contrack/contract` alias). This file checks the matrix against docs/erp/01-architecture.md §5 by hand.

const LEGACY: Record<Role, readonly Permission[]> = {
    // release 1, copied from the matrix before WP-05
    owner: [
        'workspace.read', 'workspace.rename', 'workspace.delete',
        'members.read', 'members.invite', 'members.changeRole', 'members.remove',
        'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete',
        'revisions.create', 'levels.assign', 'modules.manage',
        'sc.read', 'sc.readPrices', 'sc.vendors.manage', 'sc.packages.manage', 'sc.award',
        'sc.claims.inspect', 'sc.claims.approve', 'sc.payments.record', 'sc.settings',
        'vendor.read', 'vendor.bid.draft', 'vendor.bid.submit', 'vendor.contract.act', 'vendor.profile.edit',
        'rateCards.read', 'rateCards.create', 'rateCards.edit', 'rateCards.archive',
        'workforce.read', 'workforce.manage', 'workforce.assign', 'workforce.seeWages', 'workforce.seeCrewCost',
    ],
    admin: [
        'workspace.read', 'workspace.rename',
        'members.read', 'members.invite', 'members.changeRole', 'members.remove',
        'projects.read', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete',
        'revisions.create', 'levels.assign', 'modules.manage',
        'sc.read', 'sc.readPrices', 'sc.vendors.manage', 'sc.packages.manage', 'sc.award',
        'sc.claims.inspect', 'sc.claims.approve', 'sc.payments.record', 'sc.settings',
        'vendor.read', 'vendor.bid.draft', 'vendor.bid.submit', 'vendor.contract.act', 'vendor.profile.edit',
        'rateCards.read', 'rateCards.create', 'rateCards.edit', 'rateCards.archive',
        'workforce.read', 'workforce.manage', 'workforce.assign', 'workforce.seeWages', 'workforce.seeCrewCost',
    ],
    estimator: [
        'workspace.read', 'members.read', 'projects.read', 'projects.create', 'projects.edit', 'projects.archive',
        'revisions.create',
        'sc.read', 'sc.readPrices', 'sc.vendors.manage', 'sc.packages.manage', 'sc.claims.inspect',
        'vendor.read', 'vendor.bid.draft', 'rateCards.read', 'rateCards.create',
        'workforce.read', 'workforce.assign', 'workforce.seeCrewCost',
    ],
    viewer: ['workspace.read', 'members.read', 'projects.read', 'sc.read', 'vendor.read', 'rateCards.read', 'workforce.read'],
    // §5.3 "สิทธิ์เดิมของบทบาทใหม่"
    pm: [
        'workspace.read', 'members.read', 'projects.read', 'projects.create', 'projects.edit', 'projects.archive',
        'revisions.create', 'levels.assign',
        'sc.read', 'sc.readPrices', 'sc.vendors.manage', 'sc.packages.manage', 'sc.claims.inspect', 'sc.award', 'sc.claims.approve',
        'vendor.read', 'vendor.bid.draft', 'rateCards.read', 'rateCards.create',
        'workforce.read', 'workforce.assign', 'workforce.seeCrewCost', 'workforce.manage',
    ],
    purchasing: [
        'workspace.read', 'members.read', 'projects.read', 'sc.read', 'sc.readPrices', 'sc.vendors.manage',
        'rateCards.read', 'workforce.read', 'vendor.read',
    ],
    accounting: [
        'workspace.read', 'members.read', 'projects.read', 'sc.read', 'sc.readPrices', 'sc.payments.record',
        'rateCards.read', 'workforce.read', 'workforce.seeWages', 'workforce.seeCrewCost', 'vendor.read',
    ],
    foreman: [
        'workspace.read', 'members.read', 'projects.read', 'sc.read', 'sc.claims.inspect',
        'rateCards.read', 'workforce.read', 'workforce.assign', 'vendor.read',
    ],
};

/** §5.3, columns: estimator, pm, purchasing, accounting, foreman, viewer (owner and admin hold every ERP permission). */
const ERP_TABLE: Record<string, string> = {
    'company.read': 'xxxxxx',
    'company.manage': '......',
    'customers.read': 'xxxx.x',
    'customers.manage': 'xx.x..',
    'boq.baseline.lock': '.x....',
    'boq.baseline.unlock': '......',
    'quotations.read': 'xx.x.x',
    'quotations.manage': 'xx....',
    'quotations.issue': 'xx....',
    'quotations.seeMargins': 'xx.x..',
    'contracts.read': 'xxxxxx',
    'contracts.manage': '.x.x..',
    'billing.read': 'xx.x.x',
    'billing.manage': '.x.x..',
    'billing.receive': '...x..',
    'variations.read': 'xxxxxx',
    'variations.manage': 'xx....',
    'procurement.read': 'xxxxxx',
    'procurement.request': 'xxx.x.',
    'procurement.manage': '.xx...',
    'procurement.receive': '.xx.x.',
    'suppliers.read': 'xxxxxx',
    'suppliers.manage': '.xxx..',
    'site.read': 'xxxxxx',
    'site.report': '.x..x.',
    'labour.read': 'xx.xxx',
    'labour.record': '.x..x.',
    'labour.pay': '...x..',
    'cost.read': 'xxxx..',
    'cost.manage': '.x....',
    'payables.read': '.xxx..',
    'payables.manage': '...x..',
    'payables.pay': '...x..',
    'tax.reports': '...x..',
    'handover.read': 'xxxxxx',
    'handover.manage': '.x..x.',
    'audit.read': '.x.x..',
};
const COLUMNS: readonly Role[] = ['estimator', 'pm', 'purchasing', 'accounting', 'foreman', 'viewer'];

function expected(role: Role, permission: Permission): boolean {
    const row = ERP_TABLE[permission];
    if (row === undefined) return LEGACY[role].includes(permission);
    if (role === 'owner' || role === 'admin') return true;
    return row[COLUMNS.indexOf(role)] === 'x';
}

const pairs = ROLES.flatMap(role => PERMISSIONS.map(permission => [role, permission] as const));

describe('permission matrix', () => {
    it('every permission is either a release-1 one or a row of the ERP table', () => {
        const legacy = new Set(LEGACY.owner);
        expect(PERMISSIONS.filter(p => !legacy.has(p) && ERP_TABLE[p] === undefined)).toEqual([]);
        expect(Object.keys(ERP_TABLE).filter(p => !(PERMISSIONS as readonly string[]).includes(p))).toEqual([]);
    });

    it.each(pairs)('%s × %s matches the design (§5.3)', (role, permission) => {
        expect(can(role, permission)).toBe(expected(role, permission));
    });

    it('the web and the contract give the same answer for every role × permission', () => {
        for (const [role, permission] of pairs) expect(webCan(role, permission)).toBe(can(role, permission));
        expect(webCan(undefined, 'projects.read')).toBe(false);
        for (const role of ROLES) expect(webRoleRank(role)).toBe(roleRank(role));
    });

    it('the server re-exports the same matrix', () => {
        const source = readFileSync(path.resolve(__dirname, '../../../../backend/src/shared/domain/permissions.ts'), 'utf8');
        expect(source).toMatch(/export \{[^}]*\bcan\b[^}]*\broleRank\b[^}]*\} from '@contrack\/contract';/);
        expect(source).not.toMatch(/\bMATRIX\b|function can\b/);
    });

    it('acceptance: accounting pays bills, a viewer never sees cost; only owner and admin may edit the company', () => {
        expect(can('accounting', 'payables.pay')).toBe(true);
        expect(can('viewer', 'cost.read')).toBe(false);
        expect(can('purchasing', 'projects.edit')).toBe(false);
        expect(ROLES.filter(r => can(r, 'company.manage'))).toEqual(['owner', 'admin']);
        expect(ROLES.filter(r => can(r, 'workspace.delete'))).toEqual(['owner']);
    });

    it('ranks: owner 3, admin 2, working roles 1, viewer 0', () => {
        expect(ROLES.map(r => [r, roleRank(r)])).toEqual([
            ['owner', 3], ['admin', 2], ['estimator', 1], ['viewer', 0],
            ['pm', 1], ['purchasing', 1], ['accounting', 1], ['foreman', 1],
        ]);
    });

    it('grantable roles: release 1 by default, ERP roles only when asked', () => {
        expect(grantableRoles('owner', true)).toEqual(['owner', 'admin', 'estimator', 'viewer']);
        expect(grantableRoles('admin', false)).toEqual(['admin', 'estimator', 'viewer']);
        expect(grantableRoles('admin', false, true)).toEqual(['admin', 'estimator', 'pm', 'purchasing', 'accounting', 'foreman', 'viewer']);
        expect(grantableRoles('admin', true, true)).not.toContain('owner');
    });
});
