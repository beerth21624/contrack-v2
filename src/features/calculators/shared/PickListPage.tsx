'use client';

import type { ReactNode } from 'react';
import { AutoComplete, Button, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { CalculatorDef } from '@/domain/calculators/types';
import {
    catalogueItem, emptyPickRow, isCountUnit, matchKey, needsPrice, pickRowCalc, qtyDigits, selectItem, setOptionQty,
    splitByOption, type Catalogue, type PickListInput, type PickRow,
} from '@/domain/calculators/shared/pick-list';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { EditableTable } from '@/components/sheet/EditableTable';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import {
    AddButton, CountStepper, Hint, LevelLink, RequiredArea, RequiredMark, ResultSummary, blankIfZero, levelTitle,
    useRequiredField,
} from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { suggestionText, type ItemSuggestion } from './itemMatch';
import { useItemMatches, type ItemMatches } from './useItemMatches';

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
    /** Guided journey: shown above the count list (e.g. a "add one bathroom" helper). */
    journeyTop?: ReactNode;
    /** Guided journey: the count list in titled groups (items by their dropdown text); unlisted items go last. */
    groups?: readonly PickGroup[];
    /** Guided journey: where on the plan to read an item (by its dropdown text). */
    itemHints?: Readonly<Record<string, string>>;
    /** Guided journey: counts an earlier step already knows, offered with one click (by dropdown text). */
    suggestions?: readonly PickSuggestion[];
}

export interface PickGroup { title: string; items: readonly string[] }

export interface PickSuggestion {
    item: string;
    qty: number;
    /** Journey step the count comes from. */
    levelId: string;
    /** What was counted there, e.g. "วงจรเบรกเกอร์ 16A". */
    what: string;
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

/** รายการ cell: dropdown, or dropdown + free text; under it, what the AI thinks a free text means (quiet, inline). */
function ItemCell({ row, options, allowFreeText, catalogue, onChange, placeholder, matches }: {
    row: PickRow; options: readonly string[]; allowFreeText?: boolean; catalogue: Catalogue;
    onChange: (row: PickRow) => void; placeholder?: string; matches?: ItemMatches;
}) {
    const itemOptions = itemOptionsOf(options);
    const suggestion = matches?.suggestionFor(row.item);
    return (
        <div style={{ background: SHEET_COLORS.input, borderRadius: 3, minWidth: 260 }}>
            {allowFreeText
                ? (
                    <AutoComplete size="small" variant="borderless" style={{ width: '100%' }}
                        value={row.item} options={itemOptions} placeholder={placeholder ?? 'เลือกหรือพิมพ์รายการ'}
                        onChange={v => onChange(selectItem(row, v, catalogue))}
                        onBlur={() => matches?.flush()} />
                )
                : (
                    <Select size="small" variant="borderless" style={{ width: '100%' }} allowClear
                        value={row.item === '' ? undefined : row.item} options={itemOptions} placeholder={placeholder ?? 'เลือกรายการ'}
                        onChange={(v: string | undefined) => onChange(selectItem(row, v ?? '', catalogue))} />
                )}
            {suggestion !== undefined && matches !== undefined && (
                <ItemSuggestionLine suggestion={suggestion}
                    onAccept={() => onChange(selectItem(row, suggestion.item, catalogue))}
                    onDecline={() => matches.decline(row.item)} />
            )}
        </div>
    );
}

/**
 * The AI's reading of a free text, as secondary text under the field: "หมายถึง "X" ใช่ไหม" (sure) or
 * "อาจหมายถึง "X"" (likely), with [ใช้รายการนี้] [ไม่ใช่]. Accepting picks the catalogue item like the dropdown
 * would (unit and prices follow; qty and typed prices stay); declining is remembered for the session.
 */
function ItemSuggestionLine({ suggestion, onAccept, onDecline }: {
    suggestion: ItemSuggestion; onAccept: () => void; onDecline: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-1 px-2 pb-1 text-[12px] leading-tight text-gray-500" role="status">
            <span className="min-w-0 break-words">{suggestionText(suggestion)}</span>
            <Button type="link" size="small" className="!px-1 !h-auto !text-[12px]" onClick={onAccept}>ใช้รายการนี้</Button>
            <Button type="link" size="small" className="!px-1 !h-auto !text-[12px] !text-gray-400" onClick={onDecline}>ไม่ใช่</Button>
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
    const matches = useItemMatches(input.items, catalogue);

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
                                matches={matches} onChange={row => setRow(i, row)} />
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

/** The count lines in the page's groups (dropdown order inside a group); lines in no group come last. */
function groupLines(lines: OptionLine[], groups: readonly PickGroup[] | undefined): { title: string; lines: OptionLine[] }[] {
    if (groups === undefined || groups.length === 0) return [{ title: '', lines }];
    const inGroup = (g: PickGroup, l: OptionLine) => g.items.some(it => matchKey(it) === matchKey(l.label));
    const out = groups.map(g => ({ title: g.title, lines: lines.filter(l => inGroup(g, l)) })).filter(g => g.lines.length > 0);
    const rest = lines.filter(l => !groups.some(g => inGroup(g, l)));
    return rest.length > 0 ? [...out, { title: 'อื่น ๆ', lines: rest }] : out;
}

const hintOf = (hints: Readonly<Record<string, string>> | undefined, label: string): string | undefined =>
    hints === undefined ? undefined : Object.entries(hints).find(([k]) => matchKey(k) === matchKey(label))?.[1];

/**
 * One item of the journey count sheet: name (and where to read it when people hesitate), − / + stepper for counted
 * units (a plain box for lengths) with the unit, and a count an earlier step already knows.
 */
function CountLine({ line, hint, suggestion, onQty }: {
    line: OptionLine; hint?: string; suggestion?: PickSuggestion; onQty: (qty: number) => void;
}) {
    const qty = line.row?.qty ?? 0;
    const offer = suggestion !== undefined && suggestion.qty > 0 && suggestion.qty !== qty ? suggestion : undefined;
    return (
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-gray-100 py-2 last:border-b-0">
            <div className="min-w-0">
                <div className="text-[13px] text-gray-800">{line.label}</div>
                {hint !== undefined && <Hint>{hint}</Hint>}
                {offer !== undefined && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-sky-800">
                        <span>
                            <LevelLink levelId={offer.levelId} className="text-sky-700 hover:underline">ขั้นตอน{levelTitle(offer.levelId)}</LevelLink>
                            {' '}นับ{offer.what} ได้ {formatNumber(offer.qty, 0)}
                        </span>
                        <Button size="small" onClick={() => onQty(offer.qty)}>ใช้ {formatNumber(offer.qty, 0)} {line.unit}</Button>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1.5">
                {isCountUnit(line.unit)
                    ? <CountStepper value={qty} onChange={onQty} ariaLabel={`จำนวน ${line.label}`} unit={line.unit} />
                    : (
                        // As wide as a stepper (− box +) and with the same unit column, so every line ends in one column.
                        <>
                            <span className="w-[120px]">
                                <NumberCell value={qty} digits={qtyDigits(qty, line.unit)} blankZero placeholder="0"
                                    onCommit={v => onQty(v ?? 0)} ariaLabel={`ปริมาณ ${line.label} (${line.unit})`} />
                            </span>
                            <span className="min-w-[40px] text-[12px] text-gray-500 whitespace-nowrap">{line.unit}</span>
                        </>
                    )}
            </div>
        </div>
    );
}

/**
 * Guided journey: a count sheet of every dropdown option (type how many the plan shows, 0 = none), then the
 * rows that are not a dropdown option (free text / a second row of an item) with their prices in plain view,
 * the catalogue prices folded away, and a short money summary.
 */
function JourneyPickList({
    catalogue, options, units = [], allowFreeText, journeyNotes, journeyTop, groups, itemHints, suggestions, calc,
}: PickListPageProps & { calc: Calc }) {
    const { input, update, outputs } = calc;
    // The step needs at least one counted item: the count sheet's title carries the `*`.
    const qtyRequired = useRequiredField('qty').required;
    const rows = input.items;
    const { first, others } = splitByOption(rows, options);
    const setRow = (i: number, row: PickRow) => update(p => ({ ...p, items: p.items.map((r, j) => (j === i ? row : r)) }));
    const setQty = (option: number, qty: number) =>
        update(p => ({ ...p, items: setOptionQty(p.items, options, option, qty, catalogue) }));
    const addOther = () => update(p => ({ ...p, items: [...p.items, emptyPickRow()] }));
    const matches = useItemMatches(rows, catalogue);

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
            <SheetCard title={<>นับจากแบบ<RequiredMark required={qtyRequired} /></>}>
                {journeyTop !== undefined && <div className="mb-3">{journeyTop}</div>}
                <p className="mb-1 text-[12px] text-gray-500">ใส่จำนวนตามที่เห็นในแบบ รายการที่ไม่มีให้เว้นว่างไว้</p>
                <RequiredArea className="flex flex-col gap-3">
                    {groupLines(lines, groups).map(g => (
                        <div key={g.title}>
                            {g.title !== '' && <div className="mt-1 text-[12px] font-semibold text-gray-500">{g.title}</div>}
                            <div className="flex flex-col">
                                {g.lines.map(l => (
                                    <CountLine key={l.option} line={l}
                                        hint={hintOf(itemHints, l.label)}
                                        suggestion={suggestions?.find(s => matchKey(s.item) === matchKey(l.label))}
                                        onQty={qty => setQty(l.option, qty)} />
                                ))}
                            </div>
                        </div>
                    ))}
                </RequiredArea>
                {journeyNotes}
            </SheetCard>

            {showOthers && (
                <SheetCard title={allowFreeText ? 'งานอื่นที่ไม่อยู่ในรายการ' : 'รายการเพิ่มเติม'}>
                    {otherLines.length === 0
                        ? (
                            // Optional extras: a quiet add button, so the step's own "ยืนยัน" stays the one primary action.
                            <>
                                <p className="mb-2 text-[12px] text-gray-500">มีงานอื่นที่ไม่อยู่ในรายการด้านบน เพิ่มเองได้ พร้อมใส่ราคาต่อหน่วย</p>
                                <AddButton label="เพิ่มงานอื่น" onClick={addOther} />
                            </>
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
                                                    placeholder={allowFreeText ? 'พิมพ์ชื่องาน' : undefined} matches={matches}
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

            <AdvancedSection>
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

            {/* The split material / labour; the total is มูลค่าขั้นตอนนี้ in the bottom bar. */}
            <ResultSummary items={[
                { label: 'ค่าวัสดุ', value: outputs.mat, unit: 'บาท', digits: 0 },
                { label: 'ค่าแรง', value: outputs.lab, unit: 'บาท', digits: 0 },
            ]} empty="ใส่จำนวนตามแบบ ระบบจะคิดค่าวัสดุและค่าแรงให้" />
        </>
    );
}
