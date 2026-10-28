*** Settings ***
Documentation       Page objects for the cloud side of ConTrack: sign-in, projects page, members, modules, invitations.
...                 Setup of users, workspaces and projects goes through the HTTP API (fast); the behaviour under
...                 test goes through the browser; the result is read back from the database.
Resource            ../common.resource
Resource            ../journey.resource
Resource            ../api.resource
Resource            ../db.resource


*** Variables ***
${EMAIL_INPUT}              css=input#email
${PASSWORD_INPUT}           css=input#password
${NAME_INPUT}               css=input#displayName
${CONFIRM_INPUT}            css=input#confirm
${ACCOUNT_MENU}             css=button[aria-label="บัญชีผู้ใช้"]
${SUBMIT_BUTTON}            css=form button[type="submit"]
${WORKSPACE_SELECT}         css=.ant-select:has([aria-label="พื้นที่ทำงาน"])
${OPEN_MODAL}               css=.ant-modal-wrap:not([style*="display: none"]) .ant-modal
${OPEN_DROPDOWN}            css=.ant-dropdown:not(.ant-dropdown-hidden)
${OPEN_SELECT_DROPDOWN}     css=.ant-select-dropdown:not(.ant-select-dropdown-hidden)
${PROJECT_BADGE}            css=button[aria-label="โครงการที่เปิดอยู่"]
${LEVEL_MAP_BUTTON}         css=button[aria-label="ภาพรวมขั้นตอน"]
${READ_ONLY_BANNER_TEXT}    คุณมีสิทธิ์ดูโครงการนี้ แก้ตัวเลขไม่ได้
${READ_ONLY_MESSAGE}        คุณมีสิทธิ์ดูอย่างเดียวในโครงการนี้ แก้ไขไม่ได้
${SUBCONTRACT_SWITCH}       css=button[role="switch"][aria-label^="จ้างช่วง"]
${SUBCONTRACT_MENU_ITEM}    css=.ant-menu-horizontal > .ant-menu-item:has-text("จ้างช่วง")
${ROLE_OWNER}               เจ้าของ
${ROLE_ADMIN}               ผู้ดูแล
${ROLE_ESTIMATOR}           ผู้ถอดแบบ/ประมาณราคา
${ROLE_VIEWER}              ดูอย่างเดียว


*** Keywords ***
Go To Cloud Path
    [Documentation]    Navigate inside the app and wait until React has hydrated and the session is known (the header
    ...    shows either "เข้าสู่ระบบ" or the account menu). ``domcontentloaded`` instead of ``load``: the dev server
    ...    sends many script chunks and ``load`` often exceeds a minute when several suites share it.
    [Arguments]    ${path}
    Go To    ${BASE_URL}${path}    wait_until=domcontentloaded
    Wait For Hydration

Go To Level On Map
    [Documentation]    Open ``/journey/<level id>`` and wait until the level page shows its bottom bar.
    [Arguments]    ${level_id}
    Go To Cloud Path    /journey/${level_id}
    Wait For Elements State    ${LEVEL_MAP_BUTTON}    visible    timeout=90s
    Page Should Have No Error Overlay

Open Cloud Context
    [Documentation]    Like ``Open Fresh Context`` (own cookies and storage, Thai locale, Bangkok time) but waits for
    ...    hydration instead of ``load`` + ``networkidle``.
    [Arguments]    ${path}=/    ${viewport_width}=1440    ${viewport_height}=900
    VAR    &{viewport}=    width=${viewport_width}    height=${viewport_height}
    New Context    locale=th-TH    timezoneId=Asia/Bangkok    viewport=${viewport}    acceptDownloads=True
    New Page    ${BASE_URL}${path}    wait_until=domcontentloaded
    Wait For Hydration

Reload Cloud Page
    [Documentation]    Reload by navigating to the current URL (``domcontentloaded`` + hydration), see ``Go To Cloud Path``.
    ${url}=    Get Url
    Go To    ${url}    wait_until=domcontentloaded
    Wait For Hydration

Wait For Hydration
    [Documentation]    The header's account area renders only after React hydrated and the session check answered.
    Wait For Elements State    css=button[aria-label="เข้าสู่ระบบ"], button[aria-label="บัญชีผู้ใช้"]    visible    timeout=90s

Open Cloud Suite
    [Documentation]    One browser per suite; a 120 s default timeout because the dev server compiles a route on its
    ...    first visit (20-40 s) and the cloud pages are many.
    Open Browser For Suite
    Set Browser Timeout    120s

Account Menu Should Offer
    [Documentation]    Open the account menu and check an entry is (or is not) in it; the menu is closed again.
    [Arguments]    ${entry}    ${present}=${True}
    Click    ${ACCOUNT_MENU}
    Wait For Elements State    ${OPEN_DROPDOWN}    visible
    ${n}=    Get Element Count    ${OPEN_DROPDOWN} >> css=li >> text="${entry}"
    IF    ${present}
        Should Be True    ${n} >= 1    msg=Account menu has no entry "${entry}"
    ELSE
        Should Be Equal As Integers    ${n}    0    msg=Account menu must not offer "${entry}"
    END
    Keyboard Key    press    Escape

Add Member Via API
    [Documentation]    Register a new user and make them a member of ``${workspace_id}`` with ``${role}`` (invitation +
    ...    accept through the API). Returns the user dictionary.
    [Arguments]    ${owner}    ${workspace_id}    ${role}    ${prefix}=${role}
    ${user}=    Register User Via API    ${prefix}
    ${token}=    Invite Via API    ${owner}    ${workspace_id}    ${user}[email]    ${role}
    Accept Invitation Via API    ${user}    ${token}
    RETURN    ${user}

Accept Invitation Via API
    [Arguments]    ${user}    ${token}    ${expected_status}=200
    VAR    &{body}=    token=${token}
    ${resp}=    POST On Session    ${user}[alias]    /invitations/accept    json=${body}    expected_status=${expected_status}
    RETURN    ${resp}

Alert Should Show
    [Documentation]    An inline Ant Design alert (error banner on the auth forms, info on the pages).
    [Arguments]    ${text}
    Wait For Elements State    css=.ant-alert >> text=${text}    visible    timeout=30s

Apply Doc To Project
    [Documentation]    In place: set one stored document on the project dictionary (as ``applyDoc`` of the domain does).
    [Arguments]    ${project}    ${doc_key}    ${data}
    IF    '${doc_key}' == 'journey'
        Evaluate    $project.update({'journey': $data})
        RETURN
    END
    IF    '${doc_key}' == 'meta'
        Evaluate    $project['meta'].update($data)
        RETURN
    END
    ${kind}    ${rest}=    Split String    ${doc_key}    :    max_split=1
    IF    '${kind}' == 'calc'
        Evaluate    $project['calculators'].update({$rest: $data})
    ELSE IF    '${kind}' == 'boq'
        Evaluate    $project['boqOverrides'].update({$rest: $data})
    ELSE IF    '${kind}' == 'planning'
        Evaluate    $project.setdefault('planning', {}).update({$rest: $data})
    END

Assignment Row Count
    [Documentation]    Number of ``level_assignments`` rows of a project (optionally for one level).
    [Arguments]    ${project_id}    ${level_id}=${EMPTY}
    IF    '${level_id}' == '${EMPTY}'
        ${n}=    Query Value    select count(*) from level_assignments where project_id = %s    ${project_id}
    ELSE
        ${n}=    Query Value    select count(*) from level_assignments where project_id = %s and level_id = %s
        ...    ${project_id}    ${level_id}
    END
    RETURN    ${n}

Click Card Open Button
    [Arguments]    ${name}
    ${card}=    Project Card    ${name}
    Click    ${card} >> css=button.ant-btn-block

Create Company Team
    [Documentation]    Owner + company workspace + one member per role in ``@{roles}`` (all through the API).
    ...    Returns ``&{team}``: owner, ws, ws_name, and a user per role (admin / estimator / viewer).
    [Arguments]    @{roles}
    ${owner}=    Register User Via API    owner
    ${ws_name}=    Unique Name    บริษัททดสอบ
    ${ws}=    Create Company Workspace Via API    ${owner}    ${ws_name}
    VAR    &{team}=    owner=${owner}    ws=${ws}    ws_name=${ws_name}
    FOR    ${role}    IN    @{roles}
        ${user}=    Add Member Via API    ${owner}    ${ws}    ${role}
        Set To Dictionary    ${team}    ${role}=${user}
    END
    RETURN    ${team}

Create Project Via UI
    [Documentation]    "สร้างโครงการใหม่" dialog: name, start choice (blank/sample), confirm. The app opens the new
    ...    project and lands on /journey; look it up by name in the database.
    [Arguments]    ${name}    ${start}=blank
    Click    css=button:has-text("สร้างโครงการใหม่")
    Wait For Elements State    ${OPEN_MODAL}    visible
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${name}
    IF    '${start}' == 'sample'    Click    ${OPEN_MODAL} >> css=button:has-text("ลองกับบ้านตัวอย่าง")
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Wait For Condition    Url    should end with    /journey    timeout=90s

Doc Data
    [Arguments]    ${project_id}    ${doc_key}
    ${row}=    Project Doc Row    ${project_id}    ${doc_key}
    RETURN    ${row}[data]

Doc Should Satisfy
    [Documentation]    ``${condition}`` is a Python expression over ``data`` (the stored JSON of the document).
    [Arguments]    ${project_id}    ${doc_key}    ${condition}
    ${rows}=    Query Rows    select data from project_docs where project_id = %s and doc_key = %s
    ...    ${project_id}    ${doc_key}
    Should Not Be Empty    ${rows}    msg=${doc_key} not stored yet
    ${data}=    Set Variable    ${rows}[0][data]
    ${ok}=    Evaluate    bool(eval($condition, {}, {'data': $data}))
    Should Be True    ${ok}    msg=${doc_key} is ${data}, expected ${condition}

Doc Version
    [Documentation]    ``project_docs.version`` of a document, or 0 when the document does not exist yet.
    [Arguments]    ${project_id}    ${doc_key}
    ${rows}=    Query Rows    select version from project_docs where project_id = %s and doc_key = %s
    ...    ${project_id}    ${doc_key}
    ${n}=    Get Length    ${rows}
    IF    ${n} == 0    RETURN    ${0}
    RETURN    ${rows}[0][version]

Doc Version Should Be Above
    [Arguments]    ${project_id}    ${doc_key}    ${version}
    ${now}=    Doc Version    ${project_id}    ${doc_key}
    Should Be True    ${now} > ${version}    msg=${doc_key} is still at version ${now}

Expected For Cloud Project
    [Documentation]    Engine result for the project the DATABASE holds: ``createProject(start)`` with every stored
    ...    document applied (the same rebuild the app does when it opens a cloud project).
    [Arguments]    ${project_id}    ${start}=blank
    ${base}=    Compute Expected For New Project    ${start}
    ${project}=    Set Variable    ${base}[project]
    ${docs}=    Query Rows    select doc_key, data from project_docs where project_id = %s    ${project_id}
    FOR    ${doc}    IN    @{docs}
        Apply Doc To Project    ${project}    ${doc}[doc_key]    ${doc}[data]
    END
    ${expected}=    Compute Expected    ${project}
    RETURN    ${expected}

Form Error Should Show
    [Documentation]    An Ant Design field validation message (red text under the input).
    [Arguments]    ${text}
    Wait For Elements State    css=.ant-form-item-explain-error >> text=${text}    visible    timeout=20s

Go To Level Of Cloud Project
    [Documentation]    Open the level page and wait until the bar shows the cloud project's saved state.
    [Arguments]    ${level_id}
    Go To Level On Map    ${level_id}
    Wait For Elements State    ${PROJECT_BADGE} >> text=บันทึกแล้ว    visible    timeout=60s

Invite Via API
    [Documentation]    Create an invitation. Returns the one-time token.
    [Arguments]    ${owner}    ${workspace_id}    ${email}    ${role}=estimator
    VAR    &{body}=    email=${email}    role=${role}
    ${resp}=    POST On Session    ${owner}[alias]    /workspaces/${workspace_id}/invitations    json=${body}
    ...    expected_status=201
    RETURN    ${resp.json()}[token]

Level Assignee Button
    [Documentation]    The "มอบหมายผู้รับผิดชอบ" button in the level row (map page) whose title contains ``${title}``.
    [Arguments]    ${title}
    RETURN    css=li:has-text("${title}") button[aria-label="มอบหมายผู้รับผิดชอบ"]

Open Card Menu
    [Documentation]    The "ตัวเลือก" (...) button of a project card, then pick ``${item}`` from the dropdown.
    [Arguments]    ${name}    ${item}
    ${card}=    Project Card    ${name}
    Click    ${card} >> css=button[aria-label="ตัวเลือก"]
    Click    ${OPEN_DROPDOWN} >> css=li >> text="${item}"

Open Context As
    [Documentation]    A fresh browser context (own cookies/localStorage) signed in through the form as ``${email}``.
    ...    Returns the context id: switch between several of them with ``Switch Context``.
    [Arguments]    ${email}    ${password}=${DEMO_PASSWORD}    ${path}=/projects    ${clipboard}=${False}
    VAR    &{viewport}=    width=1440    height=900
    ${ctx}=    New Context    locale=th-TH    timezoneId=Asia/Bangkok    viewport=${viewport}
    IF    ${clipboard}    Grant Permissions    clipboard-read    clipboard-write    origin=${BASE_URL}
    New Page    ${BASE_URL}/login    wait_until=domcontentloaded
    Wait For Hydration
    Sign In Via UI    ${email}    ${password}
    IF    '${path}' != '/projects'    Go To Cloud Path    ${path}
    RETURN    ${ctx}

Open Members Page
    Go To Cloud Path    /workspace/members
    Wait For Elements State    css=h3:has-text("สมาชิก")    visible    timeout=60s
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row    visible    timeout=30s

Open Modules Page
    Go To Cloud Path    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s

Open Project From List
    [Documentation]    Press "เปิด" on the card; the app goes to the journey with the cloud project bound.
    [Arguments]    ${name}
    Click Card Open Button    ${name}
    Wait For Condition    Url    should end with    /journey    timeout=90s
    Wait For Elements State    ${PROJECT_BADGE} >> text=บันทึกแล้ว    visible    timeout=30s

Open Projects Page
    Go To Cloud Path    /projects
    Projects Page Should Be Loaded

Project Card
    [Documentation]    Selector of the card whose title button carries the project name (its ``title`` attribute).
    [Arguments]    ${name}
    RETURN    css=div.shadow-card:has(button[title="${name}"])

Project Card Should Be Visible
    [Arguments]    ${name}
    ${card}=    Project Card    ${name}
    Wait For Elements State    ${card}    visible    timeout=30s

Project Card Should Not Exist
    [Arguments]    ${name}
    ${card}=    Project Card    ${name}
    Wait For Elements State    ${card}    detached    timeout=30s

Project Row By Name
    [Documentation]    The ``projects`` row of a workspace by name (fails unless exactly one).
    [Arguments]    ${workspace_id}    ${name}
    ${row}=    Query Row    select * from projects where workspace_id = %s and name = %s    ${workspace_id}    ${name}
    RETURN    ${row}

Projects Page Should Be Loaded
    Wait For Elements State    css=h3:has-text("โครงการทั้งหมด")    visible    timeout=60s
    Wait For Elements State    css=.ant-segmented    visible    timeout=30s
    Wait For Elements State    css=.ant-spin    detached    timeout=30s

Put Doc Via API
    [Documentation]    PUT one project document (``data`` = ${None} resets it). Returns the response.
    [Arguments]    ${user}    ${project_id}    ${doc_key}    ${data}    ${base_version}=${0}    ${expected_status}=200
    VAR    &{body}=    data=${data}    baseVersion=${base_version}
    ${resp}=    PUT On Session    ${user}[alias]    /projects/${project_id}/docs/${doc_key}    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

Register Via UI
    [Documentation]    Fill the register form and press the submit button unless ``${submit}`` is false.
    [Arguments]    ${name}    ${email}    ${password}    ${confirm}=${password}    ${submit}=${True}
    Fill Text    ${NAME_INPUT}    ${name}
    Fill Text    ${EMAIL_INPUT}    ${email}
    Fill Text    ${PASSWORD_INPUT}    ${password}
    Fill Text    ${CONFIRM_INPUT}    ${confirm}
    IF    ${submit}    Click    ${SUBMIT_BUTTON}

Select Role In Form
    [Documentation]    The role Select of the invitation form: open it and pick the option with ``${label}``.
    [Arguments]    ${label}
    Click    css=form.ant-form-inline .ant-select
    Click    ${OPEN_SELECT_DROPDOWN} >> css=.ant-select-item-option:has-text("${label}")

Select Workspace
    [Documentation]    Switch the workspace with the page's selector (option text: name · role).
    [Arguments]    ${text}
    Click    ${WORKSPACE_SELECT}
    Click    ${OPEN_SELECT_DROPDOWN} >> css=.ant-select-item-option:has-text("${text}")
    Wait For Elements State    ${WORKSPACE_SELECT} >> text=${text}    visible    timeout=30s
    Wait For Elements State    css=.ant-spin    detached    timeout=30s

Show Active Tab
    Click    css=.ant-segmented-item:has-text("ใช้งานอยู่")
    Wait For Elements State    css=.ant-segmented-item-selected:has-text("ใช้งานอยู่")    visible

Show Archived Tab
    Click    css=.ant-segmented-item:has-text("เก็บถาวร")
    Wait For Elements State    css=.ant-segmented-item-selected:has-text("เก็บถาวร")    visible

Sign In Via UI
    [Documentation]    Fill the real login form and wait until the app leaves /login (lands on /projects by default).
    [Arguments]    ${email}    ${password}=${DEMO_PASSWORD}    ${expect_path}=/projects
    Go To Cloud Path    /login
    Wait For Elements State    ${EMAIL_INPUT}    visible    timeout=60s
    Fill Text    ${EMAIL_INPUT}    ${email}
    Fill Text    ${PASSWORD_INPUT}    ${password}
    Click    ${SUBMIT_BUTTON}
    Wait For Condition    Url    should end with    ${expect_path}    timeout=90s

Open Signed In Context
    [Documentation]    Fresh context (own cookies and localStorage) already signed in through the login form.
    [Arguments]    ${email}    ${password}=${DEMO_PASSWORD}    ${path}=/projects
    Open Cloud Context    /login
    Sign In Via UI    ${email}    ${password}
    IF    '${path}' != '/projects'    Go To Cloud Path    ${path}

Sign Out Via UI
    [Documentation]    Account menu -> ออกจากระบบ. The app returns to the journey in guest mode.
    Click    ${ACCOUNT_MENU}
    Click    ${OPEN_DROPDOWN} >> css=li >> text="ออกจากระบบ"
    Wait For Condition    Url    should end with    /journey    timeout=90s
    Wait For Elements State    css=button[aria-label="เข้าสู่ระบบ"]    visible    timeout=30s

Unlock Levels Via API
    [Documentation]    Mark every level before ``${until_level}`` done in the cloud project (so that level opens).
    [Arguments]    ${user}    ${project_id}    ${until_level}    ${start}=blank
    ${expected}=    Compute Expected For New Project    ${start}
    ${project}=    Project With Levels Done    ${expected}[project]    ${until_level}
    ${existing}=    Doc Version    ${project_id}    journey
    Put Doc Via API    ${user}    ${project_id}    journey    ${project}[journey]    ${existing}

Wait Until Doc Satisfies
    [Documentation]    Poll the database (up to ``${timeout}``) until the stored document satisfies the Python
    ...    expression ``${condition}`` over ``data``. The app saves a moment after the edit.
    [Arguments]    ${project_id}    ${doc_key}    ${condition}    ${timeout}=90s
    Wait Until Keyword Succeeds    ${timeout}    500ms    Doc Should Satisfy    ${project_id}    ${doc_key}    ${condition}

Sign In Form Should Show Error
    [Documentation]    The login form shows ``${text}`` in its red alert and the app stays on /login.
    [Arguments]    ${text}
    Alert Should Show    ${text}
    Get Url    should end with    /login

Toast Should Show
    [Documentation]    An Ant Design toast containing ``${text}`` (30 s: the dev server can be slow under load).
    [Arguments]    ${text}
    Wait For Elements State    css=.ant-message-notice, .ant-notification-notice >> text=${text}    visible    timeout=30s
