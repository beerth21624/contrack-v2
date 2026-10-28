*** Settings ***
Documentation       W2a (2/2): journey levels 8-11 "ฐานราก": piles (optional), footing, pedestal, ground-beam.
...                 Per level: blank project, fill from plan and confirm, required values and half-filled cards,
...                 edge inputs (0, comma decimal, formulas, negative, letters, clear, huge), add / duplicate / delete
...                 cards down to the empty state, many cards, optional skip / unskip, reload persistence,
...                 navigation, and cross-level data (pedestal reads the footing names and counts, piles feed the
...                 pile head cutting of the footing level, layout is independent of piles).
...                 Expected totals always come from the engine (``Level Totals Should Match Engine``).
Resource            ../../resources/pages/levels_prepare_foundation.resource
Suite Setup         Prepare Suite
Test Teardown       Close Context
Test Tags           journey    levels-foundation


*** Test Cases ***
# ───────────────────────── Level 8: piles (เสาเข็ม, optional) ─────────────────────────
Blank Piles Are Zero With A Hint What To Fill
    Open Level    piles
    Level Total Should Be    0
    Get Text    body    contains    เลือกชนิดเสาเข็ม หน้าตัด ความยาว และใส่จำนวนต้น
    Level Totals Should Match Engine Eventually    piles

Blank Piles Confirm Without Any Entry
    [Documentation]    REQUIRED_FIELDS: an untouched pile form is ignored.
    Open Level    piles
    Confirm Level And Land On    piles    footing

Piles From Plan Match The Engine And Are Confirmed
    [Tags]    smoke
    Open Level    piles
    Fill Piles From Plan
    Wait Until Keyword Succeeds    10s    300ms    Positive Level Total On Screen
    Level Totals Should Match Engine Eventually    piles
    Get Text    body    contains    ค่าตัดหัวเสาเข็ม 12 ต้น
    Confirm Level And Land On    piles    footing

Pile Type Alone Lists Section Length And Count As Missing
    [Documentation]    REQUIRED_FIELDS: once one pile value is typed, type, section, length and count are all required.
    [Tags]    negative
    Open Level    piles
    Choose Pile Type    เสาเข็มเจาะ
    Confirm Should Be Blocked With    piles    3    หน้าตัด/รูปทรง
    Get Text    ${MISSING_ALERT}    contains    ความยาว
    Get Text    ${MISSING_ALERT}    contains    จำนวนต้น
    Choose Pile Section    กลม Ø 30 ซม.
    Fill Number By Label    ความยาวต่อต้น (ม.)    18
    Confirm Level Should Be Blocked    piles    1
    Fill Number By Label    จำนวนเสาเข็มทั้งหมด    12
    Level Totals Should Match Engine Eventually    piles
    Confirm Level And Land On    piles    footing

Pile Count Alone Lists Type Section And Length As Missing
    [Tags]    negative
    Open Level    piles
    Fill Number By Label    จำนวนเสาเข็มทั้งหมด    12
    Confirm Should Be Blocked With    piles    3    ชนิดเสาเข็ม
    Get Text    ${MISSING_ALERT}    contains    หน้าตัด/รูปทรง
    Get Text    ${MISSING_ALERT}    contains    ความยาว

Every Pile Type Can Be Chosen
    Open Level    piles
    FOR    ${type}    IN    เสาเข็มตอก    เสาเข็มเจาะ    เสาเข็มไมโครไพล์    เสาเข็มสปัน
        Choose Pile Type    ${type}
        Get Attribute    css=[role="radiogroup"][aria-label="ชนิดเสาเข็ม"] >> text="${type}"    aria-checked    ==    true
    END
    Level Totals Should Match Engine Eventually    piles

Pile Section From Each Group Appears In The Bill Note
    Open Level    piles
    Fill Piles From Plan
    Choose Pile Section    กลม Ø 30 ซม.
    Get Text    body    contains    กลม Ø 30 ซม.
    Choose Pile Section    สี่เหลี่ยม 22 x 22
    Get Text    body    contains    สี่เหลี่ยม 22 x 22
    Level Totals Should Match Engine Eventually    piles

Pile Length Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Test    piles    ความยาวต่อต้น (ม.)    0    Fill Piles From Plan
    [Template]    Edge Case
    0                 ${EMPTY}
    1,250.5           1,250.50
    =2.5*4            10.00
    9.5+7+2           18.50
    2x3               6.00
    -3                -3.00
    abc               5.00
    1/0               5.00
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999.00

Pile Count Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Test    piles    จำนวนเสาเข็มทั้งหมด    0    Fill Piles From Plan
    [Template]    Edge Case
    0                 ${EMPTY}
    =2*8              16
    7+9               16
    -3                -3
    abc               5
    1/0               5
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999

Price Per Pile In The Folded Section Changes The Total
    Open Level    piles
    Fill Piles From Plan
    Level Totals Should Match Engine Eventually    piles
    Click    css=button:has-text("ราคาและค่าตั้งต้น")
    ${before}=    Level Total On Screen
    Fill Number By Label    ราคาเหมาต่อต้น (ค่าเสาเข็ม + ค่าตอก)    3000
    Wait Until Keyword Succeeds    10s    300ms    Level Total Should Exceed    ${before}
    Level Totals Should Match Engine Eventually    piles

Skipping Piles Zeroes Its Money And Drops The Construction Total
    [Tags]    skip
    Open Level    piles
    Fill Piles From Plan
    ${level}=    Wait Until Keyword Succeeds    10s    300ms    Positive Level Total On Screen
    ${before}=    Construction Total On Screen
    Skip Level Through Popconfirm Should Land On    piles    footing
    Level Totals Should Match Engine Eventually    footing
    ${after}=    Construction Total On Screen
    ${drop}=    Evaluate    ${before} - ${after}
    Should Be True    ${drop} > 0    Construction total did not drop after skipping (${before} -> ${after})
    Go To Level    piles
    Level Total Should Be Eventually    0
    Level Totals Should Match Engine Eventually    piles

Unskipping Piles Restores The Values
    [Tags]    skip
    Open Level    piles
    Fill Piles From Plan
    ${level}=    Wait Until Keyword Succeeds    10s    300ms    Positive Level Total On Screen
    Skip Level Through Popconfirm Should Land On    piles    footing
    Go To Level    piles
    Unskip Level
    Wait For Elements State    ${UNSKIP_BUTTON}    detached
    Input Should Show    จำนวนเสาเข็มทั้งหมด    12
    Get Attribute    css=[role="radiogroup"][aria-label="ชนิดเสาเข็ม"] >> text="เสาเข็มตอก"    aria-checked    ==    true
    Level Total Should Be Eventually    ${level}
    Level Totals Should Match Engine Eventually    piles

Piles Count Does Not Change The Layout Lump Sum
    [Documentation]    Cross-level: layout stakes "ปกติเท่ากับจำนวนเสาเข็ม" is a hint only; filling the piles leaves
    ...    the layout level at its own total (engine) and the stakes untouched.
    Open Level    piles
    Fill Piles From Plan
    Level Totals Should Match Engine Eventually    piles
    Go To Level    layout
    Level Total Should Be    5500
    Input Should Show    จำนวนหมุด    ${EMPTY}
    Level Totals Should Match Engine Eventually    layout

Piles Add Pile Head Cutting To The Footing Level
    [Documentation]    Cross-level: "ค่าตัดหัวเสาเข็ม N ต้น คิดให้อัตโนมัติในขั้นตอนฐานราก": the footing level total grows
    ...    once piles are filled (and equals the engine).
    Open Level    footing
    ${without}=    Level Total On Screen
    Close Context
    Open Level    piles
    Fill Piles From Plan
    Confirm Level And Land On    piles    footing
    Wait For Elements State    ${MAP_BUTTON}    visible    timeout=60s
    ${with}=    Wait Until Keyword Succeeds    10s    300ms    Positive Level Total On Screen
    Should Be True    ${with} > ${without}    Footing total ${with} did not grow over ${without} after 12 piles
    Level Totals Should Match Engine Eventually    footing

Piles Values And Mark Survive A Reload
    Open Level    piles
    Fill Piles From Plan
    Confirm Level And Land On    piles    footing
    Go To Level    piles
    Reload Level Page
    Input Should Show    ความยาวต่อต้น (ม.)    12.00
    Input Should Show    จำนวนเสาเข็มทั้งหมด    12
    Input Should Show    รายละเอียดเพิ่มเติม (ถ้ามี)    รับน้ำหนัก 15 ตัน/ต้น
    Level Mark Should Become    piles    done
    Level Totals Should Match Engine Eventually    piles

Reset Returns Piles To Empty
    Open Level    piles
    Fill Piles From Plan
    Level Totals Should Match Engine Eventually    piles
    Reset Level To Default
    Level Total Should Be Eventually    0
    Input Should Show    จำนวนเสาเข็มทั้งหมด    ${EMPTY}
    Get Attribute    css=[role="radiogroup"][aria-label="ชนิดเสาเข็ม"] >> text="เสาเข็มตอก"    aria-checked    ==    false

Piles Navigation Goes Back Opens The Map And Locks The Next Level
    [Tags]    navigation
    Open Level    piles
    Locked Level Should Wait For Previous    footing    ฐานราก
    Go To Level    piles
    Previous Arrow Should Lead To    layout
    Map Button Should Open Overview

# ───────────────────────── Level 9: footing (ฐานราก) ─────────────────────────
Blank Footing Is Blocked Because At Least One Footing Is Required
    [Documentation]    REQUIRED_FIELDS: ≥ 1 footing. Empty list shows the empty state and "เพิ่มฐานราก F1".
    [Tags]    negative
    Open Level    footing
    Get Text    body    contains    ยังไม่มีฐานราก
    Wait For Elements State    css=button:has-text("เพิ่มฐานราก F1")    visible
    Level Totals Should Match Engine Eventually    footing
    Confirm Should Be Blocked With    footing    1    เพิ่มฐานรากอย่างน้อย 1 รายการ

An Added Footing Card Without Values Does Not Count As A Footing
    [Tags]    negative
    Open Level    footing
    Click    css=button:has-text("เพิ่มฐานราก F1")
    Wait For Elements State    css=[data-req-card="rows#0"]    visible
    Input Should Show    ชื่อฐาน    F1
    Confirm Should Be Blocked With    footing    1    เพิ่มฐานรากอย่างน้อย 1 รายการ

Half Filled Footing Lists The Missing Values Until They Are Typed
    [Documentation]    A footing with only a width: count, length, thickness and pit depth are missing (4).
    [Tags]    negative
    Open Level    footing
    Click    css=button:has-text("เพิ่มฐานราก F1")
    Fill Card Number    rows    0    ความกว้าง (ม.)    1.2
    Confirm Should Be Blocked With    footing    4    ฐานราก F1 — จำนวนฐานแบบนี้
    Get Text    css=[data-req-card="rows#0"]    contains    ยังขาด
    Fill Card Number    rows    0    จำนวนฐานแบบนี้ (ฐาน)    8
    Confirm Level Should Be Blocked    footing    3
    Fill Card Number    rows    0    ความยาว (ม.)    1.2
    Fill Card Number    rows    0    ความหนาฐาน (ม.)    0.3
    Confirm Level Should Be Blocked    footing    1
    Fill Card Number    rows    0    ความลึกหลุมขุด (ม.)    1.5
    Level Totals Should Match Engine Eventually    footing
    Confirm Level And Land On    footing    pedestal

Missing Count Alone Blocks A Footing That Has Every Size
    [Tags]    negative
    Open Level    footing
    Click    css=button:has-text("เพิ่มฐานราก F1")
    Fill Card Number    rows    0    ความกว้าง (ม.)    1
    Fill Card Number    rows    0    ความยาว (ม.)    1
    Fill Card Number    rows    0    ความหนาฐาน (ม.)    0.3
    Fill Card Number    rows    0    ความลึกหลุมขุด (ม.)    1.3
    Confirm Should Be Blocked With    footing    1    ฐานราก F1 — จำนวนฐานแบบนี้

Footing From Plan Matches The Engine And Is Confirmed
    [Tags]    smoke
    Open Level    footing
    Fill Footing From Plan
    Card Count Should Be    rows    2
    Level Totals Should Match Engine Eventually    footing
    Get Text    body    contains    คอนกรีตฐานราก
    Confirm Level And Land On    footing    pedestal

Footing Without Bars Still Confirms Because Bars Are Optional
    [Documentation]    Bar sizes and counts are not required (standard sizes pre-chosen).
    Open Level    footing
    Click    css=button:has-text("เพิ่มฐานราก F1")
    Fill Card Number    rows    0    จำนวนฐานแบบนี้ (ฐาน)    12
    Fill Card Number    rows    0    ความกว้าง (ม.)    1
    Fill Card Number    rows    0    ความยาว (ม.)    1
    Fill Card Number    rows    0    ความหนาฐาน (ม.)    0.3
    Fill Card Number    rows    0    ความลึกหลุมขุด (ม.)    1.3
    Level Totals Should Match Engine Eventually    footing
    Confirm Level And Land On    footing    pedestal

Footing Types Get The Next Free Names And The Button Follows
    Open Level    footing
    Click    css=button:has-text("เพิ่มฐานราก F1")
    Wait For Elements State    css=button:has-text("เพิ่มฐานราก F2")    visible
    Click    css=button:has-text("เพิ่มฐานราก F2")
    Wait For Elements State    css=button:has-text("เพิ่มฐานราก F4")    visible
    Click    css=button:has-text("เพิ่มฐานราก F4")
    Card Count Should Be    rows    3
    Input Should Show    ชื่อฐาน    F1    0
    Input Should Show    ชื่อฐาน    F2    1
    Input Should Show    ชื่อฐาน    F4    2

Footing Width Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Card Test    footing    rows    0    ความกว้าง (ม.)    Fill Footing From Plan
    [Template]    Edge Card Case
    0                 ${EMPTY}
    1,250.5           1,250.50
    =2.5*4            10.00
    0.5+0.7           1.20
    (4+2)*0.9         5.40
    2x3               6.00
    -3                -3.00
    abc               5.00
    1/0               5.00
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999.00

Footing Count Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Card Test    footing    rows    0    จำนวนฐานแบบนี้ (ฐาน)    Fill Footing From Plan
    [Template]    Edge Card Case
    0                 ${EMPTY}
    =2*8              16
    7+9               16
    -3                -3
    abc               5
    1/0               5
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999

Footing Bar Count Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Card Test    footing    rows    1    เหล็กแนวด้านสั้น (เส้น)    Fill Footing From Plan
    [Template]    Edge Card Case
    0                 ${EMPTY}
    =2*3              6
    -3                -3
    abc               5
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999

A Pit Shallower Than The Footing Shows A Warning
    [Documentation]    Pit 0.20 m under a 0.60 m footing digs a negative volume: the page asks to check the depth.
    [Tags]    edge
    Open Level    footing
    Click    css=button:has-text("เพิ่มฐานราก F1")
    Fill Card Number    rows    0    จำนวนฐานแบบนี้ (ฐาน)    1
    Fill Card Number    rows    0    ความกว้าง (ม.)    1
    Fill Card Number    rows    0    ความยาว (ม.)    1
    Fill Card Number    rows    0    ความหนาฐาน (ม.)    0.6
    Fill Card Number    rows    0    ความลึกหลุมขุด (ม.)    0.2
    Get Text    css=[data-req-card="rows#0"]    contains    หลุมขุดตื้นกว่าฐานราก
    Level Totals Should Match Engine Eventually    footing

Sand And Lean Thickness In The Folded Section Change The Total
    Open Level    footing
    Fill Footing From Plan
    Level Totals Should Match Engine Eventually    footing
    Click    css=button:has-text("ค่าตั้งต้น")
    Fill Number By Label    ทรายหยาบ หนา (ม.)    0.1    0
    Fill Number By Label    คอนกรีตหยาบ หนา (ม.)    0.08    1
    Level Totals Should Match Engine Eventually    footing

Deleting A Filled Footing Asks First And Updates The Totals
    Open Level    footing
    Fill Footing From Plan
    Level Totals Should Match Engine Eventually    footing
    Delete Card    rows    1
    Card Count Should Be    rows    1
    Level Totals Should Match Engine Eventually    footing
    Confirm Level And Land On    footing    pedestal

Cancelling The Delete Popconfirm Keeps The Footing
    [Tags]    negative
    Open Level    footing
    Fill Footing From Plan
    Click    css=[data-req-card="rows#0"] button[aria-label="ลบ"]
    Click    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button >> text="ยกเลิก"
    Card Count Should Be    rows    2
    Level Totals Should Match Engine Eventually    footing

Deleting The Last Footing Brings Back The Empty State
    Open Level    footing
    Fill Footing From Plan
    Delete Card    rows    1
    Delete Card    rows    0
    Card Count Should Be    rows    0
    Get Text    body    contains    ยังไม่มีฐานราก
    Wait For Elements State    css=button:has-text("เพิ่มฐานราก F1")    visible
    Level Total Should Be Eventually    0
    Level Totals Should Match Engine Eventually    footing
    Confirm Should Be Blocked With    footing    1    เพิ่มฐานรากอย่างน้อย 1 รายการ

An Untouched Footing Card Is Deleted Without Asking
    Open Level    footing
    Click    css=button:has-text("เพิ่มฐานราก F1")
    Delete Card    rows    0    asks=${False}
    Card Count Should Be    rows    0

A Duplicated Footing Has No Count Until It Is Typed
    [Documentation]    "ทำซ้ำ" copies the sizes and bars but not the count: the copy blocks confirm until counted.
    [Tags]    negative
    Open Level    footing
    Fill Footing From Plan
    Duplicate Card    rows    0
    Wait For Elements State    css=[data-req-card="rows#2"]    visible
    Card Input Should Show    rows    2    ความกว้าง (ม.)    1.20
    Card Input Should Show    rows    2    จำนวนฐานแบบนี้ (ฐาน)    ${EMPTY}
    Confirm Should Be Blocked With    footing    1    จำนวนฐานแบบนี้
    Fill Card Number    rows    2    จำนวนฐานแบบนี้ (ฐาน)    2
    Level Totals Should Match Engine Eventually    footing
    Confirm Level And Land On    footing    pedestal

Fifteen Footing Types Are All Counted
    [Documentation]    F1 filled from plan, duplicated 14 times, each copy counted 1.
    [Tags]    slow
    Open Level    footing
    Click    css=button:has-text("เพิ่มฐานราก F1")
    Fill Footing Card    0    8    1.2    1.2    0.3    1.5    6
    FOR    ${i}    IN RANGE    1    15
        Duplicate Card    rows    0
        Wait For Elements State    css=[data-req-card="rows#${i}"]    visible
        Fill Card Number    rows    ${i}    จำนวนฐานแบบนี้ (ฐาน)    1
    END
    Card Count Should Be    rows    15
    Level Totals Should Match Engine Eventually    footing
    Confirm Level And Land On    footing    pedestal

Footing Reset Returns To The Empty List
    Open Level    footing
    Fill Footing From Plan
    Level Totals Should Match Engine Eventually    footing
    Reset Level To Default
    Card Count Should Be    rows    0
    Level Totals Should Match Engine Eventually    footing

Footing Values Survive A Reload And The Level Stays Done
    Open Level    footing
    Fill Footing From Plan
    Confirm Level And Land On    footing    pedestal
    Go To Level    footing
    Reload Level Page
    Card Count Should Be    rows    2
    Card Input Should Show    rows    0    จำนวนฐานแบบนี้ (ฐาน)    8
    Card Input Should Show    rows    1    ความลึกหลุมขุด (ม.)    1.30
    Level Mark Should Become    footing    done
    Level Totals Should Match Engine Eventually    footing

Footing Navigation Goes Back Opens The Map And Locks The Next Level
    [Tags]    navigation
    Open Level    footing
    Locked Level Should Wait For Previous    pedestal    เสาตอม่อ
    Go To Level    footing
    Previous Arrow Should Lead To    piles
    Map Button Should Open Overview

# ───────────────────────── Level 10: pedestal (เสาตอม่อ) ─────────────────────────
Blank Pedestal Without Footings Points Back To The Footing Level
    Open Level    pedestal
    Get Text    body    contains    ยังไม่มีฐานราก
    Level Total Should Be    0
    Level Totals Should Match Engine Eventually    pedestal
    Click    css=button:has-text("ไปที่ขั้นตอนฐานราก")
    Wait For Condition    Url    should end with    /journey/footing    timeout=90s

Blank Pedestal Confirms Because No Row Means Nothing Is Required
    [Documentation]    REQUIRED_FIELDS: pedestal has no "at least one" rule, each existing type must be complete.
    Open Level    pedestal
    Confirm Level And Land On    pedestal    ground-beam

Pedestals Are Offered For Every Footing Type With Its Count
    [Documentation]    Cross-level: pedestal reads the footing names and counts (F1 x8, F2 x4).
    Open Pedestal With Footings From Plan
    Get Text    body    contains    ปกติฐานรากแต่ละแบบมีเสาตอม่อ 1 แบบ (F1, F2)
    Click    css=button:has-text("เพิ่มเสาตอม่อ")
    Card Count Should Be    rows    2
    Card Input Should Show    rows    0    จำนวนต้น (ต้น)    8
    Card Input Should Show    rows    1    จำนวนต้น (ต้น)    4
    Footing Choice Should Be    0    F1
    Footing Choice Should Be    1    F2
    Input Should Show    ชื่อเสาตอม่อ    C1    0
    Input Should Show    ชื่อเสาตอม่อ    C2    1

Pedestal From Plan Matches The Engine And Is Confirmed
    [Tags]    smoke
    Open Pedestal With Footings From Plan
    Fill Pedestal From Plan
    Level Totals Should Match Engine Eventually    pedestal
    Get Text    body    contains    คอนกรีตเสาตอม่อ
    Confirm Level And Land On    pedestal    ground-beam

Pedestal With Only A Width Lists Length And Height As Missing
    [Documentation]    The count comes from the footing, so only length and height are missing (2).
    [Tags]    negative
    Open Pedestal With Footings From Plan
    Click    css=button:has-text("เพิ่มเสาตอม่อ")
    Fill Card Number    rows    0    ความกว้าง (ม.)    0.25
    Confirm Should Be Blocked With    pedestal    2    เสาตอม่อ C1 — ความยาว
    Get Text    ${MISSING_ALERT}    contains    ความสูง
    Fill Card Number    rows    0    ความยาว (ม.)    0.25
    Confirm Level Should Be Blocked    pedestal    1
    Fill Card Number    rows    0    ความสูง (ม.)    0.8
    Level Totals Should Match Engine Eventually    pedestal
    Confirm Level And Land On    pedestal    ground-beam

Clearing The Pedestal Count Blocks Confirm
    [Tags]    negative
    Open Pedestal With Footings From Plan
    Fill Pedestal From Plan
    Fill Card Number    rows    1    จำนวนต้น (ต้น)    ${EMPTY}
    Confirm Should Be Blocked With    pedestal    1    เสาตอม่อ C2 — จำนวนต้น
    Fill Card Number    rows    1    จำนวนต้น (ต้น)    4
    Confirm Level And Land On    pedestal    ground-beam

Renaming A Footing Renames It On The Pedestal Level
    [Documentation]    Cross-level: the pedestal choice shows the footing's current name.
    Open Level    footing
    Fill Footing From Plan
    Fill Card Text    rows    0    ชื่อฐาน    FA
    Confirm Level And Land On    footing    pedestal
    Click    css=button:has-text("เพิ่มเสาตอม่อ")
    Footing Choice Should Be    0    FA
    Footing Choice Should Be    1    F2

A Pedestal Can Be Moved To Another Footing
    Open Pedestal With Footings From Plan
    Fill Pedestal From Plan
    Level Totals Should Match Engine Eventually    pedestal
    Click    css=[data-req-card="rows#0"] [role="radiogroup"][aria-label="ตั้งอยู่บนฐานราก"] >> text="F2"
    Footing Choice Should Be    0    F2
    Level Totals Should Match Engine Eventually    pedestal

Pedestal Height Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Pedestal Edge Test    ความสูง (ม.)
    [Template]    Edge Card Case
    0                 ${EMPTY}
    1,250.5           1,250.50
    =2.5*4            10.00
    0.5+0.3           0.80
    2x3               6.00
    -3                -3.00
    abc               5.00
    1/0               5.00
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999.00

Pedestal Count Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Pedestal Edge Test    จำนวนต้น (ต้น)
    [Template]    Edge Card Case
    0                 ${EMPTY}
    =2*8              16
    7+9               16
    -3                -3
    abc               5
    1/0               5
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999

Deleting Pedestals Down To The Empty State
    Open Pedestal With Footings From Plan
    Fill Pedestal From Plan
    Level Totals Should Match Engine Eventually    pedestal
    Delete Card    rows    1
    Card Count Should Be    rows    1
    Level Totals Should Match Engine Eventually    pedestal
    Delete Card    rows    0
    Card Count Should Be    rows    0
    Get Text    body    contains    ยังไม่มีเสาตอม่อ
    Wait For Elements State    css=button:has-text("เพิ่มเสาตอม่อ")    visible
    Level Totals Should Match Engine Eventually    pedestal

Pedestal Next Type Button Adds A Card With The Next Name
    Open Pedestal With Footings From Plan
    Click    css=button:has-text("เพิ่มเสาตอม่อ")
    Click    css=button:has-text("เพิ่มเสาตอม่อแบบถัดไป")
    Card Count Should Be    rows    3
    Input Should Show    ชื่อเสาตอม่อ    C3    2

Fifteen Pedestal Types Are All Counted
    [Documentation]    2 pedestals from the empty state + 13 added, each 0.2 x 0.2 x 0.8 m.
    [Tags]    slow
    Open Pedestal With Footings From Plan
    Click    css=button:has-text("เพิ่มเสาตอม่อ")
    Fill Pedestal From Plan
    FOR    ${i}    IN RANGE    2    15
        Click    css=button:has-text("เพิ่มเสาตอม่อแบบถัดไป")
        Wait For Elements State    css=[data-req-card="rows#${i}"]    visible
        Fill Card Number    rows    ${i}    จำนวนต้น (ต้น)    1
        Fill Card Number    rows    ${i}    ความกว้าง (ม.)    0.2
        Fill Card Number    rows    ${i}    ความยาว (ม.)    0.2
        Fill Card Number    rows    ${i}    ความสูง (ม.)    0.8
    END
    Card Count Should Be    rows    15
    Level Totals Should Match Engine Eventually    pedestal
    Confirm Level And Land On    pedestal    ground-beam

Sample House Pedestal Matches The Engine And Is Confirmed
    [Documentation]    Excel v5 sample: footing F1 x21 and pedestal C1 exist; the level total equals the engine.
    Open Level    pedestal    sample
    Card Count Should Be    rows    1
    Footing Choice Should Be    0    F1
    Level Totals Should Match Engine Eventually    pedestal
    Confirm Level And Land On    pedestal    ground-beam

Pedestal Values And Mark Survive A Reload
    Open Pedestal With Footings From Plan
    Fill Pedestal From Plan
    Confirm Level And Land On    pedestal    ground-beam
    Go To Level    pedestal
    Reload Level Page
    Card Count Should Be    rows    2
    Card Input Should Show    rows    0    ความสูง (ม.)    0.80
    Footing Choice Should Be    1    F2
    Level Mark Should Become    pedestal    done
    Level Totals Should Match Engine Eventually    pedestal

Pedestal Navigation Goes Back Opens The Map And Locks The Next Level
    [Tags]    navigation
    Open Level    pedestal
    Locked Level Should Wait For Previous    ground-beam    คานคอดิน
    Go To Level    pedestal
    Previous Arrow Should Lead To    footing
    Map Button Should Open Overview

# ───────────────────────── Level 11: ground-beam (คานคอดิน) ─────────────────────────
Blank Ground Beam Is Blocked Because At Least One Beam Is Required
    [Tags]    negative
    Open Level    ground-beam
    Get Text    body    contains    ยังไม่มีคานคอดิน
    Wait For Elements State    css=button:has-text("เพิ่มคานคอดินแบบแรก")    visible
    Level Totals Should Match Engine Eventually    ground-beam
    Confirm Should Be Blocked With    ground-beam    1    เพิ่มคานคอดินอย่างน้อย 1 รายการ

An Added Beam Card Without Values Does Not Count As A Beam
    [Tags]    negative
    Open Level    ground-beam
    Click    css=button:has-text("เพิ่มคานคอดินแบบแรก")
    Wait For Elements State    css=[data-req-card="beams#0"]    visible
    Input Should Show    ชื่อคาน    B1
    Confirm Should Be Blocked With    ground-beam    1    เพิ่มคานคอดินอย่างน้อย 1 รายการ

Half Filled Beam Lists Depth And Length Until They Are Typed
    [Tags]    negative
    Open Level    ground-beam
    Click    css=button:has-text("เพิ่มคานคอดินแบบแรก")
    Fill Card Number    beams    0    ความกว้าง (ม.)    0.2
    Confirm Should Be Blocked With    ground-beam    2    คานคอดิน B1 — ความลึก
    Get Text    ${MISSING_ALERT}    contains    ความยาวรวมทุกช่วง
    Fill Card Number    beams    0    ความลึก (ม.)    0.4
    Confirm Level Should Be Blocked    ground-beam    1
    Fill Card Number    beams    0    ความยาวรวมทุกช่วง (ม.)    40
    Level Totals Should Match Engine Eventually    ground-beam
    Confirm Level And Land On    ground-beam    slab-on-grade

Ground Beam From Plan Matches The Engine And Is Confirmed
    [Tags]    smoke
    Open Level    ground-beam
    Fill Ground Beam From Plan
    Card Count Should Be    beams    2
    Level Totals Should Match Engine Eventually    ground-beam
    Get Text    body    contains    คอนกรีตคาน
    Confirm Level And Land On    ground-beam    slab-on-grade

Beam Length Adds Up The Typed Spans
    [Documentation]    "9.5+7+2+9.5+7+2" is evaluated to 37.00 m in the length box.
    Open Level    ground-beam
    Fill Ground Beam From Plan
    Card Input Should Show    beams    0    ความยาวรวมทุกช่วง (ม.)    37.00
    Level Totals Should Match Engine Eventually    ground-beam

A Copied Beam Without A Length Blocks Confirm
    [Documentation]    The next beam copies width, depth and bars of the previous one but not its length.
    [Tags]    negative
    Open Level    ground-beam
    Click    css=button:has-text("เพิ่มคานคอดินแบบแรก")
    Fill Ground Beam Card    0    40    0.2    0.4    0.15
    Click    css=button:has-text("เพิ่มคานคอดิน B2")
    Wait For Elements State    css=[data-req-card="beams#1"]    visible
    Card Input Should Show    beams    1    ความกว้าง (ม.)    0.20
    Card Input Should Show    beams    1    ความยาวรวมทุกช่วง (ม.)    ${EMPTY}
    Confirm Should Be Blocked With    ground-beam    1    คานคอดิน B2 — ความยาวรวมทุกช่วง
    Fill Card Number    beams    1    ความยาวรวมทุกช่วง (ม.)    18
    Level Totals Should Match Engine Eventually    ground-beam
    Confirm Level And Land On    ground-beam    slab-on-grade

Spacing Chip Fills The Stirrup Spacing
    Open Level    ground-beam
    Fill Ground Beam From Plan
    Click    css=[data-req-card="beams#0"] button:has-text("0.20")
    Card Input Should Show    beams    0    เหล็กปลอก ระยะห่าง @ (ม.)    0.20
    Level Totals Should Match Engine Eventually    ground-beam

Ground Beam Length Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Card Test    ground-beam    beams    0    ความยาวรวมทุกช่วง (ม.)    Fill Ground Beam From Plan
    [Template]    Edge Card Case
    0                 ${EMPTY}
    1,250.5           1,250.50
    =2.5*4            10.00
    9.5+7+2           18.50
    2x3               6.00
    -3                -3.00
    abc               5.00
    1/0               5.00
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999.00

Ground Beam Width Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Card Test    ground-beam    beams    1    ความกว้าง (ม.)    Fill Ground Beam From Plan
    [Template]    Edge Card Case
    0                 ${EMPTY}
    =0.1+0.1          0.20
    -3                -3.00
    abc               5.00
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999.00

Beam Main Bar Count Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Card Test    ground-beam    beams    0    เหล็กเสริมหลัก (บน + ล่าง) (เส้น)    Fill Ground Beam From Plan
    [Template]    Edge Card Case
    0                 ${EMPTY}
    =2*3              6
    -3                -3
    abc               5
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999

Lean Concrete Thickness In The Folded Section Changes The Total
    Open Level    ground-beam
    Fill Ground Beam From Plan
    Level Totals Should Match Engine Eventually    ground-beam
    Click    css=button:has-text("ค่าตั้งต้น")
    Fill Number By Label    คาน B1 (ม.)    0.1
    Level Totals Should Match Engine Eventually    ground-beam

Deleting Beams Down To The Empty State
    Open Level    ground-beam
    Fill Ground Beam From Plan
    Level Totals Should Match Engine Eventually    ground-beam
    Delete Card    beams    1
    Card Count Should Be    beams    1
    Level Totals Should Match Engine Eventually    ground-beam
    Delete Card    beams    0
    Card Count Should Be    beams    0
    Get Text    body    contains    ยังไม่มีคานคอดิน
    Level Total Should Be Eventually    0
    Confirm Should Be Blocked With    ground-beam    1    เพิ่มคานคอดินอย่างน้อย 1 รายการ

Fifteen Beam Types Are All Counted
    [Documentation]    B1 filled, duplicated 14 times (copies have length 0), each copy given a 10 m length.
    [Tags]    slow
    Open Level    ground-beam
    Click    css=button:has-text("เพิ่มคานคอดินแบบแรก")
    Fill Ground Beam Card    0    40    0.2    0.4    0.15
    FOR    ${i}    IN RANGE    1    15
        Duplicate Card    beams    0
        Wait For Elements State    css=[data-req-card="beams#${i}"]    visible
    END
    Card Count Should Be    beams    15
    Confirm Level Should Be Blocked    ground-beam    14
    FOR    ${i}    IN RANGE    1    15
        Fill Card Number    beams    ${i}    ความยาวรวมทุกช่วง (ม.)    10
    END
    Level Totals Should Match Engine Eventually    ground-beam
    Confirm Level And Land On    ground-beam    slab-on-grade

Ground Beam Reset Returns To The Empty List
    Open Level    ground-beam
    Fill Ground Beam From Plan
    Level Totals Should Match Engine Eventually    ground-beam
    Reset Level To Default
    Card Count Should Be    beams    0
    Level Totals Should Match Engine Eventually    ground-beam

Ground Beam Values And Mark Survive A Reload
    Open Level    ground-beam
    Fill Ground Beam From Plan
    Confirm Level And Land On    ground-beam    slab-on-grade
    Go To Level    ground-beam
    Reload Level Page
    Card Count Should Be    beams    2
    Card Input Should Show    beams    1    ความยาวรวมทุกช่วง (ม.)    18.00
    Card Input Should Show    beams    1    เหล็กปลอก ระยะห่าง @ (ม.)    0.20
    Level Mark Should Become    ground-beam    done
    Level Totals Should Match Engine Eventually    ground-beam

Ground Beam Navigation Goes Back Opens The Map And Locks The Next Level
    [Tags]    navigation
    Open Level    ground-beam
    Locked Level Should Wait For Previous    slab-on-grade    พื้นหล่อในที่
    Go To Level    ground-beam
    Previous Arrow Should Lead To    pedestal
    Map Button Should Open Overview


*** Keywords ***
Prepare Pedestal Edge Test
    [Documentation]    Footings from plan, then the pedestal level with both pedestals filled; edge cases on card 0.
    [Arguments]    ${label}
    Open Pedestal With Footings From Plan
    Click    css=button:has-text("เพิ่มเสาตอม่อ")
    Fill Pedestal From Plan
    Set Test Variable    ${EDGE_LEVEL}    pedestal
    Set Test Variable    ${EDGE_LIST}    rows
    Set Test Variable    ${EDGE_CARD}    0
    Set Test Variable    ${EDGE_LABEL}    ${label}
