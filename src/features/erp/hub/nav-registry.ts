'use client';

// ─── The one place that declares ERP menu entries and project tabs (docs/erp/01-architecture.md §3.3) ───
// Each WP with a screen appends its entry here (never edits AppLayoutUI.tsx / ProjectShell directly). WP-16 wires
// useWorkspaceNav() into the top menu and useProjectTabs() into ProjectShell. An entry shows only when its module is
// active for the workspace (all four layers), at least one of `anyModule` is, and the role has `permission`.
import { createElement, useMemo, type ComponentType, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { MenuProps } from 'antd';
import { useTranslations } from 'next-intl';
import { type ModuleId, type Permission, type Role, can } from '@/shared/contract';
import { useActiveModules } from '@/features/modules/modules';
import { usePlatformAdminStatus } from '../admin/hooks';
import { ApprovalBadge } from '../approvals/ApprovalBadge';
import { useErpWorkspace } from '../shared/useErpWorkspace';

export type AntdMenuItem = NonNullable<MenuProps['items']>[number];

type NavTranslator = ReturnType<typeof useTranslations<'nav'>>;
/** A key of the `nav` namespace, e.g. `receivables` (→ nav.receivables). Typed: a missing key fails tsc. */
export type NavLabelKey = Parameters<NavTranslator>[0];

export const ERP_NAV_GROUPS = ['sales', 'purchasing', 'finance', 'settings'] as const;
export type ErpNavGroupKey = (typeof ERP_NAV_GROUPS)[number];

/** Who may see an entry. */
export interface ErpNavGate {
    /** Must be active. */
    module?: ModuleId;
    /** At least one must be active. */
    anyModule?: readonly ModuleId[];
    /** can(role, permission). */
    permission?: Permission;
    /** Only for platform admins (PLATFORM_ADMIN_EMAILS). */
    admin?: boolean;
}

export interface ErpNavItem extends ErpNavGate {
    /** antd Menu key (also the active key). */
    key: string;
    labelKey: NavLabelKey;
    href: string;
    icon?: ReactNode;
    /** The pathname belongs to this entry (highlights it). */
    match: (pathname: string) => boolean;
    /** Wraps the label (and its group's label) with a count, e.g. pending approvals. */
    badge?: ComponentType<{ children?: ReactNode }>;
}

export interface ErpNavGroup {
    groupKey: ErpNavGroupKey;
    items: readonly ErpNavItem[];
}

export interface ErpProjectTab extends Omit<ErpNavItem, 'href'> {
    href: (projectId: string) => string;
}

/** Entries on the top level of the menu, before the groups (docs/erp/01-architecture.md §3.3). */
export const TOP_NAV: readonly ErpNavItem[] = [
    // Only when the portal exists: without it "home" would be a second link to /hub.
    { key: 'home', labelKey: 'home', href: '/home', module: 'portal', match: p => p === '/home' || p.startsWith('/home/') },
    { key: 'projects', labelKey: 'projects', href: '/hub', module: 'project-hub', match: p => p === '/hub' || p.startsWith('/hub/') || p.startsWith('/p/') },
];

/** Workspace-level menu, by group (label nav.groups.<groupKey>). Empty until the module WPs add their entries. */
export const WORKSPACE_NAV: readonly ErpNavGroup[] = [
    {
        groupKey: 'sales',
        items: [
            { key: 'customers', labelKey: 'customers', href: '/customers', module: 'project-hub', permission: 'customers.read', match: p => p.startsWith('/customers') },
            { key: 'receivables', labelKey: 'receivables', href: '/receivables', module: 'billing', permission: 'billing.read', match: p => p.startsWith('/receivables') },
        ],
    },
    { groupKey: 'purchasing', items: [] },
    { groupKey: 'finance', items: [] },
    {
        groupKey: 'settings',
        items: [
            { key: 'company', labelKey: 'company', href: '/workspace/company', module: 'project-hub', permission: 'company.read', match: p => p.startsWith('/workspace/company') },
            { key: 'approvals', labelKey: 'approvals', href: '/approvals', module: 'project-hub', badge: ApprovalBadge, match: p => p.startsWith('/approvals') },
            { key: 'approval-policies', labelKey: 'approvalPolicies', href: '/workspace/approval-policies', module: 'project-hub', permission: 'company.manage', match: p => p.startsWith('/workspace/approval-policies') },
            { key: 'numbering', labelKey: 'numbering', href: '/workspace/numbering', module: 'project-hub', permission: 'company.read', match: p => p.startsWith('/workspace/numbering') },
            { key: 'modules', labelKey: 'modules', href: '/workspace/modules', permission: 'modules.manage', match: p => p.startsWith('/workspace/modules') },
            { key: 'admin-entitlements', labelKey: 'entitlements', href: '/admin/entitlements', admin: true, match: p => p.startsWith('/admin/entitlements') },
        ],
    },
];

const projectRoot = /^\/p\/[^/]+\/?$/;

/**
 * Tabs of a project page (/p/[projectId]/…), in display order. `boq` leaves the project pages: ProjectShell opens the
 * project in the project store (openCloudProject) and goes to /boq.
 */
export const PROJECT_TABS: readonly ErpProjectTab[] = [
    { key: 'overview', labelKey: 'tabs.overview', href: id => `/p/${encodeURIComponent(id)}`, module: 'project-hub', match: p => projectRoot.test(p) },
    { key: 'boq', labelKey: 'tabs.boq', href: () => '/boq', permission: 'projects.read', match: p => p.startsWith('/boq') },
    { key: 'versions', labelKey: 'tabs.versions', href: id => `/p/${encodeURIComponent(id)}/versions`, module: 'boq-control', match: p => /^\/p\/[^/]+\/versions/.test(p) },
    { key: 'quotations', labelKey: 'tabs.quotations', href: id => `/p/${encodeURIComponent(id)}/quotations`, module: 'quotations', permission: 'quotations.read', match: p => /^\/p\/[^/]+\/quotations/.test(p) },
    { key: 'contract', labelKey: 'tabs.contract', href: id => `/p/${encodeURIComponent(id)}/contract`, module: 'contracts', permission: 'contracts.read', match: p => /^\/p\/[^/]+\/contract/.test(p) },
    { key: 'variations', labelKey: 'tabs.variations', href: id => `/p/${encodeURIComponent(id)}/variations`, module: 'variations', permission: 'variations.read', match: p => /^\/p\/[^/]+\/variations/.test(p) },
    { key: 'billing', labelKey: 'tabs.billing', href: id => `/p/${encodeURIComponent(id)}/billing`, module: 'billing', permission: 'billing.read', match: p => /^\/p\/[^/]+\/billing/.test(p) },
];

/** The entry passes its module / permission gate. */
export function navItemVisible(item: ErpNavGate, active: ReadonlySet<ModuleId>, role: Role | undefined, isPlatformAdmin = false): boolean {
    if (item.admin === true && !isPlatformAdmin) return false;
    if (item.module !== undefined && !active.has(item.module)) return false;
    if (item.anyModule !== undefined && item.anyModule.length > 0 && !item.anyModule.some(m => active.has(m))) return false;
    if (item.permission !== undefined && !can(role, item.permission)) return false;
    return true;
}

/** The key of the workspace entry the pathname belongs to (AppLayoutUI asks this before its own if/else), else undefined. */
export function activeWorkspaceNavKey(pathname: string, groups: readonly ErpNavGroup[] = WORKSPACE_NAV, top: readonly ErpNavItem[] = TOP_NAV): string | undefined {
    const topHit = top.find(item => item.match(pathname));
    if (topHit !== undefined) return topHit.key;
    for (const group of groups) {
        const hit = group.items.find(item => item.match(pathname));
        if (hit !== undefined) return hit.key;
    }
    return undefined;
}

/** The key of the project tab the pathname belongs to, else undefined. */
export function activeProjectTabKey(pathname: string, tabs: readonly ErpProjectTab[] = PROJECT_TABS): string | undefined {
    return tabs.find(tab => tab.match(pathname))?.key;
}

const NO_MODULES: ReadonlySet<ModuleId> = new Set<ModuleId>();

/**
 * The active modules of exactly `workspaceId`. While it is still unknown (workspaces loading) nothing is active:
 * useActiveModules(undefined) would fall back to the open project's workspace and could flash entries of another one.
 */
function useNavModules(workspaceId: string | undefined): ReadonlySet<ModuleId> {
    const active = useActiveModules(workspaceId);
    return workspaceId === undefined ? NO_MODULES : active;
}

function itemLabel(item: ErpNavItem, label: string): ReactNode {
    const Badge = item.badge;
    return Badge === undefined ? label : createElement(Badge, null, label);
}

export interface WorkspaceNavMenu {
    /** Top-level entries (home, projects). */
    top: AntdMenuItem[];
    /** One submenu per group with at least one visible entry; a group without any is missing. */
    groups: Partial<Record<ErpNavGroupKey, AntdMenuItem>>;
}

/** The visible ERP menu, split so the app shell can put its own entries between the groups. */
export function useWorkspaceNavMenu(workspaceId?: string): WorkspaceNavMenu {
    const t = useTranslations('nav');
    const router = useRouter();
    const ws = useErpWorkspace(workspaceId);
    const active = useNavModules(ws.workspaceId);
    const role = ws.role;
    const { admin } = usePlatformAdminStatus();
    return useMemo(() => {
        const toItem = (item: ErpNavItem): AntdMenuItem => ({
            key: item.key,
            icon: item.icon,
            label: itemLabel(item, t(item.labelKey)),
            onClick: () => router.push(item.href),
        });
        const groups: Partial<Record<ErpNavGroupKey, AntdMenuItem>> = {};
        for (const group of WORKSPACE_NAV) {
            const items = group.items.filter(item => navItemVisible(item, active, role, admin));
            if (items.length === 0) continue;
            const badged = items.find(item => item.badge !== undefined);
            const label = t(`groups.${group.groupKey}`);
            groups[group.groupKey] = {
                key: `erp-group-${group.groupKey}`,
                label: badged === undefined ? label : itemLabel(badged, label),
                children: items.map(toItem),
            };
        }
        return { top: TOP_NAV.filter(item => navItemVisible(item, active, role, admin)).map(toItem), groups };
    }, [t, router, active, role, admin]);
}

/**
 * The workspace menu for antd Menu: one submenu per group with at least one visible entry (groups without any are
 * left out, so release 1 gets []). `workspaceId`: default the current workspace (useErpWorkspace).
 */
export function useWorkspaceNav(workspaceId?: string): AntdMenuItem[] {
    const menu = useWorkspaceNavMenu(workspaceId);
    return useMemo(() => [
        ...menu.top,
        ...ERP_NAV_GROUPS.flatMap(g => { const item = menu.groups[g]; return item === undefined ? [] : [item]; }),
    ], [menu]);
}

export interface ProjectTabView {
    key: string;
    label: string;
    href: string;
    icon?: ReactNode;
}

/** The visible tabs of a project (key, label, href), for antd Tabs / links. `workspaceId`: the project's workspace. */
export function useProjectTabs(projectId: string, workspaceId?: string): ProjectTabView[] {
    const t = useTranslations('nav');
    const ws = useErpWorkspace(workspaceId);
    const active = useNavModules(ws.workspaceId);
    const role = ws.role;
    const { admin } = usePlatformAdminStatus();
    return useMemo(() => PROJECT_TABS
        .filter(tab => navItemVisible(tab, active, role, admin))
        .map(tab => ({ key: tab.key, label: t(tab.labelKey), href: tab.href(projectId), icon: tab.icon })),
    [t, active, role, admin, projectId]);
}
