'use client';

// ─── Create a quotation from the project's BOQ: one-click button, and a dialog with the options ───
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Form, Input, Modal, Select } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
    DETAIL_LEVELS, DOC_LANGUAGES, QUOTATION_FORMATS, can, type CreateQuotationRequest,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useModuleEnabled } from '@/features/modules/modules';
import { useBoqVersions } from '../boq-control/hooks';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { useCreateQuotation } from './hooks';

/** The `quotations` module is active for the workspace and the role may manage quotations. */
export function useCanCreateQuotation(workspaceId: string | undefined): boolean {
    const ws = useErpWorkspace(workspaceId);
    const on = useModuleEnabled('quotations', ws.workspaceId).enabled;
    return on && can(ws.role, 'quotations.manage');
}

export const quotationHref = (projectId: string, quotationId: string): string =>
    `/p/${encodeURIComponent(projectId)}/quotations/${encodeURIComponent(quotationId)}`;

/** "Create quotation from BOQ": one click with the project's defaults, then opens the editor. Renders nothing when not allowed. */
export function CreateQuotationButton({ projectId, workspaceId, type = 'default', size }: {
    projectId: string;
    workspaceId: string | undefined;
    type?: 'default' | 'primary';
    size?: 'small' | 'middle' | 'large';
}) {
    const t = useTranslations('quotations');
    const router = useRouter();
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const allowed = useCanCreateQuotation(workspaceId);
    const create = useCreateQuotation(projectId);
    if (!allowed) return null;
    return (
        <Button type={type} size={size} icon={<FileTextOutlined />} loading={create.isPending}
            onClick={() => {
                create.mutateAsync({})
                    .then(v => { router.push(quotationHref(projectId, v.quotationId)); })
                    .catch((e: unknown) => { void message.error(toText(e)); });
            }}>
            {t('create.oneClick')}
        </Button>
    );
}

interface FormValues {
    title?: string;
    boqVersionId?: string;
    format?: CreateQuotationRequest['format'];
    detailLevel?: CreateQuotationRequest['detailLevel'];
    language?: CreateQuotationRequest['language'];
}

export function CreateFromBoqDialog({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
    const t = useTranslations('quotations');
    const tEnums = useTranslations('enums');
    const router = useRouter();
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [form] = Form.useForm<FormValues>();
    const create = useCreateQuotation(projectId);
    const hasVersions = useModuleEnabled('boq-control').enabled;
    const versions = useBoqVersions(hasVersions && open ? projectId : undefined);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const v = form.getFieldsValue();
        const body: CreateQuotationRequest = {};
        if (v.title !== undefined && v.title.trim() !== '') body.title = v.title.trim();
        if (v.boqVersionId !== undefined) body.boqVersionId = v.boqVersionId;
        if (v.format !== undefined) body.format = v.format;
        if (v.detailLevel !== undefined) body.detailLevel = v.detailLevel;
        if (v.language !== undefined) body.language = v.language;
        setBusy(true);
        try {
            const res = await create.mutateAsync(body);
            onClose();
            router.push(quotationHref(projectId, res.quotationId));
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={open} title={t('create.title')} onCancel={onClose} okText={t('create.submit')} confirmLoading={busy}
            onOk={() => { void submit(); }} destroyOnHidden>
            <div className="mb-3 text-[13px] text-gray-500">{t('create.hint')}</div>
            <Form<FormValues> form={form} layout="vertical">
                <Form.Item name="title" label={t('create.fields.title')}>
                    <Input maxLength={200} placeholder={t('create.fields.titlePlaceholder')} />
                </Form.Item>
                {hasVersions && (
                    <Form.Item name="boqVersionId" label={t('create.fields.boqVersion')}>
                        <Select allowClear placeholder={t('create.fields.boqCurrent')} loading={versions.isLoading}
                            options={(versions.data ?? []).map(v => ({ value: v.id, label: `${t('create.versionNo', { no: v.versionNo })} · ${v.label}` }))} />
                    </Form.Item>
                )}
                <Form.Item name="format" label={t('fields.format')}>
                    <Select allowClear placeholder={t('create.fields.projectDefault')}
                        options={QUOTATION_FORMATS.map(f => ({ value: f, label: tEnums(`quotationFormat.${f}`) }))} />
                </Form.Item>
                <Form.Item name="detailLevel" label={t('fields.detailLevel')}>
                    <Select allowClear placeholder={t('create.fields.projectDefault')}
                        options={DETAIL_LEVELS.map(f => ({ value: f, label: tEnums(`detailLevel.${f}`) }))} />
                </Form.Item>
                <Form.Item name="language" label={t('fields.language')}>
                    <Select allowClear placeholder={t('create.fields.projectDefault')}
                        options={DOC_LANGUAGES.map(l => ({ value: l, label: t(`languages.${l}`) }))} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
