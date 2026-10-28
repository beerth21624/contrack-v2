*** Settings ***
Documentation       Workforce module in the browser ("ทีมช่างและการจัดคน"): /workspace/crews (crews and people: add, search,
...                 filter by trade, archive, archive refused while a crew is on a running job, wages hidden by role),
...                 /team (assign a crew to a planned task, double-booking warning, supervisors, waits), /workspace/board
...                 (the company crew board and its filters) and the module switch (menus and pages vanish when the
...                 company turns the module off, data stays). Users, crews and assignments are created through the API;
...                 the browser does the thing under test; the database confirms it.
Resource            ../../resources/pages/workforce.resource
Suite Setup         Open Cloud Suite
Test Teardown       Close All Contexts
Test Tags           ui    workforce    cloud


*** Variables ***
${MANAGERS_ONLY_TEXT}       เฉพาะเจ้าของหรือผู้ดูแลพื้นที่ทำงานเปิด-ปิดโมดูลได้


*** Test Cases ***
# ── crews and people page ──────────────────────────────────────────────────────────
Empty Company Shows The First Crew Prompt
    [Tags]    smoke
    ${team}=    Create Ui Workforce Team
    Open Crews Page As    ${team}[owner]
    Get Text    css=.ant-tabs-tabpane-active    contains    ยังไม่มีทีมช่าง
    Wait For Elements State    css=button:has-text("เพิ่มทีมแรก")    visible
    Page Should Have No Error Overlay

Viewer Sees The First Use Screen Without An Add Button
    [Tags]    security
    ${team}=    Create Ui Workforce Team
    Open Crews Page As    ${team}[viewer]
    Get Text    css=.ant-tabs-tabpane-active    contains    เจ้าของหรือผู้ดูแลเป็นผู้เพิ่มทีม
    Get Element Count    css=button:has-text("เพิ่มทีมแรก")    ==    0
    Get Element Count    css=button:has-text("เพิ่มทีม")    ==    0

Owner Adds A Crew From The Quick Dialog
    [Tags]    smoke    db
    ${team}=    Create Ui Workforce Team
    ${name}=    Unique Name    ทีมก่อฉาบ
    Open Crews Page As    ${team}[owner]
    Add Crew Via Quick Dialog    ${name}    ก่ออิฐ-ฉาบปูน    2    3
    Message Should Appear    เพิ่ม "${name}" แล้ว
    Crew Should Be Listed    ${name}
    ${row}=    Query Row    select * from crews where workspace_id = %s and name = %s    ${team}[ws]    ${name}
    Should Be Equal    ${row}[trade]    masonry
    Should Be Equal    ${row}[skilled_count]    ${2}
    Should Be Equal    ${row}[labourer_count]    ${3}
    Should Be Equal    ${row}[archived_at]    ${None}

Quick Dialog Refuses A Missing Name And Trade
    [Tags]    negative    db
    ${team}=    Create Ui Workforce Team
    Add Crew    ${team}[owner]    ${team}[ws]
    Open Crews Page As    ${team}[owner]
    Click    css=button.ant-btn-primary:has-text("เพิ่มทีม")
    Wait For Elements State    ${OPEN_MODAL}    visible
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Form Error Should Show    ตั้งชื่อทีม
    Form Error Should Show    เลือกสายงาน
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button:has-text("ยกเลิก")
    ${n}=    Count Rows    select count(*) from crews where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    1

Duplicate Crew Name Is Refused With A Message
    [Tags]    negative    db
    ${team}=    Create Ui Workforce Team
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมซ้ำ
    Open Crews Page As    ${team}[owner]
    Add Crew Via Quick Dialog With Error    ทีมซ้ำ    ก่ออิฐ-ฉาบปูน
    Form Error Should Show    มีชื่อ "ทีมซ้ำ" อยู่แล้ว
    ${n}=    Count Rows    select count(*) from crews where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    1

Owner Adds A Person And Sees The Wage
    [Tags]    smoke    db
    ${team}=    Create Ui Workforce Team
    ${name}=    Unique Name    ช่างสมชาย
    Open Crews Page As    ${team}[owner]
    Open People Tab
    Add Person Via Drawer    ${name}    081-234-5678    650
    Message Should Appear    เพิ่ม "${name}" แล้ว
    Crew Should Be Listed    ${name}
    Get Text    ${TABLE ROW}:has-text("${name}")    contains    650
    Get Text    ${TABLE ROW}:has-text("${name}")    contains    081-234-5678
    ${row}=    Query Row    select * from people where workspace_id = %s and name = %s    ${team}[ws]    ${name}
    Should Be Equal    ${row}[daily_wage]    ${650}
    Should Be Equal    ${row}[phone]    081-234-5678
    Should Be Equal    ${row}[role]    skilled

Person Form Refuses A Bad Phone Number
    [Tags]    negative    db
    ${team}=    Create Ui Workforce Team
    Add Person    ${team}[owner]    ${team}[ws]
    Open Crews Page As    ${team}[owner]
    Open People Tab
    Click    css=button.ant-btn-primary:has-text("เพิ่มบุคลากร")
    Wait For Elements State    ${OPEN DRAWER} >> css=input#name    visible
    Fill Text    ${OPEN DRAWER} >> css=input#name    คนทดสอบ
    Fill Text    ${OPEN DRAWER} >> css=input#phone    081-abc
    Click    css=.ant-drawer-footer button.ant-btn-primary
    Form Error Should Show    ใช้ตัวเลข ช่องว่าง หรือขีด
    ${n}=    Count Rows    select count(*) from people where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    1

Crew Search Narrows The Table
    [Tags]    smoke
    ${team}=    Create Ui Workforce Team
    ${suffix}=    Unique Suffix
    Add Crew    ${team}[owner]    ${team}[ws]    name=ช่างแดง ${suffix}
    Add Crew    ${team}[owner]    ${team}[ws]    name=ช่างเขียว ${suffix}
    Add Crew    ${team}[owner]    ${team}[ws]    name=ช่างดำ ${suffix}
    Open Crews Page As    ${team}[owner]
    Table Rows Should Be    3
    Fill Text    ${CREW SEARCH}    เขียว
    Table Rows Should Be    1
    Crew Should Be Listed    ช่างเขียว ${suffix}
    Fill Text    ${CREW SEARCH}    ไม่มีทีมนี้แน่นอน
    Table Rows Should Be    0
    Get Text    css=.ant-table-placeholder    contains    ไม่พบทีมที่ตรงกับที่ค้นหา
    Fill Text    ${CREW SEARCH}    ${EMPTY}
    Table Rows Should Be    3

Crew Search Also Finds The Leader
    ${team}=    Create Ui Workforce Team
    ${leader}=    Add Person    ${team}[owner]    ${team}[ws]    name=หัวหน้าสมศักดิ์    role=foreman
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีม ก    leaderId=${leader}[id]
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีม ข
    Open Crews Page As    ${team}[owner]
    Fill Text    ${CREW SEARCH}    สมศักดิ์
    Table Rows Should Be    1
    Crew Should Be Listed    ทีม ก

Crews Can Be Filtered By Trade
    [Tags]    smoke
    ${team}=    Create Ui Workforce Team
    ${suffix}=    Unique Suffix
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมอิฐ ${suffix}    trade=masonry
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมสี ${suffix}    trade=painting
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมสี สอง ${suffix}    trade=painting
    Open Crews Page As    ${team}[owner]
    Table Rows Should Be    3
    Choose Filter Option    กรองตามสายงาน    ทาสี
    Table Rows Should Be    2
    Crew Should Not Be Listed    ทีมอิฐ ${suffix}
    Click    css=.ant-select:has([aria-label="กรองตามสายงาน"]) .ant-select-clear
    Table Rows Should Be    3

People Can Be Searched And Filtered By Trade And Role
    ${team}=    Create Ui Workforce Team
    ${suffix}=    Unique Suffix
    Add Person    ${team}[owner]    ${team}[ws]    name=สมหมาย ${suffix}    role=foreman    trades=${{ ['masonry'] }}
    Add Person    ${team}[owner]    ${team}[ws]    name=สมปอง ${suffix}    role=skilled    trades=${{ ['painting'] }}
    Add Person    ${team}[owner]    ${team}[ws]    name=วิชัย ${suffix}    role=labourer    phone=0899999999
    Open Crews Page As    ${team}[owner]
    Open People Tab
    Table Rows Should Be    3
    Fill Text    ${PEOPLE SEARCH}    สมหมาย
    Table Rows Should Be    1
    Fill Text    ${PEOPLE SEARCH}    0899999999
    Table Rows Should Be    1
    Crew Should Be Listed    วิชัย ${suffix}
    Fill Text    ${PEOPLE SEARCH}    ${EMPTY}
    Choose Filter Option    กรองตามสายงาน    ทาสี
    Table Rows Should Be    1
    Crew Should Be Listed    สมปอง ${suffix}

Owner Archives A Crew After Confirming
    [Tags]    smoke    db
    ${team}=    Create Ui Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมที่จะเก็บ
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมที่อยู่ต่อ
    Open Crews Page As    ${team}[owner]
    Archive Row Named    ทีมที่จะเก็บ
    Message Should Appear    เก็บถาวร "ทีมที่จะเก็บ" แล้ว
    Crew Should Not Be Listed    ทีมที่จะเก็บ
    Crew Should Be Listed    ทีมที่อยู่ต่อ
    Archived At Should Be Set    crews    ${crew}[id]

Archive Is Refused While The Crew Is On A Running Job
    [Documentation]    409 ``in_use``: the row stays and the message says how many jobs are still open.
    [Tags]    smoke    negative    db
    ${team}=    Create Ui Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมติดงาน
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_id}    ${crew}[id]
    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_id}    ${crew}[id]    task_id=3.1
    Open Crews Page As    ${team}[owner]
    Archive Row Named    ทีมติดงาน
    Message Should Appear    ยังมีงานที่จัดไว้ 2 งานที่ยังไม่จบ
    Crew Should Be Listed    ทีมติดงาน
    Archived At Should Be Empty    crews    ${crew}[id]

Archiving A Person On A Running Crew Is Refused
    [Tags]    negative    db
    ${team}=    Create Ui Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    name=คนในทีมติดงาน
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    memberIds=${{ [$person['id']] }}
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_id}    ${crew}[id]
    Open Crews Page As    ${team}[owner]
    Open People Tab
    Archive Row Named    คนในทีมติดงาน
    Message Should Appear    ยังมีงานที่จัดไว้ 1 งานที่ยังไม่จบ
    Crew Should Be Listed    คนในทีมติดงาน
    Archived At Should Be Empty    people    ${person}[id]

Crew Booked Today Shows Where It Is
    ${team}=    Create Ui Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมวันนี้
    ${free}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมว่าง
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    ${from}    ${to}=    Days Around Today
    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_id}    ${crew}[id]    start=${from}    end=${to}
    Open Crews Page As    ${team}[owner]
    Wait For Elements State    ${TABLE ROW}:has-text("ทีมวันนี้") >> text=${project_name}    visible    timeout=30s
    Get Text    ${TABLE ROW}:has-text("ทีมว่าง")    contains    ว่าง

Wages Are Visible To The Owner
    [Tags]    smoke    security
    ${team}=    Create Ui Workforce Team
    Add Person    ${team}[owner]    ${team}[ws]    name=ช่างค่าแรง    dailyWage=${777}
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมค่าแรง    dailyCostOverride=${3500}
    Open Crews Page As    ${team}[owner]
    Column Should Be Shown    ค่าแรงต่อวัน    ${True}
    Get Text    ${TABLE ROW}:has-text("ทีมค่าแรง")    contains    3,500
    Open People Tab
    Column Should Be Shown    ค่าแรงต่อวัน    ${True}
    Get Text    ${TABLE ROW}:has-text("ช่างค่าแรง")    contains    777

Estimator Sees Crew Cost But No Person Wage And Cannot Edit
    [Tags]    security
    ${team}=    Create Ui Workforce Team
    Add Person    ${team}[owner]    ${team}[ws]    name=ช่างลับ    dailyWage=${777}
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมมีต้นทุน    dailyCostOverride=${3500}
    Open Crews Page As    ${team}[estimator]
    Get Text    css=body    contains    ดูได้อย่างเดียว
    Column Should Be Shown    ค่าแรงต่อวัน    ${True}
    Get Text    ${TABLE ROW}:has-text("ทีมมีต้นทุน")    contains    3,500
    Get Element Count    css=button.ant-btn-primary:has-text("เพิ่มทีม")    ==    0
    Get Element Count    css=button[aria-label^="เก็บถาวร"]    ==    0
    Get Element Count    css=button[aria-label^="แก้ไข"]    ==    0
    Open People Tab
    Crew Should Be Listed    ช่างลับ
    Column Should Be Shown    ค่าแรงต่อวัน    ${False}
    ${text}=    Get Text    css=body
    Should Not Contain    ${text}    777

Viewer Sees Neither Wage Nor Crew Cost
    [Tags]    smoke    security
    ${team}=    Create Ui Workforce Team
    Add Person    ${team}[owner]    ${team}[ws]    name=ช่างลับ    dailyWage=${777}
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมมีต้นทุน    dailyCostOverride=${3500}
    Open Crews Page As    ${team}[viewer]
    Crew Should Be Listed    ทีมมีต้นทุน
    Column Should Be Shown    ค่าแรงต่อวัน    ${False}
    ${text}=    Get Text    css=body
    Should Not Contain    ${text}    3,500
    Get Element Count    css=button[aria-label^="เก็บถาวร"]    ==    0
    Open People Tab
    Crew Should Be Listed    ช่างลับ
    Column Should Be Shown    ค่าแรงต่อวัน    ${False}
    ${text}=    Get Text    css=body
    Should Not Contain    ${text}    777
    Get Element Count    css=button.ant-btn-primary:has-text("เพิ่มบุคลากร")    ==    0

Crews Page Needs A Sign In
    [Tags]    security
    Open Cloud Context    /workspace/crews
    Wait For Elements State    css=a[href^="/login"]    visible    timeout=60s
    Get Text    css=body    contains    เข้าสู่ระบบ

Crews Page On A Phone Does Not Overflow Sideways
    [Tags]    responsive
    ${team}=    Create Ui Workforce Team
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมบนมือถือ
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /projects
    Set Viewport Size    390    844
    Go To Cloud Path    /workspace/crews
    Wait For Elements State    css=h3:has-text("${CREWS TITLE}")    visible    timeout=120s
    Crew Should Be Listed    ทีมบนมือถือ
    ${overflow}=    Evaluate JavaScript    ${None}    () => document.documentElement.scrollWidth - window.innerWidth
    Should Be True    ${overflow} <= 1    msg=page scrolls sideways by ${overflow}px

# ── project team page ──────────────────────────────────────────────────────────────
Owner Assigns A Crew To A Planned Task
    [Tags]    smoke    db
    ${team}=    Create Ui Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมเทพื้น    trade=structure
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    Open Project Team Page As    ${team}[owner]    ${project_name}
    Team Table Should Be Loaded
    Open Assign Dialog    2.1
    Pick Crew In Assign Dialog    ทีมเทพื้น
    Save Assign Dialog
    Message Should Appear    จัดทีมเทพื้นเข้างาน 2.1 แล้ว
    Wait For Elements State    css=button[aria-label^="แก้ไขทีม ทีมเทพื้น"]    visible    timeout=30s
    ${row}=    Query Row    select * from crew_assignments where project_id = %s    ${project_id}
    Should Be Equal As Strings    ${row}[crew_id]    ${crew}[id]
    Should Be Equal    ${row}[task_id]    2.1
    Should Be True    $row['start_date'] <= $row['end_date']
    Should Be Equal As Strings    ${row}[created_by]    ${team}[owner][id]

Saving Without A Crew Shows What Is Missing
    [Tags]    negative    db
    ${team}=    Create Ui Workforce Team
    Add Crew    ${team}[owner]    ${team}[ws]
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    Open Project Team Page As    ${team}[owner]    ${project_name}
    Team Table Should Be Loaded
    Open Assign Dialog    2.1
    Save Assign Dialog
    Wait For Elements State    ${OPEN_MODAL} >> css=[role="alert"]    visible    timeout=10s
    ${n}=    Assignment Count Of Project    ${project_id}
    Should Be Equal As Integers    ${n}    0

Double Booking A Crew Warns Before Saving
    [Documentation]    The crew is already booked on another project over the same days: saving asks for confirmation,
    ...    "กลับไปแก้" saves nothing, "บันทึกซ้อนกัน" saves the overlap.
    [Tags]    smoke    db
    ${team}=    Create Ui Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมถูกจอง    trade=structure
    ${other_name}    ${other_id}=    Create Ui Project    ${team}
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    Add Assignment    ${team}[owner]    ${team}[ws]    ${other_id}    ${crew}[id]    task_id=1.1    start=2000-01-01
    ...    end=2099-12-31
    Open Project Team Page As    ${team}[owner]    ${project_name}
    Team Table Should Be Loaded
    Open Assign Dialog    2.1
    Pick Crew In Assign Dialog    ทีมถูกจอง
    Get Text    ${OPEN_MODAL}    contains    ${other_name}
    Save Assign Dialog
    Wait For Elements State    css=.ant-modal-confirm    visible    timeout=10s
    Get Text    css=.ant-modal-confirm    contains    ทีมถูกจอง ติดงานในช่วงนี้
    Get Text    css=.ant-modal-confirm    contains    ${other_name}
    Click    css=.ant-modal-confirm button:has-text("กลับไปแก้")
    Wait For Elements State    css=.ant-modal-confirm    detached    timeout=10s
    ${n}=    Assignment Count Of Project    ${project_id}
    Should Be Equal As Integers    ${n}    0
    Save Assign Dialog
    Wait For Elements State    css=.ant-modal-confirm    visible    timeout=10s
    Click    css=.ant-modal-confirm button:has-text("บันทึกซ้อนกัน")
    Message Should Appear    จัดทีมถูกจองเข้างาน 2.1 แล้ว
    ${n}=    Assignment Count Of Project    ${project_id}
    Should Be Equal As Integers    ${n}    1
    Wait For Elements State    css=[data-conflict]    visible    timeout=30s

Owner Removes A Crew From A Task
    [Tags]    db
    ${team}=    Create Ui Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมที่จะถอด
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_id}    ${crew}[id]    task_id=2.1    start=2099-03-02
    ...    end=2099-03-06
    Open Project Team Page As    ${team}[owner]    ${project_name}
    Team Table Should Be Loaded
    Click    css=button[aria-label^="แก้ไขทีม ทีมที่จะถอด"]
    Wait For Elements State    ${OPEN_MODAL}    visible
    Click    ${OPEN_MODAL} >> css=button:has-text("เอาออก")
    Click Popconfirm Ok    เอาออก
    Message Should Appear    เอาทีมที่จะถอดออกจากงาน 2.1 แล้ว
    ${n}=    Count Rows    select count(*) from crew_assignments where id = %s    ${a}[id]
    Should Be Equal As Integers    ${n}    0
    Archived At Should Be Empty    crews    ${crew}[id]

Estimator Can Assign But Viewer Only Reads
    [Tags]    security
    ${team}=    Create Ui Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมอ่านอย่างเดียว
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_id}    ${crew}[id]    task_id=2.1    start=2099-03-02
    ...    end=2099-03-06
    Open Project Team Page As    ${team}[viewer]    ${project_name}
    Team Table Should Be Loaded
    Get Text    css=body    contains    ดูอย่างเดียว
    Get Text    css=body    contains    ทีมอ่านอย่างเดียว
    Get Element Count    css=button[aria-label^="จัดทีมงาน"]    ==    0
    Get Element Count    css=button[aria-label^="แก้ไขทีม"]    ==    0
    Get Element Count    css=button[aria-label^="แก้ช่วงรอหลังงาน"]    ==    0
    Get Element Count    css=section[aria-label="ผู้คุมงาน"] .ant-select    ==    0
    Close Context    CURRENT
    Open Project Team Page As    ${team}[estimator]    ${project_name}
    Team Table Should Be Loaded
    Wait For Elements State    css=button[aria-label^="จัดทีมงาน 2.1 "]    visible
    Wait For Elements State    css=section[aria-label="ผู้คุมงาน"] .ant-select    visible

Owner Names The Site Supervisors
    [Tags]    smoke    db
    ${team}=    Create Ui Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    name=ผู้คุมงานสมชาย    role=supervisor
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    Open Project Team Page As    ${team}[owner]    ${project_name}
    Team Table Should Be Loaded
    Click    css=section[aria-label="ผู้คุมงาน"] .ant-select
    Click    ${OPEN_SELECT_DROPDOWN} >> css=.ant-select-item-option:has-text("ผู้คุมงานสมชาย")
    Keyboard Key    press    Escape
    Click    css=section[aria-label="ผู้คุมงาน"] button.ant-btn-primary:has-text("บันทึก")
    Message Should Appear    บันทึกผู้คุมงานแล้ว
    ${ids}=    Supervisor Ids In Database    ${project_id}
    Should Be Equal    ${ids}    ${{ [$person['id']] }}

Owner Sets A Wait After A Task
    [Tags]    db
    ${team}=    Create Ui Workforce Team
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    Open Project Team Page As    ${team}[owner]    ${project_name}
    Team Table Should Be Loaded
    Click    css=button[aria-label^="แก้ช่วงรอหลังงาน 2.1 "]
    Wait For Elements State    ${OPEN_MODAL}    visible
    Fill Text    ${OPEN_MODAL} >> css=input[aria-label="รอกี่วัน"]    12
    Fill Text    ${OPEN_MODAL} >> css=input[aria-label="เหตุผล"]    รอคอนกรีตบ่ม
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary:has-text("บันทึก")
    Message Should Appear    บันทึกช่วงรอแล้ว
    ${rows}=    Task Lag Rows In Database    ${project_id}
    Should Be Equal    ${rows}    ${{ {'2.1': (12, 'รอคอนกรีตบ่ม')} }}
    Wait For Elements State    css=tr:has(button[aria-label^="แก้ช่วงรอหลังงาน 2.1 "]) >> text=แก้แล้ว    visible    timeout=30s

Project Team Page Of A Guest Project Explains Itself
    [Tags]    edge
    Open Cloud Context    /team
    Wait For Elements State    css=h4:has-text("ทีมงาน")    visible    timeout=120s
    Get Text    css=body    contains    โครงการของบริษัท

# ── crew board ─────────────────────────────────────────────────────────────────────
Board Without Crews Points To The Crews Page
    [Tags]    smoke
    ${team}=    Create Ui Workforce Team
    Open Board As    ${team}[owner]
    Get Text    css=body    contains    ยังไม่มีทีมช่าง
    Wait For Elements State    css=a[href="/workspace/crews"] >> nth=0    visible

Board Shows Crews Bars And Summary
    [Tags]    smoke
    ${team}=    Create Ui Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมบนกระดาน
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมว่างบนกระดาน    trade=painting
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    ${from}    ${to}=    Days Around Today
    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_id}    ${crew}[id]    start=${from}    end=${to}
    Open Board As    ${team}[owner]
    Wait For Elements State    css=span[title="ทีมบนกระดาน"]    visible    timeout=60s
    Wait For Elements State    css=span[title="ทีมว่างบนกระดาน"]    visible
    Wait For Elements State    css=button[data-from][data-to]    visible    timeout=30s
    Get Text    css=body    contains    อัตราการใช้ทีมเฉลี่ย
    Get Text    css=body    contains    จุดชน
    Get Text    css=body    contains    ${project_name}
    Page Should Have No Error Overlay

Board Filters By Trade And Project
    [Tags]    smoke
    ${team}=    Create Ui Workforce Team
    ${mason}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมอิฐบอร์ด    trade=masonry
    ${painter}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมสีบอร์ด    trade=painting
    ${name_a}    ${project_a}=    Create Ui Project    ${team}
    ${name_b}    ${project_b}=    Create Ui Project    ${team}
    ${from}    ${to}=    Days Around Today
    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_a}    ${mason}[id]    start=${from}    end=${to}
    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_b}    ${painter}[id]    task_id=3.2    start=${from}    end=${to}
    Open Board As    ${team}[owner]
    Wait For Elements State    css=span[title="ทีมอิฐบอร์ด"]    visible    timeout=60s
    Wait For Elements State    css=span[title="ทีมสีบอร์ด"]    visible
    Choose Ant Select Option    สายงาน    ทาสี
    Wait For Elements State    css=span[title="ทีมอิฐบอร์ด"]    detached    timeout=30s
    Wait For Elements State    css=span[title="ทีมสีบอร์ด"]    visible
    Click    css=.ant-select:has([aria-label="สายงาน"]) .ant-select-clear
    Wait For Elements State    css=span[title="ทีมอิฐบอร์ด"]    visible    timeout=30s
    Choose Ant Select Option    โครงการ    ${name_a}
    Wait For Elements State    css=span[title="ทีมสีบอร์ด"]    detached    timeout=30s
    Wait For Elements State    css=span[title="ทีมอิฐบอร์ด"]    visible

Board Lists A Clash When One Crew Is Booked Twice
    [Tags]    edge
    ${team}=    Create Ui Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมชนกัน
    ${name_a}    ${project_a}=    Create Ui Project    ${team}
    ${name_b}    ${project_b}=    Create Ui Project    ${team}
    ${from}    ${to}=    Days Around Today
    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_a}    ${crew}[id]    start=${from}    end=${to}
    Add Assignment    ${team}[owner]    ${team}[ws]    ${project_b}    ${crew}[id]    task_id=3.2    start=${from}    end=${to}
    Open Board As    ${team}[owner]
    Wait For Elements State    css=button:has-text("ดูบนกระดาน")    visible    timeout=60s
    Get Text    css=body    contains    ทีมชนกัน
    Wait For Elements State    css=button[data-from][aria-label*="ชนกับงานอื่น"] >> nth=0    visible

Board Opens For A Viewer Without Edit Rights
    [Tags]    security
    ${team}=    Create Ui Workforce Team
    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมดูบอร์ด
    Open Board As    ${team}[viewer]
    Wait For Elements State    css=span[title="ทีมดูบอร์ด"]    visible    timeout=60s
    Get Text    css=body    contains    ดูได้อย่างเดียว
    Page Should Have No Error Overlay

Board Needs A Sign In
    [Tags]    security
    Open Cloud Context    /workspace/board
    Wait For Elements State    css=a[href^="/login"]    visible    timeout=60s

# ── module switch ──────────────────────────────────────────────────────────────────
Module Off Hides The Menus And Pages
    [Documentation]    A company that never switched the module on: no menu entries, the pages say "ยังไม่เปิดใช้งาน"
    ...    and nothing crashes. The database has no enabled row.
    [Tags]    smoke    negative
    ${team}=    Create Ui Workforce Team    module_on=${False}
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/crews
    Wait For Elements State    css=.ant-result-title:has-text("${MODULE OFF TITLE}")    visible    timeout=120s
    Account Menu Should Offer Workforce    ${False}
    Go To Cloud Path    /workspace/board
    Wait For Elements State    css=.ant-result-title:has-text("${MODULE OFF TITLE}")    visible    timeout=120s
    Page Should Have No Error Overlay
    ${row}=    Module Row    ${team}[ws]    workforce
    Should Be Equal    ${row}    ${None}

Module Off Hides The Project Team Page
    [Tags]    negative
    ${team}=    Create Ui Workforce Team    module_on=${False}
    ${project_name}    ${project_id}=    Create Ui Project    ${team}
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /projects
    Projects Page Should Be Loaded
    Open Project From List    ${project_name}
    Client Navigate To    /team
    Wait For Elements State    css=h4:has-text("ทีมงาน")    visible    timeout=120s
    Get Text    css=body    contains    ยังไม่เปิดใช้ในระบบนี้
    Get Element Count    css=button[aria-label^="จัดทีมงาน"]    ==    0

Module On Shows The Menus
    [Tags]    smoke
    ${team}=    Create Ui Workforce Team
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /projects
    Account Menu Should Offer Workforce    ${True}

Owner Switches The Module On And Off From The Modules Page
    [Tags]    smoke    db
    ${team}=    Create Ui Workforce Team    module_on=${False}
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/modules
    Wait For Elements State    ${WORKFORCE SWITCH}    visible    timeout=120s
    Get Attribute    ${WORKFORCE SWITCH}    aria-checked    ==    false
    Click    ${WORKFORCE SWITCH}
    Get Attribute    ${WORKFORCE SWITCH}    aria-checked    ==    true
    Account Menu Should Offer Workforce    ${True}
    ${row}=    Module Row    ${team}[ws]    workforce
    Should Be Equal    ${row}[enabled]    ${True}
    Click    ${WORKFORCE SWITCH}
    Wait For Elements State    css=.ant-modal-confirm    visible
    Click    css=.ant-modal-confirm button:has-text("ปิดโมดูล")
    Get Attribute    ${WORKFORCE SWITCH}    aria-checked    ==    false
    Account Menu Should Offer Workforce    ${False}
    ${row}=    Module Row    ${team}[ws]    workforce
    Should Be Equal    ${row}[enabled]    ${False}

Switching Off Keeps The Data And Switching On Brings It Back
    [Tags]    state    db
    ${team}=    Create Ui Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมที่ต้องอยู่ต่อ
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/crews
    Crew Should Be Listed    ทีมที่ต้องอยู่ต่อ
    Switch Module    ${team}[owner]    ${team}[ws]    workforce    ${False}
    Go To Cloud Path    /workspace/crews
    Wait For Elements State    css=.ant-result-title:has-text("${MODULE OFF TITLE}")    visible    timeout=120s
    Archived At Should Be Empty    crews    ${crew}[id]
    Switch Module    ${team}[owner]    ${team}[ws]    workforce    ${True}
    Go To Cloud Path    /workspace/crews
    Crew Should Be Listed    ทีมที่ต้องอยู่ต่อ

Viewer Cannot Use The Workforce Switch
    [Tags]    security
    ${team}=    Create Ui Workforce Team
    Open Context As    ${team}[viewer][email]    ${team}[viewer][password]    /workspace/modules
    Wait For Elements State    ${WORKFORCE SWITCH}    visible    timeout=120s
    Get Element States    ${WORKFORCE SWITCH}    *=    disabled
    Get Text    css=body    contains    ${MANAGERS_ONLY_TEXT}


*** Keywords ***
Close All Contexts
    [Documentation]    Test teardown: every context of this test goes (cookies and storage never leak to the next one).
    Close Context    ALL    CURRENT

Days Around Today
    [Documentation]    ``${from}`` yesterday and ``${to}`` in three days (ISO), so an assignment covers today.
    ${from}=    Evaluate    (datetime.date.today() - datetime.timedelta(days=1)).isoformat()    modules=datetime
    ${to}=    Evaluate    (datetime.date.today() + datetime.timedelta(days=3)).isoformat()    modules=datetime
    RETURN    ${from}    ${to}

Add Crew Via Quick Dialog With Error
    [Documentation]    Fill the quick dialog and confirm; the dialog stays open because the server refuses.
    [Arguments]    ${name}    ${trade_label}
    Click    css=button.ant-btn-primary:has-text("เพิ่มทีม")
    Wait For Elements State    ${OPEN_MODAL}    visible
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${name}
    Choose Option In Open Modal Select    trade    ${trade_label}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
