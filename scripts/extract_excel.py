#!/usr/bin/env python3
"""Extract foundation sheet formulas from the BOQ Excel."""
import zipfile, re, glob

xlsxes = glob.glob('/Users/sarawutinpol/projects/footing-boq-poc/*.xlsx')
xlsx = xlsxes[0]

with zipfile.ZipFile(xlsx) as z:
    # Read rels to map rId → sheet file
    with z.open('xl/_rels/workbook.xml.rels') as f:
        rels = f.read().decode('utf-8')
    rels_map = {}
    for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="worksheets/(sheet\d+\.xml)"', rels):
        rels_map[m.group(1)] = m.group(2)
    
    # Read workbook to get sheet names
    with z.open('xl/workbook.xml') as f:
        wb = f.read().decode('utf-8')
    sheets_raw = re.findall(r'name="([^"]+)"[^>]*sheetId="\d+"[^>]*r:id="(rId\d+)"', wb)
    
    # Read shared strings for text values
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        with z.open('xl/sharedStrings.xml') as f:
            ss_xml = f.read().decode('utf-8')
        ss = re.findall(r'<t[^>]*>([^<]*)</t>', ss_xml)

    def extract_sheet(name, rid):
        fn = rels_map.get(rid, None)
        if not fn:
            print(f"  No file for {rid}")
            return
        path = 'xl/worksheets/' + fn
        if path not in z.namelist():
            print(f"  File not found: {path}")
            return
        with z.open(path) as f:
            content = f.read().decode('utf-8')
        
        formulas = re.findall(r'<c r="([^"]+)"[^>]*><f[^>]*>([^<]+)</f>', content)
        texts    = re.findall(r'<c r="([^"]+)" t="s"><v>(\d+)</v>', content)
        nums     = re.findall(r'<c r="([^"]+)"(?![^>]*t=)[^>]*><v>([^<]+)</v></c>', content)
        
        print(f"\n{'='*70}")
        print(f"SHEET: {name!r}  ({path})")
        print(f"{'='*70}")
        
        if formulas:
            print("--- Formulas ---")
            for cell, formula in formulas:
                print(f"  {cell}: ={formula}")
        else:
            print("  [no formulas in this sheet]")
        
        print("--- Text cells (first 20) ---")
        for cell, idx in texts[:20]:
            i = int(idx)
            val = ss[i] if i < len(ss) else f'[{i}]'
            if val.strip():
                print(f"  {cell}: '{val}'")
        
        print("--- Numeric cells (first 20) ---")
        for cell, val in nums[:20]:
            print(f"  {cell}: {val}")

    # Print all sheet names first
    print("ALL SHEETS:")
    for name, rid in sheets_raw:
        fn = rels_map.get(rid, '?')
        print(f"  {name!r:55s} {rid} → {fn}")
    
    # Focus only on relevant foundation/structure sheets
    target_keywords = ['ฐานราก', 'เสาตอม่อ', 'คานคอดิน', 'พื้น', 'BOQ', 'เสาเข็ม']
    for name, rid in sheets_raw:
        if any(k in name for k in target_keywords):
            extract_sheet(name, rid)
