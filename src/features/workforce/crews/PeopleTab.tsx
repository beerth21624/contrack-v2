'use client';

// ─── Tab "บุคลากร": the people of the workspace (not necessarily users), their trades, wage and crews ───
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { App, Button, Input, Popconfirm, Select, Table, Tag, Tooltip, type TableColumnsType } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { CrewDto, PersonDto, PersonRole, WorkforceTradeId } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useArchivePerson } from '@/features/cloud/api/workforce';
import { PersonEditor, type PersonEditorTarget } from './PersonEditor';
import { crewsByPerson, filterPeople, tradeLabel } from './logic';
import { employmentNameOf, roleNameOf } from '../text';
import { Card, baht, useWorkforceOptions, useWriteErrorMessage } from './shared';

interface Props {
    workspaceId: string;
    canManage: boolean;
    seeWages: boolean;
    people: { data: PersonDto[] | undefined; isLoading: boolean; error: unknown };
    crews: readonly CrewDto[];
}

const MAX_TRADE_TAGS = 2;

export function PeopleTab({ workspaceId, canManage, seeWages, people, crews }: Props) {
    const { message } = App.useApp();
    const t = useTranslations('workforce');
    const tc = useTranslations('common');
    const locale = useLocale();
    const options = useWorkforceOptions();
    const writeErrorMessage = useWriteErrorMessage();
    const errorMessage = useErrorMessage();
    const archive = useArchivePerson(workspaceId);
    const [search, setSearch] = useState('');
    const [trade, setTrade] = useState<WorkforceTradeId | undefined>(undefined);
    const [role, setRole] = useState<PersonRole | undefined>(undefined);
    const [editor, setEditor] = useState<PersonEditorTarget>({ mode: 'closed' });
    const [seq, setSeq] = useState(0);
    const open = (person: PersonDto | undefined) => {
        setEditor({ mode: 'open', person });
        setSeq(s => s + 1);
    };

    const all = useMemo(() => (people.data ?? []).filter(p => p.archivedAt === null), [people.data]);
    const rows = useMemo(() => filterPeople(all, { search, trade, role }), [all, search, trade, role]);
    const crewsOf = useMemo(() => crewsByPerson(crews), [crews]);
    const showWage = seeWages && all.some(p => !p.wagesHidden);

    const onArchive = (p: PersonDto) => archive.mutateAsync(p.id).then(
        () => { void message.success(t('shared.archivedNamed', { name: p.name })); },
        (e: unknown) => { void message.error(writeErrorMessage(e)); },
    );

    const columns: TableColumnsType<PersonDto> = [
        {
            title: t('people.table.name'), key: 'name', width: 200, fixed: 'left',
            sorter: (a, b) => a.name.localeCompare(b.name, locale),
            render: (_, p) => (
                <span>
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {p.nickname !== null && p.nickname.trim() !== '' && <span className="text-gray-500"> ({p.nickname})</span>}
                </span>
            ),
        },
        { title: t('people.table.role'), key: 'role', width: 160, render: (_, p) => roleNameOf(t, p.role) },
        { title: t('people.table.employment'), key: 'employment', width: 120, render: (_, p) => employmentNameOf(t, p.employment) },
        {
            title: t('people.table.trades'), key: 'trades', width: 220,
            render: (_, p) => {
                if (p.trades.length === 0) return <span className="text-gray-400">—</span>;
                const shown = p.trades.slice(0, MAX_TRADE_TAGS);
                const more = p.trades.slice(MAX_TRADE_TAGS);
                return (
                    <span className="inline-flex flex-wrap gap-1">
                        {shown.map(t => <Tag key={t} className="!m-0">{tradeLabel(t)}</Tag>)}
                        {more.length > 0 && (
                            <Tooltip title={more.map(tradeLabel).join(', ')}><Tag className="!m-0">+{more.length}</Tag></Tooltip>
                        )}
                    </span>
                );
            },
        },
        {
            title: t('people.table.phone'), key: 'phone', width: 130,
            render: (_, p) => (p.phone === null ? <span className="text-gray-400">—</span> : <span className="tabular-nums">{p.phone}</span>),
        },
        ...(showWage ? [{
            title: t('people.table.wage'), key: 'wage', width: 120, align: 'right' as const,
            sorter: (a: PersonDto, b: PersonDto) => (a.dailyWage ?? -1) - (b.dailyWage ?? -1),
            render: (_: unknown, p: PersonDto) => (p.dailyWage === null
                ? <span className="text-gray-400">—</span>
                : <span className="tabular-nums">{baht(p.dailyWage)}</span>),
        }] : []),
        {
            title: t('people.table.crews'), key: 'crews', width: 200,
            render: (_, p) => {
                const list = crewsOf.get(p.id) ?? [];
                if (list.length === 0) return <span className="text-gray-400">—</span>;
                const text = list.map(c => (c.leaderId === p.id ? t('people.table.leaderOf', { name: c.name }) : c.name)).join(', ');
                return <div className="truncate" title={text}>{text}</div>;
            },
        },
        ...(canManage ? [{
            title: '', key: 'actions', width: 96, align: 'right' as const,
            render: (_: unknown, p: PersonDto) => (
                <span className="inline-flex gap-1">
                    <Tooltip title={t('crews.table.edit')}>
                        <Button size="small" type="text" icon={<EditOutlined />} aria-label={t('crews.table.editAria', { name: p.name })} onClick={() => open(p)} />
                    </Tooltip>
                    <Popconfirm title={t('crews.table.archiveTitle', { name: p.name })} description={t('people.table.archiveDesc')}
                        okText={t('crews.table.archiveOk')} cancelText={tc('cancel')} okButtonProps={{ danger: true }} onConfirm={() => onArchive(p)}>
                        <Button size="small" type="text" className="text-gray-400" icon={<DeleteOutlined />} aria-label={t('crews.table.archiveAria', { name: p.name })} />
                    </Popconfirm>
                </span>
            ),
        }] : []),
    ];

    const firstUse = !people.isLoading && people.error === null && all.length === 0;

    return (
        <Card>
            {firstUse
                ? (
                    <div className="flex flex-col items-center text-center gap-3 py-12">
                        <div className="text-[16px] font-semibold text-gray-900">{t('people.empty.title')}</div>
                        {canManage
                            ? (
                                <>
                                    <div className="text-[14px] text-gray-600 max-w-[420px]">
                                        {t('people.empty.hint')}
                                    </div>
                                    <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => open(undefined)}>{t('people.empty.add')}</Button>
                                </>
                            )
                            : <div className="text-[14px] text-gray-600">{t('people.empty.viewer')}</div>}
                    </div>
                )
                : (
                    <>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <Input allowClear prefix={<SearchOutlined className="text-gray-400" />} placeholder={t('people.filter.search')}
                                value={search} onChange={e => setSearch(e.target.value)} className="!w-full sm:!w-[260px]" aria-label={t('people.filter.searchAria')} />
                            <Select<WorkforceTradeId> allowClear placeholder={t('crews.filter.allTrades')} value={trade} onChange={v => setTrade(v)}
                                options={options.trades} className="!w-full sm:!w-[220px]" aria-label={t('crews.filter.tradeAria')}
                                showSearch={{ optionFilterProp: 'label' }} />
                            <Select<PersonRole> allowClear placeholder={t('people.filter.allRoles')} value={role} onChange={v => setRole(v)}
                                options={options.roles} className="!w-full sm:!w-[190px]" aria-label={t('people.filter.roleAria')} />
                            {canManage && (
                                <Button type="primary" icon={<PlusOutlined />} className="sm:ml-auto" onClick={() => open(undefined)}>{t('people.empty.add')}</Button>
                            )}
                        </div>
                        <Table<PersonDto> rowKey="id" columns={columns} dataSource={rows} loading={people.isLoading} size="middle"
                            scroll={{ x: 'max-content' }} tableLayout="fixed"
                            pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
                            locale={{ emptyText: people.error === null ? t('people.table.noMatch') : errorMessage(people.error) }} />
                    </>
                )}
            {canManage && (
                <PersonEditor key={seq} workspaceId={workspaceId} target={editor} seeWages={seeWages}
                    onClose={() => setEditor({ mode: 'closed' })} />
            )}
        </Card>
    );
}
