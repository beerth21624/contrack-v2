'use client';

import type { ReactNode } from 'react';
import { Button, Select } from 'antd';
import {
    roofStructure, partTotal, DOUBLE_C_OPTIONS, ROOF_FACTOR_OPTIONS, STICK_LENGTH,
    type AreaMember, type KingPostPart, type LengthMember, type RoofStructureInput,
} from '@/domain/calculators/roof-structure';
import { roofing } from '@/domain/calculators/roofing';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, TextCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { LengthsCell } from '@/components/sheet/LengthsCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import {
    EmptyState, FieldNote, FromLevel, Hint, JNumber, PlanNumber, ResultSummary, blankIfZero, outOfRange,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-1 py-0.5 text-[13px] align-middle';

function NumSelect({ value, options, onChange, label, digits = 0 }: {
    value: number; options: readonly number[]; onChange: (v: number) => void; label: string; digits?: number;
}) {
    return (
        <Select size="small" variant="borderless" style={{ width: '100%', background: SHEET_COLORS.input }} aria-label={label}
            value={String(value)} onChange={v => onChange(Number(v))}
            options={options.map(o => ({ value: String(o), label: o.toFixed(digits) }))} />
    );
}

/** One plan-length line: label, typed segments, their sum (a total typed in cm gets a quiet note). */
function LengthLine({ label, hint, lengths, total, onChange }: {
    label: string; hint: string; lengths: number[]; total: number | undefined; onChange: (lengths: number[]) => void;
}) {
    const t = useTranslations('calculators');
    const note = outOfRange(total ?? 0, 1, 500, t('common.m'));
    return (
        <div className="py-1">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px_110px] items-center gap-2">
                <div>
                    <div className="text-[13px] text-gray-700">{label}</div>
                    <Hint>{hint}</Hint>
                </div>
                <LengthsCell lengths={lengths} ariaLabel={label} onChange={onChange} />
                <span className="text-right tabular-nums px-1 rounded-sm text-[13px]" style={{ background: SHEET_COLORS.calc }}>
                    {(total ?? 0) === 0 ? '' : t('common.m2', { v: formatNumber(total) })}
                </span>
            </div>
            {note !== undefined && <FieldNote>{note}</FieldNote>}
        </div>
    );
}

export default function RoofStructureJourney() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofStructure);
    const roofSlope = useProjectStore(s => calculatorInput(s.project, roofing).slopeDeg);
    const linked = outputs.linkedSlopeArea ?? 0;

    function set<K extends keyof RoofStructureInput>(key: K, patch: Partial<RoofStructureInput[K]>) {
        update(p => ({ ...p, [key]: { ...p[key], ...patch } }));
    }
    const setParts = (parts: KingPostPart[]) => update(p => ({ ...p, kingPosts: { ...p.kingPosts, parts } }));
    const newPart = (parts: KingPostPart[]): KingPostPart =>
        ({ desc: t('roofStructure.kingPost', { v: String(parts.length + 1) }), c: parts[parts.length - 1]?.c ?? 2, length: 0, count: 1 });
    const addPart = () => update(p => ({ ...p, kingPosts: { ...p.kingPosts, parts: [...p.kingPosts.parts, newPart(p.kingPosts.parts)] } }));
    const parts = input.kingPosts.parts;

    // ─── Advanced: steel sections and spec per member ───
    const lengthSpec = (key: 'wallPlate' | 'ridge', name: string, m: LengthMember): ReactNode => (
        <tr key={key}>
            <td className={td}>{name}</td>
            <td className={td} style={{ background: SHEET_COLORS.input }}><TextCell value={m.desc} ariaLabel={t('roofStructure.barSize', { name })} onCommit={v => set(key, { desc: v ?? '' })} /></td>
            <td className={td}><NumSelect value={m.c} options={DOUBLE_C_OPTIONS} label={t('roofStructure.doubleC')} onChange={c => set(key, { c })} /></td>
            <td className={`${td} text-center text-gray-400`}>-</td>
            <td className={`${td} text-center text-gray-400`}>-</td>
            <td className={td}><NumberCell value={m.count} digits={0} ariaLabel={t('roofStructure.numberOfBars')} onCommit={v => set(key, { count: v ?? 1 })} /></td>
        </tr>
    );
    const areaSpec = (key: 'rafter' | 'purlin', name: string, m: AreaMember): ReactNode => (
        <tr key={key}>
            <td className={td}>{name}</td>
            <td className={td} style={{ background: SHEET_COLORS.input }}><TextCell value={m.desc} ariaLabel={t('roofStructure.barSize', { name })} onCommit={v => set(key, { desc: v ?? '' })} /></td>
            <td className={td}><NumSelect value={m.c} options={DOUBLE_C_OPTIONS} label={t('roofStructure.doubleC')} onChange={c => set(key, { c })} /></td>
            <td className={td}><NumSelect value={m.factor} options={ROOF_FACTOR_OPTIONS} digits={2} label={t('roofStructure.roofFactor')} onChange={factor => set(key, { factor })} /></td>
            <td className={td}><NumberCell value={m.spacing} ariaLabel={t('roofStructure.spacingM', { name })} onCommit={v => set(key, { spacing: v ?? 0 })} /></td>
            <td className={`${td} text-center text-gray-400`}>-</td>
        </tr>
    );
    const areaOverride = (key: 'rafter' | 'purlin', name: string, m: AreaMember) => (
        <div className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2 py-1">
            <span className="text-[13px] text-gray-700">{t('roofStructure.roofAreaUsed')}{name}</span>
            <NumberCell value={outputs[`${key}.area`] ?? 0} tone={m.area === null ? 'calc' : 'input'} edited={m.area !== null}
                ariaLabel={t('roofStructure.roofAreaUsedSqM', { name })}
                onCommit={v => set(key, { area: v ?? null })} />
            <span className="text-[12px] text-gray-500">{t('roofStructure.sqM')}{m.area === null ? t('roofStructure.fromTheRoofingMaterialStep') : t('roofStructure.typedManuallyClearTheValue')}</span>
        </div>
    );

    return (
        <CalculatorShell def={roofStructure} result={result} isDefault={isDefault} onReset={reset}>
            <FromLevel levelId="roofing">
                {linked > 0
                    ? <>{t('roofStructure.slopedRoofArea')}<b>{formatNumber(linked)}{t('common.sqM2')}</b>{t('roofStructure.raftersPurlinsAndRoofFrame')}</>
                    : <>{t('roofStructure.noRoofAreaYetEnter')}</>}
            </FromLevel>

            <SheetCard title={t('roofStructure.wallPlatesAndRidge')}>
                <Hint>{t('roofStructure.youCanTypeTheLength')}</Hint>
                <LengthLine label={t('roofStructure.wallPlate')} hint={t('roofStructure.lengthOfTheSteelBeam')}
                    lengths={input.wallPlate.lengths} total={outputs['wallPlate.length']}
                    onChange={lengths => set('wallPlate', { lengths })} />
                <LengthLine label={t('roofStructure.ridge')} hint={t('roofStructure.roofRidgeLengthTheTopmost')}
                    lengths={input.ridge.lengths} total={outputs['ridge.length']}
                    onChange={lengths => set('ridge', { lengths })} />
            </SheetCard>

            <SheetCard title={t('roofStructure.kingPostsColumnsSupportingThe')}>
                {parts.length === 0
                    ? <EmptyState text={t('roofStructure.noKingPostsYetCheck')} addLabel={t('roofStructure.addKingPost')} onAdd={addPart} />
                    : (
                        <EditableTable<KingPostPart>
                            rows={parts}
                            onChange={setParts}
                            newRow={() => newPart(parts)}
                            addLabel={t('roofStructure.addKingPost2')}
                            columns={[
                                { kind: 'text', key: 'desc', title: t('roofStructure.name'), width: 140, get: p => p.desc, set: (p, v) => ({ ...p, desc: v }) },
                                { kind: 'number', key: 'length', title: t('roofStructure.heightLengthM'), width: 120, get: p => p.length, set: (p, v) => ({ ...p, length: v }) },
                                { kind: 'number', key: 'count', title: t('roofStructure.quantityPcs'), width: 90, digits: 0, get: p => p.count, set: (p, v) => ({ ...p, count: v }) },
                                { kind: 'calc', key: 'total', title: t('roofStructure.totalLengthM'), width: 110, get: p => blankIfZero(partTotal(p)) },
                            ]}
                        />
                    )}
            </SheetCard>

            <SheetCard title={t('roofStructure.valley')}>
                <Hint>{t('roofStructure.ifTheRoofHasNo')}</Hint>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 mt-2 items-start">
                    <PlanNumber label={t('roofStructure.horizontalRunSide1')} value={input.valley.runA} unit={t('common.m')} range={[0.5, 30]}
                        onChange={runA => set('valley', { runA })} />
                    <PlanNumber label={t('roofStructure.horizontalRunSide2')} value={input.valley.runB} unit={t('common.m')} range={[0.5, 30]}
                        onChange={runB => set('valley', { runB })} />
                    <JNumber label={t('roofStructure.numberOfValleys')} value={input.valley.count} unit={t('common.pcs2')} digits={0} onChange={count => set('valley', { count })} />
                    <PlanNumber label={t('common.roofPitch')} value={input.valley.deg} unit={t('common.degrees')} digits={0} range={[5, 60]}
                        onChange={deg => set('valley', { deg })}
                        hint={roofSlope > 0 && input.valley.deg !== roofSlope
                            ? (
                                <Button size="small" type="link" className="!px-0" onClick={() => set('valley', { deg: roofSlope })}>
                                    {t('roofStructure.useTheSamePitchAs')}{formatNumber(roofSlope, 0)}°)
                                </Button>
                            )
                            : undefined} />
                </div>
                {(outputs['valley.length'] ?? 0) > 0 && (
                    <div className="mt-2 text-[13px] text-gray-700">
                        {t('roofStructure.valleyLengthPerPiece')}<b className="tabular-nums">{formatNumber(outputs['valley.length'])}{t('common.m3')}</b>
                    </div>
                )}
            </SheetCard>

            <AdvancedSection title={t('roofStructure.steelSizeAndSpacing')}>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} style={{ width: 80 }}>{t('common.item')}</th>
                                <th className={th} style={{ minWidth: 200 }}>{t('roofStructure.steelSize')}</th>
                                <th className={th} style={{ width: 70 }}>{t('roofStructure.doubleC')}</th>
                                <th className={th} style={{ width: 80 }}>{t('roofStructure.roofFactor')}</th>
                                <th className={th} style={{ width: 90 }}>{t('common.spacingM')}</th>
                                <th className={th} style={{ width: 80 }}>{t('roofStructure.numberOfBars')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lengthSpec('wallPlate', t('roofStructure.wallPlate'), input.wallPlate)}
                            <tr>
                                <td className={td}>{t('roofStructure.kingPost2')}</td>
                                <td className={td} style={{ background: SHEET_COLORS.input }}>
                                    <TextCell value={input.kingPosts.desc} ariaLabel={t('roofStructure.kingPostSteelSize')} onCommit={v => set('kingPosts', { desc: v ?? '' })} />
                                </td>
                                <td className={td}>
                                    {parts.length > 0
                                        ? <NumSelect value={parts[0]?.c ?? 2} options={DOUBLE_C_OPTIONS} label={t('roofStructure.doubleCKingPost')}
                                            onChange={c => setParts(parts.map(p => ({ ...p, c })))} />
                                        : <span className="block text-center text-gray-400">-</span>}
                                </td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                            </tr>
                            {lengthSpec('ridge', t('roofStructure.ridge'), input.ridge)}
                            <tr>
                                <td className={td}>{t('roofStructure.valley')}</td>
                                <td className={td} style={{ background: SHEET_COLORS.input }}>
                                    <TextCell value={input.valley.desc} ariaLabel={t('roofStructure.valleySteelSize')} onCommit={v => set('valley', { desc: v ?? '' })} />
                                </td>
                                <td className={td}><NumSelect value={input.valley.c} options={DOUBLE_C_OPTIONS} label={t('roofStructure.doubleC')} onChange={c => set('valley', { c })} /></td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                            </tr>
                            {areaSpec('rafter', t('roofStructure.rafter'), input.rafter)}
                            {areaSpec('purlin', t('roofStructure.purlin'), input.purlin)}
                        </tbody>
                    </table>
                </div>
                <div className="mt-2 max-w-2xl">
                    {areaOverride('rafter', t('roofStructure.rafter'), input.rafter)}
                    {areaOverride('purlin', t('roofStructure.purlin'), input.purlin)}
                </div>
                <div className="mt-2 text-[12px] text-gray-500">
                    {t('roofStructure.doubleC2CSections')}{STICK_LENGTH}{t('common.m3')}
                </div>
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: t('roofStructure.wallPlate'), value: outputs.R152, unit: t('roofStructure.pieces'), digits: 0 },
                    { label: t('roofStructure.kingPost2'), value: outputs.R153, unit: t('roofStructure.pieces'), digits: 0 },
                    { label: t('roofStructure.ridge'), value: outputs.R154, unit: t('roofStructure.pieces'), digits: 0 },
                    { label: t('roofStructure.valley'), value: outputs.R155, unit: t('roofStructure.pieces'), digits: 0 },
                    { label: t('roofStructure.rafter'), value: outputs.R156, unit: t('roofStructure.pieces'), digits: 0 },
                    { label: t('roofStructure.purlin'), value: outputs.R157, unit: t('roofStructure.pieces'), digits: 0 },
                ]}
                note={<>{t('roofStructure.roofFrameSteelPerPiece')}{STICK_LENGTH}{t('roofStructure.mRoofFrameLabourIs')}{formatNumber(outputs.R159)}{t('common.sqM2')}</>} />
        </CalculatorShell>
    );
}
