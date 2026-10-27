*** Settings ***
Documentation       Smoke: the web app, the API and the database answer, and the engine tool agrees with the screen.
...                 Runs first; if it fails, nothing else is worth running.
Resource            ../resources/journey.resource
Resource            ../resources/api.resource
Resource            ../resources/db.resource
Suite Setup         Open Browser For Suite
Test Tags           smoke


*** Test Cases ***
API Health Answers
    Create Anonymous Session    health
    GET On Session    health    /health    expected_status=200

Database Has The Schema
    ${n}=    Query Value    select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'projects'
    Should Be Equal As Integers    ${n}    1

Sample House Totals On Screen Equal The Engine
    [Documentation]    The Excel v5 sample house: the level bar shows the engine's construction total.
    Open Fresh Context
    ${expected}=    Start Guest Project    sample    /journey/land-inspection    unlock_until=land-inspection
    Go To Level    land-inspection
    ${lvl}=    Expected Level    ${expected}    land-inspection
    Level Total Should Be    ${lvl}[total]
    Construction Total Should Be    ${expected}[constructionTotal]

Seeded Owner Can Sign In Via API
    ${owner}=    Login Via API    ${DEMO_OWNER}
    ${ws}=    Workspace Id By Name    ${owner}    ${DEMO_COMPANY}
    Should Not Be Empty    ${ws}
