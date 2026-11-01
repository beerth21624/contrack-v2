'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { DownOutlined, RightOutlined, SettingOutlined } from '@ant-design/icons';

/**
 * Prices, waste %, ratios and other values that come from Excel and rarely change. Folded by default inside
 * the guided journey (`defaultOpen` false) so a user filling from a plan only sees what the plan tells them.
 */
export function AdvancedSection({ title, hint, defaultOpen = false, children }: {
    title?: ReactNode; hint?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
    const t = useTranslations('sheet');
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white border border-dashed border-gray-300 rounded-card">
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
                className="w-full flex items-center gap-2 min-h-[44px] px-4 sm:px-5 py-2 text-left cursor-pointer bg-transparent border-0">
                <SettingOutlined className="text-gray-400 shrink-0" />
                <span className="font-semibold text-[13px] text-gray-700">{title ?? t('advanced.title')}</span>
                <span className="min-w-0 text-[12px] text-gray-400 truncate">{hint ?? t('advanced.hint')}</span>
                <span className="ml-auto shrink-0 flex items-center text-gray-400 text-[11px]">{open ? <DownOutlined /> : <RightOutlined />}</span>
            </button>
            {open && <div className="px-4 sm:px-5 pb-4 sm:pb-5">{children}</div>}
        </div>
    );
}
