// ─── Dev-mode trace labels of the toilet tile step (docs/dev-mode/README.md §5) ───
// Names follow the toilet tile page. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

export const TOILET_TILE_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            code: 'สัญลักษณ์',
            surface: 'พื้นหรือผนัง',
            item: 'รายการ',
            width: 'กว้างห้อง',
            length: 'ยาวห้อง / ความยาวรอบห้อง',
            height: 'ความสูงที่กรุกระเบื้อง',
            openings: 'หักช่องเปิด',
            location: 'ชื่อห้องน้ำ',
            product: 'ผลคูณขนาด',
            area: 'พื้นที่',
            floorArea: 'ปูกระเบื้องพื้น พื้นที่รวม',
            wallArea: 'กรุกระเบื้องผนัง พื้นที่รวม',
            R210: 'ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น',
            R211: 'กรุกระเบื้องแกรนิตโต้',
        },
        units: {
            width: 'ม.', length: 'ม.', height: 'ม.', openings: 'ตร.ม.', product: 'ตร.ม.', area: 'ตร.ม.',
            floorArea: 'ตร.ม.', wallArea: 'ตร.ม.', R210: 'ตร.ม.', R211: 'ตร.ม.',
        },
        steps: {
            product: { label: 'ผลคูณขนาด', formula: 'กว้าง × ยาว × สูง (เฉพาะช่องที่กรอก) = {dims}', unit: 'ตร.ม.' },
            area: { label: 'พื้นที่', formula: '{product} − {openings}', unit: 'ตร.ม.' },
            floorArea: { label: 'ปูกระเบื้องพื้น พื้นที่รวม', formula: 'Σ {area} (แถวพื้น)', unit: 'ตร.ม.' },
            wallArea: { label: 'กรุกระเบื้องผนัง พื้นที่รวม', formula: 'Σ {area} (แถวผนัง)', unit: 'ตร.ม.' },
            R210: { label: 'ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น', formula: '{floorArea}', unit: 'ตร.ม.' },
            R211: { label: 'กรุกระเบื้องแกรนิตโต้', formula: '{wallArea}', unit: 'ตร.ม.' },
        },
    },
    en: {
        terms: {
            code: 'Code',
            surface: 'Floor or wall',
            item: 'Item',
            width: 'Room width',
            length: 'Room length / room perimeter',
            height: 'Tiled height',
            openings: 'Deduct openings',
            location: 'Bathroom name',
            product: 'Product of dimensions',
            area: 'Area',
            floorArea: 'Floor tiling, total area',
            wallArea: 'Wall tiling, total area',
            R210: 'Non-slip granito tile (floor)',
            R211: 'Granito wall tile',
        },
        units: {
            width: 'm', length: 'm', height: 'm', openings: 'sq.m', product: 'sq.m', area: 'sq.m',
            floorArea: 'sq.m', wallArea: 'sq.m', R210: 'sq.m', R211: 'sq.m',
        },
        steps: {
            product: { label: 'Product of dimensions', formula: 'width × length × height (only the filled ones) = {dims}', unit: 'sq.m' },
            area: { label: 'Area', formula: '{product} − {openings}', unit: 'sq.m' },
            floorArea: { label: 'Floor tiling, total area', formula: 'Σ {area} (floor rows)', unit: 'sq.m' },
            wallArea: { label: 'Wall tiling, total area', formula: 'Σ {area} (wall rows)', unit: 'sq.m' },
            R210: { label: 'Non-slip granito tile (floor)', formula: '{floorArea}', unit: 'sq.m' },
            R211: { label: 'Granito wall tile', formula: '{wallArea}', unit: 'sq.m' },
        },
    },
};
