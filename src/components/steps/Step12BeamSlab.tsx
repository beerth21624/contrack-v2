'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { type Step12Input, type BeamEntry, calcStep12 } from '@/lib/steps/step12';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step12Input;  onBack: () => void; onSave: (inp: Step12Input, res: StepResult) => void; }

const createBeam = (index: number): BeamEntry => ({
    label: `B${index}`,
    count: 1,
    width_m: 0,
    depth_m: 0,
    avg_length_m: 0,
});

const DEFAULTS: Step12Input = {
    beams: [createBeam(1)],
    slab_area_m2: 0,
    slab_thickness_m: 0,
    rebar_kg_per_m3: 0,
    waste_percent: 0,
    waterproofing_required: false,
    slope_concrete_required: false,
    concrete_pump_required: false,
};

export default function Step12BeamSlab({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step12');
    const [inp, setInp] = useState<Step12Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step12Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const updateBeam = (index: number, patch: Partial<BeamEntry>) => {
        setInp(prev => {
            const beams = [...prev.beams];
            beams[index] = { ...beams[index], ...patch } as BeamEntry;
            return { ...prev, beams };
        });
    };

    const addBeam = () => {
        setInp(prev => ({
            ...prev,
            beams: [...prev.beams, createBeam(prev.beams.length + 1)]
        }));
    };

    const removeBeam = (index: number) => {
        setInp(prev => ({
            ...prev,
            beams: prev.beams.filter((_, i) => i !== index)
        }));
    };

    const result = useMemo(() => {
        try {
            return calcStep12(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 2 }}>{t('beamsPart')}</Text>

            {inp.beams.map((b, i) => {
                const vol = (b.width_m * b.depth_m * b.avg_length_m * b.count);
                return (
                    <Card key={i} size="small" style={{ marginBottom: 12, border: '1px solid #ffe4b5' }}
                        title={
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Text strong style={{ fontSize: 13 }}>{b.label}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('formula', { count: b.count, width: b.width_m, depth: b.depth_m, length: b.avg_length_m, vol: vol.toFixed(3) })}
                                </Text>
                            </Space>
                        }
                        extra={inp.beams.length > 1 && (
                            <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeBeam(i)} />
                        )}
                    >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('count')}</Text>}
                                tooltip={t('countTooltip')} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={1}
                                    value={b.count} onChange={v => updateBeam(i, { count: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('width')}</Text>}
                                tooltip={t('widthTooltip')} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={0.05} precision={2}
                                    value={b.width_m} onChange={v => updateBeam(i, { width_m: v ?? 0.20 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('depth')}</Text>} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={0.05} precision={2}
                                    value={b.depth_m} onChange={v => updateBeam(i, { depth_m: v ?? 0.40 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('length')}</Text>}
                                tooltip={t('lengthTooltip')} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={2}
                                    value={b.avg_length_m} onChange={v => updateBeam(i, { avg_length_m: v ?? 4 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('section')}</Text>} style={{ margin: 0 }}>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {(b.width_m * 100).toFixed(0)}×{(b.depth_m * 100).toFixed(0)} ซม.
                                </Text>
                            </Form.Item>
                        </div>
                    </Card>
                );
            })}

            <Button type="dashed" block icon={<PlusOutlined />} onClick={addBeam} style={{ marginBottom: 12 }}>
                {t('addBeam')}
            </Button>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('slabPart')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('slabArea')}</Text>}
                        tooltip={t('slabAreaTooltip')} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={5} precision={2}
                            value={inp.slab_area_m2} onChange={v => update({ slab_area_m2: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('slabThick')}</Text>}
                        tooltip={t('slabThickTooltip')} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={0.30} step={0.01} precision={2}
                            value={inp.slab_thickness_m} onChange={v => update({ slab_thickness_m: v ?? 0.12 })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('globalParams')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarDensity')}</Text>}
                        validateStatus={result?.warningFields?.includes('rebar_kg_per_m3') ? 'warning' : ''}
                        tooltip={t('rebarDensityTooltip')} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={300} step={10}
                            value={inp.rebar_kg_per_m3} onChange={v => update({ rebar_kg_per_m3: v ?? 130 })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={20} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('formworkShoring')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('formworkReuse')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={10} step={1} placeholder={t('formworkReusePh')}
                            value={inp.formwork_reuse_times} onChange={v => update({ formwork_reuse_times: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('spacer')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={8} step={1} placeholder={t('spacerPh')}
                            value={inp.spacer_per_m2} onChange={v => update({ spacer_per_m2: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('tieWire')}</Text>} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={3} step={0.5} placeholder={t('tieWirePh')}
                            value={inp.tie_wire_factor} onChange={v => update({ tie_wire_factor: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('floorHeight')}</Text>} tooltip={t('floorHeightTooltip')} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={6} step={0.5} placeholder={t('floorHeightPh')}
                            value={inp.floor_height_m} onChange={v => update({ floor_height_m: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>

            {inp.slab_area_m2 > 0 && (
                <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('waterproofSlope')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                    <div className="grid grid-cols-2 gap-2">
                        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('slopeConcrete')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                            <Switch checked={inp.slope_concrete_required !== false}
                                onChange={v => update({ slope_concrete_required: v })}
                                checkedChildren={t('slopeYes')} unCheckedChildren={t('slopeNo')} />
                        </Form.Item>
                        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('roofDrain')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                            <InputNumber style={{ width: '100%' }} min={0} step={1}
                                value={inp.roof_drain_count} onChange={v => update({ roof_drain_count: v ?? undefined })} />
                        </Form.Item>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waterproofSystem')}</Text>} style={{ margin: 0 }}>
                            <Switch checked={inp.waterproofing_required !== false}
                                onChange={v => update({ waterproofing_required: v })}
                                checkedChildren={t('waterproofYes')} unCheckedChildren={t('waterproofNo')} />
                        </Form.Item>
                        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waterproofType')}</Text>} style={{ margin: 0 }}>
                            <Select value={inp.waterproofing_type ?? 'pu'}
                                onChange={v => update({ waterproofing_type: v })}
                                options={[
                                    { value: 'pu', label: t('wpPu') },
                                    { value: 'acrylic', label: t('wpAcrylic') },
                                    { value: 'cementitious', label: t('wpCement') },
                                ]} disabled={inp.waterproofing_required === false} />
                        </Form.Item>
                    </div>
                </Card>
            )}

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
                        <Switch checked={inp.concrete_pump_required !== false}
                            onChange={v => update({ concrete_pump_required: v })}
                            checkedChildren={t('pumpYes')} unCheckedChildren={t('pumpNo')} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('vibratorDays')}</Text>} tooltip={t('vibratorDaysTooltip')} style={{ margin: 0 }}>
                    <InputNumber style={{ width: '100%' }} min={0} max={10} step={1}
                        value={inp.vibrator_days} onChange={v => update({ vibrator_days: v ?? undefined })} />
                </Form.Item>
            </Card>
            
        </div>
    );

    return (
        <StepFormShell stepId={12} title="คาน + พื้นดาดฟ้า" titleEn="Beam + Roof Deck"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
