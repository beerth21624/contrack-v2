'use client';

// ─── /subcontracting/settings: module settings of the workspace (defaults, rights, contract template) ───
// Percentages are typed as % (5) and stored as fractions (0.05). Only `sc.settings` saves; others see the values.
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, App, Button, Form, Input, InputNumber, Switch, Tag, Tooltip } from 'antd';
import type { SubcontractingSettingsDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { can } from '@/features/cloud/permissions';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { spinner } from '@/features/cloud/ui/common';
import { usePutScSettings, useScSettings } from './api';
import { templatePlaceholders, settingsFromForm as fromForm, settingsToForm as toForm, type SettingsForm } from './logic';
import { CARD, LoadError, PageFrame } from './ui';

export function SettingsPage() {
    const t = useTranslations('subcontracting');
    const { workspace, isLoading } = useCurrentWorkspace();
    const q = useScSettings(workspace?.id);
    if (isLoading || q.isLoading) return spinner;
    if (workspace === undefined) return null;
    if (q.isError) return <PageFrame title={t('contracts.settings.title')}><LoadError error={q.error} /></PageFrame>;
    if (q.data === undefined) return spinner;
    return <SettingsFormView key={workspace.id} workspaceId={workspace.id} workspaceName={workspace.name} settings={q.data} editable={can(workspace.role, 'sc.settings')} />;
}

function SettingsFormView({ workspaceId, workspaceName, settings, editable }: {
    workspaceId: string; workspaceName: string; settings: SubcontractingSettingsDto; editable: boolean;
}) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [form] = Form.useForm<SettingsForm>();
    const put = usePutScSettings(workspaceId);
    const template = Form.useWatch('contractTemplateHtml', form) as string | undefined;
    const areaRef = useRef<React.ComponentRef<typeof Input.TextArea>>(null);

    const save = async () => {
        const v = await form.validateFields();
        try {
            const saved = await put.mutateAsync(fromForm(v));
            form.setFieldsValue(toForm(saved));
            void message.success(t('contracts.settings.saved'));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    /** Insert {{key}} at the caret of the template editor. */
    const insert = (key: string) => {
        const current = form.getFieldValue('contractTemplateHtml') as string;
        const el = areaRef.current?.resizableTextArea?.textArea;
        const at = el?.selectionStart ?? current.length;
        const token = `{{${key}}}`;
        form.setFieldValue('contractTemplateHtml', current.slice(0, at) + token + current.slice(el?.selectionEnd ?? at));
    };

    const pctInput = (max: number) => <InputNumber min={0} max={max} step={0.5} suffix="%" className="!w-[160px]" />;

    return (
        <PageFrame
            title={t('contracts.settings.title')}
            subtitle={workspaceName}
            extra={editable ? <Button type="primary" loading={put.isPending} onClick={() => { void save(); }}>{t('contracts.settings.save')}</Button> : undefined}
        >
            {!editable && <Alert type="info" showIcon title={t('contracts.settings.ownersOnly')} />}
            <Form form={form} layout="vertical" requiredMark={false} disabled={!editable} initialValues={toForm(settings)}>
                <div className="flex flex-col gap-4">
                    <section className={`${CARD} p-5`}>
                        <h2 className="text-section font-semibold mt-0 mb-3">{t('contracts.settings.defaultsTitle')}</h2>
                        <div className="grid sm:grid-cols-3 gap-x-6">
                            <Form.Item name="retentionPct" label={t('contracts.settings.retention')} rules={[{ required: true, type: 'number', min: 0, max: 30, message: t('contracts.settings.range0to30pct') }]}>
                                {pctInput(30)}
                            </Form.Item>
                            <Form.Item name="warrantyMonths" label={t('contracts.settings.warrantyPeriod')} rules={[{ required: true, type: 'number', min: 0, max: 120, message: t('contracts.settings.range0to120months') }]}>
                                <InputNumber min={0} max={120} precision={0} suffix={t('contracts.settings.months')} className="!w-[160px]" />
                            </Form.Item>
                            <Form.Item name="whtPct" label={t('contracts.settings.wht')} extra={t('contracts.settings.whtHint')} rules={[{ required: true, type: 'number', min: 0, max: 15, message: t('contracts.settings.range0to15pct') }]}>
                                {pctInput(15)}
                            </Form.Item>
                        </div>
                    </section>

                    <section className={`${CARD} p-5`}>
                        <h2 className="text-section font-semibold mt-0 mb-3">{t('contracts.settings.rightsTitle')}</h2>
                        <div className="flex flex-col">
                            <SwitchRow name="estimatorCanAward" label={t('contracts.settings.estimatorAwards')} hint={t('contracts.settings.estimatorAwardsHint')} />
                            <SwitchRow name="estimatorCanApproveClaims" label={t('contracts.settings.estimatorApproves')} />
                            <SwitchRow name="viewerSeesPrices" label={t('contracts.settings.viewerSeesPrices')} />
                            <SwitchRow name="fixesBlockNextClaim" label={t('contracts.settings.fixesBlock')} />
                        </div>
                        <Form.Item name="levelingPct" label={t('contracts.settings.levelingWarn')} className="!mt-4 !mb-0"
                            rules={[{ required: true, type: 'number', min: 1, max: 200, message: t('contracts.settings.range1to200pct') }]}>
                            <InputNumber min={1} max={200} step={5} suffix="%" className="!w-[160px]" />
                        </Form.Item>
                    </section>

                    <section className={`${CARD} p-5`}>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-section font-semibold m-0 flex-1">{t('contracts.settings.templateTitle')}</h2>
                            {editable && (
                                <Button size="small" disabled={template === ''} onClick={() => form.setFieldValue('contractTemplateHtml', '')}>{t('contracts.settings.useStandardTemplate')}</Button>
                            )}
                        </div>
                        <div className="text-secondary text-gray-600 mb-3">
                            {template === '' ? t('contracts.settings.usingStandard') : t('contracts.settings.usingCustom')}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {templatePlaceholders(t).map(p => (
                                <Tooltip key={p.key} title={editable ? t('contracts.settings.clickToInsert') : undefined}>
                                    <Tag className={`!m-0 font-mono text-[12px] ${editable ? 'cursor-pointer' : ''}`} onClick={editable ? () => insert(p.key) : undefined}>
                                        {`{{${p.key}}}`} <span className="font-sans text-gray-500">{p.label}</span>
                                    </Tag>
                                </Tooltip>
                            ))}
                        </div>
                        <Form.Item name="contractTemplateHtml" className="!mb-0" rules={[{ max: 200_000, message: t('contracts.settings.tooLong') }]}>
                            <Input.TextArea ref={areaRef} rows={14} className="font-mono text-[12px]" spellCheck={false}
                                placeholder={t('contracts.settings.templateExample', { contractNo: '{{contractNo}}', buyerName: '{{buyerName}}' })} />
                        </Form.Item>
                    </section>
                </div>
            </Form>
        </PageFrame>
    );
}

function SwitchRow({ name, label, hint }: { name: keyof SettingsForm; label: string; hint?: string }) {
    return (
        <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0">
            <div className="flex-1 min-w-0">
                <div>{label}</div>
                {hint !== undefined && <div className="text-[12px] text-gray-500">{hint}</div>}
            </div>
            <Form.Item name={name} valuePropName="checked" noStyle><Switch /></Form.Item>
        </div>
    );
}
