'use client';

import {
    ALUMINIUM, ALUMINIUM_RATES, BRICK_THICKNESSES, BRICK_TYPES, doorWindow, LIGHT_WALL, openingRowCalc, WALL_PARTS, WOOD,
    WOOD_DEFAULT_PRICE, type DoorWindowInput, type OpeningRow,
} from '@/domain/calculators/door-window';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { EmptyPrompt, ResultSummary, parseWallType, wallTypeOptions, wallTypeValue } from '../brick/JourneyBits';
import { newOpeningRow, priceCommit } from './rows';

type Block = 'doors' | 'windows';

const TYPE_OPTIONS = [{ value: ALUMINIUM, label: 'อลูมิเนียม' }, { value: WOOD, label: 'ไม้' }];
const WALL_TYPE_OPTIONS = [
    ...wallTypeOptions(BRICK_TYPES, BRICK_THICKNESSES),
    { value: `${LIGHT_WALL}|`, label: `${LIGHT_WALL} (ไม่หักช่องเปิด)` },
];
const wallValue = (r: OpeningRow) => (r.brick.trim() === LIGHT_WALL ? `${LIGHT_WALL}|` : wallTypeValue(r.brick, r.thickness));

const BLOCKS: Record<Block, { title: string; prefix: string; add: string; empty: string; placeholder: string }> = {
    doors: {
        title: 'ประตู', prefix: 'D', add: 'เพิ่มประตู', placeholder: 'เช่น D1-บานเลื่อนคู่ 2.6 x 2.05 ม.',
        empty: 'ยังไม่มีประตู — ดูตารางประตูในแบบ (D1, D2 …) แล้วเพิ่มทีละแบบ: ขนาด ชนิดบาน และจำนวน',
    },
    windows: {
        title: 'หน้าต่าง', prefix: 'W', add: 'เพิ่มหน้าต่าง', placeholder: 'เช่น W1-บานเลื่อนสลับ 1.3 x 1.2 ม.',
        empty: 'ยังไม่มีหน้าต่าง — ดูตารางหน้าต่างในแบบ (W1, W2 …) แล้วเพิ่มทีละแบบ',
    },
};

const planColumns: SheetColumn<OpeningRow>[] = [
    { kind: 'text', key: 'name', title: 'รหัส-รายการ (ตามตารางในแบบ)', width: 260, get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
    { kind: 'select', key: 'type', title: 'ชนิดบาน', width: 110, options: TYPE_OPTIONS,
        get: r => r.type.trim(), set: (r, v) => ({ ...r, type: v }) },
    { kind: 'number', key: 'count', title: 'จำนวน (บาน)', width: 75, digits: 0, get: r => r.count, set: (r, v) => ({ ...r, count: v }) },
    { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 75, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
    { kind: 'number', key: 'height', title: 'สูง (ม.)', width: 75, get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
    { kind: 'select', key: 'wallPart', title: 'อยู่ที่ผนัง', width: 150, options: WALL_PARTS.map(v => ({ value: v })),
        get: r => r.wallPart, set: (r, v) => ({ ...r, wallPart: v }) },
    { kind: 'select', key: 'wall', title: 'ผนังชนิด', width: 170, options: WALL_TYPE_OPTIONS,
        get: wallValue,
        set: (r, v) => {
            const t = parseWallType(v);
            return { ...r, brick: t.brick, thickness: t.brick === LIGHT_WALL ? r.thickness : t.thickness };
        } },
];

export default function DoorWindowJourney() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(doorWindow);

    const setRow = (block: Block, i: number, row: OpeningRow) =>
        update((prev: DoorWindowInput) => ({ ...prev, [block]: prev[block].map((r, j) => (j === i ? row : r)) }));
    const addRow = (block: Block) =>
        update((prev: DoorWindowInput) => ({ ...prev, [block]: [...prev[block], newOpeningRow(prev[block], BLOCKS[block].prefix)] }));

    const priceColumns = (block: Block): SheetColumn<OpeningRow>[] => [
        { kind: 'label', key: 'name', title: 'รายการ', width: 240, get: r => <span className="px-1">{r.name}</span> },
        { kind: 'label', key: 'type', title: 'ชนิดบาน', width: 90,
            get: r => <span className="px-1">{r.type.trim() === WOOD ? 'ไม้' : r.type.trim() === ALUMINIUM ? 'อลูมิเนียม' : '-'}</span> },
        { kind: 'label', key: 'rate', title: 'อลูมิเนียม (บาท/ตร.ม.)', width: 100,
            get: (r, i) => (r.type.trim() === ALUMINIUM
                ? <NumberCell value={r.rate} digits={0} ariaLabel="อัตราอลูมิเนียม บาท/ตร.ม."
                    onCommit={v => setRow(block, i, { ...r, rate: v ?? ALUMINIUM_RATES.sliding })} />
                : <span className="block text-center text-gray-400">-</span>) },
        { kind: 'label', key: 'mat', title: 'ค่าวัสดุต่อชุด (บาท)', width: 110,
            get: (r, i) => (
                <NumberCell value={openingRowCalc(r).matUnit} tone={r.matPrice === null ? 'calc' : 'input'}
                    edited={r.matPrice !== null} ariaLabel="ค่าวัสดุต่อชุด"
                    onCommit={v => {
                        const p = priceCommit(r.matPrice, openingRowCalc(r).matUnit, v);
                        if (p !== 'unchanged') setRow(block, i, { ...r, matPrice: p });
                    }} />
            ) },
        { kind: 'label', key: 'lab', title: 'ค่าแรงต่อชุด (บาท)', width: 100,
            get: (r, i) => (
                <NumberCell value={openingRowCalc(r).labUnit} tone={r.labPrice === null ? 'calc' : 'input'}
                    edited={r.labPrice !== null} ariaLabel="ค่าแรงต่อชุด"
                    onCommit={v => {
                        const p = priceCommit(r.labPrice, openingRowCalc(r).labUnit, v);
                        if (p !== 'unchanged') setRow(block, i, { ...r, labPrice: p });
                    }} />
            ) },
    ];

    const count = (rows: OpeningRow[]) => rows.reduce((s, r) => s + (Number.isFinite(r.count) ? r.count : 0), 0);
    const all = [...input.doors, ...input.windows];

    return (
        <CalculatorShell def={doorWindow} result={result} isDefault={isDefault} onReset={reset}>
            {(['doors', 'windows'] as const).map(block => {
                const b = BLOCKS[block];
                const rows = input[block];
                return (
                    <SheetCard key={block} title={b.title}>
                        {rows.length === 0
                            ? <EmptyPrompt text={b.empty} addLabel={b.add} onAdd={() => addRow(block)} />
                            : (
                                <EditableTable<OpeningRow>
                                    rows={rows}
                                    onChange={next => update((prev: DoorWindowInput) => ({ ...prev, [block]: next }))}
                                    newRow={() => newOpeningRow(rows, b.prefix)}
                                    addLabel={`+ ${b.add}`}
                                    columns={planColumns.map(c => (c.kind === 'text' ? { ...c, placeholder: b.placeholder } : c))}
                                />
                            )}
                    </SheetCard>
                );
            })}
            <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                <li>&quot;อยู่ที่ผนัง&quot; และ &quot;ผนังชนิด&quot; ใช้หักพื้นที่ประตู-หน้าต่างออกจากผนังในด่านก่ออิฐ — เลือกให้ตรงกับผนังที่ติดตั้ง</li>
                <li>ราคาตั้งต้น: อลูมิเนียมคิดตามพื้นที่บาน ({formatNumber(ALUMINIUM_RATES.sliding, 0)}–{formatNumber(ALUMINIUM_RATES.awning, 0)} บาท/ตร.ม.), ไม้ {formatNumber(WOOD_DEFAULT_PRICE.mat, 0)} + ค่าแรง {formatNumber(WOOD_DEFAULT_PRICE.lab, 0)} บาท/ชุด — แก้ได้ในส่วนราคาด้านล่าง</li>
            </ul>

            {all.length > 0 && (
                <AdvancedSection title="ราคาประตู-หน้าต่าง" hint="ราคาตั้งต้น แก้เฉพาะเมื่อมีราคาจริง">
                    {(['doors', 'windows'] as const).filter(block => input[block].length > 0).map(block => (
                        <div key={block} className="mb-3">
                            <div className="font-semibold text-[13px] text-gray-700 mb-1">{BLOCKS[block].title}</div>
                            <EditableTable<OpeningRow> rows={input[block]} onChange={next => update((prev: DoorWindowInput) => ({ ...prev, [block]: next }))}
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
                note="พื้นที่ช่องเปิดจะถูกหักออกจากผนังในด่านก่ออิฐให้อัตโนมัติ" />
        </CalculatorShell>
    );
}
