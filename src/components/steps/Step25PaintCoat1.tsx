'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Space, Tag, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step25Input, calcStep25 } from '@/lib/steps/step25';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step25Input;  onBack: () => void; onSave: (inp: Step25Input, res: StepResult) => void; }

const DEFAULTS: Step25Input = {
    interior_wall_area_m2: 0, exterior_wall_area_m2: 0,
    ceiling_area_m2: 0, paint_ceiling: false,
    paint_grade_interior: 'premium', paint_grade_exterior: 'premium',
    sheen_interior: 'eggshell',
    waste_percent: 0, woodwork_area_m2: 0,
};

export default function Step25PaintCoat1({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step25');
    const [inp, setInp] = useState<Step25Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step25Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const totalArea = inp.interior_wall_area_m2 + inp.exterior_wall_area_m2 + (inp.paint_ceiling ? inp.ceiling_area_m2 : 0);

    const result = useMemo(() => {
        try {
            return calcStep25(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('paintAreaInfo')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Space style={{ marginBottom: 12 }}>
                    <Tag color="blue">{t('totalAreaTag', { area: totalArea.toFixed(0) })}</Tag>
                    <Tag color="green">{t('intTag', { area: inp.interior_wall_area_m2.toFixed(0) })}</Tag>
                    <Tag color="orange">{t('extTag', { area: inp.exterior_wall_area_m2.toFixed(0) })}</Tag>
                    {inp.paint_ceiling && <Tag color="purple">{t('ceilTag', { area: inp.ceiling_area_m2.toFixed(0) })}</Tag>}
                </Space>

                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('intWallArea')}</Text>}
                        tooltip={t('intWallTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={10} precision={0}
                            value={inp.interior_wall_area_m2} onChange={v => update({ interior_wall_area_m2: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('extWallArea')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={10} precision={0}
                            value={inp.exterior_wall_area_m2} onChange={v => update({ exterior_wall_area_m2: v ?? 0 })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('ceilArea')}</Text>}
                        tooltip={t('ceilTooltip')} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={10} precision={0}
                            value={inp.ceiling_area_m2} onChange={v => update({ ceiling_area_m2: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('paintCeil')}</Text>} style={{ margin: 0 }}>
                        <Switch checked={inp.paint_ceiling} onChange={v => update({ paint_ceiling: v })}
                            checkedChildren={t('labelPaint')} unCheckedChildren={t('labelNoPaint')} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('paintGradeInfo')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('intGrade')}</Text>}
                        tooltip={t('intGradeTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.paint_grade_interior} onChange={v => update({ paint_grade_interior: v })}
                            options={[
                                { value: 'economy', label: t('intGradeOptions.economy') },
                                { value: 'premium', label: t('intGradeOptions.premium') },
                                { value: 'washable', label: t('intGradeOptions.washable') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('extGrade')}</Text>}
                        tooltip={t('extGradeTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.paint_grade_exterior} onChange={v => update({ paint_grade_exterior: v })}
                            options={[
                                { value: 'economy', label: t('extGradeOptions.economy') },
                                { value: 'premium', label: t('extGradeOptions.premium') },
                                { value: 'elastomeric', label: t('extGradeOptions.elastomeric') },
                            ]} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('sheen')}</Text>}
                        tooltip={t('sheenTooltip')} style={{ margin: 0 }}>
                        <Select value={inp.sheen_interior} onChange={v => update({ sheen_interior: v })}
                            options={[
                                { value: 'flat', label: t('sheenOptions.flat') },
                                { value: 'eggshell', label: t('sheenOptions.eggshell') },
                                { value: 'semi_gloss', label: t('sheenOptions.semi_gloss') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={25} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('specialDetails')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('accentWall')}</Text>}
                        tooltip={t('accentTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={5}
                            value={inp.accent_wall_area_m2} onChange={v => update({ accent_wall_area_m2: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('woodwork')}</Text>}
                        tooltip={t('woodworkTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={5}
                            value={inp.woodwork_area_m2} onChange={v => update({ woodwork_area_m2: v ?? undefined })} />
                    </Form.Item>
                </div>
                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('colorCount')}</Text>}
                    tooltip={t('colorTooltip')} style={{ margin: 0 }}>
                    <InputNumber style={{ width: '100%' }} min={0} max={10} step={1}
                        value={inp.color_count ?? 1} onChange={v => update({ color_count: v ?? 1 })} />
                </Form.Item>
            </Card>

            
        </div>
    );

    return (
        <StepFormShell stepId={25} title="ทาสีจริง รอบ 1" titleEn="Paint Coat 1"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
