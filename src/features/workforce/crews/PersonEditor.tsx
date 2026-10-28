'use client';

// ─── Add / edit a person (บุคลากร): a drawer with name, nickname, phone, role, employment, trades, wage, note ───
import { App, Button, Drawer, Form, Input, InputNumber, Select } from 'antd';
import type { PersonDto } from '@/shared/contract';
import { useCreatePerson, useUpdatePerson, workforceConflict } from '@/features/cloud/api/workforce';
import { EMPTY_PERSON_FORM, personFormToRequest, personToForm, personUpdate, type PersonFormValues } from './logic';
import { EMPLOYMENT_OPTIONS, ROLE_OPTIONS, RULES, TRADE_OPTIONS, bahtFormatter, bahtParser, writeErrorMessage } from './shared';

/** closed, a new person, or a person to edit. The caller remounts the editor (a changing `key`) on every open. */
export type PersonEditorTarget = { mode: 'closed' } | { mode: 'open'; person: PersonDto | undefined };

export function PersonEditor({ workspaceId, target, seeWages, onClose }: {
    workspaceId: string; target: PersonEditorTarget; seeWages: boolean; onClose: () => void;
}) {
    const { message } = App.useApp();
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
                void message.success(`เพิ่ม "${saved.name}" แล้ว`);
            } else {
                await update.mutateAsync({ personId: person.id, ...personUpdate(req, !showWage) });
                void message.success('บันทึกแล้ว');
            }
            onClose();
        } catch (e) {
            if (workforceConflict(e)?.reason === 'name_taken') form.setFields([{ name: 'name', errors: [writeErrorMessage(e)] }]);
            else void message.error(writeErrorMessage(e));
        }
    };

    return (
        <Drawer open={target.mode === 'open'} onClose={onClose} destroyOnHidden size="min(480px, 100vw)"
            title={person === undefined ? 'เพิ่มบุคลากร' : `แก้ไข ${person.name}`}
            footer={(
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>ยกเลิก</Button>
                    <Button type="primary" loading={create.isPending || update.isPending} onClick={() => { void submit(); }}>
                        {person === undefined ? 'เพิ่มบุคลากร' : 'บันทึก'}
                    </Button>
                </div>
            )}>
            <Form form={form} layout="vertical" initialValues={initial} onFinish={() => { void submit(); }}>
                <Form.Item name="name" label="ชื่อ-นามสกุล" rules={RULES.name}>
                    <Input autoFocus />
                </Form.Item>
                <div className="grid grid-cols-2 gap-3">
                    <Form.Item name="nickname" label="ชื่อเล่น" rules={RULES.nickname}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="phone" label="เบอร์โทร" rules={RULES.phone}>
                        <Input inputMode="tel" placeholder="081-234-5678" />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Form.Item name="role" label="บทบาท">
                        <Select options={ROLE_OPTIONS} />
                    </Form.Item>
                    <Form.Item name="employment" label="การจ้าง">
                        <Select options={EMPLOYMENT_OPTIONS} />
                    </Form.Item>
                </div>
                <Form.Item name="trades" label="สายงาน">
                    <Select mode="multiple" allowClear showSearch={{ optionFilterProp: 'label' }} options={TRADE_OPTIONS}
                        placeholder="เลือกได้หลายสาย" />
                </Form.Item>
                {showWage && (
                    <Form.Item name="dailyWage" label="ค่าแรงต่อวัน" rules={RULES.wage}>
                        <InputNumber<number> min={0} precision={0} className="!w-full" suffix="บาท/วัน"
                            formatter={bahtFormatter} parser={bahtParser} />
                    </Form.Item>
                )}
                <Form.Item name="note" label="หมายเหตุ" rules={RULES.note}>
                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
                </Form.Item>
            </Form>
        </Drawer>
    );
}
