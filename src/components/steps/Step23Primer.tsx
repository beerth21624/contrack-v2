'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Space, Tag, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step23Input, calcStep23 } from '@/lib/steps/step23';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step23Input;  onBack: () => void; onSave: (inp: Step23Input, res: StepResult) => void; }

const DEFAULTS: Step23Input = {
    interior_area_m2: 0, exterior_area_m2: 0,
    primer_type_interior: 'alkali_seal', primer_type_exterior: 'alkali_seal',
    coats: 1, waste_percent: 0,
    surface_prep_required: false, use_sealer_crack: false,
};

export default function Step23Primer({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step23');
    const [inp, setInp] = useState<Step23Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step23Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const totalArea = inp.interior_area_m2 + inp.exterior_area_m2;

    const result = useMemo(() => {
        try {
            return calcStep23(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('areaPrimerType')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Space style={{ marginBottom: 12 }}>
                    <Tag color="blue">{t('totalAreaTag', { area: totalArea.toFixed(0) })}</Tag>
                    <Tag color="green">{t('intAreaTag', { area: inp.interior_area_m2.toFixed(0) })}</Tag>
                    <Tag color="orange">{t('extAreaTag', { area: inp.exterior_area_m2.toFixed(0) })}</Tag>
                </Space>

                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('intArea')}</Text>}
                        tooltip={t('intAreaTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={10} precision={0}
                            value={inp.interior_area_m2} onChange={v => update({ interior_area_m2: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('extArea')}</Text>}
                        tooltip={t('extAreaTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={10} precision={0}
                            value={inp.exterior_area_m2} onChange={v => update({ exterior_area_m2: v ?? 0 })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('intPrimer')}</Text>}
                        tooltip={t('intPrimerTooltip')} style={{ margin: 0 }}>
                        <Select value={inp.primer_type_interior} onChange={v => update({ primer_type_interior: v })}
                            options={[
                                { value: 'acrylic', label: t('primerTypes.acrylic') },
                                { value: 'alkali_seal', label: t('primerTypes.alkali_seal') },
                                { value: 'water_based', label: t('primerTypes.water_based') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('extPrimer')}</Text>}
                        tooltip={t('extPrimerTooltip')} style={{ margin: 0 }}>
                        <Select value={inp.primer_type_exterior} onChange={v => update({ primer_type_exterior: v })}
                            options={[
                                { value: 'acrylic', label: t('primerTypes.acrylic') },
                                { value: 'alkali_seal', label: t('primerTypes.alkali_seal') },
                                { value: 'elastomeric', label: t('primerTypes.elastomeric') },
                            ]} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optionsWaste')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('coats')}</Text>}
                        tooltip={t('coatsTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.coats} onChange={v => update({ coats: v })}
                            options={[
                                { value: 1, label: t('coat1') },
                                { value: 2, label: t('coat2') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={25} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('surfacePrepInfo')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('sandSurface')}</Text>}
                        tooltip={t('sandTooltip')} style={{ margin: 0 }}>
                        <Switch checked={inp.surface_prep_required} onChange={v => update({ surface_prep_required: v })}
                            checkedChildren={t('labelSand')} unCheckedChildren={t('labelNoNeed')} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('fillCracks')}</Text>}
                        tooltip={t('fillCracksTooltip')} style={{ margin: 0 }}>
                        <Switch checked={inp.use_sealer_crack} onChange={v => update({ use_sealer_crack: v })}
                            checkedChildren={t('labelFillCracks')} unCheckedChildren={t('labelNoNeed')} />
                    </Form.Item>
                </div>
            </Card>

        </div>
    );

    return (
        <StepFormShell stepId={23} title="ทาสีรองพื้น" titleEn="Primer Coat"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
