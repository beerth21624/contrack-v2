'use client';

// ─── End of a contract: cancel (before acceptance), terminate (active), complete (all paid), close (retention 0), rate ───
import { useState } from 'react';
import { App, Button, Dropdown, Form, Input, Modal, Rate } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { SubcontractDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import type { Permission } from '@/features/cloud/permissions';
import { contractsApi, useContractMutation } from './api';
import { contractActions } from './logic';

type Ending = 'cancel' | 'terminate';

export function EndActions({ sc, may, onCompleted }: { sc: SubcontractDto; may: (p: Permission) => boolean; onCompleted: () => void }) {
    const { message, modal } = App.useApp();
    const [ending, setEnding] = useState<Ending | null>(null);
    const a = contractActions(sc);
    const complete = useContractMutation(sc.id, () => contractsApi.complete(sc.id));
    const close = useContractMutation(sc.id, () => contractsApi.close(sc.id));

    const canComplete = a.complete && may('sc.claims.approve');
    const canClose = a.close && may('sc.payments.record');
    const menu = [
        ...(a.cancel && may('sc.award') ? [{ key: 'cancel', label: 'ยกเลิกสัญญา', danger: true }] : []),
        ...(a.terminate && may('sc.award') ? [{ key: 'terminate', label: 'บอกเลิกสัญญา', danger: true }] : []),
    ];

    const onComplete = () => {
        modal.confirm({
            title: 'ยืนยันส่งมอบงาน',
            content: 'ทุกงวดจ่ายแล้ว สัญญาจะเป็น "ส่งมอบแล้ว" เงินประกันผลงานยังค้างคืนได้ตามกำหนด',
            okText: 'ส่งมอบแล้ว',
            cancelText: 'ยกเลิก',
            onOk: async () => {
                try {
                    await complete.mutateAsync(undefined);
                    onCompleted();
                } catch (e) {
                    void message.error(thaiErrorMessage(e));
                }
            },
        });
    };

    const onClose = () => {
        modal.confirm({
            title: 'ปิดสัญญา',
            content: 'คืนเงินประกันผลงานครบแล้ว ปิดสัญญานี้ได้ หลังปิดแก้ไขไม่ได้',
            okText: 'ปิดสัญญา',
            cancelText: 'ยกเลิก',
            onOk: async () => {
                try {
                    await close.mutateAsync(undefined);
                } catch (e) {
                    void message.error(thaiErrorMessage(e));
                }
            },
        });
    };

    return (
        <>
            {canComplete && <Button type="primary" onClick={onComplete}>ส่งมอบงาน</Button>}
            {canClose && <Button type="primary" onClick={onClose}>ปิดสัญญา</Button>}
            {menu.length > 0 && (
                <Dropdown trigger={['click']} menu={{ items: menu, onClick: ({ key }) => { setEnding(key === 'cancel' ? 'cancel' : 'terminate'); } }}>
                    <Button icon={<MoreOutlined />} aria-label="เพิ่มเติม" />
                </Dropdown>
            )}
            <EndModal sc={sc} ending={ending} onClose={() => setEnding(null)} />
        </>
    );
}

function EndModal({ sc, ending, onClose }: { sc: SubcontractDto; ending: Ending | null; onClose: () => void }) {
    const { message } = App.useApp();
    const [form] = Form.useForm<{ reason: string }>();
    const m = useContractMutation(sc.id, ({ kind, reason }: { kind: Ending; reason: string }) =>
        kind === 'cancel' ? contractsApi.cancel(sc.id, reason) : contractsApi.terminate(sc.id, reason));
    const cancel = ending === 'cancel';

    const submit = async () => {
        if (ending === null) return;
        const { reason } = await form.validateFields();
        try {
            await m.mutateAsync({ kind: ending, reason: reason.trim() });
            void message.success(cancel ? 'ยกเลิกสัญญาแล้ว' : 'บอกเลิกสัญญาแล้ว');
            form.resetFields();
            onClose();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <Modal
            open={ending !== null}
            title={cancel ? 'ยกเลิกสัญญา' : 'บอกเลิกสัญญา'}
            okText={cancel ? 'ยกเลิกสัญญา' : 'บอกเลิกสัญญา'}
            okButtonProps={{ danger: true, loading: m.isPending }}
            cancelText="ไม่ทำ"
            onOk={() => { void submit(); }}
            onCancel={onClose}
            destroyOnHidden
        >
            <p className="text-secondary text-gray-600 mt-0">
                {cancel
                    ? 'แพ็กเกจจะกลับไปรับราคา เลือกผู้รับจ้างรายอื่นได้ ผู้รับจ้างได้รับแจ้งพร้อมเหตุผล'
                    : 'งวดที่อนุมัติแล้วยังคงอยู่ ผู้รับจ้างได้รับแจ้งพร้อมเหตุผล'}
            </p>
            <Form form={form} layout="vertical" requiredMark={false}>
                <Form.Item name="reason" label="เหตุผล" rules={[{ required: true, whitespace: true, message: 'ใส่เหตุผล' }, { max: 1000 }]}>
                    <Input.TextArea rows={3} />
                </Form.Item>
            </Form>
        </Modal>
    );
}

const RATING_ITEMS = [
    { key: 'quality', label: 'คุณภาพงาน' },
    { key: 'time', label: 'ตรงเวลา' },
    { key: 'communication', label: 'การติดต่อสื่อสาร' },
] as const;

interface RatingForm { quality: number; time: number; communication: number; comment?: string }

export function RatingModal({ subcontractId, vendorName, open, onClose }: { subcontractId: string; vendorName: string; open: boolean; onClose: () => void }) {
    const { message } = App.useApp();
    const [form] = Form.useForm<RatingForm>();
    const m = useContractMutation(subcontractId, (v: RatingForm) =>
        contractsApi.rate(subcontractId, {
            scores: { quality: v.quality, time: v.time, communication: v.communication },
            comment: (v.comment ?? '').trim(),
        }));

    const submit = async () => {
        const v = await form.validateFields();
        try {
            await m.mutateAsync(v);
            void message.success('บันทึกคะแนนแล้ว ขอบคุณ');
            onClose();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <Modal open={open} title={`ให้คะแนน ${vendorName}`} okText="ส่งคะแนน" cancelText="ไว้ทีหลัง"
            okButtonProps={{ loading: m.isPending }} onOk={() => { void submit(); }} onCancel={onClose} destroyOnHidden>
            <Form form={form} layout="horizontal" requiredMark={false} labelCol={{ span: 9 }} wrapperCol={{ span: 15 }}>
                {RATING_ITEMS.map(i => (
                    <Form.Item key={i.key} name={i.key} label={i.label} rules={[{ required: true, message: 'ให้คะแนน 1–5' }]}>
                        <Rate />
                    </Form.Item>
                ))}
                <Form.Item name="comment" label="ความเห็น" rules={[{ max: 1000 }]}>
                    <Input.TextArea rows={3} placeholder="ไม่บังคับ" />
                </Form.Item>
            </Form>
        </Modal>
    );
}
