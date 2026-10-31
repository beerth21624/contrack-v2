*** Settings ***
Documentation       W4 / export: the Excel download (src/features/export/xlsx.ts) and the print document (ปร.5 summary +
...                 ปร.4 detail, BoqPrintDocument.tsx). The .xlsx is opened with Python's zipfile (no extra library).
...                 A headless browser has no print dialog: ``window.print`` is stubbed and the print-only document the app
...                 mounted right before the call is read.
Library             OperatingSystem
Resource            ../../resources/pages/boq_planning.resource
Suite Setup         Setup W4 Suite
Test Teardown       Close Test Context
Test Tags           export    w4


*** Variables ***
${PRINT_MENU_BUTTON}    css=button[aria-label="เลือกแบบที่จะพิมพ์"]
${SUMMARY_TITLE}        แบบสรุปผลการประมาณราคาค่าก่อสร้าง
${DETAIL_TITLE}         แบบแสดงรายการ ปริมาณงาน และราคา


*** Test Cases ***
Excel Download Gives A Non Empty Xlsx File
    [Documentation]    Click "ดาวน์โหลด Excel": a file arrives, ends with .xlsx, is not empty and is a zip (PK header).
    [Tags]    smoke
    Open Project Page    /boq
    ${download}=    Download Excel
    Should End With    ${download}[suggestedFilename]    .xlsx
    Should Start With    ${download}[suggestedFilename]    BOQ_
    File Should Exist    ${download}[saveAs]
    ${size}=    Get File Size    ${download}[saveAs]
    Should Be True    ${size} > 5000    msg=xlsx is only ${size} bytes
    ${magic}=    Evaluate    open($download['saveAs'], 'rb').read(2)
    Should Be Equal    ${magic}    ${{ b'PK' }}

Workbook Has The Summary And The BOQ Home Sheets
    [Documentation]    The workbook holds the ปร.5 summary sheet "สรุป" first and then "BOQ (Home)".
    ${path}=    Open And Download
    ${workbook}=    Workbook Xml    ${path}
    Should Contain    ${workbook}    name="BOQ (Home)"
    Should Contain    ${workbook}    name="สรุป"
    ${first}=    Evaluate    $workbook.index('name="สรุป"') < $workbook.index('name="BOQ (Home)"')
    Should Be True    ${first}

Workbook Is A Complete Office Open XML Package
    [Documentation]    Mandatory parts exist: content types, workbook, two worksheets, styles; the zip passes its own CRC check.
    ${path}=    Open And Download
    ${names}=    Evaluate    zipfile.ZipFile($path).namelist()    modules=zipfile
    List Should Contain Value    ${names}    [Content_Types].xml
    List Should Contain Value    ${names}    xl/workbook.xml
    List Should Contain Value    ${names}    xl/styles.xml
    ${sheets}=    Evaluate    [n for n in $names if n.startswith('xl/worksheets/sheet')]
    Length Should Be    ${sheets}    2
    ${bad}=    Evaluate    zipfile.ZipFile($path).testzip()    modules=zipfile
    Should Be Equal    ${bad}    ${None}

Workbook Holds The Engine Grand Total
    [Documentation]    The BOQ sheet carries the construction total of the engine (1,855,162.25 for the sample).
    ${expected}=    Open Project Page    /boq
    ${download}=    Download Excel
    ${xml}=    Worksheets Xml    ${download}[saveAs]
    ${whole}=    Evaluate    str(int($expected['constructionTotal']))
    Should Contain    ${xml}    ${whole}    msg=${whole} is not in any worksheet

Workbook Holds The Project Name
    [Documentation]    The project name of the sample is in the workbook text.
    ${expected}=    Open Project Page    /boq
    ${download}=    Download Excel
    ${strings}=    Shared Strings    ${download}[saveAs]
    Should Contain    ${strings}    ${expected}[project][meta][projectName]

Workbook Holds Every Section Title
    [Documentation]    All 32 section titles of the template are in the workbook text.
    ${expected}=    Open Project Page    /boq
    ${download}=    Download Excel
    ${strings}=    Shared Strings    ${download}[saveAs]
    FOR    ${section}    IN    @{expected}[sections]
        Should Contain    ${strings}    ${section}[title]    msg=Section ${section}[no] ${section}[title] missing in the xlsx
    END

Excel After An Edit Holds The New Total
    [Documentation]    R19 qty 4 -> 10, then download: the workbook total equals the engine's new total.
    Open Project Page    /boq
    Set Boq Cell    R19    qty    10
    ${expected}=    Boq Should Match Stored Project
    ${download}=    Download Excel
    ${xml}=    Worksheets Xml    ${download}[saveAs]
    ${whole}=    Evaluate    str(int($expected['constructionTotal']))
    Should Contain    ${xml}    ${whole}

Excel File Name Follows The Project Name And Revision
    [Documentation]    BOQ_<project name>_Rev<revision>.xlsx (boqFileBaseName).
    ${expected}=    Open Project Page    /boq
    ${download}=    Download Excel
    VAR    ${name}    ${expected}[project][meta][projectName]
    Should Be Equal    ${download}[suggestedFilename]    BOQ_${name}_Rev00.xlsx

Excel File Name Drops Characters Windows Forbids
    [Documentation]    A name with / : * ? " < > | is cleaned before it becomes a file name.
    [Tags]    edge
    Open Project Page    /boq
    Fill Text By Label    📂 โครงการ    บ้าน/คุณ:ทดสอบ*?
    Wait Until Keyword Succeeds    10s    250ms    Project Name Is Stored
    ${download}=    Download Excel
    Should End With    ${download}[suggestedFilename]    .xlsx
    FOR    ${bad}    IN    /    \\    :    *    ?    "    <    >    |
        Should Not Contain    ${download}[suggestedFilename]    ${bad}
    END

Excel Of A Blank Project Downloads Without An Error
    [Documentation]    A blank project exports a workbook and shows no error message.
    [Tags]    edge
    Open Project Page    /boq    start=blank
    ${download}=    Download Excel
    ${size}=    Get File Size    ${download}[saveAs]
    Should Be True    ${size} > 3000
    Get Element Count    css=.ant-message-notice    ==    0
    Page Should Have No Error Overlay

Excel Of A Project With Skipped Levels Downloads
    [Documentation]    Piles and fill skipped: the workbook still carries the engine's (lower) construction total.
    [Tags]    edge
    ${project}=    Sample Project With Journey    piles=skipped    fill=skipped
    ${expected}=    Open Project Object Page    /boq    ${project}
    ${download}=    Download Excel
    ${xml}=    Worksheets Xml    ${download}[saveAs]
    ${whole}=    Evaluate    str(int($expected['constructionTotal']))
    Should Contain    ${xml}    ${whole}

Excel Button Is Offered On The Journey Map Only When Every Level Is Passed
    [Documentation]    The finish card of the map shows the export buttons only after all 37 levels are done or skipped.
    [Tags]    edge
    ${expected}=    Open Project Page    /journey
    Get Element Count    ${EXCEL_BUTTON}    ==    0
    Close Context
    ${project}=    Project With Levels Done    ${expected}[project]    ALL
    Open Project Object Page    /journey    ${project}
    Wait For Elements State    ${EXCEL_BUTTON}    visible

Excel Download From The Journey Map Of A Finished Project
    [Documentation]    The finished journey offers the same download and it is a real xlsx.
    [Tags]    smoke
    ${expected}=    Cached Start Project    sample
    ${project}=    Project With Levels Done    ${expected}[project]    ALL
    Open Project Object Page    /journey    ${project}
    ${download}=    Download Excel
    Should End With    ${download}[suggestedFilename]    .xlsx
    ${size}=    Get File Size    ${download}[saveAs]
    Should Be True    ${size} > 5000

Print Button Mounts The Print Document And Calls Print
    [Documentation]    One click = one window.print() with the ปร.5 and ปร.4 forms mounted.
    [Tags]    smoke    print
    Open Project Page    /boq
    Capture Print Calls
    Click    ${PRINT_BUTTON}
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    ${text}=    Printed Text
    Should Contain    ${text}    ${SUMMARY_TITLE}
    Should Contain    ${text}    ${DETAIL_TITLE}

Print Document Shows The Project Name
    [Documentation]    The project name of the sample is printed in the form header.
    [Tags]    print
    ${expected}=    Open Project Page    /boq
    Capture Print Calls
    Click    ${PRINT_BUTTON}
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    ${text}=    Printed Text
    Should Contain    ${text}    ${expected}[project][meta][projectName]

Print Document Shows The Grand Total
    [Documentation]    The grand total of the engine (1,855,162.25) is printed in the summary form.
    [Tags]    print    smoke
    ${expected}=    Open Project Page    /boq
    Capture Print Calls
    Click    ${PRINT_BUTTON}
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    ${text}=    Printed Text
    ${money}=    Format Baht    ${expected}[constructionTotal]    2
    Should Contain    ${text}    ${money}

Print Document Lists Every Priced Section
    [Documentation]    The detail form prints a sub-total line per section with money ("รวมหมวดที่ n").
    [Tags]    print
    ${expected}=    Open Project Page    /boq
    Capture Print Calls
    Click    ${PRINT_BUTTON}
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    ${text}=    Printed Text
    FOR    ${section}    IN    @{expected}[sections]
        IF    $section['total'] > 0 and $section['no'] > 0
            Should Contain    ${text}    รวมหมวดที่ ${section}[no]    msg=No sub-total line for section ${section}[no]
        END
    END

Print Summary Only Prints One Form
    [Documentation]    "เฉพาะแบบสรุป (ปร.5)" prints the summary form and not the detail form.
    [Tags]    print
    Open Project Page    /boq
    Capture Print Calls
    Click    ${PRINT_MENU_BUTTON}
    Click    css=.ant-dropdown-menu-item:has-text("เฉพาะแบบสรุป (ปร.5)")
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    ${text}=    Printed Text
    Should Contain    ${text}    ${SUMMARY_TITLE}
    Should Not Contain    ${text}    ${DETAIL_TITLE}

Print Detail Only Prints One Form
    [Documentation]    "เฉพาะรายการ ปริมาณงานและราคา (ปร.4)" prints the detail form and not the summary form.
    [Tags]    print
    Open Project Page    /boq
    Capture Print Calls
    Click    ${PRINT_MENU_BUTTON}
    Click    css=.ant-dropdown-menu-item:has-text("เฉพาะรายการ ปริมาณงานและราคา (ปร.4)")
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    ${text}=    Printed Text
    Should Contain    ${text}    ${DETAIL_TITLE}
    Should Not Contain    ${text}    ${SUMMARY_TITLE}

Print Menu Offers The Three Choices
    [Documentation]    The arrow next to the print button lists all, summary only and detail only.
    [Tags]    print
    Open Project Page    /boq
    Click    ${PRINT_MENU_BUTTON}
    Wait For Elements State    css=.ant-dropdown-menu-item:has-text("ทั้งชุด (แบบสรุป ปร.5 + รายการ ปร.4)")    visible
    Wait For Elements State    css=.ant-dropdown-menu-item:has-text("เฉพาะแบบสรุป (ปร.5)")    visible
    Wait For Elements State    css=.ant-dropdown-menu-item:has-text("เฉพาะรายการ ปริมาณงานและราคา (ปร.4)")    visible

Print Document Is Hidden On Screen
    [Documentation]    The print-only document never shows in the normal view (CSS ``@media screen`` hides it).
    [Tags]    print
    Open Project Page    /boq
    Capture Print Calls
    Click    ${PRINT_BUTTON}
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    Get Element States    css=.boqp-root    *=    hidden

Print Uses The Project Name As The File Name Of The PDF
    [Documentation]    While the dialog is open the page title is "BOQ_<name>_Rev<revision>" (the browser's default PDF name).
    [Tags]    print
    ${expected}=    Open Project Page    /boq
    Capture Print Calls
    Click    ${PRINT_BUTTON}
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    ${title}=    Printed Title
    Should Be Equal    ${title}    BOQ_${expected}[project][meta][projectName]_Rev00

Print After An Edit Shows The New Total
    [Documentation]    R19 qty 4 -> 10: the printed grand total is the engine's new total.
    [Tags]    print
    Open Project Page    /boq
    Set Boq Cell    R19    qty    10
    ${expected}=    Boq Should Match Stored Project
    Capture Print Calls
    Click    ${PRINT_BUTTON}
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    ${text}=    Printed Text
    ${money}=    Format Baht    ${expected}[constructionTotal]    2
    Should Contain    ${text}    ${money}

Print Of A Blank Project Does Not Crash
    [Documentation]    A blank project prints without NaN and without an error overlay.
    [Tags]    print    edge
    Open Project Page    /boq    start=blank
    Capture Print Calls
    Click    ${PRINT_BUTTON}
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    ${text}=    Printed Text
    Should Not Contain    ${text}    NaN
    Page Should Have No Error Overlay

Print Document Never Contains NaN Or Undefined
    [Documentation]    The printed text of the sample has no NaN, undefined or Infinity.
    [Tags]    print    edge
    Open Project Page    /boq
    Capture Print Calls
    Click    ${PRINT_BUTTON}
    Wait Until Keyword Succeeds    10s    250ms    Print Calls Should Be    1
    ${text}=    Printed Text
    Should Not Contain    ${text}    NaN
    Should Not Contain    ${text}    undefined
    Should Not Contain    ${text}    Infinity


*** Keywords ***
Download Excel
    [Documentation]    Click the Excel button and wait for the download. Returns {saveAs, suggestedFilename}.
    ${name}=    Unique Name    xlsx
    ${promise}=    Promise To Wait For Download    ${TEMPDIR}${/}contrack-w4${/}${name}.xlsx
    Click    ${EXCEL_BUTTON}
    ${download}=    Wait For    ${promise}
    RETURN    ${download}

Open And Download
    [Documentation]    Sample BOQ page, download, return the path of the saved file.
    Open Project Page    /boq
    ${download}=    Download Excel
    RETURN    ${download}[saveAs]

Workbook Xml
    [Documentation]    The text of xl/workbook.xml (sheet names and their order).
    [Arguments]    ${path}
    ${xml}=    Evaluate    zipfile.ZipFile($path).read('xl/workbook.xml').decode('utf-8')    modules=zipfile
    RETURN    ${xml}

Worksheets Xml
    [Documentation]    All worksheet XML parts joined (cell values and formula results).
    [Arguments]    ${path}
    ${xml}=    Package Text    ${path}    xl/worksheets/sheet
    RETURN    ${xml}

Shared Strings
    [Documentation]    The text of the workbook (shared strings plus the worksheets).
    [Arguments]    ${path}
    ${strings}=    Package Text    ${path}    xl/sharedStrings.xml
    ${sheets}=    Package Text    ${path}    xl/worksheets/sheet
    RETURN    ${strings}${sheets}

Package Text
    [Documentation]    Decoded text of every part of the .xlsx (zip) whose name starts with ``${prefix}``.
    [Arguments]    ${path}    ${prefix}
    ${names}=    Evaluate    zipfile.ZipFile($path).namelist()    modules=zipfile
    VAR    ${text}    ${EMPTY}
    FOR    ${name}    IN    @{names}
        IF    not $name.startswith($prefix)    CONTINUE
        ${part}=    Evaluate    zipfile.ZipFile($path).read($name).decode('utf-8')    modules=zipfile
        VAR    ${text}    ${text}${part}
    END
    RETURN    ${text}

Print Calls Should Be
    [Documentation]    ``window.print`` was called ``${count}`` times.
    [Arguments]    ${count}
    ${actual}=    Print Calls
    Should Be Equal As Integers    ${actual}    ${count}

Project Name Is Stored
    [Documentation]    The saved project name contains the typed text.
    ${project}=    Read Guest Project
    Should Contain    ${project}[meta][projectName]    ทดสอบ
