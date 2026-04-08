// ─── Step Registry ──────────────────────────────────────────────────────────
// Single source of truth for step metadata, calc functions, and lazy components.
// To add a new step: 1) add type to StepInputMap, 2) add calc in steps/,
// 3) add component in components/steps/, 4) add entry here.

import { type ComponentType, lazy } from 'react';
import type { StepId, StepInputMap, StepResult } from '@/types';
import {
  calcStep0,
  calcStep1, calcStep2, calcStep3, calcStep4, calcStep5,
  calcStep6, calcStep7, calcStep8, calcStep9, calcStep10,
  calcStep11, calcStep12, calcStep13, calcStep14, calcStep15,
  calcStep16, calcStep17, calcStep18, calcStep19, calcStep20,
  calcStep21, calcStep22, calcStep23, calcStep24, calcStep25,
  calcStep26, calcStep27, calcStep28, calcStep29, calcStep30,
  calcStep31, calcStep32, calcStep33, calcStep34,
} from './steps';

/** Props that every step form component must accept */
export interface StepComponentProps<S extends StepId> {
  initialData?: StepInputMap[S];
  onBack: () => void;
  onSave: (inp: StepInputMap[S], res: StepResult) => void;
}

/** Configuration for a single step */
export interface StepDefinition<S extends StepId = StepId> {
  id: S;
  title: string;
  titleEn: string;
  calc: (inp: StepInputMap[S]) => StepResult;
  /** Lazy-load the component to keep initial bundle small */
  loadComponent: () => Promise<{ default: ComponentType<StepComponentProps<S>> }>;
  /** The actual lazy component */
  Component: ComponentType<StepComponentProps<S>>;
}

function defineStep<S extends StepId>(def: Omit<StepDefinition<S>, 'Component'>): StepDefinition<S> {
  return {
    ...def,
    Component: lazy(def.loadComponent) as ComponentType<StepComponentProps<S>>,
  };
}

/** All steps — the only place you register a new step */
export const STEP_REGISTRY = [
  defineStep({ id: 0,  title: 'ตรวจสอบที่ดิน / หมุดหลัก', titleEn: 'Land Survey & Benchmark', calc: calcStep0,  loadComponent: () => import('@/components/steps/Step0LandSurvey') }),
  defineStep({ id: 1,  title: 'ถมดิน + บดอัด',               titleEn: 'Earthwork & Compaction',     calc: calcStep1,  loadComponent: () => import('@/components/steps/Step1Earthwork') }),
  defineStep({ id: 2,  title: 'เดินน้ำ–ไฟชั่วคราว',          titleEn: 'Temporary Utilities',        calc: calcStep2,  loadComponent: () => import('@/components/steps/Step2Utilities') }),
  defineStep({ id: 3,  title: 'เตรียมพื้นที่หน้างาน',         titleEn: 'Site Preparation',           calc: calcStep3,  loadComponent: () => import('@/components/steps/Step3SitePrep') }),
  defineStep({ id: 4,  title: 'วางผัง / ปักหมุด',            titleEn: 'Layout & Setting Out',       calc: calcStep4,  loadComponent: () => import('@/components/steps/Step4Layout') }),
  defineStep({ id: 5,  title: 'งานเสาเข็ม',                  titleEn: 'Piling',                     calc: calcStep5,  loadComponent: () => import('@/components/steps/Step5Piling') }),
  defineStep({ id: 6,  title: 'ทำฐานราก',                    titleEn: 'Footing',                    calc: calcStep6,  loadComponent: () => import('@/components/steps/Step6FootingForm') }),
  defineStep({ id: 7,  title: 'เสาตอม่อ',                    titleEn: 'Pedestal',                   calc: calcStep7,  loadComponent: () => import('@/components/steps/Step7Pedestal') }),
  defineStep({ id: 8,  title: 'คานคอดิน',                    titleEn: 'Ground Beam',                calc: calcStep8,  loadComponent: () => import('@/components/steps/Step8GroundBeam') }),
  defineStep({ id: 9,  title: 'เทพื้นหล่อในที่',              titleEn: 'Slab on Grade',              calc: calcStep9,  loadComponent: () => import('@/components/steps/Step9SlabOnGrade') }),
  defineStep({ id: 10, title: 'วางแผ่นพื้นสำเร็จ',            titleEn: 'Precast Slab',               calc: calcStep10, loadComponent: () => import('@/components/steps/Step10PrecastSlab') }),
  defineStep({ id: 11, title: 'ทำเสาชั้น 1',                 titleEn: 'Column Floor 1',             calc: calcStep11, loadComponent: () => import('@/components/steps/Step11Column') }),
  defineStep({ id: 12, title: 'ทำคาน + พื้นดาดฟ้า',          titleEn: 'Beam + Roof Deck Slab',      calc: calcStep12, loadComponent: () => import('@/components/steps/Step12BeamSlab') }),
  defineStep({ id: 13, title: 'โครงสร้างบันได',               titleEn: 'Staircase Structure',        calc: calcStep13, loadComponent: () => import('@/components/steps/Step13Staircase') }),
  defineStep({ id: 14, title: 'เพลทหัวเสา',                  titleEn: 'Column Cap Plate',           calc: calcStep14, loadComponent: () => import('@/components/steps/Step14ColumnCapPlate') }),
  defineStep({ id: 15, title: 'โครงหลังคา',                  titleEn: 'Roof Structure',             calc: calcStep15, loadComponent: () => import('@/components/steps/Step15RoofStructure') }),
  defineStep({ id: 16, title: 'มุงหลังคา',                   titleEn: 'Roofing',                    calc: calcStep16, loadComponent: () => import('@/components/steps/Step16Roofing') }),
  defineStep({ id: 17, title: 'ก่ออิฐ',                      titleEn: 'Brickwork',                  calc: calcStep17, loadComponent: () => import('@/components/steps/Step17Brickwork') }),
  defineStep({ id: 18, title: 'ฉาบปูน',                      titleEn: 'Plastering',                 calc: calcStep18, loadComponent: () => import('@/components/steps/Step18Plastering') }),
  defineStep({ id: 19, title: 'ปิดฝ้าเพดาน',                  titleEn: 'Ceiling Works',              calc: calcStep19, loadComponent: () => import('@/components/steps/Step19Ceiling') }),
  defineStep({ id: 20, title: 'ปูกระเบื้องพื้น',               titleEn: 'Floor Tiling',               calc: calcStep20, loadComponent: () => import('@/components/steps/Step20FloorTiling') }),
  defineStep({ id: 21, title: 'ปูกระเบื้องห้องน้ำ',            titleEn: 'Bathroom Tiling',            calc: calcStep21, loadComponent: () => import('@/components/steps/Step21BathroomTiling') }),
  defineStep({ id: 22, title: 'ตกแต่งผนังภายนอก',             titleEn: 'Exterior Wall Finish',       calc: calcStep22, loadComponent: () => import('@/components/steps/Step22ExteriorFinish') }),
  defineStep({ id: 23, title: 'ทาสีรองพื้น',                  titleEn: 'Primer Coat',                calc: calcStep23, loadComponent: () => import('@/components/steps/Step23Primer') }),
  defineStep({ id: 24, title: 'ประตู-หน้าต่างอลูมิเนียม',      titleEn: 'Aluminium Doors & Windows',  calc: calcStep24, loadComponent: () => import('@/components/steps/Step24AlumDoorWindow') }),
  defineStep({ id: 25, title: 'ทาสีจริงรอบ 1',               titleEn: 'Paint Coat 1',               calc: calcStep25, loadComponent: () => import('@/components/steps/Step25PaintCoat1') }),
  defineStep({ id: 26, title: 'ติดตั้งอุปกรณ์ไฟฟ้า',           titleEn: 'Electrical Systems',         calc: calcStep26, loadComponent: () => import('@/components/steps/Step26Electrical') }),
  defineStep({ id: 27, title: 'สุขาภิบาลภายใน',               titleEn: 'Sanitary — Interior',        calc: calcStep27, loadComponent: () => import('@/components/steps/Step27SanitaryInterior') }),
  defineStep({ id: 28, title: 'สุขาภิบาลภายนอก',              titleEn: 'Sanitary — Exterior',        calc: calcStep28, loadComponent: () => import('@/components/steps/Step28SanitaryExterior') }),
  defineStep({ id: 29, title: 'อุปกรณ์เบ็ดเตล็ด',              titleEn: 'Miscellaneous Fixtures',     calc: calcStep29, loadComponent: () => import('@/components/steps/Step29Miscellaneous') }),
  defineStep({ id: 30, title: 'สุขภัณฑ์',                     titleEn: 'Sanitary Fixtures',          calc: calcStep30, loadComponent: () => import('@/components/steps/Step30SanitaryFixtures') }),
  defineStep({ id: 31, title: 'ประตู-หน้าต่างไม้',             titleEn: 'Wooden Doors & Windows',     calc: calcStep31, loadComponent: () => import('@/components/steps/Step31WoodDoorWindow') }),
  defineStep({ id: 32, title: 'ทาสีรอบสุดท้าย',               titleEn: 'Final Paint',                calc: calcStep32, loadComponent: () => import('@/components/steps/Step32FinalPaint') }),
  defineStep({ id: 33, title: 'ตรวจ Defect',                 titleEn: 'Defect Inspection',          calc: calcStep33, loadComponent: () => import('@/components/steps/Step33DefectCheck') }),
  defineStep({ id: 34, title: 'ส่งมอบงาน',                   titleEn: 'Project Handover',           calc: calcStep34, loadComponent: () => import('@/components/steps/Step34Handover') }),
] as const;

/** Lookup a step definition by ID */
export function getStepDef(id: StepId): StepDefinition {
  const def = STEP_REGISTRY.find(s => s.id === id);
  if (!def) throw new Error(`Step ${id} not found in registry`);
  return def as StepDefinition;
}
