'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Typography, Card, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { type Step31Input, type WoodDWEntry, calcStep31 } from '@/lib/steps/step31';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step31Input;  onBack: () => void; onSave: (inp: Step31Input, res: StepResult) => void; }

const createWoodItem = (index: number, type: 'door' | 'window'): WoodDWEntry => ({
    label: type === 'door' ? `WD${index}` : `WW${index}`,
    type,
    count: 1,
    width_m: type === 'door' ? 0.90 : 1.00,
    height_m: type === 'door' ? 2.00 : 1.20,
});

const DEFAULTS: Step31Input = {
    items: [],
    waste_percent: 0,
    frame_type: 'engineered',
    has_door_lock: true,
};

export default function Step31WoodDoorWindow({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step31');
    const [inp, setInp] = useState<Step31Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step31Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const updateItem = (index: number, patch: Partial<WoodDWEntry>) => {
        setInp(prev => {
            const items = [...prev.items];
            items[index] = { ...items[index], ...patch } as WoodDWEntry;
            return { ...prev, items };
        });
    };

    const addItem = (type: 'door' | 'window') => {
        setInp(prev => ({
            ...prev,
            items: [...prev.items, createWoodItem(prev.items.length + 1, type)]
        }));
    };

    const removeItem = (index: number) => {
        setInp(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const result = useMemo(() => {
        try {
            return calcStep31(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card1Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                {inp.items.map((item, i) => (
                    <Card key={i} size="small" style={{ marginBottom: 12, border: '1px solid #ffe4b5' }}
                        title={
                            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Text strong style={{ fontSize: 13 }}>
                                    {item.label}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('doorTag', { count: item.count, w: item.width_m, h: item.height_m })}
                                </Text>
                            </Space>
                        }
                        extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(i)} />}
                    >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('type')}</Text>} style={{ margin: 0 }}>
                                <Select size="small" value={item.type}
                                    onChange={v => updateItem(i, { type: v })}
                                    options={[
                                        { value: 'door', label: t('doorOption') },
                                        { value: 'window', label: t('windowOption') },
                                    ]} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('count')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} size="small"
                                    value={item.count} onChange={v => updateItem(i, { count: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('width')}</Text>}
                                tooltip={t('widthTooltip')} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.10} precision={2} size="small"
                                    value={item.width_m} onChange={v => updateItem(i, { width_m: v ?? 0.90 })} />
                            </Form.Item>
                            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('height')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.10} precision={2} size="small"
                                    value={item.height_m} onChange={v => updateItem(i, { height_m: v ?? 2.00 })} />
                            </Form.Item>
                        </div>
                    </Card>
                ))}

                <Space style={{ marginBottom: 0 }}>
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => addItem('door')}>{t('addDoor')}</Button>
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => addItem('window')}>{t('addWindow')}</Button>
                </Space>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card2Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('frameType')}</Text>}
                        tooltip={t('frameTooltip')} style={{ margin: 0 }}>
                        <Select value={inp.frame_type}
                            onChange={v => update({ frame_type: v })}
                            options={[
                                { value: 'teak', label: t('teak') },
                                { value: 'hardwood', label: t('hardwood') },
                                { value: 'pine', label: t('pine') },
                                { value: 'engineered', label: t('engineered') },
                                { value: 'wpc', label: t('wpc') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wastePercent')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 0 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            
        </div>
    );

    return (
        <StepFormShell stepId={31} title="ประตู–หน้าต่างไม้" titleEn="Wooden Doors & Windows"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
