'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Typography, Button, Card, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { type Step21Input, type BathroomEntry, calcStep21 } from '@/lib/steps/step21';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step21Input;  onBack: () => void; onSave: (inp: Step21Input, res: StepResult) => void; }

type Step21Translator = (key: string, values?: Record<string, string | number | Date>) => string;

const createBathroom = (index: number, t: Step21Translator): BathroomEntry => ({
    label: t('bathroomIndexLabel', { index }),
    width_m: 1.50,
    length_m: 2.00,
    wall_tile_height_m: 2.40,
    door_width_m: 0.70,
    door_height_m: 2.00,
});

const DEFAULTS: Step21Input = {
    bathrooms: [],
    waste_percent: 0,
    waterproof_height_m: 0,
};

export default function Step21BathroomTiling({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step21');
    const [inp, setInp] = useState<Step21Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step21Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const updateBathroom = (index: number, patch: Partial<BathroomEntry>) => {
        setInp(prev => {
            const bathrooms = [...prev.bathrooms];
            bathrooms[index] = { ...bathrooms[index], ...patch } as BathroomEntry;
            return { ...prev, bathrooms };
        });
    };

    const addBathroom = () => {
        setInp(prev => ({
            ...prev,
            bathrooms: [...prev.bathrooms, createBathroom(prev.bathrooms.length + 1, t)]
        }));
    };

    const removeBathroom = (index: number) => {
        setInp(prev => ({
            ...prev,
            bathrooms: prev.bathrooms.filter((_, i) => i !== index)
        }));
    };

    const result = useMemo(() => {
        try {
            return calcStep21(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col">
            {inp.bathrooms.map((b, i) => {
                const floorArea = (b.width_m * b.length_m);
                const perimeter = 2 * (b.width_m + b.length_m);
                const wallArea = Math.max(0, (perimeter * b.wall_tile_height_m) - (b.door_width_m * b.door_height_m));

                return (
                    <Card 
                        key={i} size="small" 
                        style={{ marginBottom: 12, border: '1px solid #ffe4b5' }}
                        title={
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Text strong style={{ fontSize: 13 }}>{b.label}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('areaVal', { floor: floorArea.toFixed(2), wall: wallArea.toFixed(2) })}
                                </Text>
                            </Space>
                        }
                        extra={
                            inp.bathrooms.length > 1 && (
                                <Button type="text" danger size="small" icon={<DeleteOutlined />}
                                    onClick={() => removeBathroom(i)} />
                            )
                        }
                    >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 12 }}>{t('width')}</Text>}
                                tooltip={t('widthTooltip')}
                                style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} max={10} step={0.1} precision={2}
                                    value={b.width_m} onChange={v => updateBathroom(i, { width_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 12 }}>{t('length')}</Text>}
                                tooltip={t('lengthTooltip')}
                                style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} max={10} step={0.1} precision={2}
                                    value={b.length_m} onChange={v => updateBathroom(i, { length_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 12 }}>{t('wallTileHeight')}</Text>}
                                tooltip={t('wallTileTooltip')}
                                style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} max={3.5} step={0.1} precision={2}
                                    value={b.wall_tile_height_m} onChange={v => updateBathroom(i, { wall_tile_height_m: v ?? 2.40 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 12 }}>{t('doorWidth')}</Text>}
                                tooltip={t('doorWidthTooltip')}
                                style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} max={2} step={0.05} precision={2}
                                    value={b.door_width_m} onChange={v => updateBathroom(i, { door_width_m: v ?? 0.70 })} />
                            </Form.Item>
                        </div>
                    </Card>
                );
            })}

            <Button type="dashed" block icon={<PlusOutlined />} onClick={addBathroom}
                style={{ marginBottom: 12 }}>
                {t('addRoomBtn')}
            </Button>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optionsWaste')}</span>} size="small" className="shadow-sm mt-4" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('waterproofHeight')}</Text>} 
                        tooltip={t('waterproofTooltip')}
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} max={3.0} step={0.1} precision={2}
                            value={inp.waterproof_height_m} onChange={v => update({ waterproof_height_m: v ?? 1.80 })} />
                    </Form.Item>
                    <Form.Item layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('waterproofAreaOverride')}</Text>} 
                        tooltip={t('waterproofAreaPh')}
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} step={5} precision={2} placeholder={t('waterproofAreaPh')}
                            value={inp.waterproof_area_m2} onChange={v => update({ waterproof_area_m2: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical"
                        label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} 
                        tooltip={t('wasteTooltip')}
                        style={{ margin: 0, marginBottom: 12 }}
                    >
                        <InputNumber style={{ width: '100%' }} min={0} max={25} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 15 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    /* ── Optional fields ────────────────────────────────────── */
    /* ── Optional fields (Moved to Required Finishes) ────────────────────────────────────── */
    const optional = (
        <>
            
        </>
    );

    return (
        <StepFormShell
            stepId={21} title="ปูกระเบื้องห้องน้ำ" titleEn="Bathroom Tiling"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
}
