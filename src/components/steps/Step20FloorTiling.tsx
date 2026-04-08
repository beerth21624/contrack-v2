'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Typography, Card, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { type Step20Input, type FloorRoomEntry, calcStep20 } from '@/lib/steps/step20';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step20Input;  onBack: () => void; onSave: (inp: Step20Input, res: StepResult) => void; }

interface Step20Translator {
    (key: string, values?: Record<string, string | number | Date>): string;
    has: (key: string) => boolean;
}

const createRoom = (index: number, t: Step20Translator): FloorRoomEntry => ({
    label: t.has(`roomPresets.${['living', 'bed1', 'bed2', 'kitchen', 'balcony'][index - 1]}`) ? t(`roomPresets.${['living', 'bed1', 'bed2', 'kitchen', 'balcony'][index - 1]}`) : t('roomIndexLabel', { index }),
    width_m: 4.00, length_m: 5.00, tile_size: '60x60',
});

const DEFAULTS: Step20Input = {
    rooms: [],
    laying_pattern: 'straight', waste_percent: 0,
};

export default function Step20FloorTiling({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step20');
    const [inp, setInp] = useState<Step20Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step20Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const updateRoom = (index: number, patch: Partial<FloorRoomEntry>) => {
        setInp(prev => {
            const rooms = [...prev.rooms];
            rooms[index] = { ...rooms[index], ...patch } as FloorRoomEntry;
            return { ...prev, rooms };
        });
    };

    const addRoom = () => {
        setInp(prev => ({
            ...prev,
            rooms: [...prev.rooms, createRoom(prev.rooms.length + 1, t)]
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
            return calcStep20(inp);
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
                            <Text strong style={{ fontSize: 13 }}>{r.label}</Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>{t('areaTileVal', { area: area.toFixed(2), size: r.tile_size.split('x')[0] ?? '' })}</Text>
                        </Space>}
                        extra={inp.rooms.length > 1 && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRoom(i)} />}
                    >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('width')}</Text>}
                                tooltip={t('widthTooltip')} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={2} size="small"
                                    value={r.width_m} onChange={v => updateRoom(i, { width_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('length')}</Text>} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={2} size="small"
                                    value={r.length_m} onChange={v => updateRoom(i, { length_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('tileSize')}</Text>}
                                tooltip={t('tileSizeTooltip')} style={{ margin: 0 }}>
                                <Select size="small" value={r.tile_size} onChange={v => updateRoom(i, { tile_size: v })}
                                    options={[
                                        { value: '30x30', label: '30×30' }, { value: '40x40', label: '40×40' },
                                        { value: '60x60', label: '60×60' }, { value: '80x80', label: '80×80' },
                                        { value: '100x100', label: '100×100' },
                                    ]} />
                            </Form.Item>
                        </div>
                    </Card>
                );
            })}
            <Button type="dashed" block icon={<PlusOutlined />} onClick={addRoom} style={{ marginBottom: 12 }}>{t('addRoomBtn')}</Button>
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optionsWaste')}</span>} size="small" className="shadow-sm mt-4" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('layingPattern')}</Text>}
                        tooltip={t('patternTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <Select value={inp.laying_pattern} onChange={v => update({ laying_pattern: v })}
                            options={[
                                { value: 'straight', label: t('patternStraight') },
                                { value: 'diagonal', label: t('patternDiagonal') },
                            ]} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={25} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('skirting')}</Text>}
                tooltip={t('skirtingTooltip')} style={{ margin: 0 }}>
                <InputNumber style={{ width: '100%' }} min={0} step={5}
                    value={inp.skirting_length_m} onChange={v => update({ skirting_length_m: v ?? undefined })} />
            </Form.Item>
            
        </>
    );

    return (
        <StepFormShell stepId={20} title="ปูกระเบื้องพื้น" titleEn="Floor Tiling"
            result={result} onBack={onBack} onSave={() => result && onSave(inp, result)} optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
