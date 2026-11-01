'use client';

// ─── Claim flow dialogs (plan §4.7): request on behalf → inspect → approve (live amounts) → pay; reject ───
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { App, Button, Checkbox, DatePicker, Form, Input, Modal, Radio, Upload, type UploadFile } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import type { ClaimDto, FileDto, InspectionResult, SubcontractDto } from '@/shared/contract';
import { getTrade } from '@/domain/subcontracting/trades';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { contractsApi, scKeys, useChecklists, useContractMutation } from './api';
import { fmtMoney, fmtPct, inspectionResultLabel, previewApproveAmounts, todayIso } from './logic';
import { Money, MoneyInput } from './ui';
import { uploadFile, uploadProblem } from './upload';

/** After any claim change: the claims list too (useContractMutation refreshes the contract and lists). */
function useClaimMutation<V>(subcontractId: string, fn: (v: V) => Promise<ClaimDto>) {
    const qc = useQueryClient();
    const m = useContractMutation(subcontractId, fn);
    return {
        ...m,
        run: async (v: V) => {
            const r = await m.mutateAsync(v);
            void qc.invalidateQueries({ queryKey: scKeys.claims(subcontractId) });
            void qc.invalidateQueries({ queryKey: scKeys.retention(subcontractId) });
            return r;
        },
    };
}

// ── Request on behalf of the vendor ──

export function RequestClaimModal({ sc, installmentNo, onClose }: { sc: SubcontractDto; installmentNo: number; onClose: () => void }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [note, setNote] = useState('');
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [photos, setPhotos] = useState<Record<string, FileDto>>({});
    const m = useClaimMutation(sc.id, (body: { note: string; photoFileIds: string[] }) =>
        contractsApi.requestClaim(sc.id, { installmentNo, ...body }));
    const uploading = files.some(f => f.status === 'uploading');
    const inst = sc.installments.find(i => i.no === installmentNo);

    const submit = async () => {
        try {
            await m.run({ note: note.trim(), photoFileIds: files.flatMap(f => photos[f.uid]?.id ?? []) });
            void message.success(t('contracts.claim.createdToast', { no: String(installmentNo) }));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={t('contracts.claim.requestTitle', { no: String(installmentNo) })} okText={t('contracts.claim.createClaim')} cancelText={t('contracts.common.cancel')}
            okButtonProps={{ loading: m.isPending, disabled: uploading }} onOk={() => { void submit(); }} onCancel={onClose}>
            {inst !== undefined && (
                <p className="text-secondary text-gray-600 mt-0">{inst.condition} · <span className="tabular-nums">{fmtMoney(inst.amount)}</span> {t('contracts.common.baht')}</p>
            )}
            <Form layout="vertical">
                <Form.Item label={t('contracts.claim.photos')}>
                    <PhotoUpload files={files} setFiles={setFiles} onUploaded={(uid, dto) => setPhotos(p => ({ ...p, [uid]: dto }))} />
                </Form.Item>
                <Form.Item label={t('contracts.common.note')}>
                    <Input.TextArea rows={3} value={note} maxLength={2000} onChange={e => setNote(e.target.value)} placeholder={t('contracts.common.optional')} />
                </Form.Item>
            </Form>
        </Modal>
    );
}

function PhotoUpload({ files, setFiles, onUploaded }: {
    files: UploadFile[];
    setFiles: React.Dispatch<React.SetStateAction<UploadFile[]>>;
    onUploaded: (uid: string, dto: FileDto) => void;
}) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    return (
        <Upload
            listType="picture-card"
            accept="image/*"
            multiple
            fileList={files}
            maxCount={10}
            beforeUpload={(file) => {
                const problem = uploadProblem(file, t);
                if (problem !== null) {
                    void message.error(problem);
                    return Upload.LIST_IGNORE;
                }
                return true;
            }}
            customRequest={({ file, onSuccess, onError }) => {
                if (!(file instanceof File)) return;
                uploadFile(file, 'claim_photo').then(
                    (dto) => {
                        const uid = (file as File & { uid?: string }).uid;
                        if (uid !== undefined) onUploaded(uid, dto);
                        onSuccess?.(dto);
                    },
                    (e: unknown) => {
                        void message.error(toText(e));
                        onError?.(e instanceof Error ? e : new Error('upload failed'));
                    },
                );
            }}
            onChange={({ fileList }) => setFiles(fileList)}
        >
            {files.length < 10 && <div><PlusOutlined /><div className="mt-1 text-[12px]">{t('contracts.claim.addPhoto')}</div></div>}
        </Upload>
    );
}

// ── Inspect ──

interface InspectForm {
    result: InspectionResult;
    checks: string[];
    fixes: { text: string; done?: boolean }[];
    note?: string;
}

export function InspectModal({ sc, claim, onClose }: { sc: SubcontractDto; claim: ClaimDto; onClose: () => void }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const checklists = useChecklists();
    const [form] = Form.useForm<InspectForm>();
    const result = Form.useWatch('result', form);
    const m = useClaimMutation(sc.id, (body: Parameters<typeof contractsApi.inspect>[1]) => contractsApi.inspect(claim.id, body));
    const previous = claim.inspection;
    const fromServer = checklists.data?.[sc.trade];
    const items = previous !== null && previous.checklist.length > 0
        ? previous.checklist.map(c => c.item)
        : fromServer ?? getTrade(sc.trade).checklist;

    const submit = async () => {
        const v = await form.validateFields();
        const fixes = v.result === 'pass_with_fixes'
            ? v.fixes.filter(f => f.text.trim() !== '').map(f => ({ text: f.text.trim(), done: f.done === true }))
            : [];
        try {
            await m.run({
                result: v.result,
                checklist: items.map(item => ({ item, ok: v.checks.includes(item) })),
                fixes,
                note: (v.note ?? '').trim(),
            });
            void message.success(t('contracts.claim.inspectSavedToast'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open width={620} title={t('contracts.claim.inspectTitle', { no: String(claim.installmentNo) })} okText={t('contracts.claim.saveInspection')} cancelText={t('contracts.common.cancel')}
            okButtonProps={{ loading: m.isPending }} onOk={() => { void submit(); }} onCancel={onClose} destroyOnHidden>
            <p className="text-secondary text-gray-600 mt-0">{claim.condition}</p>
            <Form form={form} layout="vertical" requiredMark={false}
                initialValues={{
                    result: previous?.result ?? 'pass',
                    checks: previous?.checklist.filter(c => c.ok).map(c => c.item) ?? [],
                    fixes: previous !== null && previous.fixes.length > 0 ? previous.fixes : [{ text: '', done: false }],
                    note: previous?.note ?? '',
                }}>
                {items.length > 0 && (
                    <Form.Item name="checks" label={t('contracts.claim.checklist')}>
                        <Checkbox.Group className="flex flex-col gap-1.5" options={items.map(i => ({ value: i, label: i }))} />
                    </Form.Item>
                )}
                <Form.Item name="result" label={t('contracts.claim.result')}>
                    <Radio.Group optionType="button"
                        options={(['pass', 'pass_with_fixes', 'fail'] as const).map(r => ({ value: r, label: inspectionResultLabel(r, t) }))} />
                </Form.Item>
                {result === 'pass_with_fixes' && (
                    <Form.List name="fixes" rules={[{
                        validator: (_r, list: { text?: string }[] | undefined) => ((list ?? []).some(f => (f.text ?? '').trim() !== '')
                            ? Promise.resolve()
                            : Promise.reject(new Error(t('contracts.claim.needFix')))),
                    }]}>
                        {(fields, { add, remove }, { errors }) => (
                            <Form.Item label={t('contracts.claim.fixesLabel')}>
                                <div className="flex flex-col gap-2">
                                    {fields.map(f => (
                                        <div key={f.key} className="flex items-center gap-2">
                                            <Form.Item name={[f.name, 'done']} valuePropName="checked" noStyle>
                                                <Checkbox aria-label={t('contracts.claim.fixedAria')} />
                                            </Form.Item>
                                            <Form.Item name={[f.name, 'text']} noStyle rules={[{ max: 300 }]}>
                                                <Input placeholder={t('contracts.claim.fixExample')} />
                                            </Form.Item>
                                            <Button type="text" icon={<DeleteOutlined />} aria-label={t('contracts.common.delete')} onClick={() => remove(f.name)} />
                                        </div>
                                    ))}
                                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ text: '', done: false })}>{t('contracts.claim.addFix')}</Button>
                                    <div className="text-[12px] text-gray-500">{t('contracts.claim.tickWhenFixed')}</div>
                                    <Form.ErrorList errors={errors} />
                                </div>
                            </Form.Item>
                        )}
                    </Form.List>
                )}
                <Form.Item name="note" label={t('contracts.claim.noteLabel')} rules={[{ max: 2000 }]}>
                    <Input.TextArea rows={2} placeholder={t('contracts.common.optional')} />
                </Form.Item>
            </Form>
        </Modal>
    );
}

// ── Approve (adjustments + live amounts) ──

interface ApproveForm { adjustments: { label?: string; amount?: number | null }[] }

export function ApproveModal({ sc, claim, onClose }: { sc: SubcontractDto; claim: ClaimDto; onClose: () => void }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [form] = Form.useForm<ApproveForm>();
    const watched = Form.useWatch('adjustments', form) as ApproveForm['adjustments'] | undefined;
    const m = useClaimMutation(sc.id, (body: Parameters<typeof contractsApi.approve>[1]) => contractsApi.approve(claim.id, body));
    const adjustments = (watched ?? []).map(a => ({ label: a.label ?? '', amount: a.amount ?? 0 }));
    // The domain rule the server applies, on the installment's current amount.
    const preview = previewApproveAmounts(sc, claim, adjustments);

    const submit = async () => {
        await form.validateFields();
        try {
            await m.run({ adjustments: preview.adjustments });
            void message.success(t('contracts.claim.approvedToast', { no: String(claim.installmentNo) }));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open width={620} title={t('contracts.claim.approveTitle', { no: String(claim.installmentNo) })} okText={t('contracts.claim.approve')} cancelText={t('contracts.common.cancel')}
            okButtonProps={{ loading: m.isPending }} onOk={() => { void submit(); }} onCancel={onClose} destroyOnHidden>
            <Form form={form} layout="vertical" initialValues={{ adjustments: claim.amounts.adjustments }}>
                <Form.List name="adjustments">
                    {(fields, { add, remove }) => (
                        <Form.Item label={t('contracts.claim.adjustLabel')} extra={t('contracts.claim.adjustExtra')}>
                            <div className="flex flex-col gap-2">
                                {fields.map(f => (
                                    <div key={f.key} className="flex items-start gap-2">
                                        <Form.Item name={[f.name, 'label']} className="!mb-0 flex-1"
                                            rules={[{ required: true, whitespace: true, message: t('contracts.common.enterReason') }, { max: 200 }]}>
                                            <Input placeholder={t('contracts.common.reason')} />
                                        </Form.Item>
                                        <Form.Item name={[f.name, 'amount']} className="!mb-0"
                                            rules={[{ required: true, message: t('contracts.claim.enterAmount') }]}>
                                            <MoneyInput className="!w-[150px]" placeholder={t('contracts.common.baht')} />
                                        </Form.Item>
                                        <Button type="text" icon={<DeleteOutlined />} aria-label={t('contracts.common.delete')} onClick={() => remove(f.name)} />
                                    </div>
                                ))}
                                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ label: '', amount: null })} disabled={fields.length >= 20}>
                                    {t('contracts.claim.addAdjustment')}
                                </Button>
                            </div>
                        </Form.Item>
                    )}
                </Form.List>
            </Form>
            <AmountsTable amounts={preview} retentionPct={sc.terms.retentionPct} />
            <div className="text-[12px] text-gray-500 mt-2">{t('contracts.claim.disclaimer')}</div>
        </Modal>
    );
}

/** The claim calculation as a table, never hidden (plan §4.7). */
export function AmountsTable({ amounts, retentionPct }: { amounts: ClaimDto['amounts']; retentionPct?: number }) {
    const t = useTranslations('subcontracting');
    const row = (label: string, value: number, cls = '') => (
        <tr key={label} className={cls}>
            <td className="py-1 pr-4 text-gray-700">{label}</td>
            <td className="py-1 text-right tabular-nums whitespace-nowrap"><Money value={value} /></td>
        </tr>
    );
    return (
        <table className="w-full text-body border-t border-gray-200">
            <tbody>
                {row(t('contracts.claim.installmentValue'), amounts.gross)}
                {amounts.adjustments.map(a => row(a.label, a.amount))}
                {row(`${t('contracts.claim.retentionDeduction')}${retentionPct === undefined ? '' : ` ${fmtPct(retentionPct)}`}`, -amounts.retention)}
                {amounts.wht !== 0 && row(t('contracts.claim.wht'), -amounts.wht)}
                {amounts.vat !== 0 && row('VAT 7%', amounts.vat)}
                {row(t('contracts.claim.netPayable'), amounts.net, 'font-semibold border-t border-gray-200')}
            </tbody>
        </table>
    );
}

// ── Pay ──

interface PayForm { paidAt: Dayjs; amount: number; channel?: string; ref?: string }

export function PayModal({ sc, claim, onClose }: { sc: SubcontractDto; claim: ClaimDto; onClose: () => void }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [form] = Form.useForm<PayForm>();
    const m = useClaimMutation(sc.id, (body: Parameters<typeof contractsApi.pay>[1]) => contractsApi.pay(claim.id, body));

    const submit = async () => {
        const v = await form.validateFields();
        try {
            await m.run({ paidAt: v.paidAt.format('YYYY-MM-DD'), amount: v.amount, channel: (v.channel ?? '').trim(), ref: (v.ref ?? '').trim() });
            void message.success(t('contracts.claim.paidToast', { no: String(claim.installmentNo) }));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={t('contracts.claim.payTitle', { no: String(claim.installmentNo) })} okText={t('contracts.claim.recordPayment')} cancelText={t('contracts.common.cancel')}
            okButtonProps={{ loading: m.isPending }} onOk={() => { void submit(); }} onCancel={onClose} destroyOnHidden>
            <Form form={form} layout="vertical" requiredMark={false}
                initialValues={{ paidAt: dayjs(todayIso()), amount: claim.amounts.net, channel: t('contracts.claim.channelTransfer'), ref: '' }}>
                <div className="grid grid-cols-2 gap-x-3">
                    <Form.Item name="paidAt" label={t('contracts.claim.paidDate')} rules={[{ required: true, message: t('contracts.claim.pickDate') }]}>
                        <DatePicker className="w-full" format="D MMM YYYY" allowClear={false} />
                    </Form.Item>
                    <Form.Item name="amount" label={t('contracts.common.amountBaht')} extra={t('contracts.claim.netExtra', { amount: fmtMoney(claim.amounts.net) })}
                        rules={[{ required: true, message: t('contracts.common.enterAmountBaht') }, { type: 'number', min: 0, max: 1e11, message: t('contracts.claim.invalidAmount') }]}>
                        <MoneyInput className="!w-full" min={0} />
                    </Form.Item>
                </div>
                <Form.Item name="channel" label={t('contracts.claim.channel')} rules={[{ max: 60 }]}>
                    <Radio.Group optionType="button" options={[t('contracts.claim.channelTransfer'), t('contracts.claim.channelCheque'), t('contracts.claim.channelCash')].map(c => ({ value: c, label: c }))} />
                </Form.Item>
                <Form.Item name="ref" label={t('contracts.claim.reference')} rules={[{ max: 120 }]}>
                    <Input placeholder={t('contracts.common.optional')} />
                </Form.Item>
            </Form>
        </Modal>
    );
}

// ── Reject ──

export function RejectModal({ sc, claim, onClose }: { sc: SubcontractDto; claim: ClaimDto; onClose: () => void }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [form] = Form.useForm<{ reason: string }>();
    const m = useClaimMutation(sc.id, (reason: string) => contractsApi.reject(claim.id, { reason }));

    const submit = async () => {
        const { reason } = await form.validateFields();
        try {
            await m.run(reason.trim());
            void message.success(t('contracts.claim.rejectedToast'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={t('contracts.claim.rejectTitle', { no: String(claim.installmentNo) })} okText={t('contracts.claim.rejectOk')} cancelText={t('contracts.common.cancel')}
            okButtonProps={{ danger: true, loading: m.isPending }} onOk={() => { void submit(); }} onCancel={onClose} destroyOnHidden>
            <Form form={form} layout="vertical" requiredMark={false}>
                <Form.Item name="reason" label={t('contracts.common.reason')} rules={[{ required: true, whitespace: true, message: t('contracts.common.enterReason') }, { max: 1000 }]}>
                    <Input.TextArea rows={3} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
