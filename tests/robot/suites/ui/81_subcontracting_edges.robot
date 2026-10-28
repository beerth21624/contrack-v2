*** Settings ***
Documentation       W6 - subcontracting edge and negative cases: sign-in codes, links, bid form validation, double
...                 award, package rules, module switch, permissions between crews and tenants, and the crew app on a
...                 phone (390x844: no sideways scroll, the main action on screen).
Resource            ../../resources/pages/subcontracting.resource
Suite Setup         Open Browser For Suite
Suite Teardown      Close Browser    ALL
Test Setup          Set Browser Timeout    120s
Test Teardown       Close Context    ALL
Test Tags           subcontracting    ui    edge


*** Test Cases ***
# ── crew sign-in: OTP ───────────────────────────────────────────────────────────────────────
Wrong Sign In Code Shows An Error And Does Not Sign The Crew In
    [Documentation]    A code that is not the one in the SMS: the red alert shows, the crew stays on the login page,
    ...    and no user with that phone exists afterwards.
    [Tags]    negative    auth
    ${crew}=    New Phone Crew
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Request Code    ${crew}[phone]
    ${real}=    Latest Otp To    ${crew}[phone]
    ${wrong}=    Evaluate    str((int($real) + 1) % 1000000).zfill(6)
    Crew Enter Code    ${wrong}
    Fill Text    internal:label="ชื่อผู้ติดต่อ"s    ช่างทดสอบ
    Fill Text    internal:label="ชื่อทีม / ชื่อร้าน"i    ทีมรหัสผิด
    Click    role=button[name="เข้าใช้งาน"]
    Wait For Elements State    css=.ant-alert-error    visible    timeout=20s
    Get Url    contains    /vendor/login
    ${e164}=    To E164 Thai    ${crew}[phone]
    ${n}=    Query Value    select count(*) from users where phone = %s    ${e164}
    Should Be Equal As Integers    ${n}    0

Sign In Code Cannot Be Used Twice
    [Documentation]    API: the right code signs in once (200); the same code again is refused (401 otp_invalid).
    [Tags]    negative    auth    api
    ${crew}=    New Phone Crew
    ${e164}=    To E164 Thai    ${crew}[phone]
    ${alias}=    Anonymous Crew Session
    VAR    &{request}    phone=${e164}
    POST On Session    ${alias}    /auth/otp/request    json=${request}    expected_status=204
    ${code}=    Latest Otp To    ${crew}[phone]
    VAR    &{body}    phone=${e164}    code=${code}    displayName=ช่างใช้ซ้ำ    teamName=ทีมใช้ซ้ำ
    POST On Session    ${alias}    /auth/otp/verify    json=${body}    expected_status=200
    ${resp}=    POST On Session    ${alias}    /auth/otp/verify    json=${body}    expected_status=401
    Error Code Should Be    ${resp}    otp_invalid

Code Field Takes Digits Only And Needs Six Of Them
    [Documentation]    Letters are dropped while typing, the field holds at most 6 digits, and "เข้าใช้งาน" stays
    ...    disabled until all 6 are there.
    [Tags]    negative
    ${crew}=    New Phone Crew
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Request Code    ${crew}[phone]
    Crew Enter Code    12ab34
    Get Property    ${CODE_FIELD}    value    ==    1234
    Get Element States    role=button[name="เข้าใช้งาน"]    contains    disabled
    Crew Enter Code    12345678
    Get Property    ${CODE_FIELD}    value    ==    123456

Login Needs A Valid Phone Number
    [Documentation]    "ขอรหัส" is disabled for a number that is not a Thai mobile, enabled for a good one.
    [Tags]    negative
    ${ctx}=    Open Crew Context    /vendor/login
    Fill Text    ${PHONE_FIELD}    12345
    Get Element States    role=button[name="ขอรหัส"]    contains    disabled
    ${phone}=    Unique Thai Phone
    Fill Text    ${PHONE_FIELD}    ${phone}
    Get Element States    role=button[name="ขอรหัส"]    contains    enabled

Resending The Code Is Locked For A Minute
    [Documentation]    Right after asking for a code the resend button is disabled and shows the countdown.
    [Tags]    negative
    ${crew}=    New Phone Crew
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Request Code    ${crew}[phone]
    Get Element States    role=button[name=/ส่งรหัสอีกครั้งได้ใน/]    contains    disabled
    Wait For Elements State    text=/ส่งรหัสอีกครั้งได้ใน \\d+ วินาที/    visible

Login Warns When The Phone Is Not The Invited One
    [Documentation]    From a link, typing a number other than the invited one shows a notice (login still possible).
    [Tags]    negative    security
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${other}=    New Phone Crew
    ${ctx}=    Open Crew Context    /vendor/login?token=${crew}[token]
    Fill Text    ${PHONE_FIELD}    ${other}[phone]
    Wait For Elements State    text=/ไม่ตรงกับที่ผู้ว่าจ้างเชิญ/    visible    timeout=30s

# ── links: unknown, withdrawn, resent, taken ─────────────────────────────────────────────────
Unknown Link Shows The Expired Page
    [Documentation]    /s/<made-up token>: "ลิงก์นี้หมดอายุหรือถูกยกเลิก", no bid button.
    [Tags]    negative
    ${ctx}=    Open Crew Context    /s/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    Wait For Elements State    text="ลิงก์นี้หมดอายุหรือถูกยกเลิก"    visible    timeout=60s
    Get Element Count    role=button[name="เสนอราคา"]    ==    0

Withdrawn Invitation Link Stops Working
    [Documentation]    The buyer withdraws crew 1's invitation (API): the link page shows the expired message, the
    ...    API answers 410, invitation status is withdrawn; crew 2's link still works.
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${c1}=    Set Variable    ${pkg}[crews][0]
    ${c2}=    Set Variable    ${pkg}[crews][1]
    POST On Session    ${buyer}[user][alias]    /subcontracting/invitations/${c1}[invitation_id]/withdraw    expected_status=200
    Invitation Status Should Be    ${pkg}[id]    ${c1}[name]    withdrawn
    ${anon}=    Create Anonymous Session
    ${resp}=    GET On Session    ${anon}    /s/${c1}[token]    expected_status=410
    Error Code Should Be    ${resp}    invitation_invalid
    GET On Session    ${anon}    /s/${c2}[token]    expected_status=200
    ${ctx}=    Open Crew Context    /s/${c1}[token]
    Wait For Elements State    text="ลิงก์นี้หมดอายุหรือถูกยกเลิก"    visible    timeout=60s
    Get Element Count    role=button[name="เสนอราคา"]    ==    0

Resending A Link Kills The Old One
    [Documentation]    Resend gives a new token: the old link answers 410, the new one 200, resent_count is 1.
    [Tags]    negative    security
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${resp}=    POST On Session    ${buyer}[user][alias]    /subcontracting/invitations/${crew}[invitation_id]/resend
    ...    expected_status=200
    ${new_token}=    Token Of Url    ${resp.json()}[link][url]
    Should Not Be Equal    ${new_token}    ${crew}[token]
    ${anon}=    Create Anonymous Session
    GET On Session    ${anon}    /s/${crew}[token]    expected_status=410
    GET On Session    ${anon}    /s/${new_token}    expected_status=200
    ${inv}=    Invitation Row    ${pkg}[id]    ${crew}[name]
    Should Be Equal As Integers    ${inv}[resent_count]    1

Another Phone Cannot Take Over A Crews Link
    [Documentation]    A different phone signs in from crew A's link: the invitation is not handed to it
    ...    (sc_invitations.vendor_workspace_id stays empty) and the bid form never shows.
    [Tags]    negative    security
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew_a}=    Set Variable    ${pkg}[crews][0]
    ${intruder}=    New Phone Crew
    ${ctx}=    Open Crew Context    /vendor/login
    Go To Path    /s/${crew_a}[token]
    Click    role=button[name="เสนอราคา"]
    Wait For Elements State    ${PHONE_FIELD}    visible    timeout=30s
    Crew Sign In With Otp    ${intruder}
    Wait For Elements State    css=.ant-result, [class*="text-card-title"]    visible    timeout=60s
    Get Element Count    role=button[name="ส่งราคา"]    ==    0
    ${inv}=    Invitation Row    ${pkg}[id]    ${crew_a}[name]
    Should Be Equal    ${inv}[vendor_workspace_id]    ${None}

Crew Cannot Open Another Crews Invitation Page
    [Documentation]    Crew B is signed in and types the URL of crew A's invitation: an error page, no bid form; the
    ...    API answers 404 for the same id (see the next test).
    [Tags]    negative    security
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${crew_a}=    Set Variable    ${pkg}[crews][0]
    ${crew_b}=    Set Variable    ${pkg}[crews][1]
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew_b}
    Go To Path    /vendor/invitations/${crew_a}[invitation_id]
    Wait For Elements State    text="เปิดหน้านี้ไม่ได้"    visible    timeout=60s
    Get Element Count    role=button[name="ส่งราคา"]    ==    0

Crew Cannot Read Another Crews Invitation Through The API
    [Documentation]    API: crew B asks for crew A's invitation id: 404, and cannot claim crew A's link either
    ...    (409 phone_mismatch).
    [Tags]    negative    security    api
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${crew_a}=    Set Variable    ${pkg}[crews][0]
    ${crew_b}=    Set Variable    ${pkg}[crews][1]
    ${vendor_b}=    Crew Otp Sign In Via API    ${crew_b}    ${crew_b}[token]
    GET On Session    ${vendor_b}[alias]    /vendor/invitations/${crew_a}[invitation_id]    expected_status=404
    VAR    &{claim}    token=${crew_a}[token]    workspaceId=${vendor_b}[workspace_id]
    ${resp}=    POST On Session    ${vendor_b}[alias]    /vendor/claim-invitation    json=${claim}    expected_status=409
    ${inv}=    Invitation Row    ${pkg}[id]    ${crew_a}[name]
    Should Be Equal    ${inv}[vendor_workspace_id]    ${None}

Crew Cannot Read Another Crews Contract
    [Documentation]    API: a crew that did not win gets 404 for a running contract of another crew.
    [Tags]    negative    security    api
    ${buyer}=    Setup Buyer Via API
    ${run}=    Active Contract Via API    ${buyer}
    ${other}=    Create Crew Entry Via API    ${buyer}
    ${stranger}=    Crew Otp Sign In Via API    ${other}
    GET On Session    ${stranger}[alias]    /subcontracting/subcontracts/${run}[sc_id]    expected_status=404

Outsider Cannot Read A Package Or The Leveling Of Another Company
    [Documentation]    API: a user of another workspace gets 404 for the package, its leveling and the contract.
    [Tags]    negative    security    api
    ${buyer}=    Setup Buyer Via API
    ${run}=    Active Contract Via API    ${buyer}
    ${outsider}=    Register User Via API    outsider
    GET On Session    ${outsider}[alias]    /subcontracting/packages/${run}[pkg][id]    expected_status=404
    GET On Session    ${outsider}[alias]    /subcontracting/packages/${run}[pkg][id]/leveling    expected_status=404
    GET On Session    ${outsider}[alias]    /subcontracting/subcontracts/${run}[sc_id]    expected_status=404

Viewer Of The Buyer Company Cannot Create A Package Or Award
    [Documentation]    API: a viewer member may not create a package (403) nor award (403).
    [Tags]    negative    security    api
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${totals}=    Crews Have Bid Via API    ${pkg}    ${lines}    120    110
    ${viewer}=    Add Project Member Via API    ${buyer}    viewer
    VAR    &{as_viewer}    user=${viewer}
    ${body}=    Package Body    งานของผู้ดู
    POST On Session    ${viewer}[alias]    /projects/${buyer}[project_id]/subcontracting/packages    json=${body}
    ...    expected_status=403
    ${inv}=    Invitation Row    ${pkg}[id]    ${pkg}[crews][0][name]
    ${bid}=    Latest Bid Row    ${inv}[id]
    Award Whole Package Via API    ${as_viewer}    ${pkg}[id]    ${lines}    ${bid}[id]    status=403
    Award Count Should Be    ${pkg}[id]    0

# ── bid form ────────────────────────────────────────────────────────────────────────────────
Bid With Empty Prices Is Stopped By The Form
    [Documentation]    "ส่งราคา" with no price typed: the sheet lists "ยังไม่ได้ใส่ราคา 7 รายการ", offers only "กลับไปแก้",
    ...    and no submitted bid is stored.
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    Click    role=button[name="ส่งราคา"]
    Wait For Elements State    text=/ยังไม่ได้ใส่ราคา ${MASONRY_ROW_COUNT} รายการ/    visible
    Get Element Count    role=button[name="ยืนยันส่งราคา"]    ==    0
    Wait For Elements State    role=button[name="กลับไปแก้"]    visible
    ${inv}=    Invitation Row    ${pkg}[id]    ${crew}[name]
    ${n}=    Query Value    select count(*) from sc_bids where invitation_id = %s and status = 'submitted'    ${inv}[id]
    Should Be Equal As Integers    ${n}    0

Negative Price Cannot Be Typed
    [Documentation]    Typing "-50" into a price box keeps only the digits ("50"): a minus sign never gets in.
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    Fill Text    css=input[aria-label^="ราคาต่อ"] >> nth=0    -50
    Get Property    css=input[aria-label^="ราคาต่อ"] >> nth=0    value    ==    50
    Fill Text    css=input[aria-label^="ราคาต่อ"] >> nth=1    abc
    Get Property    css=input[aria-label^="ราคาต่อ"] >> nth=1    value    ==    ${EMPTY}

Zero Prices Raise A Warning Before The Bid Goes Out
    [Documentation]    Documented behaviour (plan, bid form checks): a 0 price on a priced row is a warning
    ...    "มี N รายการราคาเป็น 0 บาท", not a block. The sheet shows it and a way back to fix.
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    @{zeros}=    Evaluate    ['0'] * ${MASONRY_ROW_COUNT}
    Crew Types Prices    @{zeros}
    Click    role=button[name="ส่งราคา"]
    Wait For Elements State    text=/มี ${MASONRY_ROW_COUNT} รายการราคาเป็น 0 บาท/    visible
    Wait For Elements State    role=button[name="กลับไปแก้"]    visible
    ${inv}=    Invitation Row    ${pkg}[id]    ${crew}[name]
    ${n}=    Query Value    select count(*) from sc_bids where invitation_id = %s and status = 'submitted'    ${inv}[id]
    Should Be Equal As Integers    ${n}    0

Excluded Row Needs A Reason
    [Documentation]    Tick "ไม่รวมรายการนี้" on a row, price the rest, leave the reason empty: blocked with "ยังไม่ได้บอกเหตุผล".
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    Check Checkbox    css=input[type="checkbox"] >> nth=0
    @{prices}=    Evaluate    ['100'] * (${MASONRY_ROW_COUNT} - 1)
    Crew Types Prices    @{prices}
    Click    role=button[name="ส่งราคา"]
    Wait For Elements State    text=/ยังไม่ได้บอกเหตุผล/    visible
    Get Element Count    role=button[name="ยืนยันส่งราคา"]    ==    0

Proposed Payment Stages Must Add Up To 100 Percent
    [Documentation]    "ขอเสนองวดเอง" with the first stage changed to 10%: the sheet blocks with "ต้องรวมให้ได้ 100%".
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    @{prices}=    Evaluate    ['100'] * ${MASONRY_ROW_COUNT}
    Crew Types Prices    @{prices}
    Click    text="ขอเสนองวดเอง"
    Fill Text    css=input[aria-label="งวด 1 กี่เปอร์เซ็นต์"]    10
    Click    role=button[name="ส่งราคา"]
    Wait For Elements State    text=/ต้องรวมให้ได้ 100%/    visible
    Get Element Count    role=button[name="ยืนยันส่งราคา"]    ==    0

Lump Sum Bid Needs A Price And Is Stored As Lump
    [Documentation]    Package priced "vendor_choice": crew switches to "เหมารวม". Empty lump sum is blocked
    ...    ("ใส่ราคาเหมารวม"); 640,000 is accepted and stored with mode lump and total 640000.
    ${buyer}=    Setup Buyer Via API
    ${resp}=    Create Package Via API    ${buyer}    ${MASONRY_TITLE}    pricing=vendor_choice
    ${package_id}=    Set Variable    ${resp.json()}[id]
    ${crew}=    Create Crew Entry Via API    ${buyer}
    ${links}=    Invite Crews Via API    ${buyer}    ${package_id}    link    ${crew}
    ${token}=    Set Variable    ${links}[${crew}[name]][token]
    Set To Dictionary    ${crew}    token=${token}
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    Click    text="เหมารวม"
    Click    role=button[name="ส่งราคา"]
    Wait For Elements State    text="ใส่ราคาเหมารวม"    visible
    Click    role=button[name="กลับไปแก้"]
    Fill Text    css=input[aria-label="ราคาเหมารวม"]    640000
    Crew Form Total Should Be    640000
    Crew Presses Send Bid
    Wait For Elements State    text=/ราคาที่ส่ง ฉบับที่ 1/    visible    timeout=30s
    ${inv}=    Invitation Row    ${package_id}    ${crew}[name]
    ${bid}=    Latest Bid Row    ${inv}[id]
    Should Be Equal    ${bid}[mode]    lump
    Numbers Should Be Close    ${bid}[total]    640000    0.01

Bid API Refuses A Negative Unit Price
    [Documentation]    API: a negative unit price is refused (400, validation) and nothing is stored.
    [Tags]    negative    api
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${vendor}=    Crew Otp Sign In Via API    ${crew}    ${crew}[token]
    Submit Bid Via API    ${vendor}    ${crew}[invitation_id]    ${lines}    -5    status=400
    ${n}=    Query Value    select count(*) from sc_bids where invitation_id = %s and status = 'submitted'    ${crew}[invitation_id]
    Should Be Equal As Integers    ${n}    0

# ── package rules ───────────────────────────────────────────────────────────────────────────
Package Without Rows Cannot Go To The Next Step
    [Documentation]    Wizard step 1 with nothing ticked: "ถัดไป" is disabled and the footer says no work is chosen;
    ...    ticking a row enables it.
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${ctx}=    Open Buyer Context    ${buyer}
    Start Package Wizard
    Wait For Elements State    text="ยังไม่ได้เลือกงาน"    visible
    Get Element States    role=button[name="ถัดไป"]    contains    disabled
    Click    text="${MASONRY_TEMPLATE}"
    Uncheck Checkbox    css=[aria-label="วงกบประตูไม้"]
    Get Element States    role=button[name="ถัดไป"]    contains    enabled

Package Without Rows Is Refused By The API
    [Documentation]    API: lineKeys [] and no custom lines -> 400 (validation), nothing stored.
    [Tags]    negative    api
    ${buyer}=    Setup Buyer Via API
    @{none}=    Create List
    ${resp}=    Create Package Via API    ${buyer}    ${MASONRY_TITLE}    ${none}    status=400
    ${n}=    Query Value    select count(*) from sc_work_packages where project_id = %s    ${buyer}[project_id]
    Should Be Equal As Integers    ${n}    0

Package Name Cannot Be Empty
    [Documentation]    Wizard step 2: clearing the name disables "ถัดไป".
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${ctx}=    Open Buyer Context    ${buyer}
    Start Package Wizard
    Pick Masonry Template
    Go To Wizard Next Step
    Fill Text    css=input[maxlength="160"]    ${EMPTY}
    Get Element States    role=button[name="ถัดไป"]    contains    disabled

Bid Deadline In The Past Cannot Be Sent By The API
    [Documentation]    API: a draft with bidDeadline yesterday may exist, but sending it to a crew must be refused (4xx),
    ...    the package stays draft and no invitation row is written.
    [Tags]    negative    api
    ${buyer}=    Setup Buyer Via API
    ${body}=    Package Body
    ${yesterday}=    Evaluate    (__import__("datetime").datetime.now(__import__("datetime").timezone.utc) - __import__("datetime").timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:00.000Z")
    Set To Dictionary    ${body}    bidDeadline=${yesterday}
    ${created}=    POST On Session    ${buyer}[user][alias]    /projects/${buyer}[project_id]/subcontracting/packages
    ...    json=${body}    expected_status=any
    Pass Execution If    ${created.status_code} >= 400    The server refuses a past deadline already when the draft is created
    ${crew}=    Create Crew Entry Via API    ${buyer}
    VAR    &{entry}    vendorListEntryId=${crew}[entry_id]    channel=link
    VAR    @{entries}    ${entry}
    VAR    &{invite}    entries=${entries}
    ${resp}=    POST On Session    ${buyer}[user][alias]    /subcontracting/packages/${created.json()}[id]/invitations
    ...    json=${invite}    expected_status=any
    Should Be True    ${resp.status_code} >= 400    msg=A package whose bid deadline is yesterday was sent (HTTP ${resp.status_code})
    Package Status Should Be    ${created.json()}[id]    draft

Comparing Needs At Least Two Crews In The Wizard
    [Documentation]    One crew picked in "ขอราคาเทียบ" mode: pressing send warns "ขอราคาเทียบเลือกอย่างน้อย 2 ราย"
    ...    and no package is created.
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${crew}=    New Phone Crew
    ${ctx}=    Open Buyer Context    ${buyer}
    Start Package Wizard
    Pick Masonry Template
    Go To Wizard Next Step
    Fill Package Terms    ${MASONRY_TITLE}    ทดสอบรายเดียว
    Go To Wizard Next Step
    Add Crew In Wizard    ${crew}[name]    ${crew}[phone]
    Click    role=button[name="ส่งคำเชิญ 1 ราย"]
    Toast Should Show    ขอราคาเทียบเลือกอย่างน้อย 2 ราย
    ${n}=    Query Value    select count(*) from sc_work_packages where project_id = %s    ${buyer}[project_id]
    Should Be Equal As Integers    ${n}    0

Send Button Needs A Crew
    [Documentation]    Step 3 with nobody picked: "ส่งคำเชิญ" is disabled.
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${ctx}=    Open Buyer Context    ${buyer}
    Start Package Wizard
    Pick Masonry Template
    Go To Wizard Next Step
    Fill Package Terms    ${MASONRY_TITLE}    ทดสอบไม่มีผู้รับ
    Go To Wizard Next Step
    Get Element States    role=button[name="ส่งคำเชิญ"]    contains    disabled

Quick Add Refuses A Bad Or Duplicate Phone
    [Documentation]    "เพิ่มรายใหม่" with "12345" shows "เบอร์โทรไม่ถูกต้อง"; adding the same phone twice gives
    ...    "เบอร์นี้อยู่ในทะเบียนแล้ว"; the vendor list holds the crew once.
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${crew}=    New Phone Crew
    ${ctx}=    Open Buyer Context    ${buyer}
    Start Package Wizard
    Pick Masonry Template
    Go To Wizard Next Step
    Fill Package Terms    ${MASONRY_TITLE}    ทดสอบเบอร์
    Go To Wizard Next Step
    Fill Text    css=[aria-label="ชื่อทีมช่างใหม่"]    ทีมเบอร์ผิด
    Fill Text    css=[aria-label="เบอร์โทรทีมช่างใหม่"]    12345
    Click    ${QUICK_ADD_BUTTON}
    Wait For Elements State    text="เบอร์โทรไม่ถูกต้อง"    visible
    Add Crew In Wizard    ${crew}[name]    ${crew}[phone]
    Fill Text    css=[aria-label="ชื่อทีมช่างใหม่"]    ทีมซ้ำ
    Fill Text    css=[aria-label="เบอร์โทรทีมช่างใหม่"]    ${crew}[phone]
    Click    ${QUICK_ADD_BUTTON}
    Toast Should Show    เบอร์นี้อยู่ในทะเบียนแล้ว
    ${n}=    Query Value    select count(*) from sc_vendor_list_entries where buyer_workspace_id = %s    ${buyer}[ws]
    Should Be Equal As Integers    ${n}    1

Same BOQ Row Cannot Be In Two Live Packages
    [Documentation]    API: a second package with the same rows -> 409 (details lineKeys). Wizard: the rows held by the
    ...    first package are shown as "อยู่ในแพ็กเกจ <title>" and cannot be ticked.
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    Create Package Via API    ${buyer}    แพ็กเกจแรก
    ${resp}=    Create Package Via API    ${buyer}    แพ็กเกจสอง    status=409
    ${ctx}=    Open Buyer Context    ${buyer}
    Start Package Wizard
    Click    text="${MASONRY_TEMPLATE}"
    Wait For Elements State    text="อยู่ในแพ็กเกจ แพ็กเกจแรก" >> nth=0    visible    timeout=30s
    Get Element States    css=[aria-label="ก่ออิฐมอญ (ครึ่งแผ่น)"]    contains    disabled
    ${n}=    Query Value    select count(*) from sc_work_packages where project_id = %s    ${buyer}[project_id]
    Should Be Equal As Integers    ${n}    1

Buyer Cancels A Package And Crews Are Told
    [Documentation]    "ยกเลิกแพ็กเกจ" with a reason: package cancelled (DB), the crew's link page says the buyer
    ...    cancelled, no bid button.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${ctx}=    Open Buyer Context    ${buyer}
    Open Package Page    ${pkg}[id]
    Click    role=button[name=/จัดการ/]
    Click    text="ยกเลิกแพ็กเกจ"
    Fill Text    css=.ant-modal textarea    เจ้าของเลื่อนงาน
    Click    css=.ant-modal >> role=button[name="ยกเลิกแพ็กเกจ"]
    Toast Should Show    ยกเลิกแพ็กเกจแล้ว
    ${row}=    Package Row    ${pkg}[id]
    Should Be Equal    ${row}[status]    cancelled
    Should Be Equal    ${row}[cancel_reason]    เจ้าของเลื่อนงาน
    ${crew_ctx}=    Open Crew Context    /s/${pkg}[crews][0][token]
    Wait For Elements State    text="ผู้ว่าจ้างยกเลิกงานนี้"    visible    timeout=60s
    Get Element Count    role=button[name="เสนอราคา"]    ==    0

# ── award ───────────────────────────────────────────────────────────────────────────────────
Award Button Waits For A Choice
    [Documentation]    Leveling page: "ตกลงจ้าง" is disabled until a bidder is picked; the empty table says so when
    ...    nobody bid yet.
    [Tags]    negative
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${ctx}=    Open Buyer Context    ${buyer}
    Open Package Page    ${pkg}[id]
    Client Navigate    /subcontracting/packages/${pkg}[id]/leveling
    Wait For Elements State    text="ยังไม่มีผู้รับส่งราคา"    visible    timeout=60s
    ${totals}=    Crews Have Bid Via API    ${pkg}    ${lines}    120    110
    Reload
    Wait For Elements State    css=table    visible    timeout=60s
    Get Element States    role=button[name="ตกลงจ้าง"]    contains    disabled

Double Click On Award Creates One Award And One Contract
    [Documentation]    Two quick clicks on "ตกลงจ้าง" in the summary: exactly one sc_awards row and one
    ...    sc_subcontracts row (the double click must not create two).
    [Tags]    security
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${totals}=    Crews Have Bid Via API    ${pkg}    ${lines}    120    110
    ${buyer_ctx}=    Open Buyer Context    ${buyer}
    Open Leveling Page    ${pkg}[id]
    Award Whole Package In Leveling    ${pkg}[crews][1][name]    clicks=2
    Wait Until Keyword Succeeds    30s    500ms    Award Count Should Be    ${pkg}[id]    1
    Wait For Elements State    css=.ant-tag >> text="รอผู้รับจ้างยอมรับ"    visible    timeout=60s
    ${contracts}=    Subcontract Rows    ${pkg}[id]
    Length Should Be    ${contracts}    1
    Award Count Should Be    ${pkg}[id]    1

Second Award On The Same Package Is Refused
    [Documentation]    API: after one award a second award request is a 409 and the tables keep one award, one contract.
    [Tags]    negative    security    api
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${totals}=    Crews Have Bid Via API    ${pkg}    ${lines}    120    110
    ${inv1}=    Invitation Row    ${pkg}[id]    ${pkg}[crews][0][name]
    ${inv2}=    Invitation Row    ${pkg}[id]    ${pkg}[crews][1][name]
    ${bid1}=    Latest Bid Row    ${inv1}[id]
    ${bid2}=    Latest Bid Row    ${inv2}[id]
    Award Whole Package Via API    ${buyer}    ${pkg}[id]    ${lines}    ${bid2}[id]
    Award Whole Package Via API    ${buyer}    ${pkg}[id]    ${lines}    ${bid1}[id]    status=409
    Award Count Should Be    ${pkg}[id]    1
    ${contracts}=    Subcontract Rows    ${pkg}[id]
    Length Should Be    ${contracts}    1

# ── module switch ───────────────────────────────────────────────────────────────────────────
Module Switched Off Removes The Menu And The Pages
    [Documentation]    Owner turns "จ้างช่วง" off on /workspace/modules: the menu item is gone and /subcontracting says
    ...    the module is off. Turning it on again brings the menu back.
    [Tags]    smoke
    ${buyer}=    Setup Buyer Via API
    ${ctx}=    Open Buyer Context    ${buyer}
    Get Element Count    css=.ant-layout-header [role="menuitem"]:has-text("จ้างช่วง")    >=    1
    Client Navigate    /workspace/modules
    Click    css=[role="switch"][aria-label^="จ้างช่วง"]
    Click    css=.ant-modal-confirm >> role=button[name="ปิดโมดูล"]
    Toast Should Show    ปิด
    Get Element Count    css=.ant-layout-header [role="menuitem"]:has-text("จ้างช่วง")    ==    0
    Client Navigate    /subcontracting
    Wait For Elements State    text=/ปิดใช้งานอยู่/    visible    timeout=60s
    Client Navigate    /subcontracting/packages/new
    Wait For Elements State    text=/ปิดใช้งานอยู่/    visible    timeout=60s
    ${on}=    Query Value    select enabled from workspace_modules where workspace_id = %s and module = 'subcontracting'    ${buyer}[ws]
    Should Not Be True    ${on}
    Client Navigate    /workspace/modules
    Click    css=[role="switch"][aria-label^="จ้างช่วง"]
    Toast Should Show    เปิด
    Get Element Count    css=.ant-layout-header [role="menuitem"]:has-text("จ้างช่วง")    >=    1

Module Off Keeps Data And Back On Restores It
    [Documentation]    API: off (no running contract) hides the package (404 module_disabled) but the row stays in
    ...    sc_work_packages; on again -> the package is readable (200).
    [Tags]    api
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    Switch Module Via API    ${buyer}[user]    ${buyer}[ws]    ${False}
    ${resp}=    GET On Session    ${buyer}[user][alias]    /subcontracting/packages/${pkg}[id]    expected_status=404
    Error Code Should Be    ${resp}    module_disabled
    Package Status Should Be    ${pkg}[id]    open
    Switch Module Via API    ${buyer}[user]    ${buyer}[ws]    ${True}
    GET On Session    ${buyer}[user][alias]    /subcontracting/packages/${pkg}[id]    expected_status=200

Module Off With A Running Contract Needs Confirmation And Crew Keeps Read Only Access
    [Documentation]    A contract is running: the switch asks "ยังมีสัญญาที่ดำเนินอยู่ 1 สัญญา" (API 409 first); after
    ...    "ปิดต่อ" the buyer's menu is gone, the crew still opens the contract on the phone read-only
    ...    ("ดูได้อย่างเดียว", no claim button) and a claim is refused (404 module_disabled).
    [Tags]    slow    security
    ${buyer}=    Setup Buyer Via API
    ${run}=    Active Contract Via API    ${buyer}
    Switch Module Via API    ${buyer}[user]    ${buyer}[ws]    ${False}    status=409
    ${buyer_ctx}=    Open Buyer Context    ${buyer}
    Client Navigate    /workspace/modules
    Click    css=[role="switch"][aria-label^="จ้างช่วง"]
    Click    css=.ant-modal-confirm >> role=button[name="ปิดโมดูล"]
    Wait For Elements State    text=/ยังมีสัญญาที่ดำเนินอยู่ 1 สัญญา/    visible    timeout=30s
    Click    css=.ant-modal-confirm >> role=button[name="ปิดต่อ"]
    Wait For Elements State    css=.ant-modal-confirm    detached    timeout=30s
    Get Element Count    css=.ant-layout-header [role="menuitem"]:has-text("จ้างช่วง")    ==    0
    ${crew_ctx}=    Open Crew Context    /vendor/login
    Go To Path    /s/${run}[crew][token]
    Click    role=button[name="ดูงานของฉัน"]
    Crew Sign In With Otp    ${run}[crew]    ${False}
    Go To Path    /vendor/contracts/${run}[sc_id]
    Wait For Elements State    text="ผู้ว่าจ้างปิดระบบจ้างช่วงชั่วคราว ดูได้อย่างเดียว"    visible    timeout=60s
    Get Element Count    role=button[name=/ขอเบิก/]    ==    0
    VAR    &{claim}    installmentNo=${1}    note=${EMPTY}    photoFileIds=@{EMPTY}
    ${resp}=    POST On Session    ${run}[vendor][alias]    /subcontracting/subcontracts/${run}[sc_id]/claims
    ...    json=${claim}    expected_status=404
    Error Code Should Be    ${resp}    module_disabled
    ${sc}=    Subcontract Row    ${run}[pkg][id]
    Should Be Equal    ${sc}[status]    active

# ── crew app on a phone ─────────────────────────────────────────────────────────────────────
Link Page Fits The Phone And Shows The Bid Button
    [Documentation]    /s/<token> at 390x844: no sideways scroll; "เสนอราคา" is fully inside the screen.
    [Tags]    mobile
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${ctx}=    Open Crew Context    /s/${pkg}[crews][0][token]
    Wait For Elements State    text="ก่ออิฐมอญ (ครึ่งแผ่น)"    visible    timeout=60s
    Page Should Not Scroll Sideways
    Element Should Be Inside Viewport    role=button[name="เสนอราคา"]

Login Page Fits The Phone
    [Documentation]    /vendor/login at 390x844: no sideways scroll, "ขอรหัส" on screen; after asking, the code step too.
    [Tags]    mobile
    ${crew}=    New Phone Crew
    ${ctx}=    Open Crew Context    /vendor/login
    Page Should Not Scroll Sideways
    Fill Text    ${PHONE_FIELD}    ${crew}[phone]
    Element Should Be Inside Viewport    role=button[name="ขอรหัส"]
    Crew Request Code    ${crew}[phone]
    Page Should Not Scroll Sideways
    Element Should Be Inside Viewport    ${CODE_FIELD}

Bid Form Fits The Phone And Keeps Send On Screen
    [Documentation]    The bid form with 7 rows at 390x844: no sideways scroll, the fixed bar with the total and
    ...    "ส่งราคา" stays on screen, also after typing prices; the confirm sheet fits too.
    [Tags]    mobile
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    Page Should Not Scroll Sideways
    Element Should Be Inside Viewport    role=button[name="ส่งราคา"]
    @{prices}=    Evaluate    ['100'] * ${MASONRY_ROW_COUNT}
    Crew Types Prices    @{prices}
    Page Should Not Scroll Sideways
    Element Should Be Inside Viewport    role=button[name="ส่งราคา"]
    Click    role=button[name="ส่งราคา"]
    Wait For Elements State    role=button[name="ยืนยันส่งราคา"]    visible
    Element Should Be Inside Viewport    role=button[name="ยืนยันส่งราคา"]
    Page Should Not Scroll Sideways

Crew Inbox Fits The Phone
    [Documentation]    /vendor after sign-in: no sideways scroll, the job card and its action are on screen.
    [Tags]    mobile
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    Go To Path    /vendor
    Wait For Elements State    text="${MASONRY_TITLE}"    visible    timeout=60s
    Page Should Not Scroll Sideways
    Wait For Elements State    role=tab[name=/รอเสนอราคา/]    visible

Contract Page Fits The Phone And Keeps Accept On Screen
    [Documentation]    A contract waiting for acceptance at 390x844: no sideways scroll, "ยอมรับเงื่อนไข" fully on screen.
    [Tags]    mobile
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${vendor}=    Crew Otp Sign In Via API    ${crew}    ${crew}[token]
    ${bid}=    Submit Bid Via API    ${vendor}    ${crew}[invitation_id]    ${lines}    100
    Award Whole Package Via API    ${buyer}    ${pkg}[id]    ${lines}    ${bid.json()}[id]
    ${sc}=    Subcontract Row    ${pkg}[id]
    ${ctx}=    Open Crew Context    /vendor/login
    Go To Path    /s/${crew}[token]
    Click    role=button[name="ดูงานของฉัน"]
    Crew Sign In With Otp    ${crew}    ${False}
    Go To Path    /vendor/contracts/${sc}[id]
    Wait For Elements State    role=button[name="ยอมรับเงื่อนไข"]    visible    timeout=60s
    Page Should Not Scroll Sideways
    Element Should Be Inside Viewport    role=button[name="ยอมรับเงื่อนไข"]


*** Keywords ***
New Phone Crew
    [Documentation]    ``&{crew}`` with a unique name and phone (not in any list).
    ${name}=    Unique Name    ทีมทดสอบ
    ${phone}=    Unique Thai Phone
    VAR    &{crew}    name=${name}    phone=${phone}
    RETURN    ${crew}

Anonymous Crew Session
    [Documentation]    API session without a token, with its own ``X-Forwarded-For`` (per-IP OTP quota).
    ${alias}=    Unique Suffix
    ${ip}=    Random Test Ip
    Create Session    ${alias}    ${API_URL}    verify=${False}    disable_warnings=1    headers=${{ {'X-Forwarded-For': $ip} }}
    RETURN    ${alias}
