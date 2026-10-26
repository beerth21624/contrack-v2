'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card, Collapse } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step13Input, type StepResult } from '@/types';
import { calcStep13 } from '@/lib/steps';
import { StructuralSpecForm } from '../shared/StructuralSpecForm';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step13Input;  onBack: () => void; onSave: (inp: Step13Input, res: StepResult) => void; }

const DEFAULTS: Step13Input = {
    stair_flight_count: 0, stair_width_m: 0,
    stair_rise_m: 0, stair_going_m: 0,
    steps_per_flight: 0, landing_area_m2: 0,
    rebar_kg_per_m3: 0, waste_percent: 0,
    nosing_required: false,
};

export default function Step13Staircase({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step13');
    const [inp, setInp] = useState<Step13Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step13Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep13(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('flightSpecs')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('flightCount')}</Text>} 
                        tooltip={t('flightCountTooltip')} 
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.stair_flight_count} onChange={v => update({ stair_flight_count: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('stepsPerFlight')}</Text>} 
                        tooltip={t('stepsPerFlightTooltip')} 
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.steps_per_flight} onChange={v => update({ steps_per_flight: v ?? 0 })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('stairRise')}</Text>} 
                        tooltip={t('stairRiseTooltip')} 
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={0.25} step={0.005} precision={3}
                            value={inp.stair_rise_m} onChange={v => update({ stair_rise_m: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('stairGoing')}</Text>} 
                        tooltip={t('stairGoingTooltip')} 
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={0.40} step={0.01} precision={3}
                            value={inp.stair_going_m} onChange={v => update({ stair_going_m: v ?? 0 })} />
                    </Form.Item>
                </div>
                <Form.Item required layout="vertical" 
                    label={<Text style={{ fontSize: 13 }}>{t('stairWidth')}</Text>} 
                    tooltip={t('stairWidthTooltip')}
                    style={{ margin: 0 }}
                >
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.05} precision={2}
                        value={inp.stair_width_m} onChange={v => update({ stair_width_m: v ?? 0 })} />
                </Form.Item>
            </Card>

            <Collapse size="small" defaultActiveKey={[]} items={[{
                key: 'advanced', label: <span className="text-gray-500 font-medium">⚙️ ตั้งค่าขั้นสูง (สเปคคอนกรีต / ชานพัก)</span>, children: (
                    <div className="flex flex-col gap-4">
                        <StructuralSpecForm 
                            spec={inp.structural_spec ?? { ksc: 240, waterproof: false, workLevel: '1FL' }}
                            onChange={patch => update({ structural_spec: { ...inp.structural_spec, ...patch } as any })}
                            fixedWorkLevel="1FL"
                        />

                        <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('landingMaterial')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                            <Form.Item required layout="vertical" 
                                label={<Text style={{ fontSize: 13 }}>{t('landingArea')}</Text>} 
                                tooltip={t('landingAreaTooltip')} 
                                style={{ margin: 0, marginBottom: 12 }}
                            >
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.5} precision={2}
                                    value={inp.landing_area_m2} onChange={v => update({ landing_area_m2: v ?? 0 })} />
                            </Form.Item>
                            <div className="grid grid-cols-2 gap-2">
                                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarDensity')}</Text>} style={{ margin: 0 }}>
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={250} step={10}
                                        value={inp.rebar_kg_per_m3} onChange={v => update({ rebar_kg_per_m3: v ?? 120 })} />
                                </Form.Item>
                                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                                        value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
                                </Form.Item>
                            </div>
                        </Card>
                    </div>
                )
            }]} />
        </div>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('structureFormwork')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waistThick')}</Text>} tooltip={t('waistThickTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={0.30} step={0.01} precision={2} placeholder={t('waistPh')}
                            value={inp.waist_slab_thickness_m}
                            onChange={v => update({ waist_slab_thickness_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('landingThick')}</Text>} tooltip={t('landingThickTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={0.30} step={0.01} precision={2} placeholder={t('landingPh')}
                            value={inp.landing_thickness_m}
                            onChange={v => update({ landing_thickness_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('floorHeight')}</Text>} tooltip={t('floorHeightTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={0.5} placeholder={t('floorHeightPh')}
                            value={inp.floor_height_m}
                            onChange={v => update({ floor_height_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('spacer')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={8} step={1} placeholder={t('spacerPh')}
                            value={inp.spacer_per_m2}
                            onChange={v => update({ spacer_per_m2: v ?? undefined })} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('tieWire')}</Text>} style={{ margin: 0 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={5} step={0.5} placeholder={t('tieWirePh')}
                        value={inp.tie_wire_factor}
                        onChange={v => update({ tie_wire_factor: v ?? undefined })} />
                </Form.Item>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('safetyNosing')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('nosingRequired')}</Text>} style={{ margin: 0 }}>
                        <Switch checked={inp.nosing_required !== false}
                            onChange={v => update({ nosing_required: v })}
                            checkedChildren={t('nosingYes')} unCheckedChildren={t('nosingNo')} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('nosingType')}</Text>} style={{ margin: 0 }}>
                        <Select value={inp.nosing_material ?? 'pvc'}
                            onChange={v => update({ nosing_material: v })}
                            options={[
                                { value: 'pvc', label: t('nosingPvc') },
                                { value: 'aluminum', label: t('nosingAlu') },
                                { value: 'brass', label: t('nosingBrass') },
                            ]} disabled={inp.nosing_required === false} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('operations')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('curingMethod')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.curing_method ?? 'water'}
                            onChange={v => update({ curing_method: v })}
                            options={[
                                { value: 'water', label: t('curingWater') },
                                { value: 'plastic', label: t('curingPlastic') },
                                { value: 'compound', label: t('curingCompound') },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('concretePump')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.concrete_pump_required}
                            onChange={v => update({ concrete_pump_required: v })}
                            checkedChildren={t('pumpYes')} unCheckedChildren={t('pumpNo')} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('vibratorDays')}</Text>} tooltip={t('vibratorDaysTooltip')} style={{ margin: 0 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={1} placeholder="1"
                        value={inp.vibrator_days} onChange={v => update({ vibrator_days: v ?? undefined })} />
                </Form.Item>
            </Card>
        </div>
    );

    return (
        <StepFormShell
            stepId={13} title="โครงสร้างบันได" titleEn="Staircase"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
}
