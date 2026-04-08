'use client';

import React, { createContext, useContext, useCallback } from 'react';
import type { PriceItem, StepSaveMap } from '@/types';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { INITIAL_PRICE_LIST } from '@/data/price-list';
import { SCHEDULE_DATA as INITIAL_SCHEDULE_DATA, type StepSchedule } from '@/data/schedule-data';

export interface AppContextType {
    priceList: PriceItem[];
    setPriceList: React.Dispatch<React.SetStateAction<PriceItem[]>>;
    handleUpdatePrice: (code: string, field: 'costMaterial' | 'costLabor', value: number) => void;

    stepSaves: StepSaveMap;
    setStepSaves: React.Dispatch<React.SetStateAction<StepSaveMap>>;
    
    scheduleData: StepSchedule[];
    setScheduleData: React.Dispatch<React.SetStateAction<StepSchedule[]>>;
    handleUpdateSchedule: (stepId: number, field: 'defaultDays' | 'workers' | 'productivityRate', value: number) => void;

    resetAll: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used within a GlobalStateProvider");
    }
    return context;
};

export function GlobalStateProvider({ children }: { children: React.ReactNode }) {
    const [priceList, setPriceList, resetPriceList] = useLocalStorage<PriceItem[]>('boq-price-list', INITIAL_PRICE_LIST);
    const [stepSaves, setStepSaves, resetStepSaves] = useLocalStorage<StepSaveMap>('boq-step-saves', {});
    const [scheduleData, setScheduleData, resetScheduleData] = useLocalStorage<StepSchedule[]>('boq-schedule-data', INITIAL_SCHEDULE_DATA);

    const handleUpdatePrice = useCallback((code: string, field: 'costMaterial' | 'costLabor', value: number) => {
        setPriceList((prev: PriceItem[]) => prev.map((p: PriceItem) => p.code === code ? { ...p, [field]: value } : p));
    }, [setPriceList]);

    const handleUpdateSchedule = useCallback((stepId: number, field: 'defaultDays' | 'workers' | 'productivityRate', value: number) => {
        setScheduleData((prev: StepSchedule[]) => prev.map((s: StepSchedule) => s.stepId === stepId ? { ...s, [field]: value } : s));
    }, [setScheduleData]);

    const resetAll = useCallback(() => {
        resetPriceList();
        resetStepSaves();
        resetScheduleData();
    }, [resetPriceList, resetStepSaves, resetScheduleData]);

    const value: AppContextType = {
        priceList,
        setPriceList,
        handleUpdatePrice,
        stepSaves,
        setStepSaves,
        scheduleData,
        setScheduleData,
        handleUpdateSchedule,
        resetAll,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
