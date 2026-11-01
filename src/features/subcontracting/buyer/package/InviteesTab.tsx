'use client';

// ─── ผู้รับคำเชิญ: status per invitee, resend (new link), withdraw, type a price on their behalf ───
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { App, Button, Dropdown, Table } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { type BuyerPackageDto, type ScInvitationDto, formatThaiPhone } from '@/shared/contract';

import { useResendInvitation, useWithdrawInvitation } from '../hooks';
import { channelLabel, declineReasonLabel, fmtDateTime, money0 } from '../format';
import type { LinkRow } from '../LinksModal';
import { InvitationStatusTag } from '../ui';
import { isSentUndecided } from './helpers';

const FINISHED = new Set<ScInvitationDto['status']>(['withdrawn', 'won', 'lost', 'closed']);

export function InviteesTab({ pkg, invitations, loading, error, canManage, canSeePrices, onLinks, onManualBid, onInviteMore }: {
    pkg: BuyerPackageDto;
    invitations: readonly ScInvitationDto[];
    loading: boolean;
    error: string | null;
    canManage: boolean;
    canSeePrices: boolean;
    onLinks: (rows: LinkRow[], title: string) => void;
    onManualBid: (invitation: ScInvitationDto) => void;
    /** null when no more invitees can be added. */
    onInviteMore: (() => void) | null;
}) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message, modal } = App.useApp();
    const resend = useResendInvitation(pkg.id);
    const withdraw = useWithdrawInvitation(pkg.id);
    const live = isSentUndecided(pkg.status);

    const doResend = async (i: ScInvitationDto) => {
        try {
            const res = await resend.mutateAsync(i.id);
            onLinks([{ invitationId: i.id, displayName: i.displayName, phone: i.phone, url: res.link.url }], t('buyer.inviteesTab.newLinkFor', { displayName: i.displayName }));
        } catch (e) {
            void message.error(toText(e));
        }
    };
    const doWithdraw = (i: ScInvitationDto) => {
        modal.confirm({
            title: t('buyer.inviteesTab.withdrawTheInvitationTo', { displayName: i.displayName }),
            content: t('buyer.inviteesTab.thisLinkWillStopWorking'),
            okText: t('buyer.inviteesTab.withdrawInvitation'), okButtonProps: { danger: true }, cancelText: t('buyer.inviteesTab.cancel'),
            onOk: async () => {
                try {
                    await withdraw.mutateAsync(i.id);
                    void message.success(t('buyer.inviteesTab.invitationWithdrawn'));
                } catch (e) {
                    void message.error(toText(e));
                }
            },
        });
    };

    return (
        <div className="flex flex-col gap-3">
            {onInviteMore !== null && canManage && live && (
                <div className="flex justify-end"><Button onClick={onInviteMore}>{t('buyer.inviteesTab.inviteMore')}</Button></div>
            )}
            <Table<ScInvitationDto>
                rowKey="id" size="middle" pagination={false} loading={loading} dataSource={[...invitations]} scroll={{ x: 760 }}
                locale={{ emptyText: error ?? (pkg.status === 'draft' ? t('buyer.inviteesTab.noInvitationsHaveBeenSent') : t('buyer.inviteesTab.noInviteesYet')) }}
                columns={[
                    {
                        title: t('buyer.inviteesTab.recipient'), key: 'who',
                        render: (_: unknown, i) => (
                            <div className="min-w-0">
                                <div className="font-medium">{i.displayName}</div>
                                <div className="text-caption text-gray-500">{formatThaiPhone(i.phone)}</div>
                            </div>
                        ),
                    },
                    { title: t('buyer.inviteesTab.channel'), key: 'channel', width: 130, responsive: ['md'], render: (_: unknown, i) => channelLabel(i.channel) },
                    {
                        title: t('buyer.inviteesTab.sent'), key: 'sent', width: 150, responsive: ['lg'],
                        render: (_: unknown, i) => (
                            <span className="text-secondary">
                                {fmtDateTime(i.sentAt)}
                                {i.resentCount > 0 && <span className="text-gray-500"> {t('buyer.inviteesTab.resent')} {i.resentCount}</span>}
                            </span>
                        ),
                    },
                    {
                        title: t('buyer.inviteesTab.opened'), key: 'viewed', width: 140, responsive: ['lg'],
                        render: (_: unknown, i) => <span className="text-secondary">{i.viewedAt === null ? '–' : fmtDateTime(i.viewedAt)}</span>,
                    },
                    {
                        title: t('buyer.inviteesTab.status'), key: 'status', width: 220,
                        render: (_: unknown, i) => <StatusCell invitation={i} canSeePrices={canSeePrices} />,
                    },
                    {
                        title: '', key: 'actions', width: 170, align: 'right',
                        render: (_: unknown, i) => {
                            if (!canManage || !live || FINISHED.has(i.status)) return null;
                            return (
                                <div className="flex justify-end gap-1">
                                    <Button size="small" onClick={() => onManualBid(i)}>{t('buyer.inviteesTab.enterAPriceForThem')}</Button>
                                    <Dropdown trigger={['click']} menu={{
                                        items: [
                                            { key: 'resend', label: t('buyer.inviteesTab.resendNewLink') },
                                            { key: 'withdraw', label: t('buyer.inviteesTab.withdrawInvitation'), danger: true },
                                        ],
                                        onClick: ({ key }) => {
                                            if (key === 'resend') void doResend(i);
                                            else doWithdraw(i);
                                        },
                                    }}>
                                        <Button size="small" type="text" icon={<MoreOutlined />} aria-label={t('buyer.inviteesTab.moreOptions')} />
                                    </Dropdown>
                                </div>
                            );
                        },
                    },
                ]}
            />
        </div>
    );
}

function StatusCell({ invitation: i, canSeePrices }: { invitation: ScInvitationDto; canSeePrices: boolean }) {
    const t = useTranslations('subcontracting');
    const bid = i.latestBid;
    const notes: React.ReactNode[] = [];
    if (i.status === 'declined' && i.declineReason !== null) {
        notes.push(<span key="r">{declineReasonLabel(i.declineReason)}{i.declineNote !== null && i.declineNote !== '' ? `: ${i.declineNote}` : ''}</span>);
    }
    if (bid !== null) {
        if (canSeePrices) notes.push(<span key="t" className="tabular-nums">{money0(bid.total)} {t('buyer.inviteesTab.thb')}</span>);
        if (bid.enteredByBuyer) notes.push(<span key="b">{t('buyer.inviteesTab.enteredByBuyer')}</span>);
        if (bid.outdated) notes.push(<span key="o" className="text-amber-600">{t('buyer.inviteesTab.basedOnAnOldVersion')}</span>);
    }
    return (
        <div className="flex flex-col items-start gap-0.5">
            <InvitationStatusTag status={i.status} extra={bid !== null && i.status === 'submitted' && bid.version > 1 ? `v${String(bid.version)}` : undefined} />
            {notes.length > 0 && (
                <div className="text-caption text-gray-500 flex flex-wrap gap-x-2">{notes}</div>
            )}
        </div>
    );
}
