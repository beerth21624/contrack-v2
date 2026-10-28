*** Settings ***
Documentation       Journey levels 24-31 (TEST_PLAN W3): ท่อร้อยสายไฟ, สายไฟ, ตู้ควบคุมไฟฟ้า, อุปกรณ์ไฟฟ้า,
...                 ท่อน้ำทิ้ง, ท่อน้ำดี, อุปกรณ์ระบบสุขาภิบาล, สุขภัณฑ์.
...                 Per level: blank state, required fields (REQUIRED_FIELDS.md), filled-from-plan totals
...                 against the engine, half-filled rows, edge inputs, pick-list quantities and items outside the
...                 catalogue, add/delete rows, reload, navigation, and the cross-level flow (conduit lengths become
...                 cable lengths, circuits suggest breaker counts, switches and sockets suggest equipment counts).
...                 House values: see ``resources/pages/levels_walls_systems.resource``.
Resource            ../../resources/journey.resource
Resource            ../../resources/pages/levels_walls_systems.resource
Suite Setup         Open Browser For Suite
Test Teardown       Close Test Context
Test Tags           journey    systems    w3a


*** Variables ***
# Journey level id -> the page-object keyword that types the test house's plan into it (levels 24-31).
&{SYSTEM_FILL}
...                 electrical-pipe=Fill Electrical Pipe From Plan
...                 electrical-cable=Fill Electrical Cable From Plan
...                 load-center=Fill Load Center From Plan
...                 electrical-equipment=Fill Electrical Equipment From Plan
...                 waste-pipe=Fill Waste Pipe From Plan
...                 water-pipe=Fill Water Pipe From Plan
...                 sanitary-system=Fill Sanitary System From Plan
...                 sanitary-ware=Fill Sanitary Ware From Plan


*** Test Cases ***
# ═════════════════════════════ 24 electrical-pipe ═════════════════════════════

Blank Electrical Pipe Level Totals Zero And Offers Seven Circuit Kinds
    [Tags]    electrical-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    electrical-pipe
    Get Text    css=body    contains    ยังไม่มีวงจร
    FOR    ${kind}    IN
    ...    ไฟแสงสว่าง
    ...    เต้ารับ
    ...    เต้ารับเหนือเคาน์เตอร์
    ...    เครื่องทำน้ำอุ่น
    ...    เครื่องปรับอากาศ
    ...    ปั๊มน้ำ
    ...    อื่น ๆ
        WS Button Count Should Be    วงจร${kind}    1
    END

Confirming A Blank Electrical Pipe Level Is Blocked
    [Tags]    electrical-pipe    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Confirm Should Be Blocked Naming    electrical-pipe    1    เพิ่มวงจรไฟฟ้าอย่างน้อย 1 วงจร
    Level Mark Should Be    electrical-pipe    ${None}

Electrical Pipe Filled From The Plan Matches The Engine And Confirms
    [Documentation]    6 circuits. Per circuit: main run + device run + vertical rules (1.5 m at the panel, drop per
    ...    point): 58.70 + 60.40 + 44.90 + 13.40 + 13.40 + 15.00 = 205.80 m. Both totals equal the engine;
    ...    confirm opens the cable level.
    [Tags]    electrical-pipe    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    Fill Electrical Pipe From Plan
    WS Level Should Match Engine    electrical-pipe    positive=${TRUE}
    WS Circuit Card Count Should Be    6
    Get Text    css=body    contains    ท่อ 58.70 ม.
    Get Text    css=body    contains    ท่อ 60.40 ม.
    Get Text    css=body    contains    ท่อ 44.90 ม.
    Get Text    css=body    contains    205.80
    WS Confirm Should Pass    electrical-pipe    electrical-cable

Sample House Electrical Pipe Matches The Engine And Confirms
    [Tags]    electrical-pipe    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Level Should Match Engine    electrical-pipe    positive=${TRUE}
    WS Confirm Should Pass    electrical-pipe    electrical-cable

Circuit With Switches But No Conduit Run Is Blocked Naming The Main Run
    [Documentation]    Half-filled circuit: points typed, main run (ท่อสายเมน) missing.
    [Tags]    electrical-pipe    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    จำนวนสวิตช์ (จุด)    3
    WS Confirm Should Be Blocked Naming    electrical-pipe    1    ท่อสายเมน

Circuit With A Lamp Run But No Main Run Is Blocked
    [Tags]    electrical-pipe    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    เต้ารับ
    Fill Number By Label    ท่อแยกเข้าจุด (ม.)    5
    WS Confirm Should Be Blocked Naming    electrical-pipe    1    ท่อสายเมน

Completing A Half Filled Circuit Lets The Level Confirm
    [Tags]    electrical-pipe    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    จำนวนสวิตช์ (จุด)    3
    Confirm Level Should Be Blocked    electrical-pipe    1
    Fill Number By Label    ท่อสายเมน (ม.)    18.5
    WS Level Should Match Engine    electrical-pipe
    WS Confirm Should Pass    electrical-pipe    electrical-cable

Circuit With Only A Name Is Not An Item
    [Documentation]    A new circuit that only got a name has no run: the level still asks for at least one circuit.
    [Tags]    electrical-pipe    negative    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Text By Label    ชื่อวงจร (ตามตารางโหลด)    แสงสว่าง : ห้องนอน
    WS Confirm Should Be Blocked Naming    electrical-pipe    1    เพิ่มวงจรไฟฟ้าอย่างน้อย 1 วงจร

Two Half Filled Circuits Are Both Listed
    [Tags]    electrical-pipe    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    จำนวนสวิตช์ (จุด)    3    0
    WS Add Circuit    เต้ารับ
    Fill Number By Label    จำนวนเต้ารับ (จุด)    2    0
    Confirm Level Should Be Blocked    electrical-pipe    2

Conduit Main Run Edge Inputs Stay Finite And Match The Engine
    [Documentation]    0, thousands, =expression, sum, exponent, negative, text, cleared, 1/0, very large.
    [Tags]    electrical-pipe    edge
    [Setup]    Open Pipe With One Light Circuit
    [Template]    Pipe Edge Number
    ท่อสายเมน (ม.)    0    0
    ท่อสายเมน (ม.)    1,250.5    1250.5
    ท่อสายเมน (ม.)    =2.5*4    10
    ท่อสายเมน (ม.)    9.5+7+2    18.5
    ท่อสายเมน (ม.)    1e3    1000
    ท่อสายเมน (ม.)    -3    -3
    ท่อสายเมน (ม.)    abc    1
    ท่อสายเมน (ม.)    ${EMPTY}    0
    ท่อสายเมน (ม.)    1/0    1
    ท่อสายเมน (ม.)    99999999    99999999

Conduit Lamp Run Edge Inputs Stay Finite And Match The Engine
    [Tags]    electrical-pipe    edge
    [Setup]    Open Pipe With One Light Circuit
    [Template]    Pipe Edge Number
    ท่อแยกเข้าโคม (ม.)    0    0
    ท่อแยกเข้าโคม (ม.)    1,250.5    1250.5
    ท่อแยกเข้าโคม (ม.)    =2.5*4    10
    ท่อแยกเข้าโคม (ม.)    -3    -3
    ท่อแยกเข้าโคม (ม.)    abc    1
    ท่อแยกเข้าโคม (ม.)    ${EMPTY}    0
    ท่อแยกเข้าโคม (ม.)    99999999    99999999

Switch Count Edge Inputs Stay Finite And Match The Engine
    [Documentation]    Wall points show whole numbers (tolerance 0.5); the drop length follows points x 2.3 m.
    [Tags]    electrical-pipe    edge
    [Setup]    Open Pipe With One Light Circuit
    [Template]    Pipe Count Edge Number
    0    0
    7    7
    1,250.5    1250.5
    =2*3    6
    -4    -4
    abc    1
    ${EMPTY}    0
    99999999    99999999

Every Circuit Kind Can Be Added With Its Own Breaker
    [Documentation]    All 7 kinds from the quick-add chips: card count grows, light circuits start with 16 A, all
    ...    others 20 A.
    [Tags]    electrical-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    VAR    ${i}    0
    FOR    ${kind}    ${breaker}    IN
    ...    ไฟแสงสว่าง    16A
    ...    เต้ารับ    20A
    ...    เต้ารับเหนือเคาน์เตอร์    20A
    ...    เครื่องทำน้ำอุ่น    20A
    ...    เครื่องปรับอากาศ    20A
    ...    ปั๊มน้ำ    20A
    ...    อื่น ๆ    20A
        WS Add Circuit    ${kind}
        ${i}=    Evaluate    ${i} + 1
        WS Circuit Card Count Should Be    ${i}
        WS Radio Should Be Selected    ขนาดเบรกเกอร์    ${breaker}    ${{ ${i} - 1 }}
    END
    WS Level Should Match Engine    electrical-pipe

Circuit Kind Dropdown Offers Every Kind And Presets The Breaker
    [Documentation]    The "ชนิดวงจร" dropdown: each of its 7 options is chosen once; the breaker follows the kind.
    [Tags]    electrical-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    อื่น ๆ
    FOR    ${kind}    ${breaker}    IN
    ...    ไฟแสงสว่าง    16A
    ...    เต้ารับ    20A
    ...    เต้ารับเหนือเคาน์เตอร์    20A
    ...    เครื่องทำน้ำอุ่น    20A
    ...    เครื่องปรับอากาศ    20A
    ...    ปั๊มน้ำ    20A
    ...    อื่น ๆ    20A
        Choose Ant Select Option    ชนิดวงจร    ${kind}
        WS Radio Should Be Selected    ขนาดเบรกเกอร์    ${breaker}
    END
    WS Level Should Match Engine    electrical-pipe

Every Breaker Size Can Be Picked
    [Tags]    electrical-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    เต้ารับ
    Fill Number By Label    ท่อสายเมน (ม.)    10
    FOR    ${size}    IN    16A    20A    32A    40A
        WS Choose Radio    ขนาดเบรกเกอร์    ${size}
        WS Radio Should Be Selected    ขนาดเบรกเกอร์    ${size}
    END
    WS Level Should Match Engine    electrical-pipe

Single Appliance Circuits Have No Points Box
    [Documentation]    Air-conditioner, heater and pump circuits have no switch/socket count and no lamp run; lights
    ...    and sockets do.
    [Tags]    electrical-pipe    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    เครื่องปรับอากาศ
    Get Element Count    css=[aria-label="จำนวนเต้ารับ (จุด)"], [aria-label="จำนวนสวิตช์ (จุด)"]    ==    0
    Get Element Count    css=[aria-label="ท่อแยกเข้าโคม (ม.)"], [aria-label="ท่อแยกเข้าจุด (ม.)"]    ==    0
    WS Add Circuit    ไฟแสงสว่าง
    Get Element Count    css=[aria-label="จำนวนสวิตช์ (จุด)"]    ==    1

Circuits Can Be Added Duplicated And Deleted Down To The Empty State
    [Tags]    electrical-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    ท่อสายเมน (ม.)    20    0
    WS Add Circuit    เครื่องปรับอากาศ
    Fill Number By Label    ท่อสายเมน (ม.)    8    1
    WS Circuit Card Count Should Be    2
    Click    css=button[title="ทำซ้ำรายการนี้"] >> nth=0
    WS Circuit Card Count Should Be    3
    WS Box Should Show    css=[aria-label="ท่อสายเมน (ม.)"] >> nth=1    20
    WS Level Should Match Engine    electrical-pipe
    WS Delete Card Confirm    1
    WS Circuit Card Count Should Be    2
    WS Delete Card Confirm    1
    WS Circuit Card Count Should Be    1
    WS Delete Card Confirm    0
    WS Circuit Card Count Should Be    0
    Get Text    css=body    contains    ยังไม่มีวงจร
    WS Level Should Match Engine    electrical-pipe

Sixteen Circuits Add Up To The Engine Total
    [Documentation]    One light circuit of 58.70 m duplicated 15 times: 16 cards, 939.20 m.
    [Tags]    electrical-pipe    slow    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    ท่อสายเมน (ม.)    22.4
    Fill Number By Label    ท่อแยกเข้าโคม (ม.)    25.6
    Fill Number By Label    จำนวนสวิตช์ (จุด)    4
    FOR    ${_}    IN RANGE    15
        Click    css=button[title="ทำซ้ำรายการนี้"] >> nth=0
    END
    WS Circuit Card Count Should Be    16
    WS Level Should Match Engine    electrical-pipe
    Get Text    css=body    contains    939.20
    WS Confirm Should Pass    electrical-pipe    electrical-cable

Electrical Pipe Values Survive A Reload
    [Tags]    electrical-pipe    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    Fill Electrical Pipe From Plan
    WS Level Should Match Engine    electrical-pipe
    WS Reload And Wait
    WS Circuit Card Count Should Be    6
    WS Box Should Show    css=[aria-label="ท่อสายเมน (ม.)"] >> nth=0    22.4
    WS Box Should Show    css=[aria-label="ท่อสายเมน (ม.)"] >> nth=5    12
    WS Box Should Show    css=[aria-label="จำนวนสวิตช์ (จุด)"] >> nth=1    3    0.5
    WS Level Should Match Engine    electrical-pipe

Previous Arrow Of Electrical Pipe Leads To Plaster
    [Tags]    electrical-pipe    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    ฉาบปูน    plaster

Locked Electrical Pipe Level Shows The Waiting Screen
    [Tags]    electrical-pipe    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    lock_level=electrical-pipe
    WS Go To Locked Level    electrical-pipe    ท่อร้อยสายไฟ

# ═════════════════════════════ 25 electrical-cable ═════════════════════════════

Blank Electrical Cable Level Has No Circuits And Points Back To The Conduit Level
    [Tags]    electrical-cable
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-cable    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    electrical-cable
    Get Text    css=body    contains    ยังไม่มีวงจร
    WS Cable Card Count Should Be    0
    Click    css=button >> text="ไปที่ขั้นตอนท่อร้อยสายไฟ"
    Wait For Condition    Url    should end with    /journey/electrical-pipe    timeout=180s

Blank Electrical Cable Level Confirms Because There Is No Conduit To Wire
    [Documentation]    REQUIRED_FIELDS: only circuits with conduit need a cable size; with none, nothing is required.
    [Tags]    electrical-cable
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-cable    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Confirm Should Pass    electrical-cable    load-center

Cable Length Comes From The Conduit Lengths Of The Circuits
    [Documentation]    Cross-level: main = main run + vertical at the panel (22.4 + 1.5 = 23.90), lamp run = lamp run
    ...    + drops (25.6 + 4 x 2.3 = 34.80). Wire per size = length x wires: 1.5 sqmm 138.40, 2.5 sqmm
    ...    168.50, 4 sqmm 191.40 m.
    [Tags]    electrical-cable    electrical-pipe    cross-level    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    Fill Electrical Pipe From Plan
    WS Level Should Match Engine    electrical-pipe
    WS Go To Level    electrical-cable
    WS Cable Card Count Should Be    6
    Get Text    css=body    contains    ระยะสายเมน 23.90 ม.
    Get Text    css=body    contains    เข้าโคม/จุด 34.80 ม.
    Get Text    css=body    contains    ระยะสายเมน 28.90 ม.
    Get Text    css=body    contains    138.40
    Get Text    css=body    contains    168.50
    Get Text    css=body    contains    191.40
    WS Level Should Match Engine    electrical-cable

New Circuits Arrive With Suggested Wire And The Level Confirms
    [Documentation]    Cross-level: circuits added in the conduit level get the kind's usual wire, so nothing is
    ...    missing.
    [Tags]    electrical-cable    electrical-pipe    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    Fill Electrical Pipe From Plan
    WS Go To Level    electrical-cable
    WS Level Should Match Engine    electrical-cable    positive=${TRUE}
    WS Confirm Should Pass    electrical-cable    load-center

Electrical Cable Filled From The Plan Matches The Engine And Confirms
    [Tags]    electrical-cable    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    Fill Electrical Pipe From Plan
    WS Go To Level    electrical-cable
    Fill Electrical Cable From Plan
    WS Level Should Match Engine    electrical-cable    positive=${TRUE}
    WS Confirm Should Pass    electrical-cable    load-center

Sample House Electrical Cable Matches The Engine And Confirms
    [Tags]    electrical-cable    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/electrical-cable    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Level Should Match Engine    electrical-cable    positive=${TRUE}
    WS Confirm Should Pass    electrical-cable    load-center

Changing A Conduit Run Changes The Cable Length Like The Engine
    [Documentation]    Cross-level: lengthen the first light circuit main run 22.4 -> 30: its cable main becomes 31.50
    ...    m.
    [Tags]    electrical-cable    electrical-pipe    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    Fill Electrical Pipe From Plan
    WS Go To Level    electrical-cable
    ${first}=    WS Level Should Match Engine    electrical-cable
    ${before}=    WS Total Of    ${first}    electrical-cable
    WS Go To Level    electrical-pipe
    Fill Number By Label    ท่อสายเมน (ม.)    30    0
    WS Go To Level    electrical-cable
    Get Text    css=body    contains    ระยะสายเมน 31.50 ม.
    ${after}=    WS Level Should Match Engine    electrical-cable
    ${lvl}=    Expected Level    ${after}    electrical-cable
    Should Not Be Equal As Numbers    ${before}    ${lvl}[total]

Deleting A Circuit In The Conduit Level Removes Its Cable Card
    [Tags]    electrical-cable    electrical-pipe    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    Fill Electrical Pipe From Plan
    WS Go To Level    electrical-pipe
    WS Delete Card Confirm    5
    WS Delete Card Confirm    4
    WS Go To Level    electrical-cable
    WS Cable Card Count Should Be    4
    WS Level Should Match Engine    electrical-cable

Duplicated Circuit Keeps Its Wire Choice In The Cable Level
    [Documentation]    Cross-level: a copy of a wired circuit is wired the same way, so the level still confirms.
    [Tags]    electrical-cable    electrical-pipe    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    ท่อสายเมน (ม.)    20
    Fill Number By Label    ท่อแยกเข้าโคม (ม.)    10
    Click    css=button[title="ทำซ้ำรายการนี้"] >> nth=0
    WS Go To Level    electrical-cable
    WS Cable Card Count Should Be    2
    WS Radio Should Be Selected    ขนาดสายเมนวงจร    2.5    1
    WS Radio Should Be Selected    จำนวนสาย    2 เส้น    1
    WS Level Should Match Engine    electrical-cable
    WS Confirm Should Pass    electrical-cable    load-center

Circuit With Conduit But No Cable Size Is Blocked Listing The Fields
    [Documentation]    Half-filled circuit: conduit exists (main + lamp run) but no wire is chosen: 3 values are
    ...    missing (main size, lamp size, number of wires). The suggest button appears.
    [Tags]    electrical-cable    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    ท่อสายเมน (ม.)    20
    Fill Number By Label    ท่อแยกเข้าโคม (ม.)    10
    WS Clear Cable Wiring
    WS Go To Level    electrical-cable
    Get Text    css=body    contains    มี 1 วงจรที่ยังไม่ได้เลือกขนาดสาย
    WS Confirm Should Be Blocked Naming    electrical-cable    3    สายเมนวงจร
    Get Text    css=[role="alert"]:has-text("ยังต้องกรอก")    contains    จำนวนสาย

Choosing The Suggested Wire Completes The Level
    [Tags]    electrical-cable    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Add Circuit    เต้ารับ
    Fill Number By Label    ท่อสายเมน (ม.)    20
    Fill Number By Label    จำนวนเต้ารับ (จุด)    4
    WS Clear Cable Wiring
    WS Go To Level    electrical-cable
    Confirm Level Should Be Blocked    electrical-cable
    WS Click Button    เลือกขนาดสายที่แนะนำให้
    Get Element Count    css=button >> text="เลือกขนาดสายที่แนะนำให้"    ==    0
    WS Level Should Match Engine    electrical-cable
    WS Confirm Should Pass    electrical-cable    load-center

Missing Only The Number Of Wires Is Blocked Naming It
    [Tags]    electrical-cable    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    ท่อสายเมน (ม.)    20
    Fill Number By Label    ท่อแยกเข้าโคม (ม.)    10
    WS Clear Cable Wiring
    WS Go To Level    electrical-cable
    WS Choose Radio    ขนาดสายเมนวงจร    2.5
    WS Choose Radio    ขนาดสายเข้าโคม / จุด    1.5
    WS Confirm Should Be Blocked Naming    electrical-cable    1    จำนวนสาย
    WS Choose Radio    จำนวนสาย    2 เส้น
    WS Level Should Match Engine    electrical-cable
    WS Confirm Should Pass    electrical-cable    load-center

Choosing No Lamp Wire For A Lamp Run Leaves Metres Unpriced
    [Documentation]    The "ไม่มี" lamp wire on a circuit that has a lamp run leaves those metres unassigned: blocked.
    [Tags]    electrical-cable    negative    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    ท่อสายเมน (ม.)    20
    Fill Number By Label    ท่อแยกเข้าโคม (ม.)    10
    WS Go To Level    electrical-cable
    WS Choose Radio    ขนาดสายเข้าโคม / จุด    ไม่มี
    WS Confirm Should Be Blocked Naming    electrical-cable    1    สายเข้าโคม / จุด
    WS Level Should Match Engine    electrical-cable

Every Wire Size And Wire Count Can Be Picked
    [Documentation]    Main sizes 1.5 / 2.5 / 4 / 6, lamp sizes the same plus none, wires 2 / 3. Size 6 warns that it
    ...    has no price.
    [Tags]    electrical-cable
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    ท่อสายเมน (ม.)    20
    Fill Number By Label    ท่อแยกเข้าโคม (ม.)    10
    WS Go To Level    electrical-cable
    FOR    ${size}    IN    1.5    2.5    4    6
        WS Choose Radio    ขนาดสายเมนวงจร    ${size}
        WS Radio Should Be Selected    ขนาดสายเมนวงจร    ${size}
    END
    WS Level Should Match Engine    electrical-cable
    Get Text    css=body    contains    ยังไม่มีรายการราคา
    FOR    ${size}    IN    1.5    2.5    4    6    ไม่มี
        WS Choose Radio    ขนาดสายเข้าโคม / จุด    ${size}
        WS Radio Should Be Selected    ขนาดสายเข้าโคม / จุด    ${size}
    END
    FOR    ${wires}    IN    2 เส้น    3 เส้น (มีสายดิน)
        WS Choose Radio    จำนวนสาย    ${wires}
        WS Radio Should Be Selected    จำนวนสาย    ${wires}
    END
    WS Level Should Match Engine    electrical-cable

Conduit Edge Lengths Keep The Cable Totals Finite
    [Documentation]    Typed oddities in the conduit level (negative, huge, sums) must not turn the cable totals into
    ...    NaN.
    [Tags]    electrical-cable    electrical-pipe    cross-level    edge
    [Setup]    Open Cable With One Light Circuit
    [Template]    Cable After Conduit Edit
    0
    1,250.5
    =2.5*4
    9.5+7+2
    -3
    abc
    ${EMPTY}
    99999999

Sixteen Circuits Are Wired In The Cable Level
    [Documentation]    16 circuits (one wired light circuit duplicated 15 times): 16 cable cards, the level confirms.
    [Tags]    electrical-cable    slow    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    ท่อสายเมน (ม.)    22.4
    Fill Number By Label    ท่อแยกเข้าโคม (ม.)    25.6
    Fill Number By Label    จำนวนสวิตช์ (จุด)    4
    FOR    ${_}    IN RANGE    15
        Click    css=button[title="ทำซ้ำรายการนี้"] >> nth=0
    END
    WS Go To Level    electrical-cable
    WS Cable Card Count Should Be    16
    WS Level Should Match Engine    electrical-cable
    WS Confirm Should Pass    electrical-cable    load-center

Electrical Cable Choices Survive A Reload
    [Tags]    electrical-cable    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    Fill Electrical Pipe From Plan
    WS Go To Level    electrical-cable
    Fill Electrical Cable From Plan
    WS Level Should Match Engine    electrical-cable
    WS Reload And Wait
    WS Cable Card Count Should Be    6
    WS Radio Should Be Selected    ขนาดสายเมนวงจร    2.5    0
    WS Radio Should Be Selected    ขนาดสายเมนวงจร    4    2
    WS Radio Should Be Selected    จำนวนสาย    3 เส้น (มีสายดิน)    5
    WS Level Should Match Engine    electrical-cable

Previous Arrow Of Electrical Cable Leads To Electrical Pipe
    [Tags]    electrical-cable    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-cable    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    ท่อร้อยสายไฟ    electrical-pipe

Locked Electrical Cable Level Shows The Waiting Screen
    [Tags]    electrical-cable    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-cable    lock_level=electrical-cable
    WS Go To Locked Level    electrical-cable    สายไฟ

# ═════════════════════════════ 26 load-center ═════════════════════════════

Blank Load Center Level Totals Zero And Lists Eight Items
    [Tags]    load-center
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    load-center
    WS Pick Line Count Should Be    8

Confirming A Blank Load Center Level Is Blocked
    [Tags]    load-center    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page
    WS Confirm Should Be Blocked Naming    load-center    1    ระบุอุปกรณ์ตู้ควบคุมไฟฟ้าพร้อมจำนวนอย่างน้อย 1 รายการ
    Level Mark Should Be    load-center    ${None}

Load Center Filled From The Plan Matches The Engine And Confirms
    [Documentation]    Business rule (Excel BOQ rows 256-263 prices): 3,000+3,000 + 1,500 + 2x120 + 3x140 + 1,200 +
    ...    15x(200+100) + (500+300) + 5x(70+30) = 15,160 baht.
    [Tags]    load-center    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page
    Fill Load Center From Plan
    WS Level Should Match Engine    load-center
    WS Level Total Should Be    15160
    WS Confirm Should Pass    load-center    electrical-equipment

Sample House Load Center Matches The Engine And Confirms
    [Tags]    load-center    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page
    WS Level Should Match Engine    load-center    positive=${TRUE}
    WS Confirm Should Pass    load-center    electrical-equipment

Every Load Center Item Can Be Counted
    [Documentation]    Each of the 8 dropdown items is given a quantity once (counted units and metres); totals follow
    ...    the engine.
    [Tags]    load-center
    [Setup]    Open Load Center
    [Template]    Pick Item Quantity Matches Engine
    load-center    ${LC_CONSUMER_UNIT}    1
    load-center    ${LC_MAIN_CB}    1
    load-center    ${LC_ELCB}    2
    load-center    ${LC_CB16}    6
    load-center    ${LC_CB20}    3
    load-center    ${LC_GROUND_ROD}    2
    load-center    ${LC_GROUND_CABLE}    5.5
    load-center    ${LC_MAIN_CABLE}    15

Load Center Stepper Adds And Removes One At A Time
    [Documentation]    + twice -> 2, - once -> 1, - again -> 0 and the minus button is then disabled.
    [Tags]    load-center
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page
    WS Minus Button Should Be Disabled    ${LC_CB16}
    WS Step Pick Quantity    เพิ่ม    ${LC_CB16}
    WS Step Pick Quantity    เพิ่ม    ${LC_CB16}
    WS Pick Quantity Should Be    ${LC_CB16}    2
    WS Level Should Match Engine    load-center
    WS Step Pick Quantity    ลด    ${LC_CB16}
    WS Pick Quantity Should Be    ${LC_CB16}    1
    WS Step Pick Quantity    ลด    ${LC_CB16}
    WS Pick Quantity Should Be    ${LC_CB16}    0
    WS Minus Button Should Be Disabled    ${LC_CB16}
    WS Level Should Match Engine    load-center
    WS Level Total Should Be    0
    Confirm Level Should Be Blocked    load-center    1

Load Center Quantity Edge Inputs Stay Finite And Match The Engine
    [Tags]    load-center    edge
    [Setup]    Open Load Center
    [Template]    Pick Edge Quantity
    load-center    ${LC_CB16}    0    0
    load-center    ${LC_CB16}    1,250.5    1250.5
    load-center    ${LC_CB16}    =2*3    6
    load-center    ${LC_CB16}    9.5+7+2    18.5
    load-center    ${LC_CB16}    -4    -4
    load-center    ${LC_CB16}    abc    1
    load-center    ${LC_CB16}    ${EMPTY}    0
    load-center    ${LC_CB16}    1/0    1
    load-center    ${LC_CB16}    99999999    99999999

Load Center Cable Length Edge Inputs Stay Finite And Match The Engine
    [Documentation]    The main cable is counted in metres (two decimals shown), so a typed 1,250.5 shows as typed.
    [Tags]    load-center    edge
    [Setup]    Open Load Center
    [Template]    Pick Edge Length
    load-center    ${LC_MAIN_CABLE}    0    0
    load-center    ${LC_MAIN_CABLE}    1,250.5    1250.5
    load-center    ${LC_MAIN_CABLE}    =2.5*4    10
    load-center    ${LC_MAIN_CABLE}    9.5+7+2    18.5
    load-center    ${LC_MAIN_CABLE}    -4.5    -4.5
    load-center    ${LC_MAIN_CABLE}    abc    1
    load-center    ${LC_MAIN_CABLE}    99999999    99999999

Load Center Suggests Breaker Counts From The Conduit Circuits
    [Documentation]    Cross-level: 2 circuits on 16 A and 4 on 20 A in the conduit level are offered as one-click
    ...    counts.
    [Tags]    load-center    electrical-pipe    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=load-center
    WS Wait For Level Page
    Fill Electrical Pipe From Plan
    WS Go To Level    load-center
    Get Text    css=body    contains    นับวงจรเบรกเกอร์ 16A ได้ 2
    Get Text    css=body    contains    นับวงจรเบรกเกอร์ 20A ได้ 4
    WS Click Button    ใช้ 2 ตัว
    WS Pick Quantity Should Be    ${LC_CB16}    2
    WS Click Button    ใช้ 4 ตัว
    WS Pick Quantity Should Be    ${LC_CB20}    4
    Get Element Count    css=button >> text="ใช้ 2 ตัว"    ==    0
    Get Element Count    css=button >> text="ใช้ 4 ตัว"    ==    0
    WS Level Should Match Engine    load-center

Load Center Offers No Suggestion Before Any Circuit Exists
    [Tags]    load-center    electrical-pipe    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page
    Get Element Count    css=button >> text=/^ใช้ \\d/    ==    0

Load Center Item Outside The Catalogue And Duplicates Stay Safe
    [Documentation]    An old saved project: an item not in the catalogue (3 units, no price) and a breaker listed
    ...    twice. The page shows them under "รายการเพิ่มเติม", prices the duplicates separately (3 x 120
    ...    baht), nothing is NaN, totals equal the engine.
    [Tags]    load-center    edge    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page
    WS Seed Pick Items    load-center
    ...    เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 16 A|2|ตัว
    ...    ของนอกรายการ ทดสอบ|3|ชุด
    ...    เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 16 A|1|ตัว
    Get Text    css=body    contains    รายการเพิ่มเติม
    WS Pick Quantity Should Be    ${LC_CB16}    2
    WS Level Should Match Engine    load-center
    WS Level Total Should Be    360
    WS Confirm Should Pass    load-center    electrical-equipment

Extra Rows Of A Load Center Can Be Edited And Deleted
    [Documentation]    The duplicate row's quantity is editable in the extra table; deleting the row removes its baht.
    [Tags]    load-center    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page
    WS Seed Pick Items    load-center
    ...    เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 16 A|2|ตัว
    ...    เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 16 A|1|ตัว
    WS Level Total Should Be    360
    Fill Number By Label    จำนวน    4    0
    WS Level Should Match Engine    load-center
    WS Level Total Should Be    720
    Click    css=button[aria-label="ลบแถว"] >> nth=0
    WS Level Total Should Be    240
    WS Level Should Match Engine    load-center

Load Center Quantities Survive A Reload
    [Tags]    load-center    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page
    Fill Load Center From Plan
    WS Level Should Match Engine    load-center
    WS Reload And Wait
    WS Pick Quantity Should Be    ${LC_CB20}    3
    WS Pick Quantity Should Be    ${LC_MAIN_CABLE}    15
    WS Level Total Should Be    15160
    WS Level Should Match Engine    load-center

Previous Arrow Of Load Center Leads To Electrical Cable
    [Tags]    load-center    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    สายไฟ    electrical-cable

Locked Load Center Level Shows The Waiting Screen
    [Tags]    load-center    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    lock_level=load-center
    WS Go To Locked Level    load-center    ตู้ควบคุมไฟฟ้า

# ═════════════════════════════ 27 electrical-equipment ═════════════════════════════

Blank Electrical Equipment Level Totals Zero And Lists Six Items
    [Tags]    electrical-equipment
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-equipment    unlock_until=electrical-equipment
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    electrical-equipment
    WS Pick Line Count Should Be    6

Confirming A Blank Electrical Equipment Level Is Blocked
    [Tags]    electrical-equipment    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-equipment    unlock_until=electrical-equipment
    WS Wait For Level Page
    WS Confirm Should Be Blocked Naming    electrical-equipment    1    ระบุอุปกรณ์ไฟฟ้าพร้อมจำนวนอย่างน้อย 1 รายการ
    Level Mark Should Be    electrical-equipment    ${None}

Electrical Equipment Filled From The Plan Matches The Engine And Confirms
    [Documentation]    Business rule (Excel BOQ rows 265-270 prices): 6x270 + 2x500 + 450 + 7x240 + 450 + 7x160 =
    ...    6,320 baht.
    [Tags]    electrical-equipment    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-equipment    unlock_until=electrical-equipment
    WS Wait For Level Page
    Fill Electrical Equipment From Plan
    WS Level Should Match Engine    electrical-equipment
    WS Level Total Should Be    6320
    WS Confirm Should Pass    electrical-equipment    waste-pipe

Sample House Electrical Equipment Matches The Engine And Confirms
    [Tags]    electrical-equipment    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/electrical-equipment    unlock_until=electrical-equipment
    WS Wait For Level Page
    WS Level Should Match Engine    electrical-equipment    positive=${TRUE}
    WS Confirm Should Pass    electrical-equipment    waste-pipe

Every Electrical Equipment Item Can Be Counted
    [Documentation]    Each of the 6 dropdown items is given a quantity once.
    [Tags]    electrical-equipment
    [Setup]    Open Equipment
    [Template]    Pick Item Quantity Matches Engine
    electrical-equipment    ${EQ_CEILING_LAMP}    3
    electrical-equipment    ${EQ_DOWNLIGHT}    12
    electrical-equipment    ${EQ_FLUORESCENT_WP}    1
    electrical-equipment    ${EQ_SOCKET_WP}    2
    electrical-equipment    ${EQ_SOCKET}    9
    electrical-equipment    ${EQ_SWITCH}    8

Electrical Equipment Stepper Adds And Removes One At A Time
    [Tags]    electrical-equipment
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-equipment    unlock_until=electrical-equipment
    WS Wait For Level Page
    WS Minus Button Should Be Disabled    ${EQ_DOWNLIGHT}
    WS Step Pick Quantity    เพิ่ม    ${EQ_DOWNLIGHT}
    WS Step Pick Quantity    เพิ่ม    ${EQ_DOWNLIGHT}
    WS Step Pick Quantity    เพิ่ม    ${EQ_DOWNLIGHT}
    WS Pick Quantity Should Be    ${EQ_DOWNLIGHT}    3
    WS Level Should Match Engine    electrical-equipment
    WS Level Total Should Be    810
    WS Step Pick Quantity    ลด    ${EQ_DOWNLIGHT}
    WS Pick Quantity Should Be    ${EQ_DOWNLIGHT}    2
    WS Level Total Should Be    540
    WS Level Should Match Engine    electrical-equipment

Electrical Equipment Quantity Edge Inputs Stay Finite And Match The Engine
    [Tags]    electrical-equipment    edge
    [Setup]    Open Equipment
    [Template]    Pick Edge Quantity
    electrical-equipment    ${EQ_SWITCH}    0    0
    electrical-equipment    ${EQ_SWITCH}    1,250.5    1250.5
    electrical-equipment    ${EQ_SWITCH}    =2*3    6
    electrical-equipment    ${EQ_SWITCH}    9.5+7+2    18.5
    electrical-equipment    ${EQ_SWITCH}    -4    -4
    electrical-equipment    ${EQ_SWITCH}    abc    1
    electrical-equipment    ${EQ_SWITCH}    ${EMPTY}    0
    electrical-equipment    ${EQ_SWITCH}    99999999    99999999

Equipment Suggests Switch And Socket Counts From The Conduit Circuits
    [Documentation]    Cross-level: 4 + 3 switch points and 5 + 3 socket points (waterproof included) of the circuits.
    [Tags]    electrical-equipment    electrical-pipe    cross-level
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-equipment
    WS Wait For Level Page
    Fill Electrical Pipe From Plan
    WS Go To Level    electrical-equipment
    Get Text    css=body    contains    นับจุดสวิตช์ ได้ 7
    Get Text    css=body    contains    นับจุดเต้ารับ (รวมชนิดกันน้ำ) ได้ 8
    WS Click Button    ใช้ 7 ตัว
    WS Pick Quantity Should Be    ${EQ_SWITCH}    7
    WS Click Button    ใช้ 8 ตัว
    WS Pick Quantity Should Be    ${EQ_SOCKET}    8
    WS Level Should Match Engine    electrical-equipment

Equipment Item Outside The Catalogue And Duplicates Stay Safe
    [Documentation]    Old saved list: a downlight listed twice and an unknown lamp. Duplicates are separate BOQ rows
    ...    (2+1 downlights x 270).
    [Tags]    electrical-equipment    edge    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-equipment    unlock_until=electrical-equipment
    WS Wait For Level Page
    WS Seed Pick Items    electrical-equipment
    ...    โคมไฟดาวน์ไลท์|2|ชุด
    ...    โคมไฟนอกรายการ|4|ชุด
    ...    โคมไฟดาวน์ไลท์|1|ชุด
    Get Text    css=body    contains    รายการเพิ่มเติม
    WS Pick Quantity Should Be    ${EQ_DOWNLIGHT}    2
    WS Level Should Match Engine    electrical-equipment
    WS Level Total Should Be    810
    WS Confirm Should Pass    electrical-equipment    waste-pipe

Electrical Equipment Quantities Survive A Reload
    [Tags]    electrical-equipment    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-equipment    unlock_until=electrical-equipment
    WS Wait For Level Page
    Fill Electrical Equipment From Plan
    WS Reload And Wait
    WS Pick Quantity Should Be    ${EQ_DOWNLIGHT}    6
    WS Pick Quantity Should Be    ${EQ_SWITCH}    7
    WS Level Total Should Be    6320
    WS Level Should Match Engine    electrical-equipment

Previous Arrow Of Electrical Equipment Leads To Load Center
    [Tags]    electrical-equipment    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-equipment    unlock_until=electrical-equipment
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    ตู้ควบคุมไฟฟ้า    load-center

Locked Electrical Equipment Level Shows The Waiting Screen
    [Tags]    electrical-equipment    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-equipment    lock_level=electrical-equipment
    WS Go To Locked Level    electrical-equipment    อุปกรณ์ไฟฟ้า

# ═════════════════════════════ 28 waste-pipe ═════════════════════════════

Blank Waste Pipe Level Totals Zero With Three Fixed Pipe Rows
    [Tags]    waste-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    waste-pipe
    Get Element Count    css=[aria-label="แนวราบ (ม.)"]    ==    3
    Get Element Count    css=[aria-label="แนวดิ่ง (ม.)"]    ==    3

Confirming A Blank Waste Pipe Level Is Blocked
    [Tags]    waste-pipe    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    WS Confirm Should Be Blocked Naming    waste-pipe    1    กรอกความยาวท่อน้ำทิ้งอย่างน้อย 1 แนว
    Level Mark Should Be    waste-pipe    ${None}

Waste Pipe Filled From The Plan Matches The Engine And Confirms
    [Documentation]    Runs: 4" 7.5 + 2 = 9.50 m, 2" 10.5 + 3 = 13.50 m, 1" vent 3.50 m. Totals equal the engine.
    [Tags]    waste-pipe    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    Fill Waste Pipe From Plan
    WS Level Should Match Engine    waste-pipe    positive=${TRUE}
    Get Text    css=body    contains    รวม 9.50 ม.
    Get Text    css=body    contains    รวม 13.50 ม.
    Get Text    css=body    contains    รวม 3.50 ม.
    WS Confirm Should Pass    waste-pipe    water-pipe

Sample House Waste Pipe Matches The Engine And Confirms
    [Tags]    waste-pipe    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    WS Level Should Match Engine    waste-pipe    positive=${TRUE}
    WS Confirm Should Pass    waste-pipe    water-pipe

Waste Pipe With Only A Vertical Run Is Enough
    [Documentation]    REQUIRED_FIELDS: at least one run length, horizontal or vertical.
    [Tags]    waste-pipe    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    Fill Number By Label    แนวดิ่ง (ม.)    3.5    2
    WS Level Should Match Engine    waste-pipe
    WS Confirm Should Pass    waste-pipe    water-pipe

Waste Pipe With Only A Horizontal Run Is Enough
    [Tags]    waste-pipe    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    Fill Number By Label    แนวราบ (ม.)    12    0
    WS Level Should Match Engine    waste-pipe
    WS Confirm Should Pass    waste-pipe    water-pipe

Waste Pipe Run Cleared Again Blocks The Level
    [Tags]    waste-pipe    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    Fill Number By Label    แนวราบ (ม.)    12    0
    Fill Number By Label    แนวราบ (ม.)    ${EMPTY}    0
    WS Level Total Should Be    0
    WS Confirm Should Be Blocked Naming    waste-pipe    1    กรอกความยาวท่อน้ำทิ้งอย่างน้อย 1 แนว

Waste Pipe Horizontal Edge Inputs Stay Finite And Match The Engine
    [Tags]    waste-pipe    edge
    [Setup]    Open Waste Pipe Level
    [Template]    Waste Edge Number
    แนวราบ (ม.)    0    0
    แนวราบ (ม.)    1,250.5    1250.5
    แนวราบ (ม.)    =2.5*4    10
    แนวราบ (ม.)    9.5+7+2    18.5
    แนวราบ (ม.)    4+3.5+4    11.5
    แนวราบ (ม.)    1e3    1000
    แนวราบ (ม.)    -3    -3
    แนวราบ (ม.)    abc    1
    แนวราบ (ม.)    ${EMPTY}    0
    แนวราบ (ม.)    1/0    1
    แนวราบ (ม.)    99999999    99999999

Waste Pipe Vertical Edge Inputs Stay Finite And Match The Engine
    [Tags]    waste-pipe    edge
    [Setup]    Open Waste Pipe Level
    [Template]    Waste Edge Number
    แนวดิ่ง (ม.)    0    0
    แนวดิ่ง (ม.)    1,250.5    1250.5
    แนวดิ่ง (ม.)    =2*1.5    3
    แนวดิ่ง (ม.)    -3    -3
    แนวดิ่ง (ม.)    abc    1
    แนวดิ่ง (ม.)    ${EMPTY}    0
    แนวดิ่ง (ม.)    99999999    99999999

Extra Waste Pipe Run Without A Size Is Flagged And Not Priced
    [Documentation]    An extra run with a length but no pipe size cannot be priced: the card says so; picking a size
    ...    prices it.
    [Tags]    waste-pipe    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    Fill Number By Label    แนวราบ (ม.)    10    0
    WS Level Should Match Engine    waste-pipe
    WS Click Button    เพิ่มท่อน้ำทิ้งอีกแนว
    Fill Number By Label    แนวราบ (ม.)    5    3
    Get Text    css=body    contains    ยังไม่ได้เลือกขนาดท่อ
    Get Text    css=body    contains    ยังไม่ถูกนำไปคิดเงิน
    WS Level Should Match Engine    waste-pipe
    WS Choose Radio    ขนาดท่อ    PVC 2"
    Get Element Count    css=body >> text=ยังไม่ได้เลือกขนาดท่อ    ==    0
    WS Level Should Match Engine    waste-pipe

Every Extra Waste Pipe Type And Size Can Be Picked
    [Documentation]    All 3 pipe types and all 3 sizes of the extra run are chosen once. A type brings its own size
    ...    along.
    [Tags]    waste-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    WS Click Button    เพิ่มท่อน้ำทิ้งอีกแนว
    Fill Number By Label    แนวราบ (ม.)    5    3
    FOR    ${type}    ${size}    IN
    ...    ท่อส้วม (ชักโครก)    PVC 4"
    ...    ท่อน้ำทิ้ง (อ่างล้างหน้า / ท่อระบายพื้น)    PVC 2"
    ...    ท่ออากาศถังบำบัด    PVC 1"
        WS Choose Radio    ชนิดท่อ    ${type}
        WS Radio Should Be Selected    ชนิดท่อ    ${type}
        WS Radio Should Be Selected    ขนาดท่อ    ${size}
    END
    WS Level Should Match Engine    waste-pipe
    FOR    ${size}    IN    PVC 1"    PVC 2"    PVC 4"
        WS Choose Radio    ขนาดท่อ    ${size}
        WS Radio Should Be Selected    ขนาดท่อ    ${size}
    END
    WS Level Should Match Engine    waste-pipe

Extra Waste Pipe Runs Can Be Added And Deleted
    [Tags]    waste-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    Fill Waste Pipe From Plan
    FOR    ${i}    IN RANGE    3
        WS Click Button    เพิ่มท่อน้ำทิ้งอีกแนว
        Fill Number By Label    แนวราบ (ม.)    ${{ 2 + ${i} }}    ${{ 3 + ${i} }}
        WS Choose Radio    ขนาดท่อ    PVC 2"    ${i}
    END
    Get Element Count    css=[aria-label="แนวราบ (ม.)"]    ==    6
    WS Level Should Match Engine    waste-pipe
    WS Delete Card Confirm    1
    Get Element Count    css=[aria-label="แนวราบ (ม.)"]    ==    5
    WS Delete Card Confirm    0
    WS Delete Card Confirm    0
    Get Element Count    css=[aria-label="แนวราบ (ม.)"]    ==    3
    Get Text    css=body    contains    อยากแยกกรอกเป็นแนว ๆ
    WS Level Should Match Engine    waste-pipe

Eighteen Waste Pipe Runs Add Up To The Engine Total
    [Documentation]    3 fixed rows + 15 extra runs of 2" pipe (2 m each): the table keeps working and totals equal
    ...    the engine.
    [Tags]    waste-pipe    slow    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    Fill Waste Pipe From Plan
    WS Click Button    เพิ่มท่อน้ำทิ้งอีกแนว
    Fill Number By Label    แนวราบ (ม.)    2    3
    WS Choose Radio    ขนาดท่อ    PVC 2"    0
    FOR    ${i}    IN RANGE    1    15
        WS Click Button    เพิ่มท่อน้ำทิ้งอีกแนว
        Fill Number By Label    แนวราบ (ม.)    2    ${{ 3 + ${i} }}
        WS Choose Radio    ขนาดท่อ    PVC 2"    ${i}
    END
    Get Element Count    css=[aria-label="แนวราบ (ม.)"]    ==    18
    WS Level Should Match Engine    waste-pipe
    WS Confirm Should Pass    waste-pipe    water-pipe

Waste Pipe Values Survive A Reload
    [Tags]    waste-pipe    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    Fill Waste Pipe From Plan
    WS Level Should Match Engine    waste-pipe
    WS Reload And Wait
    WS Box Should Show    css=[aria-label="แนวราบ (ม.)"] >> nth=0    7.5
    WS Box Should Show    css=[aria-label="แนวราบ (ม.)"] >> nth=1    10.5
    WS Box Should Show    css=[aria-label="แนวดิ่ง (ม.)"] >> nth=2    3.5
    WS Level Should Match Engine    waste-pipe

Previous Arrow Of Waste Pipe Leads To Electrical Equipment
    [Tags]    waste-pipe    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    อุปกรณ์ไฟฟ้า    electrical-equipment

Locked Waste Pipe Level Shows The Waiting Screen
    [Tags]    waste-pipe    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    lock_level=waste-pipe
    WS Go To Locked Level    waste-pipe    ท่อน้ำทิ้ง

# ═════════════════════════════ 29 water-pipe ═════════════════════════════

Blank Water Pipe Level Totals Zero With Two Fixed Pipe Rows
    [Tags]    water-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    water-pipe
    Get Element Count    css=[aria-label="แนวราบ (ม.)"]    ==    2
    Get Element Count    css=[aria-label="แนวดิ่ง (ม.)"]    ==    2

Confirming A Blank Water Pipe Level Is Blocked
    [Tags]    water-pipe    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    WS Confirm Should Be Blocked Naming    water-pipe    1    กรอกความยาวท่อน้ำดีอย่างน้อย 1 แนว
    Level Mark Should Be    water-pipe    ${None}

Water Pipe Filled From The Plan Matches The Engine And Confirms
    [Documentation]    Runs: main 3/4" 20 + 0.5 = 20.50 m, branch 1/2" 6 + 4.5 = 10.50 m.
    [Tags]    water-pipe    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    Fill Water Pipe From Plan
    WS Level Should Match Engine    water-pipe    positive=${TRUE}
    Get Text    css=body    contains    รวม 20.50 ม.
    Get Text    css=body    contains    รวม 10.50 ม.
    WS Confirm Should Pass    water-pipe    sanitary-system

Sample House Water Pipe Matches The Engine And Confirms
    [Tags]    water-pipe    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    WS Level Should Match Engine    water-pipe    positive=${TRUE}
    WS Confirm Should Pass    water-pipe    sanitary-system

Water Pipe With Only The Inside Branch Is Enough
    [Tags]    water-pipe    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    Fill Number By Label    แนวราบ (ม.)    6    1
    WS Level Should Match Engine    water-pipe
    WS Confirm Should Pass    water-pipe    sanitary-system

Water Pipe Run Cleared Again Blocks The Level
    [Tags]    water-pipe    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    Fill Number By Label    แนวดิ่ง (ม.)    2    0
    Fill Number By Label    แนวดิ่ง (ม.)    ${EMPTY}    0
    WS Confirm Should Be Blocked Naming    water-pipe    1    กรอกความยาวท่อน้ำดีอย่างน้อย 1 แนว

Water Pipe Horizontal Edge Inputs Stay Finite And Match The Engine
    [Tags]    water-pipe    edge
    [Setup]    Open Water Pipe Level
    [Template]    Water Edge Number
    แนวราบ (ม.)    0    0
    แนวราบ (ม.)    1,250.5    1250.5
    แนวราบ (ม.)    =2.5*4    10
    แนวราบ (ม.)    12+8    20
    แนวราบ (ม.)    1e3    1000
    แนวราบ (ม.)    -3    -3
    แนวราบ (ม.)    abc    1
    แนวราบ (ม.)    ${EMPTY}    0
    แนวราบ (ม.)    1/0    1
    แนวราบ (ม.)    99999999    99999999

Water Pipe Vertical Edge Inputs Stay Finite And Match The Engine
    [Tags]    water-pipe    edge
    [Setup]    Open Water Pipe Level
    [Template]    Water Edge Number
    แนวดิ่ง (ม.)    0    0
    แนวดิ่ง (ม.)    1,250.5    1250.5
    แนวดิ่ง (ม.)    =2*1.5    3
    แนวดิ่ง (ม.)    -3    -3
    แนวดิ่ง (ม.)    abc    1
    แนวดิ่ง (ม.)    ${EMPTY}    0
    แนวดิ่ง (ม.)    99999999    99999999

Extra Water Pipe Run Without A Size Is Flagged And Not Priced
    [Tags]    water-pipe    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    Fill Number By Label    แนวราบ (ม.)    10    0
    WS Click Button    เพิ่มท่อน้ำดีอีกแนว
    Fill Number By Label    แนวราบ (ม.)    5    2
    Get Text    css=body    contains    ยังไม่ได้เลือกขนาดท่อ
    Get Text    css=body    contains    ยังไม่ถูกนำไปคิดเงิน
    WS Level Should Match Engine    water-pipe
    WS Choose Radio    ขนาดท่อ    PVC 3/4"
    Get Element Count    css=body >> text=ยังไม่ได้เลือกขนาดท่อ    ==    0
    WS Level Should Match Engine    water-pipe

Every Extra Water Pipe Type And Size Can Be Picked
    [Tags]    water-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    WS Click Button    เพิ่มท่อน้ำดีอีกแนว
    Fill Number By Label    แนวราบ (ม.)    5    2
    FOR    ${type}    ${size}    IN
    ...    ท่อเมนนอกบ้าน    PVC 3/4"
    ...    ท่อย่อยในบ้าน (ห้องน้ำ / จุดใช้น้ำ)    PVC 1/2"
        WS Choose Radio    ชนิดท่อ    ${type}
        WS Radio Should Be Selected    ชนิดท่อ    ${type}
        WS Radio Should Be Selected    ขนาดท่อ    ${size}
    END
    WS Level Should Match Engine    water-pipe
    FOR    ${size}    IN    PVC 1/2"    PVC 3/4"
        WS Choose Radio    ขนาดท่อ    ${size}
        WS Radio Should Be Selected    ขนาดท่อ    ${size}
    END
    WS Level Should Match Engine    water-pipe

Extra Water Pipe Runs Can Be Added And Deleted
    [Tags]    water-pipe
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    Fill Water Pipe From Plan
    FOR    ${i}    IN RANGE    3
        WS Click Button    เพิ่มท่อน้ำดีอีกแนว
        Fill Number By Label    แนวราบ (ม.)    ${{ 2 + ${i} }}    ${{ 2 + ${i} }}
        WS Choose Radio    ขนาดท่อ    PVC 1/2"    ${i}
    END
    Get Element Count    css=[aria-label="แนวราบ (ม.)"]    ==    5
    WS Level Should Match Engine    water-pipe
    WS Delete Card Confirm    1
    Get Element Count    css=[aria-label="แนวราบ (ม.)"]    ==    4
    WS Delete Card Confirm    0
    WS Delete Card Confirm    0
    Get Element Count    css=[aria-label="แนวราบ (ม.)"]    ==    2
    Get Text    css=body    contains    อยากแยกกรอกเป็นแนว ๆ
    WS Level Should Match Engine    water-pipe

Seventeen Water Pipe Runs Add Up To The Engine Total
    [Documentation]    2 fixed rows + 15 extra runs of 1/2" pipe (2 m each).
    [Tags]    water-pipe    slow    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    Fill Water Pipe From Plan
    FOR    ${i}    IN RANGE    15
        WS Click Button    เพิ่มท่อน้ำดีอีกแนว
        Fill Number By Label    แนวราบ (ม.)    2    ${{ 2 + ${i} }}
        WS Choose Radio    ขนาดท่อ    PVC 1/2"    ${i}
    END
    Get Element Count    css=[aria-label="แนวราบ (ม.)"]    ==    17
    WS Level Should Match Engine    water-pipe
    WS Confirm Should Pass    water-pipe    sanitary-system

Water Pipe Values Survive A Reload
    [Tags]    water-pipe    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    Fill Water Pipe From Plan
    WS Level Should Match Engine    water-pipe
    WS Reload And Wait
    WS Box Should Show    css=[aria-label="แนวราบ (ม.)"] >> nth=0    20
    WS Box Should Show    css=[aria-label="แนวดิ่ง (ม.)"] >> nth=1    4.5
    WS Level Should Match Engine    water-pipe

Previous Arrow Of Water Pipe Leads To Waste Pipe
    [Tags]    water-pipe    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    ท่อน้ำทิ้ง    waste-pipe

Locked Water Pipe Level Shows The Waiting Screen
    [Tags]    water-pipe    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    lock_level=water-pipe
    WS Go To Locked Level    water-pipe    ท่อน้ำดี

# ═════════════════════════════ 30 sanitary-system ═════════════════════════════

Blank Sanitary System Level Totals Zero And Lists Four Items
    [Tags]    sanitary-system
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-system    unlock_until=sanitary-system
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    sanitary-system
    WS Pick Line Count Should Be    4

Blank Sanitary System Level Confirms Because Nothing Is Required
    [Documentation]    REQUIRED_FIELDS: septic tanks etc. vary, so the step has no required value.
    [Tags]    sanitary-system
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-system    unlock_until=sanitary-system
    WS Wait For Level Page
    WS Confirm Should Pass    sanitary-system    sanitary-ware

Sanitary System Filled From The Plan Matches The Engine And Confirms
    [Documentation]    Business rule (Excel BOQ rows 273-276 prices): septic 7,000+3,000, grease trap 1,500+300, 2
    ...    manholes 2x(300+200), 10 m drain pipe 10x(200+150) = 16,300 baht.
    [Tags]    sanitary-system    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-system    unlock_until=sanitary-system
    WS Wait For Level Page
    Fill Sanitary System From Plan
    WS Level Should Match Engine    sanitary-system
    WS Level Total Should Be    16300
    WS Confirm Should Pass    sanitary-system    sanitary-ware

Sample House Sanitary System Matches The Engine And Confirms
    [Tags]    sanitary-system    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/sanitary-system    unlock_until=sanitary-system
    WS Wait For Level Page
    WS Level Should Match Engine    sanitary-system    positive=${TRUE}
    WS Confirm Should Pass    sanitary-system    sanitary-ware

Every Sanitary System Item Can Be Counted
    [Documentation]    Each of the 4 dropdown items is given a quantity once (3 counted, 1 in metres).
    [Tags]    sanitary-system
    [Setup]    Open Sanitary System
    [Template]    Pick Item Quantity Matches Engine
    sanitary-system    ${SS_GREASE_TRAP}    1
    sanitary-system    ${SS_SEPTIC_TANK}    2
    sanitary-system    ${SS_MANHOLE}    6
    sanitary-system    ${SS_AC_PIPE}    36

Sanitary System Shows The Excavator Note
    [Tags]    sanitary-system
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-system    unlock_until=sanitary-system
    WS Wait For Level Page
    Get Text    css=body    contains    งานถังบำบัด บ่อพัก และท่อระบายน้ำ ต้องใช้รถแมคโครเล็ก

Sanitary System Stepper Adds And Removes One At A Time
    [Tags]    sanitary-system
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-system    unlock_until=sanitary-system
    WS Wait For Level Page
    WS Minus Button Should Be Disabled    ${SS_SEPTIC_TANK}
    WS Step Pick Quantity    เพิ่ม    ${SS_SEPTIC_TANK}
    WS Step Pick Quantity    เพิ่ม    ${SS_SEPTIC_TANK}
    WS Pick Quantity Should Be    ${SS_SEPTIC_TANK}    2
    WS Level Total Should Be    20000
    WS Level Should Match Engine    sanitary-system
    WS Step Pick Quantity    ลด    ${SS_SEPTIC_TANK}
    WS Step Pick Quantity    ลด    ${SS_SEPTIC_TANK}
    WS Minus Button Should Be Disabled    ${SS_SEPTIC_TANK}
    WS Level Total Should Be    0

Sanitary System Quantity Edge Inputs Stay Finite And Match The Engine
    [Tags]    sanitary-system    edge
    [Setup]    Open Sanitary System
    [Template]    Pick Edge Quantity
    sanitary-system    ${SS_MANHOLE}    0    0
    sanitary-system    ${SS_MANHOLE}    1,250.5    1250.5
    sanitary-system    ${SS_MANHOLE}    =2*3    6
    sanitary-system    ${SS_MANHOLE}    9.5+7+2    18.5
    sanitary-system    ${SS_MANHOLE}    -4    -4
    sanitary-system    ${SS_MANHOLE}    abc    1
    sanitary-system    ${SS_MANHOLE}    ${EMPTY}    0
    sanitary-system    ${SS_MANHOLE}    99999999    99999999

Sanitary System Pipe Length Edge Inputs Stay Finite And Match The Engine
    [Tags]    sanitary-system    edge
    [Setup]    Open Sanitary System
    [Template]    Pick Edge Length
    sanitary-system    ${SS_AC_PIPE}    0    0
    sanitary-system    ${SS_AC_PIPE}    1,250.5    1250.5
    sanitary-system    ${SS_AC_PIPE}    =2.5*4    10
    sanitary-system    ${SS_AC_PIPE}    9.5+7+2    18.5
    sanitary-system    ${SS_AC_PIPE}    -4.5    -4.5
    sanitary-system    ${SS_AC_PIPE}    abc    1
    sanitary-system    ${SS_AC_PIPE}    99999999    99999999

Sanitary System Item Outside The Catalogue And Duplicates Stay Safe
    [Documentation]    Old saved list: a septic tank listed twice (10,000 baht each) and an unknown unit of 2: 20,000
    ...    baht, no crash.
    [Tags]    sanitary-system    edge    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-system    unlock_until=sanitary-system
    WS Wait For Level Page
    WS Seed Pick Items    sanitary-system
    ...    ถังบำบัดน้ำเสียสาเร็จรูป ขนาด 600 ลิตร|1|ชุด
    ...    บ่อดักตะกอนพิเศษ|2|ชุด
    ...    ถังบำบัดน้ำเสียสาเร็จรูป ขนาด 600 ลิตร|1|ชุด
    Get Text    css=body    contains    รายการเพิ่มเติม
    WS Pick Quantity Should Be    ${SS_SEPTIC_TANK}    1
    WS Level Should Match Engine    sanitary-system
    WS Level Total Should Be    20000
    WS Confirm Should Pass    sanitary-system    sanitary-ware

Sanitary System Quantities Survive A Reload
    [Tags]    sanitary-system    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-system    unlock_until=sanitary-system
    WS Wait For Level Page
    Fill Sanitary System From Plan
    WS Reload And Wait
    WS Pick Quantity Should Be    ${SS_MANHOLE}    2
    WS Pick Quantity Should Be    ${SS_AC_PIPE}    10
    WS Level Total Should Be    16300
    WS Level Should Match Engine    sanitary-system

Previous Arrow Of Sanitary System Leads To Water Pipe
    [Tags]    sanitary-system    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-system    unlock_until=sanitary-system
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    ท่อน้ำดี    water-pipe

Locked Sanitary System Level Shows The Waiting Screen
    [Tags]    sanitary-system    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-system    lock_level=sanitary-system
    WS Go To Locked Level    sanitary-system    อุปกรณ์ระบบสุขาภิบาล

# ═════════════════════════════ 31 sanitary-ware ═════════════════════════════

Blank Sanitary Ware Level Totals Zero And Lists Ten Items
    [Tags]    sanitary-ware
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page
    WS Level Total Should Be    0
    WS Level Should Match Engine    sanitary-ware
    WS Pick Line Count Should Be    10
    WS Button Count Should Be    เพิ่มชุดห้องน้ำ 1 ห้อง    1

Confirming A Blank Sanitary Ware Level Is Blocked
    [Tags]    sanitary-ware    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page
    WS Confirm Should Be Blocked Naming    sanitary-ware    1    ระบุสุขภัณฑ์พร้อมจำนวนอย่างน้อย 1 รายการ
    Level Mark Should Be    sanitary-ware    ${None}

Sanitary Ware Filled From The Plan Matches The Engine And Confirms
    [Documentation]    Business rule (Excel BOQ rows 282-291 prices): one bathroom set + 1 extra floor drain =
    ...    5,800+600+4,000+870+1,100+420+870+2x400+600+1,100 = 16,160 baht. Confirm opens ceiling.
    [Tags]    sanitary-ware    smoke
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page
    Fill Sanitary Ware From Plan
    WS Level Should Match Engine    sanitary-ware
    WS Level Total Should Be    16160
    WS Confirm Should Pass    sanitary-ware    ${LEVEL_AFTER_SANITARY_WARE}

Sample House Sanitary Ware Matches The Engine And Confirms
    [Tags]    sanitary-ware    sample
    Open Fresh Context    /file.svg
    WS Start Guest Project    sample    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page
    WS Level Should Match Engine    sanitary-ware    positive=${TRUE}
    WS Confirm Should Pass    sanitary-ware    ${LEVEL_AFTER_SANITARY_WARE}

Bathroom Set Button Adds One Of Every Fitting Per Press
    [Documentation]    One press: toilet, bidet spray, basin, tap, mirror, paper holder, towel rail, floor drain, soap
    ...    dish, shower each 1; a second press makes them 2 (two bathrooms).
    [Tags]    sanitary-ware
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page
    WS Click Button    เพิ่มชุดห้องน้ำ 1 ห้อง
    FOR    ${item}    IN    ${SW_TOILET}    ${SW_BIDET_SPRAY}    ${SW_BASIN_TAP}    ${SW_MIRROR}    ${SW_PAPER_HOLDER}
    ...    ${SW_TOWEL_RAIL}    ${SW_FLOOR_DRAIN}    ${SW_SOAP_DISH}    ${SW_SHOWER}
        WS Pick Quantity Should Be    ${item}    1
    END
    WS Pick Quantity Should Be    ${SW_BASIN}    1    exact=${TRUE}
    WS Level Should Match Engine    sanitary-ware
    WS Click Button    เพิ่มชุดห้องน้ำ 1 ห้อง
    WS Pick Quantity Should Be    ${SW_TOILET}    2
    WS Pick Quantity Should Be    ${SW_SHOWER}    2
    WS Pick Quantity Should Be    ${SW_BASIN}    2    exact=${TRUE}
    WS Level Should Match Engine    sanitary-ware

Bathroom Set Button Adds To Counts Already Typed
    [Tags]    sanitary-ware    edge
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page
    WS Set Pick Quantity    ${SW_TOILET}    3
    WS Click Button    เพิ่มชุดห้องน้ำ 1 ห้อง
    WS Pick Quantity Should Be    ${SW_TOILET}    4
    WS Pick Quantity Should Be    ${SW_SHOWER}    1
    WS Level Should Match Engine    sanitary-ware

Every Sanitary Ware Item Can Be Counted
    [Documentation]    Each of the 10 dropdown items is given a quantity once. "อ่างล้างหน้า" is matched whole because
    ...    "ก๊อกเดี่ยวอ่างล้างหน้า" ends with the same words.
    [Tags]    sanitary-ware
    [Setup]    Open Sanitary Ware
    [Template]    Pick Item Quantity Matches Engine
    sanitary-ware    ${SW_MIRROR}    1
    sanitary-ware    ${SW_BASIN_TAP}    2
    sanitary-ware    ${SW_TOILET}    3
    sanitary-ware    ${SW_FLOOR_DRAIN}    4
    sanitary-ware    ${SW_PAPER_HOLDER}    1
    sanitary-ware    ${SW_SOAP_DISH}    2
    sanitary-ware    ${SW_SHOWER}    3
    sanitary-ware    ${SW_TOWEL_RAIL}    4
    sanitary-ware    ${SW_BIDET_SPRAY}    1
    sanitary-ware    ${SW_BASIN}    2    ${TRUE}

Sanitary Ware Stepper Adds And Removes One At A Time
    [Tags]    sanitary-ware
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page
    WS Minus Button Should Be Disabled    ${SW_TOILET}
    WS Step Pick Quantity    เพิ่ม    ${SW_TOILET}
    WS Step Pick Quantity    เพิ่ม    ${SW_TOILET}
    WS Pick Quantity Should Be    ${SW_TOILET}    2
    WS Level Total Should Be    11600
    WS Level Should Match Engine    sanitary-ware
    WS Step Pick Quantity    ลด    ${SW_TOILET}
    WS Level Total Should Be    5800
    WS Step Pick Quantity    ลด    ${SW_TOILET}
    WS Minus Button Should Be Disabled    ${SW_TOILET}
    WS Level Total Should Be    0

Sanitary Ware Quantity Edge Inputs Stay Finite And Match The Engine
    [Tags]    sanitary-ware    edge
    [Setup]    Open Sanitary Ware
    [Template]    Pick Edge Quantity
    sanitary-ware    ${SW_TOILET}    0    0
    sanitary-ware    ${SW_TOILET}    1,250.5    1250.5
    sanitary-ware    ${SW_TOILET}    =2*3    6
    sanitary-ware    ${SW_TOILET}    9.5+7+2    18.5
    sanitary-ware    ${SW_TOILET}    -4    -4
    sanitary-ware    ${SW_TOILET}    abc    1
    sanitary-ware    ${SW_TOILET}    ${EMPTY}    0
    sanitary-ware    ${SW_TOILET}    1/0    1
    sanitary-ware    ${SW_TOILET}    99999999    99999999

Sanitary Ware Item Outside The Catalogue And Duplicates Stay Safe
    [Documentation]    Old saved list: a toilet listed twice (5,800 baht each) and a bidet nobody sells: 11,600 baht,
    ...    no crash.
    [Tags]    sanitary-ware    edge    negative
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page
    WS Seed Pick Items    sanitary-ware
    ...    ชักโครกนั่งราบ|1|ชุด
    ...    โถปัสสาวะชายแบบพิเศษ|3|ชุด
    ...    ชักโครกนั่งราบ|1|ชุด
    Get Text    css=body    contains    รายการเพิ่มเติม
    WS Pick Quantity Should Be    ${SW_TOILET}    1
    WS Level Should Match Engine    sanitary-ware
    WS Level Total Should Be    11600
    WS Confirm Should Pass    sanitary-ware    ${LEVEL_AFTER_SANITARY_WARE}

Sanitary Ware Quantities Survive A Reload
    [Tags]    sanitary-ware    persistence
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page
    Fill Sanitary Ware From Plan
    WS Reload And Wait
    WS Pick Quantity Should Be    ${SW_TOILET}    1
    WS Pick Quantity Should Be    ${SW_FLOOR_DRAIN}    2
    WS Level Total Should Be    16160
    WS Level Should Match Engine    sanitary-ware

Previous Arrow Of Sanitary Ware Leads To Sanitary System
    [Tags]    sanitary-ware    navigation
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page
    WS Previous Arrow Should Lead To    อุปกรณ์ระบบสุขาภิบาล    sanitary-system

Locked Sanitary Ware Level Shows The Waiting Screen
    [Tags]    sanitary-ware    navigation    security
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    lock_level=sanitary-ware
    WS Go To Locked Level    sanitary-ware    สุขภัณฑ์

# ═════════════════════════════ whole stretch ═════════════════════════════

Levels 24 To 31 Can Be Filled And Confirmed In Order From A Blank Project
    [Documentation]    The plan's electrical, water and sanitary levels one after the other, in the order the app offers
    ...    them (the fittings of group D wait for the paint, so the project starts with everything else done): each
    ...    fill keyword, each confirm opens the engine's next step, and every level total equals the engine on the way.
    ...    All 8 levels are filled once and the journey ends on the map with 37 of 37 steps done.
    [Tags]    smoke    slow    cross-level
    Open Fresh Context    /file.svg
    ${project}=    WS New Project    blank
    ${project}=    Project With Levels Done    ${project}    ALL
    ${journey}=    Evaluate    {k: v for k, v in $project['journey'].items() if k not in $SYSTEM_FILL}
    Set To Dictionary    ${project}    journey=${journey}
    ${value}=    Guest Storage Value    ${project}
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    ${value}
    WS Go To Path    /journey/electrical-pipe
    ${visited}=    Create List
    FOR    ${i}    IN RANGE    8
        WS Wait For Level Page
        ${id}=    Current Level Id
        Append To List    ${visited}    ${id}
        Run Keyword    ${SYSTEM_FILL}[${id}]
        WS Level Should Match Engine    ${id}
        ${path}=    Landing Path After Confirm    ${id}
        WS Confirm Should Pass    ${id}    ${EMPTY}
        Wait For Condition    Url    should end with    ${path}    timeout=180s
    END
    Get Url    should end with    /journey
    Lists Should Be Equal    ${{ sorted($visited) }}    ${{ sorted($SYSTEM_FILL) }}    msg=Not every level was visited exactly once
    Get Text    css=body    contains    37 จาก 37 ขั้นตอน


*** Keywords ***
Close Test Context
    [Documentation]    Free the browser context of the finished test (a failure screenshot was already taken).
    Run Keyword And Ignore Error    Close Context

Open Pipe With One Light Circuit
    [Documentation]    Conduit level with one new light circuit (no length typed yet).
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-pipe
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง

Pipe Edge Number
    [Documentation]    Edge input ``${typed}`` into the circuit box ``${label}``; the box must then show ``${shown}``.
    [Arguments]    ${label}    ${typed}    ${shown}
    WS Edge Number    electrical-pipe    ${label}    ${typed}    ${shown}

Pipe Count Edge Number
    [Documentation]    Edge input ``${typed}`` into the switch count; the box must then show ``${shown}``.
    [Arguments]    ${typed}    ${shown}
    WS Edge Number    electrical-pipe    จำนวนสวิตช์ (จุด)    ${typed}    ${shown}    tolerance=0.5

Open Cable With One Light Circuit
    [Documentation]    A wired light circuit in the conduit level (main 20 m, lamp run 10 m), browser on the conduit
    ...    level.
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-pipe    unlock_until=electrical-cable
    WS Wait For Level Page
    WS Add Circuit    ไฟแสงสว่าง
    Fill Number By Label    ท่อสายเมน (ม.)    20
    Fill Number By Label    ท่อแยกเข้าโคม (ม.)    10

Cable After Conduit Edit
    [Documentation]    Type ``${typed}`` as the main conduit run, then check the cable level totals against the
    ...    engine.
    [Arguments]    ${typed}
    WS Go To Level    electrical-pipe
    Fill Number By Label    ท่อสายเมน (ม.)    ${typed}
    WS Go To Level    electrical-cable
    WS Level Should Match Engine    electrical-cable

Open Load Center
    [Documentation]    A blank project on the load-center level.
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/load-center    unlock_until=load-center
    WS Wait For Level Page

Open Equipment
    [Documentation]    A blank project on the electrical-equipment level.
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/electrical-equipment    unlock_until=electrical-equipment
    WS Wait For Level Page

Open Sanitary System
    [Documentation]    A blank project on the sanitary-system level.
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-system    unlock_until=sanitary-system
    WS Wait For Level Page

Open Sanitary Ware
    [Documentation]    A blank project on the sanitary-ware level.
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/sanitary-ware    unlock_until=sanitary-ware
    WS Wait For Level Page

Open Waste Pipe Level
    [Documentation]    A blank project on the waste-pipe level.
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/waste-pipe    unlock_until=waste-pipe
    WS Wait For Level Page

Open Water Pipe Level
    [Documentation]    A blank project on the water-pipe level.
    Open Fresh Context    /file.svg
    WS Start Guest Project    blank    /journey/water-pipe    unlock_until=water-pipe
    WS Wait For Level Page

Waste Edge Number
    [Documentation]    Edge input ``${typed}`` into the waste-pipe box ``${label}``; it must then show ``${shown}``.
    [Arguments]    ${label}    ${typed}    ${shown}
    WS Edge Number    waste-pipe    ${label}    ${typed}    ${shown}

Water Edge Number
    [Documentation]    Edge input ``${typed}`` into the water-pipe box ``${label}``; it must then show ``${shown}``.
    [Arguments]    ${label}    ${typed}    ${shown}
    WS Edge Number    water-pipe    ${label}    ${typed}    ${shown}

Pick Item Quantity Matches Engine
    [Documentation]    Count ``${item}`` (a fragment of its text, or the whole label with ``${exact}``) and compare to
    ...    the engine.
    [Arguments]    ${level_id}    ${item}    ${qty}    ${exact}=${FALSE}
    WS Set Pick Quantity    ${item}    ${qty}    ${exact}
    WS Pick Quantity Should Be    ${item}    ${qty}    ${exact}
    WS Level Should Match Engine    ${level_id}    positive=${TRUE}

Pick Edge Quantity
    [Documentation]    Edge input ``${typed}`` into the count of ``${item}``; the box must then show ``${shown}``.
    [Arguments]    ${level_id}    ${item}    ${typed}    ${shown}
    WS Edge Pick    ${level_id}    ${item}    ${typed}    ${shown}

Pick Edge Length
    [Documentation]    Edge input ``${typed}`` into the metres of ``${item}``; the box must then show ``${shown}``.
    [Arguments]    ${level_id}    ${item}    ${typed}    ${shown}
    WS Edge Pick    ${level_id}    ${item}    ${typed}    ${shown}    tolerance=0.001
