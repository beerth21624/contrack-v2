export interface Footing {
  id: string;
  name: string;
  qty: number;
  width: number; // m
  length: number; // m
  thickness: number; // m
  depth: number; // m (from GL to bottom of footing? No, usually depth of excavation. Let's assume Depth is Excavation Depth)
  // Steel Config could be added here if customized per footing, for now assume standard or global config
  steelBars: {
    type: 'RB6' | 'RB9' | 'DB12' | 'DB16' | 'DB20';
    count: number; // Total count (Direction 1 + 2) or handled separately? 
    // Let's make it more detailed based on design:
    // Direction 1 (L)
    dir1: {
        barType: string;
        spacing: number;
    };
    // Direction 2 (W)
    dir2: {
        barType: string; 
        spacing: number;
    }
  }
}

// Simplified Input for POC
export interface FootingInput {
    id: string;
    name: string;
    qty: number;
    w: number;
    l: number;
    t: number;
    d: number; // Depth
    // For POC, let's keep steel simple: Main Bar Size & Spacing (assume same both ways for simplicity unless detailed)
    mainBarSize: string; // e.g. 'DB12'
    mainBarSpacing: number; // e.g. 0.20
}

export type UOM =
  | 'm3' | 'm2' | 'kg' | 'm' | 'pcs' | 'set'
  | 'คน-วัน' | 'วัน' | 'จุด' | 'ชุด' | 'เที่ยว' | 'ชม.'
  | 'ตัว' | 'ตู้' | 'ต้น' | 'ลิตร' | 'ช่อง' | 'เดือน'
  | 'ป้าย' | 'อัน' | 'กระป๋อง' | 'ห้อง' | 'ถุง' | 'แผ่น' | 'ตร.ม.'
  | 'บ่อ' | 'ม้วน' | 'ผืน' | 'หลอด' | 'วงจร' | 'แกลลอน' | 'ครั้ง' | 'เหมา';

export interface PriceItem {
  code: string;
  name: string;
  uom: UOM;
  costMaterial: number;
  costLabor: number;
  category: string;
}

export interface BOQItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  uom: UOM;
  unitCostMaterial: number;
  unitCostLabor: number;
  totalCostMaterial: number;
  totalCostLabor: number;
  totalPrice: number;
}

export interface FootingCalculationResult {
  footingId: string;
  footingName: string;
  quantities: {
    excavation: number;
    sand: number;
    lean: number;
    concrete: number;
    formwork: number;
    backfill: number;
    steelWeight: number; // Total steel weight
    steelDetails: Record<string, number>; // weight per bar size
  };
  cost: number;
}

// ─── Step Quantity Engine Types ────────────────────────────────────────────

/** Shared result shape returned by every step's calc function */
export interface StepResult {
  quantities: Record<string, { qty: number; uom: string; label: string }>;
  warnings: string[];   // advisory notes (yellow)
  qc_flags: string[];   // must-check items (red / orange)
  warningFields?: string[]; // input field names that triggered warnings
}

// ─── Step Input Types (re-exported from step modules) ─────────────────────
// Source of truth lives in src/lib/steps/stepXX.ts alongside the calc function.
// These re-exports keep backward compatibility for consumers using '@/types'.
export type {
  Step0Input,
  Step1Input, Step2Input, Step3Input, Step4Input, Step5Input,
  Step6Input, Step7Input, Step8Input, Step9Input, Step10Input,
  Step11Input, Step12Input, Step13Input, Step14Input, Step15Input,
  Step16Input, Step17Input, Step18Input, Step19Input, Step20Input,
  Step21Input, Step22Input, Step23Input, Step24Input, Step25Input,
  Step26Input, Step27Input, Step28Input, Step29Input, Step30Input,
  Step31Input, Step32Input, Step33Input, Step34Input,
} from '@/lib/steps';

// ─── Step Input Map ────────────────────────────────────────────────────────
import type {
  Step0Input,
  Step1Input, Step2Input, Step3Input, Step4Input, Step5Input,
  Step6Input, Step7Input, Step8Input, Step9Input, Step10Input,
  Step11Input, Step12Input, Step13Input, Step14Input, Step15Input,
  Step16Input, Step17Input, Step18Input, Step19Input, Step20Input,
  Step21Input, Step22Input, Step23Input, Step24Input, Step25Input,
  Step26Input, Step27Input, Step28Input, Step29Input, Step30Input,
  Step31Input, Step32Input, Step33Input, Step34Input,
} from '@/lib/steps';

/** Maps step number → its input type. */
export interface StepInputMap {
  0: Step0Input;
  1: Step1Input;   2: Step2Input;   3: Step3Input;   4: Step4Input;   5: Step5Input;
  6: Step6Input;   7: Step7Input;   8: Step8Input;   9: Step9Input;   10: Step10Input;
  11: Step11Input; 12: Step12Input; 13: Step13Input; 14: Step14Input; 15: Step15Input;
  16: Step16Input; 17: Step17Input; 18: Step18Input; 19: Step19Input; 20: Step20Input;
  21: Step21Input; 22: Step22Input; 23: Step23Input; 24: Step24Input; 25: Step25Input;
  26: Step26Input; 27: Step27Input; 28: Step28Input; 29: Step29Input; 30: Step30Input;
  31: Step31Input; 32: Step32Input; 33: Step33Input; 34: Step34Input;
}

/** Valid step IDs (1–34) */
export type StepId = keyof StepInputMap;

/** Type-safe saved data for a single step */
export interface StepSaveRecord<S extends StepId = StepId> {
  inp: StepInputMap[S];
  res: StepResult;
}

/** Type-safe map of all saved step data */
export type StepSaveMap = {
  [S in StepId]?: StepSaveRecord<S>;
};

/** Union of all step input types (convenience) */
export type AnyStepInput = StepInputMap[StepId];
