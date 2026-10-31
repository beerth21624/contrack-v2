*** Settings ***
Documentation       Work packages (แพ็กเกจงาน) of the subcontracting module over HTTP: BOQ rows become a package,
...                 drafts are edited, sending opens it for bids (the invitation sends a draft), later changes go
...                 through an addendum (``sc_package_versions``), deadlines extend, packages cancel.
...                 Plan: docs/marketplace/01-module1-subcontracting-plan.md §4.3, API: docs/marketplace/API-module1.md.
Resource            ../../resources/api.resource
Resource            ../../resources/db.resource
Resource            ../../resources/pages/api_subcontracting.resource
Test Tags           api    subcontracting    packages


*** Test Cases ***
Package Is Created As Draft From Boq Rows
    [Documentation]    Masonry rows of the sample project become a draft package: version 1, status draft, one line per
    ...    row in BOQ order, and the row is in ``sc_work_packages`` for the buyer workspace and project.
    [Tags]    smoke
    ${buyer}=    Create Buyer Workspace
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${pkg}=    Set Variable    ${resp.json()}
    Should Be Equal    ${pkg}[status]    draft
    Should Be Equal As Integers    ${pkg}[version]    1
    Length Should Be    ${pkg}[lines]    ${MASONRY LINES}
    Should Be Equal    ${pkg}[lines][0][lineKey]    R179
    ${row}=    Package Row    ${pkg}[id]
    Should Be Equal    ${row}[status]    draft
    Should Be Equal As Strings    ${row}[buyer_workspace_id]    ${buyer}[ws]
    Should Be Equal As Strings    ${row}[project_id]    ${buyer}[project_id]
    Should Be Equal    ${row}[trade]    masonry
    Should Be Equal    ${row}[sourcing_mode]    rfq

Package Lines Are Numbered From Zero And Follow The Boq Order
    ${buyer}=    Create Buyer Workspace
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${keys}=    Evaluate    [l['lineKey'] for l in $resp.json()['lines']]
    ${idxs}=    Evaluate    [l['idx'] for l in $resp.json()['lines']]
    Should Be Equal    ${keys}    ${MASONRY KEYS}
    ${expected}=    Evaluate    list(range(len($keys)))
    Should Be Equal    ${idxs}    ${expected}

Package Estimate Is The Sum Of Its Line Estimates
    [Documentation]    estimateTotal (Σ labour unit x priced quantity) equals the sum of the line estimates.
    ${buyer}=    Create Buyer Workspace
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${sum}=    Evaluate    sum(l['estTotal'] for l in $resp.json()['lines'])
    Numbers Should Be Close    ${resp.json()}[estimateTotal]    ${sum}    0.05
    Should Be True    ${resp.json()}[estimateTotal] > 0
    ${row}=    Package Row    ${resp.json()}[id]
    Numbers Should Be Close    ${row}[estimate_total]    ${resp.json()}[estimateTotal]    0.01

Every Line Is Frozen Into Package Version One
    ${buyer}=    Create Buyer Workspace
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    Row Count Should Be    1    select 1 from sc_package_versions where package_id = %s    ${resp.json()}[id]
    ${lines}=    Query Value    select jsonb_array_length(lines::jsonb) from sc_package_versions where package_id = %s
    ...    ${resp.json()}[id]
    Should Be Equal As Integers    ${lines}    ${MASONRY LINES}

Duplicate Row Keys In One Request Make One Line
    [Documentation]    The same BOQ key twice in lineKeys is de-duplicated, not priced twice.
    ${buyer}=    Create Buyer Workspace
    ${keys}=    Create List    R179    R179    R180
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    line_keys=${keys}
    Length Should Be    ${resp.json()}[lines]    2

Package Can Hold Only Typed Custom Lines
    ${buyer}=    Create Buyer Workspace
    ${custom}=    Evaluate    [{'desc': 'งานรื้อถอนผนังเดิม', 'unit': 'ตร.ม.', 'qty': 12.5, 'estUnit': 80}]
    ${no_keys}=    Create List
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    line_keys=${no_keys}
    ...    customLines=${custom}
    Length Should Be    ${resp.json()}[lines]    1
    Should Be Equal    ${resp.json()}[lines][0][desc]    งานรื้อถอนผนังเดิม
    Should Be Equal    ${resp.json()}[lines][0][lineKey]    ${None}
    Numbers Should Be Close    ${resp.json()}[estimateTotal]    1000

Package Can Mix Boq Rows And Custom Lines
    ${buyer}=    Create Buyer Workspace
    ${custom}=    Evaluate    [{'desc': 'ค่าขนเศษวัสดุ', 'unit': 'เหมา', 'qty': 1, 'estUnit': 3000}]
    ${keys}=    Create List    R179    R180
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    line_keys=${keys}
    ...    customLines=${custom}
    Length Should Be    ${resp.json()}[lines]    3
    Should Be Equal    ${resp.json()}[lines][2][lineKey]    ${None}

Package Without Any Line Is Refused
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace
    ${no_keys}=    Create List
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    400    line_keys=${no_keys}
    Error Code Should Be    ${resp}    validation_failed
    Row Count Should Be    0    select 1 from sc_work_packages where buyer_workspace_id = %s    ${buyer}[ws]

Unknown Boq Row Key Is Refused With The Key Listed
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace
    ${keys}=    Create List    R179    no-such-row
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    422    line_keys=${keys}
    Error Code Should Be    ${resp}    unprocessable
    Should Contain    ${resp.json()}[details][unknownKeys]    no-such-row
    Row Count Should Be    0    select 1 from sc_work_packages where buyer_workspace_id = %s    ${buyer}[ws]

Open Sourcing Board Is Not Available Yet
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    422    sourcingMode=open
    Error Code Should Be    ${resp}    unprocessable

Package Request Field Validation Is Strict
    [Documentation]    Bad request fields are refused with 400 validation_failed and nothing is stored.
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace
    ${bad_installments}=    Evaluate    [{'no': 1, 'pct': 0.5, 'condition': 'a'}, {'no': 2, 'pct': 0.4, 'condition': 'b'}]
    ${skipped_no}=    Evaluate    [{'no': 1, 'pct': 0.5, 'condition': 'a'}, {'no': 3, 'pct': 0.5, 'condition': 'b'}]
    ${terms}=    Evaluate    {'retentionPct': 0.5, 'warrantyMonths': 12, 'penalty': {'kind': 'none'}, 'provisions': {'water': 'buyer', 'power': 'buyer', 'lodging': 'buyer', 'scaffolding': 'buyer'}, 'safetyNote': '', 'questions': []}
    FOR    ${field}    ${value}    IN
    ...    title    ${EMPTY}
    ...    trade    plumber
    ...    installments    ${bad_installments}
    ...    installments    ${skipped_no}
    ...    terms    ${terms}
    ...    supplyMode    free
    ...    bidDeadline    tomorrow
    ...    pricingMode    barter
        ${override}=    Create Dictionary    ${field}    ${value}
        ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    400    &{override}
        Error Code Should Be    ${resp}    validation_failed
    END
    Row Count Should Be    0    select 1 from sc_work_packages where buyer_workspace_id = %s    ${buyer}[ws]

Row Already In A Live Package Cannot Join Another
    [Documentation]    A BOQ line in another live package of the project is refused with 409 and the line keys.
    [Tags]    negative    edge
    ${buyer}=    Create Buyer Workspace
    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${keys}=    Create List    R180    R200
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    409    line_keys=${keys}
    Error Code Should Be    ${resp}    conflict
    Should Be Equal    ${resp.json()}[details][lineKeys]    ${{ ['R180'] }}

Same Rows Can Be Packaged In Another Project Of The Workspace
    [Documentation]    The row lock is per project: the same BOQ keys in a second project are free.
    ${buyer}=    Create Buyer Workspace
    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${other}=    Create Project Via API    ${buyer}[owner]    ${buyer}[ws]    start=sample
    Create Package Via API    ${buyer}[owner]    ${other}[project][id]

Rows Are Free Again After The Package Is Cancelled
    [Documentation]    Cancelling the first package releases its BOQ lines for a new package.
    [Tags]    edge
    ${buyer}=    Create Buyer Workspace
    ${first}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    VAR    &{cancel}    reason=ไม่ใช้แล้ว
    Api Post    ${buyer}[owner]    /subcontracting/packages/${first.json()}[id]/cancel    ${cancel}    200
    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]

Another Workspace Cannot Create A Package In My Project
    [Documentation]    A user who is not a member of the project's workspace gets 404 (the project is not revealed).
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace
    ${stranger}=    Create Buyer Workspace
    ${resp}=    Create Package Via API    ${stranger}[owner]    ${buyer}[project_id]    404
    Error Code Should Be    ${resp}    not_found
    Row Count Should Be    0    select 1 from sc_work_packages where buyer_workspace_id = %s    ${buyer}[ws]

Estimator Can Create A Package And Viewer Cannot
    [Documentation]    sc.packages.manage: owner, admin and estimator have it; viewer has not (403).
    [Tags]    security
    ${buyer}=    Create Buyer Workspace
    ${estimator}=    Add Workspace Member    ${buyer}    estimator
    ${viewer}=    Add Workspace Member    ${buyer}    viewer
    ${denied}=    Create Package Via API    ${viewer}    ${buyer}[project_id]    403
    Error Code Should Be    ${denied}    forbidden
    ${keys}=    Create List    R179
    Create Package Via API    ${estimator}    ${buyer}[project_id]    line_keys=${keys}

Viewer Reads Packages Without Estimates
    [Documentation]    A viewer has sc.read but not sc.readPrices (setting viewerSeesPrices is off by default): the
    ...    package is readable and its estimate shows 0.
    [Tags]    security
    ${buyer}=    Create Buyer Workspace
    ${viewer}=    Add Workspace Member    ${buyer}    viewer
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${seen}=    Api Get    ${viewer}    /subcontracting/packages/${created.json()}[id]
    Should Be Equal As Numbers    ${seen.json()}[estimateTotal]    0
    ${list}=    Api Get    ${viewer}    /projects/${buyer}[project_id]/subcontracting/packages
    Length Should Be    ${list.json()}    1
    Should Be Equal As Numbers    ${list.json()}[0][estimateTotal]    0

Package List Of A Project Shows Its Packages
    ${buyer}=    Create Buyer Workspace
    ${first}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${keys}=    Create List    R199    R200
    ${second}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    line_keys=${keys}
    ...    trade=ceiling
    ${list}=    Api Get    ${buyer}[owner]    /projects/${buyer}[project_id]/subcontracting/packages
    ${ids}=    Evaluate    sorted(p['id'] for p in $list.json())
    ${expected}=    Evaluate    sorted([$first.json()['id'], $second.json()['id']])
    Should Be Equal    ${ids}    ${expected}

Another Workspace Cannot Read My Package
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace
    ${stranger}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${resp}=    Api Get    ${stranger}[owner]    /subcontracting/packages/${created.json()}[id]    404
    Error Code Should Be    ${resp}    not_found
    ${listing}=    Api Get    ${stranger}[owner]    /projects/${buyer}[project_id]/subcontracting/packages    404
    Error Code Should Be    ${listing}    not_found

Anonymous Caller Cannot Read A Package
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${anon}=    Anonymous Caller
    ${resp}=    Api Get    ${anon}    /subcontracting/packages/${created.json()}[id]    401
    Error Code Should Be    ${resp}    unauthenticated

Draft Package Title And Description Can Be Edited
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    VAR    &{patch}    title=ก่ออิฐชั้น 1    description=แก้ไขรายละเอียด
    ${resp}=    Api Patch    ${buyer}[owner]    /subcontracting/packages/${created.json()}[id]    ${patch}
    Should Be Equal    ${resp.json()}[title]    ก่ออิฐชั้น 1
    ${row}=    Package Row    ${created.json()}[id]
    Should Be Equal    ${row}[title]    ก่ออิฐชั้น 1
    Should Be Equal    ${row}[description]    แก้ไขรายละเอียด

Draft Package Lines Are Re-Snapshotted When The Selection Changes
    [Documentation]    Editing the lines of a draft replaces version 1 (no extra version row) and updates the estimate.
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${keys}=    Create List    R179    R180
    VAR    &{patch}    lineKeys=${keys}
    ${resp}=    Api Patch    ${buyer}[owner]    /subcontracting/packages/${created.json()}[id]    ${patch}
    Length Should Be    ${resp.json()}[lines]    2
    Should Be True    ${resp.json()}[estimateTotal] < ${created.json()}[estimateTotal]
    Row Count Should Be    1    select 1 from sc_package_versions where package_id = %s    ${created.json()}[id]
    ${lines}=    Query Value    select jsonb_array_length(lines::jsonb) from sc_package_versions where package_id = %s
    ...    ${created.json()}[id]
    Should Be Equal As Integers    ${lines}    2

Draft Cannot Be Edited To The Open Board
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    VAR    &{patch}    sourcingMode=open
    ${resp}=    Api Patch    ${buyer}[owner]    /subcontracting/packages/${created.json()}[id]    ${patch}    422
    Error Code Should Be    ${resp}    unprocessable

Viewer Cannot Edit A Draft Package
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace
    ${viewer}=    Add Workspace Member    ${buyer}    viewer
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    VAR    &{patch}    title=แก้โดย viewer
    ${resp}=    Api Patch    ${viewer}    /subcontracting/packages/${created.json()}[id]    ${patch}    403
    Error Code Should Be    ${resp}    forbidden
    ${row}=    Package Row    ${created.json()}[id]
    Should Not Be Equal    ${row}[title]    แก้โดย viewer

Draft Package Can Be Deleted With Its Version Rows
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    Api Delete    ${buyer}[owner]    /subcontracting/packages/${created.json()}[id]    204
    Row Count Should Be    0    select 1 from sc_work_packages where id = %s    ${created.json()}[id]
    Row Count Should Be    0    select 1 from sc_package_versions where package_id = %s    ${created.json()}[id]
    Api Get    ${buyer}[owner]    /subcontracting/packages/${created.json()}[id]    404

Sent Package Cannot Be Deleted
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$entry['id']] }}
    ${resp}=    Api Delete    ${buyer}[owner]    /subcontracting/packages/${created.json()}[id]    409
    Error Code Should Be    ${resp}    conflict
    Row Count Should Be    1    select 1 from sc_work_packages where id = %s    ${created.json()}[id]

Inviting A Crew Sends The Draft And Opens It For Bids
    [Documentation]    The first invitation sends the package: status open, sentAt set, version stays 1.
    [Tags]    smoke
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$entry['id']] }}
    ${seen}=    Api Get    ${buyer}[owner]    /subcontracting/packages/${created.json()}[id]
    Should Be Equal    ${seen.json()}[status]    open
    Should Be Equal As Integers    ${seen.json()}[version]    1
    Should Not Be Equal    ${seen.json()}[sentAt]    ${None}
    ${row}=    Package Row    ${created.json()}[id]
    Should Be Equal    ${row}[status]    open
    Should Not Be Equal    ${row}[sent_at]    ${None}

Sending After The Deadline Is Refused
    [Documentation]    A draft whose bid deadline is already past cannot be sent (422); it stays a draft.
    [Tags]    negative    edge
    ${buyer}=    Create Buyer Workspace
    ${past}=    Future Deadline    -1
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    bidDeadline=${past}
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${resp}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$entry['id']] }}    status=422
    Error Code Should Be    ${resp}    unprocessable
    ${row}=    Package Row    ${created.json()}[id]
    Should Be Equal    ${row}[status]    draft
    Row Count Should Be    0    select 1 from sc_invitations where package_id = %s    ${created.json()}[id]

After Sending Only Description And A Later Deadline Can Change
    [Tags]    edge
    ${ctx}=    Set Up Open Package With Crews    1
    ${id}=    Set Variable    ${ctx}[package_id]
    VAR    &{title}    title=ชื่อใหม่
    ${refused}=    Api Patch    ${ctx}[buyer][owner]    /subcontracting/packages/${id}    ${title}    422
    Error Code Should Be    ${refused}    unprocessable
    ${later}=    Future Deadline    14
    VAR    &{patch}    description=ขยายเวลา    bidDeadline=${later}
    ${resp}=    Api Patch    ${ctx}[buyer][owner]    /subcontracting/packages/${id}    ${patch}
    Should Be Equal    ${resp.json()}[description]    ขยายเวลา
    Should Be Equal    ${resp.json()}[bidDeadline]    ${later}

Earlier Deadline Is Refused After Sending
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${earlier}=    Future Deadline    2
    VAR    &{body}    bidDeadline=${earlier}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/extend    ${body}    422
    Error Code Should Be    ${resp}    unprocessable

Deadline Can Be Extended To A Later Time
    ${ctx}=    Set Up Open Package With Crews    1
    ${later}=    Future Deadline    20
    VAR    &{body}    bidDeadline=${later}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/extend    ${body}    200
    Should Be Equal    ${resp.json()}[bidDeadline]    ${later}
    Should Be Equal    ${resp.json()}[status]    open

Extending A Draft Is Refused
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${later}=    Future Deadline    30
    VAR    &{body}    bidDeadline=${later}
    ${resp}=    Api Post    ${buyer}[owner]    /subcontracting/packages/${created.json()}[id]/extend    ${body}    409
    Error Code Should Be    ${resp}    conflict

Addendum Creates Version Two And Keeps Version One
    [Documentation]    An addendum on a sent package: version 2, the changed lines listed, both versions stored in
    ...    ``sc_package_versions``, status unchanged.
    ${ctx}=    Set Up Open Package With Crews    1
    ${keys}=    Create List    R179    R180    R181
    VAR    &{material}
    VAR    @{custom}
    VAR    &{body}    lineKeys=${keys}    customLines=${custom}    materialByLine=${material}    note=ลดรายการก่ออิฐ
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/addendum    ${body}    200
    Should Be Equal As Integers    ${resp.json()}[version]    2
    Length Should Be    ${resp.json()}[lines]    3
    Should Be Equal    ${resp.json()}[status]    open
    Row Count Should Be    2    select 1 from sc_package_versions where package_id = %s    ${ctx}[package_id]
    ${row}=    Package Row    ${ctx}[package_id]
    Should Be Equal As Integers    ${row}[version]    2
    ${v1}=    Query Value    select jsonb_array_length(lines::jsonb) from sc_package_versions where package_id = %s and version = 1
    ...    ${ctx}[package_id]
    Should Be Equal As Integers    ${v1}    ${MASONRY LINES}

Addendum On A Draft Is Refused
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    ${keys}=    Create List    R179
    VAR    &{material}
    VAR    @{custom}
    VAR    &{body}    lineKeys=${keys}    customLines=${custom}    materialByLine=${material}    note=x
    ${resp}=    Api Post    ${buyer}[owner]    /subcontracting/packages/${created.json()}[id]/addendum    ${body}    409
    Error Code Should Be    ${resp}    conflict

Addendum Without A Note Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${keys}=    Create List    R179
    VAR    &{material}
    VAR    @{custom}
    VAR    &{body}    lineKeys=${keys}    customLines=${custom}    materialByLine=${material}    note=${EMPTY}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/addendum    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Cancel Stores The Reason And Status
    ${ctx}=    Set Up Open Package With Crews    1
    VAR    &{body}    reason=เจ้าของงานเลื่อนโครงการ
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/cancel    ${body}    200
    Should Be Equal    ${resp.json()}[status]    cancelled
    Should Be Equal    ${resp.json()}[cancelReason]    เจ้าของงานเลื่อนโครงการ
    ${row}=    Package Row    ${ctx}[package_id]
    Should Be Equal    ${row}[status]    cancelled
    Should Be Equal    ${row}[cancel_reason]    เจ้าของงานเลื่อนโครงการ
    Should Not Be Equal    ${row}[cancelled_at]    ${None}

Cancelling Twice Is Refused
    [Tags]    negative    edge
    ${ctx}=    Set Up Open Package With Crews    1
    VAR    &{body}    reason=ยกเลิก
    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/cancel    ${body}    200
    ${again}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/cancel    ${body}    409
    Error Code Should Be    ${again}    conflict

Cancel Needs A Reason
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    VAR    &{body}    reason=${EMPTY}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/cancel    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Cancelled Package Accepts No New Invitation And No Deadline Change
    [Tags]    negative    edge
    ${ctx}=    Set Up Open Package With Crews    1
    VAR    &{body}    reason=ยกเลิก
    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/cancel    ${body}    200
    ${entry}=    Add Crew To Vendor List    ${ctx}[buyer][owner]    ${ctx}[buyer][ws]
    ${invite}=    Invite Crews    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${{ [$entry['id']] }}    status=409
    Error Code Should Be    ${invite}    conflict
    ${later}=    Future Deadline    30
    VAR    &{extend}    bidDeadline=${later}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/extend    ${extend}    409
    Error Code Should Be    ${resp}    conflict

Cancelling A Package Closes It For The Crew
    [Documentation]    After the buyer cancels, the invited crew sees the package as cancelled and cannot bid.
    [Tags]    edge
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    VAR    &{cancel}    reason=ยกเลิก
    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/cancel    ${cancel}    200
    ${seen}=    Api Get    ${crew}    /vendor/invitations/${crew}[invitation_id]
    Should Be Equal    ${seen.json()}[packageStatus]    cancelled
    ${body}=    Bid Body    ${ctx}[lines]
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    409
    Error Code Should Be    ${resp}    conflict

Direct Package Takes Exactly One Crew
    [Documentation]    sourcingMode direct = exactly one invitee in total (a second one is refused 422).
    [Tags]    edge
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    sourcingMode=direct
    ${first}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${second}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${two}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$first['id'], $second['id']] }}    status=422
    Error Code Should Be    ${two}    unprocessable
    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$first['id']] }}
    ${more}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${{ [$second['id']] }}    status=422
    Error Code Should Be    ${more}    unprocessable

Rfq Package Takes At Most Eight Crews
    [Tags]    edge
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    @{ids}=    Create List
    FOR    ${n}    IN RANGE    9
        ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
        Append To List    ${ids}    ${entry}[id]
    END
    ${nine}=    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${ids}    status=422
    Error Code Should Be    ${nine}    unprocessable
    ${eight}=    Get Slice From List    ${ids}    0    8
    Invite Crews    ${buyer}[owner]    ${created.json()}[id]    ${eight}
    Row Count Should Be    8    select 1 from sc_invitations where package_id = %s    ${created.json()}[id]

Procurement Overview Lists The Package Under Its Trade
    ${ctx}=    Set Up Open Package With Crews    1
    ${resp}=    Api Get    ${ctx}[buyer][owner]    /projects/${ctx}[buyer][project_id]/subcontracting/overview
    ${masonry}=    Evaluate    [t for t in $resp.json()['trades'] if t['trade'] == 'masonry'][0]
    Should Be Equal    ${masonry}[status]    waiting_bids
    ${ids}=    Evaluate    [p['id'] for p in $masonry['packages']]
    Should Contain    ${ids}    ${ctx}[package_id]
