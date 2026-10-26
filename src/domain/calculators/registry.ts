// All calculator sheets. Add a calculator here once its domain module exists.
import type { CalculatorDef } from './types';
import { landInspection } from './land-inspection';
import { demolition } from './demolition';
import { fill } from './fill';
import { tempUtilities } from './temp-utilities';
import { siteCamp } from './site-camp';
import { layout } from './layout';
import { piles } from './piles';
import { footing } from './footing';
import { pedestal } from './pedestal';
import { groundBeam } from './ground-beam';
import { slabOnGrade } from './slab-on-grade';
import { precastSlab } from './precast-slab';
import { column } from './column';
import { roofBeam } from './roof-beam';
import { roofSlab } from './roof-slab';
import { stair } from './stair';
import { roofing } from './roofing';
import { roofStructure } from './roof-structure';
import { doorWindow } from './door-window';
import { brick } from './brick';
import { plaster } from './plaster';
import { ceiling } from './ceiling';
import { floorTile } from './floor-tile';
import { toiletTile } from './toilet-tile';
import { wallFinishing } from './wall-finishing';
import { paint } from './paint';
import { structureSummary } from './structure-summary';
import { wastePipe } from './waste-pipe';
import { waterPipe } from './water-pipe';
import { electricalPipe } from './electrical-pipe';
import { electricalCable } from './electrical-cable';
import { loadCenter } from './load-center';
import { electricalEquipment } from './electrical-equipment';
import { sanitarySystem } from './sanitary-system';
import { misc } from './misc';
import { sanitaryWare } from './sanitary-ware';

export const CALCULATORS: CalculatorDef[] = [
    landInspection,
    demolition,
    fill,
    tempUtilities,
    siteCamp,
    layout,
    piles,
    footing,
    pedestal,
    groundBeam,
    slabOnGrade,
    precastSlab,
    column,
    roofBeam,
    roofSlab,
    stair,
    roofing,
    roofStructure,
    doorWindow,
    brick,
    plaster,
    ceiling,
    floorTile,
    toiletTile,
    wallFinishing,
    paint,
    structureSummary,
    wastePipe,
    waterPipe,
    electricalPipe,
    electricalCable,
    loadCenter,
    electricalEquipment,
    sanitarySystem,
    misc,
    sanitaryWare,
];

export function getCalculator(id: string): CalculatorDef | undefined {
    return CALCULATORS.find(c => c.id === id);
}

/** Calculators in dependency order (a calculator comes after everything in its `deps`). */
export function calculatorsInOrder(list: CalculatorDef[] = CALCULATORS): CalculatorDef[] {
    const byId = new Map(list.map(c => [c.id, c]));
    const done = new Set<string>();
    const visiting = new Set<string>();
    const out: CalculatorDef[] = [];
    const visit = (c: CalculatorDef) => {
        if (done.has(c.id)) return;
        if (visiting.has(c.id)) throw new Error(`Circular calculator dependency at ${c.id}`);
        visiting.add(c.id);
        for (const d of c.deps) {
            const dep = byId.get(d);
            if (dep) visit(dep);
        }
        visiting.delete(c.id);
        done.add(c.id);
        out.push(c);
    };
    list.forEach(visit);
    return out;
}
