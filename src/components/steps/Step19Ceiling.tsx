'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Card, Button, Space, Dropdown } from 'antd';

import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { type Step19Input, type CeilingRoomEntry, calcStep19 } from '@/lib/steps/step19';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step19Input;  onBack: () => void; onSave: (inp: Step19Input, res: StepResult) => void; }

// Room presets replaced by Dropdown menu

const DEFAULTS: Step19Input = {
    rooms: [],
    ceiling_type: 'gypsum', waste_percent: 0,
};

export default function Step19Ceiling({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step19');
    const [inp, setInp] = useState<Step19Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step19Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const updateRoom = (index: number, patch: Partial<CeilingRoomEntry>) => {
        setInp(prev => {
            const rooms = [...prev.rooms];
            rooms[index] = { ...rooms[index], ...patch } as CeilingRoomEntry;
            return { ...prev, rooms };
        });
    };

    const addRoom = (label: string) => {
        setInp(prev => ({
            ...prev,
            rooms: [...prev.rooms, { label, width_m: 3, length_m: 3, has_drop_ceiling: false, drop_area_m2: 0 }]
        }));
    };

    const removeRoom = (index: number) => {
        setInp(prev => ({
            ...prev,
            rooms: prev.rooms.filter((_, i) => i !== index)
        }));
    };

    const result = useMemo(() => {
        try {
            return calcStep19(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col">
            {inp.rooms.map((r, i) => {
                const area = r.width_m * r.length_m;
                return (
                    <Card key={i} size="small" style={{ marginBottom: 12, border: '1px solid #ffe4b5' }}
                        title={<Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text strong style={{ fontSize: 13 }}>{t.has(`roomTypes.${r.label}`) ? t(`roomTypes.${r.label}`) : r.label}</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>{t('ceilingAreaVal', { val: area.toFixed(2) })}{r.has_drop_ceiling ? ` + Drop ${r.drop_area_m2} ม²` : ''}</Text>
                        </Space>}
                        extra={inp.rooms.length > 1 && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRoom(i)} />}
                    >
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('width')}</Text>}
                                tooltip={t('widthTooltip')} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.5} precision={2} size="small"
                                    value={r.width_m} onChange={v => updateRoom(i, { width_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('length')}</Text>} style={{ margin: 0 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.5} precision={2} size="small"
                                    value={r.length_m} onChange={v => updateRoom(i, { length_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('dropCeiling')}</Text>}
                                tooltip={t('dropTooltip')} style={{ margin: 0 }}>
                                <Switch size="small" checked={r.has_drop_ceiling}
                                    onChange={v => updateRoom(i, { has_drop_ceiling: v, drop_area_m2: v ? area * 0.3 : 0 })} />
                            </Form.Item>
                            {r.has_drop_ceiling && (
                                <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('dropArea')}</Text>} style={{ margin: 0 }}>
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} precision={2} size="small"
                                        value={r.drop_area_m2} onChange={v => updateRoom(i, { drop_area_m2: v ?? 0 })} />
                                </Form.Item>
                            )}
                        </div>
                    </Card>
                );
            })}
            <Dropdown
                menu={{
                    items: [
                        { key: 'living', label: t('roomTypes.living') },
                        { key: 'bedroom', label: t('roomTypes.bedroom') },
                        { key: 'kitchen', label: t('roomTypes.kitchen') },
                        { key: 'bathroom', label: t('roomTypes.bathroom') },
                        { key: 'hallway', label: t('roomTypes.hallway') },
                        { type: 'divider' },
                        { key: 'balcony', label: t('roomTypes.balcony') },
                        { key: 'eaves', label: t('roomTypes.eaves') },
                        { key: 'washing', label: t('roomTypes.washing') },
                        { type: 'divider' },
                        { key: 'other', label: t('roomTypes.other') },
                    ],
                    onClick: (e) => addRoom(e.key)
                }}
                placement="bottom"
            >
                <Button type="dashed" block icon={<PlusOutlined />} style={{ marginBottom: 12 }}>{t('addRoomBtn')}</Button>
            </Dropdown>
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optionsWaste')}</span>} size="small" className="shadow-sm mt-4" styles={{ header: { minHeight: 'auto', padding: '8px 12px' } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('ceilingType')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.ceiling_type} onChange={v => update({ ceiling_type: v })}
                            options={[
                                { value: 'gypsum', label: t('typeGypsum') },
                                { value: 'gypsum_moisture', label: t('typeGypsumMoist') },
                                { value: 'gypsum_fire', label: t('typeGypsumFire') },
                                { value: 'fiber_cement', label: t('typeFiber') },
                                { value: 'fiber_cement_6', label: t('typeFiber6') },
                                { value: 'calcium_silicate', label: t('typeCalcium') },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={25} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cornice')}</Text>}
                tooltip={t('corniceTooltip')} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5}
                    value={inp.cornice_length_m} onChange={v => update({ cornice_length_m: v ?? undefined })} />
            </Form.Item>

        </>
    );

    return (
        <StepFormShell stepId={19} title="ปิดฝ้าเพดาน" titleEn="Ceiling Works"
            result={result} onBack={onBack} onSave={() => result && onSave(inp, result)} optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
