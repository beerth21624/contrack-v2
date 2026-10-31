*** Settings ***
Documentation       Business modules on/off (W5): /workspace/modules lets an owner or admin switch "จ้างช่วง" on and off.
...                 With the module off the app must look like plain BOQ estimation: no menu entry, no "จ้างช่วง" link
...                 on the BOQ sections, and /subcontracting answers "ปิดใช้งานอยู่" without crashing. With it on the
...                 entries are back. The switch is stored per workspace in ``workspace_modules``; estimators and
...                 viewers cannot change it. The E2E backend offers only ``subcontracting`` (MODULES_ENABLED).
Resource            ../../resources/pages/cloud.resource
Suite Setup         Open Cloud Suite
Test Teardown       Close All Contexts
Test Tags           modules    cloud


*** Variables ***
${MODULE_NAME}          จ้างช่วง (หาผู้รับเหมาช่วง)
${OFF_TITLE}            ปิดใช้งานอยู่
${MANAGERS_ONLY_TEXT}   เฉพาะเจ้าของหรือผู้ดูแลพื้นที่ทำงานเปิด-ปิดโมดูลได้
${BOQ_LINK}             css=a[href^="/subcontracting/packages/new"]


*** Test Cases ***
New Company Starts With Subcontracting Off
    [Documentation]    A new company has the module off: switch unchecked, status "ปิดอยู่", no menu entry, and the
    ...    database has no enabled row.
    [Tags]    smoke    db
    ${team}=    Create Company Team
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Get Attribute    ${SUBCONTRACT_SWITCH}    aria-checked    ==    false
    Get Text    css=tr.ant-table-row:has-text("${MODULE_NAME}")    contains    ปิดอยู่
    Get Element Count    ${SUBCONTRACT_MENU_ITEM}    ==    0
    Module Should Be Stored As    ${team}[ws]    ${False}

Owner Switches Subcontracting On
    [Documentation]    Switch on: message, status "เปิดใช้งาน", ``workspace_modules.enabled`` true with the owner as
    ...    ``enabled_by``, and the menu entry "จ้างช่วง" appears in the header.
    [Tags]    smoke    db
    ${team}=    Create Company Team
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Click    ${SUBCONTRACT_SWITCH}
    Toast Should Show    เปิด ${MODULE_NAME} แล้ว
    Get Attribute    ${SUBCONTRACT_SWITCH}    aria-checked    ==    true
    Get Text    css=body    contains    เปิดใช้งาน
    Wait For Elements State    ${SUBCONTRACT_MENU_ITEM}    visible    timeout=30s
    Module Should Be Stored As    ${team}[ws]    ${True}
    ${row}=    Query Row    select * from workspace_modules where workspace_id = %s and module = 'subcontracting'    ${team}[ws]
    Should Be Equal As Strings    ${row}[enabled_by]    ${team}[owner][id]
    Should Not Be Equal    ${row}[enabled_at]    ${None}

Owner Switches Subcontracting Off After Confirming
    [Tags]    smoke    db
    ${team}=    Create Company Team
    Enable Subcontracting Via API    ${team}[owner]    ${team}[ws]
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Wait For Elements State    ${SUBCONTRACT_MENU_ITEM}    visible    timeout=30s
    Click    ${SUBCONTRACT_SWITCH}
    Wait For Elements State    css=.ant-modal-confirm    visible
    Get Text    css=.ant-modal-confirm    contains    ปิด ${MODULE_NAME}?
    Click    css=.ant-modal-confirm button:has-text("ปิดโมดูล")
    Toast Should Show    ปิด ${MODULE_NAME} แล้ว
    Get Attribute    ${SUBCONTRACT_SWITCH}    aria-checked    ==    false
    Wait For Elements State    ${SUBCONTRACT_MENU_ITEM}    detached    timeout=30s
    Module Should Be Stored As    ${team}[ws]    ${False}

Cancelling The Switch Off Dialog Keeps The Module On
    [Tags]    edge    db
    ${team}=    Create Company Team
    Enable Subcontracting Via API    ${team}[owner]    ${team}[ws]
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Click    ${SUBCONTRACT_SWITCH}
    Wait For Elements State    css=.ant-modal-confirm    visible
    Click    css=.ant-modal-confirm button:has-text("ยกเลิก")
    Wait For Elements State    css=.ant-modal-confirm    detached    timeout=10s
    Get Attribute    ${SUBCONTRACT_SWITCH}    aria-checked    ==    true
    Module Should Be Stored As    ${team}[ws]    ${True}

The Choice Survives A Reload
    [Tags]    edge    db
    ${team}=    Create Company Team
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Click    ${SUBCONTRACT_SWITCH}
    Toast Should Show    เปิด ${MODULE_NAME} แล้ว
    Reload Cloud Page
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Get Attribute    ${SUBCONTRACT_SWITCH}    aria-checked    ==    true
    Wait For Elements State    ${SUBCONTRACT_MENU_ITEM}    visible    timeout=30s

Admin Can Switch The Module
    [Tags]    security    db
    ${team}=    Create Company Team    admin
    Open Context As    ${team}[admin][email]    ${team}[admin][password]    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Get Element Count    css=.ant-alert:has-text("${MANAGERS_ONLY_TEXT}")    ==    0
    Click    ${SUBCONTRACT_SWITCH}
    Toast Should Show    เปิด ${MODULE_NAME} แล้ว
    Module Should Be Stored As    ${team}[ws]    ${True}

Estimator Cannot Switch The Module
    [Documentation]    The switch is disabled, an info box says only owner/admin may change it, nothing is stored.
    [Tags]    security    negative    db
    ${team}=    Create Company Team    estimator
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    disabled
    Alert Should Show    ${MANAGERS_ONLY_TEXT}
    Module Should Be Stored As    ${team}[ws]    ${False}

Viewer Cannot Switch The Module
    [Tags]    security    negative    db
    ${team}=    Create Company Team    viewer
    Open Context As    ${team}[viewer][email]    ${team}[viewer][password]    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    disabled
    Alert Should Show    ${MANAGERS_ONLY_TEXT}
    Module Should Be Stored As    ${team}[ws]    ${False}

Server Refuses A Module Change From An Estimator Or A Viewer
    [Documentation]    Security: the screen hides the control, the API enforces it (403) and the row stays unchanged.
    [Tags]    security    negative    db
    ${team}=    Create Company Team    estimator    viewer
    VAR    &{body}=    enabled=${True}
    FOR    ${role}    IN    estimator    viewer
        ${resp}=    PUT On Session    ${team}[${role}][alias]    /workspaces/${team}[ws]/modules/subcontracting    json=${body}
        ...    expected_status=403
        Error Code Should Be    ${resp}    forbidden
    END
    Module Should Be Stored As    ${team}[ws]    ${False}

Outsider Cannot Read Or Change Another Workspace's Modules
    [Tags]    security    negative
    ${team}=    Create Company Team
    ${outsider}=    Register User Via API    outsider
    VAR    &{body}=    enabled=${True}
    PUT On Session    ${outsider}[alias]    /workspaces/${team}[ws]/modules/subcontracting    json=${body}    expected_status=404
    GET On Session    ${outsider}[alias]    /workspaces/${team}[ws]/modules    expected_status=404
    Module Should Be Stored As    ${team}[ws]    ${False}

Modules That The Platform Does Not Offer Are Locked
    [Documentation]    Modules this server does not offer (``LEGACY_MODULE_IDS`` minus ``OFFERED_MODULES``: materials, owner-leads
    ...    and the AI assistant): each shows "ยังไม่เปิดให้บริการ" and its switch is disabled, even for the owner.
    [Tags]    edge
    ${team}=    Create Company Team
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Get Element Count    css=button[role="switch"]    ==    ${{ len($LEGACY_MODULE_IDS) }}
    Get Element Count    css=button[role="switch"][disabled]    ==    ${{ len($LEGACY_MODULE_IDS) - len($OFFERED_MODULES) }}
    Get Element Count    css=.ant-tag:has-text("ยังไม่เปิดให้บริการ")    ==    ${{ len($LEGACY_MODULE_IDS) - len($OFFERED_MODULES) }}
    Get Attribute    ${SUBCONTRACT_SWITCH}    disabled    ==    ${None}

Subcontracting Page Says It Is Off And Offers The Way To Turn It On
    [Documentation]    Module off: /subcontracting shows "ปิดใช้งานอยู่" with a link to the settings (owner), no crash.
    [Tags]    smoke
    ${team}=    Create Company Team
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /subcontracting
    Wait For Elements State    css=.ant-result >> text=${OFF_TITLE}    visible    timeout=60s
    Get Text    css=.ant-result    contains    พื้นที่ทำงานนี้ใช้เฉพาะการประมาณราคา BOQ
    Page Should Have No Error Overlay
    Click    css=.ant-result a[href="/workspace/modules"] button
    Wait For Condition    Url    should end with    /workspace/modules    timeout=90s

Estimator Sees A Way Back To The BOQ When The Module Is Off
    [Tags]    edge
    ${team}=    Create Company Team    estimator
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]    /subcontracting
    Wait For Elements State    css=.ant-result >> text=${OFF_TITLE}    visible    timeout=60s
    Get Element Count    css=.ant-result a[href="/workspace/modules"]    ==    0
    Get Element Count    css=.ant-result a[href="/journey"] button    ==    1

Subcontracting Sub Pages Are Not Available When The Module Is Off
    [Documentation]    Deep links into the module (packages, vendors, contracts, report, retention, settings) answer
    ...    the same "ปิดใช้งานอยู่" and never show a package list or an error screen.
    [Tags]    edge    negative
    [Template]    Module Page Should Be Off
    /subcontracting/packages/new
    /subcontracting/vendors
    /subcontracting/contracts
    /subcontracting/report
    /subcontracting/retention
    /subcontracting/settings

Subcontracting Page Opens When The Module Is On
    [Tags]    smoke
    ${team}=    Create Company Team
    Enable Subcontracting Via API    ${team}[owner]    ${team}[ws]
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /subcontracting
    Wait For Elements State    css=main, .ant-layout-content    visible    timeout=60s
    Wait For Elements State    css=.ant-spin    detached    timeout=30s
    Get Element Count    css=.ant-result:has-text("${OFF_TITLE}")    ==    0
    Page Should Have No Error Overlay
    Get Text    css=body    contains    จ้างช่วง

Estimator And Viewer See The Menu Entry When The Module Is On
    [Documentation]    Everyone in the workspace sees the entry when it is on (they may read subcontracting).
    [Tags]    edge
    ${team}=    Create Company Team    estimator    viewer
    Enable Subcontracting Via API    ${team}[owner]    ${team}[ws]
    FOR    ${role}    IN    estimator    viewer
        Open Context As    ${team}[${role}][email]    ${team}[${role}][password]
        Projects Page Should Be Loaded
        Wait For Elements State    ${SUBCONTRACT_MENU_ITEM}    visible    timeout=30s
    END

Menu Follows The Workspace Chosen In The Switcher
    [Documentation]    The user owns two companies: the module is on in one and off in the other; the header menu and
    ...    the switch follow the workspace selected on the page.
    [Tags]    edge    db
    ${owner}=    Register User Via API    twoco
    ${on_name}=    Unique Name    บริษัทเปิดโมดูล
    ${off_name}=    Unique Name    บริษัทปิดโมดูล
    ${on}=    Create Company Workspace Via API    ${owner}    ${on_name}
    ${off}=    Create Company Workspace Via API    ${owner}    ${off_name}
    Enable Subcontracting Via API    ${owner}    ${on}
    Open Context As    ${owner}[email]    ${owner}[password]    /workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Select Workspace    ${on_name}
    Wait For Elements State    ${SUBCONTRACT_MENU_ITEM}    visible    timeout=30s
    Get Attribute    ${SUBCONTRACT_SWITCH}    aria-checked    ==    true
    Select Workspace    ${off_name}
    Wait For Elements State    ${SUBCONTRACT_MENU_ITEM}    detached    timeout=30s
    Get Attribute    ${SUBCONTRACT_SWITCH}    aria-checked    ==    false
    Module Should Be Stored As    ${on}    ${True}
    Module Should Be Stored As    ${off}    ${False}

BOQ Sections Offer Subcontracting Only While The Module Is On
    [Documentation]    With a cloud project open, the BOQ page shows a "จ้างช่วง" link per section when the module is on
    ...    and none when it is off. Switching it off removes them again.
    [Tags]    smoke    edge
    ${team}=    Create Company Team
    ${name}=    Unique Name    โครงการจ้างช่วง
    Create Project Via API    ${team}[owner]    ${team}[ws]    ${name}    sample
    Open Context As    ${team}[owner][email]    ${team}[owner][password]
    Open Project From List    ${name}
    Go To Cloud Path    /boq
    Wait For Elements State    css=#boq-section-5    visible    timeout=60s
    Get Element Count    ${BOQ_LINK}    ==    0
    Get Element Count    css=a:has-text("จ้างช่วง")    ==    0
    Enable Subcontracting Via API    ${team}[owner]    ${team}[ws]
    Reload Cloud Page
    Wait For Elements State    css=#boq-section-5    visible    timeout=60s
    Wait For Elements State    ${BOQ_LINK} >> nth=0    visible    timeout=30s
    Disable Subcontracting Via API    ${team}[owner]    ${team}[ws]
    Reload Cloud Page
    Wait For Elements State    css=#boq-section-5    visible    timeout=60s
    Get Element Count    ${BOQ_LINK}    ==    0

Viewer Does Not Get Package Buttons On The BOQ
    [Documentation]    Subcontract links need ``sc.packages.manage``: a viewer sees none even with the module on.
    [Tags]    security    edge
    ${team}=    Create Company Team    viewer
    ${name}=    Unique Name    โครงการดูอย่างเดียว
    Create Project Via API    ${team}[owner]    ${team}[ws]    ${name}    sample
    Enable Subcontracting Via API    ${team}[owner]    ${team}[ws]
    Open Context As    ${team}[viewer][email]    ${team}[viewer][password]
    Open Project From List    ${name}
    Go To Cloud Path    /boq
    Wait For Elements State    css=#boq-section-5    visible    timeout=60s
    Get Element Count    ${BOQ_LINK}    ==    0

Switching Off Keeps The Workspace Data
    [Documentation]    "ปิดแล้วข้อมูลไม่หาย": projects and members are untouched after the module is turned off and on.
    [Tags]    edge    db
    ${team}=    Create Company Team    estimator
    ${name}=    Unique Name    โครงการคงอยู่
    ${created}=    Create Project Via API    ${team}[owner]    ${team}[ws]    ${name}    sample
    Enable Subcontracting Via API    ${team}[owner]    ${team}[ws]
    Disable Subcontracting Via API    ${team}[owner]    ${team}[ws]
    Row Count Should Be    1    select 1 from projects where id = %s    ${created}[project][id]
    Row Count Should Be    2    select 1 from memberships where workspace_id = %s    ${team}[ws]
    Open Context As    ${team}[owner][email]    ${team}[owner][password]
    Project Card Should Be Visible    ${name}

Menu Entry Is Also In The Phone Drawer Only When The Module Is On
    [Tags]    edge
    ${team}=    Create Company Team
    Open Cloud Context    /login    390    844
    Sign In Via UI    ${team}[owner][email]    ${team}[owner][password]
    Projects Page Should Be Loaded
    Click    css=button[aria-label="เมนู"]
    Wait For Elements State    css=.ant-drawer-open .ant-menu    visible    timeout=15s
    Get Element Count    css=.ant-drawer-open .ant-menu-item:has-text("จ้างช่วง")    ==    0
    Keyboard Key    press    Escape
    Enable Subcontracting Via API    ${team}[owner]    ${team}[ws]
    Reload Cloud Page
    Projects Page Should Be Loaded
    Click    css=button[aria-label="เมนู"]
    Wait For Elements State    css=.ant-drawer-open .ant-menu-item:has-text("จ้างช่วง")    visible    timeout=30s

Modules Page Needs A Sign In
    [Tags]    security
    Open Cloud Context    /subcontracting
    Wait For Elements State    css=button[aria-label="เข้าสู่ระบบ"]    visible    timeout=60s
    Get Element Count    css=a[href^="/login?next="]    >=    1
    Page Should Have No Error Overlay

Demo Viewer Sees The Module Switch But Cannot Use It
    [Documentation]    Read-only look at the seeded company with the viewer account: the page loads, the switch is
    ...    disabled. Nothing is clicked.
    [Tags]    security
    Open Context As    ${DEMO_VIEWER}    path=/workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    disabled
    Alert Should Show    ${MANAGERS_ONLY_TEXT}

Demo Owner Can See An Enabled Switch
    [Documentation]    Read-only look: the owner's switch is not disabled (nothing is clicked).
    [Tags]    smoke
    Open Context As    ${DEMO_OWNER}    path=/workspace/modules
    Wait For Elements State    ${SUBCONTRACT_SWITCH}    visible    timeout=60s
    Get Attribute    ${SUBCONTRACT_SWITCH}    disabled    ==    ${None}
    Get Element Count    css=.ant-alert:has-text("${MANAGERS_ONLY_TEXT}")    ==    0

Personal Workspace Modules Page Does Not Crash
    [Tags]    edge
    ${user}=    Register User Via API    personalmodules
    Open Context As    ${user}[email]    ${user}[password]    /workspace/modules
    Wait For Elements State    css=button[role="switch"] >> nth=0    visible    timeout=60s
    Page Should Have No Error Overlay
    Get Element Count    css=button[role="switch"]    ==    ${{ len($LEGACY_MODULE_IDS) }}


*** Keywords ***
Close All Contexts
    [Documentation]    Test teardown: every context of this test goes (cookies and storage never leak to the next one).
    Close Context    ALL    CURRENT

Disable Subcontracting Via API
    [Arguments]    ${user}    ${workspace_id}
    VAR    &{body}=    enabled=${False}
    PUT On Session    ${user}[alias]    /workspaces/${workspace_id}/modules/subcontracting    json=${body}    expected_status=200

Enable Subcontracting Via API
    [Arguments]    ${user}    ${workspace_id}
    VAR    &{body}=    enabled=${True}
    PUT On Session    ${user}[alias]    /workspaces/${workspace_id}/modules/subcontracting    json=${body}    expected_status=200

Module Page Should Be Off
    [Arguments]    ${path}
    ${team}=    Create Company Team
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    ${path}
    Wait For Elements State    css=.ant-result >> text=${OFF_TITLE}    visible    timeout=60s
    Page Should Have No Error Overlay
    Get Element Count    css=.ant-table-tbody tr.ant-table-row    ==    0

Module Should Be Stored As
    [Documentation]    ``workspace_modules.enabled`` for subcontracting (no row counts as off).
    [Arguments]    ${workspace_id}    ${enabled}
    ${rows}=    Query Rows    select enabled from workspace_modules where workspace_id = %s and module = 'subcontracting'    ${workspace_id}
    ${actual}=    Evaluate    bool($rows[0]['enabled']) if $rows else False
    Should Be Equal    ${actual}    ${enabled}

Row Count Should Be
    [Arguments]    ${expected}    ${sql}    @{params}
    ${rows}=    Query Rows    ${sql}    @{params}
    Length Should Be    ${rows}    ${expected}
