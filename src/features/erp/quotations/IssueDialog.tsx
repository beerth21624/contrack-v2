'use client';

// ─── Issue a draft: pick the dates, get the number (or "waiting for approval" when the approval policy is on) ───
import { useState } from 'react';
import { App, Input, Modal } from 'antd';
import { useTranslations } from 'next-intl';
import { QUOTATION_DEFAULT_VALID_DAYS, type QuotationVersionDto } from '@/shared/contract';
import { addDays, bangkokToday } from '@/domain/dates/business-date';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useIssueQuotationVersion } from './hooks';

export function IssueDialog({ version, open, flush, onClose }: {
    version: QuotationVersionDto;
    open: boolean;
    /** Saves pending edits first. */
    flush: () => Promise<boolean>;
    onClose: () => void;
}) {
    // Mounted only while open, so the dates start from the version every time.
    return open ? <IssueForm version={version} flush={flush} onClose={onClose} /> : null;
}

function IssueForm({ version, flush, onClose }: { version: QuotationVersionDto; flush: () => Promise<boolean>; onClose: () => void }) {
    const t = useTranslations('quotations');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const issue = useIssueQuotationVersion(version.id);
    const [issueDate, setIssueDate] = useState(() => version.issueDate ?? bangkokToday(new Date()));
    const [validUntil, setValidUntil] = useState(() => version.validUntil ?? addDays(version.issueDate ?? bangkokToday(new Date()), QUOTATION_DEFAULT_VALID_DAYS));

    const invalid = issueDate === '' || validUntil === '' || validUntil < issueDate;

    const submit = async () => {
        try {
            if (!(await flush())) return;
            const res = await issue.mutateAsync({ issueDate, validUntil });
            if (res.status === 'pending_approval') void message.info(t('issue.pending'));
            else void message.success(t('issue.done', { number: res.number ?? '' }));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={t('issue.title')} onCancel={onClose} okText={t('issue.submit')} confirmLoading={issue.isPending}
            okButtonProps={{ disabled: invalid }} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="mb-3 text-[13px] text-gray-500">{t('issue.hint')}</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.issueDate')}
                    <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.validUntil')}
                    <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                </label>
            </div>
            {issueDate !== '' && validUntil !== '' && validUntil < issueDate && (
                <div className="mt-2 text-[13px] text-red-600">{t('problems.dates_order')}</div>
            )}
        </Modal>
    );
}
