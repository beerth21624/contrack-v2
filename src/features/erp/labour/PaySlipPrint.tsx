'use client';

// ─── /print/pay-period/<id>: the wage payment summary of a pay period (one row per person, signature column) ───
import { Alert, Skeleton } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { PrintFrame } from '../shared/PrintFrame';
import { usePayPeriod } from './hooks';

const cell: React.CSSProperties = { border: '1px solid #000', padding: '4px 6px', fontSize: '10.5pt' };
const num: React.CSSProperties = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' };

export function PaySlipPrint({ periodId }: { periodId: string }) {
    const t = useTranslations('labour.print');
    const tm = useTranslations('enums.labourPaymentMethod');
    const toText = useErrorMessage();
    const fmt = useFormat();
    const locale = useLocale();
    const q = usePayPeriod(periodId);
    const p = q.data;
    const money = (v: number | null): string => (v === null ? '–' : fmt.money(v));
    return (
        <PrintFrame language={locale} title={p === undefined ? undefined : `${t('title')} ${p.periodKey}`} ready={p !== undefined}>
            {q.isError ? <Alert type="error" showIcon title={toText(q.error)} />
                : p === undefined ? <Skeleton active />
                    : (
                        <div>
                            <h1 style={{ fontSize: '16pt', margin: 0, textAlign: 'center' }}>{t('title')}</h1>
                            <p style={{ textAlign: 'center', margin: '4px 0 12px' }}>
                                {t('period')} {p.periodKey} ({fmt.date(p.startDate)} – {fmt.date(p.endDate)})
                            </p>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ ...cell, width: 30 }}>#</th>
                                        <th style={cell}>{t('person')}</th>
                                        <th style={cell}>{t('days')}</th>
                                        <th style={cell}>{t('ot')}</th>
                                        <th style={cell}>{t('gross')}</th>
                                        <th style={cell}>{t('advance')}</th>
                                        <th style={cell}>{t('other')}</th>
                                        <th style={cell}>{t('net')}</th>
                                        <th style={{ ...cell, width: 110 }}>{t('signature')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {p.lines.map((l, i) => (
                                        <tr key={l.id}>
                                            <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>
                                            <td style={cell}>{l.personName}</td>
                                            <td style={num}>{l.days}</td>
                                            <td style={num}>{l.otHours}</td>
                                            <td style={num}>{money(l.gross)}</td>
                                            <td style={num}>{money(l.advanceDeduction)}</td>
                                            <td style={num}>{money(l.otherDeduction)}</td>
                                            <td style={{ ...num, fontWeight: 600 }}>{money(l.net)}</td>
                                            <td style={cell} />
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td style={cell} colSpan={4}><b>{t('total')}</b></td>
                                        <td style={num}><b>{money(p.wagesHidden ? null : p.gross)}</b></td>
                                        <td style={num}><b>{money(p.wagesHidden ? null : p.advanceDeduction)}</b></td>
                                        <td style={num} />
                                        <td style={num}><b>{money(p.wagesHidden ? null : p.net)}</b></td>
                                        <td style={cell} />
                                    </tr>
                                </tfoot>
                            </table>
                            {p.paidAt !== null && p.paymentMethod !== null && (
                                <p style={{ marginTop: 10 }}>{t('paidOn')} {fmt.date(p.paidDate ?? p.paidAt)} · {tm(p.paymentMethod)}</p>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 48 }}>
                                {[t('preparedBy'), t('approvedBy')].map(label => (
                                    <div key={label} style={{ textAlign: 'center', width: 200 }}>
                                        <div style={{ borderBottom: '1px solid #000', height: 28 }} />
                                        <div style={{ marginTop: 4 }}>{label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
        </PrintFrame>
    );
}
