'use client';

// ─── "ตรวจ BOQ ก่อนส่ง": rules now, the model when it answers ───
// The deterministic rules (@/domain/boq/review) run locally on every render while the panel is open, so the list
// follows the user's fixes. The decision model (module `ai-assist`) is asked once per click, only when the module
// is on for the current workspace and the user is signed in; its answer is appended. Any failure (module off,
// signed out, network, server) leaves the rule findings alone: no toast, at most a quiet note.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoqResult, BoqSectionTemplate } from '@/domain/boq/types';
import { reviewBoqRules, toReviewRows } from '@/domain/boq/review';
import type { AiFinding, BoqReviewFinding, BoqReviewProject } from '@/shared/contract/ai-assist';
import { api } from '@/features/cloud/api/routes';
import { isApiError } from '@/features/cloud/api/errors';
import { useSession } from '@/features/cloud/auth/session';
import { useModuleEnabled } from '@/features/modules/modules';
import { aiToFindings, mergeFindings } from './merge';

/** Contract limit on rows per request (boqReviewRequestSchema). */
const MAX_ROWS = 400;

export type AiReviewStatus =
    /** Not asked: module off, signed out, or nothing to send. */
    | 'off'
    | 'loading'
    | 'done'
    /** Asked but no answer (network, server, 404 module_disabled while the switch looked on): rules only. */
    | 'unavailable';

type AiState =
    | { status: 'off' | 'loading' | 'unavailable' }
    | { status: 'done'; findings: AiFinding[] };

export interface BoqReview {
    open: boolean;
    /** Merged list: errors first, rules before model findings, one line per row + kind. */
    findings: BoqReviewFinding[];
    ai: AiReviewStatus;
    /** Opens the panel, runs the rules, and asks the model when it is available. */
    run: () => void;
    close: () => void;
}

export function useBoqReview(result: BoqResult, template: BoqSectionTemplate[], project: BoqReviewProject): BoqReview {
    const [open, setOpen] = useState(false);
    const [ai, setAi] = useState<AiState>({ status: 'off' });
    const abortRef = useRef<AbortController | null>(null);
    const signedIn = useSession(s => s.status === 'signed-in');
    const { enabled, workspaceId } = useModuleEnabled('ai-assist');

    const rows = useMemo(() => (open ? toReviewRows(result, template) : []), [open, result, template]);
    const rules = useMemo(() => (open ? reviewBoqRules(result, template) : []), [open, result, template]);
    const findings = useMemo(
        () => mergeFindings(rules, ai.status === 'done' ? aiToFindings(ai.findings, rows) : []),
        [rules, ai, rows],
    );

    const stop = () => {
        abortRef.current?.abort();
        abortRef.current = null;
    };

    const run = useCallback(() => {
        stop();
        setOpen(true);
        const sent = toReviewRows(result, template).slice(0, MAX_ROWS);
        if (!signedIn || !enabled || workspaceId === undefined || sent.length === 0) {
            setAi({ status: 'off' });
            return;
        }
        const ctl = new AbortController();
        abortRef.current = ctl;
        setAi({ status: 'loading' });
        api.ai.reviewBoq(workspaceId, { project, rows: sent }, ctl.signal)
            .then(res => {
                if (ctl.signal.aborted) return;
                setAi({ status: 'done', findings: res.findings });
            })
            .catch((e: unknown) => {
                if (ctl.signal.aborted) return;
                // The switch said on but the server says off: behave as if the module were off (no note).
                setAi({ status: isApiError(e) && e.code === 'module_disabled' ? 'off' : 'unavailable' });
            })
            .finally(() => {
                if (abortRef.current === ctl) abortRef.current = null;
            });
    }, [result, template, project, signedIn, enabled, workspaceId]);

    const close = useCallback(() => {
        stop();
        setOpen(false);
        setAi({ status: 'off' });
    }, []);

    // Leaving the page while the model is still answering.
    useEffect(() => () => { abortRef.current?.abort(); }, []);

    return { open, findings, ai: ai.status, run, close };
}
