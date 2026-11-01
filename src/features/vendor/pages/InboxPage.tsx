'use client';

// ─── /vendor: the crew's jobs — invitations to price, prices sent, contracts, history ───
import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Tabs } from 'antd';
import { useTranslations } from 'next-intl';
import type { InboxInvitationDto, SubcontractSummaryDto } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { tradeName } from '@/features/subcontracting/buyer/format';
import { deadlineInfo, formatBaht, invitationStatusText, outcomeText, provinceName, subcontractStatusText } from '../format';
import { INBOX_TABS, contractAction, groupInbox, inboxTabLabel, invitationAction, type CardAction, type InboxTab } from '../inbox';
import { useInbox, useMySubcontracts, useProfile, useVendorWorkspace } from '../hooks';
import { useNow } from '../now';
import { ErrorState, PageSpinner, QuietNote, Section, SignInPrompt } from '../ui/common';
import { CreateCrewProfile } from '../ui/CreateCrewProfile';

function ActionButton({ action }: { action: CardAction }) {
    return (
        <Link href={action.href} className="block mt-3">
            <Button type={action.primary ? 'primary' : 'default'} size="large" block tabIndex={-1}>{action.label}</Button>
        </Link>
    );
}

function InvitationCard({ item, tab, now }: { item: InboxInvitationDto; tab: InboxTab; now: number }) {
    const t = useTranslations('vendor');
    const sc = useTranslations('subcontracting');
    const dl = now === 0 ? null : deadlineInfo(item.bidDeadline, now, t);
    const outcome = outcomeText(item.outcome, t);
    const statusLine = outcome !== '' ? outcome : invitationStatusText(item.status, t);
    return (
        <Section>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-secondary text-gray-600 truncate">{item.buyerName}</div>
                    <div className="text-section font-semibold text-gray-900">{item.title}</div>
                    <div className="text-secondary text-gray-600">{tradeName(item.trade, sc)}{item.province === '' ? '' : ` · ${t('labels.location.province', { name: provinceName(item.province) })}`}</div>
                </div>
                {item.unreadMessages > 0 && <Badge count={item.unreadMessages} title={t('inbox.newMessages')} />}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2 text-secondary">
                <span className={item.outcome === 'won' ? 'text-green-700 font-medium' : 'text-gray-600'}>{statusLine}</span>
                {tab !== 'history' && dl !== null && (
                    <span className={dl.soon ? 'text-amber-600 font-medium' : 'text-gray-600'}>{dl.passed ? t('inbox.closed') : t('inbox.closesIn', { left: dl.left })}</span>
                )}
            </div>
            {item.latestBidTotal !== null && tab !== 'todo' && (
                <div className="mt-1 text-secondary text-gray-600">{t('inbox.sentPrice')} <span className="text-gray-900 font-medium">{formatBaht(item.latestBidTotal)}</span></div>
            )}
            <ActionButton action={invitationAction(item, tab, t)} />
        </Section>
    );
}

function ContractCard({ item }: { item: SubcontractSummaryDto }) {
    const t = useTranslations('vendor');
    return (
        <Section tone={item.status === 'pending_acceptance' ? 'highlight' : 'default'}>
            <div className="text-secondary text-gray-600 truncate">{item.buyerName} · {t('inbox.contractNo', { no: item.contractNo })}</div>
            <div className="text-section font-semibold text-gray-900">{item.title}</div>
            <div className="mt-1 text-secondary text-gray-700">{subcontractStatusText(item.status, t)}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-caption text-gray-600">
                <div>{t('inbox.value')}<div className="text-body text-gray-900 font-medium">{formatBaht(item.total)}</div></div>
                <div>{t('inbox.received')}<div className="text-body text-gray-900 font-medium">{formatBaht(item.paidTotal)}</div></div>
                <div>{t('inbox.retentionHeld')}<div className="text-body text-gray-900 font-medium">{formatBaht(item.retentionBalance)}</div></div>
            </div>
            <ActionButton action={contractAction(item, t)} />
        </Section>
    );
}


function InboxBody({ workspaceId }: { workspaceId: string }) {
    const t = useTranslations('vendor');
    const now = useNow();
    const inbox = useInbox(workspaceId);
    const contracts = useMySubcontracts(workspaceId);
    const profile = useProfile(workspaceId);
    const [tab, setTab] = useState<InboxTab | null>(null);

    if (inbox.isPending || contracts.isPending) return <PageSpinner />;
    if (inbox.isError) return <ErrorState error={inbox.error} onRetry={() => { void inbox.refetch(); }} />;
    if (contracts.isError) return <ErrorState error={contracts.error} onRetry={() => { void contracts.refetch(); }} />;

    const groups = groupInbox(inbox.data.invitations, contracts.data, now);
    // Open where the work is: a contract waiting for me, else invitations to price, else contracts.
    const auto: InboxTab = groups.contracts.some(c => c.kind === 'contract' && c.item.pendingAction === 'vendor_accept')
        ? 'contracts' : groups.todo.length > 0 ? 'todo' : groups.contracts.length > 0 ? 'contracts' : groups.submitted.length > 0 ? 'submitted' : 'todo';
    const active = tab ?? auto;
    const incomplete = profile.data !== undefined && profile.data !== null && !profile.data.profileComplete;

    return (
        <div className="flex flex-col gap-3">
            <Tabs
                activeKey={active}
                onChange={k => setTab(k as InboxTab)}
                items={INBOX_TABS.map(tabDef => ({
                    key: tabDef.key,
                    label: tabDef.key === 'history' || groups[tabDef.key].length === 0
                        ? inboxTabLabel(tabDef.key, t) : `${inboxTabLabel(tabDef.key, t)} ${String(groups[tabDef.key].length)}`,
                }))}
            />
            {groups[active].length === 0 ? (
                <QuietNote title={t(`inbox.empty.${active}.title`)}>{active === 'todo' ? t('inbox.empty.todo.hint') : active === 'contracts' ? t('inbox.empty.contracts.hint') : undefined}</QuietNote>
            ) : (
                groups[active].map(x => (x.kind === 'invitation'
                    ? <InvitationCard key={x.item.invitationId} item={x.item} tab={active} now={now} />
                    : <ContractCard key={x.item.id} item={x.item} />))
            )}
            {incomplete && (
                <Link href="/vendor/profile" className="block text-center text-secondary text-gray-600 py-3">
                    {t('inbox.completeProfile')}
                </Link>
            )}
        </div>
    );
}

export function InboxPage() {
    const status = useSession(s => s.status);
    const ws = useVendorWorkspace();
    if (status === 'unknown') return <PageSpinner />;
    if (status === 'guest') return <SignInPrompt next="/vendor" />;
    if (ws.error !== null) return <ErrorState error={ws.error} />;
    if (ws.none) {
        return <Section><CreateCrewProfile onCreated={() => undefined} /></Section>;
    }
    if (ws.current === undefined) return <PageSpinner />;
    return <InboxBody key={ws.current.workspaceId} workspaceId={ws.current.workspaceId} />;
}
