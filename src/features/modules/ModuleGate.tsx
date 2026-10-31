'use client';

// ─── Page guard of a business module: sign-in → module active for the workspace → the page ───
import Link from 'next/link';
import { App, Button, Result } from 'antd';
import { useTranslations } from 'next-intl';
import { MODULE_LABEL, MODULE_REGISTRY, type ModuleId } from '@/shared/contract';
import { RequireSignIn, spinner } from '@/features/cloud/ui/common';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { can } from '@/features/cloud/permissions';
import { useModuleState, useStartTrial } from './modules';

export function ModuleGate({ module, next, children }: { module: ModuleId; next: string; children: React.ReactNode }) {
    return (
        <RequireSignIn next={next} title={MODULE_LABEL[module]}>
            <Gate module={module}>{children}</Gate>
        </RequireSignIn>
    );
}

function Gate({ module, children }: { module: ModuleId; children: React.ReactNode }) {
    const { state, loading, workspaceId } = useModuleState(module);
    const role = useCurrentWorkspace().workspace?.role;
    if (loading) return spinner;
    if (state?.active !== true) {
        return <Inactive module={module} state={state} workspaceId={workspaceId} mayManage={can(role, 'modules.manage')} />;
    }
    return <>{children}</>;
}

function Inactive({ module, state, workspaceId, mayManage }: {
    module: ModuleId;
    state: ReturnType<typeof useModuleState>['state'];
    workspaceId: string | undefined;
    mayManage: boolean;
}) {
    const t = useTranslations('modules');
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const trial = useStartTrial(workspaceId ?? '');
    const label = t(`${module}.label`);

    const entitlement = state?.entitlement.status;
    const notEntitled = entitlement === 'none' || entitlement === 'expired' || entitlement === 'revoked';
    const missing = state?.enabled === true ? (state.missingDependencies) : [];
    const subTitle = missing.length > 0
        ? t('gate.missingDependencies', { modules: missing.map(m => t(`${m}.label`)).join(', ') })
        : notEntitled && MODULE_REGISTRY[module].kind === 'erp' ? t('gate.notEntitled') : t('gate.subTitle');

    const startTrial = async () => {
        try {
            await trial.mutateAsync(module);
            void message.success(t('messages.trialStarted', { module: label }));
        } catch (e) { void message.error(toText(e)); }
    };

    return (
        <Result
            status="info"
            title={t('gate.title', { module: label })}
            subTitle={subTitle}
            extra={mayManage
                ? (
                    <div className="flex flex-wrap gap-2 justify-center">
                        {state?.trialAvailable === true && workspaceId !== undefined && (
                            <Button type="primary" loading={trial.isPending} onClick={() => void startTrial()}>
                                {t('actions.startTrial', { days: MODULE_REGISTRY[module].trialDays })}
                            </Button>
                        )}
                        <Link href="/workspace/modules"><Button type={state?.trialAvailable === true ? 'default' : 'primary'}>{t('gate.enable')}</Button></Link>
                    </div>
                )
                : <Link href="/journey"><Button>{t('gate.backToBoq')}</Button></Link>}
        />
    );
}
