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
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

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
const brick = (t: CalcT) => t('doorWindow.usedForBrickMasonry');
const price = (t: CalcT) => t('doorWindow.pricePerSetSentTo');

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
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(doorWindow);

    const setRow = (block: Block, i: number, row: OpeningRow) =>
        update((prev: DoorWindowInput) => ({ ...prev, [block]: prev[block].map((r, j) => (j === i ? row : r)) }));

    const columns = (block: Block): SheetColumn<OpeningRow>[] => [
        { kind: 'text', key: 'name', title: t('common.item'), width: 340, get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
        { kind: 'select', key: 'type', title: t('doorWindow.leafType'), width: 130, options: typeOptions,
            get: r => r.type.trim(), set: (r, v) => ({ ...r, type: v }) },
        { kind: 'select', key: 'wallPart', title: t('common.wallPart'), width: 150, options: wallOptions,
            get: r => r.wallPart, set: (r, v) => ({ ...r, wallPart: v }) },
        { kind: 'select', key: 'brick', title: t('doorWindow.brick'), width: 110, options: brickOptions,
            get: r => r.brick, set: (r, v) => ({ ...r, brick: v }) },
        { kind: 'select', key: 'thickness', title: t('common.thickness'), width: 100, options: thicknessOptions,
            get: r => r.thickness, set: (r, v) => ({ ...r, thickness: v }) },
        { kind: 'number', key: 'count', title: t('doorWindow.numberLeaves'), width: 70, digits: 0,
            get: r => r.count, set: (r, v) => ({ ...r, count: v }) },
        { kind: 'number', key: 'width', title: head(brick(t), t('common.widthM')), width: 75,
            get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
        { kind: 'number', key: 'height', title: head(brick(t), t('common.heightM')), width: 75,
            get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
        { kind: 'calc', key: 'area', title: head(brick(t), t('doorWindow.areaPerLeafSqM')), width: 85, get: r => openingRowCalc(r).area },
        { kind: 'calc', key: 'total', title: head(brick(t), t('common.totalSqM')), width: 85, get: r => openingRowCalc(r).total },
        { kind: 'label', key: 'rate', title: head(price(t), t('doorWindow.aluminiumBahtSqM')), width: 95,
            get: (r, i) => (r.type.trim() === ALUMINIUM
                ? <NumberCell value={r.rate} digits={0} ariaLabel={t('doorWindow.aluminiumRateBahtSqM')}
                    onCommit={v => setRow(block, i, { ...r, rate: v ?? ALUMINIUM_RATES.sliding })} />
                : <span className="block text-center text-gray-400">-</span>) },
        { kind: 'label', key: 'mat', title: head(price(t), t('doorWindow.materialBaht')), width: 100,
            get: (r, i) => (
                <NumberCell value={openingRowCalc(r).matUnit} tone={r.matPrice === null ? 'calc' : 'input'}
                    edited={r.matPrice !== null} ariaLabel={t('doorWindow.materialPerSet')}
                    onCommit={v => {
                        const p = priceCommit(r.matPrice, openingRowCalc(r).matUnit, v);
                        if (p !== 'unchanged') setRow(block, i, { ...r, matPrice: p });
                    }} />
            ) },
        { kind: 'label', key: 'lab', title: head(price(t), t('doorWindow.labourBaht')), width: 90,
            get: (r, i) => (
                <NumberCell value={openingRowCalc(r).labUnit} tone={r.labPrice === null ? 'calc' : 'input'}
                    edited={r.labPrice !== null} ariaLabel={t('doorWindow.labourPerSet')}
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
                <SheetCard title={t('doorWindow.passedOnToOtherCalculators')}>
                    <div className="text-[13px] font-medium text-gray-700 mb-1">{t('doorWindow.openingAreaBrickMasonryDeducted')}</div>
                    <table className="w-full border-collapse mb-3">
                        <thead>
                            <tr><th className={th}>{t('common.wallPart')}</th><th className={th}>{t('doorWindow.brick')}</th><th className={th}>{t('common.thickness')}</th><th className={th}>{t('common.totalSqM')}</th></tr>
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
                    <CalcField label={t('doorWindow.woodenDoorFramesAllWooden')} value={outputs.R191} unit={t('doorWindow.set')} digits={0} />
                    <CalcField label={t('doorWindow.aluminiumDoorsAndWindowsBoq')} value={outputs['aluminium.amount']} unit={t('common.baht')} />
                    <CalcField label={t('doorWindow.woodenDoorsAndWindowsBoq')} value={outputs['wood.amount']} unit={t('common.baht')} />
                </SheetCard>
            )}>
            <SheetCard title={t('doorWindow.doorAndWindowQuantityTable')}>
                <div className="font-semibold text-[13px] text-gray-800 mb-1">{t('doorWindow.door')}</div>
                <EditableTable<OpeningRow>
                    rows={input.doors}
                    onChange={doors => update({ doors })}
                    newRow={() => newRow(input.doors, 'D')}
                    addLabel={t('doorWindow.addDoor2')}
                    columns={columns('doors')}
                />
                <div className="font-semibold text-[13px] text-gray-800 mt-4 mb-1">{t('doorWindow.window')}</div>
                <EditableTable<OpeningRow>
                    rows={input.windows}
                    onChange={windows => update({ windows })}
                    newRow={() => newRow(input.windows, 'W')}
                    addLabel={t('doorWindow.addWindow2')}
                    columns={columns('windows')}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('doorWindow.areaPerLeafWidthHeight')}</li>
                    <li>{ALUMINIUM} {t('doorWindow.boq241RowPer')}{formatNumber(ALUMINIUM_RATES.sliding, 0)} {t('doorWindow.bahtSqMSlidingFixed')}{formatNumber(ALUMINIUM_RATES.awning, 0)} {t('doorWindow.bahtSqMCasementLabour')}</li>
                    <li>{WOOD} {t('doorWindow.boq301RowPer')}{WOOD_DOOR_NOTE}”</li>
                    <li>{t('doorWindow.greenCellsDefaultPriceType2')}</li>
                    <li>{t('doorWindow.woodenDoorFramesBoq18')}</li>
                    <li>{t('doorWindow.theBrickLightWallIs')}</li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
