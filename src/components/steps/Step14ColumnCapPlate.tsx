'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step14Input, type StepResult } from '@/types';
import { calcStep14 } from '@/lib/steps';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step14Input;  onBack: () => void; onSave: (inp: Step14Input, res: StepResult) => void; }

const DEFAULTS: Step14Input = {
    plate_count: 0, plate_width_mm: 0, plate_depth_mm: 0, plate_thickness_mm: 0,
    anchor_bolt_per_plate: 0, bolt_type: 'j-bolt', bolt_diameter_mm: 0, grout_thickness_mm: 0,
    welding_required: false, anti_rust_paint_required: false, bolt_template_required: false,
    waste_percent: 0,
};

export default function Step14ColumnCapPlate({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step14');
    const [inp, setInp] = useState<Step14Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step14Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep14(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('plateSpecs')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item required layout="vertical" 
                    label={<Text style={{ fontSize: 13 }}>{t('plateCount')}</Text>} 
                    tooltip={t('plateCountTooltip')}
                    style={{ margin: 0, marginBottom: 12 }}
                >
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                        value={inp.plate_count} onChange={v => update({ plate_count: v ?? 0 })} />
                </Form.Item>
                <div className="grid grid-cols-3 gap-2">
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('widthMm')}</Text>} 
                        tooltip={t('widthMmTooltip')}
                        style={{ margin: 0 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.plate_width_mm} onChange={v => update({ plate_width_mm: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('depthMm')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.plate_depth_mm} onChange={v => update({ plate_depth_mm: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('thicknessMm')}</Text>} 
                        tooltip={t('thicknessMmTooltip')} 
                        style={{ margin: 0 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={40} step={2}
                            value={inp.plate_thickness_mm} onChange={v => update({ plate_thickness_mm: v ?? 0 })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('anchorage')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('boltCount')}</Text>} 
                        tooltip={t('boltCountTooltip')}
                        style={{ margin: 0 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={16} step={1}
                            value={inp.anchor_bolt_per_plate} onChange={v => update({ anchor_bolt_per_plate: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" 
                        label={<Text style={{ fontSize: 13 }}>{t('boltDiameter')}</Text>} 
                        tooltip={t('boltDiameterTooltip')} 
                        style={{ margin: 0 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={32} step={2}
                            value={inp.bolt_diameter_mm} onChange={v => update({ bolt_diameter_mm: v ?? 0 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('installExtras')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('boltType')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.bolt_type ?? 'j-bolt'}
                            onChange={v => update({ bolt_type: v })}
                            options={[
                                { value: 'j-bolt', label: t('boltJ') },
                                { value: 'l-bolt', label: t('boltL') },
                                { value: 'chemical', label: t('boltChemical') },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('boltLength')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={1} step={0.1} placeholder={t('boltLengthPh')}
                            value={inp.bolt_length_m} onChange={v => update({ bolt_length_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('boltTemplate')}</Text>} tooltip={t('boltTemplateTooltip')} style={{ margin: 0 }}>
                        <Switch checked={inp.bolt_template_required !== false}
                            onChange={v => update({ bolt_template_required: v })}
                            checkedChildren={t('templateYes')} unCheckedChildren={t('templateNo')} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('groutThick')}</Text>} tooltip={t('groutThickTooltip')} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={100} step={5}
                            value={inp.grout_thickness_mm} onChange={v => update({ grout_thickness_mm: v ?? 30 })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('weldingFinishes')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('weldingReq')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.welding_required}
                            onChange={v => update({ welding_required: v })}
                            checkedChildren={t('weldingYes')} unCheckedChildren={t('weldingNo')} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('weldingLength')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={5} step={0.1} placeholder={t('weldingLengthPh')}
                            disabled={!inp.welding_required}
                            value={inp.welding_length_m_per_plate} onChange={v => update({ welding_length_m_per_plate: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('antiRust')}</Text>} style={{ margin: 0 }}>
                        <Switch checked={inp.anti_rust_paint_required !== false}
                            onChange={v => update({ anti_rust_paint_required: v })}
                            checkedChildren={t('antiRustYes')} unCheckedChildren={t('antiRustNo')} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    return (
        <StepFormShell
            stepId={14} title="ทำเพลทหัวเสา" titleEn="Column Cap Plate"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
}
