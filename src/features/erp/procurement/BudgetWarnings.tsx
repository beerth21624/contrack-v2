'use client';

// ─── Budget warnings of a PR / PO (over quantity, over price, over budget) + the reason that overrides them ───
import { Alert, Input } from 'antd';
import { useTranslations } from 'next-intl';
import type { BudgetWarning } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';

export function BudgetWarnings({ warnings, reason, onReasonChange, readOnly = false }: {
    warnings: readonly BudgetWarning[];
    reason: string;
    onReasonChange?: (reason: string) => void;
    readOnly?: boolean;
}) {
    const t = useTranslations('procurement.warnings');
    const fmt = useFormat();
    if (warnings.length === 0) return null;
    const text = (w: BudgetWarning): string => {
        const show = w.kind === 'over_quantity' ? fmt.qty : fmt.money;
        return t(w.kind, { code: w.code, value: show(w.value), limit: show(w.limit) });
    };
    return (
        <Alert
            type="warning" showIcon title={t('title')}
            description={(
                <div className="flex min-w-0 flex-col gap-2">
                    <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5">
                        {warnings.map(w => <li key={`${w.kind}:${w.costCodeId}`} className="break-words">{text(w)}</li>)}
                    </ul>
                    {readOnly ? (
                        reason.trim() !== '' && <div className="break-words"><span className="font-medium">{t('reason')}:</span> {reason}</div>
                    ) : (
                        <label className="flex flex-col gap-1 text-[13px]">
                            {t('reasonLabel')}
                            <Input.TextArea value={reason} rows={2} maxLength={2000} placeholder={t('reasonPlaceholder')}
                                status={reason.trim() === '' ? 'warning' : undefined} onChange={e => onReasonChange?.(e.target.value)} />
                        </label>
                    )}
                </div>
            )}
        />
    );
}
