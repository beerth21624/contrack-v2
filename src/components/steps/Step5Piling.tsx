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
    pile_type: 'driven', pile_shape: 'square', number_of_piles: 0, pile_length_m: 0, waste_percent: 0,
    pile_head_cut_required: false, dowel_bar_required: false,
};

export const Step5Piling: React.FC<Props> = ({ onSave, onBack, initialData }) => {
    const [inp, setInp] = useState<Step5Input>(initialData ?? DEFAULT);
    const t = useTranslations('steps.step5');
    const update = useCallback((patch: Partial<Step5Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const isBored = inp.pile_type === 'bored';
    const isMini = inp.pile_type === 'mini';

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
                    onChange={v => update({ pile_type: v, pile_diameter_m: undefined, pile_section_cm: undefined, mini_pile_type: v === 'mini' ? 'mini15' : undefined, mini_pile_length_m: v === 'mini' ? 4 : undefined })}
                    options={[
                        { value: 'driven', label: t('typeDriven') },
                        { value: 'bored', label: t('typeBored') },
                        { value: 'mini', label: t('typeMini') },
                    ]} />
            </Form.Item>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('pileCount')}</Text>} 
                tooltip={t('pileCountTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                    value={inp.number_of_piles} onChange={v => update({ number_of_piles: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" 
                label={<Text style={{ fontSize: 13 }}>{t('pileLength')}</Text>} 
                tooltip={t('pileLengthTooltip')}
                style={{ margin: 0 }}
            >
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={0.5} precision={1}
                    value={inp.pile_length_m} onChange={v => update({ pile_length_m: v ?? 0 })} />
            </Form.Item>
            <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waste')}</Text>} style={{ margin: 0 }}>
                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={20} step={1}
                    value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 5 })} />
            </Form.Item>

            {/* ── Specification Fields (REQUIRED) ── */}
            {isMini ? (
                <>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('miniType')}</Text>} style={{ margin: 0 }}>
                        <Select style={{ width: '100%' }}
                            value={inp.mini_pile_type ?? 'mini15'}
                            onChange={(v: 'mini15' | 'cpac10x12') => update({ mini_pile_type: v })}
                            options={[
                                { value: 'mini15', label: t('miniType15') },
                                { value: 'cpac10x12', label: t('miniTypeCpac') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('miniLength')}</Text>} style={{ margin: 0 }}>
                        <Select style={{ width: '100%' }}
                            value={inp.mini_pile_length_m ?? 4}
                            onChange={(v: number) => update({ mini_pile_length_m: v, pile_length_m: v })}
                            options={
                                (inp.mini_pile_type ?? 'mini15') === 'mini15'
                                  ? [
                                      { value: 2, label: '2 m' }, { value: 3, label: '3 m' }, { value: 4, label: '4 m' },
                                      { value: 5, label: '5 m' }, { value: 6, label: '6 m' },
                                  ]
                                  : [
                                      { value: 2, label: '2 m' }, { value: 3, label: '3 m' }, { value: 4, label: '4 m' },
                                      { value: 5, label: '5 m' },
                                  ]
                            } />
                    </Form.Item>
                </>
            ) : !isBored ? (
                <>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('pileShape')}</Text>} style={{ margin: 0 }}>
                        <Select style={{ width: '100%' }}
                            value={inp.pile_shape ?? 'square'}
                            onChange={(v: 'square' | 'spun') => update({ pile_shape: v, pile_section_cm: undefined })}
                            options={[
                                { value: 'square', label: t('shapeSquare') },
                                { value: 'spun', label: t('shapeSpun') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{inp.pile_shape === 'spun' ? t('spunDia') : t('drivenSection')}</Text>} style={{ margin: 0 }}>
                        <Select style={{ width: '100%' }} placeholder={inp.pile_shape === 'spun' ? t('spunDiaPh') : t('drivenSectionPh')} allowClear
                            value={inp.pile_section_cm}
                            onChange={(v: number | undefined) => update({ pile_section_cm: v ?? undefined })}
                            options={inp.pile_shape === 'spun' ? [
                                { value: 25, label: 'Spun Ø25 cm' }, { value: 30, label: 'Spun Ø30 cm' }, { value: 35, label: 'Spun Ø35 cm' },
                                { value: 40, label: 'Spun Ø40 cm' }, { value: 45, label: 'Spun Ø45 cm' }, { value: 50, label: 'Spun Ø50 cm' },
                                { value: 60, label: 'Spun Ø60 cm' }, { value: 80, label: 'Spun Ø80 cm' },
                            ] : [
                                { value: 15, label: t('secI15') }, { value: 18, label: t('secI18') }, { value: 20, label: 'I-20 (0.20×0.20)' },
                                { value: 22, label: t('secI22') }, { value: 26, label: t('secI26') }, { value: 30, label: t('secI30') },
                                { value: 35, label: t('secI35') }, { value: 40, label: t('secI40') }, { value: 45, label: 'I-45 (0.45×0.45)' },
                                { value: 52.5, label: 'I-52.5 (0.525×0.525)' },
                            ]} />
                    </Form.Item>
                </>
            ) : (
                <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('boredDia')}</Text>} style={{ margin: 0 }}>
                    <Select style={{ width: '100%' }} placeholder={t('boredDiaPh')} allowClear
                        value={inp.pile_diameter_m}
                        onChange={(v: number | undefined) => update({ pile_diameter_m: v ?? undefined })}
                        options={[
                            { value: 0.30, label: t('dia30') }, { value: 0.35, label: t('dia35') }, { value: 0.40, label: t('dia40') },
                            { value: 0.50, label: t('dia50') }, { value: 0.60, label: t('dia60') },
                        ]} />
                </Form.Item>
            )}
        </>
    );

    /* ── Optional fields ────────────────────────────────────── */
    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('titleSpec')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                {isMini ? (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cutHead')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                <Switch checked={inp.pile_head_cut_required !== false}
                                    onChange={v => update({ pile_head_cut_required: v })}
                                    checkedChildren={t('cutHeadYes')} unCheckedChildren={t('cutHeadNo')} />
                            </Form.Item>
                            {inp.pile_head_cut_required !== false && (
                                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('dowelBar') || 'Dowel Bar'}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                    <Switch checked={inp.dowel_bar_required !== false}
                                        onChange={v => update({ dowel_bar_required: v })}
                                        checkedChildren="ใส่" unCheckedChildren="ไม่ใส่" />
                                </Form.Item>
                            )}
                        </div>
                    </>
                ) : !isBored ? (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cutHead')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                <Switch checked={inp.pile_head_cut_required}
                                    onChange={v => update({ pile_head_cut_required: v })}
                                    checkedChildren={t('cutHeadYes')} unCheckedChildren={t('cutHeadNo')} />
                            </Form.Item>
                            {inp.pile_head_cut_required && (
                                <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('cutDepth')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                    <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={80} step={5} placeholder={t('cutDepthPh')}
                                        value={inp.pile_head_cut_depth_cm} onChange={v => update({ pile_head_cut_depth_cm: v ?? undefined })} />
                                </Form.Item>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('rebarCage')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={80} step={5} placeholder={t('rebarCagePh')}
                                    value={inp.rebar_cage_kg_per_m} onChange={v => update({ rebar_cage_kg_per_m: v ?? undefined })} />
                            </Form.Item>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('casingLen')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                                <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} placeholder={t('casingLenPh')}
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
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>ระยะเวลาเข้า-ออกเครื่องจักร (วัน)</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={5} step={1} placeholder="เช่น 1 หรือ 2 วัน"
                            value={inp.mobilization_days} onChange={v => update({ mobilization_days: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('prodRate')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={30} step={1}
                            placeholder={isBored ? t('prodRateBoredPh') : t('prodRateDrivenPh')}
                            value={inp.production_rate_per_day} onChange={v => update({ production_rate_per_day: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>ต้องการเจาะสำรวจดินกี่หลุม? (Soil Boring Test)</Text>} tooltip={t('soilBoringTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} placeholder="จำนวนหลุม (ถ้าไม่มีใส่ 0)"
                            value={inp.soil_boring_count} onChange={v => update({ soil_boring_count: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>ทดสอบความสมบูรณ์เข็มกี่ต้น? (Seismic Test)</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} placeholder="จำนวนต้น (ถ้าไม่มีใส่ 0)"
                            value={inp.seismic_test_count} onChange={v => update({ seismic_test_count: v ?? undefined })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>ทดสอบการรับน้ำหนักกี่จุด? (Load Test)</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={10} step={1} placeholder="จำนวนทดสอบ (ถ้าไม่มีใส่ 0)"
                            value={inp.load_test_count} onChange={v => update({ load_test_count: v ?? undefined })} />
                    </Form.Item>
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
