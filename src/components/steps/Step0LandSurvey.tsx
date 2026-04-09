'use client';

import { useState, useMemo, useCallback } from "react";
import { InputNumber, Switch, Select, Form, Typography } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { calcStep0 } from '@/lib/steps';
import type { Step0Input, StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step0Input;  onSave: (inp: Step0Input, res: StepResult) => void; onBack: () => void; }

const DEFAULT: Step0Input = {
    land_area_m2: 0,
    boundary_length_m: 0,
    benchmark_count: 2,
    survey_crew_count: 1,
    waste_percent: 0,
    topo_required: false,
    equipment_type: 'total_station',
    photo_documentation: true,
};

export const Step0LandSurvey: React.FC<Props> = ({ onSave, onBack, initialData }) => {
    const [inp, setInp] = useState<Step0Input>(initialData ?? DEFAULT);
    const t = useTranslations('steps.step0');
    const update = useCallback((patch: Partial<Step0Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep0(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <>
            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('landArea')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={10} precision={0}
                    value={inp.land_area_m2} onChange={v => update({ land_area_m2: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('boundaryLength')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} precision={0}
                    value={inp.boundary_length_m} onChange={v => update({ boundary_length_m: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('bmCount')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={1}
                    value={inp.benchmark_count} onChange={v => update({ benchmark_count: v ?? 2 })} />
            </Form.Item>
            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('surveyCrew')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={5} step={1}
                    value={inp.survey_crew_count} onChange={v => update({ survey_crew_count: v ?? 1 })} />
            </Form.Item>
            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                    value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 0 })} />
            </Form.Item>
        </>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('equipType')}</Text>} style={{ margin: 0 }}>
                <Select value={inp.equipment_type} onChange={v => update({ equipment_type: v })}
                    options={[
                        { value: 'none', label: t('equipNone') },
                        { value: 'total_station', label: t('equipTs') },
                        { value: 'gps_rtk', label: t('equipGps') },
                        { value: 'level_only', label: t('equipLevel') },
                    ]} />
            </Form.Item>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('existingMarkers')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} placeholder={t('markerPh')}
                    value={inp.existing_boundary_markers} onChange={v => update({ existing_boundary_markers: v ?? undefined })} />
            </Form.Item>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('topoRequired')}</Text>} style={{ margin: 0 }}>
                <Switch checked={inp.topo_required} onChange={v => update({ topo_required: v })}
                    checkedChildren={t('do')} unCheckedChildren={t('dont')} />
            </Form.Item>
            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('photoDoc')}</Text>} style={{ margin: 0 }}>
                <Switch checked={inp.photo_documentation} onChange={v => update({ photo_documentation: v })}
                    checkedChildren={t('photoYes')} unCheckedChildren={t('photoNo')} />
            </Form.Item>
        </>
    );

    return (
        <StepFormShell
            stepId={0} title="ตรวจสอบที่ดิน / หมุดหลัก" titleEn="Land Survey & Benchmark"
            result={result} onBack={onBack}
            onSave={() => { if (result) onSave(inp, result); }}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
};

export default Step0LandSurvey;
