*** Settings ***
Documentation       The cloud projects page /projects (W5): tabs, project cards, create / rename / archive / restore /
...                 delete, long names, search and sort, empty states, workspace switcher and tenant isolation.
...                 Cards are compared with the BOQ engine (``Expected For Cloud Project`` rebuilds the project from
...                 the stored documents) and every write is read back from ``projects`` / ``project_docs``.
Resource            ../../resources/pages/cloud.resource
Suite Setup         Open Cloud Suite
Test Teardown       Close All Contexts
Test Tags           projects    cloud


*** Variables ***
${LONG_THAI_NAME}       โครงการก่อสร้างบ้านพักอาศัยสองชั้นพร้อมโรงจอดรถและสระว่ายน้ำส่วนตัวของคุณสมศรีรัตนวงศ์ใจดีมากที่ซอยลำลูกกาคลองสิบสามจังหวัดปทุมธานี ระยะที่หนึ่ง
${UNBROKEN_NAME}        โครงการ_ที่_ไม่_มี_ช่อง_ว่าง_เลย_ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz_0123456789_ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz
${EMPTY_ACTIVE_TEXT}    ยังไม่มีโครงการในพื้นที่นี้
${EMPTY_ARCHIVE_TEXT}   ไม่มีโครงการที่เก็บถาวร


*** Test Cases ***
Empty Projects Page Invites The First Project
    [Documentation]    A new user with no project sees the empty state and a "สร้างโครงการแรก" button.
    [Tags]    smoke
    ${user}=    Register User Via API    empty
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Get Text    css=body    contains    ${EMPTY_ACTIVE_TEXT}
    Get Element Count    css=button:has-text("สร้างโครงการแรก")    ==    1
    Get Element Count    css=div.shadow-card:has(button[title])    ==    0

Archived Tab Of A New User Is Empty
    [Tags]    edge
    ${user}=    Register User Via API    emptyarchive
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Show Archived Tab
    Get Text    css=body    contains    ${EMPTY_ARCHIVE_TEXT}
    Get Element Count    css=button:has-text("สร้างโครงการแรก")    ==    0

Projects Page Shows Both Tabs And The Local Project Row
    [Documentation]    "ใช้งานอยู่" is selected first; the row "โครงการในเครื่องนี้" shows the guest project of this browser.
    ${user}=    Register User Via API    tabs
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Get Text    css=.ant-segmented-item-selected    ==    ใช้งานอยู่
    Get Text    css=.ant-segmented    contains    เก็บถาวร
    Get Text    css=body    contains    โครงการในเครื่องนี้:
    Get Text    css=body    contains    เก็บในเบราว์เซอร์นี้เท่านั้น

Sample Project Card Shows Name Tags Total And Progress
    [Documentation]    Card of a cloud project started from the Excel v5 house: name, "แก้ล่าสุด", the tag
    ...    "บ้านตัวอย่าง", the total equals the engine, and "0/37 ขั้นตอน".
    [Tags]    smoke
    ${user}=    Register User Via API    sample
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    บ้านตัวอย่างทดสอบ
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    sample
    ${expected}=    Expected For Cloud Project    ${created}[project][id]    sample
    ${total}=    Format Baht    ${expected}[constructionTotal]
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    ${card}=    Project Card    ${name}
    Get Text    ${card}    contains    แก้ล่าสุด
    Get Text    ${card}    contains    บ้านตัวอย่าง
    Get Text    ${card}    contains    ${total} บาท
    Get Text    ${card}    contains    0/37 ขั้นตอน
    Get Text    ${card}    not contains    เก็บถาวร
    Get Text    ${card}    not contains    เปิดอยู่

Blank Project Card Has No Sample Tag And Shows The Engine Total
    ${user}=    Register User Via API    blankcard
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการเปล่า
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    blank
    ${expected}=    Expected For Cloud Project    ${created}[project][id]    blank
    ${total}=    Format Baht    ${expected}[constructionTotal]
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    ${card}=    Project Card    ${name}
    Get Text    ${card}    contains    ${total} บาท
    Get Text    ${card}    not contains    บ้านตัวอย่าง
    Get Text    ${card}    contains    /37 ขั้นตอน

Card Progress Counts The Levels Marked Done Or Skipped
    [Documentation]    N/37 and the progress bar follow the ``journey`` document (levels before ``layout`` = 6).
    ${user}=    Register User Via API    progress
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการคืบหน้า
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Unlock Levels Via API    ${user}    ${created}[project][id]    layout
    ${journey}=    Doc Data    ${created}[project][id]    journey
    ${done}=    Get Length    ${journey}
    Should Be Equal As Integers    ${done}    6
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    ${card}=    Project Card    ${name}
    Get Text    ${card}    contains    ${done}/37 ขั้นตอน
    ${percent}=    Evaluate    round(${done} / 37 * 100)
    Get Attribute    ${card} >> css=.ant-progress    aria-valuenow    ==    ${{ str($percent) }}

Card Total Follows A Document Changed By Another Client
    [Documentation]    A BOQ line edited elsewhere (API) shows on the card after a reload, equal to the engine.
    [Tags]    edge
    ${user}=    Register User Via API    follow
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการแก้จากที่อื่น
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    sample
    ${id}=    Set Variable    ${created}[project][id]
    Put Doc Via API    ${user}    ${id}    boq:R32    ${{ {'qty': 1, 'mat': 1000, 'lab': 2000} }}
    ${expected}=    Expected For Cloud Project    ${id}    sample
    ${total}=    Format Baht    ${expected}[constructionTotal]
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    ${card}=    Project Card    ${name}
    Get Text    ${card}    contains    ${total} บาท
    ${row}=    Project Row By Name    ${ws}    ${name}
    Numbers Should Be Close    ${row}[summary][constructionTotal]    ${expected}[constructionTotal]    1

Updated Time On The Card Matches The Database In Bangkok Time
    [Documentation]    "แก้ล่าสุด 28 ต.ค. 26 00:35": day, Thai month, Christian-era year (2 digits), hour and minute of
    ...    ``projects.updated_at`` in Asia/Bangkok.
    [Tags]    edge
    ${user}=    Register User Via API    time
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการเวลา
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    ${row}=    Project Row By Name    ${ws}    ${name}
    ${expected}=    Thai Date Text    ${row}[updated_at]
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    ${card}=    Project Card    ${name}
    Get Text    ${card}    contains    แก้ล่าสุด ${expected}

Create A Blank Project Through The Dialog
    [Documentation]    "เริ่มจากแบบแปลนของฉัน": the app opens the new project on /journey; the DB has the project row
    ...    (start=blank, not archived) and its first document.
    [Tags]    smoke    db
    ${user}=    Register User Via API    createblank
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการใหม่เปล่า
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Create Project Via UI    ${name}    blank
    ${row}=    Project Row By Name    ${ws}    ${name}
    Should Be Equal    ${row}[start]    blank
    Should Be Equal As Strings    ${row}[created_by]    ${user}[id]
    Should Be Equal    ${row}[archived_at]    ${None}
    ${docs}=    Query Rows    select doc_key from project_docs where project_id = %s    ${row}[id]
    Should Not Be Empty    ${docs}
    Wait For Elements State    ${PROJECT_BADGE} >> text=${name}    visible    timeout=30s

Create A Sample Project Through The Dialog
    [Documentation]    "ลองกับบ้านตัวอย่าง": the stored project totals what the engine says for the sample house.
    [Tags]    smoke    db
    ${user}=    Register User Via API    createsample
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการใหม่ตัวอย่าง
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Create Project Via UI    ${name}    sample
    ${row}=    Project Row By Name    ${ws}    ${name}
    Should Be Equal    ${row}[start]    sample
    ${expected}=    Expected For Cloud Project    ${row}[id]    sample
    Numbers Should Be Close    ${row}[summary][constructionTotal]    ${expected}[constructionTotal]    1
    Open Projects Page
    ${card}=    Project Card    ${name}
    ${total}=    Format Baht    ${expected}[constructionTotal]
    Get Text    ${card}    contains    ${total} บาท
    Get Text    ${card}    contains    เปิดอยู่

Created Project Appears In The List Of Its Workspace Only
    [Tags]    db
    ${user}=    Register User Via API    appears
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการปรากฏ
    Open Signed In Context    ${user}[email]    ${user}[password]
    Create Project Via UI    ${name}
    Open Projects Page
    Project Card Should Be Visible    ${name}
    ${n}=    Query Value    select count(*) from projects where name = %s and workspace_id = %s    ${name}    ${ws}
    Should Be Equal As Integers    ${n}    1

Create Dialog Requires A Name
    [Tags]    negative
    ${user}=    Register User Via API    noname
    ${ws}=    Personal Workspace Id    ${user}
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Click    css=button:has-text("สร้างโครงการใหม่")
    Wait For Elements State    ${OPEN_MODAL}    visible
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Form Error Should Show    ตั้งชื่อโครงการ
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${ws}
    Should Be Equal As Integers    ${n}    0

Create Dialog Rejects A Name Of Only Spaces
    [Tags]    negative    edge
    ${user}=    Register User Via API    spacename
    ${ws}=    Personal Workspace Id    ${user}
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Click    css=button:has-text("สร้างโครงการใหม่")
    Wait For Elements State    ${OPEN_MODAL}    visible
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${SPACE}${SPACE}${SPACE}${SPACE}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Wait For Elements State    css=.ant-form-item-explain-error    visible    timeout=10s
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${ws}
    Should Be Equal As Integers    ${n}    0

Create Dialog Accepts 160 Characters And Rejects 161
    [Documentation]    Boundary of ``projectNameSchema`` (max 160).
    [Tags]    edge    negative    db
    ${user}=    Register User Via API    namelen
    ${ws}=    Personal Workspace Id    ${user}
    ${ok}=    Evaluate    'ก' * 160
    ${too_long}=    Evaluate    'ก' * 161
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Click    css=button:has-text("สร้างโครงการใหม่")
    Wait For Elements State    ${OPEN_MODAL}    visible
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${too_long}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Form Error Should Show    ชื่อโครงการยาวได้ไม่เกิน 160 ตัวอักษร
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${ws}
    Should Be Equal As Integers    ${n}    0
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${ok}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Wait For Condition    Url    should end with    /journey    timeout=90s
    ${row}=    Project Row By Name    ${ws}    ${ok}
    Should Be Equal As Integers    ${{ len($row['name']) }}    160

Create Dialog Cancel Creates Nothing
    [Tags]    edge
    ${user}=    Register User Via API    cancel
    ${ws}=    Personal Workspace Id    ${user}
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Click    css=button:has-text("สร้างโครงการใหม่")
    Wait For Elements State    ${OPEN_MODAL}    visible
    Fill Text    ${OPEN_MODAL} >> css=input#name    โครงการที่ยกเลิก
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button:has-text("ยกเลิก")
    Wait For Elements State    ${OPEN_MODAL}    detached    timeout=10s
    Get Url    should end with    /projects
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${ws}
    Should Be Equal As Integers    ${n}    0

Create Dialog Trims The Name
    [Tags]    edge    db
    ${user}=    Register User Via API    trimname
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการตัดช่องว่าง
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Create Project Via UI    ${SPACE}${SPACE}${name}${SPACE}${SPACE}
    ${row}=    Project Row By Name    ${ws}    ${name}
    Should Be Equal    ${row}[name]    ${name}

Project Name With Html Is Shown As Text
    [Documentation]    Security (XSS): markup in a project name is escaped on the card and in the delete dialog.
    [Tags]    security
    ${user}=    Register User Via API    xssproj
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Set Variable    <img src=x onerror=document.title=1> โครงการ
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Wait For Elements State    css=div.shadow-card button[title]    visible    timeout=30s
    Get Element Count    css=img[src="x"]    ==    0
    Get Title    !=    1
    Get Text    css=div.shadow-card button[title]    contains    <img src=x
    Open Card Menu    ${name}    ลบถาวร
    Get Text    ${OPEN_MODAL}    contains    <img src=x
    Get Element Count    css=img[src="x"]    ==    0

Rename A Project From The Card Menu
    [Tags]    smoke    db
    ${user}=    Register User Via API    rename
    ${ws}=    Personal Workspace Id    ${user}
    ${old}=    Unique Name    ชื่อเดิม
    ${new}=    Unique Name    ชื่อใหม่
    ${created}=    Create Project Via API    ${user}    ${ws}    ${old}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${old}
    Open Card Menu    ${old}    เปลี่ยนชื่อ
    Get Property    ${OPEN_MODAL} >> css=input#name    value    ==    ${old}
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${new}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Toast Should Show    เปลี่ยนชื่อแล้ว
    Project Card Should Be Visible    ${new}
    Project Card Should Not Exist    ${old}
    ${row}=    Project Row By Name    ${ws}    ${new}
    Should Be Equal As Strings    ${row}[id]    ${created}[project][id]

Rename With An Empty Name Is Rejected
    [Tags]    negative    db
    ${user}=    Register User Via API    renameempty
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    ชื่อห้ามว่าง
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Open Card Menu    ${name}    เปลี่ยนชื่อ
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${EMPTY}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Form Error Should Show    ตั้งชื่อโครงการ
    Project Row By Name    ${ws}    ${name}

Rename To More Than 160 Characters Is Rejected
    [Tags]    negative    edge    db
    ${user}=    Register User Via API    renamelong
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    ชื่อสั้น
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Open Card Menu    ${name}    เปลี่ยนชื่อ
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${{ 'ข' * 161 }}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Form Error Should Show    ชื่อโครงการยาวได้ไม่เกิน 160 ตัวอักษร
    Project Row By Name    ${ws}    ${name}

Rename Cancel Keeps The Old Name
    [Tags]    edge    db
    ${user}=    Register User Via API    renamecancel
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    ชื่อคงเดิม
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Open Card Menu    ${name}    เปลี่ยนชื่อ
    Fill Text    ${OPEN_MODAL} >> css=input#name    ชื่อที่ไม่บันทึก
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button:has-text("ยกเลิก")
    Wait For Elements State    ${OPEN_MODAL}    detached    timeout=10s
    Project Card Should Be Visible    ${name}
    Project Row By Name    ${ws}    ${name}

Archive Moves A Project To The Archived Tab
    [Tags]    smoke    db
    ${user}=    Register User Via API    archive
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการเก็บถาวร
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Open Card Menu    ${name}    เก็บถาวร
    Toast Should Show    เก็บถาวรแล้ว
    Project Card Should Not Exist    ${name}
    ${row}=    Project Row By Name    ${ws}    ${name}
    Should Not Be Equal    ${row}[archived_at]    ${None}
    Show Archived Tab
    Project Card Should Be Visible    ${name}
    ${card}=    Project Card    ${name}
    Get Text    ${card}    contains    เก็บถาวร
    Get Text    ${card}    contains    กู้คืนก่อนเปิด

Restore Brings An Archived Project Back
    [Tags]    smoke    db
    ${user}=    Register User Via API    restore
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการกู้คืน
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Archive Project Via API    ${user}    ${created}[project][id]
    Open Signed In Context    ${user}[email]    ${user}[password]
    Show Archived Tab
    Project Card Should Be Visible    ${name}
    Open Card Menu    ${name}    กู้คืน
    Toast Should Show    กู้คืนแล้ว
    Project Card Should Not Exist    ${name}
    ${row}=    Project Row By Name    ${ws}    ${name}
    Should Be Equal    ${row}[archived_at]    ${None}
    Show Active Tab
    Project Card Should Be Visible    ${name}

Archived Project Cannot Be Opened From Its Card
    [Documentation]    The button says "กู้คืนก่อนเปิด" and is disabled; clicking the card does not leave /projects.
    [Tags]    negative    edge
    ${user}=    Register User Via API    noopen
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการห้ามเปิด
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Archive Project Via API    ${user}    ${created}[project][id]
    Open Signed In Context    ${user}[email]    ${user}[password]
    Show Archived Tab
    ${card}=    Project Card    ${name}
    Wait For Elements State    ${card} >> css=button.ant-btn-block    disabled
    Click    ${card} >> css=div.text-\\[22px\\]
    Get Url    should end with    /projects
    Get Element Count    ${PROJECT_BADGE}    ==    0

Renaming An Archived Project Is Refused With A Message
    [Documentation]    API rule: renaming an archived project is a conflict. The menu still offers "เปลี่ยนชื่อ";
    ...    the UI must show an error message and the name stays unchanged in the database.
    [Tags]    negative    edge    db
    ${user}=    Register User Via API    renamearch
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    เก็บแล้วห้ามเปลี่ยนชื่อ
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Archive Project Via API    ${user}    ${created}[project][id]
    Open Signed In Context    ${user}[email]    ${user}[password]
    Show Archived Tab
    Open Card Menu    ${name}    เปลี่ยนชื่อ
    Fill Text    ${OPEN_MODAL} >> css=input#name    ชื่อใหม่ของโครงการที่เก็บถาวร
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Toast Should Show    ทำรายการนี้ไม่ได้
    Project Row By Name    ${ws}    ${name}

Delete Asks For Confirmation And Cancel Keeps The Project
    [Tags]    negative    db
    ${user}=    Register User Via API    delcancel
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการไม่ลบ
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Open Card Menu    ${name}    ลบถาวร
    Wait For Elements State    css=.ant-modal-confirm    visible
    Get Text    css=.ant-modal-confirm    contains    ลบโครงการ "${name}" ถาวร?
    Click    css=.ant-modal-confirm button:has-text("ยกเลิก")
    Wait For Elements State    css=.ant-modal-confirm    detached    timeout=10s
    Project Card Should Be Visible    ${name}
    Project Row By Name    ${ws}    ${name}

Delete Removes The Project And Its Documents
    [Tags]    smoke    db
    ${user}=    Register User Via API    delete
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการลบถาวร
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    sample
    ${id}=    Set Variable    ${created}[project][id]
    ${docs}=    Query Value    select count(*) from project_docs where project_id = %s    ${id}
    Should Be True    ${docs} >= 1
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Open Card Menu    ${name}    ลบถาวร
    Click    css=.ant-modal-confirm button:has-text("ลบถาวร")
    Toast Should Show    ลบโครงการแล้ว
    Project Card Should Not Exist    ${name}
    Row Count Should Be    0    select 1 from projects where id = %s    ${id}
    Row Count Should Be    0    select 1 from project_docs where project_id = %s    ${id}

Deleting The Open Project Closes It
    [Tags]    edge    db
    ${user}=    Register User Via API    delopen
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการเปิดแล้วลบ
    ${created}=    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Open Project From List    ${name}
    Open Projects Page
    Open Card Menu    ${name}    ลบถาวร
    Click    css=.ant-modal-confirm button:has-text("ลบถาวร")
    Toast Should Show    ลบโครงการแล้ว
    Project Card Should Not Exist    ${name}
    Row Count Should Be    0    select 1 from projects where id = %s    ${created}[project][id]
    Get Text    css=body    contains    ยังไม่มีโครงการในพื้นที่นี้

Archiving The Open Project Closes It
    [Tags]    edge    db
    ${user}=    Register User Via API    archopen
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการเปิดแล้วเก็บ
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Open Project From List    ${name}
    Open Projects Page
    Open Card Menu    ${name}    เก็บถาวร
    Toast Should Show    เก็บถาวรแล้ว
    Project Card Should Not Exist    ${name}
    Get Element Count    ${PROJECT_BADGE}    ==    0

Opening A Project Marks It As Open And Binds The Cloud Project
    [Tags]    smoke
    ${user}=    Register User Via API    open
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการเปิด
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Open Project From List    ${name}
    Get Text    ${PROJECT_BADGE}    contains    ${name}
    Open Projects Page
    ${card}=    Project Card    ${name}
    Get Text    ${card}    contains    เปิดอยู่
    Get Text    ${card} >> css=button.ant-btn-block    contains    ไปที่โครงการ
    Click    ${card} >> css=button.ant-btn-block
    Wait For Condition    Url    should end with    /journey    timeout=90s

Clicking The Whole Card Opens The Project
    [Tags]    edge
    ${user}=    Register User Via API    cardclick
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการคลิกการ์ด
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    ${card}=    Project Card    ${name}
    Click    ${card} >> css=div.text-\\[22px\\]
    Wait For Condition    Url    should end with    /journey    timeout=90s
    Wait For Elements State    ${PROJECT_BADGE} >> text=${name}    visible    timeout=30s

Card Menu Button Does Not Open The Project
    [Documentation]    Using "ตัวเลือก" must not also trigger the card click (the project must not open).
    [Tags]    edge
    ${user}=    Register User Via API    menuclick
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการเมนู
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    ${card}=    Project Card    ${name}
    Click    ${card} >> css=button[aria-label="ตัวเลือก"]
    Wait For Elements State    ${OPEN_DROPDOWN}    visible
    Get Url    should end with    /projects
    Get Element Count    ${PROJECT_BADGE}    ==    0

Local Project Row Closes The Cloud Project
    [Documentation]    With a cloud project open, the row "โครงการในเครื่องนี้" gets an "เปิด" button back to the local one.
    [Tags]    edge
    ${user}=    Register User Via API    localrow
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการคลาวด์
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Open Project From List    ${name}
    Open Projects Page
    Click    css=button:has-text("เปิด") >> nth=0
    Wait For Condition    Url    should end with    /journey    timeout=90s
    Wait For Elements State    ${PROJECT_BADGE}    detached    timeout=30s

Upload Local Project Button Appears Only With Local Data
    [Documentation]    A fresh browser has the untouched default project: no upload button. After editing it, there is.
    [Tags]    edge
    ${user}=    Register User Via API    uploadbtn
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Get Element Count    css=button:has-text("อัปโหลดโครงการในเครื่องขึ้นคลาวด์")    ==    0
    ${expected}=    Compute Expected For New Project    blank
    ${project}=    Project With Levels Done    ${expected}[project]    layout
    Seed Guest Project    ${project}    /projects
    Projects Page Should Be Loaded
    Get Element Count    css=button:has-text("อัปโหลดโครงการในเครื่องขึ้นคลาวด์")    ==    1

Upload Local Project Copies It To The Cloud
    [Documentation]    The local project (6 levels done) is uploaded: a cloud project with the same journey and the
    ...    same engine total; the local project stays in localStorage.
    [Tags]    db
    ${user}=    Register User Via API    upload
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการอัปโหลด
    Open Signed In Context    ${user}[email]    ${user}[password]
    ${expected}=    Compute Expected For New Project    blank
    ${project}=    Project With Levels Done    ${expected}[project]    layout
    Seed Guest Project    ${project}    /projects
    Projects Page Should Be Loaded
    Click    css=button:has-text("อัปโหลดโครงการในเครื่องขึ้นคลาวด์")
    Wait For Elements State    ${OPEN_MODAL}    visible
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${name}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Wait For Elements State    css=.ant-modal-confirm    visible    timeout=30s
    Get Text    css=.ant-modal-confirm    contains    ยังอยู่เหมือนเดิม
    Click    css=.ant-modal-confirm button:has-text("ไว้ทีหลัง")
    Project Card Should Be Visible    ${name}
    ${row}=    Project Row By Name    ${ws}    ${name}
    ${journey}=    Doc Data    ${row}[id]    journey
    Should Be Equal    ${journey}    ${project}[journey]
    ${cloud}=    Expected For Cloud Project    ${row}[id]    blank
    ${local}=    Compute Expected    ${project}
    Numbers Should Be Close    ${cloud}[constructionTotal]    ${local}[constructionTotal]    1
    Level Mark Should Be    land-inspection    done

Project Cards Of A Row Have Their Open Buttons On One Line
    [Documentation]    Layout: three cards in one row (a short name, a two-line Thai name, a long unbroken name):
    ...    every "เปิด" button must have the same top (y). The cards stretch to one height, so a button that
    ...    sits higher in the card with the short title is a visual defect.
    [Tags]    edge    layout
    ${user}=    Register User Via API    layoutrow
    ${ws}=    Personal Workspace Id    ${user}
    Create Project Via API    ${user}    ${ws}    ชื่อสั้น    blank
    Create Project Via API    ${user}    ${ws}    ${LONG_THAI_NAME}    blank
    Create Project Via API    ${user}    ${ws}    ${UNBROKEN_NAME}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Wait For Elements State    css=div.shadow-card button.ant-btn-block >> nth=2    visible    timeout=30s
    ${tops}=    Evaluate JavaScript    ${None}    () => [...document.querySelectorAll('div.shadow-card button.ant-btn-block')].map(b => Math.round(b.getBoundingClientRect().top))
    Length Should Be    ${tops}    3
    Should Be True    max($tops) - min($tops) <= 1    msg="เปิด" buttons are at different heights: ${tops}
    ${cards}=    Evaluate JavaScript    ${None}    () => [...document.querySelectorAll('div.shadow-card:has(button[title])')].map(c => Math.round(c.getBoundingClientRect().top))
    Should Be True    max($cards) - min($cards) <= 1    msg=cards of one row start at different heights: ${cards}

Long Names Are Cut To Two Lines And Never Overflow The Card
    [Documentation]    Layout: the title button clamps to 2 lines (full name in its title attribute); a name without
    ...    spaces wraps instead of widening the card; nothing scrolls sideways.
    [Tags]    edge    layout
    ${user}=    Register User Via API    layoutclamp
    ${ws}=    Personal Workspace Id    ${user}
    Create Project Via API    ${user}    ${ws}    ${LONG_THAI_NAME}    blank
    Create Project Via API    ${user}    ${ws}    ${UNBROKEN_NAME}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${LONG_THAI_NAME}
    Project Card Should Be Visible    ${UNBROKEN_NAME}
    ${metrics}=    Evaluate JavaScript    ${None}    () => [...document.querySelectorAll('div.shadow-card button[title]')].map(b => { const s = getComputedStyle(b); const card = b.closest('div.shadow-card'); return { lines: Math.round(b.getBoundingClientRect().height / parseFloat(s.lineHeight)), cardOverflow: card.scrollWidth - card.clientWidth, bodyOverflow: document.documentElement.scrollWidth - window.innerWidth } })
    FOR    ${m}    IN    @{metrics}
        Should Be True    ${m}[lines] <= 2    msg=title takes ${m}[lines] lines
        Should Be True    ${m}[cardOverflow] <= 0    msg=card content is ${m}[cardOverflow]px wider than the card
        Should Be True    ${m}[bodyOverflow] <= 0    msg=page scrolls sideways by ${m}[bodyOverflow]px
    END

Cards Do Not Overflow On A Phone
    [Documentation]    390 px wide: one column, no horizontal scroll, the "เปิด" button inside the screen.
    [Tags]    edge    layout
    ${user}=    Register User Via API    phone
    ${ws}=    Personal Workspace Id    ${user}
    Create Project Via API    ${user}    ${ws}    ${LONG_THAI_NAME}    sample
    Create Project Via API    ${user}    ${ws}    ${UNBROKEN_NAME}    sample
    Open Cloud Context    /login    390    844
    Sign In Via UI    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${LONG_THAI_NAME}
    Project Card Should Be Visible    ${UNBROKEN_NAME}
    ${overflow}=    Evaluate JavaScript    ${None}    () => document.documentElement.scrollWidth - window.innerWidth
    Should Be True    ${overflow} <= 0    msg=page scrolls sideways by ${overflow}px on a phone
    ${right}=    Evaluate JavaScript    ${None}    () => Math.max(...[...document.querySelectorAll('div.shadow-card button.ant-btn-block')].map(b => b.getBoundingClientRect().right))
    Should Be True    ${right} <= 390    msg=a button ends at ${right}px

Search And Sort Appear From Six Projects
    [Documentation]    With 6 projects the page offers a search box and a sort; below that it hides them.
    [Tags]    edge
    ${user}=    Register User Via API    search
    ${ws}=    Personal Workspace Id    ${user}
    ${tag}=    Unique Suffix
    FOR    ${i}    IN RANGE    5
        Create Project Via API    ${user}    ${ws}    ค้นหา ${tag} ลำดับ ${i}    blank
    END
    Open Signed In Context    ${user}[email]    ${user}[password]
    Wait For Elements State    css=div.shadow-card button[title] >> nth=4    visible    timeout=30s
    Get Element Count    css=input[aria-label="ค้นหาชื่อโครงการ"]    ==    0
    Create Project Via API    ${user}    ${ws}    โครงการพิเศษ ${tag}    blank
    Reload Cloud Page
    Projects Page Should Be Loaded
    Wait For Elements State    css=input[aria-label="ค้นหาชื่อโครงการ"]    visible    timeout=30s
    Fill Text    css=input[aria-label="ค้นหาชื่อโครงการ"]    พิเศษ
    Get Element Count    css=div.shadow-card button[title]    ==    1
    Project Card Should Be Visible    โครงการพิเศษ ${tag}
    Fill Text    css=input[aria-label="ค้นหาชื่อโครงการ"]    ไม่มีชื่อนี้แน่นอน
    Get Text    css=body    contains    ไม่พบโครงการที่ชื่อมี
    Click    css=button:has-text("ล้างคำค้น")
    Get Element Count    css=div.shadow-card button[title]    ==    6

Sorting By Name And By Value Reorders The Cards
    [Tags]    edge
    ${user}=    Register User Via API    sort
    ${ws}=    Personal Workspace Id    ${user}
    ${tag}=    Unique Suffix
    Create Project Via API    ${user}    ${ws}    ก ${tag}    blank
    Create Project Via API    ${user}    ${ws}    ข ${tag}    blank
    Create Project Via API    ${user}    ${ws}    ค ${tag}    blank
    Create Project Via API    ${user}    ${ws}    ง ${tag}    blank
    Create Project Via API    ${user}    ${ws}    จ ${tag}    blank
    Create Project Via API    ${user}    ${ws}    ฮ ใหญ่สุด ${tag}    sample
    Open Signed In Context    ${user}[email]    ${user}[password]
    Wait For Elements State    css=input[aria-label="ค้นหาชื่อโครงการ"]    visible    timeout=30s
    ${first}=    Get Attribute    css=div.shadow-card button[title] >> nth=0    title
    Should Be Equal    ${first}    ฮ ใหญ่สุด ${tag}    msg=newest update comes first by default
    Choose Sort    ชื่อ ก–ฮ
    ${first}=    Get Attribute    css=div.shadow-card button[title] >> nth=0    title
    Should Be Equal    ${first}    ก ${tag}
    Choose Sort    มูลค่าสูงสุด
    ${first}=    Get Attribute    css=div.shadow-card button[title] >> nth=0    title
    Should Be Equal    ${first}    ฮ ใหญ่สุด ${tag}

Workspace Switcher Shows Only The Projects Of The Chosen Workspace
    [Documentation]    Personal vs company: each workspace lists its own projects, never the other's.
    [Tags]    security    db
    ${owner}=    Register User Via API    switcher
    ${personal}=    Personal Workspace Id    ${owner}
    ${company_name}=    Unique Name    บริษัทสลับ
    ${company}=    Create Company Workspace Via API    ${owner}    ${company_name}
    ${mine}=    Unique Name    โครงการส่วนตัว
    ${theirs}=    Unique Name    โครงการบริษัท
    Create Project Via API    ${owner}    ${personal}    ${mine}    blank
    Create Project Via API    ${owner}    ${company}    ${theirs}    blank
    Open Signed In Context    ${owner}[email]    ${owner}[password]
    Wait For Elements State    ${WORKSPACE_SELECT} >> text=${company_name}    visible    timeout=30s
    Project Card Should Be Visible    ${theirs}
    Project Card Should Not Exist    ${mine}
    Select Workspace    ส่วนตัว
    Project Card Should Be Visible    ${mine}
    Project Card Should Not Exist    ${theirs}
    Select Workspace    ${company_name}
    Project Card Should Be Visible    ${theirs}
    Project Card Should Not Exist    ${mine}

Workspace Choice Is Remembered After A Reload
    [Tags]    edge
    ${owner}=    Register User Via API    remember
    ${company_name}=    Unique Name    บริษัทจำ
    Create Company Workspace Via API    ${owner}    ${company_name}
    Open Signed In Context    ${owner}[email]    ${owner}[password]
    Select Workspace    ส่วนตัว
    Reload Cloud Page
    Projects Page Should Be Loaded
    Wait For Elements State    ${WORKSPACE_SELECT} >> text=ส่วนตัว    visible    timeout=30s

Another User Never Sees My Projects
    [Documentation]    Tenant isolation in the UI: user B's project list has none of user A's projects.
    [Tags]    security
    ${a}=    Register User Via API    tenanta
    ${b}=    Register User Via API    tenantb
    ${wa}=    Personal Workspace Id    ${a}
    ${wb}=    Personal Workspace Id    ${b}
    ${secret}=    Unique Name    ความลับของเอ
    ${open}=    Unique Name    โครงการของบี
    Create Project Via API    ${a}    ${wa}    ${secret}    blank
    Create Project Via API    ${b}    ${wb}    ${open}    blank
    Open Signed In Context    ${b}[email]    ${b}[password]
    Project Card Should Be Visible    ${open}
    Project Card Should Not Exist    ${secret}
    Get Text    css=body    not contains    ${secret}

Projects Page Of A Guest Offers Sign In Not Projects
    [Tags]    security
    Open Cloud Context    /projects
    Wait For Elements State    css=button[aria-label="เข้าสู่ระบบ"]    visible    timeout=60s
    Get Text    css=body    contains    โครงการบนคลาวด์
    Get Element Count    css=div.shadow-card    ==    0

Sign Out From The Projects Page Hides The Cloud Projects
    [Tags]    security
    ${user}=    Register User Via API    signoutlist
    ${ws}=    Personal Workspace Id    ${user}
    ${name}=    Unique Name    โครงการหลังออกจากระบบ
    Create Project Via API    ${user}    ${ws}    ${name}    blank
    Open Signed In Context    ${user}[email]    ${user}[password]
    Project Card Should Be Visible    ${name}
    Sign Out Via UI
    Go To Cloud Path    /projects
    Wait For Elements State    css=button[aria-label="เข้าสู่ระบบ"]    visible    timeout=60s
    Get Text    css=body    not contains    ${name}


*** Keywords ***
Archive Project Via API
    [Arguments]    ${user}    ${project_id}
    VAR    &{body}=    archived=${True}
    PATCH On Session    ${user}[alias]    /projects/${project_id}    json=${body}    expected_status=200

Choose Sort
    [Arguments]    ${label}
    Click    css=.ant-select:has([aria-label="เรียงตาม"])
    Click    ${OPEN_SELECT_DROPDOWN} >> css=.ant-select-item-option:has-text("${label}")

Close All Contexts
    [Documentation]    Test teardown: every context of this test goes (cookies and storage never leak to the next one).
    Close Context    ALL    CURRENT

Row Count Should Be
    [Arguments]    ${expected}    ${sql}    @{params}
    ${rows}=    Query Rows    ${sql}    @{params}
    Length Should Be    ${rows}    ${expected}

Thai Date Text
    [Documentation]    ``formatDateTime`` of the app for a UTC timestamp, in Bangkok time: "28 ต.ค. 26 00:35" (Christian-era year).
    [Arguments]    ${timestamp}
    ${t}=    Evaluate    $timestamp.astimezone(datetime.timezone(datetime.timedelta(hours=7)))
    ${months}=    Create List    ม.ค.    ก.พ.    มี.ค.    เม.ย.    พ.ค.    มิ.ย.    ก.ค.    ส.ค.    ก.ย.    ต.ค.    พ.ย.    ธ.ค.
    ${text}=    Evaluate    "{} {} {} {:02d}:{:02d}".format($t.day, $months[$t.month - 1], str($t.year)[-2:], $t.hour, $t.minute)
    RETURN    ${text}
