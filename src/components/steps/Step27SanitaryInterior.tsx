'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Space, Tag, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step27Input, calcStep27 } from '@/lib/steps/step27';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step27Input;  onBack: () => void; onSave: (inp: Step27Input, res: StepResult) => void; }

const DEFAULTS: Step27Input = {
    bathroom_count: 0, kitchen_count: 0, laundry_point: false,
    has_hot_water: false, hot_water_type: 'electric',
    waste_percent: 0,
};

export default function Step27SanitaryInterior({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step27');
    const [inp, setInp] = useState<Step27Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step27Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep27(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card1Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Space style={{ marginBottom: 12 }} wrap>
                    <Tag color="blue">{t('bathroomTag', { count: inp.bathroom_count })}</Tag>
                    <Tag color="green">{t('kitchenTag', { count: inp.kitchen_count })}</Tag>
                    {inp.laundry_point && <Tag color="purple">{t('laundryTag')}</Tag>}
                </Space>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('bathroomCount')}</Text>}
                        tooltip={t('bathroomCountTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.bathroom_count} onChange={v => update({ bathroom_count: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('kitchenCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.kitchen_count} onChange={v => update({ kitchen_count: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('laundryPoint')}</Text>} style={{ margin: 0 }}>
                        <Switch checked={inp.laundry_point} onChange={v => update({ laundry_point: v })}
                            checkedChildren={t('yes')} unCheckedChildren={t('no')} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card2Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('hasHotWater')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.has_hot_water} onChange={v => update({ has_hot_water: v })}
                            checkedChildren={t('yes')} unCheckedChildren={t('no')} />
                    </Form.Item>
                    {inp.has_hot_water && (
                        <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('hotWaterType')}</Text>}
                            tooltip={t('hotWaterTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                            <Select value={inp.hot_water_type} onChange={v => update({ hot_water_type: v })}
                                options={[
                                    { value: 'electric', label: t('hwElectric') },
                                    { value: 'solar', label: t('hwSolar') },
                                    { value: 'heat_pump', label: t('hwHeatPump') },
                                ]} />
                        </Form.Item>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cleanout')}</Text>}
                        tooltip={t('cleanoutTooltip')} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.cleanout_count} onChange={v => update({ cleanout_count: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wastePipe')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={25} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optCardMain')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('supplyOverride')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} placeholder="auto"
                            value={inp.supply_pipe_override_m} onChange={v => update({ supply_pipe_override_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('drainOverride')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} placeholder="auto"
                            value={inp.drain_pipe_override_m} onChange={v => update({ drain_pipe_override_m: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    return (
        <StepFormShell stepId={27} title="สุขาภิบาลภายใน" titleEn="Sanitary — Interior"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
