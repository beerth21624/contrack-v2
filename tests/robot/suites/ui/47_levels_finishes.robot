*** Settings ***
Documentation       W3b: journey levels 32-37 (ceiling, floor-tile, toilet-tile, wall-finishing, paint, misc) in depth.
...                 Per level: blank state, required values (docs/rebuild/REQUIRED_FIELDS.md), fill from plan then
...                 confirm, half-filled cards, edge inputs, every option, values pulled from earlier levels, rows
...                 (add / duplicate / delete / 16 rows), reload, previous arrow, locked URL. Totals always come from
...                 the BOQ engine (``Totals Should Match Engine``); hard-coded numbers are plan arithmetic that is
...                 explained in the test (area = width x length).
Resource            ../../resources/pages/levels_finishes.resource
Suite Setup         Open Browser With Patience
Test Tags           journey    finishes


*** Variables ***
${SAMPLE_TOTAL}     1855162


*** Test Cases ***
# ───────────── 32 ceiling ─────────────

Ceiling Blank Shows Zero And Confirm Is Blocked
    [Documentation]    A blank project: level total 0, empty state; confirm needs at least one room (1 item).
    [Tags]    negative
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Level Total Should Be    0
    Totals Should Match Engine    ceiling
    Get Text    css=body    contains    ยังไม่มีห้อง
    Confirm Level Should Be Blocked    ceiling    1
    Get Text    ${MISSING_ALERT}    contains    เพิ่มฝ้าเพดานอย่างน้อย 1 ห้อง
    Level Mark Should Be    ceiling    ${NONE}

Ceiling Filled From Plan Confirms And Opens Floor Tile
    [Documentation]    The test house ceiling (73.1 m2 = 20 + 10.5 + 10.5 + 7.5 + 3 + 21.6): totals equal the engine,
    ...    confirm stores "done" and opens ปูกระเบื้องพื้น.
    [Tags]    smoke
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Fill Ceiling From Plan
    Card Count Should Be    6
    ${expected}=    Totals Should Match Engine    ceiling
    Numbers Should Be Close    ${expected}[calcOutputs][ceiling][total]    73.1    0.001
    ${lvl}=    Expected Level    ${expected}    ceiling
    Should Be True    ${lvl}[total] > 0
    Get Text    css=body    contains    กรอกแล้ว 6 / 6 ห้อง
    Confirm Level    floor-tile
    Level Mark Should Be    ceiling    done
    Wait For Level Page

Ceiling Half Filled Room Is Blocked Then Passes
    [Documentation]    A room with a width but no length costs nothing and is blocked ("ห้องที่ 1 — ยาว");
    ...    typing the length lets the level pass.
    [Tags]    negative
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    ${card}=    Add Room Card
    Fill Card Number    ${card}    กว้าง (ม.)    4
    Confirm Level Should Be Blocked    ceiling    1
    Get Text    ${MISSING_ALERT}    contains    ห้องที่ 1 — ยาว
    Get Text    ${ROOM_CARD} >> nth=0    contains    ยังขาด: ยาว
    Fill Card Number    ${card}    ยาว (ม.)    5
    Totals Should Match Engine    ceiling
    Confirm Level    floor-tile
    Level Mark Should Be    ceiling    done

Ceiling Room Without Type Is Blocked
    [Documentation]    Clearing nothing is possible, but a sample-based row can lack a type: a row whose sizes are typed
    ...    in the sheet table with no type is "ชนิดฝ้า" missing. Seeded: width and length set, type empty.
    [Tags]    negative
    Open Fresh Context
    ${data}=    Ceiling Data    :4:5:ห้องรับแขก:
    Start Project With Data    ${data}    /journey/ceiling    ceiling
    Wait For Level Page
    Totals Should Match Engine    ceiling
    Confirm Level Should Be Blocked    ceiling    1
    Get Text    ${MISSING_ALERT}    contains    ชนิดฝ้า
    Choose Card Option    0    ชนิดฝ้า    ${CEILING_TYPE}[C1]
    Confirm Level    floor-tile

Ceiling Untouched Extra Room Does Not Block
    [Documentation]    A just-added room with no size is not an item and not incomplete: one good room plus an empty
    ...    card still confirms.
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Add Ceiling Room    ห้องนอน 1    C1    3    3.5
    Add Room Card
    Card Count Should Be    2
    ${expected}=    Totals Should Match Engine    ceiling
    Numbers Should Be Close    ${expected}[calcOutputs][ceiling][total]    10.5    0.001
    Confirm Level    floor-tile

Ceiling Every Type Option Reaches The Engine
    [Documentation]    Each ceiling type (C1 gypsum, C2 moisture-resistant, C3 eaves, C4 slats): the stored code, the
    ...    paint group that follows the type, the area (width x length), and the summary line.
    [Tags]    edge
    [Template]    Ceiling Type Case
    C1    4      5     20      ยิปซัมบอร์ด 9 มม. (ห้องทั่วไป)    ภายใน
    C2    1.5    2     3       ยิปซัมบอร์ดกันชื้น 9 มม. (ห้องน้ำ, เฉลียง)    ภายใน
    C3    0.6    36    21.6    ไฟเบอร์ซีเมนต์ 4 มม. (ชายคาภายนอก)    ภายนอก
    C4    3.5    4     14      ระแนงไม้ไฟเบอร์ซีเมนต์ 4 นิ้ว    ไม้ระแนง

Ceiling Every Paint Option Reaches The Engine
    [Documentation]    Each "ทาสีฝ้า" choice moves the room's area into its paint group (or none) for the paint level.
    [Tags]    edge
    [Template]    Ceiling Paint Case
    สีภายใน    ภายใน    ส่งต่อขั้นตอนทาสี: สีภายใน 20.00 ตร.ม.
    สีภายนอก    ภายนอก    ส่งต่อขั้นตอนทาสี: สีภายนอก 20.00 ตร.ม.
    สีย้อมไม้ (ระแนง)    ไม้ระแนง    ส่งต่อขั้นตอนทาสี: สีย้อมไม้ (ระแนง) 20.00 ตร.ม.
    ไม่ทาสี    ${EMPTY}    พื้นที่ฝ้าที่ทาสีจะส่งต่อไปขั้นตอนทาสีให้อัตโนมัติ

Ceiling Width Accepts Odd Input And Stays Finite
    [Documentation]    Edge inputs in the width cell (typed 4 first): plain numbers, thousands separators, "=" formulas,
    ...    sums, negative (accepted with a warning), text (ignored, keeps 4), cleared (0), huge.
    [Tags]    edge    negative
    [Template]    Ceiling Width Case
    0                 0
    1,250.5           1250.5      มากกว่าปกติ
    =2.5*4            10
    9.5+7+2           18.5
    -3                -3          ค่าติดลบ
    abc               keep
    ${EMPTY}          0
    99999999          99999999    มากกว่าปกติ

Ceiling Slope Accepts Any Angle And Stays Finite
    [Documentation]    The slope (degrees) divides the area by cos: flat, 40, 89, an impossible 90 and 120, text.
    [Tags]    edge
    [Template]    Ceiling Slope Case
    0       0
    40      40
    89      89
    90      90
    120     120
    abc     keep

Ceiling Rooms Can Be Duplicated And Deleted
    [Documentation]    Add 2 rooms, duplicate one (name counts up), delete the middle one, then the last, then the
    ...    only one: the engine area follows each step and the empty state returns.
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Add Ceiling Room    ห้องนอน 1    C1    3    3.5
    Add Ceiling Room    ห้องครัว    C1    2.5    3
    Duplicate Card    0
    Card Count Should Be    3
    Get Property    css=[aria-label="ชื่อห้องที่ 2"]    value    ==    ห้องนอน 2
    ${expected}=    Totals Should Match Engine    ceiling
    Numbers Should Be Close    ${expected}[calcOutputs][ceiling][total]    28.5    0.001
    Delete Card    1
    Card Count Should Be    2
    ${expected}=    Totals Should Match Engine    ceiling
    Numbers Should Be Close    ${expected}[calcOutputs][ceiling][total]    18    0.001
    Delete Card    1
    Card Count Should Be    1
    ${expected}=    Totals Should Match Engine    ceiling
    Numbers Should Be Close    ${expected}[calcOutputs][ceiling][total]    10.5    0.001
    Delete Card    0
    Card Count Should Be    0
    Level Total Should Be    0
    Get Text    css=body    contains    ยังไม่มีห้อง

Ceiling Sixteen Rooms Add Up
    [Documentation]    16 rooms of 3 x 4 m typed through the screen: 192 m2, the progress line counts 16, and the
    ...    rooms survive a reload.
    [Tags]    slow
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    FOR    ${i}    IN RANGE    1    17
        Add Ceiling Room    ห้อง ${i}    C1    3    4
    END
    Card Count Should Be    16
    ${expected}=    Totals Should Match Engine    ceiling
    Numbers Should Be Close    ${expected}[calcOutputs][ceiling][total]    192    0.001
    Get Text    css=body    contains    กรอกแล้ว 16 / 16 ห้อง
    Reload
    Wait For Level Page
    Card Count Should Be    16
    Totals Should Match Engine    ceiling

Ceiling Values Survive A Reload
    [Documentation]    Name, type, sizes and paint group are still on the screen after a reload.
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Add Ceiling Room    ห้องรับแขก    C2    4    5
    Choose Card Option    0    ทาสีฝ้า    สีภายนอก
    Stored Value Should Be    ceiling    ['rows'][0]['paint']    ภายนอก
    Reload
    Wait For Level Page
    Get Property    css=[aria-label="ชื่อห้องที่ 1"]    value    ==    ห้องรับแขก
    Input Number Should Be    ${ROOM_CARD} >> nth=0 >> css=[aria-label="กว้าง (ม.)"]    4
    Input Number Should Be    ${ROOM_CARD} >> nth=0 >> css=[aria-label="ยาว (ม.)"]    5
    Get Attribute    ${ROOM_CARD} >> nth=0 >> css=[role="radiogroup"][aria-label="ชนิดฝ้า"] button:text-is("ยิปซัมกันชื้น")    aria-checked    ==    true
    Get Attribute    ${ROOM_CARD} >> nth=0 >> css=[role="radiogroup"][aria-label="ทาสีฝ้า"] button:text-is("สีภายนอก")    aria-checked    ==    true
    Totals Should Match Engine    ceiling

Ceiling Sample House Equals The Engine And Confirms
    [Documentation]    The Excel v5 sample ceiling meets every requirement: totals equal the engine and it confirms.
    Open Fresh Context
    Start Guest Project    sample    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    ${expected}=    Totals Should Match Engine    ceiling
    ${lvl}=    Expected Level    ${expected}    ceiling
    Should Be True    ${lvl}[total] > 0
    Card Count Should Be    17
    Confirm Level    floor-tile

# ───────────── 33 floor-tile ─────────────

Floor Tile Blank Shows Zero And Confirm Is Blocked
    [Documentation]    Floor Tile Blank Shows Zero And Confirm Is Blocked.
    [Tags]    negative
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    Level Total Should Be    0
    Totals Should Match Engine    floor-tile
    Confirm Level Should Be Blocked    floor-tile    1
    Get Text    ${MISSING_ALERT}    contains    เพิ่มพื้นปูกระเบื้องอย่างน้อย 1 ห้อง
    Level Mark Should Be    floor-tile    ${NONE}

Floor Tile Filled From Plan Confirms And Opens Toilet Tile
    [Documentation]    4 granito rooms: 20 + 10.5 + 10.5 + 7.5 = 48.5 m2.
    [Tags]    smoke
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    Fill Floor Tile From Plan
    Card Count Should Be    4
    ${expected}=    Totals Should Match Engine    floor-tile
    Numbers Should Be Close    ${expected}[calcOutputs][floor-tile][total]    48.5    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][floor-tile][F1]    48.5    0.001
    Confirm Level    toilet-tile
    Level Mark Should Be    floor-tile    done

Floor Tile Half Filled Room Is Blocked Then Passes
    [Documentation]    Floor Tile Half Filled Room Is Blocked Then Passes.
    [Tags]    negative
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    ${card}=    Add Room Card
    Fill Card Number    ${card}    ยาว (ม.)    5
    Confirm Level Should Be Blocked    floor-tile    1
    Get Text    ${MISSING_ALERT}    contains    ห้องที่ 1 — กว้าง
    Fill Card Number    ${card}    กว้าง (ม.)    4
    Totals Should Match Engine    floor-tile
    Confirm Level    toilet-tile

Floor Tile Untouched Extra Room Does Not Block
    [Documentation]    Floor Tile Untouched Extra Room Does Not Block.
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    Add Floor Room    ห้องนอน 1    F1    3    3.5
    Add Room Card
    Card Count Should Be    2
    Totals Should Match Engine    floor-tile
    Confirm Level    toilet-tile

Floor Tile Every Type Option Reaches The Engine
    [Documentation]    F1 granito, F3 non-slip granito, F4 waterproof levelling: stored code, area and summary line.
    [Tags]    edge
    [Template]    Floor Type Case
    F1    4    5    20    กระเบื้องแกรนิตโต้ (ห้องทั่วไป)
    F3    1    4    4     กระเบื้องแกรนิตโต้ กันลื่น (เฉลียง, บันได)
    F4    3.5    4    14    ปรับระดับ ทำกันซึม (ดาดฟ้า)

Floor Tile Width Accepts Odd Input And Stays Finite
    [Documentation]    Floor Tile Width Accepts Odd Input And Stays Finite.
    [Tags]    edge    negative
    [Template]    Floor Width Case
    0                 0
    1,250.5           1250.5      มากกว่าปกติ
    =2.5*4            10
    9.5+7+2           18.5
    -3                -3          ค่าติดลบ
    abc               keep
    ${EMPTY}          0
    99999999          99999999    มากกว่าปกติ

Floor Tile Copies Rooms From The Ceiling
    [Documentation]    fromCeiling: rooms typed on the ceiling level become floor rows. Bathrooms and eaves are left out
    ...    (message says so), a slat ceiling (C4) gets the non-slip floor F3. Copy button disappears once copied.
    Open Fresh Context
    ${data}=    Ceiling Data    C1:4:5:ห้องรับแขก:ภายใน    C1:3:3.5:ห้องนอน 1:ภายใน    C2:1.5:2:ห้องน้ำ 1:ภายใน
    ...    C3:0.6:36:ชายคา:ภายนอก    C4:1.5:3:เฉลียงพักผ่อน:ไม้ระแนง
    Start Project With Data    ${data}    /journey/floor-tile    floor-tile
    Wait For Level Page
    Get Text    css=body    contains    คัดลอกห้องจากฝ้าเพดาน (3 ห้อง)
    Click    css=button:has-text("คัดลอกห้องจากฝ้าเพดาน")
    Message Should Appear    คัดลอก 3 ห้องแล้ว (ไม่รวมห้องน้ำ 1 ห้อง)
    Card Count Should Be    3
    Stored Value Should Be    floor-tile    ['rows'][2]['code']    F3
    Stored Value Should Be    floor-tile    ['rows'][0]['code']    F1
    ${expected}=    Totals Should Match Engine    floor-tile
    Numbers Should Be Close    ${expected}[calcOutputs][floor-tile][total]    35    0.001
    Get Element Count    css=button:has-text("คัดลอกห้องจากฝ้าเพดาน")    ==    0
    Get Text    ${ROOM_CARD} >> nth=0    contains    20.00 ตร.ม.
    Confirm Level    toilet-tile

Floor Tile Follows A Changed Ceiling
    [Documentation]    Change the earlier level's data (a second seeded project): the rooms offered and the floor total
    ...    follow the ceiling, always equal to the engine.
    Open Fresh Context
    ${a}=    Ceiling Data    C1:4:5:ห้องรับแขก:ภายใน
    Start Project With Data    ${a}    /journey/floor-tile    floor-tile
    Wait For Level Page
    Get Text    css=body    contains    คัดลอกห้องจากฝ้าเพดาน (1 ห้อง)
    Click    css=button:has-text("คัดลอกห้องจากฝ้าเพดาน")
    ${one}=    Totals Should Match Engine    floor-tile
    Numbers Should Be Close    ${one}[calcOutputs][floor-tile][total]    20    0.001
    ${b}=    Ceiling Data    C1:6:5:ห้องรับแขก:ภายใน    C1:3:3:ห้องครัว:ภายใน
    Start Project With Data    ${b}    /journey/floor-tile    floor-tile
    Wait For Level Page
    Get Text    css=body    contains    คัดลอกห้องจากฝ้าเพดาน (2 ห้อง)
    Click    css=button:has-text("คัดลอกห้องจากฝ้าเพดาน")
    ${two}=    Totals Should Match Engine    floor-tile
    Numbers Should Be Close    ${two}[calcOutputs][floor-tile][total]    39    0.001

Floor Tile Offers No Copy When The Ceiling Is Empty
    [Documentation]    Floor Tile Offers No Copy When The Ceiling Is Empty.
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    Get Element Count    css=button:has-text("คัดลอกห้องจากฝ้าเพดาน")    ==    0
    Get Text    css=body    contains    ห้องน้ำไม่ต้องใส่ที่นี่
    Get Element Count    ${ADD_ROOM}    ==    1

Floor Tile Bathroom Name Warns About Double Counting
    [Documentation]    Floor Tile Bathroom Name Warns About Double Counting.
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    Add Floor Room    ห้องน้ำ 1    F1    1.5    2
    Get Text    css=body    contains    ห้องน้ำกรอกในขั้นตอนกระเบื้องห้องน้ำ — ที่นี่จะนับซ้ำ
    Totals Should Match Engine    floor-tile

Floor Tile Stair Row Uses Stair Wording
    [Documentation]    A room named บันได relabels the size boxes; "0.9+0.45" sums to 1.35 m.
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    ${card}=    Add Room Card
    Fill Text By Label    ชื่อห้องที่ 1    บันได (1)
    Choose Card Option    ${card}    ชนิดพื้น    ${FLOOR_TYPE}[F3]
    Fill Card Number    ${card}    ความกว้างบันได (ม.)    3.3
    Fill Card Number    ${card}    ลูกนอน + ลูกตั้ง (ม.)    0.9+0.45
    Stored Number Should Be    floor-tile    ['rows'][0]['length']    1.35
    ${expected}=    Totals Should Match Engine    floor-tile
    Numbers Should Be Close    ${expected}[calcOutputs][floor-tile][F3]    4.455    0.001

Floor Tile Rooms Can Be Duplicated And Deleted
    [Documentation]    Floor Tile Rooms Can Be Duplicated And Deleted.
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    Add Floor Room    ห้องนอน 1    F1    3    3.5
    Add Floor Room    ห้องครัว    F1    2.5    3
    Duplicate Card    0
    Card Count Should Be    3
    Get Property    css=[aria-label="ชื่อห้องที่ 2"]    value    ==    ห้องนอน 2
    ${expected}=    Totals Should Match Engine    floor-tile
    Numbers Should Be Close    ${expected}[calcOutputs][floor-tile][total]    28.5    0.001
    Delete Card    2
    Delete Card    1
    Card Count Should Be    1
    ${expected}=    Totals Should Match Engine    floor-tile
    Numbers Should Be Close    ${expected}[calcOutputs][floor-tile][total]    10.5    0.001
    Delete Card    0
    Level Total Should Be    0
    Get Text    css=body    contains    ยังไม่มีห้อง

Floor Tile Sixteen Rooms Add Up
    [Documentation]    Floor Tile Sixteen Rooms Add Up.
    [Tags]    slow
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    FOR    ${i}    IN RANGE    1    17
        Add Floor Room    ห้อง ${i}    F1    3    4
    END
    Card Count Should Be    16
    ${expected}=    Totals Should Match Engine    floor-tile
    Numbers Should Be Close    ${expected}[calcOutputs][floor-tile][total]    192    0.001
    Reload
    Wait For Level Page
    Card Count Should Be    16
    Totals Should Match Engine    floor-tile

Floor Tile Values Survive A Reload
    [Documentation]    Floor Tile Values Survive A Reload.
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    Add Floor Room    ห้องรับแขก    F3    4    5
    Stored Value Should Be    floor-tile    ['rows'][0]['code']    F3
    Reload
    Wait For Level Page
    Get Property    css=[aria-label="ชื่อห้องที่ 1"]    value    ==    ห้องรับแขก
    Input Number Should Be    ${ROOM_CARD} >> nth=0 >> css=[aria-label="ยาว (ม.)"]    5
    Get Attribute    ${ROOM_CARD} >> nth=0 >> css=[role="radiogroup"][aria-label="ชนิดพื้น"] button:text-is("แกรนิตโต้ กันลื่น")    aria-checked    ==    true
    Totals Should Match Engine    floor-tile

Floor Tile Sample House Equals The Engine And Confirms
    [Documentation]    Floor Tile Sample House Equals The Engine And Confirms.
    Open Fresh Context
    Start Guest Project    sample    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    ${expected}=    Totals Should Match Engine    floor-tile
    ${lvl}=    Expected Level    ${expected}    floor-tile
    Should Be True    ${lvl}[total] > 0
    Confirm Level    toilet-tile

# ───────────── 34 toilet-tile ─────────────

Toilet Tile Blank Shows Zero And Confirm Passes
    [Documentation]    REQUIRED_FIELDS: a bathroom row needs its sizes, but no bathroom is required, so an empty
    ...    level confirms.
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    Level Total Should Be    0
    Totals Should Match Engine    toilet-tile
    Get Text    css=body    contains    ยังไม่มีห้องน้ำ
    Confirm Level    wall-finishing
    Level Mark Should Be    toilet-tile    done

Toilet Tile Filled From Plan Confirms And Opens Wall Finishing
    [Documentation]    Bathroom 1.5 x 2.0, tiled 2.0 m high, door 1.4 m2: floor 3.0, wall 7 x 2.0 - 1.4 = 12.6 m2.
    ...    The wall length 7 m is filled by the app from the floor size.
    [Tags]    smoke
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    Fill Toilet Tile From Plan
    Input Number Should Be    css=[aria-label="ความยาวรอบห้อง (ม.)"]    7
    ${expected}=    Totals Should Match Engine    toilet-tile
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][floorArea]    3    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][wallArea]    12.6    0.001
    Confirm Level    wall-finishing
    Level Mark Should Be    toilet-tile    done

Toilet Tile Floor Only Is Blocked Until The Wall Height Is Typed
    [Documentation]    Floor sized but the wall has no tile height: blocked with "ความสูงกระเบื้องผนัง".
    [Tags]    negative
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${bath}=    Add Bathroom
    Fill Number By Label    กว้างห้อง (ม.)    1.5    ${bath}
    Fill Number By Label    ยาวห้อง (ม.)    2.0    ${bath}
    Confirm Level Should Be Blocked    toilet-tile    1
    Get Text    ${MISSING_ALERT}    contains    ความสูงกระเบื้องผนัง
    Fill Number By Label    ความสูงที่กรุกระเบื้อง (ม.)    2.0    ${bath}
    Totals Should Match Engine    toilet-tile
    Confirm Level    wall-finishing

Toilet Tile Half Filled Floor Is Blocked Then Passes
    [Documentation]    Only the floor width typed: the engine's count of missing values is shown; finishing the
    ...    bathroom lets the level pass.
    [Tags]    negative
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${bath}=    Add Bathroom
    Fill Number By Label    กว้างห้อง (ม.)    1.5    ${bath}
    Confirm Should Be Blocked Like The Engine    toilet-tile
    Fill Number By Label    ยาวห้อง (ม.)    2.0    ${bath}
    Fill Number By Label    ความสูงที่กรุกระเบื้อง (ม.)    2.0    ${bath}
    Totals Should Match Engine    toilet-tile
    Confirm Level    wall-finishing

Toilet Tile Untouched Bathroom Does Not Block
    [Documentation]    A bathroom card added but not typed in has no plan value, so it is ignored.
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    Add Bathroom
    Totals Should Match Engine    toilet-tile
    Confirm Level    wall-finishing

Toilet Tile Wall Length Follows The Floor And Can Be Reset
    [Documentation]    2 x (1.5 + 2.0) = 7 m is offered; a typed 8 m is kept and "ใช้รอบห้อง" brings 7 m back.
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${bath}=    Add Bathroom
    Fill Bathroom    ${bath}    1.5    2.0    2.0
    Input Number Should Be    css=[aria-label="ความยาวรอบห้อง (ม.)"]    7
    Get Element Count    css=button:has-text("ใช้รอบห้อง")    ==    0
    Fill Number By Label    ความยาวรอบห้อง (ม.)    8
    Get Text    css=button:has-text("ใช้รอบห้อง")    contains    ใช้รอบห้อง 7.00 ม.
    Click    css=button:has-text("ใช้รอบห้อง")
    Input Number Should Be    css=[aria-label="ความยาวรอบห้อง (ม.)"]    7
    Totals Should Match Engine    toilet-tile

Toilet Tile Height Chips Fill The Tile Height
    [Documentation]    The quick-pick chips set the tile height: 1.2, 1.5, 2.0 and "เต็มผนัง" = 2.4 m.
    [Tags]    edge
    [Template]    Toilet Height Chip Case
    1.2           1.2
    1.5           1.5
    2.0           2
    เต็มผนัง      2.4

Toilet Tile Openings Accept A Formula
    [Documentation]    "0.7*2+0.5*1.8" = 2.3 m2 is deducted: wall 7 x 2.0 - 2.3 = 11.7 m2.
    [Tags]    edge
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${bath}=    Add Bathroom
    Fill Bathroom    ${bath}    1.5    2.0    2.0    0.7*2+0.5*1.8
    Stored Number Should Be    toilet-tile    ['rows'][1]['openings']    2.3
    ${expected}=    Totals Should Match Engine    toilet-tile
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][wallArea]    11.7    0.001

Toilet Tile Openings Larger Than The Wall Are Flagged
    [Documentation]    A 100 m2 opening on a 14 m2 wall: a red warning, and the screen still equals the engine.
    [Tags]    negative    edge
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${bath}=    Add Bathroom
    Fill Bathroom    ${bath}    1.5    2.0    2.0    100
    Get Text    css=body    contains    ช่องเปิดมากกว่าพื้นที่ผนัง
    Totals Should Match Engine    toilet-tile
    Page Should Show No Broken Number

Toilet Tile Floor Width Accepts Odd Input And Stays Finite
    [Documentation]    Toilet Tile Floor Width Accepts Odd Input And Stays Finite.
    [Tags]    edge    negative
    [Template]    Bathroom Width Case
    0                 0
    1,250.5           1250.5      มากกว่าปกติ
    =2.5*4            10
    9.5+7+2           18.5
    -3                -3          ค่าติดลบ
    abc               keep
    ${EMPTY}          None
    99999999          99999999    มากกว่าปกติ

Toilet Tile Two Bathrooms Are Counted Separately
    [Documentation]    Bathroom 2 is 1.2 x 1.8: floors 3.0 + 2.16, walls (7 x 2.0 - 1.4) + (6 x 2.0 - 1.4).
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${b1}=    Add Bathroom
    Fill Bathroom    ${b1}    1.5    2.0    2.0    0.7*2
    ${b2}=    Add Bathroom
    Fill Bathroom    ${b2}    1.2    1.8    2.0    0.7*2
    Get Property    css=[aria-label="ชื่อห้องน้ำที่ 2"]    value    ==    ห้องน้ำ 2
    ${expected}=    Totals Should Match Engine    toilet-tile
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][floorArea]    5.16    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][wallArea]    23.2    0.001

Toilet Tile Bathroom Can Be Duplicated Renamed And Deleted
    [Documentation]    Toilet Tile Bathroom Can Be Duplicated Renamed And Deleted.
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${bath}=    Add Bathroom
    Fill Bathroom    ${bath}    1.5    2.0    2.0    0.7*2
    Click    css=button[title="ทำซ้ำรายการนี้"] >> nth=0
    Wait For Elements State    css=[aria-label="ชื่อห้องน้ำที่ 2"]    visible
    ${expected}=    Totals Should Match Engine    toilet-tile
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][floorArea]    6    0.001
    Fill Text By Label    ชื่อห้องน้ำที่ 1    ห้องน้ำชั้นล่าง
    Stored Value Should Be    toilet-tile    ['rows'][0]['location']    ห้องน้ำชั้นล่าง
    Stored Value Should Be    toilet-tile    ['rows'][1]['location']    ห้องน้ำชั้นล่าง
    Click    css=button[aria-label="ลบ"] >> nth=1
    Click Popconfirm Ok    ลบ
    Get Element Count    css=[aria-label^="ชื่อห้องน้ำที่"]    ==    1
    ${expected}=    Totals Should Match Engine    toilet-tile
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][floorArea]    3    0.001
    Click    css=button[aria-label="ลบ"] >> nth=0
    Click Popconfirm Ok    ลบ
    Level Total Should Be    0
    Get Text    css=body    contains    ยังไม่มีห้องน้ำ

Toilet Tile Extra Floor Row Can Be Added And Removed
    [Documentation]    The "+ พื้น" button adds a second floor row (1.0 x 1.0 = +1 m2), its trash button removes it.
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${bath}=    Add Bathroom
    Fill Bathroom    ${bath}    1.5    2.0    2.0
    Click    css=button:has-text("พื้น")
    Get Element Count    css=[aria-label="กว้างห้อง (ม.)"]    ==    2
    Fill Number By Label    กว้างห้อง (ม.)    1    1
    Fill Number By Label    ยาวห้อง (ม.)    1    1
    ${expected}=    Totals Should Match Engine    toilet-tile
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][floorArea]    4    0.001
    Click    css=button[aria-label="ลบแถว"] >> nth=2
    Get Element Count    css=[aria-label="กว้างห้อง (ม.)"]    ==    1
    ${expected}=    Totals Should Match Engine    toilet-tile
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][floorArea]    3    0.001

Toilet Tile Fifteen Bathrooms Add Up
    [Documentation]    Toilet Tile Fifteen Bathrooms Add Up.
    [Tags]    slow
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    FOR    ${_}    IN RANGE    15
        ${bath}=    Add Bathroom
        Fill Bathroom    ${bath}    2    2    2.0
    END
    Get Element Count    css=[aria-label^="ชื่อห้องน้ำที่"]    ==    15
    ${expected}=    Totals Should Match Engine    toilet-tile
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][floorArea]    60    0.001
    Get Text    css=body    contains    กรอกแล้ว 15 / 15 ห้อง
    Reload
    Wait For Level Page
    Get Element Count    css=[aria-label^="ชื่อห้องน้ำที่"]    ==    15
    Totals Should Match Engine    toilet-tile

Toilet Tile Values Survive A Reload
    [Documentation]    Toilet Tile Values Survive A Reload.
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    Fill Toilet Tile From Plan
    Stored Number Should Be    toilet-tile    ['rows'][1]['height']    2
    Reload
    Wait For Level Page
    Input Number Should Be    css=[aria-label="กว้างห้อง (ม.)"]    1.5
    Input Number Should Be    css=[aria-label="ยาวห้อง (ม.)"]    2
    Input Number Should Be    css=[aria-label="ความสูงที่กรุกระเบื้อง (ม.)"]    2
    Input Number Should Be    css=[aria-label="หักช่องเปิด (ตร.ม.)"]    1.4
    Totals Should Match Engine    toilet-tile

Toilet Tile Sample House Equals The Engine And Confirms
    [Documentation]    Toilet Tile Sample House Equals The Engine And Confirms.
    Open Fresh Context
    Start Guest Project    sample    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${expected}=    Totals Should Match Engine    toilet-tile
    ${lvl}=    Expected Level    ${expected}    toilet-tile
    Should Be True    ${lvl}[total] > 0
    Get Element Count    css=[aria-label^="ชื่อห้องน้ำที่"]    ==    2
    Confirm Level    wall-finishing

# ───────────── 35 wall-finishing (optional) ─────────────

Wall Finishing Blank Shows Zero And Confirm Passes
    [Documentation]    An optional level with no requirement: blank = 0 and "confirm" passes with nothing typed.
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Level Total Should Be    0
    Totals Should Match Engine    wall-finishing
    Confirm Level    paint
    Level Mark Should Be    wall-finishing    done

Wall Finishing Empty State Offers Both Items And The Skip Way Out
    [Documentation]    Wall Finishing Empty State Offers Both Items And The Skip Way Out.
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Get Text    css=body    contains    ยังไม่มีงานตกแต่งผนัง
    Get Element Count    ${ADD_MOULDING}    ==    1
    Get Element Count    ${ADD_SLAT}    ==    1
    Get Element Count    ${SKIP_BUTTON}    ==    1

Wall Finishing Can Be Skipped And The Level Is Worth Zero
    [Documentation]    "ไม่มีในโครงการนี้" + ยืนยัน: stored as skipped, opens paint, the level shows 0 baht and the
    ...    construction total equals the engine.
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Skip Level
    Wait For Condition    Url    should end with    /journey/paint    timeout=30s
    Level Mark Should Be    wall-finishing    skipped
    Go To Level    wall-finishing
    Level Total Should Be    0
    Get Text    css=body    contains    ไม่นำมาคิดมูลค่า
    ${expected}=    Expected For Current Guest Project
    Construction Total Should Be    ${expected}[constructionTotal]
    Get Element Count    ${SKIP_BUTTON}    ==    0

Wall Finishing Skip Drops The Construction Total And Undo Restores It
    [Documentation]    Sample house: the level is worth money; skipping removes exactly that from the construction
    ...    total, "มีงานส่วนนี้ กลับไปกรอกข้อมูล" brings it back.
    Open Fresh Context
    ${before}=    Start Guest Project    sample    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    ${lvl}=    Expected Level    ${before}    wall-finishing
    Should Be True    ${lvl}[total] > 0
    Totals Should Match Engine    wall-finishing
    Skip Level
    Wait For Condition    Url    should end with    /journey/paint    timeout=30s
    Go To Level    wall-finishing
    Level Total Should Be    0
    ${after}=    Expected For Current Guest Project
    ${drop}=    Evaluate    $before['constructionTotal'] - $after['constructionTotal']
    Numbers Should Be Close    ${drop}    ${lvl}[total]    1
    Construction Total Should Be    ${after}[constructionTotal]
    Unskip Level
    Level Mark Should Be    wall-finishing    ${NONE}
    Level Total Should Be    ${lvl}[total]
    Construction Total Should Be    ${before}[constructionTotal]
    Totals Should Match Engine    wall-finishing

Wall Finishing Filled From Plan Confirms And Opens Paint
    [Documentation]    Moulding 8+10+8+10 = 36 m and a slat wall 3.0 x 2.4 = 7.2 m2.
    [Tags]    smoke
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Fill Wall Finishing From Plan
    ${expected}=    Totals Should Match Engine    wall-finishing
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][moulding.0.3]    36    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][slatWallArea]    7.2    0.001
    ${lvl}=    Expected Level    ${expected}    wall-finishing
    Should Be True    ${lvl}[total] > 0
    Confirm Level    paint
    Level Mark Should Be    wall-finishing    done

Wall Finishing Half Filled Slat Wall Is Blocked Then Passes
    [Documentation]    Wall Finishing Half Filled Slat Wall Is Blocked Then Passes.
    [Tags]    negative
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Click    ${ADD_SLAT}
    Fill Number By Label    กว้าง (ม.)    3.0
    Confirm Level Should Be Blocked    wall-finishing    1
    Get Text    ${MISSING_ALERT}    contains    สูง
    Fill Number By Label    สูง (ม.)    2.4
    Totals Should Match Engine    wall-finishing
    Confirm Level    paint

Wall Finishing Every Moulding Size Reaches The Engine
    [Documentation]    Big moulding (0.30 x 0.10) feeds R218, small (0.10 x 0.10) feeds R219.
    [Tags]    edge
    [Template]    Moulding Size Case
    ${MOULDING_BIG}      0.3    R218    R219
    ${MOULDING_SMALL}    0.1    R219    R218

Wall Finishing Moulding Length Accepts A Sum
    [Documentation]    "6+4.5+2.5" = 13 m.
    [Tags]    edge
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Add Moulding    ผนังภายนอก    ${MOULDING_BIG}    6+4.5+2.5
    Stored Number Should Be    wall-finishing    ['rows'][0]['length']    13
    ${expected}=    Totals Should Match Engine    wall-finishing
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][moulding.0.3]    13    0.001

Wall Finishing Slat Width Accepts Odd Input And Stays Finite
    [Documentation]    Wall Finishing Slat Width Accepts Odd Input And Stays Finite.
    [Tags]    edge    negative
    [Template]    Slat Width Case
    0                 0
    1,250.5           1250.5      มากกว่าปกติ
    =2.5*4            10
    9.5+7+2           18.5
    -3                -3          ค่าติดลบ
    abc               keep
    ${EMPTY}          0
    99999999          99999999    มากกว่าปกติ

Wall Finishing Items Can Be Duplicated And Deleted
    [Documentation]    Wall Finishing Items Can Be Duplicated And Deleted.
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Add Moulding    ผนังภายนอก    ${MOULDING_BIG}    13
    Add Slat Wall    ผนังเฉลียง 1    1.65    2
    Duplicate Card    1
    Card Count Should Be    3
    ${expected}=    Totals Should Match Engine    wall-finishing
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][slatWallArea]    6.6    0.001
    Delete Card    2
    Delete Card    1
    ${expected}=    Totals Should Match Engine    wall-finishing
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][slatWallArea]    0    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][moulding.0.3]    13    0.001
    Delete Card    0
    Get Text    css=body    contains    ยังไม่มีงานตกแต่งผนัง
    Level Total Should Be    0

Wall Finishing Sixteen Items Add Up
    [Documentation]    Wall Finishing Sixteen Items Add Up.
    [Tags]    slow
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    FOR    ${i}    IN RANGE    8
        Add Moulding    ผนัง ${i}    ${MOULDING_BIG}    5
        Add Slat Wall    ระแนง ${i}    2    3
    END
    Card Count Should Be    16
    ${expected}=    Totals Should Match Engine    wall-finishing
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][moulding.0.3]    40    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][slatWallArea]    48    0.001
    Reload
    Wait For Level Page
    Card Count Should Be    16
    Totals Should Match Engine    wall-finishing

Wall Finishing Values Survive A Reload
    [Documentation]    Wall Finishing Values Survive A Reload.
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Fill Wall Finishing From Plan
    Stored Number Should Be    wall-finishing    ['rows'][1]['width']    3
    Reload
    Wait For Level Page
    Get Property    css=[aria-label="ตำแหน่งบัวที่ 1"]    value    ==    ผนังภายนอก
    Input Number Should Be    css=[aria-label="ความยาวรวม (ม.)"]    36
    Input Number Should Be    css=[aria-label="กว้าง (ม.)"]    3
    Input Number Should Be    css=[aria-label="สูง (ม.)"]    2.4
    Totals Should Match Engine    wall-finishing

Wall Finishing Done Level Has No Skip Button
    [Documentation]    Once confirmed the level is decided: no "ไม่มีในโครงการนี้", and the main button just moves on.
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Fill Wall Finishing From Plan
    Confirm Level    paint
    Go To Level    wall-finishing
    Get Element Count    ${SKIP_BUTTON}    ==    0
    Get Text    css=button:has-text("ไปขั้นตอนทาสี")    contains    ไปขั้นตอนทาสี

Wall Finishing Sample House Equals The Engine And Confirms
    [Documentation]    Wall Finishing Sample House Equals The Engine And Confirms.
    Open Fresh Context
    Start Guest Project    sample    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    ${expected}=    Totals Should Match Engine    wall-finishing
    ${lvl}=    Expected Level    ${expected}    wall-finishing
    Should Be True    ${lvl}[total] > 0
    Card Count Should Be    4
    Confirm Level    paint

# ───────────── 36 paint ─────────────

Paint Blank Shows Zero And Confirm Passes
    [Documentation]    Paint has no required value: blank = 0 and it confirms.
    Open Fresh Context
    Start Guest Project    blank    /journey/paint    unlock_until=paint
    Wait For Level Page
    Level Total Should Be    0
    Totals Should Match Engine    paint
    Confirm Level    misc
    Level Mark Should Be    paint    done

Paint Blank Lists Every Source Area As Empty
    [Documentation]    With nothing on the earlier levels the five pulled areas read "ไม่มี" and the engine agrees.
    Open Fresh Context
    ${expected}=    Start Guest Project    blank    /journey/paint    unlock_until=paint
    Wait For Level Page
    Paint Source Areas Should Match Engine    ${expected}

Paint Source Areas Equal The Engine On The Sample House
    [Documentation]    Plaster, ceiling and finishing areas shown on the paint level are the engine's paint inputs.
    Open Fresh Context
    ${expected}=    Start Guest Project    sample    /journey/paint    unlock_until=paint
    Wait For Level Page
    Paint Source Areas Should Match Engine    ${expected}
    ${expected}=    Totals Should Match Engine    paint
    ${lvl}=    Expected Level    ${expected}    paint
    Should Be True    ${lvl}[total] > 0

Paint Follows The Ceiling Level
    [Documentation]    Change the ceiling data (seed another project): the paint areas and the paint total follow the
    ...    engine. Interior ceiling 20 m2 first, then 20 + 6 x 5 = 50 m2.
    Open Fresh Context
    ${a}=    Ceiling Data    C1:4:5:ห้องรับแขก:ภายใน
    ${one}=    Start Project With Data    ${a}    /journey/paint    paint
    Wait For Level Page
    Paint Source Areas Should Match Engine    ${one}
    Numbers Should Be Close    ${one}[calcOutputs][paint][ceilingInterior]    20    0.001
    Totals Should Match Engine    paint
    ${b}=    Ceiling Data    C1:4:5:ห้องรับแขก:ภายใน    C1:6:5:ห้องนอน:ภายใน
    ${two}=    Start Project With Data    ${b}    /journey/paint    paint
    Wait For Level Page
    Paint Source Areas Should Match Engine    ${two}
    Numbers Should Be Close    ${two}[calcOutputs][paint][ceilingInterior]    50    0.001
    Totals Should Match Engine    paint
    Should Be True    ${two}[constructionTotal] > ${one}[constructionTotal]

Paint Follows The Plaster Level
    [Documentation]    Sample walls: the plaster rows decide the wall paint. Changing them (2 faces on the outside wall
    ...    only) changes the paint areas, always equal to the engine.
    Open Fresh Context
    ${one}=    Start Guest Project    sample    /journey/paint    unlock_until=paint
    Wait For Level Page
    Paint Source Areas Should Match Engine    ${one}
    ${plaster}=    Evaluate    {'rows': [{'wallPart': 'ผนังรอบบ้าน', 'kind': 'ฉาบภายนอก', 'sides': 1}]}
    ${two}=    Start Project With Data    ${{ {'plaster': $plaster} }}    /journey/paint    paint    sample
    Wait For Level Page
    Paint Source Areas Should Match Engine    ${two}
    Totals Should Match Engine    paint
    Should Be True    ${two}[calcOutputs][paint][wallInterior] == 0
    Should Be True    ${one}[calcOutputs][paint][wallInterior] > 0

Paint Every Ceiling Paint Option Lands On Its Line
    [Documentation]    A 4 x 5 ceiling with each paint choice: the matching paint line shows 20 m2, the others "ไม่มี".
    [Tags]    edge
    [Template]    Paint Option Case
    ภายใน         ทาสีฝ้า - ภายใน
    ภายนอก        ทาสีฝ้า - ภายนอก
    ไม้ระแนง      ทาสีฝ้า - ไม้ระแนง
    ${EMPTY}      ${EMPTY}

Paint Offers The Wall Finishing Areas And Takes Them
    [Documentation]    Finishing has a 3 x 2.4 slat wall and 36 m of moulding: paint offers 7.20 m2, "ใช้ค่านี้" fills
    ...    it, "เลิกทำ" returns to empty, and the stored value follows.
    Open Fresh Context
    ${rows}=    Wall Finishing Data
    Start Project With Data    ${rows}    /journey/paint    paint
    Wait For Level Page
    Get Text    css=body    contains    ขั้นตอนตกแต่งผนังมีค่าให้ใช้
    Get Text    css=body    contains    7.20 ตร.ม.
    Click    css=button:has-text("ใช้ค่านี้") >> nth=0
    Stored Number Should Be    paint    ['slatWallArea']    7.2
    Get Text    css=body    contains    ใช้ค่าจากขั้นตอนตกแต่งผนังแล้ว
    ${expected}=    Totals Should Match Engine    paint
    Numbers Should Be Close    ${expected}[calcOutputs][paint][wallSlat]    7.2    0.001
    Click    css=button:has-text("เลิกทำ")
    Stored Number Should Be    paint    ['slatWallArea']    0
    ${expected}=    Totals Should Match Engine    paint
    Numbers Should Be Close    ${expected}[calcOutputs][paint][wallSlat]    0    0.001

Paint Bulk Apply Takes Every Offered Value And Undo Gives Them Back
    [Documentation]    Slat wall, 0.3 moulding and the roofing fascia length are offered: one button takes them all.
    Open Fresh Context
    ${rows}=    Wall Finishing Data
    Start Project With Data    ${rows}    /journey/paint    paint
    Wait For Level Page
    Click    css=button:has-text("ใช้ค่าจากขั้นตอนก่อนหน้าทั้งหมด")
    Get Text    css=body    contains    ใช้ค่าจากขั้นตอนก่อนหน้าแล้ว
    Stored Number Should Be    paint    ['slatWallArea']    7.2
    Stored Number Should Be    paint    ['mouldings'][0]['length']    36
    ${expected}=    Totals Should Match Engine    paint
    Numbers Should Be Close    ${expected}[calcOutputs][paint][moulding]    18    0.001
    Click    css=button:has-text("เลิกทำ")
    Stored Number Should Be    paint    ['slatWallArea']    0
    Stored Number Should Be    paint    ['mouldings'][0]['length']    0
    Totals Should Match Engine    paint

Paint Hides Slat And Moulding Fields When Wall Finishing Is Skipped
    [Documentation]    The optional wall-finishing level was skipped: paint says "ไม่มี" instead of asking for
    ...    slat and moulding numbers, and the totals still equal the engine.
    Open Fresh Context
    ${none}=    Create Dictionary
    ${marks}=    Create Dictionary    wall-finishing=skipped
    Start Project With Data    ${none}    /journey/paint    paint    marks=${marks}
    Wait For Level Page
    Get Text    css=body    contains    ทาสีผนังไม้ระแนงและบัวผนัง: ไม่มี
    Get Element Count    css=[aria-label="พื้นที่ผนังไม้ระแนง"]    ==    0
    Get Element Count    css=[aria-label="ความยาวเชิงชาย"]    ==    1
    Totals Should Match Engine    paint

Paint Fascia Length Accepts Odd Input And Stays Finite
    [Documentation]    Fascia area = length x 0.23 m (the standard height). Typed 10 first.
    [Tags]    edge    negative
    [Template]    Fascia Length Case
    0                 0
    1,250.5           1250.5
    =2.5*4            10
    9.5+7+2           18.5
    -3                -3
    abc               keep
    ${EMPTY}          0
    99999999          99999999

Paint Moulding Length Accepts Odd Input And Stays Finite
    [Documentation]    Paint Moulding Length Accepts Odd Input And Stays Finite.
    [Tags]    edge    negative
    [Template]    Paint Moulding Case
    0                 0
    =2.5*4            10
    9.5+7+2           18.5
    -3                -3
    abc               keep
    ${EMPTY}          0

Paint Filled From Plan Confirms And Opens Misc
    [Documentation]    Earlier levels seeded with the test house (ceiling, finishing); the paint keyword takes every
    ...    offered area and types the fascia 36 m x 0.23 = 8.28 m2.
    [Tags]    smoke
    Open Fresh Context
    ${ceiling}=    Ceiling Data    C1:4:5:ห้องรับแขก:ภายใน    C3:0.6:36:ชายคา:ภายนอก
    ${wall}=    Wall Finishing Data
    ${data}=    Evaluate    {**$ceiling, **$wall}
    Start Project With Data    ${data}    /journey/paint    paint
    Wait For Level Page
    Fill Paint From Plan
    ${expected}=    Totals Should Match Engine    paint
    Numbers Should Be Close    ${expected}[calcOutputs][paint][fascia]    8.28    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][paint][wallSlat]    7.2    0.001
    ${lvl}=    Expected Level    ${expected}    paint
    Should Be True    ${lvl}[total] > 0
    Confirm Level    misc
    Level Mark Should Be    paint    done

Paint Values Survive A Reload
    [Documentation]    Paint Values Survive A Reload.
    Open Fresh Context
    Start Guest Project    blank    /journey/paint    unlock_until=paint
    Wait For Level Page
    Fill Number By Label    ความยาวเชิงชาย    36
    Stored Number Should Be    paint    ['fasciaLength']    36
    Reload
    Wait For Level Page
    Input Number Should Be    css=[aria-label="ความยาวเชิงชาย"]    36
    Get Text    css=body    contains    8.28 ตร.ม.
    Totals Should Match Engine    paint

Paint Sample House Equals The Engine And Confirms
    [Documentation]    Paint Sample House Equals The Engine And Confirms.
    Open Fresh Context
    Start Guest Project    sample    /journey/paint    unlock_until=paint
    Wait For Level Page
    Totals Should Match Engine    paint
    Confirm Level    misc

# ───────────── 37 misc (last level) ─────────────

Misc Blank Shows Zero And Finishes The Journey
    [Documentation]    The last level: the button says "ยืนยันและเสร็จสิ้น"; with nothing typed it still passes (no
    ...    requirement) and the overview shows the journey complete.
    Open Fresh Context
    Start Guest Project    blank    /journey/misc    unlock_until=misc
    Wait For Level Page
    Level Total Should Be    0
    Totals Should Match Engine    misc
    Confirm Last Level
    Level Mark Should Be    misc    done
    Journey Overview Should Be Complete

Misc Filled From Plan Finishes The Journey
    [Documentation]    Glass railing 7.5 m x 4,000 baht/m material = 30,000 baht (catalogue price of the Excel v5 row).
    [Tags]    smoke
    Open Fresh Context
    Start Guest Project    blank    /journey/misc    unlock_until=misc
    Wait For Level Page
    Fill Misc From Plan
    ${expected}=    Totals Should Match Engine    misc
    Numbers Should Be Close    ${expected}[calcOutputs][misc][total]    30000    0.5
    Confirm Last Level
    Level Mark Should Be    misc    done
    Journey Overview Should Be Complete
    ${final}=    Expected For Current Guest Project
    FOR    ${lvl}    IN    @{final}[levels]
        Should Be Equal    ${lvl}[state]    done    msg=${lvl}[id] is ${lvl}[state]
    END

Misc Last Level Has No Next Level
    [Documentation]    Before confirming: no "ไปขั้นตอน" arrow; after: the button leads back to the overview.
    Open Fresh Context
    Start Guest Project    blank    /journey/misc    unlock_until=misc
    Wait For Level Page
    Get Text    ${CONFIRM_BUTTON}    contains    ยืนยันและเสร็จสิ้น
    Get Element Count    css=button:has-text("ยืนยัน แล้วไปขั้นตอน")    ==    0
    Confirm Last Level
    Go To Level    misc
    Get Text    css=button:has-text("กลับไปภาพรวมขั้นตอน")    contains    กลับไปภาพรวมขั้นตอน
    Click    css=button:has-text("กลับไปภาพรวมขั้นตอน")
    Wait For Condition    Url    should end with    /journey    timeout=30s

Misc Railing Length Accepts Odd Input And Stays Finite
    [Documentation]    Misc Railing Length Accepts Odd Input And Stays Finite.
    [Tags]    edge    negative
    [Template]    Railing Case
    0                 0
    1,250.5           1250.5
    =2.5*4            10
    9.5+7+2           18.5
    -3                -3
    abc               keep
    ${EMPTY}          0
    99999999          99999999

Misc Free Text Work Is Priced By The User
    [Documentation]    "กันสาด" 1 ชุด at 8,500 baht material and 1,500 labour = 10,000 baht; the level equals the engine.
    Open Fresh Context
    Start Guest Project    blank    /journey/misc    unlock_until=misc
    Wait For Level Page
    Add Misc Other Row    0    กันสาด    1    ชุด    8500    1500
    ${expected}=    Totals Should Match Engine    misc
    Numbers Should Be Close    ${expected}[calcOutputs][misc][total]    10000    0.5
    Confirm Last Level

Misc Free Text Without A Price Is Flagged
    [Documentation]    No price typed: an orange note says the row counts as 0 baht; the engine agrees.
    [Tags]    negative
    Open Fresh Context
    Start Guest Project    blank    /journey/misc    unlock_until=misc
    Wait For Level Page
    Add Misc Other Row    0    ป้ายบ้านเลขที่    1    ชุด
    Get Text    css=body    contains    ยังไม่มีราคา
    ${expected}=    Totals Should Match Engine    misc
    Numbers Should Be Close    ${expected}[calcOutputs][misc][total]    0    0.5

Misc Extra Row Can Be Deleted
    [Documentation]    Misc Extra Row Can Be Deleted.
    Open Fresh Context
    Start Guest Project    blank    /journey/misc    unlock_until=misc
    Wait For Level Page
    Add Misc Other Row    0    กันสาด    1    ชุด    8500    1500
    Totals Should Match Engine    misc
    Click    css=button[aria-label="ลบแถว"]
    Level Total Should Be    0
    Get Element Count    css=button[aria-label="ลบแถว"]    ==    0
    Totals Should Match Engine    misc

Misc Sixteen Extra Rows Add Up
    [Documentation]    16 free-text rows of 1 x 1,000 baht material: 16,000 baht, all kept after a reload.
    [Tags]    slow
    Open Fresh Context
    Start Guest Project    blank    /journey/misc    unlock_until=misc
    Wait For Level Page
    FOR    ${i}    IN RANGE    16
        Add Misc Other Row    ${i}    งานอื่น ${i}    1    ชุด    1000
    END
    Get Element Count    css=button[aria-label="ลบแถว"]    ==    16
    ${expected}=    Totals Should Match Engine    misc
    Numbers Should Be Close    ${expected}[calcOutputs][misc][total]    16000    0.5
    Reload
    Wait For Level Page
    Get Element Count    css=button[aria-label="ลบแถว"]    ==    16
    Totals Should Match Engine    misc

Misc Values Survive A Reload
    [Documentation]    Misc Values Survive A Reload.
    Open Fresh Context
    Start Guest Project    blank    /journey/misc    unlock_until=misc
    Wait For Level Page
    Fill Misc From Plan
    Reload
    Wait For Level Page
    Input Number Should Be    css=[aria-label="${RAILING_QTY}"]    7.5
    Totals Should Match Engine    misc

Misc Sample House Finishes At The Sample Total
    [Documentation]    The Excel v5 sample: every level is done, the overview is complete and the construction total is
    ...    the app's sample total 1,855,162 baht (same constant as suite 40).
    Open Fresh Context
    Start Guest Project    sample    /journey/misc    unlock_until=misc
    Wait For Level Page
    Totals Should Match Engine    misc
    Confirm Last Level
    Journey Overview Should Be Complete
    ${final}=    Expected For Current Guest Project
    Numbers Should Be Close    ${final}[constructionTotal]    ${SAMPLE_TOTAL}    1
    Get Text    css=body    contains    1,855,162

Misc Journey Finishes Even When Wall Finishing Was Skipped
    [Documentation]    Misc Journey Finishes Even When Wall Finishing Was Skipped.
    Open Fresh Context
    ${none}=    Create Dictionary
    ${marks}=    Create Dictionary    wall-finishing=skipped
    Start Project With Data    ${none}    /journey/misc    misc    marks=${marks}
    Wait For Level Page
    Confirm Last Level
    Journey Overview Should Be Complete
    Get Text    css=body    contains    37 จาก 37 ขั้นตอน

Misc Overview Button Opens The BOQ
    [Documentation]    Misc Overview Button Opens The BOQ.
    Open Fresh Context
    Start Guest Project    sample    /journey/misc    unlock_until=misc
    Wait For Level Page
    Confirm Last Level
    Journey Overview Should Be Complete
    Click    css=a[href="/boq"] >> text=ดูสรุป BOQ
    Wait For Condition    Url    should end with    /boq    timeout=60s
    Page Should Have No Error Overlay

# ───────────── navigation: previous arrow, locked URL ─────────────

Previous Arrow Goes Back One Level
    [Documentation]    The "ขั้นตอนก่อนหน้า" arrow of every finishing level opens the level before it.
    [Template]    Previous Arrow Case
    ceiling           sanitary-ware    สุขภัณฑ์
    floor-tile        ceiling          ฝ้าเพดาน
    toilet-tile       floor-tile       ปูกระเบื้องพื้น
    wall-finishing    toilet-tile      กระเบื้องห้องน้ำ
    paint             wall-finishing   ตกแต่งผนัง
    misc              paint            ทาสี

Locked Level Url Shows The Waiting Screen
    [Documentation]    Opening a level by URL before the one in front of it is done is safe: no inputs, no confirm,
    ...    a link to the level to do next.
    [Tags]    negative    security
    [Template]    Locked Level Case
    ceiling           sanitary-ware    สุขภัณฑ์
    floor-tile        ceiling          ฝ้าเพดาน
    toilet-tile       floor-tile       ปูกระเบื้องพื้น
    wall-finishing    toilet-tile      กระเบื้องห้องน้ำ
    paint             wall-finishing   ตกแต่งผนัง
    misc              paint            ทาสี

# ───────────── levels 32-37 in one run ─────────────

Finishes Levels Run From A Blank Plan To The End
    [Documentation]    From a blank project with the earlier levels done: fill and confirm ceiling, floor tile, toilet
    ...    tile, wall finishing, paint and misc in order. At each step the totals equal the engine; at the end the
    ...    journey is complete.
    [Tags]    slow    smoke
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Fill Ceiling From Plan
    Totals Should Match Engine    ceiling
    Confirm Level    floor-tile
    Wait For Level Page
    Fill Floor Tile From Plan
    Totals Should Match Engine    floor-tile
    Confirm Level    toilet-tile
    Wait For Level Page
    Fill Toilet Tile From Plan
    Totals Should Match Engine    toilet-tile
    Confirm Level    wall-finishing
    Wait For Level Page
    Fill Wall Finishing From Plan
    Totals Should Match Engine    wall-finishing
    Confirm Level    paint
    Wait For Level Page
    Fill Paint From Plan
    Totals Should Match Engine    paint
    Confirm Level    misc
    Wait For Level Page
    Fill Misc From Plan
    Totals Should Match Engine    misc
    Confirm Last Level
    Journey Overview Should Be Complete
    ${final}=    Expected For Current Guest Project
    FOR    ${lvl}    IN    @{final}[levels]
        Should Be Equal    ${lvl}[state]    done    msg=${lvl}[id] is ${lvl}[state]
    END
    Should Be True    ${final}[constructionTotal] > 0

Finishes Levels Run With Wall Finishing Skipped
    [Documentation]    Same run, the optional wall-finishing level skipped: paint says "ไม่มี" for slats and mouldings
    ...    and the finishing level is worth 0.
    [Tags]    slow
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Fill Ceiling From Plan
    Confirm Level    floor-tile
    Wait For Level Page
    Fill Floor Tile From Plan
    Confirm Level    toilet-tile
    Wait For Level Page
    Fill Toilet Tile From Plan
    Confirm Level    wall-finishing
    Wait For Level Page
    Skip Level
    Wait For Condition    Url    should end with    /journey/paint    timeout=30s
    Wait For Level Page
    Get Text    css=body    contains    ทาสีผนังไม้ระแนงและบัวผนัง: ไม่มี
    Fill Paint From Plan
    Totals Should Match Engine    paint
    Confirm Level    misc
    Wait For Level Page
    Fill Misc From Plan
    Confirm Last Level
    Journey Overview Should Be Complete
    Level Mark Should Be    wall-finishing    skipped


*** Keywords ***
Add Misc Other Row
    [Documentation]    Add a free-text work row (n-th, 0-based) and type name, quantity, unit and optional prices.
    ...    The name and unit boxes have no aria-label, so they are the (2n)-th and (2n+1)-th combobox of the table.
    [Arguments]    ${row}    ${name}    ${qty}    ${unit}    ${mat}=${EMPTY}    ${lab}=${EMPTY}
    Click    css=button:has-text("เพิ่มงานอื่น")
    Wait For Elements State    css=table input[role="combobox"] >> nth=${{ 2 * int($row) }}    visible
    ${name_box}=    Set Variable    css=table input[role="combobox"] >> nth=${{ 2 * int($row) }}
    ${unit_box}=    Set Variable    css=table input[role="combobox"] >> nth=${{ 2 * int($row) + 1 }}
    Click    ${name_box}
    Fill Text    ${name_box}    ${name}
    Fill Number By Label    จำนวน    ${qty}    ${row}
    Click    ${unit_box}
    Fill Text    ${unit_box}    ${unit}
    IF    '${mat}' != '${EMPTY}'    Fill Number By Label    ค่าวัสดุต่อหน่วย    ${mat}    ${row}
    IF    '${lab}' != '${EMPTY}'    Fill Number By Label    ค่าแรงต่อหน่วย    ${lab}    ${row}

Bathroom Width Case
    [Documentation]    Floor width of a bathroom typed as ``${typed}``: stored value (``None`` = not saved, ``keep`` =
    ...    unchanged 1.5), warning text, and the screen equals the engine.
    [Arguments]    ${typed}    ${stored}    ${note}=${EMPTY}
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${bath}=    Add Bathroom
    Fill Bathroom    ${bath}    1.5    2.0    2.0
    Fill Number By Label    กว้างห้อง (ม.)    ${typed}
    IF    '${stored}' == 'None'
        Stored Value Should Be Missing    toilet-tile    ['rows'][0]    width
    ELSE
        ${want}=    Set Variable If    '${stored}' == 'keep'    1.5    ${stored}
        Stored Number Should Be    toilet-tile    ['rows'][0]['width']    ${want}
    END
    Edge Result Should Be Sane    toilet-tile    ${note}
    [Teardown]    Close Context

Ceiling Paint Case
    [Documentation]    Ceiling Paint Case.
    [Arguments]    ${button}    ${group}    ${note}
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Add Ceiling Room    ห้องทดสอบ    C1    4    5
    Choose Card Option    0    ทาสีฝ้า    ${button}
    Stored Value Should Be    ceiling    ['rows'][0]['paint']    ${group}
    ${expected}=    Totals Should Match Engine    ceiling
    FOR    ${g}    IN    ภายใน    ภายนอก    ไม้ระแนง
        ${want}=    Set Variable If    '${g}' == '${group}'    20    0
        Numbers Should Be Close    ${expected}[calcOutputs][ceiling][paint.${g}]    ${want}    0.001
    END
    Get Text    css=body    contains    ${note}
    [Teardown]    Close Context

Ceiling Slope Case
    [Documentation]    Ceiling Slope Case.
    [Arguments]    ${typed}    ${stored}
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Add Ceiling Room    ห้องทดสอบ    C2    1    4
    Fill Card Number    0    ลาดเอียง (องศา)    ${typed}
    ${want}=    Set Variable If    '${stored}' == 'keep'    0    ${stored}
    IF    '${typed}' == 'abc'
        Page Should Show No Broken Number
    ELSE
        Stored Number Should Be    ceiling    ['rows'][0]['slope']    ${want}
    END
    Edge Result Should Be Sane    ceiling
    [Teardown]    Close Context

Ceiling Type Case
    [Documentation]    Ceiling Type Case.
    [Arguments]    ${code}    ${width}    ${length}    ${area}    ${label}    ${paint_group}
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Add Ceiling Room    ห้องทดสอบ    ${code}    ${width}    ${length}
    Stored Value Should Be    ceiling    ['rows'][0]['code']    ${code}
    Stored Value Should Be    ceiling    ['rows'][0]['paint']    ${paint_group}
    ${expected}=    Totals Should Match Engine    ceiling
    Numbers Should Be Close    ${expected}[calcOutputs][ceiling][${code}]    ${area}    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][ceiling][total]    ${area}    0.001
    Get Text    css=body    contains    ${label}
    Confirm Level    floor-tile
    [Teardown]    Close Context

Ceiling Width Case
    [Documentation]    Width of a ceiling room typed as ``${typed}`` (room started as 4 x 5): stored value (``keep`` =
    ...    unchanged 4), warning text, and the screen equals the engine.
    [Arguments]    ${typed}    ${stored}    ${note}=${EMPTY}
    Open Fresh Context
    Start Guest Project    blank    /journey/ceiling    unlock_until=ceiling
    Wait For Level Page
    Add Ceiling Room    ห้องทดสอบ    C1    4    5
    Fill Card Number    0    กว้าง (ม.)    ${typed}
    ${want}=    Set Variable If    '${stored}' == 'keep'    4    ${stored}
    Stored Number Should Be    ceiling    ['rows'][0]['width']    ${want}
    Edge Result Should Be Sane    ceiling    ${note}
    [Teardown]    Close Context

Check Railing Quantity
    [Documentation]    Check Railing Quantity.
    [Arguments]    ${expected}
    ${input}=    Stored Input    misc
    ${qty}=    Evaluate    $input['items'][0]['qty']
    Should Be Equal As Numbers    ${qty}    ${expected}    precision=6

Edge Result Should Be Sane
    [Documentation]    The level total on screen equals the engine, is a finite number, no crash overlay, and the
    ...    plausibility note (when given) is shown.
    [Arguments]    ${level_id}    ${note}=${EMPTY}
    ${expected}=    Totals Should Match Engine    ${level_id}
    ${lvl}=    Expected Level    ${expected}    ${level_id}
    ${finite}=    Evaluate    __import__('math').isfinite($lvl['total'])
    Should Be True    ${finite}    msg=engine total of ${level_id} is not finite
    Page Should Show No Broken Number
    IF    '${note}' != '${EMPTY}'    Get Text    css=body    contains    ${note}

Fascia Length Case
    [Documentation]    Fascia Length Case.
    [Arguments]    ${typed}    ${stored}
    Open Fresh Context
    Start Guest Project    blank    /journey/paint    unlock_until=paint
    Wait For Level Page
    Fill Number By Label    ความยาวเชิงชาย    10
    Fill Number By Label    ความยาวเชิงชาย    ${typed}
    ${want}=    Set Variable If    '${stored}' == 'keep'    10    ${stored}
    Stored Number Should Be    paint    ['fasciaLength']    ${want}
    ${expected}=    Totals Should Match Engine    paint
    ${area}=    Evaluate    float($want) * 0.23
    Numbers Should Be Close    ${expected}[calcOutputs][paint][fascia]    ${area}    0.001
    Edge Result Should Be Sane    paint
    [Teardown]    Close Context

Floor Type Case
    [Documentation]    Floor Type Case.
    [Arguments]    ${code}    ${width}    ${length}    ${area}    ${label}
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    Add Floor Room    ห้องทดสอบ    ${code}    ${width}    ${length}
    Stored Value Should Be    floor-tile    ['rows'][0]['code']    ${code}
    ${expected}=    Totals Should Match Engine    floor-tile
    Numbers Should Be Close    ${expected}[calcOutputs][floor-tile][${code}]    ${area}    0.001
    Get Text    css=body    contains    ${label}
    Confirm Level    toilet-tile
    [Teardown]    Close Context

Floor Width Case
    [Documentation]    Floor Width Case.
    [Arguments]    ${typed}    ${stored}    ${note}=${EMPTY}
    Open Fresh Context
    Start Guest Project    blank    /journey/floor-tile    unlock_until=floor-tile
    Wait For Level Page
    Add Floor Room    ห้องทดสอบ    F1    4    5
    Fill Card Number    0    กว้าง (ม.)    ${typed}
    ${want}=    Set Variable If    '${stored}' == 'keep'    4    ${stored}
    Stored Number Should Be    floor-tile    ['rows'][0]['width']    ${want}
    Edge Result Should Be Sane    floor-tile    ${note}
    [Teardown]    Close Context

Journey Overview Should Be Complete
    [Documentation]    The overview after the last level: "ครบทุกขั้นตอนแล้ว", 37 of 37 steps, a link to the BOQ.
    Wait For Condition    Url    should end with    /journey    timeout=30s
    Get Text    css=body    contains    ครบทุกขั้นตอนแล้ว
    Get Text    css=body    contains    37 จาก 37 ขั้นตอน
    Get Text    css=body    contains    สรุป BOQ ทั้งโครงการพร้อมใช้งาน
    Get Element Count    css=a[href="/boq"]    >=    1
    Page Should Have No Error Overlay

Locked Level Case
    [Documentation]    Locked Level Case.
    [Arguments]    ${level}    ${previous}    ${previous_title}
    Open Fresh Context
    Start Guest Project    blank    /journey    lock_level=${level}
    Go To Path    /journey/${level}
    Locked Screen Should Match Engine    ${level}
    Get Element Count    ${CONFIRM_BUTTON}    ==    0
    Get Element Count    css=input[aria-label]    ==    0
    Page Should Have No Error Overlay
    ${expected}=    Expected For Current Guest Project
    ${lvl}=    Expected Level    ${expected}    ${level}
    ${first}=    Expected Level    ${expected}    ${lvl}[firstStep]
    Click    css=.ant-result button:has-text("ทำต่อ: ${first}[title]")
    Wait For Condition    Url    should end with    /journey/${lvl}[firstStep]    timeout=60s
    Wait For Level Page
    [Teardown]    Close Context

Moulding Size Case
    [Documentation]    Moulding Size Case.
    [Arguments]    ${size}    ${key}    ${line}    ${other_line}
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Add Moulding    ผนังภายนอก    ${size}    10
    ${expected}=    Totals Should Match Engine    wall-finishing
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][moulding.${key}]    10    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][${line}]    10    0.001
    Numbers Should Be Close    ${expected}[calcOutputs][wall-finishing][${other_line}]    0    0.001
    Get Attribute    css=[role="radiogroup"][aria-label="ขนาดบัว"] button:text-is("${size}")    aria-checked    ==    true
    [Teardown]    Close Context

Open Browser With Patience
    [Documentation]    The shared dev server compiles each route on first use and is busy with other suites:
    ...    longer navigation timeout and assertion retries than the library default.
    Open Browser For Suite
    Set Browser Timeout    90s
    Set Retry Assertions For    20s
    Warm Up Routes

Paint Moulding Case
    [Documentation]    Paint Moulding Case.
    [Arguments]    ${typed}    ${stored}
    Open Fresh Context
    Start Guest Project    blank    /journey/paint    unlock_until=paint
    Wait For Level Page
    Fill Number By Label    ความยาวบัว 0.3 ม.    10
    Fill Number By Label    ความยาวบัว 0.3 ม.    ${typed}
    ${want}=    Set Variable If    '${stored}' == 'keep'    10    ${stored}
    Stored Number Should Be    paint    ['mouldings'][0]['length']    ${want}
    ${expected}=    Totals Should Match Engine    paint
    ${area}=    Evaluate    float($want) * 0.5
    Numbers Should Be Close    ${expected}[calcOutputs][paint][moulding]    ${area}    0.001
    Edge Result Should Be Sane    paint
    [Teardown]    Close Context

Paint Option Case
    [Documentation]    Paint Option Case.
    [Arguments]    ${group}    ${line}
    Open Fresh Context
    ${data}=    Ceiling Data    C1:4:5:ห้องทดสอบ:${group}
    ${expected}=    Start Project With Data    ${data}    /journey/paint    paint
    Wait For Level Page
    Paint Source Areas Should Match Engine    ${expected}
    IF    '${line}' != '${EMPTY}'
        ${text}=    Get Text    xpath=//span[normalize-space()="${line}"]/following-sibling::span[1]
        Numbers Should Be Close    ${text}    20    0.01
    END
    Totals Should Match Engine    paint
    [Teardown]    Close Context

Paint Source Areas Should Match Engine
    [Documentation]    The five areas the paint level pulls from earlier levels, as shown, equal the engine's paint inputs
    ...    ("ไม่มี" when the engine says 0).
    [Arguments]    ${expected}
    FOR    ${label}    ${key}    IN
    ...    ทาสีผนัง - ภายนอก    wallExterior
    ...    ทาสีผนัง - ภายใน    wallInterior
    ...    ทาสีฝ้า - ภายนอก    ceilingExterior
    ...    ทาสีฝ้า - ภายใน    ceilingInterior
    ...    ทาสีฝ้า - ไม้ระแนง    ceilingSlat
        ${want}=    Set Variable    ${expected}[calcOutputs][paint][${key}]
        ${area}=    Get Text    xpath=//span[normalize-space()="${label}"]/following-sibling::span[1]
        IF    ${want} == 0
            Should Be Equal    ${area}    ไม่มี
        ELSE
            Numbers Should Be Close    ${area}    ${want}    0.01
        END
    END

Previous Arrow Case
    [Documentation]    Previous Arrow Case.
    [Arguments]    ${level}    ${previous}    ${previous_title}
    Open Fresh Context
    Start Guest Project    blank    /journey/${level}    unlock_until=${level}
    Wait For Level Page
    Click    css=button[aria-label="ขั้นตอนก่อนหน้า: ${previous_title}"]
    Wait For Condition    Url    should end with    /journey/${previous}    timeout=60s
    Wait For Level Page
    [Teardown]    Close Context

Railing Case
    [Documentation]    Railing Case.
    [Arguments]    ${typed}    ${stored}
    Open Fresh Context
    Start Guest Project    blank    /journey/misc    unlock_until=misc
    Wait For Level Page
    Fill Misc From Plan    7.5
    Fill Number By Label    ${RAILING_QTY}    ${typed}
    ${want}=    Set Variable If    '${stored}' == 'keep'    7.5    ${stored}
    Wait Until Keyword Succeeds    15s    250ms    Check Railing Quantity    ${want}
    ${expected}=    Totals Should Match Engine    misc
    ${money}=    Evaluate    max(0.0, float($want)) * 4000
    Numbers Should Be Close    ${expected}[calcOutputs][misc][total]    ${money}    0.5
    Edge Result Should Be Sane    misc
    [Teardown]    Close Context

Slat Width Case
    [Documentation]    Slat Width Case.
    [Arguments]    ${typed}    ${stored}    ${note}=${EMPTY}
    Open Fresh Context
    Start Guest Project    blank    /journey/wall-finishing    unlock_until=wall-finishing
    Wait For Level Page
    Add Slat Wall    ผนังเฉลียง    3    2.4
    Fill Number By Label    กว้าง (ม.)    ${typed}
    ${want}=    Set Variable If    '${stored}' == 'keep'    3    ${stored}
    Stored Number Should Be    wall-finishing    ['rows'][0]['width']    ${want}
    Edge Result Should Be Sane    wall-finishing    ${note}
    [Teardown]    Close Context

Toilet Height Chip Case
    [Documentation]    Toilet Height Chip Case.
    [Arguments]    ${chip}    ${height}
    Open Fresh Context
    Start Guest Project    blank    /journey/toilet-tile    unlock_until=toilet-tile
    Wait For Level Page
    ${bath}=    Add Bathroom
    Fill Number By Label    กว้างห้อง (ม.)    1.5    ${bath}
    Fill Number By Label    ยาวห้อง (ม.)    2.0    ${bath}
    Click    css=[aria-label="ค่าที่ใช้บ่อย"] button:text-is("${chip}")
    Stored Number Should Be    toilet-tile    ['rows'][1]['height']    ${height}
    ${expected}=    Totals Should Match Engine    toilet-tile
    ${wall}=    Evaluate    7 * float($height)
    Numbers Should Be Close    ${expected}[calcOutputs][toilet-tile][wallArea]    ${wall}    0.001
    [Teardown]    Close Context

Warm Up Routes
    [Documentation]    Open every route this suite uses once, so the dev server has compiled them before the tests
    ...    time their page changes.
    New Context    locale=th-TH    viewport={'width': 1440, 'height': 900}
    New Page    ${BASE_URL}/journey
    FOR    ${route}    IN    ceiling    floor-tile    toilet-tile    wall-finishing    paint    misc
        Go To    ${BASE_URL}/journey/${route}
    END
    Go To    ${BASE_URL}/boq
    Close Context
