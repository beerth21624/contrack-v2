'use client';

// Man-Day_Basic (Excel v5 sheet 02), planning columns O..U: crew per work block → daily wage → calculated
// days S (hint) → typed days T (→ S-Curve duration) and budget U (→ S-Curve budget).
// Layout: summary tiles across the top, then two tabs: แผนคน-วัน (the plan table) and อัตราค่าแรง (the wage sets
// as one table row each), so the page stays tidy with 2 wage sets or 20.
import { Button, Popconfirm, Segmented, Tooltip } from 'antd';
import { UndoOutlined } from '@ant-design/icons';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { NumberCell, formatNumber } from '@/components/sheet/NumberCell';
import { SheetCard } from '@/components/sheet/SheetFields';
import type { ManDayBlockInput, ManDayBlockResult, ManDayInput, WageSet } from '@/domain/planning';
import { isRoleReadOnly, useProjectStore } from '@/store/project-store';
import { CalcText, NoBoqYet, PlanningHeader, StatTile, SummaryBanner, formatDate, money, usePlanning } from '../shared/planning-ui';
import type { PlanningT } from '../text';
import { usePlanningText } from '../usePlanningText';
import { useCompanyLibrary } from './CompanyWageSets';
import { useManDayTab } from './manday-tab';
import { WageSetTable } from './WageSetTable';

interface Row {
    id: string;
    input: ManDayBlockInput;
    result: ManDayBlockResult;
}

const daysDigits = (v: number) => (Number.isInteger(v) ? 0 : 2);

function basisNote(r: ManDayBlockResult, share: number, tr: PlanningT): string | null {
    if (r.labourBasis === 'none') return tr('manday.noCalc');
    if (r.labourBasis === 'shareOfTotal') return tr('manday.shareOfTotal', { pct: formatNumber(share * 100, 0) });
    return null;
}

export function ManDayPage() {
    const { planning, input, stored, setPlanning, result } = usePlanning();
    const { t: tr, title: taskTitle, wageSet: wageSetText } = usePlanningText();
    const md = input.manday;
    const res = planning.manday;
    const sched = planning.schedule;
    const save = (next: ManDayInput) => setPlanning({ manday: next });
    // Cloud projects: the company rate-card library (pick a card in, save a user set out). Viewers can't edit the project.
    const library = useCompanyLibrary();
    const readOnly = useProjectStore(s => isRoleReadOnly(s.binding));
    const [tab, setTab] = useManDayTab();

    const rows: Row[] = res.blocks.map(b => ({
        id: b.id,
        result: b,
        input: md.blocks[b.id] ?? { skilled: b.skilled, labourers: b.labourers, wageSet: b.wageSet, days: b.days },
    }));
    const saveRows = (next: Row[]) => save({ ...md, blocks: { ...md.blocks, ...Object.fromEntries(next.map(r => [r.id, r.input])) } });
    const setBlock = (id: string, patch: Partial<ManDayBlockInput>) =>
        saveRows(rows.map(r => (r.id === id ? { ...r, input: { ...r.input, ...patch } } : r)));

    const differs = rows.filter(r => r.result.suggestedDays !== null && r.result.suggestedDays !== r.input.days);
    const applyAllSuggested = () => saveRows(rows.map(r => (
        r.result.suggestedDays === null ? r : { ...r, input: { ...r.input, days: r.result.suggestedDays } }
    )));
    const rates = (s: WageSet) => `${formatNumber(s.skilled, 0)}/${formatNumber(s.labourer, 0)}`;

    const columns: SheetColumn<Row>[] = [
        {
            kind: 'label', key: 'title', title: tr('manday.cols.task'), width: 250,
            get: r => {
                const note = basisNote(r.result, md.subcontractLabourShare, tr);
                return (
                    <div className="min-w-[200px] leading-tight py-0.5">
                        <span className="text-gray-400 mr-1 tabular-nums">{r.id}</span>{taskTitle(r.id, r.result.title)}
                        <div className="text-[11px] text-gray-400">{tr('manday.boqSection', { section: r.result.section })}{note ? ` · ${note}` : ''}</div>
                    </div>
                );
            },
        },
        { kind: 'number', key: 'skilled', title: <>{tr('manday.cols.skilled')}<br /><span className="font-normal">{tr('manday.cols.persons')}</span></>, width: 64, digits: 0, get: r => r.input.skilled, set: (r, v) => ({ ...r, input: { ...r.input, skilled: v } }) },
        { kind: 'number', key: 'labourers', title: <>{tr('manday.cols.labourers')}<br /><span className="font-normal">{tr('manday.cols.persons')}</span></>, width: 64, digits: 0, get: r => r.input.labourers, set: (r, v) => ({ ...r, input: { ...r.input, labourers: v } }) },
        { kind: 'calc', key: 'crew', title: <>{tr('manday.cols.crew')}<br /><span className="font-normal">{tr('manday.cols.persons')}</span></>, width: 72, digits: 0, get: r => r.result.crew },
        {
            kind: 'select', key: 'set', title: <>{tr('manday.cols.wageSet')}<br /><span className="font-normal">{tr('manday.cols.wageSetUnit')}</span></>, width: 130, popupWidth: 280,
            options: md.wageSets.map(s => ({
                value: s.id,
                selectedLabel: <span className="tabular-nums">{s.id} · {rates(s)}</span>,
                label: (
                    <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate">{wageSetText(s)}</span>
                        <span className="shrink-0 tabular-nums text-gray-500">{rates(s)}</span>
                    </span>
                ),
            })),
            // The set R really used: an unknown id in a stored block shows (and computes) as the task's Excel set.
            get: r => r.result.wageSet, set: (r, v) => ({ ...r, input: { ...r.input, wageSet: v } }),
        },
        { kind: 'calc', key: 'wage', title: <>{tr('manday.cols.dailyWage')}<br /><span className="font-normal">{tr('manday.cols.dailyWageUnit')}</span></>, width: 96, digits: 0, get: r => r.result.dailyWage },
        { kind: 'calc', key: 'labour', title: <>{tr('manday.cols.labour')}<br /><span className="font-normal">{tr('manday.cols.labourUnit')}</span></>, width: 110, digits: 2, get: r => (r.result.labourBasis === 'none' ? null : r.result.labourCost) },
        {
            kind: 'label', key: 'calcDays', title: <>{tr('manday.cols.calcDays')}<br /><span className="font-normal">{tr('manday.cols.daysUnit')}</span></>, width: 84,
            get: r => (
                <Tooltip title={r.result.calcDays === null
                    ? (r.result.labourBasis === 'none' ? tr('manday.noFormula') : tr('manday.noCrew'))
                    : tr('manday.calcFormula')}>
                    <div><CalcText>{r.result.calcDays === null ? '–' : formatNumber(r.result.calcDays, 2)}</CalcText></div>
                </Tooltip>
            ),
        },
        {
            kind: 'label', key: 'days', title: <>{tr('manday.cols.days')}<br /><span className="font-normal">{tr('manday.cols.daysEstimate')}</span></>, width: 110,
            get: r => {
                const s = r.result.suggestedDays;
                return (
                    <div className="flex items-center gap-1">
                        <div className="w-[56px]">
                            <NumberCell value={r.input.days} digits={daysDigits(r.input.days)} ariaLabel={tr('manday.estimateAria', { name: taskTitle(r.id, r.result.title) })}
                                onCommit={v => setBlock(r.id, { days: v ?? s ?? 0 })} />
                        </div>
                        {s !== null && s !== r.input.days && (
                            <Tooltip title={tr('manday.useCalcTip', { days: s })}>
                                <Button size="small" type="link" className="!px-0.5" icon={<UndoOutlined />}
                                    aria-label={tr('manday.useCalcAria', { days: s })} onClick={() => setBlock(r.id, { days: s })}>{s}</Button>
                            </Tooltip>
                        )}
                    </div>
                );
            },
        },
        { kind: 'calc', key: 'budget', title: <>{tr('manday.cols.budget')}<br /><span className="font-normal">{tr('manday.cols.budgetUnit')}</span></>, width: 116, digits: 2, get: r => r.result.budget },
    ];

    const footer = (
        <tr className="font-semibold bg-gray-50">
            <td className="border border-gray-200 px-2 py-1 text-right text-[13px]" colSpan={9}>{tr('manday.totals')}</td>
            <td className="border border-gray-200 px-2 py-1 text-right tabular-nums text-[13px]">{formatNumber(res.totalDays, daysDigits(res.totalDays))} {tr('unit.days')}</td>
            <td className="border border-gray-200 px-2 py-1 text-right tabular-nums text-[13px]">{formatNumber(res.totalBudget, 2)}</td>
        </tr>
    );

    return (
        <div className="flex flex-col gap-4">
            <PlanningHeader current="/man-day" title={tr('manday.title')} sheetName="Man-Day_Basic"
                isDefault={stored.manday === undefined} onReset={() => setPlanning({ manday: undefined })} />
            <NoBoqYet constructionTotal={result.boq.constructionTotal} />

            {/* The totals (days, budget, project duration) are the tiles below: the banner says what they mean. */}
            <SummaryBanner headline={<>{tr('manday.headline', { n: rows.length })}</>}>
                <span>
                    {tr('manday.bannerTotal')}
                </span>
                <span>{tr('manday.bannerHow')}</span>
            </SummaryBanner>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatTile label={tr('manday.tileTotalDays')} value={formatNumber(res.totalDays, 0)} unit={tr('unit.days')} />
                <StatTile label={tr('manday.tileDuration')} value={sched.durationDays} unit={tr('unit.days')}
                    hint={sched.start && sched.finish ? `${formatDate(sched.start)} – ${formatDate(sched.finish)}` : undefined} />
                <StatTile label={tr('manday.tileBudget')} value={money(res.totalBudget)} unit={tr('unit.baht')} />
            </div>

            {/* The page tabs sit in the card header (as ตารางงาน | ปฏิทิน on /schedule). */}
            <SheetCard
                title={(
                    <Segmented value={tab} onChange={v => setTab(v === 'rates' ? 'rates' : 'plan')}
                        options={[{ label: tr('manday.tabPlan'), value: 'plan' }, { label: tr('manday.tabRates', { n: md.wageSets.length }), value: 'rates' }]} />
                )}
                extra={tab !== 'plan' ? undefined : differs.length === 0
                    ? <span className="text-[12px] text-gray-500">{tr('manday.allMatch')}</span>
                    : (
                        // Wraps under the tabs on a phone instead of widening the page.
                        <span className="text-[12px] text-gray-500 flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                            <span>{tr('manday.someDiffer', { n: differs.length })}</span>
                            <Popconfirm title={tr('manday.applyAllTitle')} okText={tr('manday.applyAllOk')} cancelText={tr('header.cancel')}
                                onConfirm={applyAllSuggested}>
                                <Button size="small" icon={<UndoOutlined />}>{tr('manday.applyAll')}</Button>
                            </Popconfirm>
                        </span>
                    )}>
                {tab === 'plan' ? (
                    <>
                        <EditableTable rows={rows} columns={columns} onChange={saveRows} canDelete={false} footer={footer} />
                        <div className="text-[12px] text-gray-500 mt-2">
                            {tr('manday.legendBefore')} <UndoOutlined /> {tr('manday.legendAfter')}
                        </div>
                    </>
                ) : (
                    <WageSetTable md={md} save={save} library={library} readOnly={readOnly} />
                )}
            </SheetCard>
        </div>
    );
}

export default ManDayPage;
