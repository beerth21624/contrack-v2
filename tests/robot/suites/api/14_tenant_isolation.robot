*** Settings ***
Documentation       A1 tenant isolation: users of tenant A cannot read or change anything of tenant B by id. The API answers
...                 404 ``not_found`` (the same answer as for an id that does not exist, so the tenant is not revealed),
...                 never 403 and never data. After each hostile call the database must show tenant B unchanged.
...                 Two teams are built once in the suite setup (read-only use); destructive checks build their own.
Resource            ../../resources/api.resource
Resource            ../../resources/db.resource
Resource            ../../resources/pages/api_team.resource
Suite Setup         Prepare Two Tenants
Test Tags           api    team    security    tenant    db


*** Variables ***
@{A ROLES}      owner    admin    estimator    viewer


*** Test Cases ***
# ── every route of tenant B is hidden from every role of tenant A ──
Foreign Workspace Cannot Be Read
    [Template]    Foreign Call Should Be Hidden
    GET    /workspaces/${B}[ws]

Foreign Workspace Cannot Be Renamed
    [Template]    Foreign Call Should Be Hidden
    PATCH    /workspaces/${B}[ws]    name=ถูกแฮก

Foreign Workspace Cannot Be Deleted
    [Template]    Foreign Call Should Be Hidden
    DELETE    /workspaces/${B}[ws]

Foreign Member List Cannot Be Read
    [Template]    Foreign Call Should Be Hidden
    GET    /workspaces/${B}[ws]/members

Foreign Member Role Cannot Be Changed
    [Template]    Foreign Call Should Be Hidden
    PATCH    /workspaces/${B}[ws]/members/${B}[admin][id]    role=viewer

Foreign Member Cannot Be Promoted To Owner
    [Template]    Foreign Call Should Be Hidden
    PATCH    /workspaces/${B}[ws]/members/${B}[viewer][id]    role=owner

Foreign Member Cannot Be Removed
    [Template]    Foreign Call Should Be Hidden
    DELETE    /workspaces/${B}[ws]/members/${B}[viewer][id]

Foreign Owner Cannot Be Removed
    [Template]    Foreign Call Should Be Hidden
    DELETE    /workspaces/${B}[ws]/members/${B}[owner][id]

Foreign Invitation List Cannot Be Read
    [Template]    Foreign Call Should Be Hidden
    GET    /workspaces/${B}[ws]/invitations

Cannot Invite Someone Into A Foreign Workspace
    [Template]    Foreign Call Should Be Hidden
    POST    /workspaces/${B}[ws]/invitations    email=intruder@robot.test    role=admin

Foreign Invitation Cannot Be Revoked
    [Template]    Foreign Call Should Be Hidden
    DELETE    /workspaces/${B}[ws]/invitations/${B INVITATION}

Foreign Project List Cannot Be Read
    [Template]    Foreign Call Should Be Hidden
    GET    /workspaces/${B}[ws]/projects

Cannot Create A Project In A Foreign Workspace
    [Template]    Foreign Call Should Be Hidden
    POST    /workspaces/${B}[ws]/projects    name=โครงการแทรก    start=blank

Foreign Project Cannot Be Read By Id
    [Template]    Foreign Call Should Be Hidden
    GET    /projects/${B PROJECT}

Foreign Project Cannot Be Renamed
    [Template]    Foreign Call Should Be Hidden
    PATCH    /projects/${B PROJECT}    name=ถูกเปลี่ยนชื่อ

Foreign Project Cannot Be Archived
    [Template]    Foreign Call Should Be Hidden
    PATCH    /projects/${B PROJECT}    archived=${True}

Foreign Project Cannot Be Deleted
    [Template]    Foreign Call Should Be Hidden
    DELETE    /projects/${B PROJECT}

Foreign Project Revisions Cannot Be Listed
    [Template]    Foreign Call Should Be Hidden
    GET    /projects/${B PROJECT}/revisions

Cannot Create A Revision On A Foreign Project
    [Template]    Foreign Call Should Be Hidden
    POST    /projects/${B PROJECT}/revisions    label=Rev-X

Foreign Project Assignments Cannot Be Read
    [Template]    Foreign Call Should Be Hidden
    GET    /projects/${B PROJECT}/assignments

Cannot Assign A Level On A Foreign Project
    [Template]    Foreign Call Should Be Hidden
    PUT    /projects/${B PROJECT}/assignments/land-inspection    userId=${None}

Foreign Project Activity Cannot Be Read
    [Template]    Foreign Call Should Be Hidden
    GET    /projects/${B PROJECT}/activity

# ── the answer reveals nothing ──
Foreign Id And Unknown Id Give The Same Answer
    [Documentation]    404 for a real foreign project must equal the 404 for a random id: no existence oracle.
    ${real}=    Api Call    ${A}[owner][alias]    GET    /projects/${B PROJECT}    404
    ${fake}=    Api Call    ${A}[owner][alias]    GET    /projects/${ZERO UUID}    404
    Should Be Equal    ${real.json()}[code]    ${fake.json()}[code]
    Should Be Equal    ${real.json()}[message]    ${fake.json()}[message]
    ${real_ws}=    Api Call    ${A}[owner][alias]    GET    /workspaces/${B}[ws]    404
    ${fake_ws}=    Api Call    ${A}[owner][alias]    GET    /workspaces/${ZERO UUID}    404
    Should Be Equal    ${real_ws.json()}[message]    ${fake_ws.json()}[message]

Hostile Answers Never Contain The Names Or Ids Of Tenant B
    ${r1}=    Api Call    ${A}[owner][alias]    GET    /workspaces/${B}[ws]    404
    ${r2}=    Api Call    ${A}[owner][alias]    GET    /projects/${B PROJECT}    404
    ${r3}=    Api Call    ${A}[owner][alias]    GET    /workspaces/${B}[ws]/members    404
    FOR    ${resp}    IN    ${r1}    ${r2}    ${r3}
        Should Not Contain    ${resp.text}    ${B PROJECT NAME}
        Should Not Contain    ${resp.text}    ${B}[owner][email]
        Should Not Contain    ${resp.text}    ${B}[owner][id]
    END

Lists Of Tenant A Never Contain Tenant B
    ${ids}=    Workspace Ids Listed For    ${A}[owner]
    Should Not Contain    ${ids}    ${B}[ws]
    ${projects}=    Api Call    ${A}[owner][alias]    GET    /workspaces/${A}[ws]/projects    200
    ${names}=    Evaluate    [p['name'] for p in $projects.json()]
    Should Not Contain    ${names}    ${B PROJECT NAME}
    Should Contain    ${names}    ${A PROJECT NAME}
    ${members}=    Members Of Workspace    ${A}[owner]    ${A}[ws]
    ${emails}=    Evaluate    [m['email'] for m in $members]
    Should Not Contain    ${emails}    ${B}[owner][email]

Archived Project List Of Tenant A Does Not Leak Tenant B
    [Tags]    edge
    ${projects}=    Api Call    ${A}[owner][alias]    GET    /workspaces/${A}[ws]/projects?archived=true    200
    ${ids}=    Evaluate    [p['id'] for p in $projects.json()]
    Should Not Contain    ${ids}    ${B PROJECT}

Workspace Header Or Query Cannot Switch Tenant
    [Documentation]    Error guessing: a client sending the foreign workspace id as header or query must not see it.
    [Tags]    edge
    ${headers}=    Create Dictionary    X-Workspace-Id=${B}[ws]    X-Tenant-Id=${B}[ws]
    ${params}=    Create Dictionary    workspaceId=${B}[ws]
    ${resp}=    GET On Session    ${A}[owner][alias]    /workspaces    params=${params}    headers=${headers}    expected_status=200
    ${ids}=    Evaluate    [w['id'] for w in $resp.json()]
    Should Not Contain    ${ids}    ${B}[ws]

# ── mixing ids of two tenants ──
Member Of Tenant B Cannot Be Changed Through A Workspace Of Tenant A
    [Documentation]    Own workspace in the path, foreign user id as target: 404 member not found, B untouched.
    VAR    &{body}    role=viewer
    Api Error Should Be    ${A}[owner][alias]    PATCH    /workspaces/${A}[ws]/members/${B}[admin][id]    404    not_found    ${body}
    Membership Role Should Be    ${B}[ws]    ${B}[admin][id]    admin

Member Of Tenant B Cannot Be Removed Through A Workspace Of Tenant A
    Api Error Should Be    ${A}[owner][alias]    DELETE    /workspaces/${A}[ws]/members/${B}[viewer][id]    404    not_found
    Membership Role Should Be    ${B}[ws]    ${B}[viewer][id]    viewer

Invitation Of Tenant B Cannot Be Revoked Through A Workspace Of Tenant A
    Api Error Should Be    ${A}[owner][alias]    DELETE    /workspaces/${A}[ws]/invitations/${B INVITATION}    404    not_found
    ${row}=    Invitation Row By Id    ${B INVITATION}
    Should Be Equal    ${row}[revoked_at]    ${None}

Invitation Token Of Tenant B Cannot Be Accepted By A User Of Tenant A
    [Tags]    security
    ${resp}=    Accept Invitation    ${A}[owner]    ${B TOKEN}    410
    Error Code Should Be    ${resp}    invitation_invalid
    Membership Row Should Not Exist    ${B}[ws]    ${A}[owner][id]

Project Of Tenant B Cannot Be Assigned To A Member Of Tenant A
    [Documentation]    The workspace in the project decides: A's owner has no access to B's project at all.
    VAR    &{body}    userId=${A}[estimator][id]
    Api Error Should Be    ${A}[owner][alias]    PUT    /projects/${B PROJECT}/assignments/land-inspection    404    not_found    ${body}

User Of Tenant B Cannot Be Assigned A Level In Tenant A
    [Documentation]    An assignee must be a member of the project's workspace (API.md: 422 unprocessable).
    VAR    &{body}    userId=${B}[estimator][id]
    Api Error Should Be    ${A}[owner][alias]    PUT    /projects/${A PROJECT}/assignments/land-inspection    422    unprocessable    ${body}
    ${n}=    Query Value    select count(*) from level_assignments where project_id = %s    ${A PROJECT}
    Should Be Equal As Integers    ${n}    0

Project Created In A Cannot Be Moved To B By Body Fields
    [Documentation]    Mass assignment: ``workspaceId`` in create or rename bodies is ignored.
    [Tags]    edge
    ${name}=    Unique Name    ทดสอบย้าย
    VAR    &{create}    name=${name}    start=blank    workspaceId=${B}[ws]
    ${resp}=    Api Call    ${A}[owner][alias]    POST    /workspaces/${A}[ws]/projects    201    ${create}
    ${id}=    Set Variable    ${resp.json()}[project][id]
    ${home}=    Query Value    select workspace_id from projects where id = %s    ${id}
    Should Be Equal As Strings    ${home}    ${A}[ws]
    VAR    &{rename}    name=${name}-2    workspaceId=${B}[ws]
    Api Call    ${A}[owner][alias]    PATCH    /projects/${id}    200    ${rename}
    ${home}=    Query Value    select workspace_id from projects where id = %s    ${id}
    Should Be Equal As Strings    ${home}    ${A}[ws]

Workspace Rename Body Cannot Change The Tenant Of Members
    [Tags]    edge
    ${owner}=    Register User Via API    iso
    ${ws}=    Create Company Workspace Via API    ${owner}
    VAR    &{body}    name=ชื่อใหม่    id=${B}[ws]
    ${resp}=    Api Call    ${owner}[alias]    PATCH    /workspaces/${ws}    200    ${body}
    Should Be Equal    ${resp.json()}[id]    ${ws}
    ${n}=    Query Value    select count(*) from workspaces where id = %s and name = 'ชื่อใหม่'    ${B}[ws]
    Should Be Equal As Integers    ${n}    0

# ── one person, two tenants, two roles ──
Roles Are Per Workspace
    [Documentation]    X is viewer in A and owner in X's own company: A's rules apply in A, the owner rules in the other.
    [Tags]    edge
    ${own}=    Register User Via API    dual
    ${own_ws}=    Create Company Workspace Via API    ${own}
    ${own_project}=    Create Project Via API    ${own}    ${own_ws}
    VAR    &{rename}    name=เปลี่ยนในที่ของฉัน
    Api Call    ${A}[viewer][alias]    GET    /projects/${A PROJECT}    200
    VAR    &{denied}    name=แก้ของ A
    Api Error Should Be    ${A}[viewer][alias]    PATCH    /projects/${A PROJECT}    403    forbidden    ${denied}
    # The same person owns a second workspace and edits there.
    ${dual}=    Add Member With Role    ${own}    ${own_ws}    viewer
    Api Error Should Be    ${dual}[alias]    PATCH    /projects/${own_project}[project][id]    403    forbidden    ${rename}
    ${mine}=    Create Company Workspace Via API    ${dual}
    ${project}=    Create Project Via API    ${dual}    ${mine}
    Api Call    ${dual}[alias]    PATCH    /projects/${project}[project][id]    200    ${rename}

Leaving One Workspace Keeps The Membership In Another
    [Tags]    edge
    ${first}=    Register User Via API    dual
    ${ws1}=    Create Company Workspace Via API    ${first}
    ${ws2}=    Create Company Workspace Via API    ${first}
    ${guest}=    Add Member With Role    ${first}    ${ws1}    estimator
    ${token}=    Create Invitation Token    ${first}    ${ws2}    ${guest}[email]    viewer
    Accept Invitation    ${guest}    ${token}    200
    Api Call    ${guest}[alias]    DELETE    /workspaces/${ws1}/members/${guest}[id]    204
    Membership Row Should Not Exist    ${ws1}    ${guest}[id]
    Membership Role Should Be    ${ws2}    ${guest}[id]    viewer
    Api Call    ${guest}[alias]    GET    /workspaces/${ws2}    200

Deleting Workspace A Leaves Tenant B Intact
    [Tags]    edge
    ${doomed}=    Create Team Workspace
    Api Call    ${doomed}[owner][alias]    DELETE    /workspaces/${doomed}[ws]    204
    Tenant B Should Be Unchanged

Removed Member Loses Access To Projects Of That Workspace Only
    [Tags]    security
    ${owner}=    Register User Via API    iso
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${project}=    Create Project Via API    ${owner}    ${ws}
    ${guest}=    Add Member With Role    ${owner}    ${ws}    estimator
    Api Call    ${guest}[alias]    GET    /projects/${project}[project][id]    200
    Api Call    ${owner}[alias]    DELETE    /workspaces/${ws}/members/${guest}[id]    204
    Api Error Should Be    ${guest}[alias]    GET    /projects/${project}[project][id]    404    not_found
    Api Call    ${guest}[alias]    GET    /me    200

Personal Workspace Projects Are Hidden From The Team
    [Tags]    security
    ${personal}=    Personal Workspace Id    ${A}[owner]
    ${project}=    Create Project Via API    ${A}[owner]    ${personal}
    FOR    ${role}    IN    admin    estimator    viewer
        Api Error Should Be    ${A}[${role}][alias]    GET    /projects/${project}[project][id]    404    not_found
    END

Anonymous Callers See Nothing Of Either Tenant
    [Tags]    negative
    Create Anonymous Session    anon
    Api Error Should Be    anon    GET    /projects/${B PROJECT}    401    unauthenticated
    Api Error Should Be    anon    GET    /workspaces/${B}[ws]/members    401    unauthenticated


*** Keywords ***
Foreign Call Should Be Hidden
    [Documentation]    Every role of tenant A calls a route of tenant B: 404 ``not_found`` each time and B is unchanged.
    [Arguments]    ${method}    ${path}    &{body}
    ${payload}=    Set Variable If    ${body}    ${body}    ${None}
    FOR    ${role}    IN    @{A ROLES}
        ${resp}=    Api Call    ${A}[${role}][alias]    ${method}    ${path}    404    ${payload}
        Error Code Should Be    ${resp}    not_found
        Should Not Contain    ${resp.text}    ${B PROJECT NAME}
    END
    Tenant B Should Be Unchanged

Prepare Two Tenants
    [Documentation]    Tenant A and tenant B, each with the four roles, a project and (in B) a pending invitation.
    Create Anonymous Session    anon
    ${a}=    Create Team Workspace
    ${b}=    Create Team Workspace
    ${a_name}=    Unique Name    โครงการของ A
    ${b_name}=    Unique Name    โครงการของ B ลับ
    ${a_project}=    Create Project Via API    ${a}[owner]    ${a}[ws]    ${a_name}
    ${b_project}=    Create Project Via API    ${b}[owner]    ${b}[ws]    ${b_name}
    ${invite}=    Invite Via API    ${b}[owner]    ${b}[ws]    ${{ 'pending.' + $b['ws'][:8] + '@robot.test' }}    viewer    201
    VAR    ${A}    ${a}    scope=SUITE
    VAR    ${B}    ${b}    scope=SUITE
    VAR    ${A PROJECT}    ${a_project}[project][id]    scope=SUITE
    VAR    ${B PROJECT}    ${b_project}[project][id]    scope=SUITE
    VAR    ${A PROJECT NAME}    ${a_name}    scope=SUITE
    VAR    ${B PROJECT NAME}    ${b_name}    scope=SUITE
    VAR    ${B INVITATION}    ${invite.json()}[invitation][id]    scope=SUITE
    VAR    ${B TOKEN}    ${invite.json()}[token]    scope=SUITE

Tenant B Should Be Unchanged
    [Documentation]    Database read-back: B's workspace, 4 members and their roles, project and pending invitation as built.
    ${ws}=    Query Row    select * from workspaces where id = %s    ${B}[ws]
    Should Be Equal    ${ws}[kind]    company
    ${members}=    Query Rows    select user_id, role from memberships where workspace_id = %s    ${B}[ws]
    ${roles}=    Evaluate    {str(m['user_id']): m['role'] for m in $members}
    FOR    ${role}    IN    owner    admin    estimator    viewer
        ${stored}=    Evaluate    $roles[$B[$role]['id']]
        Should Be Equal    ${stored}    ${role}
    END
    Length Should Be    ${members}    4
    ${project}=    Project Row    ${B PROJECT}
    Should Be Equal    ${project}[name]    ${B PROJECT NAME}
    Should Be Equal    ${project}[archived_at]    ${None}
    ${invite}=    Invitation Row By Id    ${B INVITATION}
    Should Be Equal    ${invite}[revoked_at]    ${None}
    Should Be Equal    ${invite}[accepted_at]    ${None}
    ${revisions}=    Query Value    select count(*) from project_revisions where project_id = %s    ${B PROJECT}
    Should Be Equal As Integers    ${revisions}    0
    ${assignments}=    Query Value    select count(*) from level_assignments where project_id = %s    ${B PROJECT}
    Should Be Equal As Integers    ${assignments}    0
