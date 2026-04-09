'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PriceItem, StepSaveMap, StepResult, StepId, StepInputMap } from '@/types';
import { INITIAL_PRICE_LIST } from '@/data/price-list';
import { SCHEDULE_DATA as INITIAL_SCHEDULE_DATA, type StepSchedule } from '@/data/schedule-data';
import type { ScheduleConfig } from '@/lib/schedule-engine';

export const INITIAL_SCHEDULE_CONFIG: ScheduleConfig = { 
    crewOverrides: {}, 
    dayOverrides: {}, 
    isManualOverrides: {}, 
    weatherBufferPercent: 0,
    globalCuringDays: 7,
};

export interface FinancialConfig {
    overheadPercent: number;
    fixedMonthlyOverhead: number;
    profitPercent: number;
    taxPercent: number;
    contingencyPercent: number;
}

export const INITIAL_FINANCIAL_CONFIG: FinancialConfig = {
    overheadPercent: 5,
    fixedMonthlyOverhead: 0,
    profitPercent: 15,
    taxPercent: 7,
    contingencyPercent: 5,
};

export interface ProjectMeta {
    projectName: string;
    clientName: string;
    location: string;
    documentDate: string;
}

export const INITIAL_PROJECT_META: ProjectMeta = {
    projectName: '',
    clientName: '',
    location: '',
    documentDate: '',
};

export interface AppState {
    _hasHydrated: boolean;
    setHasHydrated: (state: boolean) => void;

    priceList: PriceItem[];
    setPriceList: (updater: PriceItem[] | ((prev: PriceItem[]) => PriceItem[])) => void;
    handleUpdatePrice: (code: string, field: 'costMaterial' | 'costLabor', value: number) => void;

    stepSaves: StepSaveMap;
    setStepSaves: (updater: StepSaveMap | ((prev: StepSaveMap) => StepSaveMap)) => void;
    saveStep: <S extends StepId>(id: S, inp: StepInputMap[S], res: StepResult) => void;

    scheduleData: StepSchedule[];
    setScheduleData: (updater: StepSchedule[] | ((prev: StepSchedule[]) => StepSchedule[])) => void;
    handleUpdateSchedule: (stepId: number, field: 'defaultDays' | 'crews' | 'productivityRate', value: number) => void;

    scheduleConfig: ScheduleConfig;
    setScheduleConfig: (updater: ScheduleConfig | ((prev: ScheduleConfig) => ScheduleConfig)) => void;

    financialConfig: FinancialConfig;
    setFinancialConfig: (updater: FinancialConfig | ((prev: FinancialConfig) => FinancialConfig)) => void;

    projectMeta: ProjectMeta;
    setProjectMeta: (updater: ProjectMeta | ((prev: ProjectMeta) => ProjectMeta)) => void;

    resetAll: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            _hasHydrated: false,
            setHasHydrated: (state) => set({ _hasHydrated: state }),

            priceList: INITIAL_PRICE_LIST,
            setPriceList: (updater) => set((state) => ({
                priceList: typeof updater === 'function' ? updater(state.priceList) : updater
            })),
            handleUpdatePrice: (code, field, value) => set((state) => ({
                priceList: state.priceList.map(p => p.code === code ? { ...p, [field]: value } : p)
            })),

            stepSaves: {},
            setStepSaves: (updater) => set((state) => ({
                stepSaves: typeof updater === 'function' ? updater(state.stepSaves) : updater
            })),
            saveStep: (id, inp, res) => set((state) => ({
                stepSaves: { ...state.stepSaves, [id]: { inp, res } }
            })),

            scheduleData: INITIAL_SCHEDULE_DATA,
            setScheduleData: (updater) => set((state) => ({
                scheduleData: typeof updater === 'function' ? updater(state.scheduleData) : updater
            })),
            handleUpdateSchedule: (stepId, field, value) => set((state) => ({
                scheduleData: state.scheduleData.map(s => s.stepId === stepId ? { ...s, [field]: value } : s)
            })),

            scheduleConfig: INITIAL_SCHEDULE_CONFIG,
            setScheduleConfig: (updater) => set((state) => ({
                scheduleConfig: typeof updater === 'function' ? updater(state.scheduleConfig) : updater
            })),

            financialConfig: INITIAL_FINANCIAL_CONFIG,
            setFinancialConfig: (updater) => set((state) => ({
                financialConfig: typeof updater === 'function' ? updater(state.financialConfig) : updater
            })),

            projectMeta: INITIAL_PROJECT_META,
            setProjectMeta: (updater) => set((state) => ({
                projectMeta: typeof updater === 'function' ? updater(state.projectMeta) : updater
            })),

            resetAll: () => set({
                priceList: INITIAL_PRICE_LIST,
                stepSaves: {},
                scheduleData: INITIAL_SCHEDULE_DATA,
                scheduleConfig: INITIAL_SCHEDULE_CONFIG,
                financialConfig: INITIAL_FINANCIAL_CONFIG,
                projectMeta: INITIAL_PROJECT_META,
            }),
        }),
        {
            name: 'boq-storage',
            storage: createJSONStorage(() => localStorage),
            merge: (persistedState: unknown, currentState: AppState) => {
                const persisted = (persistedState ?? {}) as Partial<AppState>;
                const merged = { ...currentState, ...persisted };

                // ── Price List: match by code, overlay user edits onto latest defaults ──
                if (persisted.priceList && Array.isArray(persisted.priceList)) {
                    const savedPriceList = persisted.priceList;
                    merged.priceList = currentState.priceList.map(defaultItem => {
                        const saved = savedPriceList.find(p => p.code === defaultItem.code);
                        if (saved) {
                            return { 
                                ...defaultItem, 
                                costMaterial: saved.costMaterial, 
                                costLabor: saved.costLabor 
                            };
                        }
                        return defaultItem;
                    });
                }

                // ── Schedule Data: match by stepId, overlay user edits onto latest defaults ──
                if (persisted.scheduleData && Array.isArray(persisted.scheduleData)) {
                    const savedScheduleData = persisted.scheduleData;
                    merged.scheduleData = currentState.scheduleData.map(defaultStep => {
                        const saved = savedScheduleData.find(s => s.stepId === defaultStep.stepId);
                        if (saved) {
                            return {
                                ...defaultStep,
                                defaultDays: saved.defaultDays,
                                crews: (typeof saved.crews === 'number' && !isNaN(saved.crews)) ? saved.crews : defaultStep.crews,
                                crewSetup: saved.crewSetup,
                                productivityRate: saved.productivityRate,
                            };
                        }
                        return defaultStep;
                    });
                }

                // ── Financial Config: merge field-by-field with defaults ──
                merged.financialConfig = {
                    ...INITIAL_FINANCIAL_CONFIG,
                    ...(persisted.financialConfig ?? {}),
                };

                // ── Project Metadata: merge field-by-field with defaults ──
                merged.projectMeta = {
                    ...INITIAL_PROJECT_META,
                    ...(persisted.projectMeta ?? {}),
                };

                // ── Schedule Config: merge field-by-field with defaults ──
                merged.scheduleConfig = {
                    ...INITIAL_SCHEDULE_CONFIG,
                    ...(persisted.scheduleConfig ?? {}),
                };

                return merged;
            },
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            }
        }
    )
);
