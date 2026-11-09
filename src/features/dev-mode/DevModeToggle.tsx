'use client';

// ─── Header switch "โหมดตรวจสอบการคำนวณ" — rendered only when the server allows dev mode ───
import { Switch, Tooltip } from 'antd';
import { useTranslations } from 'next-intl';
import { useDevMode } from './useDevMode';

export function DevModeToggle() {
    const t = useTranslations('devMode');
    const { allowed, enabled, setEnabled } = useDevMode();
    if (!allowed) return null;
    return (
        <Tooltip title={t('toggle.hint')}>
            <label className="shrink-0 flex items-center gap-2 cursor-pointer select-none" style={{ color: '#fff', fontSize: 12 }}>
                <Switch size="small" checked={enabled} onChange={setEnabled} aria-label={t('toggle.label')} />
                <span className="hidden md:inline whitespace-nowrap">{t('toggle.label')}</span>
            </label>
        </Tooltip>
    );
}
