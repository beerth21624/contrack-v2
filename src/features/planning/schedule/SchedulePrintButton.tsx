'use client';

// "พิมพ์ / PDF" of the S-Curve page: the Gantt table + S-Curve, or the ปฏิทินงาน (one page per chosen month).
// PDF = the browser's print dialog ("Save as PDF") on a print-only document, like the BOQ (BoqExportButtons).
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Checkbox, Dropdown, Modal, Tooltip, type MenuProps } from 'antd';
import { DownOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLocale, useTranslations } from 'next-intl';
import { computeCrewCalendar, type ManDayResult, type ScheduleResult } from '@/domain/planning';
import { runBrowserPrint } from '@/features/export/print-runner';
import {
    buildCalendarPrintModel, buildGanttPrintModel, calendarMonthOptions, scheduleFileBaseName,
    type CalendarPrintModel, type GanttPrintModel,
} from '@/features/export/schedule-print-model';
import { CalendarPrintDocument, GanttPrintDocument } from '@/features/export/SchedulePrintDocument';
import { useProjectTaskCrews } from '@/features/workforce/project-team/project-workforce';

type PrintJob = { kind: 'gantt'; model: GanttPrintModel } | { kind: 'calendar'; model: CalendarPrintModel };

export function SchedulePrintButton({ schedule, manday, fallbackName = '' }: {
    schedule: ScheduleResult;
    manday: ManDayResult;
    /** Printed when the S-Curve has no project name (the project's own name). */
    fallbackName?: string;
}) {
    const t = useTranslations('planning');
    const locale = useLocale();   // the printed document follows the UI language
    const [job, setJob] = useState<PrintJob | null>(null);
    const [picking, setPicking] = useState(false);
    const [months, setMonths] = useState<string[]>([]);
    const options = useMemo(() => calendarMonthOptions(computeCrewCalendar(schedule, manday), locale), [schedule, manday, locale]);
    /** Crew names of a company project with the workforce module on (undefined otherwise: the plain calendar). */
    const crews = useProjectTaskCrews();
    const ready = schedule.start !== null && options.length > 0;

    const print = (next: PrintJob) => runBrowserPrint({
        title: scheduleFileBaseName(next.kind, next.model.projectName, locale),
        mount: () => setJob(next),
        unmount: () => setJob(null),
    });

    const printGantt = () => print({ kind: 'gantt', model: buildGanttPrintModel(schedule, dayjs().format('YYYY-MM-DD'), fallbackName, locale) });
    const openCalendar = () => {
        setMonths(options.map(o => o.value));   // every month of the plan by default
        setPicking(true);
    };
    const printCalendar = () => {
        setPicking(false);
        print({ kind: 'calendar', model: buildCalendarPrintModel(schedule, manday, months, fallbackName, crews, locale) });
    };

    const menu: NonNullable<MenuProps['items']> = [
        { key: 'gantt', label: t('print.gantt') },
        { key: 'calendar', label: t('print.calendar') },
    ];
    const button = (
        <Dropdown disabled={!ready} trigger={['click']}
            menu={{ items: menu, onClick: ({ key }) => { if (key === 'gantt') printGantt(); else openCalendar(); } }}>
            <Button size="small" icon={<PrinterOutlined />} disabled={!ready}>
                {t('print.button')} <DownOutlined className="text-[10px]" />
            </Button>
        </Dropdown>
    );

    return (
        <>
            {ready ? button : <Tooltip title={t('print.disabled')}><span className="inline-flex">{button}</span></Tooltip>}
            <Modal open={picking} onCancel={() => setPicking(false)} destroyOnHidden title={t('print.dialogTitle')}
                okText={t('print.printN', { n: months.length })} cancelText={t('header.cancel')}
                okButtonProps={{ disabled: months.length === 0, icon: <PrinterOutlined /> }} onOk={printCalendar}>
                <div className="flex flex-col gap-3">
                    <div className="text-[13px] text-gray-600">{t('print.dialogHint')}</div>
                    <div className="flex gap-2">
                        <Button size="small" onClick={() => setMonths(options.map(o => o.value))}
                            disabled={months.length === options.length}>{t('print.selectAll')}</Button>
                        <Button size="small" onClick={() => setMonths([])} disabled={months.length === 0}>{t('print.clearAll')}</Button>
                    </div>
                    <Checkbox.Group value={months} onChange={v => setMonths(options.map(o => o.value).filter(m => v.includes(m)))}
                        className="!grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                        {options.map(o => <Checkbox key={o.value} value={o.value}>{o.label}</Checkbox>)}
                    </Checkbox.Group>
                </div>
            </Modal>
            {job !== null && createPortal(
                job.kind === 'gantt' ? <GanttPrintDocument model={job.model} /> : <CalendarPrintDocument model={job.model} />,
                document.body,
            )}
        </>
    );
}
