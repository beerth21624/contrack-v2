*** Settings ***
Documentation       Page objects of the finishing levels 32-37: ceiling, floor-tile, toilet-tile, wall-finishing (optional),
...                 paint, misc. The ``Fill ... From Plan`` keywords type the test house into a level (they never
...                 confirm and never navigate), so a full-run suite and the level suites share one set of values.
...
...                 The test house: 1 storey, about 8 x 10 m. Plan values (all areas = width x length, a rule you can
...                 verify by hand):
...
...                 | Level | Plan values | Area / amount |
...                 | ceiling | รับแขก C1 4x5; ห้องนอน 1 and 2 C1 3x3.5; ครัว C1 2.5x3; ห้องน้ำ C2 1.5x2; ชายคา C3 overhang 0.6 x 36 m | 20 + 10.5 + 10.5 + 7.5 + 3 + 21.6 = 73.1 m2 |
...                 | floor-tile | รับแขก F1 4x5; ห้องนอน 1 and 2 F1 3x3.5; ครัว F1 2.5x3 (bathroom is on its own level) | 48.5 m2 |
...                 | toilet-tile | ห้องน้ำ 1: floor 1.5 x 2.0, wall perimeter 2 x (1.5 + 2.0) = 7 m (offered by the app), tiled 2.0 m high, door 0.7 x 2 = 1.4 m2 | floor 3.0, wall 7 x 2.0 - 1.4 = 12.6 m2 |
...                 | wall-finishing | บัวใหญ่ 0.30 x 0.10 along 8+10+8+10 = 36 m; slat wall 3.0 x 2.4 | 36 m moulding, 7.2 m2 slat |
...                 | paint | takes every area from the earlier levels ("ใช้ค่านี้"), fascia length 36 m | fascia 36 x 0.23 = 8.28 m2 |
...                 | misc | glass railing 7.5 m (catalogue 4,000 baht per metre of material) | 30,000 baht |
Resource            ../journey.resource


*** Variables ***
&{CEILING_TYPE}         C1=ยิปซัมบอร์ด    C2=ยิปซัมกันชื้น    C3=ไฟเบอร์ซีเมนต์    C4=ระแนงไม้
&{FLOOR_TYPE}           F1=แกรนิตโต้    F3=แกรนิตโต้ กันลื่น    F4=ปรับระดับ ทำกันซึม
${ROOM_CARD}            css=[data-req-card]
${ADD_ROOM}             css=button:has-text("เพิ่มห้อง")
${ADD_BATHROOM}         css=button:has-text("เพิ่มห้องน้ำ")
${ADD_MOULDING}         css=button:has-text("เพิ่มบัวผนัง")
${ADD_SLAT}             css=button:has-text("เพิ่มผนังไม้ระแนง")
${MISSING_ALERT}        css=div[role="alert"]:has-text("ยังต้องกรอก")
${MOULDING_BIG}         บัวใหญ่ 0.30 × 0.10 ม.
${MOULDING_SMALL}       บัวเล็ก 0.10 × 0.10 ม.
${RAILING_QTY}          ปริมาณ ราวกันตกกระจก เฉลียง 1 และ 2 (ม.)
${HOUSE_EAVES_LENGTH}   36


*** Keywords ***
Add Bathroom
    [Documentation]    Add a bathroom card (floor row + wall row) and return its 0-based index.
    ${index}=    Get Element Count    css=[aria-label^="ชื่อห้องน้ำที่"]
    Click    ${ADD_BATHROOM}
    ${n}=    Evaluate    ${index} + 1
    Wait For Elements State    css=[aria-label="ชื่อห้องน้ำที่ ${n}"]    visible
    RETURN    ${index}

Add Ceiling Room
    [Documentation]    Add a room card and fill it: name, ceiling type code (C1-C4), width, length
    ...    (eaves C3: overhang and girth).
    [Arguments]    ${name}    ${code}    ${width}    ${length}
    ${card}=    Add Room Card
    ${n}=    Evaluate    ${card} + 1
    IF    '${name}' != '${EMPTY}'    Fill Text By Label    ชื่อห้องที่ ${n}    ${name}
    Choose Card Option    ${card}    ชนิดฝ้า    ${CEILING_TYPE}[${code}]
    ${w_label}=    Set Variable If    '${code}' == 'C3'    ระยะยื่นชายคา (ม.)    กว้าง (ม.)
    ${l_label}=    Set Variable If    '${code}' == 'C3'    ความยาวรอบชายคา (ม.)    ยาว (ม.)
    Fill Card Number    ${card}    ${w_label}    ${width}
    Fill Card Number    ${card}    ${l_label}    ${length}
    RETURN    ${card}

Add Floor Room
    [Documentation]    Add a room card and fill it: name, floor type code (F1, F3, F4), width, length.
    [Arguments]    ${name}    ${code}    ${width}    ${length}
    ${card}=    Add Room Card
    ${n}=    Evaluate    ${card} + 1
    IF    '${name}' != '${EMPTY}'    Fill Text By Label    ชื่อห้องที่ ${n}    ${name}
    Choose Card Option    ${card}    ชนิดพื้น    ${FLOOR_TYPE}[${code}]
    Fill Card Number    ${card}    กว้าง (ม.)    ${width}
    Fill Card Number    ${card}    ยาว (ม.)    ${length}
    RETURN    ${card}

Add Moulding
    [Documentation]    Add a moulding card (size button text, whole length) and return its 0-based number among mouldings.
    [Arguments]    ${location}    ${size}    ${length}
    ${n}=    Get Element Count    css=[aria-label^="ตำแหน่งบัวที่"]
    Click    ${ADD_MOULDING}
    ${label}=    Set Variable    ตำแหน่งบัวที่ ${{ $n + 1 }}
    Wait For Elements State    css=[aria-label="${label}"]    visible
    IF    '${location}' != '${EMPTY}'    Fill Text By Label    ${label}    ${location}
    Click    css=[role="radiogroup"][aria-label="ขนาดบัว"] >> nth=${n} >> css=button:text-is("${size}")
    Fill Number By Label    ความยาวรวม (ม.)    ${length}    ${n}
    RETURN    ${n}

Add Room Card
    [Documentation]    Click "เพิ่มห้อง" and return the 0-based index of the new card.
    ${card}=    Get Element Count    ${ROOM_CARD}
    Click    ${ADD_ROOM}
    Wait For Elements State    ${ROOM_CARD} >> nth=${card}    visible
    RETURN    ${card}

Add Slat Wall
    [Documentation]    Add a slat-wall card (width, height) and return its 0-based number among slat walls.
    [Arguments]    ${location}    ${width}    ${height}
    ${n}=    Get Element Count    css=[aria-label^="ตำแหน่งผนังระแนงที่"]
    Click    ${ADD_SLAT}
    ${label}=    Set Variable    ตำแหน่งผนังระแนงที่ ${{ $n + 1 }}
    Wait For Elements State    css=[aria-label="${label}"]    visible
    IF    '${location}' != '${EMPTY}'    Fill Text By Label    ${label}    ${location}
    Fill Number By Label    กว้าง (ม.)    ${width}    ${n}
    Fill Number By Label    สูง (ม.)    ${height}    ${n}
    RETURN    ${n}

Card Count Should Be
    [Documentation]    Card Count Should Be.
    [Arguments]    ${count}
    Get Element Count    ${ROOM_CARD}    ==    ${count}

Card Input
    [Documentation]    Selector of the input named ``${label}`` inside the ``${card}``-th plan card (0-based).
    [Arguments]    ${card}    ${label}
    RETURN    ${ROOM_CARD} >> nth=${card} >> css=[aria-label="${label}"]

Ceiling Data
    [Documentation]    Seed data for ``Start Project With Data``: ceiling rows from specs ``code:width:length:name:paint``
    ...    (e.g. ``C1:4:5:ห้องรับแขก:ภายใน``; empty code or paint = not chosen). Returns ``{'ceiling': {...}}``.
    [Arguments]    @{specs}
    ${rows}=    Create List
    FOR    ${spec}    IN    @{specs}
        ${p}=    Split String    ${spec}    :
        ${row}=    Evaluate    {'code': $p[0], 'width': float($p[1]), 'length': float($p[2]), 'location': $p[3], 'paint': $p[4]}
        Append To List    ${rows}    ${row}
    END
    ${data}=    Evaluate    {'ceiling': {'rows': $rows}}
    RETURN    ${data}

Check Stored Missing
    [Documentation]    Check Stored Missing.
    [Arguments]    ${calc}    ${path}    ${key}
    ${input}=    Stored Input    ${calc}
    ${actual}=    Evaluate    $input${path}.get($key)
    Should Be Equal    ${actual}    ${NONE}

Check Stored Number
    [Documentation]    Check Stored Number.
    [Arguments]    ${calc}    ${path}    ${expected}
    ${input}=    Stored Input    ${calc}
    ${actual}=    Evaluate    $input${path}
    Should Be Equal As Numbers    ${actual}    ${expected}    precision=6

Check Stored Value
    [Documentation]    Check Stored Value.
    [Arguments]    ${calc}    ${path}    ${expected}
    ${input}=    Stored Input    ${calc}
    ${actual}=    Evaluate    $input${path}
    Should Be Equal    ${actual}    ${expected}

Choose Card Option
    [Documentation]    Press the option button (exact text) of a button group of a plan card.
    [Arguments]    ${card}    ${group}    ${option}
    Click    ${ROOM_CARD} >> nth=${card} >> css=[role="radiogroup"][aria-label="${group}"] button:text-is("${option}")

Confirm Last Level
    [Documentation]    Press "ยืนยันและเสร็จสิ้น" on the last level: the journey ends on the overview.
    Get Text    ${CONFIRM_BUTTON}    contains    ยืนยันและเสร็จสิ้น
    Click    ${CONFIRM_BUTTON}
    Wait For Condition    Url    should end with    /journey    timeout=30s

Confirm Should Be Blocked Like The Engine
    [Documentation]    The confirm button is blocked with exactly the number of requirements the engine reports.
    [Arguments]    ${level_id}
    ${count}=    Wait Until Keyword Succeeds    20s    1s    Engine Missing Positive    ${level_id}
    Confirm Level Should Be Blocked    ${level_id}    ${count}

Delete Card
    [Documentation]    Delete the ``${card}``-th plan card; ``${confirm}`` = it holds data, so a Popconfirm asks first.
    [Arguments]    ${card}    ${confirm}=${TRUE}
    Click    ${ROOM_CARD} >> nth=${card} >> css=button[aria-label="ลบ"]
    IF    ${confirm}    Click Popconfirm Ok    ลบ

Duplicate Card
    [Documentation]    Duplicate Card.
    [Arguments]    ${card}
    Click    ${ROOM_CARD} >> nth=${card} >> css=button[title="ทำซ้ำรายการนี้"]

Engine Missing Count
    [Documentation]    How many required values the engine says the stored project still lacks on ``${level_id}``.
    [Arguments]    ${level_id}
    ${expected}=    Expected For Current Guest Project
    ${lvl}=    Expected Level    ${expected}    ${level_id}
    ${count}=    Get Length    ${lvl}[missing]
    RETURN    ${count}

Engine Missing Positive
    [Documentation]    Engine Missing Positive.
    [Arguments]    ${level_id}
    ${count}=    Engine Missing Count    ${level_id}
    Should Be True    ${count} > 0    msg=the engine reports nothing missing on ${level_id}
    RETURN    ${count}

Fill Bathroom
    [Documentation]    Fill the ``${bath}``-th bathroom card (0-based, one floor row and one wall row each).
    [Arguments]    ${bath}    ${width}    ${length}    ${tile_height}    ${openings}=${EMPTY}
    Fill Number By Label    กว้างห้อง (ม.)    ${width}    ${bath}
    Fill Number By Label    ยาวห้อง (ม.)    ${length}    ${bath}
    Fill Number By Label    ความสูงที่กรุกระเบื้อง (ม.)    ${tile_height}    ${bath}
    IF    '${openings}' != '${EMPTY}'    Fill Number By Label    หักช่องเปิด (ตร.ม.)    ${openings}    ${bath}

Fill Card Number
    [Documentation]    Type into a number box of a plan card and commit with Enter.
    [Arguments]    ${card}    ${label}    ${value}
    ${sel}=    Card Input    ${card}    ${label}
    Click Cell    ${sel}
    Fill Text    ${sel}    ${value}
    Keyboard Key    press    Enter

Fill Ceiling From Plan
    [Documentation]    Ceiling level, empty list: the 6 ceiling cards of the test house (see the table above).
    ...    Does not confirm. Total area 73.1 m2.
    Add Ceiling Room    ห้องรับแขก    C1    4    5
    Add Ceiling Room    ห้องนอน 1    C1    3    3.5
    Add Ceiling Room    ห้องนอน 2    C1    3    3.5
    Add Ceiling Room    ห้องครัว    C1    2.5    3
    Add Ceiling Room    ห้องน้ำ 1    C2    1.5    2
    Add Ceiling Room    ชายคาภายนอก    C3    0.6    ${HOUSE_EAVES_LENGTH}

Fill Floor Tile From Plan
    [Documentation]    Floor-tile level, empty list: 4 granito rooms typed by hand (the bathroom is its own level).
    ...    Does not confirm. Total area 48.5 m2.
    Add Floor Room    ห้องรับแขก    F1    4    5
    Add Floor Room    ห้องนอน 1    F1    3    3.5
    Add Floor Room    ห้องนอน 2    F1    3    3.5
    Add Floor Room    ห้องครัว    F1    2.5    3

Fill Misc From Plan
    [Documentation]    Misc level: a glass railing of ``${railing_length}`` m (default 7.5 m) on the veranda.
    ...    Does not confirm. With the catalogue price (4,000 baht per metre of material) the level is 30,000 baht.
    [Arguments]    ${railing_length}=7.5
    Fill Number By Label    ${RAILING_QTY}    ${railing_length}

Fill Paint From Plan
    [Documentation]    Paint level: accepts every area the earlier levels offer ("ใช้ค่านี้"), then types the fascia
    ...    length (default 36 m = 2 x (8 + 10); height 0.23 m gives 8.28 m2). Does not confirm.
    [Arguments]    ${fascia_length}=36
    Use All Offered Values
    Fill Number By Label    ความยาวเชิงชาย    ${fascia_length}

Fill Toilet Tile From Plan
    [Documentation]    Toilet-tile level, empty list: one bathroom 1.5 x 2.0 m floor, walls tiled 2.0 m high, a door
    ...    0.7 x 2 m deducted. The wall length (7 m) is filled by the app from the floor size. Does not confirm.
    ...    Floor 3.0 m2, wall 7 x 2.0 - 1.4 = 12.6 m2.
    ${bath}=    Add Bathroom
    Fill Bathroom    ${bath}    1.5    2.0    2.0    0.7*2

Fill Wall Finishing From Plan
    [Documentation]    Wall-finishing level, empty list: one big moulding of 8+10+8+10 = 36 m and a slat wall 3.0 x 2.4 m.
    ...    Does not confirm. Moulding 36 m, slat 7.2 m2.
    Add Moulding    ผนังภายนอก    ${MOULDING_BIG}    8+10+8+10
    Add Slat Wall    ผนังเฉลียง    3.0    2.4

Input Number Should Be
    [Documentation]    The number a sheet input holds (formatted text such as "1,250.50" is read as a number).
    [Arguments]    ${selector}    ${expected}    ${tolerance}=0.001
    ${text}=    Get Property    ${selector}    value
    Numbers Should Be Close    ${text}    ${expected}    ${tolerance}

Page Should Show No Broken Number
    [Documentation]    Neither the page text nor the console shows NaN, Infinity or "undefined".
    ${text}=    Get Text    css=body
    Should Not Match Regexp    ${text}    NaN|Infinity|undefined|\\[object
    Page Should Have No Error Overlay

Start Project With Data
    [Documentation]    A new guest project (``${start}``) whose calculator inputs are replaced by ``${data}``
    ...    ({calculator id: input}) and whose levels before ``${unlock_until}`` are done; ``${marks}`` adds journey
    ...    marks such as {"wall-finishing": "skipped"}. Stored and opened at ``${path}``; returns the engine's values.
    [Arguments]    ${data}    ${path}    ${unlock_until}    ${start}=blank    ${marks}=${NONE}
    ${expected}=    Compute Expected For New Project    ${start}
    ${project}=    Evaluate    {**$expected['project'], 'calculators': {**$expected['project']['calculators'], **$data}}
    IF    $marks is not None
        ${project}=    Evaluate    {**$project, 'journey': {**$project.get('journey', {}), **$marks}}
    END
    ${project}=    Project With Levels Done    ${project}    ${unlock_until}
    Seed Guest Project    ${project}    ${path}
    ${expected}=    Compute Expected    ${project}
    RETURN    ${expected}

Stored Input
    [Documentation]    The input of a calculator as the app saved it (dict; empty when the app never wrote one).
    [Arguments]    ${calc}
    ${project}=    Read Guest Project
    ${input}=    Evaluate    $project['calculators'].get($calc) or {}
    RETURN    ${input}

Stored Number Should Be
    [Documentation]    A number inside a calculator input as the app saved it, e.g. ``ceiling    ['rows'][0]['width']``.
    ...    Retries while the store writes localStorage.
    [Arguments]    ${calc}    ${path}    ${expected}
    Wait Until Keyword Succeeds    15s    250ms    Check Stored Number    ${calc}    ${path}    ${expected}

Stored Value Should Be
    [Documentation]    Stored Value Should Be.
    [Arguments]    ${calc}    ${path}    ${expected}
    Wait Until Keyword Succeeds    15s    250ms    Check Stored Value    ${calc}    ${path}    ${expected}

Stored Value Should Be Missing
    [Documentation]    A cleared optional number is not saved at all, e.g. ``toilet-tile    ['rows'][0]    width``.
    [Arguments]    ${calc}    ${path}    ${key}
    Wait Until Keyword Succeeds    15s    250ms    Check Stored Missing    ${calc}    ${path}    ${key}

Totals Should Match Engine
    [Documentation]    ``Level Totals Should Match Engine`` that retries while the store writes localStorage.
    [Arguments]    ${level_id}
    ${expected}=    Wait Until Keyword Succeeds    30s    1s    Level Totals Should Match Engine    ${level_id}
    RETURN    ${expected}

Use All Offered Values
    [Documentation]    Press every "ใช้ค่านี้" button of the paint level (values offered by earlier levels).
    FOR    ${_}    IN RANGE    10
        ${count}=    Get Element Count    css=button:has-text("ใช้ค่านี้")
        IF    ${count} == 0    BREAK
        Click    css=button:has-text("ใช้ค่านี้") >> nth=0
    END

Wait For Level Page
    [Documentation]    The level page is open: bottom bar visible, no crash overlay.
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    Page Should Have No Error Overlay

Wall Finishing Data
    [Documentation]    Seed data: one big moulding of ``${moulding}`` m and one slat wall ``${width}`` x ``${height}`` m.
    [Arguments]    ${moulding}=36    ${width}=3    ${height}=2.4
    ${big}=    Set Variable    บัวตกแต่งผนัง ขนาด 0.3 หนา 0.1 ม.
    ${slat}=    Set Variable    กรุไม้ระแนงไฟเบอร์ซีเมนต์บอร์ด กว้าง 4 นิ้ว หนา 9 มม.
    ${m}=    Evaluate    {'code': 'P2', 'item': $big, 'width': 0, 'length': float($moulding), 'location': 'ผนังภายนอก'}
    ${s}=    Evaluate    {'code': 'P4', 'item': $slat, 'width': float($width), 'length': float($height), 'location': 'ผนังเฉลียง'}
    ${data}=    Evaluate    {'wall-finishing': {'rows': [$m, $s]}}
    RETURN    ${data}
