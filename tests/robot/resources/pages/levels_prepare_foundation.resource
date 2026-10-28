*** Settings ***
Documentation       Page objects of journey levels 1-11 (prepare + foundation): project-info, land-inspection,
...                 demolition, fill, temp-utilities, site-camp, layout, piles, footing, pedestal, ground-beam.
...
...                 One ``Fill <Level> From Plan`` keyword per level fills the level's open page with the values of the
...                 test house (1 storey, about 8 x 10 m on a 15 x 20 m plot, 12 footings of 2 types, 12 pedestals,
...                 2 ground-beam types, 12 piles). A Fill keyword never confirms and never navigates: the caller
...                 confirms (``Confirm Level``). Every keyword expects the level page of a BLANK project that is open
...                 and unlocked (``Open Level``), so the 37-level full run can call them one after another.
...                 Cards are found by their ``data-req-card`` id (``<list>#<index>``), inputs by aria-label.
Resource            ../journey.resource


*** Variables ***
${MISSING_ALERT}        css=[role="alert"]:has-text("ยังต้องกรอก")
${LEVEL_TOTAL_LABEL}    css=div:text-is("มูลค่าขั้นตอนนี้")
${PRE_CONSTRUCTION}     text=ค่าใช้จ่ายก่อนเริ่มงาน ไม่รวมในราคาค่าก่อสร้าง
${MAP_BUTTON}           css=button[aria-label="ภาพรวมขั้นตอน"]
${PREVIOUS_ARROW}       css=button[aria-label^="ขั้นตอนก่อนหน้า"]
${SKIP_CANCEL}          css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button >> text="ยกเลิก"


*** Keywords ***
Prepare Suite
    [Documentation]    Suite setup: the browser, plus the two start projects (``blank`` / ``sample``) and the level ids
    ...    from the engine, computed once (each engine call starts ``tsx``, which is slow on a busy machine).
    Open Browser For Suite
    ${blank}=    Compute Expected For New Project    blank
    ${sample}=    Compute Expected For New Project    sample
    ${ids}=    Level Ids
    VAR    ${START_BLANK}    ${blank}[project]    scope=SUITE
    VAR    ${START_SAMPLE}    ${sample}[project]    scope=SUITE
    VAR    ${LEVEL_IDS}    ${ids}    scope=SUITE

Open Level
    [Documentation]    Fresh browser context, a guest project (``blank`` or ``sample``, from ``Prepare Suite``) with
    ...    every level before ``${level}`` done, and the page of ``${level}`` open. Starts on a static file
    ...    (``/file.svg``) so only one app page load happens per test (dev-mode compiles and a busy shared server
    ...    make each load expensive).
    [Arguments]    ${level}    ${start}=blank
    ${base}=    Set Variable If    '${start}' == 'sample'    ${START_SAMPLE}    ${START_BLANK}
    ${project}=    Evaluate
    ...    {**$base, 'journey': {i: 'done' for i in $LEVEL_IDS[:$LEVEL_IDS.index($level)]}}
    Open Fresh Context    /file.svg
    Seed Guest Project    ${project}    /journey/${level}
    Wait For Elements State    ${MAP_BUTTON}    visible    timeout=120s
    Page Should Have No Error Overlay

Reload Level Page
    [Documentation]    Browser reload (values live in localStorage) and wait for the level page again.
    Reload
    Wait For Elements State    ${MAP_BUTTON}    visible    timeout=60s
    Page Should Have No Error Overlay

Card Input
    [Documentation]    Selector of the input named ``${label}`` inside card ``${index}`` (0-based) of list ``${list}``
    ...    (``rows`` footing/pedestal, ``beams`` ground beam, ``items`` demolition).
    [Arguments]    ${list}    ${index}    ${label}
    RETURN    css=[data-req-card="${list}#${index}"] [aria-label="${label}"]

Fill Card Number
    [Arguments]    ${list}    ${index}    ${label}    ${value}
    ${sel}=    Card Input    ${list}    ${index}    ${label}
    Click    ${sel}
    Fill Text    ${sel}    ${value}
    Keyboard Key    press    Enter

Fill Card Text
    [Arguments]    ${list}    ${index}    ${label}    ${value}
    Fill Card Number    ${list}    ${index}    ${label}    ${value}

Choose Card Bar Size
    [Documentation]    Click bar size ``${size}`` (DB12 ...) of the bar group ``${group}`` inside a card.
    [Arguments]    ${list}    ${index}    ${group}    ${size}
    Click    css=[data-req-card="${list}#${index}"] [role="radiogroup"][aria-label="${group} ขนาดเหล็ก"] >> text="${size}"

Ensure Cards
    [Documentation]    Click the add button (button containing ``${add_text}``) until ``${count}`` cards of ``${list}`` exist.
    [Arguments]    ${list}    ${count}    ${add_text}
    FOR    ${i}    IN RANGE    ${count}
        ${n}=    Get Element Count    css=[data-req-card^="${list}#"]
        IF    ${n} > ${i}    CONTINUE
        Click    css=button:has-text("${add_text}")
        Wait For Elements State    css=[data-req-card="${list}#${i}"]    visible
    END

Choose Yes Answer
    [Documentation]    Land inspection question ``${number}`` (2-5) answered "ใช่".
    [Arguments]    ${number}
    Click    css=[aria-label="คำตอบข้อ ${number}"] >> text="ใช่"

Choose No Answer
    [Arguments]    ${number}
    Click    css=[aria-label="คำตอบข้อ ${number}"] >> text="ไม่ใช่"

Choose Pile Type
    [Arguments]    ${type}
    Click    css=[role="radiogroup"][aria-label="ชนิดเสาเข็ม"] >> text="${type}"

Choose Pile Section
    [Documentation]    Pick ``${option}`` in the "หน้าตัด / รูปทรง" dropdown. The list is virtual (only the first rows
    ...    are in the DOM), so it is scrolled until the option appears.
    [Arguments]    ${option}
    # Click the Select box, not its input: once a value is chosen the value text covers the input.
    Click    css=.ant-select:has([aria-label="หน้าตัด / รูปทรง"])
    ${dropdown}=    Set Variable    css=.ant-select-dropdown:not(.ant-select-dropdown-hidden)
    FOR    ${i}    IN RANGE    10
        ${found}=    Get Element Count    ${dropdown} .ant-select-item-option >> text="${option}"
        IF    ${found} > 0    BREAK
        Scroll By    ${dropdown} .rc-virtual-list-holder    vertical=120
    END
    Click    ${dropdown} .ant-select-item-option >> text="${option}"

Input Should Show
    [Documentation]    The input named ``${label}`` (n-th match) displays ``${shown}`` ("" = empty box).
    [Arguments]    ${label}    ${shown}    ${index}=0
    ${sel}=    Input By Label    ${label}    ${index}
    Get Property    ${sel}    value    ==    ${shown}
    Negative Warning Should Follow    ${sel}    ${shown}

Card Input Should Show
    [Arguments]    ${list}    ${index}    ${label}    ${shown}
    ${sel}=    Card Input    ${list}    ${index}    ${label}
    Get Property    ${sel}    value    ==    ${shown}
    Negative Warning Should Follow    ${sel}    ${shown}

Negative Warning Should Follow
    [Documentation]    A value below 0 is kept and computed as typed (owner decision: warn, do not block): its cell has
    ...    the amber "ค่าติดลบ" warning (``data-warning="negative"`` and the tooltip); any other value has none.
    [Arguments]    ${sel}    ${shown}
    ${attrs}=    Evaluate JavaScript    ${sel}    (e) => [e.getAttribute('data-warning'), e.getAttribute('title') || '']
    IF    $shown.startswith('-') and $shown.strip('-0.,') != ''
        Should Be Equal    ${attrs}[0]    negative
        Should Contain    ${attrs}[1]    ค่าติดลบ
    ELSE
        Should Be Equal    ${attrs}[0]    ${None}
    END

Page Should Show No Invalid Numbers
    [Documentation]    No NaN / Infinity / undefined anywhere on the level page.
    Get Text    body    not contains    NaN
    Get Text    body    not contains    Infinity
    Get Text    body    not contains    undefined
    Page Should Have No Error Overlay

Level Totals Should Match Engine Eventually
    [Documentation]    ``Level Totals Should Match Engine`` retried while the store flushes to localStorage
    ...    and React renders (the screen is read without waiting).
    [Arguments]    ${level_id}
    ${expected}=    Wait Until Keyword Succeeds    90s    500ms    Level Totals Should Match Engine    ${level_id}
    Page Should Show No Invalid Numbers
    RETURN    ${expected}

Construction Total Should Match Engine Eventually
    [Documentation]    For a level without its own total (project info): only the bar's construction total.
    ${expected}=    Wait Until Keyword Succeeds    90s    500ms    Construction Total Matches Stored Project
    RETURN    ${expected}

Construction Total Matches Stored Project
    ${expected}=    Expected For Current Guest Project
    Construction Total Should Be    ${expected}[constructionTotal]
    RETURN    ${expected}

Level Total Should Be Eventually
    [Arguments]    ${expected}    ${tolerance}=0.5
    Wait Until Keyword Succeeds    10s    300ms    Level Total Should Be    ${expected}    ${tolerance}

Level Mark Should Become
    [Documentation]    ``Level Mark Should Be`` retried (the store writes after React commits).
    [Arguments]    ${level_id}    ${mark}
    Wait Until Keyword Succeeds    10s    300ms    Level Mark Should Be    ${level_id}    ${mark}

Confirm Level And Land On
    [Documentation]    Press confirm and wait for ``${next_level}`` (the first load of a route can take a while in
    ...    dev mode); then the level is stored as done.
    [Arguments]    ${level_id}    ${next_level}
    ${path}=    Landing Path After Confirm    ${level_id}    ${next_level}
    Click    ${CONFIRM_BUTTON}
    Wait For Condition    Url    should end with    ${path}    timeout=90s
    Level Mark Should Become    ${level_id}    done

Confirm Should Be Blocked With
    [Documentation]    Confirm does not move on: "ยังต้องกรอก ${count} รายการ" and ``${text}`` is in the list.
    [Arguments]    ${level_id}    ${count}    ${text}
    Confirm Level Should Be Blocked    ${level_id}    ${count}
    Get Text    ${MISSING_ALERT}    contains    ${text}
    Level Mark Should Be    ${level_id}    ${None}

Construction Total On Screen
    [Documentation]    The bar's construction total as a number.
    ${text}=    Get Text    ${CONSTRUCTION_TOTAL}
    ${value}=    Parse Thai Number    ${text}
    RETURN    ${value}

Level Total On Screen
    ${text}=    Get Text    ${LEVEL_TOTAL}
    ${value}=    Parse Thai Number    ${text}
    RETURN    ${value}

Level Should Show No Own Total
    [Documentation]    The meta level (project info) has no "มูลค่าขั้นตอนนี้".
    Get Element Count    ${LEVEL_TOTAL_LABEL}    ==    0

Locked Level Should Wait For Previous
    [Documentation]    ``${locked_id}`` opened by URL shows 'ขั้นตอน "…" ยังไม่พร้อมทำ', what it waits for (as the
    ...    engine lists it) and a way to the step to do first, never a crash.
    [Arguments]    ${locked_id}    ${locked_title}
    Go To Path    /journey/${locked_id}
    Locked Screen Should Match Engine    ${locked_id}    ${locked_title}
    Get Element Count    css=button:has-text("ทำต่อ:")    ==    1
    Page Should Have No Error Overlay

Previous Arrow Should Lead To
    [Arguments]    ${previous_id}
    Click    ${PREVIOUS_ARROW}
    Wait For Condition    Url    should end with    /journey/${previous_id}    timeout=90s
    Wait For Elements State    ${MAP_BUTTON}    visible    timeout=60s

Map Button Should Open Overview
    Click    ${MAP_BUTTON}
    Wait For Condition    Url    should end with    /journey    timeout=90s
    Page Should Have No Error Overlay

Edge Value Is Handled
    [Documentation]    Type ``${typed}`` into the number cell ``${label}`` (n-th match) after it held ``${initial}``:
    ...    the box shows ``${shown}`` (arithmetic evaluated, letters / division by zero keep the old value, an empty
    ...    cell goes back to empty), nothing shows NaN / Infinity, and the level totals equal the engine.
    [Arguments]    ${level_id}    ${label}    ${index}    ${typed}    ${shown}    ${initial}=5
    Fill Number By Label    ${label}    ${initial}    ${index}
    Fill Number By Label    ${label}    ${typed}    ${index}
    Input Should Show    ${label}    ${shown}    ${index}
    Level Totals Should Match Engine Eventually    ${level_id}

Edge Card Value Is Handled
    [Arguments]    ${level_id}    ${list}    ${card}    ${label}    ${typed}    ${shown}    ${initial}=5
    Fill Card Number    ${list}    ${card}    ${label}    ${initial}
    Fill Card Number    ${list}    ${card}    ${label}    ${typed}
    Card Input Should Show    ${list}    ${card}    ${label}    ${shown}
    Level Totals Should Match Engine Eventually    ${level_id}

Delete Card
    [Documentation]    Delete card ``${index}``; a card that holds values asks first (Popconfirm "ลบ").
    [Arguments]    ${list}    ${index}    ${asks}=${True}
    Click    css=[data-req-card="${list}#${index}"] button[aria-label="ลบ"]
    IF    ${asks}    Click Popconfirm Ok    ลบ

Duplicate Card
    [Arguments]    ${list}    ${index}
    Click    css=[data-req-card="${list}#${index}"] button:has-text("ทำซ้ำ")

Reset Level To Default
    [Documentation]    "ค่าเริ่มต้น" in the BOQ detail header, then Popconfirm "ล้าง".
    Click    css=button:has-text("ค่าเริ่มต้น")
    Click Popconfirm Ok    ล้าง

Fill Project Info From Plan
    [Documentation]    Level 1 "ข้อมูลโครงการ". Name "บ้านพักอาศัย คสล. 1 ชั้น (ทดสอบ E2E)", site "ต.บางใหญ่ อ.บางใหญ่
    ...    จ.นนทบุรี", owner "คุณสมชาย ใจดี", prepared by "หจก. ทดสอบก่อสร้าง", document date = today ("วันนี้").
    ...    Requires: nothing. Total: none (meta level).
    Fill Text By Label    ชื่อโครงการ    บ้านพักอาศัย คสล. 1 ชั้น (ทดสอบ E2E)
    Fill Text By Label    สถานที่ก่อสร้าง    ต.บางใหญ่ อ.บางใหญ่ จ.นนทบุรี
    Fill Text By Label    เจ้าของบ้าน    คุณสมชาย ใจดี
    Fill Text By Label    ผู้จัดทำ BOQ    หจก. ทดสอบก่อสร้าง
    Click    css=button:has-text("วันนี้")

Fill Land Inspection From Plan
    [Documentation]    Level 2 "ตรวจสอบที่ดิน". Checklist: Q1 written (deed no.), Q2-Q5 answered "ใช่"; survey date
    ...    "27/10/2569", inspector "ช่างสมศักดิ์"; cost quantities: 2 days, 2 trips, 1 night, 1 job
    ...    (2x1,500 + 2x2,500 + 1,200 + 800 = 10,000 baht, outside the construction total).
    Fill Text By Label    บันทึกข้อ 1    โฉนดเลขที่ 12345 ต.บางใหญ่ อ.บางใหญ่ จ.นนทบุรี
    FOR    ${q}    IN    2    3    4    5
        Choose Yes Answer    ${q}
    END
    Fill Text By Label    วันที่เข้าสำรวจ    27/10/2569
    Fill Text By Label    ผู้ตรวจสอบ    ช่างสมศักดิ์
    Fill Number By Label    จำนวน    2    0
    Fill Number By Label    จำนวน    2    1
    Fill Number By Label    จำนวน    1    2
    Fill Number By Label    จำนวน    1    3

Fill Demolition From Plan
    [Documentation]    Level 3 "รื้อถอน" (optional). Old fence 18 sq.m at 150 (card 4), site clearing 200 sq.m at
    ...    25 (card 6), 4 truck trips at 1,500 (card 7): 2,700 + 5,000 + 6,000 = 13,700 baht.
    Fill Card Number    items    3    ปริมาณ (ตร.ม.)    18
    Fill Card Number    items    3    ค่ารื้อต่อหน่วย (บาท/ตร.ม.)    150
    Fill Card Number    items    5    ปริมาณ (ตร.ม.)    200
    Fill Card Number    items    5    ค่ารื้อต่อหน่วย (บาท/ตร.ม.)    25
    Fill Card Number    items    6    ปริมาณ (เที่ยว)    4
    Fill Card Number    items    6    ค่ารื้อต่อหน่วย (บาท/เที่ยว)    1500

Fill Earth Fill From Plan
    [Documentation]    Level 4 "ถมดิน" (optional; the page title is "ถมดิน", English "Earth Fill"). Area 15 x 20 m,
    ...    fill height 0.5 m, material "ดินถมคัดเกรด" (settlement allowance keeps its standard value).
    Fill Number By Label    ความกว้างพื้นที่ถม    15
    Fill Number By Label    ความยาวพื้นที่ถม    20
    Fill Number By Label    ความสูงถม (ม.)    0.5
    Fill Text By Label    วัสดุถม    ดินถมคัดเกรด

Fill Temporary Utilities From Plan
    [Documentation]    Level 5 "น้ำ-ไฟชั่วคราว". Power run 30 m, water run 20 m, 2 water points, 3 light/plug sets.
    Fill Number By Label    ระยะเดินสายไฟ จากมิเตอร์ถึงหน้างาน    30
    Fill Number By Label    ระยะเดินท่อน้ำ จากมิเตอร์ถึงหน้างาน    20
    Fill Number By Label    จำนวนจุดใช้น้ำ    2
    Fill Number By Label    จำนวนจุดไฟ / ปลั๊ก    3

Fill Site Camp From Plan
    [Documentation]    Level 6 "แคมป์คนงาน". 1 worker room, 1 toilet, 1 shower, 1 store (steppers typed).
    Fill Number By Label    จำนวนห้องพักคนงาน    1
    Fill Number By Label    จำนวนห้องน้ำ    1
    Fill Number By Label    จำนวนห้องอาบน้ำ    1
    Fill Number By Label    จำนวนสโตร์เก็บของ    1

Fill Layout From Plan
    [Documentation]    Level 7 "วางผัง / ปักหมุด". 16 layout points (grid of the 8 x 10 m house) and 12 stakes
    ...    (= the 12 piles).
    Fill Number By Label    จำนวนจุดวางผัง    16
    Fill Number By Label    จำนวนหมุด    12

Fill Piles From Plan
    [Documentation]    Level 8 "เสาเข็ม" (optional). Driven piles "เสาเข็มตอก", section "I - 22 x 22", 12 m long,
    ...    12 piles (one per footing), extra spec "รับน้ำหนัก 15 ตัน/ต้น". Price per pile keeps its standard value.
    Choose Pile Type    เสาเข็มตอก
    Choose Pile Section    I - 22 x 22
    Fill Number By Label    ความยาวต่อต้น (ม.)    12
    Fill Number By Label    จำนวนเสาเข็มทั้งหมด    12
    Fill Text By Label    รายละเอียดเพิ่มเติม (ถ้ามี)    รับน้ำหนัก 15 ตัน/ต้น

Fill Footing From Plan
    [Documentation]    Level 9 "ฐานราก". Two cards from an empty list: F1 8 footings 1.20 x 1.20 x 0.30 m, pit 1.50 m,
    ...    short/long bars 6-DB12, ring 2 x RB9; F2 4 footings 1.00 x 1.00 x 0.30 m, pit 1.30 m, bars 5-DB12,
    ...    ring 2 x RB9. Total 12 footings. Starts from a footing list with no cards (adds the missing cards).
    Ensure Cards    rows    2    เพิ่มฐานราก
    Fill Footing Card    0    8    1.2    1.2    0.3    1.5    6
    Fill Footing Card    1    4    1    1    0.3    1.3    5

Fill Footing Card
    [Documentation]    One footing card: count, width, length, thickness, pit depth, bar count (short = long), 2 rings.
    [Arguments]    ${card}    ${count}    ${width}    ${length}    ${depth}    ${pit}    ${bars}
    Fill Card Number    rows    ${card}    จำนวนฐานแบบนี้ (ฐาน)    ${count}
    Fill Card Number    rows    ${card}    ความกว้าง (ม.)    ${width}
    Fill Card Number    rows    ${card}    ความยาว (ม.)    ${length}
    Fill Card Number    rows    ${card}    ความหนาฐาน (ม.)    ${depth}
    Fill Card Number    rows    ${card}    ความลึกหลุมขุด (ม.)    ${pit}
    Choose Card Bar Size    rows    ${card}    เหล็กแนวด้านสั้น    DB12
    Fill Card Number    rows    ${card}    เหล็กแนวด้านสั้น (เส้น)    ${bars}
    Choose Card Bar Size    rows    ${card}    เหล็กแนวด้านยาว    DB12
    Fill Card Number    rows    ${card}    เหล็กแนวด้านยาว (เส้น)    ${bars}
    Choose Card Bar Size    rows    ${card}    เหล็กรัดรอบ    RB9
    Fill Card Number    rows    ${card}    เหล็กรัดรอบ (รอบ)    2

Fill Pedestal From Plan
    [Documentation]    Level 10 "เสาตอม่อ". Needs the footing level filled (F1 x8, F2 x4). Presses "เพิ่มเสาตอม่อ…"
    ...    (one pedestal per footing type, count copied: 8 and 4 = 12 pedestals) then C1 0.25 x 0.25 x 0.80 m,
    ...    C2 0.20 x 0.20 x 0.80 m, 4-DB12, stirrups RB6 @0.15.
    ${cards}=    Get Element Count    css=[data-req-card^="rows#"]
    IF    ${cards} == 0
        Click    css=button:has-text("เพิ่มเสาตอม่อ")
        Wait For Elements State    css=[data-req-card="rows#1"]    visible
    END
    Fill Pedestal Card    0    0.25    0.25    0.8
    Fill Pedestal Card    1    0.2    0.2    0.8

Fill Pedestal Card
    [Arguments]    ${card}    ${width}    ${length}    ${height}
    Fill Card Number    rows    ${card}    ความกว้าง (ม.)    ${width}
    Fill Card Number    rows    ${card}    ความยาว (ม.)    ${length}
    Fill Card Number    rows    ${card}    ความสูง (ม.)    ${height}
    Choose Card Bar Size    rows    ${card}    เหล็กยืน    DB12
    Fill Card Number    rows    ${card}    เหล็กยืน (เส้น)    4
    Choose Card Bar Size    rows    ${card}    เหล็กปลอก    RB6
    Fill Card Number    rows    ${card}    เหล็กปลอก ระยะห่าง @ (ม.)    0.15

Fill Ground Beam From Plan
    [Documentation]    Level 11 "คานคอดิน". Two cards from an empty list: B1 total length "9.5+7+2+9.5+7+2" = 37 m (sum
    ...    typed), 0.20 x 0.40 m, 4-DB12, stirrups RB6 @0.15; B2 18 m, 0.15 x 0.30 m, 4-DB12, RB6 @0.20.
    Ensure Cards    beams    2    เพิ่มคานคอดิน
    Fill Ground Beam Card    0    9.5+7+2+9.5+7+2    0.2    0.4    0.15
    Fill Ground Beam Card    1    18    0.15    0.3    0.2

Fill Ground Beam Card
    [Arguments]    ${card}    ${length}    ${width}    ${depth}    ${spacing}
    Fill Card Number    beams    ${card}    ความยาวรวมทุกช่วง (ม.)    ${length}
    Fill Card Number    beams    ${card}    ความกว้าง (ม.)    ${width}
    Fill Card Number    beams    ${card}    ความลึก (ม.)    ${depth}
    Choose Card Bar Size    beams    ${card}    เหล็กเสริมหลัก (บน + ล่าง)    DB12
    Fill Card Number    beams    ${card}    เหล็กเสริมหลัก (บน + ล่าง) (เส้น)    4
    Choose Card Bar Size    beams    ${card}    เหล็กปลอก    RB6
    Fill Card Number    beams    ${card}    เหล็กปลอก ระยะห่าง @ (ม.)    ${spacing}

Card Count Should Be
    [Documentation]    Exactly ``${count}`` cards of ``${list}`` on the page.
    [Arguments]    ${list}    ${count}
    Get Element Count    css=[data-req-card^="${list}#"]    ==    ${count}

Stored Meta Should Be
    [Documentation]    The project header field ``${field}`` (projectName, ownerName ...) saved in localStorage.
    [Arguments]    ${field}    ${expected}
    ${project}=    Read Guest Project
    Should Be Equal    ${project}[meta][${field}]    ${expected}

Stored Meta Should Eventually Be
    [Arguments]    ${field}    ${expected}
    Wait Until Keyword Succeeds    10s    300ms    Stored Meta Should Be    ${field}    ${expected}

Prepare Edge Test
    [Documentation]    Setup of a templated edge-input test: open ``${level}``, optionally run a ``Fill … From Plan``
    ...    keyword (so the totals are not all zero) and remember the level / label / index for ``Edge Case``.
    [Arguments]    ${level}    ${label}    ${index}=0    ${fill_keyword}=${EMPTY}
    Open Level    ${level}
    IF    '${fill_keyword}' != '${EMPTY}'    Run Keyword    ${fill_keyword}
    Set Test Variable    ${EDGE_LEVEL}    ${level}
    Set Test Variable    ${EDGE_LABEL}    ${label}
    Set Test Variable    ${EDGE_INDEX}    ${index}

Edge Case
    [Documentation]    Template row of an edge test prepared by ``Prepare Edge Test``: ``${typed}`` → shows ``${shown}``.
    [Arguments]    ${typed}    ${shown}
    Edge Value Is Handled    ${EDGE_LEVEL}    ${EDGE_LABEL}    ${EDGE_INDEX}    ${typed}    ${shown}

Prepare Edge Card Test
    [Arguments]    ${level}    ${list}    ${card}    ${label}    ${fill_keyword}=${EMPTY}
    Open Level    ${level}
    IF    '${fill_keyword}' != '${EMPTY}'    Run Keyword    ${fill_keyword}
    Set Test Variable    ${EDGE_LEVEL}    ${level}
    Set Test Variable    ${EDGE_LIST}    ${list}
    Set Test Variable    ${EDGE_CARD}    ${card}
    Set Test Variable    ${EDGE_LABEL}    ${label}

Edge Card Case
    [Arguments]    ${typed}    ${shown}
    Edge Card Value Is Handled    ${EDGE_LEVEL}    ${EDGE_LIST}    ${EDGE_CARD}    ${EDGE_LABEL}    ${typed}    ${shown}

Skip Level Through Popconfirm Should Land On
    [Documentation]    "ไม่มีในโครงการนี้" → Popconfirm → ยืนยัน: lands on ``${next_level}`` and ``${level_id}`` is stored skipped.
    [Arguments]    ${level_id}    ${next_level}
    ${path}=    Landing Path After Confirm    ${level_id}    ${next_level}
    Skip Level
    Wait For Condition    Url    should end with    ${path}    timeout=90s
    Level Mark Should Become    ${level_id}    skipped

Footing Choice Should Be
    [Documentation]    Pedestal card ``${card}`` stands on the footing named ``${name}`` (checked radio).
    [Arguments]    ${card}    ${name}
    Get Text    css=[data-req-card="rows#${card}"] [role="radiogroup"][aria-label="ตั้งอยู่บนฐานราก"] [role="radio"][aria-checked="true"]    ==    ${name}

Open Pedestal With Footings From Plan
    [Documentation]    Fresh project: fill the footing level from plan, confirm it and stay on the pedestal level.
    Open Level    footing
    Fill Footing From Plan
    Confirm Level And Land On    footing    pedestal
    Wait For Elements State    ${MAP_BUTTON}    visible    timeout=60s

Positive Level Total On Screen
    [Documentation]    The level total on screen as a number; fails while it is not above 0 (use with a retry).
    ${total}=    Level Total On Screen
    Should Be True    ${total} > 0    Level total is ${total}, expected more than 0
    RETURN    ${total}

Level Total Should Exceed
    [Arguments]    ${floor}
    ${total}=    Level Total On Screen
    Should Be True    ${total} > ${floor}    Level total ${total} did not exceed ${floor}
