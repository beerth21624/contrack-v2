*** Settings ***
Documentation       Guided journey (37 levels, ``src/domain/journey/levels.ts``): navigation, confirm, skip, totals.
Resource            common.resource


*** Variables ***
${LEVEL_TOTAL}          xpath=//div[normalize-space()="มูลค่าขั้นตอนนี้"]/following-sibling::div[1]
${CONSTRUCTION_TOTAL}   xpath=//div[normalize-space()="ราคาค่าก่อสร้างรวม"]/following-sibling::div[1]
${CONFIRM_BUTTON}       css=button:has-text("ยืนยัน แล้วไปขั้นตอน"), button:has-text("ยืนยันและเสร็จสิ้น")
${SKIP_BUTTON}          css=button:has-text("ไม่มีในโครงการนี้")
${UNSKIP_BUTTON}        css=button:has-text("มีงานส่วนนี้ กลับไปกรอกข้อมูล")
${MISSING_SUMMARY}      css=span:has-text("ยังต้องกรอก")


*** Keywords ***
Go To Level
    [Documentation]    Open ``/journey/<level id>`` and wait until the level page shows its bottom bar.
    [Arguments]    ${level_id}
    Go To Path    /journey/${level_id}
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=60s
    Page Should Have No Error Overlay

Level Total Should Be
    [Documentation]    "มูลค่าขั้นตอนนี้ … บาท" equals ``${expected}`` (whole baht, as the app rounds it).
    [Arguments]    ${expected}    ${tolerance}=0.5
    Number Of Element Should Be    ${LEVEL_TOTAL}    ${expected}    ${tolerance}

Construction Total Should Be
    [Documentation]    "ราคาค่าก่อสร้างรวม … บาท" in the level bottom bar (desktop only, hidden below sm).
    [Arguments]    ${expected}    ${tolerance}=0.5
    Number Of Element Should Be    ${CONSTRUCTION_TOTAL}    ${expected}    ${tolerance}

Level Totals Should Match Engine
    [Documentation]    Both totals on the current level equal the engine's numbers for the stored project.
    [Arguments]    ${level_id}
    ${expected}=    Expected For Current Guest Project
    ${lvl}=    Expected Level    ${expected}    ${level_id}
    Level Total Should Be    ${lvl}[total]
    Construction Total Should Be    ${expected}[constructionTotal]
    RETURN    ${expected}

Confirm Level
    [Documentation]    Press "ยืนยัน แล้วไปขั้นตอน…" and expect to land on ``${next_level}`` (or the map when empty).
    [Arguments]    ${next_level}=${EMPTY}
    Click    ${CONFIRM_BUTTON}
    IF    '${next_level}' != '${EMPTY}'
        Wait For Condition    Url    should end with    /journey/${next_level}    timeout=30s
    END

Confirm Level Should Be Blocked
    [Documentation]    Confirm with missing required values: stay on the level and show "ยังต้องกรอก N รายการ".
    [Arguments]    ${level_id}    ${count}=${EMPTY}
    Click    ${CONFIRM_BUTTON}
    Wait For Elements State    ${MISSING_SUMMARY}    visible    timeout=10s
    Get Url    should end with    /journey/${level_id}
    IF    '${count}' != '${EMPTY}'
        Get Text    ${MISSING_SUMMARY}    contains    ยังต้องกรอก ${count} รายการ
    END

Skip Level
    [Documentation]    Mark an optional level "ไม่มีในโครงการนี้" (Popconfirm → ยืนยัน).
    Click    ${SKIP_BUTTON}
    Click Popconfirm Ok

Unskip Level
    Click    ${UNSKIP_BUTTON}

Level Mark Should Be
    [Documentation]    The stored journey progress for ``${level_id}``: done, skipped, or ${None} (not passed).
    [Arguments]    ${level_id}    ${mark}
    ${project}=    Read Guest Project
    ${journey}=    Get From Dictionary    ${project}    journey    default=${{ {} }}
    ${actual}=    Get From Dictionary    ${journey}    ${level_id}    default=${None}
    Should Be Equal    ${actual}    ${mark}    msg=Level ${level_id} mark is ${actual}, expected ${mark}
