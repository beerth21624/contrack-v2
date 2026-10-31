'use client';

// ─── A button that asks first (antd modal.confirm), then runs the action; a failed action shows the API error ───
// Every text comes from the caller (already translated) or from common.confirm / common.cancel / erp.confirm.title.
import type { ReactNode } from 'react';
import { App, Button, type ButtonProps } from 'antd';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';

export function ConfirmAction({
    children, onConfirm, title, content, okText, danger = false, disabled, type, size, icon, block, className,
}: {
    /** The button's label. */
    children: ReactNode;
    /** Runs after "confirm"; the OK button spins until it settles. A thrown error is shown as a message. */
    onConfirm: () => unknown;
    title?: ReactNode;
    content?: ReactNode;
    okText?: ReactNode;
    danger?: boolean;
    disabled?: boolean;
    type?: ButtonProps['type'];
    size?: ButtonProps['size'];
    icon?: ReactNode;
    block?: boolean;
    className?: string;
}) {
    const { modal, message } = App.useApp();
    const tc = useTranslations('common');
    const t = useTranslations('erp');
    const toText = useErrorMessage();
    const ask = () => {
        modal.confirm({
            title: title ?? t('confirm.title'),
            content,
            okText: okText ?? tc('confirm'),
            cancelText: tc('cancel'),
            okButtonProps: { danger },
            onOk: async () => {
                try {
                    await onConfirm();
                } catch (e) {
                    void message.error(toText(e));
                }
            },
        });
    };
    return (
        <Button
            danger={danger} disabled={disabled} type={type} size={size} icon={icon} block={block} className={className}
            onClick={ask}
        >
            {children}
        </Button>
    );
}
