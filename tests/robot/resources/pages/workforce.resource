*** Settings ***
Documentation       Page objects of the workforce module ("ทีมช่างและการจัดคน"): the company page /workspace/crews (tabs
...                 ทีมช่าง and บุคลากร), the project page /team (ทีมงาน), the crew board /workspace/board and the account
...                 menu entries. Data is set up through the HTTP API (api_workforce.resource); the behaviour under test
...                 goes through the browser; results are read back from the database.
Resource            cloud.resource
Resource            api_workforce.resource


*** Variables ***
${CREWS TITLE}              ทีมช่างและบุคลากร
${BOARD TITLE}              กระดานจัดคน
${MODULE OFF TITLE}         ยังไม่เปิดใช้งาน
${WORKFORCE MODULE NAME}    ทีมช่างและการจัดคน
${WORKFORCE SWITCH}         css=button[role="switch"][aria-label="${WORKFORCE MODULE NAME}"]
${CREW SEARCH}              css=input[aria-label="ค้นหาทีม"]
${PEOPLE SEARCH}            css=input[aria-label="ค้นหาบุคลากร"]
${OPEN DRAWER}              css=.ant-drawer
${TABLE ROW}                css=tr.ant-table-row


*** Keywords ***
# ── set-up ─────────────────────────────────────────────────────────────────────────
Create Ui Workforce Team
    [Documentation]    Company with owner, estimator and viewer (all through the API) and the workforce module switched on
    ...    unless ``${module_on}`` is false. Returns ``&{team}``: owner, estimator, viewer, ws, ws_name.
    [Arguments]    ${module_on}=${True}
    ${team}=    Create Company Team    estimator    viewer
    IF    ${module_on}
        VAR    &{on}    enabled=${True}
        PUT On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/modules/workforce    json=${on}    expected_status=200
    END
    RETURN    ${team}

Create Ui Project
    [Documentation]    A ``sample`` project in the team's workspace (so the plan has task dates). Returns its name and id.
    [Arguments]    ${team}
    ${name}=    Unique Name    โครงการทีมช่าง
    ${project}=    Create Project Via API    ${team}[owner]    ${team}[ws]    ${name}    sample
    RETURN    ${name}    ${project}[project][id]

# ── navigation ─────────────────────────────────────────────────────────────────────
Client Navigate To
    [Documentation]    In-app navigation without a reload (the open cloud project lives only in memory).
    [Arguments]    ${path}
    Evaluate JavaScript    ${None}    () => { window.next.router.push("${path}"); }
    Wait Until Keyword Succeeds    120s    500ms    Url Should End With    ${path}

Url Should End With
    [Arguments]    ${path}
    Get Url    $=    ${path}

Open Crews Page As
    [Documentation]    Sign in as ``${user}`` in a fresh context and open /workspace/crews with the crews tab loaded.
    [Arguments]    ${user}
    Open Context As    ${user}[email]    ${user}[password]    /workspace/crews
    Wait For Elements State    css=h3:has-text("${CREWS TITLE}")    visible    timeout=120s
    Wait For Elements State    css=.ant-spin    detached    timeout=60s

Open People Tab
    Click    role=tab[name="บุคลากร"]
    Wait For Elements State    css=.ant-tabs-tab-active:has-text("บุคลากร")    visible    timeout=30s

Open Crews Tab
    Click    role=tab[name="ทีมช่าง"]
    Wait For Elements State    css=.ant-tabs-tab-active:has-text("ทีมช่าง")    visible    timeout=30s

Open Board As
    [Arguments]    ${user}
    Open Context As    ${user}[email]    ${user}[password]    /workspace/board
    Wait For Elements State    css=h3:has-text("${BOARD TITLE}")    visible    timeout=120s

Open Project Team Page As
    [Documentation]    Sign in, open the project from the list (binds the cloud project) and move to /team in-app.
    [Arguments]    ${user}    ${project_name}
    Open Context As    ${user}[email]    ${user}[password]    /projects
    Projects Page Should Be Loaded
    Open Project From List    ${project_name}
    Client Navigate To    /team
    Wait For Elements State    css=h4:has-text("ทีมงาน")    visible    timeout=120s

Team Table Should Be Loaded
    Wait For Elements State    css=table th >> text=รอหลังงาน    visible    timeout=60s
    Wait For Elements State    css=.ant-spin    detached    timeout=60s

# ── crews page: reading ────────────────────────────────────────────────────────────
Crew Row
    [Documentation]    Selector of the table row that shows ``${name}``.
    [Arguments]    ${name}
    RETURN    css=tr.ant-table-row:has-text("${name}")

Crew Should Be Listed
    [Arguments]    ${name}
    Wait For Elements State    ${TABLE ROW}:has-text("${name}")    visible    timeout=30s

Crew Should Not Be Listed
    [Arguments]    ${name}
    Wait For Elements State    ${TABLE ROW}:has-text("${name}")    detached    timeout=30s

Table Rows Should Be
    [Arguments]    ${count}
    Get Element Count    ${TABLE ROW}    ==    ${count}

Column Should Be Shown
    [Documentation]    The visible table header ``${title}`` exists (``${shown}`` true) or not.
    [Arguments]    ${title}    ${shown}=${True}
    ${n}=    Get Element Count    css=.ant-tabs-tabpane-active th.ant-table-cell >> text="${title}"
    IF    ${shown}
        Should Be True    ${n} >= 1    msg=Column "${title}" should be visible
    ELSE
        Should Be Equal As Integers    ${n}    0    msg=Column "${title}" must be hidden
    END

# ── crews page: dialogs ────────────────────────────────────────────────────────────
Choose Option In Open Modal Select
    [Documentation]    Open the antd Select that holds ``input#${field_id}`` inside the visible modal / drawer and pick
    ...    the option titled ``${option}``.
    [Arguments]    ${field_id}    ${option}
    Click    css=.ant-modal-wrap:not([style*="display: none"]) .ant-select:has(input#${field_id}), .ant-drawer .ant-select:has(input#${field_id})
    Click    ${OPEN_SELECT_DROPDOWN} >> css=.ant-select-item-option[title="${option}"]

Add Crew Via Quick Dialog
    [Documentation]    "เพิ่มทีม" -> fill name, trade, counts -> confirm. Works from the first-use screen too.
    [Arguments]    ${name}    ${trade_label}    ${skilled}=2    ${labourers}=3
    ${first_use}=    Get Element Count    css=button:has-text("เพิ่มทีมแรก")
    IF    ${first_use} > 0
        Click    css=button:has-text("เพิ่มทีมแรก")
    ELSE
        Click    css=button.ant-btn-primary:has-text("เพิ่มทีม")
    END
    Wait For Elements State    ${OPEN_MODAL}    visible
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${name}
    Choose Option In Open Modal Select    trade    ${trade_label}
    Fill Text    ${OPEN_MODAL} >> css=input#skilledCount    ${skilled}
    Fill Text    ${OPEN_MODAL} >> css=input#labourerCount    ${labourers}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Wait For Elements State    css=.ant-modal-wrap:not([style*="display: none"]) .ant-modal    detached    timeout=30s

Add Person Via Drawer
    [Arguments]    ${name}    ${phone}=${EMPTY}    ${wage}=${EMPTY}
    Click    css=button.ant-btn-primary:has-text("เพิ่มบุคลากร")
    Wait For Elements State    ${OPEN DRAWER} >> css=input#name    visible
    Fill Text    ${OPEN DRAWER} >> css=input#name    ${name}
    IF    $phone    Fill Text    ${OPEN DRAWER} >> css=input#phone    ${phone}
    IF    $wage    Fill Text    ${OPEN DRAWER} >> css=input#dailyWage    ${wage}
    Click    css=.ant-drawer-footer button.ant-btn-primary
    Wait For Elements State    ${OPEN DRAWER} >> css=input#name    detached    timeout=30s

Archive Row Named
    [Documentation]    The trash button of the row (aria-label "เก็บถาวร <name>") and the confirmation.
    [Arguments]    ${name}
    Click    css=button[aria-label="เก็บถาวร ${name}"]
    Wait For Elements State    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons    visible
    Click Popconfirm Ok    เก็บถาวร

# ── project team page ──────────────────────────────────────────────────────────────
Open Assign Dialog
    [Arguments]    ${task_id}
    Click    css=button[aria-label^="จัดทีมงาน ${task_id} "]
    Wait For Elements State    ${OPEN_MODAL}    visible    timeout=30s

Pick Crew In Assign Dialog
    [Arguments]    ${crew_name}
    Click    ${OPEN_MODAL} >> css=.ant-select:has([aria-label="ทีม"])
    Click    ${OPEN_SELECT_DROPDOWN} >> css=.ant-select-item-option[title="${crew_name}"]

Save Assign Dialog
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary:has-text("บันทึก")

Assignment Count Of Project
    [Arguments]    ${project_id}
    ${n}=    Count Rows    select count(*) from crew_assignments where project_id = %s    ${project_id}
    RETURN    ${n}

# ── menu ───────────────────────────────────────────────────────────────────────────
Account Menu Should Offer Workforce
    [Arguments]    ${shown}
    Account Menu Should Offer    ${CREWS TITLE}    ${shown}
    Account Menu Should Offer    ${BOARD TITLE}    ${shown}

Choose Filter Option
    [Documentation]    Pick ``${option}`` in a searchable filter Select (found by aria-label). The list is virtual and only
    ...    renders the first rows, so the option is typed into the box first.
    [Arguments]    ${label}    ${option}
    ${sel}=    Input By Label    ${label}
    Click    ${sel}
    Type Text    ${sel}    ${option}
    Click    ${OPEN_SELECT_DROPDOWN} >> css=.ant-select-item-option[title="${option}"]
