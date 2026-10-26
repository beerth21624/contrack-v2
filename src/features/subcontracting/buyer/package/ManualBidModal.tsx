'use client';

// ─── "บันทึกราคาแทน": the buyer types a price received by phone / on paper, with the same fields as the bid form ───
// The bid is marked "บันทึกโดยผู้ซื้อ" (enteredByBuyer) by the server.
import { useState } from 'react';
import dayjs from 'dayjs';
import { App, Alert, Button, Checkbox, DatePicker, Input, InputNumber, Modal, Segmented } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { type BidMode, type BuyerPackageDto, type ScInvitationDto, manualBidRequestSchema } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useManualBid } from '../hooks';
import { installmentsTotal, installmentsValid, money, money0, pct, qty, renumber, toDay } from '../format';
import {
    type ManualBidForm, type ManualBidLine, allowedBidModes, initialManualBid, manualBidRequest, manualBidTotal, unpricedLines,
} from './helpers';

const num = (v: number | string | null): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function ManualBidModal({ pkg, invitation, onClose }: {
    pkg: BuyerPackageDto;
    /** null = closed. */
    invitation: ScInvitationDto | null;
    onClose: () => void;
}) {
    return (
        <Modal open={invitation !== null} onCancel={onClose} footer={null} width={960} destroyOnHidden
            title={invitation === null ? 'บันทึกราคาแทน' : `บันทึกราคาแทน ${invitation.displayName}`}>
            {invitation !== null && <ManualBidBody pkg={pkg} invitation={invitation} onClose={onClose} />}
        </Modal>
    );
}

function ManualBidBody({ pkg, invitation, onClose }: { pkg: BuyerPackageDto; invitation: ScInvitationDto; onClose: () => void }) {
    const { message } = App.useApp();
    const save = useManualBid(pkg.id);
    const [form, setForm] = useState<ManualBidForm>(() => initialManualBid(pkg));
    const [tried, setTried] = useState(false);
    const modes = allowedBidModes(pkg.pricingMode);
    const set = (patch: Partial<ManualBidForm>) => setForm(f => ({ ...f, ...patch }));
    const setLine = (idx: number, patch: Partial<ManualBidLine>) =>
        setForm(f => ({ ...f, lines: f.lines.map(l => (l.idx === idx ? { ...l, ...patch } : l)) }));

    const total = manualBidTotal(pkg, form);
    const missing = new Set(unpricedLines(pkg, form));
    const lumpMissing = form.mode === 'lump' && form.lumpTotal === null;
    const installmentsBad = !form.acceptInstallments && !installmentsValid(form.installments);

    const submit = async () => {
        setTried(true);
        if (missing.size > 0 || lumpMissing || installmentsBad) {
            void message.error(missing.size > 0 ? `ยังไม่ได้ใส่ราคา ${String(missing.size)} แถว (หรือติ๊ก "ไม่รวม")` : 'กรอกข้อมูลให้ครบก่อนบันทึก');
            return;
        }
        const parsed = manualBidRequestSchema.safeParse(manualBidRequest(form));
        if (!parsed.success) {
            void message.error(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
            return;
        }
        try {
            await save.mutateAsync({ invitationId: invitation.id, body: parsed.data });
            void message.success('บันทึกราคาแล้ว');
            onClose();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    const lineState = new Map(form.lines.map(l => [l.idx, l]));
    const hasVendorMaterial = pkg.lines.some(l => l.materialBy === 'vendor');

    return (
        <div className="flex flex-col gap-4">
            <p className="text-secondary text-gray-600 m-0">ราคานี้จะติดป้าย &quot;บันทึกโดยผู้ซื้อ&quot; ในตารางเทียบ</p>

            {modes.length > 1 && (
                <Segmented<BidMode> value={form.mode} onChange={m => set({ mode: m })}
                    options={[{ value: 'unit', label: 'ต่อหน่วยรายแถว' }, { value: 'lump', label: 'เหมารวม' }]} />
            )}

            {form.mode === 'unit' ? (
                <div className="overflow-x-auto border border-gray-200 rounded-card">
                    <table className="w-full text-body">
                        <thead className="bg-gray-50 text-secondary text-gray-600">
                            <tr>
                                <th className="text-left font-medium px-3 py-2">รายการ</th>
                                <th className="text-right font-medium px-3 py-2 w-28">ปริมาณ</th>
                                <th className="text-right font-medium px-3 py-2 w-36">ค่าแรง/หน่วย</th>
                                {hasVendorMaterial && <th className="text-right font-medium px-3 py-2 w-36">วัสดุ/หน่วย</th>}
                                <th className="text-center font-medium px-3 py-2 w-20">ไม่รวม</th>
                                <th className="text-right font-medium px-3 py-2 w-32">รวม</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pkg.lines.map(line => {
                                const f = lineState.get(line.idx);
                                if (f === undefined) return null;
                                const bad = tried && missing.has(line.idx);
                                return (
                                    <tr key={line.idx} className="border-t border-gray-100 align-top">
                                        <td className="px-3 py-2">
                                            <div>{line.desc}</div>
                                            {f.excluded && (
                                                <Input size="small" className="!mt-1" placeholder="เหตุผลที่ไม่รวม" maxLength={300}
                                                    value={f.reason} onChange={e => setLine(line.idx, { reason: e.target.value })} />
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{qty(line.qtyPriced)} {line.unit}</td>
                                        <td className="px-3 py-2 text-right">
                                            <InputNumber size="small" min={0} className="!w-32" disabled={f.excluded}
                                                status={bad && f.unitPrice === null ? 'error' : undefined}
                                                value={f.unitPrice} onChange={v => setLine(line.idx, { unitPrice: num(v) })} />
                                        </td>
                                        {hasVendorMaterial && (
                                            <td className="px-3 py-2 text-right">
                                                {line.materialBy === 'vendor' ? (
                                                    <InputNumber size="small" min={0} className="!w-32" disabled={f.excluded}
                                                        status={bad && f.matUnitPrice === null ? 'error' : undefined}
                                                        value={f.matUnitPrice} onChange={v => setLine(line.idx, { matUnitPrice: num(v) })} />
                                                ) : <span className="text-gray-400">–</span>}
                                            </td>
                                        )}
                                        <td className="px-3 py-2 text-center">
                                            <Checkbox checked={f.excluded} onChange={e => setLine(line.idx, { excluded: e.target.checked })} />
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                                            {f.excluded ? <span className="text-gray-400">ไม่รวม</span>
                                                : money(manualBidTotal({ lines: [line] }, { mode: 'unit', lines: [f], lumpTotal: null, adjustment: 0 }))}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
                    <Field label="ราคาเหมารวม (บาท)">
                        <InputNumber min={0} className="!w-full" status={tried && lumpMissing ? 'error' : undefined}
                            value={form.lumpTotal} onChange={v => set({ lumpTotal: num(v) })} />
                    </Field>
                    <Field label="รวม / ไม่รวมอะไรบ้าง">
                        <Input.TextArea rows={2} maxLength={2000} value={form.inclusions} onChange={e => set({ inclusions: e.target.value })} />
                    </Field>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
                <Field label="ส่วนลด (−) / บวกเพิ่ม (+)">
                    <InputNumber className="!w-full" value={form.adjustment} onChange={v => set({ adjustment: num(v) ?? 0 })} />
                </Field>
                <Field label="หมายเหตุส่วนลด">
                    <Input maxLength={300} value={form.adjustmentNote} onChange={e => set({ adjustmentNote: e.target.value })} />
                </Field>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Field label="จำนวนวัน">
                    <InputNumber min={1} precision={0} className="!w-full" value={form.days} onChange={v => set({ days: num(v) })} />
                </Field>
                <Field label="เริ่มได้วันที่">
                    <DatePicker format="D MMM YY" className="w-full" value={form.earliestStart === null ? null : dayjs(form.earliestStart)}
                        onChange={d => set({ earliestStart: d === null ? null : toDay(d.toDate()) })} />
                </Field>
                <Field label="ช่างฝีมือ (คน)">
                    <InputNumber min={0} precision={0} className="!w-full" value={form.crewSkilled} onChange={v => set({ crewSkilled: num(v) })} />
                </Field>
                <Field label="คนงาน (คน)">
                    <InputNumber min={0} precision={0} className="!w-full" value={form.crewLabourers} onChange={v => set({ crewLabourers: num(v) })} />
                </Field>
                <Field label="ราคายืนถึง">
                    <DatePicker format="D MMM YY" className="w-full" value={form.validUntil === null ? null : dayjs(form.validUntil)}
                        onChange={d => set({ validUntil: d === null ? null : toDay(d.toDate()) })} />
                </Field>
            </div>

            <div>
                <Checkbox checked={form.acceptInstallments} onChange={e => set({ acceptInstallments: e.target.checked })}>
                    ใช้งวดจ่ายตามแพ็กเกจ ({pkg.installments.map(i => pct(i.pct)).join(' / ')})
                </Checkbox>
                {!form.acceptInstallments && (
                    <InstallmentsEditor value={form.installments} onChange={installments => set({ installments })} showError={tried} />
                )}
            </div>

            {pkg.terms.questions.length > 0 && (
                <div className="flex flex-col gap-2">
                    <div className="font-medium">คำตอบคำถามของงาน</div>
                    {pkg.terms.questions.map((question, k) => (
                        <Field key={question} label={question}>
                            <Input maxLength={1000} value={form.answers[k] ?? ''}
                                onChange={e => set({ answers: form.answers.map((a, j) => (j === k ? e.target.value : a)) })} />
                        </Field>
                    ))}
                </div>
            )}

            <Field label="หมายเหตุ">
                <Input.TextArea rows={2} maxLength={2000} value={form.note} onChange={e => set({ note: e.target.value })} />
            </Field>

            <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
                <div className="flex-1">
                    <span className="text-gray-600">รวม </span>
                    <span className="text-card-title font-semibold tabular-nums">{money0(total)}</span>
                    <span className="text-gray-600"> บาท</span>
                </div>
                <Button onClick={onClose}>ยกเลิก</Button>
                <Button type="primary" loading={save.isPending} onClick={() => { void submit(); }}>บันทึกราคา</Button>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1 min-w-0">
            <span className="text-secondary text-gray-600">{label}</span>
            {children}
        </label>
    );
}

function InstallmentsEditor({ value, onChange, showError }: {
    value: ManualBidForm['installments'];
    onChange: (v: ManualBidForm['installments']) => void;
    showError: boolean;
}) {
    const sum = installmentsTotal(value);
    const sumOk = Math.abs(sum - 1) <= 0.0001;
    const patch = (k: number, p: Partial<ManualBidForm['installments'][number]>) => onChange(value.map((i, j) => (j === k ? { ...i, ...p } : i)));
    return (
        <div className="flex flex-col gap-2 mt-2">
            {value.map((i, k) => (
                <div key={i.no} className="flex items-center gap-2">
                    <span className="w-14 text-gray-600">งวด {i.no}</span>
                    <InputNumber size="small" min={0} max={100} className="!w-24" suffix="%"
                        value={Math.round(i.pct * 1000) / 10} onChange={v => patch(k, { pct: (num(v) ?? 0) / 100 })} />
                    <Input size="small" maxLength={300} placeholder="เงื่อนไขส่งมอบ" value={i.condition}
                        status={showError && i.condition.trim() === '' ? 'error' : undefined}
                        onChange={e => patch(k, { condition: e.target.value })} />
                    <Button size="small" type="text" icon={<DeleteOutlined />} disabled={value.length <= 1} aria-label="ลบงวด"
                        onClick={() => onChange(renumber(value.filter((_, j) => j !== k)))} />
                </div>
            ))}
            <div className="flex items-center gap-3">
                <Button size="small" icon={<PlusOutlined />}
                    onClick={() => onChange(renumber([...value, { no: value.length + 1, pct: Math.max(0, 1 - sum), condition: '' }]))}>
                    เพิ่มงวด
                </Button>
                <span className={sumOk ? 'text-secondary text-gray-500' : 'text-secondary text-red-600'}>รวม {pct(sum)}{sumOk ? '' : ' (ต้องเท่ากับ 100%)'}</span>
            </div>
            {showError && !sumOk && <Alert type="error" showIcon title="งวดต้องรวมได้ 100%" />}
        </div>
    );
}
