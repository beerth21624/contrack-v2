*** Settings ***
Documentation       Keywords of the workforce module ("การจัดคน"): people, crews, company rate cards, crews on a project's
...                 planned tasks, project supervisors and waiting windows (task lags), over HTTP, plus the database
...                 read-backs of ``people``, ``crews``, ``crew_members``, ``crew_assignments``, ``project_supervisors``,
...                 ``project_task_lags`` and ``rate_cards``.
...                 Every request keyword states the HTTP status it expects (default 200; creates pass 201, archives 204).
Library             Collections
Library             String
Library             ${CURDIR}/../../libraries/WorkforceBulk.py
Resource            ../api.resource
Resource            ../db.resource
Resource            api_projects.resource


*** Variables ***
${ZERO ID}              00000000-0000-4000-8000-000000000000
# Far future / far past: the in-use rule looks at "ends today or later" in Bangkok time.
${FUTURE START}         2099-03-02
${FUTURE END}           2099-03-06
${PAST START}           2020-03-02
${PAST END}             2020-03-06
${TASK A}               2.1
${TASK B}               3.2


*** Keywords ***
# ── set-up ─────────────────────────────────────────────────────────────────────────
Create Workforce Team
    [Documentation]    Company workspace with owner, admin, estimator, viewer and an outsider (a user of another
    ...    tenant), the workforce module switched on, and a ``sample`` project. Returns ``&{team}``: owner, admin,
    ...    estimator, viewer, outsider, ws, project_id.
    [Arguments]    ${module_on}=${True}
    ${team}=    Create Team
    IF    ${module_on}    Switch Module    ${team}[owner]    ${team}[ws]    workforce    ${True}
    ${project}=    Create Project Via API    ${team}[owner]    ${team}[ws]    start=sample
    Set To Dictionary    ${team}    project_id=${project}[project][id]
    RETURN    ${team}

Create Second Workforce Team
    [Documentation]    A second, unrelated company (own owner, workspace with the module on, sample project): the "other
    ...    tenant" of the isolation tests. Returns ``&{team}`` (owner, ws, project_id).
    ${owner}=    Register User Via API    rival
    ${ws}=    Create Company Workspace Via API    ${owner}
    Switch Module    ${owner}    ${ws}    workforce    ${True}
    ${project}=    Create Project Via API    ${owner}    ${ws}    start=sample
    VAR    &{team}    owner=${owner}    ws=${ws}    project_id=${project}[project][id]
    RETURN    ${team}

# ── raw calls ──────────────────────────────────────────────────────────────────────
Wf Call
    [Documentation]    One HTTP call as ``${user}`` (``GET`` / ``POST`` / ``PATCH`` / ``PUT`` / ``DELETE``) that must
    ...    answer ``${expected}``. Returns the response.
    [Arguments]    ${user}    ${method}    ${path}    ${expected}=200    ${body}=${None}
    ${resp}=    Run Keyword    ${method} On Session    ${user}[alias]    ${path}    json=${body}    expected_status=${expected}
    RETURN    ${resp}

Wf Error
    [Documentation]    The call must answer ``${status}`` with the stable error ``${code}``. Returns the response.
    [Arguments]    ${user}    ${method}    ${path}    ${status}    ${code}    ${body}=${None}
    ${resp}=    Wf Call    ${user}    ${method}    ${path}    ${status}    ${body}
    Error Code Should Be    ${resp}    ${code}
    RETURN    ${resp}

Conflict Reason Should Be
    [Documentation]    A 409 ``conflict`` whose ``details.reason`` is ``${reason}``.
    [Arguments]    ${resp}    ${reason}
    Error Code Should Be    ${resp}    conflict
    Should Be Equal    ${resp.json()}[details][reason]    ${reason}

Post Raw Body
    [Documentation]    POST / PATCH / PUT exactly this text as a JSON body (malformed JSON, wrong types).
    [Arguments]    ${user}    ${method}    ${path}    ${raw}    ${expected}
    ${bytes}=    Evaluate    $raw.encode('utf-8')
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${resp}=    Run Keyword    ${method} On Session    ${user}[alias]    ${path}    data=${bytes}    headers=${headers}
    ...    expected_status=${expected}
    RETURN    ${resp}

# ── bodies ─────────────────────────────────────────────────────────────────────────
Person Body
    [Documentation]    A valid person body; override or add fields with ``name=value``.
    [Arguments]    &{override}
    ${name}=    Unique Name    ช่างทดสอบ
    VAR    &{body}    name=${name}    role=skilled    employment=daily
    Set To Dictionary    ${body}    &{override}
    RETURN    ${body}

Crew Body
    [Documentation]    A valid crew body (masonry, 2 skilled, 3 labourers); override or add fields with ``name=value``.
    [Arguments]    &{override}
    ${name}=    Unique Name    ทีมทดสอบ
    VAR    &{body}    name=${name}    trade=masonry    skilledCount=${2}    labourerCount=${3}
    Set To Dictionary    ${body}    &{override}
    RETURN    ${body}

Rate Card Body
    [Documentation]    A valid rate card body (800 / 500); override or add fields with ``name=value``.
    [Arguments]    &{override}
    ${name}=    Unique Name    ชุดค่าแรง
    VAR    &{body}    name=${name}    skilledRate=${800}    labourerRate=${500}
    Set To Dictionary    ${body}    &{override}
    RETURN    ${body}

Assignment Body
    [Documentation]    A valid assignment body for a crew on a task of a project, far in the future by default.
    [Arguments]    ${project_id}    ${crew_id}    ${task_id}=${TASK A}    ${start}=${FUTURE START}    ${end}=${FUTURE END}
    ...    &{override}
    VAR    &{body}    projectId=${project_id}    taskId=${task_id}    crewId=${crew_id}    start=${start}    end=${end}
    Set To Dictionary    ${body}    &{override}
    RETURN    ${body}

# ── people ─────────────────────────────────────────────────────────────────────────
Create Person Via API
    [Documentation]    ``POST /workspaces/:id/people``. Returns the response (201 unless ``${status}`` says otherwise).
    [Arguments]    ${user}    ${ws}    ${status}=201    &{fields}
    ${body}=    Person Body    &{fields}
    ${resp}=    Wf Call    ${user}    POST    /workspaces/${ws}/people    ${status}    ${body}
    RETURN    ${resp}

Add Person
    [Documentation]    Create a person as ``${user}`` and return its JSON.
    [Arguments]    ${user}    ${ws}    &{fields}
    ${resp}=    Create Person Via API    ${user}    ${ws}    201    &{fields}
    RETURN    ${resp.json()}

List People
    [Arguments]    ${user}    ${ws}    ${status}=200
    ${resp}=    Wf Call    ${user}    GET    /workspaces/${ws}/people    ${status}
    RETURN    ${resp}

Person Ids Listed For
    [Arguments]    ${user}    ${ws}
    ${resp}=    List People    ${user}    ${ws}
    ${ids}=    Evaluate    [p['id'] for p in $resp.json()]
    RETURN    ${ids}

# ── crews ──────────────────────────────────────────────────────────────────────────
Create Crew Via API
    [Documentation]    ``POST /workspaces/:id/crews``. Returns the response (201 unless ``${status}`` says otherwise).
    [Arguments]    ${user}    ${ws}    ${status}=201    &{fields}
    ${body}=    Crew Body    &{fields}
    ${resp}=    Wf Call    ${user}    POST    /workspaces/${ws}/crews    ${status}    ${body}
    RETURN    ${resp}

Add Crew
    [Documentation]    Create a crew as ``${user}`` and return its JSON.
    [Arguments]    ${user}    ${ws}    &{fields}
    ${resp}=    Create Crew Via API    ${user}    ${ws}    201    &{fields}
    RETURN    ${resp.json()}

List Crews
    [Arguments]    ${user}    ${ws}    ${status}=200
    ${resp}=    Wf Call    ${user}    GET    /workspaces/${ws}/crews    ${status}
    RETURN    ${resp}

Crew Ids Listed For
    [Arguments]    ${user}    ${ws}
    ${resp}=    List Crews    ${user}    ${ws}
    ${ids}=    Evaluate    [c['id'] for c in $resp.json()]
    RETURN    ${ids}

# ── rate cards ─────────────────────────────────────────────────────────────────────
Create Rate Card Via API
    [Documentation]    ``POST /workspaces/:id/rate-cards``. Returns the response (201 unless ``${status}`` says otherwise).
    [Arguments]    ${user}    ${ws}    ${status}=201    &{fields}
    ${body}=    Rate Card Body    &{fields}
    ${resp}=    Wf Call    ${user}    POST    /workspaces/${ws}/rate-cards    ${status}    ${body}
    RETURN    ${resp}

Add Rate Card
    [Documentation]    Create a rate card as ``${user}`` and return its JSON.
    [Arguments]    ${user}    ${ws}    &{fields}
    ${resp}=    Create Rate Card Via API    ${user}    ${ws}    201    &{fields}
    RETURN    ${resp.json()}

List Rate Cards
    [Arguments]    ${user}    ${ws}    ${status}=200
    ${resp}=    Wf Call    ${user}    GET    /workspaces/${ws}/rate-cards    ${status}
    RETURN    ${resp}

# ── assignments, supervisors, lags ─────────────────────────────────────────────────
Create Assignment Via API
    [Documentation]    ``POST /workspaces/:id/crew-assignments``. Returns the response.
    [Arguments]    ${user}    ${ws}    ${project_id}    ${crew_id}    ${status}=201    ${task_id}=${TASK A}
    ...    ${start}=${FUTURE START}    ${end}=${FUTURE END}    &{override}
    ${body}=    Assignment Body    ${project_id}    ${crew_id}    ${task_id}    ${start}    ${end}    &{override}
    ${resp}=    Wf Call    ${user}    POST    /workspaces/${ws}/crew-assignments    ${status}    ${body}
    RETURN    ${resp}

Add Assignment
    [Documentation]    Assign a crew as ``${user}`` and return the assignment JSON.
    [Arguments]    ${user}    ${ws}    ${project_id}    ${crew_id}    ${task_id}=${TASK A}    ${start}=${FUTURE START}
    ...    ${end}=${FUTURE END}    &{override}
    ${resp}=    Create Assignment Via API    ${user}    ${ws}    ${project_id}    ${crew_id}    201    ${task_id}    ${start}
    ...    ${end}    &{override}
    RETURN    ${resp.json()}

List Assignments Of Workspace
    [Documentation]    ``GET /workspaces/:id/crew-assignments``; named arguments are the query filters.
    [Arguments]    ${user}    ${ws}    ${status}=200    &{filters}
    ${resp}=    GET On Session    ${user}[alias]    /workspaces/${ws}/crew-assignments    params=${filters}
    ...    expected_status=${status}
    RETURN    ${resp}

Put Supervisors
    [Arguments]    ${user}    ${project_id}    ${person_ids}    ${status}=200
    VAR    &{body}    personIds=${person_ids}
    ${resp}=    Wf Call    ${user}    PUT    /projects/${project_id}/supervisors    ${status}    ${body}
    RETURN    ${resp}

Put Task Lags
    [Arguments]    ${user}    ${project_id}    ${lags}    ${status}=200
    VAR    &{body}    lags=${lags}
    ${resp}=    Wf Call    ${user}    PUT    /projects/${project_id}/task-lags    ${status}    ${body}
    RETURN    ${resp}

Lag
    [Documentation]    One task-lag item. A days value typed as digits (``5``) is sent as a number; anything else
    ...    (``${1.5}``, ``five``) is sent as given.
    [Arguments]    ${task_id}    ${days}    ${note}=${None}
    ${number}=    Evaluate    int($days) if isinstance($days, str) and $days.lstrip('-').isdigit() else $days
    VAR    &{lag}    taskId=${task_id}    days=${number}
    IF    $note is not None    Set To Dictionary    ${lag}    note=${note}
    RETURN    ${lag}

# ── database read-backs ────────────────────────────────────────────────────────────
Person Row
    [Arguments]    ${person_id}
    ${row}=    Query Row    select * from people where id = %s    ${person_id}
    RETURN    ${row}

Crew Row
    [Arguments]    ${crew_id}
    ${row}=    Query Row    select * from crews where id = %s    ${crew_id}
    RETURN    ${row}

Rate Card Row
    [Arguments]    ${card_id}
    ${row}=    Query Row    select * from rate_cards where id = %s    ${card_id}
    RETURN    ${row}

Assignment Row
    [Arguments]    ${assignment_id}
    ${row}=    Query Row    select * from crew_assignments where id = %s    ${assignment_id}
    RETURN    ${row}

Count Rows
    [Documentation]    ``select count(*)`` of a one-parameter query as an integer.
    [Arguments]    ${sql}    @{params}
    ${n}=    Query Value    ${sql}    @{params}
    RETURN    ${n}

Crew Member Ids In Database
    [Documentation]    The named members of a crew as stored, in position order (strings).
    [Arguments]    ${crew_id}
    ${rows}=    Query Rows    select person_id from crew_members where crew_id = %s order by position    ${crew_id}
    ${ids}=    Evaluate    [str(r['person_id']) for r in $rows]
    RETURN    ${ids}

Supervisor Ids In Database
    [Arguments]    ${project_id}
    ${rows}=    Query Rows    select person_id from project_supervisors where project_id = %s order by position
    ...    ${project_id}
    ${ids}=    Evaluate    [str(r['person_id']) for r in $rows]
    RETURN    ${ids}

Task Lag Rows In Database
    [Documentation]    ``project_task_lags`` rows of a project as ``{taskId: (days, note)}``.
    [Arguments]    ${project_id}
    ${rows}=    Query Rows    select task_id, days, note from project_task_lags where project_id = %s    ${project_id}
    ${map}=    Evaluate    {r['task_id']: (r['days'], r['note']) for r in $rows}
    RETURN    ${map}

Archived At Should Be Set
    [Arguments]    ${table}    ${row_id}
    ${value}=    Query Value    select archived_at from ${table} where id = %s    ${row_id}
    Should Not Be Equal    ${value}    ${None}    msg=${table} ${row_id} should be archived

Archived At Should Be Empty
    [Arguments]    ${table}    ${row_id}
    ${value}=    Query Value    select archived_at from ${table} where id = %s    ${row_id}
    Should Be Equal    ${value}    ${None}    msg=${table} ${row_id} should not be archived

Bulk Create
    [Documentation]    POST ``${count}`` copies of ``${template}`` one after another (one HTTP session: much faster than
    ...    one Robot keyword per call). With ``name_key`` each copy gets a numbered name. Fails on the first non-201.
    [Arguments]    ${user}    ${path}    ${template}    ${count}    ${name_key}=${EMPTY}
    ${failures}=    Bulk Post    ${API_URL}    ${user}[token]    ${path}    ${template}    ${count}    ${name_key}
    Should Be Empty    ${failures}    msg=Bulk create failed: ${failures}
