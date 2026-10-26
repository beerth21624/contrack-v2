'use client';

import { tempUtilities, type TempUtilitiesInput, type TempUtilitiesPrices } from '@/domain/calculators/temp-utilities';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { JNumber, ResultSummary } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

/** One fixed row (18–24) of the Excel item table. */
interface ItemRow {
    label: string;                        // B รายการ
    qty: number | null;                   // C ปริมาณ (blank on the % rows)
    unit: string;                         // D หน่วย
    hint: string;                         // E สูตร/ที่มา
    price?: keyof TempUtilitiesPrices;    // F ราคาต่อหน่วย (yellow); none on the % rows
    total: number;                        // G รวมราคา
}

const WARNINGS = [
    'ราคานี้เป็นต้นทุนตั้งต้น ปรับ Rate ได้',
    'ถ้าระยะไฟไกลมาก ควรให้ช่างไฟตรวจขนาดสายจริง',
    'อุปกรณ์ต่อท่อและไฟฟ้าคิดเป็น % เพื่อลดความรกใน BOQ',
    'BOQ หลักส่งออกเป็นรายการเดียว: เดินน้ำ–ไฟชั่วคราว',
];

/** Unit prices of the item table, in table order (for the journey's folded price list). */
const PRICE_FIELDS: { key: keyof TempUtilitiesPrices; label: string; unit: string }[] = [
    { key: 'pvcPipe', label: 'ท่อ PVC 1/2 นิ้ว', unit: 'บาท/เส้น' },
    { key: 'faucet', label: 'ก๊อกน้ำ 1/2 นิ้ว', unit: 'บาท/อัน' },
    { key: 'powerBox', label: 'ตู้ไฟฟ้าชั่วคราว 30A', unit: 'บาท/ชุด' },
    { key: 'cable', label: 'สายไฟ THW 1x10 ตร.มม.', unit: 'บาท/ม้วน' },
    { key: 'lightPlug', label: 'หลอดไฟ + ปลั๊กไฟ', unit: 'บาท/ชุด' },
];

type Calc = UseCalculator<TempUtilitiesInput>;

export default function TempUtilitiesPage() {
    const calc = useCalculator(tempUtilities);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;
    const o = (k: string) => outputs[k] ?? 0;
    const setPrice = (key: keyof TempUtilitiesPrices, v: number) =>
        update(p => ({ ...p, prices: { ...p.prices, [key]: v } }));

    const rows: ItemRow[] = [
        { label: 'ท่อ PVC 1/2 นิ้ว', qty: o('pipeQty'), unit: 'เส้น', hint: 'ปัดขึ้น ระยะน้ำ ÷ 4 ม. × Waste', price: 'pvcPipe', total: o('pipeTotal') },
        { label: 'ก๊อกน้ำ 1/2 นิ้ว', qty: o('faucetQty'), unit: 'อัน', hint: 'เท่ากับจำนวนจุดใช้น้ำ', price: 'faucet', total: o('faucetTotal') },
        { label: 'อุปกรณ์ต่อท่อน้ำ', qty: null, unit: '', hint: '% ของค่าวัสดุหลัก', total: o('waterFittings') },
        { label: 'ตู้ไฟฟ้าชั่วคราว 30A', qty: o('powerBoxQty'), unit: 'ชุด', hint: '', price: 'powerBox', total: o('powerBoxTotal') },
        { label: 'สายไฟ THW 1x10 ตร.มม.', qty: o('cableQty'), unit: 'ม้วน', hint: 'ปัดขึ้น ระยะไฟ ÷ 50 ม.', price: 'cable', total: o('cableTotal') },
        { label: 'หลอดไฟ + ปลั๊กไฟ', qty: o('lightPlugQty'), unit: 'ชุด', hint: 'เท่ากับจำนวนจุดไฟ/ปลั๊ก', price: 'lightPlug', total: o('lightPlugTotal') },
        { label: 'อุปกรณ์ประกอบไฟฟ้า', qty: null, unit: '', hint: '% ของค่าวัสดุหลัก', total: o('electricalAcc') },
    ];

    return (
        <CalculatorShell def={tempUtilities} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyView calc={calc} setPrice={setPrice} /> : (
                <>
                    <SheetCard title="ข้อมูลโครงการ">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                            <InputTextField label="ชื่อโครงการ" value={input.projectName} onChange={v => update({ projectName: v })} />
                            <InputTextField label="ผู้คำนวณ" value={input.calculatedBy} onChange={v => update({ calculatedBy: v })} />
                            <InputTextField label="วันที่คำนวณ" value={input.calcDate} placeholder="วว/ดด/ปปปป"
                                onChange={v => update({ calcDate: v })} />
                            <InputTextField label="หมายเหตุ" value={input.remark} onChange={v => update({ remark: v })} />
                        </div>
                    </SheetCard>

                    <SheetCard title="ข้อมูลที่ต้องกรอก">
                        <InputNumberField label="ระยะจากมิเตอร์ไฟ" value={input.powerDistance} unit="ม." hint="ใช้คำนวณสายไฟ THW"
                            onChange={v => update({ powerDistance: v })} />
                        <InputNumberField label="ระยะจากมิเตอร์น้ำ" value={input.waterDistance} unit="ม." hint="ใช้คำนวณท่อ PVC"
                            onChange={v => update({ waterDistance: v })} />
                        <InputNumberField label="จำนวนจุดใช้น้ำ" value={input.waterPoints} digits={0} unit="จุด" hint="เช่น ก๊อกน้ำ / จุดล้าง"
                            onChange={v => update({ waterPoints: v })} />
                        <InputNumberField label="จำนวนจุดไฟ / ปลั๊ก" value={input.powerPoints} digits={0} unit="ชุด" hint="หลอดไฟ + ปลั๊กไฟ"
                            onChange={v => update({ powerPoints: v })} />
                        <Allowances calc={calc} />
                    </SheetCard>

                    <SheetCard title="รายการวัสดุ">
                        <EditableTable<ItemRow>
                            rows={rows}
                            onChange={() => undefined}
                            canDelete={false}
                            columns={[
                                { kind: 'label', key: 'label', title: 'รายการ', get: r => r.label },
                                { kind: 'calc', key: 'qty', title: 'ปริมาณ', width: 80, digits: 0, get: r => r.qty },
                                { kind: 'label', key: 'unit', title: 'หน่วย', width: 60, get: r => r.unit },
                                { kind: 'label', key: 'hint', title: 'สูตร/ที่มา', get: r => <span className="text-[12px] text-gray-500">{r.hint}</span> },
                                {
                                    kind: 'label', key: 'price', title: 'ราคาต่อหน่วย', width: 110,
                                    get: r => {
                                        const key = r.price;
                                        return key === undefined ? null : (
                                            <NumberCell value={input.prices[key]} ariaLabel={`ราคาต่อหน่วย ${r.label}`}
                                                onCommit={v => setPrice(key, v ?? tempUtilities.defaults().prices[key])} />
                                        );
                                    },
                                },
                                { kind: 'calc', key: 'total', title: 'รวมราคา', width: 110, get: r => r.total },
                            ]}
                        />
                    </SheetCard>

                    <SheetCard title="สรุปราคา STEP 02">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <CalcField label="ค่าวัสดุน้ำประปาชั่วคราว" value={outputs.waterMaterial} unit="บาท" />
                                <CalcField label="ค่าวัสดุไฟฟ้าชั่วคราว" value={outputs.powerMaterial} unit="บาท" />
                                <CalcField label="รวมต้นทุน" value={outputs.total} unit="บาท" strong />
                            </div>
                            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                                <div className="font-semibold text-[13px] text-gray-800 mb-1">คำเตือน / ข้อควรระวัง</div>
                                <ol className="list-decimal pl-5 text-[12px] text-gray-600 space-y-0.5">
                                    {WARNINGS.map(w => <li key={w}>{w}</li>)}
                                </ol>
                            </div>
                        </div>
                        <p className="mt-2 text-[12px] text-gray-500">
                            ยอด {formatNumber(outputs.total)} บาท ส่งเข้า BOQ แถว &quot;เดินน้ำ-ไฟชั่วคราว&quot; (ช่องค่าวัสดุ, 1 เหมา) —
                            ค่าแรงของแถวนี้กรอกในหน้า BOQ
                        </p>
                    </SheetCard>
                </>
            )}
        </CalculatorShell>
    );
}

/** Waste and the two % rows (C13:C15). */
function Allowances({ calc }: { calc: Calc }) {
    const { input, update } = calc;
    return (
        <>
            <InputNumberField label="เผื่อวัสดุสูญเสีย" value={input.waste} percent unit="%" hint="แนะนำ 5–10%"
                onChange={v => update({ waste: v })} />
            <InputNumberField label="อุปกรณ์ต่อท่อน้ำ" value={input.waterFittingsPct} percent unit="% ของค่าวัสดุน้ำหลัก"
                hint="ข้องอ/ข้อต่อ/วาล์ว/เทป/กาว" onChange={v => update({ waterFittingsPct: v })} />
            <InputNumberField label="อุปกรณ์ประกอบไฟฟ้า" value={input.electricalAccPct} percent unit="% ของค่าวัสดุไฟหลัก"
                hint="เทปพันสาย/แคล้มป์/อื่น ๆ" onChange={v => update({ electricalAccPct: v })} />
        </>
    );
}

/** Guided journey: distances and points on site first; waste, % rows and unit prices folded. */
function JourneyView({ calc, setPrice }: { calc: Calc; setPrice: (key: keyof TempUtilitiesPrices, v: number) => void }) {
    const { input, update, outputs } = calc;
    const o = (k: string) => outputs[k] ?? 0;
    const nothingYet = o('pipeQty') === 0 && o('cableQty') === 0 && o('faucetQty') === 0 && o('lightPlugQty') === 0;
    return (
        <>
            <SheetCard title="น้ำ-ไฟที่ใช้ระหว่างก่อสร้าง">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                    <JNumber label="ระยะเดินสายไฟ จากมิเตอร์ถึงหน้างาน" value={input.powerDistance} unit="ม."
                        onChange={v => update({ powerDistance: v })} />
                    <JNumber label="ระยะเดินท่อน้ำ จากมิเตอร์ถึงหน้างาน" value={input.waterDistance} unit="ม."
                        onChange={v => update({ waterDistance: v })} />
                    <JNumber label="จำนวนจุดใช้น้ำ" value={input.waterPoints} digits={0} unit="จุด" hint="ก๊อกน้ำ / จุดล้าง"
                        onChange={v => update({ waterPoints: v })} />
                    <JNumber label="จำนวนจุดไฟ / ปลั๊ก" value={input.powerPoints} digits={0} unit="ชุด" hint="หลอดไฟ + ปลั๊ก 1 ชุด"
                        onChange={v => update({ powerPoints: v })} />
                </div>
            </SheetCard>

            <AdvancedSection hint="ตั้งไว้ให้แล้ว ไม่ต้องแก้ก็ได้">
                <Allowances calc={calc} />
                <div className="mt-3 text-[12px] font-semibold text-gray-600">ราคาต่อหน่วย</div>
                {PRICE_FIELDS.map(f => (
                    <InputNumberField key={f.key} label={f.label} value={input.prices[f.key]} unit={f.unit}
                        onChange={v => setPrice(f.key, v)} />
                ))}
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: 'ท่อ PVC', value: o('pipeQty'), unit: 'เส้น', digits: 0 },
                    { label: 'สายไฟ', value: o('cableQty'), unit: 'ม้วน', digits: 0 },
                    { label: 'ค่าวัสดุน้ำ', value: o('waterMaterial'), unit: 'บาท', digits: 0 },
                    { label: 'ค่าวัสดุไฟ', value: o('powerMaterial'), unit: 'บาท', digits: 0 },
                    { label: 'ค่าวัสดุน้ำ-ไฟชั่วคราวรวม', value: o('total'), unit: 'บาท', digits: 0 },
                ]}
                note={nothingYet
                    ? 'กรอกระยะจากมิเตอร์และจำนวนจุดใช้งาน ระบบจะคิดท่อ สายไฟ และอุปกรณ์ให้ (ตอนนี้คิดเฉพาะตู้ไฟชั่วคราว 1 ชุด)'
                    : undefined} />
        </>
    );
}
