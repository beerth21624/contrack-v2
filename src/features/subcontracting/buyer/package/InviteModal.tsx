'use client';

// ─── Pick invitees from the vendor list (filtered by the package trade), a channel each, then send ───
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useMemo, useState } from 'react';
import { App, Alert, Checkbox, Input, Modal, Select, Table } from 'antd';
import { type BuyerPackageDto, type InviteChannel, type ScInvitationDto, type VendorListEntryDto, formatThaiPhone } from '@/shared/contract';

import { useInvite, useVendorList } from '../hooks';
import { channelLabel } from '../format';
import type { LinkRow } from '../LinksModal';
import { TradeChips } from '../ui';
import { invitedEntryIds, inviteRoom } from './helpers';

export function InviteModal({ open, onClose, pkg, invitations, onSent }: {
    open: boolean;
    onClose: () => void;
    pkg: BuyerPackageDto;
    invitations: readonly ScInvitationDto[];
    /** Links returned once by the server. */
    onSent: (rows: LinkRow[]) => void;
}) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [allTrades, setAllTrades] = useState(false);
    const [q, setQ] = useState('');
    // The vendor list of the workspace that owns the package (not the switcher's current workspace).
    const list = useVendorList(pkg.buyerWorkspaceId, allTrades ? {} : { trade: pkg.trade });
    const invite = useInvite(pkg.id);
    const [picked, setPicked] = useState<Record<string, InviteChannel>>({});
    const already = useMemo(() => invitedEntryIds(invitations), [invitations]);
    const room = inviteRoom(pkg.sourcingMode, invitations);
    const pickedIds = Object.keys(picked);

    const rows = (list.data ?? []).filter(v => !v.hidden && !already.has(v.id)
        && (q.trim() === '' || v.displayName.includes(q.trim()) || v.phone.includes(q.replace(/\D/g, '').replace(/^0/, ''))));

    const toggle = (v: VendorListEntryDto, on: boolean) => {
        setPicked(prev => {
            if (!on) return Object.fromEntries(Object.entries(prev).filter(([id]) => id !== v.id));
            if (pkg.sourcingMode === 'direct') return { [v.id]: 'link' };
            return { ...prev, [v.id]: 'link' };
        });
    };

    const send = async () => {
        try {
            const res = await invite.mutateAsync({ entries: pickedIds.map(id => ({ vendorListEntryId: id, channel: picked[id] ?? 'link' })) });
            const byId = new Map(res.invitations.map(i => [i.id, i]));
            onSent(res.links.map(l => {
                const inv = byId.get(l.invitationId);
                return { invitationId: l.invitationId, url: l.url, displayName: inv?.displayName ?? '', phone: inv?.phone ?? '' };
            }));
            setPicked({});
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const overLimit = pickedIds.length > room;

    return (
        <Modal open={open} onCancel={onClose} title={pkg.status === 'draft' ? t('buyer.invite.sendInvitations') : t('buyer.invite.inviteMore')} width={760} destroyOnHidden
            okText={t('buyer.invite.send', { count: pickedIds.length })} cancelText={t('buyer.invite.cancel')}
            okButtonProps={{ disabled: pickedIds.length === 0 || overLimit, loading: invite.isPending }}
            onOk={() => { void send(); }}>
            <div className="flex flex-wrap items-center gap-3 mb-3">
                <Input.Search placeholder={t('buyer.invite.searchByNameOrPhone')} allowClear value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 260 }} />
                <Checkbox checked={allTrades} onChange={e => setAllTrades(e.target.checked)}>{t('buyer.invite.showEveryTrade')}</Checkbox>
                <span className="ml-auto text-secondary text-gray-500">
                    {pkg.sourcingMode === 'direct' ? t('buyer.invite.directHireChoose1') : t('buyer.invite.youCanPickMore', { room })}
                </span>
            </div>
            {room === 0 && <Alert type="info" showIcon className="!mb-3" title={t('buyer.invite.theInvitationLimitIsReached')} />}
            <Table<VendorListEntryDto>
                rowKey="id" size="small" pagination={false} scroll={{ y: 360 }} loading={list.isLoading} dataSource={rows}
                locale={{ emptyText: list.isError ? toText(list.error) : t('buyer.invite.noMatchingCrewsAddThem') }}
                columns={[
                    {
                        key: 'pick', width: 40,
                        render: (_: unknown, v) => (
                            <Checkbox checked={v.id in picked} onChange={e => toggle(v, e.target.checked)}
                                disabled={!(v.id in picked) && pkg.sourcingMode !== 'direct' && pickedIds.length >= room} />
                        ),
                    },
                    {
                        title: t('buyer.invite.crew'), key: 'name',
                        render: (_: unknown, v) => (
                            <div className="min-w-0">
                                <div className="font-medium">{v.displayName}{v.hasAccount && <span className="text-green-600 text-caption ml-1">{t('buyer.invite.hasAnAccount')}</span>}</div>
                                <div className="text-caption text-gray-500">{formatThaiPhone(v.phone)}{v.province !== '' ? ` · ${v.province}` : ''}</div>
                            </div>
                        ),
                    },
                    { title: t('buyer.invite.trade'), key: 'trades', responsive: ['md'], render: (_: unknown, v) => <TradeChips trades={v.trades} /> },
                    {
                        title: t('buyer.invite.channel'), key: 'channel', width: 170,
                        render: (_: unknown, v) => (v.id in picked ? (
                            <Select<InviteChannel> size="small" style={{ width: 160 }} value={picked[v.id]}
                                onChange={c => setPicked(prev => ({ ...prev, [v.id]: c }))}
                                options={(['link', 'sms', ...(v.lineId !== '' ? ['line' as const] : [])] as InviteChannel[])
                                    .map(c => ({ value: c, label: channelLabel(c) }))} />
                        ) : null),
                    },
                ]}
            />
        </Modal>
    );
}
