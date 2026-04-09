'use client';

import { useState, useMemo, useCallback } from "react";
import { InputNumber, Select, Switch, Form, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { calcStep5 } from '@/lib/steps';
import { type Step5Input, type StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step5Input;  onSave: (inp: Step5Input, res: StepResult) => void; onBack: () => void; }

const DEFAULT: Step5Input = {
    pile_type: 'driven', number_of_piles: 0, pile_length_m: 0, waste_percent: 0,
    pile_head_cut_required: false, mobilization_days: 0, load_test_count: 0,
};

export const Step5Piling: React.FC<Props> = ({ onSave, onBack, initialData }) => {
    const [inp, setInp] = useState<Step5Input>(initialData ?? DEFAULT);
    const t = useTranslations('steps.step5');
    const update = useCallback((patch: Partial<Step5Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const isBored = inp.pile_type === 'bored';

    const result = useMemo(() => {
        try {
            return calcStep5(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('pileType')}</Text>} 
                tooltip={t('pileTypeTooltip')}
                style={{ margin: 0 }}
            >
                <Select value={inp.pile_type}
                    onChange={v => update({ pile_type: v, pile_diameter_m: undefined, pile_section_cm: undefined })}
                    options={[
                        { value: 'driven', label: t('typeDriven') },
                        { value: 'bored', label: t('typeBored') },
                    ]} />
            </Form.Item>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('pileCount')}</Text>} 
                tooltip={t('pileCountTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber style={{ width: '100%' }} min={0} step={1}
                    value={inp.number_of_piles} onChange={v => update({ number_of_piles: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('pileLength')}</Text>} 
                tooltip={t('pileLengthTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={1}
                    value={inp.pile_length_m} onChange={v => update({ pile_length_m: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                <InputNumber style={{ width: '100%' }} min={0} max={20} step={1}
                    value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
            </Form.Item>
        </>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleSpec')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                {!isBored ? (
                    <>
                        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('drivenSection')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                            <Select style={{ width: '100%' }} placeholder={t('drivenSectionPh')} allowClear
                                value={inp.pile_section_cm}
                                onChange={(v: number | undefined) => update({ pile_section_cm: v ?? undefined })}
                                options={[
                                    { value: 15, label: t('secI15') },
                                    { value: 18, label: t('secI18') },
                                    { value: 22, label: t('secI22') },
                                    { value: 26, label: t('secI26') },
                                    { value: 30, label: t('secI30') },
                                    { value: 35, label: t('secI35') },
                                    { value: 40, label: t('secI40') },
                                ]} />
                        </Form.Item>
                        <div className="grid grid-cols-2 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cutHead')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                <Switch checked={inp.pile_head_cut_required}
                                    onChange={v => update({ pile_head_cut_required: v })}
                                    checkedChildren={t('cutHeadYes')} unCheckedChildren={t('cutHeadNo')} />
                            </Form.Item>
                            {inp.pile_head_cut_required && (
                                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cutDepth')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                    <InputNumber style={{ width: '100%' }} min={0} max={80} step={5} placeholder={t('cutDepthPh')}
                                        value={inp.pile_head_cut_depth_cm} onChange={v => update({ pile_head_cut_depth_cm: v ?? undefined })} />
                                </Form.Item>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('boredDia')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                <Select style={{ width: '100%' }} placeholder={t('boredDiaPh')} allowClear
                                    value={inp.pile_diameter_m}
                                    onChange={(v: number | undefined) => update({ pile_diameter_m: v ?? undefined })}
                                    options={[
                                        { value: 0.30, label: t('dia30') },
                                        { value: 0.35, label: t('dia35') },
                                        { value: 0.40, label: t('dia40') },
                                        { value: 0.50, label: t('dia50') },
                                        { value: 0.60, label: t('dia60') },
                                    ]} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarCage')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                <InputNumber style={{ width: '100%' }} min={0} max={80} step={5} placeholder={t('rebarCagePh')}
                                    value={inp.rebar_cage_kg_per_m} onChange={v => update({ rebar_cage_kg_per_m: v ?? undefined })} />
                            </Form.Item>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('casingLen')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder={t('casingLenPh')}
                                    value={inp.casing_length_m} onChange={v => update({ casing_length_m: v ?? undefined })} />
                            </Form.Item>
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('bentonite')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                <Switch checked={inp.bentonite_required ?? true}
                                    onChange={v => update({ bentonite_required: v })}
                                    checkedChildren={t('bentoniteYes')} unCheckedChildren={t('bentoniteNo')} />
                            </Form.Item>
                        </div>
                    </>
                )}
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleTest')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('prodRate')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={30} step={1}
                            placeholder={isBored ? t('prodRateBoredPh') : t('prodRateDrivenPh')}
                            value={inp.production_rate_per_day} onChange={v => update({ production_rate_per_day: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('mobilizeDays')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={5} step={1} placeholder={t('mobilizeDaysPh')}
                            value={inp.mobilization_days} onChange={v => update({ mobilization_days: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('loadTestCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} max={10} step={1} placeholder={t('loadTestCountPh')}
                            value={inp.load_test_count} onChange={v => update({ load_test_count: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('seismicTestCount')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber style={{ width: '100%' }} min={0} step={1} placeholder={t('seismicTestCountPh')}
                            value={inp.seismic_test_count} onChange={v => update({ seismic_test_count: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {(inp.load_test_count ?? 0) > 0 && (
                        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('loadTestType')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                            <Select value={inp.load_test_type ?? 'dynamic'}
                                onChange={v => update({ load_test_type: v })}
                                options={[
                                    { value: 'dynamic', label: t('testDynamic') },
                                    { value: 'static', label: t('testStatic') },
                                ]} />
                        </Form.Item>
                    )}
                </div>
            </Card>
        </div>
    );

    return (
        <StepFormShell
            stepId={5} title="งานเสาเข็ม" titleEn="Piling Works"
            result={result} onBack={onBack}
            onSave={() => { if (result) onSave(inp, result); }}
            optionalChildren={optional}
        >
            {required}
        </StepFormShell>
    );
};
export default Step5Piling;
