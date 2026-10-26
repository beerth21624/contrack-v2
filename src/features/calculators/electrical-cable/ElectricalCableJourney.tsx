'use client';

import { Button } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import {
    BLANK_WIRING, circuitsToSuggest, CONDUCTOR_COUNTS, fillSuggestedWiring, sizeKey, WIRE_SIZES, type CircuitWiring,
} from '@/domain/calculators/electrical-cable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    ChoiceButtons, EmptyState, FillProgress, FromLevel, PlanCard, PlanField, ResultSummary, countFill,
    fillState, type FillState,
} from '@/components/sheet/journey';
import { useCableRows, type Calc, type Row } from './cableRows';

const sizeLabel = (s: string) => s.replace(/^THW\s*/, '');
const MAIN_SIZE_CHOICES = WIRE_SIZES.map(value => ({ value: value as string, label: sizeLabel(value) }));
const DEVICE_SIZE_CHOICES = [...MAIN_SIZE_CHOICES, { value: '', label: 'ไม่มี' }];
const CONDUCTOR_CHOICES = CONDUCTOR_COUNTS.map(n => ({ value: n as number, label: n === 3 ? '3 เส้น (มีสายดิน)' : `${String(n)} เส้น` }));

const rowTotal = (r: Row) => (r.cable ? WIRE_SIZES.reduce((s, size) => s + (r.cable?.bySize[size] ?? 0), 0) : 0);
const lengthOf = (r: Row) => (r.cable?.main ?? 0) + (r.cable?.device ?? 0);
const stateOf = (r: Row): FillState => fillState([lengthOf(r) > 0 && (r.cable?.unassigned ?? 0) === 0], lengthOf(r) > 0);

/**
 * Guided journey: one card per circuit of the conduit step — its run lengths (carried from that step), the wire
 * sizes and number of wires as buttons (pre-selected from the circuit kind), and the metres of wire it comes to.
 */
export function ElectricalCableJourney({ calc }: { calc: Calc }) {
    const { input, update, outputs } = calc;
    const { rows, circuits } = useCableRows(calc);
    const total = (size: string) => outputs[sizeKey(size)] ?? 0;
    const toSuggest = circuitsToSuggest(input, circuits);
    const setWiring = (r: Row, patch: Partial<CircuitWiring>) => update(p => ({
        ...p, wiring: { ...p.wiring, [r.circuit.id]: { ...(p.wiring[r.circuit.id] ?? BLANK_WIRING), ...patch } },
    }));

    if (rows.length === 0) {
        return (
            <SheetCard>
                <EmptyState text="ยังไม่มีวงจร" note="วงจรและระยะสายมาจากขั้นตอนท่อร้อยสายไฟ — เพิ่มวงจรในขั้นตอนนั้นก่อน"
                    goToLevel="electrical-pipe" />
            </SheetCard>
        );
    }

    const states = rows.map(stateOf);
    const progress = countFill(states);

    const card = (r: Row, i: number) => {
        const state = states[i] ?? 'empty';
        const main = r.cable?.main ?? 0;
        const device = r.cable?.device ?? 0;
        const w = r.wiring;
        const sum = rowTotal(r);
        const unassigned = r.cable?.unassigned ?? 0;
        const showDevice = device > 0 || w.deviceSize.trim() !== '';
        return (
            <PlanCard key={r.circuit.id} index={i + 1} state={state} compact
                title={r.circuit.name.trim() === '' ? `วงจรที่ ${String(i + 1)}` : r.circuit.name}
                result={sum > 0 ? <>สาย {formatNumber(sum)} ม.</> : undefined}
                missingText={`ยังไม่ได้เลือก${w.conductors > 0 ? 'ขนาดสาย' : 'จำนวนสาย'} — สาย ${formatNumber(unassigned)} ม. ยังไม่ถูกคิดเงิน`}>
                <div className="mb-2 text-[12px] text-gray-500 tabular-nums">
                    {lengthOf(r) > 0
                        ? <>ระยะสายเมน {formatNumber(main)} ม.{device > 0 && <> · เข้าโคม/จุด {formatNumber(device)} ม.</>}</>
                        : 'ยังไม่มีระยะท่อของวงจรนี้'}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 items-start">
                    <PlanField label="สายเมนวงจร (ตร.มม.)" missing={state === 'missing' && w.mainSize.trim() === '' && main > 0}>
                        <ChoiceButtons ariaLabel="ขนาดสายเมนวงจร" size="small" options={MAIN_SIZE_CHOICES}
                            value={w.mainSize.trim() === '' ? undefined : w.mainSize.trim()}
                            onChange={mainSize => setWiring(r, { mainSize })} />
                    </PlanField>
                    {showDevice && (
                        <PlanField label="สายเข้าโคม / จุด (ตร.มม.)"
                            missing={state === 'missing' && w.deviceSize.trim() === '' && device > 0}>
                            <ChoiceButtons ariaLabel="ขนาดสายเข้าโคม / จุด" size="small" options={DEVICE_SIZE_CHOICES}
                                value={w.deviceSize.trim()} onChange={deviceSize => setWiring(r, { deviceSize })} />
                        </PlanField>
                    )}
                    <PlanField label="จำนวนสาย" missing={state === 'missing' && !(w.conductors > 0)}>
                        <ChoiceButtons ariaLabel="จำนวนสาย" size="small" options={CONDUCTOR_CHOICES}
                            value={w.conductors > 0 ? w.conductors : undefined}
                            onChange={conductors => setWiring(r, { conductors })} />
                    </PlanField>
                </div>
            </PlanCard>
        );
    };

    return (
        <>
            <FromLevel levelId="electrical-pipe">
                วงจร {formatNumber(rows.length, 0)} วงจร และระยะสายของแต่ละวงจร — แก้ชื่อหรือเพิ่มวงจรได้ในขั้นตอนนั้น
            </FromLevel>

            <SheetCard title="ขนาดสายไฟแต่ละวงจร">
                <div className="flex flex-col gap-2">
                    {rows.length >= 5 && <FillProgress {...progress} noun="วงจร" verb="เลือกสายแล้ว" />}
                    <p className="text-[12px] text-gray-500">
                        ระบบเลือกขนาดสายตามชนิดวงจรไว้ให้ ตรวจกับไดอะแกรมไฟฟ้า
                        (ไฟแสงสว่าง: สายเมน 2.5 / เข้าโคม 1.5 ตร.มม. 2 เส้น · เต้ารับ: 4 / 2.5 ตร.มม. 3 เส้น ·
                        เครื่องทำน้ำอุ่น แอร์ ปั๊มน้ำ: 4 ตร.มม. 3 เส้น)
                    </p>
                    {toSuggest.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                            <span className="text-[13px] text-orange-700">มี {toSuggest.length} วงจรที่ยังไม่ได้เลือกขนาดสาย</span>
                            <Button size="small" type="primary" icon={<ThunderboltOutlined />}
                                onClick={() => update(p => fillSuggestedWiring(p, circuits))}>
                                เลือกขนาดสายที่แนะนำให้
                            </Button>
                        </div>
                    )}
                    {rows.map(card)}
                </div>
            </SheetCard>

            <ResultSummary
                items={[
                    { label: 'สายไฟ THW 1.5 ตร.มม.', value: total('THW 1.5'), unit: 'ม.' },
                    { label: 'สายไฟ THW 2.5 ตร.มม.', value: total('THW 2.5'), unit: 'ม.' },
                    { label: 'สายไฟ THW 4 ตร.มม.', value: total('THW 4'), unit: 'ม.' },
                    ...(total('THW 6') > 0 ? [{ label: 'สายไฟ THW 6 ตร.มม.', value: total('THW 6'), unit: 'ม.' }] : []),
                ]}
                note={total('THW 6') > 0
                    ? <span className="text-orange-600">สาย 6 ตร.มม. ยังไม่มีรายการราคา จึงยังไม่ถูกคิดเงิน</span>
                    : undefined} />
        </>
    );
}
