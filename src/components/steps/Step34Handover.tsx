'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Switch, Typography, Alert, Space, Tag, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step34Input, calcStep34 } from '@/lib/steps/step34';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step34Input;  onBack: () => void; onSave: (inp: Step34Input, res: StepResult) => void; }

const DEFAULTS: Step34Input = {
    document_set_count: 0, warranty_years: 0, key_set_count: 0,
    has_asbuilt_drawing: false, has_equipment_manual: false,
    has_warranty_cert: false, has_photo_record: false,
    handover_training: false,
    big_cleaning_required: false, building_area_m2: 0,
};

export default function Step34Handover({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step34');
    const [inp, setInp] = useState<Step34Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step34Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const toggle = (label: string, field: keyof Step34Input, emoji: string) => (
        <Form.Item label={<Text style={{ fontSize: 13 }}>{emoji} {label}</Text>} style={{ margin: 0 }}>
            <Switch checked={inp[field] as boolean} onChange={v => update({ [field]: v })}
                checkedChildren={t('deliver')} unCheckedChildren={t('doNotDeliver')} />
        </Form.Item>
    );

    const result = useMemo(() => {
        try {
            return calcStep34(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Space style={{ marginBottom: 0 }} wrap>
                <Tag color="green">{t('handoverTag')}</Tag>
                <Tag color="blue">{t('keySetTag', { val: inp.key_set_count })}</Tag>
                <Tag color="orange">{t('docSetTag', { val: inp.document_set_count })}</Tag>
            </Space>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card1Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('asbuiltDocs')}</Text>}
                        tooltip={t('asbuiltDocsTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.document_set_count} onChange={v => update({ document_set_count: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('keySets')}</Text>}
                        tooltip={t('keySetsTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.key_set_count} onChange={v => update({ key_set_count: v ?? 0 })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {toggle(t('asbuiltDrawing'), 'has_asbuilt_drawing', '')}
                    {toggle(t('equipmentManual'), 'has_equipment_manual', '')}
                    {toggle(t('warrantyCert'), 'has_warranty_cert', '')}
                    {toggle(t('photoRecord'), 'has_photo_record', '')}
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card2Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('warrantyYears')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={5} step={1}
                            value={inp.warranty_years} onChange={v => update({ warranty_years: v ?? 1 })} />
                    </Form.Item>
                    <div style={{ marginTop: 24 }}>
                        {toggle(t('training'), 'handover_training', '')}
                    </div>
                </div>
            </Card>
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('cleaningMain')}</span>} size="small" className="shadow-sm mt-4" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div style={{ marginTop: 24 }}>
                        {toggle(t('bigCleaning'), 'big_cleaning_required', '')}
                    </div>
                    {inp.big_cleaning_required && (
                        <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('buildingArea')}</Text>}
                            tooltip={t('buildingAreaTooltip')} style={{ margin: 0 }}>
                            <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={10} precision={2}
                                value={inp.building_area_m2} onChange={v => update({ building_area_m2: v ?? 0 })} />
                        </Form.Item>
                    )}
                </div>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optCardMain')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('punchList')}</Text>}
                    tooltip={t('punchListTooltip')} style={{ margin: 0 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                        value={inp.punch_list_remaining ?? 0} onChange={v => update({ punch_list_remaining: v ?? 0 })} />
                </Form.Item>
            </Card>

            
            {result?.qc_flags && result.qc_flags.length > 0 && (
                <div style={{ marginTop: 8 }}>
                    <Alert type="success" showIcon title={
                        <div><Text strong style={{ fontSize: 12 }}>{t('checklistTitle')}</Text>
                            <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 12 }}>
                                {result.qc_flags.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                        </div>
                    } />
                </div>
            )}
        </div>
    );

    return (
        <StepFormShell stepId={34} title="ส่งมอบงาน" titleEn="Project Handover"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
