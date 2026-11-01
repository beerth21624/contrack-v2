'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircleFilled, CloseCircleFilled, ExclamationCircleFilled, UndoOutlined } from '@ant-design/icons';
import { TextCell } from '../NumberCell';

export interface ChecklistValue {
    done: boolean;
    note: string;
    answer?: 'yes' | 'no';
}

/**
 * One site-check question as a card: yes / no answered with two buttons (a "no" turns the note into the place to
 * write the problem found), or an open question answered in writing. Replaces a bare checkbox + note line.
 */
export function ChecklistItem({ index, question, hint, kind, problemIf = 'no', value, onChange }: {
    index: number;
    question: ReactNode;
    hint?: ReactNode;
    kind: 'yesno' | 'open';
    /** Which answer is a finding to follow up (shown in red with a required-looking note). */
    problemIf?: 'yes' | 'no';
    value: ChecklistValue;
    onChange: (patch: Partial<ChecklistValue>) => void;
}) {
    const t = useTranslations('journeyUi.checklist');
    const isProblem = kind === 'yesno' && value.answer !== undefined && value.answer === problemIf;
    const answeredOk = kind === 'yesno' ? value.answer !== undefined && !isProblem : value.note.trim() !== '';
    // An answer saved before yes / no existed (only "checked") still shows as checked.
    const legacyChecked = kind === 'yesno' && value.done && value.answer === undefined;

    const tone = isProblem ? 'border-red-300 bg-red-50/60'
        : answeredOk || legacyChecked ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-white';

    const choose = (answer: 'yes' | 'no') => {
        if (value.answer === answer) onChange({ answer: undefined, done: false });
        else onChange({ answer, done: true });
    };

    const choice = (answer: 'yes' | 'no', label: string) => {
        const selected = value.answer === answer;
        const bad = answer === problemIf;
        const on = bad ? 'bg-red-500 border-red-500 text-white' : 'bg-green-600 border-green-600 text-white';
        return (
            <button type="button" aria-pressed={selected} onClick={() => choose(answer)}
                className={`min-h-[36px] px-4 rounded-md border text-[13px] font-medium transition cursor-pointer
                    ${selected ? on : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'}`}>
                {selected && (bad ? <CloseCircleFilled className="mr-1" /> : <CheckCircleFilled className="mr-1" />)}
                {label}
            </button>
        );
    };

    return (
        <div className={`rounded-lg border px-4 py-3 transition-colors ${tone}`}>
            <div className="flex flex-wrap items-start gap-3">
                <span className={`shrink-0 w-6 h-6 rounded-full text-[12px] font-semibold flex items-center justify-center mt-0.5
                    ${isProblem ? 'bg-red-500 text-white' : answeredOk || legacyChecked ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {answeredOk || legacyChecked ? <CheckCircleFilled /> : isProblem ? <ExclamationCircleFilled /> : index}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-gray-900">{question}</div>
                    {hint !== undefined && <div className="text-[12px] text-gray-500 mt-0.5">{hint}</div>}
                </div>
                {kind === 'yesno' && (
                    <div className="flex items-center gap-2 shrink-0" role="group" aria-label={t('answerGroup', { index })}>
                        {choice('yes', t('yes'))}
                        {choice('no', t('no'))}
                        {(value.answer !== undefined || legacyChecked) && (
                            <button type="button" aria-label={t('clear')} title={t('clear')}
                                onClick={() => onChange({ answer: undefined, done: false })}
                                className="min-h-[36px] px-2 text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer">
                                <UndoOutlined />
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div className={`mt-2 ml-9 rounded-md border px-2 ${isProblem ? 'border-red-300 bg-white' : 'border-gray-200 bg-white'}`}>
                <TextCell
                    value={value.note}
                    ariaLabel={t('noteLabel', { index })}
                    placeholder={kind === 'open' ? t('notePlaceholderOpen') : isProblem ? t('notePlaceholderProblem') : t('notePlaceholderDefault')}
                    onCommit={v => {
                        const note = v ?? '';
                        onChange(kind === 'open' ? { note, done: note.trim() !== '' } : { note });
                    }}
                />
            </div>
            {isProblem && value.note.trim() === '' && (
                <div className="mt-1 ml-9 text-[12px] text-red-600">{t('problemRequired')}</div>
            )}
        </div>
    );
}

/** "ตรวจแล้ว 3 / 5 ข้อ · พบประเด็น 1 ข้อ" with a thin progress bar. */
export function ChecklistProgress({ done, total, problems }: { done: number; total: number; problems: number }) {
    const t = useTranslations('journeyUi.checklist');
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="text-[13px] text-gray-700">
                {t.rich('checked', { done, total, b: chunks => <b className="tabular-nums">{chunks}</b> })}
                {problems > 0 && <span className="ml-2 text-red-600">{t('problems', { problems })}</span>}
                {done === total && problems === 0 && <span className="ml-2 text-green-700">{t('ready')}</span>}
            </div>
            <div className="flex-1 min-w-[120px] h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden>
                <div className={`h-full ${problems > 0 ? 'bg-red-400' : 'bg-green-500'}`} style={{ width: `${String(pct)}%` }} />
            </div>
        </div>
    );
}
