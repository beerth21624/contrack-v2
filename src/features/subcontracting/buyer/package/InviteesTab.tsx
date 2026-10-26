'use client';

// ─── ผู้รับคำเชิญ: status per invitee, resend (new link), withdraw, type a price on their behalf ───
import { App, Button, Dropdown, Table } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { type BuyerPackageDto, type ScInvitationDto, formatThaiPhone } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useResendInvitation, useWithdrawInvitation } from '../hooks';
import { CHANNEL_LABEL, DECLINE_REASON_LABEL, fmtDateTime, money0 } from '../format';
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
    const { message, modal } = App.useApp();
    const resend = useResendInvitation(pkg.id);
    const withdraw = useWithdrawInvitation(pkg.id);
    const live = isSentUndecided(pkg.status);

    const doResend = async (i: ScInvitationDto) => {
        try {
            const res = await resend.mutateAsync(i.id);
            onLinks([{ invitationId: i.id, displayName: i.displayName, phone: i.phone, url: res.link.url }], `ลิงก์ใหม่ของ ${i.displayName}`);
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };
    const doWithdraw = (i: ScInvitationDto) => {
        modal.confirm({
            title: `ถอนคำเชิญ ${i.displayName}?`,
            content: 'ลิงก์ของรายนี้จะใช้ไม่ได้ ราคาที่ส่งมาจะไม่อยู่ในตารางเทียบ',
            okText: 'ถอนคำเชิญ', okButtonProps: { danger: true }, cancelText: 'ยกเลิก',
            onOk: async () => {
                try {
                    await withdraw.mutateAsync(i.id);
                    void message.success('ถอนคำเชิญแล้ว');
                } catch (e) {
                    void message.error(thaiErrorMessage(e));
                }
            },
        });
    };

    return (
        <div className="flex flex-col gap-3">
            {onInviteMore !== null && canManage && live && (
                <div className="flex justify-end"><Button onClick={onInviteMore}>เชิญเพิ่ม</Button></div>
            )}
            <Table<ScInvitationDto>
                rowKey="id" size="middle" pagination={false} loading={loading} dataSource={[...invitations]} scroll={{ x: 760 }}
                locale={{ emptyText: error ?? (pkg.status === 'draft' ? 'ยังไม่ได้ส่งคำเชิญ' : 'ยังไม่มีผู้รับคำเชิญ') }}
                columns={[
                    {
                        title: 'ผู้รับ', key: 'who',
                        render: (_: unknown, i) => (
                            <div className="min-w-0">
                                <div className="font-medium">{i.displayName}</div>
                                <div className="text-caption text-gray-500">{formatThaiPhone(i.phone)}</div>
                            </div>
                        ),
                    },
                    { title: 'ช่องทาง', key: 'channel', width: 130, responsive: ['md'], render: (_: unknown, i) => CHANNEL_LABEL[i.channel] },
                    {
                        title: 'ส่งเมื่อ', key: 'sent', width: 150, responsive: ['lg'],
                        render: (_: unknown, i) => (
                            <span className="text-secondary">
                                {fmtDateTime(i.sentAt)}
                                {i.resentCount > 0 && <span className="text-gray-500"> · ส่งซ้ำ {i.resentCount}</span>}
                            </span>
                        ),
                    },
                    {
                        title: 'เปิดดูเมื่อ', key: 'viewed', width: 140, responsive: ['lg'],
                        render: (_: unknown, i) => <span className="text-secondary">{i.viewedAt === null ? '–' : fmtDateTime(i.viewedAt)}</span>,
                    },
                    {
                        title: 'สถานะ', key: 'status', width: 220,
                        render: (_: unknown, i) => <StatusCell invitation={i} canSeePrices={canSeePrices} />,
                    },
                    {
                        title: '', key: 'actions', width: 170, align: 'right',
                        render: (_: unknown, i) => {
                            if (!canManage || !live || FINISHED.has(i.status)) return null;
                            return (
                                <div className="flex justify-end gap-1">
                                    <Button size="small" onClick={() => onManualBid(i)}>บันทึกราคาแทน</Button>
                                    <Dropdown trigger={['click']} menu={{
                                        items: [
                                            { key: 'resend', label: 'ส่งซ้ำ / ลิงก์ใหม่' },
                                            { key: 'withdraw', label: 'ถอนคำเชิญ', danger: true },
                                        ],
                                        onClick: ({ key }) => {
                                            if (key === 'resend') void doResend(i);
                                            else doWithdraw(i);
                                        },
                                    }}>
                                        <Button size="small" type="text" icon={<MoreOutlined />} aria-label="ตัวเลือกเพิ่ม" />
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
    const bid = i.latestBid;
    const notes: React.ReactNode[] = [];
    if (i.status === 'declined' && i.declineReason !== null) {
        notes.push(<span key="r">{DECLINE_REASON_LABEL[i.declineReason]}{i.declineNote !== null && i.declineNote !== '' ? `: ${i.declineNote}` : ''}</span>);
    }
    if (bid !== null) {
        if (canSeePrices) notes.push(<span key="t" className="tabular-nums">{money0(bid.total)} บาท</span>);
        if (bid.enteredByBuyer) notes.push(<span key="b">บันทึกโดยผู้ซื้อ</span>);
        if (bid.outdated) notes.push(<span key="o" className="text-amber-600">อิงฉบับเก่า</span>);
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
