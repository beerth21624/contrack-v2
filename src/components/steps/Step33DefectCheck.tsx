'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Switch, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step33Input, calcStep33 } from '@/lib/steps/step33';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step33Input;  onBack: () => void; onSave: (inp: Step33Input, res: StepResult) => void; }

const DEFAULTS: Step33Input = {
    total_floor_area_m2: 0,
    protection_required: true,
    pressure_test_systems: 0,
    megger_test_required: true,
    defect_contingency_lump_sum: true,
};

export default function Step33DefectCheck({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step33');
    const [inp, setInp] = useState<Step33Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step33Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep33(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card1Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cleaningArea')}</Text>}
                        tooltip={t('cleaningTooltip')} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={10}
                            value={inp.total_floor_area_m2} onChange={v => update({ total_floor_area_m2: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('protection')}</Text>}
                        tooltip={t('protectionTooltip')} style={{ margin: 0 }}>
                        <Switch checked={inp.protection_required} onChange={v => update({ protection_required: v })}
                            checkedChildren={t('protectYes')} unCheckedChildren={t('protectNo')} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card2Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('pressureTest')}</Text>} 
                        tooltip={t('pressureTestTooltip')} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.pressure_test_systems} onChange={v => update({ pressure_test_systems: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('meggerTest')}</Text>} style={{ margin: 0 }}>
                        <Switch checked={inp.megger_test_required} onChange={v => update({ megger_test_required: v })}
                            checkedChildren={t('meggerYes')} unCheckedChildren={t('meggerNo')} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optCardMain')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('defectContingency')}</Text>}
                        tooltip={t('defectTooltip')} style={{ margin: 0 }}>
                    <Switch checked={inp.defect_contingency_lump_sum} onChange={v => update({ defect_contingency_lump_sum: v })}
                        checkedChildren={t('contingencyYes')} unCheckedChildren={t('contingencyNo')} />
                </Form.Item>
            </Card>
        </div>
    );

    return (
        <StepFormShell stepId={33} title="งานป้องกันและทดสอบระบบ" titleEn="Protection & Testing"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
