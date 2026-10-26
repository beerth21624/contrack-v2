'use client';

import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons';

/**
 * How far one element read off the plan (an opening, a wall, a circuit …) is filled — the same grey / green / red
 * language as the site checklist: `empty` = nothing typed yet (grey), `done` = every plan value there (green),
 * `missing` = started but a plan value is still missing (red).
 */
export type FillState = 'empty' | 'missing' | 'done';

/**
 * `filled`: one flag per required plan value. `started` (default: any of them filled) tells an element the user
 * has not touched yet (grey) from one that is half done (red), e.g. when a preset already fills one of the flags.
 */
export function fillState(filled: readonly boolean[], started: boolean = filled.some(Boolean)): FillState {
    if (filled.length > 0 && filled.every(Boolean)) return 'done';
    return started ? 'missing' : 'empty';
}

/**
 * Border + background classes of a card or row in a fill state. A half-filled card only gets a red edge: the
 * "!" marker and its "ยังขาด: …" line already say what is missing, so no red wash over the fields being typed in.
 */
export const fillTone = (state: FillState): string =>
    state === 'done' ? 'border-green-200 bg-green-50/40'
        : state === 'missing' ? 'border-red-300 bg-white'
            : 'border-gray-200 bg-white';

/** The round marker in front of a card or row: a number while empty, a green tick when done, red "!" when missing. */
export function FillBadge({ state, index }: { state: FillState; index?: number }) {
    const label = state === 'done' ? 'กรอกครบแล้ว' : state === 'missing' ? 'ยังกรอกไม่ครบ' : 'ยังไม่ได้กรอก';
    return (
        <span role="img" aria-label={label} title={label}
            className={`shrink-0 w-6 h-6 rounded-full text-[12px] font-semibold flex items-center justify-center
                ${state === 'done' ? 'bg-green-600 text-white' : state === 'missing' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {state === 'done' ? <CheckCircleFilled /> : state === 'missing' ? <ExclamationCircleFilled /> : (index ?? '')}
        </span>
    );
}

/**
 * "กรอกแล้ว 6 / 9 ช่องเปิด · ยังขาดค่าจากแบบ 2 รายการ" with a thin progress bar (like the checklist progress).
 * `done` counts complete elements, `missing` the half-filled ones.
 */
export function FillProgress({ done, total, noun, missing = 0, verb = 'กรอกแล้ว', doneText }: {
    done: number;
    total: number;
    /** What is counted, e.g. "ช่องเปิด", "ผนัง", "วงจร". */
    noun: string;
    missing?: number;
    verb?: string;
    /** Shown in green when everything is done (default "· ครบแล้ว"). */
    doneText?: string;
}) {
    if (total === 0) return null;
    const pct = Math.round((done / total) * 100);
    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="text-[13px] text-gray-700">
                {verb} <b className="tabular-nums">{done}</b> / {total} {noun}
                {missing > 0 && <span className="ml-2 text-red-600">· ยังขาดค่าจากแบบ {missing} รายการ</span>}
                {done === total && <span className="ml-2 text-green-700">· {doneText ?? 'ครบแล้ว'}</span>}
            </div>
            <div className="flex-1 min-w-[120px] h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden>
                <div className={`h-full ${missing > 0 ? 'bg-red-400' : 'bg-green-500'}`} style={{ width: `${String(pct)}%` }} />
            </div>
        </div>
    );
}

/** Done / missing counts of a list of fill states (for `FillProgress`). */
export function countFill(states: readonly FillState[]): { done: number; missing: number; total: number } {
    return {
        done: states.filter(s => s === 'done').length,
        missing: states.filter(s => s === 'missing').length,
        total: states.length,
    };
}
