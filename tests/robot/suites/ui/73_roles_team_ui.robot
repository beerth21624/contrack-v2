*** Settings ***
Documentation       Roles and team management in the browser (W5): what owner / admin / estimator / viewer see and can
...                 do, invitations (create, copy, accept as the invitee in a second browser context, revoke), role
...                 changes, removing members, the last-owner rule, and assigning journey levels to members.
...                 Every write is read back from ``memberships``, ``invitations`` or ``level_assignments``; users and
...                 workspaces are created through the API so no test touches the seeded demo data (the demo accounts
...                 are only signed in with, read-only).
Resource            ../../resources/pages/cloud.resource
Suite Setup         Open Cloud Suite
Test Teardown       Close All Contexts
Test Tags           team    cloud


*** Variables ***
${INVITE_EMAIL_INPUT}       css=input[placeholder="อีเมลของคนที่จะเชิญ"]
${CREATE_LINK_BUTTON}       css=button:has-text("สร้างลิงก์เชิญ")
${INVITE_LINK_INPUT}        css=input[aria-label="ลิงก์เชิญ"]
${INVITE_SECTION_TITLE}     เชิญสมาชิก
${LAST_OWNER_TEXT}          ต้องมีเจ้าของอย่างน้อย 1 คนเสมอ
${ASSIGN_BUTTON}            css=button[aria-label="มอบหมายผู้รับผิดชอบ"]
${SAVED_TEXT}               บันทึกแล้ว


*** Test Cases ***
Owner Sees Every Management Control
    [Documentation]    Owner of a company: invite section, rename and delete workspace, a role selector and a remove
    ...    button for each of the three other members.
    [Tags]    smoke
    ${team}=    Create Company Team    admin    estimator    viewer
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=3    visible    timeout=60s
    Get Text    css=body    contains    ${INVITE_SECTION_TITLE}
    Get Element Count    css=button:has-text("เปลี่ยนชื่อ")    ==    1
    Get Element Count    css=button:has-text("ลบพื้นที่")    ==    1
    Get Element Count    css=tr.ant-table-row .ant-select    ==    3
    Get Element Count    css=tr.ant-table-row button:has-text("นำออก")    ==    3
    Get Text    css=body    contains    บทบาทของคุณ: ${ROLE_OWNER}

Admin Manages Members But Not The Owner Or The Workspace
    [Tags]    security
    ${team}=    Create Company Team    admin    estimator    viewer
    Open Context As    ${team}[admin][email]    ${team}[admin][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=3    visible    timeout=60s
    Get Text    css=body    contains    ${INVITE_SECTION_TITLE}
    Get Element Count    css=button:has-text("ลบพื้นที่")    ==    0
    ${owner_row}=    Member Row    ${team}[owner][email]
    Get Element Count    ${owner_row} >> css=.ant-select    ==    0
    Get Element Count    ${owner_row} >> css=button:has-text("นำออก")    ==    0
    ${estimator_row}=    Member Row    ${team}[estimator][email]
    Get Element Count    ${estimator_row} >> css=.ant-select    ==    1
    Get Element Count    ${estimator_row} >> css=button:has-text("นำออก")    ==    1

Estimator Can Read Members But Not Manage Them
    [Tags]    security
    ${team}=    Create Company Team    admin    estimator    viewer
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=3    visible    timeout=60s
    Get Text    css=body    not contains    ${INVITE_SECTION_TITLE}
    Get Element Count    css=tr.ant-table-row .ant-select    ==    0
    Get Element Count    css=tr.ant-table-row button:has-text("นำออก")    ==    0
    Get Element Count    css=button:has-text("เปลี่ยนชื่อ")    ==    0
    Get Element Count    css=button:has-text("ลบพื้นที่")    ==    0
    Get Text    css=body    contains    บทบาทของคุณ: ${ROLE_ESTIMATOR}

Viewer Can Read Members But Not Manage Them
    [Tags]    security
    ${team}=    Create Company Team    admin    estimator    viewer
    Open Context As    ${team}[viewer][email]    ${team}[viewer][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=3    visible    timeout=60s
    Get Text    css=body    not contains    ${INVITE_SECTION_TITLE}
    Get Element Count    css=tr.ant-table-row .ant-select    ==    0
    Get Element Count    css=tr.ant-table-row button:has-text("นำออก")    ==    0
    Get Text    css=body    contains    บทบาทของคุณ: ${ROLE_VIEWER}

Demo Accounts See The Controls Their Role Allows
    [Documentation]    Read-only: sign in as each seeded account and look at /workspace/members (nothing is clicked).
    ...    Columns: e-mail, invite section shown, "ลบพื้นที่" shown.
    [Tags]    smoke
    [Template]    Demo Account Members Page Should Show
    ${DEMO_OWNER}        ${True}     ${True}
    ${DEMO_ADMIN}        ${True}     ${False}
    ${DEMO_ESTIMATOR}    ${False}    ${False}
    ${DEMO_VIEWER}       ${False}    ${False}

Account Menu Offers Members To Everyone And Modules Only To Managers
    [Tags]    security
    ${team}=    Create Company Team    admin    estimator    viewer
    FOR    ${role}    ${modules}    IN    admin    ${True}    estimator    ${False}    viewer    ${False}
        Open Context As    ${team}[${role}][email]    ${team}[${role}][password]
        Projects Page Should Be Loaded
        Account Menu Should Offer    สมาชิก
        Account Menu Should Offer    โมดูลเสริม    ${modules}
    END
    Open Context As    ${team}[owner][email]    ${team}[owner][password]
    Projects Page Should Be Loaded
    Account Menu Should Offer    โมดูลเสริม

Viewer Opens A Company Project Read Only
    [Documentation]    The viewer sees the project and the banner "ดูอย่างเดียว"; typing is rejected with a message and
    ...    nothing is written (the document does not exist and stays absent, also after a reload).
    [Tags]    smoke    security    db
    ${team}=    Create Company Team    viewer
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    Open Context As    ${team}[viewer][email]    ${team}[viewer][password]
    Open Project From List    ${project}[name]
    Go To Level Of Cloud Project    layout
    Get Text    css=body    contains    ${READ_ONLY_BANNER_TEXT}
    Fill Number By Label    จำนวนจุดวางผัง    55
    Toast Should Show    ${READ_ONLY_MESSAGE}
    Row Count Of Doc Should Be    ${project}[id]    calc:layout    0
    Reload Cloud Page
    Wait For Elements State    ${LEVEL_MAP_BUTTON}    visible    timeout=60s
    Get Property    css=[aria-label="จำนวนจุดวางผัง"]    value    !=    55
    Row Count Of Doc Should Be    ${project}[id]    calc:layout    0

Viewer Cannot Change The Seeded Demo Project
    [Documentation]    Demo viewer opens "บ้านตัวอย่าง 1 ชั้น (ทีม)" and tries to edit: the app refuses and the
    ...    stored documents (versions and timestamps) are exactly as before. Nothing of the seed data changes.
    [Tags]    security    db
    ${project_id}=    Query Value    select p.id from projects p join workspaces w on w.id = p.workspace_id where w.name = %s and p.name = %s    ${DEMO_COMPANY}    บ้านตัวอย่าง 1 ชั้น (ทีม)
    ${before}=    Query Rows    select doc_key, version, updated_at from project_docs where project_id = %s order by doc_key    ${project_id}
    Open Context As    ${DEMO_VIEWER}
    Select Workspace    ${DEMO_COMPANY}
    Open Project From List    บ้านตัวอย่าง 1 ชั้น (ทีม)
    Go To Level Of Cloud Project    layout
    Get Text    css=body    contains    ${READ_ONLY_BANNER_TEXT}
    Fill Number By Label    จำนวนหมุด    99
    Toast Should Show    ${READ_ONLY_MESSAGE}
    Reload Cloud Page
    Wait For Elements State    ${LEVEL_MAP_BUTTON}    visible    timeout=60s
    Wait For Elements State    ${PROJECT_BADGE} >> text=${SAVED_TEXT}    visible    timeout=30s
    ${after}=    Query Rows    select doc_key, version, updated_at from project_docs where project_id = %s order by doc_key    ${project_id}
    Should Be Equal    ${after}    ${before}

Viewer Cannot Create Or Change Projects From The List
    [Tags]    security
    ${team}=    Create Company Team    viewer
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    Open Context As    ${team}[viewer][email]    ${team}[viewer][password]
    Project Card Should Be Visible    ${project}[name]
    Get Element Count    css=button:has-text("สร้างโครงการใหม่")    ==    0
    ${card}=    Project Card    ${project}[name]
    Get Element Count    ${card} >> css=button[aria-label="ตัวเลือก"]    ==    0
    Get Text    css=.ant-select-selection-item >> nth=0    contains    ${ROLE_VIEWER}

Viewer Sees The Empty State Without A Create Button
    [Tags]    edge
    ${team}=    Create Company Team    viewer
    Open Context As    ${team}[viewer][email]    ${team}[viewer][password]
    Projects Page Should Be Loaded
    Get Text    css=body    contains    ยังไม่มีโครงการในพื้นที่นี้
    Get Element Count    css=button:has-text("สร้างโครงการแรก")    ==    0
    Get Element Count    css=button:has-text("สร้างโครงการใหม่")    ==    0

Estimator Can Edit A Level And The Change Is Stored
    [Tags]    smoke    db
    ${team}=    Create Company Team    estimator
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]
    Open Project From List    ${project}[name]
    Go To Level Of Cloud Project    layout
    Get Text    css=body    not contains    ${READ_ONLY_BANNER_TEXT}
    Fill Number By Label    จำนวนจุดวางผัง    21
    Wait Until Doc Satisfies    ${project}[id]    calc:layout    data['points'] == 21
    ${row}=    Project Doc Row    ${project}[id]    calc:layout
    Should Be Equal As Strings    ${row}[updated_by]    ${team}[estimator][id]

Estimator Can Create And Rename But Not Delete
    [Documentation]    Estimator permissions: projects.create / edit / archive yes, projects.delete no.
    [Tags]    security
    ${team}=    Create Company Team    estimator
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]
    Project Card Should Be Visible    ${project}[name]
    Get Element Count    css=button:has-text("สร้างโครงการใหม่")    ==    1
    ${card}=    Project Card    ${project}[name]
    Click    ${card} >> css=button[aria-label="ตัวเลือก"]
    Wait For Elements State    ${OPEN_DROPDOWN}    visible
    Get Element Count    ${OPEN_DROPDOWN} >> css=li >> text="เปลี่ยนชื่อ"    ==    1
    Get Element Count    ${OPEN_DROPDOWN} >> css=li >> text="เก็บถาวร"    ==    1
    Get Element Count    ${OPEN_DROPDOWN} >> css=li >> text="ลบถาวร"    ==    0

Admin Can Delete A Project
    [Tags]    security    db
    ${team}=    Create Company Team    admin
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    Open Context As    ${team}[admin][email]    ${team}[admin][password]
    Project Card Should Be Visible    ${project}[name]
    Open Card Menu    ${project}[name]    ลบถาวร
    Click    css=.ant-modal-confirm button:has-text("ลบถาวร")
    Toast Should Show    ลบโครงการแล้ว
    Row Count Should Be    0    select 1 from projects where id = %s    ${project}[id]

Estimator Can Create A Project Through The Dialog
    [Tags]    db
    ${team}=    Create Company Team    estimator
    ${name}=    Unique Name    โครงการของผู้ถอดแบบ
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]
    Projects Page Should Be Loaded
    Create Project Via UI    ${name}
    ${row}=    Project Row By Name    ${team}[ws]    ${name}
    Should Be Equal As Strings    ${row}[created_by]    ${team}[estimator][id]

Permissions Are Enforced By The Server Not Only Hidden In The Screen
    [Documentation]    Direct API calls with the viewer's / estimator's token: write, invite, role change and
    ...    assignment are all 403 and change nothing.
    [Tags]    security    negative    db
    ${team}=    Create Company Team    estimator    viewer
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    Put Doc Via API    ${team}[viewer]    ${project}[id]    calc:layout    ${{ {'points': 1} }}    ${0}    expected_status=403
    VAR    &{invite}=    email=${{ 'x.' + $team['ws'][:8] + '@robot.test' }}    role=viewer
    POST On Session    ${team}[estimator][alias]    /workspaces/${team}[ws]/invitations    json=${invite}    expected_status=403
    VAR    &{role}=    role=owner
    PATCH On Session    ${team}[estimator][alias]    /workspaces/${team}[ws]/members/${team}[estimator][id]    json=${role}    expected_status=403
    VAR    &{assign}=    userId=${team}[estimator][id]
    PUT On Session    ${team}[estimator][alias]    /projects/${project}[id]/assignments/layout    json=${assign}    expected_status=403
    Row Count Should Be    0    select 1 from project_docs where project_id = %s and doc_key = 'calc:layout'    ${project}[id]
    Membership Role Should Be    ${team}[ws]    ${team}[estimator][id]    estimator

Owner Invites A Member By E-mail And Gets A Link
    [Documentation]    The invitation form creates a pending invitation: a dialog with a one-time link, a row in the
    ...    pending list, and an ``invitations`` row (e-mail, role, token stored only as a hash, not accepted).
    [Tags]    smoke    db
    ${team}=    Create Company Team
    ${email}=    Unique Email    invitee
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    ${INVITE_EMAIL_INPUT}    visible    timeout=60s
    Fill Text    ${INVITE_EMAIL_INPUT}    ${email}
    Select Role In Form    ${ROLE_VIEWER}
    Click    ${CREATE_LINK_BUTTON}
    Wait For Elements State    ${OPEN_MODAL} >> text=ลิงก์เชิญพร้อมแล้ว    visible    timeout=15s
    ${link}=    Get Property    ${INVITE_LINK_INPUT}    value
    Should Start With    ${link}    ${BASE_URL}/invite/
    ${token}=    Evaluate    $link.rsplit('/', 1)[1]
    Get Text    ${OPEN_MODAL}    contains    ${email}
    Click    ${OPEN_MODAL} >> css=button:has-text("เสร็จ")
    Wait For Elements State    css=tr:has-text("${email}")    visible    timeout=15s
    ${row}=    Query Row    select * from invitations where workspace_id = %s and email = %s    ${team}[ws]    ${email}
    Should Be Equal    ${row}[role]    viewer
    Should Be Equal As Strings    ${row}[invited_by]    ${team}[owner][id]
    Should Be Equal    ${row}[accepted_at]    ${None}
    Should Be Equal    ${row}[revoked_at]    ${None}
    Should Not Contain    ${row}[token_hash]    ${token}    msg=the invitation token is stored in clear text

Invitation E-mail Is Stored In Lower Case
    [Tags]    edge    db
    ${team}=    Create Company Team
    ${email}=    Unique Email    upperinv
    ${upper}=    Convert To Upper Case    ${email}
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    ${INVITE_EMAIL_INPUT}    visible    timeout=60s
    Fill Text    ${INVITE_EMAIL_INPUT}    ${upper}
    Click    ${CREATE_LINK_BUTTON}
    Wait For Elements State    ${OPEN_MODAL} >> text=ลิงก์เชิญพร้อมแล้ว    visible    timeout=15s
    Query Row    select * from invitations where workspace_id = %s and email = %s    ${team}[ws]    ${email}

Copy Link Button Copies The Invitation Link
    [Tags]    edge
    ${team}=    Create Company Team
    ${email}=    Unique Email    copy
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members    clipboard=${True}
    Wait For Elements State    ${INVITE_EMAIL_INPUT}    visible    timeout=60s
    Fill Text    ${INVITE_EMAIL_INPUT}    ${email}
    Click    ${CREATE_LINK_BUTTON}
    Wait For Elements State    ${INVITE_LINK_INPUT}    visible    timeout=15s
    ${link}=    Get Property    ${INVITE_LINK_INPUT}    value
    Click    ${OPEN_MODAL} >> css=button:has-text("คัดลอกลิงก์")
    Wait For Elements State    ${OPEN_MODAL} >> css=button:has-text("คัดลอกแล้ว")    visible    timeout=10s
    ${clipboard}=    Evaluate JavaScript    ${None}    async () => await navigator.clipboard.readText()
    Should Be Equal    ${clipboard}    ${link}

Invitation Form Rejects A Bad E-mail
    [Tags]    negative    db
    ${team}=    Create Company Team
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    ${INVITE_EMAIL_INPUT}    visible    timeout=60s
    Click    ${CREATE_LINK_BUTTON}
    Form Error Should Show    กรอกอีเมล
    Fill Text    ${INVITE_EMAIL_INPUT}    not-an-email
    Click    ${CREATE_LINK_BUTTON}
    Form Error Should Show    รูปแบบอีเมลไม่ถูกต้อง
    Row Count Should Be    0    select 1 from invitations where workspace_id = %s    ${team}[ws]

Inviting Someone Who Is Already A Member Shows A Message
    [Tags]    negative    db
    ${team}=    Create Company Team    estimator
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    ${INVITE_EMAIL_INPUT}    visible    timeout=60s
    Fill Text    ${INVITE_EMAIL_INPUT}    ${team}[estimator][email]
    Click    ${CREATE_LINK_BUTTON}
    Toast Should Show    ทำรายการนี้ไม่ได้
    Row Count Should Be    0    select 1 from invitations where workspace_id = %s    ${team}[ws]

Invitation Role Choices Never Include Owner
    [Tags]    security
    ${team}=    Create Company Team
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    ${INVITE_EMAIL_INPUT}    visible    timeout=60s
    Click    css=form.ant-form-inline .ant-select
    Wait For Elements State    ${OPEN_SELECT_DROPDOWN}    visible
    Get Element Count    ${OPEN_SELECT_DROPDOWN} >> css=.ant-select-item-option    ==    3
    Get Text    ${OPEN_SELECT_DROPDOWN}    not contains    ${ROLE_OWNER}

Invitee Accepts The Link In A Second Browser
    [Documentation]    Second context: the invited user (already registered) signs in, opens /invite/<token>, joins.
    ...    DB: membership with the invited role, invitation marked accepted by that user. The owner then sees the
    ...    new member in the list.
    [Tags]    smoke    db
    ${team}=    Create Company Team
    ${invitee}=    Register User Via API    joiner
    ${owner_ctx}=    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    ${INVITE_EMAIL_INPUT}    visible    timeout=60s
    Fill Text    ${INVITE_EMAIL_INPUT}    ${invitee}[email]
    Select Role In Form    ${ROLE_ADMIN}
    Click    ${CREATE_LINK_BUTTON}
    Wait For Elements State    ${INVITE_LINK_INPUT}    visible    timeout=15s
    ${link}=    Get Property    ${INVITE_LINK_INPUT}    value
    ${invitee_ctx}=    Open Context As    ${invitee}[email]    ${invitee}[password]
    Go To    ${link}    wait_until=domcontentloaded
    Wait For Elements State    css=button:has-text("เข้าร่วมทีม")    visible    timeout=60s
    Get Text    css=body    contains    ${invitee}[email]
    Click    css=button:has-text("เข้าร่วมทีม")
    Wait For Elements State    css=.ant-result-title:has-text("เข้าร่วมแล้ว")    visible    timeout=30s
    Get Text    css=body    contains    บทบาทของคุณ: ${ROLE_ADMIN}
    Membership Role Should Be    ${team}[ws]    ${invitee}[id]    admin
    ${row}=    Query Row    select * from invitations where workspace_id = %s and email = %s    ${team}[ws]    ${invitee}[email]
    Should Be Equal As Strings    ${row}[accepted_by]    ${invitee}[id]
    Should Not Be Equal    ${row}[accepted_at]    ${None}
    Click    css=button:has-text("ไปที่โครงการของทีม")
    Wait For Condition    Url    should end with    /projects    timeout=90s
    Projects Page Should Be Loaded
    Wait For Elements State    ${WORKSPACE_SELECT} >> text=${team}[ws_name]    visible    timeout=30s
    Switch Context    ${owner_ctx}
    Reload Cloud Page
    Wait For Elements State    css=tr.ant-table-row:has-text("${invitee}[email]")    visible    timeout=60s

An Invitation Link Works Only Once
    [Documentation]    Single use: after it was accepted, the same link is refused with "ใช้ไม่ได้แล้ว" and no second
    ...    membership appears.
    [Tags]    security    negative    db
    ${team}=    Create Company Team
    ${invitee}=    Register User Via API    once
    ${token}=    Invite Via API    ${team}[owner]    ${team}[ws]    ${invitee}[email]    viewer
    Open Context As    ${invitee}[email]    ${invitee}[password]    /invite/${token}
    Click    css=button:has-text("เข้าร่วมทีม")
    Wait For Elements State    css=.ant-result-title:has-text("เข้าร่วมแล้ว")    visible    timeout=30s
    Go To Cloud Path    /invite/${token}
    Wait For Elements State    css=button:has-text("เข้าร่วมทีม")    visible    timeout=60s
    Click    css=button:has-text("เข้าร่วมทีม")
    Wait For Elements State    css=.ant-result >> text=ลิงก์เชิญนี้ใช้ไม่ได้แล้ว    visible    timeout=30s
    Row Count Should Be    1    select 1 from memberships where workspace_id = %s and user_id = %s    ${team}[ws]    ${invitee}[id]

Another User Cannot Use Someone Else's Invitation
    [Documentation]    Security: the link is for one e-mail; a different signed-in user gets "ลิงก์นี้เชิญอีเมลอื่น"
    ...    and is not added.
    [Tags]    security    negative    db
    ${team}=    Create Company Team
    ${invited}=    Register User Via API    invited
    ${thief}=    Register User Via API    thief
    ${token}=    Invite Via API    ${team}[owner]    ${team}[ws]    ${invited}[email]    admin
    Open Context As    ${thief}[email]    ${thief}[password]    /invite/${token}
    Click    css=button:has-text("เข้าร่วมทีม")
    Wait For Elements State    css=.ant-result >> text=ลิงก์นี้เชิญอีเมลอื่น    visible    timeout=30s
    Row Count Should Be    0    select 1 from memberships where workspace_id = %s and user_id = %s    ${team}[ws]    ${thief}[id]

Revoked Invitation Cannot Be Accepted
    [Documentation]    Owner cancels the pending invitation in the UI (popconfirm); the DB marks it revoked and the
    ...    invitee gets "ใช้ไม่ได้แล้ว".
    [Tags]    negative    db
    ${team}=    Create Company Team
    ${invitee}=    Register User Via API    revoked
    ${token}=    Invite Via API    ${team}[owner]    ${team}[ws]    ${invitee}[email]    viewer
    ${owner_ctx}=    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=tr:has-text("${invitee}[email]")    visible    timeout=60s
    Click    css=tr:has-text("${invitee}[email]") button:has-text("ยกเลิก")
    Click    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button:has-text("ยกเลิกคำเชิญ")
    Wait For Elements State    css=tr:has-text("${invitee}[email]")    detached    timeout=15s
    Get Text    css=body    contains    ไม่มีคำเชิญค้าง
    ${row}=    Query Row    select * from invitations where workspace_id = %s and email = %s    ${team}[ws]    ${invitee}[email]
    Should Not Be Equal    ${row}[revoked_at]    ${None}
    Open Context As    ${invitee}[email]    ${invitee}[password]    /invite/${token}
    Click    css=button:has-text("เข้าร่วมทีม")
    Wait For Elements State    css=.ant-result >> text=ลิงก์เชิญนี้ใช้ไม่ได้แล้ว    visible    timeout=30s
    Row Count Should Be    0    select 1 from memberships where workspace_id = %s and user_id = %s    ${team}[ws]    ${invitee}[id]

Cancelling The Revoke Dialog Keeps The Invitation
    [Tags]    edge    db
    ${team}=    Create Company Team
    ${email}=    Unique Email    keepinv
    Invite Via API    ${team}[owner]    ${team}[ws]    ${email}    viewer
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=tr:has-text("${email}")    visible    timeout=60s
    Click    css=tr:has-text("${email}") button:has-text("ยกเลิก")
    Click    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button:has-text("ไม่")
    Wait For Elements State    css=tr:has-text("${email}")    visible
    ${row}=    Query Row    select * from invitations where workspace_id = %s and email = %s    ${team}[ws]    ${email}
    Should Be Equal    ${row}[revoked_at]    ${None}

Invitation Link With A Malformed Token Shows A Clear Message
    [Tags]    negative    edge
    ${user}=    Register User Via API    badtoken
    Open Context As    ${user}[email]    ${user}[password]    /invite/abc
    Wait For Elements State    css=.ant-result-title:has-text("ลิงก์เชิญไม่ถูกต้อง")    visible    timeout=60s
    Get Element Count    css=button:has-text("เข้าร่วมทีม")    ==    0

Invitation Link With An Unknown Token Is Refused
    [Documentation]    A well-formed but unknown token: joining fails with a message, no membership, no crash.
    [Tags]    negative    security
    ${user}=    Register User Via API    unknowntoken
    ${token}=    Evaluate    'A' * 43
    Open Context As    ${user}[email]    ${user}[password]    /invite/${token}
    Click    css=button:has-text("เข้าร่วมทีม")
    Wait For Elements State    css=.ant-result >> text=เข้าร่วมไม่สำเร็จ    visible    timeout=30s
    Page Should Have No Error Overlay

Guest Opening An Invitation Link Is Asked To Sign In First
    [Tags]    edge
    ${team}=    Create Company Team
    ${email}=    Unique Email    guestinv
    ${token}=    Invite Via API    ${team}[owner]    ${team}[ws]    ${email}    viewer
    Open Cloud Context    /invite/${token}
    Wait For Elements State    css=a[href^="/login?next="] button    visible    timeout=60s
    Get Attribute    css=a[href^="/login?next="]    href    contains    invite
    Get Element Count    css=button:has-text("เข้าร่วมทีม")    ==    0

Owner Changes A Role And The Database Follows
    [Tags]    smoke    db
    ${team}=    Create Company Team    estimator
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=1    visible    timeout=60s
    ${row}=    Member Row    ${team}[estimator][email]
    Click    ${row} >> css=.ant-select
    Click    ${OPEN_SELECT_DROPDOWN} >> css=.ant-select-item-option:has-text("${ROLE_VIEWER}")
    Toast Should Show    เป็น ${ROLE_VIEWER} แล้ว
    Wait Until Keyword Succeeds    15s    500ms    Membership Role Should Be    ${team}[ws]    ${team}[estimator][id]    viewer

A Demoted Member Loses Edit Rights On Their Next Visit
    [Documentation]    Estimator becomes viewer: opening a project now shows the read-only banner and edits are refused.
    [Tags]    security    db
    ${team}=    Create Company Team    estimator
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    VAR    &{role}=    role=viewer
    PATCH On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/members/${team}[estimator][id]    json=${role}    expected_status=200
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]
    Open Project From List    ${project}[name]
    Go To Level Of Cloud Project    layout
    Get Text    css=body    contains    ${READ_ONLY_BANNER_TEXT}
    Fill Number By Label    จำนวนจุดวางผัง    33
    Toast Should Show    ${READ_ONLY_MESSAGE}
    Row Count Should Be    0    select 1 from project_docs where project_id = %s and doc_key = 'calc:layout'    ${project}[id]

Owner Promotes A Member To Owner
    [Tags]    db
    ${team}=    Create Company Team    admin
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=1    visible    timeout=60s
    ${row}=    Member Row    ${team}[admin][email]
    Click    ${row} >> css=.ant-select
    Click    ${OPEN_SELECT_DROPDOWN} >> css=.ant-select-item-option:has-text("${ROLE_OWNER}")
    Toast Should Show    เป็น ${ROLE_OWNER} แล้ว
    Wait Until Keyword Succeeds    15s    500ms    Membership Role Should Be    ${team}[ws]    ${team}[admin][id]    owner

Owner Cannot Change Their Own Role Or Remove Themselves From The List Row
    [Documentation]    The owner's own row shows a tag, not a role selector; the only action is "ออก" (leave).
    [Tags]    edge
    ${team}=    Create Company Team    estimator
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=1    visible    timeout=60s
    ${row}=    Member Row    ${team}[owner][email]
    Get Element Count    ${row} >> css=.ant-select    ==    0
    Get Element Count    ${row} >> css=button:has-text("นำออก")    ==    0
    Get Element Count    ${row} >> css=button:has-text("ออก")    ==    1
    Get Text    ${row}    contains    คุณ

Owner Removes A Member
    [Documentation]    Popconfirm "นำ … ออกจากพื้นที่ทำงาน?" then the membership row is gone and the removed user no
    ...    longer sees the company in their workspace list.
    [Tags]    smoke    db
    ${team}=    Create Company Team    estimator
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=1    visible    timeout=60s
    ${row}=    Member Row    ${team}[estimator][email]
    Click    ${row} >> css=button:has-text("นำออก")
    Click    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button:has-text("นำออก")
    Toast Should Show    นำ
    Wait For Elements State    ${row}    detached    timeout=15s
    Row Count Should Be    0    select 1 from memberships where workspace_id = %s and user_id = %s    ${team}[ws]    ${team}[estimator][id]
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]
    Projects Page Should Be Loaded
    Get Text    css=body    not contains    ${project}[name]
    Get Text    css=body    not contains    ${team}[ws_name]

Removing A Member Needs Confirmation
    [Tags]    negative    edge    db
    ${team}=    Create Company Team    viewer
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=1    visible    timeout=60s
    ${row}=    Member Row    ${team}[viewer][email]
    Click    ${row} >> css=button:has-text("นำออก")
    Click    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button:has-text("ยกเลิก")
    Wait For Elements State    ${row}    visible
    Row Count Should Be    1    select 1 from memberships where workspace_id = %s and user_id = %s    ${team}[ws]    ${team}[viewer][id]

The Last Owner Cannot Leave The Workspace
    [Documentation]    The only owner presses "ออก" and confirms: the app shows "ต้องมีเจ้าของอย่างน้อย 1 คนเสมอ" and
    ...    the membership stays.
    [Tags]    negative    edge    db
    ${team}=    Create Company Team    estimator
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=1    visible    timeout=60s
    ${row}=    Member Row    ${team}[owner][email]
    Click    ${row} >> css=button:has-text("ออก")
    Click    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button:has-text("ออก")
    Toast Should Show    ${LAST_OWNER_TEXT}
    Membership Role Should Be    ${team}[ws]    ${team}[owner][id]    owner
    Wait For Elements State    ${row}    visible

An Owner Can Leave When Another Owner Exists
    [Tags]    edge    db
    ${team}=    Create Company Team    admin
    VAR    &{role}=    role=owner
    PATCH On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/members/${team}[admin][id]    json=${role}    expected_status=200
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=1    visible    timeout=60s
    ${row}=    Member Row    ${team}[owner][email]
    Click    ${row} >> css=button:has-text("ออก")
    Click    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button:has-text("ออก")
    Toast Should Show    ออกจากพื้นที่ทำงานแล้ว
    Row Count Should Be    0    select 1 from memberships where workspace_id = %s and user_id = %s    ${team}[ws]    ${team}[owner][id]
    Membership Role Should Be    ${team}[ws]    ${team}[admin][id]    owner

A Member Can Leave On Their Own
    [Tags]    db
    ${team}=    Create Company Team    estimator
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row >> nth=1    visible    timeout=60s
    ${row}=    Member Row    ${team}[estimator][email]
    Click    ${row} >> css=button:has-text("ออก")
    Click    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button:has-text("ออก")
    Toast Should Show    ออกจากพื้นที่ทำงานแล้ว
    Row Count Should Be    0    select 1 from memberships where workspace_id = %s and user_id = %s    ${team}[ws]    ${team}[estimator][id]

Create A Company Workspace From The Members Page
    [Documentation]    "สร้างพื้นที่ของบริษัท/ทีม": name required; then workspace + owner membership in the DB.
    [Tags]    db
    ${user}=    Register User Via API    newws
    ${name}=    Unique Name    บริษัทใหม่
    Open Context As    ${user}[email]    ${user}[password]    /workspace/members
    Wait For Elements State    css=button:has-text("สร้างพื้นที่ของบริษัท/ทีม")    visible    timeout=60s
    Click    css=button:has-text("สร้างพื้นที่ของบริษัท/ทีม")
    Wait For Elements State    ${OPEN_MODAL}    visible
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Form Error Should Show    ตั้งชื่อบริษัท/ทีม
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${name}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Toast Should Show    สร้างพื้นที่ทำงานแล้ว
    ${ws}=    Query Row    select * from workspaces where name = %s    ${name}
    Should Be Equal    ${ws}[kind]    company
    Membership Role Should Be    ${ws}[id]    ${user}[id]    owner
    Wait For Elements State    css=body:has-text("บทบาทของคุณ: ${ROLE_OWNER}")    visible    timeout=30s

Workspace Name Is Limited To 120 Characters
    [Tags]    negative    edge    db
    ${user}=    Register User Via API    wslen
    Open Context As    ${user}[email]    ${user}[password]    /workspace/members
    Wait For Elements State    css=button:has-text("สร้างพื้นที่ของบริษัท/ทีม")    visible    timeout=60s
    Click    css=button:has-text("สร้างพื้นที่ของบริษัท/ทีม")
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${{ 'บ' * 121 }}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Form Error Should Show    ชื่อยาวได้ไม่เกิน 120 ตัวอักษร
    Row Count Should Be    0    select 1 from workspaces where name = %s    ${{ 'บ' * 121 }}

Owner Renames The Workspace
    [Tags]    db
    ${team}=    Create Company Team
    ${new}=    Unique Name    ชื่อบริษัทใหม่
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=button:has-text("เปลี่ยนชื่อ")    visible    timeout=60s
    Click    css=button:has-text("เปลี่ยนชื่อ")
    Wait For Elements State    ${OPEN_MODAL}    visible
    Get Property    ${OPEN_MODAL} >> css=input#name    value    ==    ${team}[ws_name]
    Fill Text    ${OPEN_MODAL} >> css=input#name    ${new}
    Click    ${OPEN_MODAL} >> css=.ant-modal-footer button.ant-btn-primary
    Wait For Elements State    ${OPEN_MODAL}    detached    timeout=15s
    ${name}=    Query Value    select name from workspaces where id = %s    ${team}[ws]
    Should Be Equal    ${name}    ${new}

Owner Deletes The Workspace After Confirming
    [Tags]    db
    ${team}=    Create Company Team    estimator
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    Open Context As    ${team}[owner][email]    ${team}[owner][password]    /workspace/members
    Wait For Elements State    css=button:has-text("ลบพื้นที่")    visible    timeout=60s
    Click    css=button:has-text("ลบพื้นที่")
    Wait For Elements State    css=.ant-modal-confirm    visible
    Get Text    css=.ant-modal-confirm    contains    ลบพื้นที่ทำงาน "${team}[ws_name]" ถาวร?
    Click    css=.ant-modal-confirm button:has-text("ลบถาวร")
    Toast Should Show    ลบพื้นที่ทำงานแล้ว
    Row Count Should Be    0    select 1 from workspaces where id = %s    ${team}[ws]
    Row Count Should Be    0    select 1 from projects where id = %s    ${project}[id]

Personal Workspace Has No Team Management
    [Documentation]    The personal workspace has the owner only: an info box, no invite form, no role selector, no
    ...    remove buttons.
    [Tags]    edge
    ${user}=    Register User Via API    personalmembers
    Open Context As    ${user}[email]    ${user}[password]    /workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row    visible    timeout=60s
    Alert Should Show    พื้นที่ส่วนตัวมีคุณคนเดียว
    Get Text    css=body    not contains    ${INVITE_SECTION_TITLE}
    Get Element Count    css=.ant-table-row .ant-select    ==    0
    Get Element Count    css=.ant-table-row button    ==    0
    Get Element Count    css=button:has-text("ลบพื้นที่")    ==    0

Owner Assigns A Level To A Member
    [Documentation]    On the level map the owner picks a member for "ตรวจสอบที่ดิน": the row shows the member's name and
    ...    ``level_assignments`` holds (project, level, user, assigned_by).
    [Tags]    smoke    db
    ${team}=    Create Company Team    estimator
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    Open Context As    ${team}[owner][email]    ${team}[owner][password]
    Open Project From List    ${project}[name]
    Assign Level On Map    ตรวจสอบที่ดิน    ผู้ทดสอบ estimator
    Wait For Elements State    css=li:has-text("ตรวจสอบที่ดิน") >> text=ผู้ทดสอบ estimator    visible    timeout=15s
    ${row}=    Query Row    select * from level_assignments where project_id = %s and level_id = 'land-inspection'    ${project}[id]
    Should Be Equal As Strings    ${row}[user_id]    ${team}[estimator][id]
    Should Be Equal As Strings    ${row}[assigned_by]    ${team}[owner][id]
    Should Be Equal As Strings    ${row}[workspace_id]    ${team}[ws]

Assigning The Current Level Does Not Navigate Away
    [Documentation]    "ข้อมูลโครงการ" is the open (clickable) row. Using its assign control must open the member list
    ...    and stay on the map, not jump into the level page.
    [Tags]    edge
    ${team}=    Create Company Team    estimator
    ${created}=    Create Project Via API    ${team}[owner]    ${team}[ws]    ${EMPTY}    blank
    Open Context As    ${team}[owner][email]    ${team}[owner][password]
    Open Project From List    ${created}[project][name]
    Click    ${ASSIGN_BUTTON} >> nth=0
    Wait For Elements State    ${OPEN_DROPDOWN}    visible    timeout=10s
    Get Url    should end with    /journey

Reassigning And Unassigning A Level Updates The Database
    [Tags]    db
    ${team}=    Create Company Team    estimator    viewer
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    Open Context As    ${team}[owner][email]    ${team}[owner][password]
    Open Project From List    ${project}[name]
    Assign Level On Map    ตรวจสอบที่ดิน    ผู้ทดสอบ estimator
    Wait Until Keyword Succeeds    15s    500ms    Assignee Of Level Should Be    ${project}[id]    land-inspection    ${team}[estimator][id]
    Assign Level On Map    ตรวจสอบที่ดิน    ผู้ทดสอบ viewer
    Wait Until Keyword Succeeds    15s    500ms    Assignee Of Level Should Be    ${project}[id]    land-inspection    ${team}[viewer][id]
    Row Count Should Be    1    select 1 from level_assignments where project_id = %s and level_id = 'land-inspection'    ${project}[id]
    Assign Level On Map    ตรวจสอบที่ดิน    ไม่มอบหมาย
    Wait Until Keyword Succeeds    15s    500ms    Row Count Should Be    0    select 1 from level_assignments where project_id = %s    ${project}[id]
    Wait For Elements State    css=li:has-text("ตรวจสอบที่ดิน") >> text=ยังไม่มอบหมาย    visible    timeout=15s

Estimator Sees The Assignment But Cannot Change It
    [Documentation]    Assignments are shown to every member; the assign control exists for owner and admin only.
    [Tags]    security
    ${team}=    Create Company Team    estimator
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    VAR    &{body}=    userId=${team}[estimator][id]
    PUT On Session    ${team}[owner][alias]    /projects/${project}[id]/assignments/land-inspection    json=${body}    expected_status=200
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]
    Open Project From List    ${project}[name]
    Wait For Elements State    css=li:has-text("ตรวจสอบที่ดิน") >> text=ผู้ทดสอบ estimator    visible    timeout=30s
    Get Element Count    ${ASSIGN_BUTTON}    ==    0

Level Assigned To Someone Else Shows A Gentle Notice
    [Documentation]    Soft lock: another member's level opens normally with an info alert, nothing is blocked.
    [Tags]    edge
    ${team}=    Create Company Team    estimator    viewer
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    VAR    &{body}=    userId=${team}[viewer][id]
    PUT On Session    ${team}[owner][alias]    /projects/${project}[id]/assignments/layout    json=${body}    expected_status=200
    Open Context As    ${team}[estimator][email]    ${team}[estimator][password]
    Open Project From List    ${project}[name]
    Go To Level Of Cloud Project    layout
    Alert Should Show    ขั้นตอนนี้มอบหมายให้คุณผู้ทดสอบ viewer
    Get Element Count    css=[aria-label="จำนวนจุดวางผัง"]    ==    1

Assignment To A Non Member Is Refused By The Server
    [Tags]    security    negative    db
    ${team}=    Create Company Team
    ${outsider}=    Register User Via API    outsider
    ${project}=    Company Project With Unlocked Level    ${team}    layout
    VAR    &{body}=    userId=${outsider}[id]
    PUT On Session    ${team}[owner][alias]    /projects/${project}[id]/assignments/layout    json=${body}    expected_status=422
    Row Count Should Be    0    select 1 from level_assignments where project_id = %s    ${project}[id]

Another Company Member Cannot Open My Company's Project By Link
    [Documentation]    Tenant isolation: a member of company B who knows a project id of company A gets nothing.
    [Tags]    security
    ${a}=    Create Company Team
    ${b}=    Create Company Team
    ${project}=    Company Project With Unlocked Level    ${a}    layout
    Open Context As    ${b}[owner][email]    ${b}[owner][password]
    Get Text    css=body    not contains    ${project}[name]
    ${resp}=    GET On Session    ${b}[owner][alias]    /projects/${project}[id]    expected_status=404
    Error Code Should Be    ${resp}    not_found


*** Keywords ***
Assign Level On Map
    [Documentation]    Open the member list of the level row ``${title}`` and pick ``${who}`` (a display name or
    ...    "ไม่มอบหมาย").
    [Arguments]    ${title}    ${who}
    ${button}=    Level Assignee Button    ${title}
    Click    ${button}
    Wait For Elements State    ${OPEN_DROPDOWN}    visible    timeout=10s
    Click    ${OPEN_DROPDOWN} >> css=li:has-text("${who}")

Assignee Of Level Should Be
    [Arguments]    ${project_id}    ${level_id}    ${user_id}
    ${actual}=    Query Value    select user_id from level_assignments where project_id = %s and level_id = %s    ${project_id}    ${level_id}
    Should Be Equal As Strings    ${actual}    ${user_id}

Close All Contexts
    [Documentation]    Test teardown: every context of this test goes (cookies and storage never leak to the next one).
    Close Context    ALL    CURRENT

Company Project With Unlocked Level
    [Documentation]    A blank project in the team's company workspace, created by the owner, with every level before
    ...    ``${level}`` done. Returns ``&{project}``: id and name.
    [Arguments]    ${team}    ${level}
    ${name}=    Unique Name    โครงการทีม
    ${created}=    Create Project Via API    ${team}[owner]    ${team}[ws]    ${name}    blank
    Unlock Levels Via API    ${team}[owner]    ${created}[project][id]    ${level}
    VAR    &{project}=    id=${created}[project][id]    name=${name}
    RETURN    ${project}

Demo Account Members Page Should Show
    [Arguments]    ${email}    ${invite_section}    ${delete_button}
    Open Context As    ${email}    path=/workspace/members
    Wait For Elements State    css=.ant-table-tbody tr.ant-table-row    visible    timeout=60s
    ${want_invite}=    Set Variable If    ${invite_section}    ${1}    ${0}
    ${want_delete}=    Set Variable If    ${delete_button}    ${1}    ${0}
    ${invite_count}=    Get Element Count    css=body:has-text("${INVITE_SECTION_TITLE}")
    Should Be Equal As Integers    ${invite_count}    ${want_invite}
    ${delete_count}=    Get Element Count    css=button:has-text("ลบพื้นที่")
    Should Be Equal As Integers    ${delete_count}    ${want_delete}

Member Row
    [Arguments]    ${email}
    RETURN    css=tr.ant-table-row:has-text("${email}")

Row Count Of Doc Should Be
    [Arguments]    ${project_id}    ${doc_key}    ${expected}
    ${rows}=    Query Rows    select 1 from project_docs where project_id = %s and doc_key = %s    ${project_id}    ${doc_key}
    Length Should Be    ${rows}    ${expected}

Row Count Should Be
    [Arguments]    ${expected}    ${sql}    @{params}
    ${rows}=    Query Rows    ${sql}    @{params}
    Length Should Be    ${rows}    ${expected}
