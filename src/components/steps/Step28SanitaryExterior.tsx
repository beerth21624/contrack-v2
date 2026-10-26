'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Switch, Typography, Space, Tag, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step28Input, calcStep28 } from '@/lib/steps/step28';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step28Input;  onBack: () => void; onSave: (inp: Step28Input, res: StepResult) => void; }

const DEFAULTS: Step28Input = {
    building_perimeter_m: 0, meter_to_building_m: 0, resident_count: 0,
    waste_percent: 0, rainwater_drain_m: 0,
};

export default function Step28SanitaryExterior({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step28');
    const [inp, setInp] = useState<Step28Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step28Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const septicEst = inp.septic_size_override_m3 ?? Math.max(1.0, Math.round(inp.resident_count * 0.5 * 100) / 100); // same as step28.ts septicSize()

    const result = useMemo(() => {
        try {
            return calcStep28(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card1Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Space style={{ marginBottom: 12 }} wrap>
                    <Tag color="blue">{t('perimeterTag', { val: inp.building_perimeter_m })}</Tag>
                    <Tag color="green">{t('residentTag', { val: inp.resident_count })}</Tag>
                    <Tag color="orange">{t('septicEstTag', { val: septicEst })}</Tag>
                </Space>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('buildingPerimeter')}</Text>}
                        tooltip={t('perimeterTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5}
                            value={inp.building_perimeter_m} onChange={v => update({ building_perimeter_m: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('meterDistance')}</Text>}
                        tooltip={t('meterDistanceTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.meter_to_building_m} onChange={v => update({ meter_to_building_m: v ?? 0 })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card2Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('residentCount')}</Text>}
                        tooltip={t('residentTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.resident_count} onChange={v => update({ resident_count: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('greaseTrap')}</Text>}
                        tooltip={t('greaseTrapTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} placeholder="auto"
                            value={inp.grease_trap_count} onChange={v => update({ grease_trap_count: v ?? undefined })} />
                    </Form.Item>
                </div>
                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wastePipe')}</Text>} style={{ margin: 0 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={25} step={1}
                        value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 0 })} />
                </Form.Item>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optCardMain')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rainwaterGutter')}</Text>}
                        tooltip={t('rainwaterTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5}
                            value={inp.rainwater_drain_m} onChange={v => update({ rainwater_drain_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('pumpTank')}</Text>}
                        tooltip={t('pumpTankTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.has_pump_tank ?? false} onChange={v => update({ has_pump_tank: v })}
                            checkedChildren={t('installed')} unCheckedChildren={t('notInstalled')} />
                    </Form.Item>
                </div>
                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('septicOverride')}</Text>}
                    tooltip={t('septicOverrideTooltip')} style={{ margin: 0 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.5} placeholder="auto"
                        value={inp.septic_size_override_m3} onChange={v => update({ septic_size_override_m3: v ?? undefined })} />
                </Form.Item>
            </Card>

            
        </div>
    );

    return (
        <StepFormShell stepId={28} title="สุขาภิบาลภายนอก" titleEn="Sanitary — Exterior"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
