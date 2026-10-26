'use client';

// ─── Shared pieces of the buyer screens: page frame, header card, empty states, status tags, copy button ───
import Link from 'next/link';
import { useState } from 'react';
import { App, Button, Empty, Tag, Tooltip } from 'antd';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import type { InvitationStatus, PackageStatus, TradeId } from '@/shared/contract';
import { TRADES, tradeLabel } from '@/domain/subcontracting/trades';
import { ModuleGate } from '@/features/modules/ModuleGate';
import {
    INVITATION_STATUS_COLOR, INVITATION_STATUS_LABEL, PACKAGE_STATUS_COLOR, PACKAGE_STATUS_LABEL,
} from './format';

/** Every buyer page: signed in + module on, inside the 1200 px frame. */
export function ScPage({ next, children }: { next: string; children: React.ReactNode }) {
    return (
        <ModuleGate module="subcontracting" next={next}>
            <div className="flex flex-col gap-4 max-w-[1200px] mx-auto w-full">{children}</div>
        </ModuleGate>
    );
}

/** Page header card: title left (with an optional line under it), actions right. */
export function PageHead({ title, sub, extra, back }: {
    title: React.ReactNode;
    sub?: React.ReactNode;
    extra?: React.ReactNode;
    back?: { href: string; label: string };
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-card p-5 shadow-card flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 min-w-0">
                {back && (
                    <Link href={back.href} className="text-[13px] text-gray-500 hover:text-orange-600">← {back.label}</Link>
                )}
                <h1 className="text-page-title font-semibold text-gray-900 m-0">{title}</h1>
                {sub !== undefined && <div className="text-secondary text-gray-600 mt-1">{sub}</div>}
            </div>
            {extra !== undefined && <div className="flex flex-wrap items-center gap-2">{extra}</div>}
        </div>
    );
}

/** A white card with an optional title row (title left, meta right). */
export function Card({ title, extra, children, className }: {
    title?: React.ReactNode;
    extra?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={`bg-white border border-gray-200 rounded-card p-5 max-md:p-4 shadow-card ${className ?? ''}`}>
            {(title !== undefined || extra !== undefined) && (
                <div className="flex items-center gap-2 mb-3 min-h-8">
                    <div className="text-section font-semibold text-gray-900 flex-1 min-w-0">{title}</div>
                    {extra}
                </div>
            )}
            {children}
        </section>
    );
}

/** No cloud project open: the module works on a project of a workspace. */
export function NoProjectState() {
    return (
        <Card>
            <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={(
                    <div className="flex flex-col gap-1">
                        <span className="text-gray-900">ยังไม่ได้เปิดโครงการ</span>
                        <span className="text-secondary text-gray-500">จ้างช่วงทำงานจาก BOQ ของโครงการบนคลาวด์ เปิดโครงการก่อน</span>
                    </div>
                )}
            >
                <Link href="/projects"><Button type="primary">ไปที่โครงการทั้งหมด</Button></Link>
            </Empty>
        </Card>
    );
}

export function PackageStatusTag({ status }: { status: PackageStatus }) {
    return <Tag color={PACKAGE_STATUS_COLOR[status]} className="!m-0">{PACKAGE_STATUS_LABEL[status]}</Tag>;
}

export function InvitationStatusTag({ status, extra }: { status: InvitationStatus; extra?: string }) {
    return (
        <Tag color={INVITATION_STATUS_COLOR[status]} className="!m-0">
            {INVITATION_STATUS_LABEL[status]}{extra !== undefined && extra !== '' ? ` ${extra}` : ''}
        </Tag>
    );
}

export function TradeChips({ trades }: { trades: readonly TradeId[] }) {
    if (trades.length === 0) return <span className="text-gray-400">–</span>;
    return (
        <span className="flex flex-wrap gap-1">
            {trades.map(t => <Tag key={t} className="!m-0" variant="filled">{tradeLabel(t)}</Tag>)}
        </span>
    );
}

export const TRADE_OPTIONS = TRADES.map(t => ({ value: t.id, label: t.label }));

/** Copy a text to the clipboard; shows ✓ for a moment after a successful copy. */
export function CopyButton({ text, label = 'คัดลอกลิงก์', size = 'small', type }: {
    text: string;
    label?: string;
    size?: 'small' | 'middle';
    type?: 'default' | 'link' | 'text';
}) {
    const { message } = App.useApp();
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            void message.error('คัดลอกไม่สำเร็จ เลือกข้อความแล้วคัดลอกเอง');
        }
    };
    return (
        <Tooltip title={copied ? 'คัดลอกแล้ว' : undefined} open={copied ? true : undefined}>
            <Button size={size} type={type} icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={() => { void copy(); }}>
                {label}
            </Button>
        </Tooltip>
    );
}

/** Right-aligned amount with tabular numerals. */
export function Num({ children, muted, className }: { children: React.ReactNode; muted?: boolean; className?: string }) {
    return <span className={`tabular-nums whitespace-nowrap ${muted === true ? 'text-gray-500' : ''} ${className ?? ''}`}>{children}</span>;
}
