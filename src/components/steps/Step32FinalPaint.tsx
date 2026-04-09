'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Space, Tag, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step32Input, calcStep32 } from '@/lib/steps/step32';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step32Input;  onBack: () => void; onSave: (inp: Step32Input, res: StepResult) => void; }

const DEFAULTS: Step32Input = {
    interior_wall_area_m2: 0, exterior_wall_area_m2: 0,
    ceiling_area_m2: 0, paint_ceiling: true,
    paint_grade_interior: 'premium', paint_grade_exterior: 'premium',
    waste_percent: 0, woodwork_area_m2: 0,
};

export default function Step32FinalPaint({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step32');
    const [inp, setInp] = useState<Step32Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step32Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const totalArea = inp.interior_wall_area_m2 + inp.exterior_wall_area_m2 + (inp.paint_ceiling ? inp.ceiling_area_m2 : 0);

    const result = useMemo(() => {
        try {
            return calcStep32(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card1Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Space style={{ marginBottom: 12 }} wrap>
                    <Tag color="blue">{t('totalPaintTag', { val: totalArea.toFixed(0) })}</Tag>
                    <Tag color="green">{t('inPaintTag', { val: inp.interior_wall_area_m2.toFixed(0) })}</Tag>
                    <Tag color="orange">{t('outPaintTag', { val: inp.exterior_wall_area_m2.toFixed(0) })}</Tag>
                </Space>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('interiorWallArea')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={10} precision={0}
                            value={inp.interior_wall_area_m2} onChange={v => update({ interior_wall_area_m2: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('exteriorWallArea')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={10} precision={0}
                            value={inp.exterior_wall_area_m2} onChange={v => update({ exterior_wall_area_m2: v ?? 0 })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('ceilingArea')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={10} precision={0}
                            value={inp.ceiling_area_m2} onChange={v => update({ ceiling_area_m2: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('paintCeiling')}</Text>} style={{ margin: 0 }}>
                        <Switch checked={inp.paint_ceiling} onChange={v => update({ paint_ceiling: v })}
                            checkedChildren={t('yes')} unCheckedChildren={t('no')} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card2Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('interiorGrade')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.paint_grade_interior} onChange={v => update({ paint_grade_interior: v })}
                            options={[
                                { value: 'economy', label: t('economy', { val: '40' }) },
                                { value: 'premium', label: t('premium', { val: '35' }) },
                                { value: 'washable', label: t('washable', { val: '32' }) },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('exteriorGrade')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.paint_grade_exterior} onChange={v => update({ paint_grade_exterior: v })}
                            options={[
                                { value: 'economy', label: t('economy', { val: '35' }) },
                                { value: 'premium', label: t('premium', { val: '32' }) },
                                { value: 'elastomeric', label: t('elastomeric', { val: '25' }) },
                            ]} />
                    </Form.Item>
                </div>
                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wastePercent')}</Text>} style={{ margin: 0 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                        value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 0 })} />
                </Form.Item>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optCardMain')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('woodworkArea')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5}
                            value={inp.woodwork_area_m2} onChange={v => update({ woodwork_area_m2: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('touchUpPercent')}</Text>}
                        tooltip={t('touchUpTooltip')} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                            value={inp.touch_up_percent ?? 5} onChange={v => update({ touch_up_percent: v ?? 5 })} />
                    </Form.Item>
                </div>
            </Card>

            
        </div>
    );

    return (
        <StepFormShell stepId={32} title="ทาสีรอบสุดท้าย" titleEn="Final Paint (Coat 2)"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
