*** Settings ***
Documentation       The per-workspace switch of the workforce module ("ทีมช่างและการจัดคน"): the platform offers it
...                 (MODULES_ENABLED=subcontracting,workforce on the E2E API), every company switches it on or off
...                 (owner and admin only). Off = every workforce route answers 404 ``module_disabled`` for members,
...                 nothing is deleted and the plain BOQ product keeps working; on again = all data is back.
...                 A non-member never learns the module exists (404 ``not_found``). The switch is stored in
...                 ``workspace_modules``.
Resource            ../../resources/pages/api_workforce.resource
Test Tags           api    workforce    modules    module-gate    db


*** Variables ***
# Every route of the module as METHOD|path with {ws}, {project} and {zero} placeholders.
@{GATED ROUTES}     GET|/workspaces/{ws}/people    POST|/workspaces/{ws}/people    GET|/workspaces/{ws}/crews
...                 POST|/workspaces/{ws}/crews    GET|/workspaces/{ws}/crew-assignments
...                 POST|/workspaces/{ws}/crew-assignments    GET|/workspaces/{ws}/task-lags
...                 GET|/projects/{project}/supervisors    PUT|/projects/{project}/supervisors
...                 GET|/projects/{project}/task-lags    PUT|/projects/{project}/task-lags
...                 PATCH|/workspaces/{ws}/people/{zero}    DELETE|/workspaces/{ws}/people/{zero}
...                 PATCH|/workspaces/{ws}/crews/{zero}    DELETE|/workspaces/{ws}/crews/{zero}
...                 PATCH|/workspaces/{ws}/crew-assignments/{zero}    DELETE|/workspaces/{ws}/crew-assignments/{zero}


*** Test Cases ***
Platform Offers The Workforce Module
    [Tags]    smoke
    ${anon}=    Create Anonymous Session    anon
    ${resp}=    GET On Session    ${anon}    /platform/modules    expected_status=200
    Should Contain    ${resp.json()}[modules]    workforce

New Workspace Has Workforce Available But Off
    [Tags]    smoke
    ${team}=    Create Workforce Team    module_on=${False}
    ${entry}=    Module State From List    ${team}[owner]    ${team}[ws]    workforce
    Should Be Equal    ${entry}[available]    ${True}
    Should Be Equal    ${entry}[enabled]    ${False}
    Should Be Equal    ${entry}[enabledAt]    ${None}
    ${row}=    Module Row    ${team}[ws]    workforce
    Should Be Equal    ${row}    ${None}

Every Route Answers Module Disabled For Members While The Module Is Off
    [Documentation]    All 16 routes, for owner (can manage) and viewer (read only): 404 ``module_disabled``, never 403.
    [Tags]    smoke    negative
    ${team}=    Create Workforce Team    module_on=${False}
    FOR    ${role}    IN    owner    viewer
        FOR    ${route}    IN    @{GATED ROUTES}
            Call Gated Route    ${team}[${role}]    ${route}    ${team}    404    module_disabled
        END
    END

Writes While The Module Is Off Store Nothing
    [Tags]    negative
    ${team}=    Create Workforce Team    module_on=${False}
    ${body}=    Person Body
    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/people    404    module_disabled    ${body}
    ${crew_body}=    Crew Body
    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crews    404    module_disabled    ${crew_body}
    FOR    ${table}    IN    people    crews    crew_assignments    project_supervisors    project_task_lags
        ${n}=    Count Rows    select count(*) from ${table} where workspace_id = %s    ${team}[ws]
        Should Be Equal As Integers    ${n}    0    msg=${table} must stay empty
    END

A Non Member Never Learns The Module Exists
    [Documentation]    Outsiders and another company's owner get ``not_found``, even with the module off; anonymous callers
    ...    get 401.
    [Tags]    security    negative
    ${team}=    Create Workforce Team    module_on=${False}
    ${rival}=    Create Second Workforce Team
    FOR    ${stranger}    IN    ${team}[outsider]    ${rival}[owner]
        FOR    ${route}    IN    @{GATED ROUTES}
            Call Gated Route    ${stranger}    ${route}    ${team}    404    not_found
        END
    END
    ${anon}=    Create Anonymous Session    anon
    VAR    &{caller}    alias=${anon}
    FOR    ${route}    IN    @{GATED ROUTES}
        Call Gated Route    ${caller}    ${route}    ${team}    401    unauthenticated
    END

Switching On Makes The Routes Work And Stores The Row
    [Tags]    smoke
    ${team}=    Create Workforce Team    module_on=${False}
    ${resp}=    Switch Module    ${team}[owner]    ${team}[ws]    workforce    ${True}
    Should Be Equal    ${resp.json()}[module]    workforce
    Should Be Equal    ${resp.json()}[enabled]    ${True}
    Should Be Equal    ${resp.json()}[available]    ${True}
    Should Not Be Equal    ${resp.json()}[enabledAt]    ${None}
    ${row}=    Module Row    ${team}[ws]    workforce
    Should Be Equal    ${row}[enabled]    ${True}
    Should Be Equal As Strings    ${row}[enabled_by]    ${team}[owner][id]
    List People    ${team}[viewer]    ${team}[ws]
    List Crews    ${team}[viewer]    ${team}[ws]
    Add Person    ${team}[owner]    ${team}[ws]

Switching Off Hides The Routes But Never Deletes Data
    [Documentation]    People, crews, assignments, supervisors and waits are all still in the database while the module is
    ...    off and come back, unchanged, when it is switched on again. Switching off needs no confirmation although
    ...    crews are assigned.
    [Tags]    smoke    state
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    dailyWage=${650}
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    leaderId=${person}[id]    rateCardId=${card}[id]
    ${assignment}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ [$person['id']] }}
    ${lag}=    Lag    2.1    6    รอบ่ม
    Put Task Lags    ${team}[owner]    ${team}[project_id]    ${{ [$lag] }}
    ${off}=    Switch Module    ${team}[owner]    ${team}[ws]    workforce    ${False}
    Should Be Equal    ${off.json()}[enabled]    ${False}
    FOR    ${route}    IN    @{GATED ROUTES}
        Call Gated Route    ${team}[admin]    ${route}    ${team}    404    module_disabled
    END
    ${row}=    Module Row    ${team}[ws]    workforce
    Should Be Equal    ${row}[enabled]    ${False}
    Should Not Be Equal    ${row}[enabled_at]    ${None}
    Archived At Should Be Empty    people    ${person}[id]
    Archived At Should Be Empty    crews    ${crew}[id]
    ${n}=    Count Rows    select count(*) from crew_assignments where id = %s    ${assignment}[id]
    Should Be Equal As Integers    ${n}    1
    ${supervisors}=    Supervisor Ids In Database    ${team}[project_id]
    Should Be Equal    ${supervisors}    ${{ [$person['id']] }}
    ${lags}=    Task Lag Rows In Database    ${team}[project_id]
    Should Be Equal    ${lags}    ${{ {'2.1': (6, 'รอบ่ม')} }}
    Switch Module    ${team}[owner]    ${team}[ws]    workforce    ${True}
    ${people}=    List People    ${team}[owner]    ${team}[ws]
    Should Be Equal As Integers    ${people.json()}[0][dailyWage]    650
    ${assignments}=    List Assignments Of Workspace    ${team}[viewer]    ${team}[ws]
    Should Be Equal    ${assignments.json()}[0][id]    ${assignment}[id]
    ${read}=    Wf Call    ${team}[viewer]    GET    /projects/${team}[project_id]/supervisors
    Should Be Equal    ${read.json()}[personIds]    ${{ [$person['id']] }}
    ${waits}=    Wf Call    ${team}[viewer]    GET    /workspaces/${team}[ws]/task-lags
    Should Be Equal    ${waits.json()}[0][lags][0][days]    ${6}
    ${crews}=    List Crews    ${team}[owner]    ${team}[ws]
    Should Be Equal As Integers    ${crews.json()}[0][dailyCost]    ${{ 2 * 800 + 3 * 500 }}

On Off On Cycle Ends Enabled With A Single Row
    [Tags]    state
    ${team}=    Create Workforce Team    module_on=${False}
    FOR    ${enabled}    IN    ${True}    ${False}    ${True}    ${False}    ${True}
        Switch Module    ${team}[owner]    ${team}[ws]    workforce    ${enabled}
    END
    List Crews    ${team}[owner]    ${team}[ws]
    ${n}=    Count Rows    select count(*) from workspace_modules where workspace_id = %s and module = 'workforce'    ${team}[ws]
    Should Be Equal As Integers    ${n}    1

Switching Off Is Immediate For A Signed In User
    [Documentation]    No caching: the very next call after the switch sees the new state, in both directions.
    [Tags]    state
    ${team}=    Create Workforce Team
    FOR    ${i}    IN RANGE    3
        List Crews    ${team}[viewer]    ${team}[ws]
        Switch Module    ${team}[admin]    ${team}[ws]    workforce    ${False}
        Wf Error    ${team}[viewer]    GET    /workspaces/${team}[ws]/crews    404    module_disabled
        Switch Module    ${team}[admin]    ${team}[ws]    workforce    ${True}
    END

Admin Can Switch The Module But Estimator And Viewer Cannot
    [Tags]    security    negative
    ${team}=    Create Workforce Team    module_on=${False}
    Switch Module    ${team}[estimator]    ${team}[ws]    workforce    ${True}    403
    Switch Module    ${team}[viewer]    ${team}[ws]    workforce    ${True}    403
    Switch Module    ${team}[outsider]    ${team}[ws]    workforce    ${True}    404
    ${row}=    Module Row    ${team}[ws]    workforce
    Should Be Equal    ${row}    ${None}
    Switch Module    ${team}[admin]    ${team}[ws]    workforce    ${True}
    Switch Module    ${team}[estimator]    ${team}[ws]    workforce    ${False}    403
    Switch Module    ${team}[viewer]    ${team}[ws]    workforce    ${False}    403
    List Crews    ${team}[viewer]    ${team}[ws]

Workforce Is Switched Per Workspace
    [Tags]    security    state
    ${a}=    Create Workforce Team
    ${b}=    Create Workforce Team    module_on=${False}
    List Crews    ${a}[owner]    ${a}[ws]
    Wf Error    ${b}[owner]    GET    /workspaces/${b}[ws]/crews    404    module_disabled
    ${second}=    Create Company Workspace Via API    ${a}[owner]
    Wf Error    ${a}[owner]    GET    /workspaces/${second}/crews    404    module_disabled

Switching Workforce Does Not Touch Other Modules
    [Tags]    state
    ${team}=    Create Workforce Team    module_on=${False}
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    Switch Module    ${team}[owner]    ${team}[ws]    workforce    ${True}
    Switch Module    ${team}[owner]    ${team}[ws]    workforce    ${False}
    ${sub}=    Module State From List    ${team}[owner]    ${team}[ws]    subcontracting
    Should Be Equal    ${sub}[enabled]    ${True}
    ${wf}=    Module State From List    ${team}[owner]    ${team}[ws]    workforce
    Should Be Equal    ${wf}[enabled]    ${False}

Plain BOQ Keeps Working With The Module Off
    [Documentation]    Every marketplace module must switch off to the plain BOQ product: projects, documents and
    ...    revisions need no module.
    [Tags]    smoke
    ${team}=    Create Workforce Team    module_on=${False}
    ${fill}=    Fill Input
    ${project}=    Create Project Via API    ${team}[owner]    ${team}[ws]    start=sample
    Put Doc    ${team}[owner]    ${project}[project][id]    calc:fill    ${fill}    0
    Create Revision    ${team}[owner]    ${project}[project][id]    R1
    Get Project    ${team}[viewer]    ${project}[project][id]
    List Total Should Equal Engine    ${team}[owner]    ${team}[ws]    ${project}[project][id]

Rate Cards Do Not Depend On The Module
    [Tags]    state
    ${team}=    Create Workforce Team    module_on=${False}
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]
    ${listed}=    List Rate Cards    ${team}[viewer]    ${team}[ws]
    Should Be Equal    ${listed.json()}[0][id]    ${card}[id]

Unoffered Modules Cannot Be Switched On But Workforce Can
    [Tags]    negative
    ${team}=    Create Workforce Team    module_on=${False}
    Switch Module    ${team}[owner]    ${team}[ws]    materials    ${True}    422
    Switch Module    ${team}[owner]    ${team}[ws]    workforce    ${True}


*** Keywords ***
Call Gated Route
    [Documentation]    Call one ``METHOD|path`` route as ``${user}``; it must answer ``${status}`` with error ``${code}``.
    ...    Bodies are minimal and valid, so a refusal can only come from the gate (or the caller's standing).
    [Arguments]    ${user}    ${route}    ${team}    ${status}    ${code}
    ${method}    ${template}=    Split String    ${route}    |    max_split=1
    VAR    ${zero}    ${ZERO ID}
    ${path}=    Evaluate    $template.replace('{ws}', $team['ws']).replace('{project}', $team['project_id']).replace('{zero}', $zero)
    ${body}=    Gated Body    ${method}    ${template}    ${team}
    ${resp}=    Wf Call    ${user}    ${method}    ${path}    ${status}    ${body}
    Error Code Should Be    ${resp}    ${code}

Gated Body
    [Arguments]    ${method}    ${template}    ${team}
    VAR    ${zero}    ${ZERO ID}
    IF    '${method}' in ['GET', 'DELETE']    RETURN    ${None}
    IF    '${template}'.endswith('/people')    RETURN    ${{ {'name': 'x', 'role': 'skilled', 'employment': 'daily'} }}
    IF    '${template}'.endswith('/crews')
        RETURN    ${{ {'name': 'x', 'trade': 'misc', 'skilledCount': 1, 'labourerCount': 1} }}
    END
    IF    '${template}'.endswith('/crew-assignments')
        RETURN    ${{ {'projectId': $team['project_id'], 'taskId': '1.1', 'crewId': $zero, 'start': '2099-01-01', 'end': '2099-01-02'} }}
    END
    IF    '${template}'.endswith('/supervisors')    RETURN    ${{ {'personIds': []} }}
    IF    '${template}'.endswith('/task-lags')    RETURN    ${{ {'lags': []} }}
    RETURN    ${{ {'note': 'x'} }}
