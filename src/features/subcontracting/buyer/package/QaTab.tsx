'use client';

// ─── คำถาม-คำตอบ: vendors ask, the buyer answers once for everyone (the asker is not named to the others) ───
import { useState } from 'react';
import { App, Button, Empty, Input } from 'antd';
import type { QuestionDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useAnswerQuestion } from '../hooks';
import { fmtDateTime } from '../format';
import { sortQuestions } from './helpers';

export function QaTab({ packageId, questions, loading, error, canAnswer }: {
    packageId: string;
    questions: readonly QuestionDto[];
    loading: boolean;
    error: string | null;
    canAnswer: boolean;
}) {
    const { message } = App.useApp();
    const answer = useAnswerQuestion(packageId);
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    if (!loading && questions.length === 0) {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error ?? 'ยังไม่มีคำถามจากผู้รับคำเชิญ'} />;
    }

    const submit = async (q: QuestionDto) => {
        const text = (drafts[q.id] ?? '').trim();
        if (text === '') return;
        try {
            await answer.mutateAsync({ questionId: q.id, body: { answer: text } });
            setDrafts(d => Object.fromEntries(Object.entries(d).filter(([id]) => id !== q.id)));
            void message.success('ตอบแล้ว ทุกรายเห็นคำตอบนี้');
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <div className="flex flex-col gap-3">
            {sortQuestions(questions).map(q => (
                <div key={q.id} className="border border-gray-200 rounded-card p-3">
                    <div className="flex items-baseline gap-2">
                        <div className="flex-1 min-w-0 whitespace-pre-line">{q.question}</div>
                        <span className="text-caption text-gray-500 whitespace-nowrap">
                            {q.askedBy !== null && q.askedBy !== '' ? `${q.askedBy} · ` : ''}{fmtDateTime(q.askedAt)}
                        </span>
                    </div>
                    {q.answer !== null ? (
                        <div className="mt-2 pl-3 border-l-2 border-gray-200 text-gray-700 whitespace-pre-line">
                            {q.answer}
                            {q.answeredAt !== null && <div className="text-caption text-gray-500">ตอบเมื่อ {fmtDateTime(q.answeredAt)}</div>}
                        </div>
                    ) : canAnswer ? (
                        <div className="mt-2 flex flex-col gap-2">
                            <Input.TextArea rows={2} maxLength={2000} placeholder="คำตอบ (ทุกรายเห็น ไม่ระบุชื่อผู้ถาม)"
                                value={drafts[q.id] ?? ''} onChange={e => setDrafts(d => ({ ...d, [q.id]: e.target.value }))} />
                            <div className="flex justify-end">
                                <Button size="small" type="primary" disabled={(drafts[q.id] ?? '').trim() === ''}
                                    loading={answer.isPending && answer.variables.questionId === q.id}
                                    onClick={() => { void submit(q); }}>
                                    ตอบ
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-2 text-secondary text-gray-500">ยังไม่ได้ตอบ</div>
                    )}
                </div>
            ))}
        </div>
    );
}
