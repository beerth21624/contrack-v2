'use client';

// ─── "Subcontract" (จ้างช่วง) shortcut on a BOQ section header (plan §4.1) ───
// Shown only when the subcontracting module is on for the open cloud project's workspace and the user may create
// packages; otherwise it renders nothing, so with the module off the BOQ page looks exactly as before.
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { TeamOutlined } from '@ant-design/icons';
import type { BoqSectionResult } from '@/domain/boq/types';
import { tradeOfRow } from '@/domain/subcontracting/trades';
import { can } from '@/features/cloud/permissions';
import { useModuleEnabled } from '@/features/modules/modules';
import { useProjectStore } from '@/store/project-store';

export function SubcontractSectionLink({ section }: { section: BoqSectionResult }) {
    const t = useTranslations('subcontracting');
    const binding = useProjectStore(s => s.binding);
    const workspaceId = binding.kind === 'cloud' ? binding.workspaceId : undefined;
    const { enabled } = useModuleEnabled('subcontracting', workspaceId);
    if (binding.kind !== 'cloud' || !enabled || !can(binding.role, 'sc.packages.manage')) return null;
    const first = section.rows.find(r => r.type === 'item');
    const trade = first === undefined ? undefined : tradeOfRow(section.no, first.excelRow);
    if (trade === undefined) return null;
    return (
        <Link href={`/subcontracting/packages/new?trade=${trade}&section=${String(section.no)}`}
            className="text-[12px] font-normal text-gray-500 hover:text-orange-600">
            <TeamOutlined /> {t('shared.sectionLink')}
        </Link>
    );
}
