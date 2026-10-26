'use client';

import type { ReactNode } from 'react';
import { AutoComplete, Button, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { CalculatorDef } from '@/domain/calculators/types';
import {
    catalogueItem, emptyPickRow, needsPrice, pickRowCalc, qtyDigits, selectItem, setOptionQty, splitByOption,
    type Catalogue, type PickListInput, type PickRow,
} from '@/domain/calculators/shared/pick-list';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { EditableTable } from '@/components/sheet/EditableTable';
import { NumberCell, SHEET_COLORS } from '@/components/sheet/NumberCell';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { EmptyState, ResultSummary, blankIfZero } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

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
    /** Notes under the sheet table (full /calc view only). */
    notes?: ReactNode;
    /** Notes for the guided journey (plain words, no Excel/BOQ references); `notes` is not shown there. */
    journeyNotes?: ReactNode;
}

type Calc = UseCalculator<PickListInput>;

/** Page for an Excel pick-list sheet: รายการ (dropdown) / จำนวน / หน่วย, one BOQ row per listed item. */
export function PickListPage(props: PickListPageProps) {
    const calc = useCalculator(props.def);
    const inJourney = useJourneyMode();
    const { result, isDefault, reset } = calc;

    return (
        <CalculatorShell def={props.def} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyPickList {...props} calc={calc} /> : <SheetPickList {...props} calc={calc} />}
        </CalculatorShell>
    );
}

const itemOptionsOf = (options: readonly string[]) => options.map(o => ({ value: o, label: o.trim() }));

/** รายการ cell: dropdown, or dropdown + free text. */
function ItemCell({ row, options, allowFreeText, catalogue, onChange, placeholder }: {
    row: PickRow; options: readonly string[]; allowFreeText?: boolean; catalogue: Catalogue;
    onChange: (row: PickRow) => void; placeholder?: string;
}) {
    const itemOptions = itemOptionsOf(options);
    return (
        <div style={{ background: SHEET_COLORS.input, borderRadius: 3, minWidth: 260 }}>
            {allowFreeText
                ? (
                    <AutoComplete size="small" variant="borderless" style={{ width: '100%' }}
                        value={row.item} options={itemOptions} placeholder={placeholder ?? 'เลือกหรือพิมพ์รายการ'}
                        onChange={v => onChange(selectItem(row, v, catalogue))} />
                )
                : (
                    <Select size="small" variant="borderless" style={{ width: '100%' }} allowClear
                        value={row.item === '' ? undefined : row.item} options={itemOptions} placeholder={placeholder ?? 'เลือกรายการ'}
                        onChange={(v: string | undefined) => onChange(selectItem(row, v ?? '', catalogue))} />
                )}
        </div>
    );
}

/** หน่วย cell: the row's own unit (placeholder = the catalogue unit), so it can be cleared and retyped. */
function UnitCell({ row, units, catalogue, onChange }: {
    row: PickRow; units: readonly string[]; catalogue: Catalogue; onChange: (row: PickRow) => void;
}) {
    return (
        <div style={{ background: SHEET_COLORS.input, borderRadius: 3 }}>
            <AutoComplete size="small" variant="borderless" style={{ width: '100%' }}
                value={row.unit} placeholder={pickRowCalc(row, catalogue).unit}
                options={units.map(u => ({ value: u }))}
                onChange={v => onChange({ ...row, unit: v })} />
        </div>
    );
}

function QtyCell({ row, catalogue, onChange, ariaLabel, blankZero }: {
    row: PickRow; catalogue: Catalogue; onChange: (qty: number) => void; ariaLabel?: string; blankZero?: boolean;
}) {
    return (
        <NumberCell value={row.qty} digits={qtyDigits(row.qty, pickRowCalc(row, catalogue).unit)} blankZero={blankZero}
            onCommit={v => onChange(v ?? 0)} ariaLabel={ariaLabel ?? 'จำนวน'} />
    );
}

/** Material / labour price per unit: green = catalogue price, yellow = typed for this project. */
function PriceCell({ row, field, catalogue, onChange, highlight, blankZero }: {
    row: PickRow; field: 'mat' | 'lab'; catalogue: Catalogue; onChange: (row: PickRow) => void; highlight?: boolean; blankZero?: boolean;
}) {
    const typed = row[field];
    const cell = (
        <NumberCell value={pickRowCalc(row, catalogue)[field]} edited={typed !== null} blankZero={blankZero}
            tone={typed === null ? 'calc' : 'input'}
            onCommit={v => onChange({ ...row, [field]: v ?? null })}
            ariaLabel={field === 'mat' ? 'ค่าวัสดุต่อหน่วย' : 'ค่าแรงต่อหน่วย'} />
    );
    if (!highlight) return cell;
    return (
        <div className="rounded ring-2 ring-orange-400" title="ยังไม่มีราคา — พิมพ์ราคาต่อหน่วย">
            {cell}
        </div>
    );
}

/** The full Excel-mirror view (/calc). */
function SheetPickList({ catalogue, options, units = [], allowFreeText, title, notes, calc }: PickListPageProps & { calc: Calc }) {
    const { input, update, outputs } = calc;
    const setRow = (i: number, row: PickRow) => update(p => ({ ...p, items: p.items.map((r, j) => (j === i ? row : r)) }));

    return (
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
                            <ItemCell row={r} options={options} allowFreeText={allowFreeText} catalogue={catalogue}
                                onChange={row => setRow(i, row)} />
                        ),
                    },
                    {
                        kind: 'label', key: 'qty', title: 'จำนวน', width: 90,
                        get: (r, i) => <QtyCell row={r} catalogue={catalogue} onChange={qty => setRow(i, { ...r, qty })} />,
                    },
                    {
                        kind: 'label', key: 'unit', title: 'หน่วย', width: 110,
                        get: (r, i) => <UnitCell row={r} units={units} catalogue={catalogue} onChange={row => setRow(i, row)} />,
                    },
                    {
                        kind: 'label', key: 'mat', title: 'ค่าวัสดุ / หน่วย', width: 120,
                        get: (r, i) => (
                            <PriceCell row={r} field="mat" catalogue={catalogue} onChange={row => setRow(i, row)}
                                highlight={allowFreeText === true && needsPrice(r, catalogue)} />
                        ),
                    },
                    {
                        kind: 'label', key: 'lab', title: 'ค่าแรง / หน่วย', width: 120,
                        get: (r, i) => (
                            <PriceCell row={r} field="lab" catalogue={catalogue} onChange={row => setRow(i, row)}
                                highlight={allowFreeText === true && needsPrice(r, catalogue)} />
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
    );
}

interface OptionLine {
    option: number;
    label: string;
    unit: string;
    /** Index of the option's (first) row in the list; undefined = not listed yet (qty 0). */
    index?: number;
    row?: PickRow;
}

interface OtherLine {
    index: number;
    row: PickRow;
}

/**
 * Guided journey: a count sheet of every dropdown option (type how many the plan shows, 0 = none), then the
 * rows that are not a dropdown option (free text / a second row of an item) with their prices in plain view,
 * the catalogue prices folded away, and a short money summary.
 */
function JourneyPickList({ catalogue, options, units = [], allowFreeText, journeyNotes, calc }: PickListPageProps & { calc: Calc }) {
    const { input, update, outputs } = calc;
    const rows = input.items;
    const { first, others } = splitByOption(rows, options);
    const setRow = (i: number, row: PickRow) => update(p => ({ ...p, items: p.items.map((r, j) => (j === i ? row : r)) }));
    const setQty = (option: number, qty: number) =>
        update(p => ({ ...p, items: setOptionQty(p.items, options, option, qty, catalogue) }));
    const addOther = () => update(p => ({ ...p, items: [...p.items, emptyPickRow()] }));

    const lines: OptionLine[] = options.map((o, option) => {
        const index = first.get(option);
        const row = index === undefined ? undefined : rows[index];
        const unit = row ? pickRowCalc(row, catalogue).unit : (catalogueItem(catalogue, o)?.unit ?? '');
        return { option, label: o.trim(), unit, ...(index === undefined ? {} : { index }), ...(row ? { row } : {}) };
    });
    const otherLines: OtherLine[] = others.flatMap(index => {
        const row = rows[index];
        return row ? [{ index, row }] : [];
    });
    const showOthers = allowFreeText === true || otherLines.length > 0;
    const unpriced = otherLines.filter(l => needsPrice(l.row, catalogue)).length;
    const priced = lines.flatMap(l => (l.row && l.index !== undefined ? [{ index: l.index, row: l.row, label: l.label }] : []));

    return (
        <>
            <SheetCard title="นับจากแบบ">
                <EditableTable<OptionLine>
                    rows={lines}
                    onChange={() => undefined}
                    canDelete={false}
                    columns={[
                        { kind: 'label', key: 'item', title: 'รายการ', get: l => <span className="px-1">{l.label}</span> },
                        {
                            kind: 'label', key: 'qty', title: 'จำนวน', width: 110,
                            get: l => (
                                <NumberCell value={l.row?.qty ?? 0} digits={qtyDigits(l.row?.qty ?? 0, l.unit)} blankZero placeholder="0"
                                    onCommit={v => setQty(l.option, v ?? 0)} ariaLabel={`จำนวน ${l.label}`} />
                            ),
                        },
                        { kind: 'label', key: 'unit', title: 'หน่วย', width: 80, get: l => <span className="block text-center text-gray-600">{l.unit}</span> },
                    ]}
                />
                <p className="mt-2 text-[12px] text-gray-500">ใส่จำนวนตามที่เห็นในแบบ รายการที่ไม่มีให้เว้นว่างไว้</p>
                {journeyNotes}
            </SheetCard>

            {showOthers && (
                <SheetCard title={allowFreeText ? 'งานอื่นที่ไม่อยู่ในรายการ' : 'รายการเพิ่มเติม'}>
                    {otherLines.length === 0
                        ? (
                            <EmptyState text="มีงานอื่นที่ไม่อยู่ในรายการด้านบนไหม? เพิ่มเองได้ พร้อมใส่ราคาต่อหน่วย"
                                addLabel="เพิ่มงานอื่น" onAdd={addOther} />
                        )
                        : (
                            <>
                                <EditableTable<OtherLine>
                                    rows={otherLines}
                                    onChange={next => {
                                        // Only the delete button calls this (every cell commits through setRow).
                                        const keep = new Set(next.map(l => l.index));
                                        const drop = new Set(others.filter(i => !keep.has(i)));
                                        update(p => ({ ...p, items: p.items.filter((_, j) => !drop.has(j)) }));
                                    }}
                                    columns={[
                                        {
                                            kind: 'label', key: 'item', title: 'รายการ',
                                            get: l => (
                                                <ItemCell row={l.row} options={options} allowFreeText={allowFreeText} catalogue={catalogue}
                                                    placeholder={allowFreeText ? 'พิมพ์ชื่องาน' : undefined}
                                                    onChange={row => setRow(l.index, row)} />
                                            ),
                                        },
                                        {
                                            kind: 'label', key: 'qty', title: 'จำนวน', width: 90,
                                            get: l => <QtyCell row={l.row} catalogue={catalogue} blankZero onChange={qty => setRow(l.index, { ...l.row, qty })} />,
                                        },
                                        {
                                            kind: 'label', key: 'unit', title: 'หน่วย', width: 90,
                                            get: l => <UnitCell row={l.row} units={units} catalogue={catalogue} onChange={row => setRow(l.index, row)} />,
                                        },
                                        {
                                            kind: 'label', key: 'mat', title: 'ค่าวัสดุ / หน่วย (บาท)', width: 120,
                                            get: l => (
                                                <PriceCell row={l.row} field="mat" catalogue={catalogue} onChange={row => setRow(l.index, row)}
                                                    highlight={needsPrice(l.row, catalogue)} blankZero />
                                            ),
                                        },
                                        {
                                            kind: 'label', key: 'lab', title: 'ค่าแรง / หน่วย (บาท)', width: 120,
                                            get: l => (
                                                <PriceCell row={l.row} field="lab" catalogue={catalogue} onChange={row => setRow(l.index, row)}
                                                    highlight={needsPrice(l.row, catalogue)} blankZero />
                                            ),
                                        },
                                        { kind: 'calc', key: 'total', title: 'เป็นเงิน (บาท)', width: 110, get: l => blankIfZero(pickRowCalc(l.row, catalogue).total) },
                                    ]}
                                />
                                <Button type="dashed" icon={<PlusOutlined />} className="mt-2" onClick={addOther}>เพิ่มงานอื่น</Button>
                                {unpriced > 0 && (
                                    <p className="mt-2 text-[12px] text-orange-600">
                                        ช่องกรอบสีส้มยังไม่มีราคา — ใส่ค่าวัสดุและ/หรือค่าแรงต่อหน่วย ไม่เช่นนั้นรายการนี้จะคิดเป็น 0 บาท
                                    </p>
                                )}
                            </>
                        )}
                </SheetCard>
            )}

            <AdvancedSection hint="ราคาตั้งต้นของแต่ละรายการ — ไม่ต้องแก้ก็ได้">
                {priced.length === 0
                    ? <p className="text-[12px] text-gray-500">ใส่จำนวนรายการก่อน แล้วราคาต่อหน่วยจะแสดงที่นี่</p>
                    : (
                        <>
                            <EditableTable<{ index: number; row: PickRow; label: string }>
                                rows={priced}
                                onChange={() => undefined}
                                canDelete={false}
                                columns={[
                                    { kind: 'label', key: 'item', title: 'รายการ', get: l => <span className="px-1">{l.label}</span> },
                                    {
                                        kind: 'label', key: 'mat', title: 'ค่าวัสดุ / หน่วย (บาท)', width: 130,
                                        get: l => <PriceCell row={l.row} field="mat" catalogue={catalogue} onChange={row => setRow(l.index, row)} />,
                                    },
                                    {
                                        kind: 'label', key: 'lab', title: 'ค่าแรง / หน่วย (บาท)', width: 130,
                                        get: l => <PriceCell row={l.row} field="lab" catalogue={catalogue} onChange={row => setRow(l.index, row)} />,
                                    },
                                ]}
                            />
                            <p className="mt-2 text-[12px] text-gray-500">
                                สีเขียว = ราคาตั้งต้น · พิมพ์ทับเพื่อใช้ราคาของโครงการนี้ · ลบค่าเพื่อกลับไปใช้ราคาตั้งต้น
                            </p>
                        </>
                    )}
            </AdvancedSection>

            <ResultSummary items={[
                { label: 'จำนวนรายการ', value: outputs.rows, unit: 'รายการ', digits: 0 },
                { label: 'ค่าวัสดุ', value: outputs.mat, unit: 'บาท', digits: 0 },
                { label: 'ค่าแรง', value: outputs.lab, unit: 'บาท', digits: 0 },
                { label: 'รวม', value: outputs.total, unit: 'บาท', digits: 0 },
            ]} />
        </>
    );
}
