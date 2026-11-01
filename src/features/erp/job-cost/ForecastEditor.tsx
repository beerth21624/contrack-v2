'use client';

// ─── Edit the forecast at completion (EAC) of one cost code: automatic (from progress) or entered by hand ───
import { useEffect } from 'react';
import { App, Form, Input, Modal, Radio } from 'antd';
import { useTranslations } from 'next-intl';
import type { JobCostForecastMethod, JobCostLineDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { usePutForecast } from './hooks';

interface ForecastForm {
    method: JobCostForecastMethod;
    eac?: number;
    note?: string;
}

export function ForecastEditor({ projectId, line, onClose }: { projectId: string; line: JobCostLineDto | null; onClose: () => void }) {
    const t = useTranslations('jobCost.forecast');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const put = usePutForecast(projectId);
    const [form] = Form.useForm<ForecastForm>();
    const method = Form.useWatch('method', form);

    useEffect(() => {
        if (line === null) return;
        form.setFieldsValue({ method: line.forecastMethod, eac: line.forecastEac ?? line.eac, note: line.forecastNote });
    }, [line, form]);

    const submit = async (v: ForecastForm) => {
        if (line === null) return;
        const note = v.note === undefined || v.note.trim() === '' ? undefined : v.note.trim();
        try {
            await put.mutateAsync({
                costCodeId: line.costCodeId,
                body: v.method === 'manual'
                    ? { method: 'manual', eac: v.eac ?? 0, ...(note === undefined ? {} : { note }) }
                    : { method: 'auto', ...(note === undefined ? {} : { note }) },
            });
            void message.success(t('saved'));
            onClose();
        } catch (err) {
            void message.error(toText(err));
        }
    };

    return (
        <Modal
            open={line !== null}
            title={line === null ? '' : t('title', { code: line.code })}
            okText={t('save')}
            confirmLoading={put.isPending}
            onOk={() => form.submit()}
            onCancel={onClose}
            destroyOnHidden
            forceRender
        >
            {line !== null && (
                <div className="mb-3 text-[13px] text-gray-600 flex flex-col gap-0.5">
                    <div>{line.descTh}</div>
                    <div>{t('budget')} <MoneyText value={line.budget} /> · {t('actual')} <MoneyText value={line.actual} /> · {t('committed')} <MoneyText value={line.committedOpen} /></div>
                    <div>{t('currentEac')} <MoneyText value={line.eac} className="font-semibold" /></div>
                </div>
            )}
            <Form<ForecastForm> form={form} layout="vertical" onFinish={submit} initialValues={{ method: 'auto' }}>
                <Form.Item name="method" label={t('method')}>
                    <Radio.Group
                        options={[
                            { value: 'auto', label: t('auto') },
                            { value: 'manual', label: t('manual') },
                        ]}
                    />
                </Form.Item>
                <div className="text-[12px] text-gray-500 -mt-3 mb-3">{method === 'manual' ? t('manualHint') : t('autoHint')}</div>
                {method === 'manual' && (
                    <Form.Item name="eac" label={t('eac')} rules={[{ required: true }]}><MoneyInput /></Form.Item>
                )}
                <Form.Item name="note" label={t('note')}><Input.TextArea rows={2} maxLength={1000} showCount /></Form.Item>
            </Form>
        </Modal>
    );
}
