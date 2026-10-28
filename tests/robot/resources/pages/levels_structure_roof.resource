*** Settings ***
Documentation       Page objects for journey levels 12-20 (พื้น เสา คาน ... โครงหลังคา): slab-on-grade, precast-slab,
...                 column, roof-beam, roof-slab, stair, column-plates, roofing, roof-structure.
...
...                 ``Fill <Level> From Plan`` keywords fill one realistic small one-storey house on the level's open page
...                 (no confirm, no navigation) so every requirement of ``docs/rebuild/REQUIRED_FIELDS.md`` is met.
...                 They work on a blank level (the add button is pressed) and are reused by the 37-level full run.
...
...                 The house (8 x 10 m, gable roof, 12 columns):
...                 | Level | Values typed |
...                 | slab-on-grade | S1: 4 x (9.5+0.5)=10 m, 0.10 m, RB9 @0.20 x2 layers; S2: 4 x 10 m, 0.12 m, RB9 @0.15 x1 layer |
...                 | precast-slab | span 1: 3 x 4 m; span 2: 2.5 x 3.5 m |
...                 | column | C1: 12 pcs, 0.20 x 0.20 m, 3 m high, main DB12 x4, stirrup RB6 @0.15 |
...                 | roof-beam | B1: length 8+10+8+10=36 m, 0.20 x 0.40 m, DB12 x6, RB6 @0.15; B2: 8+8=16 m, 0.20 x 0.30 m, DB12 x4, RB6 @0.20 |
...                 | roof-slab | S1: 3 x 4 m, 0.10 m, RB9 @0.20 x2 |
...                 | stair | บันไดหน้าบ้าน: 12 steps, riser 0.17 m, tread 0.25 m, width 1 m, waist 0.12 m (rise 2.04 / run 3.00 derived) |
...                 | column-plates | 6 plates and 6 grout points (8 x 8 inch plate, 9 mm) |
...                 | roofing | plan area 110 m2, slope 30 deg, ridge 10 m, gable rake 4*4 m, wall-end 2, gable-end 2, bird-stop 11+11 m, fascia 11+11+10+10 m |
...                 | roof-structure | wall plate 8+10+8+10 m, ridge 10 m, king posts 1.5 m x2 and 1.2 m x2, no valley |
Resource            ../journey.resource


*** Variables ***
${NAN_TEXT}             NaN
${INFINITY_TEXT}        Infinity


*** Keywords ***

# ── generic helpers (cards, bar choices, chips) ──────────────────────────────────────────────
Card
    [Documentation]    Selector of the n-th card (0-based) of an input list (``slabs``, ``columns``, ``rows``, ``panels``).
    [Arguments]    ${list_key}    ${index}=0
    RETURN    css=[data-req-card="${list_key}#${index}"]

Card Count
    [Documentation]    Number of plan cards on the level page.
    ${n}=    Get Element Count    css=[data-req-card]
    RETURN    ${n}

Ensure Card
    [Documentation]    The card ``${index}`` of ``${list_key}`` exists: press the empty-state add button for the first
    ...    card, the "add another" button for the others. Returns the card selector.
    [Arguments]    ${list_key}    ${index}    ${first_add}    ${next_add}
    ${card}=    Card    ${list_key}    ${index}
    ${n}=    Get Element Count    ${card}
    IF    ${n} == 0
        ${label}=    Set Variable If    ${index} == 0    ${first_add}    ${next_add}
        Click    css=button:has-text("${label}")
        Wait For Elements State    ${card}    visible    timeout=10s
    END
    RETURN    ${card}

Fill Card Number
    [Documentation]    Type into the number cell ``${label}`` (its aria-label) inside ``${card}`` and commit with Enter.
    [Arguments]    ${card}    ${label}    ${value}
    VAR    ${sel}    ${card} >> css=[aria-label="${label}"]
    Click    ${sel}
    Fill Text    ${sel}    ${value}
    Keyboard Key    press    Enter

Card Number Should Show
    [Documentation]    The number cell shows ``${text}`` (as formatted on screen, e.g. 4.00 or 1,250.50).
    [Arguments]    ${card}    ${label}    ${text}
    Get Property    ${card} >> css=[aria-label="${label}"]    value    ==    ${text}

Choose Card Option
    [Documentation]    Press a choice button (S1, RB9, 2 ชั้น ...) of the radiogroup ``${group}`` inside ``${card}``.
    [Arguments]    ${card}    ${group}    ${option}
    Click    ${card} >> css=[role="radiogroup"][aria-label="${group}"] >> css=button[role="radio"]:text-is("${option}")

Card Option Should Be Selected
    [Arguments]    ${card}    ${group}    ${option}
    Get Attribute    ${card} >> css=[role="radiogroup"][aria-label="${group}"] >> css=button[role="radio"]:text-is("${option}")
    ...    aria-checked    ==    true

Card Option Count Should Be
    [Arguments]    ${card}    ${group}    ${count}
    Get Element Count    ${card} >> css=[role="radiogroup"][aria-label="${group}"] >> css=button[role="radio"]    ==    ${count}

Pick Card Preset
    [Documentation]    Press a quick-pick chip (e.g. 0.12) of the ``${group}``-th chip row (0-based) of ``${card}``.
    [Arguments]    ${card}    ${text}    ${group}=0
    Click    ${card} >> css=[aria-label="ค่าที่ใช้บ่อย"] >> nth=${group} >> css=button:text-is("${text}")

Delete Card
    [Documentation]    Press the card's "ลบ"; a card holding values asks first (Popconfirm "ลบ").
    [Arguments]    ${card}    ${asks}=${TRUE}
    Click    ${card} >> css=button[aria-label="ลบ"]
    IF    ${asks}    Click Popconfirm Ok    ลบ

Add Another Card
    [Arguments]    ${label}
    Click    css=button:has-text("${label}")

Missing Summary Should Mention
    [Documentation]    The list under the bottom bar ("ยังต้องกรอก N รายการ: ...") contains ``${text}``.
    [Arguments]    ${text}
    Get Text    css=div[role="alert"]:has-text("ยังต้องกรอก")    contains    ${text}

Missing Summary Should Be Gone
    Get Element Count    css=div[role="alert"]:has-text("ยังต้องกรอก")    ==    0

Screen Should Have No NaN Or Infinity
    [Documentation]    A bad number must never reach the screen as NaN / Infinity.
    Get Text    css=body    not contains    ${NAN_TEXT}
    Get Text    css=body    not contains    ${INFINITY_TEXT}
    Page Should Have No Error Overlay

Prepare Level Suite
    [Documentation]    Suite setup: one browser, and the engine's blank project and the 37 level ids computed once (the
    ...    engine is a node process; computing them per test would dominate the run time).
    Open Browser For Suite
    ${expected}=    Compute Expected For New Project    blank
    ${ids}=    Evaluate    [l['id'] for l in $expected['levels']]
    VAR    ${BLANK_PROJECT}    ${expected}[project]    scope=SUITE
    VAR    @{LEVEL_IDS}    @{ids}    scope=SUITE

Seed Blank Project Until
    [Documentation]    Store the blank guest project with every level before ``${level_id}`` done and open ``${path}``
    ...    (same as ``Start Guest Project    blank ... unlock_until=``, without calling the engine again).
    [Arguments]    ${level_id}    ${path}
    ${project}=    Evaluate    {**$BLANK_PROJECT, 'journey': {i: 'done' for i in $LEVEL_IDS[:$LEVEL_IDS.index($level_id)]}}
    Seed Guest Project    ${project}    ${path}

Open Level
    [Documentation]    Fresh context, a guest project (``blank``, or ``sample`` = the Excel v5 house) with every earlier
    ...    level done, the level open. Needs ``Prepare Level Suite`` as suite setup for ``blank``.
    [Arguments]    ${level_id}    ${start}=blank
    Open Fresh Context    /file.svg
    IF    '${start}' == 'blank'
        Seed Blank Project Until    ${level_id}    /journey/${level_id}
    ELSE
        Start Guest Project    ${start}    /journey/${level_id}    unlock_until=${level_id}
    END
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    Page Should Have No Error Overlay

Reload Level
    Reload
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    Page Should Have No Error Overlay

Stored Input
    [Documentation]    The calculator input the app saved in localStorage for ``${calc_id}`` (dict).
    [Arguments]    ${calc_id}
    ${project}=    Read Guest Project
    ${calcs}=    Get From Dictionary    ${project}    calculators
    ${input}=    Get From Dictionary    ${calcs}    ${calc_id}
    RETURN    ${input}

Stored Level Mark
    [Arguments]    ${level_id}
    ${project}=    Read Guest Project
    ${journey}=    Get From Dictionary    ${project}    journey
    ${mark}=    Get From Dictionary    ${journey}    ${level_id}    default=${None}
    RETURN    ${mark}

# ── Fill <Level> From Plan ─────────────────────────────────────────────────────────────────
Fill Slab On Grade From Plan
    [Documentation]    Two panels S1 / S2 (see the resource documentation). Page: ``/journey/slab-on-grade``.
    ${s1}=    Ensure Card    slabs    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Choose Card Option    ${s1}    ชื่อพื้น    S1
    Fill Card Number    ${s1}    ความกว้าง (ม.)    4
    Fill Card Number    ${s1}    ความยาว (ม.)    9.5+0.5
    Pick Card Preset    ${s1}    0.10    0
    Choose Card Option    ${s1}    เหล็กเสริม ขนาดเหล็ก    RB9
    Pick Card Preset    ${s1}    0.20    1
    Choose Card Option    ${s1}    วางเหล็ก    2 ชั้น
    ${s2}=    Ensure Card    slabs    1    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Choose Card Option    ${s2}    ชื่อพื้น    S2
    Fill Card Number    ${s2}    ความกว้าง (ม.)    4
    Fill Card Number    ${s2}    ความยาว (ม.)    10
    Pick Card Preset    ${s2}    0.12    0
    Choose Card Option    ${s2}    เหล็กเสริม ขนาดเหล็ก    RB9
    Pick Card Preset    ${s2}    0.15    1
    Choose Card Option    ${s2}    วางเหล็ก    1 ชั้น

Fill Precast Slab From Plan
    [Documentation]    Two spans 3 x 4 m and 2.5 x 3.5 m. Page: ``/journey/precast-slab``.
    ${p1}=    Ensure Card    panels    0    เพิ่มช่วงแรก    เพิ่มช่วงถัดไป
    Fill Card Number    ${p1}    ความกว้างช่วง (ม.)    3
    Fill Card Number    ${p1}    ความยาวช่วง (ม.)    4
    ${p2}=    Ensure Card    panels    1    เพิ่มช่วงแรก    เพิ่มช่วงถัดไป
    Fill Card Number    ${p2}    ความกว้างช่วง (ม.)    2.5
    Fill Card Number    ${p2}    ความยาวช่วง (ม.)    3.5

Fill Column From Plan
    [Documentation]    Column type C1: 12 pcs 0.20 x 0.20 x 3 m, DB12 x4, RB6 @0.15. Page: ``/journey/column``.
    ${c1}=    Ensure Card    columns    0    เพิ่มเสา    เพิ่มเสา
    Choose Card Option    ${c1}    ชื่อเสา    C1
    Fill Card Number    ${c1}    จำนวนต้น (ต้น)    12
    Fill Card Number    ${c1}    ความกว้าง (ม.)    0.2
    Fill Card Number    ${c1}    ความยาว (ม.)    0.2
    Fill Card Number    ${c1}    ความสูงเสา (ม.)    3
    Choose Card Option    ${c1}    เหล็กยืน ขนาดเหล็ก    DB12
    Fill Card Number    ${c1}    เหล็กยืน (เส้น)    4
    Choose Card Option    ${c1}    เหล็กปลอก ขนาดเหล็ก    RB6
    Pick Card Preset    ${c1}    0.15    0

Fill Roof Beam From Plan
    [Documentation]    Beams B1 (36 m, 0.20 x 0.40) and B2 (16 m, 0.20 x 0.30). Page: ``/journey/roof-beam``.
    ${b1}=    Ensure Card    rows    0    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Choose Card Option    ${b1}    ชื่อคาน    B1
    Fill Card Number    ${b1}    ความยาวรวม (ม.)    8+10+8+10
    Fill Card Number    ${b1}    ความกว้าง (ม.)    0.2
    Fill Card Number    ${b1}    ความลึก (ม.)    0.4
    Choose Card Option    ${b1}    เหล็กแกน (บน + ล่าง) ขนาดเหล็ก    DB12
    Fill Card Number    ${b1}    เหล็กแกน (บน + ล่าง) (เส้น)    6
    Choose Card Option    ${b1}    เหล็กปลอก ขนาดเหล็ก    RB6
    Pick Card Preset    ${b1}    0.15    0
    ${b2}=    Ensure Card    rows    1    เพิ่มคานเส้นแรก    เพิ่มคานอีกขนาด
    Choose Card Option    ${b2}    ชื่อคาน    B2
    Fill Card Number    ${b2}    ความยาวรวม (ม.)    8+8
    Fill Card Number    ${b2}    ความกว้าง (ม.)    0.2
    Fill Card Number    ${b2}    ความลึก (ม.)    0.3
    Choose Card Option    ${b2}    เหล็กแกน (บน + ล่าง) ขนาดเหล็ก    DB12
    Fill Card Number    ${b2}    เหล็กแกน (บน + ล่าง) (เส้น)    4
    Choose Card Option    ${b2}    เหล็กปลอก ขนาดเหล็ก    RB6
    Pick Card Preset    ${b2}    0.20    0

Fill Roof Slab From Plan
    [Documentation]    One panel S1 3 x 4 m, 0.10 m, RB9 @0.20 x2. Page: ``/journey/roof-slab``.
    ${s1}=    Ensure Card    rows    0    เพิ่มพื้นผืนแรก    เพิ่มพื้นอีกผืน
    Choose Card Option    ${s1}    ชื่อพื้น    S1
    Fill Card Number    ${s1}    ความกว้าง (ม.)    3
    Fill Card Number    ${s1}    ความยาว (ม.)    4
    Pick Card Preset    ${s1}    0.10    0
    Choose Card Option    ${s1}    เหล็กเสริม ขนาดเหล็ก    RB9
    Pick Card Preset    ${s1}    0.20    1
    Choose Card Option    ${s1}    วางเหล็ก    2 ชั้น

Fill Stair From Plan
    [Documentation]    One stair: 12 steps, riser 0.17, tread 0.25, width 1 m, waist 0.12. Page: ``/journey/stair``.
    ${st}=    Ensure Card    rows    0    เพิ่มบันไดชุดแรก    เพิ่มบันไดอีกชุด
    Choose Card Option    ${st}    ชื่อบันได    บันไดหน้าบ้าน
    Fill Card Number    ${st}    จำนวนขั้น (ขั้น)    12
    Fill Card Number    ${st}    ลูกตั้ง สูง (ม.)    0.17
    Fill Card Number    ${st}    ลูกนอน กว้าง (ม.)    0.25
    Fill Card Number    ${st}    ความกว้างบันได (ม.)    1
    Fill Card Number    ${st}    ท้องบันได หนา (ม.)    0.12

Fill Column Plates From Plan
    [Documentation]    6 steel plates and 6 grout points (BOQ rows typed on the level). Page: ``/journey/column-plates``.
    Fill Number By Label    เหล็กเพลทสี่เหลี่ยมหนา 9 มม. ขนาด 8 x 8 นิ้ว จำนวน    6
    Fill Number By Label    ปูนเกร้าท์ นอนชริ้งค์ จำนวน    6

Fill Roofing From Plan
    [Documentation]    Plan area 110 m2, slope 30 deg and the measured lengths (see the resource documentation).
    ...    Page: ``/journey/roofing``.
    Fill Number By Label    พื้นที่หลังคาตามแนวราบ (ตร.ม.)    110
    Click    css=[aria-label="ค่าที่ใช้บ่อย"] >> css=button:text-is("30°")
    Fill Text By Label    ครอบสันโค้ง (ม.)    10
    Fill Text By Label    ครอบข้างจั่ว ความยาวตามแนวราบ (ม.)    4*4
    Fill Text By Label    ครอบปิดชาย (จุด)    2
    Fill Text By Label    ครอบปิดจั่ว (จุด)    2
    Fill Text By Label    แผ่นปิดกันนก (ม.)    11+11
    Fill Text By Label    ไม้เชิงชาย (ม.)    11+11+10+10

Fill Roof Structure From Plan
    [Documentation]    Wall plate, ridge and four king posts; rafters and purlins come from the roofing level.
    ...    Page: ``/journey/roof-structure``.
    Fill Text By Label    อะเส    8+10+8+10
    Fill Text By Label    อกไก่    10
    ${parts}=    Get Element Count    css=[aria-label="จำนวน (ต้น)"]
    IF    ${parts} == 0    Click    css=button:has-text("เพิ่มดั้ง")
    Fill Number By Label    ความสูง/ความยาว (ม.)    1.5    0
    Fill Number By Label    จำนวน (ต้น)    2    0
    ${parts}=    Get Element Count    css=[aria-label="จำนวน (ต้น)"]
    IF    ${parts} < 2    Click    css=button:has-text("เพิ่มดั้ง")
    Fill Number By Label    ความสูง/ความยาว (ม.)    1.2    1
    Fill Number By Label    จำนวน (ต้น)    2    1

# ── shared scenario helpers (used by suites 43 and 44) ───────────────────────────────────────
Fill Minimal Slab Card
    [Documentation]    Works for slab-on-grade and roof-slab cards: 4 x 5 m, 0.10 m thick (bars keep the standard spec).
    [Arguments]    ${card}
    Fill Card Number    ${card}    ความกว้าง (ม.)    4
    Fill Card Number    ${card}    ความยาว (ม.)    5
    Fill Card Number    ${card}    ความหนา (ม.)    0.1

Fill Minimal Precast Card
    [Arguments]    ${card}
    Fill Card Number    ${card}    ความกว้างช่วง (ม.)    3
    Fill Card Number    ${card}    ความยาวช่วง (ม.)    4

Fill Minimal Column Card
    [Documentation]    2 pcs 0.20 x 0.20 x 3 m with 4 main bars.
    [Arguments]    ${card}
    Fill Card Number    ${card}    จำนวนต้น (ต้น)    2
    Fill Card Number    ${card}    ความกว้าง (ม.)    0.2
    Fill Card Number    ${card}    ความยาว (ม.)    0.2
    Fill Card Number    ${card}    ความสูงเสา (ม.)    3
    Fill Card Number    ${card}    เหล็กยืน (เส้น)    4

Fill Minimal Roof Beam Card
    [Documentation]    5 m long, 0.20 x 0.40 m with 4 main bars.
    [Arguments]    ${card}
    Fill Card Number    ${card}    ความยาวรวม (ม.)    5
    Fill Card Number    ${card}    ความกว้าง (ม.)    0.2
    Fill Card Number    ${card}    ความลึก (ม.)    0.4
    Fill Card Number    ${card}    เหล็กแกน (บน + ล่าง) (เส้น)    4

Fill Minimal Stair Card
    [Documentation]    10 steps, 1 m wide (rise and run follow the riser / tread).
    [Arguments]    ${card}
    Fill Card Number    ${card}    จำนวนขั้น (ขั้น)    10
    Fill Card Number    ${card}    ความกว้างบันได (ม.)    1

Add And Fill Cards
    [Documentation]    Add ``${count}`` cards of ``${list_key}`` and fill each with the keyword ``${filler}``.
    [Arguments]    ${list_key}    ${count}    ${first_add}    ${next_add}    ${filler}
    FOR    ${i}    IN RANGE    ${count}
        ${card}=    Ensure Card    ${list_key}    ${i}    ${first_add}    ${next_add}
        Run Keyword    ${filler}    ${card}
    END

Duplicate Card
    [Arguments]    ${card}
    Click    ${card} >> css=button[title="ทำซ้ำรายการนี้"]

Level Total Should Be A Number
    [Documentation]    The level total on the bottom bar shows digits and "บาท" (never blank, NaN or Infinity).
    Get Text    ${LEVEL_TOTAL}    matches    ^[-−]?[0-9,]+ *บาท$

Edge Value Should Be Handled
    [Documentation]    Type ``${typed}`` into the number ``${label}`` of ``${card}`` (a card that already has plan values) and
    ...    check: the saved ``${list}[${index}].${field}`` is ``${expected}`` (``KEEP`` = unchanged, e.g. text that is not a
    ...    number), both totals equal the engine, and the screen shows no NaN / Infinity.
    [Arguments]    ${calc_id}    ${level_id}    ${card}    ${label}    ${typed}    ${list_key}    ${index}    ${field}    ${expected}
    ${before}=    Stored Input    ${calc_id}
    VAR    ${old}    ${before}[${list_key}][${index}][${field}]
    Fill Card Number    ${card}    ${label}    ${typed}
    ${after}=    Stored Input    ${calc_id}
    VAR    ${now}    ${after}[${list_key}][${index}][${field}]
    ${want}=    Set Variable If    '${expected}' == 'KEEP'    ${old}    ${expected}
    Should Be Equal As Numbers    ${now}    ${want}    msg=Typed "${typed}" into ${label}: saved ${now}, expected ${want}
    Level Totals Should Match Engine    ${level_id}
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number

Bar Choice Should Be Stored
    [Documentation]    Press the bar-size button ``${option}`` of ``${group}``: it shows selected, is saved as
    ...    ``${list}[${index}].${field}`` and both totals still equal the engine.
    [Arguments]    ${calc_id}    ${level_id}    ${card}    ${group}    ${option}    ${list_key}    ${index}    ${field}
    Choose Card Option    ${card}    ${group}    ${option}
    Card Option Should Be Selected    ${card}    ${group}    ${option}
    ${input}=    Stored Input    ${calc_id}
    Should Be Equal    ${input}[${list_key}][${index}][${field}]    ${option}
    Level Totals Should Match Engine    ${level_id}

Preset Chip Should Be Stored
    [Documentation]    Press the quick-pick chip ``${text}`` (row ``${group}``): the box shows it and ``${value}`` is saved.
    [Arguments]    ${calc_id}    ${level_id}    ${card}    ${text}    ${group}    ${list_key}    ${index}    ${field}    ${value}
    Pick Card Preset    ${card}    ${text}    ${group}
    ${input}=    Stored Input    ${calc_id}
    Should Be Equal As Numbers    ${input}[${list_key}][${index}][${field}]    ${value}
    Level Totals Should Match Engine    ${level_id}

Level Should Be Locked
    [Documentation]    A level whose predecessor is not done: URL shows "รอขั้นตอนก่อนหน้า", a way to the current level,
    ...    and no inputs.
    [Arguments]    ${level_id}    ${unlock_until}    ${current_title}
    Open Fresh Context    /file.svg
    Seed Blank Project Until    ${unlock_until}    /journey/${level_id}
    Wait For Elements State    text=รอขั้นตอนก่อนหน้า    visible    timeout=60s
    Get Text    css=body    contains    ทำต่อ: ${current_title}
    Get Element Count    ${CONFIRM_BUTTON}    ==    0
    Get Element Count    css=[data-req-card]    ==    0

Previous Arrow Should Go To
    [Arguments]    ${prev_id}    ${prev_title}
    Click    css=button[aria-label="ขั้นตอนก่อนหน้า: ${prev_title}"]
    Wait For Condition    Url    should end with    /journey/${prev_id}    timeout=30s
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s

Level Should Be Marked Done On Screen
    Wait For Elements State    css=.ant-tag:has-text("เสร็จแล้ว")    visible    timeout=10s

Every Option Can Be Chosen
    [Documentation]    Press every button of the radiogroup ``${group}`` in turn: it shows selected, is saved as
    ...    ``${list}[${index}].${field}`` (``${numeric}`` for numbers such as the layers) and the totals equal the engine.
    [Arguments]    ${calc_id}    ${level_id}    ${card}    ${group}    ${options}    ${list_key}    ${index}    ${field}
    ...    ${stored}=${NONE}
    ${n}=    Get Length    ${options}
    Card Option Count Should Be    ${card}    ${group}    ${n}
    FOR    ${i}    ${option}    IN ENUMERATE    @{options}
        Choose Card Option    ${card}    ${group}    ${option}
        Card Option Should Be Selected    ${card}    ${group}    ${option}
        ${input}=    Stored Input    ${calc_id}
        ${want}=    Set Variable If    $stored is None    ${option}    ${stored}[${i}]
        Should Be Equal As Strings    ${input}[${list_key}][${index}][${field}]    ${want}
    END
    Level Totals Should Match Engine    ${level_id}
    Screen Should Have No NaN Or Infinity
