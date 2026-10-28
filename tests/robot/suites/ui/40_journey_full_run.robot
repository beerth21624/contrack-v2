*** Settings ***
Documentation       Play the whole guided journey, all 37 levels, end to end in the browser.
...                 1) The Excel v5 sample house: every level already satisfies its requirements, so each one is
...                 confirmed in order; at every level the level total and the construction total equal the engine,
...                 and the finished project totals 1,855,162 baht (app sample; Excel M310 1,850,317.34 differs by the
...                 documented KNOWN_DELTAS of src/domain/__tests__/project-golden.test.ts).
...                 Levels open by prerequisites, so "in order" means the order the app leads the user through: confirm
...                 goes to the next open step (``Landing Path After Confirm``, from the engine's journey rules), which
...                 is not always the next one in the list (the fittings of group D wait for the paint).
...                 2) A project started from a blank plan, filled level by level through the UI with the
...                 ``Fill … From Plan`` page objects (optional levels skipped in one variant, filled in another),
...                 then the BOQ and the planning pages.
Resource            ../../resources/journey.resource
Resource            ../../resources/pages/levels_prepare_foundation.resource
Resource            ../../resources/pages/levels_structure_roof.resource
Resource            ../../resources/pages/levels_walls_systems.resource
Resource            ../../resources/pages/levels_finishes.resource
Resource            ../../resources/pages/boq_planning.resource
Suite Setup         Open Browser For Suite
Test Tags           journey    full-run    slow


*** Variables ***
${SAMPLE_TOTAL}     1855162
# Journey level id -> the page-object keyword that types the test house's plan into it (does not confirm).
&{FILL_FROM_PLAN}
...                 project-info=Fill Project Info From Plan
...                 land-inspection=Fill Land Inspection From Plan
...                 demolition=Fill Demolition From Plan
...                 fill=Fill Earth Fill From Plan
...                 temp-utilities=Fill Temporary Utilities From Plan
...                 site-camp=Fill Site Camp From Plan
...                 layout=Fill Layout From Plan
...                 piles=Fill Piles From Plan
...                 footing=Fill Footing From Plan
...                 pedestal=Fill Pedestal From Plan
...                 ground-beam=Fill Ground Beam From Plan
...                 slab-on-grade=Fill Slab On Grade From Plan
...                 precast-slab=Fill Precast Slab From Plan
...                 column=Fill Column From Plan
...                 roof-beam=Fill Roof Beam From Plan
...                 roof-slab=Fill Roof Slab From Plan
...                 stair=Fill Stair From Plan
...                 column-plates=Fill Column Plates From Plan
...                 roofing=Fill Roofing From Plan
...                 roof-structure=Fill Roof Structure From Plan
...                 door-window=Fill Door Window From Plan
...                 brick=Fill Brick From Plan
...                 plaster=Fill Plaster From Plan
...                 electrical-pipe=Fill Electrical Pipe From Plan
...                 electrical-cable=Fill Electrical Cable From Plan
...                 load-center=Fill Load Center From Plan
...                 electrical-equipment=Fill Electrical Equipment From Plan
...                 waste-pipe=Fill Waste Pipe From Plan
...                 water-pipe=Fill Water Pipe From Plan
...                 sanitary-system=Fill Sanitary System From Plan
...                 sanitary-ware=Fill Sanitary Ware From Plan
...                 ceiling=Fill Ceiling From Plan
...                 floor-tile=Fill Floor Tile From Plan
...                 toilet-tile=Fill Toilet Tile From Plan
...                 wall-finishing=Fill Wall Finishing From Plan
...                 paint=Fill Paint From Plan
...                 misc=Fill Misc From Plan
# The levels the journey marks optional (levels.ts ``optional: true``).
@{OPTIONAL_LEVELS}  demolition    fill    piles    precast-slab    roof-slab    stair    wall-finishing


*** Test Cases ***
Sample House Can Be Confirmed Through All 37 Levels
    [Documentation]    Start "ทดลองกับบ้านตัวอย่าง", confirm step by step from ข้อมูลโครงการ, each time moving to the step
    ...    the app offers next (the engine's next open step). Each step: the page opens unlocked, totals equal the
    ...    engine, confirm moves on and stores "done". All 37 levels are visited once; at the end every level is done
    ...    and the construction total is the sample total.
    [Tags]    smoke
    Open Fresh Context
    ${expected}=    Start Guest Project    sample    /journey/project-info
    ${ids}=    Level Ids
    Length Should Be    ${ids}    37
    ${visited}=    Create List
    FOR    ${i}    IN RANGE    37
        Wait For Elements State    ${CONFIRM_BUTTON}    visible    timeout=60s
        ${id}=    Current Level Id
        Append To List    ${visited}    ${id}
        Page Should Have No Error Overlay
        IF    '${id}' != 'project-info'
            ${lvl}=    Expected Level    ${expected}    ${id}
            Level Total Should Be    ${lvl}[total]
        END
        Construction Total Should Be    ${expected}[constructionTotal]
        ${path}=    Landing Path After Confirm    ${id}
        Click    ${CONFIRM_BUTTON}
        Wait For Condition    Url    should end with    ${path}    timeout=30s
        Level Mark Should Be    ${id}    done
    END
    Get Url    should end with    /journey
    Length Should Be    ${visited}    37
    Lists Should Be Equal    ${{ sorted($visited) }}    ${{ sorted($ids) }}    msg=Not every level was visited exactly once
    ${project}=    Read Guest Project
    ${final}=    Compute Expected    ${project}
    Numbers Should Be Close    ${final}[constructionTotal]    ${SAMPLE_TOTAL}    1
    FOR    ${lvl}    IN    @{final}[levels]
        Should Be Equal    ${lvl}[state]    done    msg=Level ${lvl}[id] is ${lvl}[state] after the full run
    END

Sample House Journey Survives A Reload In The Middle
    [Documentation]    Confirm the first 10 steps the app offers, reload, and continue: progress and totals are unchanged.
    Open Fresh Context
    ${expected}=    Start Guest Project    sample    /journey/project-info
    ${done}=    Create List
    FOR    ${i}    IN RANGE    10
        Wait For Elements State    ${CONFIRM_BUTTON}    visible    timeout=60s
        ${id}=    Current Level Id
        Append To List    ${done}    ${id}
        ${path}=    Landing Path After Confirm    ${id}
        Click    ${CONFIRM_BUTTON}
        Wait For Condition    Url    should end with    ${path}    timeout=30s
    END
    ${where}=    Current Level Id
    Reload
    Wait For Elements State    ${CONFIRM_BUTTON}    visible    timeout=60s
    Get Url    should end with    /journey/${where}
    FOR    ${id}    IN    @{done}
        Level Mark Should Be    ${id}    done
    END
    Construction Total Should Be    ${expected}[constructionTotal]

Blank Plan Filled Through All 37 Levels Then BOQ And Planning
    [Documentation]    Business flow: "เริ่มจากแบบแปลนของฉัน", every level typed from the test house's plan through the
    ...    UI and confirmed, each time on the step the app offers next (engine order, not list order). At each level the level total and the construction total equal the engine
    ...    for the stored project, and the level is stored "done". At the end every level is done and the BOQ,
    ...    Man-Day, Schedule and Cash Flow pages equal the engine.
    Open Fresh Context
    Start Guest Project    blank    /journey/project-info
    Play Blank Journey    skip_optional=${False}
    Finished Project Should Match Every Page    expect_state=done

Blank Plan With Every Optional Level Skipped Then BOQ And Planning
    [Documentation]    Same flow, but the 7 optional levels (demolition, earth fill, piles, precast slab, roof slab, stair,
    ...    wall finishing) are marked "ไม่มีในโครงการนี้". Their sections cost 0 and every page still equals the engine.
    Open Fresh Context
    Start Guest Project    blank    /journey/project-info
    Play Blank Journey    skip_optional=${True}
    ${expected}=    Finished Project Should Match Every Page    expect_state=${EMPTY}
    FOR    ${id}    IN    @{OPTIONAL_LEVELS}
        ${lvl}=    Expected Level    ${expected}    ${id}
        Should Be Equal As Numbers    ${lvl}[total]    0    msg=Skipped level ${id} still costs ${lvl}[total]
        Should Be Equal    ${lvl}[state]    skipped
    END


*** Keywords ***
Play Blank Journey
    [Documentation]    Visit the 37 levels in the order the app leads through them (confirm goes to the engine's next
    ...    open step); type each one's plan (or skip it when optional and ``${skip_optional}``), check the totals
    ...    against the engine and confirm. Every level is visited once.
    [Arguments]    ${skip_optional}
    ${ids}=    Level Ids
    Length Should Be    ${ids}    37
    ${visited}=    Create List
    Go To Level    project-info
    FOR    ${i}    IN RANGE    37
        Wait For Elements State    ${CONFIRM_BUTTON}    visible    timeout=60s
        ${id}=    Current Level Id
        Append To List    ${visited}    ${id}
        ${path}=    Landing Path After Confirm    ${id}
        IF    ${skip_optional} and $id in $OPTIONAL_LEVELS
            Skip Level
            Wait Until Keyword Succeeds    10s    500ms    Level Mark Should Be    ${id}    skipped
        ELSE
            Run Keyword    ${FILL_FROM_PLAN}[${id}]
            IF    '${id}' != 'project-info'
                Wait Until Keyword Succeeds    15s    500ms    Level Totals Should Match Engine    ${id}
            END
            Click    ${CONFIRM_BUTTON}
            Wait Until Keyword Succeeds    15s    500ms    Level Mark Should Be    ${id}    done
        END
        Wait For Condition    Url    should end with    ${path}    timeout=30s
    END
    Get Url    should end with    /journey
    Lists Should Be Equal    ${{ sorted($visited) }}    ${{ sorted($ids) }}    msg=Not every level was visited exactly once

Finished Project Should Match Every Page
    [Documentation]    Every level passed (``${expect_state}`` = done for all, or empty to accept done or skipped), then the
    ...    BOQ, Man-Day, Schedule and Cash Flow pages equal the engine. Returns the engine result.
    [Arguments]    ${expect_state}
    ${project}=    Read Guest Project
    ${expected}=    Compute Expected    ${project}
    FOR    ${lvl}    IN    @{expected}[levels]
        IF    '${expect_state}' != '${EMPTY}'
            Should Be Equal    ${lvl}[state]    ${expect_state}    msg=Level ${lvl}[id] is ${lvl}[state]
        ELSE
            Should Contain    ${{ ['done', 'skipped'] }}    ${lvl}[state]    msg=Level ${lvl}[id] is ${lvl}[state]
        END
    END
    Should Be True    ${expected}[constructionTotal] > 0
    Go To Path    /boq
    Boq Should Match Stored Project
    Page Should Not Show Broken Numbers
    Go To Path    /man-day
    Man Day Page Should Match Engine
    Go To Path    /schedule
    Schedule Page Should Match Engine
    Go To Path    /cashflow
    Cash Flow Page Should Match Engine
    RETURN    ${expected}
