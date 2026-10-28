*** Settings ***
Documentation       Journey levels 21-23 (TEST_PLAN W3): ประตู-หน้าต่าง (door-window), ก่ออิฐ (brick), ฉาบปูน (plaster).
...                 Per level: blank state, required fields (REQUIRED_FIELDS.md), filled-from-plan totals against the
...                 engine, half-filled rows, edge inputs, add/delete rows, reload, navigation, and the cross-level data
...                 flow (openings are deducted from the brick walls, plaster area follows the brick walls).
...                 House values: see ``resources/pages/levels_walls_systems.resource``.
Resource            ../../resources/journey.resource
Resource            ../../resources/pages/levels_walls_systems.resource
Suite Setup         Open Browser For Suite
Test Teardown       Close Test Context
Test Tags           journey    walls    w3a


*** Test Cases ***
# ═════════════════════════════ 21 door-window ═════════════════════════════

Blank Door Window Level Totals Zero And Offers Both Add Buttons
    [Documentation]    A new blank project has no openings: total 0, both empty prompts and add buttons show.
    [Tags]    door-window
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    door-window
    Get Text    css=body    contains    ยังไม่มีประตู
    Get Text    css=body    contains    ยังไม่มีหน้าต่าง
    WS Button Count Should Be    เพิ่มประตู    1
    WS Button Count Should Be    เพิ่มหน้าต่าง    1

Confirming A Blank Door Window Level Is Blocked
    [Documentation]    REQUIRED_FIELDS: at least one opening. Confirm stays on the level and says 1 item is missing.
    [Tags]    door-window    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Confirm Should Be Blocked Naming    door-window    1    เพิ่มประตูหรือหน้าต่างอย่างน้อย 1 รายการ
    Level Mark Should Be    door-window    ${None}

Door Window Filled From The Plan Matches The Engine And Confirms
    [Documentation]    D1 x1 + D2 x2 doors and W1 x5 windows: card areas 2.10 / 3.20 / 9.00 sqm (width x height x
    ...    count), both totals equal the engine, confirm opens brick and marks door-window done.
    [Tags]    door-window    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Level Should Match Engine    door-window    positive=${TRUE}
    Get Text    css=body    contains    2.10 ตร.ม.
    Get Text    css=body    contains    3.20 ตร.ม.
    Get Text    css=body    contains    9.00 ตร.ม.
    WS Confirm Should Pass    door-window    brick

Sample House Door Window Matches The Engine And Confirms
    [Documentation]    The Excel v5 sample house satisfies every requirement of the level.
    [Tags]    door-window    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Level Should Match Engine    door-window    positive=${TRUE}
    WS Confirm Should Pass    door-window    brick

Door With Width Only Is Blocked Naming The Height
    [Documentation]    Half-filled opening: a new door starts with 1 leaf, so only the height is missing.
    [Tags]    door-window    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    กว้าง (ม.)    0.9
    WS Confirm Should Be Blocked Naming    door-window    1    ความสูง
    Get Text    css=[role="alert"]:has-text("ยังต้องกรอก")    contains    ประตู D1

Window With Height Only Is Blocked Naming The Width
    [Tags]    door-window    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    windows
    Fill Number By Label    สูง (ม.)    1.2
    WS Confirm Should Be Blocked Naming    door-window    1    ความกว้าง
    Get Text    css=[role="alert"]:has-text("ยังต้องกรอก")    contains    หน้าต่าง W1

Door With Size But Zero Leaves Is Blocked Naming The Count
    [Tags]    door-window    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    กว้าง (ม.)    0.9
    Fill Number By Label    สูง (ม.)    2.1
    Fill Number By Label    จำนวน (บาน)    0
    WS Confirm Should Be Blocked Naming    door-window    1    จำนวน

Door With Neither Width Nor Height Is Reported Once Per Missing Value
    [Documentation]    Typing only a name does not make the opening an item, so the level asks for one opening;
    ...    a door with a height only lists exactly the width.
    [Tags]    door-window    negative    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Text By Label    รหัส-รายการ (ตามตารางในแบบ)    D1-ประตูที่ยังไม่มีขนาด
    WS Confirm Should Be Blocked Naming    door-window    1    เพิ่มประตูหรือหน้าต่างอย่างน้อย 1 รายการ

Completing A Half Filled Door Lets The Level Confirm
    [Tags]    door-window    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    กว้าง (ม.)    0.9
    Confirm Level Should Be Blocked    door-window    1
    Fill Number By Label    สูง (ม.)    2.1
    WS Level Should Match Engine    door-window
    WS Confirm Should Pass    door-window    brick

Door Width Edge Inputs Stay Finite And Match The Engine
    [Documentation]    0, thousands separator, =expression, sum, x as times, exponent, negative, text, cleared, 1/0,
    ...    very large.
    [Tags]    door-window    edge
    [Setup]    Open Door With Height
    [Template]    Door Edge Number
    กว้าง (ม.)    0    0
    กว้าง (ม.)    1,250.5    1250.5
    กว้าง (ม.)    =2.5*4    10
    กว้าง (ม.)    9.5+7+2    18.5
    กว้าง (ม.)    2.5x4    10
    กว้าง (ม.)    1e3    1000
    กว้าง (ม.)    -3    -3
    กว้าง (ม.)    abc    1
    กว้าง (ม.)    ${EMPTY}    0
    กว้าง (ม.)    1/0    1
    กว้าง (ม.)    99999999    99999999

Door Height Edge Inputs Stay Finite And Match The Engine
    [Tags]    door-window    edge
    [Setup]    Open Door With Width
    [Template]    Door Edge Number
    สูง (ม.)    0    0
    สูง (ม.)    1,250.5    1250.5
    สูง (ม.)    =2.1*1    2.1
    สูง (ม.)    1+1.1    2.1
    สูง (ม.)    -2    -2
    สูง (ม.)    abc    1
    สูง (ม.)    ${EMPTY}    0
    สูง (ม.)    99999999    99999999

Door Count Edge Inputs Stay Finite And Match The Engine
    [Documentation]    Leaf counts show whole numbers: a typed 1,250.5 is stored but shown rounded (tolerance 0.5).
    [Tags]    door-window    edge
    [Setup]    Open Door With Size
    [Template]    Door Count Edge Number
    0    0
    3    3
    1,250.5    1250.5
    =2*3    6
    -4    -4
    abc    1
    ${EMPTY}    0
    99999999    99999999

Unusual Opening Size Shows A Quiet Warning Not A Block
    [Documentation]    A 90 m wide door is accepted but the card asks to check the unit.
    [Tags]    door-window    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    กว้าง (ม.)    90
    Fill Number By Label    สูง (ม.)    2.1
    Get Text    css=body    contains    มากกว่าปกติ
    WS Level Should Match Engine    door-window
    WS Confirm Should Pass    door-window    brick

Door Width Presets Fill The Box
    [Documentation]    The 0.8 / 0.9 / 1.0 m quick-pick chips of a door type the width.
    [Tags]    door-window
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    FOR    ${preset}    IN    0.8    0.9    1.0
        Click    css=[aria-label="ค่าที่ใช้บ่อย"] >> css=button >> text="${preset}" >> nth=0
        WS Box Should Show    css=[aria-label="กว้าง (ม.)"] >> nth=0    ${preset}
    END
    WS Level Should Match Engine    door-window

Every Opening Choice Can Be Picked
    [Documentation]    Every option of material (2), wall part (4), wall type (3) and thickness (2) is selected once
    ...    and kept.
    [Tags]    door-window
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    กว้าง (ม.)    0.9
    Fill Number By Label    สูง (ม.)    2.1
    FOR    ${option}    IN    ไม้    อลูมิเนียม
        WS Choose Radio    วัสดุบาน    ${option}
        WS Radio Should Be Selected    วัสดุบาน    ${option}
    END
    FOR    ${option}    IN    ผนังรอบบ้าน    ผนังภายในบ้าน    ผนังภายนอกบ้าน    ผนังรอบบ้าน-พิเศษ
        WS Choose Radio    ติดตั้งที่ผนัง    ${option}
        WS Radio Should Be Selected    ติดตั้งที่ผนัง    ${option}
    END
    FOR    ${option}    IN    อิฐมวลเบา    อิฐมอญ    ผนังเบา
        WS Choose Radio    ชนิดผนัง    ${option}
        WS Radio Should Be Selected    ชนิดผนัง    ${option}
    END
    WS Choose Radio    ชนิดผนัง    อิฐมอญ
    FOR    ${option}    IN    ครึ่งแผ่น    เต็มแผ่น
        WS Choose Radio    ความหนาผนัง    ${option}
        WS Radio Should Be Selected    ความหนาผนัง    ${option}
    END
    WS Level Should Match Engine    door-window

Light Wall Hides The Thickness Choice And Confirms
    [Documentation]    A light (non-brick) wall has no thickness; the level still confirms.
    [Tags]    door-window    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    windows
    Fill Number By Label    กว้าง (ม.)    1.5
    Fill Number By Label    สูง (ม.)    1.2
    WS Choose Radio    ชนิดผนัง    ผนังเบา
    Get Element Count    css=[role="radiogroup"][aria-label="ความหนาผนัง"]    ==    0
    WS Level Should Match Engine    door-window
    WS Confirm Should Pass    door-window    brick

Aluminium And Wood Doors Both Count And Match The Engine
    [Documentation]    Material changes the price, not the quantity: same sizes, different material, engine agrees
    ...    each time.
    [Tags]    door-window
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    กว้าง (ม.)    1.0
    Fill Number By Label    สูง (ม.)    2.1
    WS Choose Radio    วัสดุบาน    อลูมิเนียม
    ${aluminium}=    WS Level Should Match Engine    door-window
    WS Choose Radio    วัสดุบาน    ไม้
    ${wood}=    WS Level Should Match Engine    door-window
    ${a}=    Expected Level    ${aluminium}    door-window
    ${w}=    Expected Level    ${wood}    door-window
    Should Not Be Equal As Numbers    ${a}[total]    ${w}[total]

Doors Can Be Added And Deleted Down To The Empty State
    [Documentation]    Add 3 doors, delete the middle one (asks first), then the last, then the only one: back to the
    ...    prompt.
    [Tags]    door-window
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    FOR    ${i}    IN RANGE    3
        WS Add Opening    doors
        Fill Number By Label    กว้าง (ม.)    ${{ 0.8 + ${i} / 10 }}    ${i}
        Fill Number By Label    สูง (ม.)    2.1    ${i}
    END
    WS Opening Card Count Should Be    3
    WS Delete Card Confirm    1
    WS Opening Card Count Should Be    2
    WS Box Should Show    css=[aria-label="กว้าง (ม.)"] >> nth=1    1.0
    WS Level Should Match Engine    door-window
    WS Delete Card Confirm    1
    WS Opening Card Count Should Be    1
    WS Delete Card Confirm    0
    WS Opening Card Count Should Be    0
    Get Text    css=body    contains    ยังไม่มีประตู
    WS Level Should Match Engine    door-window

An Untouched New Door Is Deleted Without Asking
    [Tags]    door-window    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Click    css=button[aria-label="ลบ"] >> nth=0
    Get Element Count    css=.ant-popover:not(.ant-popover-hidden)    ==    0
    WS Opening Card Count Should Be    0

Deleting The Only Opening After Confirming Blocks The Level Again
    [Documentation]    A done level whose last opening is removed lists what is missing again and does not move on.
    [Tags]    door-window    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    กว้าง (ม.)    0.9
    Fill Number By Label    สูง (ม.)    2.1
    WS Delete Card Confirm    0
    WS Confirm Should Be Blocked Naming    door-window    1    เพิ่มประตูหรือหน้าต่างอย่างน้อย 1 รายการ

Duplicating A Door Gives The Copy The Next Code
    [Tags]    door-window
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Text By Label    รหัส-รายการ (ตามตารางในแบบ)    D1-บานเปิดเดี่ยว
    Fill Number By Label    กว้าง (ม.)    0.9
    Fill Number By Label    สูง (ม.)    2.1
    Click    css=button[title="ทำซ้ำรายการนี้"] >> nth=0
    WS Opening Card Count Should Be    2
    ${name}=    Get Property    css=[aria-label="รหัส-รายการ (ตามตารางในแบบ)"] >> nth=1    value
    Should Start With    ${name}    D2-
    WS Box Should Show    css=[aria-label="กว้าง (ม.)"] >> nth=1    0.9
    WS Level Should Match Engine    door-window

Sixteen Openings Add Up To The Engine Total
    [Documentation]    One filled door duplicated 15 times: 16 cards, each 2.1 sqm, the table keeps working.
    [Tags]    door-window    slow    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    กว้าง (ม.)    1.0
    Fill Number By Label    สูง (ม.)    2.1
    FOR    ${_}    IN RANGE    15
        Click    css=button[title="ทำซ้ำรายการนี้"] >> nth=0
    END
    WS Opening Card Count Should Be    16
    WS Level Should Match Engine    door-window
    WS Confirm Should Pass    door-window    brick

Door Window Values Survive A Reload
    [Tags]    door-window    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Level Should Match Engine    door-window
    WS Reload And Wait
    WS Opening Card Count Should Be    3
    WS Box Should Show    css=[aria-label="กว้าง (ม.)"] >> nth=0    1.0
    WS Box Should Show    css=[aria-label="กว้าง (ม.)"] >> nth=2    1.5
    WS Box Should Show    css=[aria-label="จำนวน (บาน)"] >> nth=2    5    0.5
    WS Radio Should Be Selected    ติดตั้งที่ผนัง    ผนังภายในบ้าน    1
    WS Level Should Match Engine    door-window

Previous Arrow Of Door Window Leads To Roof Structure
    [Tags]    door-window    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    โครงหลังคา    roof-structure

Locked Door Window Level Shows The Waiting Screen
    [Documentation]    Opening /journey/door-window while roof-structure is not done shows a lock screen, nothing to
    ...    confirm.
    [Tags]    door-window    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=roof-structure
    WS Go To Locked Level    door-window    ประตู-หน้าต่าง
    Get Text    css=body    contains    ทำต่อ: โครงหลังคา

Confirmed Door Window Level Reopens As Done And Moves On
    [Documentation]    After confirming, the level shows "เสร็จแล้ว" and the bottom button goes to the next level
    ...    without re-checking.
    [Tags]    door-window    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Confirm Should Pass    door-window    brick
    WS Go To Level    door-window
    Get Text    css=body    contains    เสร็จแล้ว
    Click    css=button >> text="ไปขั้นตอนก่ออิฐ"
    Wait For Condition    Url    should end with    /journey/brick    timeout=180s

# ═════════════════════════════ 22 brick ═════════════════════════════

Blank Brick Level Totals Zero With The Empty Prompt
    [Tags]    brick
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    brick
    Get Text    css=body    contains    ยังไม่มีผนัง
    Get Text    css=body    contains    ยังไม่มีประตู-หน้าต่าง จึงยังไม่หักช่องเปิดออกจากผนัง
    WS Button Count Should Be    เพิ่มผนัง    1

Confirming A Blank Brick Level Is Blocked
    [Tags]    brick    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Confirm Should Be Blocked Naming    brick    1    เพิ่มผนังก่ออิฐอย่างน้อย 1 รายการ
    Level Mark Should Be    brick    ${None}

Brick Filled From The Plan Matches The Engine And Confirms
    [Documentation]    36 m + 9 m of wall, 2.8 m high, no openings yet: 100.80 + 25.20 sqm.
    [Tags]    brick    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    Fill Brick From Plan
    WS Level Should Match Engine    brick    positive=${TRUE}
    Get Text    css=body    contains    ก่อ 100.80 ตร.ม.
    Get Text    css=body    contains    ก่อ 25.20 ตร.ม.
    WS Confirm Should Pass    brick    plaster

Sample House Brick Matches The Engine And Confirms
    [Tags]    brick    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Level Should Match Engine    brick    positive=${TRUE}
    WS Confirm Should Pass    brick    plaster

Wall With Length But No Height Is Blocked Naming The Height
    [Documentation]    Half-filled wall: a length without a height has no area.
    [Tags]    brick    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    Fill Number By Label    ความยาวผนัง (ม.)    12
    WS Confirm Should Be Blocked Naming    brick    1    ความสูง
    Get Text    css=[role="alert"]:has-text("ยังต้องกรอก")    contains    ผนังที่ 1
    WS Level Total Should Be    0

Completing A Half Filled Wall Lets The Level Confirm
    [Tags]    brick    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    Fill Number By Label    ความยาวผนัง (ม.)    12
    Confirm Level Should Be Blocked    brick    1
    Fill Number By Label    ความสูงผนัง (ม.)    2.8
    WS Level Should Match Engine    brick
    WS Confirm Should Pass    brick    plaster

Wall With Height But No Length Is Not An Item
    [Documentation]    A height alone is not a wall: the level asks for at least one wall.
    [Tags]    brick    negative    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    Fill Number By Label    ความสูงผนัง (ม.)    2.8
    WS Confirm Should Be Blocked Naming    brick    1    เพิ่มผนังก่ออิฐอย่างน้อย 1 รายการ

Two Half Filled Walls Are Both Listed
    [Tags]    brick    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    Fill Number By Label    ความยาวผนัง (ม.)    12
    WS Add Wall
    Fill Number By Label    ความยาวผนัง (ม.)    5    1
    WS Confirm Should Be Blocked Naming    brick    2    ผนังที่ 1
    Get Text    css=[role="alert"]:has-text("ยังต้องกรอก")    contains    ผนังที่ 2

A New Wall Copies The Previous Height And Wall Type
    [Documentation]    UX rule: the second wall starts with the first wall's part, brick, thickness and height, so a
    ...    length is enough.
    [Tags]    brick
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    WS Fill Wall    0    ผนังภายนอกบ้าน    10    2.5    อิฐมวลเบา    เต็มแผ่น
    WS Add Wall
    WS Radio Should Be Selected    ส่วนผนัง    ผนังภายนอกบ้าน    1
    WS Radio Should Be Selected    ชนิดอิฐ    อิฐมวลเบา    1
    WS Radio Should Be Selected    ความหนา    เต็มแผ่น    1
    WS Box Should Show    css=[aria-label="ความสูงผนัง (ม.)"] >> nth=1    2.5
    Fill Number By Label    ความยาวผนัง (ม.)    4    1
    WS Level Should Match Engine    brick
    WS Confirm Should Pass    brick    plaster

Wall Length Edge Inputs Stay Finite And Match The Engine
    [Documentation]    Lengths accept sums and expressions; text keeps the old value; no NaN or Infinity reaches the
    ...    screen.
    [Tags]    brick    edge
    [Setup]    Open Wall With Height
    [Template]    Wall Edge Number
    ความยาวผนัง (ม.)    0    0
    ความยาวผนัง (ม.)    1,250.5    1250.5
    ความยาวผนัง (ม.)    =2.5*4    10
    ความยาวผนัง (ม.)    9.5+7+2    18.5
    ความยาวผนัง (ม.)    10+8+10+8    36
    ความยาวผนัง (ม.)    1e3    1000
    ความยาวผนัง (ม.)    -3    -3
    ความยาวผนัง (ม.)    abc    1
    ความยาวผนัง (ม.)    ${EMPTY}    0
    ความยาวผนัง (ม.)    1/0    1
    ความยาวผนัง (ม.)    99999999    99999999

Wall Height Edge Inputs Stay Finite And Match The Engine
    [Tags]    brick    edge
    [Setup]    Open Wall With Length
    [Template]    Wall Edge Number
    ความสูงผนัง (ม.)    0    0
    ความสูงผนัง (ม.)    1,250.5    1250.5
    ความสูงผนัง (ม.)    =2*1.4    2.8
    ความสูงผนัง (ม.)    1.4+1.4    2.8
    ความสูงผนัง (ม.)    -2.8    -2.8
    ความสูงผนัง (ม.)    abc    1
    ความสูงผนัง (ม.)    ${EMPTY}    0
    ความสูงผนัง (ม.)    99999999    99999999

Every Wall Choice Can Be Picked
    [Documentation]    Every option of wall part (4), brick (2), thickness (2) and shape (2) is selected once.
    [Tags]    brick
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    Fill Number By Label    ความยาวผนัง (ม.)    10
    Fill Number By Label    ความสูงผนัง (ม.)    2.8
    FOR    ${option}    IN    ผนังรอบบ้าน    ผนังภายในบ้าน    ผนังภายนอกบ้าน    ผนังรอบบ้าน-พิเศษ
        WS Choose Radio    ส่วนผนัง    ${option}
        WS Radio Should Be Selected    ส่วนผนัง    ${option}
    END
    FOR    ${option}    IN    อิฐมวลเบา    อิฐมอญ
        WS Choose Radio    ชนิดอิฐ    ${option}
        WS Radio Should Be Selected    ชนิดอิฐ    ${option}
    END
    FOR    ${option}    IN    เต็มแผ่น    ครึ่งแผ่น
        WS Choose Radio    ความหนา    ${option}
        WS Radio Should Be Selected    ความหนา    ${option}
    END
    FOR    ${option}    IN    สามเหลี่ยม (จั่ว)    สี่เหลี่ยม
        WS Choose Radio    รูปผนัง    ${option}
        WS Radio Should Be Selected    รูปผนัง    ${option}
    END
    WS Level Should Match Engine    brick

Triangle Gable Wall Counts Half Of Base Times Height
    [Documentation]    Gable: 10 m base x 3 m apex = 15 sqm (business rule: half of length x height); labels change.
    [Tags]    brick
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    WS Choose Radio    รูปผนัง    สามเหลี่ยม (จั่ว)
    Get Text    css=body    contains    ความกว้างฐานจั่ว (ม.)
    Fill Number By Label    ความยาวผนัง (ม.)    10
    Fill Number By Label    ความสูงยอดจั่ว (ม.)    3
    Get Text    css=body    contains    ก่อ 15.00 ตร.ม.
    WS Level Should Match Engine    brick
    WS Confirm Should Pass    brick    plaster

Walls Can Be Added Duplicated And Deleted Down To The Empty State
    [Tags]    brick
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    WS Fill Wall    0    ผนังรอบบ้าน    36    2.8
    WS Add Wall
    Fill Number By Label    ความยาวผนัง (ม.)    9    1
    WS Wall Card Count Should Be    2
    Click    css=button[title="ทำซ้ำรายการนี้"] >> nth=0
    WS Wall Card Count Should Be    3
    WS Box Should Show    css=[aria-label="ความยาวผนัง (ม.)"] >> nth=1    36
    WS Level Should Match Engine    brick
    WS Delete Card Confirm    1
    WS Wall Card Count Should Be    2
    WS Delete Card Confirm    1
    WS Wall Card Count Should Be    1
    WS Delete Card Confirm    0
    WS Wall Card Count Should Be    0
    Get Text    css=body    contains    ยังไม่มีผนัง
    WS Level Should Match Engine    brick

Sixteen Walls Add Up To The Engine Total
    [Documentation]    One 6 m wall duplicated 15 times: 16 cards and a progress line, totals equal the engine.
    [Tags]    brick    slow    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    WS Fill Wall    0    ผนังรอบบ้าน    6    2.8
    FOR    ${_}    IN RANGE    15
        Click    css=button[title="ทำซ้ำรายการนี้"] >> nth=0
    END
    WS Wall Card Count Should Be    16
    Get Text    css=body    contains    ผนัง
    WS Level Should Match Engine    brick
    Get Text    css=body    contains    ก่อ 16.80 ตร.ม.
    WS Confirm Should Pass    brick    plaster

Brick Values Survive A Reload
    [Tags]    brick    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    Fill Brick From Plan
    WS Level Should Match Engine    brick
    WS Reload And Wait
    WS Wall Card Count Should Be    2
    WS Box Should Show    css=[aria-label="ความยาวผนัง (ม.)"] >> nth=0    36
    WS Box Should Show    css=[aria-label="ความสูงผนัง (ม.)"] >> nth=1    2.8
    WS Radio Should Be Selected    ส่วนผนัง    ผนังภายในบ้าน    1
    WS Level Should Match Engine    brick

Previous Arrow Of Brick Leads To Door Window
    [Tags]    brick    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    ประตู-หน้าต่าง    door-window

Locked Brick Level Shows The Waiting Screen
    [Tags]    brick    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=door-window
    WS Go To Locked Level    brick    ก่ออิฐ
    Get Text    css=body    contains    ทำต่อ: ประตู-หน้าต่าง

Openings From Door Window Are Deducted From The Brick Walls
    [Documentation]    Cross-level: exterior openings 1.0*2.1 + 5*1.5*1.2 = 11.1 sqm and interior 2*0.8*2.0 = 3.2 sqm
    ...    come off the walls: 36*2.8 - 11.1 = 89.70 and 9*2.8 - 3.2 = 22.00 sqm.
    [Tags]    brick    door-window    cross-level    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=brick
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Level Should Match Engine    door-window
    WS Go To Level    brick
    Get Text    css=body    contains    ประตู-หน้าต่างรวม 14.30 ตร.ม.
    Fill Brick From Plan
    Get Text    css=body    contains    ก่อ 89.70 ตร.ม.
    Get Text    css=body    contains    ก่อ 22.00 ตร.ม.
    Get Text    css=body    contains    หักประตู-หน้าต่างแล้ว 11.10 ตร.ม.
    Get Text    css=body    contains    หักประตู-หน้าต่างแล้ว 3.20 ตร.ม.
    WS Level Should Match Engine    brick
    WS Confirm Should Pass    brick    plaster

Changing A Window In Door Window Changes The Brick Net Area
    [Documentation]    Widen W1 from 1.5 to 2.0 m: window area 5*2.0*1.2 = 12 sqm, exterior openings 14.1, wall 86.70
    ...    sqm.
    [Tags]    brick    door-window    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=brick
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Go To Level    brick
    Fill Brick From Plan
    Get Text    css=body    contains    ก่อ 89.70 ตร.ม.
    ${first}=    WS Level Should Match Engine    brick
    ${before}=    WS Total Of    ${first}    brick
    WS Go To Level    door-window
    Fill Number By Label    กว้าง (ม.)    2.0    2
    WS Go To Level    brick
    Get Text    css=body    contains    ก่อ 86.70 ตร.ม.
    ${after}=    WS Level Should Match Engine    brick
    ${lvl}=    Expected Level    ${after}    brick
    Should Not Be Equal As Numbers    ${before}    ${lvl}[total]

Removing All Openings Gives The Walls Back Their Full Area
    [Tags]    brick    door-window    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=brick
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Go To Level    brick
    Fill Brick From Plan
    Get Text    css=body    contains    ก่อ 89.70 ตร.ม.
    WS Go To Level    door-window
    WS Delete Card Confirm    2
    WS Delete Card Confirm    1
    WS Delete Card Confirm    0
    WS Opening Card Count Should Be    0
    WS Go To Level    brick
    Get Text    css=body    contains    ก่อ 100.80 ตร.ม.
    Get Text    css=body    contains    ยังไม่มีประตู-หน้าต่าง
    WS Level Should Match Engine    brick

An Opening With No Matching Wall Shows A Warning And Adds The Wall
    [Documentation]    A door on "ผนังภายนอกบ้าน" with no such wall: the warning names it; "เพิ่มผนังนี้" adds the
    ...    wall with the same part.
    [Tags]    brick    door-window    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=brick
    WS Wait For Level Page
    WS Add Opening    doors
    WS Fill Opening    0    D1-ประตูซักล้าง    ไม้    1    0.9    2.0    ผนังภายนอกบ้าน
    WS Go To Level    brick
    Get Text    css=body    contains    มีประตู-หน้าต่างที่ยังไม่มีผนังชนิดเดียวกัน
    WS Click Button    เพิ่มผนังนี้
    WS Wall Card Count Should Be    1
    WS Radio Should Be Selected    ส่วนผนัง    ผนังภายนอกบ้าน
    Fill Number By Label    ความยาวผนัง (ม.)    5
    Fill Number By Label    ความสูงผนัง (ม.)    2.8
    Get Element Count    css=.ant-alert    ==    0
    Get Text    css=body    contains    ก่อ 12.20 ตร.ม.
    WS Level Should Match Engine    brick

Walls Can Be Added For Every Opening Group At Once
    [Documentation]    With 2+ opening groups and no wall yet, the empty state offers one button that adds a wall per
    ...    group.
    [Tags]    brick    door-window    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=brick
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Go To Level    brick
    Click    css=button >> text="เพิ่มผนังตามประตู-หน้าต่าง (2 กลุ่ม)"
    WS Wall Card Count Should Be    2
    WS Radio Should Be Selected    ส่วนผนัง    ผนังรอบบ้าน    0
    WS Radio Should Be Selected    ส่วนผนัง    ผนังภายในบ้าน    1
    Fill Number By Label    ความยาวผนัง (ม.)    36    0
    Fill Number By Label    ความสูงผนัง (ม.)    2.8    0
    Fill Number By Label    ความยาวผนัง (ม.)    9    1
    Get Text    css=body    contains    ก่อ 89.70 ตร.ม.
    WS Level Should Match Engine    brick

Openings In A Light Wall Are Not Deducted And Raise No Warning
    [Documentation]    Light (non-brick) walls are not in the brick step: their openings never come off the brick
    ...    area.
    [Tags]    brick    door-window    cross-level    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=brick
    WS Wait For Level Page
    WS Add Opening    windows
    WS Fill Opening    0    W1-หน้าต่างผนังเบา    อลูมิเนียม    2    1.5    1.2    ผนังรอบบ้าน    ผนังเบา
    WS Go To Level    brick
    Get Element Count    css=.ant-alert    ==    0
    WS Add Wall
    WS Fill Wall    0    ผนังรอบบ้าน    10    2.8
    Get Text    css=body    contains    ก่อ 28.00 ตร.ม.
    WS Level Should Match Engine    brick

Openings Bigger Than The Wall Are Flagged And Stay Finite
    [Documentation]    A 5 m^2 wall with 11.1 sqm of openings: net area negative, the card warns, nothing is NaN.
    [Tags]    brick    door-window    cross-level    edge    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=brick
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Go To Level    brick
    WS Add Wall
    WS Fill Wall    0    ผนังรอบบ้าน    2    2.5
    Get Text    css=body    contains    ประตู-หน้าต่างมากกว่าพื้นที่ผนัง
    WS Level Should Match Engine    brick

# ═════════════════════════════ 23 plaster ═════════════════════════════

Blank Plaster Level Totals Zero And Says There Are No Walls
    [Tags]    plaster
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/plaster    unlock_until=plaster
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    plaster
    Get Text    css=body    contains    ยังไม่มีผนังก่ออิฐ

Blank Plaster Level Confirms Because Nothing Is Required
    [Documentation]    REQUIRED_FIELDS: plaster has no required value (everything is derived from the walls).
    [Tags]    plaster
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/plaster    unlock_until=plaster
    WS Wait For Level Page
    WS Confirm Should Pass    plaster    electrical-pipe

Plaster Area Follows The Brick Walls Of The Plan
    [Documentation]    Cross-level: the exterior wall (89.70 sqm net) is plastered 1 side inside + 1 side outside, the
    ...    interior wall (22.00 sqm) 2 sides inside, plus the 31.24 sqm column/beam surface outside.
    ...    Inside = 89.70 + 2*22.00 = 133.70, outside = 89.70 + 31.24 = 120.94, total 254.64 sqm.
    [Tags]    plaster    brick    cross-level    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=plaster
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Go To Level    brick
    Fill Brick From Plan
    WS Go To Level    plaster
    Fill Plaster From Plan
    Get Text    css=body    contains    ผนัง 89.70 ตร.ม. ต่อด้าน
    Get Text    css=body    contains    ผนัง 22.00 ตร.ม. ต่อด้าน
    Get Text    css=body    contains    133.70
    Get Text    css=body    contains    120.94
    Get Text    css=body    contains    254.64
    WS Level Should Match Engine    plaster    positive=${TRUE}
    WS Confirm Should Pass    plaster    electrical-pipe

Changing A Brick Wall Changes The Plaster Total Like The Engine
    [Documentation]    Cross-level: lengthen the exterior wall from 36 to 40 m (no openings): plaster follows.
    [Tags]    plaster    brick    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=plaster
    WS Wait For Level Page
    Fill Brick From Plan
    WS Go To Level    plaster
    ${first}=    WS Level Should Match Engine    plaster
    ${before}=    WS Total Of    ${first}    plaster
    WS Go To Level    brick
    Fill Number By Label    ความยาวผนัง (ม.)    40    0
    WS Go To Level    plaster
    Get Text    css=body    contains    ผนัง 112.00 ตร.ม. ต่อด้าน
    ${after_expected}=    WS Level Should Match Engine    plaster
    ${lvl}=    Expected Level    ${after_expected}    plaster
    Should Not Be Equal As Numbers    ${before}    ${lvl}[total]

Deleting Every Brick Wall Empties The Plaster Level
    [Tags]    plaster    brick    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=plaster
    WS Wait For Level Page
    Fill Brick From Plan
    WS Go To Level    plaster
    WS Level Should Match Engine    plaster
    WS Go To Level    brick
    WS Delete Card Confirm    1
    WS Delete Card Confirm    0
    WS Wall Card Count Should Be    0
    WS Go To Level    plaster
    WS Level Total Should Be    0
    Get Text    css=body    contains    ยังไม่มีผนังก่ออิฐ
    WS Level Should Match Engine    plaster

Wall Part Without A Brick Wall Is Marked On The Plaster Level
    [Documentation]    With only an exterior wall, the interior part says it has no wall in the brick step.
    [Tags]    plaster    brick    cross-level    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=plaster
    WS Wait For Level Page
    WS Add Wall
    WS Fill Wall    0    ผนังรอบบ้าน    36    2.8
    WS Go To Level    plaster
    Get Text    css=body    contains    ไม่มีผนังนี้ในขั้นตอนก่ออิฐ
    Get Text    css=body    contains    ผนัง 100.80 ตร.ม. ต่อด้าน
    WS Level Should Match Engine    plaster

Plaster Door Deduction Flows Through Two Levels
    [Documentation]    Door-window -> brick -> plaster: the plaster exterior part shows the net 89.70, not the gross
    ...    100.80.
    [Tags]    plaster    brick    door-window    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=plaster
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Go To Level    brick
    Fill Brick From Plan
    WS Go To Level    plaster
    Get Text    css=body    contains    ผนัง 89.70 ตร.ม. ต่อด้าน
    Get Element Count    css=body >> text=ผนัง 100.80 ตร.ม. ต่อด้าน    ==    0
    WS Level Should Match Engine    plaster

Structural Surface Edge Inputs Stay Finite And Match The Engine
    [Documentation]    The column/beam area per side accepts sums; text keeps the old value; negative and huge stay
    ...    finite.
    [Tags]    plaster    edge
    [Setup]    Open Plaster With Walls
    [Template]    Plaster Edge Number
    0    0
    1,250.5    1250.5
    =25+6.24    31.24
    25+6.24    31.24
    -5    -5
    abc    1
    ${EMPTY}    0
    1/0    1
    99999999    99999999

Plaster Sides Choices Change The Total Like The Engine
    [Documentation]    Every option of "กี่ด้าน" (ไม่ฉาบ / 1 ด้าน / 2 ด้าน) on the exterior-inside row; the area
    ...    scales with the sides.
    [Tags]    plaster    brick    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=plaster
    WS Wait For Level Page
    Fill Brick From Plan
    WS Go To Level    plaster
    VAR    ${group}    ผนังรอบบ้าน ฉาบด้านใน กี่ด้าน
    FOR    ${option}    IN    ไม่ฉาบ    2 ด้าน    1 ด้าน
        WS Choose Radio    ${group}    ${option}
        WS Radio Should Be Selected    ${group}    ${option}
        WS Level Should Match Engine    plaster
    END

Every Plaster Row Offers The Same Three Side Choices
    [Documentation]    Each wall part row (exterior wall in/out, interior, outside wall, special, structure) has its
    ...    own choice group.
    [Tags]    plaster
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/plaster    unlock_until=plaster
    WS Wait For Level Page
    Get Element Count    css=[role="radiogroup"][aria-label$="กี่ด้าน"]    ==    7
    FOR    ${group}    IN
    ...    ผนังรอบบ้าน ฉาบด้านใน กี่ด้าน
    ...    ผนังรอบบ้าน ฉาบด้านนอก กี่ด้าน
    ...    ผนังภายในบ้าน ฉาบด้านใน กี่ด้าน
    ...    ผนังภายนอกบ้าน ฉาบด้านนอก กี่ด้าน
    ...    ผนังรอบบ้าน-พิเศษ ฉาบด้านใน กี่ด้าน
    ...    ผนังรอบบ้าน-พิเศษ ฉาบด้านนอก กี่ด้าน
    ...    ผนังโครงสร้าง ฉาบด้านนอก กี่ด้าน
        FOR    ${option}    IN    ไม่ฉาบ    1 ด้าน    2 ด้าน
            WS Choose Radio    ${group}    ${option}
            WS Radio Should Be Selected    ${group}    ${option}
        END
    END
    WS Level Should Match Engine    plaster

Plaster Values Survive A Reload
    [Tags]    plaster    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=plaster
    WS Wait For Level Page
    Fill Brick From Plan
    WS Go To Level    plaster
    Fill Plaster From Plan
    WS Level Should Match Engine    plaster
    WS Reload And Wait
    WS Box Should Show    css=[aria-label="พื้นที่ผิวเสา-คาน ต่อด้าน (ตร.ม.)"]    31.24
    Get Text    css=body    contains    ผนัง 100.80 ตร.ม. ต่อด้าน
    WS Level Should Match Engine    plaster

Previous Arrow Of Plaster Leads To Brick
    [Tags]    plaster    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/plaster    unlock_until=plaster
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    ก่ออิฐ    brick

Locked Plaster Level Shows The Waiting Screen
    [Tags]    plaster    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/plaster    unlock_until=brick
    WS Go To Locked Level    plaster    ฉาบปูน
    Get Text    css=body    contains    ทำต่อ: ก่ออิฐ

Sample House Plaster Matches The Engine And Confirms
    [Tags]    plaster    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/plaster    unlock_until=plaster
    WS Wait For Level Page
    WS Level Should Match Engine    plaster    positive=${TRUE}
    WS Confirm Should Pass    plaster    electrical-pipe

# ═════════════════════════════ whole stretch ═════════════════════════════

Levels 21 To 23 Can Be Filled And Confirmed In Order From A Blank Project
    [Documentation]    Doors and windows, brick walls and plaster one after the other with the page-object keywords:
    ...    each confirm opens the next level and every level total equals the engine on the way. Ends on
    ...    the conduit level.
    [Tags]    smoke    slow    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    Fill Door Window From Plan
    WS Level Should Match Engine    door-window
    WS Confirm Should Pass    door-window    brick
    WS Wait For Level Page
    Fill Brick From Plan
    WS Level Should Match Engine    brick
    Get Text    css=body    contains    ก่อ 89.70 ตร.ม.
    WS Confirm Should Pass    brick    plaster
    WS Wait For Level Page
    Fill Plaster From Plan
    WS Level Should Match Engine    plaster
    Get Text    css=body    contains    254.64
    WS Confirm Should Pass    plaster    electrical-pipe

*** Keywords ***
Close Test Context
    [Documentation]    Free the browser context of the finished test (a failure screenshot was already taken).
    Run Keyword And Ignore Error    Close Context

Open Door With Height
    [Documentation]    Door-window level with one door whose height is 2.1 m (width still empty).
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    สูง (ม.)    2.1

Open Door With Width
    [Documentation]    Door-window level with one door whose width is 0.9 m (height still empty).
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    กว้าง (ม.)    0.9

Open Door With Size
    [Documentation]    Door-window level with one door of 0.9 x 2.1 m.
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/door-window    unlock_until=door-window
    WS Wait For Level Page
    WS Add Opening    doors
    Fill Number By Label    กว้าง (ม.)    0.9
    Fill Number By Label    สูง (ม.)    2.1

Door Edge Number
    [Documentation]    Edge input ``${typed}`` into the door box ``${label}``; the box must then show ``${shown}``.
    [Arguments]    ${label}    ${typed}    ${shown}
    WS Edge Number    door-window    ${label}    ${typed}    ${shown}

Door Count Edge Number
    [Documentation]    Edge input ``${typed}`` into the leaf count; the box must then show ``${shown}``.
    [Arguments]    ${typed}    ${shown}
    WS Edge Number    door-window    จำนวน (บาน)    ${typed}    ${shown}    tolerance=0.5

Open Wall With Height
    [Documentation]    Brick level with one wall whose height is 2.8 m (length still empty).
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    Fill Number By Label    ความสูงผนัง (ม.)    2.8

Open Wall With Length
    [Documentation]    Brick level with one wall of 12 m length (height still empty).
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=brick
    WS Wait For Level Page
    WS Add Wall
    Fill Number By Label    ความยาวผนัง (ม.)    12

Wall Edge Number
    [Documentation]    Edge input ``${typed}`` into the wall box ``${label}``; the box must then show ``${shown}``.
    [Arguments]    ${label}    ${typed}    ${shown}
    WS Edge Number    brick    ${label}    ${typed}    ${shown}

Open Plaster With Walls
    [Documentation]    Plaster level of a project whose brick level holds the plan's two walls.
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/brick    unlock_until=plaster
    WS Wait For Level Page
    Fill Brick From Plan
    WS Go To Level    plaster

Plaster Edge Number
    [Documentation]    Edge input ``${typed}`` into the column/beam surface; the box must then show ``${shown}``.
    [Arguments]    ${typed}    ${shown}
    WS Edge Number    plaster    พื้นที่ผิวเสา-คาน ต่อด้าน (ตร.ม.)    ${typed}    ${shown}
