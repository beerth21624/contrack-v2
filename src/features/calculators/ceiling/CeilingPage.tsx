'use client';

import {
    ceiling, ceilingRowArea, setCeilingCode, CEILING_CODES, CEILING_DEFAULT_PAINT, CEILING_DESCRIPTIONS,
    CEILING_DESCRIPTION_ORDER, CEILING_PAINT_GROUPS, paintGroupLabel, paintKey, SLOPED_CEILING_DEG,
    type CeilingCode, type CeilingInput, type CeilingPaintGroup, type CeilingRow,
} from '@/domain/calculators/ceiling';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, ChoiceButtons, EmptyState, FillProgress, NameInput, PlanCard, PlanField, PlanNumber, ResultSummary,
    countFill, fillState, insertAfter, nextCopyName, removeAt, type FillState,
} from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const isCode = (v: string): v is CeilingCode => (CEILING_CODES as readonly string[]).includes(v);
const isPaint = (v: string): v is CeilingPaintGroup => (CEILING_PAINT_GROUPS as readonly string[]).includes(v);

/** Scroll the table sideways instead of letting the รายการ dropdown squeeze the number columns. */
const TABLE_MIN_WIDTH = 1240;

/** Journey: short type names, with where the sample house uses each one. */
const plainType = (t: CalcT): Record<CeilingCode, string> => ({
    C1: t('ceiling.gypsumBoard9MmGeneral'),
    C2: t('ceiling.moistureResistantGypsumBoard9'),
    C3: t('ceiling.fibreCement4MmOutdoor'),
    C4: t('ceiling.fibreCementWoodSlats4'),
});
const plainPaint = (t: CalcT): Record<CeilingPaintGroup, string> => ({
    ภายใน: t('ceiling.interiorPaint'), ภายนอก: t('ceiling.exteriorPaint'), ไม้ระแนง: t('ceiling.woodStainSlats'),
});

const newJourneyRow = (): CeilingRow => ({ code: 'C1', width: 0, length: 0, location: '', paint: CEILING_DEFAULT_PAINT.C1 });

/** Journey: the four ceiling types as buttons (short names; the full name is the button's tooltip). */
const typeChoices = (t: CalcT) => CEILING_CODES.map(c => ({
    value: c,
    label: { C1: t('ceiling.gypsumBoard'), C2: t('ceiling.moistureResistantGypsum'), C3: t('ceiling.fibreCement'), C4: t('ceiling.woodSlats') }[c],
    hint: plainType(t)[c],
}));
const paintChoices = (t: CalcT): { value: CeilingPaintGroup | ''; label: string }[] => [
    ...CEILING_PAINT_GROUPS.map(g => ({ value: g, label: plainPaint(t)[g] })),
    { value: '', label: t('ceiling.noPaint') },
];

/** Plan values a room card still needs, in reading order. */
function missingOf(t: CalcT, r: CeilingRow): string[] {
    const eaves = r.code === 'C3';
    const out: string[] = [];
    if (r.code === '') out.push(t('ceiling.ceilingType'));
    if (!(r.width > 0)) out.push(eaves ? t('ceiling.eaveOverhang') : t('common.width'));
    if (!(r.length > 0)) out.push(eaves ? t('ceiling.eavePerimeterLength') : t('common.length2'));
    return out;
}
// A new room already has a type, so a card counts as started once a size is typed.
const stateOf = (t: CalcT, r: CeilingRow): FillState => fillState([missingOf(t, r).length === 0], r.width > 0 || r.length > 0);

/** Journey mode: one card per room, read off the ceiling plan; live area per room, results reduced to the totals. */
function CeilingJourney({ input, update, outputs }: {
    input: CeilingInput; update: UseCalculator<CeilingInput>['update']; outputs: Record<string, number>;
}) {
    const t = useTranslations('calculators');
    const rows = input.rows;
    const setRows = (edit: (rows: CeilingRow[]) => CeilingRow[]) => update(p => ({ ...p, rows: edit(p.rows) }));
    const editRow = (i: number, edit: (r: CeilingRow) => CeilingRow) => setRows(rs => rs.map((r, j) => (j === i ? edit(r) : r)));
    const setRow = (i: number, patch: Partial<CeilingRow>) => editRow(i, r => ({ ...r, ...patch }));
    const add = () => setRows(rs => [...rs, newJourneyRow()]);
    // "ทำซ้ำ": the same room right after it, under the next name (ห้องนอน 1 → ห้องนอน 2).
    const duplicate = (i: number) => setRows(rs => {
        const r = rs[i];
        return r ? insertAfter(rs, i, { ...r, location: nextCopyName(r.location, rs.map(x => x.location)) }) : rs;
    });
    const usedTypes = CEILING_CODES.filter(c => (outputs[c] ?? 0) !== 0);
    const states = rows.map(r => stateOf(t, r));

    const card = (r: CeilingRow, i: number) => {
        const state = states[i] ?? 'empty';
        const missing = state === 'missing' ? new Set(missingOf(t, r)) : new Set<string>();
        const eaves = r.code === 'C3';
        const area = ceilingRowArea(r);
        return (
            <PlanCard key={i} index={i + 1} state={state} scope={{ listKey: 'rows', itemIndex: i }}
                title={<NameInput value={r.location} placeholder={t('common.roomNameEGBedroom')} ariaLabel={t('common.roomNameV', { v: String(i + 1) })}
                    onChange={location => setRow(i, { location })} />}
                result={area > 0 ? t('common.vSqM', { v: formatNumber(area) }) : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => setRows(rs => removeAt(rs, i))} hasData={r.width > 0 || r.length > 0}
                deleteTitle={t('common.deleteThisRoom')} missingText={t('common.missingV', { v: missingOf(t, r).join(', ') })}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
                    <PlanField className="sm:col-span-3" label={t('ceiling.ceilingType')} fieldKey="code">
                        <ChoiceButtons ariaLabel={t('ceiling.ceilingType')} size="small" options={typeChoices(t)} value={r.code === '' ? undefined : r.code}
                            onChange={code => editRow(i, row => setCeilingCode(row, code))} />
                    </PlanField>
                    <PlanNumber label={eaves ? t('ceiling.eaveOverhang') : t('common.width')} fieldKey="width" unit={t('common.m')} value={r.width}
                        range={eaves ? [0.2, 2] : [0.3, 30]} missing={missing.has(eaves ? t('ceiling.eaveOverhang') : t('common.width'))}
                        onChange={width => setRow(i, { width })} />
                    <PlanNumber label={eaves ? t('ceiling.eavePerimeterLength') : t('common.length2')} fieldKey="length" unit={t('common.m')} value={r.length}
                        range={eaves ? [1, 300] : [0.3, 30]} missing={missing.has(eaves ? t('ceiling.eavePerimeterLength') : t('common.length2'))}
                        onChange={length => setRow(i, { length })} />
                    <PlanNumber label={t('ceiling.sloped')} unit={t('ceiling.degrees')} digits={0} value={r.slope ?? 0} range={[5, 60]}
                        hint={t('ceiling.leaveBlankForAFlat')} onChange={slope => setRow(i, { slope })} />
                    <PlanField className="sm:col-span-3" label={t('common.ceilingPaint')}>
                        <ChoiceButtons ariaLabel={t('common.ceilingPaint')} size="small" options={paintChoices(t)} value={r.paint}
                            onChange={paint => setRow(i, { paint })} />
                    </PlanField>
                </div>
            </PlanCard>
        );
    };

    return (
        <>
            <SheetCard title={t('ceiling.roomsAndCeilingTypes')}>
                {rows.length === 0
                    ? (
                        <EmptyState text={t('ceiling.noRoomsYetOpenThe')}
                            addLabel={t('common.addRoom')} onAdd={add} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {rows.length >= 5 && <FillProgress {...countFill(states)} noun={t('common.room')} />}
                            {rows.map(card)}
                            <AddButton label={t('common.addRoom')} onClick={add} />
                            <p className="text-[12px] text-gray-500">
                                {t('ceiling.anLShapedRoomIs')}
                            </p>
                        </div>
                    )}
            </SheetCard>

            <ResultSummary
                items={[
                    ...usedTypes.map(c => ({ label: plainType(t)[c], value: outputs[c], unit: t('common.sqM') })),
                    { label: t('ceiling.totalCeilingArea'), value: outputs.total, unit: t('common.sqM') },
                ]}
                note={CEILING_PAINT_GROUPS.some(g => (outputs[paintKey(g)] ?? 0) !== 0)
                    ? <>{t('ceiling.passedOnToThePainting')}{CEILING_PAINT_GROUPS.filter(g => (outputs[paintKey(g)] ?? 0) !== 0)
                        .map(g => t('ceiling.vV2SqM', { v: plainPaint(t)[g], v2: formatNumber(outputs[paintKey(g)]) })).join(' · ')}</>
                    : t('ceiling.thePaintedCeilingAreaPasses')} />
        </>
    );
}

export default function CeilingPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(ceiling);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={ceiling} result={result} isDefault={isDefault} onReset={reset}>
                <CeilingJourney input={input} outputs={outputs} update={update} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={ceiling} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('ceiling.ceilingQuantityTable')}>
                {/* The long รายการ texts would otherwise squeeze กว้าง/ยาว to ~40 px (62.30 shown as "62."). */}
                <div className="overflow-x-auto">
                    <div style={{ minWidth: TABLE_MIN_WIDTH }}>
                        <EditableTable<CeilingRow>
                            rows={input.rows}
                            onChange={rows => update({ rows })}
                            newRow={() => ({ code: '', width: 0, length: 0, location: '', paint: '' })}
                            addLabel={t('common.addItem')}
                            columns={[
                                { kind: 'select', key: 'code', title: t('common.symbol'), width: 80,
                                    options: CEILING_CODES.map(v => ({ value: v })),
                                    get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                                // Excel's C column is its own dropdown; here it selects the same code (O-13), in Excel's list order.
                                { kind: 'select', key: 'desc', title: t('common.item'), width: 380,
                                    options: CEILING_DESCRIPTION_ORDER.map(c => ({ value: c, label: CEILING_DESCRIPTIONS[c] })),
                                    get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                                { kind: 'number', key: 'width', title: t('common.widthM'), width: 80,
                                    get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 80,
                                    get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                                { kind: 'number', key: 'slope', title: t('ceiling.slopeDegrees'), width: 80, digits: 0,
                                    get: r => r.slope ?? 0, set: (r, v) => ({ ...r, slope: v }) },
                                { kind: 'calc', key: 'area', title: t('common.totalSqM'), width: 90, get: r => ceilingRowArea(r) },
                                { kind: 'text', key: 'location', title: t('common.location'), width: 150,
                                    get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                                { kind: 'select', key: 'paint', title: t('ceiling.paintWork'), width: 150,
                                    options: CEILING_PAINT_GROUPS.map(g => ({ value: g, label: paintGroupLabel(g) })),
                                    get: r => r.paint, set: (r, v) => ({ ...r, paint: isPaint(v) ? v : '' }) },
                            ]}
                        />
                    </div>
                </div>
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('common.totalSqMWidthLength')}</li>
                    <li>
                        {t('ceiling.slopedCeilingEGA')}{SLOPED_CEILING_DEG}{t('ceiling.forBalconies12Enter')}
                    </li>
                    <li>{t('ceiling.symbolsC1C4PoolThe')}</li>
                </ul>
            </SheetCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SheetCard title={t('ceiling.ceilingAreaSummarySentTo')}>
                    {CEILING_CODES.map(c => (
                        <CalcField key={c} label={`${c} ${CEILING_DESCRIPTIONS[c]}`} value={outputs[c]} unit={t('common.sqM')} />
                    ))}
                    <CalcField label={t('common.grandTotal')} value={outputs.total} unit={t('common.sqM')} strong />
                </SheetCard>
                <SheetCard title={t('ceiling.ceilingPaintAreaSummarySent')}>
                    {CEILING_PAINT_GROUPS.map(g => (
                        <CalcField key={g} label={paintGroupLabel(g)} value={outputs[paintKey(g)]} unit={t('common.sqM')} />
                    ))}
                </SheetCard>
            </div>
        </CalculatorShell>
    );
}
