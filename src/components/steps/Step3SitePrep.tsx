'use client';

import { useState, useMemo, useCallback } from "react";
import { InputNumber, Switch, Select, Form, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { calcStep3 } from '@/lib/steps';
import type { Step3Input, StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step3Input;  onSave: (inp: Step3Input, res: StepResult) => void; onBack: () => void; }

const DEFAULT: Step3Input = {
    site_width_m: 0, site_length_m: 0, number_of_workers: 0, waste_percent: 0,
    fence_type: 'zinc', site_sign: false,
};

export const Step3SitePrep: React.FC<Props> = ({ onSave, onBack, initialData }) => {
    const [inp, setInp] = useState<Step3Input>(initialData ?? DEFAULT);
    const t = useTranslations('steps.step3');
    const update = useCallback((patch: Partial<Step3Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep3(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('siteWidth')}</Text>} 
                tooltip={t('siteWidthTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} precision={1}
                    value={inp.site_width_m} onChange={v => update({ site_width_m: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('siteLength')}</Text>} 
                tooltip={t('siteLengthTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} precision={1}
                    value={inp.site_length_m} onChange={v => update({ site_length_m: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('peakWorkers')}</Text>} 
                tooltip={t('peakWorkersTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                    value={inp.number_of_workers} onChange={v => update({ number_of_workers: v ?? 4 })} />
            </Form.Item>
            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={30} step={1}
                    value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
            </Form.Item>
        </>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleFencing')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('fenceType')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <Select value={inp.fence_type} onChange={v => update({ fence_type: v })}
                        options={[
                            { value: 'zinc', label: t('fenceZinc') },
                            { value: 'mesh', label: t('fenceMesh') },
                            { value: 'concrete_block', label: t('fenceConcrete') },
                        ]} />
                </Form.Item>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('fenceHeight')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={3} step={0.5} precision={1} placeholder={t('fenceHeightPh')}
                        value={inp.fence_height_m} onChange={v => update({ fence_height_m: v ?? undefined })} />
                </Form.Item>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('gateCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={4} step={1}
                            value={inp.gate_count} onChange={v => update({ gate_count: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('gateWidth')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={8} step={0.5} placeholder={t('gateWidthPh')}
                            value={inp.gate_width_m} onChange={v => update({ gate_width_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('roadLength')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} placeholder={t('roadLengthPh')}
                            value={inp.access_road_length_m} onChange={v => update({ access_road_length_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('roadWidth')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={8} step={0.5} placeholder={t('roadWidthPh')}
                            value={inp.access_road_width_m} onChange={v => update({ access_road_width_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarArea')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} placeholder={t('rebarAreaPh')}
                        value={inp.rebar_work_area_m2} onChange={v => update({ rebar_work_area_m2: v ?? undefined })} />
                </Form.Item>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('storageRatio')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={0.5} step={0.05} precision={2} placeholder={t('storageRatioPh')}
                            value={inp.storage_ratio} onChange={v => update({ storage_ratio: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('drainRatio')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={0.75} step={0.05} precision={2} placeholder={t('drainRatioPh')}
                            value={inp.drain_ratio} onChange={v => update({ drain_ratio: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleCamp')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('toiletCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={1} placeholder={t('toiletCountPh')}
                        value={inp.toilet_count} onChange={v => update({ toilet_count: v ?? undefined })} />
                </Form.Item>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('duration')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={36} step={1} placeholder={t('durationPh')}
                        value={inp.construction_duration_months} onChange={v => update({ construction_duration_months: v ?? undefined })} />
                </Form.Item>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('areaPerWorker')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={5} step={0.5} precision={1} placeholder={t('areaPerWorkerPh')}
                        value={inp.area_per_worker_m2} onChange={v => update({ area_per_worker_m2: v ?? undefined })} />
                </Form.Item>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('safetySigns')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                        value={inp.safety_signs_count} onChange={v => update({ safety_signs_count: v ?? undefined })} />
                </Form.Item>
                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('siteSign')}</Text>} style={{ margin: 0 }}>
                    <Switch checked={inp.site_sign} onChange={v => update({ site_sign: v })}
                        checkedChildren={t('siteSignYes')} unCheckedChildren={t('siteSignNo')} />
                </Form.Item>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>ค่าขนย้ายและรื้อถอน (Mobilization)</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>ขนย้ายเครื่องจักรเข้า (ครั้ง)</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} placeholder="0"
                            value={inp.mobilization_trips} onChange={v => update({ mobilization_trips: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>ขนย้ายออก/รื้อถอน (ครั้ง)</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} placeholder="0"
                            value={inp.demobilization_trips} onChange={v => update({ demobilization_trips: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    return (
        <StepFormShell
            stepId={3} title="เตรียมพื้นที่หน้างาน" titleEn="Site Preparation"
            result={result} onBack={onBack}
            onSave={() => { if (result) onSave(inp, result); }}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
};
export default Step3SitePrep;
