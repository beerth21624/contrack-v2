'use client';

// ─── Dialog shown before a BOQ is sent to the decision model ───
// Three ways out: send to the model, open the review with the deterministic rules only, or do nothing.
import { Button, Modal } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

export interface AiConsentModalProps {
    open: boolean;
    onConfirm: () => void;
    onRulesOnly: () => void;
    onCancel: () => void;
}

export function AiConsentModal({ open, onConfirm, onRulesOnly, onCancel }: AiConsentModalProps) {
    const t = useTranslations('boqHome.consent');
    return (
        <Modal
            open={open}
            onCancel={onCancel}
            title={<span className="flex items-center gap-2"><RobotOutlined /> {t('title')}</span>}
            width={520}
            destroyOnHidden
            footer={(
                <div className="flex flex-wrap justify-end gap-2">
                    <Button onClick={onRulesOnly}>{t('rulesOnly')}</Button>
                    <Button type="primary" onClick={onConfirm} autoFocus>{t('confirm')}</Button>
                </div>
            )}
        >
            <ul className="m-0 pl-5 flex flex-col gap-2 text-secondary text-gray-800 leading-relaxed">
                <li>{t('sends')}</li>
                <li>{t('hints')}</li>
                <li>{t('cost')}</li>
            </ul>
        </Modal>
    );
}
