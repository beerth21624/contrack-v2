'use client';

// ─── Drawer that edits the hub fields of a project (code, type, customer, site, dates, manager, description) ───
import { App, Button, DatePicker, Drawer, Form, Input, Select, Skeleton } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { PROJECT_CODE_MAX, PROJECT_TYPES, type HubProjectDetailDto, type ProjectType, type UpdateHubProjectRequest } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useMembers } from '@/features/cloud/query/hooks';
import { CustomerPicker } from '../shared/CustomerPicker';
import { useAssignProjectCode, useHubProject, usePatchHubProject } from './hooks';

const DEFAULT_TYPE = 'default';
const NO_MANAGER = 'none';
const DATE_FORMAT = 'DD/MM/YYYY';

interface FormValues {
    code: string;
    projectType: ProjectType | typeof DEFAULT_TYPE;
    customerId: string | null;
    siteAddress: string;
    plannedStart: Dayjs | null;
    plannedFinish: Dayjs | null;
    actualStart: Dayjs | null;
    actualFinish: Dayjs | null;
    managerUserId: string;
    description: string;
}

const toDay = (d: string | null): Dayjs | null => (d === null ? null : dayjs(d));
const fromDay = (d: Dayjs | null | undefined): string | null => (d === null || d === undefined ? null : d.format('YYYY-MM-DD'));

function initialValues(d: HubProjectDetailDto): FormValues {
    const h = d.hub;
    return {
        code: h.code ?? '',
        projectType: h.projectType ?? DEFAULT_TYPE,
        customerId: h.customerId,
        siteAddress: h.siteAddress,
        plannedStart: toDay(h.plannedStart),
        plannedFinish: toDay(h.plannedFinish),
        actualStart: toDay(h.actualStart),
        actualFinish: toDay(h.actualFinish),
        managerUserId: h.managerUserId ?? NO_MANAGER,
        description: h.description,
    };
}

/** Only what changed: re-sending an unchanged code would be checked for duplicates again. */
function changes(d: HubProjectDetailDto, v: FormValues): UpdateHubProjectRequest {
    const h = d.hub;
    const body: UpdateHubProjectRequest = {};
    const code = v.code.trim() === '' ? null : v.code.trim();
    if (code !== h.code) body.code = code;
    const type = v.projectType === DEFAULT_TYPE ? null : v.projectType;
    if (type !== h.projectType) body.projectType = type;
    const customerId = v.customerId ?? null;
    if (customerId !== h.customerId) body.customerId = customerId;
    if (v.siteAddress.trim() !== h.siteAddress) body.siteAddress = v.siteAddress.trim();
    const dates = ['plannedStart', 'plannedFinish', 'actualStart', 'actualFinish'] as const;
    for (const k of dates) {
        const next = fromDay(v[k]);
        if (next !== h[k]) body[k] = next;
    }
    const manager = v.managerUserId === NO_MANAGER ? null : v.managerUserId;
    if (manager !== h.managerUserId) body.managerUserId = manager;
    if (v.description.trim() !== h.description) body.description = v.description.trim();
    return body;
}

export function HubFieldsDrawer({ projectId, open, isNew = false, onClose, onSaved }: {
    projectId: string | undefined;
    open: boolean;
    /** Just created from the hub: the title says so and "cancel" reads "later". */
    isNew?: boolean;
    onClose: () => void;
    onSaved?: (detail: HubProjectDetailDto) => void;
}) {
    const t = useTranslations('hub');
    const tCommon = useTranslations('common');
    const tEnums = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const detail = useHubProject(open ? projectId : undefined);
    const d = detail.data;
    const members = useMembers(open ? d?.project.workspaceId : undefined);
    const patch = usePatchHubProject(projectId ?? '');
    const assign = useAssignProjectCode();
    const [form] = Form.useForm<FormValues>();

    const readOnly = d !== undefined && !d.canEdit;

    const submit = async () => {
        if (d === undefined) return;
        const values = await form.validateFields();
        const body = changes(d, values);
        try {
            const saved = Object.keys(body).length === 0 ? d : await patch.mutateAsync(body);
            void message.success(t('fields.saved'));
            onSaved?.(saved);
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const issueCode = async () => {
        if (projectId === undefined) return;
        try {
            const res = await assign.mutateAsync(projectId);
            form.setFieldValue('code', res.hub.code ?? '');
            void message.success(t('fields.codeAssigned', { code: res.hub.code ?? '' }));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const notBefore = (startField: 'plannedStart' | 'actualStart') => ({ getFieldValue }: { getFieldValue: (n: string) => unknown }) => ({
        validator: (_: unknown, value: Dayjs | null | undefined) => {
            const start = getFieldValue(startField) as Dayjs | null | undefined;
            if (value !== null && value !== undefined && start !== null && start !== undefined && value.isBefore(start, 'day')) {
                return Promise.reject(new Error(t('fields.finishBeforeStart')));
            }
            return Promise.resolve();
        },
    });

    return (
        <Drawer
            open={open}
            onClose={onClose}
            destroyOnHidden
            title={isNew ? t('fields.titleNew') : t('fields.title')}
            styles={{ wrapper: { width: 'min(560px, 100vw)' } }}
            footer={
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>{isNew ? t('fields.skip') : tCommon('cancel')}</Button>
                    {!readOnly && (
                        <Button type="primary" loading={patch.isPending} disabled={d === undefined} onClick={() => { void submit().catch(() => undefined); }}>
                            {tCommon('save')}
                        </Button>
                    )}
                </div>
            }
        >
            {d === undefined ? (
                detail.isError ? <div className="text-red-600">{toText(detail.error)}</div> : <Skeleton active />
            ) : (
                <Form<FormValues> form={form} layout="vertical" requiredMark={false} disabled={readOnly} initialValues={initialValues(d)}>
                    <Form.Item label={t('fields.code')} extra={d.hub.code === null && !readOnly ? t('fields.codeHint') : undefined}>
                        <div className="flex gap-2">
                            <Form.Item name="code" noStyle rules={[{ max: PROJECT_CODE_MAX }]}>
                                <Input maxLength={PROJECT_CODE_MAX} />
                            </Form.Item>
                            {d.hub.code === null && !readOnly && (
                                <Button loading={assign.isPending} onClick={() => { void issueCode(); }}>{t('fields.assignCode')}</Button>
                            )}
                        </div>
                    </Form.Item>
                    <Form.Item name="projectType" label={t('fields.projectType')}>
                        <Select options={[
                            { value: DEFAULT_TYPE, label: `${t('fields.projectTypeDefault')} (${tEnums(`projectType.${d.effectiveProjectType}`)})` },
                            ...PROJECT_TYPES.map(p => ({ value: p, label: tEnums(`projectType.${p}`) })),
                        ]} />
                    </Form.Item>
                    <Form.Item name="customerId" label={t('fields.customer')}>
                        <CustomerPicker workspaceId={d.project.workspaceId} disabled={readOnly} />
                    </Form.Item>
                    <Form.Item name="siteAddress" label={t('fields.siteAddress')} rules={[{ max: 1000 }]}>
                        <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} />
                    </Form.Item>
                    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                        <Form.Item name="plannedStart" label={t('fields.plannedStart')}>
                            <DatePicker className="w-full" format={DATE_FORMAT} />
                        </Form.Item>
                        <Form.Item name="plannedFinish" label={t('fields.plannedFinish')} dependencies={['plannedStart']} rules={[notBefore('plannedStart')]}>
                            <DatePicker className="w-full" format={DATE_FORMAT} />
                        </Form.Item>
                        <Form.Item name="actualStart" label={t('fields.actualStart')}>
                            <DatePicker className="w-full" format={DATE_FORMAT} />
                        </Form.Item>
                        <Form.Item name="actualFinish" label={t('fields.actualFinish')} dependencies={['actualStart']} rules={[notBefore('actualStart')]}>
                            <DatePicker className="w-full" format={DATE_FORMAT} />
                        </Form.Item>
                    </div>
                    <Form.Item name="managerUserId" label={t('fields.manager')}>
                        <Select
                            showSearch={{ optionFilterProp: 'label' }}
                            loading={members.isLoading}
                            options={[
                                { value: NO_MANAGER, label: t('fields.managerNone') },
                                ...(members.data ?? []).map(m => ({ value: m.userId, label: m.displayName === '' ? m.email : m.displayName })),
                                // The current manager while the member list loads (or after they left).
                                ...(d.hub.managerUserId !== null && !(members.data ?? []).some(m => m.userId === d.hub.managerUserId)
                                    ? [{ value: d.hub.managerUserId, label: d.managerName ?? d.hub.managerUserId }] : []),
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="description" label={t('fields.description')} rules={[{ max: 4000 }]}>
                        <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} maxLength={4000} />
                    </Form.Item>
                </Form>
            )}
        </Drawer>
    );
}
