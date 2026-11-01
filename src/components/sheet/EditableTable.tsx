'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { NumberCell, TextCell, SHEET_COLORS, formatNumber } from './NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';

/** One column of an Excel-style input table. */
export type SheetColumn<R> =
    | { kind: 'text'; key: string; title: ReactNode; width?: number; get: (row: R) => string; set: (row: R, v: string) => R; placeholder?: string }
    | { kind: 'number'; key: string; title: ReactNode; width?: number; get: (row: R) => number; set: (row: R, v: number) => R; digits?: number; percent?: boolean }
    | {
        kind: 'select'; key: string; title: ReactNode; width?: number; get: (row: R) => string; set: (row: R, v: string) => R;
        /** label = what the dropdown lists; selectedLabel = a shorter text shown in the cell (default: label). */
        options: { value: string; label?: ReactNode; selectedLabel?: ReactNode }[];
        /** Minimum width of the dropdown when its options need more room than the cell. */
        popupWidth?: number;
    }
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
/** Width of the row-number column (also the left offset of a sticky first column). */
const NO_WIDTH = 36;

export function EditableTable<R>({
    rows, columns, onChange, newRow, addLabel, lockedRows = 0, canDelete = true, footer,
}: EditableTableProps<R>) {
    const t = useTranslations('sheet');
    const replace = (i: number, row: R) => onChange(rows.map((r, j) => (j === i ? row : r)));
    // Inside the journey an unfilled plan value shows as an empty cell, not "0.00".
    const inJourney = useJourneyMode();
    // Columns keep their widths (a long dropdown must not squeeze the number cells); the table scrolls instead.
    const minWidth = columns.reduce((s, c) => s + (c.width ?? 90), 36 + 40);
    // When the table scrolls sideways (tablet, the /calc split view) the row number and the item name stay in
    // view. Not on phones: there the name column would take most of the screen.
    const stickyKey = columns[0] !== undefined && columns[0].kind !== 'number' && columns[0].kind !== 'calc' ? columns[0].key : undefined;
    const stickyNo = stickyKey !== undefined ? 'sm:sticky sm:left-0 sm:z-[1]' : '';
    const stickyCol = (key: string) => (key === stickyKey ? 'sm:sticky sm:z-[1] sm:shadow-[1px_0_0_#e5e7eb]' : '');
    const stickyLeft = (key: string) => (key === stickyKey ? { left: NO_WIDTH } : undefined);

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth }}>
                <thead>
                    <tr>
                        <th className={`${th} ${stickyNo}`} style={{ width: NO_WIDTH, minWidth: NO_WIDTH }}>#</th>
                        {columns.map(c => (
                            <th key={c.key} className={`${th} ${stickyCol(c.key)}`} style={{ width: c.width, ...stickyLeft(c.key) }}>{c.title}</th>
                        ))}
                        {canDelete && <th className={th} style={{ width: 36 }} />}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            <td className={`${td} text-center text-gray-500 bg-white ${stickyNo}`}>{i + 1}</td>
                            {columns.map(c => {
                                switch (c.kind) {
                                    case 'text':
                                        return (
                                            <td key={c.key} className={`${td} ${stickyCol(c.key)}`} style={{ background: SHEET_COLORS.input, ...stickyLeft(c.key) }}>
                                                <TextCell value={c.get(row)} placeholder={c.placeholder}
                                                    onCommit={v => replace(i, c.set(row, v ?? ''))} />
                                            </td>
                                        );
                                    case 'number':
                                        return (
                                            <td key={c.key} className={td}>
                                                <NumberCell value={c.get(row)} digits={c.digits} percent={c.percent}
                                                    blankZero={inJourney && c.percent !== true} ariaLabel={typeof c.title === 'string' ? c.title : undefined}
                                                    onCommit={v => replace(i, c.set(row, v ?? 0))} />
                                            </td>
                                        );
                                    case 'select':
                                        return (
                                            <td key={c.key} className={`${td} ${stickyCol(c.key)}`} style={{ background: SHEET_COLORS.input, ...stickyLeft(c.key) }}>
                                                <Select size="small" variant="borderless" style={{ width: '100%' }}
                                                    aria-label={typeof c.title === 'string' ? c.title : undefined}
                                                    value={c.get(row) || undefined}
                                                    options={c.options.map(o => ({ value: o.value, label: o.label ?? o.value }))}
                                                    labelRender={({ value, label }) => c.options.find(o => o.value === value)?.selectedLabel ?? label}
                                                    popupMatchSelectWidth={c.popupWidth ?? true}
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
                                        return <td key={c.key} className={`${td} bg-white ${stickyCol(c.key)}`} style={stickyLeft(c.key)}>{c.get(row, i)}</td>;
                                }
                            })}
                            {canDelete && (
                                <td className={`${td} text-center`}>
                                    {i >= lockedRows && (
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('table.deleteRow')}
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
                    {(addLabel ?? t('table.addItem')).replace(/^\+\s*/, '')}
                </Button>
            )}
        </div>
    );
}
