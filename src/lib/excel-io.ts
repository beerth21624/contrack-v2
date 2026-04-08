/**
 * Excel I/O Utilities
 * 
 * EXPORT: Uses ExcelJS for professional formatting (colors, borders, bold, number format)
 * IMPORT: Uses SheetJS (xlsx) for lightweight parsing
 */

import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import type { StepSchedule } from '@/data/schedule-data';
import type { PriceItem } from '@/types';
import type { Section } from '@/lib/boq-mapper';

/* ──────────────────── Types ──────────────────── */

export interface ImportError {
    row: number;
    field: string;
    message: string;
}

export interface ScheduleImportRow {
    stepId: number;
    defaultDays: number;
    crews: number;
    productivityRate: number | null;
}

export interface PriceImportRow {
    code: string;
    costMaterial: number;
    costLabor: number;
}

export interface ScheduleImportResult {
    valid: ScheduleImportRow[];
    errors: ImportError[];
    warnings: string[];
}

export interface PriceImportResult {
    valid: PriceImportRow[];
    errors: ImportError[];
    warnings: string[];
}

/* ──────────────── Shared Styles ──────────────── */

const DARK_BG: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } };

const GREEN_BG: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF217346' } };


const WHITE_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
const BOLD_FONT: Partial<ExcelJS.Font> = { bold: true, size: 11 };
const NORMAL_FONT: Partial<ExcelJS.Font> = { size: 11 };
const MUTED_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF8C8C8C' }, size: 10 };

const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
};

const NUM_FMT = '#,##0.00';


function saveWorkbook(wb: ExcelJS.Workbook, filename: string) {
    void wb.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });
}

/* ═══════════════════════════════════════════════════
   EXPORT: Schedule (Productivity Config)
   ═══════════════════════════════════════════════════ */

export function exportScheduleToExcel(data: StepSchedule[], filename = 'Productivity_Config.xlsx') {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Contrack BOQ System';
    wb.created = new Date();
    const ws = wb.addWorksheet('Productivity', {
        views: [{ state: 'frozen', ySplit: 2 }],
    });

    // Title row
    ws.mergeCells('A1:J1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'ตั้งค่า Productivity Rate — Contrack BOQ System';
    titleCell.font = { ...WHITE_FONT, size: 13 };
    titleCell.fill = DARK_BG;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    // Headers
    const headers = [
        'Step ID', 'ชื่อรายการ', 'Title (EN)',
        'ระยะเวลา (วัน)', 'จำนวนทีม (Crews)', 'ทีมประกอบด้วย',
        'Productivity Rate', 'หน่วย (Unit)', 'รายละเอียด', 'ทีม',
    ];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
        cell.font = HEADER_FONT;
        cell.fill = GREEN_BG;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = THIN_BORDER;
    });
    headerRow.height = 28;

    // Data rows
    data.forEach((s, idx) => {
        const row = ws.addRow([
            s.stepId,
            s.title,
            s.titleEn,
            s.defaultDays,
            s.crews,
            s.crewSetup || '',
            s.productivityRate ?? '',
            s.productivityUnit || '',
            s.productivity || '',
            s.team,
        ]);
        const isEven = idx % 2 === 0;
        row.eachCell((cell, colNumber) => {
            cell.font = NORMAL_FONT;
            cell.border = THIN_BORDER;
            if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
            // Number alignment
            if ([1, 4, 5, 7].includes(colNumber)) {
                cell.alignment = { horizontal: 'center' };
            }
            // Number format
            if (colNumber === 4 || colNumber === 7) {
                cell.numFmt = NUM_FMT;
            }
        });
    });

    // Column widths
    ws.columns = [
        { width: 10 },  // Step ID
        { width: 28 },  // ชื่อ
        { width: 24 },  // EN
        { width: 16 },  // วัน
        { width: 16 },  // Crews
        { width: 22 },  // Setup
        { width: 18 },  // Rate
        { width: 14 },  // Unit
        { width: 32 },  // รายละเอียด
        { width: 20 },  // ทีม
    ];

    // Auto filter
    ws.autoFilter = { from: 'A2', to: 'J2' };

    saveWorkbook(wb, filename);
}

/* ═══════════════════════════════════════════════════
   EXPORT: Price List
   ═══════════════════════════════════════════════════ */

export function exportPriceListToExcel(data: PriceItem[], filename = 'Price_List.xlsx') {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Contrack BOQ System';
    wb.created = new Date();
    const ws = wb.addWorksheet('PriceList', {
        views: [{ state: 'frozen', ySplit: 2 }],
    });

    // Title
    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'ราคากลางวัสดุและค่าแรง — Contrack BOQ System';
    titleCell.font = { ...WHITE_FONT, size: 13 };
    titleCell.fill = DARK_BG;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    // Headers
    const headers = ['รหัส (Code)', 'รายการ (Name)', 'หน่วย (Unit)', 'หมวด (Category)', 'ค่าวัสดุ (Material)', 'ค่าแรง (Labor)', 'รวม (Total)'];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
        cell.font = HEADER_FONT;
        cell.fill = GREEN_BG;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = THIN_BORDER;
    });
    headerRow.height = 28;

    // Data
    data.forEach((p, idx) => {
        const row = ws.addRow([
            p.code, p.name, p.uom, p.category,
            p.costMaterial, p.costLabor, p.costMaterial + p.costLabor,
        ]);
        const isEven = idx % 2 === 0;
        row.eachCell((cell, colNumber) => {
            cell.font = NORMAL_FONT;
            cell.border = THIN_BORDER;
            if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
            if (colNumber >= 5) {
                cell.numFmt = NUM_FMT;
                cell.alignment = { horizontal: 'right' };
            }
            if (colNumber === 7) {
                cell.font = { ...BOLD_FONT };
            }
        });
    });

    // Grand Total row
    const totalRow = ws.addRow(['', '', '', 'รวมทั้งหมด', 
        data.reduce((s, p) => s + p.costMaterial, 0),
        data.reduce((s, p) => s + p.costLabor, 0),
        data.reduce((s, p) => s + p.costMaterial + p.costLabor, 0),
    ]);
    totalRow.eachCell((cell, colNumber) => {
        cell.font = { ...WHITE_FONT };
        cell.fill = DARK_BG;
        cell.border = THIN_BORDER;
        if (colNumber >= 5) cell.numFmt = NUM_FMT;
        if (colNumber === 4) cell.alignment = { horizontal: 'right' };
    });

    // Column widths
    ws.columns = [
        { width: 18 }, { width: 38 }, { width: 12 }, { width: 18 },
        { width: 16 }, { width: 16 }, { width: 16 },
    ];

    ws.autoFilter = { from: 'A2', to: 'G2' };

    saveWorkbook(wb, filename);
}

/* ═══════════════════════════════════════════════════
   EXPORT: BOQ Summary
   ═══════════════════════════════════════════════════ */

export function exportBOQSummaryToExcel(sections: Section[], grandTotal: number, filename = 'BOQ_Summary.xlsx') {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Contrack BOQ System';
    wb.created = new Date();
    const ws = wb.addWorksheet('BOQ Summary', {
        views: [{ state: 'frozen', ySplit: 2 }],
    });

    // Title
    ws.mergeCells('A1:I1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'ใบสรุปปริมาณงานและราคา (Bill of Quantities) — Contrack BOQ System';
    titleCell.font = { ...WHITE_FONT, size: 13 };
    titleCell.fill = DARK_BG;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 32;

    // Headers
    const headers = ['ลำดับ', 'รายการ', 'จำนวน', 'หน่วย', 'ค่าวัสดุ/หน่วย', 'รวมวัสดุ', 'ค่าแรง/หน่วย', 'รวมแรงงาน', 'รวมทั้งสิ้น (฿)'];
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
        cell.font = HEADER_FONT;
        cell.fill = GREEN_BG;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = THIN_BORDER;
    });
    headerRow.height = 30;

    // Sections
    const SECTION_BG: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
    const STEP_BADGE_BG: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F54EB' } };

    for (const sec of sections) {
        // Section header — prominent blue band
        const secRow = ws.addRow([
            String(sec.stepNo).padStart(2, '0'),
            `${sec.title} (${sec.titleEn})`,
            '', '', '', '', '', '',
            sec.hasData ? sec.sectionTotal : '',
        ]);
        secRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true, size: 11, color: { argb: 'FF1A1A2E' } };
            cell.fill = SECTION_BG;
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF2F54EB' } },
                left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            };
            // Step number badge
            if (colNumber === 1) {
                cell.fill = STEP_BADGE_BG;
                cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            // Section total
            if (colNumber === 9 && sec.hasData) {
                cell.numFmt = NUM_FMT;
                cell.alignment = { horizontal: 'right' };
                cell.font = { bold: true, size: 12, color: { argb: 'FF2F54EB' } };
            }
        });
        secRow.height = 26;

        // Detail rows
        if (sec.hasData) {
            sec.rows.forEach((row, ri) => {
                const dataRow = ws.addRow([
                    row.key,
                    row.name,
                    row.qty ?? 0,
                    row.uom,
                    row.matUnit ?? 0,
                    row.matTotal ?? 0,
                    row.labUnit ?? 0,
                    row.labTotal ?? 0,
                    row.total ?? 0,
                ]);
                const isEven = ri % 2 === 0;
                dataRow.eachCell((cell, colNumber) => {
                    cell.font = NORMAL_FONT;
                    cell.border = THIN_BORDER;
                    if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                    // Number columns
                    if ([3, 5, 6, 7, 8, 9].includes(colNumber)) {
                        cell.numFmt = NUM_FMT;
                        cell.alignment = { horizontal: 'right' };
                    }
                    // Total column bold
                    if (colNumber === 9) {
                        cell.font = { ...BOLD_FONT };
                    }
                    // Unit price muted
                    if (colNumber === 5 || colNumber === 7) {
                        cell.font = { ...MUTED_FONT };
                    }
                });
            });
        }
    }

    // Grand Total
    const totalRow = ws.addRow([
        '', 'ยอดรวมทั้งโครงการ / Grand Total',
        '', '', '', '', '', '', grandTotal,
    ]);
    totalRow.eachCell((cell, colNumber) => {
        cell.font = { ...WHITE_FONT, size: 13 };
        cell.fill = DARK_BG;
        cell.border = THIN_BORDER;
        if (colNumber === 9) {
            cell.numFmt = NUM_FMT;
            cell.alignment = { horizontal: 'right' };
        }
    });
    totalRow.height = 32;

    // Column widths
    ws.columns = [
        { width: 10 },  // ลำดับ
        { width: 42 },  // รายการ
        { width: 14 },  // จำนวน
        { width: 10 },  // หน่วย
        { width: 16 },  // ค่าวัสดุ/หน่วย
        { width: 18 },  // รวมวัสดุ
        { width: 16 },  // ค่าแรง/หน่วย
        { width: 18 },  // รวมแรงงาน
        { width: 20 },  // รวมทั้งสิ้น
    ];

    saveWorkbook(wb, filename);
}

/* ═══════════════════════════════════════════════════
   IMPORT: Schedule (Productivity) — uses SheetJS
   ═══════════════════════════════════════════════════ */

export function parseScheduleExcel(
    file: File,
    existingData: StepSchedule[],
): Promise<ScheduleImportResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const sheetName = wb.SheetNames[0];
                const ws = sheetName ? wb.Sheets[sheetName] : undefined;
                if (!ws) throw new Error('ไม่พบ sheet ในไฟล์');
                const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

                const errors: ImportError[] = [];
                const warnings: string[] = [];
                const valid: ScheduleImportRow[] = [];
                const existingIds = new Set(existingData.map(s => s.stepId));

                if (jsonRows.length === 0) {
                    errors.push({ row: 0, field: '-', message: 'ไฟล์ไม่มีข้อมูล' });
                    resolve({ valid, errors, warnings });
                    return;
                }

                // Check required columns
                const firstRow = jsonRows[0];
                if (!firstRow) {
                    errors.push({ row: 0, field: '-', message: 'ไฟล์ไม่มีข้อมูลแถวนแรก' });
                    resolve({ valid, errors, warnings });
                    return;
                }
                const requiredCols = ['Step ID', 'ระยะเวลา (วัน)', 'จำนวนทีม (Crews)'];
                for (const col of requiredCols) {
                    if (!(col in firstRow)) {
                        errors.push({ row: 0, field: col, message: `ไม่พบคอลัมน์ "${col}" ในไฟล์` });
                    }
                }
                if (errors.length > 0) {
                    resolve({ valid, errors, warnings });
                    return;
                }

                jsonRows.forEach((row, idx) => {
                    const rowNum = idx + 2;
                    const stepId = Number(row['Step ID']);
                    const defaultDays = Number(row['ระยะเวลา (วัน)']);
                    const crews = Number(row['จำนวนทีม (Crews)']);
                    const rateRaw = row['Productivity Rate'];
                    const productivityRate = rateRaw === '' || rateRaw === null || rateRaw === undefined
                        ? null
                        : Number(rateRaw);

                    if (isNaN(stepId) || !existingIds.has(stepId)) {
                        errors.push({ row: rowNum, field: 'Step ID', message: `Step ID "${row['Step ID']}" ไม่ตรงกับข้อมูลในระบบ` });
                        return;
                    }
                    if (isNaN(defaultDays) || defaultDays < 0.5) {
                        errors.push({ row: rowNum, field: 'ระยะเวลา', message: `Step ${stepId}: ระยะเวลา "${row['ระยะเวลา (วัน)']}" ไม่ถูกต้อง (ต้อง ≥ 0.5)` });
                        return;
                    }
                    if (isNaN(crews) || crews < 1) {
                        errors.push({ row: rowNum, field: 'Crews', message: `Step ${stepId}: จำนวนทีม "${row['จำนวนทีม (Crews)']}" ไม่ถูกต้อง (ต้อง ≥ 1)` });
                        return;
                    }
                    if (productivityRate !== null && (isNaN(productivityRate) || productivityRate < 0)) {
                        errors.push({ row: rowNum, field: 'Rate', message: `Step ${stepId}: Productivity Rate "${rateRaw}" ไม่ถูกต้อง` });
                        return;
                    }
                    valid.push({ stepId, defaultDays, crews, productivityRate });
                });

                const importedIds = new Set(valid.map(v => v.stepId));
                existingData.forEach(s => {
                    if (!importedIds.has(s.stepId)) {
                        warnings.push(`Step ${s.stepId} (${s.title}) ไม่อยู่ในไฟล์ — จะใช้ค่าเดิม`);
                    }
                });

                resolve({ valid, errors, warnings });
            } catch {
                reject(new Error('ไม่สามารถอ่านไฟล์ได้ — กรุณาตรวจสอบว่าเป็นไฟล์ .xlsx'));
            }
        };
        reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์'));
        reader.readAsArrayBuffer(file);
    });
}

/* ═══════════════════════════════════════════════════
   IMPORT: Price List — uses SheetJS
   ═══════════════════════════════════════════════════ */

export function parsePriceListExcel(
    file: File,
    existingData: PriceItem[],
): Promise<PriceImportResult> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const sheetName = wb.SheetNames[0];
                const ws = sheetName ? wb.Sheets[sheetName] : undefined;
                if (!ws) throw new Error('ไม่พบ sheet ในไฟล์');
                const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

                const errors: ImportError[] = [];
                const warnings: string[] = [];
                const valid: PriceImportRow[] = [];
                const existingCodes = new Set(existingData.map(p => p.code));

                if (jsonRows.length === 0) {
                    errors.push({ row: 0, field: '-', message: 'ไฟล์ไม่มีข้อมูล' });
                    resolve({ valid, errors, warnings });
                    return;
                }

                const firstRow = jsonRows[0];
                if (!firstRow) {
                    errors.push({ row: 0, field: '-', message: 'ไฟล์ไม่มีข้อมูลแถวแรก' });
                    resolve({ valid, errors, warnings });
                    return;
                }
                const requiredCols = ['รหัส (Code)', 'ค่าวัสดุ (Material)', 'ค่าแรง (Labor)'];
                for (const col of requiredCols) {
                    if (!(col in firstRow)) {
                        errors.push({ row: 0, field: col, message: `ไม่พบคอลัมน์ "${col}" ในไฟล์` });
                    }
                }
                if (errors.length > 0) {
                    resolve({ valid, errors, warnings });
                    return;
                }

                jsonRows.forEach((row, idx) => {
                    const rowNum = idx + 2;
                    const rawCode = row['รหัส (Code)'];
                    const code = (typeof rawCode === 'string' || typeof rawCode === 'number') ? String(rawCode).trim() : '';
                    const costMaterial = Number(row['ค่าวัสดุ (Material)']);
                    const costLabor = Number(row['ค่าแรง (Labor)']);

                    if (!code || !existingCodes.has(code)) {
                        errors.push({ row: rowNum, field: 'Code', message: `รหัส "${code}" ไม่ตรงกับข้อมูลในระบบ` });
                        return;
                    }
                    if (isNaN(costMaterial) || costMaterial < 0) {
                        errors.push({ row: rowNum, field: 'Material', message: `${code}: ค่าวัสดุ "${row['ค่าวัสดุ (Material)']}" ไม่ถูกต้อง` });
                        return;
                    }
                    if (isNaN(costLabor) || costLabor < 0) {
                        errors.push({ row: rowNum, field: 'Labor', message: `${code}: ค่าแรง "${row['ค่าแรง (Labor)']}" ไม่ถูกต้อง` });
                        return;
                    }
                    valid.push({ code, costMaterial, costLabor });
                });

                const importedCodes = new Set(valid.map(v => v.code));
                existingData.forEach(p => {
                    if (!importedCodes.has(p.code)) {
                        warnings.push(`${p.code} (${p.name}) ไม่อยู่ในไฟล์ — จะใช้ค่าเดิม`);
                    }
                });

                resolve({ valid, errors, warnings });
            } catch {
                reject(new Error('ไม่สามารถอ่านไฟล์ได้ — กรุณาตรวจสอบว่าเป็นไฟล์ .xlsx'));
            }
        };
        reader.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการอ่านไฟล์'));
        reader.readAsArrayBuffer(file);
    });
}
