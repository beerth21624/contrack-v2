*** Settings ***
Documentation       W2b, journey levels 19-20 in depth: วัสดุมุงหลังคา (roofing) and โครงหลังคา (roof-structure)
...                 (docs/qa/TEST_PLAN.md section 4.3, W2).
...                 Roofing: roof area and pitch are required (REQUIRED_FIELDS.md), measured lengths are sums typed with
...                 "+", the slope area is area / cos(pitch). Roof structure: nothing required, rafters and purlins are
...                 derived from the roofing level (change the roofing area and the roof-structure total follows the
...                 engine), the lump sum R158 (rust paint, 8,000 + 2,000 baht in the Excel template) is counted even on
...                 a blank project.
Resource            ../../resources/pages/levels_structure_roof.resource
Suite Setup         Prepare Level Suite
Test Tags           journey    roof


*** Variables ***
${AREA}                 พื้นที่หลังคาตามแนวราบ (ตร.ม.)
${SLOPE}                ความชันหลังคา (องศา)
${KING_COUNT}           จำนวน (ต้น)
${KING_HEIGHT}          ความสูง/ความยาว (ม.)
${RUST_PAINT_LUMP}      10000


*** Test Cases ***

# ═══════════════════════════ 19 วัสดุมุงหลังคา (roofing) ═══════════════════════════
Roofing Starts Empty With A Zero Total
    Open Level    roofing
    Level Total Should Be    0
    Level Totals Should Match Engine    roofing

Roofing Cannot Be Confirmed Without Roof Area And Pitch
    [Documentation]    REQUIRED_FIELDS: the roof area (plan) and the pitch are required: "ยังต้องกรอก 2 รายการ".
    [Tags]    negative
    Open Level    roofing
    Confirm Level Should Be Blocked    roofing    2
    Missing Summary Should Mention    พื้นที่หลังคาตามแนวราบ
    Missing Summary Should Mention    ความชันหลังคา
    Level Mark Should Be    roofing    ${None}

Roofing Required Fields Carry A Star
    Open Level    roofing
    Get Text    css=body    contains    (จำเป็น)

Roofing Filled From The Plan Matches The Engine And Confirms
    [Documentation]    Plan area 110 m2 at 30 degrees: slope area = 110 / cos(30 deg) = 127.017 m2 (Excel K7 = K5/COS(K6)).
    [Tags]    smoke
    Open Level    roofing
    Fill Roofing From Plan
    ${expected}=    Level Totals Should Match Engine    roofing
    Numbers Should Be Close    ${expected}[calcOutputs][roofing][slopeArea]    127.017    0.001
    Get Text    css=body    contains    127.02 ตร.ม.
    ${lvl}=    Expected Level    ${expected}    roofing
    Should Be True    ${lvl}[total] > 0
    Confirm Level    roof-structure
    Level Mark Should Be    roofing    done

Roofing With Only The Area Is Blocked Until The Pitch Is Filled
    [Tags]    negative
    Open Level    roofing
    Fill Number By Label    ${AREA}    110
    Confirm Level Should Be Blocked    roofing    1
    Missing Summary Should Mention    ความชันหลังคา
    Fill Number By Label    ${SLOPE}    30
    Missing Summary Should Be Gone
    Confirm Level    roof-structure
    Level Mark Should Be    roofing    done

Roofing With Only The Pitch Is Blocked Until The Area Is Filled
    [Tags]    negative
    Open Level    roofing
    Fill Number By Label    ${SLOPE}    30
    Confirm Level Should Be Blocked    roofing    1
    Missing Summary Should Mention    พื้นที่หลังคาตามแนวราบ
    Fill Number By Label    ${AREA}    110
    Missing Summary Should Be Gone
    Confirm Level    roof-structure

Clearing The Roof Area After Filling Blocks The Confirm Again
    [Tags]    negative
    Open Level    roofing
    Fill Roofing From Plan
    Fill Number By Label    ${AREA}    ${EMPTY}
    Level Totals Should Match Engine    roofing
    Confirm Level Should Be Blocked    roofing    1
    Missing Summary Should Mention    พื้นที่หลังคาตามแนวราบ

A Done Roofing That Loses Its Area Stays Done And Says What Is Missing
    [Documentation]    A confirmed level is never un-marked; it shows "ข้อมูลยังไม่ครบ 1 รายการ" instead.
    Open Level    roofing
    Fill Roofing From Plan
    Confirm Level    roof-structure
    Go To Level    roofing
    Fill Number By Label    ${AREA}    ${EMPTY}
    Wait For Elements State    text=ข้อมูลยังไม่ครบ 1 รายการ    visible    timeout=10s
    Level Mark Should Be    roofing    done

Roofing Plan Area Typed As Zero Is Stored As Zero
    [Tags]    edge
    [Template]    Roofing Area Edge
    0    0

Roofing Plan Area With A Thousands Comma Is Read As A Number
    [Tags]    edge
    [Template]    Roofing Area Edge
    1,250.5    1250.5

Roofing Plan Area As An Excel Formula Is Calculated
    [Tags]    edge
    [Template]    Roofing Area Edge
    =2.5*4    10

Roofing Plan Area As A Sum Is Added Up
    [Tags]    edge
    [Template]    Roofing Area Edge
    9.5+7+2    18.5

Roofing Plan Area Negative Gives Totals Equal To The Engine
    [Tags]    edge    negative
    [Template]    Roofing Area Edge
    -3    -3

Roofing Plan Area Typed As Text Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Roofing Area Edge
    abc    KEEP

Roofing Plan Area Cleared Becomes Zero
    [Tags]    edge
    [Template]    Roofing Area Edge
    ${EMPTY}    0

Roofing Plan Area Very Large Still Equals The Engine
    [Tags]    edge
    [Template]    Roofing Area Edge
    1000000    1000000

Roofing Plan Area Divided By Zero Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Roofing Area Edge
    1/0    KEEP

Roofing Plan Area Beyond The Number Range Never Shows NaN Or Infinity
    [Tags]    edge    negative    bug
    Open Level    roofing
    Fill Number By Label    ${SLOPE}    30
    Fill Number By Label    ${AREA}    1e308
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number

Roofing Plan Area Far Outside The Usual Range Shows A Note But Is Kept
    [Documentation]    5 m2 and 3000 m2 are accepted (the user may be right) with a quiet "double-check" note.
    [Tags]    edge
    Open Level    roofing
    Fill Number By Label    ${SLOPE}    30
    Fill Number By Label    ${AREA}    5
    Get Text    css=body    contains    น้อยกว่าปกติ
    Fill Number By Label    ${AREA}    3000
    Get Text    css=body    contains    มากกว่าปกติ
    Level Totals Should Match Engine    roofing

Roofing Pitch Typed As Zero Is Stored As Zero
    [Tags]    edge
    [Template]    Roofing Slope Edge
    0    0

Roofing Pitch Of 45 Degrees Gives Totals Equal To The Engine
    [Tags]    edge
    [Template]    Roofing Slope Edge
    45    45

Roofing Pitch Negative Gives Totals Equal To The Engine
    [Tags]    edge    negative
    [Template]    Roofing Slope Edge
    -30    -30

Roofing Pitch Typed As Text Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Roofing Slope Edge
    abc    KEEP

Roofing Pitch Cleared Becomes Zero
    [Tags]    edge
    [Template]    Roofing Slope Edge
    ${EMPTY}    0

Roofing Pitch Of 90 Degrees Does Not Blow Up The Total
    [Documentation]    cos(90 deg) is 0: area / cos gives a roof of about 1e18 m2 and a total beyond 1e20 baht. A pitch
    ...    of 90 degrees or more is not a roof; the app must reject it or at least keep the amounts sane (< 1e12 baht).
    [Tags]    edge    negative    bug
    Open Level    roofing
    Fill Number By Label    ${AREA}    110
    Fill Number By Label    ${SLOPE}    90
    Get Text    css=body    contains    มากกว่าปกติ
    ${expected}=    Expected For Current Guest Project
    ${lvl}=    Expected Level    ${expected}    roofing
    Should Be True    abs(${lvl}[total]) < 1e12    msg=Pitch 90 deg made the roofing level ${lvl}[total] baht
    Screen Should Have No NaN Or Infinity

Roofing Pitch Chips Fill The Pitch
    [Tags]    edge
    [Template]    Roofing Slope Chip
    30°    30
    35°    35
    40°    40

Roofing Slope Area Readout Follows The Pitch
    [Documentation]    110 m2 at 40 degrees = 143.59 m2 (area / cos), shown under the inputs.
    Open Level    roofing
    Fill Number By Label    ${AREA}    110
    Fill Number By Label    ${SLOPE}    40
    Get Text    css=body    contains    143.59 ตร.ม.
    Level Totals Should Match Engine    roofing

Roofing Ridge Length Typed As Zero Is Stored As Zero
    [Tags]    edge
    [Template]    Roofing Ridge Edge
    0    0

Roofing Ridge Length As A Sum Of Segments Is Added Up
    [Tags]    edge
    [Template]    Roofing Ridge Edge
    12.5+11+4.5    28

Roofing Ridge Length With A Thousands Comma Is Read As A Number
    [Tags]    edge
    [Template]    Roofing Ridge Edge
    1,250.5    1250.5

Roofing Ridge Length As A Repeated Segment Is Multiplied
    [Documentation]    "5.09*2" is two segments of 5.09 m (the Excel cell was typed =5.09*2).
    [Tags]    edge
    [Template]    Roofing Ridge Edge
    5.09*2    10.18

Roofing Ridge Length Negative Gives Totals Equal To The Engine
    [Tags]    edge    negative
    [Template]    Roofing Ridge Edge
    -3    -3

Roofing Ridge Length Typed As Text Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Roofing Ridge Edge
    abc    KEEP

Roofing Ridge Length Cleared Becomes Zero
    [Tags]    edge
    [Template]    Roofing Ridge Edge
    ${EMPTY}    0

Roofing Ridge Length Very Large Still Equals The Engine
    [Tags]    edge
    [Template]    Roofing Ridge Edge
    1000000    1000000

Roofing Point Counts Are Typed Like Lengths
    [Documentation]    End-cap counts (จุด) take a plain count or a sum: 2+2 caps at the eaves = 4.
    [Tags]    edge
    Open Level    roofing
    Fill Roofing From Plan
    Fill Text By Label    ครอบปิดชาย (จุด)    2+2
    ${expected}=    Level Totals Should Match Engine    roofing
    Numbers Should Be Close    ${expected}[calcOutputs][roofing][takeoff.4]    4    0.001

Gable Rake Length Follows A New Roof Pitch
    [Documentation]    The rake row keeps its own pitch equal to the roof pitch: change the roof pitch and the rake
    ...    follows (plan length / cos(pitch)).
    Open Level    roofing
    Fill Roofing From Plan
    Fill Number By Label    ${SLOPE}    35
    ${input}=    Stored Input    roofing
    ${deg}=    Evaluate    [r for r in $input['rows'] if r['key'] == 'rake'][0]['takeoff']['deg']
    Should Be Equal As Numbers    ${deg}    35
    ${expected}=    Level Totals Should Match Engine    roofing
    ${want}=    Evaluate    16 / __import__('math').cos(__import__('math').radians(35))
    Numbers Should Be Close    ${expected}[calcOutputs][roofing][takeoff.2]    ${want}    0.001

Roofing Values And Mark Survive A Reload
    Open Level    roofing
    Fill Roofing From Plan
    Confirm Level    roof-structure
    Go To Level    roofing
    Reload Level
    Level Totals Should Match Engine    roofing
    Level Mark Should Be    roofing    done
    Get Property    css=[aria-label="${AREA}"]    value    ==    110
    Get Property    css=[aria-label="ไม้เชิงชาย (ม.)"]    value    ==    11+11+10+10

Roofing Previous Arrow Returns To The Column Plates
    Open Level    roofing
    Previous Arrow Should Go To    column-plates    เพลทหัวเสา

Roofing Is Locked Until The Column Plates Are Done
    [Tags]    negative
    Level Should Be Locked    roofing    column-plates    เพลทหัวเสา

# ═══════════════════════════ 20 โครงหลังคา (roof-structure) ═══════════════════════════
Roof Structure Blank Project Counts Only The Rust Paint Lump Sum
    [Documentation]    Nothing is typed, yet the level shows the lump sum R158 "งานทาสีกันสนิม" (1 lot, 8,000 + 2,000 baht).
    Open Level    roof-structure
    Level Total Should Be    ${RUST_PAINT_LUMP}
    Level Totals Should Match Engine    roof-structure

Roof Structure Says The Roof Size Is Missing While Roofing Is Empty
    Open Level    roof-structure
    Get Text    css=body    contains    ยังไม่มีพื้นที่หลังคา

Roof Structure Can Be Confirmed With Nothing Because No Value Is Required
    [Documentation]    REQUIRED_FIELDS: everything derives from roofing or has a standard; confirm goes through.
    Open Level    roof-structure
    Confirm Level    door-window
    Level Mark Should Be    roof-structure    done

Roof Structure Filled From The Plan Matches The Engine And Confirms
    [Documentation]    Wall plate 36 m x double C = 72 m -> 12 sticks of 6 m; ridge 10 x 2 = 20 m -> 4; king posts
    ...    (1.5 x 2 + 1.2 x 2) x 2 = 10.8 m -> 2 sticks (ROUNDUP(length / 6), Excel J column).
    [Tags]    smoke
    Open Level    roof-structure
    Fill Roof Structure From Plan
    ${expected}=    Level Totals Should Match Engine    roof-structure
    VAR    ${out}    ${expected}[calcOutputs][roof-structure]
    Should Be Equal As Numbers    ${out}[R152]    12
    Should Be Equal As Numbers    ${out}[R154]    4
    Should Be Equal As Numbers    ${out}[R153]    2
    Numbers Should Be Close    ${out}[kingPosts.total]    10.8    0.001
    Confirm Level    door-window
    Level Mark Should Be    roof-structure    done

Roof Structure Rafters And Purlins Follow The Roofing Area
    [Documentation]    Cross-level: roofing 110 m2 at 30 deg gives a slope area of 127.02 m2 that roof-structure shows and
    ...    uses for rafters and purlins. Change the roofing area to 220 m2 and the roof-structure total changes as the
    ...    engine says (area doubles, more sticks).
    Open Level    roofing
    Fill Roofing From Plan
    Confirm Level    roof-structure
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    Get Text    css=body    contains    127.02 ตร.ม.
    ${first}=    Level Totals Should Match Engine    roof-structure
    VAR    ${one}    ${first}[calcOutputs][roof-structure]
    Should Be True    ${one}[R156] > 0
    Should Be True    ${one}[R157] > 0
    Numbers Should Be Close    ${one}[rafter.area]    127.017    0.001
    Previous Arrow Should Go To    roofing    วัสดุมุงหลังคา
    Fill Number By Label    ${AREA}    220
    Go To Level    roof-structure
    Get Text    css=body    contains    254.03 ตร.ม.
    ${second}=    Level Totals Should Match Engine    roof-structure
    VAR    ${two}    ${second}[calcOutputs][roof-structure]
    ${doubled}=    Evaluate    2 * ${one}[rafter.area]
    Numbers Should Be Close    ${two}[rafter.area]    ${doubled}    0.001
    Should Be True    ${two}[R156] > ${one}[R156]
    Should Be True    ${two}[R157] > ${one}[R157]
    Should Be True    ${second}[constructionTotal] > ${first}[constructionTotal]

Roof Structure Follows The Roofing Pitch As Well As The Area
    Open Level    roofing
    Fill Number By Label    ${AREA}    110
    Fill Number By Label    ${SLOPE}    30
    Confirm Level    roof-structure
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    ${low}=    Level Totals Should Match Engine    roof-structure
    Previous Arrow Should Go To    roofing    วัสดุมุงหลังคา
    Fill Number By Label    ${SLOPE}    45
    Go To Level    roof-structure
    ${high}=    Level Totals Should Match Engine    roof-structure
    Should Be True    ${high}[calcOutputs][roof-structure][rafter.area] > ${low}[calcOutputs][roof-structure][rafter.area]

Wall Plate Length Typed As Zero Is Stored As Zero
    [Tags]    edge
    [Template]    Roof Structure Lengths Edge
    wallPlate    อะเส    0    0

Wall Plate Length With A Thousands Comma Is Read As A Number
    [Tags]    edge
    [Template]    Roof Structure Lengths Edge
    wallPlate    อะเส    1,250.5    1250.5

Wall Plate Length As A Sum Of Segments Is Added Up
    [Tags]    edge
    [Template]    Roof Structure Lengths Edge
    wallPlate    อะเส    9.5+7+2    18.5

Wall Plate Length As A Repeated Segment Is Multiplied
    [Tags]    edge
    [Template]    Roof Structure Lengths Edge
    wallPlate    อะเส    =2.5*4    10

Wall Plate Length Negative Gives Totals Equal To The Engine
    [Tags]    edge    negative
    [Template]    Roof Structure Lengths Edge
    wallPlate    อะเส    -3    -3

Wall Plate Length Typed As Text Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Roof Structure Lengths Edge
    wallPlate    อะเส    abc    KEEP

Wall Plate Length Cleared Becomes Zero
    [Tags]    edge
    [Template]    Roof Structure Lengths Edge
    wallPlate    อะเส    ${EMPTY}    0

Wall Plate Length Very Large Still Equals The Engine
    [Tags]    edge
    [Template]    Roof Structure Lengths Edge
    wallPlate    อะเส    1000000    1000000

Wall Plate Length Divided By Zero Keeps The Old Value
    [Tags]    edge    negative
    [Template]    Roof Structure Lengths Edge
    wallPlate    อะเส    1/0    KEEP

Ridge Length Edge Values Are Handled
    [Tags]    edge
    [Template]    Roof Structure Lengths Edge
    ridge    อกไก่    12.5+11+4.5    28
    ridge    อกไก่    =2.5*4    10
    ridge    อกไก่    -3    -3
    ridge    อกไก่    abc    KEEP
    ridge    อกไก่    ${EMPTY}    0

Wall Plate Length Beyond The Number Range Never Shows NaN Or Infinity
    [Tags]    edge    negative    bug
    Open Level    roof-structure
    Fill Text By Label    อะเส    1e308+1e308
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number

Wall Plate Length Far Outside The Usual Range Shows A Note But Is Kept
    [Tags]    edge
    Open Level    roof-structure
    Fill Text By Label    อะเส    1000
    Get Text    css=body    contains    มากกว่าปกติ
    Level Totals Should Match Engine    roof-structure

First King Post Can Be Added From The Empty State
    Open Level    roof-structure
    Get Text    css=body    contains    ยังไม่มีดั้ง
    Click    css=button:has-text("เพิ่มดั้ง")
    Wait For Elements State    css=[aria-label="${KING_COUNT}"]    visible    timeout=10s
    Level Totals Should Match Engine    roof-structure

King Post Count And Height Are Counted In Six Metre Sticks
    [Documentation]    2 posts of 3.05 m, double C: 12.2 m -> 3 sticks (ROUNDUP(12.2 / 6)).
    Open Level    roof-structure
    Click    css=button:has-text("เพิ่มดั้ง")
    Fill Number By Label    ${KING_HEIGHT}    3.05
    Fill Number By Label    ${KING_COUNT}    2
    ${expected}=    Level Totals Should Match Engine    roof-structure
    Numbers Should Be Close    ${expected}[calcOutputs][roof-structure][kingPosts.total]    12.2    0.001
    Should Be Equal As Numbers    ${expected}[calcOutputs][roof-structure][R153]    3

King Post Count Edge Value Is Handled
    [Tags]    edge
    [Template]    King Post Count Edge
    0    0
    1,250.5    1250.5
    =2.5*4    10
    -3    -3
    abc    KEEP
    ${EMPTY}    0

King Posts Can Be Deleted One By One Down To The Empty State
    Open Level    roof-structure
    Fill Roof Structure From Plan
    ${before}=    Level Totals Should Match Engine    roof-structure
    Click    css=button[aria-label="ลบแถว"] >> nth=0
    Get Element Count    css=[aria-label="${KING_COUNT}"]    ==    1
    ${after}=    Level Totals Should Match Engine    roof-structure
    Should Be True    ${after}[calcOutputs][roof-structure][kingPosts.total] < ${before}[calcOutputs][roof-structure][kingPosts.total]
    Click    css=button[aria-label="ลบแถว"] >> nth=0
    Wait For Elements State    text=ยังไม่มีดั้ง    visible    timeout=10s
    Level Totals Should Match Engine    roof-structure

Sixteen King Posts Add Up To The Engine Total
    [Documentation]    16 rows (the Excel sheet has 5): 16 x 1 m x double C = 32 m -> 6 sticks.
    [Tags]    slow
    Open Level    roof-structure
    FOR    ${i}    IN RANGE    16
        Click    css=button:has-text("เพิ่มดั้ง")
        Fill Number By Label    ${KING_HEIGHT}    1    ${i}
        Fill Number By Label    ${KING_COUNT}    1    ${i}
    END
    Get Element Count    css=[aria-label="${KING_COUNT}"]    ==    16
    ${expected}=    Level Totals Should Match Engine    roof-structure
    Numbers Should Be Close    ${expected}[calcOutputs][roof-structure][kingPosts.total]    32    0.001
    Should Be Equal As Numbers    ${expected}[calcOutputs][roof-structure][R155]    0
    Should Be Equal As Numbers    ${expected}[calcOutputs][roof-structure][R153]    6

Valley Runs Give The Valley Length And Sticks
    [Documentation]    Runs 3.6 and 3.6 m at 40 degrees: length = sqrt(3.6^2 + 3.6^2) / cos(40 deg) = 6.646 m each (Excel G13),
    ...    4 valleys.
    Open Level    roof-structure
    Fill Number By Label    ระยะตามแนวราบ ด้านที่ 1 (ม.)    3.6
    Fill Number By Label    ระยะตามแนวราบ ด้านที่ 2 (ม.)    3.6
    Fill Number By Label    จำนวนตะเข้    4
    Fill Number By Label    ${SLOPE}    40
    Get Text    css=body    contains    6.65 ม.
    ${expected}=    Level Totals Should Match Engine    roof-structure
    Numbers Should Be Close    ${expected}[calcOutputs][roof-structure][valley.length]    6.6458    0.001

Valley Pitch Can Be Taken From The Roofing Level
    [Documentation]    When the valley pitch differs from the roof's, a link "ใช้ความชันเดียวกับหลังคา (30°)" copies it.
    Open Level    roofing
    Fill Roofing From Plan
    Confirm Level    roof-structure
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    Click    css=button:has-text("ใช้ความชันเดียวกับหลังคา (30°)")
    ${input}=    Stored Input    roof-structure
    Should Be Equal As Numbers    ${input}[valley][deg]    30
    Level Totals Should Match Engine    roof-structure

Valley Values Typed As Text Keep The Old Value
    [Tags]    edge    negative
    Open Level    roof-structure
    Fill Number By Label    ระยะตามแนวราบ ด้านที่ 1 (ม.)    3.6
    Fill Number By Label    ระยะตามแนวราบ ด้านที่ 1 (ม.)    abc
    ${input}=    Stored Input    roof-structure
    Should Be Equal As Numbers    ${input}[valley][runA]    3.6
    Level Totals Should Match Engine    roof-structure

Roof Structure Values And Mark Survive A Reload
    Open Level    roof-structure
    Fill Roof Structure From Plan
    Confirm Level    door-window
    Go To Level    roof-structure
    Reload Level
    Level Totals Should Match Engine    roof-structure
    Level Mark Should Be    roof-structure    done
    Get Property    css=[aria-label="อะเส"]    value    ==    8+10+8+10
    Get Element Count    css=[aria-label="${KING_COUNT}"]    ==    2

Roof Structure Previous Arrow Returns To The Roofing
    Open Level    roof-structure
    Previous Arrow Should Go To    roofing    วัสดุมุงหลังคา

Roof Structure Is Locked Until The Roofing Is Done
    [Tags]    negative
    Level Should Be Locked    roof-structure    roofing    วัสดุมุงหลังคา


*** Keywords ***
Roofing Number Edge
    [Documentation]    Roofing is filled (110 m2, 30 deg); ``${typed}`` goes into the number ``${label}`` whose saved field is
    ...    ``${field}``: saved as ``${expected}`` (``KEEP`` = unchanged), totals equal the engine, screen has no NaN.
    [Arguments]    ${label}    ${field}    ${typed}    ${expected}
    Open Level    roofing
    Fill Number By Label    ${AREA}    110
    Fill Number By Label    ${SLOPE}    30
    ${before}=    Stored Input    roofing
    VAR    ${old}    ${before}[${field}]
    Fill Number By Label    ${label}    ${typed}
    ${after}=    Stored Input    roofing
    VAR    ${now}    ${after}[${field}]
    ${want}=    Set Variable If    '${expected}' == 'KEEP'    ${old}    ${expected}
    Should Be Equal As Numbers    ${now}    ${want}    msg=Typed "${typed}" into ${label}: saved ${now}, expected ${want}
    Level Totals Should Match Engine    roofing
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number

Roofing Area Edge
    [Arguments]    ${typed}    ${expected}
    Roofing Number Edge    ${AREA}    planArea    ${typed}    ${expected}

Roofing Slope Edge
    [Arguments]    ${typed}    ${expected}
    Roofing Number Edge    ${SLOPE}    slopeDeg    ${typed}    ${expected}

Roofing Slope Chip
    [Arguments]    ${chip}    ${value}
    Open Level    roofing
    Fill Number By Label    ${AREA}    110
    Click    css=[aria-label="ค่าที่ใช้บ่อย"] >> css=button:text-is("${chip}")
    ${input}=    Stored Input    roofing
    Should Be Equal As Numbers    ${input}[slopeDeg]    ${value}
    Get Property    css=[aria-label="${SLOPE}"]    value    ==    ${value}
    Level Totals Should Match Engine    roofing

Roofing Ridge Edge
    [Documentation]    The ridge length cell takes a sum of segments; the saved segments add up to ``${expected}``.
    [Arguments]    ${typed}    ${expected}
    Open Level    roofing
    Fill Number By Label    ${AREA}    110
    Fill Number By Label    ${SLOPE}    30
    Fill Text By Label    ครอบสันโค้ง (ม.)    10
    ${before}=    Stored Input    roofing
    ${old}=    Evaluate    sum([r for r in $before['rows'] if r['key'] == 'ridge'][0]['takeoff']['lengths'])
    Fill Text By Label    ครอบสันโค้ง (ม.)    ${typed}
    ${after}=    Stored Input    roofing
    ${now}=    Evaluate    sum([r for r in $after['rows'] if r['key'] == 'ridge'][0]['takeoff']['lengths'])
    ${want}=    Set Variable If    '${expected}' == 'KEEP'    ${old}    ${expected}
    Should Be Equal As Numbers    ${now}    ${want}    msg=Typed "${typed}" into the ridge: saved ${now}, expected ${want}
    Level Totals Should Match Engine    roofing
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number

Roof Structure Lengths Edge
    [Documentation]    A plan-length cell (``${member}`` = wallPlate or ridge) holds 10; ``${typed}`` is typed into it:
    ...    the saved segments add up to ``${expected}`` (``KEEP`` = 10), totals equal the engine, no NaN.
    [Arguments]    ${member}    ${label}    ${typed}    ${expected}
    Open Level    roof-structure
    Fill Text By Label    ${label}    10
    ${before}=    Stored Input    roof-structure
    ${old}=    Evaluate    sum($before['${member}']['lengths'])
    Fill Text By Label    ${label}    ${typed}
    ${after}=    Stored Input    roof-structure
    ${now}=    Evaluate    sum($after['${member}']['lengths'])
    ${want}=    Set Variable If    '${expected}' == 'KEEP'    ${old}    ${expected}
    Should Be Equal As Numbers    ${now}    ${want}    msg=Typed "${typed}" into ${label}: saved ${now}, expected ${want}
    Level Totals Should Match Engine    roof-structure
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number

King Post Count Edge
    [Arguments]    ${typed}    ${expected}
    Open Level    roof-structure
    Click    css=button:has-text("เพิ่มดั้ง")
    Fill Number By Label    ${KING_HEIGHT}    1.5
    Fill Number By Label    ${KING_COUNT}    2
    Fill Number By Label    ${KING_COUNT}    ${typed}
    ${input}=    Stored Input    roof-structure
    VAR    ${now}    ${input}[kingPosts][parts][0][count]
    ${want}=    Set Variable If    '${expected}' == 'KEEP'    2    ${expected}
    Should Be Equal As Numbers    ${now}    ${want}    msg=Typed "${typed}" into the king post count: saved ${now}, expected ${want}
    Level Totals Should Match Engine    roof-structure
    Screen Should Have No NaN Or Infinity
    Level Total Should Be A Number
