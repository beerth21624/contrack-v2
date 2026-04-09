'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step22Input } from '@/lib/steps/step22';
import { calcStep22 } from '@/lib/steps';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step22Input;  onBack: () => void; onSave: (inp: Step22Input, res: StepResult) => void; }

const DEFAULTS: Step22Input = {
    facade_area_m2: 0,
    finish_type: 'paint_only',
    waste_percent: 0,
};

export default function Step22ExteriorFinish({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step22');
    const [inp, setInp] = useState<Step22Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step22Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep22(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('wallFinishInfo')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
            <Form.Item required layout="vertical"
                label={<Text style={{ fontSize: 13 }}>{t('facadeArea')}</Text>} 
                tooltip={t('facadeTooltip')}
                style={{ margin: 0, marginBottom: 12 }}
            >
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={10} precision={2}
                    value={inp.facade_area_m2} onChange={v => update({ facade_area_m2: v ?? 0 })} />
            </Form.Item>
            <div className="grid grid-cols-2 gap-2">
                <Form.Item required layout="vertical"
                    label={<Text style={{ fontSize: 13 }}>{t('finishType')}</Text>} 
                    tooltip={t('finishTooltip')}
                    style={{ margin: 0, marginBottom: 12 }}
                >
                    <Select value={inp.finish_type} onChange={v => update({ finish_type: v })} style={{ width: '100%' }}
                        options={[
                            { value: 'paint_only', label: t('types.paint_only') },
                            { value: 'texture_paint', label: t('types.texture_paint') },
                            { value: 'tile', label: t('types.tile') },
                            { value: 'stone_cladding', label: t('types.stone_cladding') },
                            { value: 'wood_cladding', label: t('types.wood_cladding') },
                        ]} />
                </Form.Item>
                <Form.Item required layout="vertical"
                    label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} 
                    tooltip={t('wasteTooltip')}
                    style={{ margin: 0, marginBottom: 12 }}
                >
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={25} step={1}
                        value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                </Form.Item>
            </div>
        </Card>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('sealantInfo')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item layout="vertical"
                    label={<Text style={{ fontSize: 13 }}>{t('sealantLength')}</Text>} 
                    tooltip={t('sealantTooltip')}
                    style={{ margin: 0 }}
                >
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} precision={2}
                        value={inp.sealant_length_m} onChange={v => update({ sealant_length_m: v ?? undefined })} />
                </Form.Item>
            </Card>

            
        </div>
    );

    return (
        <StepFormShell
            stepId={22} title="ตกแต่งผนังภายนอก" titleEn="Exterior Wall Finish"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
}
