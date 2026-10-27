'use client';

// ─── Tab "ทีมช่าง": the crews of the workspace, where each is today, quick add / edit / archive ───
import { useMemo, useState } from 'react';
import { App, Button, Input, Popconfirm, Select, Table, Tooltip, type TableColumnsType } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { CrewAssignmentDto, CrewDto, PersonDto, RateCardDto, WorkforceTradeId } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useArchiveCrew } from '@/features/cloud/api/workforce';
import { CrewEditor, closedEditor, editCrewTarget, newCrewValues, type CrewEditorTarget } from './CrewEditor';
import {
    crewStatusOn, filterCrews, headcountLabel, personLabel, placeLines, tradeLabel, type CrewStatus, type PlaceNames,
} from './logic';
import { Card, TRADE_OPTIONS, baht, writeErrorMessage } from './shared';

export const FIRST_CREW_HINT = 'เริ่มจากเพิ่มทีมแรก — กรอกแค่ชื่อทีม สายงาน และจำนวนคนก็พอ';

interface Props {
    workspaceId: string;
    canManage: boolean;
    seeCost: boolean;
    crews: { data: CrewDto[] | undefined; isLoading: boolean; error: unknown };
    people: readonly PersonDto[];
    rateCards: readonly RateCardDto[];
    /** Assignments overlapping today; undefined while loading or when they could not be read. */
    assignments: readonly CrewAssignmentDto[] | undefined;
    today: string;
    names: PlaceNames;
}

export function CrewsTab({ workspaceId, canManage, seeCost, crews, people, rateCards, assignments, today, names }: Props) {
    const { message } = App.useApp();
    const archive = useArchiveCrew(workspaceId);
    const [search, setSearch] = useState('');
    const [trade, setTrade] = useState<WorkforceTradeId | undefined>(undefined);
    const [editor, setEditor] = useState<CrewEditorTarget>(closedEditor);
    const [seq, setSeq] = useState(0);
    const openEditor = (next: CrewEditorTarget) => {
        setEditor(next);
        if (next.mode !== 'closed') setSeq(s => s + 1);
    };

    const peopleById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
    const all = useMemo(() => (crews.data ?? []).filter(c => c.archivedAt === null), [crews.data]);
    const rows = useMemo(() => filterCrews(all, { search, trade }, peopleById), [all, search, trade, peopleById]);
    const showCost = seeCost && all.some(c => !c.wagesHidden);

    const onArchive = (c: CrewDto) => archive.mutateAsync(c.id).then(
        () => { void message.success(`เก็บถาวร "${c.name}" แล้ว`); },
        (e: unknown) => { void message.error(writeErrorMessage(e)); },
    );

    const columns: TableColumnsType<CrewDto> = [
        {
            title: 'ชื่อทีม', key: 'name', width: 200, fixed: 'left',
            sorter: (a, b) => a.name.localeCompare(b.name, 'th'),
            render: (_, c) => <span className="font-medium text-gray-900">{c.name}</span>,
        },
        {
            title: 'สายงาน', key: 'trade', width: 170,
            sorter: (a, b) => tradeLabel(a.trade).localeCompare(tradeLabel(b.trade), 'th'),
            render: (_, c) => tradeLabel(c.trade),
        },
        {
            title: 'หัวหน้าทีม', key: 'leader', width: 170,
            render: (_, c) => {
                const leader = c.leaderId === null ? undefined : peopleById.get(c.leaderId);
                return leader === undefined ? <span className="text-gray-400">—</span> : personLabel(leader);
            },
        },
        {
            title: 'คน', key: 'headcount', width: 150,
            render: (_, c) => (
                <div className="tabular-nums leading-tight">
                    <div>{headcountLabel(c)}</div>
                    {c.memberIds.length > 0 && <div className="text-[12px] text-gray-500">รายชื่อ {c.memberIds.length} คน</div>}
                </div>
            ),
        },
        ...(showCost ? [{
            title: 'ค่าแรงต่อวัน', key: 'cost', width: 130, align: 'right' as const,
            sorter: (a: CrewDto, b: CrewDto) => (a.dailyCost ?? -1) - (b.dailyCost ?? -1),
            render: (_: unknown, c: CrewDto) => (c.dailyCost === null
                ? <span className="text-gray-400">—</span>
                : <span className="tabular-nums">{baht(c.dailyCost)}</span>),
        }] : []),
        {
            title: 'ตอนนี้อยู่ที่', key: 'where', width: 260,
            render: (_, c) => (assignments === undefined
                ? <span className="text-gray-400">—</span>
                : <CrewStatusCell status={crewStatusOn(c.id, assignments, today, names)} today={today} />),
        },
        ...(canManage ? [{
            title: '', key: 'actions', width: 96, align: 'right' as const,
            render: (_: unknown, c: CrewDto) => (
                <span className="inline-flex gap-1">
                    <Tooltip title="แก้ไข">
                        <Button size="small" type="text" icon={<EditOutlined />} aria-label={`แก้ไข ${c.name}`}
                            onClick={() => openEditor(editCrewTarget(c))} />
                    </Tooltip>
                    <Popconfirm title={`เก็บถาวร "${c.name}"?`} description="ไม่แสดงในรายการอีก ประวัติการจัดทีมยังอยู่"
                        okText="เก็บถาวร" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => onArchive(c)}>
                        <Button size="small" type="text" className="text-gray-400" icon={<DeleteOutlined />} aria-label={`เก็บถาวร ${c.name}`} />
                    </Popconfirm>
                </span>
            ),
        }] : []),
    ];

    const addCrew = () => openEditor({ mode: 'quick', initial: newCrewValues(rateCards) });
    const firstUse = !crews.isLoading && crews.error === null && all.length === 0;

    return (
        <Card>
            {firstUse
                ? (
                    <div className="flex flex-col items-center text-center gap-3 py-12">
                        <div className="text-[16px] font-semibold text-gray-900">ยังไม่มีทีมช่าง</div>
                        {canManage
                            ? (
                                <>
                                    <div className="text-[14px] text-gray-600 max-w-[420px]">{FIRST_CREW_HINT}</div>
                                    <Button type="primary" size="large" icon={<PlusOutlined />} onClick={addCrew}>เพิ่มทีมแรก</Button>
                                </>
                            )
                            : <div className="text-[14px] text-gray-600">เจ้าของหรือผู้ดูแลเป็นผู้เพิ่มทีม</div>}
                    </div>
                )
                : (
                    <>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <Input allowClear prefix={<SearchOutlined className="text-gray-400" />} placeholder="ค้นหาทีมหรือหัวหน้าทีม"
                                value={search} onChange={e => setSearch(e.target.value)} className="!w-full sm:!w-[260px]" aria-label="ค้นหาทีม" />
                            <Select<WorkforceTradeId> allowClear placeholder="ทุกสายงาน" value={trade} onChange={v => setTrade(v)}
                                options={TRADE_OPTIONS} className="!w-full sm:!w-[220px]" aria-label="กรองตามสายงาน"
                                showSearch={{ optionFilterProp: 'label' }} />
                            {canManage && (
                                <Button type="primary" icon={<PlusOutlined />} className="sm:ml-auto" onClick={addCrew}>เพิ่มทีม</Button>
                            )}
                        </div>
                        <Table<CrewDto> rowKey="id" columns={columns} dataSource={rows} loading={crews.isLoading} size="middle"
                            scroll={{ x: 'max-content' }} tableLayout="fixed"
                            pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
                            locale={{ emptyText: crews.error === null ? 'ไม่พบทีมที่ตรงกับที่ค้นหา' : thaiErrorMessage(crews.error) }} />
                    </>
                )}
            {canManage && (
                <CrewEditor workspaceId={workspaceId} target={editor} seq={seq} people={people} rateCards={rateCards} onChange={openEditor} />
            )}
        </Card>
    );
}

/** "ว่าง", or the project and task with "ถึง dd/mm"; a crew booked twice today says so in red. */
export function CrewStatusCell({ status, today }: { status: CrewStatus; today: string }) {
    if (status.kind === 'free') return <span className="text-gray-500">ว่าง</span>;
    const [first, ...rest] = status.places;
    const lines = placeLines(first, today);
    return (
        <div className="leading-tight min-w-0">
            <div className="truncate" title={lines.where}>{lines.where}</div>
            <div className="text-[12px] text-gray-500 tabular-nums">
                {lines.until}
                {rest.length > 0 && (
                    <Tooltip title={rest.map(p => placeLines(p, today).where).join(', ')}>
                        <span className="text-red-600"> · ชนกับอีก {rest.length} งาน</span>
                    </Tooltip>
                )}
            </div>
        </div>
    );
}
