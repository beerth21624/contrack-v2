*** Settings ***
Documentation       Awarding a package (one bid wins all lines or the lines are split), the contract it opens
...                 (SC-<year>-<seq> number from ``sc_contract_counters``), the crew accepting it, cancel and re-award,
...                 and the basic claim path installment -> inspect -> approve -> pay. Double and concurrent award are
...                 refused by the package row lock. API-module1.md "Bidding (C2)" and "Contracts (C3)".
Resource            ../../resources/api.resource
Resource            ../../resources/db.resource
Resource            ../../resources/pages/api_subcontracting.resource
Test Tags           api    subcontracting    award    contract


*** Test Cases ***
Award Opens A Subcontract For The Winning Bid
    [Documentation]    The whole package goes to the 90-baht crew: package awarded, bid selected, the other bid not
    ...    selected, invitations won / lost, and a subcontract waiting for the crew's acceptance whose total equals the
    ...    winning bid.
    [Tags]    smoke
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${winner}=    Set Variable    ${ctx}[bids][1]
    ${loser}=    Set Variable    ${ctx}[bids][0]
    ${resp}=    Award Everything To Bid    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${ctx}[lines]    ${winner}[id]
    Should Be Equal    ${resp.json()}[packageStatus]    awarded
    Length Should Be    ${resp.json()}[subcontractIds]    1
    ${package}=    Package Row    ${ctx}[package_id]
    Should Be Equal    ${package}[status]    awarded
    Should Not Be Equal    ${package}[awarded_at]    ${None}
    ${won}=    Bid Row    ${winner}[id]
    ${lost}=    Bid Row    ${loser}[id]
    Should Be Equal    ${won}[status]    selected
    Should Be Equal    ${lost}[status]    not_selected
    ${won_invitation}=    Invitation Row    ${ctx}[crews][1][invitation_id]
    ${lost_invitation}=    Invitation Row    ${ctx}[crews][0][invitation_id]
    Should Be Equal    ${won_invitation}[status]    won
    Should Be Equal    ${lost_invitation}[status]    lost
    ${contract}=    Subcontract Row    ${resp.json()}[subcontractIds][0]
    Should Be Equal    ${contract}[status]    pending_acceptance
    Numbers Should Be Close    ${contract}[total]    ${winner}[total]    0.01
    Should Be Equal As Strings    ${contract}[vendor_workspace_id]    ${ctx}[crews][1][vendor_ws]
    Should Be Equal As Strings    ${contract}[buyer_workspace_id]    ${ctx}[buyer][ws]
    Should Be Equal As Strings    ${contract}[package_id]    ${ctx}[package_id]
    Should Be Equal As Strings    ${contract}[bid_id]    ${winner}[id]
    Row Count Should Be    1    select 1 from sc_awards where package_id = %s    ${ctx}[package_id]

Contract Total Is The Winning Bid Priced On The Package Lines
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${expected}=    Expected Bid Total    ${ctx}[lines]    ${100}
    ${seen}=    Api Get    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]
    Numbers Should Be Close    ${seen.json()}[total]    ${expected}    0.02
    Numbers Should Be Close    ${seen.json()}[baseTotal]    ${expected}    0.02
    Length Should Be    ${seen.json()}[lines]    ${MASONRY LINES}
    ${line_sum}=    Evaluate    sum(l['total'] for l in $seen.json()['lines'])
    Numbers Should Be Close    ${line_sum}    ${seen.json()}[total]    0.02
    ${installments}=    Evaluate    sum(i['amount'] for i in $seen.json()['installments'])
    Numbers Should Be Close    ${installments}    ${seen.json()}[total]    0.05

Both Sides Read The Contract With Their Own Side Label
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${vendor}=    Api Get    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]
    ${buyer}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]
    Should Be Equal    ${vendor.json()}[viewerSide]    vendor
    Should Be Equal    ${buyer.json()}[viewerSide]    buyer
    Should Be Equal    ${vendor.json()}[status]    pending_acceptance
    Should Be True    ${buyer.json()}[buyerModuleOn]

First Contract Of A Workspace Is Numbered Sc Year 0001
    [Documentation]    contract_no = SC-<year>-<seq padded to 4>, seq from ``sc_contract_counters``.
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${row}=    Subcontract Row    ${contract}[id]
    Should Match Regexp    ${row}[contract_no]    ^SC-\\d{4}-0001$
    Should Be Equal As Integers    ${row}[seq]    1
    ${counter}=    Query Value    select seq from sc_contract_counters where buyer_workspace_id = %s and year = %s
    ...    ${ctx}[buyer][ws]    ${row}[year]
    Should Be Equal As Integers    ${counter}    1

Split Award Opens Two Contracts With Consecutive Numbers
    [Documentation]    First half of the lines to the 100-baht crew and the rest to the 90-baht crew: two contracts,
    ...    numbers ...-0001 and ...-0002, the counter ends at 2, and each total is its lines at its own price.
    [Tags]    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${first_bid}=    Set Variable    ${ctx}[bids][0]
    ${second_bid}=    Set Variable    ${ctx}[bids][1]
    ${allocations}=    Evaluate
    ...    (lambda ls, a, b: [{'idx': l['idx'], 'bidId': a if l['idx'] < 3 else b} for l in ls])($ctx['lines'], $first_bid['id'], $second_bid['id'])
    VAR    &{installments_from}
    VAR    &{body}    allocations=${allocations}    installmentsFrom=${installments_from}    note=แบ่งงาน
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/award    ${body}    200
    Length Should Be    ${resp.json()}[subcontractIds]    2
    Row Count Should Be    2    select 1 from sc_subcontracts where package_id = %s    ${ctx}[package_id]
    ${numbers}=    Query Rows    select contract_no, vendor_workspace_id, total from sc_subcontracts where package_id = %s order by seq
    ...    ${ctx}[package_id]
    Should Match Regexp    ${numbers}[0][contract_no]    ^SC-\\d{4}-0001$
    Should Match Regexp    ${numbers}[1][contract_no]    ^SC-\\d{4}-0002$
    ${counter}=    Query Value    select seq from sc_contract_counters where buyer_workspace_id = %s    ${ctx}[buyer][ws]
    Should Be Equal As Integers    ${counter}    2
    ${head}=    Evaluate    $ctx['lines'][:3]
    ${tail}=    Evaluate    $ctx['lines'][3:]
    ${expected_first}=    Expected Bid Total    ${head}    ${100}
    ${expected_second}=    Expected Bid Total    ${tail}    ${90}
    Numbers Should Be Close    ${numbers}[0][total]    ${expected_first}    0.02
    Numbers Should Be Close    ${numbers}[1][total]    ${expected_second}    0.02

Contract Numbers Are Counted Per Workspace
    [Documentation]    Another buyer's first contract is also ...-0001: the counter is per workspace and year.
    [Tags]    edge
    ${first}=    Set Up Package With Bids    ${{ [100] }}
    ${second}=    Set Up Package With Bids    ${{ [100] }}
    ${a}=    Contract For Package    ${first}
    ${b}=    Contract For Package    ${second}
    ${row_a}=    Subcontract Row    ${a}[id]
    ${row_b}=    Subcontract Row    ${b}[id]
    Should Be Equal    ${row_a}[contract_no]    ${row_b}[contract_no]
    Should Not Be Equal As Strings    ${row_a}[buyer_workspace_id]    ${row_b}[buyer_workspace_id]

Double Award Is Refused And Opens No Second Contract
    [Documentation]    A second award of an awarded package (double click) is 409 package_not_open; still one contract.
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    Contract For Package    ${ctx}    1
    ${again}=    Award Everything To Bid    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${ctx}[lines]    ${ctx}[bids][0][id]    409
    Error Code Should Be    ${again}    conflict
    Should Be Equal    ${again.json()}[details][reason]    package_not_open
    Row Count Should Be    1    select 1 from sc_subcontracts where package_id = %s    ${ctx}[package_id]
    Row Count Should Be    1    select 1 from sc_awards where package_id = %s    ${ctx}[package_id]
    ${first}=    Bid Row    ${ctx}[bids][1][id]
    Should Be Equal    ${first}[status]    selected

Concurrent Award Of The Same Package Opens Exactly One Contract
    [Documentation]    Two awards at the same moment: the package row lock lets one through (200) and refuses the other
    ...    with 409 package_not_open (API-module1.md), never 500, never two contracts. The app answers the loser
    ...    422 (the bids are already selected when it reads them) instead of 409.
    [Tags]    edge    security    bug
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${allocations}=    Evaluate
    ...    (lambda ls, b: [{'idx': l['idx'], 'bidId': b} for l in ls])($ctx['lines'], $ctx['bids'][1]['id'])
    VAR    &{installments_from}
    VAR    &{body}    allocations=${allocations}    installmentsFrom=${installments_from}    note=${EMPTY}
    ${codes}=    Post Concurrently    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/award    ${body}    2
    Should Be Equal    ${codes}    ${{ [200, 409] }}
    Row Count Should Be    1    select 1 from sc_subcontracts where package_id = %s    ${ctx}[package_id]
    Row Count Should Be    1    select 1 from sc_awards where package_id = %s    ${ctx}[package_id]

Award Refuses A Line That Is Not In The Package
    [Tags]    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    VAR    &{allocation}    idx=${99}    bidId=${ctx}[bids][0][id]
    VAR    @{allocations}    ${allocation}
    VAR    &{installments_from}
    VAR    &{body}    allocations=${allocations}    installmentsFrom=${installments_from}    note=${EMPTY}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/award    ${body}    422
    Should Be Equal    ${resp.json()}[details][reason]    unknown_line
    ${package}=    Package Row    ${ctx}[package_id]
    Should Be Equal    ${package}[status]    open

Award Refuses A Line Given To Two Bids
    [Tags]    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${a}=    Evaluate    {'idx': 0, 'bidId': $ctx['bids'][0]['id']}
    ${b}=    Evaluate    {'idx': 0, 'bidId': $ctx['bids'][1]['id']}
    VAR    @{allocations}    ${a}    ${b}
    VAR    &{installments_from}
    VAR    &{body}    allocations=${allocations}    installmentsFrom=${installments_from}    note=${EMPTY}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/award    ${body}    422
    Should Be Equal    ${resp.json()}[details][reason]    duplicate_line

Award Refuses A Bid Id That Does Not Exist
    [Tags]    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${resp}=    Award Everything To Bid    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${ctx}[lines]
    ...    00000000-0000-4000-8000-000000000000    422
    Should Be Equal    ${resp.json()}[details][reason]    bid_not_latest

Award Refuses A Superseded Bid Version
    [Documentation]    Only the latest submitted bid of an invitation can win.
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${old}=    Set Variable    ${ctx}[bids][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${80}
    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    ${resp}=    Award Everything To Bid    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${ctx}[lines]    ${old}[id]    422
    Should Be Equal    ${resp.json()}[details][reason]    bid_not_latest

Award Refuses A Bid Made Before An Addendum
    [Documentation]    422 bid_outdated: the crew must resubmit against the new package version.
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${keys}=    Create List    R179    R180    R181
    VAR    &{material}
    VAR    @{custom}
    VAR    &{addendum}    lineKeys=${keys}    customLines=${custom}    materialByLine=${material}    note=ตัดรายการ
    ${changed}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/addendum    ${addendum}    200
    ${resp}=    Award Everything To Bid    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${changed.json()}[lines]
    ...    ${ctx}[bids][0][id]    422
    Should Be Equal    ${resp.json()}[details][reason]    bid_outdated
    ${package}=    Package Row    ${ctx}[package_id]
    Should Be Equal    ${package}[status]    open

Award Needs At Least One Allocation
    [Tags]    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    VAR    @{none_given}
    VAR    &{installments_from}
    VAR    &{body}    allocations=${none_given}    installmentsFrom=${installments_from}    note=${EMPTY}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/award    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Lump Sum Bid Cannot Win Only Some Lines
    [Documentation]    A lump-sum bid wins all lines or nothing (422 lump_needs_all_lines).
    [Tags]    negative    edge
    ${ctx}=    Set Up Open Package With Crews    1    pricingMode=lump
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${no_lines}=    Create List
    ${body}=    Bid Body    ${ctx}[lines]    ${100}    mode=lump    lines=${no_lines}    lumpTotal=${90000}
    ${bid}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    ${one_line}=    Evaluate    [$ctx['lines'][0]]
    ${resp}=    Award Everything To Bid    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${one_line}    ${bid.json()}[id]    422
    Should Be Equal    ${resp.json()}[details][reason]    lump_needs_all_lines
    ${all}=    Award Everything To Bid    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${ctx}[lines]    ${bid.json()}[id]
    ${contract}=    Subcontract Row    ${all.json()}[subcontractIds][0]
    Should Be Equal As Numbers    ${contract}[total]    90000

Award Uses The Installments Proposed In The Bid When Asked
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${proposal}=    Evaluate    [{'no': 1, 'pct': 0.5, 'condition': 'ก่อเสร็จครึ่งหลัง'}, {'no': 2, 'pct': 0.5, 'condition': 'ส่งมอบ'}]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}    installmentsProposal=${proposal}
    ${bid}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    ${allocations}=    Evaluate
    ...    (lambda ls, b: [{'idx': l['idx'], 'bidId': b} for l in ls])($ctx['lines'], $bid.json()['id'])
    ${bid_id}=    Set Variable    ${bid.json()}[id]
    VAR    &{from}    ${bid_id}=bid
    VAR    &{award}    allocations=${allocations}    installmentsFrom=${from}    note=${EMPTY}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/award    ${award}    200
    ${seen}=    Api Get    ${crew}    /subcontracting/subcontracts/${resp.json()}[subcontractIds][0]
    Length Should Be    ${seen.json()}[installments]    2
    Should Be Equal As Numbers    ${seen.json()}[installments][0][pct]    0.5

Award Cannot Use A Bid Installment Proposal That Was Not Made
    [Tags]    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${allocations}=    Evaluate
    ...    (lambda ls, b: [{'idx': l['idx'], 'bidId': b} for l in ls])($ctx['lines'], $ctx['bids'][0]['id'])
    ${bid_id}=    Set Variable    ${ctx}[bids][0][id]
    VAR    &{from}    ${bid_id}=bid
    VAR    &{award}    allocations=${allocations}    installmentsFrom=${from}    note=${EMPTY}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/award    ${award}    422
    Should Be Equal    ${resp.json()}[details][reason]    no_installments_proposal

Cancelled Package Cannot Be Awarded
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    VAR    &{cancel}    reason=ยกเลิก
    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/cancel    ${cancel}    200
    ${resp}=    Award Everything To Bid    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${ctx}[lines]    ${ctx}[bids][0][id]    409
    Should Be Equal    ${resp.json()}[details][reason]    package_not_open
    Row Count Should Be    0    select 1 from sc_subcontracts where package_id = %s    ${ctx}[package_id]

Awarded Package Cannot Be Cancelled Or Get More Invitations
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    Contract For Package    ${ctx}
    VAR    &{cancel}    reason=เปลี่ยนใจ
    ${cancelled}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/cancel    ${cancel}    409
    Error Code Should Be    ${cancelled}    conflict
    ${entry}=    Add Crew To Vendor List    ${ctx}[buyer][owner]    ${ctx}[buyer][ws]
    ${invite}=    Invite Crews    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${{ [$entry['id']] }}    status=409
    Error Code Should Be    ${invite}    conflict
    ${package}=    Package Row    ${ctx}[package_id]
    Should Be Equal    ${package}[status]    awarded

Crew Who Lost Cannot Bid Any More
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    Contract For Package    ${ctx}    1
    ${loser}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${50}
    ${resp}=    Api Post    ${loser}    /vendor/invitations/${loser}[invitation_id]/bid    ${body}    409
    Error Code Should Be    ${resp}    conflict

Estimator Cannot Award Until The Settings Allow It
    [Documentation]    sc.award belongs to owner and admin; an estimator may award only when the workspace setting
    ...    estimatorCanAward is on.
    [Tags]    security
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${estimator}=    Add Workspace Member    ${ctx}[buyer]    estimator
    ${denied}=    Award Everything To Bid    ${estimator}    ${ctx}[package_id]    ${ctx}[lines]    ${ctx}[bids][0][id]    403
    Error Code Should Be    ${denied}    forbidden
    ${settings}=    Api Get    ${ctx}[buyer][owner]    /workspaces/${ctx}[buyer][ws]/subcontracting/settings
    ${changed}=    Copy Dictionary    ${settings.json()}
    Set To Dictionary    ${changed}    estimatorCanAward=${True}
    Api Put    ${ctx}[buyer][owner]    /workspaces/${ctx}[buyer][ws]/subcontracting/settings    ${changed}    200
    ${allowed}=    Award Everything To Bid    ${estimator}    ${ctx}[package_id]    ${ctx}[lines]    ${ctx}[bids][0][id]
    Should Be Equal    ${allowed.json()}[packageStatus]    awarded

Viewer Stranger And Crew Cannot Award
    [Tags]    security    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${viewer}=    Add Workspace Member    ${ctx}[buyer]    viewer
    ${stranger}=    Create Buyer Workspace
    ${anon}=    Anonymous Caller
    ${as_viewer}=    Award Everything To Bid    ${viewer}    ${ctx}[package_id]    ${ctx}[lines]    ${ctx}[bids][0][id]    403
    Error Code Should Be    ${as_viewer}    forbidden
    ${as_stranger}=    Award Everything To Bid    ${stranger}[owner]    ${ctx}[package_id]    ${ctx}[lines]    ${ctx}[bids][0][id]    404
    Error Code Should Be    ${as_stranger}    not_found
    ${as_crew}=    Award Everything To Bid    ${ctx}[crews][0]    ${ctx}[package_id]    ${ctx}[lines]    ${ctx}[bids][0][id]    404
    Error Code Should Be    ${as_crew}    not_found
    ${as_anon}=    Award Everything To Bid    ${anon}    ${ctx}[package_id]    ${ctx}[lines]    ${ctx}[bids][0][id]    401
    Error Code Should Be    ${as_anon}    unauthenticated
    ${package}=    Package Row    ${ctx}[package_id]
    Should Be Equal    ${package}[status]    open

Award Notifies The Winner And The Losers
    [Documentation]    Winner: sc.outcome_won and sc.contract_to_accept; the other crew: sc.outcome_lost.
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    Contract For Package    ${ctx}    1
    ${winner_notes}=    Api Get    ${ctx}[crews][1]    /notifications
    ${loser_notes}=    Api Get    ${ctx}[crews][0]    /notifications
    ${won}=    Evaluate    [n['template'] for n in $winner_notes.json()['items']]
    ${lost}=    Evaluate    [n['template'] for n in $loser_notes.json()['items']]
    Should Contain    ${won}    sc.outcome_won
    Should Contain    ${won}    sc.contract_to_accept
    Should Contain    ${lost}    sc.outcome_lost
    Should Not Contain    ${lost}    sc.contract_to_accept

Crew Accepts The Contract And It Becomes Active
    [Tags]    smoke
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${resp}=    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    Should Be Equal    ${resp.json()}[status]    active
    Should Not Be Equal    ${resp.json()}[acceptedAt]    ${None}
    ${row}=    Subcontract Row    ${contract}[id]
    Should Be Equal    ${row}[status]    active
    Should Not Be Equal    ${row}[accepted_at]    ${None}
    Should Not Be Equal    ${row}[activated_at]    ${None}
    Should Be Equal As Strings    ${row}[accepted_by]    ${ctx}[crews][0][user_id]
    ${notes}=    Api Get    ${ctx}[buyer][owner]    /notifications
    ${templates}=    Evaluate    [n['template'] for n in $notes.json()['items']]
    Should Contain    ${templates}    sc.contract_accepted

Accepting Twice Is Refused
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    ${again}=    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]    409
    Error Code Should Be    ${again}    conflict

Accepting An Old Document Version Is Refused
    [Documentation]    The buyer edits the contract text (version 2); the crew's accept of version 1 is refused so it
    ...    never signs text it did not see.
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    VAR    &{edit}    html=<p>ข้อสัญญาใหม่ ฉบับแก้ไข</p>
    ${doc}=    Api Put    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]/document    ${edit}    200
    Should Be Equal As Integers    ${doc.json()}[version]    2
    VAR    &{stale}    documentVersion=${1}
    ${resp}=    Api Post    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]/accept    ${stale}    409
    ${row}=    Subcontract Row    ${contract}[id]
    Should Be Equal    ${row}[status]    pending_acceptance
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]

Contract Text Cannot Be Edited After Acceptance
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    VAR    &{edit}    html=<p>แก้ทีหลัง</p>
    ${resp}=    Api Put    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]/document    ${edit}    409
    Error Code Should Be    ${resp}    conflict

Empty Contract Text Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    VAR    &{edit}    html=<p> </p>
    ${resp}=    Api Put    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]/document    ${edit}    422
    Error Code Should Be    ${resp}    unprocessable

Viewer Cannot Edit The Contract Text
    [Tags]    security    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${viewer}=    Add Workspace Member    ${ctx}[buyer]    viewer
    VAR    &{edit}    html=<p>viewer แก้</p>
    ${resp}=    Api Put    ${viewer}    /subcontracting/subcontracts/${contract}[id]/document    ${edit}    403
    Error Code Should Be    ${resp}    forbidden

Buyer Cannot Accept On Behalf Of The Crew
    [Tags]    security    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${resp}=    Vendor Accepts Contract    ${ctx}[buyer][owner]    ${contract}[id]    403
    Error Code Should Be    ${resp}    forbidden
    ${row}=    Subcontract Row    ${contract}[id]
    Should Be Equal    ${row}[status]    pending_acceptance

Another Crew And Another Buyer Cannot Read The Contract
    [Tags]    security    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${contract}=    Contract For Package    ${ctx}    1
    ${stranger}=    Create Buyer Workspace
    ${anon}=    Anonymous Caller
    FOR    ${caller}    IN    ${ctx}[crews][0]    ${stranger}[owner]
        ${resp}=    Api Get    ${caller}    /subcontracting/subcontracts/${contract}[id]    404
        Error Code Should Be    ${resp}    not_found
        ${doc}=    Api Get    ${caller}    /subcontracting/subcontracts/${contract}[id]/document    404
        Error Code Should Be    ${doc}    not_found
    END
    ${resp}=    Api Get    ${anon}    /subcontracting/subcontracts/${contract}[id]    401
    Error Code Should Be    ${resp}    unauthenticated

Losing Crew Has No Contracts In Its List
    [Tags]    security
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${contract}=    Contract For Package    ${ctx}    1
    ${loser}=    Api Get    ${ctx}[crews][0]    /vendor/subcontracts    workspaceId=${ctx}[crews][0][vendor_ws]
    Should Be Empty    ${loser.json()}
    ${winner}=    Api Get    ${ctx}[crews][1]    /vendor/subcontracts    workspaceId=${ctx}[crews][1][vendor_ws]
    Length Should Be    ${winner.json()}    1
    Should Be Equal    ${winner.json()}[0][id]    ${contract}[id]
    Should Be Equal    ${winner.json()}[0][pendingAction]    vendor_accept

Buyer Lists The Contracts Of The Project
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${list}=    Api Get    ${ctx}[buyer][owner]    /projects/${ctx}[buyer][project_id]/subcontracting/subcontracts
    Length Should Be    ${list.json()}    1
    Should Be Equal    ${list.json()}[0][id]    ${contract}[id]
    Numbers Should Be Close    ${list.json()}[0][total]    ${contract}[total]    0.01

Crew Asks For A Change And The Buyer Is Told
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    VAR    &{change}    text=ขอเพิ่มงวดแรกเป็น 40%
    Api Post    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]/request-change    ${change}    200
    Row Count Should Be    1    select 1 from sc_change_requests where subcontract_id = %s    ${contract}[id]
    ${seen}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]
    Should Be Equal    ${seen.json()}[changeRequests][0][text]    ขอเพิ่มงวดแรกเป็น 40%
    Should Not Be True    ${seen.json()}[changeRequests][0][resolved]
    ${notes}=    Api Get    ${ctx}[buyer][owner]    /notifications
    ${templates}=    Evaluate    [n['template'] for n in $notes.json()['items']]
    Should Contain    ${templates}    sc.change_requested

Cancelling A Pending Contract Reopens The Package For A New Award
    [Documentation]    The crew cancels before accepting: contract cancelled, package back to ``reviewing``; the buyer
    ...    awards the other bid and gets contract number 0002.
    [Tags]    edge    smoke
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${first}=    Contract For Package    ${ctx}    1
    VAR    &{reason}    reason=ทีมไม่ว่าง
    ${cancelled}=    Api Post    ${ctx}[crews][1]    /subcontracting/subcontracts/${first}[id]/cancel    ${reason}    200
    Should Be Equal    ${cancelled.json()}[status]    cancelled
    ${package}=    Package Row    ${ctx}[package_id]
    Should Be Equal    ${package}[status]    reviewing
    ${second}=    Contract For Package    ${ctx}    0
    ${row}=    Subcontract Row    ${second}[id]
    Should Match Regexp    ${row}[contract_no]    ^SC-\\d{4}-0002$
    Row Count Should Be    2    select 1 from sc_subcontracts where package_id = %s    ${ctx}[package_id]
    Row Count Should Be    1    select 1 from sc_subcontracts where package_id = %s and status = 'cancelled'    ${ctx}[package_id]

Cancelling Needs A Reason And Only Works Before Acceptance
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    VAR    &{blank}    reason=${EMPTY}
    ${empty}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]/cancel    ${blank}    400
    Error Code Should Be    ${empty}    validation_failed
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    VAR    &{reason}    reason=เปลี่ยนใจ
    ${late}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]/cancel    ${reason}    409
    Error Code Should Be    ${late}    conflict

Buyer Terminates An Active Contract
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    VAR    &{reason}    reason=งานล่าช้าเกินกำหนด
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]/terminate    ${reason}    200
    Should Be Equal    ${resp.json()}[status]    terminated
    ${row}=    Subcontract Row    ${contract}[id]
    Should Be Equal    ${row}[status]    terminated
    Should Be Equal    ${row}[end_reason]    งานล่าช้าเกินกำหนด

Pending Contract Cannot Be Terminated And Crew Cannot Terminate
    [Tags]    negative    security
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    VAR    &{reason}    reason=ลองดู
    ${pending}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]/terminate    ${reason}    409
    Error Code Should Be    ${pending}    conflict
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    ${by_crew}=    Api Post    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]/terminate    ${reason}    403
    Error Code Should Be    ${by_crew}    forbidden
    ${row}=    Subcontract Row    ${contract}[id]
    Should Be Equal    ${row}[status]    active

Claim Cannot Be Requested Before The Contract Is Active
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    VAR    @{photos}
    VAR    &{claim}    installmentNo=${1}    note=${EMPTY}    photoFileIds=${photos}
    ${resp}=    Api Post    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]/claims    ${claim}    409
    Error Code Should Be    ${resp}    conflict
    Row Count Should Be    0    select 1 from sc_claims where subcontract_id = %s    ${contract}[id]

Installment Claim Is Inspected Approved And Paid
    [Documentation]    Happy path: gross = 30% of the contract, retention 5% of the gross, net = gross - retention -
    ...    withholding + VAT; paid claim in ``sc_claims``, retention withheld in ``sc_retention_entries``.
    [Tags]    smoke
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${active}=    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    ${total}=    Set Variable    ${active.json()}[total]
    VAR    @{photos}
    VAR    &{claim}    installmentNo=${1}    note=ก่ออิฐเสร็จ    photoFileIds=${photos}
    ${requested}=    Api Post    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]/claims    ${claim}    201
    Should Be Equal    ${requested.json()}[status]    requested
    ${paid}=    Claim Is Paid Through The Buyer    ${ctx}[buyer][owner]    ${requested.json()}[id]
    Should Be Equal    ${paid}[status]    paid
    ${gross}=    Evaluate    round($total * 0.3 + 1e-9, 2)
    ${retention}=    Evaluate    round($gross * 0.05 + 1e-9, 2)
    Numbers Should Be Close    ${paid}[amounts][gross]    ${gross}    0.02
    Numbers Should Be Close    ${paid}[amounts][retention]    ${retention}    0.02
    ${net}=    Evaluate    $paid['amounts']['gross'] - $paid['amounts']['retention'] - $paid['amounts']['wht'] + $paid['amounts']['vat']
    Numbers Should Be Close    ${paid}[amounts][net]    ${net}    0.02
    ${row}=    Query Row    select * from sc_claims where id = %s    ${requested.json()}[id]
    Should Be Equal    ${row}[status]    paid
    Should Be Equal As Integers    ${row}[installment_no]    1
    Numbers Should Be Close    ${row}[gross_amount]    ${gross}    0.02
    Numbers Should Be Close    ${row}[paid_amount]    ${paid}[amounts][net]    0.01
    ${after}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]
    Numbers Should Be Close    ${after.json()}[paidTotal]    ${paid}[amounts][net]    0.01
    Numbers Should Be Close    ${after.json()}[retention][balance]    ${paid}[amounts][retention]    0.01
    ${withheld}=    Query Value    select coalesce(sum(amount), 0) from sc_retention_entries where subcontract_id = %s and kind = 'withheld'
    ...    ${contract}[id]
    Numbers Should Be Close    ${withheld}    ${paid}[amounts][retention]    0.01

Same Installment Cannot Be Claimed Twice
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    VAR    @{photos}
    VAR    &{claim}    installmentNo=${1}    note=${EMPTY}    photoFileIds=${photos}
    Api Post    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]/claims    ${claim}    201
    ${again}=    Api Post    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]/claims    ${claim}    409
    Error Code Should Be    ${again}    conflict
    Row Count Should Be    1    select 1 from sc_claims where subcontract_id = %s    ${contract}[id]

Claim Of An Installment That Does Not Exist Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    VAR    @{photos}
    VAR    &{claim}    installmentNo=${9}    note=${EMPTY}    photoFileIds=${photos}
    ${resp}=    Api Post    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]/claims    ${claim}    422
    Error Code Should Be    ${resp}    unprocessable

Crew Cannot Inspect Approve Or Pay Its Own Claim
    [Tags]    security    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${crew}=    Set Variable    ${ctx}[crews][0]
    Vendor Accepts Contract    ${crew}    ${contract}[id]
    VAR    @{photos}
    VAR    &{claim}    installmentNo=${1}    note=${EMPTY}    photoFileIds=${photos}
    ${requested}=    Api Post    ${crew}    /subcontracting/subcontracts/${contract}[id]/claims    ${claim}    201
    VAR    @{checklist}
    VAR    @{fixes}
    VAR    &{inspect}    result=pass    checklist=${checklist}    fixes=${fixes}    note=${EMPTY}
    ${inspected}=    Api Post    ${crew}    /subcontracting/claims/${requested.json()}[id]/inspect    ${inspect}    403
    Error Code Should Be    ${inspected}    forbidden
    VAR    @{adjustments}
    VAR    &{approve}    adjustments=${adjustments}
    ${approved}=    Api Post    ${crew}    /subcontracting/claims/${requested.json()}[id]/approve    ${approve}    403
    Error Code Should Be    ${approved}    forbidden
    ${row}=    Query Row    select * from sc_claims where id = %s    ${requested.json()}[id]
    Should Be Equal    ${row}[status]    requested

Approving Before Inspection Is Refused
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    VAR    @{photos}
    VAR    &{claim}    installmentNo=${1}    note=${EMPTY}    photoFileIds=${photos}
    ${requested}=    Api Post    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]/claims    ${claim}    201
    VAR    @{adjustments}
    VAR    &{approve}    adjustments=${adjustments}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/claims/${requested.json()}[id]/approve    ${approve}    409
    Error Code Should Be    ${resp}    conflict
    ${row}=    Query Row    select * from sc_claims where id = %s    ${requested.json()}[id]
    Should Be Equal    ${row}[status]    requested

Estimator Can Inspect But Cannot Approve A Claim
    [Tags]    security
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    ${estimator}=    Add Workspace Member    ${ctx}[buyer]    estimator
    VAR    @{photos}
    VAR    &{claim}    installmentNo=${1}    note=${EMPTY}    photoFileIds=${photos}
    ${requested}=    Api Post    ${ctx}[crews][0]    /subcontracting/subcontracts/${contract}[id]/claims    ${claim}    201
    VAR    @{checklist}
    VAR    @{fixes}
    VAR    &{inspect}    result=pass    checklist=${checklist}    fixes=${fixes}    note=${EMPTY}
    Api Post    ${estimator}    /subcontracting/claims/${requested.json()}[id]/inspect    ${inspect}    200
    VAR    @{adjustments}
    VAR    &{approve}    adjustments=${adjustments}
    ${denied}=    Api Post    ${estimator}    /subcontracting/claims/${requested.json()}[id]/approve    ${approve}    403
    Error Code Should Be    ${denied}    forbidden

Contract Cannot Complete While Installments Are Unpaid
    [Tags]    negative    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]/complete    ${None}    409
    Should Be Equal    ${resp.json()}[details][reason]    installments_unpaid

All Installments Paid Completes The Contract And Retention Blocks Closing
    [Documentation]    Three installments claimed, inspected, approved and paid -> complete (200). Closing while retention
    ...    is still held is 409 retention_held.
    [Tags]    slow    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${crew}=    Set Variable    ${ctx}[crews][0]
    Vendor Accepts Contract    ${crew}    ${contract}[id]
    FOR    ${no}    IN RANGE    1    4
        VAR    @{photos}
        VAR    &{claim}    installmentNo=${no}    note=งวด ${no}    photoFileIds=${photos}
        ${requested}=    Api Post    ${crew}    /subcontracting/subcontracts/${contract}[id]/claims    ${claim}    201
        Claim Is Paid Through The Buyer    ${ctx}[buyer][owner]    ${requested.json()}[id]
    END
    ${done}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]/complete    ${None}    200
    Should Be Equal    ${done.json()}[status]    completed
    ${row}=    Subcontract Row    ${contract}[id]
    Should Be Equal    ${row}[status]    completed
    ${close}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]/close    ${None}    409
    Should Be Equal    ${close.json()}[details][reason]    retention_held

Overview Shows The Trade As Contracted And The Report Matches The Contract
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${overview}=    Api Get    ${ctx}[buyer][owner]    /projects/${ctx}[buyer][project_id]/subcontracting/overview
    ${masonry}=    Evaluate    [t for t in $overview.json()['trades'] if t['trade'] == 'masonry'][0]
    Should Be Equal    ${masonry}[status]    contracted
    Numbers Should Be Close    ${masonry}[contracted]    ${contract}[total]    0.01
    ${report}=    Api Get    ${ctx}[buyer][owner]    /projects/${ctx}[buyer][project_id]/subcontracting/report
    Numbers Should Be Close    ${report.json()}[totals][contracted]    ${contract}[total]    0.01

Viewer Cannot Read The Procurement Report
    [Tags]    security
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    Contract For Package    ${ctx}
    ${viewer}=    Add Workspace Member    ${ctx}[buyer]    viewer
    ${resp}=    Api Get    ${viewer}    /projects/${ctx}[buyer][project_id]/subcontracting/report    403
    Error Code Should Be    ${resp}    forbidden
    ${overview}=    Api Get    ${viewer}    /projects/${ctx}[buyer][project_id]/subcontracting/overview
    ${masonry}=    Evaluate    [t for t in $overview.json()['trades'] if t['trade'] == 'masonry'][0]
    Should Be Equal As Numbers    ${masonry}[estimate]    0
