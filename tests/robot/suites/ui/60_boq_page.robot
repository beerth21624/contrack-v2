*** Settings ***
Documentation       W4 / BOQ page ``/boq`` (src/features/boq-home/BoqHomePage.tsx): totals equal the engine, editing a
...                 quantity / price / waste writes an override that the engine applies, clearing it restores the template,
...                 hostile input (negative, zero, huge, text, formulas) never breaks a number, skipped levels show 0.
...                 Edited row: R19 "ห้องพักคนงาน" (site camp, section 3): qty 4 x (material 7,000 + labour 1,000) in the
...                 Excel v5 sample = 32,000 baht.
Resource            ../../resources/pages/boq_planning.resource
Suite Setup         Setup W4 Suite
Test Teardown       Close Test Context
Test Tags           boq    w4


*** Variables ***
${ROW}              R19
${RESET_SECTION}    button[aria-label="คืนค่าตั้งต้นหมวดนี้"]


*** Test Cases ***
Sample House Grand Total Is 1855162 Baht
    [Documentation]    Business rule: the Excel v5 sample house costs 1,855,162 baht (docs/excel-spec). The page shows the
    ...    engine's number in the top card and in the table footer.
    [Tags]    smoke
    ${expected}=    Open Project Page    /boq
    Number Of Element Should Be    ${GRAND_TOTAL}    1855162.25    0.006
    Number Of Element Should Be    ${TABLE_GRAND}    ${expected}[constructionTotal]    0.006
    Page Should Have No Error Overlay

Every Section Total Equals The Engine
    [Documentation]    Loops over all 32 sections: the header total of each equals the engine's section total.
    [Tags]    smoke
    ${expected}=    Open Project Page    /boq
    Length Should Be    ${expected}[sections]    32
    Boq Totals Should Match Engine    ${expected}

Land Survey 7500 Is Shown Outside The Construction Total
    [Documentation]    Section 0 (ค่าตรวจสอบที่ดิน, lump sum 7,500) is a pre-construction cost: it shows in its own card and
    ...    is not part of "รวมต้นทุนก่อสร้างทั้งหมด".
    ${expected}=    Open Project Page    /boq
    Number Of Element Should Be    ${PRE_TOTAL}    7500    0.006
    ${section0}=    Boq Section Total Selector    0
    Number Of Element Should Be    ${section0}    7500    0.006
    ${with_survey}=    Evaluate    $expected['constructionTotal'] + 7500
    ${shown}=    Get Text    ${GRAND_TOTAL}
    ${shown_number}=    Parse Thai Number    ${shown}
    Should Not Be Equal As Numbers    ${shown_number}    ${with_survey}

Grand Total Equals The Sum Of Sections 1 To 31 On Screen
    [Documentation]    Adds the section header totals of sections 1-31 as the page prints them: equals the grand total.
    ${expected}=    Open Project Page    /boq
    VAR    ${sum}    ${0}
    FOR    ${no}    IN RANGE    1    32
        ${sel}=    Boq Section Total Selector    ${no}
        ${text}=    Get Text    ${sel}
        ${number}=    Parse Thai Number    ${text}
        ${sum}=    Evaluate    ${sum} + ${number}
    END
    Number Of Element Should Be    ${GRAND_TOTAL}    ${sum}    0.2

Footer Total Row Equals The Top Card
    [Documentation]    Expected behaviour: Footer Total Row Equals The Top Card.
    ${expected}=    Open Project Page    /boq
    ${card}=    Get Text    ${GRAND_TOTAL}
    ${footer}=    Get Text    ${TABLE_GRAND}
    Should Be Equal As Numbers    ${{ float('${card}'.replace('฿', '').replace(',', '')) }}    ${{ float('${footer}'.replace(',', '')) }}

Row Totals Add Up To Each Section Subtotal
    [Documentation]    Screen-only consistency of all 32 sections: sum of the row totals = the section's subtotal row.
    Open Project Page    /boq
    Section Sums On Screen Should Match

Material Plus Labour Equals Row Total
    [Documentation]    The total of a priced row is its material total plus its labour total (rows of sections 2-5, 17).
    Open Project Page    /boq
    FOR    ${key}    IN    R16    R19    R20    R32    R35
        Boq Row Total Should Be Material Plus Labour    ${key}
    END

Project Name Field Shows The Sample Name
    [Documentation]    Expected behaviour: Project Name Field Shows The Sample Name.
    ${expected}=    Open Project Page    /boq
    ${name}=    Get Property    css=[aria-label="📂 โครงการ"]    value
    Should Be Equal    ${name}    ${expected}[project][meta][projectName]

Editing Quantity Updates Row Section And Grand Total
    [Documentation]    R19 qty 4 -> 6: row total = 6 x 8,000 = 48,000; the section and grand totals follow the engine.
    [Tags]    smoke
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    6
    Boq Cell Should Show    ${ROW}    qty    6
    ${row_total}=    Boq Row Cell    ${ROW}    total
    Wait Until Keyword Succeeds    10s    250ms    Number Of Element Should Be    ${row_total}    48000    0.006
    ${expected}=    Boq Should Match Stored Project
    Stored Override Should Be    ${ROW}    qty    6
    Boq Row Total Should Be Material Plus Labour    ${ROW}
    Section Sums On Screen Should Match

Editing Quantity To A Decimal Keeps Two Decimals
    [Documentation]    Expected behaviour: Editing Quantity To A Decimal Keeps Two Decimals.
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    2.5
    Boq Cell Should Show    ${ROW}    qty    2.5
    ${row_total}=    Boq Row Cell    ${ROW}    total
    Wait Until Keyword Succeeds    10s    250ms    Number Of Element Should Be    ${row_total}    20000    0.006
    Boq Should Match Stored Project

Editing Material Price Updates Row And Totals
    [Documentation]    R19 material 7,000 -> 7,500: row = 4 x 7,500 + 4 x 1,000 = 34,000.
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    mat    7500
    Boq Cell Should Show    ${ROW}    mat    7500
    ${row_total}=    Boq Row Cell    ${ROW}    total
    Wait Until Keyword Succeeds    10s    250ms    Number Of Element Should Be    ${row_total}    34000    0.006
    Boq Should Match Stored Project
    Stored Override Should Be    ${ROW}    mat    7500

Editing Labour Price Updates Row And Totals
    [Documentation]    R19 labour 1,000 -> 1,500: row = 4 x 7,000 + 4 x 1,500 = 34,000.
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    lab    1500
    Boq Cell Should Show    ${ROW}    lab    1500
    ${row_total}=    Boq Row Cell    ${ROW}    total
    Wait Until Keyword Succeeds    10s    250ms    Number Of Element Should Be    ${row_total}    34000    0.006
    Boq Should Match Stored Project
    Stored Override Should Be    ${ROW}    lab    1500

Editing Waste Percent Writes A Fraction And Follows The Engine
    [Documentation]    Typing 10 in %เผื่อ stores 0.1; the gross quantity grows (4 -> 4.4) and the engine decides the totals.
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    waste    10
    Boq Cell Should Show    ${ROW}    waste    10
    Stored Override Should Be    ${ROW}    waste    0.1
    ${gross}=    Boq Row Cell    ${ROW}    gross
    Wait Until Keyword Succeeds    10s    250ms    Number Of Element Should Be    ${gross}    4.4    0.006
    Boq Should Match Stored Project
    Boq Row Total Should Be Material Plus Labour    ${ROW}

Waste Percent Accepts A Typed Percent Sign
    [Documentation]    Expected behaviour: Waste Percent Accepts A Typed Percent Sign.
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    waste    15%
    Boq Cell Should Show    ${ROW}    waste    15
    Stored Override Should Be    ${ROW}    waste    0.15
    Boq Should Match Stored Project

Edited Cell Is Marked Bold
    [Documentation]    An overridden value shows in bold (font weight 700) so the user can see what differs from the template.
    Open Project Page    /boq
    ${sel}=    Boq Input    ${ROW}    qty
    ${before}=    Get Style    ${sel}    font-weight
    Set Boq Cell    ${ROW}    qty    5
    Get Style    ${sel}    font-weight    ==    700
    Should Not Be Equal    ${before}    700

Clearing An Override Restores The Template Value
    [Documentation]    Empty cell + Enter removes the override: qty back to 4 and the totals back to the sample's.
    ${original}=    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    9
    Boq Cell Should Show    ${ROW}    qty    9
    Boq Should Match Stored Project
    Set Boq Cell    ${ROW}    qty    ${EMPTY}
    Boq Cell Should Show    ${ROW}    qty    4
    Stored Override Should Be Absent    ${ROW}    qty
    Wait Until Keyword Succeeds    10s    250ms    Boq Totals Should Match Engine    ${original}

Reset Section Button Restores The Whole Section
    [Documentation]    After two edits in section 3 the "คืนค่าตั้งต้นหมวดนี้" button appears; pressing it restores the template.
    ${original}=    Open Project Page    /boq
    Wait For Elements State    css=#boq-section-3 ${RESET_SECTION}    detached
    Set Boq Cell    ${ROW}    qty    7
    Set Boq Cell    ${ROW}    mat    9999
    Wait For Elements State    css=#boq-section-3 ${RESET_SECTION}    visible
    Click    css=#boq-section-3 ${RESET_SECTION}
    Boq Cell Should Show    ${ROW}    qty    4
    Boq Cell Should Show    ${ROW}    mat    7000
    Stored Override Should Be Absent    ${ROW}    qty
    Stored Override Should Be Absent    ${ROW}    mat
    Wait Until Keyword Succeeds    10s    250ms    Boq Totals Should Match Engine    ${original}
    Wait For Elements State    css=#boq-section-3 ${RESET_SECTION}    detached

Escape Cancels An Edit
    [Documentation]    Expected behaviour: Escape Cancels An Edit.
    [Tags]    edge
    Open Project Page    /boq
    ${sel}=    Boq Input    ${ROW}    qty
    Click    ${sel}
    Fill Text    ${sel}    99
    Keyboard Key    press    Escape
    Boq Cell Should Show    ${ROW}    qty    4
    Stored Override Should Be Absent    ${ROW}    qty

Leaving A Cell Without Typing Changes Nothing
    [Documentation]    Expected behaviour: Leaving A Cell Without Typing Changes Nothing.
    [Tags]    edge
    Open Project Page    /boq
    ${sel}=    Boq Input    ${ROW}    qty
    Click    ${sel}
    Keyboard Key    press    Tab
    Stored Override Should Be Absent    ${ROW}    qty

Formula With Multiplication Is Evaluated
    [Documentation]    Excel-style "7*2.3" is read as 16.1.
    [Tags]    edge
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    7*2.3
    Boq Cell Should Show    ${ROW}    qty    16.1
    Boq Should Match Stored Project

Formula Starting With Equals Sign Is Evaluated
    [Documentation]    Expected behaviour: Formula Starting With Equals Sign Is Evaluated.
    [Tags]    edge
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    =12+3.5
    Boq Cell Should Show    ${ROW}    qty    15.5
    Boq Should Match Stored Project

Formula With Brackets And Division Is Evaluated
    [Documentation]    Expected behaviour: Formula With Brackets And Division Is Evaluated.
    [Tags]    edge
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    (4+2)*0.9/3
    Boq Cell Should Show    ${ROW}    qty    1.8
    Boq Should Match Stored Project

Thousands Separators Are Accepted
    [Documentation]    Expected behaviour: Thousands Separators Are Accepted.
    [Tags]    edge
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    mat    1,250.5
    Boq Cell Should Show    ${ROW}    mat    1250.5
    Boq Should Match Stored Project

Letters Are Rejected And The Old Value Stays
    [Documentation]    "abc" is not a number: the cell keeps 4, nothing is stored, totals unchanged.
    [Tags]    edge    negative
    ${original}=    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    abc
    Boq Cell Should Show    ${ROW}    qty    4
    Stored Override Should Be Absent    ${ROW}    qty
    Boq Totals Should Match Engine    ${original}
    Page Should Not Show Broken Numbers

Script Text In A Number Cell Is Rejected
    [Documentation]    A script tag typed into a number cell is rejected like any other text; nothing runs.
    [Tags]    edge    negative    security
    ${original}=    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    <script>window.__xss=1</script>
    Boq Cell Should Show    ${ROW}    qty    4
    ${flag}=    Evaluate JavaScript    ${None}    () => window.__xss === undefined
    Should Be True    ${flag}
    Boq Totals Should Match Engine    ${original}

Division By Zero Is Rejected
    [Documentation]    Expected behaviour: Division By Zero Is Rejected.
    [Tags]    edge    negative
    ${original}=    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    5/0
    Boq Cell Should Show    ${ROW}    qty    4
    Stored Override Should Be Absent    ${ROW}    qty
    Boq Totals Should Match Engine    ${original}

Number Beyond Floating Point Range Is Rejected
    [Documentation]    1e400 would be Infinity: the cell must keep the old value and every total stays finite.
    [Tags]    edge    negative
    ${original}=    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    1e400
    Boq Cell Should Show    ${ROW}    qty    4
    Boq Totals Should Match Engine    ${original}
    Page Should Not Show Broken Numbers

Negative Quantity Never Produces NaN And Follows The Engine
    [Documentation]    Behaviour recorded: a negative quantity is accepted as typed (credit line) and the totals equal the
    ...    engine's for the stored project. The page must not show NaN and must not crash.
    [Tags]    edge    negative
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    -5
    Boq Cell Should Show    ${ROW}    qty    -5
    Boq Should Match Stored Project
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Negative Price Never Produces NaN And Follows The Engine
    [Documentation]    Expected behaviour: Negative Price Never Produces NaN And Follows The Engine.
    [Tags]    edge    negative
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    mat    -100
    Boq Cell Should Show    ${ROW}    mat    -100
    Boq Should Match Stored Project
    Page Should Not Show Broken Numbers

Zero Quantity Makes The Row Total Zero
    [Documentation]    Expected behaviour: Zero Quantity Makes The Row Total Zero.
    [Tags]    edge
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    0
    ${row_total}=    Boq Row Cell    ${ROW}    total
    Wait Until Keyword Succeeds    10s    250ms    Number Of Element Should Be    ${row_total}    0    0.006
    Boq Should Match Stored Project
    Stored Override Should Be    ${ROW}    qty    0

Huge Quantity Keeps Every Total Finite
    [Documentation]    999,999,999,999 units: 8,000 x that is 8e15; the page shows numbers (no NaN, no Infinity), equal to the engine.
    [Tags]    edge
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    999999999999
    Boq Should Match Stored Project
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Waste Of One Hundred Percent Doubles The Gross Quantity
    [Documentation]    Expected behaviour: Waste Of One Hundred Percent Doubles The Gross Quantity.
    [Tags]    edge
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    waste    100
    ${gross}=    Boq Row Cell    ${ROW}    gross
    Wait Until Keyword Succeeds    10s    250ms    Number Of Element Should Be    ${gross}    8    0.006
    Boq Should Match Stored Project

Negative Waste Never Produces NaN
    [Documentation]    Expected behaviour: Negative Waste Never Produces NaN.
    [Tags]    edge    negative
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    waste    -10
    Boq Should Match Stored Project
    Page Should Not Show Broken Numbers

Several Edits In Different Sections All Follow The Engine
    [Documentation]    Section 3 (R19 qty), section 5 (R35 labour price), section 2 (R16 material): grand total equals the engine.
    Open Project Page    /boq
    Set Boq Cell    R19    qty    5
    Set Boq Cell    R35    lab    2600
    Set Boq Cell    R16    mat    7000
    Boq Cell Should Show    R35    lab    2600
    Boq Cell Should Show    R16    mat    7000
    Boq Should Match Stored Project
    Section Sums On Screen Should Match

Blank Project BOQ Shows Only The Documented Lump Sums
    [Documentation]    A new project from my own plan: construction total 18,200 = three typed lump sums (R16 2,700 + R32 5,500
    ...    + R158 10,000, see src/domain/__tests__/project.edge.test.ts), land survey 7,500 aside, no NaN anywhere.
    ${expected}=    Open Project Page    /boq    start=blank
    Number Of Element Should Be    ${GRAND_TOTAL}    18200    0.006
    Number Of Element Should Be    ${PRE_TOTAL}    7500    0.006
    Boq Totals Should Match Engine    ${expected}
    Page Should Not Show Broken Numbers
    Page Should Have No Error Overlay

Blank Project Sections Without Money Show Zero
    [Documentation]    Foundation (section 6) of a blank project is 0.00 in the header and in the subtotal row.
    ${expected}=    Open Project Page    /boq    start=blank
    ${sel}=    Boq Section Total Selector    6
    Get Text    ${sel}    ==    0.00
    Section Sums On Screen Should Match

Skipped Level Shows Zero In Its Section And Row
    [Documentation]    Piles (เสาเข็ม) marked "ไม่มีในโครงการนี้": section 5 is 0.00, the row quantity and total are 0 and the
    ...    grand total drops by 56,070 baht: the piles
    ...    52,500 plus R39 "ตัดหัวเสาเข็ม" (21 piles x 170 = 3,570, its quantity follows the piles).
    [Tags]    edge
    ${project}=    Sample Project With Journey    piles=skipped
    ${expected}=    Open Project Object Page    /boq    ${project}
    ${sel}=    Boq Section Total Selector    5
    Get Text    ${sel}    ==    0.00
    Boq Cell Should Show    R35    qty    0
    ${row_total}=    Boq Row Cell    R35    total
    Get Text    ${row_total}    ==    0.00
    ${sample}=    Cached Start Project    sample
    ${diff}=    Evaluate    $sample['constructionTotal'] - $expected['constructionTotal']
    Should Be Equal As Numbers    ${diff}    56070    precision=2
    Boq Totals Should Match Engine    ${expected}

Typed Quantity On A Skipped Level Does Not Bring The Money Back
    [Documentation]    The BOQ page has a typed qty override for R32 (layout) but the level "วางผัง / ปักหมุด" is skipped:
    ...    the row stays 0.
    [Tags]    edge
    ${project}=    Sample Project With Journey    layout=skipped
    VAR    &{overrides}    R32=${{ {'qty': 5} }}
    Set To Dictionary    ${project}    boqOverrides=${overrides}
    ${expected}=    Open Project Object Page    /boq    ${project}
    ${row_total}=    Boq Row Cell    R32    total
    Get Text    ${row_total}    ==    0.00
    Boq Totals Should Match Engine    ${expected}

Collapse All Hides The Rows And Expand All Brings Them Back
    [Documentation]    Expected behaviour: Collapse All Hides The Rows And Expand All Brings Them Back.
    Open Project Page    /boq
    ${all}=    Get Element Count    css=tr[data-boq-row]
    Should Be True    ${all} > 100
    Click    css=button:has-text("ย่อทั้งหมด")
    Get Element Count    css=tr[data-boq-row]    ==    0
    ${sel}=    Boq Section Total Selector    6
    Get Text    ${sel}    !=    ${EMPTY}
    Click    css=button:has-text("ขยายทั้งหมด")
    Get Element Count    css=tr[data-boq-row]    ==    ${all}

Section Heading Button Collapses One Section
    [Documentation]    Expected behaviour: Section Heading Button Collapses One Section.
    Open Project Page    /boq
    ${all}=    Get Element Count    css=tr[data-boq-row]
    Click    css=#boq-section-3 button[aria-label="งานเตรียมพื้นที่หน้างาน"]
    ${now}=    Get Element Count    css=tr[data-boq-row]
    Should Be True    ${now} < ${all}
    Get Element Count    css=#boq-section-3 tr[data-boq-row]    ==    0

Search Filters Rows And Shows The Match Count
    [Documentation]    Expected behaviour: Search Filters Rows And Shows The Match Count.
    Open Project Page    /boq
    Fill Text    css=input[aria-label="ค้นหารายการ"]    เสาเข็ม
    Get Text    css=body    matches    (?s).*พบ \\d+ รายการ.*
    ${rows}=    Get Element Count    css=tr[data-boq-row]
    Should Be True    ${rows} >= 1
    Get Element Count    css=tr[data-boq-row] >> mark    >=    1
    Click    css=.ant-input-clear-icon
    ${back}=    Get Element Count    css=tr[data-boq-row]
    Should Be True    ${back} > ${rows}

Search Without Match Shows An Empty State
    [Documentation]    Expected behaviour: Search Without Match Shows An Empty State.
    [Tags]    edge
    Open Project Page    /boq
    Fill Text    css=input[aria-label="ค้นหารายการ"]    zzzไม่มีรายการนี้
    Get Text    css=body    contains    ไม่พบรายการที่ตรงกับคำค้น
    Get Element Count    css=tr[data-boq-row]    ==    0
    Click    css=button:has-text("ล้างคำค้น")
    Get Element Count    css=tr[data-boq-row]    >    0

Section Link Opens The Calculator
    [Documentation]    The "ฐานราก Footing" link in section 6 goes to /calc/footing.
    Open Project Page    /boq
    Click    css=#boq-section-6 a[href="/calc/footing"]
    Wait For Condition    Url    should end with    /calc/footing    timeout=30s
    Page Should Have No Error Overlay

Edit Survives A Reload
    [Documentation]    Expected behaviour: Edit Survives A Reload.
    Open Project Page    /boq
    Set Boq Cell    ${ROW}    qty    8
    Stored Override Should Be    ${ROW}    qty    8
    Reload
    Wait For Elements State    css=[data-boq-row="${ROW}"]    visible
    Boq Cell Should Show    ${ROW}    qty    8
    Boq Should Match Stored Project
