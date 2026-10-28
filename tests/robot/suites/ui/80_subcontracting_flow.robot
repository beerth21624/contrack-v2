*** Settings ***
Documentation       W6 - subcontracting ("จ้างช่วง", การจัดคน): the whole staffing flow on the web.
...                 BOQ rows -> work package (wizard) -> three crews invited by phone -> each crew opens its link on a
...                 phone, signs in with the OTP from the API log and bids (or declines) -> the buyer compares the bids
...                 -> awards the cheaper one -> a contract is made -> the crew accepts it.
...                 Database rows (sc_work_packages, sc_invitations, sc_bids, sc_awards, sc_subcontracts) are read
...                 back at every step. Expected totals are computed here from what was typed, never copied.
Resource            ../../resources/pages/subcontracting.resource
Suite Setup         Open Browser For Suite
Suite Teardown      Close Browser    ALL
Test Setup          Set Browser Timeout    120s
Test Teardown       Close Context    ALL
Test Tags           subcontracting    ui


*** Test Cases ***
Buyer Staffs A Package With Three Crews From BOQ Rows To An Accepted Contract
    [Documentation]    The whole flow in the browser. Crew 1 bids 118/unit, crew 2 bids 104/unit (cheaper), crew 3
    ...    declines. Totals on every screen = sum of round(price x quantity, 2) over the 7 masonry rows.
    [Tags]    smoke    slow
    [Timeout]    15m
    ${buyer}=    Setup Buyer Via API
    ${c1}=    New Crew In Memory    ทีมช่างหนึ่ง
    ${c2}=    New Crew In Memory    ทีมช่างสอง
    ${c3}=    New Crew In Memory    ทีมช่างสาม
    ${buyer_ctx}=    Open Buyer Context    ${buyer}
    Open Subcontracting Home
    Click    role=button[name="สร้างแพ็กเกจแรกจาก BOQ"]
    Wait For Elements State    text="งานที่จะจ้าง"    visible    timeout=60s
    Pick Masonry Template
    Go To Wizard Next Step
    Fill Package Terms    ${MASONRY_TITLE}    งานก่ออิฐฉาบปูนทั้งหลัง ผนังชั้นเดียว ตามแบบที่แนบ
    Go To Wizard Next Step
    Wait For Elements State    text="ผู้รับคำเชิญ"    visible
    Add Crew In Wizard    ${c1}[name]    ${c1}[phone]
    Add Crew In Wizard    ${c2}[name]    ${c2}[phone]
    Add Crew In Wizard    ${c3}[name]    ${c3}[phone]
    ${links}=    Send Wizard Invitations    3
    # the package page opens after the links dialog is closed
    Wait For Elements State    role=tab[name="รายการงาน (${MASONRY_ROW_COUNT})"]    visible    timeout=60s
    ${pkg_row}=    Package Row By Title    ${buyer}[project_id]    ${MASONRY_TITLE}
    ${package_id}=    Set Variable    ${pkg_row}[id]
    Should Be Equal    ${pkg_row}[status]    open
    Should Be Equal    ${pkg_row}[sourcing_mode]    rfq
    Should Be Equal    ${pkg_row}[supply_mode]    labour_only
    Should Be Equal    ${pkg_row}[description]    งานก่ออิฐฉาบปูนทั้งหลัง ผนังชั้นเดียว ตามแบบที่แนบ
    Should Be True    ${pkg_row}[estimate_total] > 0
    ${lines}=    Package Lines Via API    ${buyer}    ${package_id}
    Length Should Be    ${lines}    ${MASONRY_ROW_COUNT}
    FOR    ${crew}    IN    ${c1}    ${c2}    ${c3}
        Invitation Status Should Be    ${package_id}    ${crew}[name]    sent
        ${token}=    Token Of Url    ${links}[${crew}[name]]
        Set To Dictionary    ${crew}    token=${token}
    END
    # crews 1 and 2 bid, each on its own phone
    ${price1}=    Set Variable    118
    ${price2}=    Set Variable    104
    @{prices1}=    Evaluate    [$price1] * len($lines)
    @{prices2}=    Evaluate    [$price2] * len($lines)
    ${total1}=    Expected Bid Total    ${lines}    ${prices1}
    ${total2}=    Expected Bid Total    ${lines}    ${prices2}
    Should Be True    ${total2} < ${total1}
    ${ctx1}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${c1}
    Crew Types Prices    @{prices1}
    Crew Form Total Should Be    ${total1}
    Crew Presses Send Bid
    Wait For Elements State    text=/ราคาที่ส่ง ฉบับที่ 1/    visible    timeout=30s
    ${ctx2}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${c2}
    Crew Submits Bid    @{prices2}
    # crew 3 declines
    ${ctx3}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${c3}
    Click    role=button[name="ไม่รับงานนี้"]
    Click    css=.ant-drawer-body >> role=button[name="คิวงานเต็ม"]
    Toast Should Show    แจ้งผู้ว่าจ้างแล้ว
    # database after the bids
    ${inv1}=    Invitation Row    ${package_id}    ${c1}[name]
    ${inv2}=    Invitation Row    ${package_id}    ${c2}[name]
    Invitation Status Should Be    ${package_id}    ${c1}[name]    submitted
    Invitation Status Should Be    ${package_id}    ${c2}[name]    submitted
    Invitation Status Should Be    ${package_id}    ${c3}[name]    declined
    ${bid1}=    Latest Bid Row    ${inv1}[id]
    ${bid2}=    Latest Bid Row    ${inv2}[id]
    Should Be Equal    ${bid1}[status]    submitted
    Numbers Should Be Close    ${bid1}[total]    ${total1}    0.01
    Numbers Should Be Close    ${bid2}[total]    ${total2}    0.01
    # the buyer compares
    Switch Context    ${buyer_ctx}
    Open Leveling Page    ${package_id}
    ${totals}=    Leveling Totals
    Length Should Be    ${totals}    2
    Numbers Should Be Close    ${totals}[${c1}[name]]    ${total1}    0.5
    Numbers Should Be Close    ${totals}[${c2}[name]]    ${total2}    0.5
    # award the cheaper bid
    Award Whole Package In Leveling    ${c2}[name]
    Wait For Elements State    text=/${buyer}[project_name]|กำลังโหลด|สัญญา/    visible    timeout=60s
    Wait Until Keyword Succeeds    30s    500ms    Award Count Should Be    ${package_id}    1
    Package Status Should Be    ${package_id}    awarded
    ${sc}=    Subcontract Row    ${package_id}
    Should Be Equal    ${sc}[status]    pending_acceptance
    Numbers Should Be Close    ${sc}[total]    ${total2}    0.01
    Should Be Equal    ${sc}[bid_id]    ${bid2}[id]
    Should Be Equal    ${sc}[invitation_id]    ${inv2}[id]
    Invitation Status Should Be    ${package_id}    ${c2}[name]    won
    Invitation Status Should Be    ${package_id}    ${c1}[name]    lost
    # the winning crew accepts
    Switch Context    ${ctx2}
    Go To Path    /vendor/contracts/${sc}[id]
    Click    role=button[name="ยอมรับเงื่อนไข"]
    Click    css=.ant-modal-confirm >> role=button[name="ยอมรับ"]
    Toast Should Show    ยอมรับเงื่อนไขแล้ว
    ${sc_after}=    Subcontract Row    ${package_id}
    Should Be Equal    ${sc_after}[status]    active
    Should Not Be Equal    ${sc_after}[accepted_at]    ${None}
    # the losing crew is told
    Switch Context    ${ctx1}
    Go To Path    /vendor/invitations/${inv1}[id]
    Wait For Elements State    text=/ผู้ว่าจ้างเลือกทีมอื่น/    visible

Package Wizard Saves A Draft With The Chosen Rows And Scope Text
    [Documentation]    Untick one BOQ row (6 of 7 stay), type a scope text, save as draft: one row in
    ...    sc_work_packages with status draft, no invitations.
    [Tags]    smoke
    ${buyer}=    Setup Buyer Via API
    ${ctx}=    Open Buyer Context    ${buyer}
    Start Package Wizard
    Pick Masonry Template
    Uncheck Checkbox    css=[aria-label="วงกบประตูไม้"]
    Wizard Selected Count Should Be    6
    Go To Wizard Next Step
    Fill Package Terms    ฉาบปูนและก่ออิฐ    ขอเฉพาะค่าแรง ไม่รวมวงกบ
    Go To Wizard Next Step
    Click    role=button[name="บันทึกร่าง"]
    Toast Should Show    บันทึกร่างแล้ว
    ${row}=    Package Row By Title    ${buyer}[project_id]    ฉาบปูนและก่ออิฐ
    Should Be Equal    ${row}[status]    draft
    Should Be Equal    ${row}[description]    ขอเฉพาะค่าแรง ไม่รวมวงกบ
    ${lines}=    Package Lines Via API    ${buyer}    ${row}[id]
    Length Should Be    ${lines}    6
    ${n}=    Query Value    select count(*) from sc_invitations where package_id = %s    ${row}[id]
    Should Be Equal As Integers    ${n}    0

Package Wizard Takes The Bid Deadline The Buyer Picks
    [Documentation]    Type a deadline 10 days ahead (Bangkok time 17:00) in step 3 and save a draft: the stored
    ...    bid_deadline is that moment.
    ${buyer}=    Setup Buyer Via API
    ${ctx}=    Open Buyer Context    ${buyer}
    Start Package Wizard
    Pick Masonry Template
    Go To Wizard Next Step
    Fill Package Terms    งานกำหนดเส้นตาย    ทดสอบวันปิดรับ
    Go To Wizard Next Step
    ${typed}=    Evaluate    (__import__('datetime').datetime.now() + __import__('datetime').timedelta(days=10)).strftime('%d/%m/%Y 17:00')
    Fill Text    css=[aria-label="ปิดรับราคา"]    ${typed}
    Keyboard Key    press    Enter
    Click    role=button[name="บันทึกร่าง"]
    Toast Should Show    บันทึกร่างแล้ว
    ${row}=    Package Row By Title    ${buyer}[project_id]    งานกำหนดเส้นตาย
    ${expected}=    Evaluate    (__import__('datetime').datetime.now() + __import__('datetime').timedelta(days=10)).strftime('%Y-%m-%d')
    ${stored}=    Evaluate    $row['bid_deadline'].astimezone(__import__('zoneinfo').ZoneInfo('Asia/Bangkok')).strftime('%Y-%m-%d %H:%M')
    Should Be Equal    ${stored}    ${expected} 17:00

Invitation Links Dialog Lists One Link Per Crew
    [Documentation]    After sending, the one-time dialog lists every crew with its own /s/ link, and the links are
    ...    different. sc_invitations has one row per crew.
    ${buyer}=    Setup Buyer Via API
    ${c1}=    New Crew In Memory    ทีมลิงก์หนึ่ง
    ${c2}=    New Crew In Memory    ทีมลิงก์สอง
    ${ctx}=    Open Buyer Context    ${buyer}
    ${links}=    Create Package Through Wizard    งานแจกลิงก์    ทดสอบลิงก์    ${c1}    ${c2}
    Length Should Be    ${links}    2
    Should Match Regexp    ${links}[${c1}[name]]    /s/[A-Za-z0-9_-]{16,}$
    Should Match Regexp    ${links}[${c2}[name]]    /s/[A-Za-z0-9_-]{16,}$
    Should Not Be Equal    ${links}[${c1}[name]]    ${links}[${c2}[name]]
    ${row}=    Package Row By Title    ${buyer}[project_id]    งานแจกลิงก์
    ${n}=    Query Value    select count(*) from sc_invitations where package_id = %s and status = 'sent'    ${row}[id]
    Should Be Equal As Integers    ${n}    2

Invitation Sent By SMS Carries The Link
    [Documentation]    Channel "sms": the crew's phone receives a message with the /s/ link (API log) and the
    ...    invitation row says channel sms.
    ${buyer}=    Setup Buyer Via API
    ${resp}=    Create Package Via API    ${buyer}
    ${crew}=    Create Crew Entry Via API    ${buyer}
    ${links}=    Invite Crews Via API    ${buyer}    ${resp.json()}[id]    sms    ${crew}
    ${sms}=    Latest Sms To    ${crew}[phone]
    Should Contain    ${sms}    ${links}[${crew}[name]][url]
    ${inv}=    Invitation Row    ${resp.json()}[id]    ${crew}[name]
    Should Be Equal    ${inv}[channel]    sms

Crew Opens The Link Without Signing In And Sees The Job Without Prices
    [Documentation]    /s/<token> shows the 7 rows and quantities, hides the owner (project name) and shows no
    ...    estimate; the primary action "เสนอราคา" is there.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /s/${crew}[token]
    Wait For Elements State    text="ก่ออิฐมอญ (ครึ่งแผ่น)"    visible    timeout=60s
    Wait For Elements State    role=button[name="เสนอราคา"]    visible
    ${body}=    Get Text    body
    Should Not Contain    ${body}    ${buyer}[project_name]
    Should Not Contain    ${body}    ประเมิน
    Invitation Status Should Be    ${pkg}[id]    ${crew}[name]    viewed

Crew Signs In With The Code And Sees Only Its Own Invitation
    [Documentation]    Two crews invited to the same package: after OTP sign-in the inbox of crew 1 holds exactly one
    ...    job card and the invitation link of crew 1 (not crew 2) is what the inbox opens.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${c1}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /vendor/login
    Go To Path    /s/${c1}[token]
    Click    role=button[name="เสนอราคา"]
    Crew Sign In With Otp    ${c1}
    Wait For Elements State    role=button[name="ส่งราคา"]    visible    timeout=60s
    Go To Path    /vendor
    Wait For Elements State    text="${MASONRY_TITLE}"    visible    timeout=60s
    Get Element Count    text="${MASONRY_TITLE}"    ==    1
    ${inv1}=    Invitation Row    ${pkg}[id]    ${c1}[name]
    ${vendor_ws}=    Set Variable    ${inv1}[vendor_workspace_id]
    Should Not Be Equal    ${vendor_ws}    ${None}

Crew Bid Total Is The Sum Of Price Times Quantity
    [Documentation]    Different price per row (typed in the form): the form total, the stored bid total and the
    ...    submitted page all equal the sum computed here.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    @{prices}=    Create List    120    95.5    130    18.25    42    45.75    900
    ${expected}=    Expected Bid Total    ${lines}    ${prices}
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    Crew Types Prices    @{prices}
    Crew Form Total Should Be    ${expected}
    Crew Presses Send Bid
    Wait For Elements State    text=/ราคาที่ส่ง ฉบับที่ 1/    visible    timeout=30s
    ${inv}=    Invitation Row    ${pkg}[id]    ${crew}[name]
    ${bid}=    Latest Bid Row    ${inv}[id]
    Numbers Should Be Close    ${bid}[total]    ${expected}    0.01
    Should Be Equal    ${bid}[status]    submitted
    Should Be Equal As Integers    ${bid}[version]    1

Crew Edits A Submitted Bid Before The Deadline
    [Documentation]    "ส่งราคาใหม่" lowers the prices: version 2 is stored, version 1 is superseded, and the buyer's
    ...    comparison shows only the new total.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    @{first}=    Evaluate    [150] * len($lines)
    @{second}=    Evaluate    [140] * len($lines)
    ${total1}=    Expected Bid Total    ${lines}    ${first}
    ${total2}=    Expected Bid Total    ${lines}    ${second}
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    Crew Submits Bid    @{first}
    Click    role=button[name="ส่งราคาใหม่"]
    Crew Types Prices    @{second}
    Crew Form Total Should Be    ${total2}
    Crew Presses Send Bid
    Wait For Elements State    text=/ราคาที่ส่ง ฉบับที่ 2/    visible    timeout=30s
    ${inv}=    Invitation Row    ${pkg}[id]    ${crew}[name]
    ${rows}=    Bid Rows    ${inv}[id]
    Length Should Be    ${rows}    2
    Should Be Equal    ${rows}[0][status]    superseded
    Should Be Equal    ${rows}[1][status]    submitted
    Numbers Should Be Close    ${rows}[0][total]    ${total1}    0.01
    Numbers Should Be Close    ${rows}[1][total]    ${total2}    0.01
    ${buyer_ctx}=    Open Buyer Context    ${buyer}
    Open Leveling Page    ${pkg}[id]
    ${totals}=    Leveling Totals
    Length Should Be    ${totals}    1
    Numbers Should Be Close    ${totals}[${crew}[name]]    ${total2}    0.5

Crew Withdraws A Submitted Bid
    [Documentation]    "ถอนราคา" with confirmation: the bid row becomes withdrawn and the buyer's comparison is empty.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    @{prices}=    Evaluate    [99] * len($lines)
    ${ctx}=    Open Crew Context    /vendor/login
    Crew Opens Link And Signs In    ${crew}
    Crew Submits Bid    @{prices}
    Click    role=button[name="ถอนราคา"]
    Click    css=.ant-modal-confirm >> role=button[name="ถอนราคา"]
    Toast Should Show    ถอนราคาแล้ว
    ${inv}=    Invitation Row    ${pkg}[id]    ${crew}[name]
    ${bid}=    Latest Bid Row    ${inv}[id]
    Should Be Equal    ${bid}[status]    withdrawn

Crew Declines A Job With A Reason And The Buyer Sees It
    [Documentation]    Decline from the link page (no sign-in): sc_invitations.status declined with the reason; the
    ...    buyer's package page shows the reason text.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /s/${crew}[token]
    Click    role=button[name="ไม่รับงานนี้"]
    Click    css=.ant-drawer-body >> role=button[name="ไกลเกินไป"]
    Toast Should Show    แจ้งผู้ว่าจ้างแล้ว
    ${inv}=    Invitation Row    ${pkg}[id]    ${crew}[name]
    Should Be Equal    ${inv}[status]    declined
    Should Be Equal    ${inv}[decline_reason]    too_far
    ${buyer_ctx}=    Open Buyer Context    ${buyer}
    Open Package Page    ${pkg}[id]
    Wait For Elements State    text="ไกลเกินไป"    visible    timeout=30s

Crew Question Reaches The Buyer
    [Documentation]    A crew asks a question on the link page: a row in sc_package_questions and the buyer's
    ...    "คำถาม-คำตอบ" tab shows it as waiting for an answer.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${ctx}=    Open Crew Context    /s/${crew}[token]
    Click    role=button[name="ถามคำถาม"]
    Fill Text    css=.ant-drawer-body textarea    หน้างานมีน้ำประปาใช้แล้วหรือยัง
    Click    css=.ant-drawer-body >> role=button[name="ส่งคำถาม"]
    Toast Should Show    ส่งคำถามแล้ว
    ${n}=    Query Value    select count(*) from sc_package_questions where package_id = %s and answer is null    ${pkg}[id]
    Should Be Equal As Integers    ${n}    1
    ${buyer_ctx}=    Open Buyer Context    ${buyer}
    Open Package Page    ${pkg}[id]
    Click    role=tab[name=/คำถาม-คำตอบ/]
    Wait For Elements State    text="หน้างานมีน้ำประปาใช้แล้วหรือยัง"    visible

Leveling Page Shows Two Bids With Totals Equal To What Was Typed
    [Documentation]    Two crews bid through the API with different prices; the comparison table lists exactly those
    ...    two crews, cheaper first, and the "รวม" row equals the computed sums.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${totals_expected}=    Bid Through Api As Both Crews    ${pkg}    ${lines}    131    127.5
    ${buyer_ctx}=    Open Buyer Context    ${buyer}
    Open Leveling Page    ${pkg}[id]
    ${totals}=    Leveling Totals
    Length Should Be    ${totals}    2
    ${c1}=    Set Variable    ${pkg}[crews][0]
    ${c2}=    Set Variable    ${pkg}[crews][1]
    Numbers Should Be Close    ${totals}[${c1}[name]]    ${totals_expected}[0]    0.5
    Numbers Should Be Close    ${totals}[${c2}[name]]    ${totals_expected}[1]    0.5
    Get Text    css=table thead tr:first-child th >> nth=3    contains    ${c2}[name]

Awarding The Cheaper Bid Creates One Contract With The Bid Total
    [Documentation]    Award in the UI: sc_awards 1 row, sc_subcontracts 1 row pending_acceptance with total = the
    ...    cheaper bid, winner invitation won, the other lost, package awarded.
    [Tags]    smoke
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${expected}=    Bid Through Api As Both Crews    ${pkg}    ${lines}    131    127.5
    ${c1}=    Set Variable    ${pkg}[crews][0]
    ${c2}=    Set Variable    ${pkg}[crews][1]
    ${buyer_ctx}=    Open Buyer Context    ${buyer}
    Open Leveling Page    ${pkg}[id]
    Award Whole Package In Leveling    ${c2}[name]
    Wait Until Keyword Succeeds    30s    500ms    Award Count Should Be    ${pkg}[id]    1
    Package Status Should Be    ${pkg}[id]    awarded
    ${sc}=    Subcontract Row    ${pkg}[id]
    Should Be Equal    ${sc}[status]    pending_acceptance
    Numbers Should Be Close    ${sc}[total]    ${expected}[1]    0.01
    Invitation Status Should Be    ${pkg}[id]    ${c2}[name]    won
    Invitation Status Should Be    ${pkg}[id]    ${c1}[name]    lost
    Wait For Elements State    css=.ant-tag >> text="รอผู้รับจ้างยอมรับ"    visible    timeout=60s

Crew Accepts The Awarded Contract On The Phone
    [Documentation]    The winner opens the contract (read the terms) and accepts: status active, accepted_at set,
    ...    and the inbox shows the contract under "สัญญา".
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${expected}=    Bid Through Api As Both Crews    ${pkg}    ${lines}    131    127.5
    ${c2}=    Set Variable    ${pkg}[crews][1]
    ${inv2}=    Invitation Row    ${pkg}[id]    ${c2}[name]
    ${bid2}=    Latest Bid Row    ${inv2}[id]
    Award Whole Package Via API    ${buyer}    ${pkg}[id]    ${lines}    ${bid2}[id]
    ${sc}=    Subcontract Row    ${pkg}[id]
    ${ctx}=    Open Crew Context    /vendor/login
    Go To Path    /s/${c2}[token]
    Click    role=button[name="ดูงานของฉัน"]
    Crew Sign In With Otp    ${c2}    ${False}
    Wait For Elements State    text="${MASONRY_TITLE}"    visible    timeout=60s
    Click    role=tab[name=/สัญญา/]
    Click    role=link[name=/ดูสัญญา|เปิดสัญญา|ยอมรับ/]
    Wait For Elements State    role=button[name="ยอมรับเงื่อนไข"]    visible    timeout=60s
    Click    role=button[name="ยอมรับเงื่อนไข"]
    Click    css=.ant-modal-confirm >> role=button[name="ยอมรับ"]
    Toast Should Show    ยอมรับเงื่อนไขแล้ว
    ${row}=    Subcontract Row    ${pkg}[id]
    Should Be Equal    ${row}[status]    active
    Numbers Should Be Close    ${row}[total]    ${expected}[1]    0.01
    Should Be Equal    ${row}[id]    ${sc}[id]

Losing Crew Is Told Another Team Was Chosen
    [Documentation]    After the award the losing crew's invitation page says the buyer chose another team and offers
    ...    no bid form.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${expected}=    Bid Through Api As Both Crews    ${pkg}    ${lines}    131    127.5
    ${c1}=    Set Variable    ${pkg}[crews][0]
    ${c2}=    Set Variable    ${pkg}[crews][1]
    ${inv2}=    Invitation Row    ${pkg}[id]    ${c2}[name]
    ${bid2}=    Latest Bid Row    ${inv2}[id]
    Award Whole Package Via API    ${buyer}    ${pkg}[id]    ${lines}    ${bid2}[id]
    ${inv1}=    Invitation Row    ${pkg}[id]    ${c1}[name]
    ${ctx}=    Open Crew Context    /vendor/login
    Go To Path    /s/${c1}[token]
    Wait For Elements State    text=/ผู้ว่าจ้างเลือกทีมอื่น/    visible    timeout=60s
    Get Element Count    role=button[name="เสนอราคา"]    ==    0

Buyer Overview Lists The Package And Its Status
    [Documentation]    /subcontracting lists the new package in the packages table with the "เปิดรับราคา" style
    ...    status, and the "สร้างแพ็กเกจ" action exists.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${ctx}=    Open Buyer Context    ${buyer}
    Open Subcontracting Home
    Wait For Elements State    role=link[name="${MASONRY_TITLE}"]    visible    timeout=60s
    Wait For Elements State    role=link[name="สร้างแพ็กเกจ"]    visible
    Package Status Should Be    ${pkg}[id]    open

Package Page Shows Each Crew With Its Status And Price
    [Documentation]    "ผู้รับคำเชิญ" tab: both crews, the bidder with its total in baht, the other as not yet bid.
    ${buyer}=    Setup Buyer Via API
    ${pkg}=    Open Package With Crews Via API    ${buyer}    2
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${c1}=    Set Variable    ${pkg}[crews][0]
    ${c2}=    Set Variable    ${pkg}[crews][1]
    ${vendor}=    Crew Otp Sign In Via API    ${c1}    ${c1}[token]
    ${inv1}=    Invitation Row    ${pkg}[id]    ${c1}[name]
    Submit Bid Via API    ${vendor}    ${inv1}[id]    ${lines}    111
    @{prices}=    Evaluate    [111] * len($lines)
    ${total}=    Expected Bid Total    ${lines}    ${prices}
    ${ctx}=    Open Buyer Context    ${buyer}
    Open Package Page    ${pkg}[id]
    Wait For Elements State    text="${c1}[name]"    visible    timeout=30s
    Wait For Elements State    text="${c2}[name]"    visible
    ${row_text}=    Get Text    css=tr:has-text("${c1}[name]")
    Numbers Should Be Close    ${row_text.split('บาท')[0].split()[-1]}    ${total}    1


*** Keywords ***
New Crew In Memory
    [Documentation]    ``&{crew}`` (name, phone) not yet in any list: the wizard adds it to the vendor list.
    [Arguments]    ${prefix}
    ${name}=    Unique Name    ${prefix}
    ${phone}=    Unique Thai Phone
    VAR    &{crew}    name=${name}    phone=${phone}
    RETURN    ${crew}

Bid Through Api As Both Crews
    [Documentation]    Crew 1 bids ``${price1}``, crew 2 ``${price2}`` per unit on every row (OTP sign-in through the
    ...    API). Returns the two expected totals ``[total1, total2]``.
    [Arguments]    ${pkg}    ${lines}    ${price1}    ${price2}
    ${c1}=    Set Variable    ${pkg}[crews][0]
    ${c2}=    Set Variable    ${pkg}[crews][1]
    ${v1}=    Crew Otp Sign In Via API    ${c1}    ${c1}[token]
    ${v2}=    Crew Otp Sign In Via API    ${c2}    ${c2}[token]
    ${i1}=    Invitation Row    ${pkg}[id]    ${c1}[name]
    ${i2}=    Invitation Row    ${pkg}[id]    ${c2}[name]
    Submit Bid Via API    ${v1}    ${i1}[id]    ${lines}    ${price1}
    Submit Bid Via API    ${v2}    ${i2}[id]    ${lines}    ${price2}
    @{p1}=    Evaluate    [$price1] * len($lines)
    @{p2}=    Evaluate    [$price2] * len($lines)
    ${t1}=    Expected Bid Total    ${lines}    ${p1}
    ${t2}=    Expected Bid Total    ${lines}    ${p2}
    RETURN    ${t1}    ${t2}
