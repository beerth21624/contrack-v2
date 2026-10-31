'use client';

// ─── The one place that declares ERP menu entries and project tabs (docs/erp/01-architecture.md §3.3) ───
// Each WP with a screen appends its entry here (never edits AppLayoutUI.tsx / ProjectShell directly). WP-16 wires
// useWorkspaceNav() into the top menu and useProjectTabs() into ProjectShell. An entry shows only when its module is
// active for the workspace (all four layers), at least one of `anyModule` is, and the role has `permission`.
import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { MenuProps } from 'antd';
import { useTranslations } from 'next-intl';
import { type ModuleId, type Permission, type Role, can } from '@/shared/contract';
import { useActiveModules } from '@/features/modules/modules';
import { usePlatformAdminStatus } from '../admin/hooks';
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
}

export interface ErpNavGroup {
    groupKey: ErpNavGroupKey;
    items: readonly ErpNavItem[];
}

export interface ErpProjectTab extends Omit<ErpNavItem, 'href'> {
    href: (projectId: string) => string;
}

/** Workspace-level menu, by group (label nav.groups.<groupKey>). Empty until the module WPs add their entries. */
export const WORKSPACE_NAV: readonly ErpNavGroup[] = [
    { groupKey: 'sales', items: [] },
    { groupKey: 'purchasing', items: [] },
    { groupKey: 'finance', items: [] },
    {
        groupKey: 'settings',
        items: [
            { key: 'admin-entitlements', labelKey: 'entitlements', href: '/admin/entitlements', admin: true, match: p => p.startsWith('/admin/entitlements') },
        ],
    },
];

/** Tabs of a project page (/p/[projectId]/…), in display order. Empty until WP-16 and the module WPs add theirs. */
export const PROJECT_TABS: readonly ErpProjectTab[] = [];

/** The entry passes its module / permission gate. */
export function navItemVisible(item: ErpNavGate, active: ReadonlySet<ModuleId>, role: Role | undefined, isPlatformAdmin = false): boolean {
    if (item.admin === true && !isPlatformAdmin) return false;
    if (item.module !== undefined && !active.has(item.module)) return false;
    if (item.anyModule !== undefined && item.anyModule.length > 0 && !item.anyModule.some(m => active.has(m))) return false;
    if (item.permission !== undefined && !can(role, item.permission)) return false;
    return true;
}

/** The key of the workspace entry the pathname belongs to (WP-16 asks this before its own if/else), else undefined. */
export function activeWorkspaceNavKey(pathname: string, groups: readonly ErpNavGroup[] = WORKSPACE_NAV): string | undefined {
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

/**
 * The workspace menu for antd Menu: one submenu per group with at least one visible entry (groups without any are
 * left out, so release 1 gets []). `workspaceId`: default the current workspace (useErpWorkspace).
 */
export function useWorkspaceNav(workspaceId?: string): AntdMenuItem[] {
    const t = useTranslations('nav');
    const router = useRouter();
    const ws = useErpWorkspace(workspaceId);
    const active = useNavModules(ws.workspaceId);
    const role = ws.role;
    const { admin } = usePlatformAdminStatus();
    return useMemo(() => WORKSPACE_NAV.flatMap((group): AntdMenuItem[] => {
        const items = group.items.filter(item => navItemVisible(item, active, role, admin));
        if (items.length === 0) return [];
        return [{
            key: `erp-group-${group.groupKey}`,
            label: t(`groups.${group.groupKey}`),
            children: items.map(item => ({
                key: item.key,
                icon: item.icon,
                label: t(item.labelKey),
                onClick: () => router.push(item.href),
            })),
        }];
    }), [t, router, active, role, admin]);
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
