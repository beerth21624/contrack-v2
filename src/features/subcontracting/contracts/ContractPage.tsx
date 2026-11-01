'use client';

// ─── /subcontracting/contracts/[id]: one subcontract, buyer side ───
// Header (who, how much, how far) → tabs: installments + claims, contract document, variations, retention.
// Every action is hidden when the role cannot do it (the server still decides; settings may widen estimator rights).
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Alert, Button, Progress, Result, Tabs } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import type { SubcontractDto } from '@/shared/contract';
import { tradeName } from '../buyer/format';
import { spinner } from '@/features/cloud/ui/common';
import { useSubcontract } from './api';
import { DocumentPanel } from './DocumentPanel';
import { EndActions, RatingModal } from './EndActions';
import { InstallmentsPanel } from './InstallmentsPanel';
import { RetentionPanel } from './RetentionPanel';
import { VariationsPanel } from './VariationsPanel';
import { contractActions, contractMay, fmtDate, installmentProgress } from './logic';
import { CARD, LoadError, Money, PageFrame, PricesHiddenProvider, StatusTag, useBuyerRights } from './ui';

export function ContractPage({ id }: { id: string }) {
    const t = useTranslations('subcontracting');
    const q = useSubcontract(id);
    if (q.isLoading) return spinner;
    if (q.isError) return <LoadError error={q.error} />;
    const sc = q.data;
    if (sc === undefined) return spinner;
    if (sc.viewerSide === 'vendor') {
        return (
            <Result status="info" title={t('contracts.page.youAreContractor')}
                extra={<Link href={`/vendor/contracts/${sc.id}`}><Button type="primary">{t('contracts.page.openContractorPage')}</Button></Link>} />
        );
    }
    return <ContractView sc={sc} />;
}

function ContractView({ sc }: { sc: SubcontractDto }) {
    const t = useTranslations('subcontracting');
    const rights = useBuyerRights(sc.buyerWorkspaceId);
    // Buyer switched the module off: the contract stays readable, every action is hidden.
    const readOnly = !sc.buyerModuleOn;
    const may = contractMay(rights.may, sc.buyerModuleOn);
    const [ratingOpen, setRatingOpen] = useState(false);
    const [tab, setTab] = useState<string | undefined>(undefined);
    const progress = installmentProgress(sc.installments);
    const actions = contractActions(sc);
    const pending = sc.status === 'pending_acceptance';
    const activeTab = tab ?? (pending ? 'document' : 'installments');

    return (
        <PricesHiddenProvider hidden={!rights.loading && !rights.may('sc.readPrices')}>
        <PageFrame
            back={{ href: '/subcontracting/contracts', label: t('contracts.page.allContracts') }}
            title={<span className="flex flex-wrap items-center gap-2">{sc.contractNo} <StatusTag status={sc.status} /></span>}
            subtitle={<>{sc.vendorName} · {tradeName(sc.trade, t)} · {sc.title}</>}
            extra={<>
                <Link href={`/subcontracting/contracts/${sc.id}/print`}><Button icon={<PrinterOutlined />}>{t('contracts.page.printContract')}</Button></Link>
                <EndActions sc={sc} may={may} onCompleted={() => setRatingOpen(true)} />
            </>}
        >
            <div className={`${CARD} p-5 grid grid-cols-2 md:grid-cols-4 gap-4`}>
                <Figure label={t('contracts.page.contractValue')} value={<Money value={sc.total} />}
                    note={sc.variationsTotal !== 0 ? <>{t('contracts.page.includingVariations')} <Money value={sc.variationsTotal} /></> : undefined} />
                <Figure label={t('contracts.page.paid')} value={<Money value={sc.paidTotal} />} />
                <Figure label={t('contracts.page.retentionHeld')} value={<Money value={sc.retention.balance} />} />
                <div className="min-w-0">
                    <div className="text-secondary text-gray-600">{t('contracts.page.installmentsPaid')}</div>
                    <div className="text-card-title font-semibold tabular-nums">{progress.paid}/{progress.total}</div>
                    <Progress percent={progress.pct} showInfo={false} size="small" strokeColor="#16a34a" />
                </div>
                <div className="col-span-2 md:col-span-4 text-[12px] text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                    {sc.schedule.start !== null && <span>{t('contracts.page.start', { date: fmtDate(sc.schedule.start) })}</span>}
                    {sc.schedule.finish !== null && <span>{t('contracts.page.finish', { date: fmtDate(sc.schedule.finish) })}</span>}
                    {sc.location.province !== '' && <span>{[sc.location.district, sc.location.province].filter(s => s !== '').join(' ')}</span>}
                    {sc.endReason !== null && <span className="text-red-600">{t('contracts.page.reason', { reason: sc.endReason })}</span>}
                </div>
            </div>

            {readOnly && <div className="text-secondary text-gray-500 px-1">{t('contracts.page.readOnly')}</div>}

            {actions.rate && !readOnly && (
                <Alert type="info" showIcon title={t('contracts.page.rateAlert')}
                    action={<Button size="small" type="primary" onClick={() => setRatingOpen(true)}>{t('contracts.page.rate')}</Button>} />
            )}

            <div className={`${CARD} px-5 pb-5`}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setTab}
                    items={[
                        { key: 'installments', label: t('contracts.page.tabInstallments'), children: <InstallmentsPanel sc={sc} may={may} /> },
                        { key: 'document', label: pending ? t('contracts.page.tabContractPending') : t('contracts.page.tabContract'), children: <DocumentPanel sc={sc} may={may} /> },
                        { key: 'variations', label: t('contracts.page.tabVariations'), children: <VariationsPanel sc={sc} may={may} /> },
                        { key: 'retention', label: t('contracts.page.tabRetention'), children: <RetentionPanel sc={sc} may={may} /> },
                    ]}
                />
            </div>
            <RatingModal subcontractId={sc.id} vendorName={sc.vendorName} open={ratingOpen} onClose={() => setRatingOpen(false)} />
        </PageFrame>
        </PricesHiddenProvider>
    );
}

function Figure({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <div className="text-secondary text-gray-600">{label}</div>
            <div className="text-card-title font-semibold">{value}</div>
            {note !== undefined && <div className="text-[12px] text-gray-500">{note}</div>}
        </div>
    );
}
