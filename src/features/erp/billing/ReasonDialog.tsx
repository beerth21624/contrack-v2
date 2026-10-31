'use client';

// ─── A small dialog asking for a reason (void an invoice / receipt, credit note) ───
import { useState, type ReactNode } from 'react';
import { App, Input, Modal } from 'antd';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';

export function ReasonDialog({ title, hint, okText, danger = false, extra, extraValid = true, onSubmit, onClose }: {
    title: ReactNode;
    hint?: ReactNode;
    okText: ReactNode;
    danger?: boolean;
    /** More fields above the reason. */
    extra?: ReactNode;
    extraValid?: boolean;
    onSubmit: (reason: string) => Promise<unknown>;
    onClose: () => void;
}) {
    const t = useTranslations('billing');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        try {
            await onSubmit(reason.trim());
            onClose();
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open title={title} okText={okText} okButtonProps={{ danger, disabled: reason.trim() === '' || !extraValid }} confirmLoading={busy}
            onCancel={onClose} onOk={() => { void submit(); }} destroyOnHidden>
            {hint !== undefined && <div className="mb-2 text-[13px] text-gray-500">{hint}</div>}
            {extra}
            <Input.TextArea rows={3} maxLength={500} value={reason} placeholder={t('reason.placeholder')} onChange={e => setReason(e.target.value)} />
        </Modal>
    );
}
