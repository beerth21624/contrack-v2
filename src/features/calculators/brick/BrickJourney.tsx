'use client';

import { Alert, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    brick, brickOpenings, brickWallResults, unmatchedOpenings, BRICK_BOQ_ROWS, BRICK_THICKNESSES, BRICK_TYPES,
    BRICK_WALL_PARTS, WALL_SHAPES, type BrickWall,
} from '@/domain/calculators/brick';
import { LIGHT_WALL } from '@/domain/calculators/door-window';
import type { CalcContext } from '@/domain/calculators/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { EmptyState, FromLevel, ResultSummary, SumInput, blankIfZero } from '@/components/sheet/journey';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { parseWallType, wallTypeOptions, wallTypeValue } from './wallType';

/** What each wall part means (the plaster level plasters them by these rules). */
const WALL_PART_HINTS: Record<string, string> = {
    'ผนังรอบบ้าน': 'ผนังภายนอกของตัวบ้าน (ฉาบด้านใน 1 ด้าน ด้านนอก 1 ด้าน)',
    'ผนังภายในบ้าน': 'ผนังกั้นห้องในบ้าน (ฉาบด้านในทั้ง 2 ด้าน)',
    'ผนังภายนอกบ้าน': 'ผนังนอกตัวบ้าน เช่น ผนังส่วนซักล้าง รั้ว (ฉาบด้านนอกทั้ง 2 ด้าน)',
    'ผนังรอบบ้าน-พิเศษ': 'ผนังพิเศษของตัวบ้าน เช่น ผนังจั่วสามเหลี่ยมใต้หลังคา',
};

const wallTypes = wallTypeOptions(BRICK_TYPES, BRICK_THICKNESSES);
const keyParts = (k: string) => {
    const [, wallPart = '', brickType = '', thickness = ''] = k.split('|');
    return { wallPart, brickType, thickness };
};

export default function BrickJourney() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(brick);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const openings = brickOpenings(ctx);
    const rows = brickWallResults(input, openings);
    // Openings in a light (non-brick) wall are never deducted on purpose: not a warning.
    const unmatched = Object.entries(unmatchedOpenings(input, openings)).filter(([k]) => keyParts(k).brickType !== LIGHT_WALL);
    const openingTotal = Object.entries(openings).reduce((s, [k, v]) => s + (keyParts(k).brickType === LIGHT_WALL ? 0 : v), 0);

    const newWall = (p?: Partial<BrickWall>): BrickWall => {
        const last = input.walls[input.walls.length - 1];
        return {
            wallPart: last?.wallPart ?? 'ผนังรอบบ้าน', brickType: last?.brickType ?? 'อิฐมอญ', thickness: last?.thickness ?? 'ครึ่งแผ่น',
            length: 0, height: last?.height ?? 0, shape: 'rect', ...p,
        };
    };
    const addWall = (p?: Partial<BrickWall>) => update(prev => ({ ...prev, walls: [...prev.walls, newWall(p)] }));
    const setWall = (i: number, patch: Partial<BrickWall>) =>
        update(prev => ({ ...prev, walls: prev.walls.map((w, j) => (j === i ? { ...w, ...patch } : w)) }));

    const byType = BRICK_BOQ_ROWS.map(b => ({ label: `${b.brickType} ${b.thickness}`, value: outputs[b.line] ?? 0, unit: 'ตร.ม.' }));
    const total = byType.reduce((s, b) => s + b.value, 0);

    return (
        <CalculatorShell def={brick} result={result} isDefault={isDefault} onReset={reset}>
            <FromLevel levelId="door-window">
                {openingTotal > 0
                    ? <>ประตู-หน้าต่างรวม <b>{formatNumber(openingTotal)} ตร.ม.</b> ระบบหักออกจากผนังที่ส่วนผนังและชนิดอิฐตรงกันให้เอง</>
                    : <>ยังไม่มีประตู-หน้าต่าง จึงยังไม่หักช่องเปิดออกจากผนัง</>}
            </FromLevel>

            <SheetCard title="ผนังก่ออิฐ">
                {input.walls.length === 0
                    ? (
                        <EmptyState
                            text="ยังไม่มีผนัง — ดูแปลนพื้นและรูปด้าน แล้วเพิ่มผนังทีละกลุ่ม (เช่น ผนังรอบบ้านอิฐมอญ) พิมพ์ความยาวแต่ละช่วงต่อกันได้ เช่น 9.5+7+2"
                            addLabel="เพิ่มผนัง" onAdd={() => addWall()} />
                    )
                    : (
                        <EditableTable<BrickWall>
                            rows={input.walls}
                            onChange={walls => update({ walls })}
                            newRow={() => newWall()}
                            addLabel="+ เพิ่มผนัง"
                            columns={[
                                { kind: 'select', key: 'wallPart', title: 'ส่วนผนัง', width: 150,
                                    options: BRICK_WALL_PARTS.map(v => ({ value: v })),
                                    get: r => r.wallPart, set: (r, v) => ({ ...r, wallPart: v }) },
                                { kind: 'select', key: 'type', title: 'ชนิดอิฐ', width: 150, options: wallTypes,
                                    get: r => wallTypeValue(r.brickType, r.thickness),
                                    set: (r, v) => { const t = parseWallType(v); return { ...r, brickType: t.brick, thickness: t.thickness }; } },
                                { kind: 'select', key: 'shape', title: 'รูปผนัง', width: 140,
                                    options: WALL_SHAPES.map(s => ({ value: s.value, label: s.value === 'triangle' ? 'สามเหลี่ยม (จั่ว)' : s.label })),
                                    get: r => r.shape ?? 'rect', set: (r, v) => ({ ...r, shape: v === 'triangle' ? 'triangle' : 'rect' }) },
                                { kind: 'label', key: 'length', title: 'ความยาวรวม (ม.)', width: 140,
                                    get: (r, i) => <SumInput value={r.length} ariaLabel="ความยาวผนัง (ม.)" onChange={length => setWall(i, { length })} /> },
                                { kind: 'number', key: 'height', title: 'ความสูง (ม.)', width: 85,
                                    get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
                                { kind: 'calc', key: 'openings', title: 'หักประตู-หน้าต่าง (ตร.ม.)', width: 100, get: (_, i) => blankIfZero(rows[i]?.openings ?? null) },
                                { kind: 'calc', key: 'net', title: 'พื้นที่ก่อ (ตร.ม.)', width: 95, get: (_, i) => blankIfZero(rows[i]?.net ?? null) },
                            ]}
                        />
                    )}

                {rows.some(r => r.net < 0) && (
                    <Alert className="mt-3" type="warning" showIcon
                        title="ผนังบางแนวมีพื้นที่ติดลบ — กรอกความยาวและความสูงผนัง (ตอนนี้หักประตู-หน้าต่างมากกว่าพื้นที่ผนัง)" />
                )}

                {unmatched.length > 0 && (
                    <Alert className="mt-3" type="warning" showIcon
                        title="มีประตู-หน้าต่างที่ยังไม่มีผนังชนิดเดียวกัน (ยังไม่ได้หักออก)"
                        description={(
                            <div className="flex flex-col gap-1 text-[12px]">
                                {unmatched.map(([k, v]) => {
                                    const p = keyParts(k);
                                    return (
                                        <div key={k} className="flex flex-wrap items-center gap-2">
                                            <span>{p.wallPart} · {p.brickType} {p.thickness}: {formatNumber(v)} ตร.ม.</span>
                                            {p.wallPart !== '' && p.brickType !== '' && (
                                                <Button size="small" icon={<PlusOutlined />}
                                                    onClick={() => addWall({ wallPart: p.wallPart, brickType: p.brickType, thickness: p.thickness })}>
                                                    เพิ่มผนังนี้
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                                <div className="text-gray-500">เพิ่มผนังชนิดนี้ หรือแก้ผนังของประตู-หน้าต่างในด่านก่อนหน้าให้ตรงกัน</div>
                            </div>
                        )} />
                )}

                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    {BRICK_WALL_PARTS.map(p => <li key={p}><b className="font-medium text-gray-600">{p}</b>: {WALL_PART_HINTS[p]}</li>)}
                    <li>ผนังจั่ว (สามเหลี่ยม): ใส่ความกว้างฐานจั่วเป็นความยาว และความสูงยอดจั่วเป็นความสูง ระบบคิดครึ่งหนึ่งให้</li>
                </ul>
            </SheetCard>

            <ResultSummary
                items={[
                    ...byType.filter(b => b.value !== 0),
                    { label: 'พื้นที่ก่ออิฐรวม', value: total, unit: 'ตร.ม.' },
                ]}
                note="พื้นที่ก่อ (หักประตู-หน้าต่างแล้ว) ใช้ต่อในด่านฉาบปูนให้อัตโนมัติ" />
        </CalculatorShell>
    );
}
