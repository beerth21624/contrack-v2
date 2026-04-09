// ── Schedule Engine ───────────────────────────────────────────────────────────
// Compute project schedule from BOQ saved data + คู่มือ 4 duration knowledge

import { SCHEDULE_DATA, type StepSchedule } from '@/data/schedule-data';
import type { StepResult } from '@/types';

export interface ScheduleItem {
    stepId: number;
    title: string;
    titleEn: string;
    /** Calculated or default duration (working days) */
    days: number;
    /** Number of crews */
    crews: number;
    crewSetup: string;
    crewSetupEn?: string;
    team: string;
    teamEn?: string;
    productivity: string;
    productivityEn?: string;
    productivityUnitEn?: string;
    /** Calculated start day (1-indexed from project start) */
    startDay: number;
    /** Calculated end day */
    endDay: number;
    /** Whether BOQ data was used to adjust duration */
    hasBoqData: boolean;
    isManualMode?: boolean;
    /** Parallel group ID (steps in same group can overlap) */
    parallelGroup: number | null;
}

export interface ScheduleConfig {
    crewOverrides: Record<number, number>; // stepId -> count
    dayOverrides: Record<number, number>; // stepId -> days
    isManualOverrides: Record<number, boolean>; // stepId -> boolean
    weatherBufferPercent: number; // e.g. 0.10 for +10% 
    globalCuringDays?: number; // Override for concrete curing lag
}

export interface ProjectSchedule {
    items: ScheduleItem[];
    totalDays: number;
    totalCrewDays: number;
    criticalPath: number[];
}

/**
 * Compute adjusted duration for a step based on BOQ quantity and productivity rate.
 * Falls back to default days if no BOQ data or no productivity rate.
 */
function calcAdjustedDays(
    sched: StepSchedule, 
    stepResult: StepResult | undefined,
    stepInput: unknown,
    config: ScheduleConfig
): { days: number; hasBoq: boolean; isManual: boolean } {
    let baseDays = sched.defaultDays;
    let hasBoq = false;
    const isManual = config.isManualOverrides[sched.stepId] ?? false;

    if (stepResult && sched.productivityRate && !isManual) {
        const q = stepResult.quantities;
        let totalQty = 0;

        // Map step to the relevant quantity key for duration calc
        switch (sched.stepId) {
            case 1: totalQty = q.total_volume?.qty ?? 0; break;
            case 5: totalQty = q.total_length?.qty ?? 0; break; // pile count from length
            case 6: {
                // Use actual footing count from stepInput instead of volume approximation
                const inp6 = stepInput as { footings?: { count: number }[] } | undefined;
                totalQty = (inp6?.footings ?? []).reduce((s, f) => s + f.count, 0);
                if (totalQty === 0 && q.concrete_volume?.qty) {
                    totalQty = Math.ceil(q.concrete_volume.qty / 0.5);
                }

                break;
            }
            case 7: {
                const inp7 = stepInput as { pedestals?: { count: number }[] } | undefined;
                totalQty = (inp7?.pedestals ?? []).reduce((s, p) => s + p.count, 0);
                if (totalQty === 0 && q.concrete_volume?.qty) {
                    totalQty = Math.ceil(q.concrete_volume.qty / 0.05);
                }

                break;
            }
            case 8: totalQty = q.concrete_volume?.qty ? q.concrete_volume.qty / 0.1 * 1 : 0; break; // linear m from volume
            case 9: totalQty = q.concrete_volume?.qty ? q.concrete_volume.qty / 0.1 : 0; break; // sqm from volume
            case 10: totalQty = q.panel_area?.qty ?? 0; break;
            case 11: {
                const inp11 = stepInput as { columns?: { count: number }[] } | undefined;
                totalQty = (inp11?.columns ?? []).reduce((s, c) => s + c.count, 0);
                if (totalQty === 0 && q.concrete_volume?.qty) {
                    totalQty = Math.ceil(q.concrete_volume.qty / 0.05);
                }

                break;
            }
            case 14: totalQty = q.anchor_bolts?.qty ? Math.ceil(q.anchor_bolts.qty / 4) : 0; break;
            case 15: totalQty = q.steel_weight?.qty ?? 0; break; // if structural steel exists
            case 16: totalQty = q.roofing_area?.qty ?? 0; break;
            case 17: totalQty = q.net_wall_area?.qty ?? q.bricks_required?.qty ? (q.net_wall_area?.qty ?? 0) : 0; break;
            case 18: {
                const ext = q.plaster_exterior?.qty ?? 0;
                const int_ = q.plaster_interior?.qty ?? 0;
                totalQty = ext + int_;
                break;
            }
            case 19: totalQty = q.ceiling_area?.qty ?? 0; break;
            case 20: totalQty = q.tile_area?.qty ?? 0; break;
            case 21: {
                const fl = q.floor_tiles?.qty ?? 0;
                const wl = q.wall_tiles?.qty ?? 0;
                totalQty = fl + wl;
                break;
            }
            case 23: totalQty = q.primer_interior?.qty ?? 0; break; // gallons not sqm, use default
            case 25: {
                const ip = q.interior_paint?.qty ?? 0;
                const ep = q.exterior_paint?.qty ?? 0;
                totalQty = ip + ep; // gallons — rough area estimate
                break;
            }
            case 30: totalQty = q.toilets?.qty ?? 0; break; // rooms ~ toilet count
            case 31: totalQty = q.doors?.qty ?? 0; break;
            case 32: {
                const ip2 = q.interior_paint?.qty ?? 0;
                const ep2 = q.exterior_paint?.qty ?? 0;
                totalQty = ip2 + ep2;
                break;
            }
            default: break;
        }

        if (totalQty > 0) {
            const crews = config.crewOverrides[sched.stepId] ?? sched.crews;
            const effectiveRate = (sched.productivityRate || 0) * crews;
            baseDays = Math.max(1, Math.ceil(totalQty / effectiveRate));
            hasBoq = true;
        }
    } else if (isManual && config.dayOverrides[sched.stepId]) {
        baseDays = Math.max(1, config.dayOverrides[sched.stepId] ?? 1);
    }

    const finalDays = Math.max(1, Math.ceil(baseDays * (1 + config.weatherBufferPercent)));

    return { days: finalDays, hasBoq, isManual };
}

/**
 * Build full project schedule using BOQ data + คู่มือ 4 defaults.
 * Resolves dependencies and produces start/end days for each step.
 */
export function buildSchedule(
    stepSaves: Record<number, { inp?: unknown; res: StepResult } | undefined>,
    customSchedule?: StepSchedule[],
    config: ScheduleConfig = { crewOverrides: {}, dayOverrides: {}, isManualOverrides: {}, weatherBufferPercent: 0 }
): ProjectSchedule {
    const schedData = customSchedule ?? SCHEDULE_DATA;

    // 1. Calculate duration for each step
    const items: ScheduleItem[] = schedData.map((sched) => {
        const save = stepSaves[sched.stepId];
        const { days, hasBoq, isManual } = calcAdjustedDays(sched, save?.res, save?.inp, config);
        const crews = config.crewOverrides[sched.stepId] ?? sched.crews;
        
        return {
            stepId: sched.stepId,
            title: sched.title,
            titleEn: sched.titleEn,
            days,
            crews,
            crewSetup: sched.crewSetup,
            crewSetupEn: sched.crewSetupEn,
            team: sched.team,
            teamEn: sched.teamEn,
            productivity: sched.productivity,
            productivityEn: sched.productivityEn,
            productivityUnitEn: sched.productivityUnitEn,
            startDay: 0,
            endDay: 0,
            hasBoqData: hasBoq,
            isManualMode: isManual,
            parallelGroup: null,
        };
    });

    // 2. Assign parallel groups
    const parallelGroups: number[][] = [];
    const assignedToGroup = new Set<number>();
    for (const sched of schedData) {
        if (sched.parallelWith.length > 0 && !assignedToGroup.has(sched.stepId)) {
            const group = [sched.stepId, ...sched.parallelWith.filter(id => !assignedToGroup.has(id))];
            const uniqueGroup = [...new Set(group)].sort((a, b) => a - b);
            parallelGroups.push(uniqueGroup);
            uniqueGroup.forEach(id => assignedToGroup.add(id));
        }
    }

    const stepGroupMap = new Map<number, number>();
    parallelGroups.forEach((group, gi) => {
        group.forEach(id => stepGroupMap.set(id, gi));
    });

    items.forEach(item => {
        item.parallelGroup = stepGroupMap.get(item.stepId) ?? null;
    });

    // 3. Resolve start/end days via topological order
    const endDayMap = new Map<number, number>();

    for (const sched of schedData) {
        const item = items.find(it => it.stepId === sched.stepId);
        if (!item) continue;

        let startDay = 1;

        // Start after all dependencies finish (including concrete curing lag)
        for (const depId of sched.dependsOn) {
            const depEnd = endDayMap.get(depId) ?? 0;
            const depSched = schedData.find(s => s.stepId === depId);
            const curingLag = depSched?.curingDays !== undefined 
                ? (config.globalCuringDays ?? depSched.curingDays) 
                : 0;
            
            let thisDepStart = depEnd + curingLag + 1;

            if (sched.leadPercent?.[depId] !== undefined) {
                const depItem = items.find(it => it.stepId === depId);
                const depDays = depItem?.days ?? 1;
                const leadDays = Math.floor(depDays * sched.leadPercent[depId]);
                thisDepStart = Math.min(depEnd, depEnd - leadDays + 1);
            }

            startDay = Math.max(startDay, thisDepStart);
        }

        // If in a parallel group, all items in the group start together
        if (item.parallelGroup !== null) {
            const group = parallelGroups[item.parallelGroup];
            if (!group) continue;

            const allDepsForGroup = new Set<number>();
            group.forEach(gId => {
                const gSched = schedData.find(s => s.stepId === gId);
                if (!gSched) return;

                gSched.dependsOn.forEach(d => {
                    if (!group.includes(d)) allDepsForGroup.add(d);
                });
            });

            let groupStart = 1;
            allDepsForGroup.forEach(depId => {
                const depEnd = endDayMap.get(depId) ?? 0;
                groupStart = Math.max(groupStart, depEnd + 1);
            });
            startDay = Math.max(startDay, groupStart);
        }

        item.startDay = startDay;
        item.endDay = startDay + item.days - 1;
        endDayMap.set(sched.stepId, item.endDay);
    }

    // 4. Compute totals
    const totalDays = Math.max(...items.map(it => it.endDay));
    const totalCrewDays = items.reduce((sum, it) => sum + it.days * it.crews, 0);

    // 5. Simple critical path: steps not in parallel groups or the longest in each group
    const criticalPath: number[] = [];
    const processedGroups = new Set<number>();
    for (const item of items) {
        if (item.parallelGroup === null) {
            criticalPath.push(item.stepId);
        } else if (!processedGroups.has(item.parallelGroup)) {
            processedGroups.add(item.parallelGroup);
            const group = parallelGroups[item.parallelGroup];
            if (!group) continue;

            const longestInGroup = group.reduce((longest, id) => {
                const it = items.find(x => x.stepId === id);
                const cur = items.find(x => x.stepId === longest);
                if (!it || !cur) return longest;
                return it.days > cur.days ? id : longest;
            }, group[0] ?? item.stepId);
            criticalPath.push(longestInGroup);

        }
    }

    return { items, totalDays, totalCrewDays, criticalPath };
}
