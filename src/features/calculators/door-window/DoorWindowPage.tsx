'use client';

import type { ReactNode } from 'react';
import {
    ALUMINIUM, ALUMINIUM_RATES, BRICK_THICKNESSES, DOOR_TYPES, doorWindow, OPENING_WALL_TYPES,
    openingRowCalc, WALL_PARTS, WOOD, WOOD_DOOR_NOTE, type DoorWindowInput, type OpeningRow,
} from '@/domain/calculators/door-window';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { newOpeningRow, priceCommit } from './rows';
import DoorWindowJourney from './DoorWindowJourney';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

type Block = 'doors' | 'windows';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px]';
const tdNum = `${td} text-right tabular-nums`;

/** Column header with a group label above it (the sheet's "[ ใช้คำนวณงานก่ออิฐ ]" band, the BOQ price columns). */
const head = (group: string, label: string): ReactNode => (
    <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-normal text-gray-500">{group}</span>
        <span>{label}</span>
    </span>
);
const BRICK = '[ ใช้คำนวณงานก่ออิฐ ]';
const PRICE = 'ราคาต่อชุด (ส่ง BOQ)';

const options = (list: readonly string[]) => list.map(v => ({ value: v }));

const typeOptions = options(DOOR_TYPES);
const wallOptions = options(WALL_PARTS);
const brickOptions = options(OPENING_WALL_TYPES);
const thicknessOptions = options(BRICK_THICKNESSES);
const newRow = newOpeningRow;

export default function DoorWindowPage() {
    return useJourneyMode() ? <DoorWindowJourney /> : <DoorWindowSheet />;
}

/** The Excel-mirror sheet (/calc/door-window). */
function DoorWindowSheet() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(doorWindow);

    const setRow = (block: Block, i: number, row: OpeningRow) =>
        update((prev: DoorWindowInput) => ({ ...prev, [block]: prev[block].map((r, j) => (j === i ? row : r)) }));

    const columns = (block: Block): SheetColumn<OpeningRow>[] => [
        { kind: 'text', key: 'name', title: 'รายการ', width: 340, get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
        { kind: 'select', key: 'type', title: 'ชนิดบาน', width: 130, options: typeOptions,
            get: r => r.type.trim(), set: (r, v) => ({ ...r, type: v }) },
        { kind: 'select', key: 'wallPart', title: 'ส่วนผนัง', width: 150, options: wallOptions,
            get: r => r.wallPart, set: (r, v) => ({ ...r, wallPart: v }) },
        { kind: 'select', key: 'brick', title: 'อิฐ', width: 110, options: brickOptions,
            get: r => r.brick, set: (r, v) => ({ ...r, brick: v }) },
        { kind: 'select', key: 'thickness', title: 'ความหนา', width: 100, options: thicknessOptions,
            get: r => r.thickness, set: (r, v) => ({ ...r, thickness: v }) },
        { kind: 'number', key: 'count', title: 'จำนวน (บาน)', width: 70, digits: 0,
            get: r => r.count, set: (r, v) => ({ ...r, count: v }) },
        { kind: 'number', key: 'width', title: head(BRICK, 'กว้าง (ม.)'), width: 75,
            get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
        { kind: 'number', key: 'height', title: head(BRICK, 'สูง (ม.)'), width: 75,
            get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
        { kind: 'calc', key: 'area', title: head(BRICK, 'พื้นที่ ต่อบาน (ตร.ม.)'), width: 85, get: r => openingRowCalc(r).area },
        { kind: 'calc', key: 'total', title: head(BRICK, 'รวม (ตร.ม.)'), width: 85, get: r => openingRowCalc(r).total },
        { kind: 'label', key: 'rate', title: head(PRICE, 'อลูมิเนียม (บาท/ตร.ม.)'), width: 95,
            get: (r, i) => (r.type.trim() === ALUMINIUM
                ? <NumberCell value={r.rate} digits={0} ariaLabel="อัตราอลูมิเนียม บาท/ตร.ม."
                    onCommit={v => setRow(block, i, { ...r, rate: v ?? ALUMINIUM_RATES.sliding })} />
                : <span className="block text-center text-gray-400">-</span>) },
        { kind: 'label', key: 'mat', title: head(PRICE, 'ค่าวัสดุ (บาท)'), width: 100,
            get: (r, i) => (
                <NumberCell value={openingRowCalc(r).matUnit} tone={r.matPrice === null ? 'calc' : 'input'}
                    edited={r.matPrice !== null} ariaLabel="ค่าวัสดุต่อชุด"
                    onCommit={v => {
                        const p = priceCommit(r.matPrice, openingRowCalc(r).matUnit, v);
                        if (p !== 'unchanged') setRow(block, i, { ...r, matPrice: p });
                    }} />
            ) },
        { kind: 'label', key: 'lab', title: head(PRICE, 'ค่าแรง (บาท)'), width: 90,
            get: (r, i) => (
                <NumberCell value={openingRowCalc(r).labUnit} tone={r.labPrice === null ? 'calc' : 'input'}
                    edited={r.labPrice !== null} ariaLabel="ค่าแรงต่อชุด"
                    onCommit={v => {
                        const p = priceCommit(r.labPrice, openingRowCalc(r).labUnit, v);
                        if (p !== 'unchanged') setRow(block, i, { ...r, labPrice: p });
                    }} />
            ) },
    ];

    const openings = Object.entries(outputs)
        .filter(([k, v]) => k.startsWith('opening|') && v !== 0)
        .map(([k, v]) => {
            const [, wallPart = '', brick = '', thickness = ''] = k.split('|');
            return { k, wallPart, brick, thickness, v };
        });

    return (
        <CalculatorShell def={doorWindow} result={result} isDefault={isDefault} onReset={reset}
            aside={(
                <SheetCard title="ส่งต่อเครื่องคำนวณอื่น">
                    <div className="text-[13px] font-medium text-gray-700 mb-1">พื้นที่ช่องเปิด → ก่ออิฐ_Brick (หักออกจากพื้นที่ผนัง)</div>
                    <table className="w-full border-collapse mb-3">
                        <thead>
                            <tr><th className={th}>ส่วนผนัง</th><th className={th}>อิฐ</th><th className={th}>ความหนา</th><th className={th}>รวม (ตร.ม.)</th></tr>
                        </thead>
                        <tbody>
                            {openings.length === 0
                                ? <tr><td className={`${td} text-center text-gray-400`} colSpan={4}>-</td></tr>
                                : openings.map(o => (
                                    <tr key={o.k}>
                                        <td className={td}>{o.wallPart}</td><td className={td}>{o.brick}</td><td className={td}>{o.thickness}</td>
                                        <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(o.v)}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                    <CalcField label="วงกบประตูไม้ (บานไม้ ทุกแถว) → BOQ 18 ข้อ 3)" value={outputs.R191} unit="ชุด" digits={0} />
                    <CalcField label="ประตู-หน้าต่างอลูมิเนียม → BOQ 24" value={outputs['aluminium.amount']} unit="บาท" />
                    <CalcField label="ประตู-หน้าต่างไม้ → BOQ 30" value={outputs['wood.amount']} unit="บาท" />
                </SheetCard>
            )}>
            <SheetCard title=": ตารางคำนวณปริมาณประตู-หน้าต่าง, พื้นที่ช่องเปิด">
                <div className="font-semibold text-[13px] text-gray-800 mb-1">ประตู</div>
                <EditableTable<OpeningRow>
                    rows={input.doors}
                    onChange={doors => update({ doors })}
                    newRow={() => newRow(input.doors, 'D')}
                    addLabel="+ เพิ่มประตู"
                    columns={columns('doors')}
                />
                <div className="font-semibold text-[13px] text-gray-800 mt-4 mb-1">หน้าต่าง</div>
                <EditableTable<OpeningRow>
                    rows={input.windows}
                    onChange={windows => update({ windows })}
                    newRow={() => newRow(input.windows, 'W')}
                    addLabel="+ เพิ่มหน้าต่าง"
                    columns={columns('windows')}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>พื้นที่ ต่อบาน = กว้าง × สูง; รวม = พื้นที่ ต่อบาน × จำนวน → หักช่องเปิดในงานก่ออิฐ ตามส่วนผนัง / อิฐ / ความหนา ที่ตรงกัน</li>
                    <li>{ALUMINIUM} → BOQ 24 (1 แถวต่อรายการ): ค่าวัสดุ/ชุด = กว้าง × สูง × อัตรา ({formatNumber(ALUMINIUM_RATES.sliding, 0)} บาท/ตร.ม. บานเลื่อน/ช่องแสงติดตาย, {formatNumber(ALUMINIUM_RATES.awning, 0)} บาท/ตร.ม. บานกระทุ้ง), ค่าแรง 0 (รวมติดตั้ง)</li>
                    <li>{WOOD} → BOQ 30 (1 แถวต่อรายการ): ตั้งต้น 4,000 / 800 บาทต่อชุด; ประตูไม้มีหมายเหตุ “{WOOD_DOOR_NOTE}”</li>
                    <li>ช่องสีเขียว = ราคาตั้งต้น พิมพ์ทับได้ ลบค่าออกเพื่อกลับเป็นราคาตั้งต้น</li>
                    <li>วงกบประตูไม้ (BOQ 18 ข้อ 3) = จำนวนบานไม้ทั้งหมด รวมหน้าต่างไม้ (ตามวิธีคิดของระบบ)</li>
                    <li>อิฐ “ผนังเบา” ไม่มีในชีตก่ออิฐ จึงไม่ถูกหักช่องเปิด</li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
