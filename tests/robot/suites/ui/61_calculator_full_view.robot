*** Settings ***
Documentation       W4 / calculator full view ``/calc/<id>`` (the Excel-mirror outside journey mode, src/app/(app)/calc/[id]):
...                 several calculators open without a crash, key outputs equal the engine's ``calcOutputs``, and an edit
...                 there changes the BOQ exactly as it does in journey mode.
Resource            ../../resources/pages/boq_planning.resource
Suite Setup         Setup W4 Suite
Test Teardown       Close Test Context
Test Tags           calculator    boq    w4


*** Variables ***
@{ALL_CALCULATORS}      land-inspection    demolition    fill    temp-utilities    site-camp    layout    piles    footing
...                     pedestal    ground-beam    slab-on-grade    precast-slab    column    roof-beam    roof-slab    stair
...                     roofing    roof-structure    door-window    brick    plaster    ceiling    floor-tile    toilet-tile
...                     wall-finishing    paint    structure-summary    waste-pipe    water-pipe    electrical-pipe
...                     electrical-cable    load-center    electrical-equipment    sanitary-system    misc    sanitary-ware
${FOOTING_COUNT}        css=input[aria-label="count 1"]
${BACK_TO_BOQ}          css=button[aria-label="กลับไปหน้าสรุป BOQ"]


*** Test Cases ***
Footing Page Opens With The Sample Values
    [Documentation]    The footing calculator opens with the sample's 21 footings and no error.
    [Tags]    smoke
    Open Project Page    /calc/footing
    Get Text    css=body    contains    โปรแกรมถอดแบบ – งานฐานราก Footing
    Get Text    css=body    contains    แบบฟอร์ม: ฐานราก_Footing
    Value Of Input Should Be Number    ${FOOTING_COUNT}    21
    Page Should Have No Error Overlay

Footing Key Outputs Equal The Engine
    [Documentation]    Excavation, sand, lean concrete, formwork and concrete shown in the result row = calcOutputs.footing.
    ${expected}=    Open Project Page    /calc/footing
    VAR    ${out}    ${expected}[calcOutputs][footing]
    FOR    ${name}    IN    excavation    sand    lean    formwork    concrete
        Wait Until Keyword Succeeds    10s    250ms    Page Should Show Number    ${out}[${name}]
    END

Footing Section Total In The BOQ Panel Equals The Engine
    [Documentation]    The "ส่งเข้า BOQ" panel lists section 6 with the engine's section total.
    ${expected}=    Open Project Page    /calc/footing
    ${section}=    Expected Section    ${expected}    6
    Wait Until Keyword Succeeds    10s    250ms    Page Should Show Number    ${section}[total]

Brick Page Opens And Shows Engine Wall Areas
    [Documentation]    The brick calculator shows the net wall areas of the engine for the first two wall groups.
    ${expected}=    Open Project Page    /calc/brick
    Get Text    css=body    contains    โปรแกรมถอดแบบ – งานก่ออิฐ Brick
    VAR    ${out}    ${expected}[calcOutputs][brick]
    Wait Until Keyword Succeeds    10s    250ms    Page Should Show Number    ${out}[net|ผนังรอบบ้าน]
    Wait Until Keyword Succeeds    10s    250ms    Page Should Show Number    ${out}[net|ผนังภายในบ้าน]
    Page Should Have No Error Overlay

Paint Page Opens And Shows Engine Areas
    [Documentation]    Every paint area of calcOutputs.paint (walls, ceilings, moulding, fascia, skim) is on the page.
    ${expected}=    Open Project Page    /calc/paint
    Get Text    css=body    contains    โปรแกรมถอดแบบ – งานทาสี Paint
    VAR    ${out}    ${expected}[calcOutputs][paint]
    FOR    ${name}    IN    wallExterior    wallInterior    ceilingExterior    ceilingInterior    moulding    fascia    skim
        Wait Until Keyword Succeeds    10s    250ms    Page Should Show Number    ${out}[${name}]
    END

Every Calculator Page Opens Without A Crash
    [Documentation]    All 36 calculator ids of src/features/calculators/pages.ts open: a back button, no error overlay, no NaN.
    [Tags]    slow
    Open Project Page    /boq
    FOR    ${id}    IN    @{ALL_CALCULATORS}
        Go To Path    /calc/${id}
        Wait For Elements State    ${BACK_TO_BOQ}    visible    timeout=60s
        Page Should Have No Error Overlay
        Page Should Not Show Broken Numbers
    END

Every Calculator Page Opens For A Blank Project Without NaN
    [Documentation]    Same loop for a new blank project: empty inputs must not produce NaN or Infinity.
    [Tags]    slow    edge
    Open Project Page    /boq    start=blank
    FOR    ${id}    IN    @{ALL_CALCULATORS}
        Go To Path    /calc/${id}
        Wait For Elements State    ${BACK_TO_BOQ}    visible    timeout=60s
        Page Should Have No Error Overlay
        Page Should Not Show Broken Numbers
    END

Unknown Calculator Id Shows A Not Found Message
    [Documentation]    /calc/does-not-exist shows "ยังไม่มีเครื่องคำนวณนี้" and the id, no crash.
    [Tags]    negative
    Open Project Page    /calc/does-not-exist
    Get Text    css=body    contains    ยังไม่มีเครื่องคำนวณนี้
    Get Text    css=body    contains    does-not-exist
    Page Should Have No Error Overlay

Back Button Returns To The BOQ Summary
    [Documentation]    "กลับไปหน้าสรุป BOQ" goes to /boq.
    Open Project Page    /calc/footing
    Click    ${BACK_TO_BOQ}
    Wait For Condition    Url    should end with    /boq    timeout=30s
    Wait For Elements State    ${GRAND_TOTAL}    visible

Editing Footing Count Changes The Outputs And The BOQ Like The Engine
    [Documentation]    21 -> 10 footings: outputs on the calculator page, then section totals on /boq equal the engine.
    [Tags]    smoke
    Open Project Page    /calc/footing
    Fill Number By Label    count 1    10
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Footing Stored Count Is    10
    VAR    ${out}    ${expected}[calcOutputs][footing]
    FOR    ${name}    IN    excavation    sand    lean    formwork    concrete
        Wait Until Keyword Succeeds    10s    250ms    Page Should Show Number    ${out}[${name}]
    END
    Go To Path    /boq
    Wait Until Keyword Succeeds    15s    500ms    Boq Totals Should Match Engine    ${expected}

Editing In The Full View Equals Editing In Journey Mode
    [Documentation]    The same footing edit made in /calc/footing shows the engine's level total in /journey/footing too.
    Open Project Page    /calc/footing    unlock_until=pedestal
    Fill Number By Label    count 1    10
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Footing Stored Count Is    10
    Go To Level    footing
    ${level}=    Expected Level    ${expected}    footing
    Wait Until Keyword Succeeds    15s    500ms    Level Total Should Be    ${level}[total]
    Construction Total Should Be    ${expected}[constructionTotal]

Editing In Journey Mode Shows In The Full View
    [Documentation]    Reverse direction: edit on the journey level, open /calc/footing, the count and outputs are the same.
    Open Project Page    /journey/footing    unlock_until=footing
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible
    Fill Number By Label    count 1    12
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Footing Stored Count Is    12
    Go To Path    /calc/footing
    Value Of Input Should Be Number    ${FOOTING_COUNT}    12
    Wait Until Keyword Succeeds    10s    250ms    Page Should Show Number    ${expected}[calcOutputs][footing][excavation]

Editing Brick Wall Length Follows The Engine
    [Documentation]    First wall 42.50 m -> 50 m: gross/net areas (engine) and the BOQ section totals.
    Open Project Page    /calc/brick
    Fill Number By Label    ความยาว (ม.)    50
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Stored Calculator Input Should Exist    brick
    VAR    ${out}    ${expected}[calcOutputs][brick]
    Wait Until Keyword Succeeds    10s    250ms    Page Should Show Number    ${out}[gross]
    Wait Until Keyword Succeeds    10s    250ms    Page Should Show Number    ${out}[net]
    Go To Path    /boq
    Wait Until Keyword Succeeds    15s    500ms    Boq Totals Should Match Engine    ${expected}

Editing Paint Slat Area Follows The Engine
    [Documentation]    "พื้นที่ผนังไม้ระแนง" 8.10 -> 10: the paint areas and sections 23, 25, 31 equal the engine.
    Open Project Page    /calc/paint
    Fill Number By Label    พื้นที่ผนังไม้ระแนง    10
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Stored Calculator Input Should Exist    paint
    VAR    ${out}    ${expected}[calcOutputs][paint]
    Should Be Equal As Numbers    ${out}[wallSlat]    10
    Wait Until Keyword Succeeds    10s    250ms    Page Should Show Number    ${out}[wallSlat]
    Go To Path    /boq
    Wait Until Keyword Succeeds    15s    500ms    Boq Totals Should Match Engine    ${expected}

Footing Count Of Zero Gives Zero Outputs
    [Documentation]    0 footings: concrete is 0, no NaN, and the BOQ equals the engine.
    [Tags]    edge
    Open Project Page    /calc/footing
    Fill Number By Label    count 1    0
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Footing Stored Count Is    0
    Should Be Equal As Numbers    ${expected}[calcOutputs][footing][concrete]    0
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay
    Go To Path    /boq
    Wait Until Keyword Succeeds    15s    500ms    Boq Totals Should Match Engine    ${expected}

Footing Negative Count Never Produces NaN
    [Documentation]    Behaviour recorded: -3 footings is accepted as typed; no NaN, no crash, the BOQ equals the engine.
    [Tags]    edge    negative
    Open Project Page    /calc/footing
    Fill Number By Label    count 1    -3
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay
    ${expected}=    Expected For Current Guest Project
    Go To Path    /boq
    Wait Until Keyword Succeeds    15s    500ms    Boq Totals Should Match Engine    ${expected}

Footing Letters Are Rejected
    [Documentation]    "abc" in the count cell keeps 21.
    [Tags]    edge    negative
    Open Project Page    /calc/footing
    Fill Number By Label    count 1    abc
    Value Of Input Should Be Number    ${FOOTING_COUNT}    21
    Page Should Not Show Broken Numbers

Footing Huge Width Keeps Numbers Finite
    [Documentation]    A footing 999,999,999 m wide: every number stays finite and the BOQ equals the engine.
    [Tags]    edge
    Open Project Page    /calc/footing
    Fill Number By Label    width 1    999999999
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay
    ${expected}=    Expected For Current Guest Project
    Go To Path    /boq
    Wait Until Keyword Succeeds    15s    500ms    Boq Totals Should Match Engine    ${expected}

Footing Formula In A Cell Is Evaluated
    [Documentation]    "=3*4" in the count cell is stored as 12.
    [Tags]    edge
    Open Project Page    /calc/footing
    Fill Number By Label    count 1    =3*4
    Wait Until Keyword Succeeds    15s    500ms    Footing Stored Count Is    12
    Value Of Input Should Be Number    ${FOOTING_COUNT}    12

Skipped Calculator Level Gives Zero Outputs In The Full View
    [Documentation]    The level "ถมดิน" is marked "ไม่มีในโครงการนี้": the fill calculator outputs are all 0 in the engine and the
    ...    BOQ row R13 is 0.
    [Tags]    edge
    ${project}=    Sample Project With Journey    fill=skipped
    ${expected}=    Open Project Object Page    /calc/fill    ${project}
    ${values}=    Evaluate    list($expected['calcOutputs']['fill'].values())
    FOR    ${value}    IN    @{values}
        Should Be Equal As Numbers    ${value}    0
    END
    Page Should Not Show Broken Numbers
    Go To Path    /boq
    Boq Cell Should Show    R13    qty    0

Calculator Edit Survives A Reload
    [Documentation]    A calculator edit is still there after a reload.
    Open Project Page    /calc/footing
    Fill Number By Label    count 1    15
    Wait Until Keyword Succeeds    15s    500ms    Footing Stored Count Is    15
    Reload
    Wait For Elements State    ${FOOTING_COUNT}    visible
    Value Of Input Should Be Number    ${FOOTING_COUNT}    15

Calculator Menu Highlights The BOQ Entry
    [Documentation]    The header menu keeps "สรุป BOQ" selected on a calculator route.
    Open Project Page    /calc/footing
    Get Element Count    css=.ant-menu-item-selected:has-text("สรุป BOQ")    >=    1

No Console Errors On Calculator Pages
    [Documentation]    Footing, brick and paint load without console errors (ignored: see ``Console Should Have No Errors``).
    [Tags]    console
    Open Project Page    /calc/footing
    Wait For Elements State    ${FOOTING_COUNT}    visible
    Go To Path    /calc/brick
    Go To Path    /calc/paint
    Console Should Have No Errors


*** Keywords ***
Page Should Show Number
    [Documentation]    The page text holds ``${value}`` formatted with two decimals (a half-satang on either side is accepted
    ...    because JavaScript and Python round the last digit differently on .xx5 values).
    [Arguments]    ${value}
    ${text}=    Get Text    css=body
    ${exact}=    Evaluate    '{:,.2f}'.format(float($value))
    ${above}=    Evaluate    '{:,.2f}'.format(float($value) + 0.0049)
    ${below}=    Evaluate    '{:,.2f}'.format(float($value) - 0.0049)
    Should Contain Any    ${text}    ${exact}    ${above}    ${below}    msg=${exact} is not on the page

Footing Stored Count Is
    [Documentation]    The saved footing calculator has ``${count}`` footings in its first row. Returns the engine result.
    [Arguments]    ${count}
    ${project}=    Read Guest Project
    VAR    ${rows}    ${project}[calculators][footing][rows]
    Should Be Equal As Numbers    ${rows}[0][count]    ${count}
    ${expected}=    Compute Expected    ${project}
    RETURN    ${expected}

Stored Calculator Input Should Exist
    [Documentation]    The saved project holds an input for calculator ``${id}``. Returns the engine result.
    [Arguments]    ${id}
    ${project}=    Read Guest Project
    Dictionary Should Contain Key    ${project}[calculators]    ${id}
    ${expected}=    Compute Expected    ${project}
    RETURN    ${expected}
