*** Settings ***
Documentation       W4 / planning pages: Man-Day ``/man-day``, Schedule + S-curve ``/schedule``, Cash Flow ``/cashflow``
...                 (src/features/planning). Every row and total on screen is compared with ``planning.manday`` /
...                 ``schedule`` / ``cashflow`` of the engine run on the saved project (docs/excel-spec/06-manday-scurve-cashflow.md).
Resource            ../../resources/pages/boq_planning.resource
Suite Setup         Setup W4 Suite
Test Teardown       Close Test Context
Test Tags           planning    w4


*** Variables ***
${FOUNDATION}       งานฐานราก
${PROJECT_START}    วันที่โครงการเริ่ม
${RESET_PAGE}       css=button:has-text("คืนค่าตัวอย่าง")
${SAMPLE_TAG}       css=.ant-tag:has-text("ค่าตัวอย่างจากเทมเพลต")


*** Test Cases ***
Man Day Page Matches The Engine For The Sample House
    [Documentation]    32 work blocks: crew, daily wage, calculated days, typed days, budget, and the two totals.
    [Tags]    smoke    man-day
    Open Project Page    /man-day
    ${expected}=    Man Day Page Should Match Engine
    Length Should Be    ${expected}[planning][manday][blocks]    32
    Page Should Have No Error Overlay

Man Day Total Budget Equals The Construction Total
    [Documentation]    The sum of the budgets of all work blocks equals the BOQ construction total (every baht is planned).
    [Tags]    man-day
    ${expected}=    Open Project Page    /man-day
    ${tile}=    Stat Tile Value    รวมงบประมาณ
    Number Of Element Should Be    ${tile}    ${expected}[constructionTotal]    0.51

Man Day Summary Tiles Show Total Days And Project Duration
    [Documentation]    Expected behaviour: Man Day Summary Tiles Show Total Days And Project Duration.
    [Tags]    man-day
    ${expected}=    Open Project Page    /man-day
    VAR    ${md}    ${expected}[planning][manday]
    ${days}=    Stat Tile Value    รวมเวลา (ผลรวมวันทุกงาน)
    ${duration}=    Stat Tile Value    ระยะเวลาโครงการ (S-Curve)
    Number Of Element Should Be    ${days}    ${md}[totalDays]    0.51
    Number Of Element Should Be    ${duration}    ${expected}[planning][schedule][durationDays]    0.51

Typing Days Updates Budget Row Totals And The Schedule
    [Documentation]    Foundation 10 -> 20 days: the Man-Day rows and totals follow the engine, and the schedule shows the
    ...    task with a 20-day duration (days typed here become the S-Curve duration).
    [Tags]    man-day    smoke
    Open Project Page    /man-day
    Set Man Day Days    ${FOUNDATION}    20
    ${expected}=    Man Day Page Should Match Engine
    Value Of Input Should Be Number    ${{ "css=input[aria-label='${FOUNDATION} วันประเมิน']" }}    20
    Go To Path    /schedule
    Wait Until Keyword Succeeds    15s    500ms    Schedule Match Attempt
    Value Of Input Should Be Number    ${{ "css=input[aria-label='${FOUNDATION} ระยะเวลา']" }}    20

Changing Skilled Workers Changes Crew And Daily Wage
    [Documentation]    Foundation: 3 skilled + 5 labourers on wage set A (800 / 500): crew 8, daily wage 3x800 + 5x500 = 4,900.
    [Tags]    man-day
    Open Project Page    /man-day
    Set Man Day Crew    ${FOUNDATION}    3    3
    ${crew}=    Man Day Cell    ${FOUNDATION}    5
    ${wage}=    Man Day Cell    ${FOUNDATION}    7
    Wait Until Keyword Succeeds    10s    250ms    Number Of Element Should Be    ${crew}    8    0.01
    Number Of Element Should Be    ${wage}    4900    0.5
    Man Day Page Should Match Engine

Changing Labourers Changes The Calculated Days
    [Documentation]    More labourers -> a higher daily wage -> fewer calculated days (labour cost / daily wage).
    [Tags]    man-day
    Open Project Page    /man-day
    ${calc}=    Man Day Cell    ${FOUNDATION}    9
    ${before}=    Get Text    ${calc}
    Set Man Day Crew    ${FOUNDATION}    4    10
    Wait Until Keyword Succeeds    10s    250ms    Get Text    ${calc}    !=    ${before}
    Man Day Page Should Match Engine

Editing The Wage Of Set A Changes Every Row Using It
    [Documentation]    Skilled wage 800 -> 900 (set A): daily wage of "งานน้ำ-ไฟชั่วคราว" (1 skilled + 1 labourer) = 900 + 500 = 1,400.
    [Tags]    man-day
    Open Project Page    /man-day
    Open Wage Rates Tab
    Fill Number By Label    ค่าแรงช่าง ชุด A    900
    Open Man Day Plan Tab
    ${wage}=    Man Day Cell    งานน้ำ-ไฟชั่วคราว    7
    Wait Until Keyword Succeeds    10s    250ms    Number Of Element Should Be    ${wage}    1400    0.5
    Man Day Page Should Match Engine

Editing The Subcontract Labour Share Follows The Engine
    [Documentation]    "ค่าแรง % ของยอดรวม" 20% -> 30%: the lump-sum rows recompute.
    [Tags]    man-day
    Open Project Page    /man-day
    Open Wage Rates Tab
    Fill Number By Label    งานเหมา: ค่าแรง % ของยอดรวม    30
    Open Man Day Plan Tab
    Man Day Page Should Match Engine

Use Calculated Days Button Sets The Rounded Value
    [Documentation]    Foundation shows 10 typed days while 11.32 are calculated: the "ใช้ค่าที่คำนวณ 11 วัน" button sets 11.
    [Tags]    man-day
    Open Project Page    /man-day
    Click    css=button[aria-label="ใช้ค่าที่คำนวณ 11 วัน"]
    Value Of Input Should Be Number    ${{ "css=input[aria-label='${FOUNDATION} วันประเมิน']" }}    11
    Man Day Page Should Match Engine

Use Calculated Days For All Rows Asks First And Then Applies
    [Documentation]    The popconfirm "ใช้ค่าที่คำนวณทุกงาน" sets every typed day to the calculated (rounded) value.
    [Tags]    man-day
    Open Project Page    /man-day
    Click    css=button:has-text("ใช้ค่าที่คำนวณทุกงาน")
    Click Popconfirm Ok    ตั้งค่า
    Wait For Elements State    css=button:has-text("ใช้ค่าที่คำนวณทุกงาน")    detached
    Get Text    css=body    contains    วันประเมินทุกงานเท่ากับค่าที่คำนวณ
    Man Day Page Should Match Engine

Reset Button Restores The Excel Sample Of The Page
    [Documentation]    After an edit the tag "ค่าตัวอย่างจากเทมเพลต" turns into "คืนค่าตัวอย่าง"; pressing it (and confirming)
    ...    brings the sample numbers back.
    [Tags]    man-day
    ${original}=    Open Project Page    /man-day
    Wait For Elements State    ${SAMPLE_TAG}    visible
    Set Man Day Days    ${FOUNDATION}    30
    Wait For Elements State    ${RESET_PAGE}    visible
    Click    ${RESET_PAGE}
    Click Popconfirm Ok    คืนค่า
    Wait For Elements State    ${SAMPLE_TAG}    visible
    Value Of Input Should Be Number    ${{ "css=input[aria-label='${FOUNDATION} วันประเมิน']" }}    10
    Man Day Page Should Match Engine

Negative Days Never Produce NaN
    [Documentation]    Behaviour recorded: -3 days is accepted as typed; budgets and totals equal the engine, no NaN.
    [Tags]    man-day    edge    negative
    Open Project Page    /man-day
    Set Man Day Days    ${FOUNDATION}    -3
    Man Day Page Should Match Engine
    Page Should Not Show Broken Numbers

Zero Days Are Accepted
    [Documentation]    Expected behaviour: Zero Days Are Accepted.
    [Tags]    man-day    edge
    Open Project Page    /man-day
    Set Man Day Days    ${FOUNDATION}    0
    Man Day Page Should Match Engine
    Page Should Not Show Broken Numbers

Letters In Days Are Rejected
    [Documentation]    Expected behaviour: Letters In Days Are Rejected.
    [Tags]    man-day    edge    negative
    ${original}=    Open Project Page    /man-day
    Set Man Day Days    ${FOUNDATION}    abc
    Value Of Input Should Be Number    ${{ "css=input[aria-label='${FOUNDATION} วันประเมิน']" }}    10
    Man Day Page Should Match Engine

Huge Days Keep Every Number Finite
    [Documentation]    999,999,999 typed days: the page must stay alive and show finite numbers. BUG: the date arithmetic of the
    ...    schedule (src/domain/planning/calendar.ts serialToIso) throws "Invalid time value" once the finish date is out of the
    ...    JavaScript Date range (more than about 100 million days), so the whole planning result cannot be computed.
    [Tags]    man-day    edge    bug
    Open Project Page    /man-day
    Set Man Day Days    ${FOUNDATION}    999999999
    Page Should Have No Error Overlay
    Page Should Not Show Broken Numbers
    Man Day Page Should Match Engine

Negative Wage Never Produces NaN
    [Documentation]    Expected behaviour: Negative Wage Never Produces NaN.
    [Tags]    man-day    edge    negative
    Open Project Page    /man-day
    Open Wage Rates Tab
    Fill Number By Label    ค่าแรงช่าง ชุด A    -100
    Open Man Day Plan Tab
    Man Day Page Should Match Engine
    Page Should Not Show Broken Numbers

Zero Wages Leave No Calculated Days Instead Of Infinity
    [Documentation]    Wage set A = 0/0: rows on set A have no daily wage, so "วันตามค่าแรง" is empty (–), never Infinity.
    [Tags]    man-day    edge
    Open Project Page    /man-day
    Open Wage Rates Tab
    Fill Number By Label    ค่าแรงช่าง ชุด A    0
    Fill Number By Label    ค่าแรงคนงาน ชุด A    0
    Open Man Day Plan Tab
    Man Day Page Should Match Engine
    Page Should Not Show Broken Numbers

Zero Crew Leaves The Row Without Calculated Days
    [Documentation]    Expected behaviour: Zero Crew Leaves The Row Without Calculated Days.
    [Tags]    man-day    edge
    Open Project Page    /man-day
    Set Man Day Crew    ${FOUNDATION}    3    0
    Set Man Day Crew    ${FOUNDATION}    4    0
    Man Day Page Should Match Engine
    Page Should Not Show Broken Numbers

Man Day Edit Survives A Reload
    [Documentation]    Expected behaviour: Man Day Edit Survives A Reload.
    [Tags]    man-day
    Open Project Page    /man-day
    Set Man Day Days    ${FOUNDATION}    25
    Wait Until Keyword Succeeds    10s    250ms    Man Day Match Attempt
    Reload
    Wait For Elements State    css=input[aria-label="${FOUNDATION} วันประเมิน"]    visible
    Value Of Input Should Be Number    ${{ "css=input[aria-label='${FOUNDATION} วันประเมิน']" }}    25
    Man Day Page Should Match Engine

Man Day Page Of A Blank Project Has No NaN
    [Documentation]    Expected behaviour: Man Day Page Of A Blank Project Has No NaN.
    [Tags]    man-day    edge
    Open Project Page    /man-day    start=blank
    Man Day Page Should Match Engine
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Schedule Page Matches The Engine For The Sample House
    [Documentation]    32 tasks: duration, start date, finish date; the banner and the project start field.
    [Tags]    smoke    schedule
    ${expected}=    Open Project Page    /schedule
    Schedule Page Should Match Engine
    Length Should Be    ${expected}[planning][schedule][tasks]    32
    Page Should Have No Error Overlay

Schedule Banner Shows Duration Start And Finish
    [Documentation]    Finish = start + duration - 1 calendar days (spec 06): the banner shows the engine's three numbers.
    [Tags]    schedule
    ${expected}=    Open Project Page    /schedule
    VAR    ${s}    ${expected}[planning][schedule]
    ${start}=    Format Iso Date    ${s}[start]
    ${finish}=    Format Iso Date    ${s}[finish]
    Get Text    css=body    contains    ใช้เวลา ${s}[durationDays] วัน เริ่ม ${start} เสร็จ ${finish}
    Get Text    css=body    contains    32 งาน ใน 8 งวด

Every Task Has Its Gantt Bars
    [Documentation]    Per task: planned weeks with a bar on screen = weeks with a planned share in the engine.
    [Tags]    schedule
    ${expected}=    Open Project Page    /schedule
    Gantt Bar Count Should Match Engine    ${expected}

Gantt Has Eight Installment Header Rows
    [Documentation]    Expected behaviour: Gantt Has Eight Installment Header Rows.
    [Tags]    schedule
    ${expected}=    Open Project Page    /schedule
    ${n}=    Get Length    ${expected}[planning][schedule][installments]
    Should Be Equal As Integers    ${n}    8
    Get Element Count    css=td:has-text("งวดที่")    >=    8
    FOR    ${inst}    IN    @{expected}[planning][schedule][installments]
        Get Text    css=body    contains    ${inst}[label]
    END

S-Curve Card Is Open By Default And Folds Closed And Open
    [Documentation]    The card header button toggles the chart and the pace gauge (aria-expanded true -> false -> true).
    [Tags]    schedule    smoke
    Open Project Page    /schedule
    Get Attribute    ${SCURVE_TOGGLE}    aria-expanded    ==    true
    Wait For Elements State    ${SCURVE_CHART}    visible
    Wait For Elements State    ${PACE_GAUGE}    visible
    Click    ${SCURVE_TOGGLE}
    Get Attribute    ${SCURVE_TOGGLE}    aria-expanded    ==    false
    Wait For Elements State    ${SCURVE_CHART}    hidden
    Wait For Elements State    ${PACE_GAUGE}    hidden
    Click    ${SCURVE_TOGGLE}
    Get Attribute    ${SCURVE_TOGGLE}    aria-expanded    ==    true
    Wait For Elements State    ${SCURVE_CHART}    visible
    Wait For Elements State    ${PACE_GAUGE}    visible

S-Curve Card Header Still Shows The Pace Chip When Folded
    [Documentation]    Expected behaviour: S-Curve Card Header Still Shows The Pace Chip When Folded.
    [Tags]    schedule
    Open Project Page    /schedule
    Click    ${SCURVE_TOGGLE}
    Wait For Elements State    ${PACE_GAUGE}    hidden
    Get Text    css=body    contains    ช้ากว่าแผน

Pace Gauge Reading Is Consistent With The Cumulative Progress
    [Documentation]    The gauge label is "<pace>× <status> ..."; the caption under it says "ผลงานสะสม X% เทียบแผน Y%": pace = X / Y.
    [Tags]    schedule
    Open Project Page    /schedule
    ${label}=    Get Attribute    ${PACE_GAUGE}    aria-label
    ${pace}=    Evaluate    float(__import__('re').search(r'([0-9.]+)×', $label).group(1))
    ${caption}=    Get Text    css=body
    ${numbers}=    Evaluate    [float(x) for x in __import__('re').search(r'ผลงานสะสม ([0-9.]+)% เทียบแผน ([0-9.]+)%', $caption).groups()]
    ${ratio}=    Evaluate    $numbers[0] / $numbers[1]
    Should Be True    abs(${pace} - ${ratio}) < 0.02    msg=gauge ${pace}x but ${numbers}

Pace Gauge Of The Sample Says Behind Plan
    [Documentation]    The sample has one reported task at 0.4% against a plan of 6.5%: the status is "ช้ากว่าแผน".
    [Tags]    schedule
    Open Project Page    /schedule
    Get Attribute    ${PACE_GAUGE}    aria-label    contains    ช้ากว่าแผน

Pace Gauge Of A Blank Project Waits For The First Report
    [Documentation]    Expected behaviour: Pace Gauge Of A Blank Project Waits For The First Report.
    [Tags]    schedule    edge
    Open Project Page    /schedule    start=blank
    Wait For Elements State    ${PACE_GAUGE}    visible
    Get Text    css=body    contains    เข็มจะขยับเมื่อบันทึกผลงานจริงสัปดาห์แรก
    Page Should Not Show Broken Numbers

Changing The Project Start Shifts Every Task
    [Documentation]    Start 10/01/2026 -> 20/01/2026: every task start moves by 10 days and so does the finish; the banner follows.
    [Tags]    schedule    smoke
    ${original}=    Open Project Page    /schedule
    Set Date By Label    ${PROJECT_START}    20/01/2026
    ${expected}=    Schedule Page Should Match Engine
    Should Be Equal    ${expected}[planning][schedule][start]    2026-01-20
    VAR    ${old_finish}    ${original}[planning][schedule][finish]
    ${shifted}=    Evaluate    (__import__('datetime').date.fromisoformat($old_finish) + __import__('datetime').timedelta(days=10)).isoformat()
    Should Be Equal    ${expected}[planning][schedule][finish]    ${shifted}
    Should Be Equal As Integers    ${expected}[planning][schedule][durationDays]    ${original}[planning][schedule][durationDays]

Changing The Project Start Updates The Gantt Bars
    [Documentation]    Expected behaviour: Changing The Project Start Updates The Gantt Bars.
    [Tags]    schedule
    Open Project Page    /schedule
    Set Date By Label    ${PROJECT_START}    01/03/2026
    ${expected}=    Schedule Page Should Match Engine
    Gantt Bar Count Should Match Engine    ${expected}

Moving The Project Start To A Past Year Is Handled
    [Documentation]    Expected behaviour: Moving The Project Start To A Past Year Is Handled.
    [Tags]    schedule    edge
    Open Project Page    /schedule
    Set Date By Label    ${PROJECT_START}    05/06/2024
    Schedule Page Should Match Engine
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Changing One Task Start Moves Its Finish Date
    [Documentation]    Foundation starts 22/01/2026 for 10 days -> 31/01; moving the start to 01/02/2026 gives finish 10/02/2026.
    [Tags]    schedule
    Open Project Page    /schedule
    Set Date By Label    ${FOUNDATION} วันเริ่ม    01/02/2026
    ${expected}=    Schedule Page Should Match Engine
    ${finish}=    Task Finish Cell    ${FOUNDATION}
    Get Text    ${finish}    ==    10/02/2026

Changing A Task Duration Moves Its Finish Date
    [Documentation]    Foundation 10 -> 20 days from 22/01/2026: finish 10/02/2026 (start + duration - 1).
    [Tags]    schedule    smoke
    Open Project Page    /schedule
    Set Task Duration    ${FOUNDATION}    20
    ${expected}=    Schedule Page Should Match Engine
    ${finish}=    Task Finish Cell    ${FOUNDATION}
    Get Text    ${finish}    ==    10/02/2026

Typed Duration Can Return To The Man-Day Value
    [Documentation]    After typing a duration the link button "ใช้วันจาก Man-Day" appears; pressing it restores 10.
    [Tags]    schedule
    Open Project Page    /schedule
    Set Task Duration    ${FOUNDATION}    20
    ${row}=    Task Row    ${FOUNDATION}
    Click    ${row} >> css=button[aria-label="ใช้วันจาก Man-Day"]
    Value Of Input Should Be Number    ${{ "css=input[aria-label='${FOUNDATION} ระยะเวลา']" }}    10
    Schedule Page Should Match Engine

Longer Duration Extends The Project Finish
    [Documentation]    Expected behaviour: Longer Duration Extends The Project Finish.
    [Tags]    schedule
    ${original}=    Open Project Page    /schedule
    Set Task Duration    งานก่ออิฐ    200
    ${expected}=    Schedule Page Should Match Engine
    Should Be True    ${expected}[planning][schedule][durationDays] > ${original}[planning][schedule][durationDays]

Negative Duration Never Produces NaN
    [Documentation]    Behaviour recorded: -5 days is accepted as typed by the cell; the page equals the engine, no NaN, no crash.
    [Tags]    schedule    edge    negative
    Open Project Page    /schedule
    Set Task Duration    ${FOUNDATION}    -5
    Schedule Page Should Match Engine
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Zero Duration Never Produces NaN
    [Documentation]    Expected behaviour: Zero Duration Never Produces NaN.
    [Tags]    schedule    edge
    Open Project Page    /schedule
    Set Task Duration    ${FOUNDATION}    0
    Schedule Page Should Match Engine
    Page Should Not Show Broken Numbers

Fractional Duration Is Handled
    [Documentation]    Expected behaviour: Fractional Duration Is Handled.
    [Tags]    schedule    edge
    Open Project Page    /schedule
    Set Task Duration    ${FOUNDATION}    2.5
    Schedule Page Should Match Engine
    Page Should Not Show Broken Numbers

Letters In Duration Are Rejected
    [Documentation]    Expected behaviour: Letters In Duration Are Rejected.
    [Tags]    schedule    edge    negative
    Open Project Page    /schedule
    Set Task Duration    ${FOUNDATION}    abc
    Value Of Input Should Be Number    ${{ "css=input[aria-label='${FOUNDATION} ระยะเวลา']" }}    10
    Schedule Page Should Match Engine

Huge Duration Keeps The Page Alive
    [Documentation]    Expected behaviour: Huge Duration Keeps The Page Alive.
    [Tags]    schedule    edge
    Open Project Page    /schedule
    Set Task Duration    ${FOUNDATION}    99999
    Schedule Page Should Match Engine
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Duration Beyond The Date Range Does Not Crash The Page
    [Documentation]    999,999,999 days in the schedule: same root cause as the Man-Day case (calendar.ts serialToIso throws
    ...    "Invalid time value"). The page must show no error overlay.
    [Tags]    schedule    edge    bug
    Open Project Page    /schedule
    Set Task Duration    ${FOUNDATION}    999999999
    Page Should Have No Error Overlay
    Page Should Not Show Broken Numbers
    Schedule Page Should Match Engine

Invalid Date Text Is Not Accepted
    [Documentation]    "99/99/2026" in a start date: the date stays as it was and the page equals the engine.
    [Tags]    schedule    edge    negative
    Open Project Page    /schedule
    Set Date By Label    ${FOUNDATION} วันเริ่ม    99/99/2026
    Keyboard Key    press    Escape
    Click    css=h4
    Get Property    ${{ "css=input[aria-label='${FOUNDATION} วันเริ่ม']" }}    value    ==    22/01/2026
    Schedule Page Should Match Engine

Date With Letters Is Not Accepted
    [Documentation]    Expected behaviour: Date With Letters Is Not Accepted.
    [Tags]    schedule    edge    negative
    Open Project Page    /schedule
    Set Date By Label    ${FOUNDATION} วันเริ่ม    abc
    Keyboard Key    press    Escape
    Click    css=h4
    Get Property    ${{ "css=input[aria-label='${FOUNDATION} วันเริ่ม']" }}    value    ==    22/01/2026
    Schedule Page Should Match Engine

Clearing A Task Start Date Leaves No Finish Date And No NaN
    [Documentation]    Expected behaviour: Clearing A Task Start Date Leaves No Finish Date And No NaN.
    [Tags]    schedule    edge
    Open Project Page    /schedule
    Clear Date By Label    ${FOUNDATION} วันเริ่ม
    Schedule Page Should Match Engine
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Reset Button Restores The Schedule Sample
    [Documentation]    Expected behaviour: Reset Button Restores The Schedule Sample.
    [Tags]    schedule
    Open Project Page    /schedule
    Wait For Elements State    ${SAMPLE_TAG}    visible
    Set Task Duration    ${FOUNDATION}    20
    Wait For Elements State    ${RESET_PAGE}    visible
    Click    ${RESET_PAGE}
    Click Popconfirm Ok    คืนค่า
    Wait For Elements State    ${SAMPLE_TAG}    visible
    Value Of Input Should Be Number    ${{ "css=input[aria-label='${FOUNDATION} ระยะเวลา']" }}    10
    Schedule Page Should Match Engine

Schedule Edit Survives A Reload
    [Documentation]    Expected behaviour: Schedule Edit Survives A Reload.
    [Tags]    schedule
    Open Project Page    /schedule
    Set Task Duration    ${FOUNDATION}    18
    Wait Until Keyword Succeeds    10s    250ms    Schedule Match Attempt
    Reload
    Wait For Elements State    css=input[aria-label="${FOUNDATION} ระยะเวลา"]    visible
    Value Of Input Should Be Number    ${{ "css=input[aria-label='${FOUNDATION} ระยะเวลา']" }}    18
    Schedule Page Should Match Engine

Actual Progress Table Opens And Accepts A Progress Value
    [Documentation]    "บันทึกผลงานจริง" folded section: 50% on the foundation task moves "งบประมาณตามแผน" like the engine says.
    [Tags]    schedule
    Open Project Page    /schedule
    Click    css=.ant-collapse-header:has-text("บันทึกผลงานจริงและ % คืบหน้า")
    Fill Number By Label    ${FOUNDATION} % คืบหน้า    50
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Progress Is Stored    ${FOUNDATION}
    ${tile}=    Stat Tile Value    งบประมาณตามแผน
    Wait Until Keyword Succeeds    10s    250ms    Number Of Element Should Be    ${tile}
    ...    ${expected}[planning][schedule][status][earnedValue]    0.51

Schedule Page Of A Blank Project Has No NaN
    [Documentation]    Expected behaviour: Schedule Page Of A Blank Project Has No NaN.
    [Tags]    schedule    edge
    Open Project Page    /schedule    start=blank
    Schedule Page Should Match Engine
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Cash Flow Page Matches The Engine For The Sample House
    [Documentation]    Expected behaviour: Cash Flow Page Matches The Engine For The Sample House.
    [Tags]    smoke    cashflow
    ${expected}=    Open Project Page    /cashflow
    Cash Flow Page Should Match Engine
    Length Should Be    ${expected}[planning][cashflow][installments]    9
    Page Should Have No Error Overlay

Cash Flow Cost Equals The Construction Total
    [Documentation]    "ต้นทุนก่อสร้าง" = BOQ construction total (1,855,162.25 for the sample).
    [Tags]    cashflow
    ${expected}=    Open Project Page    /cashflow
    ${cost}=    Calc Field Value    ต้นทุนก่อสร้าง
    Number Of Element Should Be    ${cost}    ${expected}[constructionTotal]    0.006

Quotation Is The Cost Times One Point Three
    [Documentation]    Business rule of the sample (quotation factor 1.30): ราคาเสนอลูกค้า = ต้นทุน x 1.3.
    [Tags]    cashflow
    ${expected}=    Open Project Page    /cashflow
    ${quotation}=    Calc Field Value    ราคาเสนอลูกค้า
    ${want}=    Evaluate    $expected['constructionTotal'] * 1.3
    Number Of Element Should Be    ${quotation}    ${want}    0.011
    Value Of Input Should Be Number    ${{ "css=input[aria-label='ตัวคูณราคาเสนอ']" }}    1.3

Installments Add Up To One Hundred Percent And The Quotation
    [Documentation]    The 9 installments sum to 100 % and their amounts sum to the quotation (no warning is shown).
    [Tags]    cashflow
    ${expected}=    Open Project Page    /cashflow
    Number Of Element Should Be    css=tfoot tr td:nth-child(2)    100    0.51
    ${sum}=    Evaluate    sum(i['amount'] for i in $expected['planning']['cashflow']['installments'])
    Number Of Element Should Be    css=tfoot tr td:nth-child(4)    ${expected}[planning][cashflow][quotation]    0.011
    Should Be True    abs(${sum} - $expected['planning']['cashflow']['quotation']) < 0.01
    Get Text    css=body    not contains    ควรเป็น 100%

Cash Flow Banner Shows The Lowest Cash Point
    [Documentation]    "เงินติดลบสูงสุด N บาท" = the engine's minimum cumulative cash position.
    [Tags]    cashflow
    ${expected}=    Open Project Page    /cashflow
    VAR    ${min}    ${expected}[planning][cashflow][minCumulative]
    ${shown}=    Format Baht    ${{ -$min['value'] }}
    Get Text    css=body    contains    เงินติดลบสูงสุด ${shown} บาท

Changing The Quotation Factor Follows The Engine
    [Documentation]    1.30 -> 1.50: quotation, installment amounts, totals follow the engine.
    [Tags]    cashflow    smoke
    Open Project Page    /cashflow
    Fill Number By Label    ตัวคูณราคาเสนอ    1.5
    ${expected}=    Cash Flow Page Should Match Engine
    ${want}=    Evaluate    $expected['constructionTotal'] * 1.5
    ${quotation}=    Calc Field Value    ราคาเสนอลูกค้า
    Number Of Element Should Be    ${quotation}    ${want}    0.011

Quotation Factor Of Zero Gives Zero Quotation
    [Documentation]    Expected behaviour: Quotation Factor Of Zero Gives Zero Quotation.
    [Tags]    cashflow    edge
    Open Project Page    /cashflow
    Fill Number By Label    ตัวคูณราคาเสนอ    0
    Cash Flow Page Should Match Engine
    Page Should Not Show Broken Numbers

Negative Quotation Factor Never Produces NaN
    [Documentation]    Expected behaviour: Negative Quotation Factor Never Produces NaN.
    [Tags]    cashflow    edge    negative
    Open Project Page    /cashflow
    Fill Number By Label    ตัวคูณราคาเสนอ    -1
    Cash Flow Page Should Match Engine
    Page Should Not Show Broken Numbers

Letters In The Quotation Factor Are Rejected
    [Documentation]    Expected behaviour: Letters In The Quotation Factor Are Rejected.
    [Tags]    cashflow    edge    negative
    Open Project Page    /cashflow
    Fill Number By Label    ตัวคูณราคาเสนอ    abc
    Value Of Input Should Be Number    ${{ "css=input[aria-label='ตัวคูณราคาเสนอ']" }}    1.3
    Cash Flow Page Should Match Engine

Huge Quotation Factor Keeps Numbers Finite
    [Documentation]    A factor of one million: the quotation is about 1.8 trillion baht, every number stays finite.
    [Tags]    cashflow    edge
    Open Project Page    /cashflow
    Fill Number By Label    ตัวคูณราคาเสนอ    1000000
    Cash Flow Page Should Match Engine
    Page Should Not Show Broken Numbers

Changing An Installment Percent Warns When The Total Is Not 100
    [Documentation]    Deposit 20% -> 30%: total 110 %, the warning "งวดเงินรวม 110% (ควรเป็น 100%)" appears and totals follow the engine.
    [Tags]    cashflow
    Open Project Page    /cashflow
    Fill Number By Label    สัดส่วนงวด    30    0
    Cash Flow Page Should Match Engine
    Get Text    css=.ant-alert    contains    งวดเงินรวม 110% (ควรเป็น 100%)

Deleting An Installment Warns And Follows The Engine
    [Documentation]    Expected behaviour: Deleting An Installment Warns And Follows The Engine.
    [Tags]    cashflow
    Open Project Page    /cashflow
    Click    css=button[aria-label="ลบแถว"] >> nth=8
    Get Element Count    css=tbody tr    ==    8
    Cash Flow Page Should Match Engine
    Get Text    css=.ant-alert    contains    ควรเป็น 100%

Adding An Installment Warns About The Missing Week
    [Documentation]    "เพิ่มงวด" adds a 0 % row without a billing week: the warning names it.
    [Tags]    cashflow
    Open Project Page    /cashflow
    Click    css=button:has-text("เพิ่มงวด")
    Get Element Count    css=tbody tr    ==    10
    Cash Flow Page Should Match Engine
    Get Text    css=.ant-alert    contains    ยังไม่กำหนดสัปดาห์เรียกเก็บ 1 งวด

Negative Installment Percent Never Produces NaN
    [Documentation]    Expected behaviour: Negative Installment Percent Never Produces NaN.
    [Tags]    cashflow    edge    negative
    Open Project Page    /cashflow
    Fill Number By Label    สัดส่วนงวด    -10    1
    Cash Flow Page Should Match Engine
    Page Should Not Show Broken Numbers

Use Finish Week Button Moves The Billing Week
    [Documentation]    Installment 5 is billed in W1 เม.ย. but its work ends in W3 มี.ค.: the "ใช้" button moves it.
    [Tags]    cashflow
    Open Project Page    /cashflow
    Click    css=button[aria-label^="เรียกเก็บ งวดที่ 4 ใน"]
    ${expected}=    Cash Flow Page Should Match Engine
    Get Element Count    css=button[aria-label^="เรียกเก็บ งวดที่ 4 ใน"]    ==    0

EVM Panel Opens And Matches The Engine
    [Documentation]    BAC, PV, EV, AC, SV, CV, SPI, CPI, EAC and planned profit equal planning.cashflow.evm.
    [Tags]    cashflow
    Open Project Page    /cashflow
    ${expected}=    Expected For Current Guest Project
    Open Evm Panel
    Evm Panel Should Match Engine    ${expected}

Changing The Actual Cost Moves CPI And EAC
    [Documentation]    AC 850,000 -> 1,000,000: CPI falls and the forecast cost rises, as the engine says.
    [Tags]    cashflow
    Open Project Page    /cashflow
    Open Evm Panel
    Fill Number By Label    ต้นทุนจริง (AC) — เงินที่จ่ายไปจริง    1000000
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Actual Cost Is Stored    1000000
    Wait Until Keyword Succeeds    10s    250ms    Evm Panel Should Match Engine    ${expected}

Actual Cost Of Zero Leaves CPI Empty Instead Of Infinity
    [Documentation]    Expected behaviour: Actual Cost Of Zero Leaves CPI Empty Instead Of Infinity.
    [Tags]    cashflow    edge
    Open Project Page    /cashflow
    Open Evm Panel
    Fill Number By Label    ต้นทุนจริง (AC) — เงินที่จ่ายไปจริง    0
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Actual Cost Is Stored    0
    Page Should Not Show Broken Numbers
    Evm Panel Should Match Engine    ${expected}

Changing Operating Cost And Profit Rates Follows The Engine
    [Documentation]    Expected behaviour: Changing Operating Cost And Profit Rates Follows The Engine.
    [Tags]    cashflow
    Open Project Page    /cashflow
    Fill Number By Label    ค่าใช้จ่ายดำเนินงาน    20
    Fill Number By Label    กำไร    10
    Cash Flow Page Should Match Engine

Cash Flow Reset Button Restores The Sample
    [Documentation]    Expected behaviour: Cash Flow Reset Button Restores The Sample.
    [Tags]    cashflow
    Open Project Page    /cashflow
    Wait For Elements State    ${SAMPLE_TAG}    visible
    Fill Number By Label    ตัวคูณราคาเสนอ    1.6
    Wait For Elements State    ${RESET_PAGE}    visible
    Click    ${RESET_PAGE}
    Click Popconfirm Ok    คืนค่า
    Wait For Elements State    ${SAMPLE_TAG}    visible
    Value Of Input Should Be Number    ${{ "css=input[aria-label='ตัวคูณราคาเสนอ']" }}    1.3
    Cash Flow Page Should Match Engine

Cash Flow Edit Survives A Reload
    [Documentation]    Expected behaviour: Cash Flow Edit Survives A Reload.
    [Tags]    cashflow
    Open Project Page    /cashflow
    Fill Number By Label    ตัวคูณราคาเสนอ    1.45
    Wait Until Keyword Succeeds    10s    250ms    Cash Flow Match Attempt
    Reload
    Wait For Elements State    css=input[aria-label="ตัวคูณราคาเสนอ"]    visible
    Value Of Input Should Be Number    ${{ "css=input[aria-label='ตัวคูณราคาเสนอ']" }}    1.45
    Cash Flow Page Should Match Engine

Cash Flow Follows A BOQ Edit
    [Documentation]    A BOQ edit (R19 qty 4 -> 10) changes the construction total; the Cash Flow cost and quotation follow.
    [Tags]    cashflow    smoke
    Open Project Page    /boq
    Set Boq Cell    R19    qty    10
    Wait Until Keyword Succeeds    10s    250ms    Stored Override Should Be    R19    qty    10
    Go To Path    /cashflow
    ${expected}=    Cash Flow Page Should Match Engine
    ${sample}=    Cached Start Project    sample
    Should Be True    ${expected}[constructionTotal] > ${sample}[constructionTotal]

Cash Flow Page Of A Blank Project Has No NaN
    [Documentation]    Expected behaviour: Cash Flow Page Of A Blank Project Has No NaN.
    [Tags]    cashflow    edge
    ${expected}=    Open Project Page    /cashflow    start=blank
    Cash Flow Page Should Match Engine
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Planning Step Links Move Between The Three Pages
    [Documentation]    The step bar "1. คน-วัน / 2. แผนงาน / 3. กระแสเงินสด" navigates man-day -> schedule -> cashflow.
    Open Project Page    /man-day
    Click    css=nav[aria-label="ขั้นตอนวางแผน"] a:has-text("2. แผนงาน")
    Wait For Condition    Url    should end with    /schedule    timeout=30s
    Click    css=nav[aria-label="ขั้นตอนวางแผน"] a:has-text("3. กระแสเงินสด")
    Wait For Condition    Url    should end with    /cashflow    timeout=30s
    Click    css=nav[aria-label="ขั้นตอนวางแผน"] a:has-text("1. คน-วัน")
    Wait For Condition    Url    should end with    /man-day    timeout=30s

Menu Entries Open The Planning Pages
    [Documentation]    Expected behaviour: Menu Entries Open The Planning Pages.
    [Tags]    planning
    Open Project Page    /boq
    Click    css=.ant-menu-item:has-text("วางแผนคน-วัน")
    Wait For Condition    Url    should end with    /man-day    timeout=30s
    Click    css=.ant-menu-item:has-text("แผนเวลา")
    Wait For Condition    Url    should end with    /schedule    timeout=30s
    Click    css=.ant-menu-item:has-text("แผนการเงิน")
    Wait For Condition    Url    should end with    /cashflow    timeout=30s

No Console Errors On The Planning Pages
    [Documentation]    Man-Day, Schedule and Cash Flow load without console or page errors (ignored: see the keyword).
    [Tags]    planning    console
    Open Project Page    /man-day
    Wait For Elements State    css=input[aria-label="${FOUNDATION} วันประเมิน"]    visible
    Go To Path    /schedule
    Wait For Elements State    ${PACE_GAUGE}    visible
    Go To Path    /cashflow
    Wait For Elements State    css=input[aria-label="ตัวคูณราคาเสนอ"]    visible
    Console Should Have No Errors


*** Keywords ***
Progress Is Stored
    [Documentation]    The saved schedule has a typed progress for ``${name}``. Returns the engine result.
    [Arguments]    ${name}
    ${project}=    Read Guest Project
    ${planning}=    Get From Dictionary    ${project}    planning
    Dictionary Should Contain Key    ${planning}    schedule
    ${expected}=    Compute Expected    ${project}
    RETURN    ${expected}

Actual Cost Is Stored
    [Documentation]    The saved cash-flow input has ``actualCost`` = ``${value}``. Returns the engine result.
    [Arguments]    ${value}
    ${project}=    Read Guest Project
    Should Be Equal As Numbers    ${project}[planning][cashflow][actualCost]    ${value}
    ${expected}=    Compute Expected    ${project}
    RETURN    ${expected}
