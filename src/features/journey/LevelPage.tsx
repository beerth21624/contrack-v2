'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Popconfirm, Progress, Result, Spin, Tag, Typography } from 'antd';
import {
    AppstoreOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined, FileSearchOutlined, LockOutlined,
    StepForwardOutlined, UndoOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '@/store/project-store';
import { computeProject } from '@/domain/project';
import {
    JOURNEY_LEVELS, currentLevel, getLevel, isUnlocked, levelTotal, nextLevel, phaseOf, previousLevel,
} from '@/domain/journey';
import { CALCULATOR_PAGES } from '@/features/calculators/pages';
import { formatNumber } from '@/components/sheet/NumberCell';
import { JourneyModeContext } from './JourneyMode';
import { BoqLevelInputs } from './BoqLevelInputs';
import { ProjectInfoInputs } from './ProjectInfoInputs';
import { LevelSoftLock } from '@/features/cloud/presence/LevelPresence';

const { Title, Text } = Typography;

const spinner = <div className="flex justify-center p-20"><Spin size="large" /></div>;

/** Bottom bar height before it is measured (one row on desktop). */
const BAR_HEIGHT_GUESS = 72;

/** One journey level: what to read from the plan, the inputs, and the way on to the next level. */
export function LevelPage({ levelId }: { levelId: string }) {
    const router = useRouter();
    const project = useProjectStore(s => s.project);
    const setLevelMark = useProjectStore(s => s.setLevelMark);
    const result = useMemo(() => computeProject(project), [project]);
    const level = getLevel(levelId);
    // The fixed bottom bar wraps to two rows on phones: the page keeps that much room below its content.
    const [barHeight, setBarHeight] = useState(BAR_HEIGHT_GUESS);
    const barRef = useCallback((el: HTMLDivElement | null) => {
        if (!el) return undefined;
        const observer = new ResizeObserver(() => setBarHeight(el.offsetHeight));
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    if (!level) return <Result status="404" title="ไม่พบขั้นตอนนี้" extra={<Link href="/journey"><Button>กลับไปภาพรวมขั้นตอน</Button></Link>} />;

    const progress = project.journey ?? {};
    const index = JOURNEY_LEVELS.indexOf(level);
    const phase = phaseOf(level.id);
    const mark = progress[level.id];
    const next = nextLevel(level.id);
    const prev = previousLevel(level.id);

    if (!isUnlocked(level.id, progress)) {
        const current = currentLevel(progress);
        return (
            <Result
                icon={<LockOutlined className="!text-gray-400" />}
                title={`ขั้นตอน "${level.title}" รอขั้นตอนก่อนหน้า`}
                subTitle="กรุณาทำขั้นตอนก่อนหน้าให้เสร็จก่อน จึงจะเริ่มขั้นตอนนี้ได้"
                extra={current && (
                    <Link href={`/journey/${current.id}`}><Button type="primary">ทำต่อ: {current.title}</Button></Link>
                )}
            />
        );
    }

    const Page = level.kind.type === 'calc' ? CALCULATOR_PAGES[level.kind.calc] : undefined;
    const goNext = () => router.push(next ? `/journey/${next.id}` : '/journey');
    const pass = () => { setLevelMark(level.id, 'done'); goNext(); };
    const skip = () => {
        // "ไม่มีในโครงการนี้": the level's calculator goes back to empty so nothing of it stays in the BOQ.
        setLevelMark(level.id, 'skipped');
        goNext();
    };
    const total = levelTotal(level, result);
    // Pre-construction costs (land inspection) sit outside the construction total, as in the BOQ.
    const levelSections = result.boq.sections.filter(s => level.sections.includes(s.no));
    const outsideConstruction = levelSections.length > 0 && levelSections.every(s => !s.inConstructionTotal);

    return (
        <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full" style={{ paddingBottom: barHeight + 24 }}>
            <div className="flex items-center gap-3">
                <Link href="/journey"><Button icon={<AppstoreOutlined />}>ภาพรวมขั้นตอน</Button></Link>
                <Text type="secondary" className="text-[13px] whitespace-nowrap">{phase?.title} · ขั้นตอน {index + 1} จาก {JOURNEY_LEVELS.length}</Text>
                <Progress percent={Math.round(((index + 1) / JOURNEY_LEVELS.length) * 100)} showInfo={false}
                    strokeColor="#fa8c16" className="flex-1 !mb-0" />
            </div>

            <LevelSoftLock levelId={level.id} />

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <Title level={3} style={{ margin: 0 }}>{level.title}</Title>
                    {mark === 'done' && <Tag color="green" icon={<CheckOutlined />}>เสร็จแล้ว</Tag>}
                    {mark === 'skipped' && <Tag icon={<StepForwardOutlined />}>ไม่มีในโครงการนี้</Tag>}
                </div>
                <div className="mt-3 flex gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                    <FileSearchOutlined className="text-blue-500 text-[20px] mt-0.5" />
                    <div>
                        <div className="text-[12px] font-semibold text-blue-700">ดูจากแบบแปลน</div>
                        <div className="text-[14px] text-gray-800">{level.planHint}</div>
                        <div className="text-[12px] text-gray-500 mt-1">
                            กรอกเฉพาะช่องสีเหลือง ช่องสีเขียวระบบคิดให้เอง
                        </div>
                    </div>
                </div>
            </div>

            {mark === 'skipped'
                ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                        ขั้นตอนนี้ระบุว่า &quot;ไม่มีในโครงการนี้&quot; — ไม่นำมาคิดมูลค่า
                        <div className="mt-3">
                            <Button icon={<UndoOutlined />} onClick={() => setLevelMark(level.id, undefined)}>มีงานส่วนนี้ กลับไปกรอกข้อมูล</Button>
                        </div>
                    </div>
                )
                : (
                    <JourneyModeContext.Provider value>
                        {Page
                            ? <Suspense fallback={spinner}><Page /></Suspense>
                            : level.kind.type === 'meta' ? <ProjectInfoInputs />
                                : <BoqLevelInputs sections={level.sections} />}
                    </JourneyModeContext.Provider>
                )}

            <div ref={barRef}
                className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-2px_8px_rgba(0,0,0,.05)] pb-[env(safe-area-inset-bottom)]">
                {/* On a phone the buttons wrap under the total instead of squeezing it. */}
                <div className="max-w-6xl mx-auto px-3 py-2.5 sm:py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {prev
                        ? <Link href={`/journey/${prev.id}`}><Button icon={<ArrowLeftOutlined />} aria-label="ขั้นตอนก่อนหน้า" /></Link>
                        : <Button icon={<ArrowLeftOutlined />} disabled aria-label="ขั้นตอนก่อนหน้า" />}
                    {level.kind.type !== 'meta' && (
                        <div className="min-w-[140px] flex-1 sm:flex-none sm:min-w-0">
                            <div className="text-[11px] text-gray-500 leading-tight">มูลค่าขั้นตอนนี้</div>
                            <div className="text-[18px] font-bold tabular-nums leading-tight">{formatNumber(mark === 'skipped' ? 0 : total, 0)} บาท</div>
                            {outsideConstruction && (
                                <div className="text-[11px] text-gray-500 leading-tight">ค่าใช้จ่ายก่อนเริ่มงาน ไม่รวมในราคาค่าก่อสร้าง</div>
                            )}
                        </div>
                    )}
                    <div className="hidden sm:block min-w-0 pl-3 border-l border-gray-200">
                        <div className="text-[11px] text-gray-500 leading-tight">มูลค่ารวมโครงการ</div>
                        <div className="text-[15px] font-semibold tabular-nums leading-tight text-gray-700">
                            {formatNumber(result.boq.constructionTotal, 0)} บาท
                        </div>
                    </div>
                    <div className="ml-auto flex flex-wrap justify-end items-center gap-2">
                        {level.optional && mark === undefined && (
                            <Popconfirm title="ยืนยันว่าไม่มีงานส่วนนี้ในโครงการ?" description="ระบบจะไม่นำขั้นตอนนี้มาคิดมูลค่า (แก้ไขภายหลังได้)"
                                okText="ยืนยัน" cancelText="ยกเลิก" onConfirm={skip}>
                                <Button icon={<StepForwardOutlined />}>ไม่มีในโครงการนี้</Button>
                            </Popconfirm>
                        )}
                        {mark === undefined
                            ? <Button type="primary" size="large" icon={<CheckOutlined />} onClick={pass}>
                                {next ? 'ยืนยันและไปขั้นตอนถัดไป' : 'ยืนยันและเสร็จสิ้น'}
                            </Button>
                            : <Button type="primary" size="large" onClick={goNext}>
                                {next ? <>ขั้นตอนถัดไป <ArrowRightOutlined /></> : 'กลับไปภาพรวมขั้นตอน'}
                            </Button>}
                    </div>
                </div>
            </div>
        </div>
    );
}
