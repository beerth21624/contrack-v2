*** Settings ***
Documentation       Shared settings for every ConTrack suite: URLs, browser lifecycle, guest project storage, numbers.
...                 Every UI test runs in its own browser context (fresh localStorage and cookies), so tests never
...                 depend on each other and can run in parallel with pabot.
Variables           ${CURDIR}/../variables/env.py
Library             Browser    timeout=${TIMEOUT}    retry_assertions_for=5s    auto_closing_level=SUITE
Library             Collections
Library             String
Library             ${CURDIR}/../libraries/ContrackLibrary.py


*** Keywords ***
Open Browser For Suite
    [Documentation]    One browser process per suite. Contexts (one per test) come from ``Open Fresh Context``.
    New Browser    ${BROWSER}    headless=${HEADLESS}    slowMo=${SLOW_MO}

Open Fresh Context
    [Documentation]    New context (Thai locale, Bangkok time, desktop viewport) and a page at ``${path}``.
    ...    Pass ``viewport_width=390`` for phone-size checks.
    [Arguments]    ${path}=/    ${viewport_width}=1440    ${viewport_height}=900
    VAR    &{viewport}    width=${viewport_width}    height=${viewport_height}
    New Context    locale=th-TH    timezoneId=Asia/Bangkok    viewport=${viewport}    acceptDownloads=True
    New Page    ${BASE_URL}${path}
    Wait For Load State    networkidle    timeout=60s

Go To Path
    [Documentation]    Navigate inside the app (``/journey/footing``) and wait until the page settled.
    [Arguments]    ${path}
    Go To    ${BASE_URL}${path}
    Wait For Load State    networkidle    timeout=60s

Seed Guest Project
    [Documentation]    Put a guest project into localStorage (as the app saves it) and reload so the store reads it.
    ...    ``${project}`` is a dict, JSON text, or a fixture name loaded with ``Load Project Fixture``.
    [Arguments]    ${project}    ${path}=/journey
    ${value}=    Guest Storage Value    ${project}
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    ${value}
    Go To Path    ${path}

Start Guest Project
    [Documentation]    A new guest project exactly as the app creates it (``blank`` = from my plan, ``sample`` = the
    ...    Excel v5 house), stored and loaded. Returns the engine's expected values for it.
    ...    ``${unlock_until}`` marks every level before that level id as done, so it opens unlocked
    ...    (levels unlock in order; a locked level shows "รอขั้นตอนก่อนหน้า").
    [Arguments]    ${start}=blank    ${path}=/journey    ${unlock_until}=${EMPTY}
    ${expected}=    Compute Expected For New Project    ${start}
    ${project}=    Set Variable    ${expected}[project]
    IF    '${unlock_until}' != '${EMPTY}'
        ${project}=    Project With Levels Done    ${project}    ${unlock_until}
        ${expected}=    Compute Expected    ${project}
    END
    Seed Guest Project    ${project}    ${path}
    RETURN    ${expected}

Read Guest Project
    [Documentation]    The guest project the app saved in localStorage (dict).
    ${key}=    Guest Project Key
    # The store writes after React commits: give it a moment to flush before reading.
    Wait Until Keyword Succeeds    5s    250ms    LocalStorage Get Item    ${key}    !=    ${None}
    ${raw}=    LocalStorage Get Item    ${key}
    ${project}=    Project From Storage Value    ${raw}
    RETURN    ${project}

Expected For Current Guest Project
    [Documentation]    Engine result for what the app holds right now (read back from localStorage).
    ${project}=    Read Guest Project
    ${expected}=    Compute Expected    ${project}
    RETURN    ${expected}

Input By Label
    [Documentation]    Selector of the input/select named ``${label}`` (every sheet input carries an aria-label).
    ...    ``${index}`` picks the n-th match (0-based) when a table repeats the same column label per row.
    [Arguments]    ${label}    ${index}=0
    RETURN    css=[aria-label="${label}"] >> nth=${index}

Fill Number By Label
    [Documentation]    Type into a spreadsheet-style number cell and commit with Enter (the cell commits on blur).
    [Arguments]    ${label}    ${value}    ${index}=0
    ${sel}=    Input By Label    ${label}    ${index}
    Click    ${sel}
    Fill Text    ${sel}    ${value}
    Keyboard Key    press    Enter

Fill Text By Label
    [Arguments]    ${label}    ${value}    ${index}=0
    ${sel}=    Input By Label    ${label}    ${index}
    Click    ${sel}
    Fill Text    ${sel}    ${value}
    Keyboard Key    press    Enter

Number Of Element Should Be
    [Documentation]    Read the text of ``${selector}`` as a Thai-formatted number and compare it (± ``${tolerance}``).
    [Arguments]    ${selector}    ${expected}    ${tolerance}=0.5
    ${text}=    Get Text    ${selector}
    Numbers Should Be Close    ${text}    ${expected}    ${tolerance}
    ...    msg=${selector} shows "${text}", expected ${expected}

Choose Ant Select Option
    [Documentation]    Open an Ant Design Select (by its aria-label) and pick the option whose text is ``${option}``.
    [Arguments]    ${label}    ${option}    ${index}=0
    ${sel}=    Input By Label    ${label}    ${index}
    Click    ${sel}
    Click    css=.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option >> text="${option}"

Message Should Appear
    [Documentation]    An Ant Design toast (message / notification) containing ``${text}``.
    [Arguments]    ${text}
    Wait For Elements State    css=.ant-message-notice, .ant-notification-notice >> text=${text}    visible    timeout=10s

Click Popconfirm Ok
    [Documentation]    Confirm the open Ant Design Popconfirm (button text defaults to ยืนยัน).
    [Arguments]    ${ok}=ยืนยัน
    Click    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button >> text="${ok}"

Page Should Have No Error Overlay
    [Documentation]    Next.js dev error overlay / React crash screens must never show.
    Get Element Count    css=nextjs-portal [data-nextjs-dialog], #nextjs__container_errors_label    ==    0
    Get Element Count    text=Application error    ==    0
