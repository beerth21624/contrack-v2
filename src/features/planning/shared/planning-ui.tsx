'use client';

// Building blocks shared by the three planning pages (Man-Day, S-Curve, CashFlow).
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Button, Collapse, DatePicker, Popconfirm, Tag, Typography } from 'antd';
import { RightOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useProjectStore } from '@/store/project-store';
import { computeProject, projectPlanningInput } from '@/domain/project';
import { type WeekBucket } from '@/domain/planning';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';

const { Title, Text } = Typography;

/** The project, its computed result and the resolved planning input (every field filled from the Excel sample). */
export function usePlanning() {
    const project = useProjectStore(s => s.project);
    const setPlanning = useProjectStore(s => s.setPlanning);
    const result = useMemo(() => computeProject(project), [project]);
    const input = useMemo(() => projectPlanningInput(project), [project]);
    return { project, result, planning: result.planning, input, stored: project.planning ?? {}, setPlanning };
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' (empty for null). */
export function formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** 'YYYY-MM-DD' → 'dd/mm'. */
export function formatDayMonth(iso: string | null | undefined): string {
    return formatDate(iso).slice(0, 5);
}

/** "W3 มี.ค.-26". */
export function bucketLabel(b: WeekBucket | undefined): string {
    return b ? `${b.weekLabel} ${b.monthLabel}` : '';
}

/** "16/03–22/03/2026". */
export function bucketRange(b: WeekBucket | undefined): string {
    return b ? `${formatDayMonth(b.start)}–${formatDate(b.end)}` : '';
}

export const money = (v: number | null | undefined) => formatNumber(v, 0);

/** Week buckets as Select options ("W1 ม.ค.-26 · 01/01–07/01/2026"). */
export function bucketOptions(buckets: WeekBucket[]): { value: string; label: string }[] {
    return buckets.map(b => ({ value: String(b.index), label: `${bucketLabel(b)} · ${bucketRange(b)}` }));
}

const STEPS = [
    { href: '/man-day', label: '1. คน-วัน (Man-Day)' },
    { href: '/schedule', label: '2. แผนงาน (S-Curve)' },
    { href: '/cashflow', label: '3. กระแสเงินสด (Cash Flow)' },
] as const;

/** Page header: the planning steps, the title, the Excel sheet name and "back to the Excel sample". */
export function PlanningHeader({ current, title, sheetName, isDefault, onReset }: {
    current: (typeof STEPS)[number]['href'];
    title: string;
    sheetName: string;
    isDefault: boolean;
    onReset: () => void;
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-card p-4 shadow-card flex flex-col gap-3">
            <nav aria-label="ขั้นตอนวางแผน" className="flex flex-wrap items-center gap-1 text-[12px]">
                {STEPS.map((s, i) => (
                    <span key={s.href} className="flex items-center gap-1">
                        {i > 0 && <RightOutlined className="text-gray-300 text-[10px]" />}
                        {s.href === current
                            ? <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white font-semibold">{s.label}</span>
                            : <Link href={s.href} className="px-2 py-0.5 rounded-full text-gray-600 hover:bg-orange-50">{s.label}</Link>}
                    </span>
                ))}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0">
                    <Title level={4} style={{ margin: 0 }}>{title}</Title>
                    <Text type="secondary" className="text-[12px] [overflow-wrap:anywhere]">ชีต Excel: {sheetName}</Text>
                </div>
                <div className="ml-auto">
                    {isDefault
                        ? <Tag>ค่าตัวอย่างจาก Excel</Tag>
                        : (
                            <Popconfirm title="คืนค่าตัวอย่างจาก Excel ของหน้านี้?" okText="คืนค่า" cancelText="ยกเลิก" onConfirm={onReset}>
                                <Button icon={<UndoOutlined />}>คืนค่าตัวอย่าง</Button>
                            </Popconfirm>
                        )}
                </div>
            </div>
        </div>
    );
}

/**
 * Shown while the BOQ has no money yet (a new project): the planning pages are computed from BOQ prices, so their
 * numbers stay 0 until the BOQ steps are filled. Nothing is shown once there is a construction total.
 */
export function NoBoqYet({ constructionTotal }: { constructionTotal: number }) {
    if (constructionTotal !== 0) return null;
    return (
        <Alert type="info" showIcon title="ยังไม่มีมูลค่างานใน BOQ"
            description={(
                <span>
                    หน้านี้คำนวณจากค่าแรงและราคาใน BOQ — กรอกขั้นตอนจัดทำ BOQ ก่อน แล้วตัวเลขจะขึ้นให้เอง{' '}
                    <Link href="/journey" className="text-blue-600 hover:underline">ไปที่ขั้นตอนจัดทำ BOQ</Link>
                </span>
            )} />
    );
}

/** The plain-language summary that leads each page. */
export function SummaryBanner({ headline, children }: { headline: ReactNode; children?: ReactNode }) {
    return (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
            <div className="text-[18px] font-semibold text-gray-900 leading-snug">{headline}</div>
            {children && <div className="mt-1 text-[13px] text-gray-700 flex flex-col gap-0.5">{children}</div>}
        </div>
    );
}

/** One number with its label (a green Excel result shown as a tile). */
export function StatTile({ label, value, unit, hint, tone = 'default' }: {
    label: ReactNode; value: ReactNode; unit?: string; hint?: ReactNode; tone?: 'default' | 'good' | 'bad';
}) {
    const color = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900';
    return (
        <div className="rounded-card border border-gray-200 bg-white shadow-card px-4 sm:px-5 py-3 min-w-0 h-full">
            <div className="text-[12px] text-gray-500 leading-tight">{label}</div>
            <div className={`text-[18px] font-semibold leading-tight mt-0.5 ${color}`}>
                {value}{unit && <span className="ml-1 text-[12px] font-normal text-gray-500">{unit}</span>}
            </div>
            {hint && <div className="text-[12px] text-gray-400 mt-0.5 leading-tight">{hint}</div>}
        </div>
    );
}

/** Folded section for the big Excel grids ("ดูตารางละเอียด"). */
export function DetailSection({ label = 'ดูตารางละเอียด', extra, children, defaultOpen = false }: {
    label?: ReactNode; extra?: ReactNode; children: ReactNode; defaultOpen?: boolean;
}) {
    return (
        <Collapse
            size="small"
            className="bg-white"
            defaultActiveKey={defaultOpen ? ['d'] : []}
            items={[{ key: 'd', label: <span className="text-[13px] font-medium text-gray-700">{label}</span>, extra, children }]}
        />
    );
}

/** Yellow date input (ISO in/out). Clearing commits undefined. */
export function DateCell({ value, onCommit, ariaLabel, allowClear = true }: {
    value: string | null | undefined; onCommit: (iso: string | undefined) => void; ariaLabel?: string; allowClear?: boolean;
}) {
    return (
        <DatePicker
            size="small"
            variant="borderless"
            format="DD/MM/YYYY"
            aria-label={ariaLabel}
            allowClear={allowClear}
            value={value ? dayjs(value) : null}
            onChange={d => onCommit(d ? d.format('YYYY-MM-DD') : undefined)}
            style={{ width: '100%', minWidth: 118, height: 32, background: SHEET_COLORS.input, borderRadius: 4 }}
        />
    );
}

/**
 * Yellow number input that may be empty (the ACTUAL cells of the S-Curve). Commits on Enter/blur;
 * an empty cell commits undefined. Same look as the sheet NumberCell.
 */
export function OptionalNumberCell({ value, onCommit, digits = 0, percent, ariaLabel }: {
    value: number | null | undefined; onCommit: (v: number | undefined) => void; digits?: number; percent?: boolean; ariaLabel?: string;
}) {
    const [text, setText] = useState<string | null>(null);
    const has = value !== null && value !== undefined && Number.isFinite(value);
    const shown = has ? (percent ? value * 100 : value) : null;
    const display = shown === null ? '' : percent ? `${formatNumber(shown, 0)}%` : formatNumber(shown, digits);
    const commit = () => {
        if (text === null) return;
        const t = text.replace(/,/g, '').replace(/%$/, '').trim();
        if (t === '') { if (has) onCommit(undefined); }
        else {
            const n = Number(t);
            if (Number.isFinite(n) && n !== shown) onCommit(percent ? n / 100 : n);
        }
        setText(null);
    };
    return (
        <input
            aria-label={ariaLabel}
            inputMode="decimal"
            value={text ?? display}
            onFocus={e => { setText(shown === null ? '' : String(Number(shown.toFixed(6)))); const el = e.target; requestAnimationFrame(() => el.select()); }}
            onChange={e => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') { setText(null); e.currentTarget.blur(); }
            }}
            style={{
                width: '100%', minWidth: 0, textAlign: 'right', border: '1px solid transparent', background: SHEET_COLORS.input,
                padding: '0 6px', borderRadius: 4, font: 'inherit',
            }}
            className="sheet-cell focus:outline-none focus:border-orange-400"
        />
    );
}

/** Green read-only value inside a table cell. */
export function CalcText({ children, strong }: { children: ReactNode; strong?: boolean }) {
    return (
        <span className="block text-right tabular-nums px-1 py-0.5 rounded-sm whitespace-nowrap"
            style={{ background: SHEET_COLORS.calc, fontWeight: strong ? 600 : 400 }}>{children}</span>
    );
}

/**
 * Buckets worth drawing in a summary view: whole months up to the last bucket where any series is non-zero
 * (the Excel axis is 12 months long even when the plan ends in May).
 */
export function usedBucketCount(buckets: WeekBucket[], ...series: number[][]): number {
    let last = -1;
    for (const s of series) s.forEach((v, i) => { if (Math.abs(v) > 1e-12 && i > last) last = i; });
    if (last < 0) return Math.min(buckets.length, 20);
    const month = buckets[last]?.monthIndex ?? 0;
    return Math.min(buckets.length, (month + 1) * 4);
}

/** S-Curve installment header colours (Excel rows 13, 28, 39, 46, 51, 56, 67, 72) and a readable text colour. */
const INSTALLMENT_FILLS = ['#118AB2', '#06D6A0', '#FF9B54', '#EF476F', '#0B5394', '#76A5AF', '#0B5394', '#6D9EEB'];
const DARK_TEXT = new Set(['#06D6A0', '#FF9B54', '#76A5AF', '#6D9EEB']);
export function installmentColors(no: number): { background: string; color: string } {
    const bg = INSTALLMENT_FILLS[(no - 1 + INSTALLMENT_FILLS.length) % INSTALLMENT_FILLS.length] ?? '#118AB2';
    return { background: bg, color: DARK_TEXT.has(bg) ? '#1f2937' : '#ffffff' };
}

/** Table cell class names shared by the planning grids. */
export const cls = {
    th: 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center whitespace-nowrap',
    td: 'border border-gray-200 px-1 py-0.5 text-[13px] align-middle',
    num: 'border border-gray-200 px-1 py-0.5 text-[12px] align-middle text-right tabular-nums whitespace-nowrap',
};
