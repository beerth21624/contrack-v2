'use client';

import {
    ALUMINIUM, ALUMINIUM_RATES, doorWindow, itemCode, LIGHT_WALL, openingRowCalc, WOOD, WOOD_DEFAULT_PRICE,
    type DoorWindowInput, type OpeningRow,
} from '@/domain/calculators/door-window';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import {
    AddButton, ChoiceButtons, EmptyState, FillProgress, JText, PlanCard, PlanField, PlanNumber, ResultSummary, countFill,
    fillState, type FillState,
} from '@/components/sheet/journey';
import { BRICK_CHOICES, THICKNESS_CHOICES, WALL_PART_CHOICES } from '../brick/wallParts';
import { duplicateOpeningRow, newOpeningRow, priceCommit } from './rows';

type Block = 'doors' | 'windows';

const TYPE_CHOICES = [{ value: ALUMINIUM as string, label: 'อลูมิเนียม' }, { value: WOOD as string, label: 'ไม้' }];
const WALL_CHOICES = [...BRICK_CHOICES, { value: LIGHT_WALL, label: 'ผนังเบา', hint: 'ผนังเบาไม่หักช่องเปิดในขั้นตอนก่ออิฐ' }];

interface BlockInfo {
    title: string; prefix: string; add: string; empty: string; placeholder: string;
    /** Standard leaf sizes (doors only; windows have no standard size). */
    widths?: readonly number[]; heights?: readonly number[];
    /** Usual size range (m): outside it a quiet note asks to check the unit (e.g. a door 90 m wide). */
    widthRange: readonly [number, number]; heightRange: readonly [number, number];
}

const BLOCKS: Record<Block, BlockInfo> = {
    doors: {
        title: 'ประตู', prefix: 'D', add: 'เพิ่มประตู', placeholder: 'เช่น D1-บานเปิดเดี่ยว',
        empty: 'ยังไม่มีประตู — ดูตารางประตูในแบบ (D1, D2 …) แล้วเพิ่มทีละแบบ: ขนาด ชนิดบาน และจำนวน',
        widths: [0.8, 0.9, 1.0], heights: [2.0, 2.1],
        widthRange: [0.5, 6], heightRange: [1.5, 4],
    },
    windows: {
        title: 'หน้าต่าง', prefix: 'W', add: 'เพิ่มหน้าต่าง', placeholder: 'เช่น W1-บานเลื่อนสลับ',
        empty: 'ยังไม่มีหน้าต่าง — ดูตารางหน้าต่างในแบบ (W1, W2 …) แล้วเพิ่มทีละแบบ',
        widthRange: [0.2, 8], heightRange: [0.2, 4],
    },
};

const isLight = (r: OpeningRow) => r.brick.trim() === LIGHT_WALL;

/** What a card still needs (plan values), in reading order. */
function missingOf(r: OpeningRow): string[] {
    const out: string[] = [];
    if (r.type.trim() === '') out.push('วัสดุบาน');
    if (!(r.count > 0)) out.push('จำนวน');
    if (!(r.width > 0)) out.push('ความกว้าง');
    if (!(r.height > 0)) out.push('ความสูง');
    if (r.wallPart.trim() === '') out.push('ผนังที่ติดตั้ง');
    if (r.brick.trim() === '' || (!isLight(r) && r.thickness.trim() === '')) out.push('ชนิดผนัง');
    return out;
}

const stateOf = (r: OpeningRow): FillState => {
    const missing = missingOf(r);
    return fillState(missing.length === 0 ? [true] : [false], r.width > 0 || r.height > 0);
};
/** The description after the code ("D1-บานเปิด" → "บานเปิด"). */
const description = (name: string) => name.replace(/^\s*[A-Za-z]+\d+\s*-?\s*/, '').trim();
const hasData = (r: OpeningRow) => r.width > 0 || r.height > 0 || description(r.name) !== '';
const titleOf = (r: OpeningRow, fallback: string) => {
    if (description(r.name) !== '') return r.name.trim();
    const code = itemCode(r.name);
    return code === '' ? fallback : `${code} · ${fallback}`;
};

export default function DoorWindowJourney() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(doorWindow);

    const setBlock = (block: Block, fn: (rows: OpeningRow[]) => OpeningRow[]) =>
        update((prev: DoorWindowInput) => ({ ...prev, [block]: fn(prev[block]) }));
    const setRow = (block: Block, i: number, patch: Partial<OpeningRow>) =>
        setBlock(block, rows => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const addRow = (block: Block) => setBlock(block, rows => [...rows, newOpeningRow(rows, BLOCKS[block].prefix)]);

    const priceColumns = (block: Block): SheetColumn<OpeningRow>[] => [
        { kind: 'label', key: 'name', title: 'รายการ', width: 240, get: r => <span className="px-1">{r.name}</span> },
        { kind: 'label', key: 'type', title: 'ชนิดบาน', width: 90,
            get: r => <span className="px-1">{r.type.trim() === WOOD ? 'ไม้' : r.type.trim() === ALUMINIUM ? 'อลูมิเนียม' : '-'}</span> },
        { kind: 'label', key: 'rate', title: 'อลูมิเนียม (บาท/ตร.ม.)', width: 100,
            get: (r, i) => (r.type.trim() === ALUMINIUM
                ? <NumberCell value={r.rate} digits={0} ariaLabel="อัตราอลูมิเนียม บาท/ตร.ม."
                    onCommit={v => setRow(block, i, { rate: v ?? ALUMINIUM_RATES.sliding })} />
                : <span className="block text-center text-gray-400">-</span>) },
        { kind: 'label', key: 'mat', title: 'ค่าวัสดุต่อชุด (บาท)', width: 110,
            get: (r, i) => (
                <NumberCell value={openingRowCalc(r).matUnit} tone={r.matPrice === null ? 'calc' : 'input'}
                    edited={r.matPrice !== null} ariaLabel="ค่าวัสดุต่อชุด"
                    onCommit={v => {
                        const p = priceCommit(r.matPrice, openingRowCalc(r).matUnit, v);
                        if (p !== 'unchanged') setRow(block, i, { matPrice: p });
                    }} />
            ) },
        { kind: 'label', key: 'lab', title: 'ค่าแรงต่อชุด (บาท)', width: 100,
            get: (r, i) => (
                <NumberCell value={openingRowCalc(r).labUnit} tone={r.labPrice === null ? 'calc' : 'input'}
                    edited={r.labPrice !== null} ariaLabel="ค่าแรงต่อชุด"
                    onCommit={v => {
                        const p = priceCommit(r.labPrice, openingRowCalc(r).labUnit, v);
                        if (p !== 'unchanged') setRow(block, i, { labPrice: p });
                    }} />
            ) },
    ];

    const count = (rows: OpeningRow[]) => rows.reduce((s, r) => s + (Number.isFinite(r.count) ? r.count : 0), 0);
    const all = [...input.doors, ...input.windows];
    const progress = countFill(all.map(stateOf));

    const card = (block: Block, r: OpeningRow, i: number) => {
        const b = BLOCKS[block];
        const state = stateOf(r);
        const missing = state === 'missing' ? new Set(missingOf(r)) : new Set<string>();
        const c = openingRowCalc(r);
        return (
            <PlanCard key={i} index={i + 1} state={state}
                title={titleOf(r, `${b.title}ที่ ${String(i + 1)}`)}
                result={c.total > 0 ? <>{formatNumber(c.total)} ตร.ม.</> : undefined}
                onDuplicate={() => setBlock(block, rows => duplicateOpeningRow(rows, i, b.prefix))}
                onDelete={() => setBlock(block, rows => rows.filter((_, j) => j !== i))}
                hasData={hasData(r)} deleteTitle={`ลบ${b.title}นี้?`}
                missingText={`ยังขาด: ${missingOf(r).join(', ')}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <div className="sm:col-span-2">
                        <JText wide label="รหัส-รายการ (ตามตารางในแบบ)" value={r.name} placeholder={b.placeholder}
                            onChange={name => setRow(block, i, { name })} />
                    </div>
                    <PlanField label="วัสดุบาน">
                        <ChoiceButtons ariaLabel="วัสดุบาน" value={r.type.trim() === '' ? undefined : r.type.trim()} options={TYPE_CHOICES}
                            onChange={type => setRow(block, i, { type })} />
                    </PlanField>
                    <PlanNumber label="จำนวน" unit="บาน" digits={0} value={r.count} missing={missing.has('จำนวน')}
                        onChange={count => setRow(block, i, { count })} />
                    <PlanNumber label="กว้าง" unit="ม." value={r.width} presets={b.widths} presetFormat={v => v.toFixed(1)}
                        range={b.widthRange} missing={missing.has('ความกว้าง')}
                        onChange={width => setRow(block, i, { width })} />
                    <PlanNumber label="สูง" unit="ม." value={r.height} presets={b.heights} presetFormat={v => v.toFixed(1)}
                        range={b.heightRange} missing={missing.has('ความสูง')}
                        onChange={height => setRow(block, i, { height })} />
                    <PlanField className="sm:col-span-2" label="ติดตั้งที่ผนัง">
                        <ChoiceButtons ariaLabel="ติดตั้งที่ผนัง" size="small" options={WALL_PART_CHOICES}
                            value={r.wallPart.trim() === '' ? undefined : r.wallPart.trim()}
                            onChange={wallPart => setRow(block, i, { wallPart })} />
                    </PlanField>
                    <PlanField className="sm:col-span-2" label="ชนิดผนัง">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            <ChoiceButtons ariaLabel="ชนิดผนัง" size="small" options={WALL_CHOICES}
                                value={r.brick.trim() === '' ? undefined : r.brick.trim()}
                                onChange={brick => setRow(block, i, { brick })} />
                            {!isLight(r) && (
                                <ChoiceButtons ariaLabel="ความหนาผนัง" size="small" options={THICKNESS_CHOICES}
                                    value={r.thickness.trim() === '' ? undefined : r.thickness.trim()}
                                    onChange={thickness => setRow(block, i, { thickness })} />
                            )}
                        </div>
                    </PlanField>
                </div>
            </PlanCard>
        );
    };

    return (
        <CalculatorShell def={doorWindow} result={result} isDefault={isDefault} onReset={reset}>
            {all.length >= 5 && <FillProgress {...progress} noun="ช่องเปิด" />}

            {(['doors', 'windows'] as const).map(block => {
                const b = BLOCKS[block];
                const rows = input[block];
                return (
                    <SheetCard key={block} title={b.title}>
                        {rows.length === 0
                            ? <EmptyState text={b.empty} addLabel={b.add} onAdd={() => addRow(block)} />
                            : (
                                <div className="flex flex-col gap-2">
                                    {rows.map((r, i) => card(block, r, i))}
                                    <AddButton label={b.add} onClick={() => addRow(block)} />
                                </div>
                            )}
                    </SheetCard>
                );
            })}
            <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                <li>&quot;ติดตั้งที่ผนัง&quot; และ &quot;ชนิดผนัง&quot; ใช้หักพื้นที่ประตู-หน้าต่างออกจากผนังในขั้นตอนก่ออิฐ — เลือกให้ตรงกับผนังที่ติดตั้ง</li>
                <li>ราคาตั้งต้น: อลูมิเนียมคิดตามพื้นที่บาน ({formatNumber(ALUMINIUM_RATES.sliding, 0)}–{formatNumber(ALUMINIUM_RATES.awning, 0)} บาท/ตร.ม.), ไม้ {formatNumber(WOOD_DEFAULT_PRICE.mat, 0)} + ค่าแรง {formatNumber(WOOD_DEFAULT_PRICE.lab, 0)} บาท/ชุด — แก้ได้ในส่วนราคาด้านล่าง</li>
            </ul>

            {all.length > 0 && (
                <AdvancedSection title="ราคาประตู-หน้าต่าง">
                    {(['doors', 'windows'] as const).filter(block => input[block].length > 0).map(block => (
                        <div key={block} className="mb-3">
                            <div className="font-semibold text-[13px] text-gray-700 mb-1">{BLOCKS[block].title}</div>
                            <EditableTable<OpeningRow> rows={input[block]} onChange={next => setBlock(block, () => next)}
                                canDelete={false} columns={priceColumns(block)} />
                        </div>
                    ))}
                    <div className="text-[12px] text-gray-500">ช่องสีเขียว = ราคาตั้งต้น พิมพ์ทับได้ ลบค่าออกเพื่อกลับเป็นราคาตั้งต้น · อลูมิเนียม: บานเลื่อน/ช่องแสงติดตาย {formatNumber(ALUMINIUM_RATES.sliding, 0)}, บานกระทุ้ง {formatNumber(ALUMINIUM_RATES.awning, 0)} บาท/ตร.ม.</div>
                </AdvancedSection>
            )}

            <ResultSummary
                items={[
                    { label: 'ประตู', value: count(input.doors), unit: 'บาน', digits: 0 },
                    { label: 'หน้าต่าง', value: count(input.windows), unit: 'บาน', digits: 0 },
                    { label: 'พื้นที่ช่องเปิดรวม', value: outputs['opening.total'], unit: 'ตร.ม.' },
                ]}
                note="พื้นที่ช่องเปิดจะถูกหักออกจากผนังในขั้นตอนก่ออิฐให้อัตโนมัติ" />
        </CalculatorShell>
    );
}
