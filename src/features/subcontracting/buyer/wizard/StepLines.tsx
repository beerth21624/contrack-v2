'use client';

// ─── Wizard step 1: choose the work (trade or template → BOQ rows by section, plus typed lines) ───
import { useTranslations } from 'next-intl';
import { Button, Checkbox, Input, InputNumber, Select, Switch, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { TradeId } from '@/shared/contract';
import type { BoqResult } from '@/domain/boq/types';
import { money, qty } from '../format';
import { Card, tradeOptions } from '../ui';
import {
    TEMPLATES, templateLabel, applyTemplate, changeTrade, groupRows, labourEstimate, newLocalId, toggleKeys, zeroRowCount,
    type CustomLineDraft, type Draft, type WizardRow,
} from './state';

export function StepLines({ draft, update, boq, rows, held }: {
    draft: Draft;
    update: (patch: Partial<Draft>) => void;
    boq: BoqResult;
    rows: readonly WizardRow[];
    held: ReadonlyMap<string, string>;
}) {
    const tx = useTranslations('subcontracting');
    const selected = new Set(draft.selected);
    const groups = groupRows(rows, draft.showZero, selected);
    const zeros = zeroRowCount(rows);

    return (
        <>
            <Card title={tx('buyer.wizardLines.workToSubcontract')}>
                <div className="flex flex-col gap-3">
                    <Select<TradeId> value={draft.trade} options={tradeOptions()} className="w-full md:max-w-[420px]"
                        aria-label={tx('buyer.wizardLines.trade')} showSearch={{ optionFilterProp: 'label' }}
                        onChange={t => update(changeTrade(draft, t))} />
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-secondary text-gray-500">{tx('buyer.wizardLines.orStartFromACommon')}</span>
                        {TEMPLATES.map(t => (
                            <Tag.CheckableTag key={t.id} className="!m-0 !border !border-gray-200"
                                checked={draft.trade === t.trade && sameTrades(draft.shownTrades, t.trades)}
                                onChange={() => update(applyTemplate(draft, t, boq))}>
                                {templateLabel(t, tx)}
                            </Tag.CheckableTag>
                        ))}
                    </div>
                </div>
            </Card>

            <Card title={tx('buyer.wizardLines.itemsFromTheBoq')} extra={zeros > 0 ? (
                <label className="flex items-center gap-2 text-secondary text-gray-600 cursor-pointer">
                    <Switch size="small" checked={draft.showZero} onChange={v => update({ showZero: v })} />
                    {tx('buyer.wizardLines.showRowsWithQuantity0')}{zeros})
                </label>
            ) : undefined}>
                {groups.length === 0 ? (
                    <p className="text-gray-500 m-0 py-4">{tx('buyer.wizardLines.theBoqHasNoQuantities')}</p>
                ) : (
                    <div className="overflow-x-auto -mx-1">
                        <table className="w-full min-w-[640px] border-collapse text-body">
                            <thead>
                                <tr className="text-secondary text-gray-500 border-b border-gray-200">
                                    <th className="w-10" />
                                    <th className="text-left font-medium py-2">{tx('buyer.wizardLines.item')}</th>
                                    <th className="text-left font-medium py-2 w-20">{tx('buyer.wizardLines.unit')}</th>
                                    <th className="text-right font-medium py-2 w-32">{tx('buyer.wizardLines.quantity')}</th>
                                    <th className="text-right font-medium py-2 w-36 pr-1">{tx('buyer.wizardLines.estimatedLabour')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map(g => {
                                    const free = g.rows.filter(r => !held.has(r.row.key)).map(r => r.row.key);
                                    const on = free.filter(k => selected.has(k)).length;
                                    return [
                                        <tr key={`s${String(g.section)}`} className="bg-gray-50 border-b border-gray-100">
                                            <td className="py-2 pl-2">
                                                <Checkbox aria-label={tx('buyer.wizardLines.selectTheWholeSection', { title: g.title })} disabled={free.length === 0}
                                                    checked={free.length > 0 && on === free.length}
                                                    indeterminate={on > 0 && on < free.length}
                                                    onChange={e => update({ selected: toggleKeys(draft.selected, free, e.target.checked) })} />
                                            </td>
                                            <td colSpan={4} className="py-2 font-medium text-gray-900">{tx('buyer.wizardLines.section')} {g.section} {g.title}</td>
                                        </tr>,
                                        ...g.rows.map(r => {
                                            const holder = held.get(r.row.key);
                                            const disabled = holder !== undefined;
                                            return (
                                                <tr key={r.row.key} className={`border-b border-gray-100 ${disabled ? 'text-gray-400' : ''}`}>
                                                    <td className="py-2 pl-2 align-top">
                                                        <Checkbox aria-label={r.row.desc} disabled={disabled}
                                                            checked={!disabled && selected.has(r.row.key)}
                                                            onChange={e => update({ selected: toggleKeys(draft.selected, [r.row.key], e.target.checked) })} />
                                                    </td>
                                                    <td className="py-2 pr-3 align-top">
                                                        <div>{r.row.desc}</div>
                                                        {holder !== undefined && <div className="text-caption">{tx('buyer.wizardLines.inPackage')} {holder}</div>}
                                                    </td>
                                                    <td className="py-2 align-top">{r.row.unit}</td>
                                                    <td className="py-2 text-right tabular-nums align-top">
                                                        <div>{qty(r.row.qty)}</div>
                                                        {r.row.grossQty !== null && (
                                                            <div className="text-caption text-gray-500">{tx('buyer.wizardLines.includingAllowance')} {qty(r.row.grossQty)}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-2 pr-1 text-right tabular-nums align-top">{money(labourEstimate(r.row))}</td>
                                                </tr>
                                            );
                                        }),
                                    ];
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <CustomLinesCard lines={draft.customLines} onChange={customLines => update({ customLines })} />
        </>
    );
}

function sameTrades(a: readonly TradeId[], b: readonly TradeId[]): boolean {
    return a.length === b.length && a.every(t => b.includes(t));
}

function CustomLinesCard({ lines, onChange }: { lines: CustomLineDraft[]; onChange: (lines: CustomLineDraft[]) => void }) {
    const tx = useTranslations('subcontracting');
    const set = (id: string, patch: Partial<CustomLineDraft>) => onChange(lines.map(l => (l.id === id ? { ...l, ...patch } : l)));
    const add = () => onChange([...lines, { id: newLocalId(), desc: '', unit: '', qty: 0, estUnit: 0 }]);
    return (
        <Card title={tx('buyer.wizardLines.workOutsideTheBoq')} extra={<Button size="small" icon={<PlusOutlined />} onClick={add}>{tx('buyer.wizardLines.addARow')}</Button>}>
            {lines.length === 0 ? (
                <p className="text-secondary text-gray-500 m-0">{tx('buyer.wizardLines.forWorkNotInThe')}</p>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="hidden md:flex gap-2 text-secondary text-gray-500">
                        <span className="flex-1">{tx('buyer.wizardLines.item')}</span>
                        <span className="w-24">{tx('buyer.wizardLines.unit')}</span>
                        <span className="w-28 text-right">{tx('buyer.wizardLines.quantity')}</span>
                        <span className="w-36 text-right">{tx('buyer.wizardLines.estimatedLabourUnit')}</span>
                        <span className="w-8" />
                    </div>
                    {lines.map(l => {
                        const missingUnit = l.desc.trim() !== '' && l.unit.trim() === '';
                        return (
                            <div key={l.id} className="flex flex-wrap md:flex-nowrap gap-2">
                                <Input className="md:flex-1 min-w-[200px]" placeholder={tx('buyer.wizardLines.item')} maxLength={300} value={l.desc}
                                    onChange={e => set(l.id, { desc: e.target.value })} />
                                <Input className="!w-24" placeholder={tx('buyer.wizardLines.unit')} maxLength={20} value={l.unit}
                                    status={missingUnit ? 'error' : undefined} onChange={e => set(l.id, { unit: e.target.value })} />
                                <InputNumber<number> className="!w-28" min={0} value={l.qty} aria-label={tx('buyer.wizardLines.quantity')}
                                    onChange={v => set(l.id, { qty: v ?? 0 })} />
                                <InputNumber<number> className="!w-36" min={0} value={l.estUnit} aria-label={tx('buyer.wizardLines.estimatedLabourPerUnit')}
                                    onChange={v => set(l.id, { estUnit: v ?? 0 })} />
                                <Button type="text" aria-label={tx('buyer.wizardLines.removeRow')} icon={<DeleteOutlined />}
                                    onClick={() => onChange(lines.filter(x => x.id !== l.id))} />
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
