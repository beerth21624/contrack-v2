'use client';

import { Alert } from 'antd';
import {
    brick, brickOpenings, brickWallResults, unmatchedOpenings, BRICK_BOQ_ROWS, BRICK_THICKNESSES, BRICK_TYPES,
    BRICK_WALL_PARTS, WALL_SHAPES, type BrickWall,
} from '@/domain/calculators/brick';
import type { CalcContext } from '@/domain/calculators/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import BrickJourney from './BrickJourney';

const opts = (list: readonly string[]) => list.map(v => ({ value: v }));

export default function BrickPage() {
    return useJourneyMode() ? <BrickJourney /> : <BrickSheet />;
}

/** The Excel-mirror sheet (/calc/brick). */
function BrickSheet() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(brick);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const openings = brickOpenings(ctx);
    const rows = brickWallResults(input, openings);
    const unmatched = Object.entries(unmatchedOpenings(input, openings));
    const noDoorWindow = result.calcOutputs['door-window'] === undefined;

    const newRow = (): BrickWall => {
        const last = input.walls[input.walls.length - 1];
        return {
            wallPart: last?.wallPart ?? '', brickType: last?.brickType ?? '', thickness: last?.thickness ?? '',
            length: 0, height: 0, shape: 'rect',
        };
    };

    return (
        <CalculatorShell def={brick} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณอิฐก่อ">
                <EditableTable<BrickWall>
                    rows={input.walls}
                    onChange={walls => update({ walls })}
                    newRow={newRow}
                    addLabel="+ เพิ่มผนัง"
                    columns={[
                        { kind: 'select', key: 'wallPart', title: 'ส่วนผนัง', width: 150, options: opts(BRICK_WALL_PARTS),
                            get: r => r.wallPart, set: (r, v) => ({ ...r, wallPart: v }) },
                        { kind: 'select', key: 'brickType', title: 'รายการ', width: 110, options: opts(BRICK_TYPES),
                            get: r => r.brickType, set: (r, v) => ({ ...r, brickType: v }) },
                        { kind: 'select', key: 'thickness', title: 'ความหนา', width: 100, options: opts(BRICK_THICKNESSES),
                            get: r => r.thickness, set: (r, v) => ({ ...r, thickness: v }) },
                        { kind: 'select', key: 'shape', title: 'รูปผนัง', width: 105,
                            options: WALL_SHAPES.map(s => ({ value: s.value, label: s.label })),
                            get: r => r.shape ?? 'rect', set: (r, v) => ({ ...r, shape: v === 'triangle' ? 'triangle' : 'rect' }) },
                        { kind: 'number', key: 'length', title: 'ความยาว (ม.)', width: 85,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'number', key: 'height', title: 'ความสูง (ม.)', width: 85,
                            get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
                        { kind: 'calc', key: 'area', title: 'พื้นที่ผนัง (ตร.ม.)', width: 90, get: (_, i) => rows[i]?.area ?? null },
                        { kind: 'calc', key: 'openings', title: 'พื้นที่ช่องเปิด (ตร.ม.)', width: 90, get: (_, i) => rows[i]?.openings ?? null },
                        { kind: 'calc', key: 'net', title: 'รวม (ตร.ม.)', width: 90, get: (_, i) => rows[i]?.net ?? null },
                    ]}
                />
                {unmatched.length > 0 && (
                    <Alert className="mt-3" type="warning" showIcon
                        title="ช่องเปิดที่ไม่มีผนังตรงกัน (ไม่ถูกหักออก)"
                        description={(
                            <ul className="list-disc pl-5 text-[12px]">
                                {unmatched.map(([k, v]) => (
                                    <li key={k}>{k.split('|').slice(1).filter(Boolean).join(' / ')}: {formatNumber(v)} ตร.ม.</li>
                                ))}
                            </ul>
                        )} />
                )}
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>พื้นที่ผนัง = ความยาว × ความสูง (สี่เหลี่ยม) หรือ ½ × ความยาว × ความสูง (สามเหลี่ยม เช่น ผนังจั่ว)</li>
                    <li>
                        พื้นที่ช่องเปิด = พื้นที่ประตู-หน้าต่างที่มี ส่วนผนัง + อิฐ + ความหนา ตรงกับแถวนี้ (จากตารางประตู-หน้าต่าง)
                        — ถ้ามีหลายแถวตรงกัน หักช่องเปิดครั้งเดียว แบ่งตามสัดส่วนพื้นที่ผนัง
                    </li>
                    {noDoorWindow && <li>ยังไม่มีตารางประตู-หน้าต่างในระบบ — ยังไม่หักพื้นที่ช่องเปิด</li>}
                    <li>รวม = พื้นที่ผนัง − พื้นที่ช่องเปิด → ส่งเข้า BOQ หมวด 17 แยกตามชนิดอิฐ × ความหนา และส่งให้งานฉาบปูนตามส่วนผนัง</li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปพื้นที่ก่ออิฐ (ส่งเข้า BOQ หมวด 17)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    {BRICK_BOQ_ROWS.map(b => (
                        <CalcField key={b.line} label={`ก่อ${b.brickType} (${b.thickness})`} value={outputs[b.line]} unit="ตร.ม." />
                    ))}
                    <CalcField label="เสาเอ็นและคานทับหลัง (รวมพื้นที่ผนัง)" unit="ตร.ม." strong
                        value={BRICK_BOQ_ROWS.reduce((s, b) => s + (outputs[b.line] ?? 0), 0)} />
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
