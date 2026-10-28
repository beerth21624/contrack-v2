*** Settings ***
Documentation       Play the whole guided journey, all 37 levels, end to end in the browser.
...                 1) The Excel v5 sample house: every level already satisfies its requirements, so each one is
...                 confirmed in order; at every level the level total and the construction total equal the engine,
...                 and the finished project totals 1,855,162 baht (app sample; Excel M310 1,850,317.34 differs by the
...                 documented KNOWN_DELTAS of src/domain/__tests__/project-golden.test.ts).
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
    [Documentation]    Start "ทดลองกับบ้านตัวอย่าง", confirm level by level from ข้อมูลโครงการ to งานเบ็ดเตล็ด.
    ...    Each step: the page opens unlocked, totals equal the engine, confirm moves to the next level and
    ...    stores "done". At the end every level is done and the construction total is the sample total.
    [Tags]    smoke
    Open Fresh Context
    ${expected}=    Start Guest Project    sample    /journey/project-info
    ${ids}=    Level Ids
    Length Should Be    ${ids}    37
    ${count}=    Get Length    ${ids}
    FOR    ${i}    IN RANGE    ${count}
        ${id}=    Set Variable    ${ids}[${i}]
        Get Url    should end with    /journey/${id}
        Wait For Elements State    ${CONFIRM_BUTTON}    visible    timeout=60s
        Page Should Have No Error Overlay
        IF    '${id}' != 'project-info'
            ${lvl}=    Expected Level    ${expected}    ${id}
            Level Total Should Be    ${lvl}[total]
        END
        Construction Total Should Be    ${expected}[constructionTotal]
        ${next}=    Evaluate    $ids[$i + 1] if $i + 1 < len($ids) else ''
        Confirm Level    ${next}
        Level Mark Should Be    ${id}    done
    END
    ${project}=    Read Guest Project
    ${final}=    Compute Expected    ${project}
    Numbers Should Be Close    ${final}[constructionTotal]    ${SAMPLE_TOTAL}    1
    FOR    ${lvl}    IN    @{final}[levels]
        Should Be Equal    ${lvl}[state]    done    msg=Level ${lvl}[id] is ${lvl}[state] after the full run
    END

Sample House Journey Survives A Reload In The Middle
    [Documentation]    Confirm the first 10 levels, reload, and continue: progress and totals are unchanged.
    Open Fresh Context
    ${expected}=    Start Guest Project    sample    /journey/project-info
    ${ids}=    Level Ids
    FOR    ${i}    IN RANGE    10
        Confirm Level    ${{ $ids[$i + 1] }}
    END
    Reload
    Wait For Elements State    ${CONFIRM_BUTTON}    visible    timeout=60s
    Get Url    should end with    /journey/${ids}[10]
    FOR    ${i}    IN RANGE    10
        Level Mark Should Be    ${ids}[${i}]    done
    END
    Construction Total Should Be    ${expected}[constructionTotal]

Blank Plan Filled Through All 37 Levels Then BOQ And Planning
    [Documentation]    Business flow: "เริ่มจากแบบแปลนของฉัน", every level typed from the test house's plan through the
    ...    UI and confirmed in journey order. At each level the level total and the construction total equal the engine
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
    [Documentation]    Visit the 37 levels in journey order; type each one's plan (or skip it when optional and
    ...    ``${skip_optional}``), check the totals against the engine and confirm.
    [Arguments]    ${skip_optional}
    ${ids}=    Level Ids
    Length Should Be    ${ids}    37
    FOR    ${id}    IN    @{ids}
        Go To Level    ${id}
        Wait For Elements State    ${CONFIRM_BUTTON}    visible    timeout=60s
        IF    ${skip_optional} and $id in $OPTIONAL_LEVELS
            Skip Level
            Wait Until Keyword Succeeds    10s    500ms    Level Mark Should Be    ${id}    skipped
            CONTINUE
        END
        Run Keyword    ${FILL_FROM_PLAN}[${id}]
        IF    '${id}' != 'project-info'
            Wait Until Keyword Succeeds    15s    500ms    Level Totals Should Match Engine    ${id}
        END
        Click    ${CONFIRM_BUTTON}
        Wait Until Keyword Succeeds    15s    500ms    Level Mark Should Be    ${id}    done
    END

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
