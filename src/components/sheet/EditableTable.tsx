'use client';

import type { ReactNode } from 'react';
import { Button, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { NumberCell, TextCell, SHEET_COLORS, formatNumber } from './NumberCell';

/** One column of an Excel-style input table. */
export type SheetColumn<R> =
    | { kind: 'text'; key: string; title: ReactNode; width?: number; get: (row: R) => string; set: (row: R, v: string) => R; placeholder?: string }
    | { kind: 'number'; key: string; title: ReactNode; width?: number; get: (row: R) => number; set: (row: R, v: number) => R; digits?: number; percent?: boolean }
    | { kind: 'select'; key: string; title: ReactNode; width?: number; get: (row: R) => string; set: (row: R, v: string) => R; options: { value: string; label?: string }[] }
    /** Computed (green) cell. */
    | { kind: 'calc'; key: string; title: ReactNode; width?: number; get: (row: R, index: number) => number | null; digits?: number }
    /** Read-only text (e.g. a fixed label from the Excel sheet). */
    | { kind: 'label'; key: string; title: ReactNode; width?: number; get: (row: R, index: number) => ReactNode };

interface EditableTableProps<R> {
    rows: R[];
    columns: SheetColumn<R>[];
    onChange: (rows: R[]) => void;
    /** Creates the row added by the "+ add" button. Omit to disable adding rows. */
    newRow?: (index: number) => R;
    addLabel?: string;
    /** Rows with index < lockedRows cannot be deleted (fixed Excel rows). */
    lockedRows?: number;
    canDelete?: boolean;
    footer?: ReactNode;
}

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-1 py-0.5 text-[13px] align-middle';

export function EditableTable<R>({
    rows, columns, onChange, newRow, addLabel = '+ เพิ่มรายการ', lockedRows = 0, canDelete = true, footer,
}: EditableTableProps<R>) {
    const replace = (i: number, row: R) => onChange(rows.map((r, j) => (j === i ? row : r)));

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={th} style={{ width: 36 }}>#</th>
                        {columns.map(c => <th key={c.key} className={th} style={{ width: c.width }}>{c.title}</th>)}
                        {canDelete && <th className={th} style={{ width: 36 }} />}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            <td className={`${td} text-center text-gray-500`}>{i + 1}</td>
                            {columns.map(c => {
                                switch (c.kind) {
                                    case 'text':
                                        return (
                                            <td key={c.key} className={td} style={{ background: SHEET_COLORS.input }}>
                                                <TextCell value={c.get(row)} placeholder={c.placeholder}
                                                    onCommit={v => replace(i, c.set(row, v ?? ''))} />
                                            </td>
                                        );
                                    case 'number':
                                        return (
                                            <td key={c.key} className={td}>
                                                <NumberCell value={c.get(row)} digits={c.digits} percent={c.percent}
                                                    onCommit={v => replace(i, c.set(row, v ?? 0))} />
                                            </td>
                                        );
                                    case 'select':
                                        return (
                                            <td key={c.key} className={td} style={{ background: SHEET_COLORS.input }}>
                                                <Select size="small" variant="borderless" style={{ width: '100%' }}
                                                    value={c.get(row) || undefined}
                                                    options={c.options.map(o => ({ value: o.value, label: o.label ?? o.value }))}
                                                    onChange={v => replace(i, c.set(row, v))} />
                                            </td>
                                        );
                                    case 'calc':
                                        return (
                                            <td key={c.key} className={`${td} text-right tabular-nums`} style={{ background: SHEET_COLORS.calc }}>
                                                {formatNumber(c.get(row, i), c.digits ?? 2)}
                                            </td>
                                        );
                                    case 'label':
                                        return <td key={c.key} className={td}>{c.get(row, i)}</td>;
                                }
                            })}
                            {canDelete && (
                                <td className={`${td} text-center`}>
                                    {i >= lockedRows && (
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="ลบแถว"
                                            onClick={() => onChange(rows.filter((_, j) => j !== i))} />
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
                {footer && <tfoot>{footer}</tfoot>}
            </table>
            {newRow && (
                <Button type="dashed" size="small" icon={<PlusOutlined />} className="mt-2"
                    onClick={() => onChange([...rows, newRow(rows.length)])}>
                    {addLabel.replace(/^\+\s*/, '')}
                </Button>
            )}
        </div>
    );
}
