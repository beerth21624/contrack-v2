'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from 'antd';
import { ArrowRightOutlined, LinkOutlined } from '@ant-design/icons';
import { levelHref, levelTitle } from './levelRef';

/** "จากขั้นตอน…" note: values on this level that were filled on an earlier level, with a way back to it. */
export function FromLevel({ levelId, children }: { levelId: string; children: ReactNode }) {
    const title = levelTitle(levelId);
    return (
        <div className="flex gap-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
            <LinkOutlined className="text-sky-500 text-[16px] mt-0.5" />
            <div className="min-w-0 flex-1 text-[13px] text-gray-800">
                <div className="text-[12px] font-semibold text-sky-700">จากขั้นตอน{title}</div>
                {children}
            </div>
            <Link href={levelHref(levelId)} className="self-center">
                <Button size="small" type="link">ไปที่ขั้นตอน{title} <ArrowRightOutlined /></Button>
            </Link>
        </div>
    );
}
