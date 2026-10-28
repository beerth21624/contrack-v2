*** Settings ***
Documentation       W4 / journey map ``/journey`` (src/features/journey/JourneyMapPage.tsx) and the new-project modal
...                 (NewProjectButton.tsx). 37 levels in 7 phases (src/domain/journey/levels.ts: 7 + 4 + 7 + 2 + 3 + 8 + 6),
...                 states current / done / skipped / locked and the money of each level equal the engine.
Resource            ../../resources/pages/boq_planning.resource
Suite Setup         Setup W4 Suite
Test Teardown       Close Test Context
Test Tags           journey    w4


*** Variables ***
@{PHASE_TITLES}         เตรียมงาน    ฐานราก    พื้น เสา คาน    หลังคา    ผนัง ประตู หน้าต่าง    งานระบบไฟฟ้า-ประปา    งานตกแต่ง
@{PHASE_SIZES}          ${7}    ${4}    ${7}    ${2}    ${3}    ${8}    ${6}
${PROGRESS_TEXT}        xpath=//span[normalize-space()="ความคืบหน้า"]/following-sibling::span[1]
${MAP_TOTAL}            xpath=//div[normalize-space()="มูลค่าค่าก่อสร้าง"]/following-sibling::div[1]
${MODAL}                css=.ant-modal
${BLANK_CHOICE}         css=.ant-modal button:has-text("เริ่มจากแบบแปลนของฉัน")
${SAMPLE_CHOICE}        css=.ant-modal button:has-text("ทดลองกับบ้านตัวอย่าง")


*** Test Cases ***
Map Lists 37 Levels In 7 Phases
    [Documentation]    Expected behaviour: Map Lists 37 Levels In 7 Phases.
    [Tags]    smoke
    Open Project Page    /journey    start=blank
    Get Element Count    css=section    ==    7
    FOR    ${i}    ${title}    IN ENUMERATE    @{PHASE_TITLES}
        Get Text    css=section >> nth=${i}    contains    ${title}
    END
    Expand All Phases
    Get Element Count    css=ol > li    ==    37
    FOR    ${i}    ${size}    IN ENUMERATE    @{PHASE_SIZES}
        Get Element Count    css=section >> nth=${i} >> css=ol > li    ==    ${size}
    END

Fresh Blank Project Opens Only The Levels Without Prerequisites
    [Documentation]    Nothing is passed yet: the levels the engine calls "current" (no prerequisite left) are open, every other
    ...    level is locked, and each state on the map equals the engine's.
    ${expected}=    Open Project Page    /journey    start=blank
    ${states}=    Level States On Map
    Should Be Equal    ${states}[0]    current
    ${want}=    Evaluate    [l['state'] for l in $expected['levels']]
    Should Be Equal    ${states}    ${want}
    ${locked}=    Evaluate    [s for s in $states if s == 'locked']
    Should Be True    len($locked) > 20
    Map Should Match Engine    ${expected}

Locked Levels Are Not Links
    [Documentation]    A locked row is a plain block carrying the "รอ: …" tooltip and no link; every open level is a link and only
    ...    the main one (the first open level) has a[aria-current=step].
    ${expected}=    Open Project Page    /journey    start=blank
    ${locked}=    Evaluate    sum(1 for l in $expected['levels'] if l['state'] == 'locked')
    ${open}=    Evaluate    37 - $locked
    Get Element Count    css=a[aria-current="step"]    ==    1
    Get Element Count    css=li > div[title]    ==    ${locked}
    Get Element Count    css=li a[href^="/journey/"]    ==    ${open}

First Level Primary Button Starts The Journey
    [Documentation]    Expected behaviour: First Level Primary Button Starts The Journey.
    Open Project Page    /journey    start=blank
    Get Text    css=body    contains    เริ่มต้น
    Click    css=a[href="/journey/project-info"] >> button:has-text("เริ่มขั้นตอนแรก")
    Wait For Condition    Url    should end with    /journey/project-info    timeout=30s
    Page Should Have No Error Overlay

Continue Button Goes To The Current Level
    [Documentation]    Levels before "footing" are done: the primary button says "ทำต่อ" and opens /journey/footing.
    [Tags]    smoke
    ${expected}=    Open Project Page    /journey    unlock_until=footing
    Map Should Match Engine    ${expected}
    Get Text    css=body    contains    ขั้นตอน 9 จาก 37
    Click    css=a[href="/journey/footing"] >> button:has-text("ทำต่อ")
    Wait For Condition    Url    should end with    /journey/footing    timeout=30s
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible

Level States Equal The Engine After Seeding Progress
    [Documentation]    Done / current / locked of all 37 rows after "Project With Levels Done" until the roof structure.
    ${expected}=    Open Project Page    /journey    unlock_until=roof-structure
    Map Should Match Engine    ${expected}
    ${states}=    Level States On Map
    ${done}=    Evaluate    [s for s in $states if s == 'done']
    Length Should Be    ${done}    19

Skipped Levels Show As Not In The Project
    [Documentation]    demolition and fill are skipped: the rows read "ไม่มีในโครงการนี้" and carry no money.
    ${project}=    Sample Project With Journey    project-info=done    land-inspection=done    demolition=skipped    fill=skipped
    ${expected}=    Open Project Object Page    /journey    ${project}
    Map Should Match Engine    ${expected}
    ${states}=    Level States On Map
    Should Be Equal    ${states}[2]    skipped
    Should Be Equal    ${states}[3]    skipped
    Should Be Equal    ${states}[4]    current

Money Of Every Finished Level Equals The Engine
    [Documentation]    36 levels done, the last is current: each finished priced level shows its whole-baht total.
    ${expected}=    Open Project Page    /journey    unlock_until=misc
    Map Should Match Engine    ${expected}
    ${priced}=    Evaluate    [l for l in $expected['levels'] if l['state'] == 'done' and l['total'] >= 0.5]
    Should Be True    len($priced) >= 25

Phase Totals Equal The Engine
    [Documentation]    The right end of each phase header is the sum of the levels' money (skipped ones count 0).
    ${expected}=    Open Project Page    /journey    unlock_until=misc
    VAR    ${at}    ${0}
    FOR    ${i}    ${size}    IN ENUMERATE    @{PHASE_SIZES}
        ${levels}=    Evaluate    $expected['levels'][$at:$at + $size]
        ${sum}=    Evaluate    sum(l['total'] for l in $levels)
        ${at}=    Evaluate    $at + $size
        ${text}=    Format Baht    ${sum}
        IF    ${sum} >= 0.5
            Get Text    css=section >> nth=${i} >> css=button[aria-expanded]    contains    ${text} บาท
        ELSE
            Get Text    css=section >> nth=${i} >> css=button[aria-expanded]    contains    —
        END
    END

Side Card Shows The Construction Total And Progress
    [Documentation]    Expected behaviour: Side Card Shows The Construction Total And Progress.
    ${expected}=    Open Project Page    /journey    unlock_until=roofing
    Number Of Element Should Be    ${MAP_TOTAL}    ${expected}[constructionTotal]    0.51
    Get Text    ${PROGRESS_TEXT}    contains    ${{ sum(1 for l in $expected['levels'] if l['state'] in ('done', 'skipped')) }} จาก 37 ขั้นตอน

Side Card Shows Land Survey Aside
    [Documentation]    "ไม่รวมค่าใช้จ่ายก่อนเริ่มงาน 7,500 บาท" while the pre-construction total is above zero.
    Open Project Page    /journey
    Get Text    css=body    contains    ไม่รวมค่าใช้จ่ายก่อนเริ่มงาน 7,500 บาท

Cost Breakdown Lists Seven Groups With The Engine Money
    [Documentation]    Expected behaviour: Cost Breakdown Lists Seven Groups With The Engine Money.
    Open Project Page    /journey    unlock_until=misc
    Get Text    css=body    contains    มูลค่าตามกลุ่มงาน
    FOR    ${title}    IN    @{PHASE_TITLES}
        Get Text    css=aside    contains    ${title}
    END

Finished Journey Shows The Completed State
    [Documentation]    All 37 levels passed: "ครบทุกขั้นตอนแล้ว", the BOQ summary button replaces "ทำต่อ", 37 จาก 37.
    [Tags]    smoke
    ${expected}=    Cached Start Project    sample
    ${project}=    Project With Levels Done    ${expected}[project]    ALL
    ${done}=    Open Project Object Page    /journey    ${project}
    Get Text    css=body    contains    ครบทุกขั้นตอนแล้ว
    Get Text    css=body    contains    สรุป BOQ ทั้งโครงการพร้อมใช้งาน
    Get Text    ${PROGRESS_TEXT}    contains    37 จาก 37 ขั้นตอน
    Get Element Count    css=button:has-text("ทำต่อ")    ==    0
    Number Of Element Should Be    ${MAP_TOTAL}    ${done}[constructionTotal]    0.51
    Click    css=a[href="/boq"] >> button:has-text("ดูสรุป BOQ")
    Wait For Condition    Url    should end with    /boq    timeout=30s

Finished Phases Start Folded And Say They Are Done
    [Documentation]    Expected behaviour: Finished Phases Start Folded And Say They Are Done.
    ${start}=    Cached Start Project    sample
    ${project}=    Project With Levels Done    ${start}[project]    ALL
    ${expected}=    Open Project Object Page    /journey    ${project}
    Get Element Count    css=section button[aria-expanded="true"]    ==    0
    Get Element Count    css=section button[aria-expanded] >> text=เสร็จแล้ว    ==    7
    Map Should Match Engine    ${expected}

Finished Journey Offers Export And Revisions Buttons
    [Documentation]    Expected behaviour: Finished Journey Offers Export And Revisions Buttons.
    ${expected}=    Cached Start Project    sample
    ${project}=    Project With Levels Done    ${expected}[project]    ALL
    Open Project Object Page    /journey    ${project}
    Wait For Elements State    ${EXCEL_BUTTON}    visible
    Wait For Elements State    ${PRINT_BUTTON}    visible

Open BOQ Button Is Always There
    [Documentation]    Expected behaviour: Open BOQ Button Is Always There.
    Open Project Page    /journey    start=blank
    Click    css=aside a[href="/boq"]
    Wait For Condition    Url    should end with    /boq    timeout=30s

Phase Header Folds And Unfolds
    [Documentation]    Expected behaviour: Phase Header Folds And Unfolds.
    Open Project Page    /journey    start=blank
    VAR    ${header}    css=section >> nth=1 >> css=button[aria-expanded]
    Get Attribute    ${header}    aria-expanded    ==    true
    Click    ${header}
    Get Attribute    ${header}    aria-expanded    ==    false
    Get Element Count    css=section >> nth=1 >> css=ol > li    ==    0
    Click    ${header}
    Get Element Count    css=section >> nth=1 >> css=ol > li    ==    4

Done Level With Missing Values Shows A Warning Dot
    [Documentation]    A blank project with every level forced to done lacks required values: one dot per level that the engine
    ...    reports with missing values.
    [Tags]    edge
    ${expected}=    Cached Start Project    blank
    ${project}=    Project With Levels Done    ${expected}[project]    ALL
    ${result}=    Open Project Object Page    /journey    ${project}
    Expand All Phases
    ${want}=    Evaluate    sum(1 for l in $result['levels'] if l['state'] == 'done' and len(l['missing']) > 0)
    Should Be True    ${want} > 0
    Get Element Count    css=[role="img"][aria-label^="ข้อมูลยังไม่ครบ"]    ==    ${want}

Clicking A Finished Level Opens It
    [Documentation]    Expected behaviour: Clicking A Finished Level Opens It.
    ${expected}=    Open Project Page    /journey    unlock_until=pedestal
    Expand All Phases
    Click    css=a[href="/journey/footing"]
    Wait For Condition    Url    should end with    /journey/footing    timeout=30s
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible

Back And Forward Move Between The Map And A Level
    [Documentation]    Browser history: map -> level -> back (map) -> forward (level), no crash and the same data.
    [Tags]    edge
    ${expected}=    Open Project Page    /journey    unlock_until=pedestal
    Expand All Phases
    Click    css=a[href="/journey/footing"]
    Wait For Condition    Url    should end with    /journey/footing    timeout=30s
    Go Back
    Wait For Condition    Url    should end with    /journey    timeout=30s
    Wait For Elements State    css=section >> nth=0    visible
    Go Forward
    Wait For Condition    Url    should end with    /journey/footing    timeout=30s
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible
    Page Should Have No Error Overlay
    ${now}=    Expected For Current Guest Project
    Should Be Equal As Numbers    ${now}[constructionTotal]    ${expected}[constructionTotal]

Back Between Two Levels Keeps Their Numbers
    [Documentation]    Expected behaviour: Back Between Two Levels Keeps Their Numbers.
    [Tags]    edge
    ${expected}=    Open Project Page    /journey/footing    unlock_until=pedestal
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible
    ${footing}=    Expected Level    ${expected}    footing
    Click    css=a[href="/journey/${footing}[previous]"]
    Wait For Condition    Url    should end with    /journey/${footing}[previous]    timeout=30s
    Go Back
    Wait For Condition    Url    should end with    /journey/footing    timeout=30s
    ${expected}=    Expected For Current Guest Project
    ${level}=    Expected Level    ${expected}    footing
    Wait Until Keyword Succeeds    15s    500ms    Level Total Should Be    ${level}[total]

Unknown Level Id Shows A Not Found Page
    [Documentation]    Expected behaviour: Unknown Level Id Shows A Not Found Page.
    [Tags]    negative
    Open Project Page    /journey/does-not-exist
    Get Text    css=body    contains    ไม่พบขั้นตอนนี้
    Click    css=a:has-text("กลับไปภาพรวมขั้นตอน")
    Wait For Condition    Url    should end with    /journey    timeout=30s

New Project Button Opens A Modal With Two Choices
    [Documentation]    "โครงการใหม่" -> modal "เริ่มโครงการใหม่": "เริ่มจากแบบแปลนของฉัน" / "ทดลองกับบ้านตัวอย่าง" and the warning
    ...    that the current project is replaced.
    [Tags]    smoke    new-project
    Open Project Page    /journey
    Click    ${NEW_PROJECT_BUTTON}
    Wait For Elements State    ${MODAL}    visible
    Get Text    ${MODAL}    contains    เริ่มโครงการใหม่
    Get Text    ${MODAL}    contains    ข้อมูลโครงการปัจจุบันจะถูกแทนที่
    Wait For Elements State    ${BLANK_CHOICE}    visible
    Wait For Elements State    ${SAMPLE_CHOICE}    visible

Closing The New Project Modal Keeps The Current Project
    [Documentation]    Expected behaviour: Closing The New Project Modal Keeps The Current Project.
    [Tags]    new-project    edge
    ${expected}=    Open Project Page    /journey
    Click    ${NEW_PROJECT_BUTTON}
    Wait For Elements State    ${MODAL}    visible
    Click    css=.ant-modal-close
    Wait For Elements State    ${MODAL}    hidden
    Get Url    *=    /journey
    ${now}=    Expected For Current Guest Project
    Should Be Equal As Numbers    ${now}[constructionTotal]    ${expected}[constructionTotal]

Escape Closes The New Project Modal Without Changes
    [Documentation]    Expected behaviour: Escape Closes The New Project Modal Without Changes.
    [Tags]    new-project    edge
    ${expected}=    Open Project Page    /journey
    Click    ${NEW_PROJECT_BUTTON}
    Wait For Elements State    ${MODAL}    visible
    Keyboard Key    press    Escape
    Wait For Elements State    ${MODAL}    hidden
    Get Text    ${MAP_TOTAL}    contains    1,855,162

Blank Choice Replaces The Sample And Lands On The First Level
    [Documentation]    Sample (1,855,162) -> "เริ่มจากแบบแปลนของฉัน": lands on /journey/project-info, the stored project is blank with
    ...    no progress, and the BOQ shows the blank totals of the engine.
    [Tags]    smoke    new-project
    Open Project Page    /journey
    Click    ${NEW_PROJECT_BUTTON}
    Click    ${BLANK_CHOICE}
    Wait For Condition    Url    should end with    /journey/project-info    timeout=30s
    ${project}=    Wait Until Keyword Succeeds    10s    250ms    Stored Project Start Is    blank
    Should Be Empty    ${project}[journey]
    Should Be Empty    ${project}[boqOverrides]
    Go To Path    /boq
    ${blank}=    Cached Start Project    blank
    Boq Totals Should Match Engine    ${blank}
    Number Of Element Should Be    ${GRAND_TOTAL}    18200    0.006

Sample Choice Replaces A Blank Project With The Excel House
    [Documentation]    Blank -> "ทดลองกับบ้านตัวอย่าง": lands on the first level; /boq shows 1,855,162.25.
    [Tags]    new-project
    Open Project Page    /journey    start=blank
    Click    ${NEW_PROJECT_BUTTON}
    Click    ${SAMPLE_CHOICE}
    Wait For Condition    Url    should end with    /journey/project-info    timeout=30s
    Wait Until Keyword Succeeds    10s    250ms    Stored Project Start Is    sample
    Go To Path    /boq
    Number Of Element Should Be    ${GRAND_TOTAL}    1855162.25    0.006

New Project Throws Away Edits And Progress
    [Documentation]    A BOQ override and journey progress exist; a new sample project resets both (overrides {} and no marks).
    [Tags]    new-project
    Open Project Page    /boq    unlock_until=footing
    Set Boq Cell    R19    qty    9
    Stored Override Should Be    R19    qty    9
    Go To Path    /journey
    Click    ${NEW_PROJECT_BUTTON}
    Click    ${SAMPLE_CHOICE}
    Wait For Condition    Url    should end with    /journey/project-info    timeout=30s
    ${project}=    Wait Until Keyword Succeeds    10s    250ms    Stored Project Start Is    sample
    Should Be Empty    ${project}[boqOverrides]
    Should Be Empty    ${project}[journey]
    Go To Path    /journey
    ${states}=    Level States On Map
    Should Be Equal    ${states}[0]    current

New Blank Project Locks Every Level After The First
    [Documentation]    Expected behaviour: New Blank Project Locks Every Level After The First.
    [Tags]    new-project    edge
    Open Project Page    /journey    unlock_until=footing
    Click    ${NEW_PROJECT_BUTTON}
    Click    ${BLANK_CHOICE}
    Wait For Condition    Url    should end with    /journey/project-info    timeout=30s
    Go To Path    /journey/footing
    Locked Screen Should Match Engine    footing
    Page Should Have No Error Overlay

New Project Lands On A Level Page That Renders
    [Documentation]    Expected behaviour: New Project Lands On A Level Page That Renders.
    [Tags]    new-project
    Open Project Page    /journey    start=blank
    Click    ${NEW_PROJECT_BUTTON}
    Click    ${BLANK_CHOICE}
    Wait For Condition    Url    should end with    /journey/project-info    timeout=30s
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible
    Page Should Have No Error Overlay

New Project Twice In A Row Leaves A Valid Project
    [Documentation]    Expected behaviour: New Project Twice In A Row Leaves A Valid Project.
    [Tags]    new-project    edge
    Open Project Page    /journey
    Click    ${NEW_PROJECT_BUTTON}
    Click    ${BLANK_CHOICE}
    Wait For Condition    Url    should end with    /journey/project-info    timeout=30s
    Go To Path    /journey
    Click    ${NEW_PROJECT_BUTTON}
    Click    ${SAMPLE_CHOICE}
    Wait For Condition    Url    should end with    /journey/project-info    timeout=30s
    ${project}=    Wait Until Keyword Succeeds    10s    250ms    Stored Project Start Is    sample
    Compute Expected    ${project}

Map Shows The Sample Tag Only For The Sample House
    [Documentation]    Expected behaviour: Map Shows The Sample Tag Only For The Sample House.
    [Tags]    edge
    Open Project Page    /journey
    Get Text    css=header:has(h1)    contains    เทมเพลตบ้านเดี่ยว 1 ชั้น
    Close Context
    Open Project Page    /journey    start=blank
    Get Text    css=header:has(h1)    not contains    เทมเพลตบ้านเดี่ยว 1 ชั้น

Map Title Shows The Project Name Or A Default
    [Documentation]    Expected behaviour: Map Title Shows The Project Name Or A Default.
    [Tags]    edge
    ${expected}=    Open Project Page    /journey
    Get Text    css=h1    ==    ${expected}[project][meta][projectName]
    Close Context
    Open Project Page    /journey    start=blank
    Get Text    css=h1    ==    โครงการของฉัน

Map Reload Keeps Progress
    [Documentation]    Expected behaviour: Map Reload Keeps Progress.
    Open Project Page    /journey    unlock_until=footing
    Reload
    Wait For Elements State    css=section >> nth=0    visible
    Get Element Count    css=a[aria-current="step"]    ==    1
    Get Text    css=a[aria-current="step"]    contains    ฐานราก


*** Keywords ***
Stored Project Start Is
    [Documentation]    The saved guest project has ``start`` = ``${start}``; returns the project.
    [Arguments]    ${start}
    ${project}=    Read Guest Project
    Should Be Equal    ${project}[start]    ${start}
    RETURN    ${project}
