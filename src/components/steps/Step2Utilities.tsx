'use client';

import { useState, useMemo, useCallback } from "react";
import { InputNumber, Switch, Select, Form, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { calcStep2 } from '@/lib/steps';
import type { Step2Input, StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step2Input;  onSave: (inp: Step2Input, res: StepResult) => void; onBack: () => void; }

const DEFAULT: Step2Input = {
    distance_to_power_source_m: 0, distance_to_water_source_m: 0, waste_percent: 0,
    main_breaker_amp: 0, electric_meter_type: '1P-30A', pipe_type: 'pe', water_meter_type: '1/2', permit_required: false,
};

export const Step2Utilities: React.FC<Props> = ({ onSave, onBack, initialData }) => {
    const [inp, setInp] = useState<Step2Input>(initialData ?? DEFAULT);
    const t = useTranslations('steps.step2');
    const update = useCallback((patch: Partial<Step2Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep2(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('distPower')}</Text>} 
                tooltip={t('distPowerTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber style={{ width: '100%' }} min={0} step={5} precision={1}
                    value={inp.distance_to_power_source_m} onChange={v => update({ distance_to_power_source_m: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('distWater')}</Text>} 
                tooltip={t('distWaterTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber style={{ width: '100%' }} min={0} step={5} precision={1}
                    value={inp.distance_to_water_source_m} onChange={v => update({ distance_to_water_source_m: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                <InputNumber style={{ width: '100%' }} min={0} max={20} step={1}
                    value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
            </Form.Item>
        </>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card 
                title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleElec')}</span>} 
                size="small" 
                className="shadow-sm"
                styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}
            >
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('electricMeter')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <Select style={{ width: '100%' }} placeholder={t('notSpecified')} allowClear
                        value={inp.electric_meter_type}
                        onChange={(v) => update({ electric_meter_type: v })}
                        options={[
                            { value: '1P-15A', label: t('meter1p15a') },
                            { value: '1P-30A', label: t('meter1p30a') },
                            { value: '3P-30A', label: t('meter3p30a') },
                        ]} />
                </Form.Item>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('socketCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0}
                            value={inp.number_of_sockets} onChange={v => update({ number_of_sockets: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('lightCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0}
                            value={inp.number_of_lights} onChange={v => update({ number_of_lights: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('mainBreaker')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select style={{ width: '100%' }} placeholder={t('auto')} allowClear
                            value={inp.main_breaker_amp}
                            onChange={(v: number | undefined) => update({ main_breaker_amp: v ?? undefined })}
                            options={[
                                { value: 15, label: '15A' }, { value: 30, label: '30A' },
                                { value: 45, label: '45A' }, { value: 60, label: '60A' },
                                { value: 100, label: '100A' },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cableSize')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select style={{ width: '100%' }} placeholder={t('auto')} allowClear
                            value={inp.cable_size_sqmm}
                            onChange={(v: number | undefined) => update({ cable_size_sqmm: v ?? undefined })}
                            options={[
                                { value: 4, label: '4 มม².' }, { value: 10, label: '10 มม².' },
                                { value: 16, label: '16 มม².' }, { value: 25, label: '25 มม².' },
                                { value: 35, label: '35 มม².' }, { value: 70, label: '70 มม².' },
                            ]} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('groundRodCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber style={{ width: '100%' }} min={0} max={5} step={1}
                        value={inp.ground_rod_count} onChange={v => update({ ground_rod_count: v ?? undefined })} />
                </Form.Item>
            </Card>

            <Card 
                title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titlePlumbing')}</span>} 
                size="small" 
                className="shadow-sm"
                styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}
            >
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waterMeter')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <Select style={{ width: '100%' }} placeholder={t('notSpecified')} allowClear
                        value={inp.water_meter_type}
                        onChange={(v) => update({ water_meter_type: v })}
                        options={[
                            { value: '1/2', label: t('waterMeter12') },
                            { value: '3/4', label: t('waterMeter34') },
                        ]} />
                </Form.Item>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('pipeDia')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select style={{ width: '100%' }} placeholder="25" allowClear
                            value={inp.pipe_diameter_mm}
                            onChange={(v: number | undefined) => update({ pipe_diameter_mm: v ?? undefined })}
                            options={[
                                { value: 20, label: 'Ø20 mm' }, { value: 25, label: 'Ø25 mm' },
                                { value: 32, label: 'Ø32 mm' }, { value: 40, label: 'Ø40 mm' },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('pipeType')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select style={{ width: '100%' }} value={inp.pipe_type} onChange={v => update({ pipe_type: v })}
                            options={[
                                { value: 'pe', label: 'PE' },
                                { value: 'pvc', label: 'PVC' },
                            ]} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waterTank')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber style={{ width: '100%' }} min={0} step={500} 
                        value={inp.water_tank_liters} onChange={v => update({ water_tank_liters: v ?? undefined })} />
                </Form.Item>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('siteArea')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber style={{ width: '100%' }} min={0} 
                        value={inp.site_area_m2} onChange={v => update({ site_area_m2: v ?? undefined })} />
                </Form.Item>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('permit')}</Text>} style={{ margin: 0 }}>
                    <Switch checked={inp.permit_required} onChange={v => update({ permit_required: v })}
                        checkedChildren={t('permitYes')} unCheckedChildren={t('permitNo')} />
                </Form.Item>
            </Card>
        </div>
    );

    return (
        <StepFormShell
            stepId={2} title="เดินน้ำ–ไฟชั่วคราว" titleEn="Temporary Utilities"
            result={result} onBack={onBack}
            onSave={() => { if (result) onSave(inp, result); }}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
};
export default Step2Utilities;
