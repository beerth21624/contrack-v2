'use client';

import { useState } from 'react';
import { Button } from 'antd';
import { ArrowRightOutlined, CheckCircleFilled, UndoOutlined } from '@ant-design/icons';
import { formatNumber } from '@/components/sheet/NumberCell';
import { levelTitle } from './levelRef';

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const shown = (v: number, unit: string) => (v === 0 ? 'ยังว่าง' : `${formatNumber(v)} ${unit}`);

/**
 * A value an earlier step offers for a field of this step, as a clear before → after: "ตอนนี้ ยังว่าง → 8.10 ตร.ม.
 * [ใช้ค่านี้]". Once used it says so, with "เลิกทำ" back to the value it replaced.
 */
export function SuggestedValue({ levelId, value, current, unit, onUse }: {
    /** Journey step the value comes from. */
    levelId: string;
    /** Offered value; undefined when that step has none. */
    value: number | undefined;
    current: number;
    unit: string;
    onUse: (v: number) => void;
}) {
    // The value replaced by the last "ใช้ค่านี้" (for เลิกทำ); set only by the click.
    const [previous, setPrevious] = useState<number | null>(null);
    const title = levelTitle(levelId);

    if (value === undefined) {
        return (
            <div className="mt-1 text-[12px] text-gray-400">ขั้นตอน{title}ยังไม่มีค่านี้ — กรอกเองได้</div>
        );
    }

    if (same(value, current)) {
        return (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-green-700">
                <CheckCircleFilled />
                {previous !== null && !same(previous, current)
                    ? (
                        <>
                            <span>ใช้ค่าจากขั้นตอน{title}แล้ว (เดิม {shown(previous, unit)})</span>
                            <Button type="link" size="small" className="!px-1 !h-auto" icon={<UndoOutlined />}
                                onClick={() => { onUse(previous); setPrevious(null); }}>
                                เลิกทำ
                            </Button>
                        </>
                    )
                    : <span>ตรงกับขั้นตอน{title}แล้ว</span>}
            </div>
        );
    }

    return (
        <div className="mt-1.5 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-[12px] text-gray-600">ขั้นตอน{title}มีค่าให้ใช้</span>
            <span className="flex items-center gap-2 text-[13px] tabular-nums">
                <span className="text-gray-500">ตอนนี้ {shown(current, unit)}</span>
                <ArrowRightOutlined className="text-orange-400 text-[11px]" />
                <b className="text-orange-700">{formatNumber(value)} {unit}</b>
            </span>
            <Button size="small" className="ml-auto" onClick={() => { setPrevious(current); onUse(value); }}>
                ใช้ค่านี้
            </Button>
        </div>
    );
}
