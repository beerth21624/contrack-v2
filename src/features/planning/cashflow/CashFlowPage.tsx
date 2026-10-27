'use client';

// CashFLOW_Basic (Excel v5 sheet 04): quotation, installments (cash-in), S-Curve-weighted cost (cash-out),
// the cumulative cash position and the EVM dashboard.
import { Alert, Button, Tooltip } from 'antd';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { formatNumber } from '@/components/sheet/NumberCell';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { bucketIndexOf, isoToSerial, type CashFlowInput, type CashInstallmentInput } from '@/domain/planning';
import { CashFlowChart } from '../shared/charts';
import {
    DetailSection, NoBoqYet, PlanningHeader, StatTile, SummaryBanner, bucketLabel, bucketOptions, bucketRange, formatDate, money,
    usePlanning, usedBucketCount,
} from '../shared/planning-ui';
import { CashFlowDetailGrid } from './CashFlowDetailGrid';
import { EvmPanel } from './EvmPanel';

const NONE = 'none';

export function CashFlowPage() {
    const { planning, input, stored, setPlanning, result } = usePlanning();
    const ci = input.cashflow;
    const cf = planning.cashflow;
    const sched = planning.schedule;
    const save = (next: CashFlowInput) => setPlanning({ cashflow: next });
    const saveInstallments = (installments: CashInstallmentInput[]) => save({ ...ci, installments });

    const min = cf.minCumulative;
    /** Lowest cumulative cash position when it is below zero (the peak funding need). */
    const neg = min !== null && min.value < 0 ? min : null;
    const minBucket = neg ? cf.buckets[neg.bucket] : undefined;
    const endCash = cf.cumulative.at(-1) ?? 0;
    const pctOff = Math.abs(cf.installmentPctTotal - 1) > 1e-9;
    const unplaced = ci.installments.filter(i => i.bucket === null).length;
    const count = usedBucketCount(cf.buckets, cf.incomeWeekly, cf.outflowWeekly);

    /** Week bucket in which the S-Curve งวด `no` finishes (the sample bills most งวด there). */
    const finishBucket = (no: number) => {
        const inst = sched.installments.find(x => x.no === no);
        const serial = isoToSerial(inst?.finish);
        return { inst, bucket: serial === null ? -1 : bucketIndexOf(cf.buckets, serial) };
    };

    const options = [{ value: NONE, label: 'ยังไม่กำหนด' }, ...bucketOptions(cf.buckets)];
    const columns: SheetColumn<CashInstallmentInput>[] = [
        { kind: 'text', key: 'label', title: 'งวด', width: 150, get: r => r.label, set: (r, v) => ({ ...r, label: v }) },
        { kind: 'number', key: 'pct', title: 'สัดส่วนงวด', width: 84, percent: true, get: r => r.pct, set: (r, v) => ({ ...r, pct: v }) },
        {
            kind: 'select', key: 'bucket', title: 'เรียกเก็บสัปดาห์', width: 250, options,
            get: r => (r.bucket === null ? NONE : String(r.bucket)),
            set: (r, v) => ({ ...r, bucket: v === NONE ? null : Number(v) }),
        },
        { kind: 'calc', key: 'amount', title: 'จำนวนเงิน (บาท)', width: 130, get: (_, i) => cf.installments[i]?.amount ?? null },
        {
            kind: 'label', key: 'hint', title: 'งานงวดนี้เสร็จ (S-Curve)', width: 230,
            get: (r, i) => {
                if (i === 0) return <span className="text-[12px] text-gray-400">มัดจำตอนเซ็นสัญญา</span>;
                const { inst, bucket } = finishBucket(i);
                if (!inst?.finish) return <span className="text-[12px] text-gray-400">–</span>;
                return (
                    <span className="text-[12px] text-gray-600 flex items-center gap-1 whitespace-nowrap">
                        {formatDate(inst.finish)} ({bucketLabel(cf.buckets[bucket])})
                        {bucket >= 0 && bucket !== r.bucket && (
                            <Tooltip title="เรียกเก็บในสัปดาห์ที่งานงวดนี้เสร็จ">
                                <Button size="small" type="link" className="!px-1"
                                    aria-label={`เรียกเก็บ ${r.label} ใน ${bucketLabel(cf.buckets[bucket])}`}
                                    onClick={() => saveInstallments(ci.installments.map((x, j) => (j === i ? { ...x, bucket } : x)))}>ใช้</Button>
                            </Tooltip>
                        )}
                    </span>
                );
            },
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            <PlanningHeader current="/cashflow" title="วางแผนการเงิน (Cash Flow)" sheetName="CashFLOW_Basic"
                isDefault={stored.cashflow === undefined} onReset={() => setPlanning({ cashflow: undefined })} />
            <NoBoqYet constructionTotal={result.boq.constructionTotal} />

            <SummaryBanner headline={neg
                ? <>เงินติดลบสูงสุด {money(-neg.value)} บาท ช่วงสัปดาห์ {bucketLabel(minBucket)} ({bucketRange(minBucket)})</>
                : <>เงินสดไม่ติดลบตลอดโครงการ</>}>
                {neg && <span>ควรเตรียมเงินสำรองไว้อย่างน้อย {money(-neg.value)} บาท ก่อนรับเงินงวดถัดไป</span>}
                <span>
                    เสนอราคาลูกค้า <b>{money(cf.quotation)} บาท</b> (ต้นทุน {money(cf.cost)} × {formatNumber(ci.quotationFactor, 2)})
                    · จบโครงการเหลือเงินสด {money(endCash)} บาท
                </span>
            </SummaryBanner>

            {(pctOff || unplaced > 0) && (
                <Alert type="warning" showIcon
                    title={[
                        pctOff ? `งวดเงินรวม ${formatNumber(cf.installmentPctTotal * 100, 0)}% (ควรเป็น 100%)` : null,
                        unplaced > 0 ? `ยังไม่กำหนดสัปดาห์เรียกเก็บ ${unplaced} งวด` : null,
                    ].filter(Boolean).join(' · ')} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SheetCard title="ราคาและค่าใช้จ่าย" className="h-full">
                    <CalcField label="ต้นทุนก่อสร้าง" value={cf.cost} unit="บาท" />
                    <InputNumberField label="ตัวคูณราคาเสนอ" value={ci.quotationFactor} unit="เท่า" onChange={v => save({ ...ci, quotationFactor: v })} />
                    <CalcField label="ราคาเสนอลูกค้า" value={cf.quotation} unit="บาท" strong />
                    <InputNumberField label="ค่าใช้จ่ายดำเนินงาน" percent value={ci.operatingCostRate} unit="ของต้นทุน"
                        onChange={v => save({ ...ci, operatingCostRate: v })} />
                    <InputNumberField label="กำไร" percent value={ci.profitRate} unit="ของต้นทุน" onChange={v => save({ ...ci, profitRate: v })} />
                    <div className="text-[12px] text-gray-500 mt-1">ไม่มี VAT / เงินประกันผลงาน (ตาม Excel)</div>
                </SheetCard>
                {/* The lowest cash point is the banner headline: not repeated as a tile. */}
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4 md:grid-rows-[auto_1fr]">
                    <StatTile label="รับเงินรวม" value={money(cf.totalIncome)} unit="บาท" />
                    <StatTile label="จ่ายรวม (ต้นทุน + ดำเนินงาน)" value={money(cf.totalOutflow)} unit="บาท" />
                    <StatTile label="กำไรตามแผน" value={money(cf.evm.profitPlan)} unit="บาท" tone="good" />
                    <div className="col-span-2 md:col-span-3">
                        <SheetCard title="กราฟกระแสเงินสดรายสัปดาห์" className="h-full">
                            <CashFlowChart buckets={cf.buckets.slice(0, count)} income={cf.incomeWeekly.slice(0, count)}
                                outflow={cf.outflowWeekly.slice(0, count)} cumulative={cf.cumulative.slice(0, count)}
                                min={min && min.bucket < count ? min : null} />
                        </SheetCard>
                    </div>
                </div>
            </div>

            <SheetCard title="งวดรับเงินจากลูกค้า">
                <EditableTable rows={ci.installments} columns={columns} onChange={saveInstallments}
                    newRow={i => ({ label: `งวดที่ ${i}`, pct: 0, bucket: null })} addLabel="+ เพิ่มงวด"
                    footer={(
                        <tr className="font-semibold bg-gray-50">
                            <td className="border border-gray-200 px-2 py-1 text-right text-[13px]" colSpan={2}>รวม</td>
                            <td className={`border border-gray-200 px-2 py-1 text-right tabular-nums text-[13px] ${pctOff ? 'text-red-600' : ''}`}>
                                {formatNumber(cf.installmentPctTotal * 100, 0)}%
                            </td>
                            <td className="border border-gray-200" />
                            <td className="border border-gray-200 px-2 py-1 text-right tabular-nums text-[13px]">
                                {formatNumber(cf.installments.reduce((s, x) => s + x.amount, 0), 2)}
                            </td>
                            <td className="border border-gray-200" colSpan={2} />
                        </tr>
                    )} />
                <div className="text-[12px] text-gray-500 mt-2">
                    จำนวนเงิน = งวด % × ราคาเสนอลูกค้า · รายจ่ายรายสัปดาห์ = ต้นทุน × สัดส่วนงานตามแผน S-Curve + ค่าใช้จ่ายดำเนินงาน
                </div>
            </SheetCard>

            <DetailSection label="วิเคราะห์ผลงานเทียบงบ (EVM) — สำหรับผู้ใช้ขั้นสูง"
                extra={<span className="text-[12px] text-gray-500">SPI {formatNumber(cf.evm.spi, 3)} · CPI {formatNumber(cf.evm.cpi, 3)}</span>}>
                <EvmPanel cf={cf} input={ci} onChange={save} />
            </DetailSection>

            <DetailSection label="ดูตารางละเอียด (ตาราง Cash Flow รายสัปดาห์แบบ Excel)">
                <CashFlowDetailGrid cf={cf} opexRate={ci.operatingCostRate} profitRate={ci.profitRate} />
            </DetailSection>
        </div>
    );
}

export default CashFlowPage;
