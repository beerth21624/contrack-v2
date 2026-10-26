'use client';

import { useState, type ReactNode } from 'react';
import { DownOutlined, RightOutlined, SettingOutlined } from '@ant-design/icons';

/**
 * Prices, waste %, ratios and other values that come from Excel and rarely change. Folded by default inside
 * the guided journey (`defaultOpen` false) so a user filling from a plan only sees what the plan tells them.
 */
export function AdvancedSection({ title = 'ราคาและค่าตั้งต้น', hint = 'ค่าจาก Excel v5 — ไม่ต้องแก้ก็ได้', defaultOpen = false, children }: {
    title?: ReactNode; hint?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg">
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
                className="w-full flex items-center gap-2 px-4 py-2 text-left cursor-pointer bg-transparent border-0">
                <SettingOutlined className="text-gray-400" />
                <span className="font-semibold text-[13px] text-gray-700">{title}</span>
                <span className="text-[12px] text-gray-400">{hint}</span>
                <span className="ml-auto text-gray-400 text-[11px]">{open ? <DownOutlined /> : <RightOutlined />}</span>
            </button>
            {open && <div className="px-4 pb-4">{children}</div>}
        </div>
    );
}
