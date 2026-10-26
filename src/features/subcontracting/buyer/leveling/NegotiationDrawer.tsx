'use client';

// ─── Negotiation with one bidder: the message thread + a message with an optional target price ───
import { useState } from 'react';
import { App, Button, Drawer, Empty, Input, InputNumber, Spin } from 'antd';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { fmtDateTime, money, money0 } from '../format';
import { useMessages, useSendMessage } from '../hooks';
import type { Bidder } from './model';

export function NegotiationDrawer({ bidder, onClose, canSend }: { bidder: Bidder | null; onClose: () => void; canSend: boolean }) {
    return (
        <Drawer open={bidder !== null} onClose={onClose} size={440} destroyOnHidden
            title={bidder === null ? '' : `ต่อรองกับ ${bidder.displayName}`}>
            {bidder !== null && <Thread bidder={bidder} canSend={canSend} />}
        </Drawer>
    );
}

function Thread({ bidder, canSend }: { bidder: Bidder; canSend: boolean }) {
    const { message } = App.useApp();
    const messages = useMessages(bidder.invitationId);
    const send = useSendMessage(bidder.invitationId);
    const [text, setText] = useState('');
    const [target, setTarget] = useState<number | null>(null);

    const submit = async () => {
        if (text.trim() === '') return;
        try {
            await send.mutateAsync({ text: text.trim(), targetTotal: target });
            setText('');
            setTarget(null);
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="text-secondary text-gray-600">
                ราคาที่เสนอ <span className="tabular-nums text-gray-900">{money0(bidder.total)}</span> บาท
                · ฉบับที่ {bidder.version}
            </div>
            <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-y-auto">
                {messages.isLoading && <div className="flex justify-center p-6"><Spin /></div>}
                {messages.isError && <div className="text-secondary text-red-600">{thaiErrorMessage(messages.error)}</div>}
                {messages.data?.length === 0 && (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีข้อความ" />
                )}
                {messages.data?.map(m => (
                    <div key={m.id} className={`max-w-[85%] rounded-card px-3 py-2 ${m.from === 'buyer'
                        ? 'self-end bg-orange-50 border border-orange-100'
                        : 'self-start bg-gray-50 border border-gray-200'}`}>
                        <div className="whitespace-pre-wrap text-gray-900">{m.text}</div>
                        {m.targetTotal !== null && (
                            <div className="text-secondary text-gray-600 mt-1">
                                ราคาเป้าหมาย <span className="tabular-nums">{money(m.targetTotal)}</span> บาท
                            </div>
                        )}
                        <div className="text-caption text-gray-400 mt-1">
                            {m.from === 'buyer' ? 'เรา' : bidder.displayName} · {fmtDateTime(m.at)}
                        </div>
                    </div>
                ))}
            </div>
            {canSend && (
                <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                    <Input.TextArea value={text} onChange={e => setText(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }}
                        maxLength={2000} placeholder="เช่น ลดได้อีกไหม ถ้าเริ่มงานได้ภายในต้นเดือน" />
                    <div className="flex items-center gap-2">
                        <InputNumber<number> value={target} onChange={v => setTarget(v)} min={0} className="!flex-1"
                            placeholder="ราคาเป้าหมาย (ไม่บังคับ)" suffix="บาท"
                            formatter={v => (v === undefined ? '' : v.toLocaleString('th-TH'))}
                            parser={v => Number((v ?? '').replace(/,/g, ''))} />
                        <Button type="primary" loading={send.isPending} disabled={text.trim() === ''} onClick={() => { void submit(); }}>
                            ส่ง
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
