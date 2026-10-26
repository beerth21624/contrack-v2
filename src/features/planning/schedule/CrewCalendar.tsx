'use client';

// ปฏิทินงาน: the plan of S-Curve_Plan_Basic as a month grid — the tasks running each day (coloured by งวด) and the
// crew they take (Man-Day ช่าง / คนงาน). Read-only: dates are edited in the task table.
import { useMemo, useState } from 'react';
import { Button } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { EmptyState } from '@/components/sheet/journey/EmptyState';
import {
    INSTALLMENTS, computeCrewCalendar, isoToSerial, serialToIso,
    type CrewCalendarDay, type CrewCalendarResult, type ManDayResult, type ScheduleResult,
} from '@/domain/planning';
import { formatDate, installmentColors } from '../shared/planning-ui';

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** Monday first. */
const WEEKDAYS_SHORT = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
const WEEKDAYS = ['วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์', 'วันอาทิตย์'];
/** Chips shown in a desktop cell before "+N งาน". */
const MAX_CHIPS = 3;

interface Ymd { y: number; m: number; d: number }

function parts(iso: string): Ymd {
    const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
    return { y, m: m - 1, d };
}

/** Months counted from year 0, so consecutive months differ by 1. */
const monthKey = (iso: string) => { const p = parts(iso); return p.y * 12 + p.m; };
const keyToIso = (key: number) => `${Math.floor(key / 12)}-${String((key % 12) + 1).padStart(2, '0')}-01`;
/** Monday = 0 … Sunday = 6. */
const weekdayOf = (serial: number) => (new Date(Date.UTC(1899, 11, 30 + serial)).getUTCDay() + 6) % 7;

/** "กุมภาพันธ์ 2026" (same year as the dates elsewhere on the page). */
const monthTitle = (key: number) => `${MONTHS[key % 12] ?? ''} ${Math.floor(key / 12)}`;

/** "วันอังคารที่ 10 กุมภาพันธ์ 2026". */
function longDate(iso: string): string {
    const p = parts(iso);
    const serial = isoToSerial(iso);
    const wd = serial === null ? '' : `${WEEKDAYS[weekdayOf(serial)] ?? ''}ที่ `;
    return `${wd}${p.d} ${MONTHS[p.m] ?? ''} ${p.y}`;
}

const crewText = (skilled: number, labourers: number) => `ช่าง ${skilled} · คนงาน ${labourers}`;
const tint = (hex: string) => `${hex}24`;

/** The days of a month grid, Monday first, padded with the neighbouring months' days to whole weeks. */
function monthCells(key: number): { iso: string; inMonth: boolean }[] {
    const first = isoToSerial(keyToIso(key));
    const next = isoToSerial(keyToIso(key + 1));
    if (first === null || next === null) return [];
    const from = first - weekdayOf(first);
    const count = Math.ceil((next - from) / 7) * 7;
    return Array.from({ length: count }, (_, i) => {
        const serial = from + i;
        return { iso: serialToIso(serial), inMonth: serial >= first && serial < next };
    });
}

export function CrewCalendar({ schedule, manday }: { schedule: ScheduleResult; manday: ManDayResult }) {
    const cal = useMemo(() => computeCrewCalendar(schedule, manday), [schedule, manday]);
    const byDate = useMemo(() => new Map(cal.days.map(d => [d.date, d])), [cal]);
    const [today] = useState(() => dayjs().format('YYYY-MM-DD'));
    /** null = the default month / day (today when it is inside the plan, else the first day of work). */
    const [month, setMonth] = useState<number | null>(null);
    const [picked, setPicked] = useState<string | null>(null);

    if (cal.start === null || cal.finish === null) {
        return (
            <EmptyState text="ยังไม่มีงานที่กำหนดวันเริ่ม"
                note="กำหนดวันเริ่มของแต่ละงานในมุมมองตารางงาน แล้วปฏิทินจะแสดงงานและจำนวนคนในแต่ละวัน" />
        );
    }
    const { start, finish } = cal;
    const inPlan = (iso: string) => iso >= start && iso <= finish;
    const firstKey = monthKey(start);
    const lastKey = monthKey(finish);
    const fallbackDay = inPlan(today) ? today : start;
    const current = Math.min(lastKey, Math.max(firstKey, month ?? monthKey(fallbackDay)));
    const selected = picked !== null && inPlan(picked) && monthKey(picked) === current
        ? picked
        : monthKey(fallbackDay) === current ? fallbackDay : firstPlanDayOf(current, start);

    const go = (key: number, day?: string) => {
        setMonth(key);
        setPicked(day ?? firstPlanDayOf(key, start));
    };
    const cells = monthCells(current);
    const selectedDay = byDate.get(selected);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center gap-1">
                    <Button icon={<LeftOutlined />} aria-label="เดือนก่อนหน้า" disabled={current <= firstKey}
                        onClick={() => go(current - 1)} />
                    <div className="min-w-[136px] text-center text-[16px] font-semibold text-gray-900" aria-live="polite">
                        {monthTitle(current)}
                    </div>
                    <Button icon={<RightOutlined />} aria-label="เดือนถัดไป" disabled={current >= lastKey}
                        onClick={() => go(current + 1)} />
                </div>
                <Button type="link" className="!px-1" disabled={current === firstKey} onClick={() => go(firstKey, start)}>
                    ไปเดือนที่เริ่มงาน
                </Button>
                <InstallmentLegend />
            </div>

            <PeakLine cal={cal} onShow={iso => go(monthKey(iso), iso)} />

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
                <div className="min-w-0 rounded-[6px] border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                        {WEEKDAYS_SHORT.map(w => (
                            <div key={w} className="py-1 text-center text-[12px] font-medium text-gray-500">{w}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-gray-100">
                        {cells.map(c => (
                            <DayCell key={c.iso} iso={c.iso} day={byDate.get(c.iso)} inMonth={c.inMonth}
                                inPlan={inPlan(c.iso)} isToday={c.iso === today} isSelected={c.iso === selected}
                                onSelect={() => setPicked(c.iso)} />
                        ))}
                    </div>
                </div>
                <DayDetail iso={selected} day={selectedDay} />
            </div>
        </div>
    );
}

/** First day of the month that is inside the plan (the plan start in its own month). */
function firstPlanDayOf(key: number, start: string): string {
    const first = keyToIso(key);
    return first < start ? start : first;
}

function DayCell({ iso, day, inMonth, inPlan, isToday, isSelected, onSelect }: {
    iso: string; day: CrewCalendarDay | undefined; inMonth: boolean; inPlan: boolean; isToday: boolean; isSelected: boolean;
    onSelect: () => void;
}) {
    const n = parts(iso).d;
    if (!inMonth) return <div className="bg-gray-50 min-h-[44px] md:min-h-[104px]" aria-hidden />;
    const tasks = day?.tasks ?? [];
    const label = tasks.length
        ? `${longDate(iso)}: ${tasks.length} งาน, ${crewText(day?.skilled ?? 0, day?.labourers ?? 0)}`
        : `${longDate(iso)}: ไม่มีงาน`;
    const number = (
        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] tabular-nums leading-none ${
            isToday ? 'bg-orange-500 font-semibold text-white' : inPlan ? 'text-gray-800' : 'text-gray-300'}`}>
            {n}
        </span>
    );
    if (!inPlan) {
        return <div className="bg-white min-h-[44px] md:min-h-[104px] p-1 md:p-1.5 flex justify-center md:justify-start items-start">{number}</div>;
    }
    return (
        <button type="button" onClick={onSelect} aria-pressed={isSelected} aria-label={label}
            title={isToday ? 'วันนี้' : undefined}
            className={`min-w-0 min-h-[44px] md:min-h-[104px] p-1 md:p-1.5 flex flex-col items-center md:items-stretch text-left
                cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400
                ${isSelected ? 'bg-orange-50 ring-1 ring-inset ring-orange-300' : 'bg-white hover:bg-gray-50'}`}>
            <span className="flex">{number}</span>
            {/* Phones: a dot per task. */}
            {tasks.length > 0 && (
                <span className="md:hidden mt-1 flex flex-wrap justify-center gap-0.5" aria-hidden>
                    {tasks.slice(0, MAX_CHIPS).map(t => (
                        <span key={t.id} className="size-1.5 rounded-full" style={{ background: installmentColors(t.installment).background }} />
                    ))}
                    {tasks.length > MAX_CHIPS && <span className="size-1.5 rounded-full bg-gray-300" />}
                </span>
            )}
            {/* Tablet and up: a chip per task and the day's crew. */}
            {tasks.length > 0 && (
                <span className="hidden md:flex flex-col gap-0.5 mt-1 min-w-0" aria-hidden>
                    {tasks.slice(0, MAX_CHIPS).map(t => {
                        const c = installmentColors(t.installment).background;
                        return (
                            <span key={t.id} className="block truncate rounded-[3px] pl-1.5 pr-1 text-[11px] leading-[18px] text-gray-800"
                                style={{ background: tint(c), boxShadow: `inset 2px 0 0 ${c}` }}>
                                <span className="tabular-nums text-gray-500">{t.id}</span> {t.name}
                            </span>
                        );
                    })}
                    {tasks.length > MAX_CHIPS && (
                        <span className="text-[11px] leading-[16px] text-gray-500 pl-1.5">+{tasks.length - MAX_CHIPS} งาน</span>
                    )}
                </span>
            )}
            {day !== undefined && day.total > 0 && (
                <span className="hidden md:block mt-auto pt-1 truncate text-[11px] leading-tight text-gray-500 tabular-nums" aria-hidden>
                    {crewText(day.skilled, day.labourers)}
                </span>
            )}
        </button>
    );
}

function DayDetail({ iso, day }: { iso: string; day: CrewCalendarDay | undefined }) {
    const tasks = day?.tasks ?? [];
    return (
        <section aria-label="งานในวันที่เลือก" className="rounded-[6px] border border-gray-200 bg-white">
            <div className="px-3 py-2 border-b border-gray-100">
                <div className="text-[14px] font-semibold text-gray-900">{longDate(iso)}</div>
                <div className="text-[13px] text-gray-600 tabular-nums">
                    {tasks.length && day
                        ? <>{tasks.length} งาน · {crewText(day.skilled, day.labourers)} · รวม {day.total} คน</>
                        : 'ไม่มีงานตามแผนในวันนี้'}
                </div>
            </div>
            {tasks.length > 0 && (
                <ul className="divide-y divide-gray-100">
                    {tasks.map(t => (
                        <li key={t.id} className="flex items-start gap-2 px-3 py-2">
                            <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ background: installmentColors(t.installment).background }} />
                            <div className="min-w-0 flex-1">
                                <div className="text-[13px] text-gray-900">
                                    <span className="tabular-nums text-gray-500 mr-1">{t.id}</span>{t.name}
                                </div>
                                <div className="text-[12px] text-gray-500 tabular-nums">
                                    {installmentLabel(t.installment)} · {formatDate(t.start)}{t.finish !== t.start ? ` – ${formatDate(t.finish)}` : ''}
                                </div>
                            </div>
                            <div className="shrink-0 text-right text-[12px] leading-snug text-gray-700 tabular-nums">
                                <div>ช่าง {t.skilled}</div>
                                <div>คนงาน {t.labourers}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

const installmentLabel = (no: number) => INSTALLMENTS.find(i => i.no === no)?.label ?? `งวดที่ ${no}`;

function InstallmentLegend() {
    return (
        <ul aria-label="สีตามงวด" className="md:ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-600">
            {INSTALLMENTS.map(i => (
                <li key={i.no} className="flex items-center gap-1">
                    <span className="size-2.5 rounded-[2px]" style={{ background: installmentColors(i.no).background }} />
                    งวด {i.no}
                </li>
            ))}
        </ul>
    );
}

/** "ใช้คนมากที่สุด 21 คน (ช่าง 8 · คนงาน 13) วันที่ 21/05/2026". Nothing when no task has a crew. */
function PeakLine({ cal, onShow }: { cal: CrewCalendarResult; onShow: (iso: string) => void }) {
    const first = cal.peakDays[0];
    const peak = first === undefined ? undefined : cal.days.find(d => d.date === first);
    if (first === undefined || peak === undefined) return null;
    const more = cal.peakDays.length - 1;
    return (
        <div className="text-[13px] text-gray-600 tabular-nums">
            ใช้คนมากที่สุด {cal.peakTotal} คน ({crewText(peak.skilled, peak.labourers)}) วันที่{' '}
            <button type="button" className="text-blue-600 hover:underline cursor-pointer" onClick={() => onShow(first)}>
                {formatDate(first)}
            </button>
            {more > 0 && <> และอีก {more} วัน</>}
        </div>
    );
}
