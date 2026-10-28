*** Settings ***
Documentation       W4 / persistence, resilience, responsive layout and console errors.
...                 Persistence: the guest project lives in localStorage ``contrack-project`` (src/store/project-store.ts):
...                 a reload keeps it, hostile / corrupted values must not crash the app, two tabs of one browser context are
...                 last-write-wins. Responsive: a 390x844 phone has no horizontal page scroll and keeps its main actions in view.
Resource            ../../resources/pages/boq_planning.resource
Suite Setup         Setup W4 Suite
Test Teardown       Close Test Context
Test Tags           persistence    w4


*** Variables ***
@{MAIN_PAGES}           /journey    /boq    /man-day    /schedule    /cashflow    /calc/footing
@{PHONE_PAGES}          /journey    /journey/land-inspection    /boq    /man-day    /schedule    /cashflow    /calc/footing
${CONFIRM_ANY}          css=button:has-text("ยืนยัน แล้วไปขั้นตอน"), button:has-text("ยืนยันและเสร็จสิ้น")
${BOQ_READY}            css=[data-boq-row="R19"]
${WIDE_JSON}            {"state":{"project":{"schemaVersion":1,"meta":{"projectName":"x"}}},"version":1}


*** Test Cases ***
Reload Keeps The Project On Every Main Page
    [Documentation]    Journey, BOQ, Man-Day, Schedule, Cash Flow and a calculator: after a reload the saved project is
    ...    identical to the one before and the page renders.
    [Tags]    smoke
    Open Project Page    /boq
    Set Boq Cell    R19    qty    6
    Stored Override Should Be    R19    qty    6
    ${before}=    Read Guest Project
    FOR    ${path}    IN    @{MAIN_PAGES}
        Go To Path    ${path}
        Reload
        Wait For Load State    networkidle    timeout=60s
        Page Should Have No Error Overlay
        ${after}=    Read Guest Project
        Should Be Equal    ${after}    ${before}    msg=Project changed after a reload of ${path}
    END
    Go To Path    /boq
    Boq Cell Should Show    R19    qty    6

Loading A Page Does Not Rewrite The Stored Project
    [Documentation]    Opening pages must not modify what is stored (no accidental defaults written back).
    ${expected}=    Open Project Page    /journey
    ${before}=    Read Guest Project
    FOR    ${path}    IN    /boq    /man-day    /schedule    /cashflow
        Go To Path    ${path}
    END
    ${after}=    Read Guest Project
    Should Be Equal    ${after}    ${before}

Reload On The Planning Pages Keeps Planning Edits
    [Documentation]    Expected behaviour: Reload On The Planning Pages Keeps Planning Edits.
    Open Project Page    /man-day
    Set Man Day Days    งานฐานราก    22
    Go To Path    /schedule
    Set Task Duration    งานก่ออิฐ    30
    Go To Path    /cashflow
    Fill Number By Label    ตัวคูณราคาเสนอ    1.4
    Wait Until Keyword Succeeds    10s    250ms    Cash Flow Match Attempt
    ${before}=    Read Guest Project
    Reload
    Wait For Elements State    css=input[aria-label="ตัวคูณราคาเสนอ"]    visible
    ${after}=    Read Guest Project
    Should Be Equal    ${after}    ${before}
    Go To Path    /man-day
    Man Day Page Should Match Engine
    Go To Path    /schedule
    Schedule Page Should Match Engine

Corrupted JSON In Storage Still Opens The BOQ Page
    [Documentation]    localStorage["contrack-project"] = "{not json": the app must open (fresh project or a message), never hang
    ...    on the spinner and never show a crash.
    [Tags]    edge    negative    resilience
    Open Fresh Context    /journey
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    {not json
    Go To    ${BASE_URL}/boq
    Wait For Elements State    ${GRAND_TOTAL}    visible    timeout=30s
    Page Should Have No Error Overlay
    Page Should Not Show Broken Numbers

Corrupted JSON In Storage Still Opens The Journey Map
    [Documentation]    Expected behaviour: Corrupted JSON In Storage Still Opens The Journey Map.
    [Tags]    edge    negative    resilience
    Open Fresh Context    /journey
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    {"state": {"project":
    Go To    ${BASE_URL}/journey
    Wait For Elements State    css=h1    visible    timeout=30s
    Page Should Have No Error Overlay

Corrupted Storage Does Not Block A Fresh Start
    [Documentation]    After a corrupted value the user can still start a project and edit; the next reload keeps the edit.
    [Tags]    edge    negative    resilience
    Open Fresh Context    /journey
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    ][ definitely not json
    Go To    ${BASE_URL}/journey
    Wait For Elements State    ${NEW_PROJECT_BUTTON}    visible    timeout=30s
    Click    ${NEW_PROJECT_BUTTON}
    Click    css=.ant-modal button:has-text("ทดลองกับบ้านตัวอย่าง")
    Wait For Condition    Url    should end with    /journey/project-info    timeout=30s
    ${project}=    Wait Until Keyword Succeeds    10s    250ms    Read Guest Project
    Should Be Equal    ${project}[start]    sample

Empty String In Storage Opens The App
    [Documentation]    Expected behaviour: Empty String In Storage Opens The App.
    [Tags]    edge    negative    resilience
    Open Fresh Context    /journey
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    ${EMPTY}
    Go To    ${BASE_URL}/boq
    Wait For Elements State    ${GRAND_TOTAL}    visible    timeout=30s
    Page Should Have No Error Overlay

JSON Null In Storage Opens The App
    [Documentation]    Expected behaviour: JSON Null In Storage Opens The App.
    [Tags]    edge    negative    resilience
    Open Fresh Context    /journey
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    null
    Go To    ${BASE_URL}/boq
    Wait For Elements State    ${GRAND_TOTAL}    visible    timeout=30s
    Page Should Have No Error Overlay

Wrong Schema Version In Storage Starts Fresh
    [Documentation]    version 99 is not understood: a fresh project, not a crash.
    [Tags]    edge    negative    resilience
    Open Fresh Context    /journey
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    {"state":{"project":{"schemaVersion":99}},"version":99}
    Go To    ${BASE_URL}/boq
    Wait For Elements State    ${GRAND_TOTAL}    visible    timeout=30s
    Page Should Have No Error Overlay
    Page Should Not Show Broken Numbers

State Without A Project In Storage Starts Fresh
    [Documentation]    Expected behaviour: State Without A Project In Storage Starts Fresh.
    [Tags]    edge    negative    resilience
    Open Fresh Context    /journey
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    {"state":{},"version":1}
    Go To    ${BASE_URL}/boq
    Wait For Elements State    ${GRAND_TOTAL}    visible    timeout=30s
    Page Should Have No Error Overlay

Project Without Meta In Storage Does Not Crash
    [Documentation]    A project object that lacks most fields (hand-edited storage): the BOQ must still render numbers.
    [Tags]    edge    negative    resilience
    Open Fresh Context    /journey
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    ${WIDE_JSON}
    Go To    ${BASE_URL}/boq
    Wait For Elements State    ${GRAND_TOTAL}    visible    timeout=30s
    Page Should Have No Error Overlay
    Page Should Not Show Broken Numbers

Text In A Stored Override Does Not Produce NaN
    [Documentation]    boqOverrides.R19.qty = "abc" written by hand: the page must not print NaN.
    [Tags]    edge    negative    resilience
    ${project}=    Sample Project With Journey
    VAR    &{overrides}    R19=${{ {'qty': 'abc'} }}
    Set To Dictionary    ${project}    boqOverrides=${overrides}
    Open Fresh Context    /journey
    Seed Guest Project    ${project}    /boq
    Wait For Elements State    ${GRAND_TOTAL}    visible    timeout=30s
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Override Of An Unknown Row Is Ignored
    [Documentation]    Expected behaviour: Override Of An Unknown Row Is Ignored.
    [Tags]    edge    resilience
    ${project}=    Sample Project With Journey
    VAR    &{overrides}    R99999=${{ {'qty': 5} }}
    Set To Dictionary    ${project}    boqOverrides=${overrides}
    ${expected}=    Open Project Object Page    /boq    ${project}
    Boq Totals Should Match Engine    ${expected}
    ${sample}=    Cached Start Project    sample
    Should Be Equal As Numbers    ${expected}[constructionTotal]    ${sample}[constructionTotal]

Unknown Journey Mark In Storage Does Not Break The Map
    [Documentation]    Expected behaviour: Unknown Journey Mark In Storage Does Not Break The Map.
    [Tags]    edge    negative    resilience
    ${project}=    Sample Project With Journey    project-info=bogus
    Open Fresh Context    /journey
    Seed Guest Project    ${project}    /journey
    Wait For Elements State    css=h1    visible    timeout=30s
    Page Should Have No Error Overlay

Cleared Storage Then Reload Starts A Fresh Project
    [Documentation]    localStorage cleared while the page is open: the next load is a fresh project and nothing crashes.
    [Tags]    edge    resilience
    Open Project Page    /boq
    LocalStorage Clear
    Reload
    Wait For Elements State    ${GRAND_TOTAL}    visible    timeout=30s
    Page Should Have No Error Overlay
    Page Should Not Show Broken Numbers

Second Tab Sees What The First Tab Saved
    [Documentation]    Same browser context, two tabs: a tab opened after an edit shows the edit.
    Open Project Page    /boq
    Set Boq Cell    R19    qty    6
    Stored Override Should Be    R19    qty    6
    New Page    ${BASE_URL}/boq
    Wait For Elements State    ${BOQ_READY}    visible    timeout=60s
    Boq Cell Should Show    R19    qty    6
    Boq Should Match Stored Project

Two Tabs Editing The Same Cell Last Write Wins
    [Documentation]    Tab A types 6, tab B (opened before) types 7: the storage ends with 7, a reload of A shows 7, no page errors.
    [Tags]    edge
    Open Project Page    /boq
    ${ids}=    Get Page Ids
    ${tab_b}=    New Page    ${BASE_URL}/boq
    Wait For Elements State    ${BOQ_READY}    visible    timeout=60s
    Switch Page    ${ids}[0]
    Set Boq Cell    R19    qty    6
    Stored Override Should Be    R19    qty    6
    Switch Page    ${tab_b}
    Set Boq Cell    R19    qty    7
    Stored Override Should Be    R19    qty    7
    Switch Page    ${ids}[0]
    Reload
    Wait For Elements State    ${BOQ_READY}    visible    timeout=60s
    Boq Cell Should Show    R19    qty    7
    Boq Should Match Stored Project
    ${errors}=    Get Page Errors    full=True
    Should Be Empty    ${errors}

Two Tabs Editing Different Cells Keep A Valid Project
    [Documentation]    Tab A edits R19, tab B (loaded before) edits R35. Whatever wins, the stored project is valid, B's edit
    ...    is in it, and a fresh load of the BOQ equals the engine. (A zustand store has no cross-tab merge: A's edit may be lost.)
    [Tags]    edge
    Open Project Page    /boq
    ${ids}=    Get Page Ids
    ${tab_b}=    New Page    ${BASE_URL}/boq
    Wait For Elements State    ${BOQ_READY}    visible    timeout=60s
    Switch Page    ${ids}[0]
    Set Boq Cell    R19    qty    6
    Stored Override Should Be    R19    qty    6
    Switch Page    ${tab_b}
    Set Boq Cell    R35    lab    2600
    Stored Override Should Be    R35    lab    2600
    Reload
    Wait For Elements State    ${BOQ_READY}    visible    timeout=60s
    Boq Cell Should Show    R35    lab    2600
    Boq Should Match Stored Project
    Page Should Not Show Broken Numbers

Back And Forward Between Pages Keep The Data
    [Documentation]    BOQ -> Man-Day -> Schedule via the menu, then back twice and forward once.
    [Tags]    edge
    Open Project Page    /boq
    Set Boq Cell    R19    qty    6
    Stored Override Should Be    R19    qty    6
    Click    css=.ant-menu-item:has-text("วางแผนคน-วัน")
    Wait For Condition    Url    should end with    /man-day    timeout=30s
    Click    css=.ant-menu-item:has-text("แผนเวลา")
    Wait For Condition    Url    should end with    /schedule    timeout=30s
    Go Back
    Wait For Condition    Url    should end with    /man-day    timeout=30s
    Go Back
    Wait For Condition    Url    should end with    /boq    timeout=30s
    Wait For Elements State    ${BOQ_READY}    visible
    Boq Cell Should Show    R19    qty    6
    Go Forward
    Wait For Condition    Url    should end with    /man-day    timeout=30s
    Man Day Page Should Match Engine

Phone Journey Level Has No Horizontal Scroll And Shows Confirm
    [Documentation]    390x844: no sideways page scroll on a journey level; the confirm button and the overview button are visible
    ...    inside the screen width.
    [Tags]    responsive    smoke
    Open Project Page    /journey/land-inspection    unlock_until=land-inspection    viewport_width=390    viewport_height=844
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    Page Should Not Scroll Sideways
    Element Should Fit The Screen    ${CONFIRM_ANY}    390
    Element Should Fit The Screen    css=button[aria-label="ภาพรวมขั้นตอน"]    390

Phone BOQ Has No Horizontal Scroll And Shows Its Actions
    [Documentation]    Expected behaviour: Phone BOQ Has No Horizontal Scroll And Shows Its Actions.
    [Tags]    responsive    smoke
    Open Project Page    /boq    viewport_width=390    viewport_height=844
    Wait For Elements State    ${BOQ_READY}    attached    timeout=60s
    Page Should Not Scroll Sideways
    Element Should Fit The Screen    ${EXCEL_BUTTON}    390
    Element Should Fit The Screen    ${PRINT_BUTTON}    390
    Element Should Fit The Screen    ${GRAND_TOTAL}    390
    Element Should Fit The Screen    css=button[aria-label="เมนู"]    390

Phone Schedule Has No Horizontal Scroll And Shows Its Controls
    [Documentation]    Expected behaviour: Phone Schedule Has No Horizontal Scroll And Shows Its Controls.
    [Tags]    responsive    smoke
    Open Project Page    /schedule    viewport_width=390    viewport_height=844
    Wait For Elements State    ${SCURVE_TOGGLE}    visible    timeout=60s
    Page Should Not Scroll Sideways
    Element Should Fit The Screen    css=input[aria-label="วันที่โครงการเริ่ม"]    390
    Element Should Fit The Screen    ${SCURVE_TOGGLE}    390
    Element Should Fit The Screen    ${PACE_GAUGE}    390

Phone Journey Map Has No Horizontal Scroll
    [Documentation]    Expected behaviour: Phone Journey Map Has No Horizontal Scroll.
    [Tags]    responsive
    Open Project Page    /journey    start=blank    viewport_width=390    viewport_height=844
    Wait For Elements State    ${NEW_PROJECT_BUTTON}    visible    timeout=60s
    Page Should Not Scroll Sideways
    Element Should Fit The Screen    ${NEW_PROJECT_BUTTON}    390
    Element Should Fit The Screen    css=a[href="/journey/project-info"] button    390

Phone Man Day Has No Horizontal Scroll
    [Documentation]    Expected behaviour: Phone Man Day Has No Horizontal Scroll.
    [Tags]    responsive
    Open Project Page    /man-day    viewport_width=390    viewport_height=844
    Wait For Elements State    css=input[aria-label="งานฐานราก วันประเมิน"]    attached    timeout=60s
    Page Should Not Scroll Sideways

Phone Cash Flow Has No Horizontal Scroll
    [Documentation]    Expected behaviour: Phone Cash Flow Has No Horizontal Scroll.
    [Tags]    responsive
    Open Project Page    /cashflow    viewport_width=390    viewport_height=844
    Wait For Elements State    css=input[aria-label="ตัวคูณราคาเสนอ"]    visible    timeout=60s
    Page Should Not Scroll Sideways
    Element Should Fit The Screen    css=input[aria-label="ตัวคูณราคาเสนอ"]    390

Phone Calculator Page Has No Horizontal Scroll
    [Documentation]    Expected behaviour: Phone Calculator Page Has No Horizontal Scroll.
    [Tags]    responsive
    Open Project Page    /calc/footing    viewport_width=390    viewport_height=844
    Wait For Elements State    css=input[aria-label="count 1"]    attached    timeout=60s
    Page Should Not Scroll Sideways

Phone Journey Level With Money Has No Horizontal Scroll
    [Documentation]    A level with a table (footing rows) on a phone: the table may scroll inside its card, the page may not.
    [Tags]    responsive    edge
    Open Project Page    /journey/footing    unlock_until=footing    viewport_width=390    viewport_height=844
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    Page Should Not Scroll Sideways

Phone Menu Button Opens The Drawer And Navigates
    [Documentation]    Below xl the menu lives in a drawer: "เมนู" opens it; choosing "แผนเวลา" opens /schedule.
    [Tags]    responsive
    Open Project Page    /boq    viewport_width=390    viewport_height=844
    Click    css=button[aria-label="เมนู"]
    Wait For Elements State    css=.ant-drawer .ant-menu-item:has-text("แผนเวลา")    visible
    Click    css=.ant-drawer .ant-menu-item:has-text("แผนเวลา")
    Wait For Condition    Url    should end with    /schedule    timeout=30s
    Page Should Not Scroll Sideways

Phone New Project Modal Fits The Screen
    [Documentation]    Expected behaviour: Phone New Project Modal Fits The Screen.
    [Tags]    responsive    new-project
    Open Project Page    /journey    viewport_width=390    viewport_height=844
    Click    ${NEW_PROJECT_BUTTON}
    Wait For Elements State    css=.ant-modal    visible
    Page Should Not Scroll Sideways
    Element Should Fit The Screen    css=.ant-modal-content    390
    Element Should Fit The Screen    css=.ant-modal button:has-text("เริ่มจากแบบแปลนของฉัน")    390

Tablet Pages Have No Horizontal Scroll
    [Documentation]    768x1024: BOQ, Schedule, Cash Flow and the map keep the page inside the screen width.
    [Tags]    responsive
    Open Project Page    /boq    viewport_width=768    viewport_height=1024
    Wait For Elements State    ${BOQ_READY}    attached    timeout=60s
    Page Should Not Scroll Sideways
    FOR    ${path}    IN    /schedule    /cashflow    /journey
        Go To Path    ${path}
        Page Should Not Scroll Sideways
    END

Phone Blank Project Pages Have No Horizontal Scroll
    [Documentation]    Expected behaviour: Phone Blank Project Pages Have No Horizontal Scroll.
    [Tags]    responsive    edge
    Open Project Page    /boq    start=blank    viewport_width=390    viewport_height=844
    FOR    ${path}    IN    /boq    /man-day    /schedule    /cashflow    /journey
        Go To Path    ${path}
        Page Should Not Scroll Sideways
    END

No Console Errors On The Journey Map
    [Documentation]    Ignored (Next dev noise): React DevTools hint, Fast Refresh / HMR, hot-update, favicon.
    [Tags]    console
    Open Project Page    /journey    unlock_until=footing
    Wait For Elements State    css=h1    visible
    Console Should Have No Errors

No Console Errors On A Journey Level
    [Documentation]    Expected behaviour: No Console Errors On A Journey Level.
    [Tags]    console
    Open Project Page    /journey/land-inspection    unlock_until=land-inspection
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    Console Should Have No Errors

No Console Errors On The BOQ Page
    [Documentation]    Expected behaviour: No Console Errors On The BOQ Page.
    [Tags]    console    smoke
    Open Project Page    /boq
    Wait For Elements State    ${BOQ_READY}    visible    timeout=60s
    Console Should Have No Errors

No Console Errors After Editing On The BOQ Page
    [Documentation]    Expected behaviour: No Console Errors After Editing On The BOQ Page.
    [Tags]    console
    Open Project Page    /boq
    Set Boq Cell    R19    qty    6
    Set Boq Cell    R19    qty    abc
    Set Boq Cell    R19    qty    ${EMPTY}
    Console Should Have No Errors

No Console Errors On A Blank Project
    [Documentation]    Expected behaviour: No Console Errors On A Blank Project.
    [Tags]    console    edge
    Open Project Page    /boq    start=blank
    Wait For Elements State    ${BOQ_READY}    visible    timeout=60s
    Go To Path    /schedule
    Go To Path    /cashflow
    Go To Path    /man-day
    Console Should Have No Errors

No Console Errors When Storage Is Corrupted
    [Documentation]    Expected behaviour: No Console Errors When Storage Is Corrupted.
    [Tags]    console    edge    resilience
    Open Fresh Context    /journey
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    {not json
    Go To    ${BASE_URL}/boq
    Wait For Elements State    ${GRAND_TOTAL}    visible    timeout=30s
    Console Should Have No Errors


*** Keywords ***
Element Should Fit The Screen
    [Documentation]    The element's box lies inside ``0 .. ${width}`` px horizontally (not cut off at the right).
    [Arguments]    ${selector}    ${width}
    Scroll To Element    ${selector}
    ${box}=    Get BoundingBox    ${selector}
    Should Be True    ${box}[x] >= -0.5    msg=${selector} starts left of the screen (x=${box}[x])
    ${right}=    Evaluate    $box['x'] + $box['width']
    Should Be True    ${right} <= ${width} + 0.5    msg=${selector} ends at ${right}px, screen is ${width}px wide
