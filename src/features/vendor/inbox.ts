// ─── The crew's inbox: which tab each invitation / contract belongs to, and the one action of its card. Pure. ───
import type { InboxInvitationDto, SubcontractSummaryDto } from '@/shared/contract';
import { vText, type VT } from './text';

export type InboxTab = 'todo' | 'submitted' | 'contracts' | 'history';

export const INBOX_TABS: readonly { key: InboxTab }[] = [{ key: 'todo' }, { key: 'submitted' }, { key: 'contracts' }, { key: 'history' }];

export const inboxTabLabel = (tab: InboxTab, t: VT = vText()): string => t(`inbox.tabs.${tab}`);

const CLOSED_PACKAGE = new Set(['awarded', 'closed', 'cancelled', 'expired']);
const FINISHED_INVITATION = new Set(['declined', 'withdrawn', 'won', 'lost', 'closed']);

export function invitationTab(i: InboxInvitationDto, nowMs: number): InboxTab {
    if (i.outcome !== 'pending' || FINISHED_INVITATION.has(i.status) || CLOSED_PACKAGE.has(i.packageStatus)) return 'history';
    if (i.status === 'submitted') return 'submitted';
    const deadline = new Date(i.bidDeadline).getTime();
    if (i.packageStatus !== 'open' || (!Number.isNaN(deadline) && deadline <= nowMs)) return 'history';
    return 'todo';
}

export function subcontractTab(s: SubcontractSummaryDto): InboxTab {
    return s.status === 'pending_acceptance' || s.status === 'active' || s.status === 'completed' ? 'contracts' : 'history';
}

export type InboxItem =
    | { kind: 'invitation'; item: InboxInvitationDto }
    | { kind: 'contract'; item: SubcontractSummaryDto };

const time = (iso: string) => {
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
};

const CONTRACT_ORDER = { pending_acceptance: 0, active: 1, completed: 2, closed: 3, cancelled: 3, terminated: 3 } as const;

/** Items per tab: to-do and submitted by deadline (soonest first), contracts by what needs me, history newest first. */
export function groupInbox(
    invitations: readonly InboxInvitationDto[], contracts: readonly SubcontractSummaryDto[], nowMs: number,
): Record<InboxTab, InboxItem[]> {
    const out: Record<InboxTab, InboxItem[]> = { todo: [], submitted: [], contracts: [], history: [] };
    for (const i of invitations) out[invitationTab(i, nowMs)].push({ kind: 'invitation', item: i });
    for (const c of contracts) out[subcontractTab(c)].push({ kind: 'contract', item: c });
    const byDeadline = (a: InboxItem, b: InboxItem) =>
        (a.kind === 'invitation' && b.kind === 'invitation' ? time(a.item.bidDeadline) - time(b.item.bidDeadline) : 0);
    out.todo.sort(byDeadline);
    out.submitted.sort(byDeadline);
    out.contracts.sort((a, b) => (a.kind === 'contract' && b.kind === 'contract'
        ? CONTRACT_ORDER[a.item.status] - CONTRACT_ORDER[b.item.status] || time(b.item.createdAt) - time(a.item.createdAt)
        : 0));
    const at = (x: InboxItem) => (x.kind === 'invitation' ? time(x.item.receivedAt) : time(x.item.createdAt));
    out.history.sort((a, b) => at(b) - at(a));
    return out;
}

export interface CardAction {
    label: string;
    href: string;
    primary: boolean;
}

export function invitationAction(i: InboxInvitationDto, tab: InboxTab, t: VT = vText()): CardAction {
    const href = `/vendor/invitations/${i.invitationId}`;
    if (tab === 'todo') return { label: i.hasDraft ? t('inbox.actions.continueQuote') : t('inbox.actions.quote'), href, primary: true };
    if (tab === 'submitted') return { label: i.unreadMessages > 0 ? t('inbox.actions.readMessages') : t('inbox.actions.viewQuote'), href, primary: i.unreadMessages > 0 };
    return { label: t('inbox.actions.viewDetails'), href, primary: false };
}

export function contractAction(c: SubcontractSummaryDto, t: VT = vText()): CardAction {
    const href = `/vendor/contracts/${c.id}`;
    if (c.pendingAction === 'vendor_accept' || c.status === 'pending_acceptance') return { label: t('inbox.actions.acceptTerms'), href, primary: true };
    if (c.pendingAction === 'variation_response') return { label: t('inbox.actions.answerVariation'), href, primary: true };
    if (c.status === 'active' && c.nextInstallment !== null) return { label: t('inbox.actions.viewInstallment', { n: c.nextInstallment }), href, primary: false };
    return { label: t('inbox.actions.viewContract'), href, primary: false };
}
