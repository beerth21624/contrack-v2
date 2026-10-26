'use client';

// ─── /vendor: the crew's jobs — invitations to price, prices sent, contracts, history ───
import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Tabs } from 'antd';
import type { InboxInvitationDto, SubcontractSummaryDto } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { tradeLabel } from '@/domain/subcontracting/trades';
import { INVITATION_STATUS_TEXT, OUTCOME_TEXT, SUBCONTRACT_STATUS_TEXT, deadlineInfo, formatBaht } from '../format';
import { INBOX_TABS, contractAction, groupInbox, invitationAction, type CardAction, type InboxTab } from '../inbox';
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
    const dl = now === 0 ? null : deadlineInfo(item.bidDeadline, now);
    const outcome = OUTCOME_TEXT[item.outcome];
    const statusLine = outcome !== '' ? outcome : INVITATION_STATUS_TEXT[item.status];
    return (
        <Section>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-secondary text-gray-600 truncate">{item.buyerName}</div>
                    <div className="text-section font-semibold text-gray-900">{item.title}</div>
                    <div className="text-secondary text-gray-600">{tradeLabel(item.trade)}{item.province === '' ? '' : ` · จ.${item.province}`}</div>
                </div>
                {item.unreadMessages > 0 && <Badge count={item.unreadMessages} title="ข้อความใหม่" />}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2 text-secondary">
                <span className={item.outcome === 'won' ? 'text-green-700 font-medium' : 'text-gray-600'}>{statusLine}</span>
                {tab !== 'history' && dl !== null && (
                    <span className={dl.soon ? 'text-amber-600 font-medium' : 'text-gray-600'}>{dl.passed ? 'ปิดรับแล้ว' : `ปิดรับ${dl.left}`}</span>
                )}
            </div>
            {item.latestBidTotal !== null && tab !== 'todo' && (
                <div className="mt-1 text-secondary text-gray-600">ราคาที่ส่ง <span className="text-gray-900 font-medium">{formatBaht(item.latestBidTotal)}</span></div>
            )}
            <ActionButton action={invitationAction(item, tab)} />
        </Section>
    );
}

function ContractCard({ item }: { item: SubcontractSummaryDto }) {
    return (
        <Section tone={item.status === 'pending_acceptance' ? 'highlight' : 'default'}>
            <div className="text-secondary text-gray-600 truncate">{item.buyerName} · สัญญา {item.contractNo}</div>
            <div className="text-section font-semibold text-gray-900">{item.title}</div>
            <div className="mt-1 text-secondary text-gray-700">{SUBCONTRACT_STATUS_TEXT[item.status]}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-caption text-gray-600">
                <div>ค่างาน<div className="text-body text-gray-900 font-medium">{formatBaht(item.total)}</div></div>
                <div>ได้รับแล้ว<div className="text-body text-gray-900 font-medium">{formatBaht(item.paidTotal)}</div></div>
                <div>เงินประกันค้าง<div className="text-body text-gray-900 font-medium">{formatBaht(item.retentionBalance)}</div></div>
            </div>
            <ActionButton action={contractAction(item)} />
        </Section>
    );
}

const EMPTY: Record<InboxTab, { title: string; hint: string }> = {
    todo: { title: 'ยังไม่มีงานรอเสนอราคา', hint: 'เมื่อผู้ว่าจ้างส่งงานมา จะแจ้งทาง SMS และแสดงที่นี่' },
    submitted: { title: 'ยังไม่มีราคาที่ส่ง', hint: '' },
    contracts: { title: 'ยังไม่มีสัญญา', hint: 'เมื่อได้งาน สัญญาจะมาอยู่ที่นี่' },
    history: { title: 'ยังไม่มีประวัติ', hint: '' },
};

function InboxBody({ workspaceId }: { workspaceId: string }) {
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
                items={INBOX_TABS.map(t => ({
                    key: t.key,
                    label: t.key === 'history' || groups[t.key].length === 0 ? t.label : `${t.label} ${String(groups[t.key].length)}`,
                }))}
            />
            {groups[active].length === 0 ? (
                <QuietNote title={EMPTY[active].title}>{EMPTY[active].hint === '' ? undefined : EMPTY[active].hint}</QuietNote>
            ) : (
                groups[active].map(x => (x.kind === 'invitation'
                    ? <InvitationCard key={x.item.invitationId} item={x.item} tab={active} now={now} />
                    : <ContractCard key={x.item.id} item={x.item} />))
            )}
            {incomplete && (
                <Link href="/vendor/profile" className="block text-center text-secondary text-gray-600 py-3">
                    กรอกโปรไฟล์ทีมให้ครบ ผู้ว่าจ้างจะเห็นป้าย “โปรไฟล์ครบ” ›
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
