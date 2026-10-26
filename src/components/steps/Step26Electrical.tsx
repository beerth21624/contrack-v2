'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Select, Switch, Typography, Space, Tag, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step26Input, calcStep26 } from '@/lib/steps/step26';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step26Input;  onBack: () => void; onSave: (inp: Step26Input, res: StepResult) => void; }

const DEFAULTS: Step26Input = {
    lighting_count: 0, single_socket_count: 0, double_socket_count: 0,
    switch_count: 0, ac_circuit_count: 0, water_heater_circuit: false,
    main_breaker_amp: 50, phase: '1phase',
    waste_percent: 0, ground_rod_count: 1, outdoor_socket_count: 0,
    avg_cable_run_m: 0,
};

export default function Step26Electrical({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step26');
    const [inp, setInp] = useState<Step26Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step26Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const totalPoints = inp.lighting_count + inp.single_socket_count + inp.double_socket_count + inp.ac_circuit_count + (inp.water_heater_circuit ? 1 : 0);

    const result = useMemo(() => {
        try {
            return calcStep26(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card1Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <Space style={{ marginBottom: 12 }} wrap>
                    <Tag color="blue">{t('totalPoints', { total: totalPoints })}</Tag>
                    <Tag color="green">{t('totalLights', { total: inp.lighting_count })}</Tag>
                    <Tag color="orange">{t('totalSockets', { total: inp.single_socket_count + inp.double_socket_count })}</Tag>
                </Space>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('lightingCount')}</Text>}
                        tooltip={t('lightingCountTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.lighting_count} onChange={v => update({ lighting_count: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('switchCount')}</Text>}
                        tooltip={t('switchCountTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.switch_count} onChange={v => update({ switch_count: v ?? 0 })} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('singleSocket')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.single_socket_count} onChange={v => update({ single_socket_count: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('doubleSocket')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.double_socket_count} onChange={v => update({ double_socket_count: v ?? 0 })} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card2Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('acCircuit')}</Text>}
                        tooltip={t('acCircuitTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.ac_circuit_count} onChange={v => update({ ac_circuit_count: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('waterHeater')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.water_heater_circuit} onChange={v => update({ water_heater_circuit: v })}
                            checkedChildren={t('yes')} unCheckedChildren={t('no')} />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('mainBreaker')}</Text>}
                        tooltip={t('mainBreakerTooltip')} style={{ margin: 0 }}>
                        <Select value={inp.main_breaker_amp} onChange={v => update({ main_breaker_amp: v })}
                            options={[
                                { value: 30, label: t('breaker30A') },
                                { value: 40, label: t('breaker40A') },
                                { value: 50, label: t('breaker50A') },
                                { value: 63, label: t('breaker63A') },
                                { value: 100, label: t('breaker100A') },
                            ]} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('phaseSys')}</Text>}
                        tooltip={t('phaseSysTooltip')} style={{ margin: 0 }}>
                        <Select value={inp.phase} onChange={v => update({ phase: v })}
                            options={[
                                { value: '1phase', label: t('phase1') },
                                { value: '3phase', label: t('phase3') },
                            ]} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card3Main')}</span>} size="small" className="shadow-sm mt-4" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('groundRod')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.ground_rod_count} onChange={v => update({ ground_rod_count: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('avgCableRun')}</Text>}
                        tooltip={t('avgCableRunTooltip')} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={30} step={1}
                            value={inp.avg_cable_run_m} onChange={v => update({ avg_cable_run_m: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item required layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('wasteCable')}</Text>} style={{ margin: 0 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} max={25} step={1}
                            value={inp.waste_percent} onChange={v => update({ waste_percent: v ?? 10 })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optCardMain')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('outdoorSocket')}</Text>} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                            value={inp.outdoor_socket_count} onChange={v => update({ outdoor_socket_count: v ?? 0 })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('evCharger')}</Text>}
                        tooltip={t('evChargerTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <Switch checked={inp.ev_charger ?? false} onChange={v => update({ ev_charger: v })}
                            checkedChildren={t('yes')} unCheckedChildren={t('no')} />
                    </Form.Item>
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optHvacMain')}</span>} size="small" className="shadow-sm mt-4" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('hvacInstallCount')}</Text>}
                        tooltip={t('hvacInstallTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1} placeholder={t('hvacInstallPh')}
                            value={inp.hvac_install_count} onChange={v => update({ hvac_install_count: v ?? undefined })} />
                    </Form.Item>
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('hvacCopper')}</Text>}
                        tooltip={t('hvacCopperTooltip')} style={{ margin: 0, marginBottom: 12 }}>
                        <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={5} precision={2} placeholder={t('hvacCopperPh')}
                            value={inp.hvac_copper_pipe_m} onChange={v => update({ hvac_copper_pipe_m: v ?? undefined })} />
                    </Form.Item>
                </div>
            </Card>
        </div>
    );

    return (
        <StepFormShell stepId={26} title="ระบบไฟฟ้า" titleEn="Electrical Systems"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
