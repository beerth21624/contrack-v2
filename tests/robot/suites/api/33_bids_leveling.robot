*** Settings ***
Documentation       Crews bid on a package (prices per BOQ row, totals), draft and resubmit, withdraw, wrong-actor and
...                 bad-input cases, and the buyer's leveling (เปรียบเทียบราคา): every number on the comparison is
...                 recomputed here from the bid rows. Questions to the buyer and negotiation messages.
...                 API-module1.md "Bidding (C2)"; pricing policy backend/src/modules/subcontracting/bidding/domain/policies.
Resource            ../../resources/api.resource
Resource            ../../resources/db.resource
Resource            ../../resources/pages/api_subcontracting.resource
Test Tags           api    subcontracting    bids


*** Test Cases ***
Crew Submits A Bid And The Total Is The Sum Of The Line Prices
    [Documentation]    Unit prices of 100 baht on every masonry row: bid total = Σ round(100 x priced qty, 2), stored in
    ...    ``sc_bids`` as submitted version 1, and the invitation turns ``submitted``.
    [Tags]    smoke
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    ${expected}=    Expected Bid Total    ${ctx}[lines]    ${100}
    Numbers Should Be Close    ${resp.json()}[total]    ${expected}    0.02
    Should Be Equal    ${resp.json()}[status]    submitted
    Should Be Equal As Integers    ${resp.json()}[version]    1
    ${row}=    Bid Row    ${resp.json()}[id]
    Should Be Equal    ${row}[status]    submitted
    Should Be Equal As Integers    ${row}[version]    1
    Should Be Equal    ${row}[mode]    unit
    Numbers Should Be Close    ${row}[total]    ${expected}    0.02
    Should Be Equal As Strings    ${row}[vendor_workspace_id]    ${crew}[vendor_ws]
    Should Be Equal As Strings    ${row}[package_id]    ${ctx}[package_id]
    ${invitation}=    Invitation Row    ${crew}[invitation_id]
    Should Be Equal    ${invitation}[status]    submitted

Each Line Total Is The Unit Price Times The Priced Quantity
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${37.5}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    FOR    ${line}    ${bid_line}    IN ZIP    ${ctx}[lines]    ${resp.json()}[lines]
        ${expected}=    Expected Bid Total    ${{ [$line] }}    ${37.5}
        Numbers Should Be Close    ${bid_line}[total]    ${expected}    0.01
        Should Be Equal As Integers    ${bid_line}[idx]    ${line}[idx]
    END

Bid Adjustment Is Added To The Total
    [Documentation]    A negative adjustment is a discount on the whole bid.
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}    adjustment=${-1000}    adjustmentNote=ส่วนลดงานเยอะ
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    ${expected}=    Expected Bid Total    ${ctx}[lines]    ${100}
    Numbers Should Be Close    ${resp.json()}[total]    ${expected - 1000}    0.02
    Should Be Equal As Numbers    ${resp.json()}[adjustment]    -1000

Resubmitting Makes Version Two And Supersedes Version One
    [Documentation]    Bids are immutable: a new submit is a new version; the earlier row turns ``superseded``.
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body1}=    Bid Body    ${ctx}[lines]    ${100}
    ${one}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body1}    201
    ${body2}=    Bid Body    ${ctx}[lines]    ${90}
    ${two}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body2}    201
    Should Be Equal As Integers    ${two.json()}[version]    2
    ${old}=    Bid Row    ${one.json()}[id]
    Should Be Equal    ${old}[status]    superseded
    ${new}=    Bid Row    ${two.json()}[id]
    Should Be Equal    ${new}[status]    submitted
    Row Count Should Be    1    select 1 from sc_bids where invitation_id = %s and status = 'submitted'    ${crew}[invitation_id]
    ${state}=    Api Get    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid
    Length Should Be    ${state.json()}[submitted]    2

Buyer Sees Every Submitted Version Of A Bid
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body1}=    Bid Body    ${ctx}[lines]    ${100}
    ${body2}=    Bid Body    ${ctx}[lines]    ${90}
    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body1}    201
    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body2}    201
    ${bids}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/bids
    ${versions}=    Evaluate    sorted(b['version'] for b in $bids.json())
    Should Be Equal    ${versions}    ${{ [1, 2] }}

Bid Draft Is Saved Without Complete Prices And Stays Private
    [Documentation]    Autosave accepts an incomplete bid (version 0, status draft). The buyer's bid list shows only
    ...    submitted versions, so a draft never reaches the buyer.
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${line0}=    Evaluate    [{'idx': 0, 'unitPrice': 120, 'matUnitPrice': None, 'excluded': False, 'reason': ''}]
    VAR    &{draft}    mode=unit    lines=${line0}    note=ร่างราคา
    ${saved}=    Api Put    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid-draft    ${draft}    200
    Should Be Equal    ${saved.json()}[status]    draft
    Should Be Equal As Integers    ${saved.json()}[version]    0
    ${row}=    Bid Row    ${saved.json()}[id]
    Should Be Equal    ${row}[status]    draft
    ${state}=    Api Get    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid
    Should Be Equal    ${state.json()}[draft][note]    ร่างราคา
    Should Be Empty    ${state.json()}[submitted]
    ${bids}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/bids
    Should Be Empty    ${bids.json()}
    ${leveling}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    Should Be Empty    ${leveling.json()}[bidders]

Incomplete Bid Is Refused Naming The Unpriced Line
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${first_only}=    Evaluate    [$ctx['lines'][0]]
    ${body}=    Bid Body    ${first_only}    ${100}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    422
    Error Code Should Be    ${resp}    unprocessable
    Should Be Equal    ${resp.json()}[details][reason]    line_not_priced
    Row Count Should Be    0    select 1 from sc_bids where invitation_id = %s and status = 'submitted'    ${crew}[invitation_id]

Line With A Null Price Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}
    Set To Dictionary    ${body}[lines][0]    unitPrice=${None}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    422
    Should Be Equal    ${resp.json()}[details][reason]    line_not_priced

Excluded Line Needs A Reason
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}
    Set To Dictionary    ${body}[lines][0]    excluded=${True}    unitPrice=${None}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    422
    Should Be Equal    ${resp.json()}[details][reason]    excluded_needs_reason

Excluded Line With A Reason Is Accepted And Left Out Of The Total
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}
    Set To Dictionary    ${body}[lines][0]    excluded=${True}    unitPrice=${None}    reason=ไม่รับงานส่วนนี้
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    ${rest}=    Evaluate    $ctx['lines'][1:]
    ${expected}=    Expected Bid Total    ${rest}    ${100}
    Numbers Should Be Close    ${resp.json()}[total]    ${expected}    0.02

Excluding Every Line Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${lines}=    Evaluate
    ...    [{'idx': l['idx'], 'unitPrice': None, 'matUnitPrice': None, 'excluded': True, 'reason': 'ไม่ทำ'} for l in $ctx['lines']]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}    lines=${lines}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    422
    Should Be Equal    ${resp.json()}[details][reason]    nothing_priced

Negative Unit Price Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${-5}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Absurd Unit Price Is Refused
    [Tags]    negative    edge
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${{ 1e9 + 1 }}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Bid That Totals Below Zero Is Refused
    [Tags]    negative    edge
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${1}    adjustment=${-99999999}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    422
    Should Be Equal    ${resp.json()}[details][reason]    negative_total

Bid Line That Is Not In The Package Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}
    ${extra}=    Evaluate    {'idx': 99, 'unitPrice': 5, 'matUnitPrice': None, 'excluded': False, 'reason': ''}
    Append To List    ${body}[lines]    ${extra}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    422
    Should Be Equal    ${resp.json()}[details][reason]    unknown_line

Pricing The Same Line Twice Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}
    ${again}=    Copy Dictionary    ${body}[lines][0]
    Append To List    ${body}[lines]    ${again}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    422
    Should Be Equal    ${resp.json()}[details][reason]    duplicate_line

Lump Bid On A Unit Price Package Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${no_lines}=    Create List
    ${body}=    Bid Body    ${ctx}[lines]    ${100}    mode=lump    lines=${no_lines}    lumpTotal=${50000}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    422
    Should Be Equal    ${resp.json()}[details][reason]    mode_not_allowed

Lump Sum Bid Is Accepted When The Package Allows It
    [Documentation]    pricingMode vendor_choice: a lump bid totals lumpTotal + adjustment.
    ${ctx}=    Set Up Open Package With Crews    1    pricingMode=vendor_choice
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${no_lines}=    Create List
    ${body}=    Bid Body    ${ctx}[lines]    ${100}    mode=lump    lines=${no_lines}    lumpTotal=${50000}    adjustment=${-500}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    Should Be Equal As Numbers    ${resp.json()}[total]    49500
    Should Be Equal    ${resp.json()}[mode]    lump

Lump Bid Without An Amount Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1    pricingMode=lump
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${no_lines}=    Create List
    ${body}=    Bid Body    ${ctx}[lines]    ${100}    mode=lump    lines=${no_lines}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    422
    Should Be Equal    ${resp.json()}[details][reason]    lump_total_missing

Bid Must Answer Every Question Of The Package
    [Tags]    negative
    ${questions}=    Create List    มีโฟร์แมนไหม    เคยทำงานแบบนี้กี่หลัง
    ${terms}=    Evaluate
    ...    {'retentionPct': 0.05, 'warrantyMonths': 12, 'penalty': {'kind': 'none'}, 'provisions': {'water': 'buyer', 'power': 'buyer', 'lodging': 'vendor', 'scaffolding': 'vendor'}, 'safetyNote': '', 'questions': $questions}
    ${ctx}=    Set Up Open Package With Crews    1    terms=${terms}
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${missing}=    Bid Body    ${ctx}[lines]    ${100}
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${missing}    422
    Should Be Equal    ${resp.json()}[details][reason]    answers_mismatch
    ${answers}=    Create List    มี 1 คน    12 หลัง
    ${full}=    Bid Body    ${ctx}[lines]    ${100}    answers=${answers}
    ${ok}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${full}    201
    Should Be Equal    ${ok.json()}[answers]    ${answers}

Bid Is Refused Without A Token
    [Tags]    security    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${anon}=    Anonymous Caller
    ${body}=    Bid Body    ${ctx}[lines]
    ${resp}=    Api Post    ${anon}    /vendor/invitations/${ctx}[crews][0][invitation_id]/bid    ${body}    401
    Error Code Should Be    ${resp}    unauthenticated

Crew Cannot Bid On An Invitation Sent To Another Crew
    [Documentation]    A crew of another workspace gets 404 (not 403): it must not learn the invitation exists.
    [Tags]    security    negative
    ${ctx}=    Set Up Open Package With Crews    2
    ${mine}=    Set Variable    ${ctx}[crews][0]
    ${other}=    Set Variable    ${ctx}[crews][1]
    ${body}=    Bid Body    ${ctx}[lines]
    ${resp}=    Api Post    ${other}    /vendor/invitations/${mine}[invitation_id]/bid    ${body}    404
    Error Code Should Be    ${resp}    not_found
    ${draft}=    Api Put    ${other}    /vendor/invitations/${mine}[invitation_id]/bid-draft    ${body}    404
    Error Code Should Be    ${draft}    not_found
    Row Count Should Be    0    select 1 from sc_bids where invitation_id = %s    ${mine}[invitation_id]

Crew Not Invited To The Package Cannot Bid On It
    [Documentation]    A crew with an account but no invitation to this package has no route into it.
    [Tags]    security    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${outsider}=    Sign In New Crew    ทีมไม่ได้รับเชิญ
    ${body}=    Bid Body    ${ctx}[lines]
    ${resp}=    Api Post    ${outsider}    /vendor/invitations/${ctx}[crews][0][invitation_id]/bid    ${body}    404
    Error Code Should Be    ${resp}    not_found
    ${inbox}=    Api Get    ${outsider}    /vendor/inbox    workspaceId=${outsider}[vendor_ws]
    Should Be Empty    ${inbox.json()}[invitations]

Buyer Cannot Use The Vendor Bid Route
    [Tags]    security    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${body}=    Bid Body    ${ctx}[lines]
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /vendor/invitations/${ctx}[crews][0][invitation_id]/bid    ${body}    404
    Error Code Should Be    ${resp}    not_found

Concurrent Double Submit Never Fails With A Server Error
    [Documentation]    API-module1.md: concurrent writes on one invitation answer 409 conflict, never 500, and leave
    ...    exactly one submitted bid.
    [Tags]    edge    security
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}
    ${codes}=    Post Concurrently    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    3
    FOR    ${code}    IN    @{codes}
        Should Be True    ${code} in (201, 409)    Unexpected status ${code} in ${codes}
    END
    Should Contain    ${codes}    ${201}
    Row Count Should Be    1    select 1 from sc_bids where invitation_id = %s and status = 'submitted'    ${crew}[invitation_id]

Crew Withdraws A Bid Before The Deadline
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}
    ${bid}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid/withdraw    ${None}    204
    ${row}=    Bid Row    ${bid.json()}[id]
    Should Be Equal    ${row}[status]    withdrawn
    ${leveling}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    Should Be Empty    ${leveling.json()}[bidders]

Withdrawn Bid Can Be Replaced By A New Submission
    [Tags]    edge
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}
    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid/withdraw    ${None}    204
    ${again}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    ${leveling}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    Length Should Be    ${leveling.json()}[bidders]    1
    Should Be Equal    ${leveling.json()}[bidders][0][bidId]    ${again.json()}[id]

Withdrawing Without A Bid Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid/withdraw    ${None}    409
    Error Code Should Be    ${resp}    conflict

Leveling Totals Equal The Sum Of The Bid Rows
    [Documentation]    Two crews bid 100 and 90 per unit. The comparison lists both, each total equals Σ line price x
    ...    priced quantity recomputed here, and the package estimate is the sum of the line estimates.
    [Tags]    smoke
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${resp}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    ${lev}=    Set Variable    ${resp.json()}
    Length Should Be    ${lev}[bidders]    2
    ${by_bid}=    Evaluate    {b['bidId']: b for b in $lev['bidders']}
    ${first}=    Set Variable    ${by_bid}[${ctx}[bids][0][id]]
    ${second}=    Set Variable    ${by_bid}[${ctx}[bids][1][id]]
    ${total_100}=    Expected Bid Total    ${ctx}[lines]    ${100}
    ${total_90}=    Expected Bid Total    ${ctx}[lines]    ${90}
    Numbers Should Be Close    ${first}[total]    ${total_100}    0.02
    Numbers Should Be Close    ${second}[total]    ${total_90}    0.02
    Numbers Should Be Close    ${first}[normalizedTotal]    ${total_100}    0.02
    ${estimate}=    Evaluate    sum(l['estTotal'] for l in $lev['lines'])
    Numbers Should Be Close    ${lev}[estimateTotal]    ${estimate}    0.05

Leveling Cells Hold One Price Per Bidder And Line
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${lev}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    Length Should Be    ${lev.json()}[lines]    ${MASONRY LINES}
    ${position}=    Evaluate    {b['bidId']: i for i, b in enumerate($lev.json()['bidders'])}
    ${pos_100}=    Set Variable    ${position}[${ctx}[bids][0][id]]
    ${pos_90}=    Set Variable    ${position}[${ctx}[bids][1][id]]
    FOR    ${line}    IN    @{lev.json()}[lines]
        Length Should Be    ${line}[cells]    2
        Should Be Equal As Numbers    ${line}[cells][${pos_100}][unitPrice]    100
        Should Be Equal As Numbers    ${line}[cells][${pos_90}][unitPrice]    90
        ${expected}=    Expected Bid Total    ${{ [$ctx['lines'][$line['idx']]] }}    ${100}
        Numbers Should Be Close    ${line}[cells][${pos_100}][total]    ${expected}    0.01
    END

Leveling Difference Is Relative To The Estimate
    [Documentation]    diffPct of a bidder = (total - estimate) / estimate for a fully priced bid.
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${lev}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    ${bidder}=    Set Variable    ${lev.json()}[bidders][0]
    ${expected}=    Evaluate    ($bidder['total'] - $lev.json()['estimateTotal']) / $lev.json()['estimateTotal']
    Numbers Should Be Close    ${bidder}[diffPct]    ${expected}    0.001

Very High Bid Is Flagged High And Very Low Bid Is Flagged
    [Documentation]    Bids far from the estimate carry a flag (threshold from the workspace settings).
    ${ctx}=    Set Up Package With Bids    ${{ [1000000, 1] }}
    ${lev}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    ${by_bid}=    Evaluate    {b['bidId']: b for b in $lev.json()['bidders']}
    Should Be Equal    ${by_bid}[${ctx}[bids][0][id]][flag]    high
    Should Not Be Equal    ${by_bid}[${ctx}[bids][1][id]][flag]    ${None}

Leveling Shows Only The Latest Version Of Each Crew
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${80}
    ${second}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    ${lev}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    Length Should Be    ${lev.json()}[bidders]    1
    Should Be Equal As Integers    ${lev.json()}[bidders][0][version]    2
    Should Be Equal    ${lev.json()}[bidders][0][bidId]    ${second.json()}[id]

Excluded Line Is Filled From The Estimate In The Normalised Total
    [Documentation]    A crew that excludes a line is compared fairly: normalizedTotal = total + the estimate of that line.
    ${ctx}=    Set Up Open Package With Crews    1
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]    ${100}
    Set To Dictionary    ${body}[lines][0]    excluded=${True}    unitPrice=${None}    reason=ไม่รับ
    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
    ${lev}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    ${bidder}=    Set Variable    ${lev.json()}[bidders][0]
    ${filled}=    Set Variable    ${lev.json()}[lines][0][estTotal]
    ${expected}=    Evaluate    $bidder['total'] + $filled
    Numbers Should Be Close    ${bidder}[normalizedTotal]    ${expected}    0.05
    Should Be True    ${lev.json()}[lines][0][cells][0][excluded]
    Should Be True    ${lev.json()}[lines][0][cells][0][filled]

Package Summary Shows The Lowest Bid
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${list}=    Api Get    ${ctx}[buyer][owner]    /projects/${ctx}[buyer][project_id]/subcontracting/packages
    ${expected}=    Expected Bid Total    ${ctx}[lines]    ${90}
    Numbers Should Be Close    ${list.json()}[0][bestBidTotal]    ${expected}    0.02
    Should Be Equal As Integers    ${list.json()}[0][invitations][submitted]    2

Bid After An Addendum Is Marked Outdated
    [Documentation]    A bid made for version 1 becomes ``outdated`` once the package has version 2.
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${keys}=    Create List    R179    R180    R181
    VAR    &{material}
    VAR    @{custom}
    VAR    &{addendum}    lineKeys=${keys}    customLines=${custom}    materialByLine=${material}    note=ตัดรายการ
    Api Post    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/addendum    ${addendum}    200
    ${lev}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    Should Be True    ${lev.json()}[bidders][0][outdated]
    Should Be Equal As Integers    ${lev.json()}[version]    2

Estimator Reads The Leveling And Viewer Does Not
    [Documentation]    sc.readPrices: estimator yes; viewer no (viewerSeesPrices is off by default).
    [Tags]    security
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${estimator}=    Add Workspace Member    ${ctx}[buyer]    estimator
    ${viewer}=    Add Workspace Member    ${ctx}[buyer]    viewer
    Api Get    ${estimator}    /subcontracting/packages/${ctx}[package_id]/leveling
    ${denied}=    Api Get    ${viewer}    /subcontracting/packages/${ctx}[package_id]/leveling    403
    Error Code Should Be    ${denied}    forbidden
    ${bids}=    Api Get    ${viewer}    /subcontracting/packages/${ctx}[package_id]/bids    403
    Error Code Should Be    ${bids}    forbidden

Other Workspaces And Crews Cannot Read The Bids Of My Package
    [Documentation]    Another buyer and even the bidding crews get 404 on the buyer's leveling and bid list.
    [Tags]    security    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${stranger}=    Create Buyer Workspace
    FOR    ${caller}    IN    ${stranger}[owner]    ${ctx}[crews][0]    ${ctx}[crews][1]
        ${lev}=    Api Get    ${caller}    /subcontracting/packages/${ctx}[package_id]/leveling    404
        Error Code Should Be    ${lev}    not_found
        ${bids}=    Api Get    ${caller}    /subcontracting/packages/${ctx}[package_id]/bids    404
        Error Code Should Be    ${bids}    not_found
    END

Crew Sees Only Its Own Bid State
    [Tags]    security
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${first}=    Set Variable    ${ctx}[crews][0]
    ${state}=    Api Get    ${first}    /vendor/invitations/${first}[invitation_id]/bid
    Length Should Be    ${state.json()}[submitted]    1
    Should Be Equal    ${state.json()}[submitted][0][id]    ${ctx}[bids][0][id]
    ${view}=    Api Get    ${first}    /vendor/invitations/${first}[invitation_id]
    Should Not Contain    ${view.text}    ${ctx}[bids][1][id]

Buyer Is Notified That A Bid Arrived
    [Documentation]    sc.bid_received goes to the buyer workspace members, without an amount.
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${notes}=    Api Get    ${ctx}[buyer][owner]    /notifications
    ${templates}=    Evaluate    [n['template'] for n in $notes.json()['items']]
    Should Contain    ${templates}    sc.bid_received

Buyer Enters A Price Received By Phone
    [Documentation]    manual-bid: enteredByBuyer is true, the bid is stored and appears in the leveling.
    ${ctx}=    Set Up Open Package With Crews    1
    ${body}=    Bid Body    ${ctx}[lines]    ${95}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/invitations/${ctx}[crews][0][invitation_id]/manual-bid    ${body}    201
    Should Be True    ${resp.json()}[enteredByBuyer]
    ${row}=    Bid Row    ${resp.json()}[id]
    Should Be True    ${row}[entered_by_buyer]
    ${lev}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/packages/${ctx}[package_id]/leveling
    Should Be True    ${lev.json()}[bidders][0][enteredByBuyer]

Viewer Cannot Enter A Manual Bid
    [Tags]    security    negative
    ${ctx}=    Set Up Open Package With Crews    1
    ${viewer}=    Add Workspace Member    ${ctx}[buyer]    viewer
    ${body}=    Bid Body    ${ctx}[lines]    ${95}
    ${resp}=    Api Post    ${viewer}    /subcontracting/invitations/${ctx}[crews][0][invitation_id]/manual-bid    ${body}    403
    Error Code Should Be    ${resp}    forbidden
    Row Count Should Be    0    select 1 from sc_bids where invitation_id = %s    ${ctx}[crews][0][invitation_id]

Negotiation Messages Go Both Ways And Stay Between The Two Parties
    [Documentation]    Buyer message with a target total, crew reply; another crew gets 404, a viewer cannot send (403)
    ...    but can read (sc.read).
    ${ctx}=    Set Up Package With Bids    ${{ [100, 90] }}
    ${first}=    Set Variable    ${ctx}[crews][0]
    ${second}=    Set Variable    ${ctx}[crews][1]
    ${viewer}=    Add Workspace Member    ${ctx}[buyer]    viewer
    VAR    &{ask}    text=ลดได้อีกไหม    targetTotal=${150000}
    Api Post    ${ctx}[buyer][owner]    /subcontracting/invitations/${first}[invitation_id]/messages    ${ask}    200
    ${read}=    Api Get    ${first}    /vendor/invitations/${first}[invitation_id]/messages
    Length Should Be    ${read.json()}    1
    Should Be Equal    ${read.json()}[0][text]    ลดได้อีกไหม
    Should Be Equal    ${read.json()}[0][from]    buyer
    Should Be Equal As Numbers    ${read.json()}[0][targetTotal]    150000
    VAR    &{reply}    text=ลดให้ 2%
    Api Post    ${first}    /vendor/invitations/${first}[invitation_id]/messages    ${reply}    200
    ${thread}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/invitations/${first}[invitation_id]/messages
    ${senders}=    Evaluate    [m['from'] for m in $thread.json()]
    Should Be Equal    ${senders}    ${{ ['buyer', 'vendor'] }}
    Row Count Should Be    2    select 1 from sc_messages where invitation_id = %s    ${first}[invitation_id]
    ${spy}=    Api Get    ${second}    /vendor/invitations/${first}[invitation_id]/messages    404
    Error Code Should Be    ${spy}    not_found
    ${seen_by_viewer}=    Api Get    ${viewer}    /subcontracting/invitations/${first}[invitation_id]/messages
    Length Should Be    ${seen_by_viewer.json()}    2
    ${send_by_viewer}=    Api Post    ${viewer}    /subcontracting/invitations/${first}[invitation_id]/messages    ${ask}    403
    Error Code Should Be    ${send_by_viewer}    forbidden

Empty Negotiation Message Is Refused
    [Tags]    negative
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    VAR    &{blank}    text=${EMPTY}
    ${resp}=    Api Post    ${ctx}[buyer][owner]    /subcontracting/invitations/${ctx}[crews][0][invitation_id]/messages    ${blank}    400
    Error Code Should Be    ${resp}    validation_failed
