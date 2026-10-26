'use client';

import { useMemo, useRef, useState } from 'react';
import { Button, Input, Select, Spin, Tooltip, Typography } from 'antd';
import { CaretDownOutlined, CaretRightOutlined, UndoOutlined, LinkOutlined, SearchOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useProjectStore } from '@/store/project-store';
import { computeProject } from '@/domain/project';
import type { BoqItemRow, BoqSectionResult } from '@/domain/boq/types';
import { NumberCell, TextCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { getCalculator } from '@/domain/calculators/registry';
import { CALCULATOR_PAGES } from '@/features/calculators/pages';
import Link from 'next/link';
import { BoqExportButtons } from '@/features/export/BoqExportButtons';
import { RevisionButtons } from '@/features/cloud/revisions/RevisionButtons';

const { Title, Text } = Typography;

const cell = 'border border-gray-200 px-1 py-0.5 align-middle';
const num = `${cell} text-right tabular-nums whitespace-nowrap`;
// When the table scrolls sideways (tablet / small laptop) No., step and description stay in view. Not on phones,
// where the description column would take most of the screen.
const stick = 'sm:sticky sm:z-[1]';
const STICKY = {
    no: { className: `${stick} sm:left-0`, style: { width: 36, minWidth: 36 } },
    step: { className: `${stick} sm:left-[36px]`, style: { width: 44, minWidth: 44 } },
    desc: { className: `${stick} sm:left-[80px] sm:shadow-[1px_0_0_#e5e7eb]` },
} as const;

function CalcValue({ value, digits = 2, tip }: { value: number | null; digits?: number; tip?: string }) {
    const content = <span>{formatNumber(value, digits)}</span>;
    return tip ? <Tooltip title={tip}>{content}</Tooltip> : content;
}

/** Texts of the table tools (search, jump), per locale. */
const TOOL_TEXT = {
    th: {
        searchPh: 'ค้นหารายการ เช่น DB12, ฝ้า, ท่อ',
        jump: 'ไปที่หมวด…',
        found: (n: number) => `พบ ${String(n)} รายการ`,
        none: 'ไม่พบรายการที่ตรงกับคำค้น',
        clear: 'ล้างคำค้น',
    },
    en: {
        searchPh: 'Search items, e.g. DB12, ceiling, pipe',
        jump: 'Go to section…',
        found: (n: number) => `${String(n)} items found`,
        none: 'No items match the search',
        clear: 'Clear search',
    },
} as const;

/** An edited value: an orange inner outline on top of the bold text. */
const editedCls = (on: boolean) => (on ? 'shadow-[inset_0_0_0_2px_#fdba74]' : '');

/** `text` with the parts matching `q` (case-insensitive) marked. */
function Highlight({ text, q }: { text: string; q: string }) {
    if (q === '') return <>{text}</>;
    const lower = text.toLowerCase();
    const parts: { s: string; hit: boolean }[] = [];
    let at = 0;
    for (let i = lower.indexOf(q, at); i >= 0; i = lower.indexOf(q, at)) {
        if (i > at) parts.push({ s: text.slice(at, i), hit: false });
        parts.push({ s: text.slice(i, i + q.length), hit: true });
        at = i + q.length;
    }
    if (at < text.length) parts.push({ s: text.slice(at), hit: false });
    return <>{parts.map((p, i) => (p.hit ? <mark key={i} className="bg-yellow-200 rounded-sm px-0">{p.s}</mark> : <span key={i}>{p.s}</span>))}</>;
}

export function BoqHomePage() {
    const t = useTranslations('boqHome');
    const locale = useLocale();
    const tt = locale === 'en' ? TOOL_TEXT.en : TOOL_TEXT.th;
    const hasHydrated = useProjectStore(s => s.hasHydrated);
    const project = useProjectStore(s => s.project);
    const setMeta = useProjectStore(s => s.setMeta);
    const setOverride = useProjectStore(s => s.setBoqOverride);
    const resetSection = useProjectStore(s => s.resetBoqSection);
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
    const [query, setQuery] = useState('');
    const boxRef = useRef<HTMLDivElement>(null);
    const headRef = useRef<HTMLTableSectionElement>(null);

    const result = useMemo(() => computeProject(project), [project]);
    const overrides = project.boqOverrides;

    if (!hasHydrated) {
        return <div className="flex justify-center p-20"><Spin size="large" /></div>;
    }

    const q = query.trim().toLowerCase();
    const filtering = q !== '';
    const matches = (r: BoqItemRow) =>
        r.desc.toLowerCase().includes(q) || (r.note ?? '').toLowerCase().includes(q);
    const itemsOf = (s: BoqSectionResult) => s.rows.filter((r): r is BoqItemRow => r.type === 'item');
    const visibleSections = filtering ? result.boq.sections.filter(s => itemsOf(s).some(matches)) : result.boq.sections;
    const matchCount = visibleSections.reduce((n, s) => n + itemsOf(s).filter(matches).length, 0);

    /** Opens a section and scrolls the table to it (under the sticky column header). */
    const jumpTo = (no: number) => {
        setCollapsed(prev => {
            if (!prev.has(no)) return prev;
            const next = new Set(prev);
            next.delete(no);
            return next;
        });
        requestAnimationFrame(() => {
            const box = boxRef.current;
            const el = document.getElementById(`boq-section-${String(no)}`);
            if (!box || !el) return;
            const head = headRef.current?.offsetHeight ?? 0;
            const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - head;
            box.scrollTo({ top, behavior: 'smooth' });
            box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    };

    const toggle = (no: number) => setCollapsed(prev => {
        const next = new Set(prev);
        if (next.has(no)) next.delete(no); else next.add(no);
        return next;
    });

    const meta = project.meta;
    const metaField = (label: string, field: keyof typeof meta, placeholder?: string) => (
        <div className="flex items-center gap-2 min-w-0">
            <Text className="whitespace-nowrap text-[13px] text-gray-600 w-36 shrink-0">{label}</Text>
            <div className="flex-1 min-w-0" style={{ background: SHEET_COLORS.input, borderRadius: 3 }}>
                <TextCell value={meta[field]} placeholder={placeholder}
                    onCommit={v => setMeta({ [field]: v ?? '' })} ariaLabel={label} />
            </div>
        </div>
    );

    const renderItem = (r: BoqItemRow) => {
        const ov = overrides[r.key] ?? {};
        const qtyTip = r.qtySource === 'calc' ? t('fromCalc') : r.qtySource === 'line' || r.qtySource === 'sumLines' ? t('fromLine') : undefined;
        return (
            <tr key={r.key} className="hover:bg-orange-50/40">
                <td className={`${cell} bg-white ${STICKY.no.className}`} />
                <td className={`${cell} text-center text-gray-500 bg-white ${STICKY.step.className}`}>{r.itemNo}</td>
                <td className={`${cell} min-w-[260px] bg-white ${STICKY.desc.className}`}><Highlight text={r.desc} q={q} /></td>
                <td className={`${num} ${editedCls(ov.qty !== undefined)}`} style={{ background: r.editable.qty ? undefined : SHEET_COLORS.calc, minWidth: 90 }}>
                    {r.editable.qty
                        ? <Tooltip title={qtyTip}>
                            <div><NumberCell value={r.qty} edited={ov.qty !== undefined} digits={r.qty % 1 === 0 ? 0 : 2}
                                tone={r.fromCalc.qty ? 'calc' : 'input'}
                                onCommit={v => setOverride(r.key, 'qty', v)} ariaLabel={`${r.desc} ${t('colQty')}`} /></div>
                          </Tooltip>
                        : <CalcValue value={r.qtySource === 'none' ? null : r.qty} tip={qtyTip} />}
                </td>
                <td className={`${cell} text-center`}>{r.unit}</td>
                <td className={`${num} ${editedCls(ov.waste !== undefined)}`} style={{ minWidth: 64 }}>
                    <NumberCell value={r.waste} percent edited={ov.waste !== undefined}
                        onCommit={v => setOverride(r.key, 'waste', v)} ariaLabel={`${r.desc} ${t('colWaste')}`} />
                </td>
                <td className={num} style={{ background: SHEET_COLORS.calc }}><CalcValue value={r.grossQty} /></td>
                <td className={`${num} ${editedCls(ov.mat !== undefined)}`} style={{ minWidth: 90 }}>
                    <NumberCell value={r.matUnit} edited={ov.mat !== undefined} tone={r.fromCalc.mat ? 'calc' : 'input'}
                        onCommit={v => setOverride(r.key, 'mat', v)} ariaLabel={`${r.desc} ${t('colMat')}`} />
                </td>
                <td className={num} style={{ background: SHEET_COLORS.calc }}><CalcValue value={r.matTotal} /></td>
                <td className={`${num} ${editedCls(ov.lab !== undefined)}`} style={{ minWidth: 90 }}>
                    <NumberCell value={r.labUnit} edited={ov.lab !== undefined} tone={r.fromCalc.lab ? 'calc' : 'input'}
                        onCommit={v => setOverride(r.key, 'lab', v)} ariaLabel={`${r.desc} ${t('colLab')}`} />
                </td>
                <td className={num} style={{ background: SHEET_COLORS.calc }}><CalcValue value={r.labTotal} /></td>
                <td className={`${num} font-semibold`} style={{ background: SHEET_COLORS.calc }}><CalcValue value={r.total} /></td>
                <td className={`${cell} min-w-[160px] text-gray-600 ${editedCls(ov.note !== undefined)}`}>
                    <TextCell value={r.note ?? ''} edited={ov.note !== undefined}
                        onCommit={v => setOverride(r.key, 'note', v)} ariaLabel={`${r.desc} ${t('colNote')}`} />
                </td>
            </tr>
        );
    };

    const renderSection = (s: BoqSectionResult) => {
        // A filter shows the matching rows of every section, open (headings would be out of context).
        const isCollapsed = !filtering && collapsed.has(s.no);
        const keys = s.rows.map(r => r.key);
        const hasEdits = keys.some(k => overrides[k] !== undefined);
        const shownRows = filtering ? s.rows.filter(r => r.type === 'item' && matches(r)) : s.rows;
        return (
            <tbody key={s.no} id={`boq-section-${s.no}`}>
                <tr style={{ background: SHEET_COLORS.header }}>
                    <td className={`${cell} text-center font-bold ${STICKY.no.className}`} style={{ background: SHEET_COLORS.header }}>{s.no}</td>
                    <td className={`${cell} font-bold`} colSpan={12}>
                        <div className="flex items-center gap-2">
                            <Button type="text" size="small" aria-label={s.title}
                                icon={isCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
                                onClick={() => toggle(s.no)} />
                            <span>{s.title}</span>
                            {s.calculators.map(id => {
                                const def = getCalculator(id);
                                return def && CALCULATOR_PAGES[id]
                                    ? (
                                        <Link key={id} href={`/calc/${id}`} className="text-[12px] font-normal text-blue-600 hover:underline">
                                            <LinkOutlined /> {def.title}
                                        </Link>
                                    )
                                    : (
                                        <Tooltip key={id} title={t('calcPending')}>
                                            <LinkOutlined className="text-gray-400" />
                                        </Tooltip>
                                    );
                            })}
                            <span className="ml-auto text-gray-600 tabular-nums">{formatNumber(s.total)}</span>
                            {hasEdits && (
                                <Tooltip title={t('resetSection')}>
                                    <Button type="text" size="small" icon={<UndoOutlined />} aria-label={t('resetSection')}
                                        onClick={() => resetSection(keys)} />
                                </Tooltip>
                            )}
                        </div>
                    </td>
                </tr>
                {!isCollapsed && shownRows.map(r => r.type === 'heading'
                    ? (
                        <tr key={r.key}>
                            <td className={`${cell} bg-white ${STICKY.no.className}`} />
                            <td className={`${cell} text-center text-gray-500 bg-white ${STICKY.step.className}`}>{r.itemNo}</td>
                            <td className={`${cell} font-medium`} colSpan={11}>{r.desc}</td>
                        </tr>
                    )
                    : renderItem(r))}
                {!isCollapsed && (
                    <tr style={{ background: SHEET_COLORS.subtotal }}>
                        <td className={cell} colSpan={2} />
                        <td className={`${cell} text-right font-semibold`} colSpan={6}>{t('subtotal')}</td>
                        <td className={`${num} font-semibold`}>{formatNumber(s.matTotal)}</td>
                        <td className={cell} />
                        <td className={`${num} font-semibold`}>{formatNumber(s.labTotal)}</td>
                        <td className={`${num} font-bold`}>{formatNumber(s.total)}</td>
                        <td className={cell} />
                    </tr>
                )}
            </tbody>
        );
    };

    const { boq } = result;

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Title level={4} style={{ margin: 0 }}>{t('title')}</Title>
                        <Text type="secondary">{meta.projectName || t('subtitle')}</Text>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                        <BoqExportButtons project={project} />
                        <RevisionButtons />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mt-4">
                    {metaField(t('projectName'), 'projectName')}
                    {metaField(t('revision'), 'revision')}
                    {metaField(t('siteAddress'), 'siteAddress', t('siteAddressPh'))}
                    {metaField(t('documentDate'), 'documentDate', t('documentDatePh'))}
                    {metaField(t('ownerName'), 'ownerName', t('ownerNamePh'))}
                    {metaField(t('preparedBy'), 'preparedBy', t('preparedByPh'))}
                </div>
                <div className="flex flex-wrap gap-4 mt-4 text-[12px] text-gray-600">
                    <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 rounded-sm" style={{ background: SHEET_COLORS.input }} />{t('legendInput')}</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-4 h-3 rounded-sm" style={{ background: SHEET_COLORS.calc }} />{t('legendCalc')}</span>
                    <span><b>B</b> = {t('legendEdited')}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white border border-orange-200 rounded-lg p-4 shadow-sm">
                    <Text type="secondary" className="text-[13px]">{t('constructionTotal')}</Text>
                    <div className="text-2xl font-bold text-orange-500 tabular-nums">฿ {formatNumber(boq.constructionTotal)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <Text type="secondary" className="text-[13px]">{t('preConstruction')}</Text>
                    <div className="text-2xl font-semibold text-gray-700 tabular-nums">฿ {formatNumber(boq.preConstructionTotal)}</div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <Input allowClear prefix={<SearchOutlined className="text-gray-400" />} placeholder={tt.searchPh} aria-label={t('search')}
                    value={query} onChange={e => setQuery(e.target.value)} style={{ width: 300, maxWidth: '100%' }} />
                <Select<number> showSearch={{ optionFilterProp: 'label' }} placeholder={tt.jump} aria-label={tt.jump}
                    style={{ width: 260, maxWidth: '100%' }}
                    options={visibleSections.map(s => ({ value: s.no, label: `${String(s.no)}. ${s.title}` }))}
                    onSelect={jumpTo} />
                {filtering && <span className="text-[13px] text-gray-500">{tt.found(matchCount)}</span>}
                <span className="ml-auto flex gap-2">
                    <Button size="small" disabled={filtering} onClick={() => setCollapsed(new Set())}>{t('expandAll')}</Button>
                    <Button size="small" disabled={filtering}
                        onClick={() => setCollapsed(new Set(boq.sections.map(s => s.no)))}>{t('collapseAll')}</Button>
                </span>
            </div>

            <div ref={boxRef} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-auto max-h-[75vh]">
                <table className="w-full border-collapse text-[13px]">
                    <thead ref={headRef} className="sticky top-0 z-10 bg-gray-100">
                        <tr>
                            <th className={`${cell} bg-gray-100 ${STICKY.no.className}`} style={STICKY.no.style} rowSpan={2}>{t('colNo')}</th>
                            <th className={`${cell} bg-gray-100 ${STICKY.step.className}`} style={STICKY.step.style} rowSpan={2}>{t('colStep')}</th>
                            <th className={`${cell} bg-gray-100 ${STICKY.desc.className}`} rowSpan={2}>{t('colDesc')}</th>
                            <th className={cell} rowSpan={2}>{t('colQty')}</th>
                            <th className={cell} rowSpan={2}>{t('colUnit')}</th>
                            <th className={cell} rowSpan={2}>{t('colWaste')}</th>
                            <th className={cell} rowSpan={2}>{t('colGross')}</th>
                            <th className={cell} colSpan={2}>{t('colMat')}</th>
                            <th className={cell} colSpan={2}>{t('colLab')}</th>
                            <th className={cell} rowSpan={2}>{t('colTotal')}</th>
                            <th className={cell} rowSpan={2}>{t('colNote')}</th>
                        </tr>
                        <tr>
                            <th className={cell}>{t('colUnitPrice')}</th>
                            <th className={cell}>{t('colSum')}</th>
                            <th className={cell}>{t('colUnitPrice')}</th>
                            <th className={cell}>{t('colSum')}</th>
                        </tr>
                    </thead>
                    {visibleSections.map(renderSection)}
                    {filtering && visibleSections.length === 0 && (
                        <tbody>
                            <tr>
                                <td className={`${cell} text-center text-gray-500 py-8`} colSpan={13}>
                                    {tt.none}
                                    <div className="mt-2">
                                        <Button size="small" onClick={() => setQuery('')}>{tt.clear}</Button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    )}
                    <tbody>
                        <tr className="bg-orange-50">
                            <td className={`${cell} text-right font-bold`} colSpan={11}>{t('constructionTotal')}</td>
                            <td className={`${num} font-bold text-orange-600`}>{formatNumber(boq.constructionTotal)}</td>
                            <td className={cell}>{t('baht')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
