*** Settings ***
Documentation       A2 level assignments (``level_assignments``) and the project activity feed (``activity_log``):
...                 assign a workspace member to one of the 37 journey levels, replace and remove, validation,
...                 permission ``levels.assign``; activity entries for every kind of change, newest first, paging
...                 with ``before`` and ``limit``.
Resource            ../../resources/pages/api_projects.resource
Test Tags           api    projects    db


*** Variables ***
${FIRST_LEVEL}      project-info
${FOOTING}          footing


*** Test Cases ***
# ── assignments ────────────────────────────────────────────────────────────────────
Assign A Member To A Level Answers 200 And Writes The Row
    [Tags]    smoke    assignments
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Assign Level    ${team}[admin]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    Should Be Equal    ${resp.json()}[levelId]    ${FOOTING}
    Should Be Equal    ${resp.json()}[userId]    ${team}[estimator][id]
    Should Be Equal    ${resp.json()}[assignedBy]    ${team}[admin][id]
    ${rows}=    Assignment Rows    ${pid}
    Length Should Be    ${rows}    1
    Should Be Equal    ${rows}[0][level_id]    ${FOOTING}
    Should Be Equal    ${rows}[0][user_id]    ${{ __import__('uuid').UUID($team['estimator']['id']) }}
    Should Be Equal    ${rows}[0][assigned_by]    ${{ __import__('uuid').UUID($team['admin']['id']) }}
    ${list}=    List Assignments    ${team}[viewer]    ${pid}
    Should Be Equal    ${list.json()}    ${{ [$resp.json()] }}

Every Member Role Can Be Assigned To A Level
    [Documentation]    Owner, admin, estimator and viewer are all members of the workspace, so all are valid assignees.
    [Tags]    assignments
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${levels}=    Level Ids
    ${index}=    Set Variable    ${0}
    FOR    ${role}    IN    owner    admin    estimator    viewer
        Assign Level    ${team}[owner]    ${pid}    ${levels}[${index}]    ${team}[${role}][id]
        ${index}=    Evaluate    $index + 1
    END
    ${rows}=    Assignment Rows    ${pid}
    Length Should Be    ${rows}    4

All 37 Journey Levels Can Be Assigned
    [Documentation]    Level ids come from the journey definition (37 levels); each answers 200 and has a row.
    [Tags]    assignments    edge
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${levels}=    Level Ids
    Length Should Be    ${levels}    37
    FOR    ${level}    IN    @{levels}
        Assign Level    ${team}[owner]    ${pid}    ${level}    ${team}[estimator][id]
    END
    ${rows}=    Assignment Rows    ${pid}
    Length Should Be    ${rows}    37
    ${list}=    List Assignments    ${team}[owner]    ${pid}
    Length Should Be    ${list.json()}    37
    ${db_levels}=    Evaluate    sorted(r['level_id'] for r in $rows)
    Should Be Equal    ${db_levels}    ${{ sorted($levels) }}

Assigning Another Member Replaces The Assignment
    [Tags]    assignments    state
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    ${resp}=    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[viewer][id]
    Should Be Equal    ${resp.json()}[userId]    ${team}[viewer][id]
    ${rows}=    Assignment Rows    ${pid}
    Length Should Be    ${rows}    1
    Should Be Equal    ${rows}[0][user_id]    ${{ __import__('uuid').UUID($team['viewer']['id']) }}

Assigning The Same Member Twice Keeps One Row
    [Tags]    assignments    edge
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    ${rows}=    Assignment Rows    ${pid}
    Length Should Be    ${rows}    1

Null Removes The Assignment And Answers JSON Null
    [Tags]    smoke    assignments    state
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    ${resp}=    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${NONE}
    Should Be Equal    ${resp.text}    null
    ${rows}=    Assignment Rows    ${pid}
    Should Be Empty    ${rows}
    ${list}=    List Assignments    ${team}[owner]    ${pid}
    Should Be Equal    ${list.json()}    ${{ [] }}

Removing An Assignment That Does Not Exist Answers JSON Null
    [Tags]    assignments    edge
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${NONE}
    Should Be Equal    ${resp.text}    null
    ${rows}=    Assignment Rows    ${pid}
    Should Be Empty    ${rows}

Removing One Level Leaves The Other Assignments
    [Tags]    assignments    state
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    Assign Level    ${team}[owner]    ${pid}    ${FIRST_LEVEL}    ${team}[admin][id]
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${NONE}
    ${rows}=    Assignment Rows    ${pid}
    Length Should Be    ${rows}    1
    Should Be Equal    ${rows}[0][level_id]    ${FIRST_LEVEL}

Unknown Or Malformed Level Id Answers 422
    [Documentation]    Equivalence classes: not a journey level, upper case, with a space, too long, injection.
    [Tags]    assignments    negative
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${long}=    Evaluate    'a' * 65
    @{bad}=    Create List    no-such-level    BAD_LEVEL    Footing    footing%20x    ${long}
    ...    footing%27%3Bdrop%20table%20projects%3B--    ..%2F..%2Fetc    footing%00
    FOR    ${level}    IN    @{bad}
        ${resp}=    Assign Level    ${team}[owner]    ${pid}    ${level}    ${team}[estimator][id]    422
        Error Code Should Be    ${resp}    unprocessable
    END
    ${rows}=    Assignment Rows    ${pid}
    Should Be Empty    ${rows}

Unknown Level Is Refused Even When Removing
    [Tags]    assignments    negative
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Assign Level    ${team}[owner]    ${pid}    no-such-level    ${NONE}    422
    Error Code Should Be    ${resp}    unprocessable

Assignee Who Is Not A Member Answers 422
    [Documentation]    A registered user of another workspace, and a random id, are not valid assignees.
    [Tags]    assignments    negative    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[outsider][id]    422
    Error Code Should Be    ${resp}    unprocessable
    ${resp}=    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    00000000-0000-4000-8000-000000000000    422
    Error Code Should Be    ${resp}    unprocessable
    ${rows}=    Assignment Rows    ${pid}
    Should Be Empty    ${rows}

Invalid User Id Values Are Rejected
    [Tags]    assignments    negative
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${bad}    IN    not-a-uuid    ${EMPTY}    ${5}    ${True}    ${{ ['x'] }}
        ${resp}=    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${bad}    400
        Error Code Should Be    ${resp}    validation_failed
    END
    ${resp}=    PUT On Session    ${team}[owner][alias]    /projects/${pid}/assignments/${FOOTING}    json=${{ {} }}    expected_status=400
    Error Code Should Be    ${resp}    validation_failed

Assignment Ignores Fields The Client Must Not Set
    [Tags]    assignments    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    VAR    &{body}    userId=${team}[estimator][id]    assignedBy=${team}[viewer][id]    levelId=${FIRST_LEVEL}
    ${resp}=    PUT On Session    ${team}[admin][alias]    /projects/${pid}/assignments/${FOOTING}    json=${body}    expected_status=200
    Should Be Equal    ${resp.json()}[assignedBy]    ${team}[admin][id]
    Should Be Equal    ${resp.json()}[levelId]    ${FOOTING}

Assignment Permission Table Owner And Admin Only
    [Documentation]    ``levels.assign``: owner and admin 200; estimator and viewer 403; outsider 404. Nothing is written
    ...    by the refused calls.
    [Tags]    assignments    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Assign Level    ${team}[estimator]    ${pid}    ${FOOTING}    ${team}[estimator][id]    403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Assign Level    ${team}[viewer]    ${pid}    ${FOOTING}    ${team}[viewer][id]    403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Assign Level    ${team}[outsider]    ${pid}    ${FOOTING}    ${team}[outsider][id]    404
    Error Code Should Be    ${resp}    not_found
    ${rows}=    Assignment Rows    ${pid}
    Should Be Empty    ${rows}
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    Assign Level    ${team}[admin]    ${pid}    ${FIRST_LEVEL}    ${team}[viewer][id]
    ${rows}=    Assignment Rows    ${pid}
    Length Should Be    ${rows}    2

Estimator And Viewer Cannot Remove An Assignment
    [Tags]    assignments    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    Assign Level    ${team}[estimator]    ${pid}    ${FOOTING}    ${NONE}    403
    Assign Level    ${team}[viewer]    ${pid}    ${FOOTING}    ${NONE}    403
    ${rows}=    Assignment Rows    ${pid}
    Length Should Be    ${rows}    1

Reading Assignments Needs Membership
    [Tags]    assignments    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    FOR    ${role}    IN    owner    admin    estimator    viewer
        ${resp}=    List Assignments    ${team}[${role}]    ${pid}
        Length Should Be    ${resp.json()}    1
    END
    ${resp}=    List Assignments    ${team}[outsider]    ${pid}    404
    Error Code Should Be    ${resp}    not_found

Assignments Of One Project Do Not Leak Into Another
    [Tags]    assignments    security
    ${team}=    Create Team
    ${one}=    New Sample Project Id    ${team}
    ${two}=    New Sample Project Id    ${team}
    Assign Level    ${team}[owner]    ${one}    ${FOOTING}    ${team}[estimator][id]
    ${resp}=    List Assignments    ${team}[owner]    ${two}
    Should Be Equal    ${resp.json()}    ${{ [] }}

Another Tenants Owner Cannot Assign Or Read
    [Tags]    assignments    security
    ${team}=    Create Team
    ${other}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Assign Level    ${other}[owner]    ${pid}    ${FOOTING}    ${other}[owner][id]    404
    List Assignments    ${other}[owner]    ${pid}    404
    ${rows}=    Assignment Rows    ${pid}
    Should Be Empty    ${rows}

Assignment Routes Without A Token Answer 401
    [Tags]    assignments    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    Create Anonymous Session    anon
    GET On Session    anon    /projects/${pid}/assignments    expected_status=401
    VAR    &{body}    userId=${team}[estimator][id]
    PUT On Session    anon    /projects/${pid}/assignments/${FOOTING}    json=${body}    expected_status=401

Assignment In An Archived Project Is Allowed
    [Documentation]    Characterisation: archiving only freezes renames and document writes.
    [Tags]    assignments    state
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    Set Archived    ${team}[owner]    ${pid}    ${True}
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]

Removing A Member From The Workspace Drops Their Assignments
    [Documentation]    State transition across modules: member removed (A1 route) -> their rows in every project are gone,
    ...    other people's assignments stay.
    [Tags]    assignments    state
    ${team}=    Create Team
    ${one}=    New Sample Project Id    ${team}
    ${two}=    New Sample Project Id    ${team}
    Assign Level    ${team}[owner]    ${one}    ${FOOTING}    ${team}[estimator][id]
    Assign Level    ${team}[owner]    ${two}    ${FIRST_LEVEL}    ${team}[estimator][id]
    Assign Level    ${team}[owner]    ${one}    ${FIRST_LEVEL}    ${team}[viewer][id]
    DELETE On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/members/${team}[estimator][id]    expected_status=204
    ${rows_one}=    Assignment Rows    ${one}
    ${rows_two}=    Assignment Rows    ${two}
    Length Should Be    ${rows_one}    1
    Should Be Equal    ${rows_one}[0][level_id]    ${FIRST_LEVEL}
    Should Be Empty    ${rows_two}

Removed Member Cannot Be Assigned Again
    [Tags]    assignments    negative    state
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    DELETE On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/members/${team}[estimator][id]    expected_status=204
    ${resp}=    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]    422
    Error Code Should Be    ${resp}    unprocessable

Deleting The Project Removes Its Assignments
    [Tags]    assignments    state
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    Assign Level    ${team}[owner]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    Delete Project    ${team}[owner]    ${pid}
    ${n}=    Query Value    select count(*) from level_assignments where project_id = %s    ${pid}
    Should Be Equal As Integers    ${n}    0

# ── activity: entries ──────────────────────────────────────────────────────────────
New Project Has Exactly One Created Entry
    [Tags]    smoke    activity
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Get Activity    ${team}[owner]    ${pid}
    Length Should Be    ${resp.json()}    1
    Should Be Equal    ${resp.json()}[0][action]    project.created
    Should Be Equal    ${resp.json()}[0][docKey]    ${NONE}
    Should Be Equal    ${resp.json()}[0][userId]    ${team}[owner][id]
    Should Be Equal    ${resp.json()}[0][projectId]    ${pid}

Every Kind Of Change Is Logged Newest First
    [Documentation]    Create, doc edit, doc reset, rename, archive, restore, revision, assign, unassign: nine entries in
    ...    this order (newest first) in the API and in ``activity_log``.
    [Tags]    smoke    activity
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[estimator]    ${pid}    calc:fill    ${fill}    0
    Put Doc    ${team}[estimator]    ${pid}    calc:fill    ${NONE}    1
    Rename Project    ${team}[estimator]    ${pid}    Renamed
    Set Archived    ${team}[estimator]    ${pid}    ${True}
    Set Archived    ${team}[estimator]    ${pid}    ${False}
    Create Revision    ${team}[estimator]    ${pid}    R1
    Assign Level    ${team}[admin]    ${pid}    ${FOOTING}    ${team}[estimator][id]
    Assign Level    ${team}[admin]    ${pid}    ${FOOTING}    ${NONE}
    ${expected}=    Create List    level.unassigned    level.assigned    revision.created    project.restored
    ...    project.archived    project.renamed    doc.reset    doc.updated    project.created
    ${api}=    Activity Actions    ${team}[viewer]    ${pid}
    ${db}=    Activity Actions In Database    ${pid}
    Should Be Equal    ${api}    ${expected}
    Should Be Equal    ${db}    ${expected}

Entries Carry The Document Key And The Acting User
    [Tags]    activity
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[estimator]    ${pid}    calc:fill    ${fill}    0
    Put Doc    ${team}[admin]    ${pid}    boq:R13    ${{ {'mat': 350} }}    0
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${NONE}    1
    ${resp}=    Get Activity    ${team}[owner]    ${pid}
    ${rows}=    Evaluate    [(a['action'], a['docKey'], a['userId']) for a in $resp.json()]
    ${owner}=    Set Variable    ${team}[owner][id]
    ${admin}=    Set Variable    ${team}[admin][id]
    ${estimator}=    Set Variable    ${team}[estimator][id]
    Should Be Equal    ${rows}[0]    ${{ ('doc.reset', 'calc:fill', $owner) }}
    Should Be Equal    ${rows}[1]    ${{ ('doc.updated', 'boq:R13', $admin) }}
    Should Be Equal    ${rows}[2]    ${{ ('doc.updated', 'calc:fill', $estimator) }}

Entry Fields Have The Documented Types
    [Tags]    activity
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Get Activity    ${team}[owner]    ${pid}
    ${entry}=    Set Variable    ${resp.json()}[0]
    Should Match Regexp    ${entry}[id]    ^\\d+$
    Should Match Regexp    ${entry}[at]    ^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$
    ${keys}=    Evaluate    sorted($entry)
    Should Be Equal    ${keys}    ${{ ['action', 'at', 'docKey', 'id', 'projectId', 'userId'] }}

Ids Are Strictly Decreasing In The Feed
    [Tags]    activity
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Rename Project    ${team}[owner]    ${pid}    Renamed
    Create Revision    ${team}[owner]    ${pid}    R1
    ${resp}=    Get Activity    ${team}[owner]    ${pid}
    ${ids}=    Evaluate    [int(a['id']) for a in $resp.json()]
    ${sorted}=    Evaluate    sorted($ids, reverse=True)
    Should Be Equal    ${ids}    ${sorted}
    ${unique}=    Evaluate    len(set($ids)) == len($ids)
    Should Be True    ${unique}

Refused And No Op Calls Write No Activity
    [Documentation]    409, 422, 403, an unchanged rename and a restore of an active project are not events.
    [Tags]    activity    negative    state
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    ${count}=    Activity Count    ${pid}
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0    409
    Put Doc    ${team}[owner]    ${pid}    calc:nope    ${fill}    0    422
    Put Doc    ${team}[viewer]    ${pid}    calc:fill    ${fill}    1    403
    Assign Level    ${team}[viewer]    ${pid}    ${FOOTING}    ${team}[viewer][id]    403
    Assign Level    ${team}[owner]    ${pid}    nope    ${team}[viewer][id]    422
    Create Revision    ${team}[viewer]    ${pid}    R1    expected_status=403
    Rename Project    ${team}[viewer]    ${pid}    X    403
    Set Archived    ${team}[owner]    ${pid}    ${False}
    ${after}=    Activity Count    ${pid}
    Should Be Equal As Integers    ${after}    ${count}

Activity Of One Project Does Not Include Another
    [Tags]    activity    security
    ${team}=    Create Owner Workspace
    ${one}=    New Sample Project Id    ${team}
    ${two}=    New Sample Project Id    ${team}
    Rename Project    ${team}[owner]    ${two}    Only two
    ${actions}=    Activity Actions    ${team}[owner]    ${one}
    Should Be Equal    ${actions}    ${{ ['project.created'] }}

Activity Rows Carry The Workspace Of The Project
    [Tags]    activity
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${rows}=    Query Rows    select workspace_id from activity_log where project_id = %s    ${pid}
    Length Should Be    ${rows}    1
    Should Be Equal    ${rows}[0][workspace_id]    ${{ __import__('uuid').UUID($team['ws']) }}

Activity Feed Reads Are Open To Every Member
    [Tags]    activity    security
    ${team}=    Create Team
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${role}    IN    owner    admin    estimator    viewer
        ${actions}=    Activity Actions    ${team}[${role}]    ${pid}
        Should Be Equal    ${actions}    ${{ ['project.created'] }}
    END
    ${resp}=    Get Activity    ${team}[outsider]    ${pid}    expected_status=404
    Error Code Should Be    ${resp}    not_found

Activity Of Another Tenants Project Answers 404
    [Tags]    activity    security
    ${team}=    Create Owner Workspace
    ${other}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Get Activity    ${other}[owner]    ${pid}    expected_status=404

Activity Without A Token Answers 401
    [Tags]    activity    security
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Create Anonymous Session    anon
    ${resp}=    GET On Session    anon    /projects/${pid}/activity    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

Activity Of An Unknown Project Answers 404
    [Tags]    activity    negative
    ${team}=    Create Owner Workspace
    FOR    ${bad}    IN    00000000-0000-4000-8000-000000000000    not-a-uuid
        Get Activity    ${team}[owner]    ${bad}    expected_status=404
    END

Deleting The Project Removes Its Activity
    [Tags]    activity    state
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Rename Project    ${team}[owner]    ${pid}    Soon gone
    Delete Project    ${team}[owner]    ${pid}
    ${n}=    Activity Count    ${pid}
    Should Be Equal As Integers    ${n}    0

# ── activity: paging ───────────────────────────────────────────────────────────────
Limit Returns The Newest Entries
    [Tags]    activity    paging
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Rename Project    ${team}[owner]    ${pid}    One
    Rename Project    ${team}[owner]    ${pid}    Two
    ${actions}=    Activity Actions    ${team}[owner]    ${pid}    ?limit=2
    Should Be Equal    ${actions}    ${{ ['project.renamed', 'project.renamed'] }}
    ${actions}=    Activity Actions    ${team}[owner]    ${pid}    ?limit=1
    Length Should Be    ${actions}    1

Paging With Before Walks The Whole Feed Without Gaps Or Repeats
    [Documentation]    Pages of 2 over 7 entries: the concatenation equals the full feed (ids), last page then empty.
    [Tags]    smoke    activity    paging
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${name}    IN    A    B    C    D    E    F
        Rename Project    ${team}[owner]    ${pid}    Name ${name}
    END
    ${full}=    Get Activity    ${team}[owner]    ${pid}
    ${all_ids}=    Evaluate    [a['id'] for a in $full.json()]
    Length Should Be    ${all_ids}    7
    ${walked}=    Create List
    ${before}=    Set Variable    ${EMPTY}
    FOR    ${page}    IN RANGE    10
        ${query}=    Set Variable If    '${before}' == ''    ?limit=2    ?limit=2&before=${before}
        ${resp}=    Get Activity    ${team}[owner]    ${pid}    ${query}
        IF    not $resp.json()    BREAK
        ${ids}=    Evaluate    [a['id'] for a in $resp.json()]
        Append To List    ${walked}    @{ids}
        ${before}=    Set Variable    ${ids}[-1]
    END
    Should Be Equal    ${walked}    ${all_ids}

Before Excludes The Given Id And Returns Only Older Entries
    [Tags]    activity    paging    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Rename Project    ${team}[owner]    ${pid}    One
    Rename Project    ${team}[owner]    ${pid}    Two
    ${full}=    Get Activity    ${team}[owner]    ${pid}
    ${newest}=    Set Variable    ${full.json()}[0][id]
    ${resp}=    Get Activity    ${team}[owner]    ${pid}    ?before=${newest}
    ${ids}=    Evaluate    [a['id'] for a in $resp.json()]
    Should Not Contain    ${ids}    ${newest}
    Length Should Be    ${ids}    2
    ${resp}=    Get Activity    ${team}[owner]    ${pid}    ?before=${full.json()}[-1][id]
    Should Be Equal    ${resp.json()}    ${{ [] }}

Before Zero Is Rejected Because Ids Start At 1
    [Documentation]    Characterisation: the contract pattern allows ``0`` but the server answers 400 (no entry can be older
    ...    than id 0, ids are positive).
    [Tags]    activity    paging    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Get Activity    ${team}[owner]    ${pid}    ?before=0    400
    Error Code Should Be    ${resp}    validation_failed

Default Page Is 50 Entries And Limit 200 Returns More
    [Documentation]    55 entries (create + 54 document writes): default 50, ``limit=200`` all 55, ``limit=54`` 54.
    [Tags]    activity    paging    edge    slow
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${version}    IN RANGE    0    54
        Put Doc    ${team}[owner]    ${pid}    calc:fill    ${{ {'width': 10 + $version, 'length': 12, 'height': 0.5} }}    ${version}
    END
    ${default}=    Get Activity    ${team}[owner]    ${pid}
    Length Should Be    ${default.json()}    50
    ${all}=    Get Activity    ${team}[owner]    ${pid}    ?limit=200
    Length Should Be    ${all.json()}    55
    ${n}=    Activity Count    ${pid}
    Should Be Equal As Integers    ${n}    55
    ${page}=    Get Activity    ${team}[owner]    ${pid}    ?limit=54
    Length Should Be    ${page.json()}    54

Invalid Limit Values Are Rejected
    [Documentation]    Boundary and equivalence classes: 0, 201, negative, fractional, text, empty.
    [Tags]    activity    paging    negative    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${limit}    IN    0    201    -1    1.5    abc    ${EMPTY}
        ${resp}=    Get Activity    ${team}[owner]    ${pid}    ?limit=${limit}    400
        Error Code Should Be    ${resp}    validation_failed
    END

Limit Of 1 And 200 Are Accepted
    [Tags]    activity    paging    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    Get Activity    ${team}[owner]    ${pid}    ?limit=1
    Get Activity    ${team}[owner]    ${pid}    ?limit=200

Invalid Before Values Are Rejected
    [Tags]    activity    paging    negative
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    FOR    ${before}    IN    -1    abc    1.5    ${EMPTY}    1;drop    0x10
        ${resp}=    Get Activity    ${team}[owner]    ${pid}    ?before=${before}    400
        Error Code Should Be    ${resp}    validation_failed
    END

Before Larger Than A 64 Bit Integer Is Not A Server Error
    [Documentation]    Error guessing: ``before`` matches ``^\\d+$`` but is bound to a bigint column; a 24 digit value
    ...    overflows it. Expected: 200 with an empty list (nothing is older than...nothing newer) or a 400. Found 500.
    [Tags]    activity    paging    negative    edge    bug
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Get Activity    ${team}[owner]    ${pid}    ?before=999999999999999999999999    400
    Error Code Should Be    ${resp}    validation_failed

Unknown Query Parameters Are Ignored
    [Tags]    activity    edge
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${resp}=    Get Activity    ${team}[owner]    ${pid}    ?foo=bar&limit=5
    Length Should Be    ${resp.json()}    1
