'use client';

// ─── Saving several assignment changes in a row (W3): accepting a suggestion, or a bar moved with its follow-ons ───
// One request per change, in order, stopping at the first error (runSaveSteps); the assignment lists are refetched
// once at the end, saved or not, so the board shows exactly what is on the server.
import { useCallback, useState } from 'react';
import type { App } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { assignmentsRootKey, workforceApi, workforceConflictMessage } from '@/features/cloud/api/workforce';
import { runSaveSteps, saveFailureLines, type SaveRun, type SaveStep } from './suggest-view';

export const writeError = (e: unknown): string => workforceConflictMessage(e) ?? thaiErrorMessage(e);

export function useSaveSteps(workspaceId: string) {
    const qc = useQueryClient();
    const [saving, setSaving] = useState(false);
    const run = useCallback(async (steps: readonly SaveStep[]): Promise<SaveRun> => {
        setSaving(true);
        try {
            return await runSaveSteps(steps, s => (s.kind === 'create'
                ? workforceApi.createAssignment(workspaceId, s.body)
                : workforceApi.updateAssignment(workspaceId, s.assignmentId, s.body)));
        } finally {
            await qc.invalidateQueries({ queryKey: assignmentsRootKey(workspaceId) });
            setSaving(false);
        }
    }, [qc, workspaceId]);
    return { run, saving };
}

/** The dialog after a run stopped: which change failed, why, and what was saved before it. */
export function showSaveFailure(modal: ReturnType<typeof App.useApp>['modal'], run: SaveRun, total: number, line: (step: SaveStep) => string): void {
    if (run.failed === undefined) return;
    const t = saveFailureLines(run, total);
    modal.error({
        title: t.title,
        content: (
            <div className="flex flex-col gap-1.5 text-[13px]">
                <div className="text-gray-900 break-words">{line(run.failed.step)}</div>
                <div className="text-red-700">{writeError(run.failed.error)}</div>
                <div className="text-gray-600">{t.saved}</div>
            </div>
        ),
        okText: 'ตกลง',
    });
}
