'use client';

import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Installment {
    label: string;
    percent: number;
    triggerWeek: number;
}

interface CashFlowConfig {
    depositPercent: number;
    operatingCostPercent: number;
    profitPercent: number;
    installments: Installment[];
}

interface WeeklyCashFlow {
    weekNumber: number;
    weekLabel: string;
    cashIn: number;
    cashInItems: string[];
    cashOut: number;
    constructionCost: number;
    operatingCost: number;
    netWeekly: number;
    cumulative: number;
}

interface QuotationData {
    result: {
        totalConstructionCost: number;
        quotationPrice: number;
        totalProfit: number;
        totalOperating: number;
        totalCashIn: number;
        totalCashOut: number;
        minCashBalance: number;
        minCashWeek: number;
    };
    config: CashFlowConfig;
    weeks: WeeklyCashFlow[];
    financialConfig: { taxPercent: number; overheadPercent: number; profitPercent: number; contingencyPercent: number };
    locale?: string;
}

// ── Formatter ─────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => `${(v * 100).toFixed(0)}%`;

// ── Styles ────────────────────────────────────────────────────────────────────

const ACCENT = '#1a1a2e';
const BORDER = '#d9d9d9';

// ── PDF Page Component ────────────────────────────────────────────────────────

export default function QuotationPdfPage() {
    const [data, setData] = useState<QuotationData | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('quotation-pdf-data');
            if (raw) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setData(JSON.parse(raw) as QuotationData);
            }
        } catch (e) {
            console.error('Failed to load quotation data:', e);
        }
        setReady(true);
    }, []);

    if (!ready) {
        return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Sarabun, sans-serif' }}>กำลังโหลดข้อมูล...</div>;
    }

    if (!data) {
        return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Sarabun, sans-serif' }}>ไม่พบข้อมูล</div>;
    }

    const { result, config } = data;
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    const subtotal = result.quotationPrice;
    const vat = parseFloat((subtotal * (data.financialConfig.taxPercent / 100)).toFixed(2));
    const grandTotal = subtotal + vat;

    const todayDate = new Date();
    const validityDate = new Date(todayDate);
    validityDate.setDate(validityDate.getDate() + 30);
    const validityStr = validityDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    const locale = data.locale ?? 'th';

    const t = locale === 'en' ? {
        loading: 'Loading data...',
        noData: 'No Data Found',
        title: 'Project Quotation',
        subtitle: 'QUOTATION',
        no: 'No.:',
        date: 'Date:',
        validUntil: 'Valid Until:',
        to: 'To:',
        address: 'Address:',
        tel: 'Tel:',
        project: 'Project:',
        defaultProject: 'Residential/Commercial Building Construction',
        location: 'Location:',
        contact: 'Contact:',
        companyName: 'NEW GEN CONTRACTOR CO., LTD.',
        companyLabel: 'NEW GEN CONTRACTOR CO., LTD.',
        companyAddress: '123/45 Vibhavadi Rangsit Rd, Din Daeng, Bangkok 10400',
        taxId: 'Tax ID: 01055xxxxxxxx • Tel: 02-123-4567',
        subject: 'Subject:',
        subjectDesc: 'Quotation for construction project',
        introText: 'We are pleased to submit our quotation with the following details:',
        colNo: 'No.',
        colDesc: 'Description',
        colQty: 'Qty',
        colUnit: 'Unit',
        colAmt: 'Amount',
        jobDesc: 'Turnkey Construction services',
        jobInc1: '- Includes standard construction materials',
        jobInc2: '- Includes labor and machinery',
        jobInc3: '- Includes all operational and management costs',
        jobUnit: 'Job',
        subTotal: 'Sub Total',
        vat: 'VAT',
        grandTotal: 'Grand Total',
        paymentTerms: 'Payment Terms',
        termNo: 'No.',
        termDesc: 'Description',
        termPct: 'Ratio',
        termAmt: 'Amount (excl. VAT)',
        termInstWeek: 'Week',
        termCond: 'Terms & Conditions',
        cond1: 'This quotation is valid for 30 days from the issue date.',
        cond2: 'Warranty period is 1 year from the handover date.',
        cond3: 'Payment must be made within 7 working days after receiving invoice.',
        cond4: 'Variation orders (VO) will be quoted separately if there are changes.',
        sigAuthLabel: 'On behalf of NEW GEN CONTRACTOR',
        sigAuthTxt: 'Authorized Signature',
        sigClientLabel: 'Accepted By',
        sigClientTxt: 'Client Signature',
        dateLabel: 'Date: ......../......../..............',
      } : {
        loading: 'กำลังโหลดข้อมูล...',
        noData: 'ไม่พบข้อมูล',
        title: 'ใบเสนอราคา',
        subtitle: 'QUOTATION',
        no: 'เลขที่ (No.):',
        date: 'วันที่ (Date):',
        validUntil: 'ยืนราคาถึง (Valid Until):',
        to: 'ลูกค้า (To):',
        address: 'ที่อยู่ (Address):',
        tel: 'โทร (Tel):',
        project: 'โครงการ:',
        defaultProject: 'โครงการรับเหมาก่อสร้างที่พักอาศัย/อาคาร',
        location: 'สถานที่ตั้ง:',
        contact: 'ผู้ติดต่อ:',
        companyName: 'บริษัทผู้รับเหมาพันธุ์ใหม่',
        companyLabel: 'NEW GEN CONTRACTOR CO., LTD.',
        companyAddress: '123/45 ถนนวิภาวดีรังสิต แขวงดินแดง เขตดินแดง กรุงเทพมหานคร 10400',
        taxId: 'เลขประจำตัวผู้เสียภาษี: 01055xxxxxxxx • โทรศัพท์: 02-123-4567',
        subject: 'เรื่อง:',
        subjectDesc: 'เสนอราคาหน้างานรับเหมาก่อสร้างโครงการ',
        introText: 'ทางบริษัทฯ มีความยินดีขอเสนอราคาค่าก่อสร้าง โดยมีรายละเอียดดังต่อไปนี้:',
        colNo: 'ลำดับ\n(No.)',
        colDesc: 'รายการ\n(Description)',
        colQty: 'จำนวน\n(Qty)',
        colUnit: 'หน่วย\n(Unit)',
        colAmt: 'จำนวนเงิน\n(Amount)',
        jobDesc: 'งานรับเหมาก่อสร้างโครงการแบบครบวงจร (Turnkey Construction)',
        jobInc1: '- รวมค่าวัสดุก่อสร้างตามมาตรฐาน',
        jobInc2: '- รวมค่าแรงงานและเครื่องจักรตลอดการก่อสร้าง',
        jobInc3: '- รวมค่าดำเนินการและควบคุมงานทั้งหมด',
        jobUnit: 'งาน (Job)',
        subTotal: 'รวมเป็นเงิน (Sub Total)',
        vat: 'ภาษีมูลค่าเพิ่ม (VAT)',
        grandTotal: 'จำนวนเงินรวมทั้งสิ้น (Grand Total)',
        paymentTerms: 'เงื่อนไขการชำระเงิน (Payment Terms)',
        termNo: 'งวดที่',
        termDesc: 'รายละเอียดการเบิกงวดงาน',
        termPct: 'สัดส่วน',
        termAmt: 'จำนวนเงิน (ไม่รวม VAT)',
        termInstWeek: 'สัปดาห์ที่',
        termCond: 'เงื่อนไขและข้อตกลง (Terms & Conditions)',
        cond1: 'ราคานี้กำหนดยืนราคาเป็นเวลา 30 วัน นับจากวันที่ออกใบเสนอราคา',
        cond2: 'การรับประกันผลงานก่อสร้าง เป็นระยะเวลา 1 ปี นับจากวันที่ส่งมอบงาน',
        cond3: 'ผู้ว่าจ้างตกลงชำระเงินตามงวดงานที่ได้ระบุไว้ในตารางด้านบน ภายใน 7 วันทำการหลังจากได้รับใบแจ้งหนี้',
        cond4: 'ในกรณีมีการปรับเปลี่ยนแบบหรือเพิ่มลดงาน จะมีการทำใบเสนอราคาเพิ่มเติม (Variation Order) แยกต่างหาก',
        sigAuthLabel: 'ในนาม บริษัทผู้รับเหมาพันธุ์ใหม่',
        sigAuthTxt: 'ผู้มีอำนาจลงนาม (Authorized Signature)',
        sigClientLabel: 'ตอบรับข้อเสนอราคา (Accepted By)',
        sigClientTxt: 'ผู้ว่าจ้าง (Client Signature)',
        dateLabel: 'วันที่ (Date): ......../......../..............',
      };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap');
                @page {
                    margin: 10mm 12mm;
                    size: A4 portrait;
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #fff; }
                .page-break-avoid { page-break-inside: avoid; break-inside: avoid; }
            `}</style>

            <div style={{
                fontFamily: "'Sarabun', sans-serif",
                color: '#1a1a1a',
                background: '#ffffff',
                lineHeight: 1.5,
                maxWidth: '100%',
                padding: '24px 32px',
            }}>
                {/* ── Header ─────────────────────────────────────────────── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{
                            width: 64, height: 64, background: ACCENT, borderRadius: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 28, fontWeight: 900
                        }}>
                            EQ
                        </div>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>
                                {t.companyName}
                            </div>
                            <div style={{ fontSize: 13, color: '#444' }}>
                                {t.companyLabel}
                            </div>
                            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                {t.companyAddress}<br/>
                                {t.taxId}
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{
                            fontSize: 26, fontWeight: 900, color: ACCENT,
                            lineHeight: 1, marginBottom: 6,
                        }}>
                            ใบเสนอราคา
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: 2, marginBottom: 12 }}>
                            QUOTATION
                        </div>
                        <div style={{
                            display: 'inline-grid', gridTemplateColumns: 'auto auto',
                            gap: '4px 12px', fontSize: 11, textAlign: 'left',
                            background: '#f8fafc', padding: '10px 14px',
                            borderRadius: 6, border: `1px solid ${BORDER}`,
                        }}>
                            <div style={{ fontWeight: 700, color: ACCENT }}>{t.no}</div>
                            <div>QT-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}-001</div>
                            <div style={{ fontWeight: 700, color: ACCENT }}>{t.date}</div>
                            <div>{today}</div>
                            <div style={{ fontWeight: 700, color: ACCENT }}>{t.validUntil}</div>
                            <div>{validityStr}</div>
                        </div>
                    </div>
                </div>

                <div style={{ borderBottom: `2px solid ${ACCENT}`, marginBottom: 20 }} />

                {/* ── Client Info ───────────────────────────────────────── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 32,
                    fontSize: 12,
                    marginBottom: 24,
                }}>
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, color: ACCENT }}>{t.to}</div>
                            <div style={{ borderBottom: '1px dotted #ccc' }}>........................................................................</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, color: ACCENT }}>{t.address}</div>
                            <div style={{ borderBottom: '1px dotted #ccc', minHeight: 20 }}></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
                            <div style={{ fontWeight: 700, color: ACCENT }}>{t.tel}</div>
                            <div style={{ borderBottom: '1px dotted #ccc' }}>........................................................................</div>
                        </div>
                    </div>
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, color: ACCENT }}>{t.project}</div>
                            <div style={{ borderBottom: '1px dotted #ccc' }}>{t.defaultProject}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, color: ACCENT }}>{t.location}</div>
                            <div style={{ borderBottom: '1px dotted #ccc', minHeight: 20 }}></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
                            <div style={{ fontWeight: 700, color: ACCENT }}>{t.contact}</div>
                            <div style={{ borderBottom: '1px dotted #ccc' }}>........................................................................</div>
                        </div>
                    </div>
                </div>

                <div style={{ fontSize: 13, marginBottom: 16 }}>
                    <span style={{ fontWeight: 700 }}>{t.subject}</span> {t.subjectDesc}<br/>
                    {t.introText}
                </div>

                {/* ── Main Item Table ───────────────────────────────────── */}
                <div className="page-break-avoid" style={{ marginBottom: 24 }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', border: `1px solid ${ACCENT}` }}>
                        <thead>
                            <tr style={{ background: ACCENT }}>
                                <th style={{ padding: '10px', color: '#fff', textAlign: 'center', width: 60, fontWeight: 600, whiteSpace: 'pre-wrap' }}>{t.colNo}</th>
                                <th style={{ padding: '10px', color: '#fff', textAlign: 'center', fontWeight: 600, whiteSpace: 'pre-wrap' }}>{t.colDesc}</th>
                                <th style={{ padding: '10px', color: '#fff', textAlign: 'center', width: 80, fontWeight: 600, whiteSpace: 'pre-wrap' }}>{t.colQty}</th>
                                <th style={{ padding: '10px', color: '#fff', textAlign: 'center', width: 80, fontWeight: 600, whiteSpace: 'pre-wrap' }}>{t.colUnit}</th>
                                <th style={{ padding: '10px', color: '#fff', textAlign: 'right', width: 140, fontWeight: 600, whiteSpace: 'pre-wrap' }}>{t.colAmt}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: `1px solid ${BORDER}`, height: 80, verticalAlign: 'top' }}>
                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>1</td>
                                <td style={{ padding: '12px 10px' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{t.jobDesc}</div>
                                    <div style={{ color: '#555', fontSize: 11, lineHeight: 1.6 }}>
                                        {t.jobInc1}<br/>
                                        {t.jobInc2}<br/>
                                        {t.jobInc3}
                                    </div>
                                </td>
                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>1</td>
                                <td style={{ padding: '12px 10px', textAlign: 'center' }}>{t.jobUnit}</td>
                                <td style={{ padding: '12px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {fmt(subtotal)}
                                </td>
                            </tr>
                            <tr style={{ borderBottom: `1px solid ${BORDER}`, height: 120 }}>
                                <td></td><td></td><td></td><td></td><td></td>
                            </tr>
                        </tbody>
                    </table>
                    
                    {/* Summary Block */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -1 }}>
                        <table style={{ width: '50%', fontSize: 12, borderCollapse: 'collapse', border: `1px solid ${ACCENT}`, borderTop: 'none' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '8px 12px', fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>{t.subTotal}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}`, borderLeft: `1px solid ${ACCENT}`, width: 140 }}>
                                        {fmt(subtotal)}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px 12px', fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>{t.vat.replace('VAT', `VAT ${data.financialConfig.taxPercent}%`)}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: `1px solid ${BORDER}`, borderLeft: `1px solid ${ACCENT}` }}>
                                        {fmt(vat)}
                                    </td>
                                </tr>
                                <tr style={{ background: '#f1f5f9' }}>
                                    <td style={{ padding: '12px', fontWeight: 800, fontSize: 13 }}>{t.grandTotal}</td>
                                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: ACCENT, fontVariantNumeric: 'tabular-nums', borderLeft: `1px solid ${ACCENT}` }}>
                                        ฿{fmt(grandTotal)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Installment Schedule ─────────────────────────────── */}
                <div className="page-break-avoid" style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 8, textDecoration: 'underline' }}>
                        {t.paymentTerms}
                    </div>
                    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', border: `1px solid ${BORDER}` }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${BORDER}` }}>
                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, width: 50 }}>{t.termNo}</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>{t.termDesc}</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, width: 70 }}>{t.termPct}</th>
                                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, width: 140 }}>{t.termAmt}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {config.installments.map((inst, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', color: '#555' }}>{i + 1}</td>
                                    <td style={{ padding: '6px 10px' }}>{inst.label} ({t.termInstWeek} {inst.triggerWeek})</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>{fmtPct(inst.percent)}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        {fmt(subtotal * inst.percent)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Terms and Conditions ─────────────────────────────── */}
                <div className="page-break-avoid" style={{ marginBottom: 32, fontSize: 11, color: '#444' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: '#1a1a1a' }}>{t.termCond}</div>
                    <ol style={{ paddingLeft: 20 }}>
                        <li style={{ paddingBottom: 2 }}>{t.cond1}</li>
                        <li style={{ paddingBottom: 2 }}>{t.cond2}</li>
                        <li style={{ paddingBottom: 2 }}>{t.cond3}</li>
                        <li style={{ paddingBottom: 2 }}>{t.cond4}</li>
                    </ol>
                </div>

                {/* ── Signature Section ───────────────────────────────── */}
                <div className="page-break-avoid" style={{ marginTop: 20 }}>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                        gap: 24,
                    }}>
                        {/* ผู้เสนอราคา */}
                        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>{t.sigAuthLabel}</div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderBottom: '1px dotted #ccc', margin: '0 20px 8px 20px', height: 20 }}></div>
                                <div style={{ fontSize: 11 }}>{t.sigAuthTxt}</div>
                                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{t.dateLabel}</div>
                            </div>
                        </div>
                        {/* ผู้ว่าจ้าง */}
                        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, background: '#f8fafc' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 40, textAlign: 'center' }}>{t.sigClientLabel}</div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ borderBottom: '1px dotted #ccc', margin: '0 20px 8px 20px', height: 20 }}></div>
                                <div style={{ fontSize: 11 }}>{t.sigClientTxt}</div>
                                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{t.dateLabel}</div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
}
