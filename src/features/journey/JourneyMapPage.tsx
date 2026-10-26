'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Button, Progress, Tag, Typography } from 'antd';
import { CheckOutlined, LockOutlined, CaretRightFilled, StepForwardOutlined, FlagFilled, TableOutlined } from '@ant-design/icons';
import { useProjectStore } from '@/store/project-store';
import { computeProject } from '@/domain/project';
import { JOURNEY, JOURNEY_LEVELS, currentLevel, journeyComplete, journeyRatio, levelStates, levelTotal, type LevelState } from '@/domain/journey';
import { formatNumber } from '@/components/sheet/NumberCell';
import { NewProjectButton } from './NewProjectButton';
import { BoqExportButtons } from '@/features/export/BoqExportButtons';
import { LevelAssignee, LevelPresenceAvatars, useCloudLevelInfo } from '@/features/cloud/presence/LevelPresence';
import { RevisionButtons } from '@/features/cloud/revisions/RevisionButtons';
import { useCloud } from '@/features/cloud/state';

const { Title, Text } = Typography;

const NODE_STYLE: Record<LevelState, { ring: string; bg: string; fg: string }> = {
    done: { ring: 'border-green-500', bg: 'bg-green-500', fg: 'text-white' },
    skipped: { ring: 'border-gray-300', bg: 'bg-gray-200', fg: 'text-gray-500' },
    current: { ring: 'border-orange-500', bg: 'bg-orange-500', fg: 'text-white' },
    locked: { ring: 'border-gray-200', bg: 'bg-gray-100', fg: 'text-gray-400' },
};

function NodeIcon({ state, n }: { state: LevelState; n: number }) {
    if (state === 'done') return <CheckOutlined />;
    if (state === 'skipped') return <StepForwardOutlined />;
    if (state === 'locked') return <LockOutlined />;
    return <span className="font-bold">{n}</span>;
}

/** The level map: every level in journey order, grouped by phase, with what is done and what comes next. */
export function JourneyMapPage() {
    const project = useProjectStore(s => s.project);
    const progress = project.journey ?? {};
    const result = useMemo(() => computeProject(project), [project]);
    const states = levelStates(progress);
    const next = currentLevel(progress);
    const complete = journeyComplete(progress);
    const passed = JOURNEY_LEVELS.filter(l => progress[l.id] !== undefined).length;
    // Cloud project only: who is on which level and who is assigned (nothing in guest mode).
    const team = useCloudLevelInfo();
    const cloudName = useCloud(s => s.project?.name);
    const title = project.meta.projectName !== '' ? project.meta.projectName : cloudName ?? 'โครงการของฉัน';

    return (
        <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Text className="text-[11px] font-bold tracking-widest text-orange-500 uppercase whitespace-nowrap">จัดทำ BOQ</Text>
                        {project.start !== 'blank' && <Tag className="!text-[11px]">บ้านตัวอย่าง Excel v5</Tag>}
                        <span className="ml-auto"><NewProjectButton /></span>
                    </div>
                    <Title level={3} style={{ margin: '2px 0 4px', overflowWrap: 'anywhere' }}>{title}</Title>
                    <Text type="secondary" className="text-[13px]">
                        เปิดแบบแปลนประกอบ แล้วกรอกข้อมูลตามแต่ละขั้นตอน เมื่อครบทุกขั้นตอนจะได้สรุป BOQ ทั้งโครงการทันที
                    </Text>
                    <div className="mt-3 flex items-center gap-3">
                        <Progress percent={Math.round(journeyRatio(progress) * 100)} strokeColor="#fa8c16" className="flex-1 !mb-0" />
                        <Text className="whitespace-nowrap text-[13px] text-gray-600">{passed}/{JOURNEY_LEVELS.length} ขั้นตอน</Text>
                    </div>
                </div>
                <div className="md:text-right md:pl-6 md:border-l border-gray-100">
                    <Text type="secondary" className="text-[12px]">ราคาค่าก่อสร้างปัจจุบัน</Text>
                    <div className="text-[26px] font-bold tabular-nums text-gray-900 leading-tight">
                        {formatNumber(result.boq.constructionTotal, 0)} <span className="text-[14px] font-normal text-gray-500">บาท</span>
                    </div>
                    {next
                        ? (
                            <Link href={`/journey/${next.id}`} className="inline-flex max-w-full">
                                <Button type="primary" size="large" icon={<CaretRightFilled />} className="mt-2 max-w-full">
                                    <span className="truncate min-w-0">{passed === 0 ? 'เริ่มขั้นตอนแรก' : 'ทำต่อ'}: {next.title}</span>
                                </Button>
                            </Link>
                        )
                        : (
                            <Link href="/boq">
                                <Button type="primary" size="large" icon={<TableOutlined />} className="mt-2">ดูสรุป BOQ ทั้งโครงการ</Button>
                            </Link>
                        )}
                </div>
            </div>

            {JOURNEY.map(phase => {
                const done = phase.levels.filter(l => progress[l.id] !== undefined).length;
                const phaseLocked = phase.levels.every(l => states[l.id] === 'locked');
                return (
                    <section key={phase.id} className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${phaseLocked ? 'opacity-70' : ''}`}>
                        <div className="flex items-center gap-3 mb-3">
                            <Title level={5} style={{ margin: 0 }}>{phase.title}</Title>
                            <Text type="secondary" className="text-[12px]">{done}/{phase.levels.length}</Text>
                            {done === phase.levels.length && <span className="text-[12px] text-green-600 font-semibold">ครบทุกขั้นตอน</span>}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {phase.levels.map(level => {
                                const n = JOURNEY_LEVELS.indexOf(level) + 1;
                                const state = states[level.id] ?? 'locked';
                                const style = NODE_STYLE[state];
                                const body = (
                                    <div className={`flex items-center gap-2 sm:gap-3 rounded-lg border-2 px-2.5 sm:px-3 py-2 min-h-[52px] h-full w-full transition
                                        ${style.ring} ${state === 'locked' ? 'cursor-not-allowed' : 'hover:shadow-md cursor-pointer'}
                                        ${state === 'current' ? 'bg-orange-50 ring-2 ring-orange-200' : 'bg-white'}`}>
                                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[13px] ${style.bg} ${style.fg}`}>
                                            <NodeIcon state={state} n={n} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-[14px] font-semibold leading-tight ${state === 'locked' ? 'text-gray-400' : 'text-gray-800'}`}>{level.title}</div>
                                            <div className="text-[12px] text-gray-500 tabular-nums">
                                                {state === 'skipped' ? 'ไม่มีในโครงการนี้'
                                                    : state === 'done'
                                                        ? (level.kind.type === 'meta' ? 'เสร็จแล้ว' : `${formatNumber(levelTotal(level, result), 0)} บาท`)
                                                        : state === 'current' ? 'ขั้นตอนปัจจุบัน' : 'รอขั้นตอนก่อนหน้า'}
                                            </div>
                                        </div>
                                        <LevelPresenceAvatars info={team} levelId={level.id} />
                                    </div>
                                );
                                const node = state === 'locked'
                                    ? <div title="ทำขั้นตอนก่อนหน้าให้เสร็จก่อน" className="flex flex-1">{body}</div>
                                    : <Link href={`/journey/${level.id}`} className="flex flex-1">{body}</Link>;
                                if (!team.enabled) return <div key={level.id} className="flex">{node}</div>;
                                return (
                                    <div key={level.id} className="flex flex-col gap-0.5">
                                        {node}
                                        <LevelAssignee info={team} levelId={level.id} />
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}

            <section className={`rounded-xl p-5 border-2 border-dashed flex flex-wrap items-center gap-4 ${complete ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                <FlagFilled className={`text-[28px] ${complete ? 'text-green-500' : 'text-gray-300'}`} />
                <div className="flex-1 min-w-[200px]">
                    <div className="font-semibold text-[15px]">{complete ? 'ครบทุกขั้นตอนแล้ว — สรุป BOQ ทั้งโครงการพร้อมใช้งาน' : 'สรุป BOQ ทั้งโครงการ'}</div>
                    <Text type="secondary" className="text-[13px]">
                        {complete ? 'ตรวจทาน ปรับราคา และพิมพ์หรือส่งออก BOQ ได้' : 'พร้อมใช้งานเมื่อทำครบทุกขั้นตอน (หรือระบุว่า "ไม่มีในโครงการนี้")'}
                    </Text>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                    <Link href="/boq"><Button type={complete ? 'primary' : 'default'} icon={<TableOutlined />}>เปิด BOQ</Button></Link>
                    {complete && <BoqExportButtons />}
                    {complete && <RevisionButtons />}
                </div>
            </section>
        </div>
    );
}
