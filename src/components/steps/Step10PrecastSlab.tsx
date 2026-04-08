'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step10Input, type StepResult } from '@/types';
import { calcStep10 } from '@/lib/steps';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step10Input;  onBack: () => void; onSave: (inp: Step10Input, res: StepResult) => void; }

const DEFAULTS: Step10Input = {
    precast_area_m2: 0, topping_thickness_m: 0, waste_percent: 0,
    shear_key_required: false, span_m: 0, concrete_pump_required: false,
    curing_method: 'plastic'
};

export const Step10PrecastSlab: React.FC<Props> = ({ onBack, onSave, initialData }) => {
    const [inp, setInp] = useState<Step10Input>(initialData ?? DEFAULTS);
    const t = useTranslations('steps.step10');
    const update = useCallback((patch: Partial<Step10Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep10(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('specTitle')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item required layout="vertical" 
                    label={<Text style={{ fontSize: 13 }}>{t('area')}</Text>} 
                    tooltip={t('areaTooltip')}
                    style={{ margin: 0, marginBottom: 12 }}
                >
                    <InputNumber style={{ width: '100%' }} min={0} step={1}
                        value={inp.precast_area_m2} onChange={v => update({ precast_area_m2: v ?? 0 })} />
                </Form.Item>
                <Form.Item required layout="vertical" 
                    label={<Text style={{ fontSize: 13 }}>{t('toppingThick')}</Text>} 
                    tooltip={t('toppingThickTooltip')} 
                    style={{ margin: 0 }}
                >
                    <InputNumber style={{ width: '100%' }} min={0} step={0.01} precision={2}
                        value={inp.topping_thickness_m} onChange={v => update({ topping_thickness_m: v ?? 0 })} />
                </Form.Item>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('globalParams')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wasteConc')}</Text>} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={20} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('shearKey')}</Text>} 
                        tooltip={t('shearKeyTooltip')}
                        style={{ margin: 0 }}
                    >
                        <Switch checked={inp.shear_key_required} onChange={v => update({ shear_key_required: v })}
                            checkedChildren={t('reqYes')} unCheckedChildren={t('reqNo')} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titlePrecastShoring')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('precastType')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.precast_type ?? 'Hollow-core'}
                            onChange={v => update({ precast_type: v })}
                            options={[
                                { value: 'Hollow-core', label: t('typeHollow') },
                                { value: 'Plank', label: t('typePlank') },
                                { value: 'Other', label: t('typeOther') },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('span')}</Text>} tooltip={t('spanTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={12} step={0.5} placeholder={t('spanPh')}
                            value={inp.span_m} onChange={v => update({ span_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('panelWidth')}</Text>} tooltip={t('panelWidthTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={1.50} step={0.05} precision={2}
                            value={inp.panel_width_m} onChange={v => update({ panel_width_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('panelThick')}</Text>} tooltip={t('panelThickTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={0.30} step={0.01} precision={2}
                            value={inp.panel_thickness_m} onChange={v => update({ panel_thickness_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('panelCount')}</Text>} tooltip={t('panelCountTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.precast_panel_count} onChange={v => update({ precast_panel_count: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('shoringLen')}</Text>} tooltip={t('shoringLenTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.shoring_line_length_m} onChange={v => update({ shoring_line_length_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('grout')}</Text>} style={{ margin: 0 }}>
                    <Switch checked={inp.grout_between_panels !== false}
                        onChange={v => update({ grout_between_panels: v })}
                        checkedChildren={t('groutYes')} unCheckedChildren={t('groutNo')} />
                </Form.Item>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleRebarSpecialsDeli')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wiremeshWeight')}</Text>} tooltip={t('wiremeshWeightTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={10} step={0.5}
                            value={inp.wiremesh_kg_per_m2} onChange={v => update({ wiremesh_kg_per_m2: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('termitePipe')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.termite_pipe_length_m} onChange={v => update({ termite_pipe_length_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('craneDays')}</Text>} tooltip={t('craneDaysTooltip')} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.crane_days} onChange={v => update({ crane_days: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('deliveryTrips')}</Text>} tooltip={t('deliveryTripsTooltip')} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.delivery_trips} onChange={v => update({ delivery_trips: v ?? undefined })} />
                    </Form.Item>
                </div>
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
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('screedDays')}</Text>} tooltip={t('screedDaysTooltip')} style={{ margin: 0 }}>
                    <InputNumber style={{ width: '100%' }} min={0} max={20} step={1}
                        value={inp.vibrator_days} onChange={v => update({ vibrator_days: v ?? undefined })} />
                </Form.Item>
            </Card>
        </div>
    );

    return (
        <StepFormShell
            stepId={10} title="วางแผ่นพื้นสำเร็จ" titleEn="Precast Slab"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
};
export default Step10PrecastSlab;
