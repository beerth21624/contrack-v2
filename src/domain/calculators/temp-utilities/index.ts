// Sheet "น้ำไฟชั่วคราว" (Excel v5 sheet 37) → BOQ (Home) section 2, row 16 "เดินน้ำ-ไฟชั่วคราว" (1 เหมา).
// Spec: docs/excel-spec/01-boq-home-and-steps-00-05.md, Section 2.
// Decision D9: v5 layout only (no MEA tables, no labour % / profit rows of the deck-p10 variant).
import { ceilingTo } from '../../boq/engine';
import { defineCalculator } from '../types';

/** Unit prices of the item table (column F, yellow). F20 and F24 are yellow in Excel but unused. */
export interface TempUtilitiesPrices {
    pvcPipe: number;      // F18 ท่อ PVC 1/2 นิ้ว (บาท/เส้น)
    faucet: number;       // F19 ก๊อกน้ำ 1/2 นิ้ว (บาท/อัน)
    powerBox: number;     // F21 ตู้ไฟฟ้าชั่วคราว 30A (บาท/ชุด)
    cable: number;        // F22 สายไฟ THW 1x10 ตร.มม. (บาท/ม้วน)
    lightPlug: number;    // F23 หลอดไฟ + ปลั๊กไฟ (บาท/ชุด)
}

export interface TempUtilitiesInput {
    projectName: string;      // C5 ชื่อโครงการ
    calculatedBy: string;     // F5 ผู้คำนวณ
    calcDate: string;         // C6 วันที่คำนวณ
    remark: string;           // F6 หมายเหตุ
    powerDistance: number;    // C9 ระยะจากมิเตอร์ไฟ (ม.)
    waterDistance: number;    // C10 ระยะจากมิเตอร์น้ำ (ม.)
    waterPoints: number;      // C11 จำนวนจุดใช้น้ำ (จุด)
    powerPoints: number;      // C12 จำนวนจุดไฟ / ปลั๊ก (ชุด)
    waste: number;            // C13 เผื่อวัสดุสูญเสีย (fraction)
    waterFittingsPct: number; // C14 อุปกรณ์ต่อท่อน้ำ (fraction of pipe + faucets)
    electricalAccPct: number; // C15 อุปกรณ์ประกอบไฟฟ้า (fraction of cable + lights)
    prices: TempUtilitiesPrices;
}

/** Metres per PVC stick (E18 "ระยะน้ำ ÷ 4 ม.") and per THW roll (E22 "ระยะไฟ ÷ 50 ม."). */
export const PVC_STICK_M = 4;
export const CABLE_ROLL_M = 50;

const num = (v: number) => (Number.isFinite(v) ? v : 0);

export const tempUtilities = defineCalculator<TempUtilitiesInput>({
    id: 'temp-utilities',
    sheetName: 'น้ำไฟชั่วคราว',
    title: 'โปรแกรมคำนวณ เดินน้ำ–ไฟชั่วคราว',
    titleEn: 'Temporary Utilities Calculator',
    sections: [2],
    deps: [],
    defaults: () => ({
        projectName: '',
        calculatedBy: '',
        calcDate: '',
        remark: '',
        powerDistance: 25,
        waterDistance: 25,
        waterPoints: 3,
        powerPoints: 6,
        waste: 0.1,
        waterFittingsPct: 0.3,
        electricalAccPct: 0.15,
        prices: { pvcPipe: 60, faucet: 120, powerBox: 1200, cable: 2500, lightPlug: 200 },
    }),
    // Site values (distances to the meters, points) empty; waste, % rows and prices keep Excel v5.
    // The 30A temporary power box is 1 ชุด regardless of the site (C21 = 1), so a blank project still costs
    // its 1,200 บาท.
    blank: () => ({
        projectName: '',
        calculatedBy: '',
        calcDate: '',
        remark: '',
        powerDistance: 0,
        waterDistance: 0,
        waterPoints: 0,
        powerPoints: 0,
        waste: 0.1,
        waterFittingsPct: 0.3,
        electricalAccPct: 0.15,
        prices: { pvcPipe: 60, faucet: 120, powerBox: 1200, cable: 2500, lightPlug: 200 },
    }),
    compute: (input) => {
        const waste = num(input.waste);
        const p = input.prices;
        // Quantities (column C)
        const pipeQty = ceilingTo((num(input.waterDistance) / PVC_STICK_M) * (1 + waste), 1);   // C18
        const faucetQty = num(input.waterPoints);                                                // C19
        const powerBoxQty = 1;                                                                   // C21 =1
        const cableQty = ceilingTo((num(input.powerDistance) / CABLE_ROLL_M) * (1 + waste), 1); // C22
        const lightPlugQty = num(input.powerPoints);                                             // C23
        // Totals (column G)
        const pipeTotal = num(p.pvcPipe) * pipeQty;                                 // G18
        const faucetTotal = num(p.faucet) * faucetQty;                              // G19
        const waterFittings = (pipeTotal + faucetTotal) * num(input.waterFittingsPct); // G20
        const powerBoxTotal = num(p.powerBox) * powerBoxQty;                        // G21
        const cableTotal = num(p.cable) * cableQty;                                 // G22
        const lightPlugTotal = num(p.lightPlug) * lightPlugQty;                     // G23
        const electricalAcc = (cableTotal + lightPlugTotal) * num(input.electricalAccPct); // G24
        // Summary
        const waterMaterial = pipeTotal + faucetTotal + waterFittings;                       // C27 SUM(G18:G20)
        const powerMaterial = powerBoxTotal + cableTotal + lightPlugTotal + electricalAcc;   // C28 SUM(G21:G24)
        return {
            pipeQty, faucetQty, powerBoxQty, cableQty, lightPlugQty,
            pipeTotal, faucetTotal, waterFittings, powerBoxTotal, cableTotal, lightPlugTotal, electricalAcc,
            waterMaterial, powerMaterial,
            total: waterMaterial + powerMaterial,                                            // C30 SUM(C27:C29)
        };
    },
    // Excel retypes C30 (6,469) as 6,500 in BOQ I16; decision D3 links it. K16 labour (1,500) has no
    // source in v5 and stays the BOQ's typed value.
    boqLinks: [{ line: 'R16', field: 'mat', output: 'total' }],
});
