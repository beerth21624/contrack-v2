'use client';

// ─── Add / edit a person (บุคลากร): a drawer with name, nickname, phone, role, employment, trades, wage, note ───
import { useTranslations } from 'next-intl';
import { App, Button, Drawer, Form, Input, InputNumber, Select } from 'antd';
import type { PersonDto } from '@/shared/contract';
import { useCreatePerson, useUpdatePerson, workforceConflict } from '@/features/cloud/api/workforce';
import { EMPTY_PERSON_FORM, personFormToRequest, personToForm, personUpdate, type PersonFormValues } from './logic';
import { bahtFormatter, bahtParser, useWorkforceOptions, useWorkforceRules, useWriteErrorMessage } from './shared';

/** closed, a new person, or a person to edit. The caller remounts the editor (a changing `key`) on every open. */
export type PersonEditorTarget = { mode: 'closed' } | { mode: 'open'; person: PersonDto | undefined };

export function PersonEditor({ workspaceId, target, seeWages, onClose }: {
    workspaceId: string; target: PersonEditorTarget; seeWages: boolean; onClose: () => void;
}) {
    const { message } = App.useApp();
    const t = useTranslations('workforce');
    const tc = useTranslations('common');
    const options = useWorkforceOptions();
    const RULES = useWorkforceRules();
    const writeErrorMessage = useWriteErrorMessage();
    const [form] = Form.useForm<PersonFormValues>();
    const create = useCreatePerson(workspaceId);
    const update = useUpdatePerson(workspaceId);
    const person = target.mode === 'open' ? target.person : undefined;
    const initial = person === undefined ? EMPTY_PERSON_FORM : personToForm(person);
    const showWage = seeWages && person?.wagesHidden !== true;

    const submit = async () => {
        let values: PersonFormValues;
        try {
            values = await form.validateFields();
        } catch {
            return;
        }
        const req = personFormToRequest({ ...initial, ...(form.getFieldsValue(true) as Partial<PersonFormValues>), ...values });
        try {
            if (person === undefined) {
                const saved = await create.mutateAsync(showWage ? req : { ...req, dailyWage: null });
                void message.success(t('shared.addedNamed', { name: saved.name }));
            } else {
                await update.mutateAsync({ personId: person.id, ...personUpdate(req, !showWage) });
                void message.success(t('shared.saved'));
            }
            onClose();
        } catch (e) {
            if (workforceConflict(e)?.reason === 'name_taken') form.setFields([{ name: 'name', errors: [writeErrorMessage(e)] }]);
            else void message.error(writeErrorMessage(e));
        }
    };

    return (
        <Drawer open={target.mode === 'open'} onClose={onClose} destroyOnHidden size="min(480px, 100vw)"
            title={person === undefined ? t('people.editor.addTitle') : t('shared.editNamed', { name: person.name })}
            footer={(
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>{tc('cancel')}</Button>
                    <Button type="primary" loading={create.isPending || update.isPending} onClick={() => { void submit(); }}>
                        {person === undefined ? t('people.editor.addTitle') : tc('save')}
                    </Button>
                </div>
            )}>
            <Form form={form} layout="vertical" initialValues={initial} onFinish={() => { void submit(); }}>
                <Form.Item name="name" label={t('people.editor.name')} rules={RULES.name}>
                    <Input autoFocus />
                </Form.Item>
                <div className="grid grid-cols-2 gap-3">
                    <Form.Item name="nickname" label={t('people.editor.nickname')} rules={RULES.nickname}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="phone" label={t('people.editor.phone')} rules={RULES.phone}>
                        <Input inputMode="tel" placeholder="081-234-5678" />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Form.Item name="role" label={t('people.editor.role')}>
                        <Select options={options.roles} />
                    </Form.Item>
                    <Form.Item name="employment" label={t('people.editor.employment')}>
                        <Select options={options.employment} />
                    </Form.Item>
                </div>
                <Form.Item name="trades" label={t('people.editor.trades')}>
                    <Select mode="multiple" allowClear showSearch={{ optionFilterProp: 'label' }} options={options.trades}
                        placeholder={t('people.editor.tradesPlaceholder')} />
                </Form.Item>
                {showWage && (
                    <Form.Item name="dailyWage" label={t('people.editor.wage')} rules={RULES.wage}>
                        <InputNumber<number> min={0} precision={0} className="!w-full" suffix={t('people.editor.wageSuffix')}
                            formatter={bahtFormatter} parser={bahtParser} />
                    </Form.Item>
                )}
                <Form.Item name="note" label={t('people.editor.note')} rules={RULES.note}>
                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
                </Form.Item>
            </Form>
        </Drawer>
    );
}
