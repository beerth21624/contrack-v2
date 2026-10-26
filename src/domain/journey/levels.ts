// ─── The guided journey: the order a contractor fills the project in ───
// Levels follow how the plan is read (and calculator deps: openings before walls, roof size before roof
// frame, everything before paint), not BOQ section order. Each level is one screen: one calculator sheet,
// or a few BOQ (Home) rows that have no calculator.
// A level opens when every level in its `after` list is passed (docs/rebuild/CONSTRUCTION_FLOW.md §4), so
// work the construction flow does side by side (stairs beside the slabs, the four finishes, …) opens together.
// The list keeps the trade groups, so a prerequisite may sit later in the list (the electrical and sanitary
// fittings wait for paint, in งานตกแต่ง). Opening never reads list order; the `after` graph only has to be acyclic.

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
    /**
     * Levels that must be passed (done or "ไม่มีในโครงการนี้") before this one opens. They include every
     * calculator this level reads from (directly or through other levels). They may sit anywhere in the list.
     */
    after: readonly string[];
    /** BOQ (Home) sections the level feeds, for the level's money total. */
    sections: number[];
    /** The work may not exist in every project (e.g. no demolition); the level can be marked "ไม่มีในโครงการนี้". */
    optional?: boolean;
    /** BOQ lines that belong to the level although its calculator does not fill them (typed lump sums). */
    extraRows?: string[];
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
                after: [],
                planHint: 'ดูหัวกระดาษแบบ: ชื่อโครงการ สถานที่ก่อสร้าง และชื่อเจ้าของบ้าน (ใช้เป็นหัว BOQ)',
            },
            {
                id: 'land-inspection', title: 'ตรวจสอบที่ดิน', kind: calc('land-inspection'), sections: [0],
                after: ['project-info'],
                planHint: 'ดูโฉนดและผังบริเวณ แล้วเดินตรวจที่ดินจริง: ตำแหน่ง ทางเข้า แนวเขต หมุดอ้างอิง และจำนวนวัน/เที่ยวที่ใช้ตรวจ',
            },
            {
                id: 'demolition', title: 'รื้อถอน', kind: calc('demolition'), sections: [1], optional: true,
                after: ['land-inspection'],
                planHint: 'มีสิ่งปลูกสร้างเดิม ต้นไม้ หรือเศษวัสดุที่ต้องรื้อ/ขนทิ้งหรือไม่ หากไม่มี กด "ไม่มีในโครงการนี้"',
            },
            {
                id: 'fill', title: 'ถมดิน', kind: calc('fill'), sections: [1], optional: true,
                after: ['land-inspection'],
                planHint: 'ดูผังบริเวณ: ขนาดพื้นที่ถม และระดับดินเดิมเทียบกับระดับที่ต้องการ (ความสูงถม)',
            },
            {
                id: 'temp-utilities', title: 'น้ำ-ไฟชั่วคราว', kind: calc('temp-utilities'), sections: [2],
                after: ['demolition', 'fill'],
                planHint: 'ดูผังบริเวณ: ระยะเดินสายไฟและท่อน้ำจากมิเตอร์ถึงหน้างาน และจำนวนจุดน้ำ/จุดไฟที่ใช้ระหว่างก่อสร้าง',
            },
            {
                id: 'site-camp', title: 'แคมป์คนงาน', kind: calc('site-camp'), sections: [3],
                after: ['temp-utilities'],
                planHint: 'ไม่มีในแบบ — ตามแผนงานของผู้รับเหมา: จำนวนห้องพักคนงาน ห้องน้ำ ห้องอาบน้ำ และสโตร์ที่ต้องสร้างในไซต์ ถ้าไม่สร้างปล่อยว่าง',
            },
            {
                id: 'layout', title: 'วางผัง / ปักหมุด', kind: calc('layout'), sections: [4], extraRows: ['R32'],
                after: ['site-camp'],
                planHint: 'ดูแปลนฐานราก: นับจุดตั้งผังตามแนวเสา และจำนวนหมุด (ปกติเท่าจำนวนเสาเข็ม)',
            },
        ],
    },
    {
        id: 'foundation', title: 'ฐานราก', levels: [
            {
                id: 'piles', title: 'เสาเข็ม', kind: calc('piles'), sections: [5], optional: true,
                after: ['layout'],
                planHint: 'ดูแปลนฐานราก/เสาเข็ม: ชนิดเข็ม ขนาด ความยาว และจำนวนต้น',
            },
            {
                id: 'footing', title: 'ฐานราก', kind: calc('footing'), sections: [6],
                after: ['piles'],
                planHint: 'ดูแปลนฐานรากและรูปขยายฐาน (F1, F2 …): ขนาด กว้าง×ยาว×หนา เหล็กเสริม และจำนวนฐาน',
            },
            {
                id: 'pedestal', title: 'เสาตอม่อ', kind: calc('pedestal'), sections: [7],
                after: ['footing'],
                planHint: 'ดูรูปขยายตอม่อ: ขนาดหน้าตัด ความสูงจากฐานถึงคานคอดิน และเหล็กเสริม',
            },
            {
                id: 'ground-beam', title: 'คานคอดิน', kind: calc('ground-beam'), sections: [8],
                after: ['pedestal'],
                planHint: 'ดูแปลนคานคอดิน (GB): ขนาดคาน ความยาวรวมทุกช่วงของคานแต่ละแบบ และเหล็กเสริม',
            },
        ],
    },
    {
        id: 'structure', title: 'พื้น เสา คาน', levels: [
            {
                id: 'slab-on-grade', title: 'พื้นหล่อในที่', kind: calc('slab-on-grade'), sections: [9],
                after: ['ground-beam'],
                planHint: 'ดูแปลนพื้น (S): ขนาดพื้นแต่ละผืน ความหนา และเหล็กเสริม',
            },
            {
                id: 'precast-slab', title: 'พื้นสำเร็จรูป', kind: calc('precast-slab'), sections: [10], optional: true,
                after: ['slab-on-grade'],
                planHint: 'ดูแปลนพื้น (PS): ขนาดพื้นสำเร็จรูปแต่ละช่วง หากแบบไม่มีพื้นสำเร็จรูป กด "ไม่มีในโครงการนี้"',
            },
            {
                id: 'column', title: 'เสาชั้น 1', kind: calc('column'), sections: [11],
                after: ['precast-slab'],
                planHint: 'ดูแปลนเสาและรูปขยายเสา (C1, C2 …): ขนาดหน้าตัด ความสูง จำนวนต้น และเหล็กเสริม',
            },
            {
                id: 'roof-beam', title: 'คานดาดฟ้า / คานหลังคา', kind: calc('roof-beam'), sections: [12],
                after: ['column'],
                planHint: 'ดูแปลนคานชั้นหลังคา (RB): ขนาดคาน ความยาวแต่ละช่วง และเหล็กเสริม',
            },
            {
                id: 'roof-slab', title: 'พื้นดาดฟ้า', kind: calc('roof-slab'), sections: [12], optional: true,
                after: ['column'],
                planHint: 'ดูแปลนพื้นดาดฟ้า (RS): ขนาด ความหนา และเหล็กเสริม หากไม่มีดาดฟ้า กด "ไม่มีในโครงการนี้"',
            },
            {
                id: 'stair', title: 'บันได', kind: calc('stair'), sections: [13], optional: true,
                after: ['ground-beam'],
                planHint: 'ดูรูปขยายบันได: ความกว้าง จำนวนขั้น ลูกตั้ง ลูกนอน ความหนาท้องบันได และเหล็กเสริม หากไม่มีบันได กด "ไม่มีในโครงการนี้"',
            },
            {
                id: 'column-plates', title: 'เพลทหัวเสา', kind: { type: 'boq', sections: [14] }, sections: [14],
                after: ['roof-beam', 'roof-slab', 'stair'],
                planHint: 'นับจำนวนเพลทหัวเสาที่รับโครงหลังคา (ดูรูปขยายจุดต่อโครงหลังคา)',
            },
        ],
    },
    {
        id: 'roof', title: 'หลังคา', levels: [
            {
                id: 'roofing', title: 'วัสดุมุงหลังคา', kind: calc('roofing'), sections: [16],
                after: ['column-plates'],
                planHint: 'ดูแปลนหลังคาและรูปตัด: พื้นที่หลังคาตามแนวราบ (รวมชายคา) ความชัน ความยาวสันหลังคา ขอบจั่ว และเชิงชาย',
            },
            {
                id: 'roof-structure', title: 'โครงหลังคา', kind: calc('roof-structure'), sections: [15], extraRows: ['R158'],
                after: ['roofing'],
                planHint: 'ดูแปลนและรูปตัดโครงหลังคา: ความยาวอะเส อกไก่ ความสูงดั้ง และตะเข้ราง (จันทันกับแปคิดจากพื้นที่หลังคาให้เอง)',
            },
        ],
    },
    {
        id: 'walls', title: 'ผนัง ประตู หน้าต่าง', levels: [
            {
                id: 'door-window', title: 'ประตู-หน้าต่าง', kind: calc('door-window'), sections: [24, 30],
                after: ['column-plates'],
                planHint: 'ดูตารางประตู-หน้าต่าง (D1, W1 …): ขนาด ชนิด และจำนวนแต่ละแบบ (ใช้หักช่องเปิดผนังให้อัตโนมัติ)',
            },
            {
                id: 'brick', title: 'ก่ออิฐ', kind: calc('brick'), sections: [17],
                after: ['door-window'],
                planHint: 'ดูแปลนพื้นและรูปด้าน: ความยาวผนังแต่ละแนว ความสูง และชนิดอิฐ',
            },
            {
                id: 'plaster', title: 'ฉาบปูน', kind: calc('plaster'), sections: [18],
                after: ['roof-structure', 'brick'],
                planHint: 'พื้นที่ฉาบมาจากผนังที่ก่อให้แล้ว ตรวจว่าผนังไหนไม่ฉาบ (เช่น ผนังโชว์อิฐ) และใส่ผิวเสา-คานที่ต้องฉาบเพิ่ม',
            },
        ],
    },
    {
        id: 'systems', title: 'งานระบบไฟฟ้า-ประปา', levels: [
            {
                id: 'electrical-pipe', title: 'ท่อร้อยสายไฟ', kind: calc('electrical-pipe'), sections: [17],
                after: ['door-window'],
                planHint: 'ดูแปลนไฟฟ้า: ระยะเดินท่อจากตู้ไฟถึงจุดไฟ ปลั๊ก และสวิตช์',
            },
            {
                id: 'electrical-cable', title: 'สายไฟ', kind: calc('electrical-cable'), sections: [18],
                // With plaster (flow 18), and after the conduit it reads its runs from.
                after: ['roof-structure', 'brick', 'electrical-pipe'],
                planHint: 'ดูแปลนไฟฟ้า/ไดอะแกรม: ขนาดสายแต่ละวงจร (ระยะท่อนำมาจากขั้นตอนท่อร้อยสาย)',
            },
            {
                id: 'load-center', title: 'ตู้ควบคุมไฟฟ้า', kind: calc('load-center'), sections: [26],
                // Group D (flow 26–29): the fittings go in after paint, beside งานเบ็ดเตล็ด.
                after: ['paint'],
                planHint: 'ดูไดอะแกรมไฟฟ้า: ตู้ควบคุม เมนเบรกเกอร์ และเบรกเกอร์ย่อย',
            },
            {
                id: 'electrical-equipment', title: 'อุปกรณ์ไฟฟ้า', kind: calc('electrical-equipment'), sections: [26],
                // Group D, after paint (see ตู้ควบคุมไฟฟ้า). Its calculator reads nothing from the wiring.
                after: ['paint'],
                planHint: 'นับจากแปลนไฟฟ้า: ดวงโคม ปลั๊ก สวิตช์ และอุปกรณ์แต่ละชนิด',
            },
            {
                id: 'waste-pipe', title: 'ท่อน้ำทิ้ง', kind: calc('waste-pipe'), sections: [9],
                after: ['ground-beam'],
                planHint: 'ดูแปลนสุขาภิบาล: ระยะท่อน้ำทิ้ง/ท่อส้วม/ท่อระบายอากาศ แต่ละขนาด',
            },
            {
                id: 'water-pipe', title: 'ท่อน้ำดี', kind: calc('water-pipe'), sections: [21],
                after: ['plaster'],
                planHint: 'ดูแปลนสุขาภิบาล: ระยะท่อน้ำดีจากมิเตอร์ถึงจุดใช้น้ำ แต่ละขนาด',
            },
            {
                id: 'sanitary-system', title: 'อุปกรณ์ระบบสุขาภิบาล', kind: calc('sanitary-system'), sections: [27],
                // Group D, after paint (see ตู้ควบคุมไฟฟ้า).
                after: ['paint'],
                planHint: 'ดูแปลนสุขาภิบาล: ถังดักไขมัน ถังบำบัด บ่อพัก และความยาวท่อระบายน้ำ AC (ใยหิน) ภายนอก',
            },
            {
                id: 'sanitary-ware', title: 'สุขภัณฑ์', kind: calc('sanitary-ware'), sections: [29],
                // Waits for the whole of group D (flow 30), งานเบ็ดเตล็ด included.
                after: ['load-center', 'electrical-equipment', 'sanitary-system', 'misc'],
                planHint: 'นับจากแปลนห้องน้ำ: ชักโครก อ่างล้างหน้า ฝักบัว และอุปกรณ์',
            },
        ],
    },
    {
        id: 'finishes', title: 'งานตกแต่ง', levels: [
            {
                id: 'ceiling', title: 'ฝ้าเพดาน', kind: calc('ceiling'), sections: [19],
                after: ['plaster'],
                planHint: 'ดูแปลนฝ้า: ชนิดฝ้าแต่ละห้อง และขนาดห้อง',
            },
            {
                id: 'floor-tile', title: 'ปูกระเบื้องพื้น', kind: calc('floor-tile'), sections: [20],
                after: ['plaster'],
                planHint: 'ดูแปลนพื้น/ผังวัสดุพื้น: ขนาดแต่ละห้อง และชนิดกระเบื้อง',
            },
            {
                id: 'toilet-tile', title: 'กระเบื้องห้องน้ำ', kind: calc('toilet-tile'), sections: [21],
                after: ['plaster'],
                planHint: 'ดูแปลนห้องน้ำ: ขนาดห้อง ความสูงที่กรุกระเบื้องผนัง และขนาดประตู-หน้าต่างในห้องน้ำ',
            },
            {
                id: 'wall-finishing', title: 'ตกแต่งผนัง', kind: calc('wall-finishing'), sections: [22], optional: true,
                after: ['plaster'],
                planHint: 'ดูรูปด้าน: บัวผนัง ผนังระแนง และงานตกแต่งพิเศษ หากไม่มี กด "ไม่มีในโครงการนี้"',
            },
            {
                id: 'paint', title: 'ทาสี', kind: calc('paint'), sections: [23, 25, 31],
                after: ['ceiling', 'floor-tile', 'toilet-tile', 'wall-finishing'],
                planHint: 'พื้นที่ทาสีดึงจากผนังฉาบ ฝ้า และงานตกแต่งให้แล้ว เลือกชนิดสีและตรวจความถูกต้อง',
            },
            {
                id: 'misc', title: 'งานเบ็ดเตล็ด', kind: calc('misc'), sections: [28],
                after: ['paint'],
                planHint: 'งานอื่น ๆ ที่ยังไม่อยู่ในขั้นตอนใด เช่น ราวกันตก กันสาด ป้ายบ้านเลขที่',
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
