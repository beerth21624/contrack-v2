*** Settings ***
Documentation       Keywords of area W6 (subcontracting, "จ้างช่วง", การจัดคน): the buyer wizard / package / leveling
...                 pages, the crew (ทีมช่าง) phone app, API shortcuts to set a state up, and the database rows
...                 (sc_work_packages, sc_invitations, sc_bids, sc_awards, sc_subcontracts) behind them.
...
...                 Every test builds its own buyer (user, company workspace, sample project, module switched on)
...                 with ``Setup Buyer Via API`` and its own crews (unique phones), so tests never depend on each other.
...                 Crew OTP codes come from the API log (SMS_PROVIDER=console).
...                 Every browser context sends its own ``X-Forwarded-For`` so the per-IP OTP quota
...                 (30 requests/hour) is not shared by all tests (the E2E API trusts loopback proxies).
Resource            ../common.resource
Resource            ../api.resource
Resource            ../db.resource
Library             Collections
Library             String
Library             DateTime


*** Variables ***
# BOQ rows of the trade "masonry" with a quantity in the sample house (engine: subcontractableRows, qty > 0).
@{MASONRY_KEYS}         R179    R180    R181    R183    R189    R190    R191
${MASONRY_ROW_COUNT}    7
${MASONRY_TEMPLATE}     ก่ออิฐ + ฉาบ
${MASONRY_TITLE}        ก่ออิฐ-ฉาบปูน
${PHONE_VIEWPORT_W}     390
${PHONE_VIEWPORT_H}     844
${CODE_FIELD}           css=[aria-label="รหัส 6 หลัก"]
${PHONE_FIELD}          css=input[type="tel"]
# role=button[name="เพิ่ม..."] finds no element in Chromium here (Thai text); a text match works.
${QUICK_ADD_BUTTON}     css=button:has-text("เพิ่มรายใหม่")


*** Keywords ***
# ── buyer set-up through the API ─────────────────────────────────────────────────────────────
Setup Buyer Via API
    [Documentation]    Owner + company workspace + cloud project (sample house) + module "จ้างช่วง" on.
    ...    Returns ``&{buyer}``: user, ws, project_id, project_name, email, password.
    ${user}=    Register User Via API    sc-owner
    ${ws}=    Create Company Workspace Via API    ${user}
    ${detail}=    Create Project Via API    ${user}    ${ws}    start=sample
    Switch Module Via API    ${user}    ${ws}    ${True}
    VAR    &{buyer}    user=${user}    ws=${ws}    project_id=${detail}[project][id]
    ...    project_name=${detail}[project][name]    email=${user}[email]    password=${user}[password]
    RETURN    ${buyer}

Switch Module Via API
    [Arguments]    ${user}    ${ws}    ${enabled}    ${confirm}=${False}    ${status}=200
    VAR    &{body}    enabled=${enabled}
    IF    ${confirm}    Set To Dictionary    ${body}    confirm=${True}
    ${resp}=    PUT On Session    ${user}[alias]    /workspaces/${ws}/modules/subcontracting    json=${body}
    ...    expected_status=${status}
    RETURN    ${resp}

Add Project Member Via API
    [Documentation]    A second user of the buyer's workspace with ``${role}`` (viewer, estimator …).
    [Arguments]    ${buyer}    ${role}
    ${user}=    Register User Via API    sc-${role}
    VAR    &{invite}    email=${user}[email]    role=${role}
    ${resp}=    POST On Session    ${buyer}[user][alias]    /workspaces/${buyer}[ws]/invitations    json=${invite}
    ...    expected_status=201
    VAR    &{accept}    token=${resp.json()}[token]
    POST On Session    ${user}[alias]    /invitations/accept    json=${accept}    expected_status=200
    RETURN    ${user}

Create Crew Entry Via API
    [Documentation]    A crew in the buyer's vendor list (unique phone). Returns ``&{crew}``: entry_id, name, phone.
    [Arguments]    ${buyer}    ${name}=${EMPTY}    ${phone}=${EMPTY}
    ${crew_name}=    Run Keyword If    '${name}' == '${EMPTY}'    Unique Name    ทีมช่าง    ELSE    Set Variable    ${name}
    ${crew_phone}=    Run Keyword If    '${phone}' == '${EMPTY}'    Unique Thai Phone    ELSE    Set Variable    ${phone}
    VAR    @{trades}    masonry
    VAR    &{body}    displayName=${crew_name}    phone=${crew_phone}    trades=${trades}    province=นนทบุรี
    ${resp}=    POST On Session    ${buyer}[user][alias]    /workspaces/${buyer}[ws]/vendor-list    json=${body}
    ...    expected_status=201
    VAR    &{crew}    entry_id=${resp.json()}[id]    name=${crew_name}    phone=${crew_phone}
    RETURN    ${crew}

Package Body
    [Documentation]    ``CreatePackageRequest`` of the masonry package (7 rows, labour only, unit prices).
    [Arguments]    ${title}=${MASONRY_TITLE}    ${line_keys}=${MASONRY_KEYS}    ${pricing}=unit    ${days_ahead}=7
    ${deadline}=    Future Iso Time    ${days_ahead}
    ${valid}=    Future Day    ${{ int($days_ahead) + 20 }}
    ${start}=    Future Day    ${{ int($days_ahead) + 3 }}
    ${finish}=    Future Day    ${{ int($days_ahead) + 33 }}
    VAR    &{provisions}    water=buyer    power=buyer    lodging=vendor    scaffolding=vendor
    VAR    @{questions}
    VAR    &{penalty}    kind=none
    VAR    &{terms}    retentionPct=${0.05}    warrantyMonths=${12}    penalty=${penalty}    provisions=${provisions}
    ...    safetyNote=${EMPTY}    questions=${questions}
    VAR    &{schedule}    start=${start}    finish=${finish}    days=${30}
    VAR    &{i1}    no=${1}    pct=${0.3}    condition=ก่ออิฐเสร็จ
    VAR    &{i2}    no=${2}    pct=${0.4}    condition=ฉาบเสร็จ
    VAR    &{i3}    no=${3}    pct=${0.3}    condition=ส่งมอบงาน
    VAR    @{installments}    ${i1}    ${i2}    ${i3}
    VAR    &{location}    district=บางกรวย    province=นนทบุรี    address=99/1 ถนนบางกรวย-ไทรน้อย
    VAR    @{custom}
    VAR    &{by_line}
    VAR    &{body}    title=${title}    trade=masonry    lineKeys=${line_keys}    customLines=${custom}
    ...    supplyMode=labour_only    materialByLine=${by_line}    pricingMode=${pricing}    sourcingMode=rfq
    ...    terms=${terms}    schedule=${schedule}    installments=${installments}    location=${location}
    ...    hideOwnerIdentity=${True}    bidDeadline=${deadline}    priceValidUntil=${valid}
    ...    description=บ้านชั้นเดียว ตามแบบที่แนบ
    RETURN    ${body}

Future Iso Time
    [Arguments]    ${days}
    ${t}=    Evaluate    (__import__('datetime').datetime.now(__import__('datetime').timezone.utc) + __import__('datetime').timedelta(days=int($days))).strftime('%Y-%m-%dT%H:%M:00.000Z')
    RETURN    ${t}

Future Day
    [Arguments]    ${days}
    ${t}=    Evaluate    (__import__('datetime').date.today() + __import__('datetime').timedelta(days=int($days))).isoformat()
    RETURN    ${t}

Create Package Via API
    [Documentation]    Draft package in the buyer's project. Returns the ``BuyerPackageDto``.
    [Arguments]    ${buyer}    ${title}=${MASONRY_TITLE}    ${line_keys}=${MASONRY_KEYS}    ${pricing}=unit    ${status}=201
    ${body}=    Package Body    ${title}    ${line_keys}    ${pricing}
    ${resp}=    POST On Session    ${buyer}[user][alias]    /projects/${buyer}[project_id]/subcontracting/packages
    ...    json=${body}    expected_status=${status}
    RETURN    ${resp}

Invite Crews Via API
    [Documentation]    Send the package to ``@{crews}`` (channel link). Returns ``&{links}``: crew name -> ``&{link}``
    ...    (url, token, invitation_id).
    [Arguments]    ${buyer}    ${package_id}    ${channel}    @{crews}
    VAR    @{entries}
    FOR    ${crew}    IN    @{crews}
        VAR    &{entry}    vendorListEntryId=${crew}[entry_id]    channel=${channel}
        Append To List    ${entries}    ${entry}
    END
    VAR    &{body}    entries=${entries}
    ${resp}=    POST On Session    ${buyer}[user][alias]    /subcontracting/packages/${package_id}/invitations
    ...    json=${body}    expected_status=201
    VAR    &{links}
    FOR    ${link}    IN    @{resp.json()}[links]
        ${token}=    Token Of Url    ${link}[url]
        ${inv}=    Invitation Row By Id    ${link}[invitationId]
        VAR    &{one}    url=${link}[url]    token=${token}    invitation_id=${link}[invitationId]
        Set To Dictionary    ${links}    ${inv}[display_name]=${one}
    END
    RETURN    ${links}

Token Of Url
    [Arguments]    ${url}
    ${token}=    Evaluate    $url.rstrip('/').rsplit('/', 1)[-1]
    RETURN    ${token}

Open Package With Crews Via API
    [Documentation]    The usual start of a crew test: a package (7 masonry rows) sent by link to ``${count}`` fresh crews.
    ...    Returns ``&{pkg}``: id, crews (list of ``&{crew}`` with url, token, invitation_id added), lines.
    [Arguments]    ${buyer}    ${count}=2    ${channel}=link
    ${resp}=    Create Package Via API    ${buyer}
    ${package_id}=    Set Variable    ${resp.json()}[id]
    VAR    @{crews}
    FOR    ${i}    IN RANGE    ${count}
        ${crew}=    Create Crew Entry Via API    ${buyer}
        Append To List    ${crews}    ${crew}
    END
    ${links}=    Invite Crews Via API    ${buyer}    ${package_id}    ${channel}    @{crews}
    FOR    ${crew}    IN    @{crews}
        ${one}=    Get From Dictionary    ${links}    ${crew}[name]
        Set To Dictionary    ${crew}    &{one}
    END
    VAR    &{pkg}    id=${package_id}    crews=${crews}    lines=${resp.json()}[lines]
    RETURN    ${pkg}

Package Lines Via API
    [Arguments]    ${buyer}    ${package_id}
    ${resp}=    GET On Session    ${buyer}[user][alias]    /subcontracting/packages/${package_id}    expected_status=200
    RETURN    ${resp.json()}[lines]

Expected Bid Total
    [Documentation]    Sum over every package line of ``round2(unit price * qtyPriced)`` (labour only) minus discount, with
    ...    the app's satang rounding (``round2`` of snapshot.ts: half away from zero on the decimal value, so 512.565 →
    ...    512.57). ``${prices}`` is the unit price typed per line, in line order.
    [Arguments]    ${lines}    ${prices}    ${discount}=0
    ${total}=    Bid Total Like The App    ${lines}    ${prices}    ${discount}
    RETURN    ${total}

# ── crew through the API (state set-up) ──────────────────────────────────────────────────────
Crew Otp Sign In Via API
    [Documentation]    New crew account: request the OTP, read it from the log, verify (new phone: names are required).
    ...    Returns ``&{vendor}``: alias, token, workspace_id, user_id.
    [Arguments]    ${crew}    ${invitation_token}=${EMPTY}
    ${e164}=    To E164 Thai    ${crew}[phone]
    ${alias}=    Unique Suffix
    ${ip}=    Random Test Ip
    Create Session    ${alias}    ${API_URL}    verify=${False}    disable_warnings=1    headers=${{ {'X-Forwarded-For': $ip} }}
    VAR    &{request}    phone=${e164}
    POST On Session    ${alias}    /auth/otp/request    json=${request}    expected_status=204
    ${code}=    Latest Otp To    ${crew}[phone]
    VAR    &{body}    phone=${e164}    code=${code}    displayName=ช่าง ${crew}[name]    teamName=${crew}[name]
    IF    '${invitation_token}' != '${EMPTY}'    Set To Dictionary    ${body}    invitationToken=${invitation_token}
    ${resp}=    POST On Session    ${alias}    /auth/otp/verify    json=${body}    expected_status=200
    Update Session    ${alias}    headers=${{ {'X-Forwarded-For': $ip, 'Authorization': 'Bearer ' + $resp.json()['accessToken']} }}
    VAR    &{vendor}    alias=${alias}    token=${resp.json()}[accessToken]    workspace_id=${resp.json()}[vendorWorkspaceId]
    ...    user_id=${resp.json()}[user][id]
    RETURN    ${vendor}

Random Test Ip
    ${ip}=    Evaluate    '10.' + '.'.join(str(__import__('random').randint(1, 254)) for _ in range(3))
    RETURN    ${ip}

Submit Bid Via API
    [Documentation]    Crew bids ``${price}`` per unit on every line (labour only). Returns the response.
    [Arguments]    ${vendor}    ${invitation_id}    ${lines}    ${price}    ${status}=201    ${days}=28
    VAR    @{bid_lines}
    FOR    ${line}    IN    @{lines}
        VAR    &{one}    idx=${line}[idx]    unitPrice=${{ float($price) }}    matUnitPrice=${None}    excluded=${False}    reason=${EMPTY}
        Append To List    ${bid_lines}    ${one}
    END
    ${valid}=    Future Day    40
    ${start}=    Future Day    12
    VAR    @{answers}
    VAR    @{photos}
    VAR    &{body}    mode=unit    lines=${bid_lines}    lumpTotal=${None}    adjustment=${0}    adjustmentNote=${EMPTY}
    ...    inclusions=${EMPTY}    days=${{ int($days) }}    earliestStart=${start}    crewSkilled=${4}    crewLabourers=${2}
    ...    validUntil=${valid}    installmentsProposal=${None}    answers=${answers}    note=${EMPTY}    photoFileIds=${photos}
    ${resp}=    POST On Session    ${vendor}[alias]    /vendor/invitations/${invitation_id}/bid    json=${body}
    ...    expected_status=${status}
    RETURN    ${resp}

Award Whole Package Via API
    [Documentation]    Award every line to ``${bid_id}``. ``${status}`` is the expected HTTP status.
    [Arguments]    ${buyer}    ${package_id}    ${lines}    ${bid_id}    ${status}=200
    VAR    @{allocations}
    FOR    ${line}    IN    @{lines}
        VAR    &{one}    idx=${line}[idx]    bidId=${{ str($bid_id) }}
        Append To List    ${allocations}    ${one}
    END
    VAR    &{from}
    VAR    &{body}    allocations=${allocations}    installmentsFrom=${from}    note=${EMPTY}
    ${resp}=    POST On Session    ${buyer}[user][alias]    /subcontracting/packages/${package_id}/award    json=${body}
    ...    expected_status=${status}
    RETURN    ${resp}

# ── database rows ────────────────────────────────────────────────────────────────────────────
Package Row
    [Arguments]    ${package_id}
    ${row}=    Query Row    select * from sc_work_packages where id = %s    ${package_id}
    RETURN    ${row}

Package Row By Title
    [Documentation]    The one package of a project with this title.
    [Arguments]    ${project_id}    ${title}
    ${row}=    Query Row    select * from sc_work_packages where project_id = %s and title = %s    ${project_id}    ${title}
    RETURN    ${row}

Package Status Should Be
    [Arguments]    ${package_id}    ${status}
    ${row}=    Package Row    ${package_id}
    Should Be Equal    ${row}[status]    ${status}

Invitation Row By Id
    [Arguments]    ${invitation_id}
    ${row}=    Query Row    select * from sc_invitations where id = %s    ${invitation_id}
    RETURN    ${row}

Invitation Row
    [Documentation]    The invitation of crew ``${name}`` on a package.
    [Arguments]    ${package_id}    ${name}
    ${row}=    Query Row    select * from sc_invitations where package_id = %s and display_name = %s    ${package_id}    ${name}
    RETURN    ${row}

Invitation Status Should Be
    [Arguments]    ${package_id}    ${name}    ${status}
    ${row}=    Invitation Row    ${package_id}    ${name}
    Should Be Equal    ${row}[status]    ${status}    msg=Invitation of ${name}: ${row}[status]

Bid Rows
    [Documentation]    Every bid version of an invitation, oldest first.
    [Arguments]    ${invitation_id}
    ${rows}=    Query Rows    select * from sc_bids where invitation_id = %s order by version    ${invitation_id}
    RETURN    ${rows}

Latest Bid Row
    [Arguments]    ${invitation_id}
    ${rows}=    Bid Rows    ${invitation_id}
    Should Not Be Empty    ${rows}    msg=No bid for invitation ${invitation_id}
    RETURN    ${rows}[-1]

Bid Count Should Be
    [Arguments]    ${invitation_id}    ${count}
    ${rows}=    Bid Rows    ${invitation_id}
    Length Should Be    ${rows}    ${count}

Award Count Should Be
    [Arguments]    ${package_id}    ${count}
    ${n}=    Query Value    select count(*) from sc_awards where package_id = %s    ${package_id}
    Should Be Equal As Integers    ${n}    ${count}

Subcontract Rows
    [Arguments]    ${package_id}
    ${rows}=    Query Rows    select * from sc_subcontracts where package_id = %s order by created_at    ${package_id}
    RETURN    ${rows}

Subcontract Row
    [Documentation]    The one contract of a package.
    [Arguments]    ${package_id}
    ${rows}=    Subcontract Rows    ${package_id}
    Length Should Be    ${rows}    1
    RETURN    ${rows}[0]

# ── browser contexts ─────────────────────────────────────────────────────────────────────────
Open Buyer Context
    [Documentation]    Desktop context (own ``X-Forwarded-For``), signed in through /login with the buyer's e-mail and
    ...    password, with the buyer's project open (the module pages work on the open project).
    [Arguments]    ${buyer}    ${user}=${None}
    ${who}=    Set Variable If    $user is None    ${buyer}[user]    ${user}
    ${ip}=    Random Test Ip
    VAR    &{viewport}    width=1440    height=900
    VAR    &{headers}    X-Forwarded-For=${ip}
    ${ctx}=    New Context    locale=th-TH    timezoneId=Asia/Bangkok    viewport=${viewport}    extraHTTPHeaders=${headers}
    New Page    ${BASE_URL}/login    wait_until=domcontentloaded
    Fill Text    internal:label="อีเมล"s    ${who}[email]
    Fill Text    internal:label="รหัสผ่าน"s    ${who}[password]
    Click    css=form button[type="submit"]
    Wait For Elements State    text="เข้าสู่ระบบอยู่แล้ว"    visible    timeout=120s
    Open Buyer Project    ${buyer}[project_name]
    RETURN    ${ctx}

Open Buyer Project
    [Documentation]    /projects → open the project card → the journey page (the project is bound in the browser).
    [Arguments]    ${project_name}
    Client Navigate    /projects
    Click    css=button[title="${project_name}"]
    Wait Until Keyword Succeeds    90s    500ms    Url Should Contain    /journey
    Wait For Load State    networkidle    timeout=60s

Open Crew Context
    [Documentation]    Phone-size context (390x844, Thai, own ``X-Forwarded-For``) with a page on ``${path}``.
    [Arguments]    ${path}=/vendor
    ${ip}=    Random Test Ip
    VAR    &{viewport}    width=${PHONE_VIEWPORT_W}    height=${PHONE_VIEWPORT_H}
    VAR    &{headers}    X-Forwarded-For=${ip}
    ${ctx}=    New Context    locale=th-TH    timezoneId=Asia/Bangkok    viewport=${viewport}    extraHTTPHeaders=${headers}
    New Page    ${BASE_URL}${path}    wait_until=domcontentloaded
    Wait For Load State    networkidle    timeout=60s
    RETURN    ${ctx}

Client Navigate
    [Documentation]    In-app navigation without a reload (the open cloud project lives only in memory).
    [Arguments]    ${path}
    Evaluate JavaScript    ${None}    () => { window.next.router.push("${path}"); }
    Wait Until Keyword Succeeds    120s    500ms    Url Should Contain    ${path}
    Wait For Load State    networkidle    timeout=60s

Open Subcontracting Home
    Client Navigate    /subcontracting
    Wait For Elements State    role=heading[name="จ้างช่วง"]    visible    timeout=60s

# ── buyer: wizard ────────────────────────────────────────────────────────────────────────────
Start Package Wizard
    [Documentation]    /subcontracting/packages/new with the masonry template ticked (7 rows).
    Client Navigate    /subcontracting/packages/new
    Wait For Elements State    text="งานที่จะจ้าง"    visible    timeout=60s

Pick Masonry Template
    Click    text="${MASONRY_TEMPLATE}"
    Wait For Elements State    text=/เลือก ${MASONRY_ROW_COUNT} รายการ/    visible

Wizard Selected Count Should Be
    [Arguments]    ${count}
    Wait For Elements State    text=/เลือก ${count} รายการ/    visible

Go To Wizard Next Step
    Click    role=button[name="ถัดไป"]

Fill Package Terms
    [Documentation]    Step 2: name and scope text.
    [Arguments]    ${title}    ${description}
    Wait For Elements State    text="ข้อมูลที่ผู้รับเห็น"    visible
    Fill Text    css=input[maxlength="160"]    ${title}
    Fill Text    css=textarea[maxlength="4000"]    ${description}

Add Crew In Wizard
    [Documentation]    Step 3 quick add: name + phone -> saved to the vendor list and ticked.
    [Arguments]    ${name}    ${phone}
    Fill Text    css=[aria-label="ชื่อทีมช่างใหม่"]    ${name}
    Fill Text    css=[aria-label="เบอร์โทรทีมช่างใหม่"]    ${phone}
    Click    ${QUICK_ADD_BUTTON}
    Toast Should Show    เพิ่ม ${name} แล้ว

Send Wizard Invitations
    [Documentation]    Click "ส่งคำเชิญ N ราย"; returns ``&{links}`` name -> url read from the one-time links dialog.
    [Arguments]    ${count}
    Click    role=button[name="ส่งคำเชิญ ${count} ราย"]
    Wait For Elements State    css=.ant-modal >> text="ส่งคำเชิญแล้ว"    visible    timeout=30s
    ${rows}=    Evaluate JavaScript    css=.ant-modal
    ...    (el) => [...el.querySelectorAll('.divide-y > div')].map(r => ({name: r.querySelector('.font-medium').innerText, url: (r.querySelector('.text-caption').innerText.match(/https?:\\/\\/\\S+/) || [''])[0]}))
    VAR    &{links}
    FOR    ${row}    IN    @{rows}
        Set To Dictionary    ${links}    ${row}[name]=${row}[url]
    END
    Click    css=.ant-modal >> role=button[name="เสร็จแล้ว"]
    Wait For Elements State    css=.ant-modal    detached    timeout=15s
    RETURN    ${links}

Create Package Through Wizard
    [Documentation]    Whole wizard in the browser with the masonry template: returns ``&{links}`` (name -> url) for
    ...    ``@{crews}`` given as ``&{crew}`` (name, phone). The package page opens at the end.
    [Arguments]    ${title}    ${description}    @{crews}
    Start Package Wizard
    Pick Masonry Template
    Go To Wizard Next Step
    Fill Package Terms    ${title}    ${description}
    Go To Wizard Next Step
    Wait For Elements State    text="ผู้รับคำเชิญ"    visible
    FOR    ${crew}    IN    @{crews}
        Add Crew In Wizard    ${crew}[name]    ${crew}[phone]
    END
    ${count}=    Get Length    ${crews}
    ${links}=    Send Wizard Invitations    ${count}
    RETURN    ${links}

# ── buyer: package and leveling pages ─────────────────────────────────────────────────────────
Open Package Page
    [Arguments]    ${package_id}
    Client Navigate    /subcontracting/packages/${package_id}
    Wait For Elements State    role=tab[name="รายการงาน (${MASONRY_ROW_COUNT})"]    visible    timeout=60s

Open Leveling Page
    [Arguments]    ${package_id}
    Client Navigate    /subcontracting/packages/${package_id}/leveling
    Wait For Elements State    css=table    visible    timeout=60s

Leveling Totals
    [Documentation]    ``&{totals}``: bidder name -> the total row ("รวม") of the comparison table, as a number.
    ${rows}=    Evaluate JavaScript    css=table
    ...    (t) => { const names = [...t.querySelectorAll('thead tr:first-child th')].filter(h => h.colSpan === 3).map(h => h.querySelector('.font-semibold').innerText); const row = [...t.querySelectorAll('tfoot tr')].find(r => r.firstElementChild.innerText.trim() === 'รวม'); const cells = [...row.children].slice(3).map(c => c.innerText); return names.map((n, i) => ({name: n, total: cells[i]})); }
    VAR    &{totals}
    FOR    ${row}    IN    @{rows}
        ${value}=    Parse Thai Number    ${row}[total]
        Set To Dictionary    ${totals}    ${row}[name]=${value}
    END
    RETURN    ${totals}

Award Whole Package In Leveling
    [Documentation]    Pick ``${name}`` for the whole package, open the summary and press "ตกลงจ้าง" ``${clicks}`` time(s)
    ...    quickly (a double click when 2).
    [Arguments]    ${name}    ${clicks}=1
    Click    css=[aria-label="เลือก ${name} ทั้งแพ็กเกจ"]
    Click    role=button[name="ตกลงจ้าง"]
    Wait For Elements State    css=.ant-modal >> text="สรุปก่อนตกลงจ้าง"    visible
    Click With Options    css=.ant-modal >> role=button[name="ตกลงจ้าง"]    clickCount=${clicks}

# ── crew phone app ────────────────────────────────────────────────────────────────────────────
Crew Request Code
    [Documentation]    On /vendor/login type the phone and press "ขอรหัส": the code step shows.
    [Arguments]    ${phone}
    Fill Text    ${PHONE_FIELD}    ${phone}
    Click    role=button[name="ขอรหัส"]
    Wait For Elements State    ${CODE_FIELD}    visible    timeout=30s

Crew Enter Code
    [Arguments]    ${code}
    Fill Text    ${CODE_FIELD}    ${code}

Crew Sign In With Otp
    [Documentation]    Crew opens ``${path}``(login page link) , asks for the code, types the one from the API log, and
    ...    (new phone) gives name and team. Ends after "เข้าใช้งาน" is pressed.
    [Arguments]    ${crew}    ${new_account}=${True}
    IF    ${new_account}
        Crew Request Code    ${crew}[phone]
    ELSE
        Crew Request Code Retrying    ${crew}[phone]
    END
    ${code}=    Latest Otp To    ${crew}[phone]
    Crew Enter Code    ${code}
    IF    ${new_account}
        Fill Text    internal:label="ชื่อผู้ติดต่อ"s    ช่าง ${crew}[name]
        Fill Text    internal:label="ชื่อทีม / ชื่อร้าน"i    ${crew}[name]
    END
    Click    role=button[name="เข้าใช้งาน"]

Crew Opens Link And Signs In
    [Documentation]    Link -> "เสนอราคา" -> login -> OTP -> lands on the invitation page ("ใบเสนอราคา" tab).
    [Arguments]    ${crew}    ${new_account}=${True}
    Go To Path    /s/${crew}[token]
    Click    role=button[name="เสนอราคา"]
    Wait For Elements State    ${PHONE_FIELD}    visible    timeout=30s
    Crew Sign In With Otp    ${crew}    ${new_account}
    Wait For Elements State    role=button[name="ส่งราคา"]    visible    timeout=60s

Crew Types Prices
    [Documentation]    One unit price per line, in line order (the price boxes are named "ราคาต่อ<unit>").
    [Arguments]    @{prices}
    ${boxes}=    Get Elements    css=input[aria-label^="ราคาต่อ"]
    ${n}=    Get Length    ${boxes}
    ${m}=    Get Length    ${prices}
    Should Be Equal As Integers    ${n}    ${m}    msg=The bid form has ${n} price boxes, ${m} prices given
    FOR    ${i}    ${price}    IN ENUMERATE    @{prices}
        Fill Text    css=input[aria-label^="ราคาต่อ"] >> nth=${i}    ${price}
    END

Crew Form Total Should Be
    [Documentation]    The "ยอดรวม" figure at the bottom of the bid form.
    [Arguments]    ${expected}
    Wait Until Keyword Succeeds    10s    250ms    Crew Form Total Is    ${expected}

Crew Form Total Is
    [Arguments]    ${expected}
    ${text}=    Get Text    css=[class*="text-card-title"] >> nth=-1
    Numbers Should Be Close    ${text}    ${expected}    0.01

Crew Presses Send Bid
    [Documentation]    "ส่งราคา" then the confirmation sheet. ``${confirm}`` False stops at the sheet.
    [Arguments]    ${confirm}=${True}
    Click    role=button[name="ส่งราคา"]
    Wait For Elements State    text="ตรวจก่อนส่งราคา"    visible
    IF    ${confirm}
        Click    role=button[name="ยืนยันส่งราคา"]
        Toast Should Show    ส่งราคาแล้ว
        Let Toasts Go
    END

Crew Submits Bid
    [Documentation]    Types the prices and sends; the submitted bid page shows.
    [Arguments]    @{prices}
    Crew Types Prices    @{prices}
    Crew Presses Send Bid
    Wait For Elements State    text=/ราคาที่ส่ง ฉบับที่/    visible    timeout=30s

Page Should Not Scroll Sideways
    [Documentation]    No horizontal scrollbar on the page (the document is not wider than the viewport).
    ${over}=    Evaluate JavaScript    ${None}    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    Should Be True    ${over} <= 1    msg=The page is ${over}px wider than the screen

Element Should Be Inside Viewport
    [Documentation]    The element is visible and fully on screen (not cut off by the bottom of the phone). Retries for a few
    ...    seconds: a bottom sheet slides in from below the screen.
    [Arguments]    ${selector}
    Wait For Elements State    ${selector}    visible
    Wait Until Keyword Succeeds    5s    200ms    Element Is Inside Viewport Now    ${selector}

Element Is Inside Viewport Now
    [Arguments]    ${selector}
    ${box}=    Evaluate JavaScript    ${selector}
    ...    (el) => { const r = el.getBoundingClientRect(); return { inside: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth, rect: [r.left, r.top, r.right, r.bottom].map(Math.round).join(','), screen: window.innerWidth + 'x' + window.innerHeight }; }
    Should Be True    ${box}[inside]    msg=${selector} is not fully inside the screen: left,top,right,bottom = ${box}[rect], screen ${box}[screen]

# ── composed set-ups ──────────────────────────────────────────────────────────────────────────
Crews Have Bid Via API
    [Documentation]    Both crews of ``${pkg}`` sign in (API) and bid ``${price1}`` / ``${price2}`` per unit on every row.
    ...    Returns ``[total1, total2]`` (computed here).
    [Arguments]    ${pkg}    ${lines}    ${price1}    ${price2}
    ${c1}=    Set Variable    ${pkg}[crews][0]
    ${c2}=    Set Variable    ${pkg}[crews][1]
    ${v1}=    Crew Otp Sign In Via API    ${c1}    ${c1}[token]
    ${v2}=    Crew Otp Sign In Via API    ${c2}    ${c2}[token]
    ${i1}=    Invitation Row    ${pkg}[id]    ${c1}[name]
    ${i2}=    Invitation Row    ${pkg}[id]    ${c2}[name]
    Submit Bid Via API    ${v1}    ${i1}[id]    ${lines}    ${price1}
    Submit Bid Via API    ${v2}    ${i2}[id]    ${lines}    ${price2}
    Set To Dictionary    ${c1}    vendor=${v1}
    Set To Dictionary    ${c2}    vendor=${v2}
    @{p1}=    Evaluate    [$price1] * len($lines)
    @{p2}=    Evaluate    [$price2] * len($lines)
    ${t1}=    Expected Bid Total    ${lines}    ${p1}
    ${t2}=    Expected Bid Total    ${lines}    ${p2}
    RETURN    ${t1}    ${t2}

Active Contract Via API
    [Documentation]    One crew invited, signed in, bids 100/unit, is awarded and accepts: an active contract.
    ...    Returns ``&{run}``: pkg, crew, vendor, lines, sc_id, total.
    [Arguments]    ${buyer}
    ${pkg}=    Open Package With Crews Via API    ${buyer}    1
    ${crew}=    Set Variable    ${pkg}[crews][0]
    ${lines}=    Package Lines Via API    ${buyer}    ${pkg}[id]
    ${vendor}=    Crew Otp Sign In Via API    ${crew}    ${crew}[token]
    ${inv}=    Invitation Row    ${pkg}[id]    ${crew}[name]
    ${bid}=    Submit Bid Via API    ${vendor}    ${inv}[id]    ${lines}    100
    Award Whole Package Via API    ${buyer}    ${pkg}[id]    ${lines}    ${bid.json()}[id]
    ${sc}=    Subcontract Row    ${pkg}[id]
    ${doc}=    GET On Session    ${vendor}[alias]    /subcontracting/subcontracts/${sc}[id]    expected_status=200
    VAR    &{accept}    documentVersion=${doc.json()}[documentVersion]
    POST On Session    ${vendor}[alias]    /subcontracting/subcontracts/${sc}[id]/accept    json=${accept}    expected_status=200
    VAR    &{run}    pkg=${pkg}    crew=${crew}    vendor=${vendor}    lines=${lines}    sc_id=${sc}[id]    total=${bid.json()}[total]
    RETURN    ${run}

Let Toasts Go
    [Documentation]    The mouse rests where the last click was and keeps an Ant Design toast open (pause on hover):
    ...    move it to the screen edge and wait until no toast is left, so the next click is not intercepted.
    Mouse Move    2    300
    Wait For Elements State    css=.ant-message-notice    detached    timeout=15s

Url Should Not Be Login
    ${url}=    Get Url
    Should Not Contain    ${url}    /login

Toast Should Show
    [Documentation]    Like ``Message Should Appear`` with a longer wait (the dev server can be slow).
    [Arguments]    ${text}
    Wait For Elements State    css=.ant-message-notice, .ant-notification-notice >> text=${text}    visible    timeout=30s

Crew Request Code Retrying
    [Documentation]    The API allows one code per phone per minute: a crew that was just signed in through the API
    ...    asks again until the quota lets the request through (the code step shows).
    [Arguments]    ${phone}
    Wait Until Keyword Succeeds    100s    3s    Crew Request Code Once    ${phone}

Crew Request Code Once
    [Arguments]    ${phone}
    Fill Text    ${PHONE_FIELD}    ${phone}
    Click    role=button[name="ขอรหัส"]
    Wait For Elements State    ${CODE_FIELD}    visible    timeout=4s

Url Should Contain
    [Arguments]    ${part}
    ${url}=    Get Url
    Should Contain    ${url}    ${part}
