'use client';

// ─── Messages between the crew and the buyer about one invitation (negotiation) ───
import { useState } from 'react';
import { App, Button, Input } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { vendorApi, vk } from '../api';
import { formatBaht, formatDateTime } from '../format';
import { useMessages } from '../hooks';
import { ErrorState, PageSpinner, Section } from './common';

export function MessagesThread({ invitationId, buyerName }: { invitationId: string; buyerName: string }) {
    const t = useTranslations('vendor');
    const locale = useLocale();
    const toText = useErrorMessage();
    const qc = useQueryClient();
    const { message } = App.useApp();
    const q = useMessages(invitationId);
    const [text, setText] = useState('');
    const send = useMutation({
        mutationFn: () => vendorApi.invitation.send(invitationId, { text: text.trim(), targetTotal: null }),
        onSuccess: async () => {
            setText('');
            await qc.invalidateQueries({ queryKey: vk.messages(invitationId) });
        },
        onError: (e) => { void message.error(toText(e)); },
    });

    if (q.isPending) return <PageSpinner />;
    if (q.isError) return <ErrorState error={q.error} onRetry={() => { void q.refetch(); }} />;

    return (
        <Section title={t('messages.title', { name: buyerName })}>
            {q.data.length === 0 ? (
                <div className="text-secondary text-gray-500 pb-3">{t('messages.empty')}</div>
            ) : (
                <div className="flex flex-col gap-2 pb-3">
                    {q.data.map(m => {
                        const mine = m.from === 'vendor';
                        return (
                            <div key={m.id} className={`max-w-[85%] rounded-card px-3 py-2 ${mine ? 'self-end bg-orange-50 border border-orange-200' : 'self-start bg-gray-100'}`}>
                                <div className="text-body text-gray-900 whitespace-pre-line">{m.text}</div>
                                {m.targetTotal !== null && (
                                    <div className="mt-1 text-secondary font-medium text-gray-800">{t('messages.target', { amount: formatBaht(m.targetTotal, locale) })}</div>
                                )}
                                <div className="mt-0.5 text-caption text-gray-500">{mine ? t('messages.you') : buyerName} · {formatDateTime(m.at, locale)}</div>
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="flex gap-2 items-end">
                <Input.TextArea value={text} onChange={e => setText(e.target.value)} autoSize={{ minRows: 1, maxRows: 5 }} maxLength={2000}
                    placeholder={t('messages.placeholder')} aria-label={t('messages.ariaText')} />
                <Button type="primary" icon={<SendOutlined />} aria-label={t('messages.send')} disabled={text.trim() === ''} loading={send.isPending}
                    onClick={() => send.mutate()} />
            </div>
        </Section>
    );
}
