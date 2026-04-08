'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step30Input, calcStep30 } from '@/lib/steps/step30';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step30Input;  onBack: () => void; onSave: (inp: Step30Input, res: StepResult) => void; }

const DEFAULTS: Step30Input = {
    toilet_count: 0, washbasin_count: 0, shower_set_count: 0,
    bidet_count: 0, faucet_count: 0,
    kitchen_sink_count: 0, kitchen_faucet_count: 0,
    water_heater_count: 0, water_heater_type: 'none',
};

export default function Step30SanitaryFixtures({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step30');
    const [inp, setInp] = useState<Step30Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step30Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const num = (label: string, field: keyof Step30Input, tooltip?: string) => (
        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{label}</Text>}
            tooltip={tooltip} style={{ margin: 0, marginBottom: 12 }}>
            <InputNumber style={{ width: '100%' }} min={0} step={1}
                value={inp[field] as number} onChange={v => update({ [field]: v ?? 0 })} />
        </Form.Item>
    );

    const result = useMemo(() => {
        try {
            return calcStep30(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card1Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {num(t('toilet'), 'toilet_count')}
                    {num(t('washbasin'), 'washbasin_count')}
                    {num(t('showerSet'), 'shower_set_count')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    {num(t('bidet'), 'bidet_count')}
                    {num(t('faucet'), 'faucet_count', t('faucetTooltip'))}
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card2Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    {num(t('kitchenSink'), 'kitchen_sink_count', t('kitchenSinkTooltip'))}
                    {num(t('kitchenFaucet'), 'kitchen_faucet_count')}
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card3Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {num(t('quantity'), 'water_heater_count')}
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('type')}</Text>}
                        tooltip={t('typeTooltip')} style={{ margin: 0 }}>
                        <Select value={inp.water_heater_type} onChange={v => update({ water_heater_type: v })}
                            options={[
                                { value: 'none', label: t('typeNone') },
                                { value: 'instant', label: t('typeInstant') },
                                { value: 'storage', label: t('typeStorage') },
                            ]} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optCardMain')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {num(t('bathtub'), 'bathtub_count')}
                    {num(t('urinal'), 'urinal_count')}
                    {num(t('laundrySink'), 'laundry_sink_count')}
                </div>
            </Card>

            
        </div>
    );

    return (
        <StepFormShell stepId={30} title="สุขภัณฑ์" titleEn="Sanitary Fixtures"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
