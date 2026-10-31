*** Settings ***
Documentation       Company rate cards (``/workspaces/:id/rate-cards``, คลังอัตราค่าแรงของบริษัท): a named pair of daily
...                 wages (skilled / labourer, whole baht 0-100,000) that crews are priced by. Owner and admin manage,
...                 an estimator may add, a viewer reads, an outsider gets 404, anonymous 401. Names are unique among
...                 active cards (case-insensitive), at most 50 active cards, archive is a soft delete. The library
...                 needs no module switch: it works with the workforce module off. Rows are read back from ``rate_cards``.
Resource            ../../resources/pages/api_workforce.resource
Test Tags           api    workforce    rate-cards    db


*** Test Cases ***
Owner Adds A Rate Card And The Row Is Stored
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${resp}=    Create Rate Card Via API    ${team}[owner]    ${team}[ws]    201    name=ชุด A    skilledRate=${800}
    ...    labourerRate=${500}    note=ราคากลาง
    ${card}=    Set Variable    ${resp.json()}
    Should Be Equal    ${card}[name]    ชุด A
    Should Be Equal As Integers    ${card}[skilledRate]    800
    Should Be Equal As Integers    ${card}[labourerRate]    500
    Should Be Equal    ${card}[note]    ราคากลาง
    Should Be Equal    ${card}[workspaceId]    ${team}[ws]
    Should Be Equal    ${card}[createdBy]    ${team}[owner][id]
    Should Be Equal    ${card}[archivedAt]    ${None}
    ${row}=    Rate Card Row    ${card}[id]
    Should Be Equal As Strings    ${row}[workspace_id]    ${team}[ws]
    Should Be Equal    ${row}[skilled_rate]    ${800}
    Should Be Equal    ${row}[labourer_rate]    ${500}
    Should Be Equal As Strings    ${row}[created_by]    ${team}[owner][id]
    Should Be Equal    ${row}[archived_at]    ${None}

Admin And Estimator Can Add A Rate Card
    [Tags]    security
    ${team}=    Create Workforce Team
    FOR    ${role}    IN    admin    estimator
        ${resp}=    Create Rate Card Via API    ${team}[${role}]    ${team}[ws]
        ${row}=    Rate Card Row    ${resp.json()}[id]
        Should Be Equal As Strings    ${row}[created_by]    ${team}[${role}][id]
    END

Viewer Outsider And Anonymous Cannot Add A Rate Card
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    ${body}=    Rate Card Body
    Wf Error    ${team}[viewer]    POST    /workspaces/${team}[ws]/rate-cards    403    forbidden    ${body}
    Wf Error    ${team}[outsider]    POST    /workspaces/${team}[ws]/rate-cards    404    not_found    ${body}
    ${anon}=    Create Anonymous Session    anon
    VAR    &{caller}    alias=${anon}
    Wf Error    ${caller}    POST    /workspaces/${team}[ws]/rate-cards    401    unauthenticated    ${body}
    ${n}=    Count Rows    select count(*) from rate_cards where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Every Member Reads The Library And Outsiders Do Not
    [Tags]    security
    ${team}=    Create Workforce Team
    Add Rate Card    ${team}[owner]    ${team}[ws]
    FOR    ${role}    IN    owner    admin    estimator    viewer
        ${resp}=    List Rate Cards    ${team}[${role}]    ${team}[ws]
        Length Should Be    ${resp.json()}    1
    END
    ${resp}=    List Rate Cards    ${team}[outsider]    ${team}[ws]    404
    Error Code Should Be    ${resp}    not_found
    ${anon}=    Create Anonymous Session    anon
    VAR    &{caller}    alias=${anon}
    Wf Error    ${caller}    GET    /workspaces/${team}[ws]/rate-cards    401    unauthenticated

Rate Card Optional Note Defaults To Null And Blank Becomes Null
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${plain}=    Add Rate Card    ${team}[owner]    ${team}[ws]
    Should Be Equal    ${plain}[note]    ${None}
    ${blank}=    Add Rate Card    ${team}[owner]    ${team}[ws]    note=${SPACE}${SPACE}
    Should Be Equal    ${blank}[note]    ${None}
    ${row}=    Rate Card Row    ${blank}[id]
    Should Be Equal    ${row}[note]    ${None}

Boundary Values Of A Rate Card Are Accepted
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${name}=    Evaluate    'ก' * 60
    ${note}=    Evaluate    'ข' * 500
    ${max}=    Add Rate Card    ${team}[owner]    ${team}[ws]    name=${name}    skilledRate=${100000}    labourerRate=${100000}
    ...    note=${note}
    Should Be Equal As Integers    ${max}[skilledRate]    100000
    ${zero}=    Add Rate Card    ${team}[owner]    ${team}[ws]    skilledRate=${0}    labourerRate=${0}
    ${row}=    Rate Card Row    ${zero}[id]
    Should Be Equal    ${row}[skilled_rate]    ${0}
    Should Be Equal    ${row}[labourer_rate]    ${0}

Rate Card Name Is Trimmed
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]    name=${SPACE}${SPACE}ชุด B${SPACE}
    Should Be Equal    ${card}[name]    ชุด B
    ${row}=    Rate Card Row    ${card}[id]
    Should Be Equal    ${row}[name]    ชุด B

Invalid Rate Card Fields Are Rejected With Validation Failed
    [Tags]    negative
    [Template]    Rate Card Field Should Be Rejected
    name            ${EMPTY}
    name            ${SPACE}${SPACE}
    name            ${{ 'ก' * 61 }}
    name            ${None}
    name            ${5}
    skilledRate     ${-1}
    skilledRate     ${100001}
    skilledRate     ${800.5}
    skilledRate     800
    skilledRate     ${None}
    labourerRate    ${-1}
    labourerRate    ${100001}
    labourerRate    ${0.1}
    labourerRate    ${None}
    note            ${{ 'ข' * 501 }}

Rate Card Body With A Missing Required Field Is Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${missing}    IN    name    skilledRate    labourerRate
        ${body}=    Rate Card Body
        Remove From Dictionary    ${body}    ${missing}
        Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/rate-cards    400    validation_failed    ${body}
    END
    Post Raw Body    ${team}[owner]    POST    /workspaces/${team}[ws]/rate-cards    {broken    400
    ${n}=    Count Rows    select count(*) from rate_cards where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Rate Card Names Are Unique Among Active Cards Ignoring Case
    [Tags]    smoke    negative
    ${team}=    Create Workforce Team
    Add Rate Card    ${team}[owner]    ${team}[ws]    name=Set A
    FOR    ${dup}    IN    Set A    SET A    set a    ${SPACE}set a${SPACE}
        ${body}=    Rate Card Body    name=${dup}
        ${resp}=    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/rate-cards    409    conflict    ${body}
        Conflict Reason Should Be    ${resp}    name_taken
    END
    ${n}=    Count Rows    select count(*) from rate_cards where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    1

An Archived Card Frees Its Name And The Same Name Lives In Another Company
    [Tags]    state    security
    ${team}=    Create Workforce Team
    ${other}=    Create Second Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]    name=Set Z
    Add Rate Card    ${other}[owner]    ${other}[ws]    name=Set Z
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/rate-cards/${card}[id]    204
    ${again}=    Add Rate Card    ${team}[owner]    ${team}[ws]    name=Set Z
    Should Not Be Equal    ${again}[id]    ${card}[id]

Owner Changes A Rate Card Partially
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]    skilledRate=${800}    labourerRate=${500}    note=เดิม
    VAR    &{patch}    labourerRate=${550}    name=ชุดใหม่
    ${resp}=    Wf Call    ${team}[admin]    PATCH    /workspaces/${team}[ws]/rate-cards/${card}[id]    200    ${patch}
    Should Be Equal    ${resp.json()}[name]    ชุดใหม่
    Should Be Equal As Integers    ${resp.json()}[skilledRate]    800
    Should Be Equal As Integers    ${resp.json()}[labourerRate]    550
    Should Be Equal    ${resp.json()}[note]    เดิม
    ${row}=    Rate Card Row    ${card}[id]
    Should Be Equal    ${row}[name]    ชุดใหม่
    Should Be Equal    ${row}[labourer_rate]    ${550}
    Should Be Equal    ${row}[note]    เดิม

Null Or Blank Note Clears The Note
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]    note=เดิม
    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${card}[id]    200    ${{ {'note': None} }}
    ${row}=    Rate Card Row    ${card}[id]
    Should Be Equal    ${row}[note]    ${None}
    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${card}[id]    200    ${{ {'note': 'ใหม่'} }}
    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${card}[id]    200    ${{ {'note': ' '} }}
    ${row}=    Rate Card Row    ${card}[id]
    Should Be Equal    ${row}[note]    ${None}

Renaming Into Another Cards Name Is A Conflict
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${one}=    Add Rate Card    ${team}[owner]    ${team}[ws]    name=One
    Add Rate Card    ${team}[owner]    ${team}[ws]    name=Two
    ${resp}=    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${one}[id]    409    conflict
    ...    ${{ {'name': 'TWO'} }}
    Conflict Reason Should Be    ${resp}    name_taken
    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${one}[id]    200    ${{ {'name': 'ONE'} }}
    ${row}=    Rate Card Row    ${one}[id]
    Should Be Equal    ${row}[name]    ONE

Empty Or Invalid Rate Card Update Is Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]    skilledRate=${800}
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${card}[id]    400    validation_failed    ${{ {} }}
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${card}[id]    400    validation_failed
    ...    ${{ {'skilledRate': 100001} }}
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${card}[id]    400    validation_failed
    ...    ${{ {'name': ''} }}
    ${row}=    Rate Card Row    ${card}[id]
    Should Be Equal    ${row}[skilled_rate]    ${800}

Estimator And Viewer Cannot Change Or Archive A Rate Card
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]    skilledRate=${800}
    FOR    ${role}    IN    estimator    viewer
        Wf Error    ${team}[${role}]    PATCH    /workspaces/${team}[ws]/rate-cards/${card}[id]    403    forbidden
        ...    ${{ {'skilledRate': 1} }}
        Wf Error    ${team}[${role}]    DELETE    /workspaces/${team}[ws]/rate-cards/${card}[id]    403    forbidden
    END
    ${row}=    Rate Card Row    ${card}[id]
    Should Be Equal    ${row}[skilled_rate]    ${800}
    Should Be Equal    ${row}[archived_at]    ${None}

Archiving A Rate Card Removes It From The Library
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]
    Wf Call    ${team}[admin]    DELETE    /workspaces/${team}[ws]/rate-cards/${card}[id]    204
    ${resp}=    List Rate Cards    ${team}[owner]    ${team}[ws]
    Should Be Empty    ${resp.json()}
    Archived At Should Be Set    rate_cards    ${card}[id]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/rate-cards/${card}[id]    204
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${card}[id]    404    not_found    ${{ {'note': 'x'} }}

Unknown Or Malformed Rate Card Ids Answer 404
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${bad}    IN    ${ZERO ID}    not-a-uuid
        Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${bad}    404    not_found    ${{ {'note': 'x'} }}
        Wf Error    ${team}[owner]    DELETE    /workspaces/${team}[ws]/rate-cards/${bad}    404    not_found
    END

A Workspace Keeps At Most 50 Active Rate Cards
    [Tags]    slow    edge
    ${team}=    Create Workforce Team
    Bulk Create    ${team}[owner]    /workspaces/${team}[ws]/rate-cards    ${{ {'skilledRate': 800, 'labourerRate': 500} }}    50
    ...    name_key=name
    ${body}=    Rate Card Body
    ${resp}=    Wf Error    ${team}[estimator]    POST    /workspaces/${team}[ws]/rate-cards    409    conflict    ${body}
    Conflict Reason Should Be    ${resp}    limit_reached
    Should Be Equal As Integers    ${resp.json()}[details][limit]    50
    ${first}=    Query Value    select id from rate_cards where workspace_id = %s limit 1    ${team}[ws]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/rate-cards/${first}    204
    Create Rate Card Via API    ${team}[owner]    ${team}[ws]    201

Rate Cards Of One Company Are Invisible To Another
    [Tags]    smoke    security
    ${a}=    Create Workforce Team
    ${b}=    Create Second Workforce Team
    ${card}=    Add Rate Card    ${a}[owner]    ${a}[ws]    skilledRate=${900}
    ${theirs}=    List Rate Cards    ${b}[owner]    ${b}[ws]
    Should Be Empty    ${theirs.json()}
    Wf Error    ${b}[owner]    GET    /workspaces/${a}[ws]/rate-cards    404    not_found
    Wf Error    ${b}[owner]    PATCH    /workspaces/${b}[ws]/rate-cards/${card}[id]    404    not_found    ${{ {'skilledRate': 1} }}
    Wf Error    ${b}[owner]    DELETE    /workspaces/${b}[ws]/rate-cards/${card}[id]    404    not_found
    Wf Error    ${b}[owner]    PATCH    /workspaces/${a}[ws]/rate-cards/${card}[id]    404    not_found    ${{ {'skilledRate': 1} }}
    ${row}=    Rate Card Row    ${card}[id]
    Should Be Equal    ${row}[skilled_rate]    ${900}
    Should Be Equal    ${row}[archived_at]    ${None}

Rate Cards Work With The Workforce Module Switched Off
    [Documentation]    The library is core, not part of the module: no ``module_disabled``.
    [Tags]    state
    ${team}=    Create Workforce Team    module_on=${False}
    Add Rate Card    ${team}[owner]    ${team}[ws]
    ${resp}=    List Rate Cards    ${team}[viewer]    ${team}[ws]
    Length Should Be    ${resp.json()}    1

Parallel Creates Of One Rate Card Name Yield Exactly One Card
    [Tags]    concurrency
    ${team}=    Create Workforce Team
    ${body}=    Rate Card Body    name=ชุดแย่งชื่อ
    ${responses}=    Fire Parallel Requests    ${team}[owner]    POST    /workspaces/${team}[ws]/rate-cards    ${body}    6
    ${codes}=    Status Codes Of    ${responses}
    Should Be Equal    ${codes}    ${{ [201] + [409] * 5 }}
    ${n}=    Count Rows    select count(*) from rate_cards where workspace_id = %s and name = %s    ${team}[ws]    ชุดแย่งชื่อ
    Should Be Equal As Integers    ${n}    1


*** Keywords ***
Rate Card Field Should Be Rejected
    [Documentation]    A rate card body with this one field wrong answers 400 ``validation_failed`` and stores nothing.
    [Arguments]    ${field}    ${value}
    ${team}=    Create Workforce Team
    ${body}=    Rate Card Body
    Set To Dictionary    ${body}    ${field}=${value}
    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/rate-cards    400    validation_failed    ${body}
    ${n}=    Count Rows    select count(*) from rate_cards where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0
