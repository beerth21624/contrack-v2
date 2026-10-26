'use client';

// S-Curve_Plan_Basic (Excel v5 sheet 03): 32 tasks in 8 งวด, typed start dates, durations from Man-Day,
// weekly plan/actual shares, the S-curve and the status block Q4–Q7.
import { Tag, Tooltip } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, RiseOutlined } from '@ant-design/icons';
import { InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { bucketIndexOf, isoToSerial, serialToIso, type ScheduleInput, type ScheduleTaskInput } from '@/domain/planning';
import { SCurveChart } from '../shared/charts';
import {
    DateCell, DetailSection, NoBoqYet, PlanningHeader, StatTile, SummaryBanner, formatDate, money, usePlanning, usedBucketCount,
} from '../shared/planning-ui';
import { ActualTable } from './ActualTable';
import { GanttTable } from './GanttTable';
import { ScheduleDetailGrid } from './ScheduleDetailGrid';

export function SchedulePage() {
    const { planning, input, stored, setPlanning, result } = usePlanning();
    const sc = input.schedule;
    const s = planning.schedule;
    const save = (next: ScheduleInput) => setPlanning({ schedule: next });
    const setTask = (id: string, patch: Partial<ScheduleTaskInput>) =>
        save({ ...sc, tasks: { ...sc.tasks, [id]: { ...(sc.tasks[id] ?? { start: '' }), ...patch } } });

    /** Moves every planned start by the same number of days (the project start is the first task's start). */
    const shiftStart = (iso: string | undefined) => {
        const from = isoToSerial(s.start);
        const to = isoToSerial(iso);
        if (from === null || to === null || from === to) return;
        const tasks = Object.fromEntries(Object.entries(sc.tasks).map(([id, t]) => {
            const st = isoToSerial(t.start);
            return [id, st === null ? t : { ...t, start: serialToIso(st + to - from) }];
        }));
        save({ ...sc, tasks });
    };

    const status = s.status;
    const lastSerial = isoToSerial(status.lastUpdate);
    const lastBucket = lastSerial === null ? -1 : bucketIndexOf(s.buckets, lastSerial);
    const count = usedBucketCount(s.buckets, s.planWeekly, s.actualWeekly);
    const actualCount = s.tasks.filter(t => t.actual.finish !== null).length;
    const delayTone = status.delayStatus === 'late' ? 'bad' : status.delayStatus === null ? 'default' : 'good';

    return (
        <div className="flex flex-col gap-4">
            <PlanningHeader current="/schedule" title="แผนงาน S-Curve" sheetName="S-Curve_Plan_Basic"
                isDefault={stored.schedule === undefined} onReset={() => setPlanning({ schedule: undefined })} />
            <NoBoqYet constructionTotal={result.boq.constructionTotal} />

            <SummaryBanner headline={s.start && s.finish
                ? <>ใช้เวลา {s.durationDays} วัน เริ่ม {formatDate(s.start)} เสร็จ {formatDate(s.finish)}</>
                : <>ยังไม่ได้กำหนดวันเริ่มงาน</>}>
                {/* Progress, spending and delay are the tiles below: not repeated here. */}
                <span>งบประมาณโครงการ {money(s.budget)} บาท · {s.tasks.length} งาน ใน {s.installments.length} งวด</span>
            </SummaryBanner>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                <SheetCard title="ข้อมูลโครงการ">
                    <InputTextField label="ชื่อโครงการ" value={sc.projectName} onChange={v => save({ ...sc, projectName: v })} />
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 py-1">
                        <span className="text-[13px] text-gray-700">วันที่โครงการเริ่ม</span>
                        <Tooltip title="เปลี่ยนวันเริ่ม = เลื่อนวันเริ่มของทุกงานไปเท่ากัน">
                            <div><DateCell value={s.start} allowClear={false} ariaLabel="วันที่โครงการเริ่ม" onCommit={shiftStart} /></div>
                        </Tooltip>
                    </div>
                    <div className="text-[12px] text-gray-500 mt-1">
                        เปลี่ยนวันเริ่มโครงการ ระบบเลื่อนทุกงานให้ · แก้วันเริ่มรายงานได้ในตารางด้านล่าง ·
                        จำนวนวันมาจากหน้า Man-Day
                    </div>
                </SheetCard>
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatTile label="บันทึกผลงานล่าสุด" value={status.lastUpdate ? formatDate(status.lastUpdate) : '–'}
                        hint={actualCount ? `บันทึกผลงานแล้ว ${actualCount} งาน` : 'กรอกในส่วนบันทึกผลงานจริง'} />
                    <StatTile label={<Tooltip title="Excel เรียกว่างบประมาณตามแผน แต่คิดจาก % คืบหน้า × น้ำหนักงาน × งบ (มูลค่างานที่ทำได้)">
                        <span className="underline decoration-dotted">งบประมาณตามแผน</span></Tooltip>}
                    value={money(status.earnedValue)} unit="บาท" hint="จาก % คืบหน้า" />
                    <StatTile label="งบที่ใช้ไป" value={status.spent === null ? '–' : money(status.spent)} unit={status.spent === null ? undefined : 'บาท'} />
                    <StatTile label="วันล่าช้า" tone={delayTone}
                        value={status.delayText === null ? '–'
                            : <span className="flex items-center gap-1">
                                {status.delayStatus === 'late' ? <ClockCircleOutlined /> : status.delayStatus === 'ahead' ? <RiseOutlined /> : <CheckCircleOutlined />}
                                <span>{status.delayText}</span>
                            </span>} />
                </div>
            </div>

            <SheetCard title="S-Curve แผนงานเทียบผลงาน (สะสม)">
                <SCurveChart buckets={s.buckets.slice(0, count)} plan={s.planCumulative.slice(0, count)}
                    actual={s.actualCumulative.slice(0, count)} actualUntil={Math.min(lastBucket, count - 1)}
                    planWeekly={s.planWeekly.slice(0, count)} />
            </SheetCard>

            <SheetCard title="ตารางงาน" extra={<span className="text-[12px] text-gray-500 flex items-center gap-2">
                <Tag color="blue" variant="filled">แผน</Tag><Tag color="orange" variant="filled">ผลงานจริง</Tag>
            </span>}>
                <GanttTable schedule={s} tasks={sc.tasks} count={count} onTask={setTask} />
                <div className="text-[12px] text-gray-500 mt-2">
                    วันเสร็จ = วันเริ่ม + ระยะเวลา − 1 (นับวันปฏิทิน ไม่เว้นวันหยุด) · 1 เดือนแบ่ง 4 ช่วง: 1–7, 8–15, 16–22, 23–สิ้นเดือน
                </div>
            </SheetCard>

            <DetailSection label={`บันทึกผลงานจริงและ % คืบหน้า${actualCount ? ` — บันทึกแล้ว ${actualCount} งาน` : ''}`}>
                <ActualTable schedule={s} tasks={sc.tasks} onTask={setTask} />
                <div className="text-[12px] text-gray-500 mt-2">
                    ผลงานจริงถ่วงน้ำหนักด้วยค่าใช้จ่ายจริง ÷ งบโครงการ (ตาม Excel) · % คืบหน้าใช้คำนวณ &quot;งบประมาณตามแผน&quot;
                </div>
            </DetailSection>

            <DetailSection label="ดูตารางละเอียด (ตาราง S-Curve รายสัปดาห์แบบ Excel)">
                <ScheduleDetailGrid schedule={s} />
            </DetailSection>
        </div>
    );
}

export default SchedulePage;
