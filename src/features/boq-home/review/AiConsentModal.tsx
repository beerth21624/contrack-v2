'use client';

// ─── Dialog shown before a BOQ is sent to the decision model ───
// Three ways out: send to the model, open the review with the deterministic rules only, or do nothing.
import { Button, Modal } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { CONSENT_TEXT } from './consent';

export interface AiConsentModalProps {
    open: boolean;
    onConfirm: () => void;
    onRulesOnly: () => void;
    onCancel: () => void;
}

export function AiConsentModal({ open, onConfirm, onRulesOnly, onCancel }: AiConsentModalProps) {
    return (
        <Modal
            open={open}
            onCancel={onCancel}
            title={<span className="flex items-center gap-2"><RobotOutlined /> {CONSENT_TEXT.title}</span>}
            width={520}
            destroyOnHidden
            footer={(
                <div className="flex flex-wrap justify-end gap-2">
                    <Button onClick={onRulesOnly}>{CONSENT_TEXT.rulesOnly}</Button>
                    <Button type="primary" onClick={onConfirm} autoFocus>{CONSENT_TEXT.confirm}</Button>
                </div>
            )}
        >
            <ul className="m-0 pl-5 flex flex-col gap-2 text-secondary text-gray-800 leading-relaxed">
                <li>{CONSENT_TEXT.sends}</li>
                <li>{CONSENT_TEXT.hints}</li>
                <li>{CONSENT_TEXT.cost}</li>
            </ul>
        </Modal>
    );
}
