'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card, Collapse } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { StructuralSpecForm } from '../shared/StructuralSpecForm';
import { type Step9Input, type StepResult } from '@/types';
import { calcStep9 } from '@/lib/steps';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step9Input;  onBack: () => void; onSave: (inp: Step9Input, res: StepResult) => void; }

const DEFAULTS: Step9Input = {
    slab_area_m2: 0, slab_thickness_m: 0, sand_fill_thickness_m: 0,
    plastic_sheet_area_factor: 1, waste_percent: 10,
    control_joint_spacing_m: 0, concrete_pump_required: false,
    curing_method: 'plastic'
};

export const Step9SlabOnGrade: React.FC<Props> = ({ onBack, onSave, initialData }) => {
    const [inp, setInp] = useState<Step9Input>(initialData ?? DEFAULTS);
    const t = useTranslations('steps.step9');
    const update = useCallback((patch: Partial<Step9Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep9(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('specTitle')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('area')}</Text>} 
                        tooltip={t('areaTooltip')}
                        style={{ margin: 0 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.slab_area_m2} onChange={v => update({ slab_area_m2: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('thickness')}</Text>} 
                        tooltip={t('thicknessTooltip')} 
                        style={{ margin: 0 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.01} precision={2}
                            value={inp.slab_thickness_m} onChange={v => update({ slab_thickness_m: v ?? 0 })} />
                    </Form.Item>
                </div>
            </Card>

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
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                <Form.Item required layout="vertical" 
                                    label={<Text style={{ fontSize: 13 }}>{t('sandThick')}</Text>} 
                                    tooltip={t('sandThickTooltip')} 
                                    style={{ margin: 0 }}
                                >
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.01} precision={3}
                                        value={inp.sand_fill_thickness_m} onChange={v => update({ sand_fill_thickness_m: v ?? 0 })} />
                                </Form.Item>
                                <Form.Item required layout="vertical" 
                                    label={<Text style={{ fontSize: 13 }}>{t('plasticFactor')}</Text>} 
                                    tooltip={t('plasticFactorTooltip')} 
                                    style={{ margin: 0 }}
                                >
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={1.5} step={0.01} precision={2}
                                        value={inp.plastic_sheet_area_factor} onChange={v => update({ plastic_sheet_area_factor: v ?? 1.10 })} />
                                </Form.Item>
                                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wasteConc')}</Text>} style={{ margin: 0 }}>
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                                        value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
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
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleRebarAndForm')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarType')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.rebar_type ?? 'wiremesh'}
                            onChange={v => update({ rebar_type: v })}
                            options={[
                                { value: 'wiremesh', label: t('typeWiremesh') },
                                { value: 'rebar', label: t('typeRebar') },
                            ]} />
                    </Form.Item>
                    {(inp.rebar_type ?? 'wiremesh') === 'wiremesh' ? (
                        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wiremeshWeight')}</Text>} tooltip={t('wiremeshWeightTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                            <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={0.5}
                                value={inp.wiremesh_kg_per_m2}
                                onChange={v => update({ wiremesh_kg_per_m2: v ?? undefined })} />
                        </Form.Item>
                    ) : (
                        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarWeight')}</Text>} tooltip={t('rebarWeightTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                            <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={250} step={5}
                                value={inp.rebar_weight_kg_per_m3}
                                onChange={v => update({ rebar_weight_kg_per_m3: v ?? undefined })} />
                        </Form.Item>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('perimeter')}</Text>} tooltip={t('perimeterTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.slab_perimeter_m}
                            onChange={v => update({ slab_perimeter_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('edgeFormworkLen')}</Text>} tooltip={t('edgeFormworkLenTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.edge_formwork_length_m}
                            onChange={v => update({ edge_formwork_length_m: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleJointsSpecials')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('controlJointSpace')}</Text>} tooltip={t('controlJointSpaceTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={6} step={0.5} placeholder={t('jointPh')}
                            value={inp.control_joint_spacing_m}
                            onChange={v => update({ control_joint_spacing_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('expJointLen')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            placeholder={t('expJointLenPh')}
                            value={inp.expansion_joint_length_m}
                            onChange={v => update({ expansion_joint_length_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('sleeveCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.sleeve_count}
                            onChange={v => update({ sleeve_count: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('slopePct')}</Text>} tooltip={t('slopePctTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={0.1}
                            value={inp.slope_percent}
                            onChange={v => update({ slope_percent: v ?? undefined })} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('hardener')}</Text>} tooltip={t('hardenerTooltip')} style={{ margin: 0 }}>
                    <Switch checked={inp.hardener_required}
                        onChange={v => update({ hardener_required: v })}
                        checkedChildren={t('hardenerYes')} unCheckedChildren={t('hardenerNo')} />
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
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('screedDays')}</Text>} tooltip={t('screedDaysTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                        value={inp.vibrator_days}
                        onChange={v => update({ vibrator_days: v ?? undefined })} />
                </Form.Item>
            </Card>
        </div>
    );

    return (
        <StepFormShell
            stepId={9} title="เทพื้นหล่อในที่" titleEn="Slab on Grade"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
};
export default Step9SlabOnGrade;
