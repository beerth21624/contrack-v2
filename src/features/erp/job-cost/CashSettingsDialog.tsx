'use client';

// ─── Company cash settings: opening balance on a date + the minimum balance that raises the warning ───
import { useEffect } from 'react';
import { App, DatePicker, Form, Modal } from 'antd';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import type { CashSettingsDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { MoneyInput } from '../shared/MoneyInput';
import { bangkokToday } from '../site-diary/form';
import { usePutCashSettings } from './hooks';

interface SettingsForm {
    openingBalance: number;
    asOf: dayjs.Dayjs;
    minBalance: number;
}

export function CashSettingsDialog({ workspaceId, open, settings, onClose }: {
    workspaceId: string;
    open: boolean;
    settings: CashSettingsDto | null;
    onClose: () => void;
}) {
    const t = useTranslations('jobCost.settings');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const put = usePutCashSettings(workspaceId);
    const [form] = Form.useForm<SettingsForm>();

    useEffect(() => {
        if (!open) return;
        form.setFieldsValue({
            openingBalance: settings?.openingBalance ?? 0,
            asOf: dayjs(settings?.asOf ?? bangkokToday()),
            minBalance: settings?.minBalance ?? 0,
        });
    }, [open, settings, form]);

    const submit = async (v: SettingsForm) => {
        try {
            await put.mutateAsync({ openingBalance: v.openingBalance, asOf: v.asOf.format('YYYY-MM-DD'), minBalance: v.minBalance });
            void message.success(t('saved'));
            onClose();
        } catch (err) {
            void message.error(toText(err));
        }
    };

    return (
        <Modal open={open} title={t('title')} okText={t('save')} confirmLoading={put.isPending} onOk={() => form.submit()} onCancel={onClose} destroyOnHidden forceRender>
            <p className="text-[13px] text-gray-600 mt-0">{t('intro')}</p>
            <Form<SettingsForm> form={form} layout="vertical" onFinish={submit}>
                <Form.Item name="openingBalance" label={t('openingBalance')} extra={t('openingHint')} rules={[{ required: true }]}><MoneyInput allowNegative /></Form.Item>
                <Form.Item name="asOf" label={t('asOf')} rules={[{ required: true }]}><DatePicker className="!w-full" allowClear={false} /></Form.Item>
                <Form.Item name="minBalance" label={t('minBalance')} extra={t('minHint')} rules={[{ required: true }]}><MoneyInput allowNegative /></Form.Item>
            </Form>
        </Modal>
    );
}
