'use client';

// The two W3 numbers on top of the "ทีมงาน" page (docs/workforce/00-crew-management-design.md §4): the finish as
// crewed against the S-Curve, and the labour as crewed against the Man-Day labour of the same tasks. Presentational:
// the numbers come from team-metrics.ts. Money shows only for those who may see crew costs, and only when every crew
// compared has a known ฿/day (never a ฿0 standing in for a hidden or missing cost).
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatDate } from '@/features/planning/shared/planning-ui';
import { PLAN_TASKS } from '@/domain/planning/tasks';
import { usePlanningText } from '@/features/planning/usePlanningText';
import { WORKSPACE_CREWS_HREF } from './project-workforce';
import { bahtText, finishDeltaText, labourDeltaText, type FinishMetric, type LabourMetric } from './team-metrics';

const TASK_NAMES = new Map(PLAN_TASKS.map(t => [t.id, t.name]));

function Tile({ label, value, children, testId }: { label: string; value: ReactNode; children?: ReactNode; testId: string }) {
    return (
        <div className="rounded-card border border-gray-200 bg-white px-3 py-2 min-w-0 shadow-card" data-metric={testId}>
            <div className="text-[12px] text-gray-500 leading-tight">{label}</div>
            <div className="text-[18px] font-semibold leading-tight mt-0.5 text-gray-900 tabular-nums">{value}</div>
            {children !== undefined && <div className="mt-1 flex flex-col gap-0.5 text-[12px] leading-snug text-gray-500">{children}</div>}
        </div>
    );
}

const quiet = (text: string) => <span className="text-[14px] font-normal text-gray-500">{text}</span>;

export function TeamMetrics({ finish, labour }: {
    finish: FinishMetric;
    /** undefined: the viewer may not see crew costs (no labour tile). */
    labour: LabourMetric | undefined;
}) {
    const t = useTranslations('workforce');
    if (finish.crewedFinish === null) return null;
    const showLabour = labour !== undefined && labour.taskIds.length > 0;
    return (
        <div className={`grid grid-cols-1 gap-3 min-w-0 ${showLabour ? 'sm:grid-cols-2' : ''}`}>
            <Tile testId="finish" label={t('team.metrics.finishLabel')} value={formatDate(finish.crewedFinish)}>
                {finish.days !== null && finish.planFinish !== null && (
                    <span>
                        <span className={finish.days < 0 ? 'text-green-700' : finish.days > 0 ? 'text-amber-700' : 'text-gray-700'}>
                            {finishDeltaText(finish.days)}
                        </span>
                        {' · '}{t('team.metrics.planDate', { date: formatDate(finish.planFinish) })}
                    </span>
                )}
                {finish.partial && <span>{t('team.metrics.partial')}</span>}
            </Tile>
            {showLabour && <LabourTile labour={labour} />}
        </div>
    );
}

function LabourTile({ labour }: { labour: LabourMetric }) {
    const t = useTranslations('workforce');
    const planning = usePlanningText();
    const excluded = labour.excludedTaskIds.map(id => {
        const name = TASK_NAMES.get(id);
        return name === undefined ? id : planning.task(id, name);
    }).join(', ');
    const scope = t('team.metrics.scope', { count: labour.taskIds.length });
    if (labour.crewCost === null || labour.diff === null) {
        return (
            <Tile testId="labour" label={t('team.metrics.labourLabel')}
                value={quiet(labour.missingCost === 'all' ? t('team.metrics.missingAll') : t('team.metrics.missingSome'))}>
                <span>
                    {t.rich('team.metrics.setWage', {
                        link: chunks => <Link href={WORKSPACE_CREWS_HREF} className="text-blue-600 hover:underline">{chunks}</Link>,
                    })}
                </span>
            </Tile>
        );
    }
    return (
        <Tile testId="labour" label={t('team.metrics.labourLabel')} value={bahtText(labour.crewCost)}>
            <span>
                <span className="text-gray-700">{labourDeltaText(labour.diff, labour.percent)}</span>
                {' · '}{t('team.metrics.boqLabour', { amount: bahtText(labour.boqLabour) })}
            </span>
            <span>{scope}</span>
            {excluded !== '' && <span>{t('team.metrics.excluded', { names: excluded })}</span>}
        </Tile>
    );
}
