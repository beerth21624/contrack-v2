'use client';

// ─── /subcontracting/settings: module settings of the workspace (defaults, rights, contract template) ───
// Percentages are typed as % (5) and stored as fractions (0.05). Only `sc.settings` saves; others see the values.
import { useRef } from 'react';
import { Alert, App, Button, Form, Input, InputNumber, Switch, Tag, Tooltip } from 'antd';
import type { SubcontractingSettingsDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { can } from '@/features/cloud/permissions';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { spinner } from '@/features/cloud/ui/common';
import { usePutScSettings, useScSettings } from './api';
import { TEMPLATE_PLACEHOLDERS, settingsFromForm as fromForm, settingsToForm as toForm, type SettingsForm } from './logic';
import { CARD, LoadError, PageFrame } from './ui';

export function SettingsPage() {
    const { workspace, isLoading } = useCurrentWorkspace();
    const q = useScSettings(workspace?.id);
    if (isLoading || q.isLoading) return spinner;
    if (workspace === undefined) return null;
    if (q.isError) return <PageFrame title="ตั้งค่าจ้างช่วง"><LoadError error={q.error} /></PageFrame>;
    if (q.data === undefined) return spinner;
    return <SettingsFormView key={workspace.id} workspaceId={workspace.id} workspaceName={workspace.name} settings={q.data} editable={can(workspace.role, 'sc.settings')} />;
}

function SettingsFormView({ workspaceId, workspaceName, settings, editable }: {
    workspaceId: string; workspaceName: string; settings: SubcontractingSettingsDto; editable: boolean;
}) {
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
            void message.success('บันทึกการตั้งค่าแล้ว');
        } catch (e) {
            void message.error(thaiErrorMessage(e));
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
            title="ตั้งค่าจ้างช่วง"
            subtitle={workspaceName}
            extra={editable ? <Button type="primary" loading={put.isPending} onClick={() => { void save(); }}>บันทึก</Button> : undefined}
        >
            {!editable && <Alert type="info" showIcon title="เฉพาะเจ้าของและผู้ดูแลแก้การตั้งค่าได้" />}
            <Form form={form} layout="vertical" requiredMark={false} disabled={!editable} initialValues={toForm(settings)}>
                <div className="flex flex-col gap-4">
                    <section className={`${CARD} p-5`}>
                        <h2 className="text-section font-semibold mt-0 mb-3">ค่าเริ่มต้นของสัญญาใหม่</h2>
                        <div className="grid sm:grid-cols-3 gap-x-6">
                            <Form.Item name="retentionPct" label="เงินประกันผลงาน" rules={[{ required: true, type: 'number', min: 0, max: 30, message: '0–30%' }]}>
                                {pctInput(30)}
                            </Form.Item>
                            <Form.Item name="warrantyMonths" label="ระยะประกันผลงาน" rules={[{ required: true, type: 'number', min: 0, max: 120, message: '0–120 เดือน' }]}>
                                <InputNumber min={0} max={120} precision={0} suffix="เดือน" className="!w-[160px]" />
                            </Form.Item>
                            <Form.Item name="whtPct" label="หักภาษี ณ ที่จ่าย" extra="ค่าจ้างทำของ ปกติ 3%" rules={[{ required: true, type: 'number', min: 0, max: 15, message: '0–15%' }]}>
                                {pctInput(15)}
                            </Form.Item>
                        </div>
                    </section>

                    <section className={`${CARD} p-5`}>
                        <h2 className="text-section font-semibold mt-0 mb-3">สิทธิ์และการตรวจ</h2>
                        <div className="flex flex-col">
                            <SwitchRow name="estimatorCanAward" label="ผู้ประมาณราคาตกลงจ้างได้" hint="ปิดไว้: ต้องให้เจ้าของหรือผู้ดูแลยืนยัน" />
                            <SwitchRow name="estimatorCanApproveClaims" label="ผู้ประมาณราคาอนุมัติงวดได้" />
                            <SwitchRow name="viewerSeesPrices" label="ผู้ดูอย่างเดียวเห็นราคาของผู้รับจ้าง" />
                            <SwitchRow name="fixesBlockNextClaim" label="ต้องปิดรายการแก้ก่อนอนุมัติงวดถัดไป" />
                        </div>
                        <Form.Item name="levelingPct" label="เตือนเมื่อราคาต่างจากประมาณการเกิน" className="!mt-4 !mb-0"
                            rules={[{ required: true, type: 'number', min: 1, max: 200, message: '1–200%' }]}>
                            <InputNumber min={1} max={200} step={5} suffix="%" className="!w-[160px]" />
                        </Form.Item>
                    </section>

                    <section className={`${CARD} p-5`}>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-section font-semibold m-0 flex-1">แม่แบบสัญญา</h2>
                            {editable && (
                                <Button size="small" disabled={template === ''} onClick={() => form.setFieldValue('contractTemplateHtml', '')}>ใช้แม่แบบมาตรฐาน</Button>
                            )}
                        </div>
                        <div className="text-secondary text-gray-600 mb-3">
                            {template === '' ? 'ใช้แม่แบบมาตรฐานภาษาไทยของระบบอยู่ — วาง HTML ของบริษัทเพื่อใช้แทน' : 'HTML ของบริษัท ใช้กับสัญญาที่ออกหลังบันทึก'}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {TEMPLATE_PLACEHOLDERS.map(p => (
                                <Tooltip key={p.key} title={editable ? 'คลิกเพื่อแทรก' : undefined}>
                                    <Tag className={`!m-0 font-mono text-[12px] ${editable ? 'cursor-pointer' : ''}`} onClick={editable ? () => insert(p.key) : undefined}>
                                        {`{{${p.key}}}`} <span className="font-sans text-gray-500">{p.label}</span>
                                    </Tag>
                                </Tooltip>
                            ))}
                        </div>
                        <Form.Item name="contractTemplateHtml" className="!mb-0" rules={[{ max: 200_000, message: 'ยาวเกิน 200,000 ตัวอักษร' }]}>
                            <Input.TextArea ref={areaRef} rows={14} className="font-mono text-[12px]" spellCheck={false}
                                placeholder="<h1>สัญญาจ้างเหมาช่วง</h1>&#10;<p>สัญญาเลขที่ {{contractNo}} ทำขึ้นระหว่าง {{buyerName}} ...</p>" />
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
