'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Switch, Typography, Card, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { StepFormShell } from '../StepFormShell';
import { type Step18Input, type PlasterRoomEntry, calcStep18 } from '@/lib/steps/step18';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step18Input;  onBack: () => void; onSave: (inp: Step18Input, res: StepResult) => void; }

interface Step18Translator {
    (key: string, values?: Record<string, string | number | Date>): string;
    has: (key: string) => boolean;
}

const createRoom = (index: number, loc: 'interior' | 'exterior', t: Step18Translator): PlasterRoomEntry => ({
    label: loc === 'exterior' ? t('extWallIndex', { index }) : (t.has(`defaultRooms.${['living', 'bed1', 'bed2', 'kitchen'][index - 1]}`) ? t(`defaultRooms.${['living', 'bed1', 'bed2', 'kitchen'][index - 1]}`) : t('intRoomIndex', { index })),
    width_m: loc === 'exterior' ? 8.00 : 4.00,
    length_m: loc === 'exterior' ? 0.01 : 5.00,  // ผนังนอก: ใช้ length เป็น 0 (ไม่มี "ยาว" แค่เส้นเดียว)
    wall_height_m: 2.70,
    opening_area_m2: loc === 'exterior' ? 3 : 2,
    location: loc,
});

const DEFAULTS: Step18Input = {
    rooms: [],
    skim_coat_interior: false, skim_coat_exterior: false, waste_percent: 0,
};

export default function Step18Plastering({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step18');
    const [inp, setInp] = useState<Step18Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step18Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const updateRoom = (index: number, patch: Partial<PlasterRoomEntry>) => {
        setInp(prev => {
            const rooms = [...prev.rooms];
            rooms[index] = { ...rooms[index], ...patch } as PlasterRoomEntry;
            return { ...prev, rooms };
        });
    };

    const addRoom = (loc: 'interior' | 'exterior') => {
        setInp(prev => ({
            ...prev,
            rooms: [...prev.rooms, createRoom(prev.rooms.length + 1, loc, t)]
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
            return calcStep18(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col">
            {inp.rooms.map((r, i) => {
                const perimeter = 2 * (r.width_m + r.length_m);
                const wallArea = Math.max(0, perimeter * r.wall_height_m - r.opening_area_m2);
                return (
                    <Card key={i} size="small" style={{ marginBottom: 12, border: r.location === 'exterior' ? '1px solid #87ceeb' : '1px solid #ffe4b5' }}
                        title={<Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text strong style={{ fontSize: 13 }}>
                                {r.location === 'exterior' ? t('tagExt') : t('tagInt')} {r.label}
                                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                                    ({r.location === 'exterior' ? t('labelExt') : t('labelInt')})
                                </Text>
                            </Text>
                            <Text type="secondary" style={{ fontSize: 11 }}>{t('plasterAreaVal', { val: wallArea.toFixed(2) })}</Text>
                        </Space>}
                        extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRoom(i)} />}
                    >
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('width')}</Text>}
                                tooltip={t('widthTooltip')} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={2} size="small"
                                    value={r.width_m} onChange={v => updateRoom(i, { width_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('length')}</Text>} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={2} size="small"
                                    value={r.length_m} onChange={v => updateRoom(i, { length_m: v ?? 1 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('height')}</Text>}
                                tooltip={t('heightTooltip')} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} max={6} step={0.1} precision={2} size="small"
                                    value={r.wall_height_m} onChange={v => updateRoom(i, { wall_height_m: v ?? 2.70 })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 11 }}>{t('openings')}</Text>}
                                tooltip={t('openingsTooltip')} style={{ margin: 0 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={2} size="small"
                                    value={r.opening_area_m2} onChange={v => updateRoom(i, { opening_area_m2: v ?? 0 })} />
                            </Form.Item>
                        </div>
                    </Card>
                );
            })}

            <Space style={{ marginBottom: 12 }}>
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => addRoom('interior')}>{t('addIntBtn')}</Button>
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => addRoom('exterior')}>{t('addExtBtn')}</Button>
            </Space>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optionsWaste')}</span>} size="small" className="shadow-sm mt-4" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('skimInt')}</Text>}
                        tooltip={t('skimIntTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.skim_coat_interior} onChange={v => update({ skim_coat_interior: v })}
                            checkedChildren={t('skimYes')} unCheckedChildren={t('skimNo')} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('skimExt')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.skim_coat_exterior} onChange={v => update({ skim_coat_exterior: v })}
                            checkedChildren={t('skimYes')} unCheckedChildren={t('skimNo')} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                    <InputNumber style={{ width: '100%' }} min={0} max={20} step={1}
                        value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                </Form.Item>
            </Card>
        </div>
    );

    const optional = (
        <>
            
        </>
    );

    return (
        <StepFormShell stepId={18} title="ฉาบปูน" titleEn="Plastering"
            result={result} onBack={onBack} onSave={() => result && onSave(inp, result)} optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
