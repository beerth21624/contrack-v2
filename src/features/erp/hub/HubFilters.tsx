'use client';

// ─── Filters of the hub: text search, statuses, customer, project type, archived ───
import { Button, Input, Select, Switch } from 'antd';
import { useTranslations } from 'next-intl';
import { PROJECT_STATUSES, PROJECT_TYPES, type HubProjectStatus, type ProjectType } from '@/shared/contract';
import { CustomerPicker } from '../shared/CustomerPicker';

export interface HubFilterValue {
    text: string;
    status: HubProjectStatus[];
    customerId: string | undefined;
    type: ProjectType | undefined;
    archived: boolean;
}

export const EMPTY_HUB_FILTER: HubFilterValue = { text: '', status: [], customerId: undefined, type: undefined, archived: false };

export const hubFilterActive = (f: HubFilterValue): boolean =>
    f.text.trim() !== '' || f.status.length > 0 || f.customerId !== undefined || f.type !== undefined || f.archived;

export function HubFilters({ value, onChange, workspaceId }: {
    value: HubFilterValue;
    onChange: (next: HubFilterValue) => void;
    workspaceId: string | undefined;
}) {
    const t = useTranslations('hub');
    const tEnums = useTranslations('enums');
    const set = (patch: Partial<HubFilterValue>) => onChange({ ...value, ...patch });

    return (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
            <Input.Search className="sm:col-span-2 lg:!w-80" allowClear value={value.text} placeholder={t('filters.search')}
                onChange={e => set({ text: e.target.value })} />
            <Select<HubProjectStatus[]> mode="multiple" allowClear maxTagCount="responsive" className="w-full lg:!w-64"
                placeholder={t('filters.status')} value={value.status} onChange={status => set({ status })}
                options={PROJECT_STATUSES.map(s => ({ value: s, label: tEnums(`projectStatus.${s}`) }))} />
            <CustomerPicker className="w-full lg:!w-56" workspaceId={workspaceId} allowCreate={false} placeholder={t('filters.customer')}
                value={value.customerId ?? null} onChange={id => set({ customerId: id ?? undefined })} />
            <Select<ProjectType | 'all'> className="w-full lg:!w-48" value={value.type ?? 'all'}
                onChange={v => set({ type: v === 'all' ? undefined : v })}
                options={[{ value: 'all', label: t('filters.type') }, ...PROJECT_TYPES.map(p => ({ value: p, label: tEnums(`projectType.${p}`) }))]} />
            <label className="flex items-center gap-2 text-gray-600">
                <Switch checked={value.archived} onChange={archived => set({ archived })} />{t('filters.showArchived')}
            </label>
            {hubFilterActive(value) && (
                <Button type="link" className="justify-self-start !px-0" onClick={() => onChange(EMPTY_HUB_FILTER)}>{t('filters.clear')}</Button>
            )}
        </div>
    );
}
