'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Typography, Card, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { type Step24Input, type DoorWindowEntry, calcStep24 } from '@/lib/steps/step24';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step24Input;  onBack: () => void; onSave: (inp: Step24Input, res: StepResult) => void; }

const createItem = (index: number, type: 'door' | 'window' | 'sliding_door' | 'fixed'): DoorWindowEntry => ({
    label: `ADW${index}`,
    type,
    count: 1,
    width_m: type.includes('door') ? 0.90 : 1.20,
    height_m: type.includes('door') ? 2.00 : 1.10,
});

const DEFAULTS: Step24Input = {
    items: [],
    waste_percent: 0,
    glass_thickness_mm: 0,
};

export default function Step24AlumDoorWindow({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step24');
    const [inp, setInp] = useState<Step24Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step24Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const updateItem = (index: number, patch: Partial<DoorWindowEntry>) => {
        setInp(prev => {
            const items = [...prev.items];
            items[index] = { ...items[index], ...patch } as DoorWindowEntry;
            return { ...prev, items };
        });
    };

    const addItem = (type: 'door' | 'window' | 'sliding_door' | 'fixed') => {
        setInp(prev => ({
            ...prev,
            items: [...prev.items, createItem(prev.items.length + 1, type)]
        }));
    };

    const removeItem = (index: number) => {
        setInp(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };


    const typeIcons: Record<string, string> = {
        door: '🚪', window: '🖼️', sliding_door: '↔️', fixed: '⏹️'
    };

    const result = useMemo(() => {
        try {
            return calcStep24(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col">
            {inp.items.map((item, i) => {
                const area = item.count * item.width_m * item.height_m;
                return (
                    <Card key={i} size="small" style={{ marginBottom: 12, border: '1px solid #ffe4b5' }}
                        title={
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Text strong style={{ fontSize: 13 }}>{typeIcons[item.type]} {item.label}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {item.count}×{item.width_m}×{item.height_m} {t('itemAreaVal')} {area.toFixed(2)} ม²
                                </Text>
                            </Space>
                        }
                        extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(i)} />}
                    >
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('itemType')}</Text>}
                                tooltip={t('typeTooltip')} style={{ margin: 0 }}>
                                <Select size="small" value={item.type} onChange={v => updateItem(i, { type: v })}
                                    options={[
                                        { value: 'door', label: t('types.door') },
                                        { value: 'window', label: t('types.window') },
                                        { value: 'sliding_door', label: t('types.sliding_door') },
                                        { value: 'fixed', label: t('types.fixed') },
                                    ]} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('count')}</Text>} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={1} size="small"
                                    value={item.count} onChange={v => updateItem(i, { count: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('width')}</Text>}
                                tooltip={t('widthTooltip')} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={0.10} precision={2} size="small"
                                    value={item.width_m} onChange={v => updateItem(i, { width_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('height')}</Text>} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={0.10} precision={2} size="small"
                                    value={item.height_m} onChange={v => updateItem(i, { height_m: v ?? 1 })} />
                            </Form.Item>
                        </div>
                    </Card>
                );
            })}

            <Space style={{ marginBottom: 12 }}>
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => addItem('door')}>{t('addDoorBtn')}</Button>
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => addItem('window')}>{t('addWindowBtn')}</Button>
            </Space>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optionsWaste')}</span>} size="small" className="shadow-sm mt-4" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('glassThickness')}</Text>} style={{ margin: 0 }}>
                        <Select value={inp.glass_thickness_mm} onChange={v => update({ glass_thickness_mm: v })}
                            options={[
                                { value: 0, label: t('glassOptions.0') },
                                { value: 5, label: t('glassOptions.5') },
                                { value: 6, label: t('glassOptions.6') },
                                { value: 8, label: t('glassOptions.8') },
                                { value: 10, label: t('glassOptions.10') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={20} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('sealantLength')}</Text>}
                tooltip={t('sealantTooltip')} style={{ margin: 0 }}>
                <InputNumber style={{ width: '100%' }} min={0} step={5}
                    value={inp.sealant_length_m} onChange={v => update({ sealant_length_m: v ?? undefined })} />
            </Form.Item>
            
        </>
    );

    return (
        <StepFormShell stepId={24} title="ประตู-หน้าต่าง อลูมิเนียม" titleEn="Aluminium Doors & Windows"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
