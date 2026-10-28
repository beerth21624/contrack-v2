*** Settings ***
Documentation       Page keywords of the BOQ page, the calculator full view, the three planning pages (Man-Day,
...                 Schedule, Cash Flow), export, journey map and the new-project modal (area W4).
...                 Every number on screen is compared with the engine through ``Expected For Current Guest Project``
...                 (the project the app saved in localStorage), never with a number copied from the screen.
Resource            ../common.resource
Resource            ../journey.resource


*** Variables ***
${GRAND_TOTAL}              xpath=//span[normalize-space()="รวมต้นทุนก่อสร้างทั้งหมด"]/following-sibling::div[1]
${PRE_TOTAL}                xpath=//span[starts-with(normalize-space(),"ค่าใช้จ่ายก่อนก่อสร้าง")]/following-sibling::div[1]
${TABLE_GRAND}              css=tr.bg-orange-50 td.text-orange-600
${NEW_PROJECT_BUTTON}       css=button:has-text("โครงการใหม่")
${EXCEL_BUTTON}             css=button:has-text("ดาวน์โหลด Excel")
${PRINT_BUTTON}             css=button:has-text("พิมพ์ / PDF")
${SCURVE_TOGGLE}            css=button[aria-expanded]:has-text("S-Curve แผนงานเทียบผลงาน")
${PACE_GAUGE}               css=svg[aria-label^="มาตรวัดความเร็วโครงการ"]
${SCURVE_CHART}             css=svg[aria-label^="กราฟ S-Curve"]
${EVM_TOGGLE}               css=.ant-collapse-header:has-text("วิเคราะห์ผลงานเทียบงบ (EVM)")
${LEVEL_STATES_JS}          () => [...document.querySelectorAll('ol > li')].map(li => !li.querySelector('a') ? 'locked' : li.querySelector('.bg-green-600') ? 'done' : li.textContent.includes('ไม่มีในโครงการนี้') ? 'skipped' : 'current')
${LEVEL_TEXTS_JS}           () => [...document.querySelectorAll('ol > li')].map(li => li.innerText.split(/[ ]+/).join(' '))
${NO_HSCROLL_JS}            () => document.documentElement.scrollWidth <= window.innerWidth
${SCROLL_WIDTHS_JS}         () => document.documentElement.scrollWidth + '/' + window.innerWidth
${ROW_SUMS_JS}              () => [...document.querySelectorAll('tbody[id^="boq-section-"]')].map(tb => { const num = s => parseFloat(s.replace(/,/g, '')) || 0; const rows = [...tb.querySelectorAll('tr[data-boq-row]')]; const sum = rows.reduce((a, r) => a + num(r.children[11].innerText), 0); const sub = tb.querySelector('tr:last-child td:nth-last-child(2)'); return [tb.id, sum, sub ? num(sub.innerText) : null]; })
${PRINT_STUB_JS}            () => { window.__printCalls = 0; window.__printText = ''; window.__printTitle = ''; window.print = () => { window.__printCalls += 1; window.__printTitle = document.title; const r = document.querySelector('.boqp-root'); window.__printText = r ? r.textContent : ''; }; }
@{IGNORED_CONSOLE}          Download the React DevTools    [Fast Refresh]    [HMR]    hot-update    favicon    webpack-hmr
&{BOQ_FIELD_LABEL}          qty=ปริมาณ    waste=%เผื่อ    mat=ค่าวัสดุ    lab=ค่าแรงงาน    note=หมายเหตุ
&{BOQ_COLUMN}               gross=7    matTotal=9    labTotal=11    total=12
&{PROJECT_CACHE}            &{EMPTY}
@{WARM_ROUTES}              /    /journey    /boq    /man-day    /schedule    /cashflow    /calc/footing    /calc/brick    /calc/paint    /journey/land-inspection


*** Keywords ***
Setup W4 Suite
    [Documentation]    One browser for the suite, a longer timeout (Next compiles every route on first visit) and every
    ...    route of this area visited once so that no test pays for the compile.
    Open Browser For Suite
    Set Browser Timeout    30s
    New Context    locale=th-TH    timezoneId=Asia/Bangkok
    New Page
    FOR    ${route}    IN    @{WARM_ROUTES}
        Go To    ${BASE_URL}${route}    timeout=150s
        Wait For Load State    networkidle    timeout=150s
    END
    Close Context

Cached Start Project
    [Documentation]    Engine result of a new project (``blank`` / ``sample``), computed once per run.
    [Arguments]    ${start}
    ${cached}=    Get From Dictionary    ${PROJECT_CACHE}    ${start}    default=${None}
    IF    $cached is None
        ${cached}=    Compute Expected For New Project    ${start}
        Set To Dictionary    ${PROJECT_CACHE}    ${start}=${cached}
    END
    RETURN    ${cached}

Open Project Page
    [Documentation]    Fresh context (own localStorage), the guest project stored, then ``${path}`` opened.
    ...    ``${unlock_until}`` marks every level before it done. Returns the engine result of the stored project.
    [Arguments]    ${path}    ${start}=sample    ${unlock_until}=${EMPTY}    ${viewport_width}=1440    ${viewport_height}=900
    ${expected}=    Cached Start Project    ${start}
    VAR    ${project}    ${expected}[project]
    IF    '${unlock_until}' != '${EMPTY}'
        ${project}=    Project With Levels Done    ${project}    ${unlock_until}
        ${expected}=    Compute Expected    ${project}
    END
    Open Fresh Context    /journey    ${viewport_width}    ${viewport_height}
    Seed Guest Project    ${project}    ${path}
    RETURN    ${expected}

Open Project Object Page
    [Documentation]    Same as ``Open Project Page`` for a project dict the test built. Returns the engine result.
    [Arguments]    ${path}    ${project}    ${viewport_width}=1440    ${viewport_height}=900
    ${expected}=    Compute Expected    ${project}
    Open Fresh Context    /journey    ${viewport_width}    ${viewport_height}
    Seed Guest Project    ${project}    ${path}
    RETURN    ${expected}

Sample Project With Journey
    [Documentation]    The sample house with its journey marks replaced, e.g. ``piles=skipped``.
    [Arguments]    &{marks}
    ${expected}=    Cached Start Project    sample
    ${project}=    Copy Dictionary    ${expected}[project]    deepcopy=True
    VAR    &{journey}    &{marks}
    Set To Dictionary    ${project}    journey=${journey}
    RETURN    ${project}

Close Test Context
    [Documentation]    Test teardown: free the context (the screenshot of a failure is taken before this).
    Close Context

Page Should Not Show Broken Numbers
    [Documentation]    No NaN / Infinity / undefined text anywhere on the page.
    Get Text    css=body    not contains    NaN
    Get Text    css=body    not contains    Infinity
    Get Text    css=body    not contains    undefined

Console Should Have No Errors
    [Documentation]    No console error and no uncaught page error since the page was opened. Ignored: Next dev noise
    ...    (React DevTools hint, Fast Refresh / HMR messages, hot-update files, favicon requests) and the browser's own
    ...    "401 (Unauthorized)" line for the guest session probe of the API (a guest has no session by design).
    ${log}=    Get Console Log    full=True
    VAR    @{errors}
    FOR    ${entry}    IN    @{log}
        IF    $entry['type'] != 'error'    CONTINUE
        ${ignored}=    Console Entry Is Ignored    ${entry}
        IF    not ${ignored}    Append To List    ${errors}    ${entry}[type]: ${entry}[text]
    END
    Should Be Empty    ${errors}    msg=Console errors: ${errors}
    ${page_errors}=    Get Page Errors    full=True
    Should Be Empty    ${page_errors}    msg=Page errors: ${page_errors}

Console Entry Is Ignored
    [Documentation]    True for the known noise listed in ``Console Should Have No Errors``.
    [Arguments]    ${entry}
    FOR    ${pattern}    IN    @{IGNORED_CONSOLE}
        IF    $pattern in $entry['text']    RETURN    ${True}
    END
    ${url}=    Get From Dictionary    ${entry}[location]    url    default=${EMPTY}
    IF    '401 (Unauthorized)' in $entry['text'] and $url.startswith($API_URL)    RETURN    ${True}
    RETURN    ${False}

Format Iso Date
    [Documentation]    2026-01-10 -> 10/01/2026 (empty stays empty).
    [Arguments]    ${iso}
    IF    $iso is None or $iso == ''    RETURN    ${EMPTY}
    ${text}=    Evaluate    '/'.join(reversed($iso.split('-')))
    RETURN    ${text}

Value Of Input Should Be Number
    [Documentation]    The value of an input equals ``${expected}`` as a number.
    [Arguments]    ${selector}    ${expected}    ${tolerance}=0.006
    ${text}=    Get Property    ${selector}    value
    Numbers Should Be Close    ${text}    ${expected}    ${tolerance}
    ...    msg=${selector} shows "${text}", expected ${expected}

# ── BOQ page ─────────────────────────────────────────────────────────────────────────

Boq Input
    [Documentation]    Selector of one cell of a BOQ row: ``${field}`` is qty, waste, mat, lab or note.
    [Arguments]    ${key}    ${field}
    ${suffix}=    Get From Dictionary    ${BOQ_FIELD_LABEL}    ${field}
    RETURN    css=[data-boq-row="${key}"] [aria-label$="${suffix}"]

Boq Row Cell
    [Documentation]    Selector of a computed cell of a BOQ row: gross, matTotal, labTotal or total.
    [Arguments]    ${key}    ${column}
    ${n}=    Get From Dictionary    ${BOQ_COLUMN}    ${column}
    RETURN    css=[data-boq-row="${key}"] td:nth-child(${n})

Boq Section Total Selector
    [Arguments]    ${no}
    RETURN    css=#boq-section-${no} > tr:first-child span.ml-auto

Set Boq Cell
    [Documentation]    Type into a BOQ cell and commit with Enter (the cell commits on blur).
    [Arguments]    ${key}    ${field}    ${text}
    ${sel}=    Boq Input    ${key}    ${field}
    Click    ${sel}
    Fill Text    ${sel}    ${text}
    Keyboard Key    press    Enter

Boq Cell Should Show
    [Documentation]    The cell shows ``${expected}`` as a number (a percent cell shows its whole percent).
    [Arguments]    ${key}    ${field}    ${expected}    ${tolerance}=0.006
    ${sel}=    Boq Input    ${key}    ${field}
    Wait Until Keyword Succeeds    10s    250ms    Value Of Input Should Be Number    ${sel}    ${expected}    ${tolerance}

Boq Totals Should Match Engine
    [Documentation]    Grand total, land survey (pre-construction) card, footer row and every section header equal the
    ...    engine's numbers for ``${expected}``.
    [Arguments]    ${expected}
    Number Of Element Should Be    ${GRAND_TOTAL}    ${expected}[constructionTotal]    0.006
    Number Of Element Should Be    ${TABLE_GRAND}    ${expected}[constructionTotal]    0.006
    Number Of Element Should Be    ${PRE_TOTAL}    ${expected}[preConstructionTotal]    0.006
    FOR    ${section}    IN    @{expected}[sections]
        ${sel}=    Boq Section Total Selector    ${section}[no]
        Number Of Element Should Be    ${sel}    ${section}[total]    0.006
    END

Boq Should Match Stored Project
    [Documentation]    Re-reads the saved project, runs the engine on it and compares the whole page (retries while the
    ...    store flushes to localStorage). Returns the engine result.
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Boq Match Attempt
    RETURN    ${expected}

Boq Match Attempt
    [Documentation]    One comparison of the page with the engine run on the saved project.
    ${expected}=    Expected For Current Guest Project
    Boq Totals Should Match Engine    ${expected}
    RETURN    ${expected}

Stored Override Should Be
    [Documentation]    ``project.boqOverrides[key][field]`` in localStorage equals ``${value}`` (fractions for waste).
    [Arguments]    ${key}    ${field}    ${value}
    ${project}=    Wait Until Keyword Succeeds    10s    250ms    Override Is Stored    ${key}    ${field}
    VAR    ${actual}    ${project}[boqOverrides][${key}][${field}]
    Should Be Equal As Numbers    ${actual}    ${value}

Override Is Stored
    [Arguments]    ${key}    ${field}
    ${project}=    Read Guest Project
    ${overrides}=    Get From Dictionary    ${project}    boqOverrides
    Dictionary Should Contain Key    ${overrides}    ${key}
    Dictionary Should Contain Key    ${overrides}[${key}]    ${field}
    RETURN    ${project}

Stored Override Should Be Absent
    [Arguments]    ${key}    ${field}
    ${project}=    Read Guest Project
    ${overrides}=    Get From Dictionary    ${project}    boqOverrides
    ${row}=    Get From Dictionary    ${overrides}    ${key}    default=${EMPTY}
    IF    $row    Dictionary Should Not Contain Key    ${row}    ${field}

Boq Row Total Should Be Material Plus Labour
    [Documentation]    Screen consistency of one row: total = material total + labour total.
    [Arguments]    ${key}
    ${mat_sel}=    Boq Row Cell    ${key}    matTotal
    ${lab_sel}=    Boq Row Cell    ${key}    labTotal
    ${total_sel}=    Boq Row Cell    ${key}    total
    ${mat}=    Get Text    ${mat_sel}
    ${lab}=    Get Text    ${lab_sel}
    ${sum}=    Evaluate    float($mat.replace(',', '') or 0) + float($lab.replace(',', '') or 0)
    Number Of Element Should Be    ${total_sel}    ${sum}    0.011

Section Sums On Screen Should Match
    [Documentation]    For every section: the sum of its row totals equals its subtotal row (screen-only consistency).
    ${rows}=    Evaluate JavaScript    ${None}    ${ROW_SUMS_JS}
    FOR    ${row}    IN    @{rows}
        IF    $row[2] is not None
            Should Be True    abs($row[1] - $row[2]) < 0.05    msg=${row}[0]: rows sum ${row}[1], subtotal shows ${row}[2]
        END
    END

# ── Man-Day ──────────────────────────────────────────────────────────────────────────

Man Day Row
    [Documentation]    Row of the Man-Day table that holds the "<title> วันประเมิน" input.
    [Arguments]    ${title}
    RETURN    css=tr:has(input[aria-label="${title} วันประเมิน"])

Man Day Cell
    [Documentation]    ``${n}``: 3 skilled, 4 labourers, 5 crew, 7 daily wage, 8 labour from BOQ, 9 calculated days, 10 days, 11 budget.
    [Arguments]    ${title}    ${n}
    ${row}=    Man Day Row    ${title}
    RETURN    ${row} >> td:nth-child(${n})

Set Man Day Days
    [Arguments]    ${title}    ${text}
    ${sel}=    Input By Label    ${title} วันประเมิน
    Click    ${sel}
    Fill Text    ${sel}    ${text}
    Keyboard Key    press    Enter

Set Man Day Crew
    [Documentation]    ``${column}``: 3 = skilled, 4 = labourers (these inputs have no aria-label: located by cell).
    [Arguments]    ${title}    ${column}    ${text}
    ${cell}=    Man Day Cell    ${title}    ${column}
    Click    ${cell} >> input
    Fill Text    ${cell} >> input    ${text}
    Keyboard Key    press    Enter

Open Wage Rates Tab
    [Documentation]    Man-Day tab "อัตราค่าแรง (N ชุด)": the wage sets as a table (and the subcontract labour share).
    Click    css=.ant-segmented-item:has-text("อัตราค่าแรง")
    Wait For Elements State    css=input[aria-label="ค่าแรงช่าง ชุด A"]    visible    timeout=30s

Open Man Day Plan Tab
    [Documentation]    Man-Day tab "แผนคน-วัน": the work blocks table.
    Click    css=.ant-segmented-item:has-text("แผนคน-วัน")
    Wait For Elements State    css=tbody tr >> nth=0    visible    timeout=30s

Man Day Page Should Match Engine
    [Documentation]    Every row (crew, wage, calculated days, typed days, budget) and the totals equal the engine.
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Man Day Match Attempt
    RETURN    ${expected}

Man Day Match Attempt
    [Documentation]    One comparison of the Man-Day page with the engine run on the saved project.
    ${expected}=    Expected For Current Guest Project
    VAR    ${md}    ${expected}[planning][manday]
    FOR    ${i}    ${block}    IN ENUMERATE    @{md}[blocks]
        VAR    ${row}    css=tbody tr >> nth=${i}
        Number Of Element Should Be    ${row} >> td:nth-child(5)    ${block}[crew]    0.01
        Number Of Element Should Be    ${row} >> td:nth-child(7)    ${block}[dailyWage]    0.5
        Value Of Input Should Be Number    ${row} >> td:nth-child(10) input    ${block}[days]    0.006
        Number Of Element Should Be    ${row} >> td:nth-child(11)    ${block}[budget]    0.006
        IF    $block['calcDays'] is not None
            Number Of Element Should Be    ${row} >> td:nth-child(9)    ${block}[calcDays]    0.006
        END
    END
    Number Of Element Should Be    css=tfoot tr td:last-child    ${md}[totalBudget]    0.006
    Number Of Element Should Be    css=tfoot tr td:nth-last-child(2)    ${md}[totalDays]    0.006
    RETURN    ${expected}

# ── Schedule ─────────────────────────────────────────────────────────────────────────

Task Row
    [Arguments]    ${name}
    RETURN    css=tr:has(input[aria-label="${name} ระยะเวลา"])

Task Finish Cell
    [Arguments]    ${name}
    ${row}=    Task Row    ${name}
    RETURN    ${row} >> td:nth-child(5)

Set Task Duration
    [Arguments]    ${name}    ${text}
    ${sel}=    Input By Label    ${name} ระยะเวลา
    Click    ${sel}
    Fill Text    ${sel}    ${text}
    Keyboard Key    press    Enter

Set Date By Label
    [Documentation]    Type a date (dd/mm/yyyy) into an Ant Design DatePicker input and commit with Enter.
    [Arguments]    ${label}    ${text}
    ${sel}=    Input By Label    ${label}
    Click    ${sel}
    Fill Text    ${sel}    ${text}
    Keyboard Key    press    Enter

Clear Date By Label
    [Documentation]    Hover the picker and press its clear icon.
    [Arguments]    ${label}
    VAR    ${picker}    css=.ant-picker:has(input[aria-label="${label}"])
    Hover    ${picker}
    Click    ${picker} .ant-picker-clear

Schedule Page Should Match Engine
    [Documentation]    Banner, project start and every task (duration, start, finish) equal the engine.
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Schedule Match Attempt
    RETURN    ${expected}

Schedule Match Attempt
    [Documentation]    One comparison of the Schedule page with the engine run on the saved project.
    ${expected}=    Expected For Current Guest Project
    VAR    ${s}    ${expected}[planning][schedule]
    FOR    ${i}    ${task}    IN ENUMERATE    @{s}[tasks]
        VAR    ${row}    css=tbody tr:has(input[aria-label$=" ระยะเวลา"]) >> nth=${i}
        Value Of Input Should Be Number    ${row} >> td:nth-child(3) input    ${task}[duration]    0.006
        ${start}=    Format Iso Date    ${task}[start]
        ${finish}=    Format Iso Date    ${task}[finish]
        Get Property    ${row} >> td:nth-child(4) input    value    ==    ${start}
        Get Text    ${row} >> td:nth-child(5)    ==    ${finish}
    END
    IF    $s['start']
        ${start}=    Format Iso Date    ${s}[start]
        ${finish}=    Format Iso Date    ${s}[finish]
        Get Text    css=body    contains    ใช้เวลา ${s}[durationDays] วัน เริ่ม ${start} เสร็จ ${finish}
        Get Property    css=input[aria-label="วันที่โครงการเริ่ม"]    value    ==    ${start}
    ELSE
        Get Text    css=body    contains    ยังไม่ได้กำหนดวันเริ่มงาน
    END
    RETURN    ${expected}

Gantt Bar Count Should Match Engine
    [Documentation]    Per task: the number of week cells with a plan bar equals the number of weeks with a planned share
    ...    within the weeks the grid draws (the grid stops at the last used month).
    [Arguments]    ${expected}
    ${weeks}=    Get Element Count    css=table:has(input[aria-label$=" ระยะเวลา"]) thead tr:nth-child(2) th
    FOR    ${i}    ${task}    IN ENUMERATE    @{expected}[planning][schedule][tasks]
        VAR    ${row}    css=tbody tr:has(input[aria-label$=" ระยะเวลา"]) >> nth=${i}
        ${want}=    Evaluate    sum(1 for v in $task['plan'][:int($weeks)] if v > 0)
        ${bars}=    Get Element Count    ${row} >> css=td:nth-child(n+6) > div:first-child[style*="background"]
        Should Be Equal As Integers    ${bars}    ${want}
        ...    msg=Task ${task}[id] ${task}[name]: ${bars} plan bars on screen, engine says ${want}
    END

# ── Cash flow ────────────────────────────────────────────────────────────────────────

Calc Field Value
    [Documentation]    Selector of the green value next to a label in the "ราคาและค่าใช้จ่าย" card.
    [Arguments]    ${label}
    RETURN    xpath=//span[normalize-space()="${label}"]/following-sibling::span[1]

Stat Tile Value
    [Documentation]    Selector of the value of a StatTile (``${label}`` is the exact tile label).
    [Arguments]    ${label}
    RETURN    xpath=//div[normalize-space()="${label}"]/following-sibling::div[1]

Cash Flow Page Should Match Engine
    [Documentation]    Cost, quotation, every installment amount, the installment footer and the tiles equal the engine.
    ${expected}=    Wait Until Keyword Succeeds    15s    500ms    Cash Flow Match Attempt
    RETURN    ${expected}

Cash Flow Match Attempt
    [Documentation]    One comparison of the Cash Flow page with the engine run on the saved project.
    ${expected}=    Expected For Current Guest Project
    VAR    ${cf}    ${expected}[planning][cashflow]
    ${cost}=    Calc Field Value    ต้นทุนก่อสร้าง
    ${quotation}=    Calc Field Value    ราคาเสนอลูกค้า
    Number Of Element Should Be    ${cost}    ${cf}[cost]    0.006
    Number Of Element Should Be    ${quotation}    ${cf}[quotation]    0.006
    FOR    ${i}    ${inst}    IN ENUMERATE    @{cf}[installments]
        Number Of Element Should Be    css=tbody tr >> nth=${i} >> td:nth-child(5)    ${inst}[amount]    0.006
        ${pct}=    Evaluate    $inst['pct'] * 100
        Value Of Input Should Be Number    css=tbody tr >> nth=${i} >> td:nth-child(3) input    ${pct}    0.51
    END
    ${sum}=    Evaluate    sum(i['amount'] for i in $cf['installments'])
    Number Of Element Should Be    css=tfoot tr td:nth-child(4)    ${sum}    0.011
    ${pct_total}=    Evaluate    $cf['installmentPctTotal'] * 100
    Number Of Element Should Be    css=tfoot tr td:nth-child(2)    ${pct_total}    0.51
    ${tile_in}=    Stat Tile Value    รับเงินรวม
    ${tile_out}=    Stat Tile Value    จ่ายรวม (ต้นทุน + ดำเนินงาน)
    ${tile_profit}=    Stat Tile Value    กำไรตามแผน
    Number Of Element Should Be    ${tile_in}    ${cf}[totalIncome]    0.51
    Number Of Element Should Be    ${tile_out}    ${cf}[totalOutflow]    0.51
    Number Of Element Should Be    ${tile_profit}    ${cf}[evm][profitPlan]    0.51
    RETURN    ${expected}

Evm Metric Cell
    [Documentation]    Value cell of an EVM row by its exact label (the panel is opened first).
    [Arguments]    ${label}
    RETURN    xpath=//div[normalize-space()="${label}"]/ancestor::tr[1]/td[3]

Open Evm Panel
    Click    ${EVM_TOGGLE}
    Wait For Elements State    xpath=//div[normalize-space()="งบประมาณ (BAC)"]    visible

Evm Panel Should Match Engine
    [Arguments]    ${expected}
    VAR    ${e}    ${expected}[planning][cashflow][evm]
    VAR    &{metrics}
    ...    งบประมาณ (BAC)=${e}[bac]
    ...    มูลค่างานตามแผน (PV)=${e}[pv]
    ...    มูลค่างานที่ทำได้ (EV)=${e}[ev]
    ...    ต้นทุนจริง (AC)=${e}[ac]
    ...    ส่วนต่างด้านเวลา (SV)=${e}[sv]
    ...    ส่วนต่างด้านต้นทุน (CV)=${e}[cv]
    ...    คาดการณ์ต้นทุนเมื่อแล้วเสร็จ (EAC)=${e}[eacCost]
    ...    กำไรสุทธิตามแผน=${e}[profitPlan]
    FOR    ${label}    ${value}    IN    &{metrics}
        ${cell}=    Evm Metric Cell    ${label}
        IF    $value is None
            Get Text    ${cell}    ==    ${EMPTY}
        ELSE
            Number Of Element Should Be    ${cell}    ${value}    0.006
        END
    END
    ${spi}=    Evm Metric Cell    ดัชนีผลงานด้านเวลา (SPI)
    ${cpi}=    Evm Metric Cell    ดัชนีผลงานด้านต้นทุน (CPI)
    IF    $e['spi'] is not None
        Number Of Element Should Be    ${spi}    ${e}[spi]    0.0006
    END
    IF    $e['cpi'] is not None
        Number Of Element Should Be    ${cpi}    ${e}[cpi]    0.0006
    END

# ── Export / print ───────────────────────────────────────────────────────────────────

Capture Print Calls
    [Documentation]    Replaces ``window.print`` (a headless browser has no print dialog): the stub stores the text of the
    ...    print-only document (``.boqp-root``) the app mounted just before calling print.
    Evaluate JavaScript    ${None}    ${PRINT_STUB_JS}

Printed Text
    [Documentation]    The text the stubbed ``window.print`` captured from the print-only document.
    ${text}=    Evaluate JavaScript    ${None}    () => window.__printText
    RETURN    ${text}

Printed Title
    [Documentation]    The page title at the moment ``window.print`` was called (the browser's default PDF file name).
    ${title}=    Evaluate JavaScript    ${None}    () => window.__printTitle
    RETURN    ${title}

Print Calls
    [Documentation]    How many times the app called ``window.print`` since ``Capture Print Calls``.
    ${count}=    Evaluate JavaScript    ${None}    () => window.__printCalls
    RETURN    ${count}

# ── Journey map ──────────────────────────────────────────────────────────────────────

Expand All Phases
    [Documentation]    Open every folded phase of the map (finished phases start folded).
    ${folded}=    Get Element Count    css=section button[aria-expanded="false"]
    FOR    ${_}    IN RANGE    ${folded}
        Click    css=section button[aria-expanded="false"] >> nth=0
    END
    Get Element Count    css=section button[aria-expanded="false"]    ==    0

Level States On Map
    [Documentation]    State of the 37 rows in order: current / done / skipped / locked.
    ${states}=    Evaluate JavaScript    ${None}    ${LEVEL_STATES_JS}
    RETURN    ${states}

Level Row Texts On Map
    [Documentation]    Visible text of each of the 37 rows of the map (title, state text, money).
    ${texts}=    Evaluate JavaScript    ${None}    ${LEVEL_TEXTS_JS}
    RETURN    ${texts}

Map Should Match Engine
    [Documentation]    The 37 rows show the engine's state, and every finished priced level shows its money (whole baht).
    [Arguments]    ${expected}
    Expand All Phases
    ${states}=    Level States On Map
    ${texts}=    Level Row Texts On Map
    Length Should Be    ${states}    37
    FOR    ${i}    ${level}    IN ENUMERATE    @{expected}[levels]
        Should Be Equal    ${states}[${i}]    ${level}[state]
        ...    msg=Level ${level}[id] is ${states}[${i}] on the map, engine says ${level}[state]
        IF    $level['state'] == 'done' and $level['total'] >= 0.5
            ${baht}=    Format Baht    ${level}[total]
            Should Contain    ${texts}[${i}]    ${baht}    msg=Level ${level}[id]: "${texts}[${i}]" lacks ${baht}
        END
    END

# ── Responsive ───────────────────────────────────────────────────────────────────────

Page Should Not Scroll Sideways
    [Documentation]    ``document.documentElement.scrollWidth <= innerWidth``.
    ${ok}=    Evaluate JavaScript    ${None}    ${NO_HSCROLL_JS}
    ${sizes}=    Evaluate JavaScript    ${None}    ${SCROLL_WIDTHS_JS}
    Should Be True    ${ok}    msg=Horizontal page scroll (scrollWidth/innerWidth = ${sizes})
