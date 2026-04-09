'use client';
import { useState, useMemo, useCallback } from "react";
import { Form, InputNumber, Switch, Typography, Card } from 'antd';
import { StepFormShell } from '../StepFormShell';
import { type Step29Input, calcStep29 } from '@/lib/steps/step29';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';

const { Text } = Typography;

interface Props { initialData?: Step29Input;  onBack: () => void; onSave: (inp: Step29Input, res: StepResult) => void; }

const DEFAULTS: Step29Input = {
    curtain_rail_m: 0, blind_window_count: 0,
    towel_bar_count: 0, soap_dish_count: 0, paper_holder_count: 0, mirror_count: 0,
    door_stopper_count: 0, door_closer_count: 0, peephole_count: 0, house_number_set: 0,
    shelf_set_count: 0, cabinet_count: 0,
    mailbox: false, clothesline_m: 0,
};

export default function Step29Miscellaneous({ initialData, onBack, onSave }: Props) {
    const t = useTranslations('steps.step29');
    const [inp, setInp] = useState<Step29Input>(initialData ?? DEFAULTS);
    
    const update = useCallback((patch: Partial<Step29Input>) => {
        setInp(prev => ({ ...prev, ...patch }));
    }, []);

    const num = (label: string, field: keyof Step29Input, tooltip?: string) => (
        <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{label}</Text>}
            tooltip={tooltip} style={{ margin: 0, marginBottom: 12 }}>
            <InputNumber onFocus={(e) => e.target.select()} style={{ width: '100%' }} min={0} step={1}
                value={inp[field] as number} onChange={v => update({ [field]: v ?? 0 })} />
        </Form.Item>
    );

    const result = useMemo(() => {
        try {
            return calcStep29(inp);
        } catch {
            return null;
        }
    }, [inp]);

    const required = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card1Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    {num(t('curtainRail'), 'curtain_rail_m', t('curtainRailTooltip'))}
                    {num(t('blindWindow'), 'blind_window_count')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {num(t('towelBar'), 'towel_bar_count')}
                    {num(t('soapDish'), 'soap_dish_count')}
                    {num(t('paperHolder'), 'paper_holder_count')}
                    {num(t('mirror'), 'mirror_count')}
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card2Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    {num(t('doorStopper'), 'door_stopper_count', t('doorStopperTooltip'))}
                    {num(t('doorCloser'), 'door_closer_count', t('doorCloserTooltip'))}
                    {num(t('peephole'), 'peephole_count')}
                    {num(t('houseNumber'), 'house_number_set')}
                </div>
            </Card>

            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('card3Main')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {num(t('shelf'), 'shelf_set_count')}
                    {num(t('cabinet'), 'cabinet_count', t('cabinetTooltip'))}
                </div>
            </Card>
        </div>
    );

    const optional = (
        <div className="flex flex-col gap-4">
            <Card title={<span style={{ whiteSpace: 'normal', lineHeight: '1.4' }}>{t('optCardMain')}</span>} size="small" className="shadow-sm" styles={{ header: { minHeight: 'auto', padding: '8px 12px'  } }}>
                <div className="grid grid-cols-2 gap-2">
                    <Form.Item layout="vertical" label={<Text style={{ fontSize: 13 }}>{t('mailbox')}</Text>} style={{ margin: 0 }}>
                        <Switch checked={inp.mailbox} onChange={v => update({ mailbox: v })}
                            checkedChildren={t('installed')} unCheckedChildren={t('notInstalled')} />
                    </Form.Item>
                    {num(t('clothesline'), 'clothesline_m')}
                </div>
            </Card>

            
        </div>
    );

    return (
        <StepFormShell stepId={29} title="อุปกรณ์เบ็ดเตล็ด" titleEn="Miscellaneous Fixtures"
            result={result} onBack={onBack}
            onSave={() => result && onSave(inp, result)}
            optionalChildren={optional}>
            {required}
        </StepFormShell>
    );
}
