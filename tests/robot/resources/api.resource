*** Settings ***
Documentation       HTTP API keywords (RequestsLibrary) against the E2E backend ``${API_URL}``.
...                 Each user gets their own session alias, so one test can act as owner, estimator and viewer.
...                 ``expected_status`` is always explicit: a test states the status it expects, never "any".
Library             RequestsLibrary
Library             Collections
Library             ${CURDIR}/../libraries/ContrackLibrary.py
Variables           ${CURDIR}/../variables/env.py


*** Keywords ***
Create Anonymous Session
    [Documentation]    Session without a token (public routes, negative auth checks).
    [Arguments]    ${alias}=anon
    Create Session    ${alias}    ${API_URL}    verify=${False}    disable_warnings=1
    RETURN    ${alias}

Register User Via API
    [Documentation]    Register a brand-new user (unique e-mail) and return ``&{user}``: alias, email, password,
    ...    token, id, displayName. The session ``${alias}`` carries the Bearer token.
    [Arguments]    ${prefix}=robot    ${display_name}=${EMPTY}    ${password}=${TEST_PASSWORD}
    ${email}=    Unique Email    ${prefix}
    VAR    ${name}    ${display_name}
    IF    $display_name == ''    VAR    ${name}    ผู้ทดสอบ ${prefix}
    ${alias}=    Unique Suffix
    Create Anonymous Session    ${alias}
    VAR    &{body}    email=${email}    password=${password}    displayName=${name}
    ${resp}=    POST On Session    ${alias}    /auth/register    json=${body}    expected_status=201
    ${user}=    Session User From Auth Response    ${alias}    ${resp.json()}    ${email}    ${password}
    RETURN    ${user}

Login Via API
    [Documentation]    Sign in an existing user. Returns the same ``&{user}`` dictionary as ``Register User Via API``.
    [Arguments]    ${email}    ${password}=${DEMO_PASSWORD}
    ${alias}=    Unique Suffix
    Create Anonymous Session    ${alias}
    VAR    &{body}    email=${email}    password=${password}
    ${resp}=    POST On Session    ${alias}    /auth/login    json=${body}    expected_status=200
    ${user}=    Session User From Auth Response    ${alias}    ${resp.json()}    ${email}    ${password}
    RETURN    ${user}

Session User From Auth Response
    [Arguments]    ${alias}    ${auth}    ${email}    ${password}
    Should Not Be Empty    ${auth}[accessToken]
    Update Session    ${alias}    headers=${{ {'Authorization': 'Bearer ' + $auth['accessToken']} }}
    VAR    &{user}    alias=${alias}    email=${email}    password=${password}    token=${auth}[accessToken]
    ...    id=${auth}[user][id]    displayName=${auth}[user][displayName]
    RETURN    ${user}

Personal Workspace Id
    [Documentation]    The personal workspace every registered user owns.
    [Arguments]    ${user}
    ${resp}=    GET On Session    ${user}[alias]    /me    expected_status=200
    FOR    ${ws}    IN    @{resp.json()}[workspaces]
        IF    '${ws}[kind]' == 'personal'    RETURN    ${ws}[id]
    END
    Fail    ${user}[email] has no personal workspace

Workspace Id By Name
    [Arguments]    ${user}    ${name}
    ${resp}=    GET On Session    ${user}[alias]    /me    expected_status=200
    FOR    ${ws}    IN    @{resp.json()}[workspaces]
        IF    $ws['name'] == $name    RETURN    ${ws}[id]
    END
    Fail    ${user}[email] is not a member of workspace "${name}"

Create Company Workspace Via API
    [Documentation]    New company workspace owned by ``${user}``. Returns its id.
    [Arguments]    ${user}    ${name}=${EMPTY}
    VAR    ${ws_name}    ${name}
    IF    $name == ''
        ${ws_name}=    Unique Name    บริษัททดสอบ
    END
    VAR    &{body}    name=${ws_name}
    ${resp}=    POST On Session    ${user}[alias]    /workspaces    json=${body}    expected_status=201
    RETURN    ${resp.json()}[id]

Create Project Via API
    [Documentation]    New cloud project in ``${workspace_id}``. Returns the ``ProjectDetailDto`` (``project``, ``docs``).
    [Arguments]    ${user}    ${workspace_id}    ${name}=${EMPTY}    ${start}=blank    &{extra}
    VAR    ${p_name}    ${name}
    IF    $name == ''
        ${p_name}=    Unique Name
    END
    VAR    &{body}    name=${p_name}    start=${start}
    Set To Dictionary    ${body}    &{extra}
    ${resp}=    POST On Session    ${user}[alias]    /workspaces/${workspace_id}/projects    json=${body}
    ...    expected_status=201
    RETURN    ${resp.json()}

Error Code Should Be
    [Documentation]    API errors are ``{ code, message, details? }``: check the code.
    [Arguments]    ${resp}    ${code}
    ${json}=    Set Variable    ${resp.json()}
    Should Be Equal    ${json}[code]    ${code}    msg=Expected error code ${code}, got ${json}
