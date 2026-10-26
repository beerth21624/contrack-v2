'use client';

import { Alert, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    brick, brickOpenings, brickWallResults, unmatchedOpenings, BRICK_BOQ_ROWS, WALL_SHAPES, type BrickInput, type BrickWall,
} from '@/domain/calculators/brick';
import { LIGHT_WALL } from '@/domain/calculators/door-window';
import type { CalcContext } from '@/domain/calculators/types';
import { SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, ChoiceButtons, EmptyState, FillProgress, FromLevel, PlanCard, PlanField, PlanNumber, ResultSummary,
    SumInput, countFill, fillState, outOfRange, type FillState,
} from '@/components/sheet/journey';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { BRICK_CHOICES, THICKNESS_CHOICES, WALL_PART_CHOICES, WALL_PART_HINTS } from './wallParts';

const SHAPE_CHOICES = WALL_SHAPES.map(s => ({ value: s.value, label: s.value === 'triangle' ? 'สามเหลี่ยม (จั่ว)' : s.label }));

const keyParts = (k: string) => {
    const [, wallPart = '', brickType = '', thickness = ''] = k.split('|');
    return { wallPart, brickType, thickness };
};

/** Plan values a wall card still needs, in reading order. */
function missingOf(w: BrickWall): string[] {
    const out: string[] = [];
    if (w.wallPart.trim() === '') out.push('ส่วนผนัง');
    if (w.brickType.trim() === '' || w.thickness.trim() === '') out.push('ชนิดอิฐ');
    if (!(w.length > 0)) out.push('ความยาว');
    if (!(w.height > 0)) out.push('ความสูง');
    return out;
}

// A new wall copies the previous height, so a card counts as started once its length is typed.
const stateOf = (w: BrickWall): FillState => fillState([missingOf(w).length === 0], w.length > 0);

export default function BrickJourney() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(brick);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const openings = brickOpenings(ctx);
    const rows = brickWallResults(input, openings);
    // Openings in a light (non-brick) wall are never deducted on purpose: not a warning.
    const unmatchedOf = (walls: BrickInput) =>
        Object.entries(unmatchedOpenings(walls, openings)).filter(([k]) => keyParts(k).brickType !== LIGHT_WALL);
    const unmatched = unmatchedOf(input);
    const openingTotal = Object.entries(openings).reduce((s, [k, v]) => s + (keyParts(k).brickType === LIGHT_WALL ? 0 : v), 0);

    const newWall = (walls: BrickWall[], p?: Partial<BrickWall>): BrickWall => {
        const last = walls[walls.length - 1];
        return {
            wallPart: last?.wallPart ?? 'ผนังรอบบ้าน', brickType: last?.brickType ?? 'อิฐมอญ', thickness: last?.thickness ?? 'ครึ่งแผ่น',
            length: 0, height: last?.height ?? 0, shape: 'rect', ...p,
        };
    };
    const addWall = (p?: Partial<BrickWall>) => update(prev => ({ ...prev, walls: [...prev.walls, newWall(prev.walls, p)] }));
    /** One wall per door/window group that has no wall yet (same part, brick and thickness). */
    const addWallsForOpenings = () => update(prev => {
        let walls = prev.walls;
        for (const [k] of unmatchedOf(prev)) {
            const p = keyParts(k);
            if (p.wallPart === '' || p.brickType === '') continue;
            walls = [...walls, newWall(walls, { wallPart: p.wallPart, brickType: p.brickType, thickness: p.thickness })];
        }
        return { ...prev, walls };
    });
    const setWall = (i: number, patch: Partial<BrickWall>) =>
        update(prev => ({ ...prev, walls: prev.walls.map((w, j) => (j === i ? { ...w, ...patch } : w)) }));
    const duplicate = (i: number) => update(prev => {
        const w = prev.walls[i];
        return w === undefined ? prev : { ...prev, walls: [...prev.walls.slice(0, i + 1), { ...w }, ...prev.walls.slice(i + 1)] };
    });
    const remove = (i: number) => update(prev => ({ ...prev, walls: prev.walls.filter((_, j) => j !== i) }));

    const byType = BRICK_BOQ_ROWS.map(b => ({ label: `${b.brickType} ${b.thickness}`, value: outputs[b.line] ?? 0, unit: 'ตร.ม.' }));
    const total = byType.reduce((s, b) => s + b.value, 0);
    const states = input.walls.map(stateOf);
    const addableGroups = unmatched.filter(([k]) => keyParts(k).wallPart !== '' && keyParts(k).brickType !== '').length;

    const card = (w: BrickWall, i: number) => {
        const r = rows[i];
        const state = states[i] ?? 'empty';
        const missing = state === 'missing' ? new Set(missingOf(w)) : new Set<string>();
        const triangle = w.shape === 'triangle';
        const net = r?.net ?? 0;
        return (
            <PlanCard key={i} index={i + 1} state={state}
                title={w.wallPart.trim() === '' ? `ผนังที่ ${String(i + 1)}` : `${w.wallPart} · ${w.brickType} ${w.thickness}`}
                result={(r?.area ?? 0) > 0
                    ? <span className={net < 0 ? 'text-red-600' : ''}>ก่อ {formatNumber(net)} ตร.ม.</span>
                    : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} hasData={w.length > 0}
                deleteTitle="ลบผนังนี้?" missingText={`ยังขาด: ${missingOf(w).join(', ')}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <PlanField className="sm:col-span-2" label="ส่วนผนัง" missing={missing.has('ส่วนผนัง')}
                        hint={WALL_PART_HINTS[w.wallPart.trim()]}>
                        <ChoiceButtons ariaLabel="ส่วนผนัง" size="small" options={WALL_PART_CHOICES}
                            value={w.wallPart.trim() === '' ? undefined : w.wallPart.trim()}
                            onChange={wallPart => setWall(i, { wallPart })} />
                    </PlanField>
                    <PlanField className="sm:col-span-2" label="ชนิดอิฐ" missing={missing.has('ชนิดอิฐ')}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            <ChoiceButtons ariaLabel="ชนิดอิฐ" size="small" options={BRICK_CHOICES}
                                value={w.brickType.trim() === '' ? undefined : w.brickType.trim()}
                                onChange={brickType => setWall(i, { brickType })} />
                            <ChoiceButtons ariaLabel="ความหนา" size="small" options={THICKNESS_CHOICES}
                                value={w.thickness.trim() === '' ? undefined : w.thickness.trim()}
                                onChange={thickness => setWall(i, { thickness })} />
                        </div>
                    </PlanField>
                    <PlanField label="รูปผนัง"
                        hint={triangle ? 'ความยาว = ฐานจั่ว · ความสูง = ยอดจั่ว ระบบคิดครึ่งหนึ่งให้' : undefined}>
                        <ChoiceButtons ariaLabel="รูปผนัง" size="small" options={SHAPE_CHOICES} value={w.shape ?? 'rect'}
                            onChange={shape => setWall(i, { shape })} />
                    </PlanField>
                    <div className="hidden sm:block" />
                    <PlanField label={triangle ? 'ความกว้างฐานจั่ว (ม.)' : 'ความยาวรวม (ม.)'} missing={missing.has('ความยาว')}
                        note={outOfRange(w.length, 0.3, 500, 'ม.')}>
                        <span className={`max-w-[180px] rounded ${missing.has('ความยาว') ? 'ring-1 ring-red-400' : ''}`}>
                            <SumInput value={w.length} ariaLabel="ความยาวผนัง (ม.)" onChange={length => setWall(i, { length })} />
                        </span>
                    </PlanField>
                    <PlanNumber label={triangle ? 'ความสูงยอดจั่ว' : 'ความสูงผนัง'} unit="ม." value={w.height}
                        range={[0.5, 10]} missing={missing.has('ความสูง')}
                        onChange={height => setWall(i, { height })} />
                </div>
                {r !== undefined && r.openings > 0 && (
                    <div className="mt-2 text-[12px] text-gray-500 tabular-nums">
                        หักประตู-หน้าต่างแล้ว {formatNumber(r.openings)} ตร.ม.
                    </div>
                )}
                {net < 0 && (
                    <div className="mt-1 text-[12px] text-red-600">
                        ประตู-หน้าต่างมากกว่าพื้นที่ผนัง — ตรวจความยาว/ความสูงผนัง หรือผนังที่ติดตั้งของประตู-หน้าต่าง
                    </div>
                )}
            </PlanCard>
        );
    };

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
                            addLabel="เพิ่มผนัง" onAdd={() => addWall()}
                            actions={addableGroups > 1
                                ? [{ label: `เพิ่มผนังตามประตู-หน้าต่าง (${String(addableGroups)} กลุ่ม)`, onClick: addWallsForOpenings }]
                                : []} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {input.walls.length >= 5 && <FillProgress {...countFill(states)} noun="ผนัง" />}
                            {input.walls.map(card)}
                            <AddButton label="เพิ่มผนัง" onClick={() => addWall()} />
                        </div>
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
                                <div className="text-gray-500">เพิ่มผนังชนิดนี้ หรือแก้ผนังของประตู-หน้าต่างในขั้นตอนก่อนหน้าให้ตรงกัน</div>
                            </div>
                        )} />
                )}
            </SheetCard>

            <ResultSummary
                items={[
                    ...byType.filter(b => b.value !== 0),
                    { label: 'พื้นที่ก่ออิฐรวม', value: total, unit: 'ตร.ม.' },
                ]}
                note="พื้นที่ก่อ (หักประตู-หน้าต่างแล้ว) ใช้ต่อในขั้นตอนฉาบปูนให้อัตโนมัติ" />
        </CalculatorShell>
    );
}
