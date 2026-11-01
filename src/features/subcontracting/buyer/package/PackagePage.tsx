'use client';

// ─── /subcontracting/packages/[packageId]: one package while it waits for prices (plan §4.4) ───
// Header (status, deadline countdown, estimate), one primary action that follows the state, tabs for invitees,
// lines, terms, files and Q&A. Polls every 30 s (no realtime yet).
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, App, Button, Dropdown, Result, Tabs, type MenuProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import type { BuyerPackageDto, ScInvitationDto } from '@/shared/contract';
import { isApiError } from '@/features/cloud/api/errors';
import { isModuleDisabled } from '../../contracts/logic';
import { spinner } from '@/features/cloud/ui/common';
import { scApi } from '../api';
import { ModuleOffState, useBuyerRights } from '../../contracts/ui';
import { useDeletePackage, useInvitations, usePackage, useQuestions } from '../hooks';
import { countdown, fmtDateTime, money0, sourcingModeLabel, tradeName } from '../format';
import { InvitationLinksModal, type LinkRow } from '../LinksModal';
import { PackageStatusTag, PageHead, ScPage } from '../ui';
import { AddendumModal } from './AddendumModal';
import { FilesTab } from './FilesTab';
import { bidCount, inviteRoom, isSentUndecided, needsMoreBids, primaryAction } from './helpers';
import { InviteesTab } from './InviteesTab';
import { InviteModal } from './InviteModal';
import { LinesTab } from './LinesTab';
import { ManualBidModal } from './ManualBidModal';
import { CancelPackageModal, EditDraftModal, ExtendDeadlineModal } from './PackageActions';
import { QaTab } from './QaTab';
import { TermsTab } from './TermsTab';

export function PackagePage({ packageId }: { packageId: string }) {
    return (
        <ScPage next={`/subcontracting/packages/${packageId}`}>
            <PackageContent packageId={packageId} />
        </ScPage>
    );
}

type Dialog = 'invite' | 'extend' | 'cancel' | 'edit' | 'addendum' | null;

/** "now" that moves every minute (for the countdown). */
function useMinuteClock(): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = window.setInterval(() => setNow(new Date()), 60_000);
        return () => window.clearInterval(t);
    }, []);
    return now;
}

function PackageContent({ packageId }: { packageId: string }) {
    const tx = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const pkg = usePackage(packageId);
    if (pkg.isLoading) return spinner;
    if (pkg.data === undefined) {
        if (isModuleDisabled(pkg.error)) return <ModuleOffState />;
        const notFound = isApiError(pkg.error) && pkg.error.status === 404;
        return (
            <Result status={notFound ? '404' : 'warning'} title={notFound ? tx('buyer.package.packageNotFound') : tx('buyer.package.couldNotLoadThePackage')}
                subTitle={notFound ? tx('buyer.package.itMayHaveBeenDeleted') : toText(pkg.error)}
                extra={<Link href="/subcontracting"><Button>{tx('buyer.package.backToSubcontracting')}</Button></Link>} />
        );
    }
    return <PackageView pkg={pkg.data} />;
}

function PackageView({ pkg }: { pkg: BuyerPackageDto }) {
    const tx = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message, modal } = App.useApp();
    const router = useRouter();
    // Role, rights and settings of the workspace that owns the package (not the switcher's current workspace).
    const rights = useBuyerRights(pkg.buyerWorkspaceId);
    const buyerName = rights.workspaceName;
    const canManage = rights.may('sc.packages.manage');
    const canSeePrices = rights.may('sc.readPrices');
    const now = useMinuteClock();

    const invitationsQ = useInvitations(pkg.id);
    const questionsQ = useQuestions(pkg.id);
    const invitations = invitationsQ.data ?? [];
    const remove = useDeletePackage();

    const [dialog, setDialog] = useState<Dialog>(null);
    const [manualFor, setManualFor] = useState<ScInvitationDto | null>(null);
    const [links, setLinks] = useState<{ rows: LinkRow[]; title: string } | null>(null);
    const [resending, setResending] = useState(false);
    const [tab, setTab] = useState('invitees');

    const live = isSentUndecided(pkg.status);
    const action = primaryAction(pkg.status, invitations);
    const room = inviteRoom(pkg.sourcingMode, invitations);
    const unansweredCount = (questionsQ.data ?? []).filter(q => q.answer === null).length;
    const cd = countdown(pkg.bidDeadline, now);

    const resendUnopened = async (ids: readonly string[]) => {
        setResending(true);
        const rows: LinkRow[] = [];
        try {
            for (const id of ids) {
                const res = await scApi.resend(id);
                rows.push({ invitationId: id, displayName: res.invitation.displayName, phone: res.invitation.phone, url: res.link.url });
            }
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setResending(false);
            void invitationsQ.refetch();
        }
        if (rows.length > 0) setLinks({ rows, title: tx('buyer.package.newLinksForThoseWho') });
    };

    const deleteDraft = () => {
        modal.confirm({
            title: tx('buyer.package.deleteThisDraftPackage'),
            content: tx('buyer.package.itHasNotBeenSent'),
            okText: tx('buyer.package.deleteDraft'), okButtonProps: { danger: true }, cancelText: tx('buyer.package.cancel'),
            onOk: async () => {
                try {
                    await remove.mutateAsync(pkg.id);
                    void message.success(tx('buyer.package.draftDeleted'));
                    router.push('/subcontracting');
                } catch (e) {
                    void message.error(toText(e));
                }
            },
        });
    };

    // ── actions ──
    let primary: React.ReactNode = null;
    if (action.kind === 'invite' && canManage) {
        primary = <Button type="primary" size="large" onClick={() => setDialog('invite')}>{tx('buyer.package.sendInvitations')}</Button>;
    } else if (action.kind === 'leveling' && canSeePrices) {
        primary = (
            <Link href={`/subcontracting/packages/${pkg.id}/leveling`}>
                <Button type="primary" size="large">{tx('buyer.package.openComparison')}{bidCount(invitations)} {tx('buyer.package.bidders')}</Button>
            </Link>
        );
    } else if (action.kind === 'resend' && canManage) {
        primary = (
            <Button type="primary" size="large" loading={resending} onClick={() => { void resendUnopened(action.ids); }}>
                {tx('buyer.package.resendToThoseWhoHave')}{action.ids.length})
            </Button>
        );
    } else if (action.kind === 'contracts') {
        primary = <Link href="/subcontracting/contracts"><Button type="primary" size="large">{tx('buyer.package.viewContract')}</Button></Link>;
    }

    const menu: NonNullable<MenuProps['items']> = [];
    if (canManage && pkg.status === 'draft') menu.push({ key: 'edit', label: tx('buyer.package.editDraft') });
    if (canManage && live) menu.push({ key: 'extend', label: tx('buyer.package.extendDeadline') });
    if (canManage && live && room > 0) menu.push({ key: 'invite', label: tx('buyer.package.inviteMore') });
    if (canSeePrices && live && action.kind !== 'leveling') menu.push({ key: 'leveling', label: tx('buyer.package.priceComparison') });
    if (canManage && (pkg.status === 'draft' || live)) menu.push({ type: 'divider' });
    if (canManage && live) menu.push({ key: 'cancel', label: tx('buyer.package.cancelPackage'), danger: true });
    if (canManage && pkg.status === 'draft') menu.push({ key: 'delete', label: tx('buyer.package.deleteDraft'), danger: true });
    const onMenu: MenuProps['onClick'] = ({ key }) => {
        if (key === 'leveling') router.push(`/subcontracting/packages/${pkg.id}/leveling`);
        else if (key === 'delete') deleteDraft();
        else if (key === 'edit' || key === 'extend' || key === 'invite' || key === 'cancel') setDialog(key);
    };
    const hasMenu = menu.some(m => m !== null && m.type !== 'divider');

    // ── header line ──
    const sub = (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PackageStatusTag status={pkg.status} />
            <span>{tradeName(pkg.trade)}</span>
            <span className="text-gray-500">{sourcingModeLabel(pkg.sourcingMode)}</span>
            {pkg.version > 1 && <span className="text-gray-500">{tx('buyer.package.version')} {pkg.version}</span>}
            {pkg.status === 'draft' && <span className="text-gray-500">{tx('buyer.package.bidsClose')} {fmtDateTime(pkg.bidDeadline)}</span>}
            {live && (
                <span className={cd.passed ? 'text-red-600' : cd.soon ? 'text-amber-600' : 'text-gray-600'} title={fmtDateTime(pkg.bidDeadline)}>
                    {cd.passed ? tx('buyer.package.closed', { bidDeadline: fmtDateTime(pkg.bidDeadline) }) : tx('buyer.package.bidsClose2', { text: cd.text })}
                </span>
            )}
            {canSeePrices && <span className="tabular-nums text-gray-600">{tx('buyer.package.estimate')} {money0(pkg.estimateTotal)} {tx('buyer.package.thb')}</span>}
        </span>
    );

    return (
        <>
            <PageHead back={{ href: '/subcontracting', label: tx('buyer.package.subcontracting') }} title={pkg.title} sub={sub}
                extra={(
                    <>
                        {hasMenu && (
                            <Dropdown trigger={['click']} menu={{ items: menu, onClick: onMenu }}>
                                <Button size="large">{tx('buyer.package.manage')} <DownOutlined /></Button>
                            </Dropdown>
                        )}
                        {primary}
                    </>
                )} />

            {pkg.status === 'cancelled' && (
                <Alert type="info" showIcon title={tx('buyer.package.thisPackageHasBeenCancelled')}
                    description={pkg.cancelReason !== null && pkg.cancelReason !== '' ? tx('buyer.package.reason', { cancelReason: pkg.cancelReason }) : undefined} />
            )}
            {needsMoreBids(pkg, invitations, now) && canManage && (
                <Alert type="warning" showIcon title={tx('buyer.package.closedWith', { invitations: bidCount(invitations) })}
                    description={tx('buyer.package.extendTheDeadlineInviteMore')}
                    action={(
                        <div className="flex flex-wrap gap-2">
                            <Button size="small" onClick={() => setDialog('extend')}>{tx('buyer.package.extendDeadline2')}</Button>
                            {room > 0 && <Button size="small" onClick={() => setDialog('invite')}>{tx('buyer.package.inviteMore')}</Button>}
                            {bidCount(invitations) > 0 && canSeePrices && (
                                <Link href={`/subcontracting/packages/${pkg.id}/leveling`}><Button size="small">{tx('buyer.package.continueWithThePricesReceived')}</Button></Link>
                            )}
                        </div>
                    )} />
            )}

            <div className="bg-white border border-gray-200 rounded-card px-5 pb-5 max-md:px-4 shadow-card">
                <Tabs activeKey={tab} onChange={setTab} items={[
                    {
                        key: 'invitees', label: invitations.length > 0 ? tx('buyer.package.tabInviteesCount', { count: invitations.length }) : tx('buyer.package.tabInvitees'),
                        children: (
                            <InviteesTab pkg={pkg} invitations={invitations} loading={invitationsQ.isLoading}
                                error={invitationsQ.isError ? toText(invitationsQ.error) : null}
                                canManage={canManage} canSeePrices={canSeePrices}
                                onLinks={(rows, title) => setLinks({ rows, title })} onManualBid={setManualFor}
                                onInviteMore={room > 0 ? () => setDialog('invite') : null} />
                        ),
                    },
                    {
                        key: 'lines', label: tx('buyer.package.workItems', { count: pkg.lines.length }),
                        children: <LinesTab pkg={pkg} canSeePrices={canSeePrices} canManage={canManage} onAddendum={() => setDialog('addendum')} />,
                    },
                    { key: 'terms', label: tx('buyer.package.terms'), children: <TermsTab pkg={pkg} /> },
                    { key: 'files', label: pkg.files.length > 0 ? tx('buyer.package.tabFilesCount', { count: pkg.files.length }) : tx('buyer.package.tabFiles'), children: <FilesTab pkg={pkg} canManage={canManage} /> },
                    {
                        key: 'qa', label: unansweredCount > 0 ? tx('buyer.package.tabQaPending', { count: unansweredCount }) : tx('buyer.package.tabQa'),
                        children: (
                            <QaTab packageId={pkg.id} questions={questionsQ.data ?? []} loading={questionsQ.isLoading}
                                error={questionsQ.isError ? toText(questionsQ.error) : null}
                                canAnswer={canManage && pkg.status !== 'cancelled'} />
                        ),
                    },
                ]} />
            </div>

            {/* Mounted only while open, so each opening starts from the package as it is now. */}
            {dialog === 'invite' && (
                <InviteModal open onClose={() => setDialog(null)} pkg={pkg}
                    invitations={invitations} onSent={rows => setLinks({ rows, title: tx('buyer.package.invitationsSent') })} />
            )}
            {dialog === 'extend' && <ExtendDeadlineModal open onClose={() => setDialog(null)} pkg={pkg} />}
            {dialog === 'cancel' && <CancelPackageModal open onClose={() => setDialog(null)} pkg={pkg} />}
            {dialog === 'edit' && <EditDraftModal open onClose={() => setDialog(null)} pkg={pkg} />}
            <AddendumModal open={dialog === 'addendum'} onClose={() => setDialog(null)} pkg={pkg} />
            <ManualBidModal pkg={pkg} invitation={manualFor} onClose={() => setManualFor(null)} />
            <InvitationLinksModal open={links !== null} onClose={() => setLinks(null)} rows={links?.rows ?? []}
                title={links?.title} buyerName={buyerName} packageTitle={pkg.title} deadline={pkg.bidDeadline} />
        </>
    );
}
