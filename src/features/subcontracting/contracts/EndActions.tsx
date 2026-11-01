'use client';

// ─── End of a contract: cancel (before acceptance), terminate (active), complete (all paid), close (retention 0), rate ───
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { App, Button, Dropdown, Form, Input, Modal, Rate } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { SubcontractDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import type { Permission } from '@/features/cloud/permissions';
import { contractsApi, useContractMutation } from './api';
import { contractActions } from './logic';

type Ending = 'cancel' | 'terminate';

export function EndActions({ sc, may, onCompleted }: { sc: SubcontractDto; may: (p: Permission) => boolean; onCompleted: () => void }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message, modal } = App.useApp();
    const [ending, setEnding] = useState<Ending | null>(null);
    const a = contractActions(sc);
    const complete = useContractMutation(sc.id, () => contractsApi.complete(sc.id));
    const close = useContractMutation(sc.id, () => contractsApi.close(sc.id));

    const canComplete = a.complete && may('sc.claims.approve');
    const canClose = a.close && may('sc.payments.record');
    const menu = [
        ...(a.cancel && may('sc.award') ? [{ key: 'cancel', label: t('contracts.end.cancelContract'), danger: true }] : []),
        ...(a.terminate && may('sc.award') ? [{ key: 'terminate', label: t('contracts.end.terminate'), danger: true }] : []),
    ];

    const onComplete = () => {
        modal.confirm({
            title: t('contracts.end.confirmDeliver'),
            content: t('contracts.end.confirmDeliverBody'),
            okText: t('contracts.end.delivered'),
            cancelText: t('contracts.common.cancel'),
            onOk: async () => {
                try {
                    await complete.mutateAsync(undefined);
                    onCompleted();
                } catch (e) {
                    void message.error(toText(e));
                }
            },
        });
    };

    const onClose = () => {
        modal.confirm({
            title: t('contracts.end.closeContract'),
            content: t('contracts.end.closeBody'),
            okText: t('contracts.end.closeContract'),
            cancelText: t('contracts.common.cancel'),
            onOk: async () => {
                try {
                    await close.mutateAsync(undefined);
                } catch (e) {
                    void message.error(toText(e));
                }
            },
        });
    };

    return (
        <>
            {canComplete && <Button type="primary" onClick={onComplete}>{t('contracts.end.deliverWork')}</Button>}
            {canClose && <Button type="primary" onClick={onClose}>{t('contracts.end.closeContract')}</Button>}
            {menu.length > 0 && (
                <Dropdown trigger={['click']} menu={{ items: menu, onClick: ({ key }) => { setEnding(key === 'cancel' ? 'cancel' : 'terminate'); } }}>
                    <Button icon={<MoreOutlined />} aria-label={t('contracts.end.more')} />
                </Dropdown>
            )}
            <EndModal sc={sc} ending={ending} onClose={() => setEnding(null)} />
        </>
    );
}

function EndModal({ sc, ending, onClose }: { sc: SubcontractDto; ending: Ending | null; onClose: () => void }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
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
            void message.success(cancel ? t('contracts.end.cancelledToast') : t('contracts.end.terminatedToast'));
            form.resetFields();
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal
            open={ending !== null}
            title={cancel ? t('contracts.end.cancelContract') : t('contracts.end.terminate')}
            okText={cancel ? t('contracts.end.cancelContract') : t('contracts.end.terminate')}
            okButtonProps={{ danger: true, loading: m.isPending }}
            cancelText={t('contracts.end.dontDo')}
            onOk={() => { void submit(); }}
            onCancel={onClose}
            destroyOnHidden
        >
            <p className="text-secondary text-gray-600 mt-0">
                {cancel
                    ? t('contracts.end.cancelNote')
                    : t('contracts.end.terminateNote')}
            </p>
            <Form form={form} layout="vertical" requiredMark={false}>
                <Form.Item name="reason" label={t('contracts.common.reason')} rules={[{ required: true, whitespace: true, message: t('contracts.common.enterReason') }, { max: 1000 }]}>
                    <Input.TextArea rows={3} />
                </Form.Item>
            </Form>
        </Modal>
    );
}

const RATING_KEYS = ['quality', 'time', 'communication'] as const;

interface RatingForm { quality: number; time: number; communication: number; comment?: string }

export function RatingModal({ subcontractId, vendorName, open, onClose }: { subcontractId: string; vendorName: string; open: boolean; onClose: () => void }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
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
            void message.success(t('contracts.end.ratedToast'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open={open} title={t('contracts.end.rateTitle', { name: vendorName })} okText={t('contracts.end.sendRating')} cancelText={t('contracts.end.later')}
            okButtonProps={{ loading: m.isPending }} onOk={() => { void submit(); }} onCancel={onClose} destroyOnHidden>
            <Form form={form} layout="horizontal" requiredMark={false} labelCol={{ span: 9 }} wrapperCol={{ span: 15 }}>
                {RATING_KEYS.map(key => (
                    <Form.Item key={key} name={key} label={t(`contracts.end.rating.${key}`)} rules={[{ required: true, message: t('contracts.end.rateRequired') }]}>
                        <Rate />
                    </Form.Item>
                ))}
                <Form.Item name="comment" label={t('contracts.end.comment')} rules={[{ max: 1000 }]}>
                    <Input.TextArea rows={3} placeholder={t('contracts.common.optional')} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
