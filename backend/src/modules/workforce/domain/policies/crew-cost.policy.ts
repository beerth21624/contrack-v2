// ─── A crew's ฿/day as used for planning (the Man-Day R formula: skilled × rate + labourers × rate) ───
// The typed override wins; else the crew's rate card prices its headcount; else unknown (null).
// A card archived after it was picked still prices the crew (its rates are known); pick another to change it.
export interface CrewCostInput {
    skilledCount: number;
    labourerCount: number;
    dailyCostOverride: number | null;
}

export interface CardRates {
    skilledRate: number;
    labourerRate: number;
}

export function crewDailyCost(crew: CrewCostInput, card: CardRates | undefined): number | null {
    if (crew.dailyCostOverride !== null) return crew.dailyCostOverride;
    if (card === undefined) return null;
    return crew.skilledCount * card.skilledRate + crew.labourerCount * card.labourerRate;
}
