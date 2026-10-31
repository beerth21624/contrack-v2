'use client';

// ─── Baseline of a project on the versions page: lock a version, show the active baseline, unlock with a reason ───
import { useState } from 'react';
import { Alert, App, Button, Form, Input, Modal, Select, Skeleton, Tag } from 'antd';
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { type BaselineUnlockBlocker, type BoqVersionDto, can } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { SectionCard } from '../shared/SectionCard';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { useHubProject } from '../hub/hooks';
import { useBaseline, useLockBaseline, useUnlockBaseline } from './hooks';

/** The "current BOQ" choice of the version select (lock without a versionId → the server issues a new version). */
const CURRENT = 'current';

function BlockerLine({ b }: { b: BaselineUnlockBlocker }) {
    const t = useTranslations('boqControl.baseline.blockers');
    const key = b.reason as 'contract_signed';
    return <li>{t.has(key) ? t(key, { count: b.count }) : t('other', { reason: b.reason, count: b.count })}</li>;
}

function UnlockModal({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
    const t = useTranslations('boqControl.baseline');
    const tc = useTranslations('common');
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const unlock = useUnlockBaseline(projectId);
    const [form] = Form.useForm<{ reason: string }>();
    const submit = async () => {
        const { reason } = await form.validateFields();
        try {
            await unlock.mutateAsync(reason.trim());
            void message.success(t('unlocked'));
            form.resetFields();
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };
    return (
        <Modal open={open} title={t('unlockTitle')} onCancel={onClose} destroyOnHidden
            okText={t('unlock')} cancelText={tc('cancel')} okButtonProps={{ danger: true, loading: unlock.isPending }}
            onOk={() => { void submit(); }}>
            <div className="mb-3 text-[13px] text-gray-600">{t('unlockHint')}</div>
            <Form form={form} layout="vertical" preserve={false}>
                <Form.Item name="reason" label={t('unlockReason')}
                    rules={[{ required: true, whitespace: true, message: t('unlockReasonRequired') }, { max: 500 }]}>
                    <Input.TextArea rows={3} maxLength={500} showCount />
                </Form.Item>
            </Form>
        </Modal>
    );
}

export function BaselinePanel({ projectId, versions }: { projectId: string; versions: readonly BoqVersionDto[] }) {
    const t = useTranslations('boqControl.baseline');
    const tl = useTranslations('boqControl.list');
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const baseline = useBaseline(projectId);
    const project = useHubProject(projectId);
    const ws = useErpWorkspace(project.data?.project.workspaceId);
    const lock = useLockBaseline(projectId);
    const [pick, setPick] = useState<string | undefined>();
    const [unlockOpen, setUnlockOpen] = useState(false);

    if (baseline.isLoading) return <SectionCard title={t('title')}><Skeleton active paragraph={{ rows: 2 }} /></SectionCard>;
    if (baseline.isError || baseline.data === undefined) {
        return <SectionCard title={t('title')}><Alert type="error" showIcon title={toText(baseline.error)} /></SectionCard>;
    }
    const st = baseline.data;
    const mayLock = can(ws.role, 'boq.baseline.lock');
    const mayUnlock = can(ws.role, 'boq.baseline.unlock');
    const past = st.history.filter(h => h.status === 'unlocked');

    const known = new Set(versions.map(v => v.id));
    const chosen = pick !== undefined && (pick === CURRENT || known.has(pick)) ? pick : versions[0]?.id ?? CURRENT;
    const options = [
        { value: CURRENT, label: t('currentBoq') },
        ...versions.map(v => ({ value: v.id, label: `${tl('versionNo', { no: v.versionNo })} · ${v.label}` })),
    ];

    const doLock = async () => {
        await lock.mutateAsync(chosen === CURRENT ? undefined : chosen);
        void message.success(t('locked'));
    };

    return (
        <SectionCard title={<span className="inline-flex items-center gap-2"><LockOutlined />{t('title')}</span>}>
            {st.locked && st.baseline !== null ? (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Tag color="blue" className="!font-semibold">{t('locked')}</Tag>
                        <span className="font-medium">{t('lockedFrom', { no: st.baseline.versionNo, label: st.baseline.label })}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-gray-600">
                        <span>{t('lockedAt')} <DateText value={st.baseline.lockedAt} style="dateTime" /></span>
                        <span>{t('reasonLabel')}: {t(`reasons.${st.baseline.reason}`)}</span>
                        <span>{t('costCodes', { count: st.costCodeCount })}</span>
                    </div>
                    {st.unlockBlockers.length > 0 && (
                        <Alert type="info" showIcon title={t('cannotUnlock')}
                            description={<ul className="m-0 list-disc pl-5">{st.unlockBlockers.map(b => <BlockerLine key={b.reason} b={b} />)}</ul>} />
                    )}
                    {mayUnlock && (
                        <div>
                            <Button danger icon={<UnlockOutlined />} disabled={st.unlockBlockers.length > 0} onClick={() => setUnlockOpen(true)}>
                                {t('unlock')}
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="text-[13px] text-gray-600">{t('notLocked')}</div>
                    {mayLock ? (
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">
                                {t('pickVersion')}
                                <Select className="!w-[320px] max-w-full" value={chosen} options={options} onChange={v => setPick(v)} />
                            </label>
                            <ConfirmAction type="primary" icon={<LockOutlined />} title={t('lockConfirm')} content={t('lockConfirmHint')}
                                okText={t('lock')} onConfirm={doLock}>
                                {t('lock')}
                            </ConfirmAction>
                        </div>
                    ) : (
                        <div className="text-[13px] text-gray-500">{t('noPermission')}</div>
                    )}
                </div>
            )}
            {past.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="mb-1 text-[13px] font-semibold text-gray-700">{t('history')}</div>
                    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-gray-600">
                        {past.map(h => (
                            <li key={h.id}>
                                {t('historyItem', { label: h.label })}
                                {h.unlockedAt !== null && <>{' '}<DateText value={h.unlockedAt} style="dateTime" /></>}
                                {h.unlockReason !== '' && <div className="whitespace-pre-wrap text-gray-500">{t('historyReason', { reason: h.unlockReason })}</div>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <UnlockModal projectId={projectId} open={unlockOpen} onClose={() => setUnlockOpen(false)} />
        </SectionCard>
    );
}
