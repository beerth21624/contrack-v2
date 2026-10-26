'use client';

import type { ReactNode } from 'react';
import { AutoComplete, Select } from 'antd';
import type { CalculatorDef } from '@/domain/calculators/types';
import {
    emptyPickRow, pickRowCalc, selectItem, type Catalogue, type PickListInput, type PickRow,
} from '@/domain/calculators/shared/pick-list';
import { EditableTable } from '@/components/sheet/EditableTable';
import { NumberCell, SHEET_COLORS } from '@/components/sheet/NumberCell';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

interface PickListPageProps {
    def: CalculatorDef<PickListInput>;
    catalogue: Catalogue;
    /** The sheet's รายการ dropdown options, verbatim, in Excel order. */
    options: readonly string[];
    /** The sheet's หน่วย dropdown options (free text is always allowed). */
    units?: readonly string[];
    /** Allow typing an item that is not in the dropdown (e.g. งานเบ็ดเตล็ด). */
    allowFreeText?: boolean;
    title: string;
    notes?: ReactNode;
}

/** Page for an Excel pick-list sheet: รายการ (dropdown) / จำนวน / หน่วย, one BOQ row per listed item. */
export function PickListPage({ def, catalogue, options, units = [], allowFreeText, title, notes }: PickListPageProps) {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(def);
    const setRow = (i: number, row: PickRow) => update(p => ({ ...p, items: p.items.map((r, j) => (j === i ? row : r)) }));
    const itemOptions = options.map(o => ({ value: o, label: o.trim() }));

    return (
        <CalculatorShell def={def} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={title}>
                <EditableTable<PickRow>
                    rows={input.items}
                    onChange={items => update({ items })}
                    newRow={emptyPickRow}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        {
                            kind: 'label', key: 'item', title: 'รายการ',
                            get: (r, i) => (
                                <div style={{ background: SHEET_COLORS.input, borderRadius: 3, minWidth: 260 }}>
                                    {allowFreeText
                                        ? (
                                            <AutoComplete size="small" variant="borderless" style={{ width: '100%' }}
                                                value={r.item} options={itemOptions} placeholder="เลือกหรือพิมพ์รายการ"
                                                onChange={v => setRow(i, selectItem(r, v, catalogue))} />
                                        )
                                        : (
                                            <Select size="small" variant="borderless" style={{ width: '100%' }} allowClear
                                                value={r.item === '' ? undefined : r.item} options={itemOptions} placeholder="เลือกรายการ"
                                                onChange={(v: string | undefined) => setRow(i, selectItem(r, v ?? '', catalogue))} />
                                        )}
                                </div>
                            ),
                        },
                        { kind: 'number', key: 'qty', title: 'จำนวน', width: 90, get: r => r.qty, set: (r, v) => ({ ...r, qty: v }) },
                        {
                            kind: 'label', key: 'unit', title: 'หน่วย', width: 110,
                            get: (r, i) => (
                                <div style={{ background: SHEET_COLORS.input, borderRadius: 3 }}>
                                    <AutoComplete size="small" variant="borderless" style={{ width: '100%' }}
                                        value={r.unit || pickRowCalc(r, catalogue).unit}
                                        options={units.map(u => ({ value: u }))}
                                        onChange={v => setRow(i, { ...r, unit: v })} />
                                </div>
                            ),
                        },
                        {
                            kind: 'label', key: 'mat', title: 'ค่าวัสดุ / หน่วย', width: 120,
                            get: (r, i) => (
                                <NumberCell value={pickRowCalc(r, catalogue).mat} edited={r.mat !== null}
                                    tone={r.mat === null ? 'calc' : 'input'}
                                    onCommit={v => setRow(i, { ...r, mat: v ?? null })} ariaLabel="ค่าวัสดุต่อหน่วย" />
                            ),
                        },
                        {
                            kind: 'label', key: 'lab', title: 'ค่าแรง / หน่วย', width: 120,
                            get: (r, i) => (
                                <NumberCell value={pickRowCalc(r, catalogue).lab} edited={r.lab !== null}
                                    tone={r.lab === null ? 'calc' : 'input'}
                                    onCommit={v => setRow(i, { ...r, lab: v ?? null })} ariaLabel="ค่าแรงต่อหน่วย" />
                            ),
                        },
                        { kind: 'calc', key: 'total', title: 'รวม', width: 120, get: r => pickRowCalc(r, catalogue).total },
                    ]}
                />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label="รวมค่าวัสดุ" value={outputs.mat} unit="บาท" />
                    <CalcField label="รวมค่าแรง" value={outputs.lab} unit="บาท" />
                    <CalcField label="รวมทั้งหมด" value={outputs.total} unit="บาท" strong />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    ราคาสีเขียว = ราคาตั้งต้นของรายการ (จาก BOQ ใน Excel) — พิมพ์ทับเพื่อใช้ราคาของโครงการนี้, ลบค่าเพื่อกลับไปใช้ราคาตั้งต้น.
                    ทุกรายการที่มีจำนวน &gt; 0 จะเป็น 1 แถวใน BOQ.
                </p>
                {notes}
            </SheetCard>
        </CalculatorShell>
    );
}
