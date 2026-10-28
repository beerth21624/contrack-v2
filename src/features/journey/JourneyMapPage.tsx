'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Tag } from 'antd';
import { ArrowRightOutlined, CheckOutlined, DownOutlined, RightOutlined, TableOutlined } from '@ant-design/icons';
import { useProjectStore } from '@/store/project-store';
import { computeProject, type ProjectResult } from '@/domain/project';
import {
    JOURNEY, JOURNEY_LEVELS, currentLevel, journeyComplete, levelStates, levelTotal, missingRequirements, phaseOf,
    type JourneyLevel, type JourneyPhase, type LevelState,
} from '@/domain/journey';
import { formatNumber } from '@/components/sheet/NumberCell';
import { NewProjectButton } from './NewProjectButton';
import { BoqExportButtons } from '@/features/export/BoqExportButtons';
import { LevelAssignee, LevelPresenceAvatars, useCloudLevelInfo, type CloudLevelInfo } from '@/features/cloud/presence/LevelPresence';
import { RevisionButtons } from '@/features/cloud/revisions/RevisionButtons';
import { useCloud } from '@/features/cloud/state';

const baht = (v: number) => formatNumber(v, 0);
const numberOf = (level: JourneyLevel) => JOURNEY_LEVELS.indexOf(level) + 1;

/** Money of a group: its steps that are not marked "ไม่มีในโครงการนี้". */
function phaseMoney(phase: JourneyPhase, progress: Record<string, string>, result: ProjectResult): number {
    return phase.levels.reduce((s, l) => s + (progress[l.id] === 'skipped' ? 0 : levelTotal(l, result)), 0);
}

/** Small status mark of a step: number while open, a tick when done, a dash when not in this project. */
function StepMark({ state, n }: { state: LevelState; n: number }) {
    const base = 'shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums';
    if (state === 'done') return <span className={`${base} bg-green-600 text-white`}><CheckOutlined className="text-[11px]" /></span>;
    if (state === 'skipped') return <span className={`${base} border border-gray-300 text-gray-400`}>–</span>;
    if (state === 'current') return <span className={`${base} bg-orange-500 text-white ring-4 ring-orange-100`}>{n}</span>;
    return <span className={`${base} border border-gray-200 text-gray-400`}>{n}</span>;
}

function StepRow({ level, state, value, team, incomplete }: {
    level: JourneyLevel; state: LevelState; value: number; team: CloudLevelInfo;
    /** Required values a done step now lacks (a small amber dot; the step page lists them). */
    incomplete: number;
}) {
    const open = state !== 'locked';
    const right = state === 'current'
        ? <span className="text-[13px] font-medium text-orange-600 whitespace-nowrap">ทำต่อ <ArrowRightOutlined className="text-[11px]" /></span>
        : state === 'skipped' ? <span className="text-[12px] text-gray-400 whitespace-nowrap">ไม่มีในโครงการนี้</span>
            : state === 'done' && level.kind.type !== 'meta' ? <span className="text-[13px] tabular-nums text-gray-700 whitespace-nowrap">{baht(value)}</span>
                : null;
    const warn = state === 'done' && incomplete > 0 && (
        <span role="img" aria-label={`ข้อมูลยังไม่ครบ ${String(incomplete)} รายการ`} title={`ข้อมูลยังไม่ครบ ${String(incomplete)} รายการ`}
            className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500" />
    );
    const row = (
        <div className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors
            ${state === 'current' ? 'bg-orange-50/70' : open ? 'hover:bg-gray-50' : ''}`}>
            <StepMark state={state} n={numberOf(level)} />
            <div className="min-w-0">
                <div className={`text-[14px] leading-[22px] truncate ${open ? 'text-gray-900' : 'text-gray-400'} ${state === 'current' ? 'font-semibold' : ''}`}>
                    {level.title}
                </div>
                {team.enabled && <div className="mt-0.5"><LevelAssignee info={team} levelId={level.id} /></div>}
            </div>
            <div className="flex items-center gap-2">
                <LevelPresenceAvatars info={team} levelId={level.id} />
                {warn}
                {right}
            </div>
        </div>
    );
    return (
        <li>
            {open
                ? <Link href={`/journey/${level.id}`} aria-current={state === 'current' ? 'step' : undefined} className="block">{row}</Link>
                : <div title="ทำขั้นตอนก่อนหน้าให้เสร็จก่อน">{row}</div>}
        </li>
    );
}

function PhaseSection({ phase, index, states, progress, result, team, expanded, onToggle, incomplete }: {
    phase: JourneyPhase; index: number; states: Record<string, LevelState>; progress: Record<string, string>;
    result: ProjectResult; team: CloudLevelInfo; expanded: boolean; onToggle: () => void;
    incomplete: ReadonlyMap<string, number>;
}) {
    const done = phase.levels.filter(l => progress[l.id] !== undefined).length;
    const all = done === phase.levels.length;
    const current = phase.levels.some(l => states[l.id] === 'current');
    const future = phase.levels.every(l => states[l.id] === 'locked');
    const money = phaseMoney(phase, progress, result);
    return (
        <section className="bg-white rounded-card border border-gray-200 shadow-card overflow-hidden">
            <button type="button" onClick={onToggle} aria-expanded={expanded}
                className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 cursor-pointer hover:bg-gray-50/60">
                <span className="text-gray-300 text-[10px] w-3">{expanded ? <DownOutlined /> : <RightOutlined />}</span>
                <span className="text-[11px] font-semibold tabular-nums text-gray-400 w-5">{String(index + 1).padStart(2, '0')}</span>
                <span className={`text-[15px] font-semibold ${future ? 'text-gray-500' : 'text-gray-900'}`}>{phase.title}</span>
                {current && <span className="text-[12px] font-medium text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">กำลังทำ</span>}
                <span className="ml-auto flex items-center gap-4 text-[12px] tabular-nums">
                    <span className={all ? 'text-green-700' : 'text-gray-500'}>{all ? 'เสร็จแล้ว' : `${String(done)}/${String(phase.levels.length)}`}</span>
                    <span className="hidden sm:inline w-28 text-right text-gray-700">{money !== 0 ? `${baht(money)} บาท` : '—'}</span>
                </span>
            </button>
            {expanded && (
                <ol className="border-t border-gray-100 divide-y divide-gray-100 m-0 p-0 list-none">
                    {phase.levels.map(l => (
                        <StepRow key={l.id} level={l} state={states[l.id] ?? 'locked'} team={team} incomplete={incomplete.get(l.id) ?? 0}
                            value={progress[l.id] === 'skipped' ? 0 : levelTotal(l, result)} />
                    ))}
                </ol>
            )}
        </section>
    );
}

/** Progress as one bar split by group (each segment's width = its number of steps). */
function PhaseBar({ progress }: { progress: Record<string, string> }) {
    return (
        <div className="flex gap-1" aria-hidden>
            {JOURNEY.map(p => {
                const done = p.levels.filter(l => progress[l.id] !== undefined).length;
                return (
                    <div key={p.id} className="h-1.5 rounded-full bg-gray-100 overflow-hidden" style={{ flexGrow: p.levels.length }} title={p.title}>
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${String((done / p.levels.length) * 100)}%` }} />
                    </div>
                );
            })}
        </div>
    );
}

/** Where the money goes: each group's share of the project, as thin bars. */
function CostBreakdown({ progress, result }: { progress: Record<string, string>; result: ProjectResult }) {
    const rows = JOURNEY.map(p => ({ id: p.id, title: p.title, money: phaseMoney(p, progress, result) }));
    const max = Math.max(1, ...rows.map(r => r.money));
    const total = rows.reduce((s, r) => s + r.money, 0);
    return (
        <div className="flex flex-col gap-2.5">
            {rows.map(r => (
                <div key={r.id}>
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="text-gray-600 truncate">{r.title}</span>
                        <span className="tabular-nums text-gray-900">{baht(r.money)}</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gray-400" style={{ width: `${String((r.money / max) * 100)}%` }} />
                    </div>
                </div>
            ))}
            {total > 0 && <div className="text-[12px] text-gray-400">สัดส่วนตามมูลค่าแต่ละกลุ่มงาน</div>}
        </div>
    );
}

/** The project overview: what to do next, every step by group, and where the money stands. */
export function JourneyMapPage() {
    const project = useProjectStore(s => s.project);
    const progress = project.journey ?? {};
    const result = useMemo(() => computeProject(project), [project]);
    // Done steps that lack a required value since (edited later, or done before the rule existed).
    const incomplete = useMemo(() => new Map(JOURNEY_LEVELS
        .filter(l => project.journey?.[l.id] === 'done')
        .map(l => [l.id, missingRequirements(l.id, project).length] as const)), [project]);
    const states = levelStates(progress);
    const next = currentLevel(progress);
    const complete = journeyComplete(progress);
    const passed = JOURNEY_LEVELS.filter(l => progress[l.id] !== undefined).length;
    const team = useCloudLevelInfo();
    const cloudName = useCloud(s => s.project?.name);
    const title = project.meta.projectName !== '' ? project.meta.projectName : cloudName ?? 'โครงการของฉัน';
    const nextPhase = next ? phaseOf(next.id) : undefined;

    // Finished groups start folded, so the eye goes to what is left.
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(
        JOURNEY.filter(p => !p.levels.every(l => progress[l.id] !== undefined)).map(p => p.id),
    ));
    const toggle = (id: string) => setExpanded(prev => {
        const s = new Set(prev);
        if (s.has(id)) s.delete(id); else s.add(id);
        return s;
    });

    return (
        <div className="max-w-[1200px] mx-auto w-full flex flex-col gap-6">
            <header className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12px] text-gray-500">
                        <span>ภาพรวมโครงการ</span>
                        {project.start !== 'blank' && <Tag variant="filled" className="!text-[12px] !m-0">เทมเพลตบ้านเดี่ยว 1 ชั้น</Tag>}
                    </div>
                    <h1 className="m-0 mt-1 text-[26px] leading-tight font-semibold text-gray-900" style={{ overflowWrap: 'anywhere' }}>{title}</h1>
                    {project.meta.siteAddress !== '' && <div className="mt-1 text-[13px] text-gray-500">{project.meta.siteAddress}</div>}
                </div>
                <NewProjectButton />
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                <div className="flex flex-col gap-4 min-w-0">
                    {/* The one primary action of the page. */}
                    <div className="rounded-2xl bg-[#1c1c1f] text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                        {next ? (
                            <>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[12px] text-white/50">
                                        {passed === 0 ? 'เริ่มต้น' : 'ขั้นตอนถัดไป'} · {nextPhase?.title} · ขั้นตอน {numberOf(next)} จาก {JOURNEY_LEVELS.length}
                                    </div>
                                    <div className="mt-1 text-[22px] font-semibold leading-tight">{next.title}</div>
                                    <div className="mt-1.5 text-[13px] text-white/60 line-clamp-2">{next.planHint}</div>
                                </div>
                                <Link href={`/journey/${next.id}`} className="shrink-0">
                                    <Button type="primary" size="large" className="!h-11 !px-6">
                                        {passed === 0 ? 'เริ่มขั้นตอนแรก' : 'ทำต่อ'} <ArrowRightOutlined />
                                    </Button>
                                </Link>
                            </>
                        ) : (
                            <>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[12px] text-white/50">ครบทุกขั้นตอนแล้ว</div>
                                    <div className="mt-1 text-[22px] font-semibold leading-tight">สรุป BOQ ทั้งโครงการพร้อมใช้งาน</div>
                                    <div className="mt-1.5 text-[13px] text-white/60">ตรวจทาน ปรับราคา แล้วพิมพ์หรือส่งออกเพื่อส่งให้เจ้าของบ้าน</div>
                                </div>
                                <Link href="/boq" className="shrink-0">
                                    <Button type="primary" size="large" icon={<TableOutlined />} className="!h-11 !px-6">ดูสรุป BOQ</Button>
                                </Link>
                            </>
                        )}
                    </div>

                    {JOURNEY.map((phase, i) => (
                        <PhaseSection key={phase.id} phase={phase} index={i} states={states} progress={progress} result={result}
                            team={team} expanded={expanded.has(phase.id)} onToggle={() => { toggle(phase.id); }} incomplete={incomplete} />
                    ))}
                </div>

                <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
                    <div className="bg-white rounded-card border border-gray-200 shadow-card p-5">
                        <div className="text-[12px] text-gray-500">มูลค่าค่าก่อสร้าง</div>
                        <div className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-gray-900 leading-none">
                            {baht(result.boq.constructionTotal)} <span className="text-[13px] font-normal text-gray-500">บาท</span>
                        </div>
                        {result.boq.preConstructionTotal > 0 && (
                            <div className="mt-1.5 text-[12px] text-gray-500">
                                ไม่รวมค่าใช้จ่ายก่อนเริ่มงาน {baht(result.boq.preConstructionTotal)} บาท
                            </div>
                        )}
                        <div className="mt-5 flex items-baseline justify-between text-[12px]">
                            <span className="text-gray-500">ความคืบหน้า</span>
                            <span className="tabular-nums text-gray-900">{passed} จาก {JOURNEY_LEVELS.length} ขั้นตอน</span>
                        </div>
                        <div className="mt-2"><PhaseBar progress={progress} /></div>
                        <div className="mt-5 flex flex-wrap gap-2">
                            <Link href="/boq"><Button icon={<TableOutlined />}>เปิด BOQ</Button></Link>
                            {complete && <BoqExportButtons />}
                            {complete && <RevisionButtons />}
                        </div>
                    </div>

                    <div className="bg-white rounded-card border border-gray-200 shadow-card p-5">
                        <div className="text-[13px] font-semibold text-gray-900 mb-3">มูลค่าตามกลุ่มงาน</div>
                        <CostBreakdown progress={progress} result={result} />
                    </div>
                </aside>
            </div>
        </div>
    );
}
