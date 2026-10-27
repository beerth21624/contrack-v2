'use client';

// ─── The timeline of the crew board: rows = crews (sticky name column), columns = days, bars absolutely positioned ───
// Light on purpose (30 crews × 90 days stays smooth): one positioned element per segment, the day grid and the
// Sunday shading are CSS backgrounds of each row, no chart library. Scrolls inside its own box both ways, with the
// day headers and the crew column sticky.
import { memo, useCallback, useMemo } from 'react';
import { Tooltip } from 'antd';
import { WORKFORCE_TRADE_LABEL, type CrewAssignmentDto, type PersonDto } from '@/shared/contract';
import {
    THAI_WEEKDAY_SHORT, monthHeaders, thaiDay, thaiDayRange, weekHeaders, type BoardDay, type BoardPreset, type BoardWindow,
    type WaitSegment, type WorkSegment,
} from '@/domain/workforce/board';
import { isoToSerial } from '@/domain/planning/calendar';
import {
    BAR_HEIGHT, DAY_WIDTH, LANE_HEIGHT, barDomId, percent, rowHeight, taskLabel,
    type BoardNames, type BoardRow, type ProjectColour,
} from './view';

const NAME_COL = 'w-[148px] md:w-[232px] shrink-0';
const MIN_ROW = 46;
const RED = '#DC2626';
const GREY: ProjectColour = { fill: '#E5E7EB', accent: '#6B7280', text: '#111827' };

export interface TimelineProps {
    rows: readonly BoardRow[];
    window: BoardWindow;
    days: readonly BoardDay[];
    preset: BoardPreset;
    today: string;
    colours: ReadonlyMap<string, ProjectColour>;
    names: BoardNames;
    peopleById: ReadonlyMap<string, PersonDto>;
    /** The open bar (outlined in the brand colour). */
    selectedId: string | undefined;
    /** Bars of other projects recede while a project filter is on. */
    focusProjectId: string | undefined;
    onOpen: (assignmentId: string) => void;
}

/** Offset of the first day in the window with weekday `dow` (0 = Sunday), or 0. */
function firstIndexOf(days: readonly BoardDay[], dow: number): number {
    const i = days.findIndex(d => d.dow === dow);
    return i === -1 ? 0 : i;
}

export function CrewTimeline(props: TimelineProps) {
    const { rows, window: w, days, preset, today } = props;
    const dw = DAY_WIDTH[preset];
    const width = days.length * dw;
    const sunday = firstIndexOf(days, 0);
    const monday = firstIndexOf(days, 1);
    const ts = isoToSerial(today);
    const ws = isoToSerial(w.from);
    const todayIndex = ts === null || ws === null ? -1 : ts - ws;
    const showToday = todayIndex >= 0 && todayIndex < days.length;

    // Grid of each row: week lines (Monday), day lines (not at 3 months), Sunday shade.
    const grid = useMemo((): React.CSSProperties => {
        const layers = [
            { img: 'linear-gradient(to right, #E5E7EB 0 1px, transparent 1px)', pos: `${String(monday * dw)}px 0`, size: `${String(7 * dw)}px 100%` },
            ...(preset === '3m' ? [] : [{ img: 'linear-gradient(to right, #F3F4F6 0 1px, transparent 1px)', pos: '0 0', size: `${String(dw)}px 100%` }]),
            { img: `linear-gradient(to right, #F5F6F8 0 ${String(dw)}px, transparent ${String(dw)}px)`, pos: `${String(sunday * dw)}px 0`, size: `${String(7 * dw)}px 100%` },
        ];
        return {
            width,
            backgroundImage: layers.map(l => l.img).join(', '),
            backgroundPosition: layers.map(l => l.pos).join(', '),
            backgroundSize: layers.map(l => l.size).join(', '),
            backgroundRepeat: 'repeat-x',
        };
    }, [dw, monday, sunday, width, preset]);

    // On mount (the page keys the timeline by window): bring today into view when the days do not fit the box,
    // a few days in from the left edge of the day area. DOM only, no state.
    const scrollToToday = useCallback((el: HTMLDivElement | null) => {
        const box = el?.parentElement;
        if (el === null || box === null || box === undefined || !showToday) return;
        const nameCol = el.querySelector<HTMLElement>('[data-name-col]')?.offsetWidth ?? 0;
        const target = nameCol + todayIndex * dw;
        const visible = box.clientWidth - nameCol;
        if (target - nameCol + dw > visible) box.scrollLeft = Math.max(0, todayIndex * dw - Math.min(3 * dw, visible / 4));
    }, [showToday, todayIndex, dw]);

    return (
        <div className="w-max min-w-full" ref={scrollToToday}>
            <Header days={days} window={w} preset={preset} width={width} today={today} />
            {rows.map(r => (
                <CrewRow key={r.crew.id} row={r} dw={dw} grid={grid} todayIndex={showToday ? todayIndex : -1} {...props} />
            ))}
        </div>
    );
}

function Header({ days, window: w, preset, width, today }: {
    days: readonly BoardDay[]; window: BoardWindow; preset: BoardPreset; width: number; today: string;
}) {
    const dw = DAY_WIDTH[preset];
    const months = monthHeaders(w);
    const weeks = weekHeaders(w);
    const cell = 'absolute top-0 h-full border-l border-gray-200 px-1.5 truncate leading-6';
    return (
        <div className="sticky top-0 z-20 flex bg-white border-b border-gray-200">
            <div data-name-col className={`${NAME_COL} sticky left-0 z-30 bg-white border-r border-gray-200 px-3 flex items-end pb-1.5 text-[12px] text-gray-500`}>
                ทีม
            </div>
            <div className="shrink-0" style={{ width }}>
                <div className="relative h-6 text-[12px] font-medium text-gray-700">
                    {months.map(m => (
                        <div key={m.offset} className={cell} style={{ left: m.offset * dw, width: m.days * dw }} title={m.label}>{m.label}</div>
                    ))}
                </div>
                <div className="relative h-6 text-[11px] text-gray-500 border-t border-gray-100 tabular-nums">
                    {weeks.map(k => (
                        <div key={k.offset} className={cell} style={{ left: k.offset * dw, width: k.days * dw }} title={k.label}>
                            {preset === '3m' ? (k.days >= 4 ? thaiDay(days[k.offset]?.iso ?? '') : '') : k.label}
                        </div>
                    ))}
                </div>
                {preset !== '3m' && (
                    <div className="relative h-9 border-t border-gray-100 tabular-nums">
                        {days.map((d, i) => {
                            const isToday = d.iso === today;
                            const tone = isToday ? 'text-orange-600 font-semibold' : d.dow === 0 ? 'text-gray-400' : 'text-gray-600';
                            return (
                                <div key={d.iso} data-day={d.iso} className={`absolute top-0 h-full flex flex-col items-center justify-center leading-[14px] ${tone}`}
                                    style={{ left: i * dw, width: dw }}>
                                    <span className="text-[10px]">{THAI_WEEKDAY_SHORT[d.dow]}</span>
                                    <span className="text-[12px]">{d.day}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

interface RowProps extends TimelineProps {
    row: BoardRow;
    dw: number;
    grid: React.CSSProperties;
    todayIndex: number;
}

const CrewRow = memo(function CrewRow({
    row, dw, grid, todayIndex, days, colours, names, peopleById, selectedId, focusProjectId, onOpen, window: w,
}: RowProps) {
    const h = Math.max(MIN_ROW, rowHeight(row.lanes));
    const lanesHeight = row.lanes * LANE_HEIGHT - (LANE_HEIGHT - BAR_HEIGHT);
    const top0 = Math.round((h - lanesHeight) / 2);
    const leader = row.crew.leaderId === null ? undefined : peopleById.get(row.crew.leaderId);
    const ws = isoToSerial(w.from) ?? 0;
    const colourOf = (projectId: string) => colours.get(projectId) ?? GREY;
    const sub = [WORKFORCE_TRADE_LABEL[row.crew.trade], leader === undefined ? undefined : `หัวหน้า ${leader.nickname ?? leader.name}`]
        .filter((x): x is string => x !== undefined).join(' · ');

    return (
        <div className="flex border-b border-gray-100 last:border-b-0" style={{ height: h }}>
            <div className={`${NAME_COL} sticky left-0 z-10 bg-white border-r border-gray-200 px-3 flex flex-col justify-center min-w-0`}>
                <div className="flex items-baseline gap-2 min-w-0">
                    <span className="truncate text-[13px] font-medium text-gray-900" title={row.crew.name}>{row.crew.name}</span>
                    <span className="ml-auto shrink-0 text-[12px] tabular-nums text-gray-500" title="อัตราการใช้ทีมในช่วงที่แสดง">
                        {percent(row.metrics.utilisation)}
                    </span>
                </div>
                <span className="truncate text-[12px] text-gray-500" title={sub}>
                    {row.crew.archivedAt !== null && <span className="text-gray-400">เก็บถาวร · </span>}{sub}
                </span>
            </div>
            <div className="relative shrink-0" style={grid}>
                {row.conflicts.map(c => {
                    const s = Math.max((isoToSerial(c.from) ?? ws) - ws, 0);
                    const e = Math.min((isoToSerial(c.to) ?? ws) - ws, days.length - 1);
                    if (e < s) return null;
                    return (
                        <div key={`${c.a.id}:${c.b.id}`} aria-hidden className="absolute inset-y-0 bg-red-50"
                            style={{ left: s * dw, width: (e - s + 1) * dw, borderTop: `3px solid ${RED}` }} />
                    );
                })}
                {todayIndex >= 0 && (
                    <div aria-hidden className="absolute inset-y-0 w-[2px] bg-orange-400/70" style={{ left: todayIndex * dw }} />
                )}
                {row.segments.map(s => {
                    if (s.kind === 'work') {
                        return (
                            <WorkBar key={s.assignment.id} seg={s} dw={dw} top={top0 + s.lane * LANE_HEIGHT} colour={colourOf(s.projectId)}
                                names={names} crewName={row.crew.name} selected={selectedId === s.assignment.id}
                                dim={focusProjectId !== undefined && focusProjectId !== s.projectId} onOpen={onOpen} />
                        );
                    }
                    if (s.kind === 'wait') {
                        return (
                            <WaitBar key={`w:${s.assignmentId}:${String(s.offset)}`} seg={s} dw={dw} top={top0} colour={colourOf(s.projectId)}
                                names={names} dim={focusProjectId !== undefined && focusProjectId !== s.projectId} onOpen={onOpen} />
                        );
                    }
                    const px = s.days * dw;
                    if (px < 64) return null;
                    return (
                        <span key={`i:${String(s.offset)}`} className="absolute text-[11px] text-gray-400 text-center truncate pointer-events-none tabular-nums"
                            style={{ left: s.offset * dw, width: px, top: top0, lineHeight: `${String(BAR_HEIGHT)}px` }}>
                            ว่าง {s.days} วัน
                        </span>
                    );
                })}
            </div>
        </div>
    );
});

function WorkBar({ seg, dw, top, colour, names, crewName, selected, dim, onOpen }: {
    seg: WorkSegment<CrewAssignmentDto>;
    dw: number; top: number; colour: ProjectColour; names: BoardNames; crewName: string; selected: boolean; dim: boolean;
    onOpen: (assignmentId: string) => void;
}) {
    const clippedLeft = seg.from !== seg.start;
    const clippedRight = seg.to !== seg.end;
    const conflict = seg.conflictWith.length > 0;
    const width = seg.days * dw - 2;
    const label = width < 44 ? seg.taskId : taskLabel(seg.taskId);
    const project = names.project(seg.projectId);
    const shadows = [conflict ? `inset 0 0 0 1.5px ${RED}` : undefined, selected ? '0 0 0 2px #F97316' : undefined]
        .filter((x): x is string => x !== undefined);
    return (
        <Tooltip mouseEnterDelay={0.25} title={(
            <div className="text-[12px] leading-5">
                <div className="font-medium">{project}</div>
                <div>{taskLabel(seg.taskId)}</div>
                <div className="tabular-nums">{thaiDayRange(seg.start, seg.end)} · {crewName}</div>
                {conflict && <div className="text-red-300">ชนกับงานอื่นของทีมนี้</div>}
            </div>
        )}>
            <button type="button" id={barDomId(seg.assignment.id)} data-from={seg.from} data-to={seg.to} onClick={() => onOpen(seg.assignment.id)}
                aria-label={`${project} ${taskLabel(seg.taskId)} ${thaiDayRange(seg.start, seg.end)}${conflict ? ' ชนกับงานอื่น' : ''}`}
                className="absolute flex items-center gap-1 px-1.5 text-left text-[12px] font-medium cursor-pointer border-0 overflow-hidden whitespace-nowrap transition-opacity focus-visible:outline-2 focus-visible:outline-orange-500"
                style={{
                    left: seg.offset * dw + 1, width: Math.max(width, 4), top, height: BAR_HEIGHT,
                    background: colour.fill, color: colour.text,
                    borderLeft: clippedLeft ? undefined : `3px solid ${colour.accent}`,
                    borderRadius: `${clippedLeft ? 0 : 4}px ${clippedRight ? 0 : 4}px ${clippedRight ? 0 : 4}px ${clippedLeft ? 0 : 4}px`,
                    boxShadow: shadows.length === 0 ? undefined : shadows.join(', '),
                    opacity: dim ? 0.35 : 1,
                    zIndex: selected ? 3 : conflict ? 2 : 1,
                }}>
                {conflict && width >= 44 && <span aria-hidden className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: RED }} />}
                <span className="truncate">{label}</span>
            </button>
        </Tooltip>
    );
}

function WaitBar({ seg, dw, top, colour, names, dim, onOpen }: {
    seg: WaitSegment; dw: number; top: number; colour: ProjectColour; names: BoardNames; dim: boolean;
    onOpen: (assignmentId: string) => void;
}) {
    const width = seg.days * dw - 2;
    return (
        <Tooltip mouseEnterDelay={0.15} title={(
            <div className="text-[12px] leading-5">
                <div className="font-medium">รอ {seg.lagDays} วัน · {seg.reason}</div>
                <div>{names.project(seg.projectId)} หลัง {taskLabel(seg.taskId)}</div>
                <div className="tabular-nums">{thaiDayRange(seg.waitStart, seg.waitEnd)}{seg.overridden ? ' · โครงการกำหนดเอง' : ''}</div>
                <div className="text-gray-300">ทีมว่าง ย้ายไปช่วยงานอื่นได้</div>
            </div>
        )}>
            <button type="button" onClick={() => onOpen(seg.assignmentId)}
                aria-label={`รอ ${String(seg.lagDays)} วัน ${seg.reason}`}
                className="absolute rounded-[4px] text-[11px] text-gray-600 cursor-pointer overflow-hidden whitespace-nowrap px-1.5 text-left tabular-nums focus-visible:outline-2 focus-visible:outline-orange-500"
                style={{
                    left: seg.offset * dw + 1, width: Math.max(width, 4), top, height: BAR_HEIGHT,
                    backgroundColor: '#FFFFFF',
                    backgroundImage: `repeating-linear-gradient(135deg, ${colour.accent}2E 0 3px, transparent 3px 7px)`,
                    border: `1px dashed ${colour.accent}80`,
                    opacity: dim ? 0.35 : 1,
                }}>
                {width >= 52 ? `รอ ${String(seg.days)} วัน` : ''}
            </button>
        </Tooltip>
    );
}
