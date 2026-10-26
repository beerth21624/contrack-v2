'use client';

import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card, Button, Space, Collapse } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { StructuralSpecForm } from '../shared/StructuralSpecForm';
import { type Step7Input, type PedestalEntry, calcStep7 } from '@/lib/steps/step07';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step7Input;  onBack: () => void; onSave: (inp: Step7Input, res: StepResult) => void; }

const createPedestal = (index: number): PedestalEntry => ({
    label: `P${index}`,
    count: 1,
    width_m: 0,
    length_m: 0,
    height_m: 0,
});

const DEFAULTS: Step7Input = {
    pedestals: [createPedestal(1)],
    waste_percent: 10,
    rebar_weight_kg_per_m3: 0,
    main_bar_count: 0,
    dowel_bar_length_m: 0,
    concrete_pump_required: false,
    curing_method: 'plastic'
};

export const Step7Pedestal: React.FC<Props> = ({ onBack, onSave, initialData }) => {
    const [inp, setInp] = useState<Step7Input>(initialData ?? DEFAULTS);
    const t = useTranslations('steps.step7');
    const update = useCallback((patch: Partial<Step7Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const totalN = useMemo(() => inp.pedestals.reduce((acc, p) => acc + p.count, 0), [inp.pedestals]);

    const updatePedestal = (index: number, patch: Partial<PedestalEntry>) => {
        setInp(prev => {
            const pedestals = [...prev.pedestals];
            pedestals[index] = { ...pedestals[index], ...patch } as PedestalEntry;
            return { ...prev, pedestals };
        });
    };

    const addPedestal = () => {
        setInp(prev => ({
            ...prev,
            pedestals: [...prev.pedestals, createPedestal(prev.pedestals.length + 1)]
        }));
    };

    const removePedestal = (index: number) => {
        setInp(prev => ({
            ...prev,
            pedestals: prev.pedestals.filter((_, i) => i !== index)
        }));
    };

    const result = useMemo(() => {
        try {
            return calcStep7(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <>
            {inp.pedestals.map((p, i) => {
                const vol = (p.width_m * p.length_m * p.height_m * p.count);
                return (
                    <Card key={i} size="small" style={{ marginBottom: 12, border: '1px solid #ffe4b5' }}
                        title={
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Text strong style={{ fontSize: 13 }}>{p.label}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('pedestalFormula', { count: p.count, w: p.width_m, l: p.length_m, h: p.height_m, vol: vol.toFixed(3) })}
                                </Text>
                            </Space>
                        }
                        extra={inp.pedestals.length > 1 && (
                            <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removePedestal(i)} />
                        )}
                    >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('count')}</Text>}
                                tooltip={t('countTooltip')} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                                    value={p.count} onChange={v => updatePedestal(i, { count: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('widthW')}</Text>}
                                tooltip={t('widthWTooltip')} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.05} precision={2}
                                    value={p.width_m} onChange={v => updatePedestal(i, { width_m: v ?? 0.3 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('lengthL')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.05} precision={2}
                                    value={p.length_m} onChange={v => updatePedestal(i, { length_m: v ?? 0.3 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('heightH')}</Text>}
                                tooltip={t('heightHTooltip')} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.05} precision={2}
                                    value={p.height_m} onChange={v => updatePedestal(i, { height_m: v ?? 0.6 })} />
                            </Form.Item>
                        </div>
                    </Card>
                );
            })}

            <Button type="dashed" block icon={<PlusOutlined />} onClick={addPedestal} style={{ marginBottom: 12 }}>
                {t('addPedestal')}
            </Button>

            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                {t('totalLabel', { total: totalN, types: inp.pedestals.length })}
            </Text>

            <Collapse size="small" defaultActiveKey={[]} items={[{
                key: 'advanced', label: <span className="text-gray-500 font-medium">⚙️ ตั้งค่าขั้นสูง (สเปคคอนกรีต / เผื่อสูญเสีย)</span>, children: (
                    <div className="flex flex-col gap-4">
                        <StructuralSpecForm 
                            spec={inp.structural_spec ?? { ksc: 240, waterproof: false, workLevel: '1FL' }}
                            onChange={patch => update({ structural_spec: { ...inp.structural_spec, ...patch } as any })}
                            fixedWorkLevel="1FL"
                            hideWaterproof={false}
                        />

                        <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('globalParams')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wasteConc')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                                    value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                            </Form.Item>
                        </Card>
                    </div>
                )
            }]} />
        </>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleRebarAndForm')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarWeight')}</Text>}
                        validateStatus={result?.warningFields?.includes('rebar_weight_kg_per_m3') ? 'warning' : ''}
                        tooltip={t('rebarWeightTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={250} step={5}
                            value={inp.rebar_weight_kg_per_m3} onChange={v => update({ rebar_weight_kg_per_m3: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('tieWire')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={3} step={0.5} placeholder="1.5%"
                            value={inp.tie_wire_factor} onChange={v => update({ tie_wire_factor: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('mainBarCount')}</Text>}
                        tooltip={t('mainBarCountTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <Select style={{ width: '100%' }} allowClear placeholder={t('mainBarCountPh')}
                            value={inp.main_bar_count} onChange={v => update({ main_bar_count: v })}
                            options={[
                                { value: 4, label: t('bars4') }, { value: 6, label: t('bars6') },
                                { value: 8, label: t('bars8') }, { value: 12, label: t('bars12') },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('dowelBarLen')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={1.5} step={0.1} placeholder={t('dowelBarLenPh')}
                            value={inp.dowel_bar_length_m} onChange={v => update({ dowel_bar_length_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('spacer')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1} placeholder={t('spacerPh')}
                            value={inp.spacer_per_pedestal} onChange={v => update({ spacer_per_pedestal: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleOps')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cureMethod')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.curing_method ?? 'water'}
                            onChange={v => update({ curing_method: v })}
                            options={[
                                { value: 'water', label: t('cureWater') },
                                { value: 'plastic', label: t('curePlastic') },
                                { value: 'compound', label: t('cureCompound') },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('pump')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.concrete_pump_required}
                            onChange={v => update({ concrete_pump_required: v })}
                            checkedChildren={t('pumpYes')} unCheckedChildren={t('pumpNo')} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('vibratorDays')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={1}
                        value={inp.vibrator_days} onChange={v => update({ vibrator_days: v ?? undefined })} />
                </Form.Item>
            </Card>

            
        </div>
    );

    return (
        <StepFormShell stepId={7} title="เสาตอม่อ" titleEn="Pedestal / Column Stump"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
};
export default Step7Pedestal;
