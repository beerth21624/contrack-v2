'use client';

// ─── Retention tab (สมุดเงินประกันผลงาน, plan §6 rule 10): balance, planned releases, ledger, release / forfeit ───
import { useState } from 'react';
import { App, Button, Empty, Form, Input, Modal, Table } from 'antd';
import type { RetentionEntryDto, SubcontractDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import type { Permission } from '@/features/cloud/permissions';
import { formatDateTime } from '@/features/cloud/ui/common';
import { contractsApi, useContractMutation, useRetentionEntries } from './api';
import { RETENTION_KIND_LABEL, fmtDate, fmtMoney, fmtPct, isOverdue, round2, todayIso } from './logic';
import { LoadError, Money, MoneyInput } from './ui';

type Move = 'release' | 'forfeit';

export function RetentionPanel({ sc, may }: { sc: SubcontractDto; may: (p: Permission) => boolean }) {
    const q = useRetentionEntries(sc.id);
    const [move, setMove] = useState<Move | null>(null);
    const r = sc.retention;
    const canMove = may('sc.payments.record') && round2(r.balance) > 0 && sc.status !== 'cancelled';
    const today = todayIso();

    if (q.isError) return <LoadError error={q.error} />;
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <Stat label={`หักไว้ (${fmtPct(sc.terms.retentionPct)})`} value={r.withheld} />
                <Stat label="คืนแล้ว" value={r.released} />
                {r.forfeited !== 0 && <Stat label="ริบ" value={r.forfeited} />}
                <Stat label="คงค้าง" value={r.balance} strong />
                {canMove && (
                    <div className="flex gap-2 ml-auto">
                        <Button onClick={() => setMove('forfeit')}>หักจากเงินประกัน</Button>
                        <Button type="primary" onClick={() => setMove('release')}>บันทึกคืน</Button>
                    </div>
                )}
            </div>

            {r.schedule.length > 0 && (
                <section>
                    <h3 className="text-section font-semibold mb-2">กำหนดคืน</h3>
                    <ul className="m-0 p-0 list-none flex flex-col gap-1">
                        {r.schedule.map((s, i) => (
                            <li key={`${s.label}-${String(i)}`} className="flex gap-3">
                                <span className={`w-28 ${isOverdue(s.dueAt, today) ? 'text-red-600' : 'text-gray-600'}`}>
                                    {s.dueAt === null ? 'ยังไม่กำหนด' : fmtDate(s.dueAt)}
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
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีรายการ — หักอัตโนมัติเมื่ออนุมัติงวด" /> }}
                columns={[
                    { title: 'วันที่', dataIndex: 'at', width: 150, render: (v: string) => formatDateTime(v) },
                    { title: 'รายการ', dataIndex: 'kind', width: 90, render: (v: RetentionEntryDto['kind']) => RETENTION_KIND_LABEL[v] },
                    { title: 'หมายเหตุ', dataIndex: 'note' },
                    {
                        title: 'จำนวน', dataIndex: 'amount', width: 130, align: 'right',
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
            void message.success(release ? 'บันทึกคืนเงินประกันแล้ว' : 'บันทึกหักเงินประกันแล้ว');
            onClose();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <Modal open title={release ? 'บันทึกคืนเงินประกันผลงาน' : 'หักจากเงินประกันผลงาน'} okText={release ? 'บันทึกคืน' : 'บันทึกหัก'}
            cancelText="ยกเลิก" okButtonProps={{ loading: m.isPending, danger: !release }} onOk={() => { void submit(); }} onCancel={onClose} destroyOnHidden>
            <Form form={form} layout="vertical" requiredMark={false} initialValues={{ amount: release ? balance : undefined, note: '' }}>
                <Form.Item name="amount" label="จำนวนเงิน (บาท)" extra={`คงค้าง ${fmtMoney(balance)}`}
                    rules={[
                        { required: true, message: 'ใส่จำนวนเงิน' },
                        { type: 'number', min: 0.01, max: balance, message: `ได้ไม่เกิน ${fmtMoney(balance)}` },
                    ]}>
                    <MoneyInput className="!w-full" min={0} max={balance} />
                </Form.Item>
                <Form.Item name="note" label={release ? 'หมายเหตุ' : 'เหตุผล (เช่น ค่าปรับ ค่าแก้งาน)'}
                    rules={[{ max: 500 }, ...(release ? [] : [{ required: true, whitespace: true, message: 'ใส่เหตุผล' }])]}>
                    <Input.TextArea rows={2} placeholder={release ? 'ไม่บังคับ' : undefined} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
