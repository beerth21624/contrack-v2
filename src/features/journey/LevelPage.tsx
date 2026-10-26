'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Popconfirm, Result, Spin, Tag, Tooltip, Typography } from 'antd';
import {
    AppstoreOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined, FileSearchOutlined, LockOutlined,
    StepForwardOutlined, UndoOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '@/store/project-store';
import { computeProject } from '@/domain/project';
import {
    JOURNEY_LEVELS, currentLevel, getLevel, isUnlocked, levelTotal, nextLevel, phaseOf, previousLevel,
} from '@/domain/journey';
import { CALCULATOR_PAGES } from '@/features/calculators/pages';
import { formatNumber } from '@/components/sheet/NumberCell';
import { JourneyModeContext } from './JourneyMode';
import { BoqLevelInputs } from './BoqLevelInputs';
import { ProjectInfoInputs } from './ProjectInfoInputs';
import { LevelSoftLock } from '@/features/cloud/presence/LevelPresence';

const { Title, Text } = Typography;

const spinner = <div className="flex justify-center p-20"><Spin size="large" /></div>;

/** Bottom bar height before it is measured (one row on desktop). */
const BAR_HEIGHT_GUESS = 72;

/** Focus is somewhere the arrow keys mean something else (typing, a dropdown, a dialog): no step shortcut. */
function keyBelongsToField(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return target.closest([
        'input', 'textarea', 'select', '[role="combobox"]', '[role="listbox"]', '[role="slider"]', '[role="dialog"]',
        '[role="radiogroup"]', '[role="group"]', '[role="tablist"]', '[role="menu"]', '.ant-select', '.ant-picker',
        '.ant-segmented',
    ].join(', ')) !== null;
}

/**
 * Shift + ← / → : previous / next step. Only moves between steps; it never confirms one (an accidental key press
 * must not mark a half-filled step done), so → works only once the step is confirmed or marked not in the project.
 * Not while typing, in a dropdown or on a button group.
 */
function useStepShortcuts(onPrev: (() => void) | undefined, onNext: (() => void) | undefined) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.repeat || e.defaultPrevented) return;
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            if (keyBelongsToField(e.target) || keyBelongsToField(document.activeElement)) return;
            // Text being selected with Shift + arrows (caret browsing) keeps its meaning.
            const sel = window.getSelection();
            if (sel !== null && !sel.isCollapsed) return;
            const run = e.key === 'ArrowLeft' ? onPrev : onNext;
            if (!run) return;
            e.preventDefault();
            run();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onPrev, onNext]);
}

const SHORTCUT_HINT = 'ปุ่มลัด: Shift + → ขั้นตอนถัดไป · Shift + ← ขั้นตอนก่อนหน้า';

/** One journey level: what to read from the plan, the inputs, and the way on to the next level. */
export function LevelPage({ levelId }: { levelId: string }) {
    const router = useRouter();
    const project = useProjectStore(s => s.project);
    const setLevelMark = useProjectStore(s => s.setLevelMark);
    const result = useMemo(() => computeProject(project), [project]);
    const level = getLevel(levelId);
    // The fixed bottom bar wraps to two rows on phones: the page keeps that much room below its content.
    const [barHeight, setBarHeight] = useState(BAR_HEIGHT_GUESS);
    const barRef = useCallback((el: HTMLDivElement | null) => {
        if (!el) return undefined;
        const observer = new ResizeObserver(() => setBarHeight(el.offsetHeight));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const progress = project.journey ?? {};
    const mark = level ? progress[level.id] : undefined;
    const next = level ? nextLevel(level.id) : undefined;
    const prev = level ? previousLevel(level.id) : undefined;
    const unlocked = level !== undefined && isUnlocked(level.id, progress);
    const nextId = next?.id;
    const prevId = prev?.id;
    const goNextCb = useCallback(() => router.push(nextId !== undefined ? `/journey/${nextId}` : '/journey'), [router, nextId]);
    const primaryAction = useCallback(() => {
        if (level === undefined) return;
        if (mark === undefined) setLevelMark(level.id, 'done');
        goNextCb();
    }, [level, mark, setLevelMark, goNextCb]);
    const prevAction = useCallback(() => { if (prevId !== undefined) router.push(`/journey/${prevId}`); }, [router, prevId]);
    // The keyboard "next" only moves on from a step already decided; it never confirms one.
    useStepShortcuts(
        unlocked && prevId !== undefined ? prevAction : undefined,
        unlocked && mark !== undefined ? goNextCb : undefined,
    );

    if (!level) return <Result status="404" title="ไม่พบขั้นตอนนี้" extra={<Link href="/journey"><Button>กลับไปภาพรวมขั้นตอน</Button></Link>} />;

    const index = JOURNEY_LEVELS.indexOf(level);
    const phase = phaseOf(level.id);
    const remaining = JOURNEY_LEVELS.filter(l => progress[l.id] === undefined).length;
    const passedCount = JOURNEY_LEVELS.length - remaining;

    if (!isUnlocked(level.id, progress)) {
        const current = currentLevel(progress);
        return (
            <Result
                icon={<LockOutlined className="!text-gray-400" />}
                title={`ขั้นตอน "${level.title}" รอขั้นตอนก่อนหน้า`}
                subTitle="กรุณาทำขั้นตอนก่อนหน้าให้เสร็จก่อน จึงจะเริ่มขั้นตอนนี้ได้"
                extra={current && (
                    <Link href={`/journey/${current.id}`}><Button type="primary">ทำต่อ: {current.title}</Button></Link>
                )}
            />
        );
    }

    const Page = level.kind.type === 'calc' ? CALCULATOR_PAGES[level.kind.calc] : undefined;
    const goNext = goNextCb;
    const pass = primaryAction;
    const skip = () => {
        // "ไม่มีในโครงการนี้": the level's calculator goes back to empty so nothing of it stays in the BOQ.
        setLevelMark(level.id, 'skipped');
        goNext();
    };
    const total = levelTotal(level, result);
    // Pre-construction costs (land inspection) sit outside the construction total, as in the BOQ.
    const levelSections = result.boq.sections.filter(s => level.sections.includes(s.no));
    const outsideConstruction = levelSections.length > 0 && levelSections.every(s => !s.inConstructionTotal);

    return (
        <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full" style={{ paddingBottom: barHeight + 24 }}>
            {/* Compact progress that stays on top while the step is scrolled: where am I and how far (the overview says how many are left). */}
            <div className="sticky top-0 z-10 -mx-3 px-3 py-2 bg-[#f5f5f7]/95 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <Link href="/journey">
                        <Button icon={<AppstoreOutlined />} aria-label="ภาพรวมขั้นตอน">
                            <span className="hidden sm:inline">ภาพรวมขั้นตอน</span>
                        </Button>
                    </Link>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 text-[13px] min-w-0">
                            <span className="font-semibold text-gray-800 truncate">{level.title}</span>
                            <Text type="secondary" className="text-[12px] whitespace-nowrap">
                                {phase?.title} · ขั้นตอน {index + 1}/{JOURNEY_LEVELS.length}
                            </Text>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-gray-200 overflow-hidden" aria-hidden>
                            <div className="h-full bg-orange-400" style={{ width: `${String(Math.round((passedCount / JOURNEY_LEVELS.length) * 100))}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <LevelSoftLock levelId={level.id} />

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <Title level={3} style={{ margin: 0 }}>{level.title}</Title>
                    {mark === 'done' && <Tag color="green" icon={<CheckOutlined />}>เสร็จแล้ว</Tag>}
                    {mark === 'skipped' && <Tag icon={<StepForwardOutlined />}>ไม่มีในโครงการนี้</Tag>}
                </div>
                <div className="mt-3 flex gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                    <FileSearchOutlined className="text-blue-500 text-[20px] mt-0.5" />
                    <div>
                        <div className="text-[12px] font-semibold text-blue-700">ดูจากแบบแปลน</div>
                        <div className="text-[14px] text-gray-800">{level.planHint}</div>
                    </div>
                </div>
            </div>

            {mark === 'skipped'
                ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                        ขั้นตอนนี้ระบุว่า &quot;ไม่มีในโครงการนี้&quot; — ไม่นำมาคิดมูลค่า
                        <div className="mt-3">
                            <Button icon={<UndoOutlined />} onClick={() => setLevelMark(level.id, undefined)}>มีงานส่วนนี้ กลับไปกรอกข้อมูล</Button>
                        </div>
                    </div>
                )
                : (
                    <JourneyModeContext.Provider value>
                        {Page
                            ? <Suspense fallback={spinner}><Page /></Suspense>
                            : level.kind.type === 'meta' ? <ProjectInfoInputs />
                                : <BoqLevelInputs sections={level.sections} />}
                    </JourneyModeContext.Provider>
                )}

            <div ref={barRef}
                className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,.05)] pb-[env(safe-area-inset-bottom)]">
                {/* On a phone the buttons wrap under the total instead of squeezing it. */}
                <div className="max-w-6xl mx-auto px-3 py-2.5 sm:py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {prev
                        ? (
                            <Tooltip title={`ขั้นตอนก่อนหน้า: ${prev.title} (Shift + ←)`} mouseEnterDelay={0.8}>
                                <Link href={`/journey/${prev.id}`}><Button icon={<ArrowLeftOutlined />} aria-label={`ขั้นตอนก่อนหน้า: ${prev.title}`} /></Link>
                            </Tooltip>
                        )
                        : <Button icon={<ArrowLeftOutlined />} disabled aria-label="ขั้นตอนก่อนหน้า" />}
                    {level.kind.type !== 'meta' && (
                        <div className="min-w-[140px] flex-1 sm:flex-none sm:min-w-0">
                            <div className="text-[11px] text-gray-500 leading-tight">มูลค่าขั้นตอนนี้</div>
                            <div className="text-[18px] font-bold tabular-nums leading-tight">{formatNumber(mark === 'skipped' ? 0 : total, 0)} บาท</div>
                            {outsideConstruction && (
                                <div className="text-[11px] text-gray-500 leading-tight">ค่าใช้จ่ายก่อนเริ่มงาน ไม่รวมในราคาค่าก่อสร้าง</div>
                            )}
                        </div>
                    )}
                    <div className="hidden sm:block min-w-0 pl-3 border-l border-gray-200">
                        <div className="text-[11px] text-gray-500 leading-tight">ราคาค่าก่อสร้างรวม</div>
                        <div className="text-[15px] font-semibold tabular-nums leading-tight text-gray-700">
                            {formatNumber(result.boq.constructionTotal, 0)} บาท
                        </div>
                    </div>
                    <div className="ml-auto flex flex-wrap justify-end items-center gap-2">
                        {level.optional && mark === undefined && (
                            <Popconfirm title="ยืนยันว่าไม่มีงานส่วนนี้ในโครงการ?" description="ระบบจะไม่นำขั้นตอนนี้มาคิดมูลค่า (แก้ไขภายหลังได้)"
                                okText="ยืนยัน" cancelText="ยกเลิก" onConfirm={skip}>
                                <Button icon={<StepForwardOutlined />}>ไม่มีในโครงการนี้</Button>
                            </Popconfirm>
                        )}
                        {mark === undefined
                            ? (
                                <Button type="primary" size="large" icon={<CheckOutlined />} onClick={pass} className="max-w-full">
                                    <span className="truncate min-w-0 max-w-[62vw] sm:max-w-[380px]">
                                        {next ? `ยืนยัน แล้วไปขั้นตอน${next.title}` : 'ยืนยันและเสร็จสิ้น'}
                                    </span>
                                </Button>
                            )
                            : (
                                <Tooltip title={next ? SHORTCUT_HINT : undefined} mouseEnterDelay={0.8}>
                                    <Button type="primary" size="large" onClick={goNext} className="max-w-full">
                                        <span className="truncate min-w-0 max-w-[62vw] sm:max-w-[380px]">
                                            {next ? `ไปขั้นตอน${next.title}` : 'กลับไปภาพรวมขั้นตอน'}
                                        </span>
                                        {next && <ArrowRightOutlined />}
                                    </Button>
                                </Tooltip>
                            )}
                    </div>
                </div>
            </div>
        </div>
    );
}
