'use client';

// ─── Record the customer's answer that came outside the link (phone, e-mail, signed copy) ───
import { useState } from 'react';
import { App, Input, Modal, Select } from 'antd';
import { useTranslations } from 'next-intl';
import { QUOTATION_RESPONSE_ACTIONS, type QuotationResponseAction } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useRecordQuotationResponse } from './hooks';

export function RecordResponseDialog({ versionId, open, onClose }: { versionId: string; open: boolean; onClose: () => void }) {
    const t = useTranslations('quotations');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const record = useRecordQuotationResponse(versionId);
    const [action, setAction] = useState<QuotationResponseAction>('accept');
    const [name, setName] = useState('');
    const [note, setNote] = useState('');

    const submit = async () => {
        try {
            await record.mutateAsync({ action, acceptedByName: name.trim(), note });
            void message.success(t('response.done'));
            setName('');
            setNote('');
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open={open} title={t('response.title')} onCancel={onClose} okText={t('response.submit')} confirmLoading={record.isPending}
            okButtonProps={{ disabled: name.trim() === '' }} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="mb-3 text-[13px] text-gray-500">{t('response.hint')}</div>
            <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('response.action')}
                    <Select value={action} onChange={setAction}
                        options={QUOTATION_RESPONSE_ACTIONS.map(a => ({ value: a, label: t(`response.actions.${a}`) }))} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('response.name')}
                    <Input value={name} maxLength={200} onChange={e => setName(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('response.note')}
                    <Input.TextArea rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
                </label>
            </div>
        </Modal>
    );
}
