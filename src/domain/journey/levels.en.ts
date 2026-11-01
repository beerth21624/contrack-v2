// ─── English overlay of the guided journey (docs/erp/03-i18n.md §9): phase and level names and plan hints ───
// Keyed by phase / level id. Pure data + lookups; levels.ts (Thai) stays the source of truth and the fallback.
import { JOURNEY_LEVELS, JOURNEY, type JourneyLevel, type JourneyPhase } from './levels';

export const PHASE_TITLES_EN: Readonly<Record<string, string>> = {
    prepare: 'Preparation',
    foundation: 'Foundation',
    structure: 'Slabs, columns, beams',
    roof: 'Roof',
    walls: 'Walls, doors, windows',
    systems: 'Electrical and plumbing',
    finishes: 'Finishes',
};

export const LEVEL_EN: Readonly<Record<string, { title: string; planHint: string }>> = {
    'project-info': { title: 'Project information', planHint: 'Look at the drawing title block: project name, construction site and the owner\'s name (used as the BOQ header)' },
    'land-inspection': { title: 'Land inspection', planHint: 'Look at the title deed and site plan, then walk the actual land: position, access, boundary, reference marks, and the number of days/trips used for the inspection' },
    demolition: { title: 'Demolition', planHint: 'Is there an existing structure, trees or debris to demolish/haul away? If not, press "Not in this project"' },
    fill: { title: 'Soil filling', planHint: 'Look at the site plan: the fill area and the existing ground level against the required level (fill height)' },
    'temp-utilities': { title: 'Temporary water and power', planHint: 'Look at the site plan: the cable and water pipe run from the meter to the site, and the number of water/power points used during construction' },
    'site-camp': { title: 'Workers\' camp', planHint: 'Not in the drawings — follow the contractor\'s plan: number of worker rooms, toilets, bathrooms and stores to build on site. Leave blank if none is built' },
    layout: { title: 'Setting out / marking', planHint: 'Look at the foundation plan: count the setting-out points along the column lines and the number of marker stakes (usually the same as the number of piles)' },
    piles: { title: 'Piles', planHint: 'Look at the foundation/pile plan: pile type, size, length and number of piles' },
    footing: { title: 'Footings', planHint: 'Look at the footing plan and footing details (F1, F2 …): size, width × length × thickness, reinforcement and number of footings' },
    pedestal: { title: 'Pedestals', planHint: 'Look at the pedestal details: section size, height from the footing to the ground beam, and reinforcement' },
    'ground-beam': { title: 'Ground beams', planHint: 'Look at the ground beam plan (GB): beam size, total length of every span of each beam type, and reinforcement' },
    'slab-on-grade': { title: 'Cast-in-place slab', planHint: 'Look at the slab plan (S): size of each slab, thickness and reinforcement' },
    'precast-slab': { title: 'Precast slab', planHint: 'Look at the slab plan (PS): size of each precast slab span. If the drawings have no precast slab, press "Not in this project"' },
    column: { title: 'Ground-floor columns', planHint: 'Look at the column plan and column details (C1, C2 …): section size, height, number of columns and reinforcement' },
    'roof-beam': { title: 'Roof deck / roof beams', planHint: 'Look at the roof-level beam plan (RB): beam size, length of each span and reinforcement' },
    'roof-slab': { title: 'Roof deck slab', planHint: 'Look at the roof slab plan (RS): size, thickness and reinforcement. If there is no roof deck, press "Not in this project"' },
    stair: { title: 'Stairs', planHint: 'Look at the stair details: width, number of steps, riser, tread, waist thickness and reinforcement. If there are no stairs, press "Not in this project"' },
    'column-plates': { title: 'Column head plates', planHint: 'Count the column head plates that carry the roof frame (see the roof frame connection details)' },
    roofing: { title: 'Roofing material', planHint: 'Look at the roof plan and section: roof area on plan (including eaves), slope, ridge length, gable edge and fascia' },
    'roof-structure': { title: 'Roof frame', planHint: 'Look at the roof frame plan and section: wall plate length, ridge beam, king post height and hip/valley rafters (rafters and purlins are calculated from the roof area)' },
    'door-window': { title: 'Doors and windows', planHint: 'Look at the door and window schedule (D1, W1 …): size, type and quantity of each (used to deduct the wall openings automatically)' },
    brick: { title: 'Brickwork', planHint: 'Look at the floor plan and elevations: length of each wall run, height and brick type' },
    plaster: { title: 'Plastering', planHint: 'The plaster area comes from the walls already entered. Check which walls are not plastered (e.g. exposed brick) and add the column and beam surfaces that need plaster' },
    'electrical-pipe': { title: 'Electrical conduit', planHint: 'Look at the electrical plan: conduit run from the consumer unit to light points, sockets and switches' },
    'electrical-cable': { title: 'Electrical cable', planHint: 'Look at the electrical plan/diagram: cable size of each circuit (conduit length comes from the conduit step)' },
    'load-center': { title: 'Consumer unit', planHint: 'Look at the electrical diagram: consumer unit, main breaker and branch breakers' },
    'electrical-equipment': { title: 'Electrical fittings', planHint: 'Count from the electrical plan: luminaires, sockets, switches and each type of fitting' },
    'waste-pipe': { title: 'Waste pipes', planHint: 'Look at the sanitary plan: length of waste/soil/vent pipe of each size' },
    'water-pipe': { title: 'Water supply pipes', planHint: 'Look at the sanitary plan: length of water supply pipe from the meter to each outlet, by size' },
    'sanitary-system': { title: 'Sanitary system equipment', planHint: 'Look at the sanitary plan: grease trap, septic tank, manholes and the outdoor AC drain pipe (asbestos cement) length' },
    'sanitary-ware': { title: 'Sanitary ware', planHint: 'Count from the bathroom plan: toilets, washbasins, showers and accessories' },
    ceiling: { title: 'Ceiling', planHint: 'Look at the ceiling plan: ceiling type of each room and the room sizes' },
    'floor-tile': { title: 'Floor tiling', planHint: 'Look at the floor plan/floor material plan: size of each room and tile type' },
    'toilet-tile': { title: 'Bathroom tiles', planHint: 'Look at the bathroom plan: room size, wall tile height, and the door-window sizes in the bathroom' },
    'wall-finishing': { title: 'Wall decoration', planHint: 'Look at the elevations: wall mouldings, slat walls and special decoration. If there is none, press "Not in this project"' },
    paint: { title: 'Painting', planHint: 'The paint area is already pulled from the plastered walls, ceilings and decoration. Choose the paint type and check it is correct' },
    misc: { title: 'Miscellaneous work', planHint: 'Other work that is not in any step, such as railings, canopies and house number signs' },
};

const isEn = (locale: string): boolean => locale === 'en';

/** Phase name in the UI locale (Thai when the locale is Thai or there is no translation). */
export const phaseTitle = (phase: JourneyPhase, locale: string): string =>
    (isEn(locale) ? PHASE_TITLES_EN[phase.id] : undefined) ?? phase.title;

/** Level name in the UI locale. */
export const levelTitleIn = (level: JourneyLevel, locale: string): string =>
    (isEn(locale) ? LEVEL_EN[level.id]?.title : undefined) ?? level.title;

/** What to look at on the plan, in the UI locale. */
export const levelPlanHint = (level: JourneyLevel, locale: string): string =>
    (isEn(locale) ? LEVEL_EN[level.id]?.planHint : undefined) ?? level.planHint;

/** Every level and phase has an English text (checked by a test and by `levelsEnCoverage`). */
export const levelsEnCoverage = (): string[] => [
    ...JOURNEY.filter(p => PHASE_TITLES_EN[p.id] === undefined).map(p => `phase:${p.id}`),
    ...JOURNEY_LEVELS.filter(l => LEVEL_EN[l.id] === undefined).map(l => `level:${l.id}`),
];
