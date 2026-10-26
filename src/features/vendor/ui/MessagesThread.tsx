'use client';

// ─── Messages between the crew and the buyer about one invitation (negotiation) ───
import { useState } from 'react';
import { App, Button, Input } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { vendorApi, vk } from '../api';
import { formatBaht, formatDateTime } from '../format';
import { useMessages } from '../hooks';
import { ErrorState, PageSpinner, Section } from './common';

export function MessagesThread({ invitationId, buyerName }: { invitationId: string; buyerName: string }) {
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
        onError: (e) => { void message.error(thaiErrorMessage(e)); },
    });

    if (q.isPending) return <PageSpinner />;
    if (q.isError) return <ErrorState error={q.error} onRetry={() => { void q.refetch(); }} />;

    return (
        <Section title={`คุยกับ ${buyerName}`}>
            {q.data.length === 0 ? (
                <div className="text-secondary text-gray-500 pb-3">ยังไม่มีข้อความ ถามเรื่องราคาหรือเงื่อนไขได้ที่นี่ (เห็นกันแค่คุณกับผู้ว่าจ้าง)</div>
            ) : (
                <div className="flex flex-col gap-2 pb-3">
                    {q.data.map(m => {
                        const mine = m.from === 'vendor';
                        return (
                            <div key={m.id} className={`max-w-[85%] rounded-card px-3 py-2 ${mine ? 'self-end bg-orange-50 border border-orange-200' : 'self-start bg-gray-100'}`}>
                                <div className="text-body text-gray-900 whitespace-pre-line">{m.text}</div>
                                {m.targetTotal !== null && (
                                    <div className="mt-1 text-secondary font-medium text-gray-800">ราคาที่ผู้ว่าจ้างหวัง {formatBaht(m.targetTotal)}</div>
                                )}
                                <div className="mt-0.5 text-caption text-gray-500">{mine ? 'คุณ' : buyerName} · {formatDateTime(m.at)}</div>
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="flex gap-2 items-end">
                <Input.TextArea value={text} onChange={e => setText(e.target.value)} autoSize={{ minRows: 1, maxRows: 5 }} maxLength={2000}
                    placeholder="พิมพ์ข้อความ" aria-label="ข้อความถึงผู้ว่าจ้าง" />
                <Button type="primary" icon={<SendOutlined />} aria-label="ส่งข้อความ" disabled={text.trim() === ''} loading={send.isPending}
                    onClick={() => send.mutate()} />
            </div>
        </Section>
    );
}
