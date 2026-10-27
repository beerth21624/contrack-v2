*** Settings ***
Documentation       A2 modules (core switch only): ``GET /platform/modules`` (public, what the server offers; this E2E
...                 server offers ``subcontracting`` only) and ``GET/PUT /workspaces/:id/modules/:module``
...                 (owner and admin switch, ``workspace_modules`` rows, switching off never deletes data).
...                 The subcontracting behaviour itself belongs to the A3 suite.
Resource            ../../resources/pages/api_projects.resource
Test Tags           api    modules    db


*** Variables ***
${SC_SETTINGS_PATH}     subcontracting/settings


*** Test Cases ***
# ── platform layer ─────────────────────────────────────────────────────────────────
Platform Offers Only Subcontracting On This Server
    [Documentation]    The E2E server runs with ``MODULES_ENABLED=subcontracting``.
    [Tags]    smoke
    Create Anonymous Session    anon
    ${resp}=    GET On Session    anon    /platform/modules    expected_status=200
    Should Be Equal    ${resp.json()}    ${{ {'modules': ['subcontracting']} }}

Platform Modules Are Public Even With A Garbage Token
    [Tags]    security
    ${alias}=    Bad Token Session
    ${resp}=    GET On Session    ${alias}    /platform/modules    expected_status=200
    Should Be Equal    ${resp.json()}[modules]    ${{ ['subcontracting'] }}

Platform Modules Only List Known Module Ids
    Create Anonymous Session    anon
    ${resp}=    GET On Session    anon    /platform/modules    expected_status=200
    ${known}=    Create List    subcontracting    materials    owner-leads    ai-assist
    FOR    ${module}    IN    @{resp.json()}[modules]
        Should Contain    ${known}    ${module}
    END

Platform Modules Cannot Be Changed Over HTTP
    [Tags]    security    negative
    Create Anonymous Session    anon
    VAR    &{body}    modules=${{ ['materials'] }}
    PUT On Session    anon    /platform/modules    json=${body}    expected_status=404
    POST On Session    anon    /platform/modules    json=${body}    expected_status=404
    ${check}=    GET On Session    anon    /platform/modules    expected_status=200
    Should Be Equal    ${check.json()}[modules]    ${{ ['subcontracting'] }}

# ── workspace list ─────────────────────────────────────────────────────────────────
Workspace Module List Has Every Module In Contract Order
    [Tags]    smoke
    ${team}=    Create Owner Workspace
    ${resp}=    Get Workspace Modules    ${team}[owner]    ${team}[ws]
    ${ids}=    Evaluate    [m['module'] for m in $resp.json()]
    Should Be Equal    ${ids}    ${{ ['subcontracting', 'materials', 'owner-leads', 'ai-assist'] }}

New Workspace Has Every Module Switched Off And Only Subcontracting Available
    ${team}=    Create Owner Workspace
    ${resp}=    Get Workspace Modules    ${team}[owner]    ${team}[ws]
    FOR    ${entry}    IN    @{resp.json()}
        Should Be Equal    ${entry}[enabled]    ${False}
        Should Be Equal    ${entry}[enabledAt]    ${NONE}
        ${available}=    Evaluate    $entry['module'] == 'subcontracting'
        Should Be Equal    ${entry}[available]    ${available}
    END
    ${n}=    Query Value    select count(*) from workspace_modules where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Every Member Can Read The Module List
    [Tags]    security
    ${team}=    Create Team
    FOR    ${role}    IN    owner    admin    estimator    viewer
        ${resp}=    Get Workspace Modules    ${team}[${role}]    ${team}[ws]
        Length Should Be    ${resp.json()}    4
    END

Module List Is Hidden From Outsiders And Anonymous Callers
    [Tags]    security
    ${team}=    Create Team
    ${resp}=    Get Workspace Modules    ${team}[outsider]    ${team}[ws]    404
    Error Code Should Be    ${resp}    not_found
    Create Anonymous Session    anon
    ${resp}=    GET On Session    anon    /workspaces/${team}[ws]/modules    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

Module List Of An Unknown Workspace Answers 404
    [Tags]    negative
    ${team}=    Create Owner Workspace
    FOR    ${bad}    IN    00000000-0000-4000-8000-000000000000    not-a-uuid
        ${resp}=    Get Workspace Modules    ${team}[owner]    ${bad}    404
        Error Code Should Be    ${resp}    not_found
    END

# ── switching on and off ───────────────────────────────────────────────────────────
Owner Switches Subcontracting On And The Row Is Written
    [Tags]    smoke
    ${team}=    Create Owner Workspace
    ${resp}=    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    Should Be Equal    ${resp.json()}[module]    subcontracting
    Should Be Equal    ${resp.json()}[enabled]    ${True}
    Should Be Equal    ${resp.json()}[available]    ${True}
    Should Not Be Equal    ${resp.json()}[enabledAt]    ${NONE}
    ${row}=    Module Row    ${team}[ws]    subcontracting
    Should Be Equal    ${row}[enabled]    ${True}
    Should Be Equal    ${row}[enabled_by]    ${{ __import__('uuid').UUID($team['owner']['id']) }}
    Should Not Be Equal    ${row}[enabled_at]    ${NONE}
    ${entry}=    Module State From List    ${team}[owner]    ${team}[ws]    subcontracting
    Should Be Equal    ${entry}[enabled]    ${True}

Admin Can Switch A Module On And Off
    [Tags]    security
    ${team}=    Create Team
    Switch Module    ${team}[admin]    ${team}[ws]    subcontracting    ${True}
    ${row}=    Module Row    ${team}[ws]    subcontracting
    Should Be Equal    ${row}[enabled]    ${True}
    Should Be Equal    ${row}[enabled_by]    ${{ __import__('uuid').UUID($team['admin']['id']) }}
    Switch Module    ${team}[admin]    ${team}[ws]    subcontracting    ${False}
    ${row}=    Module Row    ${team}[ws]    subcontracting
    Should Be Equal    ${row}[enabled]    ${False}

Switching Off Keeps The Row And Its Enable Time
    [Documentation]    Off is a state, not a delete: the row stays with ``enabled`` false and ``enabled_at`` kept
    ...    (the schema comment says so); the DTO shows no ``enabledAt`` while off.
    [Tags]    state
    ${team}=    Create Owner Workspace
    ${on}=    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    ${off}=    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${False}
    Should Be Equal    ${off.json()}[enabled]    ${False}
    ${row}=    Module Row    ${team}[ws]    subcontracting
    Should Be Equal    ${row}[enabled]    ${False}
    Should Not Be Equal    ${row}[enabled_at]    ${NONE}
    Should Be Equal    ${row}[enabled_at]    ${{ __import__('datetime').datetime.fromisoformat($on.json()['enabledAt'].replace('Z', '+00:00')) }}
    ${entry}=    Module State From List    ${team}[owner]    ${team}[ws]    subcontracting
    Should Be Equal    ${entry}[enabled]    ${False}

Switching On Twice Is Idempotent
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${first}=    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    ${second}=    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    Should Be Equal    ${second.json()}[enabledAt]    ${first.json()}[enabledAt]
    ${n}=    Query Value    select count(*) from workspace_modules where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    1

Switching Off A Module That Was Never On Is A No Op
    [Tags]    edge
    ${team}=    Create Owner Workspace
    ${resp}=    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${False}
    Should Be Equal    ${resp.json()}[enabled]    ${False}
    ${entry}=    Module State From List    ${team}[owner]    ${team}[ws]    subcontracting
    Should Be Equal    ${entry}[enabled]    ${False}

On Off On Cycle Ends Enabled With A Single Row
    [Tags]    state
    ${team}=    Create Owner Workspace
    FOR    ${enabled}    IN    ${True}    ${False}    ${True}    ${False}    ${True}
        Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${enabled}
    END
    ${entry}=    Module State From List    ${team}[owner]    ${team}[ws]    subcontracting
    Should Be Equal    ${entry}[enabled]    ${True}
    ${n}=    Query Value    select count(*) from workspace_modules where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    1

Switching Off With Confirm True And No Running Work Succeeds
    [Documentation]    ``confirm`` is only needed when contracts are running; with none it is harmless either way.
    ...    (The 409 with ``activeSubcontracts`` needs a running contract: left to the subcontracting suite.)
    [Tags]    edge
    ${team}=    Create Owner Workspace
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    VAR    &{body}    enabled=${False}    confirm=${True}
    ${resp}=    Put Workspace Module    ${team}[owner]    ${team}[ws]    subcontracting    ${body}
    Should Be Equal    ${resp.json()}[enabled]    ${False}
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    VAR    &{body}    enabled=${False}    confirm=${False}
    ${resp}=    Put Workspace Module    ${team}[owner]    ${team}[ws]    subcontracting    ${body}
    Should Be Equal    ${resp.json()}[enabled]    ${False}

Modules Are Switched Per Workspace
    [Tags]    security    state
    ${a}=    Create Owner Workspace
    ${b}=    Create Owner Workspace
    Switch Module    ${a}[owner]    ${a}[ws]    subcontracting    ${True}
    ${entry_a}=    Module State From List    ${a}[owner]    ${a}[ws]    subcontracting
    ${entry_b}=    Module State From List    ${b}[owner]    ${b}[ws]    subcontracting
    Should Be Equal    ${entry_a}[enabled]    ${True}
    Should Be Equal    ${entry_b}[enabled]    ${False}

A Second Workspace Of The Same Owner Is Independent
    [Tags]    state
    ${team}=    Create Owner Workspace
    ${ws2}=    Create Company Workspace Via API    ${team}[owner]
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    ${entry}=    Module State From List    ${team}[owner]    ${ws2}    subcontracting
    Should Be Equal    ${entry}[enabled]    ${False}

Owner Of A Personal Workspace Can Switch A Module
    [Tags]    edge
    ${owner}=    Register User Via API    solo
    ${ws}=    Personal Workspace Id    ${owner}
    ${resp}=    Switch Module    ${owner}    ${ws}    subcontracting    ${True}
    Should Be Equal    ${resp.json()}[enabled]    ${True}

# ── permissions ────────────────────────────────────────────────────────────────────
Switch Permission Table Owner Admin Allowed Estimator Viewer Forbidden
    [Documentation]    ``modules.manage``: owner and admin 200; estimator and viewer 403; outsider 404. The refused calls
    ...    write nothing.
    [Tags]    smoke    security
    ${team}=    Create Team
    ${resp}=    Switch Module    ${team}[estimator]    ${team}[ws]    subcontracting    ${True}    403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Switch Module    ${team}[viewer]    ${team}[ws]    subcontracting    ${True}    403
    Error Code Should Be    ${resp}    forbidden
    ${resp}=    Switch Module    ${team}[outsider]    ${team}[ws]    subcontracting    ${True}    404
    Error Code Should Be    ${resp}    not_found
    ${row}=    Module Row    ${team}[ws]    subcontracting
    Should Be Equal    ${row}    ${NONE}

Estimator And Viewer Cannot Switch A Module Off
    [Tags]    security
    ${team}=    Create Team
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    Switch Module    ${team}[estimator]    ${team}[ws]    subcontracting    ${False}    403
    Switch Module    ${team}[viewer]    ${team}[ws]    subcontracting    ${False}    403
    ${row}=    Module Row    ${team}[ws]    subcontracting
    Should Be Equal    ${row}[enabled]    ${True}

Another Tenants Owner Cannot Switch A Module
    [Tags]    security
    ${team}=    Create Owner Workspace
    ${other}=    Create Owner Workspace
    ${resp}=    Switch Module    ${other}[owner]    ${team}[ws]    subcontracting    ${True}    404
    Error Code Should Be    ${resp}    not_found
    ${row}=    Module Row    ${team}[ws]    subcontracting
    Should Be Equal    ${row}    ${NONE}

Switch Without A Token Answers 401
    [Tags]    security
    ${team}=    Create Owner Workspace
    Create Anonymous Session    anon
    VAR    &{body}    enabled=${True}
    ${resp}=    PUT On Session    anon    /workspaces/${team}[ws]/modules/subcontracting    json=${body}    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

Switch In An Unknown Workspace Answers 404
    [Tags]    negative
    ${team}=    Create Owner Workspace
    ${resp}=    Switch Module    ${team}[owner]    00000000-0000-4000-8000-000000000000    subcontracting    ${True}    404
    Error Code Should Be    ${resp}    not_found

# ── validation ─────────────────────────────────────────────────────────────────────
Modules The Platform Does Not Offer Cannot Be Enabled
    [Documentation]    ``materials``, ``owner-leads`` and ``ai-assist`` are known ids but not in ``MODULES_ENABLED``: 422
    ...    and no row is written.
    [Tags]    negative
    ${team}=    Create Owner Workspace
    FOR    ${module}    IN    materials    owner-leads    ai-assist
        ${resp}=    Switch Module    ${team}[owner]    ${team}[ws]    ${module}    ${True}    422
        Error Code Should Be    ${resp}    unprocessable
        ${row}=    Module Row    ${team}[ws]    ${module}
        Should Be Equal    ${row}    ${NONE}
        ${entry}=    Module State From List    ${team}[owner]    ${team}[ws]    ${module}
        Should Be Equal    ${entry}[enabled]    ${False}
        Should Be Equal    ${entry}[available]    ${False}
    END

Modules The Platform Does Not Offer Cannot Be Switched Off Either
    [Tags]    negative    edge
    ${team}=    Create Owner Workspace
    ${resp}=    Switch Module    ${team}[owner]    ${team}[ws]    materials    ${False}    422
    Error Code Should Be    ${resp}    unprocessable

Unknown Module Id Answers 400
    [Documentation]    The path parameter must be one of the four module ids (case sensitive).
    [Tags]    negative
    ${team}=    Create Owner Workspace
    FOR    ${module}    IN    nope    Subcontracting    SUBCONTRACTING    sub-contracting    x    1
        ${resp}=    Switch Module    ${team}[owner]    ${team}[ws]    ${module}    ${True}    400
        Error Code Should Be    ${resp}    validation_failed
    END
    ${n}=    Query Value    select count(*) from workspace_modules where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Unknown Module Id With Injection Characters Is Refused
    [Tags]    negative    security
    ${team}=    Create Owner Workspace
    FOR    ${module}    IN    subcontracting%27%3Bdrop%20table%20workspace_modules%3B--    ..%2F..%2Fetc
        Switch Module    ${team}[owner]    ${team}[ws]    ${module}    ${True}    400
    END
    ${tables}=    Query Value    select count(*) from information_schema.tables where table_name = 'workspace_modules'
    Should Be Equal As Integers    ${tables}    1

Body Must Be A Well Formed Switch Request
    [Documentation]    ``enabled`` is a required boolean, ``confirm`` an optional boolean.
    [Tags]    negative
    ${team}=    Create Owner Workspace
    @{bad}=    Create List    ${{ {} }}    ${{ {'enabled': 'true'} }}    ${{ {'enabled': 1} }}    ${{ {'enabled': None} }}
    ...    ${{ {'enabled': True, 'confirm': 'yes'} }}    ${{ {'confirm': True} }}    ${{ [True] }}
    FOR    ${body}    IN    @{bad}
        ${resp}=    Put Workspace Module    ${team}[owner]    ${team}[ws]    subcontracting    ${body}    400
        Error Code Should Be    ${resp}    validation_failed
    END
    ${row}=    Module Row    ${team}[ws]    subcontracting
    Should Be Equal    ${row}    ${NONE}

Extra Fields In The Switch Request Do Not Change Who Switched
    [Tags]    security
    ${team}=    Create Team
    VAR    &{body}    enabled=${True}    enabledBy=${team}[viewer][id]    settings=${{ {'x': 1} }}
    Put Workspace Module    ${team}[admin]    ${team}[ws]    subcontracting    ${body}
    ${row}=    Module Row    ${team}[ws]    subcontracting
    Should Be Equal    ${row}[enabled_by]    ${{ __import__('uuid').UUID($team['admin']['id']) }}

# ── effect on the module routes and on data ────────────────────────────────────────
Module Routes Answer 404 Module Disabled Until The Workspace Switches It On
    [Documentation]    GET ``/workspaces/:id/subcontracting/settings`` is behind the module gate: off -> 404
    ...    ``module_disabled``, on -> 200, off again -> 404.
    [Tags]    smoke    state
    ${team}=    Create Owner Workspace
    ${resp}=    GET On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/${SC_SETTINGS_PATH}    expected_status=404
    Error Code Should Be    ${resp}    module_disabled
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    GET On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/${SC_SETTINGS_PATH}    expected_status=200
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${False}
    ${resp}=    GET On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/${SC_SETTINGS_PATH}    expected_status=404
    Error Code Should Be    ${resp}    module_disabled

Module Gate Is Per Workspace
    [Tags]    security    state
    ${a}=    Create Owner Workspace
    ${b}=    Create Owner Workspace
    Switch Module    ${a}[owner]    ${a}[ws]    subcontracting    ${True}
    GET On Session    ${a}[owner][alias]    /workspaces/${a}[ws]/${SC_SETTINGS_PATH}    expected_status=200
    ${resp}=    GET On Session    ${b}[owner][alias]    /workspaces/${b}[ws]/${SC_SETTINGS_PATH}    expected_status=404
    Error Code Should Be    ${resp}    module_disabled

Switching Off Never Deletes The Module Settings
    [Documentation]    Settings written while on are still there after off and on again (rows are kept, only the routes
    ...    are hidden).
    [Tags]    state
    ${team}=    Create Owner Workspace
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    VAR    &{settings}    defaultRetentionPct=${0.07}    defaultWarrantyMonths=${18}    defaultWhtPct=${0.03}
    ...    estimatorCanAward=${False}    estimatorCanApproveClaims=${False}    viewerSeesPrices=${False}
    ...    levelingThreshold=${0.25}    fixesBlockNextClaim=${True}    contractTemplateHtml=${EMPTY}
    PUT On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/${SC_SETTINGS_PATH}    json=${settings}    expected_status=200
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${False}
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    ${resp}=    GET On Session    ${team}[owner][alias]    /workspaces/${team}[ws]/${SC_SETTINGS_PATH}    expected_status=200
    Should Be Equal As Integers    ${resp.json()}[defaultWarrantyMonths]    18
    Should Be Equal As Numbers    ${resp.json()}[defaultRetentionPct]    0.07

Switching Off Never Deletes Projects Or Their Documents
    [Documentation]    Core data is untouched by the switch: projects, documents, revisions and assignments stay and the
    ...    plain BOQ routes keep working while the module is on and off.
    [Tags]    smoke    state
    ${team}=    Create Team
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    Create Revision    ${team}[owner]    ${pid}    R1
    Assign Level    ${team}[owner]    ${pid}    footing    ${team}[estimator][id]
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${False}
    ${detail}=    Get Project    ${team}[viewer]    ${pid}
    Length Should Be    ${detail.json()}[docs]    2
    ${revisions}=    List Revisions    ${team}[viewer]    ${pid}
    Length Should Be    ${revisions.json()}    1
    ${assignments}=    List Assignments    ${team}[viewer]    ${pid}
    Length Should Be    ${assignments.json()}    1
    Put Doc    ${team}[estimator]    ${pid}    calc:fill    ${fill}    1
    Create Revision    ${team}[estimator]    ${pid}    R2
    ${n}=    Query Value    select count(*) from project_docs where project_id = %s    ${pid}
    Should Be Equal As Integers    ${n}    2

Plain BOQ Works In A Workspace That Never Switched A Module On
    [Documentation]    Every marketplace module must switch off to the plain BOQ product: projects need no module.
    [Tags]    smoke
    ${team}=    Create Owner Workspace
    ${pid}=    New Sample Project Id    ${team}
    ${fill}=    Fill Input
    Put Doc    ${team}[owner]    ${pid}    calc:fill    ${fill}    0
    List Total Should Equal Engine    ${team}[owner]    ${team}[ws]    ${pid}
    ${row}=    Module Row    ${team}[ws]    subcontracting
    Should Be Equal    ${row}    ${NONE}

Deleting The Workspace Removes Its Module Rows
    [Tags]    state
    ${team}=    Create Owner Workspace
    Switch Module    ${team}[owner]    ${team}[ws]    subcontracting    ${True}
    DELETE On Session    ${team}[owner][alias]    /workspaces/${team}[ws]    expected_status=204
    ${n}=    Query Value    select count(*) from workspace_modules where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0
