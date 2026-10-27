*** Settings ***
Documentation       A2 revisions: a named snapshot of the whole project (``project_revisions``): label unique per
...                 project, newest first, the snapshot stays when the documents change later, permission
...                 ``revisions.create``. Snapshot totals are checked against the BOQ engine.
Resource            ../../resources/pages/api_projects.resource
Test Tags           api    projects    revisions    db


*** Test Cases ***
Create Revision Answers 201 And Stores Snapshot And Totals
    [Tags]    smoke
    ${team}=    Create Team
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    sample
    ${pid}=    Set Variable    ${detail}[project][id]
    ${resp}=    Create Revision    ${team}[estimator]    ${pid}    R1    first issue
    Should Be Equal    ${resp.json()}[label]    R1
    Should Be Equal    ${resp.json()}[note]    first issue
    Should Be Equal    ${resp.json()}[projectId]    ${pid}
    Should Be Equal    ${resp.json()}[createdBy]    ${team}[estimator][id]
    Should Be Equal    ${resp.json()}[totals]    ${detail}[project][summary]
    ${row}=    Revision Row    ${resp.json()}[id]
    Should Be Equal    ${row}[label]    R1
    Should Be Equal    ${row}[note]    first issue
    Should Be Equal    ${row}[totals]    ${detail}[project][summary]
    Should Not Be Equal    ${row}[snapshot]    ${NONE}
    Should Be Equal    ${row}[created_by]    ${{ __import__('uuid').UUID($team['estimator']['id']) }}

Label And Note Are Trimmed
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Create Revision    ${team}[owner]    ${pid}    ${SPACE}R1${SPACE}${SPACE}    ${SPACE}first issue${SPACE}
    Should Be Equal    ${resp.json()}[label]    R1
    Should Be Equal    ${resp.json()}[note]    first issue
    ${row}=    Revision Row    ${resp.json()}[id]
    Should Be Equal    ${row}[label]    R1

Note Is Optional And Stored As Null
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Create Revision    ${team}[owner]    ${pid}    R1
    Should Be Equal    ${resp.json()}[note]    ${NONE}
    ${row}=    Revision Row    ${resp.json()}[id]
    Should Be Equal    ${row}[note]    ${NONE}

Thai Label And Note Are Stored Exactly
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Create Revision    ${team}[owner]    ${pid}    ฉบับแก้ไข ครั้งที่ ๑ 📐    ส่งให้เจ้าของงานตรวจสอบแล้ว
    ${row}=    Revision Row    ${resp.json()}[id]
    Should Be Equal    ${row}[label]    ฉบับแก้ไข ครั้งที่ ๑ 📐
    Should Be Equal    ${row}[note]    ส่งให้เจ้าของงานตรวจสอบแล้ว

Mass Assignment Of Server Fields Is Ignored
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    VAR    &{totals}    constructionTotal=${1}    preConstructionTotal=${1}    levelsDone=${0}    levelsTotal=${37}
    VAR    &{body}    label=R1    createdBy=${team}[viewer][id]    totals=${totals}    id=11111111-1111-4111-8111-111111111111
    ${resp}=    POST On Session    ${team}[estimator][alias]    /projects/${pid}/revisions    json=${body}    expected_status=201
    Should Be Equal    ${resp.json()}[createdBy]    ${team}[estimator][id]
    Should Not Be Equal    ${resp.json()}[id]    11111111-1111-4111-8111-111111111111
    Numbers Should Be Close    ${resp.json()}[totals][constructionTotal]    ${SAMPLE_TOTAL}    0.01

# ── label uniqueness ───────────────────────────────────────────────────────────────
Duplicate Label In The Same Project Answers 409
    [Tags]    negative    smoke
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Create Revision    ${team}[owner]    ${pid}    R1
    ${resp}=    Create Revision    ${team}[owner]    ${pid}    R1    expected_status=409
    Error Code Should Be    ${resp}    conflict
    ${n}=    Revision Count    ${pid}
    Should Be Equal As Integers    ${n}    1

Duplicate Label Is Detected After Trimming
    [Tags]    negative    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Create Revision    ${team}[owner]    ${pid}    R1
    ${resp}=    Create Revision    ${team}[owner]    ${pid}    ${SPACE}R1${SPACE}    expected_status=409
    Error Code Should Be    ${resp}    conflict

Labels That Differ Only In Case Are Different Labels
    [Documentation]    Characterisation of the unique index on (project, label): it is case sensitive.
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Create Revision    ${team}[owner]    ${pid}    R1
    Create Revision    ${team}[owner]    ${pid}    r1
    ${n}=    Revision Count    ${pid}
    Should Be Equal As Integers    ${n}    2

The Same Label Can Be Used In Another Project
    ${team}=    Create Owner Workspace
    ${one}=    New Sample Project Id    ${team}
    ${two}=    New Sample Project Id    ${team}
    Create Revision    ${team}[owner]    ${one}    R1
    Create Revision    ${team}[owner]    ${two}    R1
    ${n}=    Query Value    select count(*) from project_revisions where workspace_id = %s and label = 'R1'    ${team}[ws]
    Should Be Equal As Integers    ${n}    2

Failed Duplicate Leaves No Extra Activity
    [Tags]    negative    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Create Revision    ${team}[owner]    ${pid}    R1
    ${count}=    Activity Count    ${pid}
    Create Revision    ${team}[owner]    ${pid}    R1    expected_status=409
    ${after}=    Activity Count    ${pid}
    Should Be Equal As Integers    ${after}    ${count}

Parallel Creation Of The Same Label Exactly One Wins
    [Documentation]    Concurrency: two simultaneous requests with the same label: one 201, the other 409
    ...    ``conflict`` (the unique index decides), never a 500.
    [Tags]    state    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    VAR    &{body}    label=RACE
    ${responses}=    Fire Parallel Requests    ${team}[owner]    POST    /projects/${pid}/revisions    ${body}    4
    ${codes}=    Status Codes Of    ${responses}
    Should Be Equal    ${codes}    ${{ [201, 409, 409, 409] }}
    ${n}=    Revision Count    ${pid}
    Should Be Equal As Integers    ${n}    1

# ── label and note validation ──────────────────────────────────────────────────────
Label Of 40 Characters Is Accepted And 41 Is Rejected
    [Documentation]    Boundary of ``revisionLabelSchema`` (characters, so Thai counts per letter).
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${ok}=    Evaluate    'ก' * 40
    ${long}=    Evaluate    'ก' * 41
    Create Revision    ${team}[owner]    ${pid}    ${ok}
    ${resp}=    Create Revision    ${team}[owner]    ${pid}    ${long}    expected_status=400
    Error Code Should Be    ${resp}    validation_failed
    ${n}=    Revision Count    ${pid}
    Should Be Equal As Integers    ${n}    1

Empty Whitespace Or Missing Label Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${label}    IN    ${EMPTY}    ${SPACE}${SPACE}
        ${resp}=    Create Revision    ${team}[owner]    ${pid}    ${label}    expected_status=400
        Error Code Should Be    ${resp}    validation_failed
    END
    ${resp}=    POST On Session    ${team}[owner][alias]    /projects/${pid}/revisions    json=${{ {'note': 'x'} }}    expected_status=400
    Error Code Should Be    ${resp}    validation_failed
    ${resp}=    POST On Session    ${team}[owner][alias]    /projects/${pid}/revisions    json=${{ {} }}    expected_status=400
    Error Code Should Be    ${resp}    validation_failed

Label Of The Wrong Type Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${label}    IN    ${5}    ${NONE}    ${True}    ${{ ['R1'] }}
        VAR    &{body}    label=${label}
        ${resp}=    POST On Session    ${team}[owner][alias]    /projects/${pid}/revisions    json=${body}    expected_status=400
        Error Code Should Be    ${resp}    validation_failed
    END

Label With A NUL Character Is Refused Not A Server Error
    [Documentation]    Error guessing: ``\\u0000`` cannot be stored in PostgreSQL text. Expected a 4xx validation
    ...    answer (400); a 500 is a bug.
    [Tags]    negative    edge    security    bug
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${label}=    Evaluate    'a' + chr(0) + 'b'
    ${resp}=    Create Revision    ${team}[owner]    ${pid}    ${label}    expected_status=400
    Error Code Should Be    ${resp}    validation_failed

Label With SQL And Markup Is Stored As Text
    [Tags]    security
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${label}=    Set Variable    '; DROP TABLE x;--<b>
    ${resp}=    Create Revision    ${team}[owner]    ${pid}    ${label}
    ${row}=    Revision Row    ${resp.json()}[id]
    Should Be Equal    ${row}[label]    ${label}

Note Of 2000 Characters Is Accepted And 2001 Is Rejected
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${ok}=    Evaluate    'ก' * 2000
    ${long}=    Evaluate    'ก' * 2001
    Create Revision    ${team}[owner]    ${pid}    R1    ${ok}
    ${resp}=    Create Revision    ${team}[owner]    ${pid}    R2    ${long}    expected_status=400
    Error Code Should Be    ${resp}    validation_failed
    ${row}=    Query Row    select length(note) as n from project_revisions where project_id = %s and label = 'R1'    ${pid}
    Should Be Equal As Integers    ${row}[n]    2000

Note Of The Wrong Type Is Rejected
    [Documentation]    ``note`` may be left out, but ``null`` and non text values are contract violations.
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${note}    IN    ${NONE}    ${5}    ${True}    ${{ ['x'] }}
        VAR    &{body}    label=R1    note=${note}
        ${resp}=    POST On Session    ${team}[owner][alias]    /projects/${pid}/revisions    json=${body}    expected_status=400
        Error Code Should Be    ${resp}    validation_failed
    END
    ${n}=    Revision Count    ${pid}
    Should Be Equal As Integers    ${n}    0

# ── list and detail ────────────────────────────────────────────────────────────────
List Of A Project Without Revisions Is Empty
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    List Revisions    ${team}[owner]    ${pid}
    Should Be Equal    ${resp.json()}    ${{ [] }}

List Is Newest First And Has No Snapshot
    [Tags]    smoke
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${label}    IN    R1    R2    R3    R4    R5
        Create Revision    ${team}[owner]    ${pid}    ${label}
    END
    ${resp}=    List Revisions    ${team}[viewer]    ${pid}
    ${labels}=    Evaluate    [r['label'] for r in $resp.json()]
    Should Be Equal    ${labels}    ${{ ['R5', 'R4', 'R3', 'R2', 'R1'] }}
    ${stamps}=    Evaluate    [r['createdAt'] for r in $resp.json()]
    ${sorted}=    Evaluate    sorted($stamps, reverse=True)
    Should Be Equal    ${stamps}    ${sorted}
    ${with_snapshot}=    Evaluate    [r for r in $resp.json() if 'snapshot' in r]
    Should Be Empty    ${with_snapshot}

List Shows Only The Revisions Of Its Own Project
    ${team}=    Create Owner Workspace
    ${one}=    New Sample Project Id    ${team}
    ${two}=    New Sample Project Id    ${team}
    Create Revision    ${team}[owner]    ${one}    ONE
    Create Revision    ${team}[owner]    ${two}    TWO
    ${resp}=    List Revisions    ${team}[owner]    ${one}
    ${labels}=    Evaluate    [r['label'] for r in $resp.json()]
    Should Be Equal    ${labels}    ${{ ['ONE'] }}

Many Revisions Are Listed In Reverse Creation Order
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${expected}=    Create List
    FOR    ${i}    IN RANGE    1    16
        Create Revision    ${team}[owner]    ${pid}    REV-${i}
        Insert Into List    ${expected}    0    REV-${i}
    END
    ${resp}=    List Revisions    ${team}[owner]    ${pid}
    ${labels}=    Evaluate    [r['label'] for r in $resp.json()]
    Should Be Equal    ${labels}    ${expected}

Detail Snapshot Holds The Documents As They Were
    [Documentation]    Calculator, BOQ override, journey and header are in the snapshot; the snapshot computes to the
    ...    revision's stored total (``Compute Expected`` on the snapshot).
    [Tags]    smoke
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    VAR    &{journey}    project-info=done    land-inspection=done
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Put Doc    ${team}[owner]    ${pid}    boq:R13    ${{ {'mat': 350} }}    0
    Put Doc    ${team}[owner]    ${pid}    journey    ${journey}    0
    ${rev}=    Create Revision    ${team}[owner]    ${pid}    R1
    ${resp}=    Get Revision    ${team}[viewer]    ${pid}    ${rev.json()}[id]
    ${snapshot}=    Set Variable    ${resp.json()}[snapshot]
    Should Be Equal    ${snapshot}[calculators][fill]    ${fill}
    Should Be Equal    ${snapshot}[boqOverrides][R13][mat]    ${{ 350 }}
    Should Be Equal    ${snapshot}[journey]    ${journey}
    ${expected}=    Compute Expected    ${snapshot}
    Numbers Should Be Close    ${rev.json()}[totals][constructionTotal]    ${expected}[constructionTotal]    0.01
    Should Be Equal As Integers    ${rev.json()}[totals][levelsDone]    2
    ${engine}=    Engine Expected For Stored Project    ${team}[owner]    ${pid}
    Numbers Should Be Close    ${expected}[constructionTotal]    ${engine}[constructionTotal]    0.01

Detail Equals The List Entry Plus The Snapshot
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Create Revision    ${team}[owner]    ${pid}    R1    note
    ${list}=    List Revisions    ${team}[owner]    ${pid}
    ${resp}=    Get Revision    ${team}[owner]    ${pid}    ${list.json()}[0][id]
    ${detail}=    Evaluate    {k: v for k, v in $resp.json().items() if k != 'snapshot'}
    Should Be Equal    ${detail}    ${list.json()}[0]

Later Edits Do Not Change An Existing Revision
    [Documentation]    State: snapshot at R1, then change documents and rename; R1 (API and database) is unchanged and
    ...    a new R2 reflects the new state.
    [Tags]    state    smoke
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    ${r1}=    Create Revision    ${team}[owner]    ${pid}    R1
    ${before}=    Get Revision    ${team}[owner]    ${pid}    ${r1.json()}[id]
    ${row_before}=    Revision Row    ${r1.json()}[id]
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${NONE}    1
    Put Doc    ${team}[owner]    ${pid}    calc:footing    ${{ {'rows': [{'name': 'F1', 'count': 8, 'width': 1.2, 'length': 1.2, 'depth': 0.3, 'excavationDepth': 1.2, 'sandThickness': 0.05, 'leanThickness': 0.05, 'shortBarSize': 'DB12', 'shortBarCount': 6, 'longBarSize': 'DB12', 'longBarCount': 6, 'ringBarSize': 'RB6', 'ringBarCount': 0}]} }}    0
    Rename Project    ${team}[owner]    ${pid}    Renamed after R1
    ${after}=    Get Revision    ${team}[owner]    ${pid}    ${r1.json()}[id]
    Should Be Equal    ${after.json()}    ${before.json()}
    ${row_after}=    Revision Row    ${r1.json()}[id]
    Should Be Equal    ${row_after}[snapshot]    ${row_before}[snapshot]
    Should Be Equal    ${row_after}[totals]    ${row_before}[totals]
    ${r2}=    Create Revision    ${team}[owner]    ${pid}    R2
    Should Not Be Equal As Numbers    ${r2.json()}[totals][constructionTotal]    ${r1.json()}[totals][constructionTotal]
    ${detail2}=    Get Revision    ${team}[owner]    ${pid}    ${r2.json()}[id]
    ${keys}=    Evaluate    list($detail2.json()['snapshot']['calculators'])
    Should Be Equal    ${keys}    ${{ ['footing'] }}
    ${expected}=    Compute Expected    ${detail2.json()}[snapshot]
    Numbers Should Be Close    ${r2.json()}[totals][constructionTotal]    ${expected}[constructionTotal]    0.01

Revision After A Reset Does Not Contain The Reset Document
    [Tags]    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${NONE}    1
    ${rev}=    Create Revision    ${team}[owner]    ${pid}    R1
    ${resp}=    Get Revision    ${team}[owner]    ${pid}    ${rev.json()}[id]
    Should Be Empty    ${resp.json()}[snapshot][calculators]
    Numbers Should Be Close    ${rev.json()}[totals][constructionTotal]    ${SAMPLE_TOTAL}    0.01

Revision Of A Blank Project Has The Blank Total
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    ${rev}=    Create Revision    ${team}[owner]    ${pid}    R1
    ${engine}=    Compute Expected For New Project    blank
    Numbers Should Be Close    ${rev.json()}[totals][constructionTotal]    ${engine}[constructionTotal]    0.001

Revision Of An Uploaded Guest Project Has Its Documents
    ${team}=    Create Owner Workspace
    ${fill}=    Fill Input
    ${docs}=    Evaluate    [{'docKey': 'calc:fill', 'data': $fill}]
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    sample    Guest    docs=${docs}
    ${rev}=    Create Revision    ${team}[owner]    ${detail}[project][id]    R1
    ${resp}=    Get Revision    ${team}[owner]    ${detail}[project][id]    ${rev.json()}[id]
    Should Be Equal    ${resp.json()}[snapshot][calculators][fill]    ${fill}
    Should Be Equal    ${rev.json()}[totals]    ${detail}[project][summary]

Revision Is Logged As Revision Created
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Create Revision    ${team}[owner]    ${pid}    R1
    ${actions}=    Activity Actions In Database    ${pid}
    Should Be Equal    ${actions}[0]    revision.created

# ── permissions and isolation ──────────────────────────────────────────────────────
Create Permission Table Owner Admin Estimator Allowed Viewer Forbidden
    [Documentation]    ``revisions.create``: owner, admin, estimator yes; viewer 403; outsider 404.
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    Create Revision    ${team}[owner]    ${pid}    BY-OWNER
    Create Revision    ${team}[admin]    ${pid}    BY-ADMIN
    Create Revision    ${team}[estimator]    ${pid}    BY-ESTIMATOR
    ${resp}=    Create Revision    ${team}[viewer]    ${pid}    BY-VIEWER    expected_status=403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Create Revision    ${team}[outsider]    ${pid}    BY-OUTSIDER    expected_status=404
    Error Code Should Be    ${resp}    not_found
    ${n}=    Revision Count    ${pid}
    Should Be Equal As Integers    ${n}    3

Read Permission Table Every Member Reads Outsider Gets 404
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${rev}=    Create Revision    ${team}[owner]    ${pid}    R1
    FOR    ${role}    IN    owner    admin    estimator    viewer
        List Revisions    ${team}[${role}]    ${pid}
        Get Revision    ${team}[${role}]    ${pid}    ${rev.json()}[id]
    END
    ${resp}=    List Revisions    ${team}[outsider]    ${pid}    404
    Error Code Should Be    ${resp}    not_found
    ${resp}=    Get Revision    ${team}[outsider]    ${pid}    ${rev.json()}[id]    404
    Error Code Should Be    ${resp}    not_found

Another Tenants Member Cannot Read Or Create Revisions
    [Tags]    security
    ${team}=    Create Owner Workspace
    ${other}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${rev}=    Create Revision    ${team}[owner]    ${pid}    R1
    List Revisions    ${other}[owner]    ${pid}    404
    Get Revision    ${other}[owner]    ${pid}    ${rev.json()}[id]    404
    Create Revision    ${other}[owner]    ${pid}    HACK    expected_status=404

Revision Id Of Another Project Is Not Found Under This Project
    [Documentation]    Insecure direct object reference check: project B's id with project A's revision id is 404.
    [Tags]    security
    ${team}=    Create Owner Workspace
    ${a}=    New Sample Project Id    ${team}
    ${b}=    New Sample Project Id    ${team}
    ${rev}=    Create Revision    ${team}[owner]    ${a}    R1
    ${resp}=    Get Revision    ${team}[owner]    ${b}    ${rev.json()}[id]    404
    Error Code Should Be    ${resp}    not_found
    Get Revision    ${team}[owner]    ${a}    ${rev.json()}[id]

Revision Of A Project In Another Workspace Is Not Found Even For A Member Of Both
    [Tags]    security
    ${team}=    Create Owner Workspace
    ${ws2}=    Create Company Workspace Via API    ${team}[owner]
    ${a}=    New Sample Project Id    ${team}
    ${detail}=    New Project    ${team}[owner]    ${ws2}    sample
    ${rev}=    Create Revision    ${team}[owner]    ${a}    R1
    Get Revision    ${team}[owner]    ${detail}[project][id]    ${rev.json()}[id]    404

Unknown Or Malformed Revision Id Answers 404
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${bad}    IN    00000000-0000-4000-8000-000000000000    not-a-uuid    123    %27%20OR%201=1
        ${resp}=    Get Revision    ${team}[owner]    ${pid}    ${bad}    404
        Error Code Should Be    ${resp}    not_found
    END

Revision Routes Without A Token Answer 401
    [Tags]    security
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${rev}=    Create Revision    ${team}[owner]    ${pid}    R1
    Create Anonymous Session    anon
    GET On Session    anon    /projects/${pid}/revisions    expected_status=401
    GET On Session    anon    /projects/${pid}/revisions/${rev.json()}[id]    expected_status=401
    VAR    &{body}    label=ANON
    POST On Session    anon    /projects/${pid}/revisions    json=${body}    expected_status=401
    ${n}=    Revision Count    ${pid}
    Should Be Equal As Integers    ${n}    1

Revision Of An Archived Project Is Allowed
    [Documentation]    Characterisation: archiving freezes document writes (409) but a revision is only a read of the
    ...    documents, so it still works (API.md only restricts rename and document writes).
    [Tags]    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Set Archived    ${team}[owner]    ${pid}    ${True}
    Create Revision    ${team}[owner]    ${pid}    FINAL

Deleting The Project Removes Its Revisions
    [Tags]    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${rev}=    Create Revision    ${team}[owner]    ${pid}    R1
    Delete Project    ${team}[owner]    ${pid}
    ${n}=    Query Value    select count(*) from project_revisions where id = %s    ${rev.json()}[id]
    Should Be Equal As Integers    ${n}    0
    Get Revision    ${team}[owner]    ${pid}    ${rev.json()}[id]    404
