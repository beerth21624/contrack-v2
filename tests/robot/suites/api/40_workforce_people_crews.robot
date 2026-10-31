*** Settings ***
Documentation       Workforce module, people and crews (``/workspaces/:id/people`` and ``/crews``): create, list, change,
...                 archive; validation; who may do what (owner / admin manage, estimator and viewer read, outsider 404,
...                 anonymous 401); wages hidden by role (person wage: owner and admin; crew cost: owner, admin and
...                 estimator); unique active crew names; archive guarded by running assignments; limits; tenant
...                 isolation and concurrency. Every write is read back from the database.
Resource            ../../resources/pages/api_workforce.resource
Test Tags           api    workforce    db


*** Test Cases ***
# ── people: create ─────────────────────────────────────────────────────────────────
Owner Adds A Person And The Row Is Stored
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${resp}=    Create Person Via API    ${team}[owner]    ${team}[ws]    201    name=สมชาย ใจดี    nickname=ชาย
    ...    phone=081-234-5678    role=foreman    employment=permanent    trades=${{ ['masonry', 'tiling'] }}
    ...    dailyWage=${650}    note=ช่างเก่า
    ${person}=    Set Variable    ${resp.json()}
    Should Be Equal    ${person}[name]    สมชาย ใจดี
    Should Be Equal    ${person}[workspaceId]    ${team}[ws]
    Should Be Equal    ${person}[role]    foreman
    Should Be Equal    ${person}[employment]    permanent
    Should Be Equal    ${person}[trades]    ${{ ['masonry', 'tiling'] }}
    Should Be Equal As Integers    ${person}[dailyWage]    650
    Should Be Equal    ${person}[wagesHidden]    ${False}
    Should Be Equal    ${person}[archivedAt]    ${None}
    ${row}=    Person Row    ${person}[id]
    Should Be Equal As Strings    ${row}[workspace_id]    ${team}[ws]
    Should Be Equal    ${row}[name]    สมชาย ใจดี
    Should Be Equal    ${row}[phone]    081-234-5678
    Should Be Equal    ${row}[trades]    ${{ ['masonry', 'tiling'] }}
    Should Be Equal    ${row}[daily_wage]    ${650}
    Should Be Equal    ${row}[archived_at]    ${None}

Optional Person Fields Default To Empty
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    Should Be Equal    ${person}[nickname]    ${None}
    Should Be Equal    ${person}[phone]    ${None}
    Should Be Equal    ${person}[dailyWage]    ${None}
    Should Be Equal    ${person}[note]    ${None}
    Should Be Equal    ${person}[trades]    ${{ [] }}
    ${row}=    Person Row    ${person}[id]
    Should Be Equal    ${row}[trades]    ${{ [] }}
    Should Be Equal    ${row}[daily_wage]    ${None}

Admin Can Add A Person
    [Tags]    security
    ${team}=    Create Workforce Team
    ${resp}=    Create Person Via API    ${team}[admin]    ${team}[ws]
    ${row}=    Person Row    ${resp.json()}[id]
    Should Be Equal As Strings    ${row}[workspace_id]    ${team}[ws]

Estimator And Viewer Cannot Add A Person
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    FOR    ${role}    IN    estimator    viewer
        ${body}=    Person Body
        Wf Error    ${team}[${role}]    POST    /workspaces/${team}[ws]/people    403    forbidden    ${body}
    END
    ${n}=    Count Rows    select count(*) from people where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Outsider And Anonymous Callers Cannot Touch People
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    ${body}=    Person Body
    Wf Error    ${team}[outsider]    POST    /workspaces/${team}[ws]/people    404    not_found    ${body}
    Wf Error    ${team}[outsider]    GET    /workspaces/${team}[ws]/people    404    not_found
    Wf Error    ${team}[outsider]    PATCH    /workspaces/${team}[ws]/people/${person}[id]    404    not_found    ${{ {'note': 'x'} }}
    Wf Error    ${team}[outsider]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    404    not_found    ${None}
    ${anon}=    Create Anonymous Session    anon
    VAR    &{caller}    alias=${anon}
    Wf Error    ${caller}    GET    /workspaces/${team}[ws]/people    401    unauthenticated
    Wf Error    ${caller}    POST    /workspaces/${team}[ws]/people    401    unauthenticated    ${body}
    ${n}=    Count Rows    select count(*) from people where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    1
    Archived At Should Be Empty    people    ${person}[id]

People May Share A Name
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${first}=    Add Person    ${team}[owner]    ${team}[ws]    name=สมศักดิ์ แซ่ลิ้ม
    ${second}=    Add Person    ${team}[owner]    ${team}[ws]    name=สมศักดิ์ แซ่ลิ้ม
    Should Not Be Equal    ${first}[id]    ${second}[id]
    ${n}=    Count Rows    select count(*) from people where workspace_id = %s and name = %s    ${team}[ws]    สมศักดิ์ แซ่ลิ้ม
    Should Be Equal As Integers    ${n}    2

Person Texts Are Trimmed And Blank Optional Texts Become Null
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    name=${SPACE}${SPACE}นายช่าง${SPACE}    nickname=${SPACE}${SPACE}
    ...    note=${SPACE}
    Should Be Equal    ${person}[name]    นายช่าง
    Should Be Equal    ${person}[nickname]    ${None}
    Should Be Equal    ${person}[note]    ${None}
    ${row}=    Person Row    ${person}[id]
    Should Be Equal    ${row}[name]    นายช่าง
    Should Be Equal    ${row}[nickname]    ${None}

Duplicate Trades Of A Person Are Dropped And The Order Is Kept
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    trades=${{ ['tiling', 'masonry', 'tiling', 'masonry', 'painting'] }}
    Should Be Equal    ${person}[trades]    ${{ ['tiling', 'masonry', 'painting'] }}
    ${row}=    Person Row    ${person}[id]
    Should Be Equal    ${row}[trades]    ${{ ['tiling', 'masonry', 'painting'] }}

Every Trade Role And Employment Value Is Accepted
    [Tags]    edge
    ${team}=    Create Workforce Team
    @{trades}=    Create List    site-prep    temp-utilities    piling    structure    roof-structure    roofing    masonry
    ...    electrical    plumbing    ceiling    tiling    painting    doors-windows    misc
    ${all}=    Add Person    ${team}[owner]    ${team}[ws]    trades=${trades}
    Should Be Equal    ${all}[trades]    ${trades}
    FOR    ${role}    IN    foreman    supervisor    engineer    skilled    labourer
        Add Person    ${team}[owner]    ${team}[ws]    role=${role}
    END
    FOR    ${employment}    IN    permanent    daily    subcontractor
        Add Person    ${team}[owner]    ${team}[ws]    employment=${employment}
    END

Boundary Values Of A Person Are Accepted
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${long_name}=    Evaluate    'ก' * 80
    ${nick}=    Evaluate    'น' * 40
    ${note}=    Evaluate    'ข' * 500
    ${phone}=    Evaluate    '0' * 20
    ${max}=    Add Person    ${team}[owner]    ${team}[ws]    name=${long_name}    nickname=${nick}    note=${note}
    ...    phone=${phone}    dailyWage=${100000}
    Should Be Equal    ${max}[name]    ${long_name}
    ${zero}=    Add Person    ${team}[owner]    ${team}[ws]    dailyWage=${0}    phone=+66 81-234-5678
    Should Be Equal As Integers    ${zero}[dailyWage]    0
    ${row}=    Person Row    ${zero}[id]
    Should Be Equal    ${row}[daily_wage]    ${0}
    Should Be Equal    ${row}[phone]    +66 81-234-5678

Invalid Person Fields Are Rejected With Validation Failed
    [Documentation]    One bad field at a time; nothing is stored.
    [Tags]    negative
    [Template]    Person Field Should Be Rejected
    name            ${EMPTY}
    name            ${SPACE}${SPACE}
    name            ${{ 'ก' * 81 }}
    name            ${123}
    name            ${None}
    role            captain
    role            ${None}
    employment      freelance
    employment      ${None}
    trades          ${{ ['bricklaying'] }}
    trades          masonry
    trades          ${{ ['misc'] * 15 }}
    phone           081-abc-1234
    phone           ${{ '1' * 21 }}
    dailyWage       ${-1}
    dailyWage       ${100001}
    dailyWage       ${650.5}
    dailyWage       650
    nickname        ${{ 'น' * 41 }}
    note            ${{ 'ข' * 501 }}

Malformed Person Body Is Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${raw}    IN    {not json    []    "text"    null    ${EMPTY}
        ${resp}=    Post Raw Body    ${team}[owner]    POST    /workspaces/${team}[ws]/people    ${raw}    400
        Error Code Should Be    ${resp}    validation_failed
    END
    ${n}=    Count Rows    select count(*) from people where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Unknown Fields Cannot Smuggle Another Workspace Or An Archive Date
    [Tags]    security
    ${team}=    Create Workforce Team
    ${other}=    Create Second Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    workspaceId=${other}[ws]    archivedAt=2020-01-01T00:00:00Z
    ...    id=${ZERO ID}
    Should Be Equal    ${person}[workspaceId]    ${team}[ws]
    Should Not Be Equal    ${person}[id]    ${ZERO ID}
    Should Be Equal    ${person}[archivedAt]    ${None}
    ${n}=    Count Rows    select count(*) from people where workspace_id = %s    ${other}[ws]
    Should Be Equal As Integers    ${n}    0

# ── people: wages by role ──────────────────────────────────────────────────────────
Daily Wage Of A Person Is Visible To Owner And Admin Only
    [Tags]    smoke    security
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    dailyWage=${700}
    FOR    ${role}    IN    owner    admin
        ${resp}=    List People    ${team}[${role}]    ${team}[ws]
        Should Be Equal As Integers    ${resp.json()}[0][dailyWage]    700
        Should Be Equal    ${resp.json()}[0][wagesHidden]    ${False}
    END
    FOR    ${role}    IN    estimator    viewer
        ${resp}=    List People    ${team}[${role}]    ${team}[ws]
        Should Be Equal    ${resp.json()}[0][dailyWage]    ${None}
        Should Be Equal    ${resp.json()}[0][wagesHidden]    ${True}
        Should Not Contain    ${resp.text}    700
    END
    ${row}=    Person Row    ${person}[id]
    Should Be Equal    ${row}[daily_wage]    ${700}

Every Member Can Read The People List
    [Tags]    security
    ${team}=    Create Workforce Team
    Add Person    ${team}[owner]    ${team}[ws]
    FOR    ${role}    IN    owner    admin    estimator    viewer
        ${resp}=    List People    ${team}[${role}]    ${team}[ws]
        Length Should Be    ${resp.json()}    1
    END

Person Without A Wage Is Not Flagged As Hidden For Owner
    [Tags]    edge
    ${team}=    Create Workforce Team
    Add Person    ${team}[owner]    ${team}[ws]
    ${resp}=    List People    ${team}[owner]    ${team}[ws]
    Should Be Equal    ${resp.json()}[0][dailyWage]    ${None}
    Should Be Equal    ${resp.json()}[0][wagesHidden]    ${False}

# ── people: change ─────────────────────────────────────────────────────────────────
Owner Changes A Person Partially
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    nickname=ต้อม    dailyWage=${500}    trades=${{ ['masonry'] }}
    VAR    &{patch}    role=engineer    dailyWage=${900}
    ${resp}=    Wf Call    ${team}[admin]    PATCH    /workspaces/${team}[ws]/people/${person}[id]    200    ${patch}
    Should Be Equal    ${resp.json()}[role]    engineer
    Should Be Equal As Integers    ${resp.json()}[dailyWage]    900
    Should Be Equal    ${resp.json()}[nickname]    ต้อม
    Should Be Equal    ${resp.json()}[trades]    ${{ ['masonry'] }}
    ${row}=    Person Row    ${person}[id]
    Should Be Equal    ${row}[role]    engineer
    Should Be Equal    ${row}[daily_wage]    ${900}
    Should Be Equal    ${row}[nickname]    ต้อม
    Should Be True    $row['updated_at'] >= $row['created_at']

Null Clears The Optional Fields Of A Person
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    nickname=ต้อม    phone=0812345678    dailyWage=${500}    note=หมายเหตุ
    VAR    &{patch}    nickname=${None}    phone=${None}    dailyWage=${None}    note=${None}
    ${resp}=    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/people/${person}[id]    200    ${patch}
    Should Be Equal    ${resp.json()}[nickname]    ${None}
    ${row}=    Person Row    ${person}[id]
    Should Be Equal    ${row}[nickname]    ${None}
    Should Be Equal    ${row}[phone]    ${None}
    Should Be Equal    ${row}[daily_wage]    ${None}
    Should Be Equal    ${row}[note]    ${None}

Empty Person Update Is Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/people/${person}[id]    400    validation_failed    ${{ {} }}

Invalid Person Update Is Rejected And Changes Nothing
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    dailyWage=${500}
    VAR    &{bad}    name=ok name    dailyWage=${100001}
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/people/${person}[id]    400    validation_failed    ${bad}
    ${row}=    Person Row    ${person}[id]
    Should Be Equal    ${row}[name]    ${person}[name]
    Should Be Equal    ${row}[daily_wage]    ${500}

Estimator And Viewer Cannot Change Or Archive A Person
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    dailyWage=${500}
    FOR    ${role}    IN    estimator    viewer
        Wf Error    ${team}[${role}]    PATCH    /workspaces/${team}[ws]/people/${person}[id]    403    forbidden
        ...    ${{ {'dailyWage': 1} }}
        Wf Error    ${team}[${role}]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    403    forbidden
    END
    ${row}=    Person Row    ${person}[id]
    Should Be Equal    ${row}[daily_wage]    ${500}
    Should Be Equal    ${row}[archived_at]    ${None}

Person Update Response Hides The Wage From Nobody Who May Update
    [Documentation]    Only owner and admin may update a person, and both see wages, so the update response shows it.
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]    dailyWage=${500}
    ${resp}=    Wf Call    ${team}[admin]    PATCH    /workspaces/${team}[ws]/people/${person}[id]    200    ${{ {'note': 'n'} }}
    Should Be Equal As Integers    ${resp.json()}[dailyWage]    500
    Should Be Equal    ${resp.json()}[wagesHidden]    ${False}

Unknown Or Malformed Person Ids Answer 404
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${bad}    IN    ${ZERO ID}    not-a-uuid    123
        Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/people/${bad}    404    not_found    ${{ {'note': 'x'} }}
        Wf Error    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${bad}    404    not_found
    END

# ── people: archive ────────────────────────────────────────────────────────────────
Archiving A Person Hides It From The List And Keeps The Row
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    Wf Call    ${team}[admin]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    204
    ${ids}=    Person Ids Listed For    ${team}[owner]    ${team}[ws]
    Should Not Contain    ${ids}    ${person}[id]
    Archived At Should Be Set    people    ${person}[id]

Archiving A Person Twice Is A No-Op
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    204
    ${first}=    Query Value    select archived_at from people where id = %s    ${person}[id]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    204
    ${second}=    Query Value    select archived_at from people where id = %s    ${person}[id]
    Should Be Equal    ${first}    ${second}

An Archived Person Cannot Be Updated
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    204
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/people/${person}[id]    404    not_found    ${{ {'note': 'x'} }}

Archiving A Person Removes Them From Crews And Supervisors
    [Documentation]    The person leaves every crew (as leader and as member) and every project's supervisors; the crew
    ...    itself stays active.
    [Tags]    state
    ${team}=    Create Workforce Team
    ${leader}=    Add Person    ${team}[owner]    ${team}[ws]    role=foreman
    ${member}=    Add Person    ${team}[owner]    ${team}[ws]
    ${keeper}=    Add Person    ${team}[owner]    ${team}[ws]
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    leaderId=${leader}[id]
    ...    memberIds=${{ [$leader['id'], $member['id'], $keeper['id']] }}
    Put Supervisors    ${team}[owner]    ${team}[project_id]    ${{ [$leader['id'], $keeper['id']] }}
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${leader}[id]    204
    ${row}=    Crew Row    ${crew}[id]
    Should Be Equal    ${row}[leader_id]    ${None}
    Should Be Equal    ${row}[archived_at]    ${None}
    ${members}=    Crew Member Ids In Database    ${crew}[id]
    Should Be Equal    ${members}    ${{ [$member['id'], $keeper['id']] }}
    ${supervisors}=    Supervisor Ids In Database    ${team}[project_id]
    Should Be Equal    ${supervisors}    ${{ [$keeper['id']] }}
    ${listed}=    List Crews    ${team}[owner]    ${team}[ws]
    Should Be Equal    ${listed.json()}[0][leaderId]    ${None}
    Should Be Equal    ${listed.json()}[0][memberIds]    ${{ [$member['id'], $keeper['id']] }}

Person On A Crew With A Running Assignment Cannot Be Archived
    [Tags]    smoke    negative
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    memberIds=${{ [$person['id']] }}
    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    task_id=3.1
    ${resp}=    Wf Error    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    409    conflict
    Conflict Reason Should Be    ${resp}    in_use
    Should Be Equal As Integers    ${resp.json()}[details][assignments]    2
    Archived At Should Be Empty    people    ${person}[id]
    ${members}=    Crew Member Ids In Database    ${crew}[id]
    Should Be Equal    ${members}    ${{ [$person['id']] }}

Person Can Be Archived Once Only Past Assignments Remain
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    leaderId=${person}[id]
    ${past}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    start=${PAST START}
    ...    end=${PAST END}
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    204
    Archived At Should Be Set    people    ${person}[id]
    ${n}=    Count Rows    select count(*) from crew_assignments where id = %s    ${past}[id]
    Should Be Equal As Integers    ${n}    1

Person Can Be Archived After The Running Assignment Is Removed
    [Tags]    state
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    memberIds=${{ [$person['id']] }}
    ${assignment}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    Wf Error    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    409    conflict
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crew-assignments/${assignment}[id]    204
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    204
    Archived At Should Be Set    people    ${person}[id]

# ── people: limit and isolation ────────────────────────────────────────────────────
A Workspace Keeps At Most 500 Active People
    [Documentation]    MAX_ACTIVE_PEOPLE: the 501st is a 409 ``limit_reached``; archiving one frees a place.
    [Tags]    slow    edge
    ${team}=    Create Workforce Team
    Bulk Create    ${team}[owner]    /workspaces/${team}[ws]/people    ${{ {'name': 'คนงาน', 'role': 'labourer', 'employment': 'daily'} }}    500
    ${n}=    Count Rows    select count(*) from people where workspace_id = %s and archived_at is null    ${team}[ws]
    Should Be Equal As Integers    ${n}    500
    ${body}=    Person Body
    ${resp}=    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/people    409    conflict    ${body}
    Conflict Reason Should Be    ${resp}    limit_reached
    Should Be Equal As Integers    ${resp.json()}[details][limit]    500
    ${first}=    Query Value    select id from people where workspace_id = %s limit 1    ${team}[ws]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${first}    204
    Create Person Via API    ${team}[owner]    ${team}[ws]    201

People Of One Company Are Invisible To Another
    [Tags]    smoke    security
    ${a}=    Create Workforce Team
    ${b}=    Create Second Workforce Team
    ${person}=    Add Person    ${a}[owner]    ${a}[ws]    dailyWage=${600}
    ${theirs}=    List People    ${b}[owner]    ${b}[ws]
    Should Be Empty    ${theirs.json()}
    Wf Error    ${b}[owner]    GET    /workspaces/${a}[ws]/people    404    not_found
    Wf Error    ${b}[owner]    PATCH    /workspaces/${b}[ws]/people/${person}[id]    404    not_found    ${{ {'dailyWage': 1} }}
    Wf Error    ${b}[owner]    DELETE    /workspaces/${b}[ws]/people/${person}[id]    404    not_found
    Wf Error    ${b}[owner]    PATCH    /workspaces/${a}[ws]/people/${person}[id]    404    not_found    ${{ {'dailyWage': 1} }}
    ${row}=    Person Row    ${person}[id]
    Should Be Equal    ${row}[daily_wage]    ${600}
    Should Be Equal    ${row}[archived_at]    ${None}

Parallel Person Creates All Succeed
    [Tags]    concurrency
    ${team}=    Create Workforce Team
    ${body}=    Person Body    name=คู่ขนาน
    ${responses}=    Fire Parallel Requests    ${team}[owner]    POST    /workspaces/${team}[ws]/people    ${body}    8
    ${codes}=    Status Codes Of    ${responses}
    Should Be Equal    ${codes}    ${{ [201] * 8 }}
    ${n}=    Count Rows    select count(*) from people where workspace_id = %s and name = %s    ${team}[ws]    คู่ขนาน
    Should Be Equal As Integers    ${n}    8

Parallel Archives Of One Person Both Succeed
    [Tags]    concurrency
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    ${responses}=    Fire Parallel Requests    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${person}[id]    ${None}    4
    ${codes}=    Status Codes Of    ${responses}
    Should Be Equal    ${codes}    ${{ [204] * 4 }}
    Archived At Should Be Set    people    ${person}[id]

# ── crews: create ──────────────────────────────────────────────────────────────────
Owner Adds A Crew And The Row Is Stored
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${leader}=    Add Person    ${team}[owner]    ${team}[ws]    role=foreman
    ${m1}=    Add Person    ${team}[owner]    ${team}[ws]
    ${m2}=    Add Person    ${team}[owner]    ${team}[ws]
    ${resp}=    Create Crew Via API    ${team}[owner]    ${team}[ws]    201    name=ทีมก่อฉาบช่างแดง    trade=masonry
    ...    leaderId=${leader}[id]    memberIds=${{ [$m2['id'], $m1['id']] }}    skilledCount=${3}    labourerCount=${4}
    ...    note=ทีมหลัก
    ${crew}=    Set Variable    ${resp.json()}
    Should Be Equal    ${crew}[name]    ทีมก่อฉาบช่างแดง
    Should Be Equal    ${crew}[trade]    masonry
    Should Be Equal    ${crew}[leaderId]    ${leader}[id]
    Should Be Equal    ${crew}[memberIds]    ${{ [$m2['id'], $m1['id']] }}
    Should Be Equal    ${crew}[workspaceId]    ${team}[ws]
    Should Be Equal    ${crew}[archivedAt]    ${None}
    ${row}=    Crew Row    ${crew}[id]
    Should Be Equal As Strings    ${row}[workspace_id]    ${team}[ws]
    Should Be Equal    ${row}[trade]    masonry
    Should Be Equal    ${row}[skilled_count]    ${3}
    Should Be Equal    ${row}[labourer_count]    ${4}
    Should Be Equal As Strings    ${row}[leader_id]    ${leader}[id]
    Should Be Equal    ${row}[note]    ทีมหลัก
    ${members}=    Crew Member Ids In Database    ${crew}[id]
    Should Be Equal    ${members}    ${{ [$m2['id'], $m1['id']] }}

Crew Defaults Are Empty And Cost Is Unknown Without A Rate
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    Should Be Equal    ${crew}[leaderId]    ${None}
    Should Be Equal    ${crew}[memberIds]    ${{ [] }}
    Should Be Equal    ${crew}[rateCardId]    ${None}
    Should Be Equal    ${crew}[dailyCostOverride]    ${None}
    Should Be Equal    ${crew}[dailyCost]    ${None}
    Should Be Equal    ${crew}[wagesHidden]    ${False}

Only Owner And Admin Can Add A Crew
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    Create Crew Via API    ${team}[admin]    ${team}[ws]    201
    ${body}=    Crew Body
    FOR    ${role}    IN    estimator    viewer
        Wf Error    ${team}[${role}]    POST    /workspaces/${team}[ws]/crews    403    forbidden    ${body}
    END
    Wf Error    ${team}[outsider]    POST    /workspaces/${team}[ws]/crews    404    not_found    ${body}
    ${n}=    Count Rows    select count(*) from crews where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    1

Anonymous Caller Cannot List Or Add Crews
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    ${anon}=    Create Anonymous Session    anon
    VAR    &{caller}    alias=${anon}
    Wf Error    ${caller}    GET    /workspaces/${team}[ws]/crews    401    unauthenticated
    ${body}=    Crew Body
    Wf Error    ${caller}    POST    /workspaces/${team}[ws]/crews    401    unauthenticated    ${body}

Every Trade Is Accepted For A Crew
    [Tags]    edge
    ${team}=    Create Workforce Team
    FOR    ${trade}    IN    site-prep    temp-utilities    piling    structure    roof-structure    roofing    masonry
    ...    electrical    plumbing    ceiling    tiling    painting    doors-windows    misc
        ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    trade=${trade}
        Should Be Equal    ${crew}[trade]    ${trade}
    END

Boundary Values Of A Crew Are Accepted
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${name}=    Evaluate    'ท' * 80
    ${note}=    Evaluate    'ข' * 500
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=${name}    skilledCount=${200}    labourerCount=${200}
    ...    dailyCostOverride=${100000}    note=${note}
    Should Be Equal As Integers    ${crew}[dailyCost]    100000
    ${zero}=    Add Crew    ${team}[owner]    ${team}[ws]    skilledCount=${0}    labourerCount=${0}    dailyCostOverride=${0}
    Should Be Equal As Integers    ${zero}[dailyCost]    0
    ${row}=    Crew Row    ${zero}[id]
    Should Be Equal    ${row}[daily_cost_override]    ${0}

Invalid Crew Fields Are Rejected With Validation Failed
    [Tags]    negative
    [Template]    Crew Field Should Be Rejected
    name                ${EMPTY}
    name                ${SPACE}
    name                ${{ 'ท' * 81 }}
    name                ${None}
    trade               plumber
    trade               ${None}
    skilledCount        ${-1}
    skilledCount        ${201}
    skilledCount        ${1.5}
    skilledCount        ${None}
    labourerCount       ${-1}
    labourerCount       ${201}
    labourerCount       two
    dailyCostOverride   ${-1}
    dailyCostOverride   ${100001}
    dailyCostOverride   ${10.5}
    note                ${{ 'ข' * 501 }}
    leaderId            not-a-uuid
    memberIds           ${{ ['not-a-uuid'] }}
    memberIds           ${{ ['00000000-0000-4000-8000-0000000000%02d' % i for i in range(201)] }}
    rateCardId          not-a-uuid

Crew Body With A Missing Required Field Is Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${missing}    IN    name    trade    skilledCount    labourerCount
        ${body}=    Crew Body
        Remove From Dictionary    ${body}    ${missing}
        Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crews    400    validation_failed    ${body}
    END
    ${n}=    Count Rows    select count(*) from crews where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

# ── crews: names ───────────────────────────────────────────────────────────────────
Crew Names Are Unique Among Active Crews Ignoring Case
    [Tags]    smoke    negative
    ${team}=    Create Workforce Team
    Add Crew    ${team}[owner]    ${team}[ws]    name=Team Alpha
    FOR    ${dup}    IN    Team Alpha    TEAM ALPHA    team alpha    ${SPACE}Team Alpha${SPACE}
        ${body}=    Crew Body    name=${dup}
        ${resp}=    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crews    409    conflict    ${body}
        Conflict Reason Should Be    ${resp}    name_taken
        Should Be Equal    ${resp.json()}[details][name]    ${dup.strip()}
    END
    ${n}=    Count Rows    select count(*) from crews where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    1

An Archived Crew Frees Its Name
    [Tags]    state
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมซ้ำ
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crews/${crew}[id]    204
    ${again}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีมซ้ำ
    Should Not Be Equal    ${again}[id]    ${crew}[id]
    ${n}=    Count Rows    select count(*) from crews where workspace_id = %s and name = %s    ${team}[ws]    ทีมซ้ำ
    Should Be Equal As Integers    ${n}    2

The Same Crew Name Can Live In Two Companies
    [Tags]    security
    ${a}=    Create Workforce Team
    ${b}=    Create Second Workforce Team
    Add Crew    ${a}[owner]    ${a}[ws]    name=ทีมเดียวกัน
    Add Crew    ${b}[owner]    ${b}[ws]    name=ทีมเดียวกัน

Renaming A Crew Checks The New Name
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${one}=    Add Crew    ${team}[owner]    ${team}[ws]    name=Crew One
    Add Crew    ${team}[owner]    ${team}[ws]    name=Crew Two
    ${resp}=    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crews/${one}[id]    409    conflict
    ...    ${{ {'name': 'crew two'} }}
    Conflict Reason Should Be    ${resp}    name_taken
    ${row}=    Crew Row    ${one}[id]
    Should Be Equal    ${row}[name]    Crew One

A Crew May Change The Case Of Its Own Name
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ทีม a
    ${resp}=    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crews/${crew}[id]    200    ${{ {'name': 'ทีม A'} }}
    Should Be Equal    ${resp.json()}[name]    ทีม A
    ${row}=    Crew Row    ${crew}[id]
    Should Be Equal    ${row}[name]    ทีม A

Parallel Creates Of One Crew Name Yield Exactly One Crew
    [Tags]    concurrency
    ${team}=    Create Workforce Team
    ${body}=    Crew Body    name=ทีมแย่งชื่อ
    ${responses}=    Fire Parallel Requests    ${team}[owner]    POST    /workspaces/${team}[ws]/crews    ${body}    6
    ${codes}=    Status Codes Of    ${responses}
    Should Be Equal    ${codes}    ${{ [201] + [409] * 5 }}
    ${n}=    Count Rows    select count(*) from crews where workspace_id = %s and name = %s    ${team}[ws]    ทีมแย่งชื่อ
    Should Be Equal As Integers    ${n}    1

# ── crews: references ──────────────────────────────────────────────────────────────
Crew Leader And Members Must Be Active People Of The Workspace
    [Documentation]    Unknown, archived or another company's people → 422 ``unprocessable`` naming the field.
    [Tags]    negative    security
    ${team}=    Create Workforce Team
    ${other}=    Create Second Workforce Team
    ${archived}=    Add Person    ${team}[owner]    ${team}[ws]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/people/${archived}[id]    204
    ${foreign}=    Add Person    ${other}[owner]    ${other}[ws]
    FOR    ${bad}    IN    ${ZERO ID}    ${archived}[id]    ${foreign}[id]
        ${body}=    Crew Body    leaderId=${bad}
        ${resp}=    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crews    422    unprocessable    ${body}
        Should Be Equal    ${resp.json()}[details][field]    leaderId
        Should Be Equal    ${resp.json()}[details][ids]    ${{ [$bad] }}
        ${body}=    Crew Body    memberIds=${{ [$bad] }}
        ${resp}=    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crews    422    unprocessable    ${body}
        Should Be Equal    ${resp.json()}[details][field]    memberIds
    END
    ${n}=    Count Rows    select count(*) from crews where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Duplicate Crew Members Are Dropped And Order Is Kept
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${p1}=    Add Person    ${team}[owner]    ${team}[ws]
    ${p2}=    Add Person    ${team}[owner]    ${team}[ws]
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    memberIds=${{ [$p2['id'], $p1['id'], $p2['id']] }}
    Should Be Equal    ${crew}[memberIds]    ${{ [$p2['id'], $p1['id']] }}
    ${members}=    Crew Member Ids In Database    ${crew}[id]
    Should Be Equal    ${members}    ${{ [$p2['id'], $p1['id']] }}

Crew Rate Card Must Be An Active Card Of The Workspace
    [Tags]    negative    security
    ${team}=    Create Workforce Team
    ${other}=    Create Second Workforce Team
    ${archived}=    Add Rate Card    ${team}[owner]    ${team}[ws]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/rate-cards/${archived}[id]    204
    ${foreign}=    Add Rate Card    ${other}[owner]    ${other}[ws]
    FOR    ${bad}    IN    ${ZERO ID}    ${archived}[id]    ${foreign}[id]
        ${body}=    Crew Body    rateCardId=${bad}
        ${resp}=    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crews    422    unprocessable    ${body}
        Should Be Equal    ${resp.json()}[details][field]    rateCardId
    END
    ${n}=    Count Rows    select count(*) from crews where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

# ── crews: pricing and wages ───────────────────────────────────────────────────────
Crew Daily Cost Is Skilled And Labourers Priced By The Rate Card
    [Documentation]    Man-Day formula: skilled x card skilled + labourers x card labourer (3 x 800 + 4 x 500 = 4400).
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]    skilledRate=${800}    labourerRate=${500}
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    skilledCount=${3}    labourerCount=${4}    rateCardId=${card}[id]
    Should Be Equal As Integers    ${crew}[dailyCost]    4400
    ${row}=    Crew Row    ${crew}[id]
    Should Be Equal As Strings    ${row}[rate_card_id]    ${card}[id]
    Should Be Equal    ${row}[daily_cost_override]    ${None}

A Typed Daily Cost Overrides The Rate Card
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    rateCardId=${card}[id]    dailyCostOverride=${3500}
    Should Be Equal As Integers    ${crew}[dailyCost]    3500
    Should Be Equal As Integers    ${crew}[dailyCostOverride]    3500

Changing The Rate Card Reprices The Crew
    [Tags]    state
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]    skilledRate=${800}    labourerRate=${500}
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    skilledCount=${1}    labourerCount=${1}    rateCardId=${card}[id]
    Should Be Equal As Integers    ${crew}[dailyCost]    1300
    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/rate-cards/${card}[id]    200    ${{ {'skilledRate': 1000} }}
    ${listed}=    List Crews    ${team}[owner]    ${team}[ws]
    Should Be Equal As Integers    ${listed.json()}[0][dailyCost]    1500

An Archived Rate Card Still Prices The Crew That Already Uses It
    [Tags]    state    edge
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]    skilledRate=${800}    labourerRate=${500}
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    skilledCount=${2}    labourerCount=${0}    rateCardId=${card}[id]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/rate-cards/${card}[id]    204
    ${listed}=    List Crews    ${team}[owner]    ${team}[ws]
    Should Be Equal As Integers    ${listed.json()}[0][dailyCost]    1600
    Should Be Equal    ${listed.json()}[0][rateCardId]    ${card}[id]

Crew Cost Is Visible To Owner Admin And Estimator But Not Viewer
    [Tags]    smoke    security
    ${team}=    Create Workforce Team
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]    skilledRate=${800}    labourerRate=${500}
    Add Crew    ${team}[owner]    ${team}[ws]    skilledCount=${1}    labourerCount=${1}    rateCardId=${card}[id]
    ...    dailyCostOverride=${2222}
    FOR    ${role}    IN    owner    admin    estimator
        ${resp}=    List Crews    ${team}[${role}]    ${team}[ws]
        Should Be Equal As Integers    ${resp.json()}[0][dailyCost]    2222
        Should Be Equal As Integers    ${resp.json()}[0][dailyCostOverride]    2222
        Should Be Equal    ${resp.json()}[0][wagesHidden]    ${False}
    END
    ${resp}=    List Crews    ${team}[viewer]    ${team}[ws]
    Should Be Equal    ${resp.json()}[0][dailyCost]    ${None}
    Should Be Equal    ${resp.json()}[0][dailyCostOverride]    ${None}
    Should Be Equal    ${resp.json()}[0][wagesHidden]    ${True}
    Should Not Contain    ${resp.text}    2222

# ── crews: change ──────────────────────────────────────────────────────────────────
Owner Changes A Crew Partially
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    trade=masonry    note=เดิม
    VAR    &{patch}    name=ทีมใหม่    trade=tiling    skilledCount=${5}
    ${resp}=    Wf Call    ${team}[admin]    PATCH    /workspaces/${team}[ws]/crews/${crew}[id]    200    ${patch}
    Should Be Equal    ${resp.json()}[name]    ทีมใหม่
    Should Be Equal    ${resp.json()}[trade]    tiling
    Should Be Equal    ${resp.json()}[note]    เดิม
    Should Be Equal As Integers    ${resp.json()}[labourerCount]    ${crew}[labourerCount]
    ${row}=    Crew Row    ${crew}[id]
    Should Be Equal    ${row}[name]    ทีมใหม่
    Should Be Equal    ${row}[trade]    tiling
    Should Be Equal    ${row}[skilled_count]    ${5}

Null Clears Leader Rate Card And Override Of A Crew
    ${team}=    Create Workforce Team
    ${leader}=    Add Person    ${team}[owner]    ${team}[ws]
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    leaderId=${leader}[id]    rateCardId=${card}[id]
    ...    dailyCostOverride=${999}    note=x
    VAR    &{patch}    leaderId=${None}    rateCardId=${None}    dailyCostOverride=${None}    note=${None}
    ${resp}=    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crews/${crew}[id]    200    ${patch}
    Should Be Equal    ${resp.json()}[dailyCost]    ${None}
    ${row}=    Crew Row    ${crew}[id]
    Should Be Equal    ${row}[leader_id]    ${None}
    Should Be Equal    ${row}[rate_card_id]    ${None}
    Should Be Equal    ${row}[daily_cost_override]    ${None}
    Should Be Equal    ${row}[note]    ${None}

Updating Members Replaces The Whole List
    [Tags]    state
    ${team}=    Create Workforce Team
    ${p1}=    Add Person    ${team}[owner]    ${team}[ws]
    ${p2}=    Add Person    ${team}[owner]    ${team}[ws]
    ${p3}=    Add Person    ${team}[owner]    ${team}[ws]
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    memberIds=${{ [$p1['id'], $p2['id']] }}
    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crews/${crew}[id]    200    ${{ {'memberIds': [$p3['id'], $p1['id']]} }}
    ${members}=    Crew Member Ids In Database    ${crew}[id]
    Should Be Equal    ${members}    ${{ [$p3['id'], $p1['id']] }}
    Wf Call    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crews/${crew}[id]    200    ${{ {'memberIds': []} }}
    ${members}=    Crew Member Ids In Database    ${crew}[id]
    Should Be Empty    ${members}

Crew Update References Are Checked Too
    [Tags]    negative    security
    ${team}=    Create Workforce Team
    ${other}=    Create Second Workforce Team
    ${foreign}=    Add Person    ${other}[owner]    ${other}[ws]
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crews/${crew}[id]    422    unprocessable
    ...    ${{ {'leaderId': $foreign['id']} }}
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crews/${crew}[id]    422    unprocessable
    ...    ${{ {'memberIds': [$foreign['id']]} }}
    ${members}=    Crew Member Ids In Database    ${crew}[id]
    Should Be Empty    ${members}

Empty Crew Update Is Rejected
    [Tags]    negative
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crews/${crew}[id]    400    validation_failed    ${{ {} }}

Estimator And Viewer Cannot Change Or Archive A Crew
    [Tags]    security    negative
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]    name=ล็อก
    FOR    ${role}    IN    estimator    viewer
        Wf Error    ${team}[${role}]    PATCH    /workspaces/${team}[ws]/crews/${crew}[id]    403    forbidden    ${{ {'name': 'hacked'} }}
        Wf Error    ${team}[${role}]    DELETE    /workspaces/${team}[ws]/crews/${crew}[id]    403    forbidden
    END
    ${row}=    Crew Row    ${crew}[id]
    Should Be Equal    ${row}[name]    ล็อก
    Should Be Equal    ${row}[archived_at]    ${None}

Every Member Can Read The Crew List
    [Tags]    security
    ${team}=    Create Workforce Team
    Add Crew    ${team}[owner]    ${team}[ws]
    FOR    ${role}    IN    owner    admin    estimator    viewer
        ${resp}=    List Crews    ${team}[${role}]    ${team}[ws]
        Length Should Be    ${resp.json()}    1
    END
    List Crews    ${team}[outsider]    ${team}[ws]    404

Unknown Or Malformed Crew Ids Answer 404
    [Tags]    negative
    ${team}=    Create Workforce Team
    FOR    ${bad}    IN    ${ZERO ID}    not-a-uuid
        Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crews/${bad}    404    not_found    ${{ {'note': 'x'} }}
        Wf Error    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crews/${bad}    404    not_found
    END

# ── crews: archive ─────────────────────────────────────────────────────────────────
Archiving A Crew Hides It From The List And Keeps The Row
    [Tags]    smoke
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    Wf Call    ${team}[admin]    DELETE    /workspaces/${team}[ws]/crews/${crew}[id]    204
    ${ids}=    Crew Ids Listed For    ${team}[owner]    ${team}[ws]
    Should Not Contain    ${ids}    ${crew}[id]
    Archived At Should Be Set    crews    ${crew}[id]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crews/${crew}[id]    204
    Wf Error    ${team}[owner]    PATCH    /workspaces/${team}[ws]/crews/${crew}[id]    404    not_found    ${{ {'note': 'x'} }}

Crew With A Running Assignment Cannot Be Archived
    [Tags]    smoke    negative
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${assignment}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]
    ${resp}=    Wf Error    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crews/${crew}[id]    409    conflict
    Conflict Reason Should Be    ${resp}    in_use
    Should Be Equal As Integers    ${resp.json()}[details][assignments]    1
    Archived At Should Be Empty    crews    ${crew}[id]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crew-assignments/${assignment}[id]    204
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crews/${crew}[id]    204
    Archived At Should Be Set    crews    ${crew}[id]

Crew With Only Past Assignments Can Be Archived
    [Tags]    edge
    ${team}=    Create Workforce Team
    ${crew}=    Add Crew    ${team}[owner]    ${team}[ws]
    ${past}=    Add Assignment    ${team}[owner]    ${team}[ws]    ${team}[project_id]    ${crew}[id]    start=${PAST START}
    ...    end=${PAST END}
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crews/${crew}[id]    204
    Archived At Should Be Set    crews    ${crew}[id]
    ${n}=    Count Rows    select count(*) from crew_assignments where id = %s    ${past}[id]
    Should Be Equal As Integers    ${n}    1

A Workspace Keeps At Most 100 Active Crews
    [Tags]    slow    edge
    ${team}=    Create Workforce Team
    Bulk Create    ${team}[owner]    /workspaces/${team}[ws]/crews    ${{ {'trade': 'misc', 'skilledCount': 1, 'labourerCount': 1} }}    100
    ...    name_key=name
    ${body}=    Crew Body
    ${resp}=    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crews    409    conflict    ${body}
    Conflict Reason Should Be    ${resp}    limit_reached
    Should Be Equal As Integers    ${resp.json()}[details][limit]    100
    ${first}=    Query Value    select id from crews where workspace_id = %s limit 1    ${team}[ws]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]/crews/${first}    204
    Create Crew Via API    ${team}[owner]    ${team}[ws]    201

# ── crews: isolation ───────────────────────────────────────────────────────────────
Crews Of One Company Are Invisible To Another
    [Tags]    smoke    security
    ${a}=    Create Workforce Team
    ${b}=    Create Second Workforce Team
    ${crew}=    Add Crew    ${a}[owner]    ${a}[ws]    name=ทีมลับ    dailyCostOverride=${3000}
    ${theirs}=    List Crews    ${b}[owner]    ${b}[ws]
    Should Be Empty    ${theirs.json()}
    Wf Error    ${b}[owner]    GET    /workspaces/${a}[ws]/crews    404    not_found
    Wf Error    ${b}[owner]    PATCH    /workspaces/${b}[ws]/crews/${crew}[id]    404    not_found    ${{ {'name': 'mine'} }}
    Wf Error    ${b}[owner]    DELETE    /workspaces/${b}[ws]/crews/${crew}[id]    404    not_found
    Wf Error    ${b}[owner]    PATCH    /workspaces/${a}[ws]/crews/${crew}[id]    404    not_found    ${{ {'name': 'mine'} }}
    ${row}=    Crew Row    ${crew}[id]
    Should Be Equal    ${row}[name]    ทีมลับ
    Should Be Equal    ${row}[archived_at]    ${None}

Deleting The Workspace Removes Its People Crews And Rate Cards
    [Tags]    state
    ${team}=    Create Workforce Team
    ${person}=    Add Person    ${team}[owner]    ${team}[ws]
    ${card}=    Add Rate Card    ${team}[owner]    ${team}[ws]
    Add Crew    ${team}[owner]    ${team}[ws]    leaderId=${person}[id]    rateCardId=${card}[id]
    Wf Call    ${team}[owner]    DELETE    /workspaces/${team}[ws]    204
    FOR    ${table}    IN    people    crews    rate_cards
        ${n}=    Count Rows    select count(*) from ${table} where workspace_id = %s    ${team}[ws]
        Should Be Equal As Integers    ${n}    0    msg=${table} rows survive the workspace
    END


*** Keywords ***
Person Field Should Be Rejected
    [Documentation]    A person body with this one field wrong answers 400 ``validation_failed`` and stores nothing.
    [Arguments]    ${field}    ${value}
    ${team}=    Create Workforce Team
    ${body}=    Person Body
    Set To Dictionary    ${body}    ${field}=${value}
    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/people    400    validation_failed    ${body}
    ${n}=    Count Rows    select count(*) from people where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0

Crew Field Should Be Rejected
    [Documentation]    A crew body with this one field wrong answers 400 ``validation_failed`` and stores nothing.
    [Arguments]    ${field}    ${value}
    ${team}=    Create Workforce Team
    ${body}=    Crew Body
    Set To Dictionary    ${body}    ${field}=${value}
    Wf Error    ${team}[owner]    POST    /workspaces/${team}[ws]/crews    400    validation_failed    ${body}
    ${n}=    Count Rows    select count(*) from crews where workspace_id = %s    ${team}[ws]
    Should Be Equal As Integers    ${n}    0
