'use client';

// ─── คำแนะนำ on the crew board (W3): the top suggestions, each with its before → after numbers and reasons ───
// docs/workforce/00-crew-management-design.md §4 step 2. Computed by suggestMoves (src/domain/workforce/suggest.ts)
// from the crews, the assignments and the waits as the board loaded them, over the board's window; recomputed whenever
// those refresh (after accepting, too). Accepting saves `whatIf.result.changed` one by one (useSaveSteps); dismissing
// keeps the id in this browser (suggest-view.ts). Roles that cannot assign see the cards without the buttons.
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { App, Button, Collapse, Spin } from 'antd';
import type { CrewAssignmentDto, CrewDto, TaskLag } from '@/shared/contract';
import type { BoardWindow } from '@/domain/workforce/board';
import { SUGGESTION_LIMIT, suggestMoves, type Suggestion } from '@/domain/workforce/suggest';
import { ImpactList } from './ImpactList';
import {
    assignmentFactory, changeLine, changeNamesOf, impactLines, loadDismissed, pickSuggestions,
    planTaskName, saveDismissed, saveSteps, suggestionKindLabel, withDismissed, withoutDismissed, type SaveStep,
} from './suggest-view';
import { showSaveFailure, useSaveSteps, useWriteError } from './useSaveSteps';
import { boardCrews, type BoardNames } from './view';

type Dto = CrewAssignmentDto;

export interface SuggestionsPanelProps {
    workspaceId: string;
    crews: readonly CrewDto[];
    /** Undefined while loading; `ready` false while a placeholder (the previous window's) is shown. */
    assignments: readonly Dto[] | undefined;
    ready: boolean;
    lagsByProject: ReadonlyMap<string, readonly TaskLag[]>;
    window: BoardWindow;
    today: string;
    names: BoardNames;
    /** May accept and dismiss (workforceAbilities.assign). */
    canAct: boolean;
}

export function SuggestionsPanel({
    workspaceId, crews, assignments, ready, lagsByProject, window: win, today, names, canAct,
}: SuggestionsPanelProps) {
    const { message, modal } = App.useApp();
    const t = useTranslations('workforce');
    const tc = useTranslations('common');
    const locale = useLocale();
    const writeError = useWriteError();
    const [dismissed, setDismissed] = useState<string[]>(() => (canAct ? loadDismissed() : []));
    const { run, saving } = useSaveSteps(workspaceId);
    const lineNames = useMemo(() => changeNamesOf(names), [names]);

    const { shown, hiddenIds } = useMemo((): { shown: Suggestion<Dto>[]; hiddenIds: string[] } => {
        if (!ready || assignments === undefined) return { shown: [], hiddenIds: [] };
        const onBoard = boardCrews(crews, assignments, win);
        const input = {
            crews: onBoard, assignments, lagsByProject, window: win, today,
            projectName: names.project, taskName: planTaskName, locale,
        };
        const set = new Set(dismissed);
        // Ask for a few more than shown: suggestions for an archived crew are dropped afterwards.
        const list = suggestMoves<Dto>({ ...input, makeAssignment: assignmentFactory(workspaceId), dismissed: set, limit: SUGGESTION_LIMIT * 2 });
        const top = pickSuggestions(list, crews, SUGGESTION_LIMIT);
        if (set.size === 0) return { shown: top, hiddenIds: [] };
        const everything = suggestMoves<Dto>({
            ...input, makeAssignment: assignmentFactory(workspaceId), limit: SUGGESTION_LIMIT * 2 + set.size,
        });
        const hidden = pickSuggestions(everything, crews, everything.length).filter(s => set.has(s.id)).map(s => s.id);
        return { shown: top, hiddenIds: hidden };
    }, [ready, assignments, crews, win, lagsByProject, today, names.project, dismissed, workspaceId, locale]);

    const moneyVisible = crews.some(c => c.dailyCost !== null);
    const stepLine = (s: SaveStep) => changeLine(s.change, lineNames);

    const dismiss = (id: string) => {
        const next = withDismissed(dismissed, id);
        setDismissed(next);
        saveDismissed(next);
    };
    const restore = () => {
        const next = withoutDismissed(dismissed, hiddenIds);
        setDismissed(next);
        saveDismissed(next);
    };

    const accept = (s: Suggestion<Dto>) => {
        const steps = saveSteps(s.whatIf.result.changed);
        if (steps.length === 0) return;
        modal.confirm({
            title: t('board.suggest.confirmTitle'),
            width: 520,
            content: (
                <div className="flex flex-col gap-2 text-[13px]">
                    <div className="text-gray-900 font-medium break-words">{s.title}</div>
                    <div className="text-gray-600">{t('board.suggest.willSave', { count: steps.length })}</div>
                    <ol className="list-decimal pl-5 flex flex-col gap-1 text-gray-800">
                        {steps.map(st => <li key={st.change.after.id} className="break-words">{stepLine(st)}</li>)}
                    </ol>
                </div>
            ),
            okText: t('board.suggest.use'),
            cancelText: tc('cancel'),
            onOk: async () => {
                const result = await run(steps);
                if (result.failed === undefined) void message.success(t('board.suggest.applied', { count: steps.length }));
                else showSaveFailure(modal, result, steps.length, stepLine, writeError);
            },
        });
    };

    const loading = !ready || assignments === undefined;

    return (
        <section className="bg-white border border-gray-200 rounded-card p-4 md:p-5 shadow-card min-w-0" aria-label={t('board.suggest.title')}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                <h2 className="text-[16px] font-semibold text-gray-900 m-0">{t('board.suggest.title')}</h2>
                <span className="text-[12px] text-gray-500">{t('board.suggest.subtitle')}</span>
                {canAct && hiddenIds.length > 0 && (
                    <Button type="link" size="small" className="!px-0 sm:ml-auto" onClick={restore}>
                        {t('board.suggest.showHidden', { count: hiddenIds.length })}
                    </Button>
                )}
            </div>
            {loading ? (
                <div className="py-6 flex justify-center"><Spin size="small" /></div>
            ) : shown.length === 0 ? (
                <div className="text-[13px] text-gray-500 py-2">
                    {canAct && hiddenIds.length > 0
                        ? t('board.suggest.onlyHidden')
                        : t('board.suggest.none')}
                </div>
            ) : (
                <ul className="flex flex-col gap-3 m-0 p-0 list-none">
                    {shown.map(s => (
                        <SuggestionCard key={s.id} suggestion={s} canAct={canAct} busy={saving}
                            lines={impactLines(s.whatIf, { projectName: names.project, moneyVisible, today })}
                            changes={s.whatIf.result.changed.map(c => ({ key: c.after.id, text: changeLine(c, lineNames) }))}
                            onAccept={() => { accept(s); }} onDismiss={() => { dismiss(s.id); }} />
                    ))}
                </ul>
            )}
        </section>
    );
}

function SuggestionCard({ suggestion: s, lines, changes, canAct, busy, onAccept, onDismiss }: {
    suggestion: Suggestion<Dto>;
    lines: ReturnType<typeof impactLines>;
    changes: { key: string; text: string }[];
    canAct: boolean;
    busy: boolean;
    onAccept: () => void;
    onDismiss: () => void;
}) {
    const t = useTranslations('workforce');
    return (
        <li className="border border-gray-200 rounded-[8px] p-3 md:p-4 flex flex-col gap-3 min-w-0">
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[12px] text-gray-500">{suggestionKindLabel(s.kind)}</span>
                <span className="text-[14px] font-medium text-gray-900 break-words">{s.title}</span>
            </div>
            <ImpactList lines={lines} />
            {s.reasons.length > 0 && (
                <ul className="list-disc pl-5 m-0 flex flex-col gap-0.5 text-[13px] text-gray-700">
                    {s.reasons.map(r => <li key={r} className="break-words">{r}</li>)}
                </ul>
            )}
            {changes.length > 0 && (
                <Collapse ghost size="small" className="!-mx-3 [&_.ant-collapse-header]:!py-1"
                    items={[{
                        key: 'changes',
                        label: <span className="text-[13px] text-gray-700">{t('board.suggest.changes', { count: changes.length })}</span>,
                        children: (
                            <ol className="list-decimal pl-5 m-0 flex flex-col gap-1 text-[13px] text-gray-800">
                                {changes.map(c => <li key={c.key} className="break-words">{c.text}</li>)}
                            </ol>
                        ),
                    }]} />
            )}
            {canAct && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button onClick={onDismiss} disabled={busy}>{t('board.suggest.dismiss')}</Button>
                    <Button type="primary" onClick={onAccept} disabled={busy}>{t('board.suggest.use')}</Button>
                </div>
            )}
        </li>
    );
}
