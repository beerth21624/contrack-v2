'use client';

// ─── Variations tab (งานเพิ่ม-ลด, plan §6 rule 8): propose lines + reason; answer the vendor's proposals ───
import { useState } from 'react';
import { App, Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Table, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { SubcontractDto, VariationDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import type { Permission } from '@/features/cloud/permissions';
import { formatDateTime } from '@/features/cloud/ui/common';
import { contractsApi, useContractMutation, useVariations } from './api';
import { fmtQty, variationAmount } from './logic';
import { LoadError, Money } from './ui';

const STATUS = {
    proposed: { label: 'รอตอบ', color: 'warning' },
    accepted: { label: 'ตกลงแล้ว', color: 'success' },
    rejected: { label: 'ไม่ตกลง', color: 'default' },
} as const;

export function VariationsPanel({ sc, may }: { sc: SubcontractDto; may: (p: Permission) => boolean }) {
    const q = useVariations(sc.id);
    const [proposing, setProposing] = useState(false);
    const { message } = App.useApp();
    const respond = useContractMutation(sc.id, ({ id, accept }: { id: string; accept: boolean }) => contractsApi.respondVariation(id, accept));
    const active = sc.status === 'active';
    const canAct = active && may('sc.packages.manage');

    const answer = async (id: string, accept: boolean) => {
        try {
            await respond.mutateAsync({ id, accept });
            void message.success(accept ? 'ตกลงงานเพิ่ม-ลดแล้ว มูลค่าสัญญาปรับตาม' : 'ตอบไม่ตกลงแล้ว');
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    if (q.isError) return <LoadError error={q.error} />;
    return (
        <div className="flex flex-col gap-3">
            {canAct && (
                <div className="flex justify-end">
                    <Button icon={<PlusOutlined />} onClick={() => setProposing(true)}>เสนองานเพิ่ม-ลด</Button>
                </div>
            )}
            <Table<VariationDto>
                rowKey="id"
                loading={q.isLoading}
                dataSource={q.data ?? []}
                pagination={false}
                scroll={{ x: 720 }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีงานเพิ่ม-ลด" /> }}
                expandable={{
                    expandedRowRender: v => (
                        <table className="w-full text-secondary">
                            <tbody>
                                {v.lines.map((l, i) => (
                                    <tr key={`${l.desc}-${String(i)}`} className="border-b border-gray-100">
                                        <td className="py-1">{l.desc}</td>
                                        <td className="py-1 text-right tabular-nums w-24">{fmtQty(l.qty)} {l.unit}</td>
                                        <td className="py-1 text-right tabular-nums w-28">× <Money value={l.unitPrice} /></td>
                                        <td className="py-1 text-right tabular-nums w-32"><Money value={l.total} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ),
                }}
                columns={[
                    { title: 'วันที่', dataIndex: 'createdAt', width: 150, render: (v: string) => formatDateTime(v) },
                    { title: 'เสนอโดย', dataIndex: 'proposedBy', width: 100, render: (v: VariationDto['proposedBy']) => (v === 'buyer' ? 'ผู้ว่าจ้าง' : 'ผู้รับจ้าง') },
                    { title: 'เหตุผล', dataIndex: 'reason' },
                    { title: 'เพิ่ม / ลด', dataIndex: 'amount', width: 130, align: 'right', render: (v: number) => <Money value={v} className={v < 0 ? 'text-red-600' : ''} /> },
                    { title: 'สถานะ', dataIndex: 'status', width: 100, render: (v: VariationDto['status']) => <Tag color={STATUS[v].color} className="!m-0">{STATUS[v].label}</Tag> },
                    {
                        title: '', width: 170, align: 'right',
                        render: (_v, v) => (canAct && v.status === 'proposed' && v.proposedBy === 'vendor' ? (
                            <div className="flex justify-end gap-2">
                                <Popconfirm title="ไม่ตกลงงานเพิ่ม-ลดนี้?" okText="ไม่ตกลง" cancelText="กลับ" onConfirm={() => answer(v.id, false)}>
                                    <Button size="small">ไม่ตกลง</Button>
                                </Popconfirm>
                                <Popconfirm title="ตกลง? มูลค่าสัญญาและงวดสุดท้ายจะปรับตาม" okText="ตกลง" cancelText="กลับ" onConfirm={() => answer(v.id, true)}>
                                    <Button size="small" type="primary">ตกลง</Button>
                                </Popconfirm>
                            </div>
                        ) : v.status === 'proposed' && v.proposedBy === 'buyer' ? <span className="text-[12px] text-gray-500">รอผู้รับจ้างตอบ</span> : null),
                    },
                ]}
            />
            {proposing && <ProposeModal sc={sc} onClose={() => setProposing(false)} />}
        </div>
    );
}

interface ProposeForm { lines: { desc?: string; unit?: string; qty?: number | null; unitPrice?: number | null }[]; reason: string }

function ProposeModal({ sc, onClose }: { sc: SubcontractDto; onClose: () => void }) {
    const { message } = App.useApp();
    const [form] = Form.useForm<ProposeForm>();
    const watched = Form.useWatch('lines', form) as ProposeForm['lines'] | undefined;
    const m = useContractMutation(sc.id, (body: Parameters<typeof contractsApi.proposeVariation>[1]) => contractsApi.proposeVariation(sc.id, body));
    const amount = variationAmount((watched ?? []).map(l => ({ qty: l.qty ?? 0, unitPrice: l.unitPrice ?? 0 })));

    const submit = async () => {
        const v = await form.validateFields();
        try {
            await m.mutateAsync({
                reason: v.reason.trim(),
                lines: v.lines.map(l => ({ desc: (l.desc ?? '').trim(), unit: (l.unit ?? '').trim(), qty: l.qty ?? 0, unitPrice: l.unitPrice ?? 0 })),
            });
            void message.success('ส่งข้อเสนอให้ผู้รับจ้างแล้ว');
            onClose();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <Modal open width={760} title="เสนองานเพิ่ม-ลด" okText="ส่งให้ผู้รับจ้าง" cancelText="ยกเลิก"
            okButtonProps={{ loading: m.isPending }} onOk={() => { void submit(); }} onCancel={onClose} destroyOnHidden>
            <p className="text-secondary text-gray-600 mt-0">ใส่ปริมาณติดลบสำหรับงานที่ตัดออก ผู้รับจ้างต้องตกลงก่อน มูลค่าสัญญาจึงเปลี่ยน</p>
            <Form form={form} layout="vertical" requiredMark={false} initialValues={{ lines: [{ desc: '', unit: '', qty: null, unitPrice: null }], reason: '' }}>
                <Form.List name="lines">
                    {(fields, { add, remove }) => (
                        <div className="flex flex-col gap-2 mb-4">
                            {fields.map(f => (
                                <div key={f.key} className="grid grid-cols-[1fr_80px_100px_120px_32px] gap-2 items-start">
                                    <Form.Item name={[f.name, 'desc']} className="!mb-0" rules={[{ required: true, whitespace: true, message: 'ใส่รายการ' }, { max: 300 }]}>
                                        <Input placeholder="รายการ" />
                                    </Form.Item>
                                    <Form.Item name={[f.name, 'unit']} className="!mb-0" rules={[{ required: true, whitespace: true, message: 'หน่วย' }, { max: 20 }]}>
                                        <Input placeholder="หน่วย" />
                                    </Form.Item>
                                    <Form.Item name={[f.name, 'qty']} className="!mb-0" rules={[{ required: true, message: 'ปริมาณ' }]}>
                                        <InputNumber className="!w-full" placeholder="ปริมาณ" />
                                    </Form.Item>
                                    <Form.Item name={[f.name, 'unitPrice']} className="!mb-0" rules={[{ required: true, message: 'ราคา' }]}>
                                        <InputNumber className="!w-full" min={0} placeholder="ราคา/หน่วย" />
                                    </Form.Item>
                                    <Button type="text" icon={<DeleteOutlined />} aria-label="ลบ" disabled={fields.length === 1} onClick={() => remove(f.name)} />
                                </div>
                            ))}
                            <div className="flex items-center justify-between">
                                <Button type="dashed" icon={<PlusOutlined />} disabled={fields.length >= 100} onClick={() => add({ desc: '', unit: '', qty: null, unitPrice: null })}>เพิ่มรายการ</Button>
                                <span>รวม <Money value={amount} strong className={amount < 0 ? 'text-red-600' : ''} /> บาท</span>
                            </div>
                        </div>
                    )}
                </Form.List>
                <Form.Item name="reason" label="เหตุผล" rules={[{ required: true, whitespace: true, message: 'ใส่เหตุผล' }, { max: 1000 }]}>
                    <Input.TextArea rows={2} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
