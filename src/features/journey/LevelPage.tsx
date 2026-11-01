'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Popconfirm, Popover, Result, Spin, Tag, Tooltip, Typography } from 'antd';
import {
    AppstoreOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined, FileSearchOutlined, LockOutlined,
    StepForwardOutlined, UndoOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '@/store/project-store';
import { computeProject } from '@/domain/project';
import {
    JOURNEY_LEVELS, blockingLevels, firstStepToward, getLevel, isUnlocked, levelTotal, missingRequirements, nextLevel,
    nextOpenLevel, phaseOf, previousLevel, requiredFields, type JourneyLevel, type JourneyProgress, type LevelMark, type MissingValue,
} from '@/domain/journey';
import { CALCULATOR_PAGES } from '@/features/calculators/pages';
import { totalText } from './total-text';
import { useLevelText } from './useLevelText';
import { RequiredContext, type RequiredState } from '@/components/sheet/journey/RequiredContext';
import { NO_TARGETS, highlightTargets, missingSummary, targetOf, targetSelectors } from '@/components/sheet/journey/required';
import { JourneyModeContext } from './JourneyMode';
import { confirmOutcome, incompleteDoneCount } from './confirm';
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

/** Scroll a missing value into view (its field, card or the add button; else the step's inputs) and focus it. */
function scrollToMissing(m: MissingValue, fallback: HTMLElement | null) {
    const el = targetSelectors(targetOf(m)).reduce<Element | null>((found, sel) => found ?? document.querySelector(sel), null)
        ?? fallback;
    if (el === null) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = el.matches('input, textarea') ? el : el.querySelector('input, textarea, button[role="radio"]');
    if (input instanceof HTMLElement) input.focus({ preventScroll: true });
}

/** "ยังต้องกรอก 3 รายการ: …" under a failed confirm: the first few labels, the rest behind "ดูทั้งหมด". */
function MissingList({ missing, onPick }: { missing: readonly MissingValue[]; onPick: (m: MissingValue) => void }) {
    const t = useTranslations('journeyUi.levelPage');
    const lt = useLevelText();
    const s = missingSummary(missing, 3, lt.locale);
    const all = (
        <ul className="m-0 p-0 list-none max-h-[50vh] overflow-auto max-w-[min(420px,85vw)]">
            {missing.map((m, i) => (
                <li key={i}>
                    <button type="button" onClick={() => onPick(m)}
                        className="w-full text-left text-[13px] leading-snug text-gray-700 bg-transparent border-0 rounded px-2 py-1.5 cursor-pointer hover:bg-gray-50">
                        {lt.missing(m)}
                    </button>
                </li>
            ))}
        </ul>
    );
    return (
        <div role="alert" className="max-w-[1248px] mx-auto px-4 sm:px-6 pt-2 flex flex-wrap items-baseline gap-x-2 text-[13px] leading-snug">
            <span className="font-medium text-red-600 whitespace-nowrap">{t('missingHead', { count: s.count })}</span>
            <span className="min-w-0 text-gray-600 [overflow-wrap:anywhere]">{s.shown.join(' · ')}</span>
            {s.more > 0 && (
                <Popover content={all} trigger="click" placement="topLeft">
                    <Button type="link" size="small" className="!px-0 !h-auto">{t('viewAll')}</Button>
                </Popover>
            )}
        </div>
    );
}

/** A step opened before what it waits for is passed: what is missing, and the open step to do first on the way. */
function StepNotReady({ level, progress }: { level: JourneyLevel; progress: JourneyProgress }) {
    const t = useTranslations('journeyUi.levelPage');
    const lt = useLevelText();
    const waiting = blockingLevels(level.id, progress);
    // May be further back than what the step waits for directly.
    const step = firstStepToward(level.id, progress);
    return (
        <Result
            icon={<LockOutlined className="!text-gray-400" />}
            title={t('notReadyTitle', { title: lt.level(level) })}
            subTitle={t('notReadySub', { names: waiting.map(l => lt.level(l)).join(', ') })}
            extra={step && (
                <Link href={`/journey/${step.id}`}><Button type="primary">{t('continueTo', { title: lt.level(step) })}</Button></Link>
            )}
        />
    );
}

/** The fixed bottom bar of a step: the totals, the way back and the confirm / skip / next buttons. */
function StepBottomBar({ barRef, revealed, missing, onPick, prev, next, level, mark, total, constructionTotal, outsideConstruction, onConfirm, onGoNext, onSkip }: {
    barRef: (el: HTMLDivElement | null) => (() => void) | undefined;
    revealed: boolean; missing: readonly MissingValue[]; onPick: (m: MissingValue) => void;
    prev: JourneyLevel | undefined; next: JourneyLevel | undefined; level: JourneyLevel; mark: LevelMark | undefined;
    total: number; constructionTotal: number; outsideConstruction: boolean;
    onConfirm: () => void; onGoNext: () => void; onSkip: () => void;
}) {
    const t = useTranslations('journeyUi.levelPage');
    const lt = useLevelText();
    return (
    <div ref={barRef}
        className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,.05)] pb-[env(safe-area-inset-bottom)]">
        {revealed && <MissingList missing={missing} onPick={onPick} />}
        {/* On a phone the buttons wrap under the total instead of squeezing it. */}
        <div className="max-w-[1248px] mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {prev
                ? (
                    <Tooltip title={t('prevStepTip', { title: lt.level(prev) })} mouseEnterDelay={0.8}>
                        <Link href={`/journey/${prev.id}`}><Button size="large" icon={<ArrowLeftOutlined />} aria-label={t('prevStepNamed', { title: lt.level(prev) })} /></Link>
                    </Tooltip>
                )
                : <Button size="large" icon={<ArrowLeftOutlined />} disabled aria-label={t('prevStep')} />}
            {level.kind.type !== 'meta' && (
                <div className="min-w-[140px] flex-1 sm:flex-none sm:min-w-0">
                    <div className="text-[12px] text-gray-500 leading-tight">{t('stepValue')}</div>
                    <div className="text-[18px] font-bold tabular-nums leading-tight">{t('amountBaht', { amount: totalText(mark === 'skipped' ? 0 : total) })}</div>
                    {outsideConstruction && (
                        <div className="text-[12px] text-gray-500 leading-tight">{t('preCostNote')}</div>
                    )}
                </div>
            )}
            {/* The divider separates it from the step's own total; without one (project info) it has none. */}
            <div className={`hidden sm:block min-w-0 ${level.kind.type !== 'meta' ? 'pl-3 border-l border-gray-200' : ''}`}>
                <div className="text-[12px] text-gray-500 leading-tight">{t('totalLabel')}</div>
                <div className="text-[15px] font-semibold tabular-nums leading-tight text-gray-700">
                    {t('amountBaht', { amount: totalText(constructionTotal) })}
                </div>
            </div>
            <div className="ml-auto flex flex-wrap justify-end items-center gap-2">
                {level.optional && mark === undefined && (
                    <Popconfirm title={t('skipConfirmTitle')} description={t('skipConfirmDesc')}
                        okText={t('ok')} cancelText={t('cancel')} onConfirm={onSkip}>
                        <Button size="large" icon={<StepForwardOutlined />}>{t('skipped')}</Button>
                    </Popconfirm>
                )}
                {mark === undefined
                    ? (
                        <Button type="primary" size="large" icon={<CheckOutlined />} onClick={onConfirm} className="max-w-full">
                            <span className="truncate min-w-0 max-w-[62vw] sm:max-w-[380px]">
                                {next ? t('confirmGoNext', { title: lt.level(next) }) : t('confirmFinish')}
                            </span>
                        </Button>
                    )
                    : (
                        <Tooltip title={next ? t('shortcutHint') : undefined} mouseEnterDelay={0.8}>
                            <Button type="primary" size="large" onClick={onGoNext} className="max-w-full">
                                <span className="truncate min-w-0 max-w-[62vw] sm:max-w-[380px]">
                                    {next ? t('goNext', { title: lt.level(next) }) : t('backToOverview')}
                                </span>
                                {next && <ArrowRightOutlined />}
                            </Button>
                        </Tooltip>
                    )}
            </div>
        </div>
    </div>
    );
}

/** One journey level: what to read from the plan, the inputs, and the way on to the next level. */
export function LevelPage({ levelId }: { levelId: string }) {
    const router = useRouter();
    const t = useTranslations('journeyUi.levelPage');
    const lt = useLevelText();
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
    // Confirming (or "ไม่มีในโครงการนี้") goes on to the next step that can be worked on now; from a step already
    // decided, → steps to the next open one (passed or available), as ← does backwards.
    const next = level === undefined ? undefined
        : mark === undefined ? nextLevel(level.id, progress) : nextOpenLevel(level.id, progress);
    const prev = level ? previousLevel(level.id, progress) : undefined;
    const unlocked = level !== undefined && isUnlocked(level.id, progress);
    const nextId = next?.id;
    const prevId = prev?.id;
    const goNextCb = useCallback(() => router.push(nextId !== undefined ? `/journey/${nextId}` : '/journey'), [router, nextId]);

    // Required values (docs/rebuild/REQUIRED_FIELDS.md): `*` on their labels always; the list and the rings only
    // once the user tried to confirm this step (or asked to see what a done step now lacks).
    const missing = useMemo(() => (level === undefined ? [] : missingRequirements(level.id, project)), [level, project]);
    const [revealedLevel, setRevealedLevel] = useState<string | null>(null);
    const revealed = revealedLevel === level?.id && missing.length > 0;
    const required = useMemo<RequiredState>(() => ({
        fields: requiredFields(levelId),
        targets: revealed ? highlightTargets(missing) : NO_TARGETS,
    }), [levelId, revealed, missing]);
    const contentRef = useRef<HTMLDivElement>(null);
    const reveal = useCallback((target: MissingValue | undefined) => {
        setRevealedLevel(levelId);
        // After the rings render: bring the value into view and put the cursor in it.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (target !== undefined) scrollToMissing(target, contentRef.current);
        }));
    }, [levelId]);

    const primaryAction = useCallback(() => {
        if (level === undefined) return;
        const outcome = confirmOutcome(mark, missing);
        if (outcome.kind === 'blocked') { reveal(outcome.missing[0]); return; }
        if (outcome.kind === 'complete') setLevelMark(level.id, 'done');
        goNextCb();
    }, [level, mark, missing, reveal, setLevelMark, goNextCb]);
    const prevAction = useCallback(() => { if (prevId !== undefined) router.push(`/journey/${prevId}`); }, [router, prevId]);
    // The keyboard "next" only moves on from a step already decided; it never confirms one.
    useStepShortcuts(
        unlocked && prevId !== undefined ? prevAction : undefined,
        unlocked && mark !== undefined ? goNextCb : undefined,
    );

    if (!level) return <Result status="404" title={t('notFound')} extra={<Link href="/journey"><Button>{t('backToOverview')}</Button></Link>} />;

    const index = JOURNEY_LEVELS.indexOf(level);
    const phase = phaseOf(level.id);
    const remaining = JOURNEY_LEVELS.filter(l => progress[l.id] === undefined).length;
    const passedCount = JOURNEY_LEVELS.length - remaining;

    if (!isUnlocked(level.id, progress)) return <StepNotReady level={level} progress={progress} />;

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
    const doneButIncomplete = incompleteDoneCount(mark, missing);

    return (
        <div className="flex flex-col gap-4 max-w-[1200px] mx-auto w-full" style={{ paddingBottom: barHeight + 24 }}>
            {/* Compact progress that stays on top while the step is scrolled: where am I and how far (the overview says how many are left). */}
            <div className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 py-2 bg-page/95 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <Link href="/journey">
                        <Button icon={<AppstoreOutlined />} aria-label={t('overview')}>
                            <span className="hidden sm:inline">{t('overview')}</span>
                        </Button>
                    </Link>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 text-[13px] min-w-0">
                            <span className="font-semibold text-gray-800 truncate">{lt.level(level)}</span>
                            <Text type="secondary" className="text-[12px] whitespace-nowrap">
                                {t('stepOf', { phase: phase ? lt.phase(phase) : '', index: index + 1, total: JOURNEY_LEVELS.length })}
                            </Text>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-gray-200 overflow-hidden" aria-hidden>
                            <div className="h-full bg-orange-400" style={{ width: `${String(Math.round((passedCount / JOURNEY_LEVELS.length) * 100))}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <LevelSoftLock levelId={level.id} />

            <div className="bg-white border border-gray-200 rounded-card p-5 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                    <Title level={3} style={{ margin: 0 }}>{lt.level(level)}</Title>
                    {mark === 'done' && <Tag color="green" icon={<CheckOutlined />}>{t('done')}</Tag>}
                    {mark === 'skipped' && <Tag icon={<StepForwardOutlined />}>{t('skipped')}</Tag>}
                </div>
                {doneButIncomplete > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] text-amber-700">
                        <span>{t('incomplete', { count: doneButIncomplete })}</span>
                        <Button type="link" size="small" className="!px-0 !h-auto" onClick={() => reveal(missing[0])}>{t('viewItems')}</Button>
                    </div>
                )}
                <div className="mt-3 flex gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                    <FileSearchOutlined className="text-blue-500 text-[20px] mt-0.5" />
                    <div>
                        <div className="text-[12px] font-semibold text-blue-700">{t('fromPlan')}</div>
                        <div className="text-[14px] text-gray-800">{lt.hint(level)}</div>
                    </div>
                </div>
            </div>

            {mark === 'skipped'
                ? (
                    <div className="bg-white border border-gray-200 rounded-card p-8 text-center text-gray-500">
                        {t('skippedBody')}
                        <div className="mt-3">
                            <Button icon={<UndoOutlined />} onClick={() => setLevelMark(level.id, undefined)}>{t('undoSkip')}</Button>
                        </div>
                    </div>
                )
                : (
                    <div ref={contentRef} className="flex flex-col gap-4 min-w-0 scroll-mt-24">
                        <JourneyModeContext.Provider value>
                            <RequiredContext.Provider value={required}>
                                {Page
                                    ? <Suspense fallback={spinner}><Page /></Suspense>
                                    : level.kind.type === 'meta' ? <ProjectInfoInputs />
                                        : <BoqLevelInputs sections={level.sections} />}
                            </RequiredContext.Provider>
                        </JourneyModeContext.Provider>
                    </div>
                )}

            <StepBottomBar barRef={barRef} revealed={revealed} missing={missing} onPick={m => reveal(m)} prev={prev} next={next} level={level}
                mark={mark} total={total} constructionTotal={result.boq.constructionTotal} outsideConstruction={outsideConstruction}
                onConfirm={pass} onGoNext={goNext} onSkip={skip} />
        </div>
    );
}
