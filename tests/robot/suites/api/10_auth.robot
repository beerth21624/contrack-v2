*** Settings ***
Documentation       A1 identity: register, login, refresh (rotation, reuse), logout and ``/me`` over HTTP, with the
...                 ``users``, ``refresh_tokens``, ``workspaces`` and ``memberships`` rows read back from PostgreSQL.
...                 Rules come from ``backend/API.md`` (identity) and ``src/shared/contract/auth.ts``:
...                 e-mail trimmed + lower-cased (max 254), password 8..128, displayName trimmed 1..80,
...                 refresh grace window 30 s, 401 ``invalid_credentials`` / ``invalid_token`` / ``unauthenticated``.
Resource            ../../resources/api.resource
Resource            ../../resources/db.resource
Resource            ../../resources/pages/api_team.resource
Suite Setup         Create Anonymous Session    anon
Test Tags           api    auth    db


*** Test Cases ***
# ── register: happy path and stored data ──
Register Creates A User And Answers 201 With A Token
    [Documentation]    Equivalence class: valid e-mail, 8+ character password, Thai display name.
    [Tags]    smoke
    ${body}=    Register Body    displayName=สมชาย ใจดี
    ${resp}=    Register Raw    ${body}    201
    Auth Response Should Be Valid    ${resp.json()}    ${body}[email]
    Should Be Equal    ${resp.json()}[user][displayName]    สมชาย ใจดี
    Should Match Regexp    ${resp.json()}[user][id]    ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$

Register Stores The Password Hashed And Never In Plain Text
    ${body}=    Register Body
    ${resp}=    Register Raw    ${body}    201
    ${row}=    User Row By Email    ${body}[email]
    Should Be Equal As Strings    ${row}[id]    ${resp.json()}[user][id]
    Should Not Be Equal    ${row}[password_hash]    ${body}[password]
    Should Not Contain    ${row}[password_hash]    ${body}[password]
    Should Be True    len($row['password_hash']) >= 40

Register Hashes The Same Password Differently For Two Users
    [Documentation]    Salted hashes: equal passwords must not give equal hashes.
    ${first}=    Register Body
    ${second}=    Register Body
    Register Raw    ${first}    201
    Register Raw    ${second}    201
    ${hash1}=    Query Value    select password_hash from users where email = %s    ${first}[email]
    ${hash2}=    Query Value    select password_hash from users where email = %s    ${second}[email]
    Should Not Be Equal    ${hash1}    ${hash2}

Register Creates A Personal Workspace With The User As Only Owner
    ${body}=    Register Body    displayName=คุณเอ
    ${resp}=    Register Raw    ${body}    201
    ${user_id}=    Set Variable    ${resp.json()}[user][id]
    ${rows}=    Query Rows
    ...    select w.id, w.kind, w.name, m.role from memberships m join workspaces w on w.id = m.workspace_id where m.user_id = %s
    ...    ${user_id}
    Length Should Be    ${rows}    1
    Should Be Equal    ${rows}[0][kind]    personal
    Should Be Equal    ${rows}[0][role]    owner
    Should Be Equal    ${rows}[0][name]    คุณเอ (ส่วนตัว)
    ${members}=    Membership Count    ${rows}[0][id]
    Should Be Equal As Integers    ${members}    1

Register Sets An HttpOnly Refresh Cookie Scoped To The Auth Path
    ${body}=    Register Body
    ${resp}=    Register Raw    ${body}    201
    ${cookie}=    Set Variable    ${resp.headers}[set-cookie]
    Should Contain    ${cookie}    contrack_rt=
    Should Contain    ${cookie}    HttpOnly
    Should Contain    ${cookie}    SameSite=Lax
    Should Contain    ${cookie}    Path=/api/auth
    Should Not Contain    ${resp.text}    contrack_rt

Register Stores A Hash Of The Refresh Token Not The Token
    ${body}=    Register Body
    ${resp}=    Register Raw    ${body}    201
    ${token}=    Refresh Token Of    ${resp}
    ${rows}=    Refresh Token Rows    ${resp.json()}[user][id]
    Length Should Be    ${rows}    1
    Should Not Be Equal    ${rows}[0][token_hash]    ${token}
    Should Be Equal    ${rows}[0][revoked_at]    ${None}
    Should Be True    $rows[0]['expires_at'] > $rows[0]['created_at']

Registered User Can Call Me Immediately With The Returned Token
    ${user}=    Register User Via API    reg
    ${resp}=    Api Call    ${user}[alias]    GET    /me    200
    Should Be Equal    ${resp.json()}[user][id]    ${user}[id]
    Length Should Be    ${resp.json()}[workspaces]    1
    Should Be Equal    ${resp.json()}[workspaces][0][role]    owner
    Should Be Equal    ${resp.json()}[workspaces][0][kind]    personal

# ── register: normalisation ──
Register Lower Cases And Trims The E-mail
    [Tags]    edge
    ${local}=    Unique Suffix
    VAR    &{body}    email=${SPACE}${SPACE}${local.upper()}@Robot.TEST${SPACE}    password=${TEST_PASSWORD}    displayName=x
    ${resp}=    Register Raw    ${body}    201
    Should Be Equal    ${resp.json()}[user][email]    ${local}@robot.test
    ${row}=    User Row By Email    ${local}@robot.test
    Should Be Equal    ${row}[email]    ${local}@robot.test

Register Trims The Display Name
    [Tags]    edge
    ${body}=    Register Body    displayName=${SPACE}${SPACE}สมหญิง${SPACE}${SPACE}
    ${resp}=    Register Raw    ${body}    201
    Should Be Equal    ${resp.json()}[user][displayName]    สมหญิง

Register Accepts A Thai And Emoji Display Name
    [Tags]    edge
    ${body}=    Register Body    displayName=ช่างก่อสร้าง 🏗️👷
    ${resp}=    Register Raw    ${body}    201
    Should Be Equal    ${resp.json()}[user][displayName]    ช่างก่อสร้าง 🏗️👷
    ${row}=    User Row By Email    ${body}[email]
    Should Be Equal    ${row}[display_name]    ช่างก่อสร้าง 🏗️👷

Register Accepts A Display Name Of Exactly 80 Characters
    [Tags]    edge
    ${name}=    Evaluate    'ก' * 80
    ${body}=    Register Body    displayName=${name}
    ${resp}=    Register Raw    ${body}    201
    Should Be Equal    ${resp.json()}[user][displayName]    ${name}

Register Accepts A One Character Display Name
    [Tags]    edge
    ${body}=    Register Body    displayName=ก
    Register Raw    ${body}    201

Register Accepts A Password Of Exactly 8 And Of Exactly 128 Characters
    [Tags]    edge
    ${short}=    Register Body    password=Abcd#123
    ${long}=    Register Body    password=${{ 'a' * 128 }}
    Register Raw    ${short}    201
    Register Raw    ${long}    201
    Login Should Succeed    ${long}[email]    ${long}[password]

Register Accepts A Thai And Symbol Password
    [Tags]    edge
    ${body}=    Register Body    password=รหัสลับ#2026🔑
    Register Raw    ${body}    201
    Login Should Succeed    ${body}[email]    ${body}[password]

Register Ignores Unknown Fields Such As A Chosen Id Or Role
    [Documentation]    Mass assignment: the client cannot choose the user id nor claim a role.
    [Tags]    security    edge
    ${body}=    Register Body    id=${ZERO UUID}    role=owner    isAdmin=${True}
    ${resp}=    Register Raw    ${body}    201
    Should Not Be Equal    ${resp.json()}[user][id]    ${ZERO UUID}
    ${count}=    Query Value    select count(*) from users where id = %s    ${ZERO UUID}
    Should Be Equal As Integers    ${count}    0

Register Stores Injection Text Literally And Keeps The Table
    [Documentation]    Error guessing: SQL text in the display name is data, not code.
    [Tags]    security    negative
    ${body}=    Register Body    displayName='); drop table users;--
    Register Raw    ${body}    201
    ${row}=    User Row By Email    ${body}[email]
    Should Be Equal    ${row}[display_name]    '); drop table users;--
    ${n}=    Query Value    select count(*) from information_schema.tables where table_name = 'users'
    Should Be Equal As Integers    ${n}    1

Register Does Not Break On A Null Character In The Display Name
    [Documentation]    Error guessing: PostgreSQL text cannot hold U+0000; the API must answer a 4xx or accept it,
    ...    never 500. ``expected_status=any`` on purpose: the contract is only "no server error".
    ...    Did: POST /auth/register with displayName "ab" + NUL + "cd". Expected: 400 (or 201), no server error.
    ...    Found: 500 internal (the NUL reaches PostgreSQL and the insert fails).
    [Tags]    negative    edge    bug
    ${body}=    Register Body    displayName=ab\u0000cd
    Create Anonymous Session    anon
    ${resp}=    POST On Session    anon    /auth/register    json=${body}    expected_status=any
    Should Be True    ${resp.status_code} < 500    msg=Server error ${resp.status_code}: ${resp.text}

# ── register: duplicates ──
Register With A Taken E-mail Answers 409 Email Taken
    [Tags]    negative
    ${user}=    Register User Via API    dup
    ${body}=    Register Body    email=${user}[email]
    ${resp}=    Register Raw    ${body}    409
    Error Code Should Be    ${resp}    email_taken

Register Treats The E-mail As Case Insensitive And Trimmed For Duplicates
    [Tags]    negative    edge
    ${user}=    Register User Via API    dup
    ${shout}=    Convert To Upper Case    ${user}[email]
    ${upper}=    Set Variable    ${SPACE}${SPACE}${shout}${SPACE}
    ${body}=    Register Body    email=${upper}
    ${resp}=    Register Raw    ${body}    409
    Error Code Should Be    ${resp}    email_taken
    ${n}=    Query Value    select count(*) from users where email = %s    ${user}[email]
    Should Be Equal As Integers    ${n}    1

Register With A Taken E-mail Creates No Second Workspace
    [Tags]    negative    db
    ${user}=    Register User Via API    dup
    ${before}=    Query Value    select count(*) from workspaces
    ${body}=    Register Body    email=${user}[email]    displayName=ผู้ซ้ำ
    Register Raw    ${body}    409
    ${after}=    Query Value    select count(*) from workspaces
    Should Be True    ${after} >= ${before}
    ${rows}=    Query Rows    select * from memberships where user_id = %s    ${user}[id]
    Length Should Be    ${rows}    1

Register With A Taken E-mail Does Not Change The Original Password
    [Tags]    negative    security
    ${user}=    Register User Via API    dup
    ${body}=    Register Body    email=${user}[email]    password=Hijack#Pass99
    Register Raw    ${body}    409
    Login Should Succeed    ${user}[email]    ${user}[password]
    Login Should Be Refused    ${user}[email]    Hijack#Pass99

Two Users Can Share A Display Name
    ${first}=    Register User Via API    same    display_name=ชื่อซ้ำ
    ${second}=    Register User Via API    same    display_name=ชื่อซ้ำ
    Should Not Be Equal    ${first}[id]    ${second}[id]

# ── register: invalid input (equivalence classes and boundaries) ──
Register Rejects An E-mail Without An At Sign
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    email    plainaddress

Register Rejects An E-mail Without A Domain
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    email    someone@

Register Rejects An E-mail Without A Local Part
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    email    @robot.test

Register Rejects An E-mail With A Space Inside
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    email    some one@robot.test

Register Rejects A Blank E-mail
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    email    ${EMPTY}

Register Rejects An E-mail Of Only Spaces
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    email    ${{ ' ' * 5 }}

Register Rejects An E-mail Longer Than 254 Characters
    [Tags]    negative    edge
    ${long}=    Evaluate    'a' * 250 + '@robot.test'
    Register Field Should Be Rejected    email    ${long}

Register Rejects A Numeric E-mail
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    email    ${12345}

Register Rejects A Null E-mail
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    email    ${None}

Register Rejects An Injection String As E-mail
    [Tags]    negative    security
    [Template]    Register Field Should Be Rejected
    email    ' or 1=1 --

Register Rejects A Reserved Phone Placeholder E-mail
    [Documentation]    ``*@phone.contrack.invalid`` is reserved for phone-only users (register-user.use-case.ts).
    [Tags]    negative    security
    [Template]    Register Field Should Be Rejected
    email    66812345678@phone.contrack.invalid

Register Rejects A Password Of 7 Characters
    [Tags]    negative    edge
    [Template]    Register Field Should Be Rejected
    password    Abc#123

Register Rejects An Empty Password
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    password    ${EMPTY}

Register Rejects A Password Of 129 Characters
    [Tags]    negative    edge
    ${long}=    Evaluate    'a' * 129
    Register Field Should Be Rejected    password    ${long}

Register Rejects A Null Password
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    password    ${None}

Register Rejects A Numeric Password
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    password    ${12345678}

Register Rejects A Missing Display Name
    [Tags]    negative
    ${body}=    Register Body
    Remove From Dictionary    ${body}    displayName
    ${resp}=    Register Raw    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Register Rejects A Missing Password
    [Tags]    negative
    ${body}=    Register Body
    Remove From Dictionary    ${body}    password
    ${resp}=    Register Raw    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Register Rejects A Missing E-mail
    [Tags]    negative
    ${body}=    Register Body
    Remove From Dictionary    ${body}    email
    ${resp}=    Register Raw    ${body}    400
    Error Code Should Be    ${resp}    validation_failed

Register Rejects An Empty Object
    [Tags]    negative
    ${empty}=    Create Dictionary
    ${resp}=    Register Raw    ${empty}    400
    Error Code Should Be    ${resp}    validation_failed

Register Rejects A Blank Display Name
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    displayName    ${EMPTY}

Register Rejects A Display Name Of Only Spaces
    [Tags]    negative    edge
    [Template]    Register Field Should Be Rejected
    displayName    ${{ ' ' * 6 }}

Register Rejects A Display Name Of 81 Characters
    [Tags]    negative    edge
    ${long}=    Evaluate    'ก' * 81
    Register Field Should Be Rejected    displayName    ${long}

Register Rejects A Null Display Name
    [Tags]    negative
    [Template]    Register Field Should Be Rejected
    displayName    ${None}

Register Rejects A Display Name That Is A List
    [Tags]    negative
    ${list}=    Create List    a    b
    Register Field Should Be Rejected    displayName    ${list}

Register Rejects A Display Name Of 100000 Characters Without A Server Error
    [Tags]    negative    edge
    ${long}=    Evaluate    'ก' * 100000
    Register Field Should Be Rejected    displayName    ${long}

Register Rejects A Malformed Json Body
    [Tags]    negative    edge
    ${resp}=    Post Raw Json    anon    /auth/register    {"email": "a@b.co", "password":    400
    Error Code Should Be    ${resp}    validation_failed

Register Rejects An Empty Body
    [Tags]    negative    edge
    ${resp}=    Post Raw Json    anon    /auth/register    ${EMPTY}    400
    Error Code Should Be    ${resp}    validation_failed

Register Rejects A Json Array Body
    [Tags]    negative    edge
    ${resp}=    Post Raw Json    anon    /auth/register    []    400
    Error Code Should Be    ${resp}    validation_failed

Register Rejects A Json String Body
    [Tags]    negative    edge
    ${resp}=    Post Raw Json    anon    /auth/register    "hello"    400
    Error Code Should Be    ${resp}    validation_failed

Register Rejects A Body Over The 8 Megabyte Limit With A 413
    [Tags]    negative    edge    slow
    ${huge}=    Evaluate    '{"email":"a@b.co","password":"x","displayName":"' + 'a' * 8600000 + '"}'
    ${resp}=    Post Raw Json    anon    /auth/register    ${huge}    413
    Should Be Equal    ${resp.json()}[code]    validation_failed

# ── login ──
Login With The Right Password Answers 200 And A Token
    [Tags]    smoke
    ${user}=    Register User Via API    login
    ${resp}=    Login Should Succeed    ${user}[email]    ${user}[password]
    Auth Response Should Be Valid    ${resp.json()}    ${user}[email]
    Should Be Equal    ${resp.json()}[user][id]    ${user}[id]
    Should Contain    ${resp.headers}[set-cookie]    contrack_rt=

Login Starts A New Token Family Next To The Registration One
    ${user}=    Register User Via API    login
    Login Should Succeed    ${user}[email]    ${user}[password]
    ${rows}=    Refresh Token Rows    ${user}[id]
    Length Should Be    ${rows}    2
    Should Not Be Equal    ${rows}[0][family_id]    ${rows}[1][family_id]

Login Ignores The Case And Surrounding Spaces Of The E-mail
    [Tags]    edge
    ${user}=    Register User Via API    login
    ${shout}=    Convert To Upper Case    ${user}[email]
    ${messy}=    Set Variable    ${SPACE}${SPACE}${shout}${SPACE}${SPACE}
    Login Should Succeed    ${messy}    ${user}[password]

Login With A Wrong Password Answers 401 Invalid Credentials
    [Tags]    negative
    ${user}=    Register User Via API    login
    Login Should Be Refused    ${user}[email]    ${WRONG PASSWORD}

Login With An Unknown E-mail Answers The Same 401 And The Same Message
    [Documentation]    No user enumeration: unknown e-mail and wrong password are indistinguishable.
    [Tags]    negative    security
    ${user}=    Register User Via API    login
    ${wrong}=    Login Should Be Refused    ${user}[email]    ${WRONG PASSWORD}
    ${unknown}=    Login Should Be Refused    nobody.${user}[email]    ${WRONG PASSWORD}
    Should Be Equal    ${unknown.json()}[message]    ${wrong.json()}[message]
    Should Be Equal    ${unknown.json()}[code]    ${wrong.json()}[code]

Login Is Case Sensitive For The Password
    [Tags]    negative    edge
    ${user}=    Register User Via API    login
    ${other}=    Evaluate    $user['password'].swapcase()
    Login Should Be Refused    ${user}[email]    ${other}

Login Rejects The Password With A Trailing Space
    [Documentation]    Passwords are not trimmed (plain-password.value-object.ts).
    [Tags]    negative    edge
    ${user}=    Register User Via API    login
    Login Should Be Refused    ${user}[email]    ${user}[password]${SPACE}

Login With An Injection Password Answers 401
    [Tags]    negative    security
    ${user}=    Register User Via API    login
    Login Should Be Refused    ${user}[email]    ' OR '1'='1

Login With An Injection E-mail Answers 400
    [Tags]    negative    security
    VAR    &{body}    email=admin' --    password=whatever1
    Login Body Should Be Rejected    ${body}

Login Rejects An Empty Password With 400
    [Tags]    negative
    VAR    &{body}    email=${DEMO_OWNER}    password=${EMPTY}
    Login Body Should Be Rejected    ${body}

Login Rejects A Missing Password
    [Tags]    negative
    VAR    &{body}    email=${DEMO_OWNER}
    Login Body Should Be Rejected    ${body}

Login Rejects A Missing E-mail
    [Tags]    negative
    VAR    &{body}    password=whatever1
    Login Body Should Be Rejected    ${body}

Login Rejects A Password Longer Than 128 Characters
    [Tags]    negative    edge
    VAR    &{body}    email=${DEMO_OWNER}    password=${{ 'a' * 129 }}
    Login Body Should Be Rejected    ${body}

Login Rejects A Malformed Json Body
    [Tags]    negative    edge
    ${resp}=    Post Raw Json    anon    /auth/login    {email:    400
    Error Code Should Be    ${resp}    validation_failed

Login Failure Does Not Leak The User Id Or A Token
    [Tags]    security
    ${user}=    Register User Via API    login
    ${resp}=    Login Should Be Refused    ${user}[email]    ${WRONG PASSWORD}
    Should Not Contain    ${resp.text}    ${user}[id]
    Should Not Contain    ${resp.text}    accessToken

Seeded Demo Owner Signs In With The Demo Password
    ${owner}=    Login Via API    ${DEMO_OWNER}
    ${me}=    Api Call    ${owner}[alias]    GET    /me    200
    Should Be Equal    ${me.json()}[user][email]    ${DEMO_OWNER}

# ── refresh ──
Refresh Rotates The Token And Revokes The Old One In The Database
    [Tags]    smoke
    ${body}=    Register Body
    ${reg}=    Register Raw    ${body}    201
    ${old}=    Refresh Token Of    ${reg}
    ${resp}=    Refresh With Cookie    ${old}    200
    ${new}=    Refresh Token Of    ${resp}
    Should Not Be Equal    ${new}    ${old}
    Should Be Equal    ${resp.json()}[user][id]    ${reg.json()}[user][id]
    ${rows}=    Refresh Token Rows    ${reg.json()}[user][id]
    Length Should Be    ${rows}    2
    Should Not Be Equal    ${rows}[0][revoked_at]    ${None}
    Should Be Equal As Strings    ${rows}[0][replaced_by]    ${rows}[1][id]
    Should Be Equal    ${rows}[1][revoked_at]    ${None}
    Should Be Equal As Strings    ${rows}[0][family_id]    ${rows}[1][family_id]

Refresh Issues A Working Access Token
    ${user}=    Register User Via API    refresh
    ${resp}=    Login Cookie Refresh    ${user}
    Update Session    ${user}[alias]    headers=${{ {'Authorization': 'Bearer ' + $resp.json()['accessToken']} }}
    Api Call    ${user}[alias]    GET    /me    200

Refresh Chain Keeps Working For Ten Rotations
    [Tags]    edge
    ${user}=    Register User Via API    chain
    ${login}=    Login Raw    ${user}
    ${token}=    Refresh Token Of    ${login}
    FOR    ${i}    IN RANGE    10
        ${resp}=    Refresh With Cookie    ${token}    200
        ${next}=    Refresh Token Of    ${resp}
        Should Not Be Equal    ${next}    ${token}
        VAR    ${token}    ${next}
    END

Refresh Without A Cookie Answers 401 Invalid Token
    [Tags]    negative
    Create Anonymous Session    anon
    ${resp}=    POST On Session    anon    /auth/refresh    expected_status=401
    Error Code Should Be    ${resp}    invalid_token

Refresh With A Garbage Cookie Answers 401 And Clears The Cookie
    [Tags]    negative
    ${resp}=    Refresh With Cookie    not-a-real-token    401
    Error Code Should Be    ${resp}    invalid_token
    Should Contain    ${resp.headers}[set-cookie]    contrack_rt=;
    Should Contain    ${resp.headers}[set-cookie]    1970

Refresh With An Empty Cookie Value Answers 401
    [Tags]    negative    edge
    ${resp}=    Refresh With Cookie    ${EMPTY}    401
    Error Code Should Be    ${resp}    invalid_token

Refresh With A Token Changed By One Character Answers 401
    [Tags]    negative    security
    ${user}=    Register User Via API    refresh
    ${login}=    Login Raw    ${user}
    ${token}=    Refresh Token Of    ${login}
    ${tampered}=    Evaluate    $token[:-1] + ('A' if $token[-1] != 'A' else 'B')
    ${resp}=    Refresh With Cookie    ${tampered}    401
    Error Code Should Be    ${resp}    invalid_token

Refresh With An Access Token Instead Of A Refresh Token Answers 401
    [Tags]    negative    security
    ${user}=    Register User Via API    refresh
    ${resp}=    Refresh With Cookie    ${user}[token]    401
    Error Code Should Be    ${resp}    invalid_token

Refresh Reuse Inside The Grace Window Gives A Sibling Token
    [Documentation]    Two tabs refresh at the same moment: the second one must not be signed out (API.md, 30 s grace).
    [Tags]    edge
    ${user}=    Register User Via API    grace
    ${login}=    Login Raw    ${user}
    ${old}=    Refresh Token Of    ${login}
    ${first}=    Refresh With Cookie    ${old}    200
    ${second}=    Refresh With Cookie    ${old}    200
    ${winner}=    Refresh Token Of    ${first}
    ${sibling}=    Refresh Token Of    ${second}
    Should Not Be Equal    ${winner}    ${sibling}
    Refresh With Cookie    ${winner}    200
    Refresh With Cookie    ${sibling}    200

Refresh Reuse After The Grace Window Revokes The Whole Family
    [Documentation]    The rotation time (``revoked_at``) is moved 10 minutes back in the test's own rows to leave the
    ...    30 s grace window without sleeping. Then the reused token and its legitimate successor must both die.
    [Tags]    security
    ${user}=    Register User Via API    reuse
    ${login}=    Login Raw    ${user}
    ${old}=    Refresh Token Of    ${login}
    ${first}=    Refresh With Cookie    ${old}    200
    ${successor}=    Refresh Token Of    ${first}
    Age Rotated Refresh Tokens    ${user}[id]
    ${reuse}=    Refresh With Cookie    ${old}    401
    Error Code Should Be    ${reuse}    invalid_token
    ${dead}=    Refresh With Cookie    ${successor}    401
    Error Code Should Be    ${dead}    invalid_token
    ${open}=    Query Value
    ...    select count(*) from refresh_tokens where user_id = %s and revoked_at is null and family_id = (select family_id from refresh_tokens where user_id = %s order by created_at desc limit 1)
    ...    ${user}[id]    ${user}[id]
    Should Be Equal As Integers    ${open}    0

Refresh Reuse Revokes Only The Attacked Family
    [Documentation]    A second login (another device) must survive the reuse detection of the first family.
    [Tags]    security    edge
    ${user}=    Register User Via API    reuse
    ${device1}=    Login Raw    ${user}
    ${device2}=    Login Raw    ${user}
    ${old}=    Refresh Token Of    ${device1}
    ${other}=    Refresh Token Of    ${device2}
    Refresh With Cookie    ${old}    200
    Age Rotated Refresh Tokens    ${user}[id]
    Refresh With Cookie    ${old}    401
    Refresh With Cookie    ${other}    200

Refresh With An Expired Refresh Token Answers 401
    [Tags]    negative    edge
    ${user}=    Register User Via API    expiry
    ${login}=    Login Raw    ${user}
    ${token}=    Refresh Token Of    ${login}
    Query Rows    update refresh_tokens set expires_at = now() - interval '1 minute' where user_id = %s    ${user}[id]
    ${resp}=    Refresh With Cookie    ${token}    401
    Error Code Should Be    ${resp}    invalid_token

# ── logout ──
Logout Revokes The Token And The Cookie Is Cleared
    [Tags]    smoke
    ${user}=    Register User Via API    logout
    ${login}=    Login Raw    ${user}
    ${token}=    Refresh Token Of    ${login}
    ${resp}=    Logout With Cookie    ${token}
    Should Contain    ${resp.headers}[set-cookie]    contrack_rt=;
    ${again}=    Refresh With Cookie    ${token}    401
    Error Code Should Be    ${again}    invalid_token

Logout Marks Every Token Of The Family Revoked In The Database
    ${user}=    Register User Via API    logout
    ${login}=    Login Raw    ${user}
    ${token}=    Refresh Token Of    ${login}
    ${rotated}=    Refresh With Cookie    ${token}    200
    ${current}=    Refresh Token Of    ${rotated}
    Logout With Cookie    ${current}
    ${open}=    Query Value
    ...    select count(*) from refresh_tokens where user_id = %s and revoked_at is null and family_id = (select family_id from refresh_tokens where user_id = %s order by created_at desc limit 1)
    ...    ${user}[id]    ${user}[id]
    Should Be Equal As Integers    ${open}    0

Logout Without A Cookie Is Idempotent And Answers 204
    [Tags]    edge
    Create Anonymous Session    anon
    POST On Session    anon    /auth/logout    expected_status=204

Logout With A Garbage Cookie Answers 204
    [Tags]    edge
    Logout With Cookie    garbage

Logout Twice With The Same Cookie Answers 204 Both Times
    [Tags]    edge
    ${user}=    Register User Via API    logout
    ${login}=    Login Raw    ${user}
    ${token}=    Refresh Token Of    ${login}
    Logout With Cookie    ${token}
    Logout With Cookie    ${token}

Logout Of One Device Keeps The Other Device Signed In
    [Tags]    edge
    ${user}=    Register User Via API    logout
    ${device1}=    Login Raw    ${user}
    ${device2}=    Login Raw    ${user}
    ${first}=    Refresh Token Of    ${device1}
    Logout With Cookie    ${first}
    ${other}=    Refresh Token Of    ${device2}
    Refresh With Cookie    ${other}    200

# ── /me and the access token ──
Me Without A Token Answers 401 Unauthenticated
    [Tags]    negative    smoke
    Create Anonymous Session    anon
    ${resp}=    GET On Session    anon    /me    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

Me Returns The User And Workspaces With Roles
    ${user}=    Register User Via API    me
    Create Company Workspace Via API    ${user}
    ${resp}=    Api Call    ${user}[alias]    GET    /me    200
    Length Should Be    ${resp.json()}[workspaces]    2
    ${kinds}=    Evaluate    sorted(w['kind'] for w in $resp.json()['workspaces'])
    Should Be Equal    ${kinds}[0]    company
    Should Be Equal    ${kinds}[1]    personal
    ${roles}=    Evaluate    {w['role'] for w in $resp.json()['workspaces']}
    Should Be Equal    ${roles}    ${{ {'owner'} }}

Me With A Garbage Token Answers 401
    [Tags]    negative
    Me With Token Should Be Refused    not.a.jwt

Me With An Empty Bearer Value Answers 401
    [Tags]    negative    edge
    Me With Authorization Should Be Refused    Bearer${SPACE}

Me With The Basic Scheme Answers 401
    [Tags]    negative    security
    Me With Authorization Should Be Refused    Basic dXNlcjpwYXNz

Me With A Token Without A Scheme Answers 401
    [Tags]    negative    edge
    ${user}=    Register User Via API    me
    Me With Authorization Should Be Refused    ${user}[token]

Me Accepts A Lower Case Bearer Scheme
    [Tags]    edge
    ${user}=    Register User Via API    me
    Create Anonymous Session    anon
    ${headers}=    Create Dictionary    Authorization=bearer ${user}[token]
    GET On Session    anon    /me    headers=${headers}    expected_status=200

Me With A Token Signed With A Different Secret Answers 401
    [Tags]    negative    security
    ${user}=    Register User Via API    me
    ${forged}=    Make Signed Jwt    ${user}[id]    secret=another-secret-another-secret-another-secret
    Me With Token Should Be Refused    ${forged}

Me With An Unsigned Alg None Token Answers 401
    [Tags]    negative    security
    ${user}=    Register User Via API    me
    ${forged}=    Make Signed Jwt    ${user}[id]    alg=none
    Me With Token Should Be Refused    ${forged}

Me With An Expired Token Answers 401
    [Tags]    negative    edge
    ${user}=    Register User Via API    me
    ${expired}=    Make Signed Jwt    ${user}[id]    offset=-60
    Me With Token Should Be Refused    ${expired}

Me With A Correctly Signed Fresh Token Answers 200
    [Documentation]    Control for the forged-token tests: the helper builds a token the server accepts.
    ${user}=    Register User Via API    me
    ${good}=    Make Signed Jwt    ${user}[id]
    Create Anonymous Session    anon
    ${headers}=    Create Dictionary    Authorization=Bearer ${good}
    ${resp}=    GET On Session    anon    /me    headers=${headers}    expected_status=200
    Should Be Equal    ${resp.json()}[user][id]    ${user}[id]

Me With The Wrong Audience Answers 401
    [Tags]    negative    security
    ${user}=    Register User Via API    me
    ${forged}=    Make Signed Jwt    ${user}[id]    audience=someone-else
    Me With Token Should Be Refused    ${forged}

Me With The Wrong Issuer Answers 401
    [Tags]    negative    security
    ${user}=    Register User Via API    me
    ${forged}=    Make Signed Jwt    ${user}[id]    issuer=someone-else
    Me With Token Should Be Refused    ${forged}

Me With A Valid Token Of A Non Existent User Answers 401
    [Tags]    negative    edge
    ${ghost}=    Make Signed Jwt    ${ZERO UUID}
    Me With Token Should Be Refused    ${ghost}

Me With A Token Whose Subject Is Not A Uuid Answers 401
    [Tags]    negative    edge
    ${odd}=    Make Signed Jwt    1 or 1=1
    Me With Token Should Be Refused    ${odd}

Me Shows Only The Workspaces Of The Caller
    [Tags]    security
    ${alice}=    Register User Via API    alice
    ${bob}=    Register User Via API    bob
    ${ws}=    Create Company Workspace Via API    ${alice}
    ${ids}=    Workspace Ids Listed For    ${bob}
    Should Not Contain    ${ids}    ${ws}
    Length Should Be    ${ids}    1

Protected Routes Reject Requests Without A Token
    [Tags]    negative    security
    [Template]    Anonymous Call Should Be Refused
    GET       /me
    GET       /workspaces
    POST      /workspaces
    GET       /workspaces/${ZERO UUID}
    PATCH     /workspaces/${ZERO UUID}
    DELETE    /workspaces/${ZERO UUID}
    GET       /workspaces/${ZERO UUID}/members
    GET       /workspaces/${ZERO UUID}/invitations
    POST      /workspaces/${ZERO UUID}/invitations
    POST      /invitations/accept
    GET       /workspaces/${ZERO UUID}/projects
    POST      /workspaces/${ZERO UUID}/projects
    GET       /projects/${ZERO UUID}


*** Keywords ***
Age Rotated Refresh Tokens
    [Documentation]    Move the rotation time 10 minutes back (outside the 30 s grace window) without sleeping.
    [Arguments]    ${user_id}
    Query Rows    update refresh_tokens set revoked_at = revoked_at - interval '10 minutes' where user_id = %s and revoked_at is not null    ${user_id}

Anonymous Call Should Be Refused
    [Arguments]    ${method}    ${path}
    Create Anonymous Session    anon
    ${resp}=    Run Keyword    ${method} On Session    anon    ${path}    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

Login Body Should Be Rejected
    [Arguments]    ${body}
    Create Anonymous Session    anon
    ${resp}=    POST On Session    anon    /auth/login    json=${body}    expected_status=400
    Error Code Should Be    ${resp}    validation_failed

Login Cookie Refresh
    [Documentation]    Sign in (raw) and refresh with the cookie; returns the refresh response.
    [Arguments]    ${user}
    ${login}=    Login Raw    ${user}
    ${token}=    Refresh Token Of    ${login}
    ${resp}=    Refresh With Cookie    ${token}    200
    RETURN    ${resp}

Login Raw
    [Documentation]    ``POST /auth/login`` that must succeed; returns the response (cookie included).
    [Arguments]    ${user}
    ${resp}=    Login Should Succeed    ${user}[email]    ${user}[password]
    RETURN    ${resp}

Login Should Be Refused
    [Arguments]    ${email}    ${password}
    Create Anonymous Session    anon
    VAR    &{body}    email=${email}    password=${password}
    ${resp}=    POST On Session    anon    /auth/login    json=${body}    expected_status=401
    Error Code Should Be    ${resp}    invalid_credentials
    RETURN    ${resp}

Login Should Succeed
    [Arguments]    ${email}    ${password}
    Create Anonymous Session    anon
    VAR    &{body}    email=${email}    password=${password}
    ${resp}=    POST On Session    anon    /auth/login    json=${body}    expected_status=200
    RETURN    ${resp}

Logout With Cookie
    [Arguments]    ${token}
    Create Anonymous Session    cookie-client
    ${headers}=    Create Dictionary    Cookie=contrack_rt=${token}
    ${resp}=    POST On Session    cookie-client    /auth/logout    headers=${headers}    expected_status=204
    RETURN    ${resp}

Me With Authorization Should Be Refused
    [Arguments]    ${header_value}
    Create Anonymous Session    anon
    ${headers}=    Create Dictionary    Authorization=${header_value}
    ${resp}=    GET On Session    anon    /me    headers=${headers}    expected_status=401
    Error Code Should Be    ${resp}    unauthenticated

Me With Token Should Be Refused
    [Arguments]    ${token}
    Me With Authorization Should Be Refused    Bearer ${token}

Register Field Should Be Rejected
    [Documentation]    One field set to an invalid value: 400 ``validation_failed`` and no user row is created.
    [Arguments]    ${field}    ${value}
    ${body}=    Register Body
    ${email}=    Set Variable    ${body}[email]
    Set To Dictionary    ${body}    ${field}=${value}
    ${resp}=    Register Raw    ${body}    400
    Error Code Should Be    ${resp}    validation_failed
    ${n}=    Query Value    select count(*) from users where email = %s or display_name = %s    ${email}    ${email}
    Should Be Equal As Integers    ${n}    0
