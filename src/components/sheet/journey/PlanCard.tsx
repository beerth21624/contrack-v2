'use client';

import type { ReactNode } from 'react';
import { Button, Popconfirm } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { FillBadge, fillTone, type FillState } from './FillStatus';
import { RequiredScope, useRequiredCard } from './RequiredContext';
import type { RowScope } from './required';

/**
 * One element read off the plan (an opening, a wall, a circuit …) as a card: fill marker, title, its live result,
 * "ทำซ้ำ" (duplicate) and delete. Deleting a card that holds data asks first; an untouched card goes at once.
 * While the card is `missing`, `missingText` says what is still needed (e.g. "ยังขาด: ความสูง").
 * `scope` names the card's row of the step's input, so required fields inside can be marked and found.
 */
export function PlanCard({
    index, state, title, result, onDuplicate, onDelete, hasData, deleteTitle, missingText, compact, scope, children,
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
    /** The row of the step's input this card shows (`missingRequirements` → `listKey` / `itemIndex`). */
    scope?: RowScope;
    children?: ReactNode;
}) {
    const req = useRequiredCard(scope);
    // Red only after the user tried to confirm the step (req.highlighted). Before that a half-filled card stays
    // neutral and its "ยังขาด" line is a quiet grey note — nothing turns red while someone is still typing.
    const alert = req.highlighted;
    const shown: FillState = alert ? 'missing' : state === 'missing' ? 'empty' : state;
    const del = onDelete && (hasData
        ? (
            <Popconfirm title={deleteTitle ?? 'ลบรายการนี้?'} description="ค่าที่กรอกไว้ในรายการนี้จะหายไป"
                okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={onDelete}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="ลบ" title="ลบ" />
            </Popconfirm>
        )
        : <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="ลบ" title="ลบ" onClick={onDelete} />);

    return (
        <div className={`rounded-[10px] border transition-colors scroll-mt-24 ${fillTone(shown)}`} data-req-card={req.targetId}>
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 min-h-[36px] ${compact ? 'px-3 pt-2' : 'px-4 pt-3'}`}>
                <FillBadge state={shown} index={index} />
                {/* The title keeps room to read (an editable name must not shrink to nothing); on a phone the result
                    takes its own line under the title instead. */}
                <div className="min-w-[140px] flex-1 text-[14px] font-semibold leading-snug text-gray-800 [overflow-wrap:anywhere]">{title}</div>
                {result !== undefined && result !== '' && (
                    <div className="order-last w-full pl-9 text-[13px] tabular-nums text-gray-700 sm:order-none sm:w-auto sm:pl-0">{result}</div>
                )}
                {(onDuplicate !== undefined || del !== undefined) && (
                    <div className="flex items-center gap-0.5">
                        {onDuplicate && (
                            <Button type="text" size="small" icon={<CopyOutlined />} onClick={onDuplicate} title="ทำซ้ำรายการนี้">
                                <span className="hidden sm:inline">ทำซ้ำ</span>
                            </Button>
                        )}
                        {del}
                    </div>
                )}
            </div>
            <div className={compact ? 'px-3 pb-2.5 pt-2 sm:pl-12' : 'px-4 pb-3 pt-2 sm:pl-[52px]'}>
                <RequiredScope scope={scope}>{children}</RequiredScope>
                {(alert || state === 'missing') && missingText !== undefined && (
                    <div className={`mt-2 text-[12px] ${alert ? 'text-red-600' : 'text-gray-500'}`}>{missingText}</div>
                )}
            </div>
        </div>
    );
}
