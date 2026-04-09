'use client';

import { useState, useMemo, useCallback } from "react";
import { InputNumber, Form, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { calcStep4 } from '@/lib/steps';
import type { Step4Input, StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step4Input;  onSave: (inp: Step4Input, res: StepResult) => void; onBack: () => void; }

const DEFAULT: Step4Input = {
    building_width_m: 0, building_length_m: 0, number_of_columns: 0, waste_percent: 0,
    offset_distance_m: 0, profile_board_height_m: 0, profile_board_spacing_m: 0,
};

export const Step4Layout: React.FC<Props> = ({ onSave, onBack, initialData }) => {
    const [inp, setInp] = useState<Step4Input>(initialData ?? DEFAULT);
    const t = useTranslations('steps.step4');
    const update = useCallback((patch: Partial<Step4Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const result = useMemo(() => {
        try {
            return calcStep4(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('bldgWidth')}</Text>} 
                tooltip={t('bldgWidthTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.5} precision={2}
                    value={inp.building_width_m} onChange={v => update({ building_width_m: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('bldgLength')}</Text>} 
                tooltip={t('bldgLengthTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.5} precision={2}
                    value={inp.building_length_m} onChange={v => update({ building_length_m: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('colCount')}</Text>} 
                tooltip={t('colCountTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                    value={inp.number_of_columns} onChange={v => update({ number_of_columns: v ?? 0 })} />
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
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleProfile')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('offset')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={3} step={0.5} placeholder={t('offsetPh')}
                            value={inp.offset_distance_m} onChange={v => update({ offset_distance_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('boardHeight')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={1.5} step={0.1} placeholder={t('boardHeightPh')}
                            value={inp.profile_board_height_m} onChange={v => update({ profile_board_height_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('postSpacing')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={3} step={0.5} placeholder={t('postSpacingPh')}
                            value={inp.profile_board_spacing_m} onChange={v => update({ profile_board_spacing_m: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('stringMulti')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={4} step={0.25} precision={2} placeholder={t('stringMultiPh')}
                            value={inp.string_multiplier} onChange={v => update({ string_multiplier: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleSurvey')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('surveyDays')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={1} placeholder={t('surveyDaysPh')}
                            value={inp.survey_crew_days} onChange={v => update({ survey_crew_days: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('diag')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.001} precision={3} placeholder={t('diagPh')}
                            value={inp.measured_diagonal_m} onChange={v => update({ measured_diagonal_m: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('markerCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} placeholder={t('markerCountPh')}
                            value={inp.concrete_marker_count} onChange={v => update({ concrete_marker_count: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('sprayCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={1} placeholder={t('sprayCountPh')}
                            value={inp.spray_paint_can_count} onChange={v => update({ spray_paint_can_count: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    return (
        <StepFormShell
            stepId={4} title="วางผัง / ปักหมุด" titleEn="Site Layout"
            result={result} onBack={onBack}
            onSave={() => { if (result) onSave(inp, result); }}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
};
export default Step4Layout;
