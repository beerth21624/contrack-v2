'use client';

import type { ReactNode } from 'react';
import { Button, Popconfirm } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { FillBadge, fillTone, type FillState } from './FillStatus';

/**
 * One element read off the plan (an opening, a wall, a circuit …) as a card: fill marker, title, its live result,
 * "ทำซ้ำ" (duplicate) and delete. Deleting a card that holds data asks first; an untouched card goes at once.
 * While the card is `missing`, `missingText` says what is still needed (e.g. "ยังขาด: ความสูง").
 */
export function PlanCard({
    index, state, title, result, onDuplicate, onDelete, hasData, deleteTitle, missingText, compact, children,
}: {
    index: number;
    state: FillState;
    title: ReactNode;
    /** Live result of this element (short: "พื้นที่ 4.20 ตร.ม."). */
    result?: ReactNode;
    onDuplicate?: () => void;
    onDelete?: () => void;
    /** Ask before deleting (the card holds values typed from the plan). */
    hasData?: boolean;
    deleteTitle?: string;
    missingText?: ReactNode;
    /** Tighter padding (long lists such as circuits). */
    compact?: boolean;
    children?: ReactNode;
}) {
    const del = onDelete && (hasData
        ? (
            <Popconfirm title={deleteTitle ?? 'ลบรายการนี้?'} description="ค่าที่กรอกไว้ในรายการนี้จะหายไป"
                okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={onDelete}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="ลบ" title="ลบ" />
            </Popconfirm>
        )
        : <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="ลบ" title="ลบ" onClick={onDelete} />);

    return (
        <div className={`rounded-lg border transition-colors ${fillTone(state)}`}>
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${compact ? 'px-3 pt-2' : 'px-4 pt-3'}`}>
                <FillBadge state={state} index={index} />
                <div className="min-w-0 flex-1 text-[14px] font-semibold text-gray-800 [overflow-wrap:anywhere]">{title}</div>
                {result !== undefined && result !== '' && <div className="text-[13px] tabular-nums text-gray-700">{result}</div>}
                <div className="flex items-center gap-0.5">
                    {onDuplicate && (
                        <Button type="text" size="small" icon={<CopyOutlined />} onClick={onDuplicate} title="ทำซ้ำรายการนี้">
                            <span className="hidden sm:inline">ทำซ้ำ</span>
                        </Button>
                    )}
                    {del}
                </div>
            </div>
            <div className={compact ? 'px-3 pb-2.5 pt-2 sm:pl-12' : 'px-4 pb-3 pt-2 sm:pl-[52px]'}>
                {children}
                {state === 'missing' && missingText !== undefined && (
                    <div className="mt-2 text-[12px] text-red-600">{missingText}</div>
                )}
            </div>
        </div>
    );
}
