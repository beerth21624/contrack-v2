'use client';

import React, { useState } from 'react';
import { Button, Typography, Tag, Progress, Modal, Timeline, Skeleton, Card } from 'antd';
import {
    CheckCircleFilled,
    ClockCircleOutlined,
    RightOutlined,
    ExclamationCircleFilled,
    LockOutlined,
} from '@ant-design/icons';
import { type StepSaveMap, type StepId } from '@/types';
import { useTranslations } from 'next-intl';
import { useAppLocale } from '@/i18n/LocaleProvider';
import { useAppStore } from '@/lib/store';

const { Text, Title } = Typography;

export interface SubTask {
    label: string;
    labelEn?: string;
    special?: boolean;
}

export interface TimelineStep {
    id: number;
    title: string;
    titleEn: string;
    status: 'finish' | 'process' | 'wait';
    subtasks: SubTask[];
    note?: string;
    noteEn?: string;
}

const STEPS: TimelineStep[] = [
    {
        id: 0, title: 'ตรวจสอบที่ดิน / หมุดหลัก', titleEn: 'Land & Boundary Survey', status: 'wait',
        subtasks: [
            { label: 'ตรวจหมุดหลักที่ดิน (ดูแนวรั้ว / ตำแหน่งบ้าน)', labelEn: 'Check boundary markers (fence/house alignment)' },
            { label: 'ตรวจโฉนด (ระวังที่ติดภาระ / ทับแนวเขต)', labelEn: 'Verify land deed (encumbrances/encroachments)' },
        ],
    },
    {
        id: 1, title: 'ถมดิน', titleEn: 'Earthwork & Compaction', status: 'wait',
        subtasks: [
            { label: 'หาระดับดิน (สอดคล้องกับระดับบ้าน)', labelEn: 'Determine soil level (align with house level)', special: true },
            { label: 'ถมดิน + บดอัด (ตรวจความแน่นดิน)', labelEn: 'Backfill & compaction (verify soil density)' },
        ],
    },
    {
        id: 2, title: 'เดินน้ำ–ไฟชั่วคราว', titleEn: 'Temporary Utilities', status: 'wait',
        subtasks: [
            { label: 'ขออนุญาตราชการ', labelEn: 'Obtain government permits' },
            { label: 'เดินท่อ + สายไฟเข้าไซต์ (ระวังเดินขวางจุดทำงาน)', labelEn: 'Install temporary pipes & wiring (avoid obstruction)' },
        ],
    },
    {
        id: 3, title: 'เตรียมพื้นที่หน้างาน', titleEn: 'Site Preparation', status: 'wait',
        subtasks: [
            { label: 'พื้นที่เข้า-ออก', labelEn: 'Access & exit routes' },
            { label: 'พื้นที่กองวัสดุ (อยู่ใกล้แต่ไม่ขวางงาน)', labelEn: 'Material storage area (accessible but clear)', special: true },
            { label: 'ห้องพักคนงาน', labelEn: 'Worker camp/quarters' },
            { label: 'สโตร์เก็บของ', labelEn: 'Equipment store' },
            { label: 'ห้องน้ำ / ล้อมรั้วไซต์', labelEn: 'Toilets / Site fencing' },
            { label: 'พื้นที่ทิ้งขยะ / รางระบายน้ำ', labelEn: 'Waste disposal / Drainage trench', special: true },
            { label: 'พื้นที่ทำงานชั่วคราว เช่น ดัดเหล็ก ผูกเหล็ก', labelEn: 'Temporary work zones (e.g., rebar bending)', special: true },
        ],
    },
    {
        id: 4, title: 'วางผัง / ปักหมุด', titleEn: 'Site Layout', status: 'wait',
        subtasks: [
            { label: 'ปักไม้ผัง', labelEn: 'Install batter boards' },
            { label: 'ขึงเอ็น + หาฉาก', labelEn: 'String lines & check squareness' },
            { label: 'ปักหมุดเสา (ต้องได้ศูนย์ + ระยะเป๊ะ)', labelEn: 'Set column pins (exact center & distance)' },
            { label: 'ตรวจหมุด ระยะ ฉาก', labelEn: 'Verify pins, distance, squareness', special: true },
        ],
    },
    {
        id: 5, title: 'งานเสาเข็ม', titleEn: 'Piling Works', status: 'wait',
        subtasks: [
            { label: '(กรณีตอก) ตอก + Blow count', labelEn: '(Driven) Piling + Blow count', special: true },
            { label: '(กรณีเจาะ) เจาะ + Seismic test', labelEn: '(Bored) Drilling + Seismic test', special: true },
            { label: 'ตรวจตำแหน่งเข็มเยื้องศูนย์ (ห้ามคลาดจุด)', labelEn: 'Check pile deviation (must be centered)', special: true },
        ],
    },
    {
        id: 6, title: 'ทำฐานราก', titleEn: 'Footing', status: 'wait',
        subtasks: [
            { label: 'ขุดดิน / หาระดับ', labelEn: 'Excavation / Leveling', special: true },
            { label: 'ตัดหัวเข็ม', labelEn: 'Trim pile heads' },
            { label: 'หาศูนย์เสา (สำคัญ!)', labelEn: 'Find column center (Critical!)', special: true },
            { label: 'ปรับทราย + เทลีน (ปูนหยาบ)', labelEn: 'Sand bedding & Lean concrete' },
            { label: 'เข้าไม้แบบ', labelEn: 'Formwork installation' },
            { label: 'วางเหล็กตะกร้อฟุตติ้ง', labelEn: 'Place footing rebar cage' },
            { label: 'วางเหล็กเสาตอม่อ + เสาชั้น 1', labelEn: 'Place column neck & 1st floor rebar', special: true },
            { label: 'ล็อกเหล็กเสา (ห้ามลืม!)', labelEn: 'Lock column rebar (Do not forget!)' },
            { label: 'เทคอนกรีต', labelEn: 'Pour concrete', special: true },
            { label: 'รื้อไม้แบบ', labelEn: 'Remove formwork' },
            { label: 'ตรวจชิ้นงานหล่อ (ดูรอยรั่ว / ไม่มีรูโพรง)', labelEn: 'Inspect casting (no honeycombing/leaks)' },
            { label: 'บ่มคอนกรีต (อย่างน้อย 7 วัน)', labelEn: 'Concrete curing (min 7 days)' },
        ],
    },
    {
        id: 7, title: 'ทำเสาตอม่อ', titleEn: 'Column Neck', status: 'wait',
        subtasks: [
            { label: 'เข้าไม้แบบ', labelEn: 'Formwork' }, { label: 'เทคอนกรีต', labelEn: 'Pour concrete' }, { label: 'รื้อไม้แบบ', labelEn: 'Remove formwork' },
            { label: 'ตรวจชิ้นงานหล่อ', labelEn: 'Inspect casting' }, { label: 'บ่มคอนกรีต', labelEn: 'Curing' },
        ],
    },
    {
        id: 8, title: 'คานคอดิน', titleEn: 'Ground Beam', status: 'wait',
        subtasks: [
            { label: 'ถมดินฐานราก + ปรับระดับ', labelEn: 'Backfill footing & level', special: true },
            { label: 'เทลีน', labelEn: 'Lean concrete', special: true },
            { label: 'วางเหล็ก', labelEn: 'Place rebar', special: true },
            { label: 'เข้าไม้แบบ', labelEn: 'Formwork' },
            { label: 'เทคอนกรีต + เสียบเหล็ก dowel', labelEn: 'Pour concrete + Dowel insertion', special: true },
            { label: 'รื้อไม้แบบ', labelEn: 'Remove formwork' }, { label: 'ตรวจชิ้นงานหล่อ', labelEn: 'Inspect casting' }, { label: 'บ่มคอนกรีต', labelEn: 'Curing' },
        ],
    },
    {
        id: 9, title: 'เทพื้นหล่อในที่', titleEn: 'Cast-in-Place Slab', status: 'wait',
        subtasks: [
            { label: 'วางท่อน้ำ / ท่อ sleeve (ห้ามลืม!)', labelEn: 'Place pipes / sleeves (Do not forget!)', special: true },
            { label: 'ถมดิน + ปรับทราย', labelEn: 'Backfill & sand leveling' },
            { label: 'ปูแผ่นพลาสติกกันชื้น', labelEn: 'Lay vapor barrier sheet', special: true },
            { label: 'เข้าไม้แบบ', labelEn: 'Formwork' }, { label: 'วางเหล็ก', labelEn: 'Place rebar' }, { label: 'เทคอนกรีต', labelEn: 'Pour concrete' },
            { label: 'รื้อไม้แบบ', labelEn: 'Remove formwork' }, { label: 'ตรวจชิ้นงานหล่อ', labelEn: 'Inspect casting' }, { label: 'บ่มคอนกรีต', labelEn: 'Curing' },
        ],
    },
    {
        id: 10, title: 'วางแผ่นพื้นสำเร็จ', titleEn: 'Precast Floor Slab', status: 'wait',
        subtasks: [
            { label: 'สั่งพื้นสำเร็จรูป (ล่วงหน้า)', labelEn: 'Order precast slabs (advance)', special: true },
            { label: 'วางท่อกำจัดปลวก', labelEn: 'Install termite pipes' },
            { label: 'ค้ำยันท้องพื้น', labelEn: 'Slab shoring/supports', special: true },
            { label: 'เข้าไม้แบบ', labelEn: 'Formwork' }, { label: 'วางเหล็กไวร์เมช', labelEn: 'Place wire mesh' }, { label: 'ล็อคแผ่น (Shear key)', labelEn: 'Lock shear keys' },
            { label: 'เทคอนกรีตทับหน้า', labelEn: 'Pour concrete topping' }, { label: 'รื้อไม้แบบ', labelEn: 'Remove formwork' }, { label: 'ตรวจชิ้นงาน', labelEn: 'Inspect casting' }, { label: 'บ่มคอนกรีต', labelEn: 'Curing' },
        ],
    },
    {
        id: 11, title: 'ทำเสาชั้น 1', titleEn: 'Column Floor 1', status: 'wait',
        subtasks: [
            { label: 'วางเหล็ก', labelEn: 'Place rebar' }, { label: 'เข้าไม้แบบ', labelEn: 'Formwork' },
            { label: 'เทคอนกรีต', labelEn: 'Pour concrete', special: true },
            { label: 'รื้อไม้แบบ', labelEn: 'Remove formwork' }, { label: 'ตรวจงานหล่อ', labelEn: 'Inspect casting' }, { label: 'บ่มคอนกรีต', labelEn: 'Curing' },
        ],
    },
    {
        id: 12, title: 'ทำคาน + พื้นดาดฟ้า', titleEn: 'Beam + Roof Deck', status: 'wait',
        note: 'ขั้นตอน 13 สามารถทำพร้อมกันได้', noteEn: 'Step 13 can be done concurrently',
        subtasks: [
            { label: 'ค้ำยันท้องคาน + พื้น', labelEn: 'Beam & slab shoring' }, { label: 'เข้าไม้แบบ', labelEn: 'Formwork' }, { label: 'วางเหล็ก', labelEn: 'Place rebar' },
            { label: 'เทคอนกรีต (กันซึม)', labelEn: 'Pour concrete (Waterproofing)' }, { label: 'รื้อไม้แบบ', labelEn: 'Remove formwork' }, { label: 'ตรวจงานหล่อ', labelEn: 'Inspect casting' },
            { label: 'บ่มคอนกรีต', labelEn: 'Curing' }, { label: 'รื้อค้ำยัน', labelEn: 'Remove shoring', special: true },
        ],
    },
    {
        id: 13, title: 'โครงสร้างบันได', titleEn: 'Staircase Structure', status: 'wait',
        subtasks: [
            { label: 'ค้ำยันท้องบันได', labelEn: 'Stair shoring' }, { label: 'เข้าไม้แบบ', labelEn: 'Formwork' }, { label: 'วางเหล็ก', labelEn: 'Place rebar' },
            { label: 'เทคอนกรีต', labelEn: 'Pour concrete' }, { label: 'รื้อไม้แบบ', labelEn: 'Remove formwork' },
            { label: 'ตรวจงานหล่อ + บ่มคอนกรีต', labelEn: 'Inspect + Curing' }, { label: 'รื้อค้ำยัน', labelEn: 'Remove shoring' },
        ],
    },
    {
        id: 14, title: 'ทำเพลทหัวเสา', titleEn: 'Column Cap Plate', status: 'wait',
        subtasks: [
            { label: 'หาระดับ', labelEn: 'Leveling', special: true },
            { label: 'ตัดเหล็ก dowel', labelEn: 'Trim dowels' }, { label: 'เชื่อมเพลท', labelEn: 'Weld plates' }, { label: 'เทเกร้าท์รอยต่อ', labelEn: 'Grout joints' },
        ],
    },
    {
        id: 15, title: 'โครงหลังคา', titleEn: 'Roof Structure', status: 'wait',
        subtasks: [
            { label: 'ตรวจศูนย์เสา – ระยะ', labelEn: 'Check column centers & span', special: true },
            { label: 'ตัดเหล็กเตรียมเชื่อม + ทาสีกันสนิม', labelEn: 'Cut steel & anti-rust coating' },
            { label: 'เชื่อมอะเส, ดั้ง, อกไก่, จันทัน, ตะเข้, แป', labelEn: 'Weld rafters, purlins, king posts' },
            { label: 'ตรวจรอยเชื่อม + เก็บกันสนิม', labelEn: 'Inspect welds + touch-ups', special: true },
        ],
    },
    {
        id: 16, title: 'มุงหลังคา', titleEn: 'Roofing', status: 'wait',
        note: 'ขั้นตอน 17 สามารถทำพร้อมกันได้', noteEn: 'Step 17 can be done concurrently',
        subtasks: [
            { label: 'ติดฉนวน (ถ้ามี)', labelEn: 'Install insulation (if any)' }, { label: 'ติดเชิงชาย + ติดรางน้ำ', labelEn: 'Fascia & gutters' }, { label: 'มุงแผ่น', labelEn: 'Lay roof panels' },
            { label: 'ปิดครอบ (กันรั่วดี ๆ)', labelEn: 'Install flashings (ensure no leaks)', special: true }, { label: 'ติดแผ่นปิดกันนก', labelEn: 'Bird guards' },
        ],
    },
    {
        id: 17, title: 'ก่ออิฐ', titleEn: 'Brickwork', status: 'wait',
        subtasks: [
            { label: 'ก่ออิฐ + เหล็กหนวดกุ้ง', labelEn: 'Bricklaying + wall ties', special: true },
            { label: 'ทำเสาเอ็น–ทับหลัง (ครบ)', labelEn: 'Lintels & stiffeners', special: true },
            { label: 'ติดวงกบ (เปียก: ก่อนเทเสาเอ็น / แห้ง: หลังฉาบ)', labelEn: 'Install door frames' },
            { label: 'กรีดผนัง + ฝังท่อไฟ', labelEn: 'Wall chasing + conduit embed', special: true }, { label: 'บ่มผนัง', labelEn: 'Wall curing' },
        ],
    },
    {
        id: 18, title: 'ฉาบปูน', titleEn: 'Plastering', status: 'wait',
        subtasks: [
            { label: 'จับเซี้ยม + ปุ่ม', labelEn: 'Corner beads & depth gauges' }, { label: 'สลัดดอก (ผิวคอนกรีต)', labelEn: 'Concrete bonding agent/dash' },
            { label: 'ติดลวดกงไก่', labelEn: 'Wire mesh installation', special: true },
            { label: 'ฉาบปูน', labelEn: 'Plastering', special: true },
            { label: 'ร้อยสายไฟ', labelEn: 'Wire pulling', special: true }, { label: 'บ่มผนัง', labelEn: 'Wall curing' },
        ],
    },
    {
        id: 19, title: 'ปิดฝ้าเพดาน', titleEn: 'Ceiling Works', status: 'wait',
        note: 'ขั้นตอน 19–22 สามารถทำพร้อมกันได้', noteEn: 'Steps 19-22 can be done concurrently',
        subtasks: [
            { label: 'ขึ้นโครง C-line', labelEn: 'Install C-line frame' }, { label: 'ยึดแผ่นฝ้า', labelEn: 'Attach gypsum board' }, { label: 'ฉาบรอยต่อ + ปิดหัวสกรู', labelEn: 'Joint compound + conceal screws' },
        ],
    },
    {
        id: 20, title: 'ปูกระเบื้องพื้น', titleEn: 'Floor Tiling', status: 'wait',
        subtasks: [
            { label: 'หาระดับ / หา slope / หาแนว', labelEn: 'Leveling / slope / alignment', special: true },
            { label: 'ปูกระเบื้อง', labelEn: 'Lay tiles' }, { label: 'ยาแนว', labelEn: 'Grouting' },
        ],
    },
    {
        id: 21, title: 'ปูกระเบื้องห้องน้ำ (พื้น-ผนัง)', titleEn: 'Bathroom Tiling', status: 'wait',
        subtasks: [
            { label: 'หาระดับ / หา slope / หาแนว', labelEn: 'Leveling / slope / alignment', special: true },
            { label: 'ติดตั้งท่อน้ำดี-น้ำทิ้ง', labelEn: 'Install plumbing pipes' },
            { label: 'Test น้ำรั่ว ก่อนปู', labelEn: 'Leak test before tiling', special: true },
            { label: 'ปูกระเบื้อง', labelEn: 'Lay tiles' }, { label: 'ยาแนว', labelEn: 'Grouting' },
        ],
    },
    {
        id: 22, title: 'ตกแต่งผนังภายนอก', titleEn: 'Exterior Wall Finish', status: 'wait',
        subtasks: [
            { label: 'ติดตั้งบัว', labelEn: 'Install cornices' }, { label: 'ติดตั้งไม้ฝา', labelEn: 'Wood siding (if any)' }, { label: 'งานตกแต่งอื่น ๆ', labelEn: 'Other finishes' },
        ],
    },
    {
        id: 23, title: 'ทาสีรองพื้น', titleEn: 'Primer Coat', status: 'wait',
        subtasks: [
            { label: 'เตรียมพื้นผิว / อุดโป๊ว / ทำความสะอาด', labelEn: 'Surface prep / patching / clean', special: true },
            { label: 'ฉาบสกิม', labelEn: 'Skim coat' }, { label: 'ทาสีรองพื้น 1 รอบ', labelEn: 'Primer coat (1 round)' },
        ],
    },
    {
        id: 24, title: 'ติดตั้งประตู-หน้าต่างอลูมิเนียม', titleEn: 'Aluminium Doors & Windows', status: 'wait',
        subtasks: [
            { label: 'เตรียมช่องปูน', labelEn: 'Prepare masonry openings', special: true },
            { label: 'ติดอลูมิเนียม + กระจก', labelEn: 'Install alum frames & glass' }, { label: 'ยิงซิลิโคนรอยต่อ', labelEn: 'Silicone seal joints' },
        ],
    },
    {
        id: 25, title: 'ทาสีจริง รอบที่ 1', titleEn: 'Paint Coat 1', status: 'wait',
        note: 'ขั้นตอน 26–29 สามารถทำพร้อมกันได้', noteEn: 'Steps 26-29 can be done concurrently',
        subtasks: [
            { label: 'คอนเฟิร์มสเปกสี', labelEn: 'Confirm paint specs', special: true }, { label: 'ทาสีจริง', labelEn: 'Apply top coat' },
        ],
    },
    {
        id: 26, title: 'ติดตั้งอุปกรณ์ไฟฟ้า', titleEn: 'Electrical Systems', status: 'wait',
        subtasks: [
            { label: 'ตู้ควบคุม, สายเมน, แท่งกราวด์', labelEn: 'Consumer unit, main wiring, ground rod', special: true },
            { label: 'ปลั๊ก + สวิตช์ + โคมไฟ', labelEn: 'Outlets, switches, lights' },
            { label: 'ทดสอบระบบไฟฟ้า', labelEn: 'Electrical system testing', special: true },
        ],
    },
    {
        id: 27, title: 'ระบบสุขาภิบาล (ภายใน)', titleEn: 'Sanitary — Interior', status: 'wait',
        subtasks: [
            { label: 'ต่อท่อน้ำดี', labelEn: 'Connect supply pipes' }, { label: 'ต่อท่อน้ำทิ้ง', labelEn: 'Connect drain pipes' }, { label: 'ต่อถังดักไขมัน', labelEn: 'Connect grease trap' },
        ],
    },
    {
        id: 28, title: 'ระบบสุขาภิบาล (ภายนอก)', titleEn: 'Sanitary — Exterior', status: 'wait',
        subtasks: [
            { label: 'ขุดดิน', labelEn: 'Excavation' },
            { label: 'วางถังแชท', labelEn: 'Install septic tank', special: true },
            { label: 'วางท่อระบายน้ำ + บ่อพัก', labelEn: 'Drain pipes & manholes' }, { label: 'ถมดินกลับ', labelEn: 'Backfill' },
            { label: 'Test น้ำขัง / การระบายน้ำ', labelEn: 'Drainage test', special: true },
        ],
    },
    {
        id: 29, title: 'ติดตั้งอุปกรณ์เบ็ดเตล็ด', titleEn: 'Miscellaneous Fixtures', status: 'wait',
        subtasks: [
            { label: 'ราวกันตก', labelEn: 'Railings' }, { label: 'อุปกรณ์ตกแต่งอื่น ๆ', labelEn: 'Other accessories' },
        ],
    },
    {
        id: 30, title: 'ติดตั้งสุขภัณฑ์', titleEn: 'Sanitary Fixtures', status: 'wait',
        subtasks: [
            { label: 'ชักโครก, อ่าง, ฝักบัว ฯลฯ', labelEn: 'Toilet, basin, shower, etc.' },
            { label: 'Test น้ำก่อนยาแนว', labelEn: 'Water test before grouting' }, { label: 'เก็บยาแนวให้เรียบร้อย', labelEn: 'Grouting cleanup' },
        ],
    },
    {
        id: 31, title: 'ติดตั้งประตู–หน้าต่างไม้', titleEn: 'Wooden Doors & Windows', status: 'wait',
        subtasks: [
            { label: 'ตรวจวงกบ', labelEn: 'Inspect frames' }, { label: 'ติดตั้งบาน', labelEn: 'Install doors/windows' },
        ],
    },
    {
        id: 32, title: 'ทาสีรอบสุดท้าย', titleEn: 'Final Paint', status: 'wait',
        subtasks: [
            { label: 'ทาสีภายใน–ภายนอก', labelEn: 'Interior/Exterior painting' }, { label: 'ทาสีไม้ตกแต่ง', labelEn: 'Wood trim painting' },
        ],
    },
    {
        id: 33, title: 'ตรวจ Defect ก่อนส่งมอบ', titleEn: 'Defect Inspection', status: 'wait',
        subtasks: [
            { label: 'ตรวจงานทุกจุด', labelEn: 'Inspect all works', special: true }, { label: 'จดบันทึก–เช็คตามรายการ', labelEn: 'Log & checklist' },
        ],
    },
    {
        id: 34, title: 'เก็บรายละเอียดงาน & ส่งมอบ', titleEn: 'Project Handover', status: 'wait',
        subtasks: [
            { label: 'เก็บความเรียบร้อย', labelEn: 'Final retouch', special: true }, { label: 'ส่งมอบงานให้ลูกค้า', labelEn: 'Handover to client' },
        ],
    },
];

const STATUS_CFG = {
    finish: { color: '#389e0d', bg: '#f6ffed', border: '#d9f7be', label: 'เสร็จสิ้น', tagColor: 'success' },
    process: { color: '#c75000', bg: '#fff8f0', border: '#ffd3a6', label: 'ปลดล็อค', tagColor: 'warning' },
    wait: { color: '#8c8c8c', bg: '#fafafa', border: '#e8e8e8', label: 'ถูกล็อค', tagColor: 'default' },
} as const;

const STEP_DEPS: Record<number, number[]> = {
    0: [], 1: [0], 2: [1], 3: [2], 4: [3], 5: [4], 6: [5], 7: [6], 8: [7], 9: [8], 10: [9], 11: [10],
    12: [11], 13: [11], 14: [12, 13], 15: [14], 16: [15], 17: [15], 18: [16, 17],
    19: [18], 20: [18], 21: [18], 22: [18],
    23: [19, 20, 21, 22],
    24: [23], 25: [24],
    26: [25], 27: [25], 28: [25], 29: [25],
    30: [26, 27, 28, 29],
    31: [30], 32: [31], 33: [32], 34: [33],
};

const PHASES = [
    { id: 'phase1', title: 'Phase 1: โครงสร้างใต้ดินและฐานราก', titleEn: 'Phase 1: Substructure & Foundation', description: 'งานเตรียมการ วางผัง เสาเข็ม ฐานราก พื้น', descriptionEn: 'Preparation, Layout, Piling, Footing, Slab', stepIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { id: 'phase2', title: 'Phase 2: โครงสร้างหลักเหนือดิน', titleEn: 'Phase 2: Superstructure', description: 'เสา คาน ดาดฟ้า บันได โครงหลังคา', descriptionEn: 'Column, Beam, Deck, Staircase, Roof Structure', stepIds: [11, 12, 13, 14, 15] },
    { id: 'phase3', title: 'Phase 3: งานสถาปัตยกรรม', titleEn: 'Phase 3: Architecture', description: 'หลังคา ก่อฉาบ ฝ้า กระเบื้อง ทาสีรอบแรก', descriptionEn: 'Roofing, Masonry, Ceiling, Tiles, 1st Coat Paint', stepIds: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25] },
    { id: 'phase4', title: 'Phase 4: งานระบบ (MEP)', titleEn: 'Phase 4: MEP Systems', description: 'ไฟฟ้า สุขาภิบาล สุขภัณฑ์', descriptionEn: 'Electrical, Sanitary, Fixtures', stepIds: [26, 27, 28, 29, 30] },
    { id: 'phase5', title: 'Phase 5: จบงานและส่งมอบ', titleEn: 'Phase 5: Handover', description: 'ประตู สี ตรวจเช็ค เก็บงาน', descriptionEn: 'Doors, Paint, Inspection, Defect Clearing', stepIds: [31, 32, 33, 34] },
];

interface ProjectTimelineProps {
    onSelectStep: (id: number) => void;
    stepSaves: StepSaveMap;
}

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ onSelectStep, stepSaves }) => {
    const [isMounted, setIsMounted] = useState(false);
    const [previewStepId, setPreviewStepId] = useState<number | null>(null);
    const t = useTranslations('timeline');
    const { locale } = useAppLocale();

    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const computedSteps = STEPS.map((step) => {
        const isFinished = isMounted && !!stepSaves[step.id as StepId]?.res;
        let status: 'finish' | 'process' | 'wait' = 'wait';

        if (isFinished) {
            status = 'finish';
        } else {
            const deps = STEP_DEPS[step.id] ?? [];
            const isUnlocked = deps.length === 0 || (isMounted && deps.every(depId => !!stepSaves[depId as StepId]?.res));
            if (isUnlocked) {
                status = 'process';
            }
        }

        return { ...step, status };
    });

    const _hasHydrated = useAppStore(state => state._hasHydrated);

    if (!isMounted || !_hasHydrated) {
        return (
            <div style={{ width: '100%', padding: '0 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 24 }}>
                    <div style={{ flex: 1 }}>
                        <Skeleton.Input active style={{ width: 240, height: 32, marginBottom: 8 }} />
                        <br />
                        <Skeleton.Input active style={{ width: 180, height: 20 }} />
                    </div>
                    <div className="hidden sm:block">
                        <Skeleton.Button active style={{ width: 300, height: 60, borderRadius: 16 }} />
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {[1, 2, 3].map(phase => (
                        <div key={phase}>
                            <div style={{ marginBottom: 16, paddingLeft: 12, borderLeft: '4px solid #f0f0f0' }}>
                                <Skeleton.Input active style={{ width: 250, height: 24, marginBottom: 8 }} />
                                <br />
                                <Skeleton.Input active style={{ width: 350, height: 18 }} />
                            </div>
                            <div className="hidden sm:grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                {[1, 2, 3, 4].map(card => (
                                    <Card key={card} style={{ borderRadius: 12, border: '1px solid #f0f0f0' }} styles={{ body: { padding: 20 } }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <Skeleton.Input active style={{ width: 60, height: 16 }} />
                                            <Skeleton.Avatar active shape="circle" size="small" />
                                        </div>
                                        <Skeleton active title={{ width: '80%' }} paragraph={{ rows: 1, width: '40%' }} />
                                        <div style={{ marginTop: 24 }}>
                                            <Skeleton.Button active block style={{ borderRadius: 8 }} />
                                        </div>
                                    </Card>
                                ))}
                            </div>
                            <div className="block sm:hidden mt-4 pl-1">
                                <Skeleton active avatar paragraph={{ rows: 2 }} />
                                <Skeleton active avatar paragraph={{ rows: 2 }} className="mt-4" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const totalCount = computedSteps.length;
    const finishCount = computedSteps.filter(s => s.status === 'finish').length;
    const progressPct = Math.round((finishCount / totalCount) * 100);

    return (
        <div style={{ width: '100%', fontFamily: "var(--font-sarabun), 'Sarabun', sans-serif" }}>
            <style>{`
                @keyframes pulse-orange {
                    0% { box-shadow: 0 0 0 0 rgba(250, 140, 22, 0.4); }
                    70% { box-shadow: 0 0 0 8px rgba(250, 140, 22, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(250, 140, 22, 0); }
                }
            `}</style>

            {/* ── Minimal Header ─────────────────────────────────────── */}
            <div style={{
                marginBottom: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 24,
                padding: '0 8px'
            }}>
                <div>
                    <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f', display: 'flex', alignItems: 'center', gap: 12 }}>
                        {t('title')}
                    </Title>
                    <Text type="secondary" style={{ marginTop: 8, display: 'block', fontSize: 15 }}>
                        {t('completedSteps')} <Text strong style={{ color: '#389e0d', fontSize: 16 }}>{finishCount}</Text> {t('from')} {totalCount} {t('stepsAmount')}
                    </Text>
                </div>

                <div style={{
                    flex: '1 1 300px',
                    maxWidth: 400,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    background: '#fff',
                    padding: '16px 20px',
                    borderRadius: 16,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                    border: '1px solid #f0f0f0'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text strong style={{ fontSize: 13, color: '#595959' }}>{t('progressTitle')}</Text>
                        <Text strong style={{ fontSize: 13, color: '#389e0d' }}>{progressPct}%</Text>
                    </div>
                    <Progress
                        percent={progressPct}
                        strokeColor={{ '0%': '#fa8c16', '100%': '#52c41a' }}
                        railColor="#f5f5f5"
                        size={['100%', 8] as [string | number, number]}
                        showInfo={false}
                    />
                </div>
            </div>

            {/* ── Phase List ───────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {PHASES.map((phase, pIdx) => {
                    const phaseSteps = computedSteps.filter(s => phase.stepIds.includes(s.id));
                    const isPhaseUnlocked = phaseSteps.some(s => s.status === 'process' || s.status === 'finish');
                    const isUnlocked = pIdx === 0 || isPhaseUnlocked;

                    return (
                        <div key={phase.id} style={{
                            opacity: isUnlocked ? 1 : 0.4,
                            transition: 'opacity 0.3s ease',
                            pointerEvents: isUnlocked ? 'auto' : 'none',
                        }}>
                            <div style={{ marginBottom: 16, paddingLeft: 12, borderLeft: '4px solid #fa8c16' }}>
                                <Title level={4} style={{ margin: 0, color: '#1f1f1f', fontWeight: 700 }}>{locale === 'en' ? phase.titleEn : phase.title}</Title>
                                <Text type="secondary" style={{ fontSize: 14 }}>{locale === 'en' ? phase.descriptionEn : phase.description}</Text>
                            </div>

                            <div className="hidden sm:grid" style={{
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '16px'
                            }}>
                                {phaseSteps.map((step) => {
                                    const cfg = STATUS_CFG[step.status];
                                    const specialCount = step.subtasks.filter(s => s.special).length;
                                    const isProcess = step.status === 'process';

                                    return (
                                        <div key={step.id} style={{
                                            background: step.status === 'wait' ? '#fafafa' : '#fff',
                                            border: `1px solid ${cfg.border}`,
                                            borderRadius: 12,
                                            boxShadow: isProcess ? '0 8px 24px rgba(250, 140, 22, 0.12)' : '0 2px 8px rgba(0,0,0,0.03)',
                                            animation: isProcess ? 'pulse-orange 3s infinite' : 'none',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            transition: 'transform 0.2s, box-shadow 0.2s',
                                        }} onMouseEnter={(e) => {
                                            if (step.status !== 'wait') {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = isProcess ? '0 12px 28px rgba(250, 140, 22, 0.18)' : '0 6px 16px rgba(0,0,0,0.06)';
                                            }
                                        }} onMouseLeave={(e) => {
                                            if (step.status !== 'wait') {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = isProcess ? '0 8px 24px rgba(250, 140, 22, 0.12)' : '0 2px 8px rgba(0,0,0,0.03)';
                                            }
                                        }}>
                                            <div style={{ padding: '20px 20px 16px', flex: 1, opacity: step.status === 'wait' ? 0.6 : 1, display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                                    <span style={{
                                                        fontVariantNumeric: 'tabular-nums',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        color: step.status === 'wait' ? '#bfbfbf' : '#8c8c8c',
                                                        letterSpacing: 0.5,
                                                    }}>
                                                        {t('step', { id: String(step.id).padStart(2, '0') })}
                                                    </span>
                                                    {step.status === 'finish'
                                                        ? <CheckCircleFilled style={{ fontSize: 16, color: '#52c41a' }} />
                                                        : step.status === 'process'
                                                            ? <ClockCircleOutlined style={{ fontSize: 16, color: '#fa8c16' }} />
                                                            : <LockOutlined style={{ fontSize: 16, color: '#bfbfbf' }} />
                                                    }
                                                </div>

                                                <Title level={5} style={{ margin: '0 0 8px 0', fontSize: 15, lineHeight: 1.4, color: step.status === 'wait' ? '#8c8c8c' : '#262626', fontWeight: 600 }}>
                                                    {locale === 'en' ? step.titleEn : step.title}
                                                </Title>

                                                <div style={{ marginBottom: 16 }}>
                                                    <Tag color={cfg.tagColor} style={{ border: 'none', background: 'transparent', padding: 0, margin: 0, fontWeight: 500 }}>
                                                        {step.status === 'finish' ? t('statusFinish') : step.status === 'process' ? t('statusProcess') : t('statusWait')}
                                                    </Tag>
                                                </div>

                                                <div style={{ flex: 1 }}></div>

                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        cursor: 'pointer',
                                                        padding: '12px 0',
                                                        borderTop: '1px solid #f0f0f0',
                                                        marginBottom: 12
                                                    }}
                                                    onClick={() => setPreviewStepId(step.id)}
                                                >
                                                    <Text style={{ fontSize: 13, color: '#1890ff', fontWeight: 500 }}>{t('viewChecklist', { count: step.subtasks.length })}</Text>
                                                    {specialCount > 0 && <span style={{ fontSize: 12, color: '#d46b08', background: '#fff7e6', padding: '2px 8px', borderRadius: 12, fontWeight: 500 }}><ExclamationCircleFilled style={{ marginRight: 4 }} /> {t('specialInspection')}</span>}
                                                </div>

                                                {(step.status === 'process' || (step.id >= 0 && step.id <= 34)) && (
                                                    <Button
                                                        type={isProcess ? 'primary' : 'default'}
                                                        block
                                                        icon={step.status === 'wait' ? <LockOutlined /> : <RightOutlined />}
                                                        onClick={() => onSelectStep(step.id)}
                                                        disabled={step.status === 'wait'}
                                                        style={{
                                                            borderRadius: 8,
                                                            background: isProcess ? '#fa8c16' : step.status === 'finish' ? '#fff' : '#f5f5f5',
                                                            borderColor: isProcess ? '#fa8c16' : '#e8e8e8',
                                                            color: isProcess ? '#fff' : step.status === 'finish' ? '#595959' : '#bfbfbf',
                                                            fontWeight: isProcess ? 600 : 500,
                                                            boxShadow: 'none',
                                                        }}
                                                    >
                                                        {step.status === 'wait' ? t('btnWait') : step.status === 'finish' ? t('btnFinish') : t('btnProcess')}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Mobile Compact Timeline View */}
                            <div className="block sm:hidden mt-4 pl-1">
                                <Timeline
                                    items={phaseSteps.map((step) => {
                                        const cfg = STATUS_CFG[step.status];
                                        const isProcess = step.status === 'process';

                                        return {
                                            color: step.status === 'wait' ? '#d9d9d9' : step.status === 'finish' ? '#52c41a' : '#fa8c16',
                                            icon: step.status === 'finish'
                                                ? <CheckCircleFilled style={{ fontSize: 16, color: '#52c41a' }} />
                                                : step.status === 'process'
                                                    ? <ClockCircleOutlined style={{ fontSize: 16, color: '#fa8c16' }} />
                                                    : <LockOutlined style={{ fontSize: 14, color: '#bfbfbf' }} />,
                                            content: (
                                                <div style={{ marginBottom: 12, paddingBottom: 8 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: 14, fontWeight: 600, color: step.status === 'wait' ? '#8c8c8c' : '#262626', lineHeight: 1.3 }}>
                                                                {String(step.id).padStart(2, '0')}. {locale === 'en' ? step.titleEn : step.title}
                                                            </div>
                                                            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0 8px' }}>
                                                                <Text style={{ fontSize: 11, color: cfg.color, fontWeight: 500 }}>
                                                                    {step.status === 'finish' ? t('statusFinish') : step.status === 'process' ? t('statusProcess') : t('statusWait')}
                                                                </Text>
                                                                <span style={{ color: '#e8e8e8' }}>|</span>
                                                                <span
                                                                    style={{ fontSize: 12, color: '#1890ff', cursor: 'pointer' }}
                                                                    onClick={() => setPreviewStepId(step.id)}
                                                                >
                                                                    {t('viewChecklist', { count: step.subtasks.length })}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {(step.status === 'process' || (step.id >= 0 && step.id <= 34)) && (
                                                            <Button
                                                                type={isProcess ? 'primary' : 'default'}
                                                                size="small"
                                                                onClick={() => onSelectStep(step.id)}
                                                                disabled={step.status === 'wait'}
                                                                style={{
                                                                    borderRadius: 6,
                                                                    background: isProcess ? '#fa8c16' : step.status === 'finish' ? '#fff' : '#f5f5f5',
                                                                    borderColor: isProcess ? '#fa8c16' : '#e8e8e8',
                                                                    color: isProcess ? '#fff' : step.status === 'finish' ? '#595959' : '#bfbfbf',
                                                                    fontWeight: 500,
                                                                    minWidth: 60,
                                                                    padding: '0 8px'
                                                                }}
                                                            >
                                                                {step.status === 'wait' ? t('btnWaitMobile') : step.status === 'finish' ? t('btnFinishMobile') : t('btnProcessMobile')}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        };
                                    })}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <Modal
                title={
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#262626', fontFamily: "var(--font-sarabun), 'Sarabun', sans-serif" }}>
                        {previewStepId !== null ? t('checklistTitle', { title: locale === 'en' ? (computedSteps.find(s => s.id === previewStepId)?.titleEn ?? '') : (computedSteps.find(s => s.id === previewStepId)?.title ?? '') }) : ''}
                    </div>
                }
                open={previewStepId !== null}
                onCancel={() => setPreviewStepId(null)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setPreviewStepId(null)} style={{ borderRadius: 6, fontWeight: 500 }}>
                        {t('acknowledge')}
                    </Button>
                ]}
                centered
            >
                {previewStepId !== null && (
                    <div style={{ padding: '4px 0 8px', fontSize: 15, fontFamily: "var(--font-sarabun), 'Sarabun', sans-serif" }}>
                        {(() => {
                            const step = computedSteps.find(s => s.id === previewStepId);
                            if (!step) return null;
                            return (
                                <>
                                    {(step.note ?? step.noteEn) && (
                                        <div style={{ background: '#e6f4ff', padding: '12px 16px', borderRadius: 8, marginBottom: 16, color: '#0958d9', border: '1px solid #91caff' }}>
                                            ℹ︎ {locale === 'en' && step.noteEn ? step.noteEn : step.note}
                                        </div>
                                    )}
                                    <ul style={{ paddingLeft: 20, margin: 0, color: '#595959' }}>
                                        {step.subtasks.map((sub, idx) => (
                                            <li key={idx} style={{ marginBottom: 12, lineHeight: 1.5 }}>
                                                {locale === 'en' && sub.labelEn ? sub.labelEn : sub.label}
                                                {sub.special && <Tag color="orange" style={{ marginLeft: 8, fontSize: 11, padding: '0 6px', border: 'none', background: '#fff7e6' }}>{t('specialInspection')}</Tag>}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            );
                        })()}
                    </div>
                )}
            </Modal>
        </div>
    );
};
