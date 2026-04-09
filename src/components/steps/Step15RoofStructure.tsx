'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step15Input, type StepResult } from '@/types';
import { calcStep15 } from '@/lib/steps';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step15Input;  onBack: () => void; onSave: (inp: Step15Input, res: StepResult) => void; }

const DEFAULTS: Step15Input = {
    roof_area_m2: 0, roof_shape: 'gable', roof_pitch_deg: 0, roof_type: 'steel',
    waste_percent: 0, purlin_spacing_m: 0, rafter_spacing_m: 0,
    heavy_roof_tile: false, anti_rust_coats: 0, purlin_screw_required: false,
};

export default function Step15RoofStructure({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step15');
    const [inp, setInp] = useState<Step15Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step15Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep15(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('dimensionsGeometry')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item required layout="vertical"
                    label={<Text style={{ fontSize: 13 }}>{t('roofArea')}</Text>} 
                    tooltip={t('roofAreaTooltip')} 
                    style={{ margin: 0, marginBottom: 12 }}
                >
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} precision={2}
                        value={inp.roof_area_m2} onChange={v => update({ roof_area_m2: v ?? 0 })} />
                </Form.Item>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('roofShape')}</Text>} 
                        tooltip={t('roofShapeTooltip')}
                        style={{ margin: 0 }}
                    >
                        <Select value={inp.roof_shape} onChange={v => update({ roof_shape: v })} style={{ width: '100%' }}
                            options={[
                                { value: 'lean_to', label: t('shapeLeanTo') },
                                { value: 'gable', label: t('shapeGable') },
                                { value: 'hip', label: t('shapeHip') },
                                { value: 'flat', label: t('shapeFlat') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('roofPitch')}</Text>} 
                        tooltip={t('roofPitchTooltip')} 
                        style={{ margin: 0 }}
                    >
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={80} step={1}
                            value={inp.roof_pitch_deg} onChange={v => update({ roof_pitch_deg: v ?? 0 })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('primaryStructure')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('roofType')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.roof_type} onChange={v => update({ roof_type: v })} style={{ width: '100%' }}
                            options={[
                                { value: 'steel', label: t('typeSteel') },
                                { value: 'wood', label: t('typeWood') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('heavyTile')}</Text>} 
                        tooltip={t('heavyTileTooltip')} 
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <Switch checked={inp.heavy_roof_tile}
                            onChange={v => update({ heavy_roof_tile: v })}
                            checkedChildren={t('heavyTileYes')} unCheckedChildren={t('heavyTileNo')} />
                    </Form.Item>
                </div>
                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('purlinSpacing')}</Text>} tooltip={t('purlinSpacingTooltip')} style={{ margin: 0 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={2.00} step={0.05} precision={2}
                        value={inp.purlin_spacing_m} onChange={v => update({ purlin_spacing_m: v ?? 0 })} />
                </Form.Item>
            </Card>
        </div>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('fixingsRafter')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rafterSpacing')}</Text>} tooltip={t('rafterSpacingTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={2.00} step={0.10} precision={2}
                            value={inp.rafter_spacing_m}
                            onChange={v => update({ rafter_spacing_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('purlinScrew')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.purlin_screw_required !== false}
                            onChange={v => update({ purlin_screw_required: v })}
                            checkedChildren={t('purlinScrewYes')} unCheckedChildren={t('purlinScrewNo')} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('weldingRod')}</Text>} tooltip={t('weldingRodTooltip')} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={0.5} precision={1} placeholder={t('weldingRodPh')}
                            value={inp.welding_rod_factor}
                            onChange={v => update({ welding_rod_factor: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('antiRustCoats')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={3} step={1}
                            value={inp.anti_rust_coats}
                            onChange={v => update({ anti_rust_coats: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('trimsWaste')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('ridgeLength')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.ridge_length_m}
                            onChange={v => update({ ridge_length_m: v ?? undefined })} />
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
            stepId={15} title="โครงหลังคา" titleEn="Roof Structure"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
}
