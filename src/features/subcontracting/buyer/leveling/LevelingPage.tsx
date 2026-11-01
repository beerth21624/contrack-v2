'use client';

// ─── /subcontracting/packages/[id]/leveling: every bid against the BOQ estimate, negotiate, award (plan §4.5–4.6) ───
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useMemo, useState } from 'react';
import { Alert, App, Button, Empty, Radio, Segmented } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import type { AwardResponse, BuyerPackageDto, LevelingDto, PackageStatus } from '@/shared/contract';
import { isApiError } from '@/features/cloud/api/errors';
import { spinner } from '@/features/cloud/ui/common';
import { fmtDay, money, money0, pct, qty, tradeName } from '../format';
import { isModuleDisabled } from '../../contracts/logic';
import { ModuleOffState, useBuyerRights } from '../../contracts/ui';
import { useLeveling, usePackage } from '../hooks';
import { Card, Num, PackageStatusTag, PageHead, ScPage } from '../ui';
import { AwardModal } from './AwardModal';
import { NegotiationDrawer } from './NegotiationDrawer';
import {
    allocationOf, bidderDiffPct, bidderOrder, canWinLine, chooseLine, chooseWhole, EMPTY_CHOICE, hasVeryLow, installmentsText,
    isAwardable, isBlankCell, outdatedNote, setMode, toneClass, winnersOf, type AwardChoice, type AwardMode, type Bidder, type BidderOrder, type LevelingLine,
} from './model';

const AWARDABLE: readonly PackageStatus[] = ['open', 'reviewing', 'expired'];

export function LevelingPage({ packageId }: { packageId: string }) {
    return (
        <ScPage next={`/subcontracting/packages/${packageId}/leveling`}>
            <Content packageId={packageId} />
        </ScPage>
    );
}

function Content({ packageId }: { packageId: string }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const pkg = usePackage(packageId);
    // Rights (widened by the settings) of the workspace that owns the package, not the switcher's current one.
    const rights = useBuyerRights(pkg.data?.buyerWorkspaceId);
    const readPrices = rights.may('sc.readPrices');
    const leveling = useLeveling(packageId, readPrices);
    const [order, setOrder] = useState<BidderOrder>('normalized');
    const [exporting, setExporting] = useState(false);

    if (pkg.isLoading || (pkg.data !== undefined && rights.loading)) return spinner;
    if (pkg.data === undefined) {
        if (isModuleDisabled(pkg.error)) return <ModuleOffState />;
        return <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={toText(pkg.error)} /></Card>;
    }
    const p = pkg.data;
    const forbidden = !readPrices || (isApiError(leveling.error) && leveling.error.code === 'forbidden');

    const exportXlsx = async (data: LevelingDto) => {
        setExporting(true);
        try {
            const { downloadLevelingXlsx } = await import('./xlsx');
            await downloadLevelingXlsx(data, p.title, order);
        } catch {
            void message.error(t('buyer.leveling.couldNotCreateTheExcel'));
        } finally {
            setExporting(false);
        }
    };

    return (
        <>
            <PageHead
                back={{ href: `/subcontracting/packages/${packageId}`, label: t('buyer.leveling.package') }}
                title={t('buyer.leveling.priceComparison', { title: p.title })}
                sub={(
                    <span className="flex flex-wrap items-center gap-2">
                        <span>{tradeName(p.trade)}</span>
                        <PackageStatusTag status={p.status} />
                        {readPrices && <span>{t('buyer.leveling.estimate')} <Num>{money0(p.estimateTotal)}</Num> {t('buyer.leveling.thb')}</span>}
                        {p.version > 1 && <span>{t('buyer.leveling.version')} {p.version}</span>}
                    </span>
                )}
                extra={leveling.data !== undefined && leveling.data.bidders.length > 0 && (
                    <Button icon={<FileExcelOutlined />} loading={exporting}
                        onClick={() => { void exportXlsx(leveling.data); }}>
                        {t('buyer.leveling.exportExcel')}
                    </Button>
                )}
            />
            {forbidden && (
                <Card>
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={(
                        <div className="flex flex-col gap-1">
                            <span className="text-gray-900">{t('buyer.leveling.youCannotViewPrices')}</span>
                            <span className="text-secondary text-gray-500">{t('buyer.leveling.aWorkspaceAdminCanGrant')}</span>
                        </div>
                    )} />
                </Card>
            )}
            {!forbidden && leveling.isLoading && spinner}
            {!forbidden && leveling.isError && (
                <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={toText(leveling.error)} /></Card>
            )}
            {!forbidden && leveling.data !== undefined && (
                leveling.data.bidders.length === 0
                    ? (
                        <Card>
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('buyer.leveling.noRecipientHasSubmittedA')}>
                                <Link href={`/subcontracting/packages/${packageId}`}><Button>{t('buyer.leveling.viewInvitees')}</Button></Link>
                            </Empty>
                        </Card>
                    )
                    : (
                        <Comparison key={leveling.data.version} pkg={p} leveling={leveling.data} order={order} onOrder={setOrder}
                            awardAllowed={rights.may('sc.award') && AWARDABLE.includes(p.status)}
                            canNegotiate={rights.may('sc.packages.manage')} />
                    )
            )}
        </>
    );
}

function Comparison({ pkg, leveling, order, onOrder, awardAllowed, canNegotiate }: {
    pkg: BuyerPackageDto;
    leveling: LevelingDto;
    order: BidderOrder;
    onOrder: (o: BidderOrder) => void;
    awardAllowed: boolean;
    canNegotiate: boolean;
}) {
    const t = useTranslations('subcontracting');
    const router = useRouter();
    const [choice, setChoice] = useState<AwardChoice>(EMPTY_CHOICE);
    const [negotiate, setNegotiate] = useState<Bidder | null>(null);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const ks = useMemo(() => bidderOrder(leveling.bidders, order), [leveling.bidders, order]);
    const allocation = useMemo(() => allocationOf(leveling, choice), [leveling, choice]);
    const winners = useMemo(() => winnersOf(leveling, allocation), [leveling, allocation]);
    const anyLump = leveling.bidders.some(b => b.mode === 'lump');
    const anyFilled = leveling.lines.some(l => l.cells.some((c, k) => c.filled && leveling.bidders[k]?.mode === 'unit'));
    const leftOut = leveling.lines.length - allocation.size;

    const onAwarded = (res: AwardResponse) => {
        setSummaryOpen(false);
        const first = res.subcontractIds[0];
        router.push(res.subcontractIds.length === 1 && first !== undefined ? `/subcontracting/contracts/${first}` : '/subcontracting/contracts');
    };

    return (
        <>
            {pkg.status === 'awarded' && (
                <Alert type="success" showIcon title={t('buyer.leveling.alreadyAwarded')}
                    description={<Link href="/subcontracting/contracts">{t('buyer.leveling.viewProjectContracts')}</Link>} />
            )}
            <Card
                title={t('buyer.leveling.pricesFrom', { count: leveling.bidders.length })}
                extra={(
                    <Segmented<BidderOrder> size="small" value={order} onChange={onOrder}
                        options={[{ value: 'normalized', label: t('buyer.leveling.cheapestFirst') }, { value: 'original', label: t('buyer.leveling.inOrderReceived') }]} />
                )}
            >
                <div className="overflow-x-auto border border-gray-200 rounded-card">
                    <table className="border-collapse text-body w-max min-w-full">
                        <thead className="bg-gray-50 text-secondary text-gray-600">
                            <tr>
                                <th rowSpan={2} className="sticky left-0 z-10 bg-gray-50 text-left font-medium px-3 py-2 border-b border-r border-gray-200 min-w-[260px] max-w-[320px]">
                                    {t('buyer.leveling.item')}
                                </th>
                                <th colSpan={2} className="font-medium px-3 py-2 border-b border-r border-gray-200">{t('buyer.leveling.estimateBoq')}</th>
                                {ks.map(k => {
                                    const b = leveling.bidders[k];
                                    if (b === undefined) return null;
                                    return (
                                        <th key={b.bidId} colSpan={3} className="font-medium px-3 py-2 border-b border-r border-gray-200 align-top">
                                            <BidderHead bidder={b} wholeSelectable={awardAllowed && choice.mode === 'whole' && isAwardable(b)}
                                                selected={choice.mode === 'whole' && choice.whole === b.bidId}
                                                onSelect={() => setChoice(c => chooseWhole(c, b.bidId))}
                                                onNegotiate={() => setNegotiate(b)} />
                                        </th>
                                    );
                                })}
                            </tr>
                            <tr>
                                <th className="font-normal px-3 py-1 border-b border-gray-200 text-right">{t('buyer.leveling.perUnit')}</th>
                                <th className="font-normal px-3 py-1 border-b border-r border-gray-200 text-right">{t('buyer.leveling.total')}</th>
                                {ks.map(k => (
                                    <SubHeads key={leveling.bidders[k]?.bidId ?? k} lump={leveling.bidders[k]?.mode === 'lump'} />
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {leveling.lines.map(line => (
                                <LineRow key={line.idx} line={line} ks={ks} leveling={leveling}
                                    pickable={awardAllowed && choice.mode === 'per_line'} allocation={allocation}
                                    onPick={(bidId) => setChoice(c => chooseLine(leveling, c, line.idx, bidId))} />
                            ))}
                        </tbody>
                        <Footer leveling={leveling} ks={ks} />
                    </table>
                </div>
                <div className="flex flex-col gap-1 mt-3 text-caption text-gray-500">
                    {hasVeryLow(leveling) && <span><span className="inline-block w-3 h-3 align-middle bg-red-50 border border-red-100 mr-1" />{t('buyer.leveling.unusuallyLowCheckTheScope')}</span>}
                    <span><span className="inline-block w-3 h-3 align-middle bg-amber-50 border border-amber-100 mr-1" />{t('buyer.leveling.differsFromTheEstimateBy')} {pct(leveling.threshold)}</span>
                    {anyFilled && <span><i>{t('buyer.leveling.italic')}</i> {t('buyer.leveling.rowsTheBidderDidNot')}</span>}
                    {anyLump && <span>{t('buyer.leveling.aLumpSumPriceIs')}</span>}
                </div>
            </Card>

            {awardAllowed && (
                <Card>
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <Segmented<AwardMode> value={choice.mode} onChange={m => setChoice(c => setMode(leveling, c, m))}
                            options={[{ value: 'whole', label: t('buyer.leveling.wholePackage') }, { value: 'per_line', label: t('buyer.leveling.perRow') }]} />
                        <div className="flex-1 text-secondary text-gray-600">
                            {allocation.size === 0
                                ? (choice.mode === 'whole' ? t('buyer.leveling.pickTheWinnerAtThe') : t('buyer.leveling.pickTheWinnerOnEach'))
                                : (
                                    <>
                                        {winners.map(w => w.bidder.displayName).join(', ')} · {allocation.size} {t('buyer.leveling.of')} {leveling.lines.length} {t('buyer.leveling.rows')} <Num>{money(winners.reduce((s, w) => s + w.value, 0))}</Num> {t('buyer.leveling.thb')}
                                        {leftOut > 0 && t('buyer.leveling.rowsNotAwarded', { leftOut })}
                                    </>
                                )}
                        </div>
                        <Button type="primary" size="large" disabled={allocation.size === 0} onClick={() => setSummaryOpen(true)}>
                            {t('buyer.leveling.award')}
                        </Button>
                    </div>
                </Card>
            )}

            <NegotiationDrawer bidder={negotiate} onClose={() => setNegotiate(null)} canSend={canNegotiate} />
            <AwardModal open={summaryOpen} onClose={() => setSummaryOpen(false)} pkg={pkg} leveling={leveling}
                allocation={allocation} winners={winners} onAwarded={onAwarded} />
        </>
    );
}

function BidderHead({ bidder, wholeSelectable, selected, onSelect, onNegotiate }: {
    bidder: Bidder;
    wholeSelectable: boolean;
    selected: boolean;
    onSelect: () => void;
    onNegotiate: () => void;
}) {
    const t = useTranslations('subcontracting');
    const notes = [
        bidder.mode === 'lump' ? t('buyer.leveling.lumpSum') : null,
        bidder.enteredByBuyer ? t('buyer.leveling.enteredByBuyer') : null,
    ].filter((n): n is string => n !== null);
    return (
        <div className="flex flex-col items-start gap-1 text-left min-w-[300px]">
            <div className="flex items-center gap-2 w-full">
                {wholeSelectable && <Radio checked={selected} onClick={onSelect} aria-label={t('buyer.leveling.selectForTheWholePackage', { displayName: bidder.displayName })} />}
                <span className="text-body font-semibold text-gray-900 flex-1 min-w-0 truncate">{bidder.displayName}</span>
                <Button size="small" type="link" className="!px-0" onClick={onNegotiate}>{t('buyer.leveling.negotiate')}</Button>
            </div>
            {notes.length > 0 && <span className="text-caption text-gray-500 font-normal">{notes.join(' · ')}</span>}
            {bidder.outdated && <span className="text-caption text-gray-500 font-normal whitespace-normal">{outdatedNote(t)}</span>}
        </div>
    );
}

function SubHeads({ lump }: { lump: boolean }) {
    const t = useTranslations('subcontracting');
    return (
        <>
            <th className="font-normal px-3 py-1 border-b border-gray-200 text-right">{lump ? '' : t('buyer.leveling.perUnit')}</th>
            <th className="font-normal px-3 py-1 border-b border-gray-200 text-right">{t('buyer.leveling.total')}</th>
            <th className="font-normal px-3 py-1 border-b border-r border-gray-200 text-right">{t('buyer.leveling.diff')}</th>
        </>
    );
}

function LineRow({ line, ks, leveling, pickable, allocation, onPick }: {
    line: LevelingLine;
    ks: readonly number[];
    leveling: LevelingDto;
    pickable: boolean;
    allocation: ReadonlyMap<number, string>;
    onPick: (bidId: string) => void;
}) {
    const t = useTranslations('subcontracting');
    return (
        <tr className="border-b border-gray-100">
            <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-200 max-w-[320px]">
                <div className="text-gray-900">{line.desc}</div>
                <div className="text-caption text-gray-500 tabular-nums">{qty(line.qtyPriced)} {line.unit}</div>
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-gray-600">{money(line.estUnit)}</td>
            <td className="px-3 py-2 text-right tabular-nums border-r border-gray-200">{money(line.estTotal)}</td>
            {ks.map(k => {
                const b = leveling.bidders[k];
                const cell = line.cells[k];
                if (b === undefined || cell === undefined) return null;
                if (isBlankCell(b, cell)) {
                    return (
                        <Fragment key={b.bidId}>
                            <td className="px-3 py-2 text-right text-gray-300">—</td>
                            <td className="px-3 py-2 text-right text-gray-300">—</td>
                            <td className="px-3 py-2 border-r border-gray-200" />
                        </Fragment>
                    );
                }
                const chosen = allocation.get(line.idx) === b.bidId;
                const tone = chosen ? 'bg-green-50' : (cell.filled ? '' : toneClass(cell.flag));
                const canPick = pickable && canWinLine(leveling, k, line.idx);
                const filledUnit = b.mode === 'unit' && cell.filled;
                return (
                    <Fragment key={b.bidId}>
                        <td className={`px-3 py-2 text-right tabular-nums ${tone}`}>
                            {cell.excluded
                                ? <span className="text-caption text-gray-500">{t('buyer.leveling.excluded')}</span>
                                : cell.unitPrice === null ? <span className="text-gray-300">–</span> : money(cell.unitPrice)}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${tone}`}>
                            <div className="flex items-center justify-end gap-2">
                                {canPick && <Radio checked={chosen} onClick={() => onPick(b.bidId)} aria-label={t('buyer.leveling.giveTo', { displayName: b.displayName })} />}
                                <span className={cell.filled ? 'italic text-gray-500' : ''}>{money(cell.total)}</span>
                            </div>
                            {filledUnit && !cell.excluded && <div className="text-caption text-gray-400 not-italic">{t('buyer.leveling.filledWithEstimate')}</div>}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums border-r border-gray-200 ${tone} ${cell.flag === 'very_low' ? 'text-red-700' : 'text-gray-600'}`}>
                            {cell.filled || b.outdated ? '' : pct(cell.diffPct, true)}
                        </td>
                    </Fragment>
                );
            })}
        </tr>
    );
}

function Footer({ leveling, ks }: { leveling: LevelingDto; ks: readonly number[] }) {
    const t = useTranslations('subcontracting');
    const row = (label: React.ReactNode, est: React.ReactNode, value: (b: Bidder) => React.ReactNode, opts: { strong?: boolean; tone?: (b: Bidder) => string; left?: boolean } = {}) => (
        <tr className="border-b border-gray-100">
            <td className={`sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-200 ${opts.strong === true ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</td>
            <td className="px-3 py-2" />
            <td className={`px-3 py-2 text-right tabular-nums border-r border-gray-200 ${opts.strong === true ? 'font-semibold' : ''}`}>{est}</td>
            {ks.map(k => {
                const b = leveling.bidders[k];
                if (b === undefined) return null;
                return (
                    <td key={b.bidId} colSpan={3}
                        className={`px-3 py-2 border-r border-gray-200 ${opts.left === true ? 'text-left whitespace-normal max-w-[320px]' : 'text-right tabular-nums'} ${opts.strong === true ? 'font-semibold' : ''} ${opts.tone?.(b) ?? ''}`}>
                        {value(b)}
                    </td>
                );
            })}
        </tr>
    );
    const dash = <span className="text-gray-300">–</span>;
    return (
        <tfoot className="border-t-2 border-gray-200">
            {row(t('buyer.leveling.total'), money(leveling.estimateTotal), b => money(b.total), { strong: true })}
            {row(t('buyer.leveling.totalAfterAdjustmentToCompare'), money(leveling.estimateTotal), b => {
                const diff = bidderDiffPct(b);
                return (
                    <span>
                        {money(b.normalizedTotal)}
                        {diff !== null && <span className="text-secondary font-normal text-gray-600"> ({pct(diff, true)})</span>}
                    </span>
                );
            }, { strong: true, tone: b => (b.outdated ? '' : toneClass(b.flag)) })}
            {row(t('buyer.leveling.days'), '', b => (b.days === null ? dash : t('buyer.leveling.days2', { days: b.days })))}
            {row(t('buyer.leveling.canStart'), '', b => (b.earliestStart === null ? dash : fmtDay(b.earliestStart)))}
            {row(t('buyer.leveling.skilledLabourers'), '', b => (b.crewSkilled === null && b.crewLabourers === null
                ? dash : t('buyer.leveling.people', { value: b.crewSkilled ?? 0, value2: b.crewLabourers ?? 0 })))}
            {row(t('buyer.leveling.priceValidUntil'), '', b => (b.validUntil === null ? dash
                : <span className={b.expired ? 'text-red-600' : ''}>{fmtDay(b.validUntil)}{b.expired ? t('buyer.leveling.expired') : ''}</span>))}
            {row(t('buyer.leveling.paymentStages'), '', b => (b.installmentsProposal === null ? t('buyer.leveling.asWeSet') : t('buyer.leveling.proposed', { installmentsProposal: installmentsText(b.installmentsProposal) })))}
            {row(t('buyer.leveling.verificationLevel'), '', b => b.tier ?? <span className="text-gray-500">{t('buyer.leveling.noAccountYet')}</span>)}
            {row(t('buyer.leveling.ourRating'), '', b => (b.ratingFromUs === null ? dash
                : (b.completedWithUs > 0
                    ? t('buyer.leveling.ratingWithJobs', { rating: b.ratingFromUs.toFixed(1), count: b.completedWithUs })
                    : t('buyer.leveling.ratingOutOf5', { rating: b.ratingFromUs.toFixed(1) }))))}
            {row(t('buyer.leveling.priceVersion'), '', b => t('buyer.leveling.version2', { version: b.version }))}
            {leveling.bidders.some(b => b.note.trim() !== '') && row(t('buyer.leveling.note'), '', b => (b.note.trim() === '' ? dash : b.note), { left: true })}
            {leveling.questions.map((q, qi) => (
                <Fragment key={qi}>
                    {row(q, '', b => {
                        const a = b.answers[qi] ?? '';
                        return a.trim() === '' ? dash : a;
                    }, { left: true })}
                </Fragment>
            ))}
        </tfoot>
    );
}