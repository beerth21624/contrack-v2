*** Settings ***
Documentation       Keywords of area A2 (projects core): teams, projects, documents, revisions, level assignments,
...                 activity, module switches, and the database rows behind them.
...                 Every request keyword takes the expected HTTP status (``expected_status``) and returns the response.
Resource            ../api.resource
Resource            ../db.resource
Library             Collections
Library             String


*** Variables ***
${MAX_DOC_BYTES}        ${262144}
${SAMPLE_TOTAL}         ${1855162.25}


*** Keywords ***
# ── teams ──────────────────────────────────────────────────────────────────────────
Join Workspace As
    [Documentation]    Register a new user and make them a member of ``${workspace_id}`` with ``${role}``
    ...    (invitation from ``${owner}`` accepted by the new user). Returns the user dictionary.
    [Arguments]    ${owner}    ${workspace_id}    ${role}
    ${user}=    Register User Via API    ${role}
    VAR    &{invite}    email=${user}[email]    role=${role}
    ${resp}=    POST On Session    ${owner}[alias]    /workspaces/${workspace_id}/invitations    json=${invite}
    ...    expected_status=201
    VAR    &{accept}    token=${resp.json()}[token]
    POST On Session    ${user}[alias]    /invitations/accept    json=${accept}    expected_status=200
    RETURN    ${user}

Create Team
    [Documentation]    A company workspace with an owner, an admin, an estimator and a viewer, plus an outsider who is
    ...    not a member. Returns ``&{team}``: owner, admin, estimator, viewer, outsider, ws (workspace id).
    ${owner}=    Register User Via API    owner
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${admin}=    Join Workspace As    ${owner}    ${ws}    admin
    ${estimator}=    Join Workspace As    ${owner}    ${ws}    estimator
    ${viewer}=    Join Workspace As    ${owner}    ${ws}    viewer
    ${outsider}=    Register User Via API    outsider
    VAR    &{team}    owner=${owner}    admin=${admin}    estimator=${estimator}    viewer=${viewer}
    ...    outsider=${outsider}    ws=${ws}
    RETURN    ${team}

Create Owner Workspace
    [Documentation]    One owner with a company workspace. Returns ``&{team}`` with ``owner`` and ``ws``.
    ${owner}=    Register User Via API    owner
    ${ws}=    Create Company Workspace Via API    ${owner}
    VAR    &{team}    owner=${owner}    ws=${ws}
    RETURN    ${team}

Bad Token Session
    [Documentation]    Session whose Bearer token is garbage.
    ${alias}=    Unique Suffix
    Create Session    ${alias}    ${API_URL}    headers=${{ {'Authorization': 'Bearer not.a.token'} }}
    RETURN    ${alias}

# ── projects ───────────────────────────────────────────────────────────────────────
New Project
    [Documentation]    Create a project as ``${user}``. Returns the ``ProjectDetailDto``.
    [Arguments]    ${user}    ${ws}    ${start}=sample    ${name}=${EMPTY}    &{extra}
    ${suffix}=    Unique Suffix
    ${p_name}=    Evaluate    $name or 'โครงการทดสอบ ' + $suffix
    VAR    &{body}    name=${p_name}    start=${start}
    Set To Dictionary    ${body}    &{extra}
    ${resp}=    POST On Session    ${user}[alias]    /workspaces/${ws}/projects    json=${body}    expected_status=201
    RETURN    ${resp.json()}

New Sample Project Id
    [Documentation]    Create a sample project as the team's owner and return its id.
    [Arguments]    ${team}    ${start}=sample
    ${detail}=    New Project    ${team}[owner]    ${team}[ws]    ${start}
    RETURN    ${detail}[project][id]

Post Project
    [Documentation]    Raw ``POST /workspaces/:id/projects`` with a body dictionary; returns the response.
    [Arguments]    ${user}    ${ws}    ${body}    ${expected_status}=201
    ${resp}=    POST On Session    ${user}[alias]    /workspaces/${ws}/projects    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

List Projects
    [Arguments]    ${user}    ${ws}    ${query}=${EMPTY}    ${expected_status}=200
    ${resp}=    GET On Session    ${user}[alias]    /workspaces/${ws}/projects${query}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

List Project Ids
    [Documentation]    Ids of the projects the list returns (``${query}`` e.g. ``?archived=true``).
    [Arguments]    ${user}    ${ws}    ${query}=${EMPTY}
    ${resp}=    List Projects    ${user}    ${ws}    ${query}
    ${ids}=    Evaluate    [p['id'] for p in $resp.json()]
    RETURN    ${ids}

Get Project
    [Arguments]    ${user}    ${project_id}    ${expected_status}=200
    ${resp}=    GET On Session    ${user}[alias]    /projects/${project_id}    expected_status=${expected_status}
    RETURN    ${resp}

Patch Project
    [Arguments]    ${user}    ${project_id}    ${body}    ${expected_status}=200
    ${resp}=    PATCH On Session    ${user}[alias]    /projects/${project_id}    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

Rename Project
    [Arguments]    ${user}    ${project_id}    ${name}    ${expected_status}=200
    VAR    &{body}    name=${name}
    ${resp}=    Patch Project    ${user}    ${project_id}    ${body}    ${expected_status}
    RETURN    ${resp}

Set Archived
    [Arguments]    ${user}    ${project_id}    ${archived}    ${expected_status}=200
    VAR    &{body}    archived=${archived}
    ${resp}=    Patch Project    ${user}    ${project_id}    ${body}    ${expected_status}
    RETURN    ${resp}

Delete Project
    [Arguments]    ${user}    ${project_id}    ${expected_status}=204
    ${resp}=    DELETE On Session    ${user}[alias]    /projects/${project_id}    expected_status=${expected_status}
    RETURN    ${resp}

# ── documents ──────────────────────────────────────────────────────────────────────
Put Doc
    [Documentation]    ``PUT /projects/:id/docs/:docKey`` with ``data`` (``${None}`` resets) and ``baseVersion``.
    [Arguments]    ${user}    ${project_id}    ${doc_key}    ${data}    ${base_version}    ${expected_status}=200
    ${version}=    Convert To Integer    ${base_version}
    VAR    &{body}    data=${data}    baseVersion=${version}
    ${resp}=    PUT On Session    ${user}[alias]    /projects/${project_id}/docs/${doc_key}    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

Put Doc Body
    [Documentation]    Like ``Put Doc`` but the whole JSON body is given (to test missing or wrong-typed fields).
    [Arguments]    ${user}    ${project_id}    ${doc_key}    ${body}    ${expected_status}=400
    ${resp}=    PUT On Session    ${user}[alias]    /projects/${project_id}/docs/${doc_key}    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

Footing Input
    [Documentation]    A valid footing calculator input, one row F1. ``&{overrides}`` change row fields.
    [Arguments]    &{overrides}
    VAR    &{row}    name=F1    count=${4}    width=${1.2}    length=${1.2}    depth=${0.3}    excavationDepth=${1.2}
    ...    sandThickness=${0.05}    leanThickness=${0.05}    shortBarSize=DB12    shortBarCount=${6}
    ...    longBarSize=DB12    longBarCount=${6}    ringBarSize=RB6    ringBarCount=${0}
    Set To Dictionary    ${row}    &{overrides}
    VAR    &{input}    rows=${{ [$row] }}
    RETURN    ${input}

Fill Input
    [Documentation]    A valid fill calculator input (width x length x height, metres).
    VAR    &{input}    width=${10}    length=${12}    height=${0.5}
    RETURN    ${input}

Doc Version In Database
    [Documentation]    Version of the stored document (fails when the row does not exist).
    [Arguments]    ${project_id}    ${doc_key}
    ${row}=    Project Doc Row    ${project_id}    ${doc_key}
    RETURN    ${row}[version]

Doc Data In Database
    [Arguments]    ${project_id}    ${doc_key}
    ${row}=    Project Doc Row    ${project_id}    ${doc_key}
    RETURN    ${row}[data]

Doc Row Count
    [Arguments]    ${project_id}
    ${n}=    Query Value    select count(*) from project_docs where project_id = %s    ${project_id}
    RETURN    ${n}

Doc Should Not Exist In Database
    [Arguments]    ${project_id}    ${doc_key}
    ${n}=    Query Value    select count(*) from project_docs where project_id = %s and doc_key = %s
    ...    ${project_id}    ${doc_key}
    Should Be Equal As Integers    ${n}    0

Fire Parallel Requests
    [Documentation]    Send the same request ``${count}`` times at the same moment (threads) as ``${user}``.
    ...    Returns the list of responses (status codes and bodies), in no particular order.
    [Arguments]    ${user}    ${method}    ${path}    ${body}    ${count}=2
    ${headers}=    Create Dictionary    Authorization=Bearer ${user}[token]
    ${call}=    Evaluate    functools.partial(requests.request, $method, $API_URL + $path, json=$body, headers=$headers, timeout=60)
    ...    modules=functools,requests
    ${pool}=    Evaluate    concurrent.futures.ThreadPoolExecutor(int($count))    modules=concurrent.futures
    ${futures}=    Evaluate    list(map($pool.submit, [$call] * int($count)))
    ${responses}=    Evaluate    list(map(operator.methodcaller('result'), $futures))    modules=operator
    RETURN    ${responses}

Status Codes Of
    [Arguments]    ${responses}
    ${codes}=    Evaluate    sorted(r.status_code for r in $responses)
    RETURN    ${codes}

# ── engine comparison ──────────────────────────────────────────────────────────────
Project Json From Docs
    [Documentation]    The project the stored documents make (``start`` + docs, the reverse of ``projectToDocs``),
    ...    in the shape ``Compute Expected`` reads. A document with null data is a reset and adds nothing.
    [Arguments]    ${start}    ${docs}
    ${base}=    Compute Expected For New Project    ${start}
    ${project}=    Copy Dictionary    ${base}[project]    deepcopy=${True}
    VAR    &{calculators}
    VAR    &{overrides}
    VAR    &{planning}
    FOR    ${doc}    IN    @{docs}
        VAR    ${key}    ${doc}[docKey]
        IF    $doc['data'] is None    CONTINUE
        IF    $key == 'journey'
            Set To Dictionary    ${project}    journey=${doc}[data]
        ELSE IF    $key.startswith('calc:')
            ${id}=    Evaluate    $key.split(':', 1)[1]
            Set To Dictionary    ${calculators}    ${id}=${doc}[data]
        ELSE IF    $key.startswith('boq:')
            ${line}=    Evaluate    $key.split(':', 1)[1]
            Set To Dictionary    ${overrides}    ${line}=${doc}[data]
        ELSE IF    $key.startswith('planning:')
            ${sheet}=    Evaluate    $key.split(':', 1)[1]
            Set To Dictionary    ${planning}    ${sheet}=${doc}[data]
        END
    END
    Set To Dictionary    ${project}    calculators=${calculators}    boqOverrides=${overrides}
    IF    $planning    Set To Dictionary    ${project}    planning=${planning}
    RETURN    ${project}

Engine Expected For Stored Project
    [Documentation]    ``Compute Expected`` on the documents the API returns for the project.
    [Arguments]    ${user}    ${project_id}    ${start}=sample
    ${detail}=    Get Project    ${user}    ${project_id}
    ${project}=    Project Json From Docs    ${start}    ${detail.json()}[docs]
    ${expected}=    Compute Expected    ${project}
    RETURN    ${expected}

Summary Total In List
    [Documentation]    ``summary.constructionTotal`` of the project as the project list shows it.
    [Arguments]    ${user}    ${ws}    ${project_id}
    ${resp}=    List Projects    ${user}    ${ws}
    ${totals}=    Evaluate    [p['summary']['constructionTotal'] for p in $resp.json() if p['id'] == $project_id]
    Length Should Be    ${totals}    1
    RETURN    ${totals}[0]

List Total Should Equal Engine
    [Documentation]    The list summary of the project equals the BOQ engine on the stored documents (and the detail agrees).
    [Arguments]    ${user}    ${ws}    ${project_id}    ${start}=sample
    ${expected}=    Engine Expected For Stored Project    ${user}    ${project_id}    ${start}
    ${listed}=    Summary Total In List    ${user}    ${ws}    ${project_id}
    Numbers Should Be Close    ${listed}    ${expected}[constructionTotal]    0.01
    ...    msg=list total ${listed} differs from the engine ${expected}[constructionTotal]
    ${detail}=    Get Project    ${user}    ${project_id}
    Numbers Should Be Close    ${detail.json()}[project][summary][constructionTotal]    ${expected}[constructionTotal]    0.01
    Numbers Should Be Close    ${detail.json()}[project][summary][preConstructionTotal]    ${expected}[preConstructionTotal]    0.01
    ${row}=    Project Row    ${project_id}
    Numbers Should Be Close    ${row}[summary][constructionTotal]    ${expected}[constructionTotal]    0.01
    RETURN    ${expected}

# ── revisions ──────────────────────────────────────────────────────────────────────
Create Revision
    [Arguments]    ${user}    ${project_id}    ${label}    ${note}=${NONE}    ${expected_status}=201
    VAR    &{body}    label=${label}
    IF    $note is not None    Set To Dictionary    ${body}    note=${note}
    ${resp}=    POST On Session    ${user}[alias]    /projects/${project_id}/revisions    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

List Revisions
    [Arguments]    ${user}    ${project_id}    ${expected_status}=200
    ${resp}=    GET On Session    ${user}[alias]    /projects/${project_id}/revisions    expected_status=${expected_status}
    RETURN    ${resp}

Get Revision
    [Arguments]    ${user}    ${project_id}    ${revision_id}    ${expected_status}=200
    ${resp}=    GET On Session    ${user}[alias]    /projects/${project_id}/revisions/${revision_id}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

Revision Row
    [Arguments]    ${revision_id}
    ${row}=    Query Row    select * from project_revisions where id = %s    ${revision_id}
    RETURN    ${row}

Revision Count
    [Arguments]    ${project_id}
    ${n}=    Query Value    select count(*) from project_revisions where project_id = %s    ${project_id}
    RETURN    ${n}

# ── assignments ────────────────────────────────────────────────────────────────────
Assign Level
    [Documentation]    ``PUT /projects/:id/assignments/:levelId`` (``${user_id}`` = ``${None}`` removes).
    [Arguments]    ${user}    ${project_id}    ${level_id}    ${user_id}    ${expected_status}=200
    VAR    &{body}    userId=${user_id}
    ${resp}=    PUT On Session    ${user}[alias]    /projects/${project_id}/assignments/${level_id}    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

List Assignments
    [Arguments]    ${user}    ${project_id}    ${expected_status}=200
    ${resp}=    GET On Session    ${user}[alias]    /projects/${project_id}/assignments
    ...    expected_status=${expected_status}
    RETURN    ${resp}

Assignment Rows
    [Documentation]    ``level_id`` and ``user_id`` of every assignment row of the project, ordered by level id.
    [Arguments]    ${project_id}
    ${rows}=    Query Rows    select level_id, user_id, assigned_by from level_assignments where project_id = %s order by level_id
    ...    ${project_id}
    RETURN    ${rows}

# ── activity ───────────────────────────────────────────────────────────────────────
Get Activity
    [Arguments]    ${user}    ${project_id}    ${query}=${EMPTY}    ${expected_status}=200
    ${resp}=    GET On Session    ${user}[alias]    /projects/${project_id}/activity${query}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

Activity Actions
    [Documentation]    Actions the API lists for the project, newest first.
    [Arguments]    ${user}    ${project_id}    ${query}=${EMPTY}
    ${resp}=    Get Activity    ${user}    ${project_id}    ${query}
    ${actions}=    Evaluate    [a['action'] for a in $resp.json()]
    RETURN    ${actions}

Activity Actions In Database
    [Documentation]    ``activity_log.action`` of the project, newest first.
    [Arguments]    ${project_id}
    ${rows}=    Query Rows    select action from activity_log where project_id = %s order by id desc    ${project_id}
    ${actions}=    Evaluate    [r['action'] for r in $rows]
    RETURN    ${actions}

Activity Count
    [Arguments]    ${project_id}
    ${n}=    Query Value    select count(*) from activity_log where project_id = %s    ${project_id}
    RETURN    ${n}

# ── modules ────────────────────────────────────────────────────────────────────────
Get Workspace Modules
    [Arguments]    ${user}    ${ws}    ${expected_status}=200
    ${resp}=    GET On Session    ${user}[alias]    /workspaces/${ws}/modules    expected_status=${expected_status}
    RETURN    ${resp}

Put Workspace Module
    [Arguments]    ${user}    ${ws}    ${module}    ${body}    ${expected_status}=200
    ${resp}=    PUT On Session    ${user}[alias]    /workspaces/${ws}/modules/${module}    json=${body}
    ...    expected_status=${expected_status}
    RETURN    ${resp}

Switch Module
    [Arguments]    ${user}    ${ws}    ${module}    ${enabled}    ${expected_status}=200
    VAR    &{body}    enabled=${enabled}
    ${resp}=    Put Workspace Module    ${user}    ${ws}    ${module}    ${body}    ${expected_status}
    RETURN    ${resp}

Module State From List
    [Documentation]    The entry of ``${module}`` in the workspace's module list.
    [Arguments]    ${user}    ${ws}    ${module}
    ${resp}=    Get Workspace Modules    ${user}    ${ws}
    ${entry}=    Evaluate    [m for m in $resp.json() if m['module'] == $module][0]
    RETURN    ${entry}

Module Row
    [Documentation]    ``workspace_modules`` row, or ``${None}`` when the module was never switched.
    [Arguments]    ${ws}    ${module}
    ${rows}=    Query Rows    select * from workspace_modules where workspace_id = %s and module = %s    ${ws}    ${module}
    IF    len($rows) == 1
        RETURN    ${rows}[0]
    END
    RETURN    ${NONE}
