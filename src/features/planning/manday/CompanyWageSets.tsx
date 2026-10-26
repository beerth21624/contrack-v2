'use client';

// ─── Company rate-card library in the Man-Day "ค่าแรงต่อวัน" card (cloud projects only) ───
// "เลือกจากชุดของบริษัท" copies a card into the project as a new wage set (a snapshot); "บันทึกเป็นชุดของบริษัท" on a
// user set creates a card from it. Owners / admins can also archive a card from the same list (renaming a card is
// left out: save the renamed set again and archive the old card). Guest projects show none of this.
import { useState } from 'react';
import { App, Button, Popconfirm, Popover, Spin } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { formatNumber } from '@/components/sheet/NumberCell';
import type { WageSet } from '@/domain/planning';
import type { RateCardDto, Role } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api';
import {
    rateCardAbilities, rateCardConflictMessage, useArchiveRateCard, useCreateRateCard, useRateCards,
} from '@/features/cloud/api/rate-cards';
import { useProjectStore } from '@/store/project-store';
import { cardToWageSet, findCardOfSet, findSetOfCard, wageSetToCard } from './company-wage-sets';

export interface CompanyLibrary { workspaceId: string; role: Role }

/** The open project's workspace and the user's role there; undefined for a guest project. */
export function useCompanyLibrary(): CompanyLibrary | undefined {
    const workspaceId = useProjectStore(s => (s.binding.kind === 'cloud' ? s.binding.workspaceId : undefined));
    const role = useProjectStore(s => (s.binding.kind === 'cloud' ? s.binding.role : undefined));
    return workspaceId === undefined || role === undefined ? undefined : { workspaceId, role };
}

const rates = (skilled: number, labourer: number) => `ช่าง ${formatNumber(skilled, 0)} · คนงาน ${formatNumber(labourer, 0)} บาท/วัน`;

function CardRow({ card, inProject, canArchive, workspaceId, onPick }: {
    card: RateCardDto; inProject: WageSet | undefined; canArchive: boolean; workspaceId: string; onPick: () => void;
}) {
    const { message } = App.useApp();
    const archive = useArchiveRateCard(workspaceId);
    return (
        <li className="flex items-center gap-1">
            <button type="button" onClick={onPick}
                className="min-w-0 flex-1 text-left rounded-control px-2 py-1.5 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                <div className="truncate text-[14px] text-gray-900">{card.name}</div>
                <div className="text-[12px] text-gray-500 tabular-nums">
                    {rates(card.skilledRate, card.labourerRate)}
                    {inProject !== undefined && <span className="text-gray-400"> · มีแล้ว (ชุด {inProject.id})</span>}
                </div>
            </button>
            {canArchive && (
                <Popconfirm title={`เก็บถาวร "${card.name}"?`} description="ไม่แสดงในรายการอีก โครงการที่ใช้อยู่ไม่เปลี่ยน"
                    okText="เก็บถาวร" cancelText="ยกเลิก" okButtonProps={{ danger: true, loading: archive.isPending }}
                    onConfirm={() => archive.mutateAsync(card.id).then(
                        () => { void message.success(`เก็บถาวร "${card.name}" แล้ว`); },
                        (e: unknown) => { void message.error(thaiErrorMessage(e)); },
                    )}>
                    <Button type="text" size="small" className="shrink-0 text-gray-400" icon={<DeleteOutlined />}
                        aria-label={`เก็บถาวรชุดของบริษัท ${card.name}`} />
                </Popconfirm>
            )}
        </li>
    );
}

/** "เลือกจากชุดของบริษัท": the company cards; picking one adds it as a new project set unless the project has it. */
export function PickCompanyWageSet({ library, sets, onAdd }: {
    library: CompanyLibrary; sets: readonly WageSet[]; onAdd: (init: Omit<WageSet, 'id'>) => WageSet['id'];
}) {
    const { message } = App.useApp();
    const [open, setOpen] = useState(false);
    const cards = useRateCards(library.workspaceId);
    const abilities = rateCardAbilities(library.role);

    const pick = (card: RateCardDto) => {
        const existing = findSetOfCard(sets, card);
        if (existing !== undefined) {
            void message.info(`โครงการนี้มี "${card.name}" อยู่แล้ว (ชุด ${existing.id}) ไม่ได้เพิ่มซ้ำ`);
            return;
        }
        const id = onAdd(cardToWageSet(card));
        setOpen(false);
        void message.success(`เพิ่ม "${card.name}" เป็นชุด ${id}`);
    };

    const list = cards.data ?? [];
    const content = (
        <div className="w-[min(320px,calc(100vw-96px))]">
            {cards.isLoading ? (
                <div className="py-3 text-center"><Spin size="small" /></div>
            ) : cards.isError ? (
                <div className="text-[13px] text-red-600 py-1">{thaiErrorMessage(cards.error)}</div>
            ) : list.length === 0 ? (
                <div className="text-[13px] text-gray-600 py-1">
                    ยังไม่มีชุดค่าแรงของบริษัท
                    {abilities.create && <> — กด &quot;บันทึกเป็นชุดของบริษัท&quot; ที่ชุดที่เพิ่มเอง เพื่อใช้ซ้ำในโครงการอื่น</>}
                </div>
            ) : (
                <ul className="max-h-[320px] overflow-y-auto -mx-1 flex flex-col">
                    {list.map(card => (
                        <CardRow key={card.id} card={card} inProject={findSetOfCard(sets, card)} canArchive={abilities.archive}
                            workspaceId={library.workspaceId} onPick={() => pick(card)} />
                    ))}
                </ul>
            )}
        </div>
    );

    return (
        <Popover trigger="click" placement="bottomLeft" open={open} onOpenChange={setOpen} title="ชุดค่าแรงของบริษัท" content={content}>
            <Button size="small">เลือกจากชุดของบริษัท</Button>
        </Popover>
    );
}

/** "บันทึกเป็นชุดของบริษัท" on a user set (owner / admin / estimator); a note instead when the library has it already. */
export function SaveWageSetToCompany({ library, set }: { library: CompanyLibrary; set: WageSet }) {
    const { message } = App.useApp();
    const cards = useRateCards(library.workspaceId);
    const create = useCreateRateCard(library.workspaceId);
    if (!rateCardAbilities(library.role).create) return null;

    if (findCardOfSet(cards.data ?? [], set) !== undefined) {
        return <span className="text-[12px] text-gray-400">อยู่ในชุดของบริษัทแล้ว</span>;
    }

    const save = () => {
        const req = wageSetToCard(set);
        if (!req.ok) {
            void message.warning(req.message);
            return;
        }
        const { name, skilledRate, labourerRate } = req.body;
        create.mutate(req.body, {
            onSuccess: () => {
                void message.success(req.rounded
                    ? `บันทึก "${name}" เป็นชุดของบริษัทแล้ว (ปัดเป็นบาทเต็ม: ${rates(skilledRate, labourerRate)})`
                    : `บันทึก "${name}" เป็นชุดของบริษัทแล้ว`);
            },
            onError: (e) => { void message.error(rateCardConflictMessage(e) ?? thaiErrorMessage(e)); },
        });
    };

    return (
        <Button type="link" size="small" className="!px-0 !h-auto text-[12px]" loading={create.isPending} onClick={save}>
            บันทึกเป็นชุดของบริษัท
        </Button>
    );
}
