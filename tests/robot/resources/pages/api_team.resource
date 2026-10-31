*** Settings ***
Documentation       Keywords of area A1 (identity, workspaces, team): raw HTTP calls with an explicit expected status,
...                 hand-made JWTs, refresh-cookie handling, invitation flow, ready-made teams (owner, admin,
...                 estimator, viewer, outsider) and database read-backs.
Library             Collections
Library             String
Resource            ../api.resource
Resource            ../db.resource


*** Variables ***
${JWT SECRET}               robot-e2e-local-secret-robot-e2e-local-secret
${ZERO UUID}                00000000-0000-4000-8000-000000000000
${WRONG PASSWORD}           Wrong#Passw0rd-2026
${CREDENTIALS MESSAGE}      Invalid e-mail or password


*** Keywords ***
Add Member With Role
    [Documentation]    Register a new user, invite them with ``${role}`` (``owner`` = invited as admin, then promoted by the
    ...    inviter, who must be an owner), accept, and return the new ``&{user}``.
    [Arguments]    ${inviter}    ${workspace_id}    ${role}
    ${user}=    Register User Via API    member
    ${invite_role}=    Set Variable If    '${role}' == 'owner'    admin    ${role}
    ${resp}=    Invite Via API    ${inviter}    ${workspace_id}    ${user}[email]    ${invite_role}    201
    ${accepted}=    Accept Invitation    ${user}    ${resp.json()}[token]    200
    IF    '${role}' == 'owner'
        VAR    &{body}    role=owner
        Api Call    ${inviter}[alias]    PATCH    /workspaces/${workspace_id}/members/${user}[id]    200    ${body}
    END
    RETURN    ${user}

Accept Invitation
    [Arguments]    ${user}    ${token}    ${expected}=200
    VAR    &{body}    token=${token}
    ${resp}=    Api Call    ${user}[alias]    POST    /invitations/accept    ${expected}    ${body}
    RETURN    ${resp}

Api Call
    [Documentation]    One HTTP call on a session ``${alias}`` (``GET``, ``POST``, ``PATCH``, ``PUT``, ``DELETE``) that must
    ...    answer ``${expected}``. Returns the response.
    [Arguments]    ${alias}    ${method}    ${path}    ${expected}    ${body}=${None}
    ${resp}=    Run Keyword    ${method} On Session    ${alias}    ${path}    json=${body}    expected_status=${expected}
    RETURN    ${resp}

Api Error Should Be
    [Documentation]    The call must answer ``${status}`` with the stable error ``${code}``.
    [Arguments]    ${alias}    ${method}    ${path}    ${status}    ${code}    ${body}=${None}
    ${resp}=    Api Call    ${alias}    ${method}    ${path}    ${status}    ${body}
    Error Code Should Be    ${resp}    ${code}
    RETURN    ${resp}

Auth Response Should Be Valid
    [Documentation]    ``AuthResponse``: access token, 900 s lifetime, the user without any password field.
    [Arguments]    ${json}    ${email}
    Should Not Be Empty    ${json}[accessToken]
    Should Be True    ${json}[expiresIn] > 0
    Should Be Equal    ${json}[user][email]    ${email}
    Should Not Contain    ${json}    password
    Should Not Contain    ${{ str($json) }}    passwordHash
    Should Not Contain    ${{ str($json) }}    password_hash

Create Invitation Token
    [Documentation]    Invite ``${email}`` as ``${role}`` (must succeed) and return the raw token.
    [Arguments]    ${inviter}    ${workspace_id}    ${email}    ${role}=viewer
    ${resp}=    Invite Via API    ${inviter}    ${workspace_id}    ${email}    ${role}    201
    RETURN    ${resp.json()}[token]

Create Team Workspace
    [Documentation]    A company workspace with one member per role plus an outsider (a user of another tenant).
    ...    Returns ``&{team}``: ``ws``, ``owner``, ``admin``, ``estimator``, ``viewer``, ``outsider`` (each a ``&{user}``).
    ${owner}=    Register User Via API    owner
    ${ws}=    Create Company Workspace Via API    ${owner}
    ${admin}=    Add Member With Role    ${owner}    ${ws}    admin
    ${estimator}=    Add Member With Role    ${owner}    ${ws}    estimator
    ${viewer}=    Add Member With Role    ${owner}    ${ws}    viewer
    ${outsider}=    Register User Via API    outsider
    VAR    &{team}    ws=${ws}    owner=${owner}    admin=${admin}    estimator=${estimator}    viewer=${viewer}
    ...    outsider=${outsider}
    RETURN    ${team}

Invite Via API
    [Arguments]    ${inviter}    ${workspace_id}    ${email}    ${role}    ${expected}=201
    VAR    &{body}    email=${email}    role=${role}
    ${resp}=    Api Call    ${inviter}[alias]    POST    /workspaces/${workspace_id}/invitations    ${expected}    ${body}
    RETURN    ${resp}

Invitation Row By Id
    [Arguments]    ${invitation_id}
    ${row}=    Query Row    select * from invitations where id = %s    ${invitation_id}
    RETURN    ${row}

Make Signed Jwt
    [Documentation]    A hand-made access token. ``${offset}`` seconds from now it expires (negative = already expired).
    ...    ``alg=none`` builds an unsigned token; another ``${secret}`` / ``${audience}`` / ``${issuer}`` builds a forged one.
    [Arguments]    ${user_id}    ${offset}=900    ${secret}=${JWT SECRET}    ${audience}=contrack-web
    ...    ${issuer}=contrack-api    ${alg}=HS256
    ${header}=    Evaluate    base64.urlsafe_b64encode(json.dumps({'alg': $alg, 'typ': 'JWT'}).encode()).rstrip(b'=').decode()
    ...    modules=base64,json
    ${now}=    Evaluate    int(time.time())    modules=time
    ${exp}=    Evaluate    $now + int($offset)
    ${iat}=    Evaluate    $exp - 900
    ${payload}=    Evaluate
    ...    base64.urlsafe_b64encode(json.dumps({'sub': $user_id, 'iat': $iat, 'exp': $exp, 'aud': $audience, 'iss': $issuer}).encode()).rstrip(b'=').decode()
    ...    modules=base64,json
    ${signature}=    Evaluate
    ...    base64.urlsafe_b64encode(hmac.new($secret.encode(), ($header + '.' + $payload).encode(), hashlib.sha256).digest()).rstrip(b'=').decode() if $alg == 'HS256' else ''
    ...    modules=base64,hmac,hashlib
    RETURN    ${header}.${payload}.${signature}

Members Of Workspace
    [Arguments]    ${user}    ${workspace_id}
    ${resp}=    Api Call    ${user}[alias]    GET    /workspaces/${workspace_id}/members    200
    RETURN    ${resp.json()}

Membership Count
    [Arguments]    ${workspace_id}
    ${n}=    Query Value    select count(*) from memberships where workspace_id = %s    ${workspace_id}
    RETURN    ${n}

Membership Row Should Not Exist
    [Arguments]    ${workspace_id}    ${user_id}
    ${n}=    Query Value    select count(*) from memberships where workspace_id = %s and user_id = %s
    ...    ${workspace_id}    ${user_id}
    Should Be Equal As Integers    ${n}    0

Owner Count In Database
    [Arguments]    ${workspace_id}
    ${n}=    Query Value    select count(*) from memberships where workspace_id = %s and role = 'owner'    ${workspace_id}
    RETURN    ${n}

Post Raw Json
    [Documentation]    POST an exact text body (malformed JSON, wrong types) with a JSON content type.
    [Arguments]    ${alias}    ${path}    ${raw}    ${expected}
    ${bytes}=    Evaluate    $raw.encode('utf-8')
    ${headers}=    Create Dictionary    Content-Type=application/json
    ${resp}=    POST On Session    ${alias}    ${path}    data=${bytes}    headers=${headers}    expected_status=${expected}
    RETURN    ${resp}

Refresh With Cookie
    [Documentation]    ``POST /auth/refresh`` carrying the raw refresh token in the ``contrack_rt`` cookie header.
    [Arguments]    ${token}    ${expected}=200
    Create Anonymous Session    cookie-client
    ${headers}=    Create Dictionary    Cookie=contrack_rt=${token}
    ${resp}=    POST On Session    cookie-client    /auth/refresh    headers=${headers}    expected_status=${expected}
    RETURN    ${resp}

Refresh Token Of
    [Documentation]    The raw ``contrack_rt`` value from the ``Set-Cookie`` header of an auth response ('' when cleared).
    [Arguments]    ${resp}
    ${value}=    Evaluate    (re.search(r'contrack_rt=([^;]*)', $resp.headers.get('set-cookie', '')) or [None, None])[1]
    ...    modules=re
    Should Not Be Equal    ${value}    ${None}    msg=No contrack_rt cookie in the response
    RETURN    ${value}

Refresh Token Rows
    [Documentation]    All ``refresh_tokens`` rows of a user.
    [Arguments]    ${user_id}
    ${rows}=    Query Rows    select * from refresh_tokens where user_id = %s order by created_at    ${user_id}
    RETURN    ${rows}

Register Raw
    [Documentation]    ``POST /auth/register`` with a dict body and no token. Returns the response.
    [Arguments]    ${body}    ${expected}
    Create Anonymous Session    anon
    ${resp}=    POST On Session    anon    /auth/register    json=${body}    expected_status=${expected}
    RETURN    ${resp}

Register Body
    [Documentation]    A valid register body with a fresh e-mail; override fields with ``name=value``.
    [Arguments]    &{override}
    ${email}=    Unique Email    reg
    VAR    &{body}    email=${email}    password=${TEST_PASSWORD}    displayName=ผู้ทดสอบ
    Set To Dictionary    ${body}    &{override}
    RETURN    ${body}

Role Of Member
    [Documentation]    Role of ``${member}`` as the API lists it for ``${viewer}`` ('' when not a member).
    [Arguments]    ${viewer}    ${workspace_id}    ${member}
    ${members}=    Members Of Workspace    ${viewer}    ${workspace_id}
    FOR    ${m}    IN    @{members}
        IF    '${m}[userId]' == '${member}[id]'    RETURN    ${m}[role]
    END
    RETURN    ${EMPTY}

Workspace Ids Listed For
    [Documentation]    The ids ``GET /workspaces`` shows to ``${user}``.
    [Arguments]    ${user}
    ${resp}=    Api Call    ${user}[alias]    GET    /workspaces    200
    ${ids}=    Evaluate    [w['id'] for w in $resp.json()]
    RETURN    ${ids}
