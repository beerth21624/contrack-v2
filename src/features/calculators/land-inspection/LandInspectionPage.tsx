'use client';

import {
    checklistProgress, landInspection, lineTotal, LAND_INSPECTION_CHECKLIST, LAND_INSPECTION_CHECKLIST_KIND,
    type ChecklistAnswer, type CostLine, type LandInspectionInput,
} from '@/domain/calculators/land-inspection';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { EmptyState } from '@/components/sheet/journey';
import { ChecklistItem, ChecklistProgress } from '@/components/sheet/journey/ChecklistItem';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';

/** Rows 8–11 of the Excel sheet keep their fixed label; rows added after them are free text. */
const FIXED_ROWS = 4;
const NO_ANSWER: ChecklistAnswer = { done: false, note: '' };
const newCostLine = (): CostLine => ({ label: '', qty: 1, unit: '', unitPrice: 0 });

type Calc = UseCalculator<LandInspectionInput>;

export default function LandInspectionPage() {
    const t = useTranslations('calculators');
    const calc = useCalculator(landInspection);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;

    return (
        <CalculatorShell def={landInspection} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyView calc={calc} /> : (
                <>
                    <SheetCard title={t('landInspection.projectInformation')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                            <InputTextField label={t('landInspection.projectName')} value={input.projectName} onChange={v => update({ projectName: v })} />
                            <InputTextField label={t('landInspection.province')} value={input.province} onChange={v => update({ province: v })} />
                            <InputTextField label={t('landInspection.surveyDate')} value={input.surveyDate} placeholder={t('landInspection.ddMmYyyy')}
                                onChange={v => update({ surveyDate: v })} />
                            <InputTextField label={t('landInspection.inspector')} value={input.inspector} onChange={v => update({ inspector: v })} />
                        </div>
                    </SheetCard>

                    <SheetCard title={t('landInspection.expenseItems')}>
                        <CostTable calc={calc} />
                        <div className="mt-3 max-w-md ml-auto">
                            <CalcField label={t('landInspection.totalCost')} value={outputs.total} unit={t('common.baht')} strong />
                        </div>
                        <p className="mt-2 text-[12px] text-gray-500">
                            {t('landInspection.noteThisPriceIsA')}{formatNumber(outputs.total)} {t('landInspection.bahtSentToTheBoq')}
                        </p>
                    </SheetCard>

                    <SheetCard title={t('landInspection.siteSurveyDocumentChecklist')}>
                        <Checklist calc={calc} />
                    </SheetCard>
                </>
            )}
        </CalculatorShell>
    );
}

/** Guided journey: what to check on site first, then the cost (quantities up front, prices folded). */
function JourneyView({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update } = calc;
    return (
        <>
            <SheetCard title={t('landInspection.inspectTheLandBeforeStarting')}>
                <Checklist calc={calc} />
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <InputTextField label={t('landInspection.surveyDate')} value={input.surveyDate} placeholder={t('landInspection.ddMmYyyy')}
                        onChange={v => update({ surveyDate: v })} />
                    <InputTextField label={t('landInspection.inspector')} value={input.inspector} onChange={v => update({ inspector: v })} />
                </div>
            </SheetCard>

            <SheetCard title={t('landInspection.landInspectionExpenses')}>
                {input.items.length === 0
                    ? (
                        <EmptyState text={t('landInspection.noExpenseItemsYetE')}
                            addLabel={t('landInspection.addExpenseItem')}
                            onAdd={() => update(p => ({ ...p, items: [...p.items, newCostLine()] }))} />
                    )
                    : (
                        <>
                            <p className="mb-2 text-[12px] text-gray-500">{t('landInspection.enterTheActualNumberOf')}</p>
                            <EditableTable<CostLine>
                                rows={input.items}
                                onChange={items => update({ items })}
                                canDelete={false}
                                columns={[
                                    { kind: 'label', key: 'label', title: t('common.item'), get: r => r.label || t('landInspection.newItem') },
                                    { kind: 'number', key: 'qty', title: t('common.number'), width: 90, get: r => r.qty, set: (r, v) => ({ ...r, qty: v }) },
                                    { kind: 'label', key: 'unit', title: t('common.unit'), width: 70, get: r => r.unit },
                                    { kind: 'calc', key: 'total', title: t('landInspection.totalBaht'), width: 120, get: r => lineTotal(r) },
                                ]}
                            />
                        </>
                    )}
            </SheetCard>

            <AdvancedSection title={t('landInspection.pricePerUnitAndAdditional')}>
                <CostTable calc={calc} />
            </AdvancedSection>
            {/* No result box: the only result is the cost, already shown as มูลค่าขั้นตอนนี้ in the bottom bar. */}
        </>
    );
}

/** The full cost table of the sheet (rows 8–11 plus added rows). */
function CostTable({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update } = calc;
    return (
        <EditableTable<CostLine>
            rows={input.items}
            onChange={items => update({ items })}
            lockedRows={FIXED_ROWS}
            newRow={newCostLine}
            addLabel={t('common.addItem')}
            columns={[
                {
                    kind: 'label', key: 'label', title: t('landInspection.expenseItems'),
                    get: (r, i) => i < FIXED_ROWS
                        ? r.label
                        : <TextCell value={r.label} placeholder={t('common.itemName')}
                            onCommit={v => update(p => ({ ...p, items: p.items.map((x, j) => j === i ? { ...x, label: v ?? '' } : x) }))} />,
                },
                { kind: 'number', key: 'qty', title: t('common.number'), width: 90, get: r => r.qty, set: (r, v) => ({ ...r, qty: v }) },
                { kind: 'text', key: 'unit', title: t('common.unit'), width: 80, get: r => r.unit, set: (r, v) => ({ ...r, unit: v }) },
                { kind: 'number', key: 'unitPrice', title: t('common.pricePerUnit'), width: 120, get: r => r.unitPrice, set: (r, v) => ({ ...r, unitPrice: v }) },
                { kind: 'calc', key: 'total', title: t('common.total'), width: 120, get: r => lineTotal(r) },
                { kind: 'text', key: 'note', title: t('common.remark'), width: 160, get: r => r.note ?? '', set: (r, v) => ({ ...r, note: v || undefined }) },
            ]}
        />
    );
}

/**
 * The 5 questions of the site-inspection checklist: yes / no answered with two buttons (a "no" asks for the
 * problem found), the open question answered in writing, and the progress on top.
 */
function Checklist({ calc }: { calc: Calc }) {
    const { input, update } = calc;
    return (
        <div className="flex flex-col gap-2">
            <ChecklistProgress {...checklistProgress(input.checklist)} />
            {LAND_INSPECTION_CHECKLIST.map((q, i) => {
                const a = input.checklist[i] ?? NO_ANSWER;
                const meta = LAND_INSPECTION_CHECKLIST_KIND[i];
                // Merge into the latest stored answer, not the one captured at render time.
                const setAnswer = (patch: Partial<ChecklistAnswer>) => update(p => ({
                    ...p,
                    checklist: LAND_INSPECTION_CHECKLIST.map((_, j) => {
                        const prev = p.checklist[j] ?? NO_ANSWER;
                        return j === i ? { ...prev, ...patch } : prev;
                    }),
                }));
                return (
                    <ChecklistItem key={q} index={i + 1} question={q} hint={meta?.hint} kind={meta?.kind ?? 'yesno'}
                        problemIf={meta?.problemIf} value={a} onChange={setAnswer} />
                );
            })}
        </div>
    );
}
