'use client';

// ─── Small shared pieces of the buyer contract screens: page frame, money, open project, rights ───
import Link from 'next/link';
import { createContext, useContext } from 'react';
import { useTranslations } from 'next-intl';
import { Button, InputNumber, Result, Tag, type InputNumberProps } from 'antd';
import type { Role, SubcontractStatus } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import type { Permission } from '@/features/cloud/permissions';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { useCloud } from '@/features/cloud/state';
import { useProjectStore } from '@/store/project-store';
import { useScSettings } from './api';
import { SUBCONTRACT_STATUS_COLOR, fmtMoney, isModuleDisabled, numberLocale, scCan, subcontractStatusLabel } from './logic';

export const CARD = 'bg-white border border-gray-200 rounded-card shadow-card';

export function PageFrame({ title, subtitle, extra, children, back }: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    extra?: React.ReactNode;
    back?: { href: string; label: string };
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 w-full">
            <div className={`${CARD} p-5 flex flex-col md:flex-row md:items-center gap-3`}>
                <div className="flex-1 min-w-0">
                    {back !== undefined && (
                        <Link href={back.href} className="text-[13px] text-gray-500 hover:text-orange-600">‹ {back.label}</Link>
                    )}
                    <h1 className="text-page-title font-semibold text-gray-900 m-0">{title}</h1>
                    {subtitle !== undefined && <div className="text-secondary text-gray-600 mt-0.5">{subtitle}</div>}
                </div>
                {extra !== undefined && <div className="flex flex-wrap gap-2 md:justify-end">{extra}</div>}
            </div>
            {children}
        </div>
    );
}

/**
 * The caller's role cannot see prices (no sc.readPrices, not widened by the settings): the server sends every money
 * field as 0 / null, so the screens show "—" instead of "0.00".
 */
const PricesHidden = createContext(false);

export function PricesHiddenProvider({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
    return <PricesHidden.Provider value={hidden}>{children}</PricesHidden.Provider>;
}

export function usePricesHidden(): boolean {
    return useContext(PricesHidden);
}

/** fmtMoney, or "—" when prices are hidden for this role (or the amount is null). */
export function useMoneyText(): (n: number | null) => string {
    const hidden = usePricesHidden();
    return (n) => (hidden || n === null ? '—' : fmtMoney(n));
}

/** An amount in baht, right-aligned digits (tabular numerals); "—" when the role cannot see prices. */
export function Money({ value, strong = false, className = '' }: { value: number | null; strong?: boolean; className?: string }) {
    const text = useMoneyText()(value);
    if (text === '—') return <span className="text-gray-400">—</span>;
    return <span className={`tabular-nums whitespace-nowrap ${strong ? 'font-semibold' : ''} ${className}`}>{text}</span>;
}

export function StatusTag({ status }: { status: SubcontractStatus }) {
    const t = useTranslations('subcontracting');
    return <Tag color={SUBCONTRACT_STATUS_COLOR[status]} className="!m-0">{subcontractStatusLabel(status, t)}</Tag>;
}

/** Calm state when the server answers 404 module_disabled (the workspace switched subcontracting off). */
export function ModuleOffState() {
    const t = useTranslations('subcontracting');
    return (
        <Result status="info" title={t('contracts.ui.moduleOffTitle')}
            subTitle={t('contracts.ui.moduleOffSubtitle')}
            extra={<Link href="/journey"><Button>{t('contracts.ui.backToBoq')}</Button></Link>} />
    );
}

export function LoadError({ error }: { error: unknown }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    if (isModuleDisabled(error)) return <ModuleOffState />;
    return <Result status="warning" title={t('contracts.ui.loadFailed')} subTitle={toText(error)} />;
}

/** Shown on project-level pages when no cloud project is open. */
export function NeedProject({ what }: { what: string }) {
    const t = useTranslations('subcontracting');
    return (
        <Result
            status="info"
            title={t('contracts.ui.noProject')}
            subTitle={t('contracts.ui.openCloudProjectFirst', { what })}
            extra={<Link href="/projects"><Button type="primary">{t('contracts.ui.goToAllProjects')}</Button></Link>}
        />
    );
}

/** The open cloud project (null in guest mode). */
export function useOpenProject(): { projectId: string; workspaceId: string; role: Role; name: string } | null {
    const binding = useProjectStore(s => s.binding);
    const name = useCloud(s => s.project?.name ?? '');
    if (binding.kind !== 'cloud') return null;
    return { projectId: binding.projectId, workspaceId: binding.workspaceId, role: binding.role, name };
}

export interface BuyerRights {
    /** The caller's role in that workspace (from the workspaces list), undefined while loading or when not a member. */
    role: Role | undefined;
    /** Name of that workspace ('' while unknown). */
    workspaceName: string;
    may: (p: Permission) => boolean;
    loading: boolean;
}

/**
 * The caller's role in a buyer workspace and what it may do there, counting the module settings that widen rights.
 * Always the workspace that owns the package / contract, never the switcher's current one.
 */
export function useBuyerRights(workspaceId: string | undefined): BuyerRights {
    const { workspaces, isLoading } = useCurrentWorkspace();
    const ws = workspaces.find(w => w.id === workspaceId);
    const role = ws?.role;
    const settings = useScSettings(workspaceId);
    return {
        role,
        workspaceName: ws?.name ?? '',
        may: (p) => scCan(role, p, settings.data),
        loading: isLoading || settings.isLoading,
    };
}

/** Thousands separators once typed; the raw text while typing (so "1000." keeps its point). */
const moneyFormatter = (v: number | undefined, info: { userTyping: boolean; input: string }) =>
    (info.userTyping ? info.input : v === undefined ? '' : v.toLocaleString(numberLocale(), { maximumFractionDigits: 2 }));
const moneyParser = (v: string | undefined) => {
    const n = Number((v ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
};

/** A baht amount input with thousands separators (Form.Item passes value / onChange through). */
export function MoneyInput(props: InputNumberProps<number>) {
    return <InputNumber<number> step={100} {...props} formatter={moneyFormatter} parser={moneyParser} />;
}
