'use client';

import { PlusOutlined } from '@ant-design/icons';

/**
 * "เพิ่มด่วน: ห้องนอน · ครัว · ห้องน้ำ …" — one click adds a named row (the page picks the name and the usual type).
 * The plain "เพิ่ม…" button stays the main way in; these only save typing. Use sparingly (restraint first).
 */
export function QuickAddChips({ items, onAdd, label = 'เพิ่มด่วน' }: {
    items: readonly { key: string; label: string; hint?: string }[];
    onAdd: (key: string) => void;
    label?: string;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
            <span className="text-[12px] text-gray-500 mr-0.5">{label}</span>
            {items.map(it => (
                <button key={it.key} type="button" title={it.hint} onClick={() => onAdd(it.key)}
                    className="inline-flex items-center gap-1 min-h-[30px] px-2.5 rounded-full border border-dashed border-gray-300 bg-white
                        text-[12px] text-gray-700 cursor-pointer transition hover:border-orange-400 hover:text-orange-700">
                    <PlusOutlined className="text-[10px]" />{it.label}
                </button>
            ))}
        </div>
    );
}
