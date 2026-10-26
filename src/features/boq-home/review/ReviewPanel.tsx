'use client';

// ─── "สิ่งที่ดูผิดปกติ": the list of review findings above the BOQ table ───
// Same pattern as the required-fields list of a journey step: short lines, click one and the page scrolls to the
// row it points at. Findings never change a number; the user decides what to do with each.
import { Button, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleFilled, CloseOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import type { BoqReviewFinding } from '@/shared/contract/ai-assist';
import { aiPercent, countBySeverity } from './merge';
import type { AiReviewStatus } from './useBoqReview';

export const REVIEW_TEXT = {
    button: 'ตรวจ BOQ ก่อนส่ง',
    title: 'สิ่งที่ดูผิดปกติ',
    hint: 'เป็นข้อสังเกตเท่านั้น ไม่มีตัวเลขใดถูกแก้ กดที่รายการเพื่อไปดูแถวนั้น',
    empty: 'ไม่พบสิ่งผิดปกติ',
    loading: 'กำลังตรวจด้วย AI…',
    unavailable: 'ตรวจด้วย AI ไม่พร้อมใช้งาน',
    close: 'ปิด',
    found: (n: number) => `พบ ${String(n)} รายการ`,
    errors: (n: number) => `ผิดพลาด ${String(n)}`,
    warns: (n: number) => `ควรตรวจ ${String(n)}`,
} as const;

function SeverityIcon({ severity }: { severity: BoqReviewFinding['severity'] }) {
    return severity === 'error'
        ? <CloseCircleFilled className="text-red-600 text-[14px] shrink-0 mt-[3px]" aria-label="ผิดพลาด" />
        : <ExclamationCircleFilled className="text-amber-600 text-[14px] shrink-0 mt-[3px]" aria-label="ควรตรวจ" />;
}

export interface ReviewPanelProps {
    findings: readonly BoqReviewFinding[];
    ai: AiReviewStatus;
    onPick: (key: string) => void;
    onClose: () => void;
}

export function ReviewPanel({ findings, ai, onPick, onClose }: ReviewPanelProps) {
    const { errors, warns } = countBySeverity(findings);
    const settled = ai !== 'loading';
    const empty = findings.length === 0;
    return (
        <section aria-labelledby="boq-review-title" data-boq-review=""
            className="bg-white border border-gray-200 rounded-card shadow-card px-4 py-3">
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h3 id="boq-review-title" className="m-0 text-section font-semibold text-gray-900">{REVIEW_TEXT.title}</h3>
                        {!empty && (
                            <span className="text-secondary text-gray-600 tabular-nums">
                                {REVIEW_TEXT.found(findings.length)}
                                {' · '}
                                {errors > 0 && <span className="text-red-600">{REVIEW_TEXT.errors(errors)}</span>}
                                {errors > 0 && warns > 0 && ' · '}
                                {warns > 0 && <span className="text-amber-700">{REVIEW_TEXT.warns(warns)}</span>}
                            </span>
                        )}
                    </div>
                    <div className="text-caption text-gray-500">{REVIEW_TEXT.hint}</div>
                </div>
                <Button type="text" size="small" icon={<CloseOutlined />} aria-label={REVIEW_TEXT.close} onClick={onClose} />
            </div>

            {empty && settled && (
                <div className="flex items-center gap-2 mt-3 text-secondary text-green-700">
                    <CheckCircleOutlined /> {REVIEW_TEXT.empty}
                </div>
            )}

            {!empty && (
                <ul className="m-0 mt-2 p-0 list-none max-h-[40vh] overflow-auto divide-y divide-gray-100">
                    {findings.map(f => (
                        <li key={`${f.source}:${f.key}:${f.kind}`}>
                            <button type="button" onClick={() => onPick(f.key)}
                                className="w-full flex items-start gap-2 text-left text-secondary leading-snug text-gray-800 bg-transparent border-0 rounded px-2 py-1.5 cursor-pointer hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                                <SeverityIcon severity={f.severity} />
                                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{f.message}</span>
                                {f.source === 'ai' && f.probability !== undefined && (
                                    <span className="shrink-0 self-center rounded-sm border border-gray-200 bg-gray-50 px-1.5 text-[11px] leading-[18px] text-gray-600 tabular-nums"
                                        title="ความน่าจะเป็นจากโมเดลตัดสินใจ">
                                        {aiPercent(f.probability)}
                                    </span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {ai === 'loading' && (
                <div className="flex items-center gap-2 mt-2 text-caption text-gray-500" role="status">
                    <Spin size="small" /> {REVIEW_TEXT.loading}
                </div>
            )}
            {ai === 'unavailable' && (
                <div className="mt-2 text-caption text-gray-500">{REVIEW_TEXT.unavailable}</div>
            )}
        </section>
    );
}
