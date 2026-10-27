*** Settings ***
Documentation       The module gate of "จ้างช่วง": the platform offers it (MODULES_ENABLED=subcontracting) and every
...                 workspace switches it on or off. Off = every subcontracting route answers 404 ``module_disabled``,
...                 no data is deleted, and crews keep read-only access to running contracts (docs/marketplace/README.md §1,
...                 API-module1.md "ScAccess").
Resource            ../../resources/api.resource
Resource            ../../resources/db.resource
Resource            ../../resources/pages/api_subcontracting.resource
Test Tags           api    subcontracting    module-gate


*** Test Cases ***
Platform Offers The Subcontracting Module
    [Documentation]    GET /platform/modules is public and lists subcontracting (the E2E API runs with it on).
    [Tags]    smoke
    ${anon}=    Anonymous Caller
    ${resp}=    Api Get    ${anon}    /platform/modules
    Should Contain    ${resp.json()}[modules]    subcontracting

New Workspace Has The Module Off By Default
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    ${resp}=    Api Get    ${buyer}[owner]    /workspaces/${buyer}[ws]/modules
    ${sub}=    Set Variable    ${resp.json()}[0]
    Should Be Equal    ${sub}[module]    subcontracting
    Should Be True    ${sub}[available]
    Should Not Be True    ${sub}[enabled]
    Should Be Equal    ${sub}[enabledAt]    ${None}

Module List Has Every Module In Order
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    ${resp}=    Api Get    ${buyer}[owner]    /workspaces/${buyer}[ws]/modules
    ${ids}=    Evaluate    [m['module'] for m in $resp.json()]
    Should Be Equal    ${ids}    ${{ ['subcontracting', 'materials', 'owner-leads', 'ai-assist'] }}
    Should Not Be True    ${resp.json()}[1][available]

Buyer Routes Answer Module Disabled While The Module Is Off
    [Documentation]    Every buyer route of the module (list, settings, overview, report, contracts, retention)
    ...    answers 404 ``module_disabled`` for an owner of a workspace that has not switched it on.
    [Tags]    negative    smoke
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    ${ws}=    Set Variable    ${buyer}[ws]
    ${project}=    Set Variable    ${buyer}[project_id]
    Buyer Sees Module Disabled    ${buyer}[owner]    GET    /workspaces/${ws}/vendor-list
    Buyer Sees Module Disabled    ${buyer}[owner]    GET    /workspaces/${ws}/subcontracting/settings
    Buyer Sees Module Disabled    ${buyer}[owner]    GET    /workspaces/${ws}/subcontracting/retention
    Buyer Sees Module Disabled    ${buyer}[owner]    GET    /projects/${project}/subcontracting/packages
    Buyer Sees Module Disabled    ${buyer}[owner]    GET    /projects/${project}/subcontracting/overview
    Buyer Sees Module Disabled    ${buyer}[owner]    GET    /projects/${project}/subcontracting/report
    Buyer Sees Module Disabled    ${buyer}[owner]    GET    /projects/${project}/subcontracting/subcontracts

Creating A Package While The Module Is Off Is Refused
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    ${resp}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]    404
    Error Code Should Be    ${resp}    module_disabled
    Row Count Should Be    0    select 1 from sc_work_packages where buyer_workspace_id = %s    ${buyer}[ws]

Adding A Crew To The Vendor List While The Module Is Off Is Refused
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    ${resp}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]    status=404
    Should Be Equal    ${resp}[code]    module_disabled
    Row Count Should Be    0    select 1 from sc_vendor_list_entries where buyer_workspace_id = %s    ${buyer}[ws]

Switching The Module On Makes The Routes Work
    [Tags]    smoke
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    VAR    &{on}    enabled=${True}
    ${resp}=    Api Put    ${buyer}[owner]    /workspaces/${buyer}[ws]/modules/subcontracting    ${on}    200
    Should Be True    ${resp.json()}[enabled]
    Should Not Be Equal    ${resp.json()}[enabledAt]    ${None}
    ${list}=    Api Get    ${buyer}[owner]    /workspaces/${buyer}[ws]/vendor-list
    Should Be Empty    ${list.json()}
    ${enabled}=    Query Value    select enabled from workspace_modules where workspace_id = %s and module = 'subcontracting'
    ...    ${buyer}[ws]
    Should Be True    ${enabled}

Switching On Twice Is Harmless
    [Tags]    edge
    ${buyer}=    Create Buyer Workspace
    VAR    &{on}    enabled=${True}
    ${resp}=    Api Put    ${buyer}[owner]    /workspaces/${buyer}[ws]/modules/subcontracting    ${on}    200
    Should Be True    ${resp.json()}[enabled]
    Row Count Should Be    1    select 1 from workspace_modules where workspace_id = %s and module = 'subcontracting'
    ...    ${buyer}[ws]

Switching Off And On Again Keeps Every Subcontracting Row
    [Documentation]    Off never deletes data: the vendor-list entry and the package are still in ``sc_*`` while the
    ...    routes answer module_disabled, and they are readable again after switching on.
    [Tags]    edge    smoke
    ${buyer}=    Create Buyer Workspace
    ${entry}=    Add Crew To Vendor List    ${buyer}[owner]    ${buyer}[ws]
    ${package}=    Create Package Via API    ${buyer}[owner]    ${buyer}[project_id]
    VAR    &{off}    enabled=${False}
    ${resp}=    Api Put    ${buyer}[owner]    /workspaces/${buyer}[ws]/modules/subcontracting    ${off}    200
    Should Not Be True    ${resp.json()}[enabled]
    Row Count Should Be    1    select 1 from sc_work_packages where id = %s    ${package.json()}[id]
    Row Count Should Be    1    select 1 from sc_package_versions where package_id = %s    ${package.json()}[id]
    Row Count Should Be    1    select 1 from sc_vendor_list_entries where id = %s    ${entry}[id]
    ${blocked}=    Api Get    ${buyer}[owner]    /subcontracting/packages/${package.json()}[id]    404
    Error Code Should Be    ${blocked}    module_disabled
    VAR    &{on}    enabled=${True}
    Api Put    ${buyer}[owner]    /workspaces/${buyer}[ws]/modules/subcontracting    ${on}    200
    ${again}=    Api Get    ${buyer}[owner]    /subcontracting/packages/${package.json()}[id]
    Should Be Equal    ${again.json()}[title]    ${package.json()}[title]
    Length Should Be    ${again.json()}[lines]    ${MASONRY LINES}

Switching Off Leaves The Boq Project Untouched
    [Documentation]    Without the module ConTrack is plain BOQ: the project answers as before.
    [Tags]    edge
    ${buyer}=    Create Buyer Workspace
    VAR    &{off}    enabled=${False}
    Api Put    ${buyer}[owner]    /workspaces/${buyer}[ws]/modules/subcontracting    ${off}    200
    ${project}=    Api Get    ${buyer}[owner]    /projects/${buyer}[project_id]
    Should Be Equal    ${project.json()}[project][id]    ${buyer}[project_id]

Estimator Cannot Switch The Module
    [Documentation]    modules.manage belongs to owner and admin only.
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    ${estimator}=    Add Workspace Member    ${buyer}    estimator
    VAR    &{on}    enabled=${True}
    ${resp}=    Api Put    ${estimator}    /workspaces/${buyer}[ws]/modules/subcontracting    ${on}    403
    Error Code Should Be    ${resp}    forbidden
    ${enabled}=    Query Value    select count(*) from workspace_modules where workspace_id = %s and enabled
    ...    ${buyer}[ws]
    Should Be Equal As Integers    ${enabled}    0

Viewer Cannot Switch The Module
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    ${viewer}=    Add Workspace Member    ${buyer}    viewer
    VAR    &{on}    enabled=${True}
    ${resp}=    Api Put    ${viewer}    /workspaces/${buyer}[ws]/modules/subcontracting    ${on}    403
    Error Code Should Be    ${resp}    forbidden

Admin Can Switch The Module
    [Tags]    security
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    ${admin}=    Add Workspace Member    ${buyer}    admin
    VAR    &{on}    enabled=${True}
    ${resp}=    Api Put    ${admin}    /workspaces/${buyer}[ws]/modules/subcontracting    ${on}    200
    Should Be True    ${resp.json()}[enabled]

Stranger Cannot Switch Or See The Modules Of Another Workspace
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    ${stranger}=    Register User Via API    stranger
    VAR    &{on}    enabled=${True}
    ${put}=    Api Put    ${stranger}    /workspaces/${buyer}[ws]/modules/subcontracting    ${on}    404
    Error Code Should Be    ${put}    not_found
    ${get}=    Api Get    ${stranger}    /workspaces/${buyer}[ws]/modules    404
    Error Code Should Be    ${get}    not_found

Module Not Offered By The Platform Cannot Be Switched On
    [Documentation]    ``materials`` is not in MODULES_ENABLED of this server: 422.
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    VAR    &{on}    enabled=${True}
    ${resp}=    Api Put    ${buyer}[owner]    /workspaces/${buyer}[ws]/modules/materials    ${on}    422
    Error Code Should Be    ${resp}    unprocessable

Unknown Module Id Is Refused
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    VAR    &{on}    enabled=${True}
    ${resp}=    Api Put    ${buyer}[owner]    /workspaces/${buyer}[ws]/modules/space-travel    ${on}    400
    Error Code Should Be    ${resp}    validation_failed

Module Switch Needs A Boolean
    [Tags]    negative
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    VAR    &{bad}    enabled=yes
    ${resp}=    Api Put    ${buyer}[owner]    /workspaces/${buyer}[ws]/modules/subcontracting    ${bad}    400
    Error Code Should Be    ${resp}    validation_failed

Anonymous Caller Gets Unauthenticated On Module Routes
    [Tags]    security    negative
    ${buyer}=    Create Buyer Workspace
    ${anon}=    Anonymous Caller
    ${resp}=    Api Get    ${anon}    /workspaces/${buyer}[ws]/vendor-list    401
    Error Code Should Be    ${resp}    unauthenticated
    ${modules}=    Api Get    ${anon}    /workspaces/${buyer}[ws]/modules    401
    Error Code Should Be    ${modules}    unauthenticated

Module Is Per Workspace Not Per User
    [Documentation]    One user owning two workspaces: switching one on leaves the other off.
    [Tags]    edge    security
    ${buyer}=    Create Buyer Workspace    module_on=${False}
    ${second}=    Create Company Workspace Via API    ${buyer}[owner]
    VAR    &{on}    enabled=${True}
    Api Put    ${buyer}[owner]    /workspaces/${second}/modules/subcontracting    ${on}    200
    Buyer Sees Module Disabled    ${buyer}[owner]    GET    /workspaces/${buyer}[ws]/vendor-list
    ${list}=    Api Get    ${buyer}[owner]    /workspaces/${second}/vendor-list
    Should Be Empty    ${list.json()}

Switching Off Needs Confirmation While A Contract Runs
    [Documentation]    With a running subcontract and no ``confirm`` the switch-off is 409 conflict with
    ...    ``activeSubcontracts`` in the details; the module stays on. ``confirm: true`` switches it off.
    [Tags]    edge
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    Vendor Accepts Contract    ${ctx}[crews][0]    ${contract}[id]
    VAR    &{off}    enabled=${False}
    ${refused}=    Api Put    ${ctx}[buyer][owner]    /workspaces/${ctx}[buyer][ws]/modules/subcontracting    ${off}    409
    Error Code Should Be    ${refused}    conflict
    Should Be True    ${refused.json()}[details][activeSubcontracts] >= 1
    ${still}=    Query Value    select enabled from workspace_modules where workspace_id = %s and module = 'subcontracting'
    ...    ${ctx}[buyer][ws]
    Should Be True    ${still}
    VAR    &{confirmed}    enabled=${False}    confirm=${True}
    ${resp}=    Api Put    ${ctx}[buyer][owner]    /workspaces/${ctx}[buyer][ws]/modules/subcontracting    ${confirmed}    200
    Should Not Be True    ${resp.json()}[enabled]
    Row Count Should Be    1    select 1 from sc_subcontracts where id = %s and status = 'active'    ${contract}[id]

Crew Keeps Read Only Access To A Running Contract When The Buyer Switches Off
    [Documentation]    After the buyer switched the module off the crew can still read the contract (200) but cannot
    ...    claim (404 module_disabled); the buyer's own routes are disabled.
    [Tags]    edge    security
    ${ctx}=    Set Up Package With Bids    ${{ [100] }}
    ${contract}=    Contract For Package    ${ctx}
    ${crew}=    Set Variable    ${ctx}[crews][0]
    Vendor Accepts Contract    ${crew}    ${contract}[id]
    VAR    &{off}    enabled=${False}    confirm=${True}
    Api Put    ${ctx}[buyer][owner]    /workspaces/${ctx}[buyer][ws]/modules/subcontracting    ${off}    200
    ${read}=    Api Get    ${crew}    /subcontracting/subcontracts/${contract}[id]
    Should Be Equal    ${read.json()}[status]    active
    Should Not Be True    ${read.json()}[buyerModuleOn]
    Should Be Equal    ${read.json()}[viewerSide]    vendor
    VAR    @{photos}
    VAR    &{claim}    installmentNo=${1}    note=${EMPTY}    photoFileIds=${photos}
    ${blocked}=    Api Post    ${crew}    /subcontracting/subcontracts/${contract}[id]/claims    ${claim}    404
    Error Code Should Be    ${blocked}    module_disabled
    ${buyer_read}=    Api Get    ${ctx}[buyer][owner]    /subcontracting/subcontracts/${contract}[id]    404
    Error Code Should Be    ${buyer_read}    module_disabled
    Row Count Should Be    0    select 1 from sc_claims where subcontract_id = %s    ${contract}[id]

Crew Cannot Bid While The Buyer Module Is Off
    [Documentation]    A vendor WRITE on a buyer's package needs the buyer's module on: 404 module_disabled, no bid row.
    [Tags]    edge    negative
    ${ctx}=    Set Up Open Package With Crews    1
    VAR    &{off}    enabled=${False}
    Api Put    ${ctx}[buyer][owner]    /workspaces/${ctx}[buyer][ws]/modules/subcontracting    ${off}    200
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]
    ${resp}=    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    404
    Error Code Should Be    ${resp}    module_disabled
    Row Count Should Be    0    select 1 from sc_bids where invitation_id = %s    ${crew}[invitation_id]

Switching The Module Back On Lets The Crew Bid Again
    [Tags]    edge
    ${ctx}=    Set Up Open Package With Crews    1
    VAR    &{off}    enabled=${False}
    VAR    &{on}    enabled=${True}
    Api Put    ${ctx}[buyer][owner]    /workspaces/${ctx}[buyer][ws]/modules/subcontracting    ${off}    200
    Api Put    ${ctx}[buyer][owner]    /workspaces/${ctx}[buyer][ws]/modules/subcontracting    ${on}    200
    ${crew}=    Set Variable    ${ctx}[crews][0]
    ${body}=    Bid Body    ${ctx}[lines]
    Api Post    ${crew}    /vendor/invitations/${crew}[invitation_id]/bid    ${body}    201

One Workspace Switching Off Does Not Disable Another Buyer
    [Tags]    security    edge
    ${first}=    Create Buyer Workspace
    ${second}=    Create Buyer Workspace
    VAR    &{off}    enabled=${False}
    Api Put    ${first}[owner]    /workspaces/${first}[ws]/modules/subcontracting    ${off}    200
    ${list}=    Api Get    ${second}[owner]    /workspaces/${second}[ws]/vendor-list
    Should Be Empty    ${list.json()}
