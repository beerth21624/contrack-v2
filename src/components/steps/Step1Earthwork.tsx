'use client';

import { useState, useMemo, useCallback } from "react";
import { InputNumber, Switch, Select, Form, Typography, Card, Button, Space, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { calcStep1 } from '@/lib/steps';
import type { Step1Input, StepResult } from '@/types';
import type { FillAreaEntry } from '@/lib/steps/step01';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step1Input;  onSave: (inp: Step1Input, res: StepResult) => void; onBack: () => void; }

const SOIL_COMPACTION = {
    selected_fill: { min: 1.15, max: 1.25 },
    general: { min: 1.20, max: 1.30 },
    soft: { min: 1.25, max: 1.35 },
    sand: { min: 1.10, max: 1.15 },
    crushed_rock: { min: 1.15, max: 1.20 },
};

const createFillArea = (index: number): FillAreaEntry => ({
    label: `พื้นที่ ${index}`,
    width_m: 0,
    length_m: 0,
    average_fill_height_m: 0,
    compaction_factor: 1.30,
    layer_thickness_m: 0.30,
});

const DEFAULT: Step1Input = {
    fill_areas: [createFillArea(1)],
    waste_percent: 0,
};

export const Step1Earthwork: React.FC<Props> = ({ onSave, onBack, initialData }) => {
    const [inp, setInp] = useState<Step1Input>(initialData ?? DEFAULT);
    const t = useTranslations('steps.step1');
    const update = useCallback((patch: Partial<Step1Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const updateFillArea = (index: number, patch: Partial<FillAreaEntry>) => {
        setInp(prev => {
            const fill_areas = [...prev.fill_areas];
            fill_areas[index] = { ...fill_areas[index], ...patch } as FillAreaEntry;
            return { ...prev, fill_areas };
        });
    };

    const handleSoilChange = (index: number, type: string | undefined) => {
        if (!type) {
            updateFillArea(index, { soil_type: undefined });
            return;
        }
        const key = type as keyof typeof SOIL_COMPACTION;
        const cf = key in SOIL_COMPACTION ? SOIL_COMPACTION[key].max : 1.30;
        updateFillArea(index, { soil_type: type as FillAreaEntry['soil_type'], compaction_factor: cf });
    };

    const addFillArea = () => {
        setInp(prev => ({
            ...prev,
            fill_areas: [...prev.fill_areas, createFillArea(prev.fill_areas.length + 1)]
        }));
    };

    const removeFillArea = (index: number) => {
        setInp(prev => ({
            ...prev,
            fill_areas: prev.fill_areas.filter((_, i) => i !== index)
        }));
    };

    const result = useMemo(() => {
        try {
            return calcStep1(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <>
            {inp.fill_areas.map((f, i) => {
                const vol = f.width_m * f.length_m * f.average_fill_height_m * f.compaction_factor;
                return (
                    <Card 
                        key={i} size="small" 
                        style={{ marginBottom: 12, border: '1px solid #ffe4b5' }}
                        title={
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Text strong style={{ fontSize: 13 }}>{t('areaNumber', { index: i + 1 })}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('compactedVol', { vol: vol.toFixed(2) })}
                                </Text>
                            </Space>
                        }
                        extra={
                            inp.fill_areas.length > 1 && (
                                <Button type="text" danger size="small" icon={<DeleteOutlined />}
                                    onClick={() => removeFillArea(i)} />
                            )
                        }
                    >
                        <div className="grid grid-cols-2 md:grid-cols-2 gap-2" style={{ marginBottom: 8 }}>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('soilType')}</Text>} style={{ margin: 0, gridColumn: '1 / -1' }}>
                                <Select value={f.soil_type} onChange={v => handleSoilChange(i, v)} allowClear placeholder={t('soilPh')}
                                    options={[
                                        { value: 'selected_fill', label: t('soilSelected') },
                                        { value: 'general', label: t('soilGeneral') },
                                        { value: 'soft', label: t('soilSoft') },
                                        { value: 'sand', label: t('soilSand') },
                                        { value: 'crushed_rock', label: t('soilCrushed') },
                                    ]} />
                            </Form.Item>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-2 gap-2">
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('width')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.5} precision={2}
                                    value={f.width_m} onChange={v => updateFillArea(i, { width_m: v ?? 0 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('length')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.5} precision={2}
                                    value={f.length_m} onChange={v => updateFillArea(i, { length_m: v ?? 0 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('height')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.1} precision={2}
                                    value={f.average_fill_height_m} onChange={v => updateFillArea(i, { average_fill_height_m: v ?? 0 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('cf')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={1.5} step={0.01} precision={2}
                                    value={f.compaction_factor} onChange={v => updateFillArea(i, { compaction_factor: v ?? 1.25 })} />
                            </Form.Item>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-2" style={{ marginTop: 8 }}>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('layerThick')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={0.5} step={0.05} placeholder={t('layerPh')}
                                    value={f.layer_thickness_m} onChange={v => updateFillArea(i, { layer_thickness_m: v ?? undefined })} />
                            </Form.Item>
                        </div>
                    </Card>
                );
            })}

            <Button type="dashed" block icon={<PlusOutlined />} onClick={addFillArea}
                style={{ marginBottom: 12 }}>
                {t('addArea')}
            </Button>

            <Divider style={{ margin: '8px 0' }} />

            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} 
                tooltip={t('wasteTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                    value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
            </Form.Item>
        </>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <>
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optTitleClearance')}</span>} size="small" className="shadow-sm mb-4" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('optClearanceArea')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={10} placeholder={t('optClearancePh')}
                            value={inp.site_clearance_area_m2} onChange={v => update({ site_clearance_area_m2: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('optDemolitionTrips')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} placeholder={t('optDemolitionPh')}
                            value={inp.demolition_trips} onChange={v => update({ demolition_trips: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('optRoller')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} placeholder={t('optRollerPh')}
                    value={inp.roller_productivity_m3_per_hour} onChange={v => update({ roller_productivity_m3_per_hour: v ?? undefined })} />
            </Form.Item>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('optTruck')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={30} step={1} placeholder={t('optTruckPh')}
                    value={inp.truck_capacity_m3} onChange={v => update({ truck_capacity_m3: v ?? undefined })} />
            </Form.Item>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('optDistance')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} placeholder={t('optDistancePh')}
                    value={inp.haul_distance_km} onChange={v => update({ haul_distance_km: v ?? undefined })} />
            </Form.Item>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('optBackhoe')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} placeholder={t('optBackhoePh')}
                    value={inp.backhoe_productivity_m3_per_hour} onChange={v => update({ backhoe_productivity_m3_per_hour: v ?? undefined })} />
            </Form.Item>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('optSoilTest')}</Text>} style={{ margin: 0 }}>
                <Switch checked={inp.soil_test_required} onChange={v => update({ soil_test_required: v })}
                    checkedChildren={t('do')} unCheckedChildren={t('dont')} />
            </Form.Item>
            {inp.soil_test_required && (
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('optTestPoint')}</Text>} style={{ margin: 0 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1} placeholder={t('optTestPh')}
                        value={inp.soil_test_point_count} onChange={v => update({ soil_test_point_count: v ?? undefined })} />
                </Form.Item>
            )}
        </>
    );

    return (
        <StepFormShell
            stepId={1} title="ถมดิน + บดอัด" titleEn="Earthwork & Compaction"
            result={result} onBack={onBack}
            onSave={() => { if (result) onSave(inp, result); }}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
};
export default Step1Earthwork;
