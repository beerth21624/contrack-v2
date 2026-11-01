'use client';

import {
    siteCamp, campLine, CAMP_GROUPS, type CampGroupDef, type CampMaterialLine, type SiteCampInput,
} from '@/domain/calculators/site-camp';
import type { ProjectResult } from '@/domain/project';
import type { BoqItemRow } from '@/domain/boq/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CountStepper, PlanField, ResultSummary } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

/** Room-count inputs with the sheet's hints (deck p16). */
const roomFields = (t: CalcT): { key: CampGroupDef['rooms']; label: string; hint: string; size: string }[] => [
    { key: 'workerRooms', label: t('siteCamp.numberOfWorkerRooms'), hint: t('siteCamp.sampleBase4RoomsOf'), size: t('siteCamp.eachRoom24X') },
    { key: 'toilets', label: t('siteCamp.numberOfToilets'), hint: t('siteCamp.sampleBase2RoomsOf'), size: t('siteCamp.eachRoom12X') },
    { key: 'showers', label: t('siteCamp.numberOfShowerRooms'), hint: t('siteCamp.sampleBase1RoomOf'), size: t('siteCamp.eachRoom15X') },
    { key: 'stores', label: t('siteCamp.numberOfStorerooms'), hint: t('siteCamp.sampleBase1RoomOf2'), size: t('siteCamp.eachRoom24X2') },
];

const td = 'border border-gray-200 px-2 py-1 text-[13px]';
const tdNum = `${td} text-right tabular-nums whitespace-nowrap`;

type Calc = UseCalculator<SiteCampInput>;

export default function SiteCampPage() {
    const t = useTranslations('calculators');
    const calc = useCalculator(siteCamp);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;

    return (
        <CalculatorShell def={siteCamp} result={result} isDefault={isDefault} onReset={reset}
            aside={inJourney ? undefined : <TakeOffSummary outputs={outputs} input={input} />}>
            {inJourney ? <JourneyView calc={calc} /> : (
                <>
                    <SheetCard title={t('common.requiredInput')} extra={<span className="text-[12px] text-gray-500">{t('siteCamp.section3SitePreparation')}</span>}>
                        {roomFields(t).map(f => (
                            <InputNumberField key={f.key} label={f.label} value={input[f.key]} digits={0} unit={t('common.room')} hint={f.hint}
                                onChange={v => update({ [f.key]: v } as Partial<SiteCampInput>)} />
                        ))}
                        <Allowances calc={calc} />
                    </SheetCard>

                    <SheetCard title={t('common.materialItems')}>
                        <MaterialTables calc={calc}
                            emptyText={t('siteCamp.noItemsYetTapAdd')} />
                        <p className="mt-3 text-[12px] text-gray-500">
                            {t('siteCamp.calculatedQuantityBaseQuantityQuantity')}
                        </p>
                    </SheetCard>
                </>
            )}
        </CalculatorShell>
    );
}

/** เผื่อวัสดุสูญเสีย and ค่าแรงติดตั้ง %. */
function Allowances({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update } = calc;
    return (
        <>
            {/* Sheet hint "แก้เป็น 0.05 = 5%" is for a fraction cell; this field is typed in percent. */}
            <InputNumberField label={t('common.materialWastage')} value={input.waste} percent unit="%" hint={t('siteCamp.enter5For5')}
                onChange={v => update({ waste: v })} />
            <InputNumberField label={t('siteCamp.installationLabour')} value={input.labourRate} percent unit={t('siteCamp.ofMaterialCost')} hint={t('siteCamp.usedInTheOverallBOQ')}
                onChange={v => update({ labourRate: v })} />
        </>
    );
}

/** The take-off table, one block per หมวด. */
function MaterialTables({ calc, emptyText }: { calc: Calc; emptyText: string }) {
    const t = useTranslations('calculators');
    const { input, update, outputs } = calc;

    /** Replace one group's rows, keeping the table ordered by group. */
    const setGroupRows = (group: CampGroupDef['id'], rows: CampMaterialLine[]) => update(p => ({
        ...p,
        materials: CAMP_GROUPS.flatMap(g => (g.id === group ? rows : p.materials.filter(m => m.group === g.id))),
    }));

    return (
        <div className="flex flex-col gap-5">
            {CAMP_GROUPS.map(g => {
                const rows = input.materials.filter(m => m.group === g.id);
                return (
                    <div key={g.id}>
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-semibold text-[13px] text-gray-800">{t('siteCamp.section')}{g.label}</span>
                            <span className="text-[12px] text-gray-500">{t('siteCamp.quantityEntered')}{formatNumber(input[g.rooms], 0)}{t('siteCamp.rooms')}</span>
                            <span className="ml-auto text-[13px] tabular-nums">
                                {t('siteCamp.materialTotal')}<b>{formatNumber(outputs[`mat_${g.id}`])}</b>{t('common.baht2')}
                            </span>
                        </div>
                        {rows.length === 0 && <p className="text-[12px] text-gray-500 mb-1">{emptyText}</p>}
                        <EditableTable<CampMaterialLine>
                            rows={rows}
                            onChange={r => setGroupRows(g.id, r)}
                            newRow={() => ({ group: g.id, code: '', item: '', unit: '', baseQty: 0, basePer: input[g.rooms] > 0 ? input[g.rooms] : 1, unitPrice: 0 })}
                            addLabel={t('siteCamp.addItem', { label: g.label })}
                            columns={[
                                { kind: 'text', key: 'code', title: t('siteCamp.code'), width: 130, get: r => r.code, set: (r, v) => ({ ...r, code: v }) },
                                { kind: 'text', key: 'item', title: t('common.materialItems'), get: r => r.item, set: (r, v) => ({ ...r, item: v }) },
                                { kind: 'text', key: 'unit', title: t('common.unit'), width: 64, get: r => r.unit, set: (r, v) => ({ ...r, unit: v }) },
                                { kind: 'number', key: 'baseQty', title: t('siteCamp.baseQuantity'), width: 84, get: r => r.baseQty, set: (r, v) => ({ ...r, baseQty: v }) },
                                { kind: 'number', key: 'basePer', title: t('siteCamp.perBase'), width: 64, digits: 0, get: r => r.basePer, set: (r, v) => ({ ...r, basePer: v }) },
                                { kind: 'calc', key: 'rooms', title: t('siteCamp.quantityEntered2'), width: 72, digits: 0, get: r => campLine(r, input).rooms },
                                { kind: 'calc', key: 'calcQty', title: t('siteCamp.calculatedQuantity'), width: 84, get: r => campLine(r, input).calcQty },
                                { kind: 'calc', key: 'grossQty', title: t('siteCamp.totalWithWastage'), width: 84, get: r => campLine(r, input).grossQty },
                                { kind: 'number', key: 'unitPrice', title: t('common.pricePerUnit'), width: 90, get: r => r.unitPrice, set: (r, v) => ({ ...r, unitPrice: v }) },
                                { kind: 'calc', key: 'total', title: t('siteCamp.materialTotal2'), width: 96, get: r => campLine(r, input).total },
                                { kind: 'text', key: 'note', title: t('common.remark'), width: 100, get: r => r.note ?? '', set: (r, v) => ({ ...r, note: v || undefined }) },
                            ]}
                        />
                    </div>
                );
            })}
        </div>
    );
}

/** The BOQ row a group's room count feeds (its per-room price is typed in the BOQ). */
function boqRow(result: ProjectResult, line: CampGroupDef['boqLine']): BoqItemRow | undefined {
    const row = result.boq.sections.find(s => s.no === 3)?.rows.find(r => r.key === line);
    return row?.type === 'item' ? row : undefined;
}

/** Guided journey: how many rooms of each kind; the take-off recipe, waste and labour % are folded. */
function JourneyView({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update, result } = calc;
    const groups = CAMP_GROUPS.map(g => {
        const row = boqRow(result, g.boqLine);
        return { g, rooms: input[g.rooms], perRoom: row ? row.matUnit + row.labUnit : 0 };
    });
    const anyRoom = groups.some(x => x.rooms > 0);
    return (
        <>
            <SheetCard title={t('siteCamp.thingsToBuildOnSite')}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                    {roomFields(t).map(f => (
                        <PlanField key={f.key} label={f.label} hint={f.size}>
                            <CountStepper value={input[f.key]} unit={t('common.room')} ariaLabel={f.label}
                                onChange={v => update({ [f.key]: v } as Partial<SiteCampInput>)} />
                        </PlanField>
                    ))}
                </div>
            </SheetCard>

            <AdvancedSection title={t('siteCamp.materialItemsAndDefaults')}>
                <Allowances calc={calc} />
                <div className="mt-3">
                    <MaterialTables calc={calc} emptyText={t('siteCamp.noMaterialItemsInThis')} />
                </div>
            </AdvancedSection>

            {/* What gets built; the money is มูลค่าขั้นตอนนี้ in the bottom bar. */}
            <ResultSummary
                items={anyRoom
                    ? groups.filter(x => x.rooms > 0).map(x => ({
                        label: x.g.boqDesc, value: x.rooms, unit: t('common.room'), digits: 0,
                        detail: t('siteCamp.bahtPerRoom', { v: formatNumber(x.perRoom, 0) }),
                    }))
                    : []}
                empty={t('siteCamp.enterTheNumberOfWorker')} />
        </>
    );
}

/** Take-off totals per group, for reference: the BOQ prices are not linked yet. */
function TakeOffSummary({ outputs, input }: { outputs: Record<string, number>; input: SiteCampInput }) {
    const t = useTranslations('calculators');
    const pct = formatNumber(input.labourRate * 100, 0);
    return (
        <SheetCard title={t('siteCamp.materialCostSummaryFromThe')}>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-[12px] text-gray-700">
                            <th className={td}>{t('siteCamp.section2')}</th><th className={td}>{t('common.room')}</th><th className={td}>{t('siteCamp.materialTotal2')}</th>
                            <th className={td}>{t('siteCamp.labour')}{pct}%</th><th className={td}>{t('siteCamp.materialRoom')}</th><th className={td}>{t('siteCamp.labourRoom')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {CAMP_GROUPS.map(g => (
                            <tr key={g.id}>
                                <td className={td}>{g.label}</td>
                                <td className={tdNum}>{formatNumber(input[g.rooms], 0)}</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs[`mat_${g.id}`])}</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs[`lab_${g.id}`])}</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs[`matPerRoom_${g.id}`])}</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs[`labPerRoom_${g.id}`])}</td>
                            </tr>
                        ))}
                        <tr className="font-semibold">
                            <td className={td} colSpan={2}>{t('common.total')}</td>
                            <td className={tdNum}>{formatNumber(outputs.materialTotal)}</td>
                            <td className={tdNum}>{formatNumber(outputs.labour)}</td>
                            <td className={`${td} text-right`} colSpan={2}>{t('siteCamp.grandTotal')}{formatNumber(outputs.total)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p className="mt-2 text-[12px] text-gray-500">
                {t('siteCamp.theNumberOfRoomsIs')}
            </p>
        </SheetCard>
    );
}
