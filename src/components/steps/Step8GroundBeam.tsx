'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step8Input, type StepResult } from '@/types';
import { calcStep8 } from '@/lib/steps';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step8Input;  onBack: () => void; onSave: (inp: Step8Input, res: StepResult) => void; }

const DEFAULTS: Step8Input = {
    total_beam_length_m: 0, beam_width_m: 0, beam_height_m: 0,
    lean_concrete_thickness_m: 0, waste_percent: 0,
    rebar_weight_kg_per_m3: 0, concrete_pump_required: false,
    excavation_extra_margin_m: 0, termite_protection_required: false,
};

export const Step8GroundBeam: React.FC<Props> = ({ onBack, onSave, initialData }) => {
    const [inp, setInp] = useState<Step8Input>(initialData ?? DEFAULTS);
    const t = useTranslations('steps.step8');
    const update = useCallback((patch: Partial<Step8Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep8(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('specTitle')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item required layout="vertical" 
                    label={<Text style={{ fontSize: 13 }}>{t('totalLen')}</Text>} 
                    tooltip={t('totalLenTooltip')} 
                    style={{ margin: 0, marginBottom: 12 }}
                >
                    <InputNumber style={{ width: '100%' }} min={0} step={1}
                        value={inp.total_beam_length_m} onChange={v => update({ total_beam_length_m: v ?? 0 })} />
                </Form.Item>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('widthB')}</Text>} 
                        tooltip={t('widthBTooltip')}
                        style={{ margin: 0 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} step={0.05} precision={2}
                            value={inp.beam_width_m} onChange={v => update({ beam_width_m: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('heightH')}</Text>} 
                        tooltip={t('heightHTooltip')}
                        style={{ margin: 0 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} step={0.05} precision={2}
                            value={inp.beam_height_m} onChange={v => update({ beam_height_m: v ?? 0 })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('globalParams')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('leanThick')}</Text>} 
                        tooltip={t('leanThickTooltip')} 
                        style={{ margin: 0 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} step={0.01} precision={2}
                            value={inp.lean_concrete_thickness_m} onChange={v => update({ lean_concrete_thickness_m: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wasteConc')}</Text>} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={20} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleExcavation')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('sandThick')}</Text>} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={0.15} step={0.01} precision={2} placeholder={t('sandThickPh')}
                            value={inp.sand_bedding_thickness_m} onChange={v => update({ sand_bedding_thickness_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('excWiden')}</Text>} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={0.50} step={0.05} placeholder={t('excWidenPh')}
                            value={inp.excavation_extra_margin_m} onChange={v => update({ excavation_extra_margin_m: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleRebarAndForm')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('beamCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.beam_count} onChange={v => update({ beam_count: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarWeight')}</Text>}
                        validateStatus={result?.warningFields?.includes('rebar_weight_kg_per_m3') ? 'warning' : ''}
                        tooltip={t('rebarWeightTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={300} step={5}
                            value={inp.rebar_weight_kg_per_m3} onChange={v => update({ rebar_weight_kg_per_m3: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('dowelCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.dowel_count} onChange={v => update({ dowel_count: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('dowelLen')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={0.05} precision={2}
                            value={inp.dowel_length_m} onChange={v => update({ dowel_length_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('formReuse')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={10} step={1} placeholder={t('formReusePh')}
                            value={inp.formwork_reuse_times} onChange={v => update({ formwork_reuse_times: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('spacerPerM')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={5} step={1} placeholder={t('spacerPerMPh')}
                            value={inp.spacer_per_m} onChange={v => update({ spacer_per_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('tieWire')}</Text>} style={{ margin: 0 }}>
                    <InputNumber style={{ width: '100%' }} min={0} max={3} step={0.5} placeholder={t('tieWirePh')}
                        value={inp.tie_wire_factor} onChange={v => update({ tie_wire_factor: v ?? undefined })} />
                </Form.Item>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleOps')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cureMethod')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.curing_method ?? 'water'} onChange={v => update({ curing_method: v })}
                            options={[
                                { value: 'water', label: t('cureWater') },
                                { value: 'plastic', label: t('curePlastic') },
                                { value: 'compound', label: t('cureCompound') },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('pump')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.concrete_pump_required} onChange={v => update({ concrete_pump_required: v })}
                            checkedChildren={t('pumpYes')} unCheckedChildren={t('pumpNo')} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('vibratorDays')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={10} step={1}
                            value={inp.vibrator_days} onChange={v => update({ vibrator_days: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('shoring')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.shoring_required} onChange={v => update({ shoring_required: v })}
                            checkedChildren={t('shoringYes')} unCheckedChildren={t('shoringNo')} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('termite')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.termite_protection_required} onChange={v => update({ termite_protection_required: v })}
                            checkedChildren={t('termiteYes')} unCheckedChildren={t('termiteNo')} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    return (
        <StepFormShell
            stepId={8} title="คานคอดิน" titleEn="Ground Beam"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
};
export default Step8GroundBeam;
