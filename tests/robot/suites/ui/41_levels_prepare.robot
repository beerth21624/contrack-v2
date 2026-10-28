*** Settings ***
Documentation       W2a (1/2): journey levels 1-7 "เตรียมงาน": project-info, land-inspection, demolition (optional),
...                 fill (optional), temp-utilities, site-camp, layout. Per level: blank project, fill from plan and
...                 confirm, required / half-filled rows, edge inputs (0, comma decimal, formulas, negative, letters,
...                 clear, huge), optional skip / unskip, reload persistence, navigation (previous, map, locked).
...                 Expected totals always come from the engine (``Level Totals Should Match Engine``); fixed numbers
...                 are business rules named in the test.
Resource            ../../resources/pages/levels_prepare_foundation.resource
Suite Setup         Prepare Suite
Test Teardown       Close Context
Test Tags           journey    levels-prepare


*** Variables ***
${SPECIAL_NAME}     บ้าน "ทดสอบ" <b>ตัวหนา</b> & 100% 'quote'


*** Test Cases ***
# ───────────────────────── Level 1: project-info (ข้อมูลโครงการ) ─────────────────────────
Blank Project Info Is Blocked Until The Project Has A Name
    [Documentation]    REQUIRED_FIELDS: ชื่อโครงการ is the only required value. Blank project, confirm → stays, 1 missing.
    [Tags]    negative
    Open Level    project-info
    Level Should Show No Own Total
    Confirm Should Be Blocked With    project-info    1    ชื่อโครงการ
    Get Url    should end with    /journey/project-info

A Project Name Of Only Spaces Still Blocks Confirm
    [Tags]    negative    edge
    Open Level    project-info
    Fill Text By Label    ชื่อโครงการ    ${SPACE}${SPACE}${SPACE}
    Confirm Should Be Blocked With    project-info    1    ชื่อโครงการ

Clearing The Name After Typing Blocks Confirm Again
    [Tags]    negative    edge
    Open Level    project-info
    Fill Text By Label    ชื่อโครงการ    บ้านทดสอบ
    Fill Text By Label    ชื่อโครงการ    ${EMPTY}
    Stored Meta Should Eventually Be    projectName    ${EMPTY}
    Confirm Should Be Blocked With    project-info    1    ชื่อโครงการ

Only The Name Is Enough To Confirm Project Info
    [Documentation]    Site, owner, prepared-by and date are optional.
    Open Level    project-info
    Fill Text By Label    ชื่อโครงการ    บ้านทดสอบ
    Confirm Level And Land On    project-info    land-inspection

Project Info Filled From Plan Is Saved And Confirmed
    [Tags]    smoke
    Open Level    project-info
    Fill Project Info From Plan
    Stored Meta Should Eventually Be    projectName    บ้านพักอาศัย คสล. 1 ชั้น (ทดสอบ E2E)
    Stored Meta Should Eventually Be    siteAddress    ต.บางใหญ่ อ.บางใหญ่ จ.นนทบุรี
    Stored Meta Should Eventually Be    ownerName    คุณสมชาย ใจดี
    Stored Meta Should Eventually Be    preparedBy    หจก. ทดสอบก่อสร้าง
    Construction Total Should Match Engine Eventually
    Confirm Level And Land On    project-info    land-inspection

Today Button Fills The Document Date
    Open Level    project-info
    Click    css=button:has-text("วันนี้")
    Get Property    css=input[aria-label="วันที่เอกสาร"]    value    matches    ^\\d{2}/\\d{2}/\\d{4}$
    ${project}=    Wait Until Keyword Succeeds    10s    300ms    Project With Document Date
    Should Match Regexp    ${project}[meta][documentDate]    ^\\d{2}/\\d{2}/\\d{4}$

Quotes Html And Percent Signs In The Name Are Kept As Plain Text
    [Tags]    edge
    Open Level    project-info
    Fill Text By Label    ชื่อโครงการ    ${SPECIAL_NAME}
    Stored Meta Should Eventually Be    projectName    ${SPECIAL_NAME}
    Reload Level Page
    Get Property    css=textarea[aria-label="ชื่อโครงการ"]    value    ==    ${SPECIAL_NAME}
    Get Element Count    css=main b    ==    0

A Very Long Project Name Is Stored In Full
    [Tags]    edge
    Open Level    project-info
    ${name}=    Evaluate    'ก' * 300
    Fill Text By Label    ชื่อโครงการ    ${name}
    Stored Meta Should Eventually Be    projectName    ${name}
    Confirm Level And Land On    project-info    land-inspection

Project Info Values And Done Mark Survive A Reload
    Open Level    project-info
    Fill Project Info From Plan
    Confirm Level And Land On    project-info    land-inspection
    Go To Level    project-info
    Get Property    css=textarea[aria-label="ชื่อโครงการ"]    value    ==    บ้านพักอาศัย คสล. 1 ชั้น (ทดสอบ E2E)
    Get Property    css=textarea[aria-label="เจ้าของบ้าน"]    value    ==    คุณสมชาย ใจดี
    Get Text    css=h3    contains    ข้อมูลโครงการ
    Get Text    body    contains    เสร็จแล้ว
    Reload Level Page
    Get Property    css=textarea[aria-label="สถานที่ก่อสร้าง"]    value    ==    ต.บางใหญ่ อ.บางใหญ่ จ.นนทบุรี
    Level Mark Should Become    project-info    done

Project Info Is The First Level And Cannot Go Back
    [Tags]    navigation
    Open Level    project-info
    Get Element States    css=button[aria-label="ขั้นตอนก่อนหน้า"]    contains    disabled
    Get Text    body    contains    ขั้นตอน 1/37
    Map Button Should Open Overview

Land Inspection Is Locked Until Project Info Is Done
    [Tags]    navigation    negative
    Open Level    project-info
    Locked Level Should Wait For Previous    land-inspection    ตรวจสอบที่ดิน

# ───────────────────────── Level 2: land-inspection (ตรวจสอบที่ดิน) ─────────────────────────
Blank Land Inspection Shows The 7500 Baht Lump Sum Outside The Construction Total
    [Documentation]    Business rule (domain/calculators/land-inspection): the 4 standard cost lines are 2 x 1,500 +
    ...    1 x 2,500 + 1 x 1,200 + 1 x 800 = 7,500 baht, a pre-construction cost not in the construction total.
    Open Level    land-inspection
    Level Total Should Be    7500
    Wait For Elements State    ${PRE_CONSTRUCTION}    visible
    ${expected}=    Level Totals Should Match Engine Eventually    land-inspection
    Should Be Equal As Numbers    ${expected}[preConstructionTotal]    7500

Blank Land Inspection Confirms Without Any Entry
    [Documentation]    REQUIRED_FIELDS: nothing is required on this level.
    Open Level    land-inspection
    Confirm Level And Land On    land-inspection    demolition

Land Inspection Filled From Plan Matches The Engine And Leaves The Construction Total Alone
    [Tags]    smoke
    Open Level    land-inspection
    ${before}=    Construction Total On Screen
    Fill Land Inspection From Plan
    Level Total Should Be Eventually    10000
    ${expected}=    Level Totals Should Match Engine Eventually    land-inspection
    Numbers Should Be Close    ${before}    ${expected}[constructionTotal]    tolerance=1
    Construction Total Should Be    ${before}
    Confirm Level And Land On    land-inspection    demolition

Answering Yes Marks The Question And Counts Progress
    Open Level    land-inspection
    Choose Yes Answer    2
    Get Attribute    css=[aria-label="คำตอบข้อ 2"] >> text="ใช่"    aria-pressed    ==    true
    Get Text    body    contains    ตรวจแล้ว 1 / 5 ข้อ
    Choose Yes Answer    2
    Get Attribute    css=[aria-label="คำตอบข้อ 2"] >> text="ใช่"    aria-pressed    ==    false
    Get Text    body    contains    ตรวจแล้ว 0 / 5 ข้อ

Clear Button Removes An Answer
    Open Level    land-inspection
    Choose Yes Answer    3
    Get Text    body    contains    ตรวจแล้ว 1 / 5 ข้อ
    Click    css=button[aria-label="ล้างคำตอบ"]
    Get Text    body    contains    ตรวจแล้ว 0 / 5 ข้อ

A No Answer Is A Finding But Does Not Block Confirm
    [Documentation]    "ไม่ใช่" asks for the problem found; the level still confirms (nothing is required).
    [Tags]    negative
    Open Level    land-inspection
    Choose No Answer    3
    Get Text    body    contains    กรุณาระบุปัญหาที่พบ
    Get Text    body    contains    พบประเด็นที่ต้องแก้ไข 1 ข้อ
    Fill Text By Label    บันทึกข้อ 3    รั้วข้างบ้านรุกล้ำ 30 ซม.
    Level Totals Should Match Engine Eventually    land-inspection
    Confirm Level And Land On    land-inspection    demolition

Zero Quantities Make The Land Inspection Total Zero
    [Tags]    edge
    Open Level    land-inspection
    FOR    ${i}    IN RANGE    4
        Fill Number By Label    จำนวน    0    ${i}
    END
    Level Total Should Be Eventually    0
    Level Totals Should Match Engine Eventually    land-inspection

Land Inspection Quantity Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Test    land-inspection    จำนวน    0
    [Template]    Edge Case
    0                 ${EMPTY}
    1,250.5           1,250.50
    =2.5*4            10.00
    9.5+7+2           18.50
    (4+2)*0.9         5.40
    2x3               6.00
    -3                -3.00
    abc               5.00
    1/0               5.00
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999.00

Added Cost Row Counts And Can Be Deleted
    [Documentation]    Open the folded price list, add a row (3 x 1,000 = 3,000 baht), then delete it again.
    Open Level    land-inspection
    Click    css=button:has-text("ราคาต่อหน่วยและรายการเพิ่มเติม")
    Click    css=button:has-text("เพิ่มรายการ")
    Fill Number By Label    จำนวน    3    9
    Fill Number By Label    ราคาต่อหน่วย    1000    4
    Level Total Should Be Eventually    10500
    Level Totals Should Match Engine Eventually    land-inspection
    Click    css=button[aria-label="ลบแถว"]
    Level Total Should Be Eventually    7500
    Level Totals Should Match Engine Eventually    land-inspection

Land Inspection Notes And Answers Survive A Reload
    Open Level    land-inspection
    Fill Land Inspection From Plan
    Level Totals Should Match Engine Eventually    land-inspection
    Reload Level Page
    Input Should Show    ผู้ตรวจสอบ    ช่างสมศักดิ์
    Input Should Show    บันทึกข้อ 1    โฉนดเลขที่ 12345 ต.บางใหญ่ อ.บางใหญ่ จ.นนทบุรี
    Get Attribute    css=[aria-label="คำตอบข้อ 4"] >> text="ใช่"    aria-pressed    ==    true
    Get Text    body    contains    ตรวจแล้ว 5 / 5 ข้อ
    Level Total Should Be    10000

Reset Returns Land Inspection To The Standard Lump Sum
    Open Level    land-inspection
    Fill Land Inspection From Plan
    Level Total Should Be Eventually    10000
    Reset Level To Default
    Level Total Should Be Eventually    7500
    Get Text    body    contains    ตรวจแล้ว 0 / 5 ข้อ

Land Inspection Navigation Goes Back Opens The Map And Locks The Next Level
    [Tags]    navigation
    Open Level    land-inspection
    Locked Level Should Wait For Previous    demolition    รื้อถอน
    Go To Level    land-inspection
    Map Button Should Open Overview
    Go To Level    land-inspection
    Previous Arrow Should Lead To    project-info

# ───────────────────────── Level 3: demolition (รื้อถอน, optional) ─────────────────────────
Blank Demolition Is Zero And Says There Is No Demolition Yet
    Open Level    demolition
    Level Total Should Be    0
    Get Text    body    contains    ยังไม่มีงานรื้อถอน
    Level Totals Should Match Engine Eventually    demolition
    Card Count Should Be    items    7

Blank Demolition Confirms Without Any Entry
    [Documentation]    REQUIRED_FIELDS: a row with no quantity is ignored; "done" with nothing is allowed.
    Open Level    demolition
    Confirm Level And Land On    demolition    fill

Demolition Filled From Plan Matches The Engine And Is Confirmed
    [Tags]    smoke
    Open Level    demolition
    Fill Demolition From Plan
    Level Total Should Be Eventually    13700
    Level Totals Should Match Engine Eventually    demolition
    Confirm Level And Land On    demolition    fill

A Quantity Without A Rate Is Blocked Until The Rate Is Typed
    [Documentation]    REQUIRED_FIELDS: each item with a quantity has a rate.
    [Tags]    negative
    Open Level    demolition
    Fill Card Number    items    1    ปริมาณ (ต้น)    6
    Confirm Should Be Blocked With    demolition    1    รื้อถอนต้นไม้ — ค่ารื้อต่อหน่วย
    Get Text    css=[data-req-card="items#1"]    contains    ยังคิดเป็น 0 บาท
    Fill Card Number    items    1    ค่ารื้อต่อหน่วย (บาท/ต้น)    300
    Level Total Should Be Eventually    1800
    Level Totals Should Match Engine Eventually    demolition
    Confirm Level And Land On    demolition    fill

A Rate Without A Quantity Costs Nothing And Does Not Block
    [Tags]    edge
    Open Level    demolition
    Fill Card Number    items    0    ค่ารื้อต่อหน่วย (บาท/ตร.ม.)    500
    Level Total Should Be Eventually    0
    Level Totals Should Match Engine Eventually    demolition
    Confirm Level And Land On    demolition    fill

Demolition Quantity Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Card Test    demolition    items    3    ปริมาณ (ตร.ม.)    Fill Demolition From Plan
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

Extra Demolition Row Is Named Counted And Deleted
    [Documentation]    "เพิ่มงานรื้ออื่น": a free-text row (1 x 8,000 baht). An untouched row deletes at once; a row
    ...    with values asks first.
    Open Level    demolition
    Click    css=button:has-text("เพิ่มงานรื้ออื่น")
    Wait For Elements State    css=[data-req-card="items#7"]    visible
    Fill Card Text    items    7    ชื่องาน    รื้อบ่อเกรอะเดิม
    Fill Card Text    items    7    หน่วย    ที่
    Fill Card Number    items    7    ปริมาณ (ที่)    1
    Fill Card Number    items    7    ค่ารื้อต่อหน่วย (บาท/ที่)    8000
    Level Total Should Be Eventually    8000
    Level Totals Should Match Engine Eventually    demolition
    Get Text    css=[data-req-card="items#7"]    contains    รื้อบ่อเกรอะเดิม
    Delete Card    items    7
    Card Count Should Be    items    7
    Level Total Should Be Eventually    0
    Click    css=button:has-text("เพิ่มงานรื้ออื่น")
    Wait For Elements State    css=[data-req-card="items#7"]    visible
    Delete Card    items    7    asks=${False}
    Card Count Should Be    items    7

Fifteen Demolition Rows Are All Counted
    [Documentation]    7 standard kinds + 8 added rows, each 1 x 100 baht = 800 baht on the added rows.
    [Tags]    slow
    Open Level    demolition
    FOR    ${i}    IN RANGE    7    15
        Click    css=button:has-text("เพิ่มงานรื้ออื่น")
        Wait For Elements State    css=[data-req-card="items#${i}"]    visible
        Fill Card Number    items    ${i}    ปริมาณ (หน่วย)    1
        Fill Card Number    items    ${i}    ค่ารื้อต่อหน่วย (บาท/หน่วย)    100
    END
    Card Count Should Be    items    15
    Level Total Should Be Eventually    800
    Level Totals Should Match Engine Eventually    demolition
    Confirm Level And Land On    demolition    fill

Skipping Demolition Zeroes Its Money And Drops The Construction Total
    [Documentation]    "ไม่มีในโครงการนี้" → Popconfirm → skipped; the level total is 0 and the construction total
    ...    drops by the level amount (13,700 baht) while the values stay for a later restore.
    [Tags]    skip
    Open Level    demolition
    Fill Demolition From Plan
    Level Total Should Be Eventually    13700
    ${before}=    Construction Total On Screen
    Skip Level Through Popconfirm Should Land On    demolition    fill
    ${expected}=    Level Totals Should Match Engine Eventually    fill
    ${after}=    Construction Total On Screen
    ${drop}=    Evaluate    ${before} - ${after}
    Should Be True    ${drop} > 0    Construction total did not drop after skipping (${before} -> ${after})
    Numbers Should Be Close    ${drop}    13700    tolerance=1    msg=Construction total dropped by ${drop}, not by the level amount 13700
    Go To Level    demolition
    Get Text    body    contains    ขั้นตอนนี้ระบุว่า "ไม่มีในโครงการนี้"
    Level Total Should Be Eventually    0
    Level Totals Should Match Engine Eventually    demolition

Unskipping Demolition Restores The Values And The Total
    [Tags]    skip
    Open Level    demolition
    Fill Demolition From Plan
    Skip Level Through Popconfirm Should Land On    demolition    fill
    Go To Level    demolition
    Unskip Level
    Wait For Elements State    css=[data-req-card="items#3"]    visible
    Card Input Should Show    items    3    ปริมาณ (ตร.ม.)    18.00
    Level Total Should Be Eventually    13700
    Level Mark Should Become    demolition    ${None}
    Level Totals Should Match Engine Eventually    demolition

Cancelling The Skip Popconfirm Keeps The Level Open
    [Tags]    skip    negative
    Open Level    demolition
    Click    ${SKIP_BUTTON}
    Click    ${SKIP_CANCEL}
    Get Url    should end with    /journey/demolition
    Level Mark Should Be    demolition    ${None}
    Get Element Count    ${UNSKIP_BUTTON}    ==    0

A Confirmed Demolition Shows Done And No Skip Button
    [Tags]    skip
    Open Level    demolition
    Fill Demolition From Plan
    Confirm Level And Land On    demolition    fill
    Go To Level    demolition
    Get Text    body    contains    เสร็จแล้ว
    Get Element Count    ${SKIP_BUTTON}    ==    0

Demolition Values And Mark Survive A Reload
    Open Level    demolition
    Fill Demolition From Plan
    Confirm Level And Land On    demolition    fill
    Go To Level    demolition
    Reload Level Page
    Card Input Should Show    items    5    ปริมาณ (ตร.ม.)    200.00
    Card Input Should Show    items    6    ค่ารื้อต่อหน่วย (บาท/เที่ยว)    1,500
    Level Mark Should Become    demolition    done
    Level Total Should Be    13700

Demolition Navigation Goes Back Opens The Map And Locks The Next Level
    [Tags]    navigation
    Open Level    demolition
    Locked Level Should Wait For Previous    fill    ถมดิน
    Go To Level    demolition
    Previous Arrow Should Lead To    land-inspection
    Map Button Should Open Overview

# ───────────────────────── Level 4: fill (ถมดิน, optional) ─────────────────────────
Blank Earth Fill Is Zero With A Hint What To Fill
    Open Level    fill
    Level Total Should Be    0
    Get Text    body    contains    กรอกความกว้าง ความยาว และความสูงถม
    Level Totals Should Match Engine Eventually    fill

Blank Earth Fill Confirms Without Any Entry
    [Documentation]    An untouched form is ignored (REQUIRED_FIELDS: width, length, height only once one is typed).
    Open Level    fill
    Confirm Level And Land On    fill    temp-utilities

Earth Fill From Plan Matches The Engine And Is Confirmed
    [Tags]    smoke
    Open Level    fill
    Fill Earth Fill From Plan
    Get Text    body    contains    ปริมาณดินถม
    Level Totals Should Match Engine Eventually    fill
    Confirm Level And Land On    fill    temp-utilities

Width Alone Lists Length And Height As Missing
    [Tags]    negative
    Open Level    fill
    Fill Number By Label    ความกว้างพื้นที่ถม    15
    Confirm Should Be Blocked With    fill    2    ความยาวพื้นที่ถม
    Get Text    ${MISSING_ALERT}    contains    ความสูงถม
    Fill Number By Label    ความยาวพื้นที่ถม    20
    Fill Number By Label    ความสูงถม (ม.)    0.5
    Level Totals Should Match Engine Eventually    fill
    Confirm Level And Land On    fill    temp-utilities

Height Alone Lists Width And Length As Missing
    [Tags]    negative
    Open Level    fill
    Fill Number By Label    ความสูงถม (ม.)    0.5
    Confirm Should Be Blocked With    fill    2    ความกว้างพื้นที่ถม
    Level Total Should Be    0
    Fill Number By Label    ความกว้างพื้นที่ถม    10
    Confirm Level Should Be Blocked    fill    1
    Fill Number By Label    ความยาวพื้นที่ถม    10
    Confirm Level And Land On    fill    temp-utilities

Fill Height Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Test    fill    ความสูงถม (ม.)    0    Fill Earth Fill From Plan
    [Template]    Edge Case
    0                 ${EMPTY}
    1,250.5           1,250.50
    =2.5*4            10.00
    0.3+0.2           0.50
    2x3               6.00
    -3                -3.00
    abc               5.00
    1/0               5.00
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999.00

Fill Width Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Test    fill    ความกว้างพื้นที่ถม    0    Fill Earth Fill From Plan
    [Template]    Edge Case
    0                 ${EMPTY}
    1,250.5           1,250.50
    =7.5+7.5          15.00
    (4+2)*0.9         5.40
    -3                -3.00
    abc               5.00
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999.00

Settlement Allowance In The Folded Section Changes The Volume
    Open Level    fill
    Fill Earth Fill From Plan
    Level Totals Should Match Engine Eventually    fill
    Click    css=button:has-text("ราคาและค่าตั้งต้น")
    Fill Number By Label    เผื่อดินยุบตัว    50
    Level Totals Should Match Engine Eventually    fill
    Fill Number By Label    เผื่อดินยุบตัว    0
    Level Totals Should Match Engine Eventually    fill

Skipping Earth Fill Keeps The Construction Total In Step With The Engine
    [Documentation]    The fill BOQ row has no standard price, so the level total stays 0 until a price is typed on
    ...    the BOQ page; skipping must still mark the level and keep totals equal to the engine.
    [Tags]    skip
    Open Level    fill
    Fill Earth Fill From Plan
    Level Totals Should Match Engine Eventually    fill
    Skip Level Through Popconfirm Should Land On    fill    temp-utilities
    Level Totals Should Match Engine Eventually    temp-utilities
    Go To Level    fill
    Get Text    body    contains    ขั้นตอนนี้ระบุว่า "ไม่มีในโครงการนี้"
    Level Total Should Be Eventually    0
    Level Totals Should Match Engine Eventually    fill

Unskipping Earth Fill Restores The Values
    [Tags]    skip
    Open Level    fill
    Fill Earth Fill From Plan
    Skip Level Through Popconfirm Should Land On    fill    temp-utilities
    Go To Level    fill
    Unskip Level
    Wait For Elements State    ${UNSKIP_BUTTON}    detached
    Input Should Show    ความกว้างพื้นที่ถม    15.00
    Input Should Show    วัสดุถม    ดินถมคัดเกรด
    Level Mark Should Become    fill    ${None}
    Level Totals Should Match Engine Eventually    fill

Earth Fill Values And Mark Survive A Reload
    Open Level    fill
    Fill Earth Fill From Plan
    Confirm Level And Land On    fill    temp-utilities
    Go To Level    fill
    Reload Level Page
    Input Should Show    ความยาวพื้นที่ถม    20.00
    Input Should Show    ความสูงถม (ม.)    0.50
    Level Mark Should Become    fill    done
    Level Totals Should Match Engine Eventually    fill

Earth Fill Navigation Goes Back Opens The Map And Locks The Next Level
    [Tags]    navigation
    Open Level    fill
    Locked Level Should Wait For Previous    temp-utilities    น้ำ-ไฟชั่วคราว
    Go To Level    fill
    Previous Arrow Should Lead To    demolition
    Map Button Should Open Overview

# ───────────────────────── Level 5: temp-utilities (น้ำ-ไฟชั่วคราว) ─────────────────────────
Blank Temporary Utilities Show Only The Standard Power Box
    Open Level    temp-utilities
    Level Totals Should Match Engine Eventually    temp-utilities
    Get Text    body    contains    ตอนนี้คิดเฉพาะตู้ไฟชั่วคราว 1 ชุด

Blank Temporary Utilities Confirm Without Any Entry
    [Documentation]    REQUIRED_FIELDS: distances and points are optional (the standard box is counted anyway).
    Open Level    temp-utilities
    Confirm Level And Land On    temp-utilities    site-camp

Temporary Utilities From Plan Match The Engine And Are Confirmed
    [Tags]    smoke
    Open Level    temp-utilities
    ${blank}=    Level Total On Screen
    Fill Temporary Utilities From Plan
    Wait Until Keyword Succeeds    10s    300ms    Level Total Should Exceed    ${blank}
    Level Totals Should Match Engine Eventually    temp-utilities
    Get Text    body    contains    ท่อ PVC
    Confirm Level And Land On    temp-utilities    site-camp

Stepper Buttons Add And Remove Water Points And Stop At Zero
    Open Level    temp-utilities
    Get Element States    css=button[aria-label="ลด จำนวนจุดใช้น้ำ"]    contains    disabled
    FOR    ${i}    IN RANGE    3
        Click    css=button[aria-label="เพิ่ม จำนวนจุดใช้น้ำ"]
    END
    Input Should Show    จำนวนจุดใช้น้ำ    3
    Click    css=button[aria-label="ลด จำนวนจุดใช้น้ำ"]
    Input Should Show    จำนวนจุดใช้น้ำ    2
    Level Totals Should Match Engine Eventually    temp-utilities
    Click    css=button[aria-label="ลด จำนวนจุดใช้น้ำ"]
    Click    css=button[aria-label="ลด จำนวนจุดใช้น้ำ"]
    Input Should Show    จำนวนจุดใช้น้ำ    ${EMPTY}
    Get Element States    css=button[aria-label="ลด จำนวนจุดใช้น้ำ"]    contains    disabled

Power Distance Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Test    temp-utilities    ระยะเดินสายไฟ จากมิเตอร์ถึงหน้างาน    0    Fill Temporary Utilities From Plan
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

Light And Plug Count Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Test    temp-utilities    จำนวนจุดไฟ / ปลั๊ก    0    Fill Temporary Utilities From Plan
    [Template]    Edge Case
    0                 ${EMPTY}
    =2*8              16
    7+9               16
    -3                -3
    abc               5
    1/0               5
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999

Temporary Utilities Values Survive A Reload
    Open Level    temp-utilities
    Fill Temporary Utilities From Plan
    Confirm Level And Land On    temp-utilities    site-camp
    Go To Level    temp-utilities
    Reload Level Page
    Input Should Show    ระยะเดินสายไฟ จากมิเตอร์ถึงหน้างาน    30.00
    Input Should Show    จำนวนจุดไฟ / ปลั๊ก    3
    Level Mark Should Become    temp-utilities    done
    Level Totals Should Match Engine Eventually    temp-utilities

Temporary Utilities Navigation Goes Back Opens The Map And Locks The Next Level
    [Tags]    navigation
    Open Level    temp-utilities
    Locked Level Should Wait For Previous    site-camp    แคมป์คนงาน
    Go To Level    temp-utilities
    Previous Arrow Should Lead To    fill
    Map Button Should Open Overview

# ───────────────────────── Level 6: site-camp (แคมป์คนงาน) ─────────────────────────
Blank Site Camp Is Zero And Asks For Room Counts
    Open Level    site-camp
    Level Total Should Be    0
    Get Text    body    contains    กรอกจำนวนห้องพัก
    Level Totals Should Match Engine Eventually    site-camp

Blank Site Camp Confirms Because Zero Rooms Is Valid
    [Documentation]    REQUIRED_FIELDS: "0 is valid: no camp".
    Open Level    site-camp
    Confirm Level And Land On    site-camp    layout

Site Camp From Plan Matches The Engine And Is Confirmed
    [Tags]    smoke
    Open Level    site-camp
    Fill Site Camp From Plan
    Wait Until Keyword Succeeds    10s    300ms    Positive Level Total On Screen
    Level Totals Should Match Engine Eventually    site-camp
    Get Text    body    contains    ห้องละ
    Confirm Level And Land On    site-camp    layout

Each Room Type Costs Money On Its Own
    [Documentation]    One room of each kind alone gives a positive total equal to the engine; back to 0 gives 0.
    FOR    ${label}    IN    จำนวนห้องพักคนงาน    จำนวนห้องน้ำ    จำนวนห้องอาบน้ำ    จำนวนสโตร์เก็บของ
        Open Level    site-camp
        Fill Number By Label    ${label}    1
        Wait Until Keyword Succeeds    10s    300ms    Positive Level Total On Screen
        Level Totals Should Match Engine Eventually    site-camp
        Fill Number By Label    ${label}    0
        Level Total Should Be Eventually    0
    END

Site Camp Stepper Buttons Add And Remove Rooms And Stop At Zero
    Open Level    site-camp
    Get Element States    css=button[aria-label="ลด จำนวนห้องน้ำ"]    contains    disabled
    Click    css=button[aria-label="เพิ่ม จำนวนห้องน้ำ"]
    Click    css=button[aria-label="เพิ่ม จำนวนห้องน้ำ"]
    Input Should Show    จำนวนห้องน้ำ    2
    Level Totals Should Match Engine Eventually    site-camp
    Click    css=button[aria-label="ลด จำนวนห้องน้ำ"]
    Click    css=button[aria-label="ลด จำนวนห้องน้ำ"]
    Input Should Show    จำนวนห้องน้ำ    ${EMPTY}
    Get Element States    css=button[aria-label="ลด จำนวนห้องน้ำ"]    contains    disabled
    Level Total Should Be Eventually    0

Worker Room Count Accepts Arithmetic And Ignores Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Test    site-camp    จำนวนห้องพักคนงาน    0
    [Template]    Edge Case
    0                 ${EMPTY}
    =2+1              3
    7+9               16
    -2                -2
    abc               5
    1/0               5
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999

Site Camp Values And Mark Survive A Reload
    Open Level    site-camp
    Fill Site Camp From Plan
    Confirm Level And Land On    site-camp    layout
    Go To Level    site-camp
    Reload Level Page
    Input Should Show    จำนวนสโตร์เก็บของ    1
    Input Should Show    จำนวนห้องพักคนงาน    1
    Level Mark Should Become    site-camp    done
    Level Totals Should Match Engine Eventually    site-camp

Site Camp Navigation Goes Back Opens The Map And Locks The Next Level
    [Tags]    navigation
    Open Level    site-camp
    Locked Level Should Wait For Previous    layout    วางผัง / ปักหมุด
    Go To Level    site-camp
    Previous Arrow Should Lead To    temp-utilities
    Map Button Should Open Overview

# ───────────────────────── Level 7: layout (วางผัง / ปักหมุด) ─────────────────────────
Blank Layout Shows The 5500 Baht Lump Sum
    [Documentation]    Business rule: BOQ row R32 "ค่าวางผัง / ปักหมุด" is a 5,500 baht lump sum counted in the project
    ...    even with no points (the note under the inputs says so).
    Open Level    layout
    Level Total Should Be    5500
    Get Text    body    contains    ค่าวางผัง / ปักหมุด เหมา 5,500 บาท
    Level Totals Should Match Engine Eventually    layout

Blank Layout Confirms Without Any Entry
    Open Level    layout
    Confirm Level And Land On    layout    piles

Layout From Plan Matches The Engine And Is Confirmed
    [Tags]    smoke
    Open Level    layout
    Fill Layout From Plan
    Level Totals Should Match Engine Eventually    layout
    Get Text    body    contains    สรุปผลขั้นตอนนี้
    Confirm Level And Land On    layout    piles

Layout Points Accept Arithmetic And Ignore Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Test    layout    จำนวนจุดวางผัง    0    Fill Layout From Plan
    [Template]    Edge Case
    0                 ${EMPTY}
    =2*8              16
    7+9               16
    -3                -3
    abc               5
    1/0               5
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999

Layout Stakes Accept Arithmetic And Ignore Nonsense
    [Tags]    edge    negative
    [Setup]    Prepare Edge Test    layout    จำนวนหมุด    0    Fill Layout From Plan
    [Template]    Edge Case
    0                 ${EMPTY}
    =6+6              12
    -3                -3
    abc               5
    1/0               5
    ${EMPTY}          ${EMPTY}
    99999999          99,999,999

Layout Values And Mark Survive A Reload
    Open Level    layout
    Fill Layout From Plan
    Confirm Level And Land On    layout    piles
    Go To Level    layout
    Reload Level Page
    Input Should Show    จำนวนจุดวางผัง    16
    Input Should Show    จำนวนหมุด    12
    Level Mark Should Become    layout    done
    Level Totals Should Match Engine Eventually    layout

Layout Navigation Goes Back Opens The Map And Locks The Next Level
    [Tags]    navigation
    Open Level    layout
    Locked Level Should Wait For Previous    piles    เสาเข็ม
    Go To Level    layout
    Previous Arrow Should Lead To    site-camp
    Map Button Should Open Overview


*** Keywords ***
Project With Document Date
    [Documentation]    The stored project once its document date is set.
    ${project}=    Read Guest Project
    Should Not Be Empty    ${project}[meta][documentDate]
    RETURN    ${project}

