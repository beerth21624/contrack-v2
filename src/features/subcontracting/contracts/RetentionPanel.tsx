'use client';

// ─── Retention tab (สมุดเงินประกันผลงาน, plan §6 rule 10): balance, planned releases, ledger, release / forfeit ───
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { App, Button, Empty, Form, Input, Modal, Table } from 'antd';
import type { RetentionEntryDto, SubcontractDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import type { Permission } from '@/features/cloud/permissions';
import { useDateTime } from '@/features/cloud/ui/common';
import { contractsApi, useContractMutation, useRetentionEntries } from './api';
import { fmtDate, fmtMoney, fmtPct, isOverdue, retentionKindLabel, round2, todayIso } from './logic';
import { LoadError, Money, MoneyInput } from './ui';

type Move = 'release' | 'forfeit';

export function RetentionPanel({ sc, may }: { sc: SubcontractDto; may: (p: Permission) => boolean }) {
    const t = useTranslations('subcontracting');
    const formatDateTime = useDateTime();
    const q = useRetentionEntries(sc.id);
    const [move, setMove] = useState<Move | null>(null);
    const r = sc.retention;
    const canMove = may('sc.payments.record') && round2(r.balance) > 0 && sc.status !== 'cancelled';
    const today = todayIso();

    if (q.isError) return <LoadError error={q.error} />;
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <Stat label={t('contracts.retention.withheld', { pct: fmtPct(sc.terms.retentionPct) })} value={r.withheld} />
                <Stat label={t('contracts.retention.released')} value={r.released} />
                {r.forfeited !== 0 && <Stat label={t('contracts.retention.forfeited')} value={r.forfeited} />}
                <Stat label={t('contracts.retention.balance')} value={r.balance} strong />
                {canMove && (
                    <div className="flex gap-2 ml-auto">
                        <Button onClick={() => setMove('forfeit')}>{t('contracts.retention.deduct')}</Button>
                        <Button type="primary" onClick={() => setMove('release')}>{t('contracts.retention.recordRelease')}</Button>
                    </div>
                )}
            </div>

            {r.schedule.length > 0 && (
                <section>
                    <h3 className="text-section font-semibold mb-2">{t('contracts.retention.scheduleHeading')}</h3>
                    <ul className="m-0 p-0 list-none flex flex-col gap-1">
                        {r.schedule.map((s, i) => (
                            <li key={`${s.label}-${String(i)}`} className="flex gap-3">
                                <span className={`w-28 ${isOverdue(s.dueAt, today) ? 'text-red-600' : 'text-gray-600'}`}>
                                    {s.dueAt === null ? t('contracts.retention.notScheduled') : fmtDate(s.dueAt)}
                                </span>
                                <span className="flex-1">{s.label}</span>
                                <Money value={s.amount} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <Table<RetentionEntryDto>
                size="small"
                rowKey="id"
                loading={q.isLoading}
                dataSource={q.data ?? []}
                pagination={false}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('contracts.retention.empty')} /> }}
                columns={[
                    { title: t('contracts.retention.colDate'), dataIndex: 'at', width: 150, render: (v: string) => formatDateTime(v) },
                    { title: t('contracts.retention.colKind'), dataIndex: 'kind', width: 90, render: (v: RetentionEntryDto['kind']) => retentionKindLabel(v, t) },
                    { title: t('contracts.common.note'), dataIndex: 'note' },
                    {
                        title: t('contracts.retention.colAmount'), dataIndex: 'amount', width: 130, align: 'right',
                        render: (v: number, e) => <Money value={e.kind === 'withheld' ? v : -v} />,
                    },
                ]}
            />
            {move !== null && <MoveModal sc={sc} move={move} onClose={() => setMove(null)} />}
        </div>
    );
}

function Stat({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
    return (
        <div>
            <div className="text-secondary text-gray-600">{label}</div>
            <div className={strong ? 'text-card-title font-semibold' : 'text-section'}><Money value={value} /></div>
        </div>
    );
}

function MoveModal({ sc, move, onClose }: { sc: SubcontractDto; move: Move; onClose: () => void }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [form] = Form.useForm<{ amount: number; note?: string }>();
    const m = useContractMutation(sc.id, (body: { amount: number; note: string }) =>
        move === 'release' ? contractsApi.release(sc.id, body) : contractsApi.forfeit(sc.id, body));
    const balance = round2(sc.retention.balance);
    const release = move === 'release';

    const submit = async () => {
        const v = await form.validateFields();
        try {
            await m.mutateAsync({ amount: v.amount, note: (v.note ?? '').trim() });
            void message.success(release ? t('contracts.retention.releasedToast') : t('contracts.retention.forfeitedToast'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={release ? t('contracts.retention.releaseTitle') : t('contracts.retention.forfeitTitle')} okText={release ? t('contracts.retention.recordRelease') : t('contracts.retention.recordDeduction')}
            cancelText={t('contracts.common.cancel')} okButtonProps={{ loading: m.isPending, danger: !release }} onOk={() => { void submit(); }} onCancel={onClose} destroyOnHidden>
            <Form form={form} layout="vertical" requiredMark={false} initialValues={{ amount: release ? balance : undefined, note: '' }}>
                <Form.Item name="amount" label={t('contracts.common.amountBaht')} extra={t('contracts.retention.balanceExtra', { amount: fmtMoney(balance) })}
                    rules={[
                        { required: true, message: t('contracts.common.enterAmountBaht') },
                        { type: 'number', min: 0.01, max: balance, message: t('contracts.retention.maxAmount', { amount: fmtMoney(balance) }) },
                    ]}>
                    <MoneyInput className="!w-full" min={0} max={balance} />
                </Form.Item>
                <Form.Item name="note" label={release ? t('contracts.common.note') : t('contracts.retention.forfeitReasonLabel')}
                    rules={[{ max: 500 }, ...(release ? [] : [{ required: true, whitespace: true, message: t('contracts.common.enterReason') }])]}>
                    <Input.TextArea rows={2} placeholder={release ? t('contracts.common.optional') : undefined} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
