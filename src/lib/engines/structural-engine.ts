export interface StructuralSpecParams {
    ksc: number | 'MANUAL'; // 140, 180, 210, 240, 280, 300, 320, 350 or manual mix
    waterproof: boolean;
    workLevel: 'GRND' | '1FL' | '2FL'; // GRND=ถนน/ฐานราก, 1FL=โครงสร้างชั้นเดียว, 2FL=สองชั้นขึ้นไป
    formworkType: 'GRND' | 'BLDG' | 'BLDG-H' | 'PRECAST' | 'NONE'; 
    concrete_waste_percent?: number;
    rebar_waste_percent?: number;
}

export interface StructuralInputs {
    concrete_volume_m3: number;   // Net volume without waste
    formwork_area_m2: number;     // Net area without waste
    rebar_weight_kg: number;      // Net weight without waste
}

export interface StructuralResult {
    // ── Concrete ──
    conc_net_m3: number;
    conc_gross_m3: number;
    conc_sku: string;
    conc_admix_wp_m3?: number;

    // ── Labor (Pouring) ──
    pour_labor_m3: number;  // net volume — Excel charges labour on the quantity without waste
    pour_labor_sku: string;

    // ── Formwork ──
    fw_area_m2: number;
    fw_sku: string;

    // ── Rebar & Accessories ──
    rb_net_kg: number;
    rb_gross_kg: number;
    rb_wire_kg: number;     // 3% of gross rebar (Excel BOQ)
    rb_spacer_pcs: number;  // 4 pcs / m2 formwork
}

/** Excel BOQ: tie wire = 3% of rebar weight including waste */
export const TIE_WIRE_RATIO = 0.03;
/** Excel BOQ: formwork battens = 0.6 cu.ft. and nails = 0.25 kg per m² of formwork */
export const FORMWORK_BATTEN_CUFT_PER_M2 = 0.6;
export const FORMWORK_NAIL_KG_PER_M2 = 0.25;

export function computeStructuralQuantities(
    inputs: StructuralInputs, 
    params: StructuralSpecParams
): StructuralResult {
    
    // 1. Concrete Calculations
    const concWaste = params.concrete_waste_percent ?? 10; // Excel BOQ default 10%
    const concGross = inputs.concrete_volume_m3 * (1 + concWaste / 100);
    
    // Determine Concrete SKU based on KSC
    // Fallback to closest standard SKU if exact match not found
    let concSku = 'CON-240';
    if (params.ksc === 'MANUAL') {
        concSku = 'CON-MANUAL';
    } else if (typeof params.ksc === 'number' && [180, 210, 240, 280, 300, 320, 350].includes(params.ksc)) {
        concSku = `CON-${params.ksc}`;
    }

    // Determine if waterproofing is applied
    const wpQty = params.waterproof ? concGross : undefined;

    // 2. Pouring Labor Calculations
    let laborSku = 'LAB-POUR-1FL';
    if (params.workLevel === 'GRND') laborSku = 'LAB-POUR-GRND';
    else if (params.workLevel === '2FL') laborSku = 'LAB-POUR-2FL';

    // 3. Formwork Calculations
    let fwSku = 'FW-BLDG';
    if (params.formworkType === 'GRND') fwSku = 'FW-GRND';
    else if (params.formworkType === 'BLDG-H') fwSku = 'FW-BLDG-H';
    else if (params.formworkType === 'PRECAST') fwSku = 'FW-PRECAST';

    // 4. Rebar Accessories Calculations
    const rbWaste = params.rebar_waste_percent ?? 10; // Default 10%
    const rbGross = inputs.rebar_weight_kg * (1 + rbWaste / 100);
    
    const tieWireKg = rbGross * TIE_WIRE_RATIO;
    
    // Standard rule: 4 spacers per sq.m. of formwork contact area
    // (If footing/ground, we still need spacers under the rebar)
    const spacerPcs = inputs.formwork_area_m2 * 4;
    // Special case for SOG/Footing if formwork area is small but bottom area is large
    // Normally handled inside the Step by passing total contact area
    
    return {
        conc_net_m3: inputs.concrete_volume_m3,
        conc_gross_m3: concGross,
        conc_sku: concSku,
        conc_admix_wp_m3: wpQty,

        pour_labor_m3: inputs.concrete_volume_m3,
        pour_labor_sku: laborSku,

        fw_area_m2: inputs.formwork_area_m2,
        fw_sku: fwSku,

        rb_net_kg: inputs.rebar_weight_kg,
        rb_gross_kg: rbGross,
        rb_wire_kg: tieWireKg,
        rb_spacer_pcs: Math.ceil(spacerPcs),
    };
}
