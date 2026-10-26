'use client';

import { TextCell } from '@/components/sheet/NumberCell';

/**
 * The editable name of a plan card ("ห้องนอน 1", "ห้องน้ำ 2" …), sized for a card title: a light box that shows it
 * can be typed in. Commits trimmed text ('' when cleared).
 */
export function NameInput({ value, onChange, placeholder, ariaLabel }: {
    value: string; onChange: (v: string) => void; placeholder: string; ariaLabel: string;
}) {
    return (
        <span className="block w-full max-w-[280px] rounded-md border border-gray-200 bg-white font-semibold text-[14px] hover:border-orange-300">
            <TextCell value={value} placeholder={placeholder} ariaLabel={ariaLabel} onCommit={v => onChange((v ?? '').trim())} />
        </span>
    );
}
