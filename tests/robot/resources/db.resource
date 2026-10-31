*** Settings ***
Documentation       Database checks (PostgreSQL ``contrack_e2e``): what the API wrote, read back row by row.
Library             ${CURDIR}/../libraries/ContrackDb.py    ${DATABASE_URL}
Variables           ${CURDIR}/../variables/env.py


*** Keywords ***
User Row By Email
    [Arguments]    ${email}
    ${row}=    Query Row    select * from users where email = %s    ${email}
    RETURN    ${row}

Membership Role Should Be
    [Arguments]    ${workspace_id}    ${user_id}    ${role}
    ${actual}=    Query Value    select role from memberships where workspace_id = %s and user_id = %s
    ...    ${workspace_id}    ${user_id}
    Should Be Equal    ${actual}    ${role}

Project Row
    [Arguments]    ${project_id}
    ${row}=    Query Row    select * from projects where id = %s    ${project_id}
    RETURN    ${row}

Project Doc Row
    [Arguments]    ${project_id}    ${doc_key}
    ${row}=    Query Row    select * from project_docs where project_id = %s and doc_key = %s    ${project_id}    ${doc_key}
    RETURN    ${row}
