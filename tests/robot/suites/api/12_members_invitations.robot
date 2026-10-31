*** Settings ***
Documentation       A1 team: invitations (create, list pending, revoke, accept), members (list, change role, remove, leave)
...                 and the personal-workspace rules, with ``memberships`` and ``invitations`` rows read back.
...                 Rules (backend/API.md, workspaces domain policies): the raw token is returned once and only its hash
...                 is stored; accept needs the invited e-mail, is single use and any failure is 410 ``invitation_invalid``;
...                 an owner role is never invited; a workspace never has 0 owners (409 ``last_owner``).
...                 Role-by-role decision tables live in ``13_permission_matrix.robot``.
Resource            ../../resources/api.resource
Resource            ../../resources/db.resource
Resource            ../../resources/pages/api_team.resource
Suite Setup         Create Anonymous Session    anon
Test Tags           api    team    db


*** Test Cases ***
# ── invite ──
Owner Invites A Viewer And Receives The One Time Token
    [Tags]    smoke
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${email}=    Unique Email    guest
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${email}    viewer    201
    Should Be True    len($resp.json()['token']) >= 16
    Should Be Equal    ${resp.json()}[invitation][email]    ${email}
    Should Be Equal    ${resp.json()}[invitation][role]    viewer
    Should Be Equal    ${resp.json()}[invitation][invitedBy]    ${owner}[id]
    Should Not Contain    ${resp.text}    tokenHash
    Should Not Contain    ${resp.text}    token_hash

Invitation Row Stores Only A Hash Of The Token And A Future Expiry
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${email}=    Unique Email    guest
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${email}    estimator    201
    ${row}=    Invitation Row By Id    ${resp.json()}[invitation][id]
    Should Be Equal As Strings    ${row}[workspace_id]    ${ws}
    Should Be Equal    ${row}[email]    ${email}
    Should Be Equal    ${row}[role]    estimator
    Should Be Equal As Strings    ${row}[invited_by]    ${owner}[id]
    Should Not Be Equal    ${row}[token_hash]    ${resp.json()}[token]
    Should Not Contain    ${row}[token_hash]    ${resp.json()}[token]
    Should Be Equal    ${row}[accepted_at]    ${None}
    Should Be Equal    ${row}[revoked_at]    ${None}
    Should Be True    $row['expires_at'] > $row['created_at']

Invite Normalises The E-mail To Lower Case And Trims It
    [Tags]    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${local}=    Unique Suffix
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${SPACE}${SPACE}${local.upper()}@Robot.TEST${SPACE}    viewer    201
    Should Be Equal    ${resp.json()}[invitation][email]    ${local}@robot.test

Invite Does Not Need The Invited Person To Be Registered Yet
    [Tags]    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${email}=    Unique Email    later
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${email}    estimator
    VAR    &{body}    email=${email}    password=${TEST_PASSWORD}    displayName=มาทีหลัง
    ${reg}=    Register Raw    ${body}    201
    ${user}=    Login Via API    ${email}    ${TEST_PASSWORD}
    ${resp}=    Accept Invitation    ${user}    ${token}    200
    Should Be Equal    ${resp.json()}[role]    estimator

Invite Rejects The Owner Role
    [Documentation]    Ownership is never handed out through an invitation (assignableRoleSchema).
    [Tags]    negative    security
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${{ 'x.' + $ws[:6] + '@robot.test' }}    owner    400
    Error Code Should Be    ${resp}    validation_failed

Invite Rejects An Unknown Role
    [Tags]    negative
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${{ 'x.' + $ws[:6] + '@robot.test' }}    superuser    400
    Error Code Should Be    ${resp}    validation_failed

Invite Rejects An Upper Case Role Name
    [Tags]    negative    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${{ 'x.' + $ws[:6] + '@robot.test' }}    VIEWER    400
    Error Code Should Be    ${resp}    validation_failed

Invite Rejects A Missing Role And A Missing E-mail
    [Tags]    negative
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    VAR    &{no_role}    email=a.${ws}[:6]@robot.test
    VAR    &{no_email}    role=viewer
    Api Error Should Be    ${owner}[alias]    POST    /workspaces/${ws}/invitations    400    validation_failed    ${no_role}
    Api Error Should Be    ${owner}[alias]    POST    /workspaces/${ws}/invitations    400    validation_failed    ${no_email}

Invite Rejects A Malformed E-mail
    [Tags]    negative
    [Template]    Invite With E-mail Should Be Rejected
    not-an-email
    a@
    ${EMPTY}
    ${None}
    ' or 1=1 --

Invite Rejects An E-mail Longer Than 254 Characters
    [Tags]    negative    edge
    ${long}=    Evaluate    'a' * 250 + '@robot.test'
    Invite With E-mail Should Be Rejected    ${long}

Invite Rejects A Malformed Json Body
    [Tags]    negative    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${resp}=    Post Raw Json    ${owner}[alias]    /workspaces/${ws}/invitations    {"email":    400
    Error Code Should Be    ${resp}    validation_failed

Invite A Current Member Answers 409 Conflict
    [Tags]    negative
    ${team}=    Create Team Workspace
    ${resp}=    Invite Via API    ${team}[owner]    ${team}[ws]    ${team}[viewer][email]    admin    409
    Error Code Should Be    ${resp}    conflict

Invite A Current Member With Other Letter Case Answers 409
    [Tags]    negative    edge
    ${team}=    Create Team Workspace
    ${shout}=    Convert To Upper Case    ${team}[admin][email]
    ${resp}=    Invite Via API    ${team}[owner]    ${team}[ws]    ${shout}    viewer    409
    Error Code Should Be    ${resp}    conflict

Invite Yourself Answers 409 Conflict
    [Tags]    negative    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${owner}[email]    admin    409
    Error Code Should Be    ${resp}    conflict

Invite To A Personal Workspace Answers 409 Personal Workspace
    [Tags]    negative
    ${owner}=    Register User Via API    inv
    ${personal}=    Personal Workspace Id    ${owner}
    ${resp}=    Invite Via API    ${owner}    ${personal}    ${{ 'p.' + $personal[:6] + '@robot.test' }}    viewer    409
    Error Code Should Be    ${resp}    personal_workspace
    ${n}=    Query Value    select count(*) from invitations where workspace_id = %s    ${personal}
    Should Be Equal As Integers    ${n}    0

Rejected Invite Writes No Invitation Row
    [Tags]    negative    db
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    Invite Via API    ${owner}    ${ws}    nobody.${ws}[:8]@robot.test    owner    400
    ${n}=    Query Value    select count(*) from invitations where workspace_id = %s    ${ws}
    Should Be Equal As Integers    ${n}    0

Second Invitation To The Same E-mail Replaces The First
    [Documentation]    API.md / create-invitation: the older pending link stops working.
    [Tags]    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${first}=    Invite Via API    ${owner}    ${ws}    ${guest}[email]    viewer    201
    ${second}=    Invite Via API    ${owner}    ${ws}    ${guest}[email]    admin    201
    ${old}=    Invitation Row By Id    ${first.json()}[invitation][id]
    Should Not Be Equal    ${old}[revoked_at]    ${None}
    ${pending}=    Api Call    ${owner}[alias]    GET    /workspaces/${ws}/invitations    200
    Length Should Be    ${pending.json()}    1
    ${stale}=    Accept Invitation    ${guest}    ${first.json()}[token]    410
    Error Code Should Be    ${stale}    invitation_invalid
    ${fresh}=    Accept Invitation    ${guest}    ${second.json()}[token]    200
    Should Be Equal    ${fresh.json()}[role]    admin

Two Invitations Get Two Different Tokens
    [Tags]    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${a}=    Create Invitation Token    ${owner}    ${ws}    ${{ 'a.' + $ws[:6] + '@robot.test' }}
    ${b}=    Create Invitation Token    ${owner}    ${ws}    ${{ 'b.' + $ws[:6] + '@robot.test' }}
    Should Not Be Equal    ${a}    ${b}

# ── list pending / revoke ──
Pending List Shows The Open Invitations Without Tokens
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${email}=    Unique Email    guest
    Create Invitation Token    ${owner}    ${ws}    ${email}    estimator
    ${resp}=    Api Call    ${owner}[alias]    GET    /workspaces/${ws}/invitations    200
    Length Should Be    ${resp.json()}    1
    Should Be Equal    ${resp.json()}[0][email]    ${email}
    Should Be Equal    ${resp.json()}[0][role]    estimator
    Should Not Contain    ${resp.text}    token

Pending List Is Empty For A New Workspace
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${resp}=    Api Call    ${owner}[alias]    GET    /workspaces/${ws}/invitations    200
    Length Should Be    ${resp.json()}    0

Pending List Drops Accepted And Revoked Invitations
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${accepted}=    Register User Via API    guest
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${accepted}[email]    viewer
    Accept Invitation    ${accepted}    ${token}    200
    ${revoked}=    Invite Via API    ${owner}    ${ws}    ${{ 'r.' + $ws[:6] + '@robot.test' }}    viewer    201
    Api Call    ${owner}[alias]    DELETE    /workspaces/${ws}/invitations/${revoked.json()}[invitation][id]    204
    ${open}=    Invite Via API    ${owner}    ${ws}    ${{ 'o.' + $ws[:6] + '@robot.test' }}    viewer    201
    ${resp}=    Api Call    ${owner}[alias]    GET    /workspaces/${ws}/invitations    200
    Length Should Be    ${resp.json()}    1
    Should Be Equal    ${resp.json()}[0][id]    ${open.json()}[invitation][id]

Pending List Drops An Expired Invitation
    [Tags]    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${{ 'e.' + $ws[:6] + '@robot.test' }}    viewer    201
    Query Rows    update invitations set expires_at = now() - interval '1 minute' where id = %s    ${resp.json()}[invitation][id]
    ${list}=    Api Call    ${owner}[alias]    GET    /workspaces/${ws}/invitations    200
    Length Should Be    ${list.json()}    0

Revoke Makes The Token Useless And Marks The Row
    [Tags]    smoke
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${guest}[email]    viewer    201
    Api Call    ${owner}[alias]    DELETE    /workspaces/${ws}/invitations/${resp.json()}[invitation][id]    204
    ${row}=    Invitation Row By Id    ${resp.json()}[invitation][id]
    Should Not Be Equal    ${row}[revoked_at]    ${None}
    ${accept}=    Accept Invitation    ${guest}    ${resp.json()}[token]    410
    Error Code Should Be    ${accept}    invitation_invalid
    Membership Row Should Not Exist    ${ws}    ${guest}[id]

Revoke Twice Answers 404 The Second Time
    [Tags]    negative    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${{ 'r.' + $ws[:6] + '@robot.test' }}    viewer    201
    Api Call    ${owner}[alias]    DELETE    /workspaces/${ws}/invitations/${resp.json()}[invitation][id]    204
    Api Error Should Be    ${owner}[alias]    DELETE    /workspaces/${ws}/invitations/${resp.json()}[invitation][id]    404    not_found

Revoke An Unknown Invitation Answers 404
    [Tags]    negative
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    Api Error Should Be    ${owner}[alias]    DELETE    /workspaces/${ws}/invitations/${ZERO UUID}    404    not_found

Revoke With A Malformed Id Answers 404
    [Tags]    negative    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    Api Error Should Be    ${owner}[alias]    DELETE    /workspaces/${ws}/invitations/abc    404    not_found

Revoke An Accepted Invitation Answers 404 And Keeps The Member
    [Tags]    negative    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${guest}[email]    viewer    201
    Accept Invitation    ${guest}    ${resp.json()}[token]    200
    Api Error Should Be    ${owner}[alias]    DELETE    /workspaces/${ws}/invitations/${resp.json()}[invitation][id]    404    not_found
    Membership Role Should Be    ${ws}    ${guest}[id]    viewer

# ── accept ──
Invited User Accepts And Becomes A Member With The Invited Role
    [Tags]    smoke
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${guest}[email]    estimator
    ${resp}=    Accept Invitation    ${guest}    ${token}    200
    Should Be Equal    ${resp.json()}[workspaceId]    ${ws}
    Should Be Equal    ${resp.json()}[role]    estimator
    Membership Role Should Be    ${ws}    ${guest}[id]    estimator
    ${count}=    Membership Count    ${ws}
    Should Be Equal As Integers    ${count}    2

Accept Marks The Invitation Row As Accepted By The User
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${guest}[email]    viewer    201
    Accept Invitation    ${guest}    ${resp.json()}[token]    200
    ${row}=    Invitation Row By Id    ${resp.json()}[invitation][id]
    Should Not Be Equal    ${row}[accepted_at]    ${None}
    Should Be Equal As Strings    ${row}[accepted_by]    ${guest}[id]

Accepted Workspace Appears In Me And In The List Of The New Member
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    Accept Invitation    ${guest}    ${{ None }}    400
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${guest}[email]    admin
    Accept Invitation    ${guest}    ${token}    200
    ${ids}=    Workspace Ids Listed For    ${guest}
    Should Contain    ${ids}    ${ws}
    ${me}=    Api Call    ${guest}[alias]    GET    /me    200
    ${mine}=    Evaluate    [w for w in $me.json()['workspaces'] if w['id'] == $ws]
    Should Be Equal    ${mine}[0][role]    admin

Accept Is Single Use
    [Tags]    security    negative
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${guest}[email]    viewer
    Accept Invitation    ${guest}    ${token}    200
    ${again}=    Accept Invitation    ${guest}    ${token}    410
    Error Code Should Be    ${again}    invitation_invalid

Replay After Leaving The Workspace Does Not Let The User Back In
    [Documentation]    The link is single use even after the member left: the token cannot be replayed.
    [Tags]    security    negative
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${guest}[email]    viewer
    Accept Invitation    ${guest}    ${token}    200
    Api Call    ${guest}[alias]    DELETE    /workspaces/${ws}/members/${guest}[id]    204
    ${replay}=    Accept Invitation    ${guest}    ${token}    410
    Error Code Should Be    ${replay}    invitation_invalid
    Membership Row Should Not Exist    ${ws}    ${guest}[id]

Accept By Another User Answers 410 And Leaves The Invitation Open
    [Documentation]    Only the invited e-mail may accept. The refusal is the same 410 as for an unknown token, the
    ...    workspace is not revealed, and the rightful user can still accept afterwards.
    [Tags]    security    negative
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${thief}=    Register User Via API    thief
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${guest}[email]    admin
    ${refused}=    Accept Invitation    ${thief}    ${token}    410
    Error Code Should Be    ${refused}    invitation_invalid
    Should Not Contain    ${refused.text}    ${ws}
    Membership Row Should Not Exist    ${ws}    ${thief}[id]
    ${late}=    Accept Invitation    ${guest}    ${token}    200
    Should Be Equal    ${late.json()}[role]    admin

Accept Matches The E-mail Without Regard To Letter Case
    [Tags]    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${shout}=    Convert To Upper Case    ${guest}[email]
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${shout}    viewer
    Accept Invitation    ${guest}    ${token}    200

Accept After The Expiry Answers 410
    [Tags]    negative    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${guest}[email]    viewer    201
    Query Rows    update invitations set expires_at = now() - interval '1 second' where id = %s    ${resp.json()}[invitation][id]
    ${late}=    Accept Invitation    ${guest}    ${resp.json()}[token]    410
    Error Code Should Be    ${late}    invitation_invalid
    Membership Row Should Not Exist    ${ws}    ${guest}[id]

Accept One Second Before The Expiry Still Works
    [Tags]    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${guest}[email]    viewer    201
    Query Rows    update invitations set expires_at = now() + interval '30 seconds' where id = %s    ${resp.json()}[invitation][id]
    Accept Invitation    ${guest}    ${resp.json()}[token]    200

Invitation Lifetime Is About Seven Days
    [Documentation]    INVITATION_TTL_DAYS defaults to 7 (env.ts); the e2e env does not override it.
    [Tags]    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${resp}=    Invite Via API    ${owner}    ${ws}    ${{ 't.' + $ws[:6] + '@robot.test' }}    viewer    201
    ${row}=    Invitation Row By Id    ${resp.json()}[invitation][id]
    ${days}=    Evaluate    ($row['expires_at'] - $row['created_at']).total_seconds() / 86400
    Should Be Equal As Numbers    ${days}    7    precision=2

Accept With An Unknown Token Answers 410
    [Tags]    negative
    ${guest}=    Register User Via API    guest
    ${resp}=    Accept Invitation    ${guest}    ${{ 'z' * 43 }}    410
    Error Code Should Be    ${resp}    invitation_invalid

Accept With A Token Changed By One Character Answers 410
    [Tags]    negative    security
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${guest}[email]    viewer
    ${tampered}=    Evaluate    $token[:-1] + ('A' if $token[-1] != 'A' else 'B')
    ${resp}=    Accept Invitation    ${guest}    ${tampered}    410
    Error Code Should Be    ${resp}    invitation_invalid
    Accept Invitation    ${guest}    ${token}    200

Accept With A Token Shorter Than 16 Characters Answers 400
    [Tags]    negative    edge
    ${guest}=    Register User Via API    guest
    ${resp}=    Accept Invitation    ${guest}    short-token    400
    Error Code Should Be    ${resp}    validation_failed

Accept With A Token Of Exactly 16 Characters Passes Validation
    [Tags]    edge
    ${guest}=    Register User Via API    guest
    ${resp}=    Accept Invitation    ${guest}    ${{ 'a' * 16 }}    410
    Error Code Should Be    ${resp}    invitation_invalid

Accept With A Token Longer Than 256 Characters Answers 400
    [Tags]    negative    edge
    ${guest}=    Register User Via API    guest
    ${resp}=    Accept Invitation    ${guest}    ${{ 'a' * 257 }}    400
    Error Code Should Be    ${resp}    validation_failed

Accept With A Missing Or Null Or Numeric Token Answers 400
    [Tags]    negative
    ${guest}=    Register User Via API    guest
    ${empty}=    Create Dictionary
    VAR    &{null_token}    token=${None}
    VAR    &{number}    token=${1234567890123456}
    Api Error Should Be    ${guest}[alias]    POST    /invitations/accept    400    validation_failed    ${empty}
    Api Error Should Be    ${guest}[alias]    POST    /invitations/accept    400    validation_failed    ${null_token}
    Api Error Should Be    ${guest}[alias]    POST    /invitations/accept    400    validation_failed    ${number}

Accept With An Injection Token Answers 410
    [Tags]    negative    security
    ${guest}=    Register User Via API    guest
    ${resp}=    Accept Invitation    ${guest}    ' OR '1'='1' OR token_hash LIKE '%    410
    Error Code Should Be    ${resp}    invitation_invalid

Accept Without Signing In Answers 401
    [Tags]    negative    security
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${{ 'n.' + $ws[:6] + '@robot.test' }}    viewer
    Create Anonymous Session    anon
    VAR    &{body}    token=${token}
    ${resp}=    POST On Session    anon    /invitations/accept    json=${body}    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

Accept By The Inviter Of Their Own Pending Invitation Is Refused
    [Documentation]    The owner's e-mail differs from the invited one, so the owner cannot use the link.
    [Tags]    negative    security
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${{ 'o.' + $ws[:6] + '@robot.test' }}    viewer
    ${resp}=    Accept Invitation    ${owner}    ${token}    410
    Error Code Should Be    ${resp}    invitation_invalid
    Membership Role Should Be    ${ws}    ${owner}[id]    owner

Rejoining After Removal Needs A New Invitation
    [Tags]    edge
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${guest}=    Register User Via API    guest
    ${token}=    Create Invitation Token    ${owner}    ${ws}    ${guest}[email]    viewer
    Accept Invitation    ${guest}    ${token}    200
    Api Call    ${owner}[alias]    DELETE    /workspaces/${ws}/members/${guest}[id]    204
    ${again}=    Create Invitation Token    ${owner}    ${ws}    ${guest}[email]    estimator
    ${resp}=    Accept Invitation    ${guest}    ${again}    200
    Should Be Equal    ${resp.json()}[role]    estimator
    Membership Role Should Be    ${ws}    ${guest}[id]    estimator

# ── members: list ──
Member List Shows Every Member With Role And Joined Date
    ${team}=    Create Team Workspace
    ${members}=    Members Of Workspace    ${team}[owner]    ${team}[ws]
    Length Should Be    ${members}    4
    ${roles}=    Evaluate    sorted(m['role'] for m in $members)
    Should Be Equal    ${roles}[0]    admin
    Should Be Equal    ${roles}[1]    estimator
    Should Be Equal    ${roles}[2]    owner
    Should Be Equal    ${roles}[3]    viewer
    FOR    ${m}    IN    @{members}
        Should Not Be Empty    ${m}[email]
        Should Not Be Empty    ${m}[displayName]
        Should Match Regexp    ${m}[joinedAt]    ^\\d{4}-\\d{2}-\\d{2}T
        Should Not Contain    ${m}    passwordHash
        Should Not Contain    ${m}    password
    END

Member List Matches The Database
    ${team}=    Create Team Workspace
    ${members}=    Members Of Workspace    ${team}[viewer]    ${team}[ws]
    ${rows}=    Query Rows    select user_id, role from memberships where workspace_id = %s    ${team}[ws]
    ${api}=    Evaluate    sorted((m['userId'], m['role']) for m in $members)
    ${db}=    Evaluate    sorted((str(r['user_id']), r['role']) for r in $rows)
    Should Be Equal    ${api}    ${db}

Role Of A Member Is Visible To Every Other Member
    ${team}=    Create Team Workspace
    ${role}=    Role Of Member    ${team}[estimator]    ${team}[ws]    ${team}[admin]
    Should Be Equal    ${role}    admin

# ── members: change role ──
Owner Changes An Estimator To Viewer And The Row Follows
    [Tags]    smoke
    ${team}=    Create Team Workspace
    VAR    &{body}    role=viewer
    ${resp}=    Api Call    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[estimator][id]    200    ${body}
    Should Be Equal    ${resp.json()}[role]    viewer
    Should Be Equal    ${resp.json()}[userId]    ${team}[estimator][id]
    Membership Role Should Be    ${team}[ws]    ${team}[estimator][id]    viewer

Role Change Takes Effect Immediately For Permissions
    [Documentation]    A demoted estimator cannot create a project on the very next call; a promoted viewer can invite.
    [Tags]    security
    ${team}=    Create Team Workspace
    Create Project Via API    ${team}[estimator]    ${team}[ws]
    VAR    &{to_viewer}    role=viewer
    Api Call    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[estimator][id]    200    ${to_viewer}
    VAR    &{project}    name=หลังถูกลดสิทธิ์    start=blank
    Api Error Should Be    ${team}[estimator][alias]    POST    /workspaces/${team}[ws]/projects    403    forbidden    ${project}
    VAR    &{to_admin}    role=admin
    Api Call    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[viewer][id]    200    ${to_admin}
    Invite Via API    ${team}[viewer]    ${team}[ws]    ${{ 'p.' + $team['ws'][:6] + '@robot.test' }}    viewer    201

Changing To The Same Role Is Accepted
    [Tags]    edge
    ${team}=    Create Team Workspace
    VAR    &{body}    role=estimator
    Api Call    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[estimator][id]    200    ${body}
    Membership Role Should Be    ${team}[ws]    ${team}[estimator][id]    estimator

Owner Makes A Second Owner Then Can Step Down
    ${team}=    Create Team Workspace
    VAR    &{to_owner}    role=owner
    VAR    &{to_admin}    role=admin
    Api Call    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[admin][id]    200    ${to_owner}
    ${owners}=    Owner Count In Database    ${team}[ws]
    Should Be Equal As Integers    ${owners}    2
    Api Call    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[owner][id]    200    ${to_admin}
    ${owners}=    Owner Count In Database    ${team}[ws]
    Should Be Equal As Integers    ${owners}    1
    Membership Role Should Be    ${team}[ws]    ${team}[owner][id]    admin

Sole Owner Cannot Demote Themselves
    [Tags]    negative    security
    ${team}=    Create Team Workspace
    VAR    &{body}    role=admin
    Api Error Should Be    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[owner][id]    409    last_owner    ${body}
    Membership Role Should Be    ${team}[ws]    ${team}[owner][id]    owner

Two Owners Cannot Both End Up Demoted
    [Tags]    negative    security
    ${team}=    Create Team Workspace
    VAR    &{to_owner}    role=owner
    VAR    &{to_viewer}    role=viewer
    Api Call    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[admin][id]    200    ${to_owner}
    Api Call    ${team}[admin][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[owner][id]    200    ${to_viewer}
    Api Error Should Be    ${team}[admin][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[admin][id]    409    last_owner    ${to_viewer}
    ${owners}=    Owner Count In Database    ${team}[ws]
    Should Be Equal As Integers    ${owners}    1

Change Role Rejects An Unknown Role Value
    [Tags]    negative
    ${team}=    Create Team Workspace
    FOR    ${bad}    IN    superuser    OWNER    ${EMPTY}    ${None}    ${7}
        VAR    &{body}    role=${bad}
        Api Error Should Be    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[viewer][id]    400    validation_failed    ${body}
    END
    Membership Role Should Be    ${team}[ws]    ${team}[viewer][id]    viewer

Change Role Rejects A Missing Role
    [Tags]    negative
    ${team}=    Create Team Workspace
    ${empty}=    Create Dictionary
    Api Error Should Be    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[viewer][id]    400    validation_failed    ${empty}

Change Role Of A Non Member Answers 404
    [Tags]    negative
    ${team}=    Create Team Workspace
    VAR    &{body}    role=viewer
    Api Error Should Be    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[outsider][id]    404    not_found    ${body}
    Api Error Should Be    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${ZERO UUID}    404    not_found    ${body}

Change Role With A Malformed User Id Answers 404
    [Tags]    negative    edge
    ${team}=    Create Team Workspace
    VAR    &{body}    role=viewer
    Api Error Should Be    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/not-a-uuid    404    not_found    ${body}

Change Role In A Personal Workspace Answers 409 Personal Workspace
    [Tags]    negative
    ${owner}=    Register User Via API    solo
    ${personal}=    Personal Workspace Id    ${owner}
    VAR    &{body}    role=viewer
    Api Error Should Be    ${owner}[alias]    PATCH    /workspaces/${personal}/members/${owner}[id]    409    personal_workspace    ${body}
    Membership Role Should Be    ${personal}    ${owner}[id]    owner

Rejected Role Change Keeps The Old Role
    [Tags]    negative    db
    ${team}=    Create Team Workspace
    VAR    &{to_owner}    role=owner
    Api Error Should Be    ${team}[admin][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[estimator][id]    403    forbidden    ${to_owner}
    Membership Role Should Be    ${team}[ws]    ${team}[estimator][id]    estimator

# ── members: remove and leave ──
Owner Removes A Viewer And The Viewer Loses The Workspace
    [Tags]    smoke
    ${team}=    Create Team Workspace
    Api Call    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[viewer][id]    204
    Membership Row Should Not Exist    ${team}[ws]    ${team}[viewer][id]
    Api Error Should Be    ${team}[viewer][alias]    GET    /workspaces/${team}[ws]    404    not_found
    ${ids}=    Workspace Ids Listed For    ${team}[viewer]
    Should Not Contain    ${ids}    ${team}[ws]
    ${members}=    Members Of Workspace    ${team}[owner]    ${team}[ws]
    Length Should Be    ${members}    3

Removed Member Keeps Their User Account
    ${team}=    Create Team Workspace
    Api Call    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[estimator][id]    204
    ${row}=    User Row By Email    ${team}[estimator][email]
    Should Be Equal As Strings    ${row}[id]    ${team}[estimator][id]
    Api Call    ${team}[estimator][alias]    GET    /me    200

Removed Member Cannot Use The Workspace Any More
    [Tags]    security
    ${team}=    Create Team Workspace
    Api Call    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[estimator][id]    204
    Api Error Should Be    ${team}[estimator][alias]    GET    /workspaces/${team}[ws]/projects    404    not_found
    VAR    &{project}    name=หลังถูกลบ    start=blank
    Api Error Should Be    ${team}[estimator][alias]    POST    /workspaces/${team}[ws]/projects    404    not_found    ${project}
    Api Error Should Be    ${team}[estimator][alias]    GET    /workspaces/${team}[ws]/members    404    not_found

Admin Removes An Estimator
    ${team}=    Create Team Workspace
    Api Call    ${team}[admin][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[estimator][id]    204
    Membership Row Should Not Exist    ${team}[ws]    ${team}[estimator][id]

Remove A Non Member Answers 404
    [Tags]    negative
    ${team}=    Create Team Workspace
    Api Error Should Be    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[outsider][id]    404    not_found
    Api Error Should Be    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/${ZERO UUID}    404    not_found

Remove With A Malformed User Id Answers 404
    [Tags]    negative    edge
    ${team}=    Create Team Workspace
    Api Error Should Be    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/1    404    not_found

Remove Twice Answers 404 The Second Time
    [Tags]    negative    edge
    ${team}=    Create Team Workspace
    Api Call    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[viewer][id]    204
    Api Error Should Be    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[viewer][id]    404    not_found

Viewer Leaves The Workspace
    ${team}=    Create Team Workspace
    Api Call    ${team}[viewer][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[viewer][id]    204
    Membership Row Should Not Exist    ${team}[ws]    ${team}[viewer][id]
    ${count}=    Membership Count    ${team}[ws]
    Should Be Equal As Integers    ${count}    3

Estimator Leaves The Workspace
    ${team}=    Create Team Workspace
    Api Call    ${team}[estimator][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[estimator][id]    204
    Membership Row Should Not Exist    ${team}[ws]    ${team}[estimator][id]

Sole Owner Cannot Leave
    [Tags]    negative    security
    ${team}=    Create Team Workspace
    Api Error Should Be    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[owner][id]    409    last_owner
    Membership Role Should Be    ${team}[ws]    ${team}[owner][id]    owner

Owner Can Leave When Another Owner Remains And The Last One Cannot
    [Tags]    security
    ${team}=    Create Team Workspace
    VAR    &{to_owner}    role=owner
    Api Call    ${team}[owner][alias]    PATCH    /workspaces/${team}[ws]/members/${team}[admin][id]    200    ${to_owner}
    Api Call    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[owner][id]    204
    Api Error Should Be    ${team}[admin][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[admin][id]    409    last_owner
    ${owners}=    Owner Count In Database    ${team}[ws]
    Should Be Equal As Integers    ${owners}    1

Leaving A Personal Workspace Answers 409 Personal Workspace
    [Tags]    negative
    ${owner}=    Register User Via API    solo
    ${personal}=    Personal Workspace Id    ${owner}
    Api Error Should Be    ${owner}[alias]    DELETE    /workspaces/${personal}/members/${owner}[id]    409    personal_workspace
    Membership Role Should Be    ${personal}    ${owner}[id]    owner

Member Count Follows Joins And Leaves
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${a}=    Add Member With Role    ${owner}    ${ws}    viewer
    ${b}=    Add Member With Role    ${owner}    ${ws}    estimator
    ${resp}=    Api Call    ${owner}[alias]    GET    /workspaces/${ws}    200
    Should Be Equal As Integers    ${resp.json()}[memberCount]    3
    Api Call    ${a}[alias]    DELETE    /workspaces/${ws}/members/${a}[id]    204
    ${resp}=    Api Call    ${owner}[alias]    GET    /workspaces/${ws}    200
    Should Be Equal As Integers    ${resp.json()}[memberCount]    2

Removing A Member Removes Their Level Assignments
    [Documentation]    remove-member.use-case: the user's assignments in the workspace are cleared in the same transaction.
    [Tags]    edge
    ${team}=    Create Team Workspace
    ${project}=    Create Project Via API    ${team}[owner]    ${team}[ws]
    VAR    &{assign}    userId=${team}[estimator][id]
    Api Call    ${team}[owner][alias]    PUT    /projects/${project}[project][id]/assignments/land-inspection    200    ${assign}
    ${before}=    Query Value    select count(*) from level_assignments where project_id = %s    ${project}[project][id]
    Should Be Equal As Integers    ${before}    1
    Api Call    ${team}[owner][alias]    DELETE    /workspaces/${team}[ws]/members/${team}[estimator][id]    204
    ${after}=    Query Value    select count(*) from level_assignments where project_id = %s    ${project}[project][id]
    Should Be Equal As Integers    ${after}    0


*** Keywords ***
Invite With E-mail Should Be Rejected
    [Documentation]    ``POST invitations`` with an invalid e-mail: 400 ``validation_failed`` and no row.
    [Arguments]    ${email}
    ${owner}=    Register User Via API    inv
    ${ws}=    Create Company Workspace Via API    ${owner}
    VAR    &{body}    email=${email}    role=viewer
    ${resp}=    Api Call    ${owner}[alias]    POST    /workspaces/${ws}/invitations    400    ${body}
    Error Code Should Be    ${resp}    validation_failed
    ${n}=    Query Value    select count(*) from invitations where workspace_id = %s    ${ws}
    Should Be Equal As Integers    ${n}    0
