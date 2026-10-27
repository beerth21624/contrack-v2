*** Settings ***
Documentation       Finding and inviting crews (ทีมช่าง): the buyer's vendor list, invitations by link or SMS, the
...                 guest view of an invitation link, crew sign-in with a phone number and one-time code (the SMS is read
...                 from the API log), linking an invitation to the crew's workspace, the crew profile and Q&A.
...                 API-module1.md "Identity / phone (B2)" and "Sourcing (C1)".
Resource            ../../resources/api.resource
Resource            ../../resources/db.resource
Resource            ../../resources/pages/api_subcontracting.resource
Test Tags           api    subcontracting    crews


*** Test Cases ***
Crew Is Added To The Vendor List With A Normalised Phone
    [Documentation]    081-234-5678 style input is stored as E.164 (+6681…), unlinked, not hidden.
    [Tags]    smoke
    ${buyer}=    Create Buyer Workspace
    ${local}=    Unique Thai Phone
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    ${local}
    ${expected}=    To E164 Thai    ${local}
    Should Be Equal    ${entry}[phone]    ${expected}
    Should Not Be True    ${entry}[hasAccount]
    Should Not Be True    ${entry}[hidden]
    Should Be Equal    ${entry}[vendorWorkspaceId]    ${None}
    ${row}=    Query Row    select * from sc_vendor_list_entries where id = %s    ${entry}[id]
    Should Be Equal    ${row}[phone]    ${expected}
    Should Be Equal As Strings    ${row}[buyer_workspace_id]    ${buyer}[ws]

Phone Written With Dashes Is Accepted
    ${buyer}=    Create Buyer Workspace
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    081-234-5678
    Should Be Equal    ${entry}[phone]    +66812345678

Same Phone In Another Format Is A Duplicate
    [Documentation]    +66… and 0… are the same number: the second entry is refused 409 and not stored.
    [Tags]    negative    edge
    ${buyer}=    Create Buyer Workspace
    ${local}=    Unique Thai Phone
    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    ${local}
    ${e164}=    To E164 Thai    ${local}
    ${again}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    ${e164}    status=409
    Should Be Equal    ${again}[code]    conflict
    Row Count Should Be    1    select 1 from sc_vendor_list_entries where buyer_workspace_id = %s    ${buyer}[ws]

Same Phone Can Be In Two Buyers' Lists
    [Documentation]    The phone is unique per buyer workspace, not globally.
    [Tags]    edge
    ${first}=    Create Buyer Workspace
    ${second}=    Create Buyer Workspace
    ${phone}=    Unique Thai Phone
    Add Crew To Vendor List    ${first}[owner]    ${first}[ws]    ${phone}
    Add Crew To Vendor List    ${second}[owner]    ${second}[ws]    ${phone}

Invalid Phone Number Is Refused
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace
    FOR    ${bad}    IN    12345    abcdefghij    +1555123456    0
        ${resp}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    ${bad}    status=400
        Should Be Equal    ${resp}[code]    validation_failed
    END
    Row Count Should Be    0    select 1 from sc_vendor_list_entries where buyer_workspace_id = %s    ${buyer}[ws]

Vendor List Entry Can Be Renamed And Hidden
    ${buyer}=    Create Buyer Workspace
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    VAR    &{patch}    displayName=ทีมพี่หมี    hidden=${True}
    ${resp}=    Api Patch    ${buyer}[owner]    /subcontracting/vendor-list/${entry}[id]    ${patch}
    Should Be Equal    ${resp.json()}[displayName]    ทีมพี่หมี
    Should Be True    ${resp.json()}[hidden]
    ${row}=    Query Row    select * from sc_vendor_list_entries where id = %s    ${entry}[id]
    Should Be Equal    ${row}[display_name]    ทีมพี่หมี
    Should Not Be Equal    ${row}[hidden_at]    ${None}

Hidden Entries Are Left Out Of The Default List
    ${buyer}=    Create Buyer Workspace
    ${shown}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    name=ทีมแสดง
    ${hidden}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    name=ทีมซ่อน
    VAR    &{patch}    hidden=${True}
    Api Patch    ${buyer}[owner]    /subcontracting/vendor-list/${hidden}[id]    ${patch}
    ${list}=    Api Get    ${buyer}[owner]    /workspaces/${buyer}[ws]/vendor-list    hidden=false
    ${names}=    Evaluate    [e['displayName'] for e in $list.json()]
    Should Be Equal    ${names}    ${{ ['ทีมแสดง'] }}
    ${only_hidden}=    Api Get    ${buyer}[owner]    /workspaces/${buyer}[ws]/vendor-list    hidden=true
    Length Should Be    ${only_hidden.json()}    1

Vendor List Can Be Searched By Name
    ${buyer}=    Create Buyer Workspace
    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    name=ช่างสมชาย ก่ออิฐ
    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    name=ช่างประเสริฐ ไฟฟ้า
    ${list}=    Api Get    ${buyer}[owner]    /workspaces/${buyer}[ws]/vendor-list    q=สมชาย
    Length Should Be    ${list.json()}    1
    Should Be Equal    ${list.json()}[0][displayName]    ช่างสมชาย ก่ออิฐ

Entry Without Invitations Can Be Deleted
    ${buyer}=    Create Buyer Workspace
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    Api Delete    ${buyer}[owner]    /subcontracting/vendor-list/${entry}[id]    204
    Row Count Should Be    0    select 1 from sc_vendor_list_entries where id = %s    ${entry}[id]

Entry With Invitations Cannot Be Deleted Only Hidden
    [Tags]    negative    edge
    ${ctx}=    Set Up Open Package With Crews    1
    ${resp}=    Api Delete    ${ctx}[buyer][owner]    /subcontracting/vendor-list/${ctx}[entries][0][id]    409
    Error Code Should Be    ${resp}    conflict
    Row Count Should Be    1    select 1 from sc_vendor_list_entries where id = %s    ${ctx}[entries][0][id]

Vendor List Import Counts Created Duplicates And Invalid Rows
    ${buyer}=    Create Buyer Workspace
    ${known}=    Unique Thai Phone
    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    ${known}
    ${fresh}=    Unique Thai Phone
    ${rows}=    Evaluate
    ...    [{'displayName': 'ใหม่', 'phone': $fresh}, {'displayName': 'ซ้ำ', 'phone': $known}, {'displayName': 'เบอร์เสีย', 'phone': '12345'}]
    VAR    &{body}    rows=${rows}
    ${resp}=    Api Post    ${buyer}[owner]    /workspaces/${buyer}[ws]/vendor-list/import    ${body}    200
    Should Be Equal As Integers    ${resp.json()}[created]    1
    Should Be Equal    ${resp.json()}[duplicates]    ${{ [1] }}
    Length Should Be    ${resp.json()}[invalid]    1
    Should Be Equal As Integers    ${resp.json()}[invalid][0][row]    2
    Row Count Should Be    2    select 1 from sc_vendor_list_entries where buyer_workspace_id = %s    ${buyer}[ws]

Viewer Can Read The Vendor List But Not Change It
    [Tags]    security
    ${buyer}=    Create Buyer Workspace
    ${viewer}=    Add Workspace Member    ${buyer}    viewer
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${list}=    Api Get    ${viewer}    /workspaces/${buyer}[ws]/vendor-list
    Length Should Be    ${list.json()}    1
    ${denied}=    Add Crew To Vendor List    ${viewer}    ${buyer}[ws]    status=403
    Should Be Equal    ${denied}[code]    forbidden
    VAR    &{patch}    displayName=แก้ไม่ได้
    ${patched}=    Api Patch    ${viewer}    /subcontracting/vendor-list/${entry}[id]    ${patch}    403
    Error Code Should Be    ${patched}    forbidden

Another Workspace Cannot See Or Change My Vendor List
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace
    ${stranger}=    Create Buyer Workspace
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${list}=    Api Get    ${stranger}[owner]    /workspaces/${buyer}[ws]/vendor-list    404
    Error Code Should Be    ${list}    not_found
    VAR    &{patch}    displayName=ยึดทีม
    ${patched}=    Api Patch    ${stranger}[owner]    /subcontracting/vendor-list/${entry}[id]    ${patch}    404
    Error Code Should Be    ${patched}    not_found
    ${deleted}=    Api Delete    ${stranger}[owner]    /subcontracting/vendor-list/${entry}[id]    404
    Error Code Should Be    ${deleted}    not_found
    Row Count Should Be    1    select 1 from sc_vendor_list_entries where id = %s and display_name = 'ทีมช่างทดสอบ'
    ...    ${entry}[id]

Invitation By Link Returns A Link And Stores Only A Token Hash
    [Documentation]    The raw link is returned once. The database holds a hash of the token, never the token itself,
    ...    and a link-channel invitation sends no SMS.
    [Tags]    smoke    security
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${sent}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$entry['id']] }}    channel=link
    ${url}=    Set Variable    ${sent.json()}[links][0][url]
    Should Contain    ${url}    /s/
    ${token}=    Token From Link    ${url}
    ${invitation_id}=    Set Variable    ${sent.json()}[invitations][0][id]
    ${row}=    Invitation Row    ${invitation_id}
    Should Be Equal    ${row}[status]    sent
    Should Be Equal    ${row}[channel]    link
    Should Be Equal    ${row}[phone]    ${entry}[phone]
    Row Count Should Be    1    select 1 from sc_invitation_tokens where invitation_id = %s    ${invitation_id}
    Row Count Should Be    0    select 1 from sc_invitation_tokens where token_hash = %s    ${token}
    ${sms}=    Sms Messages To    ${entry}[phone]
    Should Be Empty    ${sms}

Invitation By Sms Texts The Link To The Crew
    [Documentation]    channel sms: the SMS in the API log carries the same /s/<token> link as the response.
    [Tags]    smoke
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${sent}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$entry['id']] }}    channel=sms
    ${text}=    Latest Sms To    ${entry}[phone]
    Should Contain    ${text}    ${sent.json()}[links][0][url]
    ${row}=    Invitation Row    ${sent.json()}[invitations][0][id]
    Should Be Equal    ${row}[channel]    sms

Same Crew Cannot Be Invited Twice To One Package
    [Tags]    negative    edge
    ${ctx}=    Set Up Open Package With Crews    1
    ${resp}=    Invite Crews    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${{ [$ctx['entries'][0]['id']] }}    status=409
    Error Code Should Be    ${resp}    conflict
    Row Count Should Be    1    select 1 from sc_invitations where package_id = %s    ${ctx}[package_id]

Same Crew Twice In One Request Is Refused
    [Tags]    negative    edge
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${resp}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$entry['id'], $entry['id']] }}    status=409
    Error Code Should Be    ${resp}    conflict
    Row Count Should Be    0    select 1 from sc_invitations where package_id = %s    ${created.json()}[id]

Entry Of Another Workspace Cannot Be Invited
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace
    ${other}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${foreign}=    Add Crew To Vendor List    ${other}[owner]    ${other}[ws]
    ${resp}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$foreign['id']] }}    status=422
    Error Code Should Be    ${resp}    unprocessable
    Row Count Should Be    0    select 1 from sc_invitations where package_id = %s    ${created.json()}[id]

Invitation Needs At Least One Entry
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${resp}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [] }}    status=400
    Error Code Should Be    ${resp}    validation_failed

Viewer Cannot Invite A Crew
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace
    ${viewer}=    Add Workspace Member    ${buyer}    viewer
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${resp}=    Invite Crews    ${viewer}    ${created.json()}[id]    ${{ [$entry['id']] }}    status=403
    Error Code Should Be    ${resp}    forbidden
    ${row}=    Package Row    ${created.json()}[id]
    Should Be Equal    ${row}[status]    draft

Guest Link Shows The Package Without Any Estimate
    [Documentation]    GET /s/:token is public: lines and quantities, never the buyer's estimate; the first view marks
    ...    the invitation viewed.
    [Tags]    security    smoke
    ${ctx}=    Set Up Open Package With Crews    1
    ${anon}=    Anonymous Caller
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${resp}=    Api Get    ${anon}    /s/${crew}[link_token]
    Should Be Equal    ${resp.json()}[packageStatus]    open
    Length Should Be    ${resp.json()}[lines]    ${MASONRY LINES}
    ${text}=    Set Variable    ${resp.text}
    Should Not Contain    ${text}    estTotal
    Should Not Contain    ${text}    estLabUnit
    Should Not Contain    ${text}    estimateTotal
    ${row}=    Invitation Row    ${crew}[invitation_id]
    Should Not Be Equal    ${row}[viewed_at]    ${None}

First View Marks The Invitation Viewed
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${sent}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$entry['id']] }}
    ${id}=    Set Variable    ${sent.json()}[invitations][0][id]
    ${before}=    Invitation Row    ${id}
    Should Be Equal    ${before}[status]    sent
    Should Be Equal    ${before}[viewed_at]    ${None}
    ${anon}=    Anonymous Caller
    Api Get    ${anon}    /s/${{ $sent.json()['links'][0]['url'].rsplit('/', 1)[-1] }}
    ${after}=    Invitation Row    ${id}
    Should Be Equal    ${after}[status]    viewed
    ${listing}=    Api Get    ${buyer}[owner]    /subcontracting/packages/${created.json()}[id]/invitations
    Should Be Equal    ${listing.json()}[0][status]    viewed

Owner Identity Stays Hidden In The Guest View
    [Documentation]    hideOwnerIdentity: project name and street address are empty until award.
    [Tags]    security
    ${ctx}=    Set Up Open Package With Crews    1    hideOwnerIdentity=${True}
    ${anon}=    Anonymous Caller
    ${resp}=    Api Get    ${anon}    /s/${ctx}[crews][0][link_token]
    Should Be Equal    ${resp.json()}[projectName]    ${EMPTY}
    Should Be Equal    ${resp.json()}[location][address]    ${EMPTY}

Unknown Invitation Token Is Gone
    [Tags]    negative    security
    ${anon}=    Anonymous Caller
    ${resp}=    Api Get    ${anon}    /s/this-token-does-not-exist-at-all-0000    410
    Error Code Should Be    ${resp}    invitation_invalid

Resend Gives A New Link And Revokes The Old One
    [Documentation]    Only the newest link works after a resend.
    [Tags]    edge    security
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/invitations/${crew}[invitation_id]/resend    ${None}    200
    ${new}=    Token From Link    ${resp.json()}[link][url]
    Should Not Be Equal    ${new}    ${crew}[link_token]
    ${anon}=    Anonymous Caller
    Api Get    ${anon}    /s/${new}
    ${old}=    Api Get    ${anon}    /s/${crew}[link_token]    410
    Error Code Should Be    ${old}    invitation_invalid
    Should Be Equal As Integers    ${resp.json()}[invitation][resentCount]    1

Resend Twice Within Ten Minutes Is Rate Limited
    [Tags]    negative    edge
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    Api Post    ${ctx}[buyer][owner]    /subcontracting/invitations/${crew}[invitation_id]/resend    ${None}    200
    ${again}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/invitations/${crew}[invitation_id]/resend    ${None}    429
    Error Code Should Be    ${again}    rate_limited

Withdrawn Invitation Is Gone For The Crew
    [Documentation]    After withdrawal the link answers 410 and the crew's own route 404 (withdrawn = not found).
    [Tags]    edge    security
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${withdrawn}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/invitations/${crew}[invitation_id]/withdraw    ${None}    200
    Should Be Equal    ${withdrawn.json()}[status]    withdrawn
    ${row}=    Invitation Row    ${crew}[invitation_id]
    Should Be Equal    ${row}[status]    withdrawn
    ${anon}=    Anonymous Caller
    ${link}=    Api Get    ${anon}    /s/${crew}[link_token]    410
    Error Code Should Be    ${link}    invitation_invalid
    ${mine}=    Api Get    ${crew}    /vendor/invitations/${crew}[invitation_id]    404
    Error Code Should Be    ${mine}    not_found

Withdrawn Crew Cannot Bid
    [Documentation]    API-module1.md: withdrawn invitations are not_found on vendor routes. The bid route answers
    ...    409 invitation_closed instead of 404 not_found (the read route answers 404).
    [Tags]    negative    edge    bug
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    Api Post    ${ctx}[buyer][owner]    /subcontracting/invitations/${crew}[invitation_id]/withdraw    ${None}    200
    ${body}=    Bid Body    ${ctx}[lines]
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    404
    Error Code Should Be    ${resp}    not_found
    Row Count Should Be    0    select 1 from sc_bids where invitation_id = %s    ${crew}[invitation_id]

Withdrawn Invitation Frees A Slot In Direct Mode
    [Documentation]    Withdrawn invitations do not count against the one crew of a direct package.
    [Tags]    edge
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    sourcingMode=direct
    ${first}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${second}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${sent}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$first['id']] }}
    Api Post    ${buyer}[owner]    /subcontracting/invitations/${sent.json()}[invitations][0][id]/withdraw    ${None}    200
    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$second['id']] }}

Crew Declines Through The Link And The Buyer Sees The Reason
    [Documentation]    POST /s/:token/decline: 204, invitation declined with the reason in the row; a second decline is 409.
    [Tags]    smoke
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${anon}=    Anonymous Caller
    VAR    &{decline}    reason=too_far    note=ไกลเกินไป
    Api Post    ${anon}    /s/${crew}[link_token]/decline    ${decline}    204
    ${row}=    Invitation Row    ${crew}[invitation_id]
    Should Be Equal    ${row}[status]    declined
    Should Be Equal    ${row}[decline_reason]    too_far
    Should Be Equal    ${row}[decline_note]    ไกลเกินไป
    ${listing}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/invitations
    Should Be Equal    ${listing.json()}[0][declineReason]    too_far
    ${again}=    Api Post    ${anon}    /s/${crew}[link_token]/decline    ${decline}    409
    Error Code Should Be    ${again}    conflict

Decline With An Unknown Reason Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${anon}=    Anonymous Caller
    VAR    &{decline}    reason=bored
    ${resp}=    Api Post    ${anon}    /s/${ctx}[crews][0][link_token]/decline    ${decline}    400
    Error Code Should Be    ${resp}    validation_failed
    ${row}=    Invitation Row    ${ctx}[crews][0][invitation_id]
    Should Not Be Equal    ${row}[status]    declined

Crew Who Declined Can Change Its Mind And Bid
    [Documentation]    The backend lets a declined invitation take a bid (invitationActive refuses only withdrawn, won,
    ...    lost, closed). The invitation must then read ``submitted`` and the buyer must see the bid, not a
    ...    stale ``declined``.
    [Tags]    edge
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    VAR    &{decline}    reason=busy    note=${EMPTY}
    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/decline    ${decline}    204
    ${body}=    Bid Body    ${ctx}[lines]
    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    ${row}=    Invitation Row    ${crew}[invitation_id]
    Should Be Equal    ${row}[status]    submitted
    Row Count Should Be    1    select 1 from sc_bids where invitation_id = %s and status = 'submitted'    ${crew}[invitation_id]

Declined Crew Frees A Slot In Direct Mode
    [Tags]    edge
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    sourcingMode=direct
    ${first}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${second}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${sent}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$first['id']] }}
    ${anon}=    Anonymous Caller
    VAR    &{decline}    reason=busy    note=${EMPTY}
    Api Post    ${anon}    /s/${{ $sent.json()['links'][0]['url'].rsplit('/', 1)[-1] }}/decline    ${decline}    204
    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$second['id']] }}

Crew Sign Up By Phone Creates User Personal And Vendor Workspace
    [Documentation]    OTP request -> SMS in the log -> verify with name and team: a new user with that phone, a vendor
    ...    workspace and a vendor profile (tier L0); /vendor/me lists the crew.
    [Tags]    smoke    auth
    ${phone}=    Unique Thai Phone
    ${crew}=    Crew Signs In With Otp    ${phone}    ทีมช่างบางกรวย
    ${expected}=    To E164 Thai    ${phone}
    Should Not Be Empty    ${crew}[vendor_ws]
    ${me}=    Api Get    ${crew}    /me
    Should Be Equal    ${me.json()}[user][phone]    ${expected}
    ${mine}=    Api Get    ${crew}    /vendor/me
    Should Be Equal    ${mine.json()}[0][teamName]    ทีมช่างบางกรวย
    Should Be Equal    ${mine.json()}[0][tier]    L0
    Should Be Equal    ${mine.json()}[0][role]    owner
    ${profile}=    Query Row    select * from sc_vendor_profiles where workspace_id = %s    ${crew}[vendor_ws]
    Should Be Equal    ${profile}[team_name]    ทีมช่างบางกรวย
    Should Be Equal    ${profile}[phone]    ${expected}
    Row Count Should Be    1    select 1 from users where phone = %s    ${expected}

Phone Status Check Reports Whether The Phone Has An Account
    [Tags]    auth
    ${phone}=    Unique Thai Phone
    ${anon}=    Anonymous Caller
    VAR    &{body}    phone=${phone}
    ${before}=    Api Post    ${anon}    /auth/otp/check    ${body}    200
    Should Not Be True    ${before.json()}[exists]
    Crew Signs In With Otp    ${phone}
    ${after}=    Api Post    ${anon}    /auth/otp/check    ${body}    200
    Should Be True    ${after.json()}[exists]

Wrong Otp Code Is Refused
    [Tags]    negative    auth
    ${phone}=    Unique Thai Phone
    ${anon}=    Anonymous Caller
    ${headers}=    Forwarded Ip Headers
    VAR    &{request}    phone=${phone}
    Api Post    ${anon}    /auth/otp/request    ${request}    204    ${headers}
    ${code}=    Latest Otp To    ${phone}
    ${wrong}=    Evaluate    '000000' if $code != '000000' else '111111'
    VAR    &{verify}    phone=${phone}    code=${wrong}    displayName=ช่างผิด    teamName=ทีมผิด
    ${resp}=    Api Post    ${anon}    /auth/otp/verify    ${verify}    401    ${headers}
    Error Code Should Be    ${resp}    otp_invalid
    Row Count Should Be    0    select 1 from users where phone = %s    ${{ '+66' + $phone[1:] }}

Otp Code Cannot Be Used Twice
    [Tags]    negative    auth    security
    ${phone}=    Unique Thai Phone
    ${anon}=    Anonymous Caller
    ${headers}=    Forwarded Ip Headers
    VAR    &{request}    phone=${phone}
    Api Post    ${anon}    /auth/otp/request    ${request}    204    ${headers}
    ${code}=    Latest Otp To    ${phone}
    VAR    &{verify}    phone=${phone}    code=${code}    displayName=ช่างหนึ่ง    teamName=ทีมหนึ่ง
    Api Post    ${anon}    /auth/otp/verify    ${verify}    200    ${headers}
    ${again}=    Api Post    ${anon}    /auth/otp/verify    ${verify}    401    ${headers}
    Error Code Should Be    ${again}    otp_invalid

Otp For A Phone Never Asked Is Refused Like A Wrong Code
    [Documentation]    Same 401 for unknown and known phones, so the answer reveals nothing.
    [Tags]    negative    auth    security
    ${anon}=    Anonymous Caller
    ${headers}=    Forwarded Ip Headers
    ${phone}=    Unique Thai Phone
    VAR    &{verify}    phone=${phone}    code=123456    displayName=ผี    teamName=ทีมผี
    ${resp}=    Api Post    ${anon}    /auth/otp/verify    ${verify}    401    ${headers}
    Error Code Should Be    ${resp}    otp_invalid

Second Otp Request Within A Minute Is Rate Limited
    [Tags]    negative    auth    edge
    ${phone}=    Unique Thai Phone
    ${anon}=    Anonymous Caller
    ${headers}=    Forwarded Ip Headers
    VAR    &{request}    phone=${phone}
    Api Post    ${anon}    /auth/otp/request    ${request}    204    ${headers}
    ${again}=    Api Post    ${anon}    /auth/otp/request    ${request}    429    ${headers}
    Error Code Should Be    ${again}    rate_limited

Otp Request With An Invalid Phone Is Refused
    [Tags]    negative    auth
    ${anon}=    Anonymous Caller
    ${headers}=    Forwarded Ip Headers
    VAR    &{request}    phone=12345
    ${resp}=    Api Post    ${anon}    /auth/otp/request    ${request}    400    ${headers}
    Error Code Should Be    ${resp}    validation_failed

Otp Code Must Be Six Digits
    [Tags]    negative    auth
    ${anon}=    Anonymous Caller
    ${headers}=    Forwarded Ip Headers
    ${phone}=    Unique Thai Phone
    VAR    &{verify}    phone=${phone}    code=12ab    displayName=x    teamName=y
    ${resp}=    Api Post    ${anon}    /auth/otp/verify    ${verify}    400    ${headers}
    Error Code Should Be    ${resp}    validation_failed

New Phone Without A Name Needs The Name And Keeps The Code Usable
    [Documentation]    API-module1.md: a right code for a new phone without displayName is 422 with details
    ...    ``{ reason: 'name_required' }`` and the code stays usable. The app answers 400 validation_failed
    ...    (details reason is name_required), which differs from the documented 422.
    [Tags]    negative    auth    bug
    ${phone}=    Unique Thai Phone
    ${anon}=    Anonymous Caller
    ${headers}=    Forwarded Ip Headers
    VAR    &{request}    phone=${phone}
    Api Post    ${anon}    /auth/otp/request    ${request}    204    ${headers}
    ${code}=    Latest Otp To    ${phone}
    VAR    &{nameless}    phone=${phone}    code=${code}
    ${resp}=    Api Post    ${anon}    /auth/otp/verify    ${nameless}    422    ${headers}
    Should Be Equal    ${resp.json()}[details][reason]    name_required
    VAR    &{named}    phone=${phone}    code=${code}    displayName=ช่างมีชื่อ    teamName=ทีมมีชื่อ
    Api Post    ${anon}    /auth/otp/verify    ${named}    200    ${headers}

Code Is Burned After Too Many Wrong Attempts
    [Documentation]    More than 5 wrong attempts invalidate the code: even the right code is refused afterwards.
    [Tags]    negative    auth    security
    ${phone}=    Unique Thai Phone
    ${anon}=    Anonymous Caller
    ${headers}=    Forwarded Ip Headers
    VAR    &{request}    phone=${phone}
    Api Post    ${anon}    /auth/otp/request    ${request}    204    ${headers}
    ${code}=    Latest Otp To    ${phone}
    ${wrong}=    Evaluate    '000000' if $code != '000000' else '111111'
    VAR    &{bad}    phone=${phone}    code=${wrong}    displayName=ช่าง    teamName=ทีม
    FOR    ${attempt}    IN RANGE    6
        Api Post    ${anon}    /auth/otp/verify    ${bad}    401    ${headers}
    END
    VAR    &{right}    phone=${phone}    code=${code}    displayName=ช่าง    teamName=ทีม
    ${resp}=    Api Post    ${anon}    /auth/otp/verify    ${right}    401    ${headers}
    Error Code Should Be    ${resp}    otp_invalid

Sign In Through The Invitation Link Links The Invitation To The Crew
    [Documentation]    The crew signs up with the invited phone and the link token: the invitation, the vendor-list
    ...    entry and the vendor inbox are linked to the new vendor workspace.
    [Tags]    smoke
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${row}=    Invitation Row    ${crew}[invitation_id]
    Should Be Equal As Strings    ${row}[vendor_workspace_id]    ${crew}[vendor_ws]
    ${entry}=    Query Row    select * from sc_vendor_list_entries where id = %s    ${crew}[entry_id]
    Should Be Equal As Strings    ${entry}[vendor_workspace_id]    ${crew}[vendor_ws]
    ${inbox}=    Api Get    ${crew}    /vendor/inbox    workspaceId=${crew}[vendor_ws]
    ${ids}=    Evaluate    [i['invitationId'] for i in $inbox.json()['invitations']]
    Should Contain    ${ids}    ${crew}[invitation_id]
    ${listing}=    Api Get    ${ctx}[buyer][owner]    /workspaces/${ctx}[buyer][ws]/vendor-list
    Should Be True    ${listing.json()}[0][hasAccount]

Link Token Used By Another Phone Does Not Link The Invitation
    [Documentation]    The invitation was sent to phone A. Phone B signs up with A's token: B gets an account but the
    ...    invitation stays unlinked and B cannot open it (404); claiming it explicitly is 409 phone_mismatch.
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${sent}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$entry['id']] }}
    ${token}=    Token From Link    ${sent.json()}[links][0][url]
    ${invitation_id}=    Set Variable    ${sent.json()}[invitations][0][id]
    ${intruder_phone}=    Unique Thai Phone
    ${intruder}=    Crew Signs In With Otp    ${intruder_phone}    ทีมคนแปลกหน้า    ${token}
    ${row}=    Invitation Row    ${invitation_id}
    Should Be Equal    ${row}[vendor_workspace_id]    ${None}
    ${open}=    Api Get    ${intruder}    /vendor/invitations/${invitation_id}    404
    Error Code Should Be    ${open}    not_found
    VAR    &{claim}    token=${token}    workspaceId=${intruder}[vendor_ws]
    ${claimed}=    Api Post    ${intruder}    /vendor/claim-invitation    ${claim}    409
    Should Be Equal    ${claimed.json()}[details][reason]    phone_mismatch
    ${inbox}=    Api Get    ${intruder}    /vendor/inbox    workspaceId=${intruder}[vendor_ws]
    Should Be Empty    ${inbox.json()}[invitations]

Crew Of Another Workspace Cannot Open My Invitation
    [Tags]    security    negative
    ${ctx}=    Set Up Open Package With Crews    2
    ${mine}=    Set Variable    ${ctx}[crews][0]
    ${other}=    Set Variable    ${ctx}[crews][1]
    ${resp}=    Api Get    ${other}    /vendor/invitations/${mine}[invitation_id]    404
    Error Code Should Be    ${resp}    not_found
    ${bid}=    Api Get    ${other}    /vendor/invitations/${mine}[invitation_id]/bid    404
    Error Code Should Be    ${bid}    not_found

Vendor Inbox Lists Only My Invitations
    [Tags]    security
    ${ctx}=    Set Up Open Package With Crews    2
    ${first}=    Set Variable    ${ctx}[crews][0]
    ${second}=    Set Variable    ${ctx}[crews][1]
    ${inbox}=    Api Get    ${first}    /vendor/inbox    workspaceId=${first}[vendor_ws]
    ${ids}=    Evaluate    [i['invitationId'] for i in $inbox.json()['invitations']]
    Should Be Equal    ${ids}    ${{ [$first['invitation_id']] }}
    Should Not Contain    ${ids}    ${second}[invitation_id]
    ${foreign}=    Api Get    ${first}    /vendor/inbox    404    workspaceId=${second}[vendor_ws]
    Error Code Should Be    ${foreign}    not_found

Crew Profile Is Created Edited And Read Back
    [Tags]    smoke
    ${crew}=    Sign In New Crew
    ${trades}=    Create List    masonry    tiling
    ${provinces}=    Create List    นนทบุรี    กรุงเทพมหานคร
    ${tools}=    Create List    เครื่องผสมปูน
    ${rates}=    Evaluate    [{'trade': 'masonry', 'label': 'ก่ออิฐมอญ', 'unit': 'ตร.ม.', 'rate': 120}]
    ${months}=    Create List    2026-12    2027-01
    VAR    &{body}    workspaceId=${crew}[vendor_ws]    teamName=ทีมช่างแก้ไข    contactName=สมชาย
    ...    trades=${trades}    provinces=${provinces}    crewSkilled=${4}    crewLabourers=${3}    tools=${tools}
    ...    vatRegistered=${True}    referenceRates=${rates}    availableMonths=${months}
    ${put}=    Api Put    ${crew}    /vendor/profile    ${body}    200
    Should Be Equal    ${put.json()}[teamName]    ทีมช่างแก้ไข
    ${get}=    Api Get    ${crew}    /vendor/profile    workspaceId=${crew}[vendor_ws]
    Should Be Equal    ${get.json()}[trades]    ${trades}
    Should Be True    ${get.json()}[vatRegistered]
    ${row}=    Query Row    select * from sc_vendor_profiles where workspace_id = %s    ${crew}[vendor_ws]
    Should Be Equal    ${row}[team_name]    ทีมช่างแก้ไข
    Should Be Equal As Integers    ${row}[crew_skilled]    4
    Should Be True    ${row}[vat_registered]

Crew Profile Needs At Least One Trade
    [Tags]    negative
    ${crew}=    Sign In New Crew
    ${nothing}=    Create List
    VAR    &{body}    workspaceId=${crew}[vendor_ws]    teamName=ทีม    contactName=ช่าง    trades=${nothing}    provinces=${nothing}
    ...    crewSkilled=${None}    crewLabourers=${None}    tools=${nothing}    vatRegistered=${False}    referenceRates=${nothing}
    ...    availableMonths=${nothing}
    ${resp}=    Api Put    ${crew}    /vendor/profile    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Crew Cannot Edit Or Read The Profile Of Another Crew
    [Tags]    security    negative
    ${first}=    Sign In New Crew    ทีมหนึ่ง
    ${second}=    Sign In New Crew    ทีมสอง
    ${read}=    Api Get    ${first}    /vendor/profile    404    workspaceId=${second}[vendor_ws]
    Error Code Should Be    ${read}    not_found
    ${trades}=    Create List    masonry
    ${nothing}=    Create List
    VAR    &{body}    workspaceId=${second}[vendor_ws]    teamName=ยึดทีม    contactName=x    trades=${trades}
    ...    provinces=${nothing}    crewSkilled=${None}    crewLabourers=${None}    tools=${nothing}    vatRegistered=${False}
    ...    referenceRates=${nothing}    availableMonths=${nothing}
    ${put}=    Api Put    ${first}    /vendor/profile    ${body}    404
    Error Code Should Be    ${put}    not_found
    ${row}=    Query Row    select * from sc_vendor_profiles where workspace_id = %s    ${second}[vendor_ws]
    Should Be Equal    ${row}[team_name]    ทีมสอง

Portfolio Item Is Added And Removed
    ${crew}=    Sign In New Crew
    ${nothing}=    Create List
    VAR    &{item}    title=บ้านคุณสมศรี    trade=masonry    year=${2025}    district=บางใหญ่    province=นนทบุรี
    ...    photoFileIds=${nothing}    note=ก่ออิฐ ฉาบเรียบ
    ${created}=    Api Post    ${crew}    /vendor/portfolio?workspaceId=${crew}[vendor_ws]    ${item}    201
    Row Count Should Be    1    select 1 from sc_vendor_portfolio where vendor_workspace_id = %s    ${crew}[vendor_ws]
    Api Delete    ${crew}    /vendor/portfolio/${created.json()}[id]    204
    Row Count Should Be    0    select 1 from sc_vendor_portfolio where vendor_workspace_id = %s    ${crew}[vendor_ws]

Buyer Reads The Card Of A Crew In Its Vendor List
    [Documentation]    GET vendors/:vendorWs/card works only for crews linked to this buyer's list.
    [Tags]    security
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${resp}=    Api Get    ${ctx}[buyer][owner]    /workspaces/${ctx}[buyer][ws]/vendors/${crew}[vendor_ws]/card
    Should Be Equal    ${resp.json()}[teamName]    ทีมช่างที่ 0
    ${other}=    Create Buyer Workspace
    ${denied}=    Api Get    ${other}[owner]    /workspaces/${other}[ws]/vendors/${crew}[vendor_ws]/card    404
    Error Code Should Be    ${denied}    not_found

Crew Question Reaches The Buyer And The Answer Reaches The Crew
    [Documentation]    Q&A: the guest asks through the link, the buyer sees it (with who asked) and answers, and the
    ...    answer shows in the guest view.
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${anon}=    Anonymous Caller
    VAR    &{ask}    question=มีน้ำไฟหน้างานไหม
    ${asked}=    Api Post    ${anon}    /s/${crew}[link_token]/questions    ${ask}    201
    Should Be Equal    ${asked.json()}[question]    มีน้ำไฟหน้างานไหม
    ${seen}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/questions
    Length Should Be    ${seen.json()}    1
    Should Be Equal    ${seen.json()}[0][answer]    ${None}
    VAR    &{answer}    answer=มีทั้งน้ำและไฟ
    ${answered}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/questions/${seen.json()}[0][id]/answer    ${answer}    200
    Should Be Equal    ${answered.json()}[answer]    มีทั้งน้ำและไฟ
    ${guest}=    Api Get    ${anon}    /s/${crew}[link_token]
    Should Be Equal    ${guest.json()}[questions][0][answer]    มีทั้งน้ำและไฟ

Viewer Cannot Answer A Question
    [Tags]    security    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${viewer}=    Add Workspace Member    ${ctx}[buyer]    viewer
    ${anon}=    Anonymous Caller
    VAR    &{ask}    question=ใช้ปูนยี่ห้อไหน
    Api Post    ${anon}    /s/${ctx}[crews][0][link_token]/questions    ${ask}    201
    ${seen}=    Api Get    ${viewer}    /subcontracting/packages/${ctx}[package_id]/questions
    VAR    &{answer}    answer=ปูนนก
    ${resp}=    Api Post    ${viewer}    /subcontracting/questions/${seen.json()}[0][id]/answer    ${answer}    403
    Error Code Should Be    ${resp}    forbidden

Empty Question Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${anon}=    Anonymous Caller
    VAR    &{ask}    question=${EMPTY}
    ${resp}=    Api Post    ${anon}    /s/${ctx}[crews][0][link_token]/questions    ${ask}    400
    Error Code Should Be    ${resp}    validation_failed
