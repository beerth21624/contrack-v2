// Page component for each calculator id (lazy-loaded). Add an entry when a calculator gets its page.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export const CALCULATOR_PAGES: Record<string, LazyExoticComponent<ComponentType>> = {
    'land-inspection': lazy(() => import('./land-inspection/LandInspectionPage')),
    'demolition': lazy(() => import('./demolition/DemolitionPage')),
    'fill': lazy(() => import('./fill/FillPage')),
    'temp-utilities': lazy(() => import('./temp-utilities/TempUtilitiesPage')),
    'site-camp': lazy(() => import('./site-camp/SiteCampPage')),
    'layout': lazy(() => import('./layout/LayoutPage')),
    'piles': lazy(() => import('./piles/PilesPage')),
};
