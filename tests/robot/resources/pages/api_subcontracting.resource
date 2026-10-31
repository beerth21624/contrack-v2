*** Settings ***
Documentation       Keywords of the subcontracting module ("จ้างช่วง", การจัดคน) over HTTP, plus database read-backs of the
...                 ``sc_*`` tables. Flow: buyer workspace -> project -> package -> invite crews -> crews sign in by
...                 phone OTP -> bids -> leveling -> award -> contract -> claim. Every ``Api *`` keyword states the
...                 HTTP status it expects (default 200 / 201 for creates is passed by the caller).
Library             Collections
Library             String
Resource            ../api.resource
Resource            ../db.resource


*** Variables ***
# BOQ row keys of the ``sample`` start (computeProject(createProject('sample')).boq, subcontractableRows with qty > 0).
@{MASONRY KEYS}     R179    R180    R181    R183    R189    R190    R191
@{CEILING KEYS}     R199    R200    R201    R202
@{TILING KEYS}      R205    R206    R207    R210    R211    R213    R214    R215    R218    R219    R220
@{PILING KEYS}      R35
${MASONRY LINES}    7


*** Keywords ***
Add Crew To Vendor List
    [Documentation]    Vendor-list entry (ทะเบียนทีมช่าง) of the buyer workspace. Returns the entry JSON.
    [Arguments]    ${user}    ${workspace_id}    ${phone}=${EMPTY}    ${name}=ทีมช่างทดสอบ    ${status}=201
    ${generated}=    Unique Thai Phone
    ${number}=    Set Variable If    not $phone    ${generated}    ${phone}
    VAR    @{trades}    masonry
    VAR    &{body}    displayName=${name}    phone=${number}    trades=${trades}    province=นนทบุรี
    ${resp}=    Api Post    ${user}    /workspaces/${workspace_id}/vendor-list    ${body}    ${status}
    RETURN    ${resp.json()}

Add Workspace Member
    [Documentation]    Registers a new user and makes them a member of the buyer workspace with ``${role}``
    ...    (admin / estimator / viewer) through the e-mail invitation flow. Returns the member's ``&{user}``.
    [Arguments]    ${buyer}    ${role}
    ${member}=    Register User Via API    ${role}
    VAR    &{body}    email=${member}[email]    role=${role}
    ${resp}=    Api Post    ${buyer}[owner]    /workspaces/${buyer}[ws]/invitations    ${body}    201
    ${token}=    Set Variable    ${resp.json()}[token]
    VAR    &{accept}    token=${token}
    Api Post    ${member}    /invitations/accept    ${accept}    200
    RETURN    ${member}

Anonymous Caller
    [Documentation]    A caller without a token, as ``&{user}`` (``alias`` only).
    ${alias}=    Unique Suffix
    Create Anonymous Session    ${alias}
    VAR    &{caller}    alias=${alias}
    RETURN    ${caller}

Api Delete
    [Documentation]    DELETE as ``${user}``; checks the status (default 204).
    [Arguments]    ${user}    ${path}    ${status}=204
    ${resp}=    DELETE On Session    ${user}[alias]    ${path}    expected_status=${status}
    RETURN    ${resp}

Api Get
    [Documentation]    GET as ``${user}``; named arguments become query parameters. Checks the status (default 200).
    [Arguments]    ${user}    ${path}    ${status}=200    &{params}
    ${resp}=    GET On Session    ${user}[alias]    ${path}    params=${params}    expected_status=${status}
    RETURN    ${resp}

Api Patch
    [Documentation]    PATCH a JSON body as ``${user}``; checks the status (default 200).
    [Arguments]    ${user}    ${path}    ${body}    ${status}=200
    ${resp}=    PATCH On Session    ${user}[alias]    ${path}    json=${body}    expected_status=${status}
    RETURN    ${resp}

Api Post
    [Documentation]    POST a JSON body (or none) as ``${user}``; checks the status (default 200); optional extra headers.
    [Arguments]    ${user}    ${path}    ${body}=${None}    ${status}=200    ${headers}=${None}
    ${resp}=    POST On Session    ${user}[alias]    ${path}    json=${body}    headers=${headers}
    ...    expected_status=${status}
    RETURN    ${resp}

Api Put
    [Documentation]    PUT a JSON body as ``${user}``; checks the status (default 200).
    [Arguments]    ${user}    ${path}    ${body}    ${status}=200
    ${resp}=    PUT On Session    ${user}[alias]    ${path}    json=${body}    expected_status=${status}
    RETURN    ${resp}

Award Everything To Bid
    [Documentation]    Award every line of the package to one bid. Returns the response (expected ``${status}``).
    [Arguments]    ${user}    ${package_id}    ${lines}    ${bid_id}    ${status}=200
    ${allocations}=    Evaluate    (lambda ls, b: [{'idx': l['idx'], 'bidId': b} for l in ls])($lines, $bid_id)
    VAR    &{installments_from}
    VAR    &{body}    allocations=${allocations}    installmentsFrom=${installments_from}    note=${EMPTY}
    ${resp}=    Api Post    ${user}    /subcontracting/packages/${package_id}/award    ${body}    ${status}
    RETURN    ${resp}

Bid Body
    [Documentation]    A complete unit-price bid: ``${price}`` baht per unit on every line of ``${lines}`` (package
    ...    lines with ``idx``). Extra named arguments override fields of the request.
    [Arguments]    ${package_lines}    ${price}=${100}    &{overrides}
    ${bid_lines}=    Evaluate
    ...    (lambda ls, p: [{'idx': l['idx'], 'unitPrice': p, 'matUnitPrice': None, 'excluded': False, 'reason': ''} for l in ls])($package_lines, $price)
    ${answers}=    Create List
    VAR    &{body}
    ...    mode=unit
    ...    lines=${bid_lines}
    ...    lumpTotal=${None}
    ...    adjustment=${0}
    ...    adjustmentNote=${EMPTY}
    ...    inclusions=${EMPTY}
    ...    days=${28}
    ...    earliestStart=2026-12-01
    ...    crewSkilled=${4}
    ...    crewLabourers=${2}
    ...    validUntil=2027-03-01
    ...    installmentsProposal=${None}
    ...    answers=${answers}
    ...    note=${EMPTY}
    ...    photoFileIds=${answers}
    Set To Dictionary    ${body}    &{overrides}
    RETURN    ${body}

Bid Row
    [Documentation]    Database row of a bid by id.
    [Arguments]    ${bid_id}
    ${row}=    Query Row    select * from sc_bids where id = %s    ${bid_id}
    RETURN    ${row}

Buyer Sees Module Disabled
    [Documentation]    Calls a buyer route and checks it answers 404 ``module_disabled``.
    [Arguments]    ${user}    ${method}    ${path}
    ${resp}=    Run Keyword    ${method} On Session    ${user}[alias]    ${path}    expected_status=404
    Error Code Should Be    ${resp}    module_disabled

Claim Is Paid Through The Buyer
    [Documentation]    Inspect -> approve -> pay a requested claim as the buyer. Returns the paid claim JSON.
    [Arguments]    ${buyer_user}    ${claim_id}
    VAR    @{checklist}
    VAR    @{fixes}
    VAR    &{inspect}    result=pass    checklist=${checklist}    fixes=${fixes}    note=${EMPTY}
    Api Post    ${buyer_user}    /subcontracting/claims/${claim_id}/inspect    ${inspect}    200
    VAR    @{adjustments}
    VAR    &{approve}    adjustments=${adjustments}
    ${approved}=    Api Post    ${buyer_user}    /subcontracting/claims/${claim_id}/approve    ${approve}    200
    VAR    &{pay}    paidAt=2026-12-20    amount=${approved.json()}[amounts][net]    channel=โอน    ref=${EMPTY}
    ${paid}=    Api Post    ${buyer_user}    /subcontracting/claims/${claim_id}/pay    ${pay}    200
    RETURN    ${paid.json()}

Contract For Package
    [Documentation]    Awards the whole package to the first crew's bid. Returns ``&{contract}``: id, bid_id, total.
    [Arguments]    ${ctx}    ${crew_index}=0
    ${bid}=    Set Variable    ${ctx}[bids][${crew_index}]
    ${resp}=    Award Everything To Bid    ${ctx}[buyer][owner]    ${ctx}[package_id]    ${ctx}[lines]    ${bid}[id]
    VAR    &{contract}    id=${resp.json()}[subcontractIds][0]    bid_id=${bid}[id]    total=${bid}[total]
    RETURN    ${contract}

Create Buyer Workspace
    [Documentation]    Owner + company workspace + a cloud project of the ``sample`` start. The subcontracting module is
    ...    switched on unless ``${module_on}`` is false. Returns ``&{buyer}``: owner, ws, project_id.
    [Arguments]    ${module_on}=${True}    ${start}=sample
    ${owner}=    Register User Via API    buyer
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${project}=    Create Project Via API    ${owner}    ${ws}    start=${start}
    IF    ${module_on}
        VAR    &{on}    enabled=${True}
        Api Put    ${owner}    /workspaces/${ws}/modules/subcontracting    ${on}    200
    END
    VAR    &{buyer}    owner=${owner}    ws=${ws}    project_id=${project}[project][id]
    RETURN    ${buyer}

Create Package Via API
    [Documentation]    Create a draft package in the buyer's project. ``&{overrides}`` replace request fields.
    [Arguments]    ${user}    ${project_id}    ${status}=201    ${line_keys}=${MASONRY KEYS}    &{overrides}
    ${body}=    Package Body    ${line_keys}    &{overrides}
    ${resp}=    Api Post    ${user}    /projects/${project_id}/subcontracting/packages    ${body}    ${status}
    RETURN    ${resp}

Crew Signs In With Otp
    [Documentation]    Phone sign-in of a crew: request the code, read it from the SMS in the API log, verify.
    ...    A new phone creates the user, a personal workspace and a vendor workspace (``teamName``). The call comes
    ...    from its own (forwarded) IP so the per-IP OTP limits of other tests do not interfere.
    ...    Returns ``&{crew}``: alias, token, user_id, vendor_ws, phone.
    [Arguments]    ${phone}    ${team}=ทีมช่างทดสอบ    ${invitation_token}=${None}
    ${anon}=    Anonymous Caller
    ${headers}=    Forwarded Ip Headers
    VAR    &{request}    phone=${phone}
    Api Post    ${anon}    /auth/otp/request    ${request}    204    ${headers}
    ${code}=    Latest Otp To    ${phone}
    VAR    &{verify}    phone=${phone}    code=${code}    displayName=ช่าง ${team}    teamName=${team}
    IF    $invitation_token is not None    Set To Dictionary    ${verify}    invitationToken=${invitation_token}
    ${resp}=    Api Post    ${anon}    /auth/otp/verify    ${verify}    200    ${headers}
    ${auth}=    Set Variable    ${resp.json()}
    Update Session    ${anon}[alias]    headers=${{ {'Authorization': 'Bearer ' + $auth['accessToken']} }}
    VAR    &{crew}    alias=${anon}[alias]    token=${auth}[accessToken]    user_id=${auth}[user][id]
    ...    vendor_ws=${auth}[vendorWorkspaceId]    phone=${phone}
    RETURN    ${crew}

Expected Bid Total
    [Documentation]    Sum of ``round(price x qtyPriced, 2)`` over the package lines (half up), the way the backend
    ...    prices a unit bid, computed here independently.
    [Arguments]    ${lines}    ${price}
    ${rounded}=    Evaluate
    ...    (lambda ls, p: float(sum((decimal.Decimal(str(p)) * decimal.Decimal(str(l['qtyPriced']))).quantize(decimal.Decimal('0.01'), rounding=decimal.ROUND_HALF_UP) for l in ls)))($lines, $price)
    ...    modules=decimal
    RETURN    ${rounded}

Forwarded Ip Headers
    [Documentation]    ``X-Forwarded-For`` with a random private address: the API trusts the loopback proxy, so every
    ...    sign-in gets its own per-IP rate-limit bucket.
    ${a}=    Evaluate    random.randint(1, 250)    modules=random
    ${b}=    Evaluate    random.randint(1, 250)    modules=random
    ${c}=    Evaluate    random.randint(1, 250)    modules=random
    VAR    &{headers}    X-Forwarded-For=10.${a}.${b}.${c}
    RETURN    ${headers}

Future Deadline
    [Documentation]    ISO instant ``${days}`` days from now (negative = in the past).
    [Arguments]    ${days}=7
    ${iso}=    Evaluate
    ...    (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=float($days))).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    ...    modules=datetime
    RETURN    ${iso}

Invitation Row
    [Documentation]    Database row of ``sc_invitations`` by id.
    [Arguments]    ${invitation_id}
    ${row}=    Query Row    select * from sc_invitations where id = %s    ${invitation_id}
    RETURN    ${row}

Invite Crews
    [Documentation]    Invite vendor-list entries to a package (sends a draft). Returns the response.
    [Arguments]    ${user}    ${package_id}    ${entry_ids}    ${channel}=link    ${status}=201
    ${entries}=    Evaluate    [{'vendorListEntryId': e, 'channel': $channel} for e in $entry_ids]
    VAR    &{body}    entries=${entries}
    ${resp}=    Api Post    ${user}    /subcontracting/packages/${package_id}/invitations    ${body}    ${status}
    RETURN    ${resp}

Package Body
    [Documentation]    A valid create-package request (ก่ออิฐ-ฉาบปูน, labour only, unit prices, RFQ, 3 installments
    ...    30/40/30). ``&{overrides}`` replace any field.
    [Arguments]    ${line_keys}=${MASONRY KEYS}    &{overrides}
    ${deadline}=    Future Deadline    7
    VAR    &{provisions}    water=buyer    power=buyer    lodging=vendor    scaffolding=vendor
    VAR    &{penalty}    kind=per_day    amount=${500}
    VAR    @{questions}
    VAR    &{terms}    retentionPct=${0.05}    warrantyMonths=${12}    penalty=${penalty}    provisions=${provisions}
    ...    safetyNote=${EMPTY}    questions=${questions}
    VAR    &{schedule}    start=2026-12-01    finish=2027-01-15    days=${45}
    VAR    &{location}    district=บางกรวย    province=นนทบุรี    address=99/1 ถนนบางกรวย-ไทรน้อย
    ${installments}=    Evaluate
    ...    [{'no': 1, 'pct': 0.3, 'condition': 'ก่ออิฐเสร็จ'}, {'no': 2, 'pct': 0.4, 'condition': 'ฉาบเสร็จ'}, {'no': 3, 'pct': 0.3, 'condition': 'ส่งมอบงาน'}]
    VAR    @{custom}
    VAR    &{material_by_line}
    ${title}=    Unique Name    ก่ออิฐ-ฉาบปูน
    VAR    &{body}
    ...    title=${title}
    ...    trade=masonry
    ...    lineKeys=${line_keys}
    ...    customLines=${custom}
    ...    supplyMode=labour_only
    ...    materialByLine=${material_by_line}
    ...    pricingMode=unit
    ...    sourcingMode=rfq
    ...    terms=${terms}
    ...    schedule=${schedule}
    ...    installments=${installments}
    ...    location=${location}
    ...    hideOwnerIdentity=${False}
    ...    bidDeadline=${deadline}
    ...    priceValidUntil=2027-03-01
    ...    description=บ้านชั้นเดียว ตามแบบที่แนบ
    Set To Dictionary    ${body}    &{overrides}
    RETURN    ${body}

Package Lines
    [Documentation]    The package lines (buyer view, with ``idx`` and ``qtyPriced``) of a package.
    [Arguments]    ${user}    ${package_id}
    ${resp}=    Api Get    ${user}    /subcontracting/packages/${package_id}
    RETURN    ${resp.json()}[lines]

Package Row
    [Documentation]    Database row of ``sc_work_packages`` by id.
    [Arguments]    ${package_id}
    ${row}=    Query Row    select * from sc_work_packages where id = %s    ${package_id}
    RETURN    ${row}

Post Concurrently
    [Documentation]    Sends the same POST ``${count}`` times at once from threads (a double click / race). Returns the
    ...    sorted list of HTTP status codes.
    [Arguments]    ${user}    ${path}    ${body}    ${count}=2
    ${token}=    Set Variable    ${user}[token]
    ${url}=    Set Variable    ${API_URL}${path}
    ${codes}=    Evaluate
    ...    (lambda u, b, t, n: sorted(f.result() for f in [concurrent.futures.ThreadPoolExecutor(n).submit(lambda: requests.post(u, json=b, headers={'Authorization': 'Bearer ' + t}).status_code) for _ in range(n)]))($url, $body, $token, int($count))
    ...    modules=concurrent.futures,requests
    RETURN    ${codes}

Set Up Open Package With Crews
    [Documentation]    Buyer + a package of the masonry rows sent to ``${crews}`` crews, every crew signed in by OTP
    ...    through its invitation link. Returns ``&{ctx}``: buyer, package_id, lines, entries, invitations, crews
    ...    (each ``&{crew}`` + invitation_id, entry_id, link_token). ``&{package}`` overrides package fields.
    [Arguments]    ${crews}=2    &{package}
    ${buyer}=    Create Buyer Workspace
    ${created}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    &{package}
    ${package_id}=    Set Variable    ${created.json()}[id]
    @{entries}=    Create List
    @{entry_ids}=    Create List
    FOR    ${n}    IN RANGE    ${crews}
        ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    name=ทีมช่างที่ ${n}
        Append To List    ${entries}    ${entry}
        Append To List    ${entry_ids}    ${entry}[id]
    END
    ${sent}=    Invite Crews    ${buyer}[owner]    ${package_id}    ${entry_ids}
    @{team}=    Create List
    FOR    ${n}    ${entry}    IN ENUMERATE    @{entries}
        ${invitation}=    Set Variable    ${sent.json()}[invitations][${n}]
        ${link_token}=    Token From Link    ${sent.json()}[links][${n}][url]
        ${crew}=    Crew Signs In With Otp    ${entry}[phone]    ทีมช่างที่ ${n}    ${link_token}
        Set To Dictionary    ${crew}    invitation_id=${invitation}[id]    entry_id=${entry}[id]    link_token=${link_token}
        Append To List    ${team}    ${crew}
    END
    ${lines}=    Package Lines    ${buyer}[owner]    ${package_id}
    VAR    @{bids}
    VAR    &{ctx}    buyer=${buyer}    package_id=${package_id}    lines=${lines}    entries=${entries}
    ...    invitations=${sent.json()}[invitations]    crews=${team}    bids=${bids}
    RETURN    ${ctx}

Set Up Package With Bids
    [Documentation]    ``Set Up Open Package With Crews`` where crew n bids ``${prices}[n]`` per unit on every line.
    ...    The submitted bids (JSON) are in ``${ctx}[bids]``.
    [Arguments]    ${prices}    &{package}
    ${crews}=    Get Length    ${prices}
    ${ctx}=    Set Up Open Package With Crews    ${crews}    &{package}
    FOR    ${n}    ${price}    IN ENUMERATE    @{prices}
        ${crew}=    Set Variable    ${ctx}[crews][${n}]
        ${body}=    Bid Body    ${ctx}[lines]    ${price}
        ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201
        Append To List    ${ctx}[bids]    ${resp.json()}
    END
    RETURN    ${ctx}

Sign In New Crew
    [Documentation]    A crew with a brand-new phone signs up by OTP. Returns ``&{crew}`` like ``Crew Signs In With Otp``.
    [Arguments]    ${team}=ทีมช่างทดสอบ
    ${phone}=    Unique Thai Phone
    ${crew}=    Crew Signs In With Otp    ${phone}    ${team}
    RETURN    ${crew}

Subcontract Row
    [Documentation]    Database row of ``sc_subcontracts`` by id.
    [Arguments]    ${subcontract_id}
    ${row}=    Query Row    select * from sc_subcontracts where id = %s    ${subcontract_id}
    RETURN    ${row}

Token From Link
    [Documentation]    The raw token at the end of an invitation link ``http://host/s/<token>``.
    [Arguments]    ${url}
    ${token}=    Evaluate    $url.rsplit('/', 1)[-1]
    RETURN    ${token}

Vendor Accepts Contract
    [Documentation]    The crew reads the contract and accepts its current document version. Returns the response.
    [Arguments]    ${crew}    ${contract_id}    ${status}=200
    ${contract}=    Api Get    ${crew}    /subcontracting/subcontracts/${contract_id}
    VAR    &{body}    documentVersion=${contract.json()}[documentVersion]
    ${resp}=    Api Post    ${crew}    /subcontracting/subcontracts/${contract_id}/accept    ${body}    ${status}
    RETURN    ${resp}
