'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, Collapse, Popconfirm, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, UndoOutlined } from '@ant-design/icons';
import type { CalculatorDef } from '@/domain/calculators/types';
import type { ProjectResult } from '@/domain/project';
import type { BoqItemRow } from '@/domain/boq/types';
import { MissingPrices } from '@/components/sheet/journey/MissingPrices';
import { formatNumber, SHEET_COLORS } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';

const { Title, Text } = Typography;

const td = 'border border-gray-200 px-2 py-1 text-[13px]';
const tdNum = `${td} text-right tabular-nums whitespace-nowrap`;

/** The BOQ (Home) rows of the given sections, as they stand with the current input. */
export function BoqPreview({ result, sections, highlight, highlightPrefix, title = 'ส่งเข้า BOQ' }: {
    result: ProjectResult; sections: number[]; highlight?: Set<string>;
    /** Rows whose key starts with this (slot rows `${calcId}:…`) are highlighted too. */
    highlightPrefix?: string;
    title?: string;
}) {
    const isHighlighted = (key: string) =>
        (highlight?.has(key) ?? false) || (highlightPrefix !== undefined && key.startsWith(highlightPrefix));
    const secs = result.boq.sections.filter(s => sections.includes(s.no));
    return (
        <div className="bg-white border border-gray-200 rounded-card shadow-card">
            <div className="px-4 py-2 border-b border-gray-100 font-semibold text-[14px] text-gray-800">
                {title}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-[12px] text-gray-700">
                            <th className={td}>รายการ</th><th className={td}>ปริมาณ</th><th className={td}>หน่วย</th>
                            <th className={td}>ค่าวัสดุ</th><th className={td}>ค่าแรง</th><th className={td}>รวม</th>
                        </tr>
                    </thead>
                    {secs.map(s => (
                        <tbody key={s.no}>
                            <tr style={{ background: SHEET_COLORS.header }}>
                                <td className={`${td} font-semibold`} colSpan={5}>{s.no}. {s.title}</td>
                                <td className={`${tdNum} font-semibold`}>{formatNumber(s.total)}</td>
                            </tr>
                            {s.rows.map(r => r.type === 'heading'
                                ? <tr key={r.key}><td className={`${td} font-medium`} colSpan={6}>{r.itemNo} {r.desc}</td></tr>
                                : (
                                    <tr key={r.key} style={isHighlighted(r.key) ? { background: SHEET_COLORS.calc } : undefined}>
                                        <td className={td}>{r.itemNo} {r.desc}</td>
                                        <td className={tdNum}>{formatNumber(r.qty)}</td>
                                        <td className={`${td} text-center`}>{r.unit}</td>
                                        <td className={tdNum}>{formatNumber(r.matTotal)}</td>
                                        <td className={tdNum}>{formatNumber(r.labTotal)}</td>
                                        <td className={`${tdNum} font-medium`}>{formatNumber(r.total)}</td>
                                    </tr>
                                ))}
                        </tbody>
                    ))}
                </table>
            </div>
        </div>
    );
}

/** Page frame for one calculator sheet: header, input area (left) and BOQ preview (right). */
export function CalculatorShell({ def, result, isDefault, onReset, children, aside }: {
    def: CalculatorDef<never> | CalculatorDef;
    result: ProjectResult;
    isDefault: boolean;
    onReset: () => void;
    children: ReactNode;
    /** Extra blocks under the BOQ preview (e.g. a summary). */
    aside?: ReactNode;
}) {
    const highlight = new Set(def.boqLinks.map(l => l.line));
    const inJourney = useJourneyMode();
    const preview = (
        <BoqPreview result={result} sections={def.sections} highlight={highlight} highlightPrefix={`${def.id}:`}
            title={inJourney ? 'รายการใน BOQ ของหมวดนี้ (แถวสีเขียวมาจากขั้นตอนนี้)' : undefined} />
    );
    if (inJourney) {
        // The level page shows title, plan hint and navigation; here only the inputs, with the BOQ detail folded.
        // Linked lines only: slot rows (rebar, doors …) get their price from the calculator itself.
        const ownRows = result.boq.sections.flatMap(s => s.rows.filter((r): r is BoqItemRow =>
            r.type === 'item' && highlight.has(r.key)));
        return (
            <div className="flex flex-col gap-4">
                {children}
                <MissingPrices rows={ownRows} />
                {aside}
                <Collapse
                    size="small"
                    items={[{
                        key: 'boq',
                        label: <span className="text-[13px] text-gray-600">ดูรายการที่ส่งเข้า BOQ (สำหรับตรวจสอบ)</span>,
                        children: preview,
                        extra: isDefault ? undefined : (
                            <Popconfirm title="ล้างข้อมูลขั้นตอนนี้กลับเป็นค่าเริ่มต้น?" okText="ล้าง" cancelText="ยกเลิก" onConfirm={onReset}>
                                <Button size="small" type="text" icon={<UndoOutlined />} onClick={e => e.stopPropagation()}>ค่าเริ่มต้น</Button>
                            </Popconfirm>
                        ),
                    }]}
                />
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-card p-4 shadow-card">
                <Link href={`/boq#boq-section-${def.sections[0] ?? 0}`}>
                    <Button icon={<ArrowLeftOutlined />} aria-label="กลับไปหน้าสรุป BOQ" />
                </Link>
                <div className="min-w-0">
                    <Text className="text-[12px] font-semibold tracking-wide text-orange-500 uppercase">
                        หมวด BOQ {def.sections.join(', ')}
                    </Text>
                    <Title level={4} style={{ margin: 0 }}>{def.title}</Title>
                    <Text type="secondary" className="text-[12px] [overflow-wrap:anywhere]">ชีต Excel: {def.sheetName}</Text>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {isDefault
                        ? <Tag>ค่าตัวอย่างจากเทมเพลต</Tag>
                        : (
                            <Popconfirm title="คืนค่าตัวอย่างจากเทมเพลต?" okText="คืนค่า" cancelText="ยกเลิก" onConfirm={onReset}>
                                <Button icon={<UndoOutlined />}>คืนค่าตัวอย่าง</Button>
                            </Popconfirm>
                        )}
                </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                <div className="xl:col-span-7 flex flex-col gap-4 min-w-0">{children}</div>
                <div className="xl:col-span-5 flex flex-col gap-4 min-w-0 xl:sticky xl:top-4">
                    {preview}
                    {aside}
                </div>
            </div>
        </div>
    );
}
