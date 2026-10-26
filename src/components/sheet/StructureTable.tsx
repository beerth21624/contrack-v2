'use client';

// Excel-style element table for the structural take-off sheets (ฐานราก, เสาตอม่อ): a band row (sheet row 3),
// group headers (row 4), bar-size sub-headers (row 5), the totals row ">>" (row 6), column headers (row 7)
// and one editable row per element. Used by the footing and pedestal pages.
import type { ReactNode } from 'react';
import { Button, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';

export type StructColumn<R> =
    | { kind: 'number'; key: string; title: ReactNode; width?: number; get: (row: R) => number; set: (row: R, v: number) => R; digits?: number; sub?: ReactNode; total?: ReactNode }
    | {
        kind: 'select'; key: string; title: ReactNode; width?: number; get: (row: R) => string | number | undefined;
        set: (row: R, v: string | number | undefined) => R; options: { value: string | number; label?: string }[];
        placeholder?: string; allowClear?: boolean; sub?: ReactNode; total?: ReactNode;
    }
    /** Computed (green) cell; null shows "-" like Excel's IFERROR(…,"-"). */
    | { kind: 'calc'; key: string; title: ReactNode; width?: number; get: (row: R, index: number) => number | null; digits?: number; sub?: ReactNode; total?: ReactNode };

export interface StructGroup<R> {
    /** Sheet row 3 label; consecutive groups with the same band share one cell. */
    band?: string;
    title: ReactNode;
    /** Header colour (Excel fill of the group). */
    color: string;
    columns: StructColumn<R>[];
    /** Total spanning the whole group (Excel's merged ">>" cell, e.g. H6:I6). */
    total?: ReactNode;
}

/** Excel header fills of the structural sheets. */
export const GROUP_COLORS = {
    info: '#f2f2f2',     // FFF2F2F2
    base: '#cfe2f3',     // FFCFE2F3 ดินขุด / ทราย / คอนกรีตหยาบ
    rebar: '#fce5cd',    // FFFCE5CD เหล็กเสริม
    concrete: '#e6b8af', // FFE6B8AF ไม้แบบ / คอนกรีต
    fill: '#d9ead3',     // FFD9EAD3 ถมดิน
} as const;

const th = 'border border-gray-300 px-1.5 py-1 text-[11px] font-semibold text-gray-700 text-center leading-tight';
const td = 'border border-gray-200 px-1 py-0.5 text-[12px] align-middle';

/** A green total value as shown on sheet row 6. */
export function TotalValue({ value, digits = 2 }: { value: number | null | undefined; digits?: number }) {
    return <span className="tabular-nums font-semibold text-blue-700">{formatNumber(value ?? 0, digits)}</span>;
}

interface StructureTableProps<R> {
    rows: R[];
    groups: StructGroup<R>[];
    onChange: (rows: R[]) => void;
    newRow?: (index: number) => R;
    addLabel?: string;
    /** Rows with index < lockedRows cannot be deleted. */
    lockedRows?: number;
}

export function StructureTable<R>({ rows, groups, onChange, newRow, addLabel = 'เพิ่มแถว', lockedRows = 0 }: StructureTableProps<R>) {
    const replace = (i: number, row: R) => onChange(rows.map((r, j) => (j === i ? row : r)));
    const hasBand = groups.some(g => g.band);
    const hasSub = groups.some(g => g.columns.some(c => c.sub !== undefined));
    const hasTotal = groups.some(g => g.total !== undefined || g.columns.some(c => c.total !== undefined));
    /** A group with neither sub-headers nor totals spans the group, sub and totals rows (Excel A4:F6). */
    const tall = (g: StructGroup<R>) => g.total === undefined && g.columns.every(c => c.sub === undefined && c.total === undefined);
    const preRows = 1 + (hasSub ? 1 : 0) + (hasTotal ? 1 : 0);

    // Band row: runs of consecutive groups with the same band.
    const bands: { label?: string; span: number }[] = [];
    for (const g of groups) {
        const last = bands[bands.length - 1];
        if (last && g.band && last.label === g.band) last.span += g.columns.length;
        else bands.push({ label: g.band, span: g.columns.length });
    }

    return (
        <div className="overflow-x-auto">
            <table className="border-collapse" style={{ minWidth: '100%' }}>
                <thead>
                    {hasBand && (
                        <tr>
                            <th className="px-1" />
                            {bands.map((b, i) => (
                                <th key={i} colSpan={b.span} className="px-1 py-0.5 text-[12px] font-semibold text-gray-400 text-center">
                                    {b.label}
                                </th>
                            ))}
                            <th />
                        </tr>
                    )}
                    <tr>
                        <th className={th} rowSpan={preRows} style={{ background: GROUP_COLORS.info, width: 32 }} />
                        {groups.map((g, i) => (
                            <th key={i} className={th} colSpan={g.columns.length} rowSpan={tall(g) ? preRows : 1} style={{ background: g.color }}>
                                {g.title}
                            </th>
                        ))}
                        <th rowSpan={preRows + 1} style={{ width: 32 }} />
                    </tr>
                    {hasSub && (
                        <tr>
                            {groups.filter(g => !tall(g)).flatMap(g => g.columns.map(c => (
                                <th key={c.key} className={th} style={{ background: g.color }}>{c.sub}</th>
                            )))}
                        </tr>
                    )}
                    {hasTotal && (
                        <tr>
                            {groups.filter(g => !tall(g)).flatMap(g => (g.total !== undefined
                                ? [<th key={`${g.columns[0]?.key ?? ''}-total`} className={th} colSpan={g.columns.length} style={{ background: SHEET_COLORS.calc }}>{g.total}</th>]
                                : g.columns.map(c => (
                                    <th key={c.key} className={th} style={{ background: c.total !== undefined ? SHEET_COLORS.calc : g.color }}>{c.total}</th>
                                ))))}
                        </tr>
                    )}
                    <tr>
                        <th className={th} style={{ background: GROUP_COLORS.info }}>ลำดับ</th>
                        {groups.flatMap(g => g.columns.map(c => (
                            <th key={c.key} className={th} style={{ background: GROUP_COLORS.info, minWidth: c.width ?? 72 }}>{c.title}</th>
                        )))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            <td className={`${td} text-center text-gray-500`}>{i + 1}</td>
                            {groups.flatMap(g => g.columns.map(c => {
                                switch (c.kind) {
                                    case 'number':
                                        return (
                                            <td key={c.key} className={td}>
                                                <NumberCell value={c.get(row)} digits={c.digits} ariaLabel={`${c.key} ${i + 1}`}
                                                    onCommit={v => replace(i, c.set(row, v ?? 0))} />
                                            </td>
                                        );
                                    case 'select': {
                                        const v = c.get(row);
                                        const known = c.options.some(o => o.value === v);
                                        // A value typed elsewhere (e.g. "F3" from the journey) stays visible even if not in the Excel list.
                                        const extra = !known && v !== undefined && v !== '' ? [{ value: v, label: String(v) }] : [];
                                        return (
                                            <td key={c.key} className={td} style={{ background: SHEET_COLORS.input }}>
                                                <Select size="small" variant="borderless" style={{ width: '100%' }}
                                                    value={v === '' ? undefined : v} placeholder={c.placeholder} allowClear={c.allowClear}
                                                    options={[...extra, ...c.options.map(o => ({ value: o.value, label: o.label ?? String(o.value) }))]}
                                                    onChange={(nv: string | number | undefined) => replace(i, c.set(row, nv))} />
                                            </td>
                                        );
                                    }
                                    case 'calc': {
                                        const v = c.get(row, i);
                                        return (
                                            <td key={c.key} className={`${td} text-right tabular-nums`} style={{ background: SHEET_COLORS.calc }}>
                                                {v === null ? '-' : formatNumber(v, c.digits ?? 2)}
                                            </td>
                                        );
                                    }
                                }
                            }))}
                            <td className={`${td} text-center`}>
                                {i >= lockedRows && (
                                    <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="ลบแถว"
                                        onClick={() => onChange(rows.filter((_, j) => j !== i))} />
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {newRow && (
                <Button type="dashed" size="small" icon={<PlusOutlined />} className="mt-2"
                    onClick={() => onChange([...rows, newRow(rows.length)])}>
                    {addLabel}
                </Button>
            )}
        </div>
    );
}
