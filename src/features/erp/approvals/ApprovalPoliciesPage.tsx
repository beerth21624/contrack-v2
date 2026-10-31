'use client';

// ─── Approval policies: per subject, who must approve and from which amount ───
import { useState } from 'react';
import { App, Button, Result, Select, Skeleton, Switch, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import { type ApprovalPolicyDto, type ModuleId, ROLES, type Role, can } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DateText } from '../shared/DateText';
import { ErpPage } from '../shared/ErpPage';
import { MoneyInput } from '../shared/MoneyInput';
import { SectionCard } from '../shared/SectionCard';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { AuditTimeline } from '../shared/AuditTimeline';
import { useApprovalPolicies, usePutApprovalPolicy } from './hooks';

export function ApprovalPoliciesPage() {
    const t = useTranslations('approvals');
    const toText = useErrorMessage();
    const ws = useErpWorkspace();
    const mayEdit = can(ws.role, 'company.manage');
    const wsId = ws.workspaceId;
    const q = useApprovalPolicies(wsId);

    return (
        <ErpPage title={t('policies.title')} subtitle={t('policies.subtitle')}>
            {q.isError ? (
                <Result status="warning" title={t('loadFailed')} subTitle={toText(q.error)}
                    extra={<Button onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
            ) : q.data === undefined || wsId === undefined ? (
                <Skeleton active />
            ) : (
                <div className="flex flex-col gap-4">
                    {!mayEdit && <div className="text-gray-600">{t('policies.readOnly')}</div>}
                    {q.data.map(p => (
                        // Re-keyed by the saved values so a refreshed policy resets the draft.
                        <PolicyCard key={`${p.subject}:${p.updatedAt ?? 'default'}`} workspaceId={wsId} policy={p} mayEdit={mayEdit} />
                    ))}
                </div>
            )}
            <AuditTimeline entityType="approval_policy" title={t('policies.history')} />
        </ErpPage>
    );
}

function PolicyCard({ workspaceId, policy, mayEdit }: { workspaceId: string; policy: ApprovalPolicyDto; mayEdit: boolean }) {
    const t = useTranslations('approvals');
    const tEnums = useTranslations('enums');
    const tRoles = useTranslations('roles');
    const tModules = useTranslations('modules');
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const put = usePutApprovalPolicy(workspaceId);
    const [enabled, setEnabled] = useState(policy.enabled);
    const [minAmount, setMinAmount] = useState<number | null>(policy.minAmount);
    const [roles, setRoles] = useState<Role[]>(policy.approverRoles);
    const [selfApprove, setSelfApprove] = useState(policy.selfApprove);

    const dirty = enabled !== policy.enabled || minAmount !== policy.minAmount || selfApprove !== policy.selfApprove
        || roles.length !== policy.approverRoles.length || roles.some(r => !policy.approverRoles.includes(r));
    const disabled = !mayEdit || put.isPending;
    // The owner always approves (the server adds it); shown and kept selected.
    const changeRoles = (next: Role[]) => setRoles(next.includes('owner') ? next : ['owner', ...next]);

    const save = async () => {
        try {
            await put.mutateAsync({ subject: policy.subject, body: { enabled, minAmount, approverRoles: roles, selfApprove } });
            void message.success(t('messages.policySaved'));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <SectionCard
            title={(
                <span className="flex flex-wrap items-center gap-2">
                    {tEnums(`approvalSubject.${policy.subject}`)}
                    <Tag className="!m-0">{tModules(`${policy.module as ModuleId}.label`)}</Tag>
                    {policy.isDefault && <Tag color="default" className="!m-0">{t('policies.isDefault')}</Tag>}
                </span>
            )}
            extra={mayEdit ? (
                <Button type="primary" disabled={!dirty} loading={put.isPending} onClick={() => void save()}>{t('policies.save')}</Button>
            ) : undefined}
        >
            <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3">
                    <Switch checked={enabled} onChange={setEnabled} disabled={disabled} />
                    <span>{t('policies.enabled')}</span>
                </label>
                <label className="flex items-center gap-3">
                    <Switch checked={selfApprove} onChange={setSelfApprove} disabled={disabled} />
                    <span>{t('policies.selfApprove')}</span>
                </label>
                <div>
                    <div className="mb-1 text-gray-700">{t('policies.minAmount')}</div>
                    <MoneyInput
                        value={minAmount}
                        onChange={v => setMinAmount(typeof v === 'number' ? v : null)}
                        disabled={disabled}
                        placeholder={t('policies.minAmountPlaceholder')}
                        aria-label={t('policies.minAmount')}
                    />
                    <div className="text-secondary text-gray-500 mt-1">{t('policies.minAmountHint')}</div>
                </div>
                <div>
                    <div className="mb-1 text-gray-700">{t('policies.approverRoles')}</div>
                    <Select<Role[]>
                        mode="multiple"
                        value={roles}
                        onChange={changeRoles}
                        disabled={disabled}
                        className="w-full"
                        aria-label={t('policies.approverRoles')}
                        options={ROLES.map(r => ({ value: r, label: tRoles(`${r}.label`), disabled: r === 'owner' }))}
                    />
                </div>
            </div>
            {policy.updatedAt !== null && (
                <div className="text-secondary text-gray-500 mt-3">{t('policies.updatedAt')} <DateText value={policy.updatedAt} style="dateTime" /></div>
            )}
        </SectionCard>
    );
}
