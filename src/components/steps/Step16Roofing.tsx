'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step16Input, type StepResult } from '@/types';
import { calcStep16 } from '@/lib/steps';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step16Input;  onBack: () => void; onSave: (inp: Step16Input, res: StepResult) => void; }

const DEFAULTS: Step16Input = {
    roof_area_m2: 0, roofing_type: 'cpac', waste_percent: 0,
    ridge_length_m: 0, hip_length_m: 0, eave_length_m: 0, valley_length_m: 0,
    insulation_required: false, bird_block_required: false,
};

export default function Step16Roofing({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step16');
    const [inp, setInp] = useState<Step16Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step16Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep16(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('mainSpecs')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
            <Form.Item required layout="vertical"
                label={<Text style={{ fontSize: 13 }}>{t('slopeArea')}</Text>} 
                tooltip={t('slopeAreaTooltip')} 
                style={{ margin: 0, marginBottom: 12 }}
            >
                <InputNumber style={{ width: '100%' }} min={0} step={5} precision={2}
                    value={inp.roof_area_m2} onChange={v => update({ roof_area_m2: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical"
                label={<Text style={{ fontSize: 13 }}>{t('roofingType')}</Text>} 
                tooltip={t('roofingTypeTooltip')}
                style={{ margin: 0 }}
            >
                <Select value={inp.roofing_type} onChange={v => update({ roofing_type: v })} style={{ width: '100%' }}
                    options={[
                        { value: 'cpac', label: t('typeCpac') },
                        { value: 'excella', label: t('typeExcella') },
                        { value: 'metal_sheet', label: t('typeMetalSheet') },
                        { value: 'corrugated', label: t('typeCorrugated') },
                        { value: 'shingle', label: t('typeShingle') },
                    ]} />
            </Form.Item>
        </Card>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('flashingsTrims')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('ridgeLength')}</Text>} 
                        tooltip={t('ridgeTooltip')} 
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.ridge_length_m} onChange={v => update({ ridge_length_m: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('hipLength')}</Text>} 
                        tooltip={t('hipTooltip')} 
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.hip_length_m} onChange={v => update({ hip_length_m: v ?? 0 })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('eaveLength')}</Text>} 
                        tooltip={t('eaveTooltip')} 
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.eave_length_m} onChange={v => update({ eave_length_m: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('valleyLength')}</Text>} 
                        tooltip={t('valleyTooltip')} 
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} step={1}
                            value={inp.valley_length_m} onChange={v => update({ valley_length_m: v ?? 0 })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('accessoriesWaste')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item layout="vertical"
                    label={<Text style={{ fontSize: 13 }}>{t('insulation')}</Text>} 
                    tooltip={t('insulationTooltip')} 
                    style={{ margin: 0, marginBottom: 12 }}
                >
                    <Switch checked={inp.insulation_required}
                        onChange={v => update({ insulation_required: v })}
                        checkedChildren={t('insulationYes')} unCheckedChildren={t('insulationNo')} />
                </Form.Item>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('birdBlock')}</Text>} 
                        tooltip={t('birdBlockTooltip')} 
                        style={{ margin: 0 }}
                    >
                        <Switch checked={inp.bird_block_required}
                            onChange={v => update({ bird_block_required: v })}
                            checkedChildren={t('birdBlockYes')} unCheckedChildren={t('birdBlockNo')} />
                    </Form.Item>
                    <Form.Item layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} 
                        style={{ margin: 0 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} max={20} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    return (
        <StepFormShell
            stepId={16} title="มุงหลังคา" titleEn="Roofing"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
}
