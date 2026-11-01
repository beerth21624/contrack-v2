'use client';

// ─── The timesheet of a week: people × days. Click a cell = full day → half day → empty; OT hours under the day ───
// Each day is its own PUT (the day's draft entries are replaced); approved / paid entries show locked. Suggestions of
// a day (the crews of its site report) fill the empty day with one click.
import { useMemo, useState } from 'react';
import { Alert, App, Button, DatePicker, InputNumber, Select, Skeleton, Tag, Tooltip } from 'antd';
import { LeftOutlined, RightOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import type { PersonDto, TimesheetDayDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { usePeople } from '@/features/cloud/api/workforce';
import { DateText } from '../shared/DateText';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import {
    type GridRow, addDays, bangkokToday, mondayOf, nextDays, putBodyFromRows, rowFromSuggestion, rowsFromDay, rowsSignature, weekdayOf,
} from './form';
import { useApproveTimesheets, usePutTimesheetDay, useTimesheetDays } from './hooks';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function TimesheetGrid({ projectId, workspaceId, canRecord }: { projectId: string; workspaceId: string | undefined; canRecord: boolean }) {
    const t = useTranslations('labour');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const today = bangkokToday();
    const [start, setStart] = useState(() => mondayOf(today));
    const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
    const days = useTimesheetDays(projectId, dates);
    const people = usePeople(workspaceId);
    const put = usePutTimesheetDay(projectId);
    const approve = useApproveTimesheets(projectId);
    // Unsaved edits per date, the people added to the grid by hand, and the wages typed for people without one.
    const [edits, setEdits] = useState<Record<string, GridRow[]>>({});
    const [added, setAdded] = useState<string[]>([]);
    const [wages, setWages] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);

    const dayData: (TimesheetDayDto | undefined)[] = days.map(q => q.data);
    const loading = days.some(q => q.isLoading);
    const firstError = days.find(q => q.isError)?.error;
    const personMap = useMemo(() => new Map((people.data ?? []).map((p): [string, PersonDto] => [p.id, p])), [people.data]);
    const hasWage = useMemo(() => new Set((people.data ?? []).filter(p => p.dailyWage !== null).map(p => p.id)), [people.data]);
    const wagesHidden = dayData.some(d => d?.wagesHidden === true);

    const rowsOf = (i: number): GridRow[] => {
        const date = dates[i] ?? '';
        const e = edits[date];
        if (e !== undefined) return e;
        const d = dayData[i];
        return d === undefined ? [] : rowsFromDay(d);
    };
    const editable = (i: number): boolean => {
        const d = dayData[i];
        return canRecord && d !== undefined && d.canEdit && !d.entries.some(e => e.pendingApproval);
    };
    const lockedEntry = (i: number, personId: string) => dayData[i]?.entries.find(e => e.personId === personId && e.status !== 'draft');
    const nameOf = (id: string): string => personMap.get(id)?.name ?? dayData.flatMap(d => d?.entries ?? []).find(e => e.personId === id)?.personName ?? '–';

    // Rows of the grid: everybody with an entry / edit / suggestion taken in the week, plus the people added by hand.
    const personIds = useMemo(() => {
        const ids = new Set<string>(added);
        dayData.forEach(d => d?.entries.forEach(e => ids.add(e.personId)));
        Object.values(edits).forEach(rows => rows.forEach(r => ids.add(r.personId)));
        return [...ids].sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'th'));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [added, edits, days.map(q => q.dataUpdatedAt).join(','), personMap]);

    const dirtyDates = dates.filter((d, i) => {
        const e = edits[d];
        const data = dayData[i];
        return e !== undefined && data !== undefined && rowsSignature(e) !== rowsSignature(rowsFromDay(data));
    });

    const setCell = (i: number, personId: string, patch: Partial<GridRow> | 'cycle') => {
        const date = dates[i] ?? '';
        const rows = rowsOf(i);
        const cur = rows.find(r => r.personId === personId);
        let next: GridRow[];
        if (patch === 'cycle') {
            const n = nextDays(cur?.days ?? 0);
            if (n === 0) next = rows.filter(r => r.personId !== personId);
            else if (cur === undefined) next = [...rows, { personId, days: n, otHours: 0, crewId: null, costCodeId: null, source: 'manual', note: '', ...(wages[personId] === undefined ? {} : { dailyWage: wages[personId] }) }];
            else next = rows.map(r => (r.personId === personId ? { ...r, days: n } : r));
        } else {
            next = rows.map(r => (r.personId === personId ? { ...r, ...patch } : r));
        }
        setEdits(e => ({ ...e, [date]: next }));
    };

    const setWage = (personId: string, v: number | null) => {
        setWages(w => ({ ...w, [personId]: v ?? 0 }));
        setEdits(e => Object.fromEntries(Object.entries(e).map(([date, rows]) =>
            [date, rows.map(r => (r.personId === personId && v !== null ? { ...r, dailyWage: v } : r))])));
    };

    const fillFromDiary = (i: number) => {
        const d = dayData[i];
        if (d === undefined) return;
        const date = dates[i] ?? '';
        const rows = [...rowsOf(i)];
        for (const s of d.suggestions) {
            if (rows.some(r => r.personId === s.personId)) continue;
            const w = wages[s.personId];
            rows.push({ ...rowFromSuggestion(s), ...(w === undefined ? {} : { dailyWage: w }) });
        }
        setEdits(e => ({ ...e, [date]: rows }));
        setAdded(a => [...new Set([...a, ...d.suggestions.map(s => s.personId)])]);
    };

    const saveAll = async () => {
        setSaving(true);
        const failed: string[] = [];
        let firstErr: unknown = null;
        for (const date of dirtyDates) {
            const i = dates.indexOf(date);
            const existing = new Set((dayData[i]?.entries ?? []).map(e => e.personId));
            try {
                await put.mutateAsync({ date, body: putBodyFromRows(rowsOf(i), existing, hasWage) });
                setEdits(e => Object.fromEntries(Object.entries(e).filter(([k]) => k !== date)));
            } catch (err) {
                failed.push(date);
                firstErr ??= err;
            }
        }
        setSaving(false);
        if (failed.length === 0) void message.success(t('grid.saved'));
        else void message.error(`${failed.join(', ')}: ${toText(firstErr)}`);
    };

    const approveWeek = async () => {
        const to = dates[6] !== undefined && dates[6] < today ? dates[6] : today;
        try {
            const r = await approve.mutateAsync({ from: start, to });
            if (r.status === 'none') void message.info(t('approve.none'));
            else if (r.status === 'pending') void message.success(t('approve.pending', { count: r.entryCount }));
            else void message.success(t('approve.approved', { count: r.entryCount }));
        } catch (err) {
            void message.error(toText(err));
        }
    };

    const totalDays = (i: number): number => rowsOf(i).reduce((s, r) => s + r.days, 0) + (dayData[i]?.entries.filter(e => e.status !== 'draft').reduce((s, e) => s + e.days, 0) ?? 0);
    const personTotal = (personId: string): number => dates.reduce((s, _d, i) => {
        const r = rowsOf(i).find(x => x.personId === personId);
        const l = lockedEntry(i, personId);
        return s + (r?.days ?? 0) + (l?.days ?? 0);
    }, 0);
    const addable = (people.data ?? []).filter(p => p.archivedAt === null && !personIds.includes(p.id));

    return (
        <SectionCard
            title={t('grid.title')}
            extra={(
                <div className="flex flex-wrap items-center gap-2">
                    <Button icon={<LeftOutlined />} aria-label={t('grid.prevWeek')} onClick={() => setStart(addDays(start, -7))} />
                    <DatePicker allowClear={false} value={dayjs(start)} disabledDate={d => d.isAfter(dayjs(today), 'day')}
                        onChange={d => { if (d !== null) setStart(mondayOf(d.format('YYYY-MM-DD'))); }} />
                    <Button icon={<RightOutlined />} aria-label={t('grid.nextWeek')} disabled={addDays(start, 7) > today} onClick={() => setStart(addDays(start, 7))} />
                </div>
            )}
        >
            <div className="mb-3 text-[13px] text-gray-500">{t('grid.hint')}</div>
            {firstError !== undefined && <Alert className="mb-3" type="error" showIcon title={toText(firstError)} />}
            {people.isError && <Alert className="mb-3" type="error" showIcon title={toText(people.error)} />}
            {loading ? <Skeleton active /> : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] border-collapse text-[13px]">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600">
                                <th className="border border-gray-200 p-2 text-left font-medium">{t('grid.person')}</th>
                                {dates.map((d, i) => (
                                    <th key={d} className={`border border-gray-200 p-2 font-medium ${d > today ? 'opacity-50' : ''}`}>
                                        <div>{t(`grid.weekdays.${WEEKDAY_KEYS[weekdayOf(d)] ?? 'sun'}`)}</div>
                                        <div className="text-[12px] font-normal"><DateText value={d} /></div>
                                        {dayData[i]?.locked === true && <Tag className="!m-0 !mt-1" color="default">{t('grid.locked')}</Tag>}
                                        {dayData[i]?.entries.some(e => e.pendingApproval) === true && <Tag className="!m-0 !mt-1" color="processing">{t('grid.pending')}</Tag>}
                                        {editable(i) && (dayData[i]?.suggestions.length ?? 0) > 0 && rowsOf(i).length === 0 && (
                                            <div className="mt-1">
                                                <Tooltip title={t('grid.fillHint')}>
                                                    <Button size="small" icon={<ThunderboltOutlined />} onClick={() => fillFromDiary(i)}>{t('grid.fill')}</Button>
                                                </Tooltip>
                                            </div>
                                        )}
                                    </th>
                                ))}
                                <th className="border border-gray-200 p-2 text-right font-medium">{t('grid.total')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {personIds.length === 0 && (
                                <tr><td colSpan={9} className="border border-gray-200 p-4 text-center text-gray-500">{t('grid.empty')}</td></tr>
                            )}
                            {personIds.map(pid => {
                                const needsWage = !hasWage.has(pid);
                                return (
                                    <tr key={pid}>
                                        <td className="border border-gray-200 p-2 align-top">
                                            <div className="font-medium">{nameOf(pid)}</div>
                                            {needsWage && canRecord && (
                                                <div className="mt-1">
                                                    <MoneyInput size="small" placeholder={t('grid.wagePlaceholder')} value={wages[pid]} min={0}
                                                        onChange={v => setWage(pid, v)} />
                                                </div>
                                            )}
                                        </td>
                                        {dates.map((d, i) => {
                                            const row = rowsOf(i).find(r => r.personId === pid);
                                            const locked = lockedEntry(i, pid);
                                            const can = editable(i) && locked === undefined && d <= today;
                                            return (
                                                <td key={d} className="border border-gray-200 p-1 text-center align-top">
                                                    {locked !== undefined ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="font-medium tabular-nums">{locked.days}</span>
                                                            <StatusTag enumName="timesheetStatus" value={locked.status} />
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Button size="small" disabled={!can} type={row === undefined ? 'default' : 'primary'} className="!min-w-[44px]"
                                                                aria-label={t('grid.cell')} onClick={() => setCell(i, pid, 'cycle')}>
                                                                {row === undefined ? '–' : row.days === 1 ? t('grid.full') : t('grid.half')}
                                                            </Button>
                                                            {row !== undefined && (
                                                                <InputNumber size="small" className="!w-[64px]" min={0} max={24} step={0.5} inputMode="decimal" value={row.otHours}
                                                                    disabled={!can} placeholder={t('grid.otUnit')} onChange={v => setCell(i, pid, { otHours: v ?? 0 })} />
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="border border-gray-200 p-2 text-right tabular-nums">{personTotal(pid)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50 font-medium">
                                <td className="border border-gray-200 p-2">{t('grid.dayTotal')}</td>
                                {dates.map((d, i) => (
                                    <td key={d} className="border border-gray-200 p-2 text-center tabular-nums">
                                        {totalDays(i)}
                                        {!wagesHidden && typeof dayData[i]?.totals.amount === 'number' && (
                                            <div className="text-[12px] font-normal text-gray-500"><MoneyText value={dayData[i].totals.amount} /></div>
                                        )}
                                    </td>
                                ))}
                                <td className="border border-gray-200 p-2 text-right tabular-nums">{dates.reduce((s, _d, i) => s + totalDays(i), 0)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
            {canRecord && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Select className="min-w-[220px]" showSearch={{ optionFilterProp: 'label' }} value={null} placeholder={t('grid.addPerson')}
                        options={addable.map(p => ({ value: p.id, label: p.name }))} onChange={(v: string | null) => { if (v !== null) setAdded(a => [...a, v]); }} />
                    <div className="flex-1" />
                    <Button onClick={() => { void approveWeek(); }} loading={approve.isPending} disabled={dirtyDates.length > 0}>{t('approve.button')}</Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={dirtyDates.length === 0} onClick={() => { void saveAll(); }}>
                        {t('grid.save')}
                    </Button>
                </div>
            )}
        </SectionCard>
    );
}
