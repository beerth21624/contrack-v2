'use client';

// The current step's required fields (`*` on their labels) and, after a failed "ยืนยัน", the fields to ring.
// Set once by the journey level page; a card scopes its fields to its row with `RequiredScope` (PlanCard does it).
import { createContext, useContext, type ReactNode } from 'react';
import { NO_TARGETS, cardTargetId, fieldTargetId, type HighlightTargets, type RowScope } from './required';

export interface RequiredState {
    /** Field keys of the step marked `*` (`requiredFields(levelId)`). */
    fields: ReadonlySet<string>;
    /** What is still missing, shown only once the user tried to confirm the step. */
    targets: HighlightTargets;
}

const NO_FIELDS: ReadonlySet<string> = new Set();

export const RequiredContext = createContext<RequiredState>({ fields: NO_FIELDS, targets: NO_TARGETS });

const RowScopeContext = createContext<RowScope | undefined>(undefined);

/** Fields inside belong to this row of the step's input (e.g. `{ listKey: 'rows', itemIndex: 2 }`). */
export function RequiredScope({ scope, children }: { scope: RowScope | undefined; children: ReactNode }) {
    return <RowScopeContext.Provider value={scope}>{children}</RowScopeContext.Provider>;
}

export interface RequiredField {
    /** Mark the label with `*`. */
    required: boolean;
    /** Ring the box: the user tried to confirm and this value is still missing. */
    highlighted: boolean;
    /** `data-req-field` for scrolling to the field (absent without a field key). */
    targetId: string | undefined;
}

/** Required / highlighted state of one field of the current step (nothing outside a journey step). */
export function useRequiredField(fieldKey: string | undefined): RequiredField {
    const { fields, targets } = useContext(RequiredContext);
    const scope = useContext(RowScopeContext);
    if (fieldKey === undefined) return { required: false, highlighted: false, targetId: undefined };
    const targetId = fieldTargetId(scope, fieldKey);
    return { required: fields.has(fieldKey), highlighted: targets.fields.has(targetId), targetId };
}

/** Card id for scrolling, and whether the card holds a value still missing after a failed confirm. */
export function useRequiredCard(scope: RowScope | undefined): { targetId: string | undefined; highlighted: boolean } {
    const { targets } = useContext(RequiredContext);
    if (scope === undefined) return { targetId: undefined, highlighted: false };
    const targetId = cardTargetId(scope);
    return { targetId, highlighted: targets.cards.has(targetId) };
}

/** The step still needs its first item: true once the user tried to confirm without one. */
export function useRequiredAdd(): boolean {
    return useContext(RequiredContext).targets.addItem;
}

/**
 * Where the step's first item goes when it has no list of cards (a count sheet, pipe runs): scrolled to, and
 * given the thin missing ring, after a failed confirm without any item.
 */
export function RequiredArea({ className, children }: { className?: string; children: ReactNode }) {
    const needed = useRequiredAdd();
    return (
        <div data-req-add="" className={`rounded-md scroll-mt-24 ${className ?? ''} ${needed ? 'ring-1 ring-red-300 ring-offset-4' : ''}`}>
            {children}
        </div>
    );
}

/** The quiet `*` after a required label. */
export function RequiredMark({ required }: { required: boolean }) {
    if (!required) return null;
    return (
        <>
            <span aria-hidden className="ml-0.5 text-gray-400">*</span>
            <span className="sr-only"> (จำเป็น)</span>
        </>
    );
}
