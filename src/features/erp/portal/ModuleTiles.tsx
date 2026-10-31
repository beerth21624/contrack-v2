'use client';

// ─── One card per ERP module: active, trial (days left), trial available, or locked ───
import Link from 'next/link';
import { App, Button, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import { type ModuleTile, can } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useStartTrial } from '@/features/modules/modules';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { SectionCard } from '../shared/SectionCard';
import { usePortalRefresh } from './refresh';

const DAY_MS = 86_400_000;

function Tile({ tile, workspaceId, mayManage, now }: { tile: ModuleTile; workspaceId: string; mayManage: boolean; now: number }) {
    const t = useTranslations('portal');
    const tm = useTranslations('modules');
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const trial = useStartTrial(workspaceId);
    const refresh = usePortalRefresh(workspaceId);
    const label = tm(`${tile.module}.label`);
    const daysLeft = tile.entitlement.status === 'trial' && tile.entitlement.expiresAt !== null
        ? Math.max(0, Math.ceil((new Date(tile.entitlement.expiresAt).getTime() - now) / DAY_MS))
        : undefined;

    const start = async () => {
        try {
            await trial.mutateAsync(tile.module);
            void message.success(tm('messages.trialStarted', { module: label }));
            refresh();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    let status: React.ReactNode;
    if (tile.active) {
        status = (
            <>
                <Tag color="success" className="!m-0">{t('tiles.active')}</Tag>
                {daysLeft !== undefined && <Tag color="warning" className="!m-0">{t('tiles.trialDaysLeft', { days: daysLeft })}</Tag>}
            </>
        );
    } else if (tile.trialAvailable && mayManage) {
        status = <Button size="small" type="primary" loading={trial.isPending} onClick={() => { void start(); }}>{t('tiles.startTrial')}</Button>;
    } else if (tile.trialAvailable) {
        status = <Tag className="!m-0">{t('tiles.trialAvailable')}</Tag>;
    } else {
        status = <Tag className="!m-0">{t('tiles.locked')}</Tag>;
    }

    return (
        <div className={`flex min-w-0 flex-col gap-2 rounded-card border border-gray-200 p-3 ${tile.active ? 'bg-white' : 'bg-gray-50'}`}>
            <div className="truncate font-medium text-gray-900" title={label}>{label}</div>
            <div className="flex flex-wrap items-center gap-1">{status}</div>
        </div>
    );
}

export function ModuleTiles({ tiles, generatedAt }: { tiles: readonly ModuleTile[]; generatedAt: string }) {
    const t = useTranslations('portal');
    const ws = useErpWorkspace();
    const shown = tiles.filter(x => x.available);
    const workspaceId = ws.workspaceId;
    if (shown.length === 0 || workspaceId === undefined) return null;
    const mayManage = can(ws.role, 'modules.manage');
    const now = new Date(generatedAt).getTime();
    return (
        <SectionCard title={t('tiles.title')} extra={mayManage ? <Link href="/workspace/modules">{t('tiles.manage')}</Link> : undefined}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map(tile => <Tile key={tile.module} tile={tile} workspaceId={workspaceId} mayManage={mayManage} now={now} />)}
            </div>
        </SectionCard>
    );
}
