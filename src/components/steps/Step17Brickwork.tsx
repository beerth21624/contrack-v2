import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Typography, Card } from 'antd';
import { type Step17Input, calcStep17 } from '@/lib/steps/step17';
import { type StepResult } from '@/types';
import { StepFormShell } from '../StepFormShell';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step17Input; 
    onBack: () => void;
    onSave: (inp: Step17Input, res: StepResult) => void;
}

const DEFAULTS: Step17Input = {
    total_wall_area_m2: 0,
    doors_windows_area_m2: 0,
    brick_type: 'clay',
    waste_percent: 0,
};

export default function Step17Brickwork({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step17');
    const [inp, setInp] = useState<Step17Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step17Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep17(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('totalWallArea')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
            <div className="grid grid-cols-2 gap-2">
                <Form.Item required layout="vertical"
                    label={<Text style={{ fontSize: 13 }}>{t('grossWallArea')}</Text>} 
                    tooltip={t('grossWallTooltip')}
                    style={{ margin: 0, marginBottom: 12 }}
                >
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} precision={2}
                        value={inp.total_wall_area_m2} onChange={v => update({ total_wall_area_m2: v ?? 0 })} />
                </Form.Item>
                <Form.Item required layout="vertical"
                    label={<Text style={{ fontSize: 13 }}>{t('openingsArea')}</Text>} 
                    tooltip={t('openingsTooltip')}
                    style={{ margin: 0, marginBottom: 12 }}
                >
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={2} precision={2}
                        value={inp.doors_windows_area_m2} onChange={v => update({ doors_windows_area_m2: v ?? 0 })} />
                </Form.Item>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Form.Item required layout="vertical"
                    label={<Text style={{ fontSize: 13 }}>{t('brickType')}</Text>} 
                    style={{ margin: 0 }}
                >
                    <Select value={inp.brick_type} onChange={v => update({ brick_type: v })} style={{ width: '100%' }}
                        options={[
                            { value: 'clay', label: t('typeClay') },
                            { value: 'aac', label: t('typeAAC') },
                        ]} />
                </Form.Item>
                <Form.Item required layout="vertical"
                    label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} 
                    tooltip={t('wasteTooltip')}
                    style={{ margin: 0 }}
                >
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                        value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                </Form.Item>
            </div>
        </Card>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('stiffenersLintels')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item layout="vertical"
                    label={<Text style={{ fontSize: 13 }}>{t('lintelLength')}</Text>} 
                    tooltip={t('lintelTooltip')}
                    style={{ margin: 0 }}
                >
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} precision={2}
                        value={inp.lintel_length_m} onChange={v => update({ lintel_length_m: v ?? undefined })} />
                </Form.Item>
            </Card>
            
        </div>
    );

    return (
        <StepFormShell
            stepId={17} title="ก่ออิฐ" titleEn="Brickwork / Masonry"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
}
