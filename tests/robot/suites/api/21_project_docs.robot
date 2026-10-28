*** Settings ***
Documentation       A2 project documents: ``PUT /projects/:id/docs/:docKey`` with optimistic versions
...                 (happy path, stale and ahead versions, races), key and data validation (422), size limit,
...                 permissions, archived state; ``project_docs`` rows are read back from PostgreSQL and the
...                 project summary total is compared with the BOQ engine (``Compute Expected``).
Resource            ../../resources/pages/api_projects.resource
Test Tags           api    projects    docs    db


*** Test Cases ***
# ── happy path and versions ────────────────────────────────────────────────────────
Put New Document Answers 200 At Version 1 And Stores It
    [Tags]    smoke
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    ${resp}=    Put Doc    ${team}[estimator]    ${pid}    calc:fill    ${fill}    0
    Should Be Equal    ${resp.json()}[doc][docKey]    calc:fill
    Should Be Equal As Integers    ${resp.json()}[doc][version]    1
    Should Be Equal    ${resp.json()}[doc][data]    ${fill}
    Should Be Equal    ${resp.json()}[doc][updatedBy]    ${team}[estimator][id]
    ${row}=    Project Doc Row    ${pid}    calc:fill
    Should Be Equal As Integers    ${row}[version]    1
    Should Be Equal    ${row}[data]    ${fill}
    Should Be Equal    ${row}[updated_by]    ${{ __import__('uuid').UUID($team['estimator']['id']) }}

Each Write Increments The Version By One
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${version}    IN RANGE    0    5
        ${data}=    Create Dictionary    width=${{ 10 + int($version) }}    length=${12}    height=${0.5}
        ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${data}    ${version}
        Should Be Equal As Integers    ${resp.json()}[doc][version]    ${version + 1}
        ${stored}=    Doc Version In Database    ${pid}    calc:fill
        Should Be Equal As Integers    ${stored}    ${version + 1}
    END
    ${stored}=    Doc Data In Database    ${pid}    calc:fill
    Should Be Equal As Numbers    ${stored}[width]    14

Write Answers With The Project Summary And A Later Update Time
    ${team}=    Create Owner Workspace
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    sample
    ${fill}=    Fill Input
    ${resp}=    Put Doc    ${team}[owner]    ${detail}[project][id]    calc:fill    ${fill}    0
    ${before}=    Evaluate    $detail['project']['updatedAt']
    ${after}=    Evaluate    $resp.json()['project']['updatedAt']
    Should Be True    '${after}' >= '${before}'
    Should Be Equal    ${resp.json()}[project][id]    ${detail}[project][id]
    ${engine}=    Engine Expected For Stored Project    ${team}[owner]    ${detail}[project][id]
    Numbers Should Be Close    ${resp.json()}[project][summary][constructionTotal]    ${engine}[constructionTotal]    0.01
    ${row}=    Project Row    ${detail}[project][id]
    Numbers Should Be Close    ${row}[summary][constructionTotal]    ${engine}[constructionTotal]    0.01

Documents Have Independent Version Counters
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    1
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:paint    ${{ {} }}    0
    Should Be Equal As Integers    ${resp.json()}[doc][version]    1
    ${meta}=    Doc Version In Database    ${pid}    meta
    Should Be Equal As Integers    ${meta}    1
    ${fill_version}=    Doc Version In Database    ${pid}    calc:fill
    Should Be Equal As Integers    ${fill_version}    2

Header Document Is Seeded At Version 1 So A Write Needs Base Version 1
    [Documentation]    ``meta`` exists from creation: base 0 conflicts, base 1 succeeds and gives version 2.
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    VAR    &{meta}    projectName=Header    ownerName=A
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    meta    ${meta}    0    409
    Error Code Should Be    ${resp}    version_conflict
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    meta    ${meta}    1
    Should Be Equal As Integers    ${resp.json()}[doc][version]    2
    ${stored}=    Doc Data In Database    ${pid}    meta
    Should Be Equal    ${stored}    ${meta}

Url Encoded Document Key Is Accepted
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc%3Afill    ${fill}    0
    Should Be Equal    ${resp.json()}[doc][docKey]    calc:fill
    ${stored}=    Doc Data In Database    ${pid}    calc:fill
    Should Be Equal    ${stored}    ${fill}

Thai And Emoji Text In A Document Round Trips Exactly
    [Tags]    edge
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    VAR    &{meta}    projectName=บ้านคุณสมชาย 🏠    siteAddress=๑๒๓ ถ.สุขุมวิท กรุงเทพฯ ๑๐๑๑๐
    Put Doc    ${team}[owner]    ${pid}    meta    ${meta}    1
    ${stored}=    Doc Data In Database    ${pid}    meta
    Should Be Equal    ${stored}    ${meta}
    ${got}=    Get Project    ${team}[viewer]    ${pid}
    Should Be Equal    ${got.json()}[docs][0][data]    ${meta}

# ── version conflicts ──────────────────────────────────────────────────────────────
Stale Base Version Answers 409 With The Current Document
    [Documentation]    State transition: the document is at version 2; a writer still on version 1 is refused and told
    ...    the server's current document (``VersionConflictDetails``). The database row does not change.
    [Tags]    smoke    state
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${v1}=    Create Dictionary    width=${10}    length=${12}    height=${0.5}
    ${v2}=    Create Dictionary    width=${20}    length=${12}    height=${0.5}
    Put Doc    ${team}[estimator]    ${pid}    calc:fill    ${v1}    0
    Put Doc    ${team}[estimator]    ${pid}    calc:fill    ${v2}    1
    ${late}=    Create Dictionary    width=${99}    length=${1}    height=${1}
    ${resp}=    Put Doc    ${team}[admin]    ${pid}    calc:fill    ${late}    1    409
    Error Code Should Be    ${resp}    version_conflict
    ${current}=    Set Variable    ${resp.json()}[details][current]
    Should Be Equal    ${current}[docKey]    calc:fill
    Should Be Equal As Integers    ${current}[version]    2
    Should Be Equal    ${current}[data]    ${v2}
    Should Be Equal    ${current}[updatedBy]    ${team}[estimator][id]
    ${row}=    Project Doc Row    ${pid}    calc:fill
    Should Be Equal As Integers    ${row}[version]    2
    Should Be Equal    ${row}[data]    ${v2}

Every Wrong Base Version Is Refused
    [Documentation]    Equivalence classes of ``baseVersion`` against a document at version 2: behind (0, 1), ahead (3, 5, 1000).
    [Tags]    edge    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    1
    FOR    ${base}    IN    0    1    3    5    1000
        ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    ${base}    409
        Error Code Should Be    ${resp}    version_conflict
        Should Be Equal As Integers    ${resp.json()}[details][current][version]    2
    END
    ${stored}=    Doc Version In Database    ${pid}    calc:fill
    Should Be Equal As Integers    ${stored}    2

Conflict On A Document That Does Not Exist Has Null Current
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:paint    ${{ {} }}    3    409
    Error Code Should Be    ${resp}    version_conflict
    Should Be Equal    ${resp.json()}[details][current]    ${NONE}
    Doc Should Not Exist In Database    ${pid}    calc:paint

Refused Writes Leave No Activity And Do Not Change The Project
    [Tags]    negative    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    ${count}=    Activity Count    ${pid}
    ${row_before}=    Project Row    ${pid}
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0    409
    Put Doc    ${team}[owner]    ${pid}    calc:no-such    ${fill}    0    422
    Put Doc    ${team}[owner]    ${pid}    calc:footing    ${{ {'rows': 'not a list'} }}    0    422
    ${count_after}=    Activity Count    ${pid}
    ${row_after}=    Project Row    ${pid}
    Should Be Equal As Integers    ${count_after}    ${count}
    Should Be Equal    ${row_after}[updated_at]    ${row_before}[updated_at]
    Should Be Equal    ${row_after}[summary]    ${row_before}[summary]

Second Writer On The Same Base Version Is Refused Then Rebases
    [Documentation]    Two tabs open version 1. The first save wins; the second gets 409 with the winner's document and
    ...    succeeds when it retries with the version it was told.
    [Tags]    state
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${a}=    Create Dictionary    width=${10}    length=${12}    height=${0.5}
    ${b}=    Create Dictionary    width=${11}    length=${12}    height=${0.5}
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${a}    0
    Put Doc    ${team}[estimator]    ${pid}    calc:fill    ${a}    1
    ${loser}=    Put Doc    ${team}[admin]    ${pid}    calc:fill    ${b}    1    409
    ${current}=    Set Variable    ${loser.json()}[details][current][version]
    ${retry}=    Put Doc    ${team}[admin]    ${pid}    calc:fill    ${b}    ${current}
    Should Be Equal As Integers    ${retry.json()}[doc][version]    3
    ${stored}=    Doc Data In Database    ${pid}    calc:fill
    Should Be Equal    ${stored}    ${b}

Parallel Writes On The Same Base Version Exactly One Wins
    [Documentation]    Concurrency: two simultaneous saves of version 1. One 200, one 409 ``version_conflict``;
    ...    never two winners, never a 500. The row ends at version 2.
    [Tags]    state    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    VAR    &{body}    data=${fill}    baseVersion=${1}
    ${responses}=    Fire Parallel Requests    ${team}[owner]    PUT    /projects/${pid}/docs/calc:fill    ${body}    4
    ${codes}=    Status Codes Of    ${responses}
    Should Be Equal    ${codes}    ${{ [200, 409, 409, 409] }}
    ${stored}=    Doc Version In Database    ${pid}    calc:fill
    Should Be Equal As Integers    ${stored}    2

Parallel Creation Of The Same New Document Exactly One Wins
    [Tags]    state    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    VAR    &{body}    data=${fill}    baseVersion=${0}
    ${responses}=    Fire Parallel Requests    ${team}[owner]    PUT    /projects/${pid}/docs/calc:fill    ${body}    4
    ${codes}=    Status Codes Of    ${responses}
    Should Be Equal    ${codes}    ${{ [200, 409, 409, 409] }}
    ${n}=    Query Value    select count(*) from project_docs where project_id = %s and doc_key = 'calc:fill'    ${pid}
    Should Be Equal As Integers    ${n}    1
    ${stored}=    Doc Version In Database    ${pid}    calc:fill
    Should Be Equal As Integers    ${stored}    1

# ── reset ──────────────────────────────────────────────────────────────────────────
Reset With Null Keeps The Row Increments The Version And Restores The Default Total
    [Tags]    smoke
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    ${changed}=    Summary Total In List    ${team}[owner]    ${team}[ws]    ${pid}
    Should Not Be Equal As Numbers    ${changed}    ${SAMPLE_TOTAL}
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${NONE}    1
    Should Be Equal As Integers    ${resp.json()}[doc][version]    2
    Should Be Equal    ${resp.json()}[doc][data]    ${NONE}
    ${row}=    Project Doc Row    ${pid}    calc:fill
    Should Be Equal    ${row}[data]    ${NONE}
    Should Be Equal As Integers    ${row}[version]    2
    Numbers Should Be Close    ${resp.json()}[project][summary][constructionTotal]    ${SAMPLE_TOTAL}    0.01
    ${actions}=    Activity Actions In Database    ${pid}
    Should Be Equal    ${actions}[0]    doc.reset

Write After A Reset Continues The Version Sequence
    [Tags]    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${NONE}    1
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    2
    Should Be Equal As Integers    ${resp.json()}[doc][version]    3
    ${stored}=    Doc Data In Database    ${pid}    calc:fill
    Should Be Equal    ${stored}    ${fill}

Reset Of A Document That Never Existed Creates A Null Row At Version 1
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:paint    ${NONE}    0
    Should Be Equal As Integers    ${resp.json()}[doc][version]    1
    ${row}=    Project Doc Row    ${pid}    calc:paint
    Should Be Equal    ${row}[data]    ${NONE}
    Numbers Should Be Close    ${resp.json()}[project][summary][constructionTotal]    ${SAMPLE_TOTAL}    0.01

# ── contract violations (400) ──────────────────────────────────────────────────────
Missing Data Field Is Rejected Because Only Null Resets
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    VAR    &{body}    baseVersion=${1}
    ${resp}=    Put Doc Body    ${team}[owner]    ${pid}    meta    ${body}    400
    Error Code Should Be    ${resp}    validation_failed
    ${stored}=    Doc Version In Database    ${pid}    meta
    Should Be Equal As Integers    ${stored}    1

Missing Base Version Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    VAR    &{body}    data=${{ {'projectName': 'x'} }}
    ${resp}=    Put Doc Body    ${team}[owner]    ${pid}    meta    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Invalid Base Versions Are Rejected
    [Documentation]    Equivalence classes: negative, fractional, text, null, boolean.
    [Tags]    negative    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${bad}    IN    ${-1}    ${1.5}    1    ${NONE}    ${True}    ${{ [1] }}
        VAR    &{body}    data=${{ {'projectName': 'x'} }}    baseVersion=${bad}
        ${resp}=    Put Doc Body    ${team}[owner]    ${pid}    meta    ${body}    400
        Error Code Should Be    ${resp}    validation_failed
    END

Body That Is Not A JSON Object Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Put Doc Body    ${team}[owner]    ${pid}    meta    ${{ [1] }}    400
    Error Code Should Be    ${resp}    validation_failed
    VAR    &{headers}    Content-Type=application/json
    ${resp}=    PUT On Session    ${team}[owner][alias]    /projects/${pid}/docs/meta    data={"data": {
    ...    headers=${headers}    expected_status=400
    Error Code Should Be    ${resp}    validation_failed

Plain Text Body Is Rejected
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    VAR    &{headers}    Content-Type=text/plain
    ${resp}=    PUT On Session    ${team}[owner][alias]    /projects/${pid}/docs/meta    data=data=1
    ...    headers=${headers}    expected_status=400
    Error Code Should Be    ${resp}    validation_failed

# ── document key validation (422) ──────────────────────────────────────────────────
Unknown Or Malformed Document Keys Answer 422 And Store Nothing
    [Documentation]    Equivalence classes of keys: not matching the pattern, unknown calculator, unknown BOQ line,
    ...    unknown planning sheet, injection and traversal attempts.
    [Tags]    negative    security
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    @{keys}=    Create List    bogus    CALC:fill    META    calc:    calc:no-such-calculator    calc:Fill
    ...    boq:NO-SUCH-LINE    boq:    planning:other    planning:MANDAY    journey2    meta:x
    ...    calc%3Afill%27%3Bdrop%20table%20projects%3B--    ..%2F..%2Fetc%2Fpasswd    calc:fill%00
    FOR    ${key}    IN    @{keys}
        ${resp}=    Put Doc    ${team}[owner]    ${pid}    ${key}    ${{ {'width': 1, 'length': 1, 'height': 1} }}    0    422
        Error Code Should Be    ${resp}    unprocessable
    END
    ${n}=    Doc Row Count    ${pid}
    Should Be Equal As Integers    ${n}    1
    ${tables}=    Query Value    select count(*) from information_schema.tables where table_name = 'projects'
    Should Be Equal As Integers    ${tables}    1

Valid Keys Of Every Kind Are Accepted
    [Documentation]    meta, journey, a calculator, a BOQ line, and all three planning sheets.
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Put Doc    ${team}[owner]    ${pid}    journey    ${{ {'project-info': 'done'} }}    0
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${{ {'width': 1, 'length': 1, 'height': 1} }}    0
    Put Doc    ${team}[owner]    ${pid}    boq:R13    ${{ {'mat': 350} }}    0
    FOR    ${sheet}    IN    manday    schedule    cashflow
        Put Doc    ${team}[owner]    ${pid}    planning:${sheet}    ${{ {'note': 'x'} }}    0
    END
    ${n}=    Doc Row Count    ${pid}
    Should Be Equal As Integers    ${n}    7

# ── data validation by document kind (422) ─────────────────────────────────────────
Meta Rejects Unknown Fields Non Text Values And Non Objects
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    @{bad}=    Create List    ${{ {'colour': 'red'} }}    ${{ {'projectName': 5} }}    ${{ {'ownerName': None} }}
    ...    ${{ ['projectName'] }}    text    ${5}    ${True}
    FOR    ${data}    IN    @{bad}
        ${resp}=    Put Doc    ${team}[owner]    ${pid}    meta    ${data}    1    422
        Error Code Should Be    ${resp}    unprocessable
    END
    ${stored}=    Doc Version In Database    ${pid}    meta
    Should Be Equal As Integers    ${stored}    1

Meta Text Of 500 Characters Is Accepted And 501 Is Rejected
    [Documentation]    Boundary of every meta text field.
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${ok}=    Evaluate    'ก' * 500
    ${long}=    Evaluate    'ก' * 501
    Put Doc    ${team}[owner]    ${pid}    meta    ${{ {'siteAddress': $ok} }}    1
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    meta    ${{ {'siteAddress': $long} }}    2    422
    Error Code Should Be    ${resp}    unprocessable

Meta With A NUL Character Is Refused Not A Server Error
    [Documentation]    Error guessing: a text with ``\\u0000`` cannot be stored in PostgreSQL jsonb. Expected a 4xx
    ...    validation answer; a 500 is a bug. Every JSON body with U+0000 is refused when it is read: 400 validation_failed.
    [Tags]    negative    edge    security    bug
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${text}=    Evaluate    'a' + chr(0) + 'b'
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    meta    ${{ {'ownerName': $text} }}    1    400
    Error Code Should Be    ${resp}    validation_failed

Journey Rejects Unknown Levels Bad States And Non Objects
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    @{bad}=    Create List    ${{ {'no-such-level': 'done'} }}    ${{ {'footing': 'half'} }}    ${{ {'footing': True} }}
    ...    ${{ {'footing': None} }}    ${{ ['footing'] }}    text
    FOR    ${data}    IN    @{bad}
        ${resp}=    Put Doc    ${team}[owner]    ${pid}    journey    ${data}    0    422
        Error Code Should Be    ${resp}    unprocessable
    END
    Doc Should Not Exist In Database    ${pid}    journey

Journey Done And Skipped Levels Count In The Summary
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    VAR    &{journey}    project-info=done    land-inspection=done    demolition=skipped
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    journey    ${journey}    0
    Should Be Equal As Integers    ${resp.json()}[project][summary][levelsDone]    3
    ${row}=    Project Row    ${pid}
    Should Be Equal As Integers    ${row}[summary][levelsDone]    3

Journey With All 37 Levels Done Reaches Levels Done 37
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${ids}=    Level Ids
    ${journey}=    Evaluate    {i: 'done' for i in $ids}
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    journey    ${journey}    0
    Should Be Equal As Integers    ${resp.json()}[project][summary][levelsDone]    37
    Should Be Equal As Integers    ${resp.json()}[project][summary][levelsTotal]    37

BOQ Line Rejects Wrong Types Unknown Fields And An Empty Object
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    @{bad}=    Create List    ${{ {'qty': 'many'} }}    ${{ {'mat': None} }}    ${{ {'colour': 'red'} }}    ${{ {} }}
    ...    ${{ {'desc': 5} }}    ${{ [1] }}    text    ${5}
    FOR    ${data}    IN    @{bad}
        ${resp}=    Put Doc    ${team}[owner]    ${pid}    boq:R13    ${data}    0    422
        Error Code Should Be    ${resp}    unprocessable
    END
    Doc Should Not Exist In Database    ${pid}    boq:R13

BOQ Line Text Boundary 1000 And 1001 Characters
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${ok}=    Evaluate    'ข' * 1000
    ${long}=    Evaluate    'ข' * 1001
    Put Doc    ${team}[owner]    ${pid}    boq:R13    ${{ {'desc': $ok} }}    0
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    boq:R13    ${{ {'desc': $long} }}    1    422
    Error Code Should Be    ${resp}    unprocessable

BOQ Line Override Changes The Total Exactly As The Engine Says
    [Documentation]    R13 material price 350 (a documented override shape): list total = engine on the same documents.
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Put Doc    ${team}[owner]    ${pid}    boq:R13    ${{ {'mat': 350} }}    0
    ${expected}=    List Total Should Equal Engine    ${team}[owner]    ${team}[ws]    ${pid}
    Should Not Be Equal As Numbers    ${expected}[constructionTotal]    ${SAMPLE_TOTAL}

BOQ Line Override With An Astronomical Number Is Refused
    [Documentation]    A value that makes the BOQ total overflow to a non number is a 422 ("stops computing"), not stored.
    [Tags]    edge    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    boq:R13    ${{ {'qty': 1e308, 'mat': 1e308} }}    0    422
    Error Code Should Be    ${resp}    unprocessable
    Doc Should Not Exist In Database    ${pid}    boq:R13

Calculator And Planning Documents Must Be Objects
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${key}    IN    calc:fill    planning:manday
        FOR    ${data}    IN    ${{ [1, 2] }}    text    ${5}    ${True}
            ${resp}=    Put Doc    ${team}[owner]    ${pid}    ${key}    ${data}    0    422
            Error Code Should Be    ${resp}    unprocessable
        END
    END

Data That Makes The Project Stop Computing Is Refused
    [Documentation]    Shape valid but the footing calculator cannot use it (``rows`` not a list): 422, nothing stored.
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:footing    ${{ {'rows': 'not a list'} }}    0    422
    Error Code Should Be    ${resp}    unprocessable
    Doc Should Not Exist In Database    ${pid}    calc:footing
    ${listed}=    Summary Total In List    ${team}[owner]    ${team}[ws]    ${pid}
    Numbers Should Be Close    ${listed}    ${SAMPLE_TOTAL}    0.01

Breaking Data Over A Good Document Keeps The Good Version
    [Tags]    negative    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${good}=    Footing Input
    Put Doc    ${team}[owner]    ${pid}    calc:footing    ${good}    0
    Put Doc    ${team}[owner]    ${pid}    calc:footing    ${{ {'rows': 'not a list'} }}    1    422
    ${stored}=    Doc Data In Database    ${pid}    calc:footing
    Should Be Equal    ${stored}    ${good}
    ${version}=    Doc Version In Database    ${pid}    calc:footing
    Should Be Equal As Integers    ${version}    1

# ── size limit ─────────────────────────────────────────────────────────────────────
Document Of Exactly The Size Limit Is Accepted And One Byte More Is Rejected
    [Documentation]    Boundary: ``MAX_DOC_BYTES`` = 262144 bytes of JSON. ``{"note":"..."}`` is 11 bytes of frame.
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fits}=    Evaluate    'x' * (${MAX_DOC_BYTES} - 11)
    ${over}=    Evaluate    'x' * (${MAX_DOC_BYTES} - 10)
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${{ {'note': $fits} }}    0
    Should Be Equal As Integers    ${resp.json()}[doc][version]    1
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${{ {'note': $over} }}    1    422
    Error Code Should Be    ${resp}    unprocessable
    Should Be Equal As Integers    ${resp.json()}[details][maxBytes]    ${MAX_DOC_BYTES}
    Should Be Equal As Integers    ${resp.json()}[details][bytes]    ${MAX_DOC_BYTES + 1}
    ${stored}=    Doc Data In Database    ${pid}    calc:fill
    Length Should Be    ${stored}[note]    ${MAX_DOC_BYTES - 11}

Oversize Document Answers 422 With Details
    [Tags]    negative    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${note}=    Evaluate    'x' * ${MAX_DOC_BYTES}
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${{ {'note': $note} }}    0    422
    Error Code Should Be    ${resp}    unprocessable
    Should Be Equal    ${resp.json()}[details][docKey]    calc:fill
    Doc Should Not Exist In Database    ${pid}    calc:fill

Size Limit Counts Bytes Not Characters
    [Documentation]    100,000 Thai characters are 300,000 bytes of UTF-8: refused although under 262,144 characters.
    [Tags]    edge    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${note}=    Evaluate    'ก' * 100000
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${{ {'note': $note} }}    0    422
    Error Code Should Be    ${resp}    unprocessable

Very Large Request Body Is Refused With 413 Not A Server Error
    [Tags]    edge    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${note}=    Evaluate    'x' * (16 * 1024 * 1024)
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${{ {'note': $note} }}    0    413
    Error Code Should Be    ${resp}    validation_failed
    Doc Should Not Exist In Database    ${pid}    calc:fill

# ── totals equal the engine ────────────────────────────────────────────────────────
Sample Project Total Is The Excel Sample House
    [Documentation]    Business rule: the untouched sample project totals 1,855,162.25 baht, and so does the engine.
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${expected}=    List Total Should Equal Engine    ${team}[owner]    ${team}[ws]    ${pid}
    Numbers Should Be Close    ${expected}[constructionTotal]    ${SAMPLE_TOTAL}    0.01

Footing Input Change Moves The Total To The Engine Value Each Time
    [Documentation]    Change a footing input via PUT and compare with the engine after every write.
    [Tags]    smoke
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${before}=    Summary Total In List    ${team}[owner]    ${team}[ws]    ${pid}
    ${four}=    Footing Input    count=${4}
    Put Doc    ${team}[owner]    ${pid}    calc:footing    ${four}    0
    ${one}=    List Total Should Equal Engine    ${team}[owner]    ${team}[ws]    ${pid}
    ${eight}=    Footing Input    count=${8}
    Put Doc    ${team}[owner]    ${pid}    calc:footing    ${eight}    1
    ${two}=    List Total Should Equal Engine    ${team}[owner]    ${team}[ws]    ${pid}
    Should Not Be Equal As Numbers    ${one}[constructionTotal]    ${before}
    Should Not Be Equal As Numbers    ${one}[constructionTotal]    ${two}[constructionTotal]
    Put Doc    ${team}[owner]    ${pid}    calc:footing    ${NONE}    2
    ${three}=    List Total Should Equal Engine    ${team}[owner]    ${team}[ws]    ${pid}
    Numbers Should Be Close    ${three}[constructionTotal]    ${SAMPLE_TOTAL}    0.01

Several Documents Together Add Up As The Engine Says
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Put Doc    ${team}[owner]    ${pid}    calc:footing    ${{ {'rows': [{'name': 'F1', 'count': 6, 'width': 1.5, 'length': 1.5, 'depth': 0.4, 'excavationDepth': 1.4, 'sandThickness': 0.05, 'leanThickness': 0.05, 'shortBarSize': 'DB12', 'shortBarCount': 8, 'longBarSize': 'DB12', 'longBarCount': 8, 'ringBarSize': 'RB6', 'ringBarCount': 0}]} }}    0
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${{ {'width': 10, 'length': 12, 'height': 0.5} }}    0
    Put Doc    ${team}[owner]    ${pid}    boq:R13    ${{ {'mat': 350} }}    0
    ${expected}=    List Total Should Equal Engine    ${team}[owner]    ${team}[ws]    ${pid}
    Should Not Be Equal As Numbers    ${expected}[constructionTotal]    ${SAMPLE_TOTAL}

Created Blank Project Total Follows The Engine After A Write
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}    blank
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${{ {'width': 10, 'length': 12, 'height': 0.5} }}    0
    List Total Should Equal Engine    ${team}[owner]    ${team}[ws]    ${pid}    blank

# ── permissions and state ──────────────────────────────────────────────────────────
Write Permission Table Owner Admin Estimator Allowed Viewer Forbidden
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Put Doc    ${team}[admin]    ${pid}    calc:fill    ${fill}    1
    Put Doc    ${team}[estimator]    ${pid}    calc:fill    ${fill}    2
    ${resp}=    Put Doc    ${team}[viewer]    ${pid}    calc:fill    ${fill}    3    403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Put Doc    ${team}[outsider]    ${pid}    calc:fill    ${fill}    3    404
    Error Code Should Be    ${resp}    not_found
    ${stored}=    Doc Version In Database    ${pid}    calc:fill
    Should Be Equal As Integers    ${stored}    3

Viewer Cannot Reset A Document Either
    [Tags]    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Put Doc    ${team}[viewer]    ${pid}    calc:fill    ${NONE}    1    403
    ${stored}=    Doc Data In Database    ${pid}    calc:fill
    Should Be Equal    ${stored}    ${fill}

Write To Another Tenants Project Answers 404
    [Tags]    security
    ${team}=    Create Owner Workspace
    ${other}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    ${resp}=    Put Doc    ${other}[owner]    ${pid}    calc:fill    ${fill}    0    404
    Error Code Should Be    ${resp}    not_found
    Doc Should Not Exist In Database    ${pid}    calc:fill

Write Without A Token Answers 401
    [Tags]    security
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Create Anonymous Session    anon
    VAR    &{body}    data=${{ {'projectName': 'x'} }}    baseVersion=${1}
    ${resp}=    PUT On Session    anon    /projects/${pid}/docs/meta    json=${body}    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

Write To An Archived Project Answers 409 Until It Is Restored
    [Tags]    negative    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Set Archived    ${team}[owner]    ${pid}    ${True}
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0    409
    Error Code Should Be    ${resp}    conflict
    Doc Should Not Exist In Database    ${pid}    calc:fill
    Set Archived    ${team}[owner]    ${pid}    ${False}
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0

Reset Of A Document In An Archived Project Is Refused Too
    [Tags]    negative    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Set Archived    ${team}[owner]    ${pid}    ${True}
    ${resp}=    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${NONE}    1    409
    Error Code Should Be    ${resp}    conflict
    ${stored}=    Doc Data In Database    ${pid}    calc:fill
    Should Be Equal    ${stored}    ${fill}

Document Write Is Logged As Doc Updated With Its Key
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    ${row}=    Query Row    select action, doc_key from activity_log where project_id = %s and action = 'doc.updated'    ${pid}
    Should Be Equal    ${row}[doc_key]    calc:fill
