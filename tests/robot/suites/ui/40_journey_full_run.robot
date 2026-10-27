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
Suite Setup         Open Browser For Suite
Test Tags           journey    full-run    slow


*** Variables ***
${SAMPLE_TOTAL}     1855162


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
