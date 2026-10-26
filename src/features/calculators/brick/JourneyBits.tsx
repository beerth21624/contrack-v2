'use client';

// Small building blocks of the journey-mode pages of roofing, roof-structure, door-window, brick and plaster.
// (Candidates for src/components/sheet once the coordinator merges the journey pages of every calculator.)

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from 'antd';
import { ArrowRightOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { getLevel } from '@/domain/journey';
import { formatNumber } from '@/components/sheet/NumberCell';
import { LengthsCell } from '@/components/sheet/LengthsCell';

/** Friendly prompt for an empty table, with one big "add" button. */
export function EmptyPrompt({ text, addLabel, onAdd }: { text: ReactNode; addLabel: string; onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
            <div className="text-[14px] text-gray-600 max-w-xl">{text}</div>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={onAdd}>{addLabel}</Button>
        </div>
    );
}

export interface SummaryItem {
    label: string;
    value: number | undefined;
    unit: string;
    digits?: number;
}

/** Compact green summary of what the level produced. */
export function ResultSummary({ items, note, title = 'ผลลัพธ์ของด่านนี้' }: { items: SummaryItem[]; note?: ReactNode; title?: string }) {
    return (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <div className="text-[12px] font-semibold text-green-700 mb-2">{title}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                {items.map(it => (
                    <div key={it.label} className="min-w-0">
                        <div className="text-[12px] text-gray-600 truncate" title={it.label}>{it.label}</div>
                        <div className="text-[18px] font-bold tabular-nums text-gray-900 leading-tight">
                            {formatNumber(it.value ?? 0, it.digits ?? 2)} <span className="text-[12px] font-normal text-gray-500">{it.unit}</span>
                        </div>
                    </div>
                ))}
            </div>
            {note && <div className="mt-2 text-[12px] text-gray-600">{note}</div>}
        </div>
    );
}

/** Note that some values here were already filled on an earlier level (with a way back to it). */
export function FromLevel({ levelId, children }: { levelId: string; children: ReactNode }) {
    const title = getLevel(levelId)?.title ?? levelId;
    return (
        <div className="flex gap-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
            <LinkOutlined className="text-sky-500 text-[16px] mt-0.5" />
            <div className="min-w-0 flex-1 text-[13px] text-gray-800">
                <div className="text-[12px] font-semibold text-sky-700">มาจากด่าน &quot;{title}&quot;</div>
                {children}
            </div>
            <Link href={`/journey/${levelId}`} className="self-center">
                <Button size="small" type="link">ไปด่าน {title} <ArrowRightOutlined /></Button>
            </Link>
        </div>
    );
}

/**
 * A number typed like a sum of segments ("9.5+7+2"), stored as the sum (the field holds one number).
 * Empty shows the placeholder.
 */
export function SumInput({ value, onChange, ariaLabel }: { value: number; onChange: (v: number) => void; ariaLabel: string }) {
    return (
        <LengthsCell lengths={value === 0 ? [] : [value]} ariaLabel={ariaLabel}
            onChange={ls => onChange(ls.reduce((s, x) => s + x, 0))} />
    );
}

/** Small grey hint under a field label. */
export function Hint({ children }: { children: ReactNode }) {
    return <div className="text-[11px] leading-tight text-gray-500">{children}</div>;
}

/** Label + hint cell content of a journey table. */
export function LabelWithHint({ label, hint }: { label: ReactNode; hint?: ReactNode }) {
    return (
        <div className="px-1 py-0.5">
            <div className="text-[13px] text-gray-800">{label}</div>
            {hint && <Hint>{hint}</Hint>}
        </div>
    );
}

// ─── Brick type + thickness as one choice (the door-window and brick levels ask "which wall is it") ───

/** Value of the combined choice (`brick|thickness`); '' when the brick type is empty. */
export const wallTypeValue = (brick: string, thickness: string) =>
    (brick.trim() === '' ? '' : `${brick.trim()}|${thickness.trim()}`);

export function parseWallType(value: string): { brick: string; thickness: string } {
    const [brick = '', thickness = ''] = value.split('|');
    return { brick, thickness };
}

/** "อิฐมอญ ครึ่งแผ่น", … for every brick type × thickness. */
export function wallTypeOptions(bricks: readonly string[], thicknesses: readonly string[]) {
    return bricks.flatMap(b => thicknesses.map(t => ({ value: `${b}|${t}`, label: `${b} ${t}` })));
}
