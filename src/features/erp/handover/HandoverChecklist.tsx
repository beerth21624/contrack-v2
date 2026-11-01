'use client';

// ─── The handover checklist: item (in the document language), ok / fix / n.a., note. Controlled by HandoverPage. ───
import { Button, Input, Segmented } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { HANDOVER_CHECK_STATUSES, type HandoverChecklistItem } from '@/shared/contract';

export function HandoverChecklist({ items, onChange, editable }: {
    items: readonly HandoverChecklistItem[];
    onChange: (items: HandoverChecklistItem[]) => void;
    editable: boolean;
}) {
    const t = useTranslations('handover');
    const te = useTranslations('enums');
    const locale = useLocale();
    const set = (i: number, patch: Partial<HandoverChecklistItem>) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    const label = (x: HandoverChecklistItem): string => {
        const first = locale === 'en' ? x.itemEn : x.itemTh;
        return first !== '' ? first : locale === 'en' ? x.itemTh : x.itemEn;
    };

    return (
        <div className="flex min-w-0 flex-col gap-2">
            {items.length === 0 && <div className="text-[13px] text-gray-500">{t('checklist.empty')}</div>}
            {items.map((x, i) => (
                <div key={i} className="flex min-w-0 flex-col gap-2 rounded border border-gray-200 p-2 md:flex-row md:items-start">
                    <div className="min-w-0 flex-1">
                        {editable ? (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <Input value={x.itemTh} maxLength={500} placeholder={t('checklist.itemTh')} onChange={e => set(i, { itemTh: e.target.value })} />
                                <Input value={x.itemEn} maxLength={500} placeholder={t('checklist.itemEn')} onChange={e => set(i, { itemEn: e.target.value })} />
                            </div>
                        ) : (
                            <div className="break-words text-[14px]">{label(x)}</div>
                        )}
                    </div>
                    <Segmented
                        size="small" disabled={!editable} value={x.status} onChange={v => set(i, { status: v })}
                        options={HANDOVER_CHECK_STATUSES.map(s => ({ value: s, label: te(`handoverCheckStatus.${s}`) }))}
                    />
                    <Input
                        className="md:!w-64" value={x.note} maxLength={2000} disabled={!editable} placeholder={t('checklist.note')}
                        onChange={e => set(i, { note: e.target.value })}
                    />
                    {editable && (
                        <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('checklist.remove')} title={t('checklist.remove')}
                            onClick={() => onChange(items.filter((_, k) => k !== i))} />
                    )}
                </div>
            ))}
            {editable && (
                <div>
                    <Button icon={<PlusOutlined />} onClick={() => onChange([...items, { itemTh: '', itemEn: '', status: 'ok', note: '' }])}>
                        {t('checklist.add')}
                    </Button>
                </div>
            )}
        </div>
    );
}
