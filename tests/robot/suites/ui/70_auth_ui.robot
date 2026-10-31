*** Settings ***
Documentation       Sign-up, sign-in, sign-out and session handling in the browser (W5, docs/qa/TEST_PLAN.md 4.3).
...                 Form validation messages come from ``src/features/cloud/auth/form-rules.ts`` and
...                 ``src/features/cloud/api/errors.ts``; what the API stored is read back from PostgreSQL.
Resource            ../../resources/pages/cloud.resource
Suite Setup         Open Cloud Suite
Test Teardown       Close All Contexts
Test Tags           auth    cloud


*** Variables ***
${EXISTING_EMAIL_TEXT}      อีเมลนี้มีบัญชีอยู่แล้ว
${BAD_LOGIN_TEXT}           อีเมลหรือรหัสผ่านไม่ถูกต้อง
${BAD_EMAIL_TEXT}           รูปแบบอีเมลไม่ถูกต้อง
${SHORT_PASSWORD_TEXT}      รหัสผ่านต้องยาว 8–128 ตัวอักษร
${NO_CLOUD_PROJECTS}        โครงการบนคลาวด์
${SIGN_IN_PROMPT_TEXT}      เข้าสู่ระบบเพื่อเก็บโครงการบนคลาวด์ และทำงานเป็นทีม


*** Test Cases ***
Register Page Shows The Form And The Guest Note
    [Documentation]    /register offers name, e-mail, password, confirmation and says guest use still works.
    [Tags]    smoke
    Open Cloud Context    /register
    Wait For Elements State    css=h3:has-text("สมัครใช้งาน")    visible    timeout=60s
    Get Element Count    css=input#displayName, input#email, input#password, input#confirm    ==    4
    Get Text    css=form button[type="submit"]    ==    สมัครและเข้าสู่ระบบ
    Get Text    css=body    contains    ไม่เข้าสู่ระบบก็ใช้งานได้
    Get Element Count    css=a[href^="/login"]    >=    1

Register With Valid Data Creates The User And Signs In
    [Documentation]    Happy path: the app lands on /projects; the DB has the user (hashed password), a personal
    ...    workspace and an owner membership.
    [Tags]    smoke    db
    ${email}=    Unique Email    reg
    Open Cloud Context    /register
    Register Via UI    ผู้สมัครใหม่ ทดสอบ    ${email}    ${TEST_PASSWORD}
    Wait For Condition    Url    should end with    /projects    timeout=90s
    Projects Page Should Be Loaded
    ${user}=    User Row By Email    ${email}
    Should Be Equal    ${user}[display_name]    ผู้สมัครใหม่ ทดสอบ
    Should Not Be Equal    ${user}[password_hash]    ${TEST_PASSWORD}
    ${memberships}=    Query Rows    select m.role, w.kind from memberships m join workspaces w on w.id = m.workspace_id where m.user_id = %s    ${user}[id]
    Length Should Be    ${memberships}    1
    Should Be Equal    ${memberships}[0][role]    owner
    Should Be Equal    ${memberships}[0][kind]    personal

Registered Password Is Stored As A Hash
    [Documentation]    Security: the password never reaches the database in clear text, and a hash is not the password.
    [Tags]    security    db
    ${email}=    Unique Email    hash
    Open Cloud Context    /register
    Register Via UI    ผู้ทดสอบแฮช    ${email}    ${TEST_PASSWORD}
    Wait For Condition    Url    should end with    /projects    timeout=90s
    ${user}=    User Row By Email    ${email}
    Should Not Contain    ${user}[password_hash]    ${TEST_PASSWORD}
    Should Contain    ${user}[password_hash]    $    msg=password_hash does not look like a salted hash
    Should Be True    len($user['password_hash']) >= 40    msg=password_hash is too short to be a salted hash

Register Stores The E-mail In Lower Case
    [Documentation]    Upper-case input is normalised, so the same address cannot register twice by changing case.
    [Tags]    edge    db
    ${email}=    Unique Email    case
    ${upper}=    Convert To Upper Case    ${email}
    Open Cloud Context    /register
    Register Via UI    ผู้ทดสอบตัวพิมพ์ใหญ่    ${upper}    ${TEST_PASSWORD}
    Wait For Condition    Url    should end with    /projects    timeout=90s
    ${user}=    User Row By Email    ${email}
    Should Be Equal    ${user}[email]    ${email}

Register Trims Spaces Around The E-mail And The Name
    [Tags]    edge    db
    ${email}=    Unique Email    trim
    Open Cloud Context    /register
    Register Via UI    ${SPACE}${SPACE}ผู้ทดสอบเว้นวรรค${SPACE}${SPACE}    ${SPACE}${email}${SPACE}${SPACE}    ${TEST_PASSWORD}
    Wait For Condition    Url    should end with    /projects    timeout=90s
    ${user}=    User Row By Email    ${email}
    Should Be Equal    ${user}[display_name]    ผู้ทดสอบเว้นวรรค

Register With An Existing E-mail Shows A Message And Creates Nothing
    [Tags]    negative    db
    ${first}=    Register User Via API    dup
    Open Cloud Context    /register
    Register Via UI    คนที่สอง    ${first}[email]    ${TEST_PASSWORD}
    Alert Should Show    ${EXISTING_EMAIL_TEXT}
    Get Url    should end with    /register
    ${n}=    Query Value    select count(*) from users where email = %s    ${first}[email]
    Should Be Equal As Integers    ${n}    1

Register With An Existing E-mail In Other Case Is Rejected Too
    [Tags]    negative    security    db
    ${first}=    Register User Via API    dupcase
    ${upper}=    Convert To Upper Case    ${first}[email]
    Open Cloud Context    /register
    Register Via UI    คนที่สอง    ${upper}    ${TEST_PASSWORD}
    Alert Should Show    ${EXISTING_EMAIL_TEXT}
    ${n}=    Query Value    select count(*) from users where lower(email) = %s    ${first}[email]
    Should Be Equal As Integers    ${n}    1

Register Form Requires Every Field
    [Tags]    negative
    Open Cloud Context    /register
    Wait For Elements State    ${SUBMIT_BUTTON}    visible    timeout=60s
    Click    ${SUBMIT_BUTTON}
    Form Error Should Show    กรอกชื่อที่ให้ทีมเห็น
    Form Error Should Show    กรอกอีเมล
    Form Error Should Show    ตั้งรหัสผ่าน
    Form Error Should Show    กรอกรหัสผ่านอีกครั้ง
    Get Url    should end with    /register

Register Rejects Invalid E-mail Addresses
    [Documentation]    Each malformed address gets "รูปแบบอีเมลไม่ถูกต้อง" and no user is created.
    [Tags]    negative    edge
    [Template]    Register Should Reject E-mail
    plainaddress
    missing-domain@
    @missing-local.test
    two words@robot.test
    no-tld@robot
    double..dot@robot.test
    <script>@robot.test

Register Rejects A Password Shorter Than Eight Characters
    [Tags]    negative    edge
    ${email}=    Unique Email    pw7
    Open Cloud Context    /register
    Register Via UI    ผู้ทดสอบ    ${email}    Abc1234
    Form Error Should Show    ${SHORT_PASSWORD_TEXT}
    Get Url    should end with    /register

Register Accepts A Password Of Exactly Eight Characters
    [Documentation]    Boundary: 8 is the minimum (PASSWORD_MIN_LENGTH).
    [Tags]    edge    db
    ${email}=    Unique Email    pw8
    Open Cloud Context    /register
    Register Via UI    ผู้ทดสอบแปดตัว    ${email}    Abcd1234
    Wait For Condition    Url    should end with    /projects    timeout=90s
    User Row By Email    ${email}

Register Rejects A Password Of 129 Characters And Accepts 128
    [Documentation]    Boundary: PASSWORD_MAX_LENGTH is 128. The 128-character password also signs in afterwards.
    [Tags]    edge    db
    ${too_long}=    Evaluate    'Aa1' * 43
    Should Be Equal As Integers    ${{ len($too_long) }}    129
    ${ok}=    Evaluate    'Aa1' * 42 + 'Aa'
    Should Be Equal As Integers    ${{ len($ok) }}    128
    ${email}=    Unique Email    pwmax
    Open Cloud Context    /register
    Register Via UI    ผู้ทดสอบยาว    ${email}    ${too_long}    submit=${False}
    Click    ${SUBMIT_BUTTON}
    Form Error Should Show    ${SHORT_PASSWORD_TEXT}
    Fill Text    ${PASSWORD_INPUT}    ${ok}
    Fill Text    ${CONFIRM_INPUT}    ${ok}
    Click    ${SUBMIT_BUTTON}
    Wait For Condition    Url    should end with    /projects    timeout=90s
    Sign Out Via UI
    Sign In Via UI    ${email}    ${ok}

Register Rejects A Confirmation That Does Not Match
    [Tags]    negative
    ${email}=    Unique Email    mismatch
    Open Cloud Context    /register
    Register Via UI    ผู้ทดสอบ    ${email}    ${TEST_PASSWORD}    ${TEST_PASSWORD}x
    Form Error Should Show    รหัสผ่านทั้งสองช่องไม่ตรงกัน
    Get Url    should end with    /register
    ${n}=    Query Value    select count(*) from users where email = %s    ${email}
    Should Be Equal As Integers    ${n}    0

Register Rejects A Display Name Longer Than 80 Characters
    [Tags]    negative    edge
    ${email}=    Unique Email    longname
    ${name}=    Evaluate    'ก' * 81
    Open Cloud Context    /register
    Register Via UI    ${name}    ${email}    ${TEST_PASSWORD}
    Form Error Should Show    ชื่อยาวได้ไม่เกิน 80 ตัวอักษร
    ${n}=    Query Value    select count(*) from users where email = %s    ${email}
    Should Be Equal As Integers    ${n}    0

Register Rejects A Display Name Of Only Spaces
    [Documentation]    A name of blanks is empty after trimming: some validation message must show, no user is made.
    [Tags]    negative    edge
    ${email}=    Unique Email    blankname
    Open Cloud Context    /register
    Register Via UI    ${SPACE}${SPACE}${SPACE}${SPACE}${SPACE}    ${email}    ${TEST_PASSWORD}
    Wait For Elements State    css=.ant-form-item-explain-error    visible    timeout=10s
    Get Url    should end with    /register
    ${n}=    Query Value    select count(*) from users where email = %s    ${email}
    Should Be Equal As Integers    ${n}    0

Display Name With Html Is Shown As Text And Never Executed
    [Documentation]    Security (XSS): a name with markup is escaped everywhere it is shown.
    [Tags]    security    db
    ${email}=    Unique Email    xss
    ${name}=    Set Variable    <img src=x onerror=document.title=1>
    Open Cloud Context    /register
    Register Via UI    ${name}    ${email}    ${TEST_PASSWORD}
    Wait For Condition    Url    should end with    /projects    timeout=90s
    Projects Page Should Be Loaded
    Get Element Count    css=img[src="x"]    ==    0
    Get Title    !=    1
    Click    ${ACCOUNT_MENU}
    Get Text    ${OPEN_DROPDOWN}    contains    <img src=x
    ${user}=    User Row By Email    ${email}
    Should Be Equal    ${user}[display_name]    ${name}

Register Link On The Login Page Keeps The Return Path
    [Tags]    edge
    Open Cloud Context    /login?next=/workspace/members
    Wait For Elements State    css=a:has-text("สมัครใช้งานฟรี")    visible    timeout=60s
    Get Attribute    css=a:has-text("สมัครใช้งานฟรี")    href    contains    next=%2Fworkspace%2Fmembers
    Click    css=a:has-text("สมัครใช้งานฟรี")
    Wait For Elements State    css=h3:has-text("สมัครใช้งาน")    visible
    Get Attribute    css=a:has-text("เข้าสู่ระบบ")    href    contains    next=%2Fworkspace%2Fmembers

Register Then Return Path Is Followed
    [Documentation]    /register?next=/workspace/members lands on the members page after sign-up.
    [Tags]    edge
    ${email}=    Unique Email    regnext
    Open Cloud Context    /register?next=/workspace/members
    Register Via UI    ผู้ทดสอบกลับหน้าเดิม    ${email}    ${TEST_PASSWORD}
    Wait For Condition    Url    should end with    /workspace/members    timeout=90s

Login With Valid Credentials Lands On Projects
    [Tags]    smoke
    ${user}=    Register User Via API    login
    Open Cloud Context    /login
    Sign In Via UI    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Get Attribute    ${ACCOUNT_MENU}    title    ==    ${user}[displayName]

Login Page Shows The Form And The Guest Note
    Open Cloud Context    /login
    Wait For Elements State    css=h3:has-text("เข้าสู่ระบบ")    visible    timeout=60s
    Get Element Count    css=input#email, input#password    ==    2
    Get Text    css=body    contains    ไม่เข้าสู่ระบบก็ใช้งานได้

Login With A Wrong Password Shows The Message And Stays
    [Tags]    negative
    ${user}=    Register User Via API    wrongpw
    Open Cloud Context    /login
    Fill Login Form    ${user}[email]    ${user}[password]x
    Sign In Form Should Show Error    ${BAD_LOGIN_TEXT}

Login With An Unknown E-mail Gives The Same Message As A Wrong Password
    [Documentation]    Security: the answer must not reveal whether an e-mail has an account (no enumeration).
    [Tags]    negative    security
    ${known}=    Register User Via API    known
    Open Cloud Context    /login
    Fill Login Form    ${known}[email]    wrong-password-1
    Alert Should Show    ${BAD_LOGIN_TEXT}
    ${known_text}=    Get Text    css=.ant-alert-error
    Reload Cloud Page
    Wait For Elements State    ${EMAIL_INPUT}    visible    timeout=60s
    Fill Login Form    nobody.${known}[email]    wrong-password-1
    Alert Should Show    ${BAD_LOGIN_TEXT}
    Get Text    css=.ant-alert-error    ==    ${known_text}

Login Requires E-mail And Password
    [Tags]    negative
    Open Cloud Context    /login
    Wait For Elements State    ${SUBMIT_BUTTON}    visible    timeout=60s
    Click    ${SUBMIT_BUTTON}
    Form Error Should Show    กรอกอีเมล
    Form Error Should Show    กรอกรหัสผ่าน
    Get Url    should end with    /login

Login Rejects A Malformed E-mail Before Asking The Server
    [Tags]    negative
    Open Cloud Context    /login
    Fill Login Form    not-an-email    ${TEST_PASSWORD}
    Form Error Should Show    ${BAD_EMAIL_TEXT}
    Get Url    should end with    /login

Login E-mail Is Case Insensitive And Trimmed
    [Tags]    edge
    ${user}=    Register User Via API    caselogin
    ${mixed}=    Convert To Upper Case    ${user}[email]
    Open Cloud Context    /login
    Fill Login Form    ${SPACE}${mixed}${SPACE}${SPACE}    ${user}[password]
    Wait For Condition    Url    should end with    /projects    timeout=90s

Login With Injection Strings Is Just A Wrong Password
    [Documentation]    Security: SQL metacharacters in the password do not log in and do not break the server.
    [Tags]    security    negative
    ${user}=    Register User Via API    sqli
    Open Cloud Context    /login
    Fill Login Form    ${user}[email]    ' OR '1'='1' --
    Sign In Form Should Show Error    ${BAD_LOGIN_TEXT}
    Fill Login Form    ${user}[email]    "; DROP TABLE users; --
    Sign In Form Should Show Error    ${BAD_LOGIN_TEXT}
    ${n}=    Query Value    select count(*) from users where email = %s    ${user}[email]
    Should Be Equal As Integers    ${n}    1

Login With A Password Over 128 Characters Shows An Error
    [Documentation]    The API rejects an over-long password; the form shows a message instead of crashing.
    [Tags]    negative    edge
    ${user}=    Register User Via API    longpw
    ${long}=    Evaluate    'p' * 200
    Open Cloud Context    /login
    Fill Login Form    ${user}[email]    ${long}
    Wait For Elements State    css=.ant-alert-error    visible    timeout=15s
    Get Url    should end with    /login
    Page Should Have No Error Overlay

Login Follows A Same-site Return Path
    [Tags]    edge
    ${user}=    Register User Via API    next
    Open Cloud Context    /login?next=/workspace/members
    Fill Login Form    ${user}[email]    ${user}[password]
    Wait For Condition    Url    should end with    /workspace/members    timeout=90s

Login Ignores A Return Path To Another Site
    [Documentation]    Security (open redirect): next=//evil.example or an absolute URL falls back to /projects.
    [Tags]    security    edge
    [Template]    Login With Return Path Lands On Projects
    //evil.example/phish
    https://evil.example/phish
    /\\evil.example
    javascript:alert(1)

Enter Key Submits The Login Form
    [Tags]    edge
    ${user}=    Register User Via API    enter
    Open Cloud Context    /login
    Wait For Elements State    ${EMAIL_INPUT}    visible    timeout=60s
    Fill Text    ${EMAIL_INPUT}    ${user}[email]
    Fill Text    ${PASSWORD_INPUT}    ${user}[password]
    Keyboard Key    press    Enter
    Wait For Condition    Url    should end with    /projects    timeout=90s

Password Field Is Masked And Can Be Revealed
    [Tags]    security
    Open Cloud Context    /login
    Wait For Elements State    ${PASSWORD_INPUT}    visible    timeout=60s
    Fill Text    ${PASSWORD_INPUT}    secret-value
    Get Attribute    ${PASSWORD_INPUT}    type    ==    password
    Click    css=.ant-input-password-icon
    Get Attribute    ${PASSWORD_INPUT}    type    ==    text

Failed Login Does Not Start A Session
    [Tags]    negative    security
    ${user}=    Register User Via API    nosession
    Open Cloud Context    /login
    Fill Login Form    ${user}[email]    not-the-password
    Alert Should Show    ${BAD_LOGIN_TEXT}
    Go To Cloud Path    /projects
    Wait For Elements State    css=button[aria-label="เข้าสู่ระบบ"]    visible    timeout=60s
    Get Text    css=body    contains    ${SIGN_IN_PROMPT_TEXT}

Session Survives A Reload
    [Documentation]    The refresh cookie signs the user in again after F5 (the access token lives in memory only).
    [Tags]    smoke
    ${user}=    Register User Via API    reload
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Reload Cloud Page
    Projects Page Should Be Loaded
    Get Attribute    ${ACCOUNT_MENU}    title    ==    ${user}[displayName]

Session Is Shared By A New Tab Of The Same Browser
    [Tags]    edge
    ${user}=    Register User Via API    tabs
    Open Signed In Context    ${user}[email]    ${user}[password]
    New Page    ${BASE_URL}/workspace/members
    Wait For Elements State    css=h3:has-text("สมาชิก")    visible    timeout=60s
    Get Attribute    ${ACCOUNT_MENU}    title    ==    ${user}[displayName]

Fresh Browser Without The Cookie Is Signed Out
    [Documentation]    Another browser profile (new context) has no session of its own.
    [Tags]    security
    ${user}=    Register User Via API    isolation
    Open Signed In Context    ${user}[email]    ${user}[password]
    Open Cloud Context    /projects
    Wait For Elements State    css=button[aria-label="เข้าสู่ระบบ"]    visible    timeout=60s
    Get Text    css=body    contains    ${SIGN_IN_PROMPT_TEXT}

Refresh Cookie Is HttpOnly And Tokens Stay Out Of Storage
    [Documentation]    Security: scripts cannot read the refresh token, and no access token is persisted in localStorage.
    [Tags]    security
    ${user}=    Register User Via API    cookie
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    ${cookies}=    Get Cookies
    ${refresh}=    Evaluate    [c for c in $cookies if c['name'] == 'contrack_rt']
    Length Should Be    ${refresh}    1
    Should Be True    ${refresh}[0][httpOnly]
    ${visible}=    Evaluate JavaScript    ${None}    () => document.cookie
    Should Not Contain    ${visible}    contrack_rt
    ${stored}=    Evaluate JavaScript    ${None}    () => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage))
    Should Not Contain    ${stored}    eyJ    msg=a JWT is stored in the browser storage
    Should Not Contain    ${stored}    ${user}[password]

Logout Returns To Guest Mode And Stays Signed Out After Reload
    [Tags]    smoke
    ${user}=    Register User Via API    logout
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Sign Out Via UI
    Reload Cloud Page
    Wait For Elements State    css=button[aria-label="เข้าสู่ระบบ"]    visible    timeout=60s
    Go To Cloud Path    /projects
    Get Text    css=body    contains    ${SIGN_IN_PROMPT_TEXT}

Logout Clears The Refresh Cookie
    [Tags]    security
    ${user}=    Register User Via API    logoutcookie
    Open Signed In Context    ${user}[email]    ${user}[password]
    Projects Page Should Be Loaded
    Sign Out Via UI
    ${cookies}=    Get Cookies
    ${refresh}=    Evaluate    [c for c in $cookies if c['name'] == 'contrack_rt' and c['value']]
    Should Be Empty    ${refresh}    msg=the refresh cookie survived the logout

Protected Pages Ask A Guest To Sign In
    [Documentation]    A signed-out visitor sees the sign-in prompt (with a return path), never someone's data.
    [Tags]    security
    [Template]    Guest Sees Sign In Prompt On
    /projects
    /workspace/members
    /workspace/modules

Sign In Prompt Returns To The Page That Asked For It
    [Tags]    edge
    ${user}=    Register User Via API    returnto
    Open Cloud Context    /workspace/members
    Wait For Elements State    css=a[href^="/login?next="] button    visible    timeout=60s
    Click    css=a[href^="/login?next="] button
    Wait For Elements State    ${EMAIL_INPUT}    visible    timeout=60s
    Get Url    contains    next=%2Fworkspace%2Fmembers
    Fill Login Form    ${user}[email]    ${user}[password]
    Wait For Condition    Url    should end with    /workspace/members    timeout=90s

Signed In User Opening Login Sees A Shortcut Instead Of The Form
    [Tags]    edge
    ${user}=    Register User Via API    already
    Open Signed In Context    ${user}[email]    ${user}[password]
    Go To Cloud Path    /login
    Wait For Elements State    css=h3:has-text("เข้าสู่ระบบอยู่แล้ว")    visible    timeout=60s
    Get Text    css=body    contains    ${user}[email]
    Get Element Count    ${EMAIL_INPUT}    ==    0
    Get Element Count    css=a[href="/projects"] button    ==    1

Guest Project Is Not Lost When Signing In
    [Documentation]    The login page promises that the project in this browser stays; localStorage is untouched.
    [Tags]    edge
    ${user}=    Register User Via API    guestkeep
    Open Cloud Context    /journey
    Start Guest Project    sample    /journey
    ${before}=    Read Guest Project
    Sign In Via UI    ${user}[email]    ${user}[password]
    ${after}=    Read Guest Project
    Should Be Equal    ${after}    ${before}

Registering Twice In A Row Creates One Account
    [Documentation]    Double-clicking the submit button must not create two users or leave an error behind.
    [Tags]    edge    db
    ${email}=    Unique Email    twice
    Open Cloud Context    /register
    Register Via UI    ผู้ทดสอบคลิกสองครั้ง    ${email}    ${TEST_PASSWORD}    submit=${False}
    Click With Options    ${SUBMIT_BUTTON}    clickCount=2    delay=20ms
    Wait For Condition    Url    should end with    /projects    timeout=90s
    ${n}=    Query Value    select count(*) from users where email = %s    ${email}
    Should Be Equal As Integers    ${n}    1


*** Keywords ***
Close All Contexts
    [Documentation]    Test teardown: every context of this test goes (cookies and storage never leak to the next one).
    Close Context    ALL    CURRENT

Fill Login Form
    [Documentation]    Type into the login form on the current page and press the submit button.
    [Arguments]    ${email}    ${password}
    Wait For Elements State    ${EMAIL_INPUT}    visible    timeout=60s
    Fill Text    ${EMAIL_INPUT}    ${email}
    Fill Text    ${PASSWORD_INPUT}    ${password}
    Click    ${SUBMIT_BUTTON}

Guest Sees Sign In Prompt On
    [Arguments]    ${path}
    Open Cloud Context    ${path}
    Wait For Elements State    css=a[href^="/login?next="] button    visible    timeout=60s
    Get Text    css=body    contains    ${SIGN_IN_PROMPT_TEXT}
    Get Attribute    css=a[href^="/login?next="]    href    contains    next=${{ urllib.parse.quote($path, safe='') }}
    Get Element Count    css=.ant-table, .ant-segmented    ==    0

Login With Return Path Lands On Projects
    [Arguments]    ${next}
    ${user}=    Register User Via API    redirect
    ${encoded}=    Evaluate    urllib.parse.quote($next, safe='')
    Open Cloud Context    /login?next=${encoded}
    Fill Login Form    ${user}[email]    ${user}[password]
    Wait For Condition    Url    should end with    /projects    timeout=90s
    Get Url    should start with    ${BASE_URL}

Register Should Reject E-mail
    [Arguments]    ${bad}
    Open Cloud Context    /register
    Register Via UI    ผู้ทดสอบอีเมลเสีย    ${bad}    ${TEST_PASSWORD}
    Form Error Should Show    ${BAD_EMAIL_TEXT}
    Get Url    should end with    /register
