'use client';

// ผู้คุมงาน of the project: people of the company (usually role ผู้คุมงาน / โฟร์แมน / วิศวกร), saved as one list.
// The pick is a draft until "บันทึก", so a slip of the mouse never changes the project by itself.
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { App, Button, Select } from 'antd';
import type { PersonDto, PersonRole } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { usePeople, useProjectSupervisors, usePutProjectSupervisors } from '@/features/cloud/api/workforce';
import { roleNameOf, workforceText } from '../text';
import { WORKSPACE_CREWS_HREF, type OpenCloudProject } from './project-workforce';

/** Most supervisors a project keeps (contract: putProjectSupervisorsRequestSchema). */
export const MAX_SUPERVISORS = 20;

const ROLE_ORDER: Record<PersonRole, number> = { supervisor: 0, foreman: 1, engineer: 2, skilled: 3, labourer: 4 };

/** Supervisors first (by role), then by name. Archived people are left out unless already chosen. */
export function supervisorOptions(people: readonly PersonDto[], chosen: readonly string[]): { value: string; label: string; role: string }[] {
    return people
        .filter(p => p.archivedAt === null || chosen.includes(p.id))
        .sort((a, b) => {
            const r = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
            return r !== 0 ? r : a.name.localeCompare(b.name, 'th');
        })
        .map(p => ({ value: p.id, label: personLabel(p), role: roleNameOf(workforceText(), p.role) }));
}

export const personLabel = (p: Pick<PersonDto, 'name' | 'nickname'>) =>
    (p.nickname === null || p.nickname === '' ? p.name : `${p.name} (${p.nickname})`);

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every(x => b.includes(x));

export function SupervisorsCard({ cloud, canEdit }: { cloud: OpenCloudProject; canEdit: boolean }) {
    const { message } = App.useApp();
    const t = useTranslations('workforce');
    const tc = useTranslations('common');
    const errorMessage = useErrorMessage();
    const people = usePeople(cloud.workspaceId);
    const current = useProjectSupervisors(cloud.projectId);
    const put = usePutProjectSupervisors(cloud.projectId);
    /** The pick being edited; null = showing what is saved. */
    const [draft, setDraft] = useState<string[] | null>(null);

    const saved = current.data?.personIds ?? [];
    const value = draft ?? saved;
    const dirty = draft !== null && !sameSet(draft, saved);
    const byId = new Map((people.data ?? []).map(p => [p.id, p]));
    const nameOf = (id: string) => {
        const p = byId.get(id);
        return p === undefined ? t('shared.archivedPerson') : personLabel(p);
    };
    const options = supervisorOptions(people.data ?? [], value);
    const loading = people.isLoading || current.isLoading;

    const save = () => {
        if (draft === null) return;
        put.mutateAsync(draft).then(
            () => { setDraft(null); void message.success(t('team.supervisors.saved')); },
            (e: unknown) => { void message.error(errorMessage(e)); },
        );
    };

    return (
        <section aria-label={t('team.supervisors.title')} className="bg-white border border-gray-200 rounded-card shadow-card px-4 sm:px-5 py-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-semibold text-[14px] text-gray-800 shrink-0">{t('team.supervisors.title')}</span>
                {canEdit ? (
                    <Select<string[]> mode="multiple" className="min-w-0 flex-1 basis-[280px]" value={value} loading={loading}
                        onChange={v => setDraft(v)} options={options} maxCount={MAX_SUPERVISORS} allowClear
                        placeholder={options.length === 0 && !loading ? t('team.supervisors.noPeople') : t('team.supervisors.placeholder')}
                        showSearch={{ optionFilterProp: 'label' }} aria-label={t('team.supervisors.title')}
                        labelRender={o => nameOf(String(o.value))}
                        optionRender={o => {
                            const p = byId.get(String(o.value));
                            return (
                                <span className="flex items-baseline gap-2 min-w-0">
                                    <span className="truncate">{nameOf(String(o.value))}</span>
                                    {p !== undefined && <span className="shrink-0 text-[12px] text-gray-500">{roleNameOf(t, p.role)}</span>}
                                </span>
                            );
                        }} />
                ) : (
                    <span className="min-w-0 text-[14px] text-gray-700">
                        {saved.length === 0 ? <span className="text-gray-400">{t('team.supervisors.none')}</span> : saved.map(nameOf).join(', ')}
                    </span>
                )}
                {dirty && (
                    <span className="flex gap-2 shrink-0">
                        <Button onClick={() => setDraft(null)}>{tc('cancel')}</Button>
                        <Button type="primary" loading={put.isPending} onClick={save}>{tc('save')}</Button>
                    </span>
                )}
            </div>
            {canEdit && !loading && (people.data ?? []).length === 0 && (
                <div className="text-[12px] text-gray-500">
                    {t.rich('team.supervisors.addPeople', {
                        link: chunks => <Link href={WORKSPACE_CREWS_HREF} className="text-blue-600 hover:underline">{chunks}</Link>,
                    })}
                </div>
            )}
            {(people.isError || current.isError) && (
                <div className="text-[12px] text-red-600">{errorMessage(people.error ?? current.error)}</div>
            )}
        </section>
    );
}
