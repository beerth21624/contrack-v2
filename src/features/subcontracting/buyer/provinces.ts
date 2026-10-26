// ─── The 77 Thai provinces (vendor list, package location). Free text on the server; the UI offers this list. ───
export const THAI_PROVINCES: readonly string[] = [
    'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท',
    'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม',
    'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์',
    'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์',
    'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง',
    'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ',
    'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย',
    'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี',
];

export const PROVINCE_OPTIONS = THAI_PROVINCES.map(p => ({ value: p, label: p }));

/** "จ.เชียงใหม่" / "เชียงใหม่ " / "กทม." → the list spelling, or the trimmed text when unknown. */
export function normalizeProvince(text: string): string {
    const t = text.trim().replace(/^จ(\.|ังหวัด)\s*/, '');
    if (t === 'กทม' || t === 'กทม.' || t === 'กรุงเทพ' || t === 'กรุงเทพฯ') return 'กรุงเทพมหานคร';
    return THAI_PROVINCES.find(p => p === t) ?? t;
}

/** The province named in a free-text address (longest match wins: "นครปฐม" before "ปทุม…"), or ''. */
export function provinceInAddress(address: string): string {
    if (/กรุงเทพ|กทม/.test(address)) return 'กรุงเทพมหานคร';
    let best = '';
    for (const p of THAI_PROVINCES) if (address.includes(p) && p.length > best.length) best = p;
    return best;
}
