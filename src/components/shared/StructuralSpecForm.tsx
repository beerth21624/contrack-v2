import React from 'react';
import { Card, Form, Select, Switch, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { StructuralSpecParams } from '@/lib/engines/structural-engine';

const { Text } = Typography;

interface Props {
    spec: Partial<StructuralSpecParams>;
    onChange: (updates: Partial<StructuralSpecParams>) => void;
    // Provide options to lock/hide certain inputs depending on the step
    hideWorkLevel?: boolean;
    fixedWorkLevel?: 'GRND' | '1FL' | '2FL'; // If provided, user can't change it
    hideWaterproof?: boolean;
    fixedWaterproof?: boolean;
}

export const StructuralSpecForm: React.FC<Props> = ({ spec, onChange, hideWorkLevel, fixedWorkLevel, hideWaterproof, fixedWaterproof }) => {
    const t = useTranslations('boqItems');

    // Default translations or raw texts if missing
    const tKsc = typeof t === 'function' ? 'กำลังอัดคอนกรีต (KSC Cylinder)' : 'Concrete Strength (KSC)';
    const tWp = typeof t === 'function' ? 'ผสมน้ำยากันซึม (+50 บ./คิว)' : 'Waterproofing Admixture';
    const tLevel = typeof t === 'function' ? 'ระดับงาน (คิดค่าแรงเท)' : 'Work Level (Pour Labor)';

    return (
        <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>ข้อมูลจำเพาะงานโครงสร้างหลัก (อ้างอิงราคากลาง)</span>} size="small" className="shadow-sm mt-4" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{tKsc}</Text>} style={{ margin: 0 }}>
                        <Select 
                            value={spec.ksc ?? 240}
                            onChange={v => onChange({ ksc: v })}
                            options={[
                                { value: 'MANUAL', label: '1:2:4 (ผสมเอง) ~180-210 ksc' },
                                { value: 180, label: '180 ksc (ทรงกระบอก)' },
                                { value: 210, label: '210 ksc (ทรงกระบอก)' },
                                { value: 240, label: '240 ksc (ทรงกระบอก) - มาตรฐาน' },
                                { value: 280, label: '280 ksc (ทรงกระบอก)' },
                                { value: 300, label: '300 ksc (ทรงกระบอก)' },
                                { value: 320, label: '320 ksc (ทรงกระบอก)' },
                                { value: 350, label: '350 ksc (ทรงกระบอก)' },
                            ]} 
                        />
                    </Form.Item>

                    {(!hideWorkLevel || fixedWorkLevel) && (
                        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{tLevel}</Text>} style={{ margin: 0 }}>
                            <Select 
                                value={fixedWorkLevel ?? (spec.workLevel ?? '1FL')}
                                onChange={v => onChange({ workLevel: v })}
                                disabled={!!fixedWorkLevel}
                                options={[
                                    { value: 'GRND', label: 'งานภาคพื้นดิน (ถูกสุด)' },
                                    { value: '1FL', label: 'งานโครงสร้างชั้นเดียว' },
                                    { value: '2FL', label: 'งานโครงสร้าง 2 ชั้นขึ้นไป (แพง)' },
                                ]} 
                            />
                        </Form.Item>
                    )}
                </div>

                {(!hideWaterproof || fixedWaterproof !== undefined) && (
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{tWp}</Text>} style={{ margin: 0 }}>
                        <Switch 
                            checked={fixedWaterproof ?? !!spec.waterproof}
                            disabled={fixedWaterproof !== undefined}
                            onChange={v => onChange({ waterproof: v })}
                            checkedChildren="ใส่" unCheckedChildren="ไม่ใส่" 
                        />
                    </Form.Item>
                )}
            </div>
        </Card>
    );
};
