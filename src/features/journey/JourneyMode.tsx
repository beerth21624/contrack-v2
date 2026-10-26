'use client';

import { createContext, useContext } from 'react';

/**
 * True while a calculator page is shown inside a journey level. The calculator frame then drops its own
 * header (the level shows title, plan hint and navigation) and folds the BOQ detail away.
 */
export const JourneyModeContext = createContext(false);

export function useJourneyMode(): boolean {
    return useContext(JourneyModeContext);
}
