'use client';

// ─── "ตรวจ BOQ ก่อนส่ง": rules now, the model only after the user says so ───
// The deterministic rules (@/domain/boq/review) run locally on every render while the panel is open, so the list
// follows the user's fixes. The decision model (module `ai-assist`) is asked ONLY from `confirmAi()`, i.e. after
// the consent dialog that a click on the button opens; nothing here reacts to data changes with a request. Any
// failure (module off, signed out, network, server) leaves the rule findings alone: no toast, at most a quiet note.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoqResult, BoqSectionTemplate } from '@/domain/boq/types';
import { reviewBoqRules, toReviewRows } from '@/domain/boq/review';
import type { AiFinding, BoqReviewFinding, BoqReviewProject } from '@/shared/contract/ai-assist';
import { api } from '@/features/cloud/api/routes';
import { isApiError } from '@/features/cloud/api/errors';
import { useSession } from '@/features/cloud/auth/session';
import { useModuleEnabled } from '@/features/modules/modules';
import { reviewClickAction } from './consent';
import { aiToFindings, mergeFindings } from './merge';

/** Contract limit on rows per request (boqReviewRequestSchema). */
const MAX_ROWS = 400;

export type AiReviewStatus =
    /** Not asked: module off, signed out, nothing to send, or the user chose the rules only. */
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
    /** The consent dialog is showing; nothing has been sent yet. */
    consent: boolean;
    /** Merged list: errors first, rules before model findings, one line per row + kind. */
    findings: BoqReviewFinding[];
    ai: AiReviewStatus;
    /** The button: opens the consent dialog when the model could be used, else the rules-only panel. */
    run: () => void;
    /** Dialog: send the BOQ to the model and open the panel. The only place a request is made. */
    confirmAi: () => void;
    /** Dialog: open the panel with the rules only; nothing is sent. */
    rulesOnly: () => void;
    /** Dialog: do nothing. */
    cancelAi: () => void;
    close: () => void;
}

export function useBoqReview(result: BoqResult, template: BoqSectionTemplate[], project: BoqReviewProject): BoqReview {
    const [open, setOpen] = useState(false);
    const [consent, setConsent] = useState(false);
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
        const rowCount = toReviewRows(result, template).length;
        if (reviewClickAction({ signedIn, moduleEnabled: enabled, workspaceId, rowCount }) === 'ask') {
            setConsent(true);
            return;
        }
        setOpen(true);
        setAi({ status: 'off' });
    }, [result, template, signedIn, enabled, workspaceId]);

    const rulesOnly = useCallback(() => {
        setConsent(false);
        setOpen(true);
        setAi({ status: 'off' });
    }, []);

    const cancelAi = useCallback(() => { setConsent(false); }, []);

    const confirmAi = useCallback(() => {
        setConsent(false);
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
        setConsent(false);
        setAi({ status: 'off' });
    }, []);

    // Leaving the page while the model is still answering.
    useEffect(() => () => { abortRef.current?.abort(); }, []);

    return { open, consent, findings, ai: ai.status, run, confirmAi, rulesOnly, cancelAi, close };
}
