'use client';

// ─── Review flags of the open project (dev mode): list, add, resolve / reopen, delete ───
// Kept in the project (one `flag:<id>` document each): a cloud project shares them with the team through the
// normal document sync, a guest project keeps them in this browser with the project (decision D14).
import { useCallback, useMemo } from 'react';
import {
    listReviewFlags, newReviewFlagId, sameFlagTarget, REVIEW_FLAG_LIMITS,
    type ReviewFlag, type ReviewFlagStatus, type ReviewFlagTarget,
} from '@/domain/review-flags';
import { isRoleReadOnly, useProjectStore } from '@/store/project-store';

const NAME_KEY = 'contrack-dev-mode-name';

/** The name last used for a flag in this browser ('' when none / storage blocked). */
export function readFlagName(): string {
    try { return window.localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}

function writeFlagName(name: string): void {
    try { window.localStorage.setItem(NAME_KEY, name); } catch { /* blocked storage: asked again next time */ }
}

export interface ReviewFlagEntry { id: string; flag: ReviewFlag }

export function useReviewFlags() {
    const flags = useProjectStore(s => s.project.reviewFlags);
    const shared = useProjectStore(s => s.binding.kind === 'cloud');
    const readOnly = useProjectStore(s => isRoleReadOnly(s.binding));
    const setReviewFlag = useProjectStore(s => s.setReviewFlag);
    const list = useMemo(() => listReviewFlags(flags), [flags]);

    const add = useCallback((target: ReviewFlagTarget, comment: string, by: string) => {
        const name = by.trim().slice(0, REVIEW_FLAG_LIMITS.by);
        writeFlagName(name);
        const now = new Date();
        setReviewFlag(newReviewFlagId(now), {
            target, comment: comment.trim().slice(0, REVIEW_FLAG_LIMITS.comment), by: name, at: now.toISOString(), status: 'open',
        });
    }, [setReviewFlag]);

    const setStatus = useCallback((id: string, status: ReviewFlagStatus) => {
        const f = flags?.[id];
        if (f) setReviewFlag(id, { ...f, status });
    }, [flags, setReviewFlag]);

    const remove = useCallback((id: string) => setReviewFlag(id, undefined), [setReviewFlag]);

    /** Flags on one target (a BOQ line's flags of any cell when `anyField`). */
    const forTarget = useCallback((target: ReviewFlagTarget, anyField = false): ReviewFlagEntry[] =>
        list.filter(e => sameFlagTarget(e.flag.target, target, anyField)), [list]);

    return { list, shared, readOnly, add, setStatus, remove, forTarget };
}
