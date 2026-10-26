'use client';

// ─── Invitation links shown once after sending / resending: copy, or open LINE with the message ready ───
// The server keeps only a hash of each token, so this is the one moment the buyer can pass the link on by hand.
import { Button, Modal } from 'antd';
import { formatThaiPhone } from '@/shared/contract';
import { invitationMessage, lineShareUrl } from './format';
import { CopyButton } from './ui';

export interface LinkRow {
    invitationId: string;
    displayName: string;
    phone: string;
    url: string;
}

export function InvitationLinksModal({ open, onClose, rows, title, buyerName, packageTitle, deadline, intro }: {
    open: boolean;
    onClose: () => void;
    rows: readonly LinkRow[];
    title?: string;
    buyerName: string;
    packageTitle: string;
    deadline: string;
    /** One short line above the list. */
    intro?: string;
}) {
    return (
        <Modal open={open} onCancel={onClose} title={title ?? 'ส่งลิงก์ให้ผู้รับ'} width={640} destroyOnHidden
            footer={<Button type="primary" onClick={onClose}>เสร็จแล้ว</Button>}>
            <p className="text-secondary text-gray-600 mb-3">
                {intro ?? 'ลิงก์แสดงครั้งเดียว คัดลอกหรือเปิด LINE ส่งให้แต่ละรายตอนนี้'}
            </p>
            <div className="flex flex-col divide-y divide-gray-100 border border-gray-200 rounded-card">
                {rows.map(r => {
                    const text = invitationMessage({ buyerName, title: packageTitle, deadline, url: r.url });
                    return (
                        <div key={r.invitationId} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate">{r.displayName}</div>
                                <div className="text-caption text-gray-500 truncate">{formatThaiPhone(r.phone)} · {r.url}</div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <CopyButton text={text} label="คัดลอกข้อความ" />
                                <a href={lineShareUrl(text)} target="_blank" rel="noopener noreferrer">
                                    <Button size="small">ส่งทาง LINE</Button>
                                </a>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
}
