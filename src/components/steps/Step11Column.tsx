'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card, Button, Space, Collapse } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { type Step11Input, type ColumnEntry, calcStep11 } from '@/lib/steps/step11';
import { StructuralSpecForm } from '../shared/StructuralSpecForm';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step11Input;  onBack: () => void; onSave: (inp: Step11Input, res: StepResult) => void; }

const createColumn = (index: number): ColumnEntry => ({
    label: `C${index}`,
    count: 1,
    width_m: 0,
    depth_m: 0,
    height_m: 0,
});

const DEFAULTS: Step11Input = {
    columns: [createColumn(1)],
    rebar_kg_per_m3: 0,
    waste_percent: 10,
    curing_method: 'plastic'
};

export default function Step11Column({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step11');
    const [inp, setInp] = useState<Step11Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step11Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const totalN = useMemo(() => inp.columns.reduce((acc, c) => acc + c.count, 0), [inp.columns]);

    const updateColumn = (index: number, patch: Partial<ColumnEntry>) => {
        setInp(prev => {
            const columns = [...prev.columns];
            columns[index] = { ...columns[index], ...patch } as ColumnEntry;
            return { ...prev, columns };
        });
    };

    const addColumn = () => {
        setInp(prev => ({
            ...prev,
            columns: [...prev.columns, createColumn(prev.columns.length + 1)]
        }));
    };

    const removeColumn = (index: number) => {
        setInp(prev => ({
            ...prev,
            columns: prev.columns.filter((_, i) => i !== index)
        }));
    };

    const result = useMemo(() => {
        try {
            return calcStep11(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            {inp.columns.map((c, i) => {
                const vol = (c.width_m * c.depth_m * c.height_m * c.count);
                return (
                    <Card key={i} size="small" style={{ marginBottom: 12, border: '1px solid #ffe4b5' }}
                        title={
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Text strong style={{ fontSize: 13 }}>{c.label}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('formula', { count: c.count, width: c.width_m, depth: c.depth_m, height: c.height_m, vol: vol.toFixed(3) })}
                                </Text>
                            </Space>
                        }
                        extra={inp.columns.length > 1 && (
                            <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeColumn(i)} />
                        )}
                    >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('count')}</Text>}
                                tooltip={t('countTooltip')} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                                    value={c.count} onChange={v => updateColumn(i, { count: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('width')}</Text>}
                                tooltip={t('widthTooltip')} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.05} precision={2}
                                    value={c.width_m} onChange={v => updateColumn(i, { width_m: v ?? 0.20 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('depth')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.05} precision={2}
                                    value={c.depth_m} onChange={v => updateColumn(i, { depth_m: v ?? 0.20 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('height')}</Text>}
                                tooltip={t('heightTooltip')} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.10} precision={2}
                                    value={c.height_m} onChange={v => updateColumn(i, { height_m: v ?? 2.70 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('section')}</Text>} style={{ margin: 0 }}>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('sectionSubtitle', { width: (c.width_m * 100).toFixed(0), depth: (c.depth_m * 100).toFixed(0) })}
                                </Text>
                            </Form.Item>
                        </div>
                    </Card>
                );
            })}

            <Button type="dashed" block icon={<PlusOutlined />} onClick={addColumn} style={{ marginBottom: 12 }}>
                {t('addColumn')}
            </Button>

            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                {t('totalSummary', { total: totalN, types: inp.columns.length })}
            </Text>

            <Collapse size="small" defaultActiveKey={[]} items={[{
                key: 'advanced', label: <span className="text-gray-500 font-medium">⚙️ ตั้งค่าขั้นสูง (สเปคคอนกรีต / เผื่อสูญเสีย)</span>, children: (
                    <div className="flex flex-col gap-4">
                        <StructuralSpecForm 
                            spec={inp.structural_spec ?? { ksc: 240, waterproof: false, workLevel: '1FL' }}
                            onChange={patch => update({ structural_spec: { ...inp.structural_spec, ...patch } as any })}
                        />

                        <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('globalParams')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                            <div className="grid grid-cols-2 gap-2">
                                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarDensity')}</Text>}
                                    validateStatus={result?.warningFields?.includes('rebar_kg_per_m3') ? 'warning' : ''}
                                    tooltip={t('rebarDensityTooltip')} style={{ margin: 0 }}>
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={300} step={10}
                                        value={inp.rebar_kg_per_m3} onChange={v => update({ rebar_kg_per_m3: v ?? 120 })} />
                                </Form.Item>
                                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                                        value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                                </Form.Item>
                            </div>
                        </Card>
                    </div>
                )
            }]} />
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('formworkSpecials')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('tieWire')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={3} step={0.5} placeholder={t('tieWirePh')}
                            value={inp.tie_wire_factor} onChange={v => update({ tie_wire_factor: v ?? undefined })} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('spacer')}</Text>} style={{ margin: 0 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={8} step={1} placeholder={t('spacerPh')}
                        value={inp.spacer_per_column} onChange={v => update({ spacer_per_column: v ?? undefined })} />
                </Form.Item>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('operations')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('curingMethod')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.curing_method ?? 'water'}
                            onChange={v => update({ curing_method: v })}
                            options={[
                                { value: 'water', label: t('curingWater') },
                                { value: 'plastic', label: t('curingPlastic') },
                                { value: 'compound', label: t('curingCompound') },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('concretePump')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.concrete_pump_required} onChange={v => update({ concrete_pump_required: v })}
                            checkedChildren={t('pumpYes')} unCheckedChildren={t('pumpNo')} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('vibratorDays')}</Text>} tooltip={t('vibratorDaysTooltip')} style={{ margin: 0 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={1}
                        value={inp.vibrator_days} onChange={v => update({ vibrator_days: v ?? undefined })} />
                </Form.Item>
            </Card>
            
        </div>
    );

    return (
        <StepFormShell stepId={11} title="ทำเสาชั้น 1" titleEn="Column Floor 1"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
