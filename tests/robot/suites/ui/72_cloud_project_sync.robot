*** Settings ***
Documentation       Editing a cloud project in the browser (W5): every change is saved to PostgreSQL by the sync engine
...                 (``project_docs`` version goes up, the document holds the typed value), the totals on screen equal
...                 the BOQ engine for what the database holds, a reload shows the edit, and the browser's guest
...                 project is never mixed in. Saving is asynchronous, so the database is polled
...                 (``Wait Until Doc Satisfies``), never read after a fixed sleep.
Resource            ../../resources/pages/cloud.resource
Suite Setup         Open Cloud Suite
Test Teardown       Close All Contexts
Test Tags           sync    cloud


*** Variables ***
${LAYOUT_DOC}       calc:layout
${SAVED_TEXT}       บันทึกแล้ว


*** Test Cases ***
Filling A Level Saves The Value To The Database
    [Documentation]    Type "จำนวนจุดวางผัง" = 12 and "จำนวนหมุด" = 8 on the layout level of a blank cloud project:
    ...    ``calc:layout`` appears in ``project_docs`` with both values and the bar says "บันทึกแล้ว".
    [Tags]    smoke    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    Fill Number By Label    จำนวนจุดวางผัง    12
    Fill Number By Label    จำนวนหมุด    8
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['points'] == 12 and data['stakes'] == 8
    Wait For Elements State    ${PROJECT_BADGE} >> text=${SAVED_TEXT}    visible    timeout=30s
    ${row}=    Project Doc Row    ${ctx}[id]    ${LAYOUT_DOC}
    Should Be True    ${row}[version] >= 1
    Should Be Equal As Strings    ${row}[updated_by]    ${ctx}[user][id]

Every Further Edit Raises The Document Version
    [Tags]    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    Fill Number By Label    จำนวนจุดวางผัง    5
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['points'] == 5
    ${v1}=    Doc Version    ${ctx}[id]    ${LAYOUT_DOC}
    Fill Number By Label    จำนวนจุดวางผัง    6
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['points'] == 6
    Doc Version Should Be Above    ${ctx}[id]    ${LAYOUT_DOC}    ${v1}
    Fill Number By Label    จำนวนจุดวางผัง    7
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['points'] == 7
    Doc Version Should Be Above    ${ctx}[id]    ${LAYOUT_DOC}    ${v1}

Level And Construction Totals Equal The Engine For The Saved Project
    [Documentation]    land-inspection: change the first "จำนวน" (labour days). After the save, "มูลค่าขั้นตอนนี้" and
    ...    "ราคาค่าก่อสร้างรวม" equal the engine computed from the stored documents.
    [Tags]    smoke    db
    ${ctx}=    Open Cloud Project Level    land-inspection    land-inspection
    Fill Number By Label    จำนวน    5    0
    Wait Until Keyword Succeeds    90s    500ms    Stored Project Should Differ From Blank    ${ctx}[id]
    ${expected}=    Expected For Cloud Project    ${ctx}[id]    blank
    ${lvl}=    Expected Level    ${expected}    land-inspection
    Level Total Should Be    ${lvl}[total]
    Construction Total Should Be    ${expected}[constructionTotal]
    ${row}=    Project Row By Name    ${ctx}[ws]    ${ctx}[name]
    Numbers Should Be Close    ${row}[summary][constructionTotal]    ${expected}[constructionTotal]    1

A Saved Edit Is Still There After A Reload
    [Tags]    smoke    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    Fill Number By Label    จำนวนจุดวางผัง    14
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['points'] == 14
    Reload Cloud Page
    Wait For Elements State    ${LEVEL_MAP_BUTTON}    visible    timeout=60s
    Wait For Elements State    ${PROJECT_BADGE} >> text=${SAVED_TEXT}    visible    timeout=30s
    Get Property    ${{ 'css=[aria-label="จำนวนจุดวางผัง"]' }}    value    ==    14

The Same User On Another Browser Sees The Saved Edit
    [Documentation]    A second context (another device) signs in, opens the project and reads the value from the cloud.
    [Tags]    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    Fill Number By Label    จำนวนหมุด    9
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['stakes'] == 9
    ${second}=    Open Context As    ${ctx}[user][email]    ${ctx}[user][password]
    Open Project From List    ${ctx}[name]
    Go To Level Of Cloud Project    layout
    Get Property    css=[aria-label="จำนวนหมุด"]    value    ==    9

An Edit Reaches A Second Open Browser Without Reloading
    [Documentation]    Realtime: the same project open in two contexts; typing in the first shows in the second.
    [Tags]    edge
    ${ctx}=    Open Cloud Project Level    layout    layout
    ${first}=    Get Context Ids
    ${second}=    Open Context As    ${ctx}[user][email]    ${ctx}[user][password]
    Open Project From List    ${ctx}[name]
    Go To Level Of Cloud Project    layout
    Switch Context    ${first}[0]
    Fill Number By Label    จำนวนจุดวางผัง    31
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['points'] == 31
    Switch Context    ${second}
    Wait Until Keyword Succeeds    90s    1s    Input Value Should Be    จำนวนจุดวางผัง    31

Guest Data Is Not Mixed Into The Cloud Project
    [Documentation]    The browser holds a local project with layout points = 77. The blank cloud project must show
    ...    its own (empty) values, store nothing of the local data, and leave localStorage untouched.
    [Tags]    security    db
    ${user}=    Register User Via API    mix
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการคลาวด์แยก
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Unlock Levels Via API    ${user}    ${created}[project][id]    layout
    Open Signed In Context    ${user}[email]    ${user}[password]    /journey
    ${expected}=    Compute Expected For New Project    blank
    ${local}=    Project With Levels Done    ${expected}[project]    layout
    # A calculator holds only the fields that were typed; the rest comes from its defaults.
    Evaluate    $local['calculators'].update({'layout': {'points': 77, 'stakes': 66}})
    Seed Guest Project    ${local}    /projects
    Projects Page Should Be Loaded
    ${before}=    Read Guest Project
    Open Project From List    ${name}
    Go To Level Of Cloud Project    layout
    Get Property    css=[aria-label="จำนวนจุดวางผัง"]    value    !=    77
    Get Property    css=[aria-label="จำนวนหมุด"]    value    !=    66
    Fill Number By Label    จำนวนจุดวางผัง    3
    Wait Until Doc Satisfies    ${created}[project][id]    ${LAYOUT_DOC}    data['points'] == 3 and data['stakes'] != 66
    ${after}=    Read Guest Project
    Should Be Equal    ${after}    ${before}    msg=editing the cloud project changed the local project

Cloud Project Values Do Not Leak Into The Local Project After Switching Back
    [Documentation]    "กลับไปโครงการในเครื่องนี้" shows the local project, without the cloud edit.
    [Tags]    security    edge
    ${ctx}=    Open Cloud Project Level    layout    layout
    Fill Number By Label    จำนวนจุดวางผัง    41
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['points'] == 41
    Click    ${PROJECT_BADGE}
    Click    ${OPEN_DROPDOWN} >> css=li >> text="กลับไปโครงการในเครื่องนี้"
    Wait For Condition    Url    should end with    /journey    timeout=90s
    Wait For Elements State    ${PROJECT_BADGE}    detached    timeout=30s
    ${local}=    Read Guest Project
    ${points}=    Evaluate    $local['calculators'].get('layout', {}).get('points')
    # A local project that never edited the layout holds no value of it at all.
    Should Be True    $points is None or float($points) != 41

Editing The Project Name Level Saves The Meta Document
    [Tags]    db
    ${ctx}=    Open Cloud Project Level    project-info    project-info
    Fill Text By Label    สถานที่ก่อสร้าง    ลำลูกกา คลอง 13
    Wait Until Doc Satisfies    ${ctx}[id]    meta    data['siteAddress'] == 'ลำลูกกา คลอง 13'
    Reload Cloud Page
    Wait For Elements State    ${PROJECT_BADGE} >> text=${SAVED_TEXT}    visible    timeout=60s
    Get Text    css=[aria-label="สถานที่ก่อสร้าง"]    ==    ลำลูกกา คลอง 13

Confirming A Level Marks It Done In The Journey Document
    [Documentation]    Confirm "วางผัง" -> ``journey`` holds layout=done; the projects page card says one more step.
    [Tags]    smoke    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    ${before}=    Doc Data    ${ctx}[id]    journey
    ${n}=    Get Length    ${before}
    Fill Number By Label    จำนวนจุดวางผัง    10
    Fill Number By Label    จำนวนหมุด    10
    Click    ${CONFIRM_BUTTON}
    Wait For Condition    Url    should end with    /journey/piles    timeout=90s
    Wait Until Doc Satisfies    ${ctx}[id]    journey    data.get('layout') == 'done'
    Open Projects Page
    ${card}=    Project Card    ${ctx}[name]
    ${expected_count}=    Evaluate    ${n} + 1
    Get Text    ${card}    contains    ${expected_count}/37 ขั้นตอน

Skipping An Optional Level Stores It As Skipped
    [Tags]    db
    ${ctx}=    Open Cloud Project Level    demolition    demolition
    Skip Level
    Wait Until Doc Satisfies    ${ctx}[id]    journey    data.get('demolition') == 'skipped'

Letters Typed Into A Number Cell Are Not Saved
    [Documentation]    Only digits, a dot and a minus are accepted by number cells; nothing reaches the database.
    [Tags]    negative    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    Click    css=[aria-label="จำนวนจุดวางผัง"]
    Keyboard Key    press    a
    Keyboard Key    press    e
    Keyboard Key    press    Backspace
    ${typed}=    Get Property    css=[aria-label="จำนวนจุดวางผัง"]    value
    Should Match Regexp    ${typed}    ^$|^0$
    Page Should Have No Error Overlay
    Row Count Of Doc Should Be    ${ctx}[id]    ${LAYOUT_DOC}    0

A Very Large Number Is Handled Without A Crash
    [Documentation]    Edge: 12 digits. The engine still computes, the page does not crash, and what is stored equals
    ...    what was typed (or the save is refused with a message, never a silent loss).
    [Tags]    edge    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    Fill Number By Label    จำนวนจุดวางผัง    999999999999
    Page Should Have No Error Overlay
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['points'] == 999999999999    timeout=30s

Offline Edit Is Kept And Sent After Reconnecting
    [Documentation]    Go offline, edit: the bar shows it is not saved and the database stays unchanged; back online
    ...    the engine sends it and the bar returns to "บันทึกแล้ว".
    [Tags]    edge    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    Set Offline    ${True}
    Fill Number By Label    จำนวนจุดวางผัง    23
    Wait For Elements State    ${PROJECT_BADGE} >> text=ออฟไลน์    visible    timeout=30s
    Row Count Of Doc Should Be    ${ctx}[id]    ${LAYOUT_DOC}    0
    Set Offline    ${False}
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['points'] == 23    timeout=60s
    Wait For Elements State    ${PROJECT_BADGE} >> text=${SAVED_TEXT}    visible    timeout=60s

Offline Edit Survives A Reload And Is Sent Later
    [Documentation]    The unsent edit is queued in localStorage: reload while offline, go online, it still arrives.
    [Tags]    edge    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    Set Offline    ${True}
    Fill Number By Label    จำนวนหมุด    27
    Wait For Elements State    ${PROJECT_BADGE} >> text=ออฟไลน์    visible    timeout=30s
    ${queued}=    Evaluate JavaScript    ${None}    () => Object.keys(localStorage).filter(k => k.startsWith('contrack-sync:')).length
    Should Be True    ${queued} >= 1    msg=no unsent edit was kept in localStorage
    Set Offline    ${False}
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['stakes'] == 27    timeout=60s

Another Client Changed The Same Document While It Was Open
    [Documentation]    Version conflict: an API client writes ``calc:layout`` while the page is open; the next UI edit
    ...    of the other field must still end up saved (no crash, no lost edit) with both values present.
    [Tags]    edge    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    ${other}=    Login Via API    ${ctx}[user][email]    ${ctx}[user][password]
    ${doc}=    Evaluate    {'points': 5}
    Put Doc Via API    ${other}    ${ctx}[id]    ${LAYOUT_DOC}    ${doc}    ${0}
    Fill Number By Label    จำนวนหมุด    9
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['stakes'] == 9    timeout=60s
    Page Should Have No Error Overlay
    Wait For Elements State    ${PROJECT_BADGE} >> text=${SAVED_TEXT}    visible    timeout=60s

Editing An Archived Project Is Refused And Nothing Is Stored
    [Documentation]    The project is archived by someone else while this page is open. The server refuses the write
    ...    (409), the page must not claim "บันทึกแล้ว" for it, and the database holds no ``calc:layout``.
    [Tags]    negative    edge    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    Archive Project Via API    ${ctx}[user]    ${ctx}[id]
    Fill Number By Label    จำนวนจุดวางผัง    19
    Wait Until Keyword Succeeds    30s    1s    Page Should Not Claim Saved
    Row Count Of Doc Should Be    ${ctx}[id]    ${LAYOUT_DOC}    0

Signing Out With A Cloud Project Open Returns To The Local Project
    [Tags]    edge
    ${ctx}=    Open Cloud Project Level    layout    layout
    Sign Out Via UI
    Wait For Elements State    ${PROJECT_BADGE}    detached    timeout=30s
    Get Text    css=body    contains    โครงการในเครื่องนี้

Project Bar Shows The Cloud Project Name And Saved State
    [Tags]    smoke
    ${ctx}=    Open Cloud Project Level    layout    layout
    Get Text    ${PROJECT_BADGE}    contains    ${ctx}[name]
    Get Text    ${PROJECT_BADGE}    contains    ${SAVED_TEXT}
    Get Attribute    ${PROJECT_BADGE}    title    ==    ${ctx}[name]

Cloud Project Of The Same Name Opens The Same Documents On Every Visit
    [Documentation]    Open, leave to the list, open again: the project and its saved value are unchanged and no
    ...    duplicate project or document row appears.
    [Tags]    edge    db
    ${ctx}=    Open Cloud Project Level    layout    layout
    Fill Number By Label    จำนวนจุดวางผัง    15
    Wait Until Doc Satisfies    ${ctx}[id]    ${LAYOUT_DOC}    data['points'] == 15
    Open Projects Page
    Open Project From List    ${ctx}[name]
    Go To Level Of Cloud Project    layout
    Input Value Should Be    จำนวนจุดวางผัง    15
    Row Count Of Doc Should Be    ${ctx}[id]    ${LAYOUT_DOC}    1
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${ctx}[ws]
    Should Be Equal As Integers    ${n}    1


*** Keywords ***
Archive Project Via API
    [Arguments]    ${user}    ${project_id}
    VAR    &{body}=    archived=${True}
    PATCH On Session    ${user}[alias]    /projects/${project_id}    json=${body}    expected_status=200

Close All Contexts
    [Documentation]    Test teardown: every context of this test goes (cookies and storage never leak to the next one).
    Close Context    ALL    CURRENT

Input Value Should Be
    [Arguments]    ${label}    ${value}
    Get Property    css=[aria-label="${label}"]    value    ==    ${value}

Open Cloud Project Level
    [Documentation]    New user, blank cloud project in the personal workspace with every level before ``${unlock}``
    ...    done; sign in through the form, open the project from its card and the level page.
    ...    Returns ``&{ctx}`` with user, ws, id (project id) and name.
    [Arguments]    ${level}    ${unlock}
    ${user}=    Register User Via API    sync
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการซิงก์
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    blank
    ${id}=    Set Variable    ${created}[project][id]
    Unlock Levels Via API    ${user}    ${id}    ${unlock}
    Open Signed In Context    ${user}[email]    ${user}[password]
    Open Project From List    ${name}
    Go To Level Of Cloud Project    ${level}
    VAR    &{ctx}=    user=${user}    ws=${ws}    id=${id}    name=${name}
    RETURN    ${ctx}

Page Should Not Claim Saved
    ${text}=    Get Text    ${PROJECT_BADGE}
    Should Not Contain    ${text}    ${SAVED_TEXT}    msg=the bar still says saved after a refused write

Row Count Of Doc Should Be
    [Arguments]    ${project_id}    ${doc_key}    ${expected}
    ${rows}=    Query Rows    select 1 from project_docs where project_id = %s and doc_key = %s    ${project_id}    ${doc_key}
    Length Should Be    ${rows}    ${expected}

Stored Project Should Differ From Blank
    [Documentation]    Passes once the ``calc:land-inspection`` document exists in the database.
    [Arguments]    ${project_id}
    ${rows}=    Query Rows    select 1 from project_docs where project_id = %s and doc_key = 'calc:land-inspection'
    ...    ${project_id}
    Should Not Be Empty    ${rows}
