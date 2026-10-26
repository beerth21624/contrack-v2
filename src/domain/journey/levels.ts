// ─── The guided journey: the order a contractor fills the project in, one level at a time ───
// Levels follow how the plan is read (and calculator deps: openings before walls, roof size before roof
// frame, everything before paint), not BOQ section order. Each level is one screen: one calculator sheet,
// or a few BOQ (Home) rows that have no calculator.

export type LevelKind =
    /** One calculator sheet, shown in journey mode. */
    | { type: 'calc'; calc: string }
    /** BOQ (Home) rows typed directly (sections with no calculator sheet). */
    | { type: 'boq'; sections: number[] }
    /** Project name, site and owner (the BOQ header). */
    | { type: 'meta' };

export interface JourneyLevel {
    id: string;
    /** Short plain-language name of the level. */
    title: string;
    /** What to look at on the plan for this level (shown above the inputs). */
    planHint: string;
    kind: LevelKind;
    /** BOQ (Home) sections the level feeds, for the level's money total. */
    sections: number[];
    /** The work may not exist in every project (e.g. no demolition); the level can be marked "ไม่มีงานนี้". */
    optional?: boolean;
}

export interface JourneyPhase {
    id: string;
    title: string;
    levels: JourneyLevel[];
}

const calc = (calcId: string) => ({ type: 'calc', calc: calcId }) as const;

export const JOURNEY: JourneyPhase[] = [
    {
        id: 'prepare', title: 'เตรียมงาน', levels: [
            {
                id: 'project-info', title: 'ข้อมูลโครงการ', kind: { type: 'meta' }, sections: [],
                planHint: 'ดูหัวกระดาษแบบ: ชื่อโครงการ สถานที่ก่อสร้าง และชื่อเจ้าของบ้าน (ใช้เป็นหัว BOQ)',
            },
            {
                id: 'land-inspection', title: 'ตรวจสอบที่ดิน', kind: calc('land-inspection'), sections: [0],
                planHint: 'ดูโฉนด/ระวางที่ดิน และผังบริเวณ: ขนาดที่ดิน หมุดเขต และสิ่งที่ต้องตรวจก่อนเริ่มงาน',
            },
            {
                id: 'demolition', title: 'รื้อถอน', kind: calc('demolition'), sections: [1], optional: true,
                planHint: 'มีสิ่งปลูกสร้างเดิม ต้นไม้ หรือเศษวัสดุที่ต้องรื้อ/ขนทิ้งไหม ถ้าไม่มีกด "ไม่มีงานนี้"',
            },
            {
                id: 'fill', title: 'ถมดิน', kind: calc('fill'), sections: [1], optional: true,
                planHint: 'ดูผังบริเวณ: ขนาดพื้นที่ถม และระดับดินเดิมเทียบกับระดับที่ต้องการ (ความสูงถม)',
            },
            {
                id: 'temp-utilities', title: 'น้ำ-ไฟชั่วคราว', kind: calc('temp-utilities'), sections: [2],
                planHint: 'ดูผังบริเวณ: ระยะเดินสายไฟและท่อน้ำจากมิเตอร์ถึงหน้างาน และจำนวนจุดน้ำ/จุดไฟที่ใช้ระหว่างก่อสร้าง',
            },
            {
                id: 'site-camp', title: 'แคมป์คนงาน', kind: calc('site-camp'), sections: [3],
                planHint: 'จำนวนห้องพักคนงาน ห้องน้ำ ห้องอาบน้ำ และสโตร์ที่ต้องสร้างในไซต์',
            },
            {
                id: 'layout', title: 'วางผัง / ปักหมุด', kind: calc('layout'), sections: [4],
                planHint: 'ดูแปลนฐานราก: นับจุดตั้งผังตามแนวเสา และจำนวนหมุด (ปกติเท่าจำนวนเสาเข็ม)',
            },
        ],
    },
    {
        id: 'foundation', title: 'ฐานราก', levels: [
            {
                id: 'piles', title: 'เสาเข็ม', kind: calc('piles'), sections: [5], optional: true,
                planHint: 'ดูแปลนฐานราก/เสาเข็ม: ชนิดเข็ม ขนาด ความยาว และจำนวนต้น',
            },
            {
                id: 'footing', title: 'ฐานราก', kind: calc('footing'), sections: [6],
                planHint: 'ดูแปลนฐานรากและรูปขยายฐาน (F1, F2 …): ขนาด กว้าง×ยาว×หนา เหล็กเสริม และจำนวนฐาน',
            },
            {
                id: 'pedestal', title: 'เสาตอม่อ', kind: calc('pedestal'), sections: [7],
                planHint: 'ดูรูปขยายตอม่อ: ขนาดหน้าตัด ความสูงจากฐานถึงคานคอดิน และเหล็กเสริม',
            },
            {
                id: 'ground-beam', title: 'คานคอดิน', kind: calc('ground-beam'), sections: [8],
                planHint: 'ดูแปลนคานคอดิน (GB): ขนาดคาน ความยาวแต่ละช่วง และเหล็กเสริม',
            },
        ],
    },
    {
        id: 'structure', title: 'พื้น เสา คาน', levels: [
            {
                id: 'slab-on-grade', title: 'พื้นหล่อในที่', kind: calc('slab-on-grade'), sections: [9],
                planHint: 'ดูแปลนพื้น (S): ขนาดพื้นแต่ละผืน ความหนา และเหล็กเสริม',
            },
            {
                id: 'precast-slab', title: 'พื้นสำเร็จรูป', kind: calc('precast-slab'), sections: [10], optional: true,
                planHint: 'ดูแปลนพื้น (PS): ขนาดพื้นสำเร็จรูปแต่ละช่วง ถ้าแบบไม่มีพื้นสำเร็จรูปกด "ไม่มีงานนี้"',
            },
            {
                id: 'column', title: 'เสาชั้น 1', kind: calc('column'), sections: [11],
                planHint: 'ดูแปลนเสาและรูปขยายเสา (C1, C2 …): ขนาดหน้าตัด ความสูง จำนวนต้น และเหล็กเสริม',
            },
            {
                id: 'roof-beam', title: 'คานดาดฟ้า / คานหลังคา', kind: calc('roof-beam'), sections: [12],
                planHint: 'ดูแปลนคานชั้นหลังคา (RB): ขนาดคาน ความยาวแต่ละช่วง และเหล็กเสริม',
            },
            {
                id: 'roof-slab', title: 'พื้นดาดฟ้า', kind: calc('roof-slab'), sections: [12], optional: true,
                planHint: 'ดูแปลนพื้นดาดฟ้า (RS): ขนาด ความหนา และเหล็กเสริม ถ้าไม่มีดาดฟ้ากด "ไม่มีงานนี้"',
            },
            {
                id: 'stair', title: 'บันได', kind: calc('stair'), sections: [13], optional: true,
                planHint: 'ดูรูปขยายบันได: จำนวนลูกตั้ง ความกว้าง และเหล็กเสริมแม่บันได',
            },
            {
                id: 'column-plates', title: 'เพลทหัวเสา', kind: { type: 'boq', sections: [14] }, sections: [14],
                planHint: 'นับจำนวนเพลทหัวเสาที่รับโครงหลังคา (ดูรูปขยายจุดต่อโครงหลังคา)',
            },
        ],
    },
    {
        id: 'roof', title: 'หลังคา', levels: [
            {
                id: 'roofing', title: 'วัสดุมุงหลังคา', kind: calc('roofing'), sections: [16],
                planHint: 'ดูแปลนหลังคาและรูปด้าน: ขนาดหลังคาแต่ละด้าน ความชัน และความยาวเชิงชาย',
            },
            {
                id: 'roof-structure', title: 'โครงหลังคา', kind: calc('roof-structure'), sections: [15],
                planHint: 'ดูแปลนโครงหลังคา: ขนาดเหล็กจันทัน แป อะเส และความยาวแต่ละชิ้น',
            },
        ],
    },
    {
        id: 'walls', title: 'ผนัง ประตู หน้าต่าง', levels: [
            {
                id: 'door-window', title: 'ประตู-หน้าต่าง', kind: calc('door-window'), sections: [24, 30],
                planHint: 'ดูตารางประตู-หน้าต่าง (D1, W1 …): ขนาด ชนิด และจำนวนแต่ละแบบ (ใช้หักช่องเปิดผนังให้อัตโนมัติ)',
            },
            {
                id: 'brick', title: 'ก่ออิฐ', kind: calc('brick'), sections: [17],
                planHint: 'ดูแปลนพื้นและรูปด้าน: ความยาวผนังแต่ละแนว ความสูง และชนิดอิฐ',
            },
            {
                id: 'plaster', title: 'ฉาบปูน', kind: calc('plaster'), sections: [18],
                planHint: 'พื้นที่ฉาบมาจากผนังที่ก่อ ตรวจผนังที่ไม่ฉาบ (เช่น ผนังโชว์อิฐ) และสันขอบ',
            },
        ],
    },
    {
        id: 'systems', title: 'งานระบบไฟฟ้า-ประปา', levels: [
            {
                id: 'electrical-pipe', title: 'ท่อร้อยสายไฟ', kind: calc('electrical-pipe'), sections: [17],
                planHint: 'ดูแปลนไฟฟ้า: ระยะเดินท่อจากตู้ไฟถึงจุดไฟ ปลั๊ก และสวิตช์',
            },
            {
                id: 'electrical-cable', title: 'สายไฟ', kind: calc('electrical-cable'), sections: [18],
                planHint: 'ดูแปลนไฟฟ้า/ไดอะแกรม: ขนาดสายแต่ละวงจร (ระยะท่อนำมาจากด่านท่อร้อยสาย)',
            },
            {
                id: 'load-center', title: 'ตู้ควบคุมไฟฟ้า', kind: calc('load-center'), sections: [26],
                planHint: 'ดูไดอะแกรมไฟฟ้า: ตู้ควบคุม เมนเบรกเกอร์ และเบรกเกอร์ย่อย',
            },
            {
                id: 'electrical-equipment', title: 'อุปกรณ์ไฟฟ้า', kind: calc('electrical-equipment'), sections: [26],
                planHint: 'นับจากแปลนไฟฟ้า: ดวงโคม ปลั๊ก สวิตช์ และอุปกรณ์แต่ละชนิด',
            },
            {
                id: 'waste-pipe', title: 'ท่อน้ำทิ้ง', kind: calc('waste-pipe'), sections: [9],
                planHint: 'ดูแปลนสุขาภิบาล: ระยะท่อน้ำทิ้ง/ท่อส้วม/ท่อระบายอากาศ แต่ละขนาด',
            },
            {
                id: 'water-pipe', title: 'ท่อน้ำดี', kind: calc('water-pipe'), sections: [21],
                planHint: 'ดูแปลนสุขาภิบาล: ระยะท่อน้ำดีจากมิเตอร์ถึงจุดใช้น้ำ แต่ละขนาด',
            },
            {
                id: 'sanitary-system', title: 'อุปกรณ์ระบบสุขาภิบาล', kind: calc('sanitary-system'), sections: [27],
                planHint: 'ดูแปลนสุขาภิบาล: ถังดักไขมัน ถังบำบัด บ่อพัก และความยาวท่อระบายน้ำแอร์',
            },
            {
                id: 'sanitary-ware', title: 'สุขภัณฑ์', kind: calc('sanitary-ware'), sections: [29],
                planHint: 'นับจากแปลนห้องน้ำ: ชักโครก อ่างล้างหน้า ฝักบัว และอุปกรณ์',
            },
        ],
    },
    {
        id: 'finishes', title: 'งานตกแต่ง', levels: [
            {
                id: 'ceiling', title: 'ฝ้าเพดาน', kind: calc('ceiling'), sections: [19],
                planHint: 'ดูแปลนฝ้า: ชนิดฝ้าแต่ละห้อง และขนาดห้อง',
            },
            {
                id: 'floor-tile', title: 'ปูกระเบื้องพื้น', kind: calc('floor-tile'), sections: [20],
                planHint: 'ดูแปลนพื้น/ผังวัสดุพื้น: ขนาดแต่ละห้อง และชนิดกระเบื้อง',
            },
            {
                id: 'toilet-tile', title: 'กระเบื้องห้องน้ำ', kind: calc('toilet-tile'), sections: [21],
                planHint: 'ดูแปลนห้องน้ำ: ขนาดห้อง ความสูงบุผนัง และช่องเปิด',
            },
            {
                id: 'wall-finishing', title: 'ตกแต่งผนัง', kind: calc('wall-finishing'), sections: [22], optional: true,
                planHint: 'ดูรูปด้าน: บัวผนัง ผนังระแนง และงานตกแต่งพิเศษ ถ้าไม่มีกด "ไม่มีงานนี้"',
            },
            {
                id: 'paint', title: 'ทาสี', kind: calc('paint'), sections: [23, 25, 31],
                planHint: 'พื้นที่ทาสีดึงจากผนังฉาบ ฝ้า และงานตกแต่งให้แล้ว เลือกชนิดสีและตรวจความถูกต้อง',
            },
            {
                id: 'misc', title: 'งานเบ็ดเตล็ด', kind: calc('misc'), sections: [28],
                planHint: 'งานอื่น ๆ ที่ยังไม่อยู่ในด่านใด เช่น ราวกันตก กันสาด ป้ายบ้านเลขที่',
            },
        ],
    },
];

export const JOURNEY_LEVELS: JourneyLevel[] = JOURNEY.flatMap(p => p.levels);

export function getLevel(id: string): JourneyLevel | undefined {
    return JOURNEY_LEVELS.find(l => l.id === id);
}

export function phaseOf(levelId: string): JourneyPhase | undefined {
    return JOURNEY.find(p => p.levels.some(l => l.id === levelId));
}
