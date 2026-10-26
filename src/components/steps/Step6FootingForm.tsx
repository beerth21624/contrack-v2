'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card, Button, Space, Collapse } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { StructuralSpecForm } from '../shared/StructuralSpecForm';
import { type Step6Input, type FootingEntry, calcStep6 } from '@/lib/steps/step06';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step6Input;  onBack: () => void; onSave: (inp: Step6Input, res: StepResult) => void; }

const createFooting = (index: number): FootingEntry => ({
    label: `F${index}`,
    count: 1,
    length_m: 0,
    width_m: 0,
    thickness_m: 0,
});

const DEFAULTS: Step6Input = {
    footings: [createFooting(1)],
    lean_concrete_thickness_m: 0,
    sand_bedding_thickness_m: 0,
    waste_percent: 0,
    excavation_depth_m: 0,
    rebar_weight_kg_per_m3: 0,
    dewatering_required: false,
    dewatering_days: 0,
    concrete_pump_required: false,
    curing_method: 'water',
};

export const Step6FootingForm: React.FC<Props> = ({ onBack, onSave, initialData }) => {
    const [inp, setInp] = useState<Step6Input>(initialData ?? DEFAULTS);
    const t = useTranslations('steps.step6');
    const update = useCallback((patch: Partial<Step6Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const totalN = useMemo(() => inp.footings.reduce((acc, f) => acc + f.count, 0), [inp.footings]);

    const updateFooting = (index: number, patch: Partial<FootingEntry>) => {
        setInp(prev => {
            const footings = [...prev.footings];
            footings[index] = { ...footings[index], ...patch } as FootingEntry;
            return { ...prev, footings };
        });
    };

    const addFooting = () => {
        setInp(prev => ({
            ...prev,
            footings: [...prev.footings, createFooting(prev.footings.length + 1)]
        }));
    };

    const removeFooting = (index: number) => {
        setInp(prev => ({
            ...prev,
            footings: prev.footings.filter((_, i) => i !== index)
        }));
    };

    const result = useMemo(() => {
        try {
            return calcStep6(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <>
            {inp.footings.map((f, i) => {
                const vol = (f.length_m * f.width_m * f.thickness_m * f.count);
                return (
                    <Card 
                        key={i} size="small" 
                        style={{ marginBottom: 12, border: '1px solid #ffe4b5' }}
                        title={
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Text strong style={{ fontSize: 13 }}>{f.label}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('footingFormula', { count: f.count, l: f.length_m, w: f.width_m, t: f.thickness_m, vol: vol.toFixed(3) })}
                                </Text>
                            </Space>
                        }
                        extra={
                            inp.footings.length > 1 && (
                                <Button type="text" danger size="small" icon={<DeleteOutlined />}
                                    onClick={() => removeFooting(i)} />
                            )
                        }
                    >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('name')}</Text>}
                                style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} 
                                    controls={false}
                                    value={undefined}
                                    placeholder={f.label}
                                    onChange={() => undefined}
                                    disabled />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('count')}</Text>}
                                tooltip={t('countTooltip')}
                                style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                                    value={f.count} onChange={v => updateFooting(i, { count: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('lengthL')}</Text>}
                                tooltip={t('lengthLTooltip')}
                                style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.05} precision={2}
                                    value={f.length_m} onChange={v => updateFooting(i, { length_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('widthW')}</Text>}
                                tooltip={t('widthWTooltip')}
                                style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.05} precision={2}
                                    value={f.width_m} onChange={v => updateFooting(i, { width_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('thickT')}</Text>}
                                tooltip={t('thickTTooltip')}
                                style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.05} precision={2}
                                    value={f.thickness_m} onChange={v => updateFooting(i, { thickness_m: v ?? 0.30 })} />
                            </Form.Item>
                        </div>
                    </Card>
                );
            })}

            <Button type="dashed" block icon={<PlusOutlined />} onClick={addFooting}
                style={{ marginBottom: 12 }}>
                {t('addFooting')}
            </Button>

            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                {t('totalLabel', { total: totalN, types: inp.footings.length })}
            </Text>

            <Collapse size="small" defaultActiveKey={[]} items={[{
                key: 'advanced', label: <span className="text-gray-500 font-medium">⚙️ ตั้งค่าขั้นสูง (สเปคคอนกรีต / เผื่อสูญเสีย)</span>, children: (
                    <div className="flex flex-col gap-4">
                        <StructuralSpecForm 
                            spec={inp.structural_spec ?? { ksc: 240, waterproof: false, workLevel: 'GRND' }}
                            onChange={patch => update({ structural_spec: { ...inp.structural_spec, ...patch } as any })}
                            fixedWorkLevel="GRND"
                            hideWaterproof={false}
                        />

                        <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('globalParams')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('leanThick')}</Text>}
                                    tooltip={t('leanThickTooltip')} style={{ margin: 0 }}>
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.01} precision={2}
                                        value={inp.lean_concrete_thickness_m} onChange={v => update({ lean_concrete_thickness_m: v ?? 0.05 })} />
                                </Form.Item>
                                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('sandThick')}</Text>}
                                    tooltip={t('sandThickTooltip')} style={{ margin: 0 }}>
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.01} precision={2}
                                        value={inp.sand_bedding_thickness_m} onChange={v => update({ sand_bedding_thickness_m: v ?? 0.05 })} />
                                </Form.Item>
                                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wasteConc')}</Text>} style={{ margin: 0 }}>
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                                        value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
                                </Form.Item>
                            </div>
                        </Card>
                    </div>
                )
            }]} />
        </>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleExcavation')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('excDepth')}</Text>}
                        tooltip={t('excDepthTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.05}
                            value={inp.excavation_depth_m}
                            onChange={v => update({ excavation_depth_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('excWiden')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={1} step={0.05} placeholder={t('excWidenPh')}
                            value={inp.excavation_extra_margin_m}
                            onChange={v => update({ excavation_extra_margin_m: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleRebar')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarWeight')}</Text>}
                        validateStatus={result?.warningFields?.includes('rebar_weight_kg_per_m3') ? 'warning' : ''}
                        tooltip={t('rebarWeightTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={200} step={5} placeholder={t('rebarWeightPh')}
                            value={inp.rebar_weight_kg_per_m3}
                            onChange={v => update({ rebar_weight_kg_per_m3: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('tieWire')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={3} step={0.5} placeholder={t('tieWirePh')}
                            value={inp.tie_wire_factor}
                            onChange={v => update({ tie_wire_factor: v ?? undefined })} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('spacer')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={12} step={1} placeholder={t('spacerPh')}
                        value={inp.spacer_per_footing}
                        onChange={v => update({ spacer_per_footing: v ?? undefined })} />
                </Form.Item>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleOps')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cureMethod')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.curing_method ?? 'water'}
                            onChange={v => update({ curing_method: v })}
                            options={[
                                { value: 'water', label: t('cureWater') },
                                { value: 'plastic', label: t('curePlastic') },
                                { value: 'compound', label: t('cureCompound') },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('pump')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.concrete_pump_required}
                            onChange={v => update({ concrete_pump_required: v })}
                            checkedChildren={t('pumpYes')} unCheckedChildren={t('pumpNo')} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('dewater')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.dewatering_required}
                            onChange={v => update({ dewatering_required: v })}
                            checkedChildren={t('dewaterYes')} unCheckedChildren={t('dewaterNo')} />
                    </Form.Item>
                    {inp.dewatering_required && (
                        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('dewaterDays')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                            <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={30} step={1}
                                value={inp.dewatering_days}
                                onChange={v => update({ dewatering_days: v ?? undefined })} />
                        </Form.Item>
                    )}
                </div>
            </Card>

            
        </div>
    );

    return (
        <StepFormShell
            stepId={6} title="ทำฐานราก" titleEn="Footing / Foundation"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
};
export default Step6FootingForm;
