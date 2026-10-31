'use client';

// ─── The customer's answer: action + typed name (+ note), confirmed once; no signature (name + time + IP are stored) ───
import { App, Button, Form, Input, Radio } from 'antd';
import { useMutation } from '@tanstack/react-query';
import type { CustomerLinkAction, CustomerLinkViewDto } from '@/shared/contract';
import { isApiError } from '@/features/cloud/api/errors';
import { errorReason } from '@/features/cloud/api/error-message';
import { publicLinksApi } from './api';
import type { CustomerLinkTranslator } from './translator';

interface Values {
    action: CustomerLinkAction;
    name: string;
    note?: string;
}

export function RespondForm({ token, view, t, onResponded }: {
    token: string;
    view: CustomerLinkViewDto;
    t: CustomerLinkTranslator;
    onResponded: (view: CustomerLinkViewDto) => void;
}) {
    const { modal, message } = App.useApp();
    const [form] = Form.useForm<Values>();
    const send = useMutation({ mutationFn: (v: Values) => publicLinksApi.respond(token, { action: v.action, name: v.name, note: v.note ?? '' }) });

    const problem = (e: unknown): string => {
        if (isApiError(e)) {
            const reason = errorReason(e.details);
            if (reason === 'already_responded') return t('respond.alreadyResponded');
            if (reason === 'invalid_transition') return t('respond.invalidTransition');
            if (e.code === 'rate_limited') return t('rateLimited');
        }
        return t('respond.failed');
    };

    const submit = (v: Values) => {
        modal.confirm({
            title: t('respond.confirmTitle', { action: t(`actions.${v.action}`) }),
            content: t('respond.confirmHint'),
            okText: t('respond.confirm'),
            cancelText: t('respond.cancel'),
            okButtonProps: { danger: v.action === 'reject' },
            onOk: async () => {
                try {
                    const next = await send.mutateAsync(v);
                    void message.success(t('respond.sent'));
                    onResponded(next);
                } catch (e) {
                    void message.error(problem(e));
                    // A refused answer usually means the link changed state: show it as it is now.
                    if (isApiError(e) && e.status === 409) {
                        publicLinksApi.view(token).then(onResponded).catch(() => undefined);
                    }
                }
            },
        });
    };

    return (
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}
            initialValues={{ action: view.actions[0] }}>
            <Form.Item name="action" label={t('respond.action')} rules={[{ required: true }]}>
                <Radio.Group optionType="button" buttonStyle="solid"
                    options={view.actions.map(a => ({ value: a, label: t(`actions.${a}`) }))} />
            </Form.Item>
            <Form.Item name="name" label={t('respond.name')} rules={[{ required: true, whitespace: true, message: t('respond.nameRequired') }]}>
                <Input maxLength={120} placeholder={t('respond.namePlaceholder')} autoComplete="name" />
            </Form.Item>
            <Form.Item name="note" label={t('respond.note')}>
                <Input.TextArea maxLength={2000} rows={3} placeholder={t('respond.notePlaceholder')} />
            </Form.Item>
            <p className="text-xs text-gray-500 mb-3">{t('respond.disclaimer')}</p>
            <Button type="primary" htmlType="submit" loading={send.isPending} block>{t('respond.submit')}</Button>
        </Form>
    );
}
