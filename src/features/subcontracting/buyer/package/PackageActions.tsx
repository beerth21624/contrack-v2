'use client';

// ─── Secondary actions of a package: edit a draft, extend the deadline, cancel ───
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { App, DatePicker, Form, Input, Modal } from 'antd';
import type { BuyerPackageDto } from '@/shared/contract';

import { useCancelPackage, useExtendDeadline, useUpdatePackage } from '../hooks';
import { fmtDateTime, toDay } from '../format';

/** Latest of now and the current deadline: the new deadline must be after both. */
function minDeadline(current: string): Dayjs {
    const now = dayjs();
    const cur = dayjs(current);
    return cur.isAfter(now) ? cur : now;
}

export function ExtendDeadlineModal({ open, onClose, pkg }: { open: boolean; onClose: () => void; pkg: BuyerPackageDto }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const extend = useExtendDeadline(pkg.id);
    const [value, setValue] = useState<Dayjs | null>(() => minDeadline(pkg.bidDeadline).add(3, 'day').hour(17).minute(0).second(0));
    const min = minDeadline(pkg.bidDeadline);
    const valid = value?.isAfter(min) === true;
    const submit = async () => {
        if (value === null) return;
        try {
            await extend.mutateAsync({ bidDeadline: value.toDate().toISOString() });
            void message.success(t('buyer.actions.deadlineExtendedInviteesWillSee'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };
    return (
        <Modal open={open} onCancel={onClose} title={t('buyer.actions.extendBidDeadline')} destroyOnHidden okText={t('buyer.actions.extend')} cancelText={t('buyer.actions.cancel')}
            okButtonProps={{ disabled: !valid, loading: extend.isPending }} onOk={() => { void submit(); }}>
            <p className="text-secondary text-gray-600 mb-3">{t('buyer.actions.current')} {fmtDateTime(pkg.bidDeadline)}</p>
            <DatePicker showTime={{ format: 'HH:mm' }} format="D MMM YYYY HH:mm" value={value} onChange={setValue}
                disabledDate={d => d.isBefore(min, 'day')} className="w-full" />
            {value !== null && !valid && <div className="text-red-600 text-caption mt-1">{t('buyer.actions.mustBeAfterTheCurrent')}</div>}
        </Modal>
    );
}

export function CancelPackageModal({ open, onClose, pkg }: { open: boolean; onClose: () => void; pkg: BuyerPackageDto }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const cancel = useCancelPackage(pkg.id);
    const [reason, setReason] = useState('');
    const submit = async () => {
        try {
            await cancel.mutateAsync({ reason: reason.trim() });
            void message.success(t('buyer.actions.packageCancelledInviteesWereNotified'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };
    return (
        <Modal open={open} onCancel={onClose} title={t('buyer.actions.cancelThisPackage')} destroyOnHidden okText={t('buyer.actions.cancelPackage')} cancelText={t('buyer.actions.doNotCancel')}
            okButtonProps={{ danger: true, disabled: reason.trim() === '', loading: cancel.isPending }} onOk={() => { void submit(); }}>
            <p className="text-secondary text-gray-600 mb-2">{t('buyer.actions.everyInviteeWillSeeThis')}</p>
            <Input.TextArea rows={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder={t('buyer.actions.reason')} />
        </Modal>
    );
}

interface EditValues {
    title: string;
    description: string;
    bidDeadline: Dayjs | null;
    priceValidUntil: Dayjs | null;
}

/** Draft only: the fields people most often fix before sending (a full re-edit of lines and terms is not here yet). */
export function EditDraftModal({ open, onClose, pkg }: { open: boolean; onClose: () => void; pkg: BuyerPackageDto }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const update = useUpdatePackage(pkg.id);
    const [form] = Form.useForm<EditValues>();
    const submit = async () => {
        const v = await form.validateFields();
        try {
            await update.mutateAsync({
                title: v.title.trim(),
                description: v.description.trim(),
                ...(v.bidDeadline !== null ? { bidDeadline: v.bidDeadline.toDate().toISOString() } : {}),
                ...(v.priceValidUntil !== null ? { priceValidUntil: toDay(v.priceValidUntil.toDate()) } : {}),
            });
            void message.success(t('buyer.actions.saved'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };
    return (
        <Modal open={open} onCancel={onClose} title={t('buyer.actions.editPackageDraft')} destroyOnHidden okText={t('buyer.actions.save')} cancelText={t('buyer.actions.cancel')}
            okButtonProps={{ loading: update.isPending }} onOk={() => { void submit(); }}>
            <Form<EditValues> form={form} layout="vertical" requiredMark={false} initialValues={{
                title: pkg.title, description: pkg.description,
                bidDeadline: dayjs(pkg.bidDeadline), priceValidUntil: dayjs(pkg.priceValidUntil),
            }}>
                <Form.Item name="title" label={t('buyer.actions.packageName')} rules={[{ required: true, whitespace: true, message: t('buyer.actions.enterAPackageName') }]}>
                    <Input maxLength={160} />
                </Form.Item>
                <Form.Item name="description" label={t('buyer.actions.descriptionForRecipients')}>
                    <Input.TextArea rows={4} maxLength={4000} />
                </Form.Item>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                    <Form.Item name="bidDeadline" label={t('buyer.actions.bidsClose')} rules={[{ required: true, message: t('buyer.actions.chooseTheClosingDate') }]}>
                        <DatePicker showTime={{ format: 'HH:mm' }} format="D MMM YYYY HH:mm" className="w-full"
                            disabledDate={d => d.isBefore(dayjs(), 'day')} />
                    </Form.Item>
                    <Form.Item name="priceValidUntil" label={t('buyer.actions.priceValidUntil')} rules={[{ required: true, message: t('buyer.actions.chooseADate') }]}>
                        <DatePicker format="D MMM YYYY" className="w-full" />
                    </Form.Item>
                </div>
            </Form>
        </Modal>
    );
}
