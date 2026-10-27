*** Settings ***
Documentation       A2 projects core: create (blank, sample, upload of a guest project), list, detail, rename,
...                 archive and restore, delete. Every write is read back from PostgreSQL (``projects``,
...                 ``project_docs``, ``activity_log``). Roles: owner, admin, estimator, viewer, outsider.
Resource            ../../resources/pages/api_projects.resource
Test Tags           api    projects    db


*** Test Cases ***
# ── create ─────────────────────────────────────────────────────────────────────────
Create Blank Project Answers 201 With Its Seeded Header Document
    [Documentation]    Blank start: 201, the name is stored, ``meta`` is seeded at version 1 with the project name,
    ...    and the rows are in ``projects`` and ``project_docs``.
    [Tags]    smoke
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank    Blank house
    Should Be Equal    ${detail}[project][name]    Blank house
    Should Be Equal    ${detail}[project][start]    blank
    Should Be Equal    ${detail}[project][engineVersion]    excel-v5
    Should Be Equal    ${detail}[project][createdBy]    ${team}[owner][id]
    Should Be Equal    ${detail}[project][workspaceId]    ${team}[ws]
    Should Be Equal    ${detail}[project][archivedAt]    ${NONE}
    Should Be Equal As Integers    ${detail}[project][summary][levelsDone]    0
    Should Be Equal As Integers    ${detail}[project][summary][levelsTotal]    37
    Length Should Be    ${detail}[docs]    1
    Should Be Equal    ${detail}[docs][0][docKey]    meta
    Should Be Equal As Integers    ${detail}[docs][0][version]    1
    Should Be Equal    ${detail}[docs][0][data][projectName]    Blank house
    ${row}=    Project Row    ${detail}[project][id]
    Should Be Equal    ${row}[name]    Blank house
    Should Be Equal    ${row}[start]    blank
    Should Be Equal    ${row}[archived_at]    ${NONE}
    ${doc}=    Project Doc Row    ${detail}[project][id]    meta
    Should Be Equal As Integers    ${doc}[version]    1
    Should Be Equal    ${doc}[data][projectName]    Blank house

Create Sample Project Total Is The Excel Sample House
    [Documentation]    Business rule (Excel v5 sample house): construction total = 1,855,162.25 baht. The stored
    ...    summary also equals the BOQ engine on a new sample project.
    [Tags]    smoke
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    sample
    ${engine}=    Compute Expected For New Project    sample
    Numbers Should Be Close    ${detail}[project][summary][constructionTotal]    ${SAMPLE_TOTAL}    0.01
    Numbers Should Be Close    ${detail}[project][summary][constructionTotal]    ${engine}[constructionTotal]    0.001
    Numbers Should Be Close    ${detail}[project][summary][preConstructionTotal]    ${engine}[preConstructionTotal]    0.001
    ${row}=    Project Row    ${detail}[project][id]
    Numbers Should Be Close    ${row}[summary][constructionTotal]    ${SAMPLE_TOTAL}    0.01

Create Blank Project Total Equals The Engine
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank
    ${engine}=    Compute Expected For New Project    blank
    Numbers Should Be Close    ${detail}[project][summary][constructionTotal]    ${engine}[constructionTotal]    0.001

Project Name Is Trimmed
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank    ${SPACE}${SPACE}Trim me${SPACE}
    Should Be Equal    ${detail}[project][name]    Trim me
    ${row}=    Project Row    ${detail}[project][id]
    Should Be Equal    ${row}[name]    Trim me

Project Name Of 160 Characters Is Accepted
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${name}=    Evaluate    'ก' * 160
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank    ${name}
    ${row}=    Project Row    ${detail}[project][id]
    Length Should Be    ${row}[name]    160

Project Name Of 161 Characters Is Rejected
    [Tags]    edge    negative
    ${team}=    Create Owner Workspace
    ${name}=    Evaluate    'x' * 161
    VAR    &{body}    name=${name}    start=blank
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Project Name With One Character Is Accepted
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank    x
    Should Be Equal    ${detail}[project][name]    x

Empty Project Name Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    VAR    &{body}    name=${EMPTY}    start=blank
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Whitespace Only Project Name Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    VAR    &{body}    name=${SPACE}${SPACE}${SPACE}    start=blank
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Missing Project Name Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    VAR    &{body}    start=blank
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Non Text Project Name Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    VAR    &{body}    name=${123}    start=blank
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Thai Project Name Is Stored Exactly
    ${team}=    Create Owner Workspace
    ${name}=    Set Variable    บ้านพักอาศัย ๒ ชั้น คุณสมชาย (ต่อเติม)
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank    ${name}
    ${row}=    Project Row    ${detail}[project][id]
    Should Be Equal    ${row}[name]    ${name}
    ${got}=    Get Project    ${team}[owner]    ${detail}[project][id]
    Should Be Equal    ${got.json()}[project][name]    ${name}

Emoji Project Name Is Stored Exactly
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${name}=    Set Variable    บ้าน 🏠 สวน 🌳 ✅
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank    ${name}
    ${row}=    Project Row    ${detail}[project][id]
    Should Be Equal    ${row}[name]    ${name}

Project Name With Markup And SQL Is Stored As Plain Text
    [Documentation]    Error guessing: script tags, quotes and SQL are data, never executed or altered.
    [Tags]    security    edge
    ${team}=    Create Owner Workspace
    ${name}=    Set Variable    <script>alert(1)</script>'; DROP TABLE projects;--
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank    ${name}
    ${row}=    Project Row    ${detail}[project][id]
    Should Be Equal    ${row}[name]    ${name}
    ${n}=    Query Value    select count(*) from information_schema.tables where table_name = 'projects'
    Should Be Equal As Integers    ${n}    1

Project Name With A NUL Character Is Refused Not A Server Error
    [Documentation]    Error guessing. Send name "a<NUL>b" (JSON ``\\u0000``). PostgreSQL text cannot hold NUL.
    ...    Expected: a 4xx validation answer (400 or 422). Found: check the status; a 500 is a bug.
    [Tags]    negative    edge    security    bug
    ${team}=    Create Owner Workspace
    ${name}=    Evaluate    'a' + chr(0) + 'b'
    VAR    &{body}    name=${name}    start=blank
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Invalid Start Value Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    FOR    ${start}    IN    Sample    BLANK    demo    ${EMPTY}    ${1}    ${NONE}
        VAR    &{body}    name=Bad start    start=${start}
        ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
        Error Code Should Be    ${resp}    validation_failed
    END
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Missing Start Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    VAR    &{body}    name=No start
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Create Ignores Fields The Client Must Not Set
    [Documentation]    Mass assignment: id, createdBy, archivedAt, workspaceId and summary in the body are ignored.
    [Tags]    security
    ${team}=    Create Team
    ${fake_id}=    Set Variable    11111111-1111-4111-8111-111111111111
    VAR    &{summary}    constructionTotal=${1}    preConstructionTotal=${1}    levelsDone=${37}    levelsTotal=${37}
    VAR    &{body}    name=Mass    start=blank    id=${fake_id}    createdBy=${team}[admin][id]
    ...    workspaceId=${team}[outsider][id]    archivedAt=2020-01-01T00:00:00Z    summary=${summary}
    ${resp}=    Post Project    ${team}[estimator]    ${team}[ws]    ${body}    201
    Should Not Be Equal    ${resp.json()}[project][id]    ${fake_id}
    Should Be Equal    ${resp.json()}[project][createdBy]    ${team}[estimator][id]
    Should Be Equal    ${resp.json()}[project][workspaceId]    ${team}[ws]
    Should Be Equal    ${resp.json()}[project][archivedAt]    ${NONE}
    Should Be Equal As Integers    ${resp.json()}[project][summary][levelsDone]    0

Malformed JSON Body Is A 400 Not A Server Error
    [Tags]    negative    edge
    ${team}=    Create Owner Workspace
    VAR    &{headers}    Content-Type=application/json
    ${resp}=    POST On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/projects    data={"name": "x",
    ...    headers=${headers}    expected_status=400
    Error Code Should Be    ${resp}    validation_failed

Create Without A Token Answers 401
    [Tags]    security    negative
    ${team}=    Create Owner Workspace
    Create Anonymous Session    anon
    VAR    &{body}    name=Anon    start=blank
    ${resp}=    POST On Session    anon    /workspaces/${team}[ws]/projects    json=${body}    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

Create With A Garbage Token Answers 401
    [Tags]    security    negative
    ${team}=    Create Owner Workspace
    ${alias}=    Bad Token Session
    VAR    &{body}    name=Bad    start=blank
    ${resp}=    POST On Session    ${alias}    /workspaces/${team}[ws]/projects    json=${body}    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

Create Permission Table Owner Admin Estimator Allowed Viewer Forbidden
    [Documentation]    Decision table for ``projects.create``: owner, admin, estimator 201; viewer 403; outsider 404.
    [Tags]    security
    ${team}=    Create Team
    VAR    &{body}    name=Who can create    start=blank
    FOR    ${role}    IN    owner    admin    estimator
        Post Project    ${team}[${role}]    ${team}[ws]    ${body}    201
    END
    ${resp}=    Post Project    ${team}[viewer]    ${team}[ws]    ${body}    403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Post Project    ${team}[outsider]    ${team}[ws]    ${body}    404
    Error Code Should Be    ${resp}    not_found
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    3

Create In Another Tenants Workspace Answers 404
    [Tags]    security
    ${a}=    Create Owner Workspace
    ${b}=    Create Owner Workspace
    VAR    &{body}    name=Cross tenant    start=blank
    ${resp}=    Post Project    ${a}[owner]    ${b}[ws]    ${body}    404
    Error Code Should Be    ${resp}    not_found
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${b}[ws]
    Should Be Equal As Integers    ${n}    0

Create In An Unknown Or Malformed Workspace Id Answers 404
    [Tags]    negative
    ${team}=    Create Owner Workspace
    VAR    &{body}    name=Nowhere    start=blank
    ${resp}=    Post Project    ${team}[owner]    00000000-0000-4000-8000-000000000000    ${body}    404
    Error Code Should Be    ${resp}    not_found
    ${resp}=    Post Project    ${team}[owner]    not-a-uuid    ${body}    404
    Error Code Should Be    ${resp}    not_found

Create Writes A Project Created Activity Row
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank
    ${actions}=    Activity Actions In Database    ${detail}[project][id]
    Should Be Equal    ${actions}    ${{ ['project.created'] }}
    ${row}=    Query Row    select user_id from activity_log where project_id = %s    ${detail}[project][id]
    Should Be Equal    ${row}[user_id]    ${{ __import__('uuid').UUID($team['owner']['id']) }}

# ── create from an uploaded guest project ─────────────────────────────────────────
Upload Of A Guest Project Stores Each Document At Version 1
    [Documentation]    Valid set (meta, a calculator, a BOQ override, journey): all stored at version 1 by the
    ...    uploader, and the stored total equals the BOQ engine on the same documents.
    [Tags]    smoke
    ${team}=    Create Team
    ${fill}=    Fill Input
    VAR    &{meta}    projectName=บ้านคุณสมชาย    ownerName=สมชาย
    VAR    &{r13}    mat=${350}
    VAR    &{journey}    project-info=done    land-inspection=done    demolition=skipped
    ${docs}=    Evaluate    [{'docKey': 'meta', 'data': $meta}, {'docKey': 'calc:fill', 'data': $fill}, {'docKey': 'boq:R13', 'data': $r13}, {'docKey': 'journey', 'data': $journey}]
    ${detail}=    New Project    ${team}[estimator]    ${team}[ws]    sample    Guest upload    docs=${docs}
    ${pid}=    Set Variable    ${detail}[project][id]
    Length Should Be    ${detail}[docs]    4
    FOR    ${doc}    IN    @{detail}[docs]
        Should Be Equal As Integers    ${doc}[version]    1
        Should Be Equal    ${doc}[updatedBy]    ${team}[estimator][id]
    END
    ${stored}=    Doc Data In Database    ${pid}    calc:fill
    Should Be Equal    ${stored}    ${fill}
    Should Be Equal As Integers    ${detail}[project][summary][levelsDone]    3
    ${n}=    Doc Row Count    ${pid}
    Should Be Equal As Integers    ${n}    4
    ${engine}=    Engine Expected For Stored Project    ${team}[viewer]    ${pid}
    Numbers Should Be Close    ${detail}[project][summary][constructionTotal]    ${engine}[constructionTotal]    0.01
    Should Not Be Equal As Numbers    ${detail}[project][summary][constructionTotal]    ${SAMPLE_TOTAL}

Upload Without A Meta Document Seeds One From The Project Name
    ${team}=    Create Owner Workspace
    ${fill}=    Fill Input
    ${docs}=    Evaluate    [{'docKey': 'calc:fill', 'data': $fill}]
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    sample    Seeded header    docs=${docs}
    ${meta}=    Project Doc Row    ${detail}[project][id]    meta
    Should Be Equal    ${meta}[data][projectName]    Seeded header
    ${n}=    Doc Row Count    ${detail}[project][id]
    Should Be Equal As Integers    ${n}    2

Upload With An Unknown Calculator Is Rejected And Nothing Is Stored
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${docs}=    Evaluate    [{'docKey': 'calc:no-such-calculator', 'data': {}}]
    VAR    &{body}    name=Bad upload    start=sample    docs=${docs}
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    422
    Error Code Should Be    ${resp}    unprocessable
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Upload With One Invalid Document Among Valid Ones Stores Nothing
    [Documentation]    All-or-nothing: a valid fill doc next to a bad meta field (422) leaves no project and no docs.
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${fill}=    Fill Input
    ${docs}=    Evaluate    [{'docKey': 'calc:fill', 'data': $fill}, {'docKey': 'meta', 'data': {'colour': 'red'}}]
    VAR    &{body}    name=Half bad    start=sample    docs=${docs}
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    422
    Error Code Should Be    ${resp}    unprocessable
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0
    ${n}=    Query Value    select count(*) from project_docs where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Upload With A Duplicated Document Key Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${fill}=    Fill Input
    ${docs}=    Evaluate    [{'docKey': 'calc:fill', 'data': $fill}, {'docKey': 'calc:fill', 'data': $fill}]
    VAR    &{body}    name=Twice    start=sample    docs=${docs}
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    422
    Error Code Should Be    ${resp}    unprocessable

Upload With A Document That Breaks Computing Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${docs}=    Evaluate    [{'docKey': 'calc:footing', 'data': {'rows': 'not a list'}}]
    VAR    &{body}    name=Breaking    start=sample    docs=${docs}
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    422
    Error Code Should Be    ${resp}    unprocessable

Upload With A Malformed Document Key Fails The Schema
    [Documentation]    A key that does not match the key pattern is a 400 (contract), nothing is stored.
    [Tags]    negative
    ${team}=    Create Owner Workspace
    FOR    ${key}    IN    bogus    CALC:fill    calc:    planning:other    ${EMPTY}
        ${docs}=    Evaluate    [{'docKey': $key, 'data': {}}]
        VAR    &{body}    name=Bad key    start=sample    docs=${docs}
        ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
        Error Code Should Be    ${resp}    validation_failed
    END

Upload With A Well Formed But Unknown BOQ Line Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${docs}=    Evaluate    [{'docKey': 'boq:NO-SUCH-LINE', 'data': {'qty': 1}}]
    VAR    &{body}    name=Unknown line    start=sample    docs=${docs}
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    422
    Error Code Should Be    ${resp}    unprocessable

Upload Of Exactly 2000 Documents Passes The Count Limit
    [Documentation]    Boundary: 2000 is allowed by the schema (so the answer is the semantic 422 for the duplicates,
    ...    not the 400 of the count limit); 2001 is the 400.
    [Tags]    edge    negative
    ${team}=    Create Owner Workspace
    ${docs}=    Evaluate    [{'docKey': 'meta', 'data': None}] * 2000
    VAR    &{body}    name=Two thousand    start=blank    docs=${docs}
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    422
    Error Code Should Be    ${resp}    unprocessable

Upload Of More Than 2000 Documents Is Rejected
    [Tags]    edge    negative
    ${team}=    Create Owner Workspace
    ${docs}=    Evaluate    [{'docKey': 'meta', 'data': None}] * 2001
    VAR    &{body}    name=Too many    start=blank    docs=${docs}
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed
    ${n}=    Query Value    select count(*) from projects where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Upload Docs Must Be A List Of Documents
    [Tags]    negative
    ${team}=    Create Owner Workspace
    VAR    &{body}    name=Not a list    start=blank    docs=meta
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed
    VAR    &{body}    name=Item not an object    start=blank    docs=${{ ['meta'] }}
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Upload Document Without A Data Field Is Rejected
    [Documentation]    ``data`` must be present; only ``null`` means reset.
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${docs}=    Evaluate    [{'docKey': 'calc:fill'}]
    VAR    &{body}    name=No data    start=sample    docs=${docs}
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Upload Document Larger Than The Limit Is Rejected
    [Tags]    negative    edge
    ${team}=    Create Owner Workspace
    ${note}=    Evaluate    'x' * ${MAX_DOC_BYTES}
    ${docs}=    Evaluate    [{'docKey': 'calc:fill', 'data': {'note': $note}}]
    VAR    &{body}    name=Huge doc    start=sample    docs=${docs}
    ${resp}=    Post Project    ${team}[owner]    ${team}[ws]    ${body}    422
    Error Code Should Be    ${resp}    unprocessable

Upload By A Viewer Is Forbidden
    [Tags]    security
    ${team}=    Create Team
    ${fill}=    Fill Input
    ${docs}=    Evaluate    [{'docKey': 'calc:fill', 'data': $fill}]
    VAR    &{body}    name=Viewer upload    start=sample    docs=${docs}
    ${resp}=    Post Project    ${team}[viewer]    ${team}[ws]    ${body}    403
    Error Code Should Be    ${resp}    forbidden

# ── list ───────────────────────────────────────────────────────────────────────────
List Shows Active Projects And Hides Archived Ones
    [Tags]    smoke
    ${team}=    Create Team
    ${keep}=    New Sample Project Id    ${team}    blank
    ${gone}=    New Sample Project Id    ${team}    blank
    Set Archived    ${team}[owner]    ${gone}    ${True}
    ${ids}=    List Project Ids    ${team}[viewer]    ${team}[ws]
    Should Contain    ${ids}    ${keep}
    Should Not Contain    ${ids}    ${gone}
    Length Should Be    ${ids}    1

List With Archived True Shows Only Archived Projects
    ${team}=    Create Team
    ${keep}=    New Sample Project Id    ${team}    blank
    ${gone}=    New Sample Project Id    ${team}    blank
    Set Archived    ${team}[owner]    ${gone}    ${True}
    ${ids}=    List Project Ids    ${team}[owner]    ${team}[ws]    ?archived=true
    Should Be Equal    ${ids}    ${{ [$gone] }}
    Should Not Contain    ${ids}    ${keep}

List With Archived False Equals The Default
    ${team}=    Create Owner Workspace
    ${a}=    New Sample Project Id    ${team}    blank
    ${b}=    New Sample Project Id    ${team}    blank
    Set Archived    ${team}[owner]    ${b}    ${True}
    ${default}=    List Project Ids    ${team}[owner]    ${team}[ws]
    ${explicit}=    List Project Ids    ${team}[owner]    ${team}[ws]    ?archived=false
    Should Be Equal    ${default}    ${explicit}
    Should Be Equal    ${default}    ${{ [$a] }}

List With An Invalid Archived Value Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    FOR    ${value}    IN    maybe    1    TRUE    yes
        ${resp}=    List Projects    ${team}[owner]    ${team}[ws]    ?archived=${value}    400
        Error Code Should Be    ${resp}    validation_failed
    END

List Of An Empty Workspace Is An Empty Array
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${resp}=    List Projects    ${team}[owner]    ${team}[ws]
    Should Be Equal    ${resp.json()}    ${{ [] }}
    ${resp}=    List Projects    ${team}[owner]    ${team}[ws]    ?archived=true
    Should Be Equal    ${resp.json()}    ${{ [] }}

List Is Ordered Newest Update First
    [Documentation]    Three projects; the oldest one is edited last and moves to the top.
    ${team}=    Create Owner Workspace
    ${first}=    New Sample Project Id    ${team}    blank
    ${second}=    New Sample Project Id    ${team}    blank
    ${third}=    New Sample Project Id    ${team}    blank
    ${ids}=    List Project Ids    ${team}[owner]    ${team}[ws]
    Should Be Equal    ${ids}    ${{ [$third, $second, $first] }}
    Rename Project    ${team}[owner]    ${first}    Edited last
    ${ids}=    List Project Ids    ${team}[owner]    ${team}[ws]
    Should Be Equal    ${ids}    ${{ [$first, $third, $second] }}
    ${resp}=    List Projects    ${team}[owner]    ${team}[ws]
    ${stamps}=    Evaluate    [p['updatedAt'] for p in $resp.json()]
    ${sorted}=    Evaluate    sorted($stamps, reverse=True)
    Should Be Equal    ${stamps}    ${sorted}

Document Edit Moves A Project To The Top Of The List
    ${team}=    Create Owner Workspace
    ${old}=    New Sample Project Id    ${team}
    ${new}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${old}    calc:fill    ${fill}    0
    ${ids}=    List Project Ids    ${team}[owner]    ${team}[ws]
    Should Be Equal    ${ids}    ${{ [$old, $new] }}

List Rows Match Detail And Database
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    sample    Match me
    ${resp}=    List Projects    ${team}[owner]    ${team}[ws]
    Length Should Be    ${resp.json()}    1
    Should Be Equal    ${resp.json()}[0]    ${detail}[project]
    ${row}=    Project Row    ${detail}[project][id]
    Should Be Equal    ${row}[name]    ${resp.json()}[0][name]
    Should Be Equal    ${row}[workspace_id]    ${{ __import__('uuid').UUID($team['ws']) }}

List Is Isolated Between Workspaces
    [Tags]    security
    ${a}=    Create Owner Workspace
    ${b}=    Create Owner Workspace
    ${pa}=    New Sample Project Id    ${a}    blank
    ${pb}=    New Sample Project Id    ${b}    blank
    ${ids_a}=    List Project Ids    ${a}[owner]    ${a}[ws]
    ${ids_b}=    List Project Ids    ${b}[owner]    ${b}[ws]
    Should Be Equal    ${ids_a}    ${{ [$pa] }}
    Should Be Equal    ${ids_b}    ${{ [$pb] }}
    ${resp}=    List Projects    ${a}[owner]    ${b}[ws]    expected_status=404
    Error Code Should Be    ${resp}    not_found

List Permission Table Every Member Reads Outsider Does Not
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}    blank
    FOR    ${role}    IN    owner    admin    estimator    viewer
        ${ids}=    List Project Ids    ${team}[${role}]    ${team}[ws]
        Should Contain    ${ids}    ${pid}
    END
    ${resp}=    List Projects    ${team}[outsider]    ${team}[ws]    expected_status=404
    Error Code Should Be    ${resp}    not_found

List Without A Token Answers 401
    [Tags]    security
    ${team}=    Create Owner Workspace
    Create Anonymous Session    anon
    ${resp}=    GET On Session    anon    /workspaces/${team}[ws]/projects    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

# ── detail ─────────────────────────────────────────────────────────────────────────
Detail Returns The Project And Its Documents To A Viewer
    ${team}=    Create Team
    ${fill}=    Fill Input
    ${docs}=    Evaluate    [{'docKey': 'calc:fill', 'data': $fill}]
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    sample    Detail    docs=${docs}
    ${resp}=    Get Project    ${team}[viewer]    ${detail}[project][id]
    Should Be Equal    ${resp.json()}[project]    ${detail}[project]
    ${keys}=    Evaluate    sorted(d['docKey'] for d in $resp.json()['docs'])
    Should Be Equal    ${keys}    ${{ ['calc:fill', 'meta'] }}

Detail Of An Unknown Project Answers 404
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${resp}=    Get Project    ${team}[owner]    00000000-0000-4000-8000-000000000000    404
    Error Code Should Be    ${resp}    not_found

Detail With A Malformed Id Answers 404
    [Tags]    negative    security
    ${team}=    Create Owner Workspace
    FOR    ${bad}    IN    not-a-uuid    123    %27%20OR%201=1    ..%2F..%2Fetc
        Get Project    ${team}[owner]    ${bad}    404
    END

Detail Of Another Tenants Project Answers 404 Not 403
    [Documentation]    Existence is not leaked: an outsider and a member of another workspace both get 404.
    [Tags]    security
    ${team}=    Create Team
    ${other}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    ${resp}=    Get Project    ${team}[outsider]    ${pid}    404
    Error Code Should Be    ${resp}    not_found
    ${resp}=    Get Project    ${other}[owner]    ${pid}    404
    Error Code Should Be    ${resp}    not_found

Detail Without A Token Answers 401
    [Tags]    security
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    Create Anonymous Session    anon
    ${resp}=    GET On Session    anon    /projects/${pid}    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

# ── rename ─────────────────────────────────────────────────────────────────────────
Rename Changes The Name And Is Stored
    [Tags]    smoke
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank    Old name
    ${resp}=    Rename Project    ${team}[owner]    ${detail}[project][id]    New name
    Should Be Equal    ${resp.json()}[name]    New name
    ${row}=    Project Row    ${detail}[project][id]
    Should Be Equal    ${row}[name]    New name
    ${actions}=    Activity Actions In Database    ${detail}[project][id]
    Should Be Equal    ${actions}    ${{ ['project.renamed', 'project.created'] }}

Rename Trims The Name And Accepts Thai And Emoji
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    ${resp}=    Rename Project    ${team}[owner]    ${pid}    ${SPACE}ต่อเติมครัว 🍳${SPACE}
    Should Be Equal    ${resp.json()}[name]    ต่อเติมครัว 🍳
    ${row}=    Project Row    ${pid}
    Should Be Equal    ${row}[name]    ต่อเติมครัว 🍳

Rename To The Same Name Is A No Op Without Activity
    [Documentation]    An unchanged value (also after trimming) changes nothing: no activity row, same ``updated_at``.
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank    Same name
    ${pid}=    Set Variable    ${detail}[project][id]
    ${before}=    Project Row    ${pid}
    ${count_before}=    Activity Count    ${pid}
    ${resp}=    Rename Project    ${team}[owner]    ${pid}    Same name
    Should Be Equal    ${resp.json()}[name]    Same name
    Rename Project    ${team}[owner]    ${pid}    ${SPACE}Same name${SPACE}
    ${after}=    Project Row    ${pid}
    ${count_after}=    Activity Count    ${pid}
    Should Be Equal As Integers    ${count_after}    ${count_before}
    Should Be Equal    ${after}[updated_at]    ${before}[updated_at]

Rename To An Empty Or Too Long Name Is Rejected
    [Tags]    negative    edge
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    blank    Keep me
    ${pid}=    Set Variable    ${detail}[project][id]
    ${long}=    Evaluate    'x' * 161
    FOR    ${bad}    IN    ${EMPTY}    ${SPACE}${SPACE}    ${long}
        ${resp}=    Rename Project    ${team}[owner]    ${pid}    ${bad}    400
        Error Code Should Be    ${resp}    validation_failed
    END
    ${row}=    Project Row    ${pid}
    Should Be Equal    ${row}[name]    Keep me

Rename To 160 Characters Is Accepted
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    ${name}=    Evaluate    'y' * 160
    ${resp}=    Rename Project    ${team}[owner]    ${pid}    ${name}
    Length Should Be    ${resp.json()}[name]    160

Rename With A NUL Character Is Refused Not A Server Error
    [Documentation]    Error guessing, as for create: expected a 4xx validation answer; a 500 is a bug.
    [Tags]    negative    edge    bug
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    ${name}=    Evaluate    'a' + chr(0) + 'b'
    ${resp}=    Rename Project    ${team}[owner]    ${pid}    ${name}    400
    Error Code Should Be    ${resp}    validation_failed

Update With An Empty Body Or Wrong Types Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    ${resp}=    Patch Project    ${team}[owner]    ${pid}    ${{ {} }}    400
    Error Code Should Be    ${resp}    validation_failed
    ${resp}=    Patch Project    ${team}[owner]    ${pid}    ${{ {'archived': 'yes'} }}    400
    Error Code Should Be    ${resp}    validation_failed
    ${resp}=    Patch Project    ${team}[owner]    ${pid}    ${{ {'name': None} }}    400
    Error Code Should Be    ${resp}    validation_failed

Update Ignores Fields The Client Must Not Set
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}    blank
    ${row_before}=    Project Row    ${pid}
    VAR    &{body}    name=Renamed    workspaceId=${team}[outsider][id]    createdBy=${team}[viewer][id]
    Patch Project    ${team}[estimator]    ${pid}    ${body}
    ${row}=    Project Row    ${pid}
    Should Be Equal    ${row}[created_by]    ${row_before}[created_by]
    Should Be Equal    ${row}[workspace_id]    ${row_before}[workspace_id]

Rename Permission Table Estimator Allowed Viewer Forbidden
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}    blank
    Rename Project    ${team}[estimator]    ${pid}    By estimator
    Rename Project    ${team}[admin]    ${pid}    By admin
    ${resp}=    Rename Project    ${team}[viewer]    ${pid}    By viewer    403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Rename Project    ${team}[outsider]    ${pid}    By outsider    404
    Error Code Should Be    ${resp}    not_found
    ${row}=    Project Row    ${pid}
    Should Be Equal    ${row}[name]    By admin

# ── archive and restore ────────────────────────────────────────────────────────────
Archive Sets ArchivedAt And Restore Clears It
    [Tags]    smoke
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    ${resp}=    Set Archived    ${team}[owner]    ${pid}    ${True}
    Should Not Be Equal    ${resp.json()}[archivedAt]    ${NONE}
    ${row}=    Project Row    ${pid}
    Should Not Be Equal    ${row}[archived_at]    ${NONE}
    ${resp}=    Set Archived    ${team}[owner]    ${pid}    ${False}
    Should Be Equal    ${resp.json()}[archivedAt]    ${NONE}
    ${row}=    Project Row    ${pid}
    Should Be Equal    ${row}[archived_at]    ${NONE}
    ${actions}=    Activity Actions In Database    ${pid}
    Should Be Equal    ${actions}    ${{ ['project.restored', 'project.archived', 'project.created'] }}

Archived Project Moves Between The Two Lists And Keeps Its Documents
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Set Archived    ${team}[owner]    ${pid}    ${True}
    ${active}=    List Project Ids    ${team}[owner]    ${team}[ws]
    ${archived}=    List Project Ids    ${team}[owner]    ${team}[ws]    ?archived=true
    Should Not Contain    ${active}    ${pid}
    Should Contain    ${archived}    ${pid}
    ${got}=    Get Project    ${team}[owner]    ${pid}
    Length Should Be    ${got.json()}[docs]    2
    Set Archived    ${team}[owner]    ${pid}    ${False}
    ${active}=    List Project Ids    ${team}[owner]    ${team}[ws]
    Should Contain    ${active}    ${pid}

Archiving Twice Is Idempotent And Logs Once
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    ${first}=    Set Archived    ${team}[owner]    ${pid}    ${True}
    ${second}=    Set Archived    ${team}[owner]    ${pid}    ${True}
    Should Be Equal    ${second.json()}[archivedAt]    ${first.json()}[archivedAt]
    ${actions}=    Activity Actions In Database    ${pid}
    Should Be Equal    ${actions}    ${{ ['project.archived', 'project.created'] }}

Restoring An Active Project Is A No Op Without Activity
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    ${resp}=    Set Archived    ${team}[owner]    ${pid}    ${False}
    Should Be Equal    ${resp.json()}[archivedAt]    ${NONE}
    ${actions}=    Activity Actions In Database    ${pid}
    Should Be Equal    ${actions}    ${{ ['project.created'] }}

Rename Of An Archived Project Answers 409
    [Tags]    negative    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    Set Archived    ${team}[owner]    ${pid}    ${True}
    ${resp}=    Rename Project    ${team}[owner]    ${pid}    Nope    409
    Error Code Should Be    ${resp}    conflict
    ${row}=    Project Row    ${pid}
    Should Not Be Equal    ${row}[name]    Nope
    Should Not Be Equal    ${row}[archived_at]    ${NONE}

Rename And Restore In One Request Succeeds
    [Tags]    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    Set Archived    ${team}[owner]    ${pid}    ${True}
    VAR    &{body}    name=Back again    archived=${False}
    ${resp}=    Patch Project    ${team}[owner]    ${pid}    ${body}
    Should Be Equal    ${resp.json()}[name]    Back again
    Should Be Equal    ${resp.json()}[archivedAt]    ${NONE}
    ${actions}=    Activity Actions In Database    ${pid}
    Should Be Equal    ${actions}[:2]    ${{ ['project.renamed', 'project.restored'] }}

Rename And Archive In One Request Is Accepted For An Active Project
    [Documentation]    Order in the request: the rename happens while active, then the archive.
    [Tags]    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    VAR    &{body}    name=Renamed then archived    archived=${True}
    ${resp}=    Patch Project    ${team}[owner]    ${pid}    ${body}
    Should Be Equal    ${resp.json()}[name]    Renamed then archived
    Should Not Be Equal    ${resp.json()}[archivedAt]    ${NONE}

Rename With Archived True While Already Archived Is Refused
    [Tags]    negative    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    Set Archived    ${team}[owner]    ${pid}    ${True}
    VAR    &{body}    name=Still archived    archived=${True}
    ${resp}=    Patch Project    ${team}[owner]    ${pid}    ${body}    409
    Error Code Should Be    ${resp}    conflict

Archive Permission Table Estimator Allowed Viewer Forbidden
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}    blank
    ${resp}=    Set Archived    ${team}[viewer]    ${pid}    ${True}    403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Set Archived    ${team}[outsider]    ${pid}    ${True}    404
    Error Code Should Be    ${resp}    not_found
    Set Archived    ${team}[estimator]    ${pid}    ${True}
    Set Archived    ${team}[admin]    ${pid}    ${False}
    ${row}=    Project Row    ${pid}
    Should Be Equal    ${row}[archived_at]    ${NONE}

Viewer Cannot Archive Even Together With A Rename
    [Documentation]    Mixed request: rename needs ``projects.edit`` and archive needs ``projects.archive``; the viewer has neither.
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}    blank
    VAR    &{body}    name=Sneaky    archived=${True}
    Patch Project    ${team}[viewer]    ${pid}    ${body}    403
    ${row}=    Project Row    ${pid}
    Should Not Be Equal    ${row}[name]    Sneaky
    Should Be Equal    ${row}[archived_at]    ${NONE}

# ── delete ─────────────────────────────────────────────────────────────────────────
Delete Answers 204 Then 404 And Removes Every Row
    [Documentation]    Delete cascades: project, docs, revisions, assignments and activity rows are gone.
    [Tags]    smoke
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Create Revision    ${team}[owner]    ${pid}    R1
    Assign Level    ${team}[owner]    ${pid}    footing    ${team}[estimator][id]
    Delete Project    ${team}[admin]    ${pid}    204
    ${resp}=    Get Project    ${team}[owner]    ${pid}    404
    Error Code Should Be    ${resp}    not_found
    ${ids}=    List Project Ids    ${team}[owner]    ${team}[ws]
    Should Not Contain    ${ids}    ${pid}
    FOR    ${table}    IN    projects    project_docs    project_revisions    level_assignments    activity_log
        ${column}=    Set Variable If    '${table}' == 'projects'    id    project_id
        ${n}=    Query Value    select count(*) from ${table} where ${column} = %s    ${pid}
        Should Be Equal As Integers    ${n}    0    msg=rows left in ${table}
    END

Deleted Project Routes All Answer 404
    [Tags]    negative    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Delete Project    ${team}[owner]    ${pid}    204
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${{ {'width': 1, 'length': 1, 'height': 1} }}    0    404
    Rename Project    ${team}[owner]    ${pid}    Ghost    404
    Create Revision    ${team}[owner]    ${pid}    R1    expected_status=404
    List Revisions    ${team}[owner]    ${pid}    404
    List Assignments    ${team}[owner]    ${pid}    404
    Get Activity    ${team}[owner]    ${pid}    expected_status=404
    Delete Project    ${team}[owner]    ${pid}    404

Delete Permission Table Only Admin And Owner
    [Documentation]    ``projects.delete`` is owner and admin only: estimator and viewer 403, outsider 404.
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}    blank
    ${resp}=    Delete Project    ${team}[estimator]    ${pid}    403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Delete Project    ${team}[viewer]    ${pid}    403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Delete Project    ${team}[outsider]    ${pid}    404
    Error Code Should Be    ${resp}    not_found
    Project Row    ${pid}
    Delete Project    ${team}[owner]    ${pid}    204

Delete Without A Token Answers 401
    [Tags]    security
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    Create Anonymous Session    anon
    DELETE On Session    anon    /projects/${pid}    expected_status=401
    Project Row    ${pid}

Delete Of An Archived Project Is Allowed
    [Tags]    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    Set Archived    ${team}[owner]    ${pid}    ${True}
    Delete Project    ${team}[owner]    ${pid}    204
    ${ids}=    List Project Ids    ${team}[owner]    ${team}[ws]    ?archived=true
    Should Not Contain    ${ids}    ${pid}

Deleting One Project Leaves The Others Untouched
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${keep}=    New Sample Project Id    ${team}
    ${drop}=    New Sample Project Id    ${team}
    Delete Project    ${team}[owner]    ${drop}    204
    Get Project    ${team}[owner]    ${keep}
    ${n}=    Doc Row Count    ${keep}
    Should Be Equal As Integers    ${n}    1
