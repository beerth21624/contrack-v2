*** Settings ***
Documentation       Workforce module, crews on a project's planned tasks and the project's supervisors and waits:
...                 ``/workspaces/:id/crew-assignments`` (create, list with filters, move, delete),
...                 ``/projects/:id/supervisors`` (replace the whole list), ``/projects/:id/task-lags`` and
...                 ``/workspaces/:id/task-lags`` (0-90 day waits after planned tasks). Owner, admin and estimator assign,
...                 viewer reads, outsider 404, anonymous 401, an archived project refuses writes with 409, and one
...                 company never sees or touches another's rows. Every write is read back from the database.
Resource            ../../resources/pages/api_workforce.resource
Library             ${CURDIR}/../../libraries/WorkforceBulk.py
Test Tags           api    workforce    db


*** Test Cases ***
# ── assignments: create ────────────────────────────────────────────────────────────
Owner Assigns A Crew To A Task And The Row Is Stored
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${resp}=    Create Assignment Via API    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    201    2.1
    ...    2099-03-02    2099-03-06    note=เทพื้นชั้นล่าง
    ${a}=    Set Variable    ${resp.json()}
    Should Be Equal    ${a}[projectId]    ${team}[project_id]
    Should Be Equal    ${a}[crewId]    ${crew}[id]
    Should Be Equal    ${a}[taskId]    2.1
    Should Be Equal    ${a}[start]    2099-03-02
    Should Be Equal    ${a}[end]    2099-03-06
    Should Be Equal    ${a}[note]    เทพื้นชั้นล่าง
    Should Be Equal    ${a}[createdBy]    ${team}[owner][id]
    ${row}=    Assignment Row    ${a}[id]
    Should Be Equal As Strings    ${row}[workspace_id]    ${team}[ws]
    Should Be Equal As Strings    ${row}[project_id]    ${team}[project_id]
    Should Be Equal As Strings    ${row}[crew_id]    ${crew}[id]
    Should Be Equal    ${row}[task_id]    2.1
    Should Be Equal As Strings    ${row}[start_date]    2099-03-02
    Should Be Equal As Strings    ${row}[end_date]    2099-03-06
    Should Be Equal As Strings    ${row}[created_by]    ${team}[owner][id]

Owner Admin And Estimator Can Assign But Viewer Cannot
    [Tags]    security
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    FOR    ${role}    IN    owner    admin    estimator
        ${resp}=    Create Assignment Via API    ${team}[${role}]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
        Should Be Equal    ${resp.json()}[createdBy]    ${team}[${role}][id]
    END
    ${body}=    Assignment Body    ${team}[project_id]    ${crew}[id]
    Wf Error    ${team}[viewer]    POST    /workspaces/${team}[ws]/crew-assignments    403    forbidden    ${body}
    Wf Error    ${team}[outsider]    POST    /workspaces/${team}[ws]/crew-assignments    404    not_found    ${body}
    ${anon}=    Create Anonymous Session    anon
    VAR    &{caller}    alias=${anon}
    Wf Error    ${caller}    POST    /workspaces/${team}[ws]/crew-assignments    401    unauthenticated    ${body}
    ${n}=    Count Rows    select count(*) from crew_assignments where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    3

A Single Day Assignment Is Valid
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    start=2099-05-05    end=2099-05-05
    ${row}=    Assignment Row    ${a}[id]
    Should Be Equal    ${row}[start_date]    ${row}[end_date]

Task Ids From 1.1 To 9.99 Are Accepted
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    FOR    ${task}    IN    1.1    8.6    1.10    9.99    5.9
        ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    task_id=${task}
        Should Be Equal    ${a}[taskId]    ${task}
    END

Invalid Assignment Fields Are Rejected With Validation Failed
    [Documentation]    One bad field at a time (task id format, calendar dates, order, note length, id formats).
    [Tags]    negative
    [Template]    Assignment Field Should Be Rejected
    taskId      0.1
    taskId      1.0
    taskId      1.100
    taskId      10.1
    taskId      1
    taskId      a.b
    taskId      ${EMPTY}
    taskId      ${None}
    start       2099-02-30
    start       2099-13-01
    start       2099-2-3
    start       03/02/2099
    start       ${None}
    start       ${20990302}
    end         2099-02-29
    end         ${None}
    end         2099-03-01
    note        ${{ 'ข' * 501 }}
    crewId      not-a-uuid
    crewId      ${None}
    projectId   not-a-uuid
    projectId   ${None}

Assignment Whose Start Is After Its End Is Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${body}=    Assignment Body    ${team}[project_id]    ${crew}[id]    start=2099-04-10    end=2099-04-09
    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crew-assignments    400    validation_failed    ${body}

Assignment Crew Must Be Active And Of The Workspace
    [Tags]    negative    security
    ${team}=    Create Workforce Team
    ${other}=    Create Second Workforce Team
    ${archived}=    Add Crew    ${team}[owner]    ${team}[ws]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crews/${archived}[id]    204
    ${foreign}=    Add Crew    ${other}[owner]    ${other}[ws]
    FOR    ${bad}    IN    ${ZERO ID}    ${archived}[id]    ${foreign}[id]
        ${body}=    Assignment Body    ${team}[project_id]    ${bad}
        ${resp}=    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crew-assignments    422    unprocessable    ${body}
        Should Be Equal    ${resp.json()}[details][field]    crewId
    END
    ${n}=    Count Rows    select count(*) from crew_assignments where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Assignment Project Must Be A Live Project Of The Workspace
    [Tags]    negative    security
    ${team}=    Create Workforce Team
    ${other}=    Create Second Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    FOR    ${bad}    IN    ${ZERO ID}    ${other}[project_id]
        ${body}=    Assignment Body    ${bad}    ${crew}[id]
        Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crew-assignments    404    not_found    ${body}
    END
    Set Archived    ${team}[owner]    ${team}[project_id]    ${True}
    ${body}=    Assignment Body    ${team}[project_id]    ${crew}[id]
    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crew-assignments    409    conflict    ${body}
    ${n}=    Count Rows    select count(*) from crew_assignments where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

A Crew May Be Booked Twice On Overlapping Days
    [Documentation]    Overlaps are allowed on purpose (the UI warns, the board shows the clash).
    [Tags]    edge    smoke
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    2.1    2099-03-02    2099-03-10
    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    3.2    2099-03-05    2099-03-12
    ${n}=    Count Rows    select count(*) from crew_assignments where crew_id = %s    ${crew}[id]
    Should Be Equal As Integers    ${n}    2

The Same Crew Can Be Booked On Two Projects
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${second}=    Create Project Via API    ${team}[owner]    ${team}[ws]    start=blank
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    Add Assignment    ${team}[owner]    ${team}[ws]    ${second}[project][id]    ${crew}[id]
    ${resp}=    List Assignments Of Workspace    ${team}[owner]    ${team}[ws]    crewId=${crew}[id]
    Length Should Be    ${resp.json()}    2

Assignment Note Is Trimmed And Blank Becomes Null
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    note=${SPACE}
    Should Be Equal    ${a}[note]    ${None}
    ${b}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    note=${SPACE}ใส่ไว้${SPACE}
    Should Be Equal    ${b}[note]    ใส่ไว้

Parallel Identical Assignments All Succeed
    [Tags]    concurrency
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${body}=    Assignment Body    ${team}[project_id]    ${crew}[id]
    ${responses}=    Fire Parallel Requests    ${team}[owner]    POST    /workspaces/${team}[ws]/crew-assignments    ${body}    6
    ${codes}=    Status Codes Of    ${responses}
    Should Be Equal    ${codes}    ${{ [201] * 6 }}
    ${n}=    Count Rows    select count(*) from crew_assignments where crew_id = %s    ${crew}[id]
    Should Be Equal As Integers    ${n}    6

# ── assignments: list ──────────────────────────────────────────────────────────────
Every Member Reads Assignments And Outsiders Do Not
    [Tags]    security
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    FOR    ${role}    IN    owner    admin    estimator    viewer
        ${resp}=    List Assignments Of Workspace    ${team}[${role}]    ${team}[ws]
        Length Should Be    ${resp.json()}    1
    END
    ${resp}=    List Assignments Of Workspace    ${team}[outsider]    ${team}[ws]    404
    Error Code Should Be    ${resp}    not_found
    ${anon}=    Create Anonymous Session    anon
    VAR    &{caller}    alias=${anon}
    Wf Error    ${caller}    GET    /workspaces/${team}[ws]/crew-assignments    401    unauthenticated

Assignments Can Be Filtered By Project Crew And Dates
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${second}=    Create Project Via API    ${team}[owner]    ${team}[ws]    start=blank
    ${c1}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${c2}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${early}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${c1}[id]    2.1    2099-01-01    2099-01-10
    ${mid}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${second}[project][id]    ${c2}[id]    3.1    2099-02-01    2099-02-10
    ${late}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${c2}[id]    4.1    2099-03-01    2099-03-10
    ${all}=    List Assignments Of Workspace    ${team}[owner]    ${team}[ws]
    ${ids}=    Evaluate    [a['id'] for a in $all.json()]
    Should Be Equal    ${ids}    ${{ [$early['id'], $mid['id'], $late['id']] }}    msg=ordered by start
    ${by_project}=    List Assignments Of Workspace    ${team}[owner]    ${team}[ws]    projectId=${team}[project_id]
    Length Should Be    ${by_project.json()}    2
    ${by_crew}=    List Assignments Of Workspace    ${team}[owner]    ${team}[ws]    crewId=${c2}[id]
    Length Should Be    ${by_crew.json()}    2
    ${both}=    List Assignments Of Workspace    ${team}[owner]    ${team}[ws]    projectId=${team}[project_id]    crewId=${c2}[id]
    Length Should Be    ${both.json()}    1
    Should Be Equal    ${both.json()}[0][id]    ${late}[id]
    ${window}=    List Assignments Of Workspace    ${team}[owner]    ${team}[ws]    from=2099-02-10    to=2099-03-01
    ${window_ids}=    Evaluate    [a['id'] for a in $window.json()]
    Should Be Equal    ${window_ids}    ${{ [$mid['id'], $late['id']] }}    msg=ranges that touch the window overlap it
    ${before}=    List Assignments Of Workspace    ${team}[owner]    ${team}[ws]    to=2099-01-01
    Length Should Be    ${before.json()}    1
    ${after}=    List Assignments Of Workspace    ${team}[owner]    ${team}[ws]    from=2099-03-11
    Should Be Empty    ${after.json()}
    ${gap}=    List Assignments Of Workspace    ${team}[owner]    ${team}[ws]    from=2099-01-11    to=2099-01-31
    Should Be Empty    ${gap.json()}

Invalid Assignment Filters Are Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${query}    IN    from\=2099-03-10&to=2099-03-01    from\=2099-02-30    to\=garbage    projectId\=nope    crewId\=nope
        ${resp}=    GET On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/crew-assignments?${query}    expected_status=400
        Error Code Should Be    ${resp}    validation_failed
    END

Filtering By Another Companys Project Or Crew Matches Nothing
    [Tags]    security
    ${a}=    Create Workforce Team
    ${b}=    Create Second Workforce Team
    ${crew}=    Add Crew    ${a}[owner]    ${a}[ws]
    Add Assignment    ${a}[owner]    ${a}[ws]    ${a}[project_id]    ${crew}[id]
    ${resp}=    List Assignments Of Workspace    ${b}[owner]    ${b}[ws]    projectId=${a}[project_id]
    Should Be Empty    ${resp.json()}
    ${resp}=    List Assignments Of Workspace    ${b}[owner]    ${b}[ws]    crewId=${crew}[id]
    Should Be Empty    ${resp.json()}
    ${resp}=    List Assignments Of Workspace    ${b}[owner]    ${a}[ws]    404
    Error Code Should Be    ${resp}    not_found

# ── assignments: change and delete ─────────────────────────────────────────────────
Owner Moves An Assignment To Other Days Crew And Note
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${c1}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${c2}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${c1}[id]
    VAR    &{patch}    crewId=${c2}[id]    start=2099-04-01    end=2099-04-09    note=ย้ายทีม
    ${resp}=    Wf Call    ${team}[estimator]    PATCH    /workspaces/${team}[ws]/crew-assignments/${a}[id]    200    ${patch}
    Should Be Equal    ${resp.json()}[crewId]    ${c2}[id]
    Should Be Equal    ${resp.json()}[taskId]    ${a}[taskId]
    Should Be Equal    ${resp.json()}[projectId]    ${team}[project_id]
    ${row}=    Assignment Row    ${a}[id]
    Should Be Equal As Strings    ${row}[crew_id]    ${c2}[id]
    Should Be Equal As Strings    ${row}[start_date]    2099-04-01
    Should Be Equal As Strings    ${row}[end_date]    2099-04-09
    Should Be Equal    ${row}[note]    ย้ายทีม

Changing Only The Note Or Clearing It Keeps The Days
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    note=เก่า
    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crew-assignments/${a}[id]    200    ${{ {'note': None} }}
    ${row}=    Assignment Row    ${a}[id]
    Should Be Equal    ${row}[note]    ${None}
    Should Be Equal As Strings    ${row}[start_date]    ${FUTURE START}
    Should Be Equal As Strings    ${row}[end_date]    ${FUTURE END}

Moving Only One End Is Checked Against The Other
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crew-assignments/${a}[id]    400    validation_failed
    ...    ${{ {'start': '2099-12-31'} }}
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crew-assignments/${a}[id]    400    validation_failed
    ...    ${{ {'end': '2099-01-01'} }}
    ${row}=    Assignment Row    ${a}[id]
    Should Be Equal As Strings    ${row}[start_date]    ${FUTURE START}
    Should Be Equal As Strings    ${row}[end_date]    ${FUTURE END}

Invalid Assignment Updates Are Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    FOR    ${patch}    IN    ${{ {} }}    ${{ {'start': '2099-02-30'} }}    ${{ {'end': 'tomorrow'} }}    ${{ {'crewId': 'x'} }}
    ...    ${{ {'note': 'ข' * 501} }}
        Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crew-assignments/${a}[id]    400    validation_failed    ${patch}
    END

Moving An Assignment To An Archived Or Foreign Crew Is Refused
    [Tags]    negative    security
    ${team}=    Create Workforce Team
    ${other}=    Create Second Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${archived}=    Add Crew    ${team}[owner]    ${team}[ws]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crews/${archived}[id]    204
    ${foreign}=    Add Crew    ${other}[owner]    ${other}[ws]
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    FOR    ${bad}    IN    ${archived}[id]    ${foreign}[id]    ${ZERO ID}
        Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crew-assignments/${a}[id]    422    unprocessable
        ...    ${{ {'crewId': $bad} }}
    END
    ${row}=    Assignment Row    ${a}[id]
    Should Be Equal As Strings    ${row}[crew_id]    ${crew}[id]

Viewer Cannot Move Or Delete An Assignment
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    Wf Error    ${team}[viewer]    PATCH    /workspaces/${team}[ws]/crew-assignments/${a}[id]    403    forbidden    ${{ {'note': 'x'} }}
    Wf Error    ${team}[viewer]    DELETE    /workspaces/${team}[ws]/crew-assignments/${a}[id]    403    forbidden
    Wf Error    ${team}[outsider]    DELETE    /workspaces/${team}[ws]/crew-assignments/${a}[id]    404    not_found
    ${row}=    Assignment Row    ${a}[id]
    Should Be Equal    ${row}[note]    ${None}

An Archived Project Refuses Assignment Changes
    [Tags]    negative    state
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    Set Archived    ${team}[owner]    ${team}[project_id]    ${True}
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crew-assignments/${a}[id]    409    conflict    ${{ {'note': 'x'} }}
    ${row}=    Assignment Row    ${a}[id]
    Should Be Equal    ${row}[note]    ${None}
    ${listed}=    List Assignments Of Workspace    ${team}[owner]    ${team}[ws]
    Length Should Be    ${listed.json()}    1
    Set Archived    ${team}[owner]    ${team}[project_id]    ${False}
    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crew-assignments/${a}[id]    200    ${{ {'note': 'x'} }}

Unknown Or Malformed Assignment Ids Answer 404
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${bad}    IN    ${ZERO ID}    not-a-uuid
        Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crew-assignments/${bad}    404    not_found    ${{ {'note': 'x'} }}
        Wf Error    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crew-assignments/${bad}    404    not_found
    END

Deleting An Assignment Removes The Row Once
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${a}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    Wf Call    ${team}[estimator]    DELETE    /workspaces/${team}[ws]/crew-assignments/${a}[id]    204
    ${n}=    Count Rows    select count(*) from crew_assignments where id = %s    ${a}[id]
    Should Be Equal As Integers    ${n}    0
    Wf Error    ${team}[estimator]    DELETE    /workspaces/${team}[ws]/crew-assignments/${a}[id]    404    not_found
    Archived At Should Be Empty    crews    ${crew}[id]

Assignments Of One Company Are Invisible And Untouchable For Another
    [Tags]    smoke    security
    ${a}=    Create Workforce Team
    ${b}=    Create Second Workforce Team
    ${crew}=    Add Crew    ${a}[owner]    ${a}[ws]
    ${assignment}=    Add Assignment    ${a}[owner]    ${a}[ws]    ${a}[project_id]    ${crew}[id]
    ${theirs}=    List Assignments Of Workspace    ${b}[owner]    ${b}[ws]
    Should Be Empty    ${theirs.json()}
    Wf Error    ${b}[owner]    PATCH    /workspaces/${b}[ws]/crew-assignments/${assignment}[id]    404    not_found    ${{ {'note': 'x'} }}
    Wf Error    ${b}[owner]    DELETE    /workspaces/${b}[ws]/crew-assignments/${assignment}[id]    404    not_found
    Wf Error    ${b}[owner]    DELETE    /workspaces/${a}[ws]/crew-assignments/${assignment}[id]    404    not_found
    ${body}=    Assignment Body    ${a}[project_id]    ${crew}[id]
    Wf Error    ${b}[owner]    POST    /workspaces/${b}[ws]/crew-assignments    404    not_found    ${body}
    ${n}=    Count Rows    select count(*) from crew_assignments where workspace_id = %s    ${a}[ws]
    Should Be Equal As Integers    ${n}    1

Deleting A Project Removes Its Assignments Supervisors And Waits
    [Tags]    state
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ [$person['id']] }}
    ${lag}=    Lag    2.1    5
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$lag] }}
    Delete Project    ${team}[owner]    ${team}[project_id]
    ${n1}=    Count Rows    select count(*) from crew_assignments where project_id = %s    ${team}[project_id]
    ${n2}=    Count Rows    select count(*) from project_supervisors where project_id = %s    ${team}[project_id]
    ${n3}=    Count Rows    select count(*) from project_task_lags where project_id = %s    ${team}[project_id]
    Should Be Equal As Integers    ${n1}    0
    Should Be Equal As Integers    ${n2}    0
    Should Be Equal As Integers    ${n3}    0
    Archived At Should Be Empty    crews    ${crew}[id]
    Archived At Should Be Empty    people    ${person}[id]

# ── supervisors ────────────────────────────────────────────────────────────────────
A Project Starts Without Supervisors
    ${team}=    Create Workforce Team
    ${resp}=    Wf Call    ${team}[viewer]    GET    /projects/${team}[project_id]/supervisors
    Should Be Equal    ${resp.json()}[projectId]    ${team}[project_id]
    Should Be Empty    ${resp.json()}[personIds]

Owner Names The Supervisors And The Rows Are Stored In Order
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${p1}=    Add Person    ${team}[owner]    ${team}[ws]    role=supervisor
    ${p2}=    Add Person    ${team}[owner]    ${team}[ws]    role=engineer
    ${resp}=    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ [$p2['id'], $p1['id']] }}
    Should Be Equal    ${resp.json()}[personIds]    ${{ [$p2['id'], $p1['id']] }}
    ${ids}=    Supervisor Ids In Database    ${team}[project_id]
    Should Be Equal    ${ids}    ${{ [$p2['id'], $p1['id']] }}
    ${read}=    Wf Call    ${team}[viewer]    GET    /projects/${team}[project_id]/supervisors
    Should Be Equal    ${read.json()}[personIds]    ${{ [$p2['id'], $p1['id']] }}

Putting Supervisors Replaces The Whole List And Empty Clears It
    [Tags]    state
    ${team}=    Create Workforce Team
    ${p1}=    Add Person    ${team}[owner]    ${team}[ws]
    ${p2}=    Add Person    ${team}[owner]    ${team}[ws]
    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ [$p1['id']] }}
    Put Supervisors    ${team}[admin]    ${team}[project_id]    ${{ [$p2['id']] }}
    ${ids}=    Supervisor Ids In Database    ${team}[project_id]
    Should Be Equal    ${ids}    ${{ [$p2['id']] }}
    Put Supervisors    ${team}[estimator]    ${team}[project_id]    ${{ [] }}
    ${ids}=    Supervisor Ids In Database    ${team}[project_id]
    Should Be Empty    ${ids}

Duplicate Supervisors Are Dropped
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${p1}=    Add Person    ${team}[owner]    ${team}[ws]
    ${p2}=    Add Person    ${team}[owner]    ${team}[ws]
    ${resp}=    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ [$p1['id'], $p2['id'], $p1['id']] }}
    Should Be Equal    ${resp.json()}[personIds]    ${{ [$p1['id'], $p2['id']] }}

A Project Keeps At Most 20 Supervisors
    [Tags]    edge    negative
    ${team}=    Create Workforce Team
    ${ids}=    Create List
    FOR    ${i}    IN RANGE    21
        ${p}=    Add Person    ${team}[owner]    ${team}[ws]
        Append To List    ${ids}    ${p}[id]
    END
    ${twenty}=    Evaluate    $ids[:20]
    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${twenty}
    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${ids}    400
    ${stored}=    Supervisor Ids In Database    ${team}[project_id]
    Length Should Be    ${stored}    20

Supervisors Must Be Active People Of The Workspace
    [Tags]    negative    security
    ${team}=    Create Workforce Team
    ${other}=    Create Second Workforce Team
    ${good}=    Add Person    ${team}[owner]    ${team}[ws]
    ${archived}=    Add Person    ${team}[owner]    ${team}[ws]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${archived}[id]    204
    ${foreign}=    Add Person    ${other}[owner]    ${other}[ws]
    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ [$good['id']] }}
    FOR    ${bad}    IN    ${ZERO ID}    ${archived}[id]    ${foreign}[id]
        ${resp}=    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ [$good['id'], $bad] }}    422
        Error Code Should Be    ${resp}    unprocessable
        Should Be Equal    ${resp.json()}[details][field]    personIds
    END
    ${ids}=    Supervisor Ids In Database    ${team}[project_id]
    Should Be Equal    ${ids}    ${{ [$good['id']] }}    msg=a refused PUT changes nothing

Malformed Supervisor Bodies Are Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ ['not-a-uuid'] }}    400
    Wf Error    ${team}[owner]    PUT    /projects/${team}[project_id]/supervisors    400    validation_failed    ${{ {} }}
    Wf Error    ${team}[owner]    PUT    /projects/${team}[project_id]/supervisors    400    validation_failed    ${{ {'personIds': 'abc'} }}

Supervisor Permissions Follow The Assign Right
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    ${p}=    Add Person    ${team}[owner]    ${team}[ws]
    Put Supervisors    ${team}[viewer]    ${team}[project_id]    ${{ [$p['id']] }}    403
    Put Supervisors    ${team}[outsider]    ${team}[project_id]    ${{ [$p['id']] }}    404
    Wf Error    ${team}[outsider]    GET    /projects/${team}[project_id]/supervisors    404    not_found
    ${anon}=    Create Anonymous Session    anon
    VAR    &{caller}    alias=${anon}
    Wf Error    ${caller}    GET    /projects/${team}[project_id]/supervisors    401    unauthenticated
    ${ids}=    Supervisor Ids In Database    ${team}[project_id]
    Should Be Empty    ${ids}
    Put Supervisors    ${team}[estimator]    ${team}[project_id]    ${{ [$p['id']] }}

Supervisors Of An Unknown Project Answer 404
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${bad}    IN    ${ZERO ID}    not-a-uuid
        Wf Error    ${team}[owner]    GET    /projects/${bad}/supervisors    404    not_found
        Wf Error    ${team}[owner]    PUT    /projects/${bad}/supervisors    404    not_found    ${{ {'personIds': []} }}
    END

An Archived Project Keeps Its Supervisors Readable But Not Editable
    [Tags]    negative    state
    ${team}=    Create Workforce Team
    ${p}=    Add Person    ${team}[owner]    ${team}[ws]
    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ [$p['id']] }}
    Set Archived    ${team}[owner]    ${team}[project_id]    ${True}
    ${resp}=    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ [] }}    409
    Error Code Should Be    ${resp}    conflict
    ${read}=    Wf Call    ${team}[viewer]    GET    /projects/${team}[project_id]/supervisors
    Should Be Equal    ${read.json()}[personIds]    ${{ [$p['id']] }}

Supervisors Are Per Project And Per Company
    [Tags]    security
    ${a}=    Create Workforce Team
    ${b}=    Create Second Workforce Team
    ${second}=    Create Project Via API    ${a}[owner]    ${a}[ws]    start=blank
    ${p}=    Add Person    ${a}[owner]    ${a}[ws]
    Put Supervisors    ${a}[owner]    ${a}[project_id]    ${{ [$p['id']] }}
    ${read}=    Wf Call    ${a}[owner]    GET    /projects/${second}[project][id]/supervisors
    Should Be Empty    ${read.json()}[personIds]
    Wf Error    ${b}[owner]    GET    /projects/${a}[project_id]/supervisors    404    not_found
    Put Supervisors    ${b}[owner]    ${a}[project_id]    ${{ [] }}    404
    Put Supervisors    ${b}[owner]    ${b}[project_id]    ${{ [$p['id']] }}    422
    ${ids}=    Supervisor Ids In Database    ${a}[project_id]
    Should Be Equal    ${ids}    ${{ [$p['id']] }}

# ── task lags (waiting windows) ────────────────────────────────────────────────────
A Project Starts Without Waits
    ${team}=    Create Workforce Team
    ${resp}=    Wf Call    ${team}[viewer]    GET    /projects/${team}[project_id]/task-lags
    Should Be Equal    ${resp.json()}[projectId]    ${team}[project_id]
    Should Be Empty    ${resp.json()}[lags]

Owner Sets Waits And The Rows Are Stored In Task Order
    [Documentation]    Task ids sort numerically ("1.9" before "1.10"); a blank note becomes null.
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${l1}=    Lag    1.10    7    รอคอนกรีตบ่ม
    ${l2}=    Lag    1.9    3
    ${l3}=    Lag    2.1    0    ${SPACE}
    ${resp}=    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$l1, $l2, $l3] }}
    ${order}=    Evaluate    [l['taskId'] for l in $resp.json()['lags']]
    Should Be Equal    ${order}    ${{ ['1.9', '1.10', '2.1'] }}
    ${rows}=    Task Lag Rows In Database    ${team}[project_id]
    Should Be Equal    ${rows}    ${{ {'1.10': (7, 'รอคอนกรีตบ่ม'), '1.9': (3, None), '2.1': (0, None)} }}
    ${read}=    Wf Call    ${team}[viewer]    GET    /projects/${team}[project_id]/task-lags
    ${read_order}=    Evaluate    [l['taskId'] for l in $read.json()['lags']]
    Should Be Equal    ${read_order}    ${{ ['1.9', '1.10', '2.1'] }}
    Should Be Equal    ${read.json()}[lags][1][note]    รอคอนกรีตบ่ม

Putting Waits Replaces The Whole Set And Empty Clears It
    [Tags]    state
    ${team}=    Create Workforce Team
    ${l1}=    Lag    1.1    5
    ${l2}=    Lag    2.2    9
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$l1] }}
    Put Task Lags    ${team}[estimator]    ${team}[project_id]    ${{ [$l2] }}
    ${rows}=    Task Lag Rows In Database    ${team}[project_id]
    Should Be Equal    ${rows}    ${{ {'2.2': (9, None)} }}
    Put Task Lags    ${team}[admin]    ${team}[project_id]    ${{ [] }}
    ${rows}=    Task Lag Rows In Database    ${team}[project_id]
    Should Be Empty    ${rows}

Wait Days Are Limited To 0 Through 90
    [Tags]    edge    negative
    ${team}=    Create Workforce Team
    ${zero}=    Lag    1.1    0
    ${max}=    Lag    1.2    90
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$zero, $max] }}
    FOR    ${bad}    IN    ${-1}    ${91}    ${1.5}    ${1000}
        ${lag}=    Lag    1.3    ${bad}
        Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$lag] }}    400
    END
    ${rows}=    Task Lag Rows In Database    ${team}[project_id]
    Should Be Equal    ${rows}    ${{ {'1.1': (0, None), '1.2': (90, None)} }}    msg=refused PUTs change nothing

Wait Days Must Be A Number
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${bad}    IN    five    ${None}    ${True}
        Wf Error    ${team}[owner]    PUT    /projects/${team}[project_id]/task-lags    400    validation_failed
        ...    ${{ {'lags': [{'taskId': '1.1', 'days': $bad}]} }}
    END

Invalid Wait Tasks Notes And Bodies Are Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${task}    IN    0.1    1.0    9    x.y    ${EMPTY}    1.100
        ${lag}=    Lag    ${task}    2
        Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$lag] }}    400
    END
    ${long}=    Lag    1.1    2    ${{ 'ข' * 201 }}
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$long] }}    400
    ${ok_note}=    Lag    1.1    2    ${{ 'ข' * 200 }}
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$ok_note] }}
    Wf Error    ${team}[owner]    PUT    /projects/${team}[project_id]/task-lags    400    validation_failed    ${{ {} }}
    Wf Error    ${team}[owner]    PUT    /projects/${team}[project_id]/task-lags    400    validation_failed    ${{ {'lags': 'x'} }}

A Task With Two Waits Is Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${l1}=    Lag    1.1    2
    ${l2}=    Lag    1.1    4
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$l1, $l2] }}    400
    ${rows}=    Task Lag Rows In Database    ${team}[project_id]
    Should Be Empty    ${rows}

A Project Keeps At Most 64 Waits
    [Tags]    edge    negative
    ${team}=    Create Workforce Team
    ${lags}=    Evaluate    [{'taskId': '%d.%d' % (1 + i // 9, 1 + i % 9), 'days': 1} for i in range(65)]
    ${first_64}=    Evaluate    $lags[:64]
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${first_64}
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${lags}    400
    ${rows}=    Task Lag Rows In Database    ${team}[project_id]
    Length Should Be    ${rows}    64

Wait Permissions Follow The Assign Right
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    ${lag}=    Lag    1.1    5
    Put Task Lags    ${team}[viewer]    ${team}[project_id]    ${{ [$lag] }}    403
    Put Task Lags    ${team}[outsider]    ${team}[project_id]    ${{ [$lag] }}    404
    Wf Error    ${team}[outsider]    GET    /projects/${team}[project_id]/task-lags    404    not_found
    ${anon}=    Create Anonymous Session    anon
    VAR    &{caller}    alias=${anon}
    Wf Error    ${caller}    GET    /projects/${team}[project_id]/task-lags    401    unauthenticated
    Wf Error    ${caller}    PUT    /projects/${team}[project_id]/task-lags    401    unauthenticated    ${{ {'lags': []} }}
    ${rows}=    Task Lag Rows In Database    ${team}[project_id]
    Should Be Empty    ${rows}
    FOR    ${role}    IN    owner    admin    estimator
        Put Task Lags    ${team}[${role}]    ${team}[project_id]    ${{ [$lag] }}
    END

Waits Of An Unknown Project Answer 404
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${bad}    IN    ${ZERO ID}    not-a-uuid
        Wf Error    ${team}[owner]    GET    /projects/${bad}/task-lags    404    not_found
        Wf Error    ${team}[owner]    PUT    /projects/${bad}/task-lags    404    not_found    ${{ {'lags': []} }}
    END

An Archived Project Keeps Its Waits Readable But Not Editable
    [Tags]    negative    state
    ${team}=    Create Workforce Team
    ${lag}=    Lag    1.1    5
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$lag] }}
    Set Archived    ${team}[owner]    ${team}[project_id]    ${True}
    ${other}=    Lag    2.2    6
    ${resp}=    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$other] }}    409
    Error Code Should Be    ${resp}    conflict
    ${read}=    Wf Call    ${team}[viewer]    GET    /projects/${team}[project_id]/task-lags
    Length Should Be    ${read.json()}[lags]    1
    ${rows}=    Task Lag Rows In Database    ${team}[project_id]
    Should Be Equal    ${rows}    ${{ {'1.1': (5, None)} }}

Workspace Wait List Shows Only Live Projects With Overrides
    [Documentation]    ``GET /workspaces/:id/task-lags`` feeds the crew board: projects with at least one override, not
    ...    archived.
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${p2}=    Create Project Via API    ${team}[owner]    ${team}[ws]    start=blank
    ${p3}=    Create Project Via API    ${team}[owner]    ${team}[ws]    start=blank
    ${l1}=    Lag    1.1    4
    ${l2}=    Lag    2.2    8
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$l1] }}
    Put Task Lags    ${team}[owner]    ${p2}[project][id]    ${{ [$l2] }}
    Put Task Lags    ${team}[owner]    ${p3}[project][id]    ${{ [] }}
    ${resp}=    Wf Call    ${team}[viewer]    GET    /workspaces/${team}[ws]/task-lags
    ${ids}=    Evaluate    sorted(x['projectId'] for x in $resp.json())
    Should Be Equal    ${ids}    ${{ sorted([$team['project_id'], $p2['project']['id']]) }}
    Set Archived    ${team}[owner]    ${p2}[project][id]    ${True}
    ${resp}=    Wf Call    ${team}[estimator]    GET    /workspaces/${team}[ws]/task-lags
    ${ids}=    Evaluate    [x['projectId'] for x in $resp.json()]
    Should Be Equal    ${ids}    ${{ [$team['project_id']] }}

Workspace Wait List Respects Roles And Tenants
    [Tags]    security
    ${a}=    Create Workforce Team
    ${b}=    Create Second Workforce Team
    ${lag}=    Lag    1.1    4
    Put Task Lags    ${a}[owner]    ${a}[project_id]    ${{ [$lag] }}
    Wf Error    ${a}[outsider]    GET    /workspaces/${a}[ws]/task-lags    404    not_found
    Wf Error    ${b}[owner]    GET    /workspaces/${a}[ws]/task-lags    404    not_found
    ${mine}=    Wf Call    ${b}[owner]    GET    /workspaces/${b}[ws]/task-lags
    Should Be Empty    ${mine.json()}
    ${anon}=    Create Anonymous Session    anon
    VAR    &{caller}    alias=${anon}
    Wf Error    ${caller}    GET    /workspaces/${a}[ws]/task-lags    401    unauthenticated
    Put Task Lags    ${b}[owner]    ${a}[project_id]    ${{ [$lag] }}    404

Parallel Wait Replacements Never Merge
    [Documentation]    Two PUTs at once are serialised per workspace: the stored set is exactly one of the two bodies.
    [Tags]    concurrency
    ${team}=    Create Workforce Team
    ${set_a}=    Evaluate    {'lags': [{'taskId': '1.1', 'days': 1}, {'taskId': '1.2', 'days': 2}]}
    ${set_b}=    Evaluate    {'lags': [{'taskId': '3.1', 'days': 3}, {'taskId': '3.2', 'days': 4}]}
    ${codes}=    Parallel Put    ${API_URL}    ${team}[owner][token]    /projects/${team}[project_id]/task-lags
    ...    ${{ [$set_a, $set_b] }}
    Should Be Equal    ${codes}    ${{ [200, 200] }}
    ${rows}=    Task Lag Rows In Database    ${team}[project_id]
    ${a}=    Evaluate    {'1.1': (1, None), '1.2': (2, None)}
    ${b}=    Evaluate    {'3.1': (3, None), '3.2': (4, None)}
    Should Be True    $rows == $a or $rows == $b    msg=merged rows: ${rows}


*** Keywords ***
Assignment Field Should Be Rejected
    [Documentation]    An assignment body with this one field wrong answers 400 ``validation_failed``; nothing is stored.
    [Arguments]    ${field}    ${value}
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${body}=    Assignment Body    ${team}[project_id]    ${crew}[id]
    Set To Dictionary    ${body}    ${field}=${value}
    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crew-assignments    400    validation_failed    ${body}
    ${n}=    Count Rows    select count(*) from crew_assignments where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0
