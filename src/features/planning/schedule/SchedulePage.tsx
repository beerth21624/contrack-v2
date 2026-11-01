'use client';

// S-Curve_Plan_Basic (Excel v5 sheet 03): 32 tasks in 8 งวด, typed start dates, durations from Man-Day,
// weekly plan/actual shares, the S-curve and the status block Q4–Q7.
import { useMemo, useState } from 'react';
import { Segmented, Tag, Tooltip } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, RiseOutlined } from '@ant-design/icons';
import { InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { usePlanningText } from '../usePlanningText';
import { bucketIndexOf, isoToSerial, paceFromSchedule, serialToIso, type ScheduleInput, type ScheduleTaskInput } from '@/domain/planning';
import { SCurveChart } from '../shared/charts';
import {
    DateCell, DetailSection, NoBoqYet, PlanningHeader, StatTile, SummaryBanner, formatDate, money, usePlanning, usedBucketCount,
} from '../shared/planning-ui';
import { ActualTable } from './ActualTable';
import { CrewCalendar } from './CrewCalendar';
import { GanttTable } from './GanttTable';
import { PaceGaugePanel, PaceStatusChip } from './PaceGauge';
import { ScheduleDetailGrid } from './ScheduleDetailGrid';
import { SchedulePrintButton } from './SchedulePrintButton';

export function SchedulePage() {
    const { project, planning, input, stored, setPlanning, result } = usePlanning();
    const { t: tr, sample } = usePlanningText();
    const [view, setView] = useState<'table' | 'calendar'>('table');
    const sc = input.schedule;
    const s = planning.schedule;
    const save = (next: ScheduleInput) => setPlanning({ schedule: next });
    const setTask = (id: string, patch: Partial<ScheduleTaskInput>) =>
        save({ ...sc, tasks: { ...sc.tasks, [id]: { ...(sc.tasks[id] ?? { start: '' }), ...patch } } });

    /** Moves every planned start by the same number of days (the project start is the first task's start). */
    const shiftStart = (iso: string | undefined) => {
        const from = isoToSerial(s.start);
        const to = isoToSerial(iso);
        if (from === null || to === null || from === to) return;
        const tasks = Object.fromEntries(Object.entries(sc.tasks).map(([id, t]) => {
            const st = isoToSerial(t.start);
            return [id, st === null ? t : { ...t, start: serialToIso(st + to - from) }];
        }));
        save({ ...sc, tasks });
    };

    const status = s.status;
    const lastSerial = isoToSerial(status.lastUpdate);
    const lastBucket = lastSerial === null ? -1 : bucketIndexOf(s.buckets, lastSerial);
    const count = usedBucketCount(s.buckets, s.planWeekly, s.actualWeekly);
    const actualCount = s.tasks.filter(t => t.actual.finish !== null).length;
    const delayTone = status.delayStatus === 'late' ? 'bad' : status.delayStatus === null ? 'default' : 'good';
    const pace = useMemo(() => paceFromSchedule(s), [s]);
    const delayText = status.delayDays === null ? ''
        : status.delayDays > 0 ? tr('schedule.delayAhead', { n: status.delayDays })
            : status.delayDays < 0 ? tr('schedule.delayLate', { n: -status.delayDays }) : tr('schedule.delayOnTime');

    return (
        <div className="flex flex-col gap-4">
            <PlanningHeader current="/schedule" title={tr('schedule.title')} sheetName="S-Curve_Plan_Basic"
                isDefault={stored.schedule === undefined} onReset={() => setPlanning({ schedule: undefined })} />
            <NoBoqYet constructionTotal={result.boq.constructionTotal} />

            <SummaryBanner headline={s.start && s.finish
                ? <>{tr('schedule.headline', { days: s.durationDays, start: formatDate(s.start), finish: formatDate(s.finish) })}</>
                : <>{tr('schedule.noStart')}</>}>
                {/* Progress, spending and delay are the tiles below: not repeated here. */}
                <span>{tr('schedule.summary', { budget: money(s.budget), tasks: s.tasks.length, installments: s.installments.length })}</span>
            </SummaryBanner>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SheetCard title={tr('schedule.projectInfo')} className="h-full">
                    <InputTextField label={tr('schedule.projectName')} value={sample(sc.projectName)} onChange={v => save({ ...sc, projectName: v })} />
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 py-1">
                        <span className="text-[13px] text-gray-700">{tr('schedule.projectStart')}</span>
                        <Tooltip title={tr('schedule.shiftHint')}>
                            <div><DateCell value={s.start} allowClear={false} ariaLabel={tr('schedule.projectStart')} onCommit={shiftStart} /></div>
                        </Tooltip>
                    </div>
                    <div className="text-[12px] text-gray-500 mt-1">
                        {tr('schedule.startNote')}
                    </div>
                </SheetCard>
                <div className="lg:col-span-2 grid grid-cols-2 gap-4 auto-rows-fr">
                    <StatTile label={tr('schedule.lastUpdate')} value={status.lastUpdate ? formatDate(status.lastUpdate) : '–'}
                        hint={actualCount ? tr('schedule.recordedTasks', { n: actualCount }) : tr('schedule.fillActuals')} />
                    <StatTile label={<Tooltip title={tr('schedule.plannedBudgetHint')}>
                        <span className="underline decoration-dotted">{tr('schedule.plannedBudget')}</span></Tooltip>}
                    value={money(status.earnedValue)} unit={tr('unit.baht')} hint={tr('schedule.fromProgress')} />
                    <StatTile label={tr('schedule.spent')} value={status.spent === null ? '–' : money(status.spent)} unit={status.spent === null ? undefined : tr('unit.baht')} />
                    <StatTile label={tr('schedule.delay')} tone={delayTone}
                        value={status.delayDays === null ? '–'
                            : <span className="flex items-center gap-1">
                                {status.delayStatus === 'late' ? <ClockCircleOutlined /> : status.delayStatus === 'ahead' ? <RiseOutlined /> : <CheckCircleOutlined />}
                                <span>{delayText}</span>
                            </span>} />
                </div>
            </div>

            {/* The pace gauge lives inside the S-curve card (no section of its own): gauge left, curve right. */}
            <SheetCard title={tr('schedule.scurveTitle')} collapsible extra={<PaceStatusChip pace={pace} />}>
                <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4 lg:gap-6 items-center">
                    <div className="lg:border-r lg:border-gray-100 lg:pr-6">
                        <PaceGaugePanel pace={pace} />
                    </div>
                    <SCurveChart buckets={s.buckets.slice(0, count)} plan={s.planCumulative.slice(0, count)}
                        actual={s.actualCumulative.slice(0, count)} actualUntil={Math.min(lastBucket, count - 1)}
                        planWeekly={s.planWeekly.slice(0, count)} />
                </div>
            </SheetCard>

            <SheetCard title={tr('schedule.timeline')} extra={(
                <span className="flex flex-wrap items-center justify-end gap-2 text-[12px] text-gray-500">
                    {view === 'table' && (
                        <span className="hidden sm:flex items-center">
                            <Tag color="blue" variant="filled">{tr('schedule.grid.planShort')}</Tag><Tag color="orange" variant="filled">{tr('schedule.actualWork')}</Tag>
                        </span>
                    )}
                    <Segmented size="small" value={view} onChange={v => setView(v === 'calendar' ? 'calendar' : 'table')}
                        options={[{ label: tr('schedule.viewTable'), value: 'table' }, { label: tr('schedule.viewCalendar'), value: 'calendar' }]} />
                    <SchedulePrintButton schedule={s} manday={planning.manday} fallbackName={project.meta.projectName} />
                </span>
            )}>
                {view === 'table'
                    ? <>
                        <GanttTable schedule={s} tasks={sc.tasks} count={count} onTask={setTask} />
                        <div className="text-[12px] text-gray-500 mt-2">
                            {tr('schedule.tableNote')}
                        </div>
                    </>
                    : <>
                        <CrewCalendar schedule={s} manday={planning.manday} />
                        <div className="text-[12px] text-gray-500 mt-3">
                            {tr('schedule.calendarNote')}
                        </div>
                    </>}
            </SheetCard>

            <DetailSection label={`${tr('schedule.actualSection')}${actualCount ? tr('schedule.actualSectionCount', { n: actualCount }) : ''}`}>
                <ActualTable schedule={s} tasks={sc.tasks} onTask={setTask} />
                <div className="text-[12px] text-gray-500 mt-2">
                    {tr('schedule.actualNote')}
                </div>
            </DetailSection>

            <DetailSection label={tr('schedule.detailSection')}>
                <ScheduleDetailGrid schedule={s} />
            </DetailSection>
        </div>
    );
}

export default SchedulePage;
