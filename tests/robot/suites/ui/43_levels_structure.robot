*** Settings ***
Documentation       W2b, journey levels 12-18 in depth: พื้นหล่อในที่, พื้นสำเร็จรูป, เสาชั้น 1, คานดาดฟ้า/คานหลังคา,
...                 พื้นดาดฟ้า, บันได, เพลทหัวเสา (docs/qa/TEST_PLAN.md section 4.3, W2).
...                 Per level: blank project and confirm rules (docs/rebuild/REQUIRED_FIELDS.md), plan filled -> totals
...                 equal the engine -> confirm -> next level, half-filled rows, edge numbers typed into cells
...                 (0, "1,250.5", "=2.5*4", "9.5+7+2", negative, text, cleared, very large), bar-size choices and
...                 quick-pick chips, add / duplicate / delete / empty state / 16 rows, skip and undo for optional
...                 levels, reload, previous arrow and the locked-level URL.
...                 Expected numbers come from the engine (``Level Totals Should Match Engine``); the few hard-coded
...                 ones are geometry (concrete = width x length x thickness) and are named where used.
Resource            ../../resources/pages/levels_structure_roof.resource
Suite Setup         Prepare Level Suite
Test Tags           journey    structure


*** Variables ***
${W}                    ความกว้าง (ม.)
${L}                    ความยาว (ม.)
${T}                    ความหนา (ม.)
${D}                    ความลึก (ม.)
${PLATE_LABEL}          เหล็กเพลทสี่เหลี่ยมหนา 9 มม. ขนาด 8 x 8 นิ้ว จำนวน
${GROUT_LABEL}          ปูนเกร้าท์ นอนชริ้งค์ จำนวน
@{BAR_5}                RB6    RB9    DB12    DB16    DB20
@{BAR_4}                RB6    RB9    DB12    DB16
${CARD_2}               css=[data-req-card="slabs#1"]
${CARD_PANELS_0}        css=[data-req-card="panels#0"]
${CARD_ROWS_0}          css=[data-req-card="rows#0"]
${CARD_ROWS_1}          css=[data-req-card="rows#1"]
${CARD_COLUMNS_0}       css=[data-req-card="columns#0"]
${CARD_COLUMNS_1}       css=[data-req-card="columns#1"]


*** Test Cases ***

# ═══════════════════════════ 12 พื้นหล่อในที่ (slab-on-grade) ═══════════════════════════
Slab On Grade Starts Empty With A Zero Total
    [Documentation]    Blank project: no panels, total 0, an invitation to add the first panel.
    Open Level    slab-on-grade
    Level Total Should Be    0
    Level Totals Should Match Engine    slab-on-grade
    Get Text    css=body    contains    ยังไม่มีพื้น
    Card Count Should Be Zero

Slab On Grade Cannot Be Confirmed With Nothing
    [Documentation]    REQUIRED_FIELDS: at least one slab panel. Confirm shows "ยังต้องกรอก 1 รายการ" and stays.
    [Tags]    negative
    Open Level    slab-on-grade
    Confirm Level Should Be Blocked    slab-on-grade    1
    Missing Summary Should Mention    เพิ่มพื้นหล่อในที่อย่างน้อย 1 ผืน
    Level Mark Should Be    slab-on-grade    ${None}

Slab On Grade Filled From The Plan Matches The Engine And Confirms
    [Documentation]    Two panels (4 x 10 m 0.10 m and 4 x 10 m 0.12 m): concrete = 40 x 0.10 + 40 x 0.12 = 8.8 m3,
    ...    damp-proof plastic = 80 m2; both totals equal the engine; confirm opens precast-slab and stores "done".
    [Tags]    smoke
    Open Level    slab-on-grade
    Fill Slab On Grade From Plan
    ${expected}=    Level Totals Should Match Engine    slab-on-grade
    ${lvl}=    Expected Level    ${expected}    slab-on-grade
    Should Be True    ${lvl}[total] > 0
    Numbers Should Be Close    ${expected}[calcOutputs][slab-on-grade][concrete]    8.8    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][slab-on-grade][plastic]    80    0.001
    Confirm Level    precast-slab
    Level Mark Should Be    slab-on-grade    done

Slab On Grade Required Fields Carry A Star
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Get Text    ${s1}    contains    (จำเป็น)

Slab Panel With Only A Width Is Blocked Until Length And Thickness Are Filled
    [Documentation]    A started panel must be complete: width only -> 2 missing (length, thickness); the list shrinks
    ...    live as the cells are filled and the confirm then goes through.
    [Tags]    negative
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Card Number    ${s1}    ${W}    4
    Confirm Level Should Be Blocked    slab-on-grade    2
    Missing Summary Should Mention    ผืนที่ 1 — ความยาว
    Get Text    ${s1}    contains    ยังขาด
    Fill Card Number    ${s1}    ${L}    10
    Missing Count Should Be    1
    Missing Summary Should Mention    ผืนที่ 1 — ความหนา
    Fill Card Number    ${s1}    ${T}    0.1
    Missing Summary Should Be Gone
    Confirm Level    precast-slab
    Level Mark Should Be    slab-on-grade    done

Slab Panel With Only A Length Is Blocked
    [Tags]    negative
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Card Number    ${s1}    ${L}    10
    Confirm Level Should Be Blocked    slab-on-grade    2
    Missing Summary Should Mention    ผืนที่ 1 — ความกว้าง

Second Slab Panel Without A Length Is Blocked After A Complete First Panel
    [Documentation]    Panel 1 is complete; panel 2 has a width only -> exactly one missing value, named.
    [Tags]    negative
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    ${s2}=    Ensure Card    slabs    1    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Card Number    ${s2}    ${W}    3
    Confirm Level Should Be Blocked    slab-on-grade    1
    Missing Summary Should Mention    ผืนที่ 2 — ความยาว

Slab Width Typed As Zero Is Stored As Zero
    [Tags]    edge
    [Template]    Slab Width Edge
    0    0

Slab Width With A Thousands Comma Is Read As A Number
    [Tags]    edge
    [Template]    Slab Width Edge
    1,250.5    1250.5

Slab Width As An Excel Formula Is Calculated
    [Tags]    edge
    [Template]    Slab Width Edge
    =2.5*4    10

Slab Width As A Sum Is Added Up
    [Tags]    edge
    [Template]    Slab Width Edge
    9.5+7+2    18.5

Slab Width Negative Number Gives Totals Equal To The Engine
    [Tags]    edge    negative
    [Template]    Slab Width Edge
    -3    -3

Slab Width Typed As Text Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Slab Width Edge
    abc    KEEP

Slab Width Cleared Becomes Zero
    [Tags]    edge
    [Template]    Slab Width Edge
    ${EMPTY}    0

Slab Width Very Large Still Equals The Engine
    [Tags]    edge
    [Template]    Slab Width Edge
    1000000    1000000

Slab Width Divided By Zero Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Slab Width Edge
    1/0    KEEP

Slab Width Beyond The Number Range Never Shows NaN Or Infinity
    [Documentation]    1e308 m x 10 m overflows to Infinity in the engine. The screen must stay readable: no NaN or
    ...    Infinity text and a level total that is still a number.
    [Tags]    edge    negative    bug
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    Fill Card Number    ${s1}    ${W}    1e308
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number

Every Slab Bar Size Can Be Chosen
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    Every Option Can Be Chosen    slab-on-grade    slab-on-grade    ${s1}    เหล็กเสริม ขนาดเหล็ก    ${BAR_4}    slabs    0    barSize

Slab Bar Layers One And Two Can Be Chosen
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    VAR    @{layers}    ${1}    ${2}
    VAR    @{labels}    1 ชั้น    2 ชั้น
    Every Option Can Be Chosen    slab-on-grade    slab-on-grade    ${s1}    วางเหล็ก    ${labels}    slabs    0    layers    ${layers}

Slab Names S1 And S2 Can Be Chosen
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    VAR    @{names}    S2    S1
    Every Option Can Be Chosen    slab-on-grade    slab-on-grade    ${s1}    ชื่อพื้น    ${names}    slabs    0    name

Slab Thickness Chips Fill The Thickness
    [Tags]    edge
    [Template]    Slab Thickness Chip
    0.10    0.1
    0.12    0.12
    0.15    0.15

Slab Spacing Chips Fill The Bar Spacing
    [Tags]    edge
    [Template]    Slab Spacing Chip
    0.15    0.15
    0.20    0.2

A New Slab Panel Copies The Thickness And Bars Of The Previous One
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    Choose Card Option    ${s1}    เหล็กเสริม ขนาดเหล็ก    DB12
    Pick Card Preset    ${s1}    0.15    1
    ${s2}=    Ensure Card    slabs    1    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Card Number Should Show    ${s2}    ${T}    0.10
    Card Option Should Be Selected    ${s2}    เหล็กเสริม ขนาดเหล็ก    DB12
    Card Number Should Show    ${s2}    ${W}    ${EMPTY}

Duplicating A Slab Panel Doubles Its Concrete
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    ${one}=    Level Totals Should Match Engine    slab-on-grade
    Duplicate Card    ${s1}
    Wait For Elements State    ${CARD_2}    visible
    ${two}=    Level Totals Should Match Engine    slab-on-grade
    ${doubled}=    Evaluate    2 * ${one}[calcOutputs][slab-on-grade][concrete]
    Numbers Should Be Close    ${two}[calcOutputs][slab-on-grade][concrete]    ${doubled}    0.0001

Deleting The Middle Slab Panel Keeps The Others And Updates The Total
    [Documentation]    A panel holding values asks "ลบ?" first; after the delete 2 cards remain, saved list has 2 panels.
    Open Level    slab-on-grade
    Add And Fill Cards    slabs    3    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน    Fill Minimal Slab Card
    Card Count Should Be    3
    ${middle}=    Card    slabs    1
    Delete Card    ${middle}
    Card Count Should Be    2
    ${input}=    Stored Input    slab-on-grade
    Length Should Be    ${input}[slabs]    2
    Level Totals Should Match Engine    slab-on-grade

Deleting An Untouched Slab Panel Needs No Confirmation
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Delete Card    ${s1}    asks=${FALSE}
    Wait For Elements State    text=ยังไม่มีพื้น    visible    timeout=10s

Deleting The Last Slab Panel Shows The Empty State And A Zero Total
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    Delete Card    ${s1}
    Wait For Elements State    text=ยังไม่มีพื้น    visible    timeout=10s
    Level Total Should Be    0
    Level Totals Should Match Engine    slab-on-grade
    Confirm Level Should Be Blocked    slab-on-grade    1

Sixteen Slab Panels Add Up To The Engine Total
    [Documentation]    16 cards (more than the 15 rows of the Excel sheet); progress bar appears from 5 cards.
    [Tags]    slow
    Open Level    slab-on-grade
    Add And Fill Cards    slabs    16    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน    Fill Minimal Slab Card
    Card Count Should Be    16
    Get Text    css=body    contains    ครบทุกผืนแล้ว
    ${expected}=    Level Totals Should Match Engine    slab-on-grade
    Numbers Should Be Close    ${expected}[calcOutputs][slab-on-grade][concrete]    32    0.001
    Confirm Level    precast-slab

Slab On Grade Values And Mark Survive A Reload
    Open Level    slab-on-grade
    Fill Slab On Grade From Plan
    Confirm Level    precast-slab
    Go To Level    slab-on-grade
    Reload Level
    Level Totals Should Match Engine    slab-on-grade
    Level Should Be Marked Done On Screen
    Level Mark Should Be    slab-on-grade    done
    ${s2}=    Card    slabs    1
    Card Number Should Show    ${s2}    ${T}    0.12
    Card Number Should Show    ${s2}    ${L}    10.00

Slab On Grade Previous Arrow Returns To The Ground Beam
    Open Level    slab-on-grade
    Previous Arrow Should Go To    ground-beam    คานคอดิน

Slab On Grade Is Locked Until The Ground Beam Is Done
    [Tags]    negative
    Level Should Be Locked    slab-on-grade    ground-beam    คานคอดิน

# ═══════════════════════════ 13 พื้นสำเร็จรูป (precast-slab, optional) ═══════════════════════════
Precast Slab Starts Empty With A Zero Total
    Open Level    precast-slab
    Level Total Should Be    0
    Level Totals Should Match Engine    precast-slab
    Get Text    css=body    contains    ยังไม่มีพื้นสำเร็จรูป

Precast Slab Can Be Confirmed With Nothing Because No Value Is Required
    [Documentation]    REQUIRED_FIELDS: no minimum item; an empty optional level is confirmed as done.
    Open Level    precast-slab
    Confirm Level    column
    Level Mark Should Be    precast-slab    done

Precast Slab Filled From The Plan Matches The Engine And Confirms
    [Documentation]    Spans 3 x 4 and 2.5 x 3.5 m: area = 12 + 8.75 = 20.75 m2 (geometry).
    Open Level    precast-slab
    Fill Precast Slab From Plan
    ${expected}=    Level Totals Should Match Engine    precast-slab
    Numbers Should Be Close    ${expected}[calcOutputs][precast-slab][area]    20.75    0.001
    Confirm Level    column
    Level Mark Should Be    precast-slab    done

Precast Span With Only A Width Is Blocked Until The Length Is Filled
    [Tags]    negative
    Open Level    precast-slab
    ${p1}=    Ensure Card    panels    0    เพิ่มช่วงแรก    เพิ่มช่วงถัดไป
    Fill Card Number    ${p1}    ความกว้างช่วง (ม.)    3
    Confirm Level Should Be Blocked    precast-slab    1
    Missing Summary Should Mention    ช่วงที่ 1 — ความยาวช่วง
    Fill Card Number    ${p1}    ความยาวช่วง (ม.)    4
    Missing Summary Should Be Gone
    Confirm Level    column

Precast Span Edge Value Is Handled
    [Tags]    edge
    [Template]    Precast Width Edge
    0    0
    1,250.5    1250.5
    =2.5*4    10
    -3    -3
    abc    KEEP

Optional Precast Slab Can Be Skipped And The Skip Undone
    [Documentation]    Skip -> level total 0, the construction total drops by exactly the level's amount; undo restores both.
    Open Level    precast-slab
    Fill Precast Slab From Plan
    Skip Then Undo Keeps Amounts Exact    precast-slab    column

Optional Precast Slab With Nothing Typed Can Be Skipped
    Open Level    precast-slab
    Skip Level
    Wait For Condition    Url    should end with    /journey/column    timeout=30s
    Level Mark Should Be    precast-slab    skipped

Sixteen Precast Spans Add Up To The Engine Total
    [Tags]    slow
    Open Level    precast-slab
    Add And Fill Cards    panels    16    เพิ่มช่วงแรก    เพิ่มช่วงถัดไป    Fill Minimal Precast Card
    Card Count Should Be    16
    ${expected}=    Level Totals Should Match Engine    precast-slab
    Numbers Should Be Close    ${expected}[calcOutputs][precast-slab][area]    192    0.001

Deleting Precast Spans Down To The Empty State
    Open Level    precast-slab
    Add And Fill Cards    panels    2    เพิ่มช่วงแรก    เพิ่มช่วงถัดไป    Fill Minimal Precast Card
    Delete Card    ${CARD_PANELS_0}
    Card Count Should Be    1
    Level Totals Should Match Engine    precast-slab
    Delete Card    ${CARD_PANELS_0}
    Wait For Elements State    text=ยังไม่มีพื้นสำเร็จรูป    visible    timeout=10s
    Level Total Should Be    0

Precast Slab Values And Mark Survive A Reload
    Open Level    precast-slab
    Fill Precast Slab From Plan
    Confirm Level    column
    Go To Level    precast-slab
    Reload Level
    Level Totals Should Match Engine    precast-slab
    Level Mark Should Be    precast-slab    done
    Card Number Should Show    ${CARD_PANELS_0}    ความยาวช่วง (ม.)    4.00

Precast Slab Previous Arrow Returns To The Slab On Grade
    Open Level    precast-slab
    Previous Arrow Should Go To    slab-on-grade    พื้นหล่อในที่

Precast Slab Is Locked Until The Slab On Grade Is Done
    [Tags]    negative
    Level Should Be Locked    precast-slab    slab-on-grade    พื้นหล่อในที่

# ═══════════════════════════ 14 เสาชั้น 1 (column) ═══════════════════════════
Column Starts Empty With A Zero Total
    Open Level    column
    Level Total Should Be    0
    Level Totals Should Match Engine    column
    Get Text    css=body    contains    ยังไม่มีเสา

Column Cannot Be Confirmed With Nothing
    [Tags]    negative
    Open Level    column
    Confirm Level Should Be Blocked    column    1
    Missing Summary Should Mention    เพิ่มเสาอย่างน้อย 1 รายการ
    Level Mark Should Be    column    ${None}

Column Filled From The Plan Matches The Engine And Confirms
    [Documentation]    12 columns 0.20 x 0.20 x 3 m: concrete = 12 x 0.04 x 3 = 1.44 m3 (geometry).
    [Tags]    smoke
    Open Level    column
    Fill Column From Plan
    ${expected}=    Level Totals Should Match Engine    column
    Numbers Should Be Close    ${expected}[calcOutputs][column][concrete]    1.44    0.001
    Confirm Level    roof-beam
    Level Mark Should Be    column    done

Column With A Size But No Count Is Blocked Until The Count Is Filled
    [Documentation]    The brief's case: size and height typed, count missing -> 1 missing value, the count.
    [Tags]    negative
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Choose Card Option    ${c1}    ชื่อเสา    C1
    Fill Card Number    ${c1}    ${W}    0.2
    Fill Card Number    ${c1}    ${L}    0.2
    Fill Card Number    ${c1}    ความสูงเสา (ม.)    3
    Confirm Level Should Be Blocked    column    1
    Missing Summary Should Mention    เสา C1 — จำนวนต้น
    Fill Card Number    ${c1}    จำนวนต้น (ต้น)    12
    Missing Summary Should Be Gone
    Confirm Level    roof-beam
    Level Mark Should Be    column    done

Column With Only A Count Is Blocked For Its Size And Height
    [Tags]    negative
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Fill Card Number    ${c1}    จำนวนต้น (ต้น)    4
    Confirm Level Should Be Blocked    column    3
    Missing Summary Should Mention    เสา แบบที่ 1 — ความกว้าง
    Get Text    ${c1}    contains    ยังขาด

Column Count Typed As Zero Is Stored As Zero
    [Tags]    edge
    [Template]    Column Count Edge
    0    0

Column Count With A Thousands Comma Is Read As A Number
    [Tags]    edge
    [Template]    Column Count Edge
    1,250.5    1250.5

Column Count As An Excel Formula Is Calculated
    [Tags]    edge
    [Template]    Column Count Edge
    =2.5*4    10

Column Count As A Sum Is Added Up
    [Tags]    edge
    [Template]    Column Count Edge
    9.5+7+2    18.5

Column Count Negative Gives Totals Equal To The Engine
    [Tags]    edge    negative
    [Template]    Column Count Edge
    -3    -3

Column Count Typed As Text Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Column Count Edge
    abc    KEEP

Column Count Cleared Becomes Zero
    [Tags]    edge
    [Template]    Column Count Edge
    ${EMPTY}    0

Column Count Very Large Still Equals The Engine
    [Tags]    edge
    [Template]    Column Count Edge
    1000000    1000000

Column Count Divided By Zero Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Column Count Edge
    1/0    KEEP

Column Height Can Be Typed As A Sum Of Levels
    [Documentation]    The placeholder says "เช่น 0.55+3.5": the height cell adds it up (4.05 m).
    [Tags]    edge
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Fill Minimal Column Card    ${c1}
    Edge Value Should Be Handled    column    column    ${c1}    ความสูงเสา (ม.)    0.55+3.5    columns    0    height    4.05

Column Height Beyond The Number Range Never Shows NaN Or Infinity
    [Tags]    edge    negative    bug
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Fill Minimal Column Card    ${c1}
    Fill Card Number    ${c1}    ความสูงเสา (ม.)    1e308
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number

Column Names C1 C2 And C3 Can Be Chosen
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    VAR    @{names}    C2    C3    C1
    Every Option Can Be Chosen    column    column    ${c1}    ชื่อเสา    ${names}    columns    0    name

Every Column Main Bar Size Can Be Chosen
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Fill Minimal Column Card    ${c1}
    Every Option Can Be Chosen    column    column    ${c1}    เหล็กยืน ขนาดเหล็ก    ${BAR_5}    columns    0    mainSize

Every Column Stirrup Size Can Be Chosen
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Fill Minimal Column Card    ${c1}
    Every Option Can Be Chosen    column    column    ${c1}    เหล็กปลอก ขนาดเหล็ก    ${BAR_5}    columns    0    stirrupSize

Column Stirrup Spacing Chips Fill The Spacing
    [Tags]    edge
    [Template]    Column Stirrup Chip
    0.15    0.15
    0.20    0.2

Column Main Bar Count Typed As Text Keeps The Old Value
    [Tags]    edge    negative
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Fill Minimal Column Card    ${c1}
    Edge Value Should Be Handled    column    column    ${c1}    เหล็กยืน (เส้น)    abc    columns    0    mainCount    KEEP

Duplicating A Column Copies The Size And Leaves The Count To Fill
    [Documentation]    "ทำซ้ำ" = same size, height and bars, next free name, count empty: the total does not change
    ...    until the count is typed.
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Fill Minimal Column Card    ${c1}
    ${one}=    Level Totals Should Match Engine    column
    Duplicate Card    ${c1}
    ${c2}=    Card    columns    1
    Wait For Elements State    ${c2}    visible
    Card Number Should Show    ${c2}    จำนวนต้น (ต้น)    ${EMPTY}
    Card Number Should Show    ${c2}    ความกว้าง (ม.)    0.20
    ${same}=    Level Totals Should Match Engine    column
    Numbers Should Be Close    ${same}[calcOutputs][column][concrete]    ${one}[calcOutputs][column][concrete]    0.0001
    Fill Card Number    ${c2}    จำนวนต้น (ต้น)    2
    ${two}=    Level Totals Should Match Engine    column
    ${doubled}=    Evaluate    2 * ${one}[calcOutputs][column][concrete]
    Numbers Should Be Close    ${two}[calcOutputs][column][concrete]    ${doubled}    0.0001

Adding A Second Column Type Offers The Next Free Name
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Choose Card Option    ${c1}    ชื่อเสา    C1
    Wait For Elements State    css=button:has-text("เพิ่มเสา C2")    visible    timeout=10s
    Click    css=button:has-text("เพิ่มเสา C2")
    ${c2}=    Card    columns    1
    Card Option Should Be Selected    ${c2}    ชื่อเสา    C2

Deleting The Middle Column Type Keeps The Others
    Open Level    column
    Add And Fill Cards    columns    3    เพิ่มเสา    เพิ่มเสา    Fill Minimal Column Card
    Delete Card    ${CARD_COLUMNS_1}
    Card Count Should Be    2
    ${input}=    Stored Input    column
    Length Should Be    ${input}[columns]    2
    Level Totals Should Match Engine    column

Deleting The Last Column Shows The Empty State And A Zero Total
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Fill Minimal Column Card    ${c1}
    Delete Card    ${c1}
    Wait For Elements State    text=ยังไม่มีเสา    visible    timeout=10s
    Level Total Should Be    0
    Confirm Level Should Be Blocked    column    1

Sixteen Column Types Add Up To The Engine Total
    [Tags]    slow
    Open Level    column
    Add And Fill Cards    columns    16    เพิ่มเสา    เพิ่มเสา    Fill Minimal Column Card
    Card Count Should Be    16
    ${expected}=    Level Totals Should Match Engine    column
    Numbers Should Be Close    ${expected}[calcOutputs][column][concrete]    3.84    0.001

Column Values And Mark Survive A Reload
    Open Level    column
    Fill Column From Plan
    Confirm Level    roof-beam
    Go To Level    column
    Reload Level
    Level Totals Should Match Engine    column
    Level Mark Should Be    column    done
    Card Number Should Show    ${CARD_COLUMNS_0}    จำนวนต้น (ต้น)    12

Column Previous Arrow Returns To The Precast Slab
    Open Level    column
    Previous Arrow Should Go To    precast-slab    พื้นสำเร็จรูป

Column Is Locked Until The Precast Slab Is Decided
    [Tags]    negative
    Level Should Be Locked    column    precast-slab    พื้นสำเร็จรูป

# ═══════════════════════════ 15 คานดาดฟ้า / คานหลังคา (roof-beam) ═══════════════════════════
Roof Beam Starts Empty With A Zero Total
    Open Level    roof-beam
    Level Total Should Be    0
    Level Totals Should Match Engine    roof-beam
    Get Text    css=body    contains    ยังไม่มีคาน

Roof Beam Cannot Be Confirmed With Nothing
    [Tags]    negative
    Open Level    roof-beam
    Confirm Level Should Be Blocked    roof-beam    1
    Missing Summary Should Mention    เพิ่มคานดาดฟ้า / คานหลังคาอย่างน้อย 1 รายการ

Roof Beam Filled From The Plan Matches The Engine And Confirms
    [Documentation]    B1 36 m 0.20 x 0.40 and B2 16 m 0.20 x 0.30: concrete = 2.88 + 0.96 = 3.84 m3 (geometry).
    [Tags]    smoke
    Open Level    roof-beam
    Fill Roof Beam From Plan
    ${expected}=    Level Totals Should Match Engine    roof-beam
    Numbers Should Be Close    ${expected}[calcOutputs][roof-beam][concrete]    3.84    0.001
    Confirm Level    roof-slab
    Level Mark Should Be    roof-beam    done

Roof Beam With A Width Only Is Blocked Until Depth And Length Are Filled
    [Tags]    negative
    Open Level    roof-beam
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Fill Card Number    ${b1}    ${W}    0.2
    Confirm Level Should Be Blocked    roof-beam    2
    Missing Summary Should Mention    คานที่ 1 — ความลึก
    Fill Card Number    ${b1}    ${D}    0.4
    Missing Count Should Be    1
    Missing Summary Should Mention    คานที่ 1 — ความยาวรวม
    Fill Card Number    ${b1}    ความยาวรวม (ม.)    8+10
    Missing Summary Should Be Gone
    Confirm Level    roof-slab
    Level Mark Should Be    roof-beam    done

Roof Beam With A Length Only Is Blocked For Its Section
    [Tags]    negative
    Open Level    roof-beam
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Fill Card Number    ${b1}    ความยาวรวม (ม.)    12
    Confirm Level Should Be Blocked    roof-beam    2
    Missing Summary Should Mention    คานที่ 1 — ความกว้าง

Roof Beam Length Typed As Zero Is Stored As Zero
    [Tags]    edge
    [Template]    Roof Beam Length Edge
    0    0

Roof Beam Length With A Thousands Comma Is Read As A Number
    [Tags]    edge
    [Template]    Roof Beam Length Edge
    1,250.5    1250.5

Roof Beam Length As An Excel Formula Is Calculated
    [Tags]    edge
    [Template]    Roof Beam Length Edge
    =2.5*4    10

Roof Beam Length As A Sum Of Spans Is Added Up
    [Tags]    edge
    [Template]    Roof Beam Length Edge
    9.5+7+2    18.5

Roof Beam Length Negative Gives Totals Equal To The Engine
    [Tags]    edge    negative
    [Template]    Roof Beam Length Edge
    -3    -3

Roof Beam Length Typed As Text Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Roof Beam Length Edge
    abc    KEEP

Roof Beam Length Cleared Becomes Zero
    [Tags]    edge
    [Template]    Roof Beam Length Edge
    ${EMPTY}    0

Roof Beam Length Very Large Still Equals The Engine
    [Tags]    edge
    [Template]    Roof Beam Length Edge
    1000000    1000000

Roof Beam Length Divided By Zero Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Roof Beam Length Edge
    1/0    KEEP

Roof Beam Length Beyond The Number Range Never Shows NaN Or Infinity
    [Tags]    edge    negative    bug
    Open Level    roof-beam
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Fill Minimal Roof Beam Card    ${b1}
    Fill Card Number    ${b1}    ความยาวรวม (ม.)    1e308
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number

Roof Beam Names B1 To B6 Can Be Chosen
    Open Level    roof-beam
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    VAR    @{names}    B1    B2    B3    B4    B5    B6
    Every Option Can Be Chosen    roof-beam    roof-beam    ${b1}    ชื่อคาน    ${names}    rows    0    name

Every Roof Beam Main Bar Size Can Be Chosen
    Open Level    roof-beam
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Fill Minimal Roof Beam Card    ${b1}
    Every Option Can Be Chosen    roof-beam    roof-beam    ${b1}    เหล็กแกน (บน + ล่าง) ขนาดเหล็ก    ${BAR_5}    rows    0    mainSize

Every Roof Beam Stirrup Size Can Be Chosen
    Open Level    roof-beam
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Fill Minimal Roof Beam Card    ${b1}
    Every Option Can Be Chosen    roof-beam    roof-beam    ${b1}    เหล็กปลอก ขนาดเหล็ก    ${BAR_5}    rows    0    stirrupSize

Roof Beam Stirrup Spacing Chips Fill The Spacing
    [Tags]    edge
    [Template]    Roof Beam Stirrup Chip
    0.15    0.15
    0.20    0.2

Duplicating A Roof Beam Keeps Its Section And Bars
    Open Level    roof-beam
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Fill Minimal Roof Beam Card    ${b1}
    Duplicate Card    ${b1}
    ${b2}=    Card    rows    1
    Wait For Elements State    ${b2}    visible
    Card Number Should Show    ${b2}    ${W}    0.20
    Card Number Should Show    ${b2}    ความยาวรวม (ม.)    ${EMPTY}
    Level Totals Should Match Engine    roof-beam

Deleting The Middle Roof Beam Keeps The Others
    Open Level    roof-beam
    Add And Fill Cards    rows    3    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด    Fill Minimal Roof Beam Card
    Delete Card    ${CARD_ROWS_1}
    Card Count Should Be    2
    ${input}=    Stored Input    roof-beam
    Length Should Be    ${input}[rows]    2
    Level Totals Should Match Engine    roof-beam

Deleting The Last Roof Beam Shows The Empty State
    Open Level    roof-beam
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Fill Minimal Roof Beam Card    ${b1}
    Delete Card    ${b1}
    Wait For Elements State    text=ยังไม่มีคาน    visible    timeout=10s
    Level Total Should Be    0

Sixteen Roof Beams Add Up To The Engine Total
    [Tags]    slow
    Open Level    roof-beam
    Add And Fill Cards    rows    16    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด    Fill Minimal Roof Beam Card
    Card Count Should Be    16
    ${expected}=    Level Totals Should Match Engine    roof-beam
    Numbers Should Be Close    ${expected}[calcOutputs][roof-beam][concrete]    6.4    0.001

Roof Beam Values And Mark Survive A Reload
    Open Level    roof-beam
    Fill Roof Beam From Plan
    Confirm Level    roof-slab
    Go To Level    roof-beam
    Reload Level
    Level Totals Should Match Engine    roof-beam
    Level Mark Should Be    roof-beam    done
    Card Number Should Show    ${CARD_ROWS_1}    ${D}    0.30

Roof Beam Previous Arrow Returns To The Column
    Open Level    roof-beam
    Previous Arrow Should Go To    column    เสาชั้น 1

Roof Beam Is Locked Until The Column Is Done
    [Tags]    negative
    Level Should Be Locked    roof-beam    column    เสาชั้น 1

# ═══════════════════════════ 16 พื้นดาดฟ้า (roof-slab, optional) ═══════════════════════════
Roof Slab Starts Empty With A Zero Total
    Open Level    roof-slab
    Level Total Should Be    0
    Level Totals Should Match Engine    roof-slab
    Get Text    css=body    contains    ยังไม่มีพื้นดาดฟ้า

Roof Slab Can Be Confirmed With Nothing Because No Value Is Required
    Open Level    roof-slab
    Confirm Level    stair
    Level Mark Should Be    roof-slab    done

Roof Slab Filled From The Plan Matches The Engine And Confirms
    [Documentation]    One panel 3 x 4 m, 0.10 m: concrete = 1.2 m3 (geometry).
    Open Level    roof-slab
    Fill Roof Slab From Plan
    ${expected}=    Level Totals Should Match Engine    roof-slab
    Numbers Should Be Close    ${expected}[calcOutputs][roof-slab][concrete]    1.2    0.001
    Confirm Level    stair
    Level Mark Should Be    roof-slab    done

Roof Slab With Only A Width Is Blocked Until Length And Thickness Are Filled
    [Tags]    negative
    Open Level    roof-slab
    ${s1}=    Ensure Card    rows    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Card Number    ${s1}    ${W}    3
    Confirm Level Should Be Blocked    roof-slab    2
    Missing Summary Should Mention    ผืนที่ 1 — ความยาว
    Fill Card Number    ${s1}    ${L}    4
    Fill Card Number    ${s1}    ${T}    0.1
    Missing Summary Should Be Gone
    Confirm Level    stair

Roof Slab Width Edge Value Is Handled
    [Tags]    edge
    [Template]    Roof Slab Width Edge
    0    0
    1,250.5    1250.5
    =2.5*4    10
    -3    -3
    abc    KEEP
    ${EMPTY}    0

Optional Roof Slab Can Be Skipped And The Skip Undone
    Open Level    roof-slab
    Fill Roof Slab From Plan
    Skip Then Undo Keeps Amounts Exact    roof-slab    stair

Every Roof Slab Bar Size Can Be Chosen
    Open Level    roof-slab
    ${s1}=    Ensure Card    rows    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    Every Option Can Be Chosen    roof-slab    roof-slab    ${s1}    เหล็กเสริม ขนาดเหล็ก    ${BAR_4}    rows    0    size

Roof Slab Thickness And Spacing Chips Fill The Boxes
    [Tags]    edge
    Open Level    roof-slab
    ${s1}=    Ensure Card    rows    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    Preset Chip Should Be Stored    roof-slab    roof-slab    ${s1}    0.12    0    rows    0    thickness    0.12
    Preset Chip Should Be Stored    roof-slab    roof-slab    ${s1}    0.15    1    rows    0    spacing    0.15

Deleting Roof Slab Panels Down To The Empty State
    Open Level    roof-slab
    Add And Fill Cards    rows    2    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน    Fill Minimal Slab Card
    Delete Card    ${CARD_ROWS_0}
    Card Count Should Be    1
    Level Totals Should Match Engine    roof-slab
    Delete Card    ${CARD_ROWS_0}
    Wait For Elements State    text=ยังไม่มีพื้นดาดฟ้า    visible    timeout=10s
    Level Total Should Be    0

Roof Slab Values And Mark Survive A Reload
    Open Level    roof-slab
    Fill Roof Slab From Plan
    Confirm Level    stair
    Go To Level    roof-slab
    Reload Level
    Level Totals Should Match Engine    roof-slab
    Level Mark Should Be    roof-slab    done
    Card Number Should Show    ${CARD_ROWS_0}    ${L}    4.00

Roof Slab Previous Arrow Returns To The Roof Beam
    Open Level    roof-slab
    Previous Arrow Should Go To    roof-beam    คานดาดฟ้า / คานหลังคา

Roof Slab Is Locked Until The Roof Beam Is Done
    [Tags]    negative
    Level Should Be Locked    roof-slab    roof-beam    คานดาดฟ้า / คานหลังคา

# ═══════════════════════════ 17 บันได (stair, optional) ═══════════════════════════
Stair Starts Empty With A Zero Total
    Open Level    stair
    Level Total Should Be    0
    Level Totals Should Match Engine    stair
    Get Text    css=body    contains    ยังไม่มีบันได

Stair Can Be Confirmed With Nothing Because No Value Is Required
    Open Level    stair
    Confirm Level    column-plates
    Level Mark Should Be    stair    done

Stair Filled From The Plan Matches The Engine And Confirms
    [Documentation]    12 steps, riser 0.17, tread 0.25, width 1 m: the total rise 2.04 m and run 3.00 m are derived.
    Open Level    stair
    Fill Stair From Plan
    Card Number Should Show    ${CARD_ROWS_0}    สูงรวม (ม.)    2.04
    Card Number Should Show    ${CARD_ROWS_0}    ยาวแนวราบ (ม.)    3.00
    Level Totals Should Match Engine    stair
    Confirm Level    column-plates
    Level Mark Should Be    stair    done

Stair With Steps But No Width Is Blocked Until The Width Is Filled
    [Tags]    negative
    Open Level    stair
    ${st}=    Ensure Card    rows    0    เพิ่มบันไดชุดแรก    เพิ่มบันไดอีกชุด
    Fill Card Number    ${st}    จำนวนขั้น (ขั้น)    12
    Confirm Level Should Be Blocked    stair    1
    Missing Summary Should Mention    บันไดข้างบ้าน — ความกว้างบันได
    Fill Card Number    ${st}    ความกว้างบันได (ม.)    1
    Missing Summary Should Be Gone
    Confirm Level    column-plates

Stair With A Width But No Steps Is Blocked Until The Steps Are Filled
    [Tags]    negative
    Open Level    stair
    ${st}=    Ensure Card    rows    0    เพิ่มบันไดชุดแรก    เพิ่มบันไดอีกชุด
    Fill Card Number    ${st}    ความกว้างบันได (ม.)    1
    Confirm Level Should Be Blocked    stair    1
    Missing Summary Should Mention    บันไดข้างบ้าน — จำนวนขั้น

Stair Rise And Run Follow The Step Count Until Typed By Hand
    [Documentation]    Changing the steps moves the derived rise and run (steps x riser, steps x tread).
    Open Level    stair
    ${st}=    Ensure Card    rows    0    เพิ่มบันไดชุดแรก    เพิ่มบันไดอีกชุด
    Fill Card Number    ${st}    จำนวนขั้น (ขั้น)    12
    Fill Card Number    ${st}    ลูกตั้ง สูง (ม.)    0.17
    Fill Card Number    ${st}    ลูกนอน กว้าง (ม.)    0.25
    Card Number Should Show    ${st}    สูงรวม (ม.)    2.04
    Fill Card Number    ${st}    จำนวนขั้น (ขั้น)    10
    Card Number Should Show    ${st}    สูงรวม (ม.)    1.70
    Card Number Should Show    ${st}    ยาวแนวราบ (ม.)    2.50
    Fill Card Number    ${st}    สูงรวม (ม.)    3
    Fill Card Number    ${st}    จำนวนขั้น (ขั้น)    11
    Card Number Should Show    ${st}    สูงรวม (ม.)    3.00
    Level Totals Should Match Engine    stair

Stair Steps Edge Value Is Handled
    [Tags]    edge
    [Template]    Stair Steps Edge
    0    0
    1,250.5    1250.5
    =2.5*4    10
    -3    -3
    abc    KEEP
    ${EMPTY}    0

Every Stair Waist Main Bar Size Can Be Chosen
    Open Level    stair
    ${st}=    Ensure Card    rows    0    เพิ่มบันไดชุดแรก    เพิ่มบันไดอีกชุด
    Fill Minimal Stair Card    ${st}
    Every Option Can Be Chosen    stair    stair    ${st}    ท้องบันได เหล็กหลัก ขนาดเหล็ก    ${BAR_5}    rows    0    waistMainSize

Every Other Stair Bar Group Can Be Chosen
    [Documentation]    Waist cross bars, step main bars and step cross bars: every size, each group.
    Open Level    stair
    ${st}=    Ensure Card    rows    0    เพิ่มบันไดชุดแรก    เพิ่มบันไดอีกชุด
    Fill Minimal Stair Card    ${st}
    Every Option Can Be Chosen    stair    stair    ${st}    ท้องบันได เหล็กกันร้าว ขนาดเหล็ก    ${BAR_5}    rows    0    waistTempSize
    Every Option Can Be Chosen    stair    stair    ${st}    ลูกบันได เหล็กหลัก ขนาดเหล็ก    ${BAR_5}    rows    0    stepMainSize
    Every Option Can Be Chosen    stair    stair    ${st}    ลูกบันได เหล็กกันร้าว ขนาดเหล็ก    ${BAR_5}    rows    0    stepTempSize

Stair Names Can Be Chosen
    Open Level    stair
    ${st}=    Ensure Card    rows    0    เพิ่มบันไดชุดแรก    เพิ่มบันไดอีกชุด
    VAR    @{names}    บันไดข้างบ้าน    บันไดหน้าบ้าน    บันไดหลังบ้าน
    Every Option Can Be Chosen    stair    stair    ${st}    ชื่อบันได    ${names}    rows    0    name

Stair Waist Spacing Chip Fills The Spacing
    [Tags]    edge
    Open Level    stair
    ${st}=    Ensure Card    rows    0    เพิ่มบันไดชุดแรก    เพิ่มบันไดอีกชุด
    Fill Minimal Stair Card    ${st}
    Preset Chip Should Be Stored    stair    stair    ${st}    0.20    0    rows    0    waistMainSpacing    0.2

Optional Stair Can Be Skipped And The Skip Undone
    Open Level    stair
    Fill Stair From Plan
    Skip Then Undo Keeps Amounts Exact    stair    column-plates

Two Stairs Can Be Added And Deleted Down To The Empty State
    Open Level    stair
    Add And Fill Cards    rows    2    เพิ่มบันไดชุดแรก    เพิ่มบันไดอีกชุด    Fill Minimal Stair Card
    Level Totals Should Match Engine    stair
    Delete Card    ${CARD_ROWS_0}
    Card Count Should Be    1
    Level Totals Should Match Engine    stair
    Delete Card    ${CARD_ROWS_0}
    Wait For Elements State    text=ยังไม่มีบันได    visible    timeout=10s
    Level Total Should Be    0

Stair Values And Mark Survive A Reload
    Open Level    stair
    Fill Stair From Plan
    Confirm Level    column-plates
    Go To Level    stair
    Reload Level
    Level Totals Should Match Engine    stair
    Level Mark Should Be    stair    done
    Card Number Should Show    ${CARD_ROWS_0}    จำนวนขั้น (ขั้น)    12

Stair Previous Arrow Returns To The Roof Slab
    Open Level    stair
    Previous Arrow Should Go To    roof-slab    พื้นดาดฟ้า

Stair Is Locked Until The Roof Slab Is Decided
    [Tags]    negative
    Level Should Be Locked    stair    roof-slab    พื้นดาดฟ้า

# ═══════════════════════════ 18 เพลทหัวเสา (column-plates, BOQ rows) ═══════════════════════════
Column Plates Start With A Zero Total
    Open Level    column-plates
    Level Total Should Be    0
    Level Totals Should Match Engine    column-plates
    Get Text    css=body    contains    เหล็กเพลทสี่เหลี่ยม

Column Plates Can Be Confirmed With Nothing Because Zero Is Valid
    [Documentation]    REQUIRED_FIELDS: no requirement, 0 is valid (a concrete roof has no plates).
    Open Level    column-plates
    Confirm Level    roofing
    Level Mark Should Be    column-plates    done

Column Plates Filled From The Plan Match The Engine And Confirm
    Open Level    column-plates
    Fill Column Plates From Plan
    ${expected}=    Level Totals Should Match Engine    column-plates
    ${lvl}=    Expected Level    ${expected}    column-plates
    Should Be True    ${lvl}[total] > 0
    Confirm Level    roofing
    Level Mark Should Be    column-plates    done

Column Plates Typed As Zero Are Valid And Cost Nothing
    [Tags]    edge
    Open Level    column-plates
    Fill Column Plates From Plan
    Fill Number By Label    ${PLATE_LABEL}    0
    Fill Number By Label    ${GROUT_LABEL}    0
    Level Total Should Be    0
    Level Totals Should Match Engine    column-plates
    Confirm Level    roofing

Column Plate Quantity Edge Value Is Handled
    [Tags]    edge
    [Template]    Plate Quantity Edge
    1,250.5
    =2.5*4
    9.5+7+2
    -3
    abc
    ${EMPTY}
    1000000
    1/0

Column Plates Offer To Use The Column Count
    [Documentation]    With columns on the column level the page says how many and offers one click to fill every row.
    ...    The sample house has columns; typing 5 plates shows the button, pressing it sets every row to that count.
    Open Level    column-plates    sample
    Fill Number By Label    ${PLATE_LABEL}    5
    Fill Number By Label    ${GROUT_LABEL}    5
    ${hint}=    Get Text    css=div:has-text("เสาที่กรอกไว้") >> nth=-1
    ${columns}=    Evaluate    str(int(re.search(r'เสาที่กรอกไว้ ([0-9,]+) ต้น', $hint).group(1).replace(',', '')))    modules=re
    Click    css=button:has-text("ทุกรายการ")
    Get Property    css=[aria-label="${PLATE_LABEL}"]    value    ==    ${columns}
    Get Property    css=[aria-label="${GROUT_LABEL}"]    value    ==    ${columns}
    Level Totals Should Match Engine    column-plates

Column Plates Values And Mark Survive A Reload
    Open Level    column-plates
    Fill Column Plates From Plan
    Confirm Level    roofing
    Go To Level    column-plates
    Reload Level
    Level Totals Should Match Engine    column-plates
    Level Mark Should Be    column-plates    done
    Get Property    css=[aria-label="${PLATE_LABEL}"]    value    ==    6

Column Plates Previous Arrow Returns To The Stair
    Open Level    column-plates
    Previous Arrow Should Go To    stair    บันได

Column Plates Are Locked Until The Stair Is Decided
    [Tags]    negative
    Level Should Be Locked    column-plates    stair    บันได


*** Keywords ***
Card Count Should Be Zero
    Get Element Count    css=[data-req-card]    ==    0

Card Count Should Be
    [Arguments]    ${count}
    Get Element Count    css=[data-req-card]    ==    ${count}

Missing Count Should Be
    [Arguments]    ${count}
    Get Text    ${MISSING_SUMMARY}    contains    ยังต้องกรอก ${count} รายการ

Slab Width Edge
    [Arguments]    ${typed}    ${expected}
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    Edge Value Should Be Handled    slab-on-grade    slab-on-grade    ${s1}    ${W}    ${typed}    slabs    0    width    ${expected}

Slab Thickness Chip
    [Arguments]    ${chip}    ${value}
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    Preset Chip Should Be Stored    slab-on-grade    slab-on-grade    ${s1}    ${chip}    0    slabs    0    thickness    ${value}

Slab Spacing Chip
    [Arguments]    ${chip}    ${value}
    Open Level    slab-on-grade
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    Preset Chip Should Be Stored    slab-on-grade    slab-on-grade    ${s1}    ${chip}    1    slabs    0    spacing    ${value}

Precast Width Edge
    [Arguments]    ${typed}    ${expected}
    Open Level    precast-slab
    ${p1}=    Ensure Card    panels    0    เพิ่มช่วงแรก    เพิ่มช่วงถัดไป
    Fill Minimal Precast Card    ${p1}
    Edge Value Should Be Handled    precast-slab    precast-slab    ${p1}    ความกว้างช่วง (ม.)    ${typed}    panels    0    width    ${expected}

Column Count Edge
    [Arguments]    ${typed}    ${expected}
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Fill Minimal Column Card    ${c1}
    Edge Value Should Be Handled    column    column    ${c1}    จำนวนต้น (ต้น)    ${typed}    columns    0    count    ${expected}

Column Stirrup Chip
    [Arguments]    ${chip}    ${value}
    Open Level    column
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Fill Minimal Column Card    ${c1}
    Preset Chip Should Be Stored    column    column    ${c1}    ${chip}    0    columns    0    stirrupSpacing    ${value}

Roof Beam Length Edge
    [Arguments]    ${typed}    ${expected}
    Open Level    roof-beam
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Fill Minimal Roof Beam Card    ${b1}
    Edge Value Should Be Handled    roof-beam    roof-beam    ${b1}    ความยาวรวม (ม.)    ${typed}    rows    0    length    ${expected}

Roof Beam Stirrup Chip
    [Arguments]    ${chip}    ${value}
    Open Level    roof-beam
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Fill Minimal Roof Beam Card    ${b1}
    Preset Chip Should Be Stored    roof-beam    roof-beam    ${b1}    ${chip}    0    rows    0    stirrupSpacing    ${value}

Roof Slab Width Edge
    [Arguments]    ${typed}    ${expected}
    Open Level    roof-slab
    ${s1}=    Ensure Card    rows    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Fill Minimal Slab Card    ${s1}
    Edge Value Should Be Handled    roof-slab    roof-slab    ${s1}    ${W}    ${typed}    rows    0    width    ${expected}

Stair Steps Edge
    [Arguments]    ${typed}    ${expected}
    Open Level    stair
    ${st}=    Ensure Card    rows    0    เพิ่มบันไดชุดแรก    เพิ่มบันไดอีกชุด
    Fill Minimal Stair Card    ${st}
    Edge Value Should Be Handled    stair    stair    ${st}    จำนวนขั้น (ขั้น)    ${typed}    rows    0    steps    ${expected}

Plate Quantity Edge
    [Documentation]    Type into the steel-plate quantity: totals equal the engine, no NaN / Infinity; a number is saved
    ...    as the quantity override, text and 1/0 leave it untouched.
    [Arguments]    ${typed}
    Open Level    column-plates
    Fill Number By Label    ${PLATE_LABEL}    ${typed}
    ${project}=    Read Guest Project
    ${qty}=    Evaluate    $project.get('boqOverrides', {}).get('R148', {}).get('qty')
    IF    '${typed}' in ['abc', '1/0']
        Should Be Equal    ${qty}    ${None}    msg=Typed "${typed}": the plate quantity must stay untouched
    END
    Level Totals Should Match Engine    column-plates
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number

Skip Then Undo Keeps Amounts Exact
    [Documentation]    On an optional level that is filled: skip it (the next level opens, the level's mark is skipped),
    ...    the construction total falls by exactly the level's amount and equals the engine; the level shows 0;
    ...    "กลับไปกรอกข้อมูล" restores the amount and the construction total.
    [Arguments]    ${level_id}    ${next_id}
    ${before}=    Level Totals Should Match Engine    ${level_id}
    ${lvl}=    Expected Level    ${before}    ${level_id}
    VAR    ${amount}    ${lvl}[total]
    Should Be True    ${amount} > 0
    VAR    ${total_before}    ${before}[constructionTotal]
    ${without}=    Evaluate    ${total_before} - ${amount}
    Skip Level
    Wait For Condition    Url    should end with    /journey/${next_id}    timeout=30s
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    Level Mark Should Be    ${level_id}    skipped
    Construction Total Should Be    ${without}    1
    ${after}=    Expected For Current Guest Project
    Numbers Should Be Close    ${after}[constructionTotal]    ${without}    1
    Go To Level    ${level_id}
    Level Total Should Be    0
    Get Text    css=body    contains    ไม่มีในโครงการนี้
    Unskip Level
    Level Mark Should Be    ${level_id}    ${None}
    ${restored}=    Level Totals Should Match Engine    ${level_id}
    Level Total Should Be    ${amount}
    Numbers Should Be Close    ${restored}[constructionTotal]    ${total_before}    1
