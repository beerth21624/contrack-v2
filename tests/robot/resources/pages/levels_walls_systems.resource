*** Settings ***
Documentation       Page objects of journey levels 21-31: door-window, brick, plaster, electrical-pipe,
...                 electrical-cable, load-center, electrical-equipment, waste-pipe, water-pipe, sanitary-system,
...                 sanitary-ware.
...
...                 One ``Fill <Level> From Plan`` keyword per level fills the same small one-storey house (about
...                 8 x 10 m) read off the plan and satisfies every required field of that level. The keywords
...                 neither confirm nor navigate: the caller is already on the level page. They are written to be
...                 re-used one after another by the 37-level full-run suite (each one assumes the earlier levels
...                 of this house were filled with their own keyword).
...
...                 THE HOUSE (values every ``Fill ... From Plan`` types in)
...
...                 - door-window: D1 door x1 1.0 x 2.1 m wood, exterior wall; D2 door x2 0.8 x 2.0 m wood, interior
...                 wall; W1 window x5 1.5 x 1.2 m aluminium, exterior wall. All walls brick, half thickness.
...                 Opening area: exterior 1.0*2.1 + 5*1.5*1.2 = 11.1 sqm, interior 2*0.8*2.0 = 3.2 sqm.
...                 - brick: exterior wall 10+8+10+8 = 36 m, interior wall 4+3+2 = 9 m (45 m), both 2.8 m high.
...                 Net area: exterior 36*2.8 - 11.1 = 89.7 sqm, interior 9*2.8 - 3.2 = 22.0 sqm.
...                 - plaster: derived from the brick walls; the only typed value is the column/beam surface
...                 25+6.24 = 31.24 sqm per side (outside, 1 side).
...                 - electrical-pipe: 6 circuits. Light 22.4 m main + 25.6 m lamp run + 4 switches; light 24.5 m +
...                 27.5 m + 3 switches; socket 27.4 m + 5 points; kitchen socket 5 m + 3 points; air-conditioner
...                 11 m; water heater 12 m. Total 205.8 m.
...                 - electrical-cable: lights 2.5 sqmm main + 1.5 sqmm to lamps, 2 wires; sockets 4 + 2.5 sqmm,
...                 3 wires; air-conditioner and heater 4 sqmm, 3 wires.
...                 - load-center: consumer unit 1, main breaker 1, 16 A breaker 2, 20 A breaker 3, ELCB 20 A 1
...                 (6 sub-breakers for 6 circuits), ground rod 1, main cable 15 m, ground cable 5 m (15,160 baht).
...                 - electrical-equipment: downlight 6, ceiling lamp 2, waterproof fluorescent 1, socket 7,
...                 waterproof socket 1, switch 7 (6,320 baht).
...                 - waste-pipe: toilet 4" 4+3.5 m + 2 m vertical; basin / floor drain 2" 6+4.5 m + 3 m vertical;
...                 tank vent 1" 3.5 m vertical.
...                 - water-pipe: main outside 3/4" 12+8 m + 0.5 m; inside 1/2" 6 m + 4.5 m.
...                 - sanitary-system: septic tank 1, grease trap 1, manhole 2, drain pipe 10 m (16,300 baht).
...                 - sanitary-ware: one bathroom set (toilet, bidet spray, basin, tap, mirror, paper holder,
...                 towel rail, floor drain, soap dish, shower) + 1 extra floor drain, 2 in total (16,160 baht).
...
...                 Helper keywords are prefixed ``WS`` so they never clash with other page resources.
Resource            ../common.resource
Resource            ../journey.resource


*** Variables ***
# Navigation order around the levels of this file (src/domain/journey/levels.ts).
${LEVEL_BEFORE_DOOR_WINDOW}     roof-structure
${LEVEL_AFTER_SANITARY_WARE}    ceiling
# Item names as the count sheets show them (text is matched as a fragment of the box label).
${LC_CONSUMER_UNIT}             Consumer Unit
${LC_MAIN_CB}                   เซอร์กิตเบรกเกอร์เมน
${LC_ELCB}                      ELCB
${LC_CB16}                      ขนาด 16 A
${LC_CB20}                      (CB) ขนาด 20 A
${LC_GROUND_ROD}                แท่งกราวด์
${LC_GROUND_CABLE}              สายไฟกราวด์
${LC_MAIN_CABLE}                สายเมนไฟฟ้า
${EQ_CEILING_LAMP}              โคมไฟซาลาเปา
${EQ_DOWNLIGHT}                 โคมไฟดาวน์ไลท์
${EQ_FLUORESCENT_WP}            โคมไฟฟลูออเรสเซนต์
${EQ_SOCKET_WP}                 เต้ารับไฟฟ้าคู่ชนิดมีกราวน์ ชนิดกันน้ำ
${EQ_SOCKET}                    มีกราวน์ (พร้อมหน้ากาก)
${EQ_SWITCH}                    สวิตซ์
${SS_GREASE_TRAP}               ถังดักไขมัน
${SS_SEPTIC_TANK}               ถังบำบัดน้ำเสีย
${SS_AC_PIPE}                   ท่อระบายน้า AC
${SS_MANHOLE}                   บ่อพักน้ำทิ้ง
${SW_MIRROR}                    กระจกเงา
${SW_BASIN_TAP}                 ก๊อกเดี่ยว
${SW_TOILET}                    ชักโครก
${SW_FLOOR_DRAIN}               ตะแกรงกันกลิ่น
${SW_PAPER_HOLDER}              ที่ใส่กระดาษ
${SW_SOAP_DISH}                 ที่ใส่สบู่
${SW_SHOWER}                    ฝักบัว
${SW_TOWEL_RAIL}                ราวแขวนผ้า
${SW_BIDET_SPRAY}               สายชำระ
${SW_BASIN}                     อ่างล้างหน้า


*** Keywords ***
# ───────────────────────────── generic helpers (WS) ─────────────────────────────

WS Radio Group
    [Documentation]    Selector of the ``${index}``-th button group (role radiogroup) named ``${group}``.
    [Arguments]    ${group}    ${index}=0
    RETURN    css=[role="radiogroup"][aria-label="${group}"] >> nth=${index}

WS Choose Radio
    [Documentation]    Press the option button ``${option}`` of the ``${index}``-th button group ``${group}``.
    [Arguments]    ${group}    ${option}    ${index}=0
    ${grp}=    WS Radio Group    ${group}    ${index}
    Click    ${grp} >> css=button[role="radio"] >> text='${option}'

WS Radio Should Be Selected
    [Documentation]    The option button ``${option}`` of the ``${index}``-th group ``${group}`` is pressed
    ...    (aria-checked).
    [Arguments]    ${group}    ${option}    ${index}=0
    ${grp}=    WS Radio Group    ${group}    ${index}
    Get Attribute    ${grp} >> css=button[role="radio"] >> text='${option}'    aria-checked    ==    true

WS Radio Should Not Be Selected
    [Documentation]    The option button ``${option}`` of the ``${index}``-th group ``${group}`` is not pressed.
    [Arguments]    ${group}    ${option}    ${index}=0
    ${grp}=    WS Radio Group    ${group}    ${index}
    Get Attribute    ${grp} >> css=button[role="radio"] >> text='${option}'    aria-checked    ==    false

WS Click Button
    [Documentation]    Click the button whose whole text is ``${text}`` (an Ant Design button keeps its text in a
    ...    span).
    [Arguments]    ${text}
    Click    css=button >> text='${text}'

WS Button Count Should Be
    [Documentation]    Number of buttons whose whole text is ``${text}``.
    [Arguments]    ${text}    ${count}
    Get Element Count    css=button >> text='${text}'    ==    ${count}

WS Box Should Show
    [Documentation]    A number box shows ``${expected}`` (a plan value of 0 shows an empty box), within
    ...    ``${tolerance}`` (a box that shows whole numbers rounds, so counts pass 0.5). Retries while
    ...    React renders.
    [Arguments]    ${selector}    ${expected}    ${tolerance}=0.001
    Wait Until Keyword Succeeds    8s    200ms    WS Box Should Show Now    ${selector}    ${expected}    ${tolerance}

WS Box Should Show Now
    [Documentation]    One attempt of ``WS Box Should Show`` (no retry).
    [Arguments]    ${selector}    ${expected}    ${tolerance}=0.001
    ${shown}=    Get Property    ${selector}    value
    IF    ${expected} == 0
        Should Be Equal    ${shown}    ${EMPTY}    msg=${selector} shows "${shown}", expected an empty box
    ELSE
        Numbers Should Be Close    ${shown}    ${expected}    ${tolerance}
        ...    msg=${selector} shows "${shown}", expected ${expected}
    END

WS Edge Number
    [Documentation]    Edge input on one number box: reset it to 1, type ``${typed}`` and commit. The box must then
    ...    show ``${shown}`` (unreadable text keeps the old value, a cleared box is 0) and the page must have no
    ...    NaN / Infinity. A plain number (or a cleared box) also has both totals compared with the engine; an
    ...    expression or text is only a different way to type a number already covered, so it is checked on
    ...    the box (the engine run is the slow part).
    [Arguments]    ${level_id}    ${label}    ${typed}    ${shown}    ${index}=0    ${tolerance}=0.001
    Fill Number By Label    ${label}    1    ${index}
    ${sel}=    Input By Label    ${label}    ${index}
    WS Box Should Show    ${sel}    1    ${tolerance}
    Fill Number By Label    ${label}    ${typed}    ${index}
    WS Box Should Show    ${sel}    ${shown}    ${tolerance}
    WS Check Edge Result    ${level_id}    ${typed}

WS Check Edge Result
    [Documentation]    Engine comparison for a plain typed number, page sanity for everything else.
    [Arguments]    ${level_id}    ${typed}
    ${plain}=    Evaluate    re.fullmatch(r'-?[0-9,]*\.?[0-9]*', $typed) is not None    modules=re
    IF    ${plain}
        WS Level Should Match Engine    ${level_id}
    ELSE
        WS Page Should Have No Bad Numbers
    END

WS Page Should Have No Bad Numbers
    [Documentation]    No NaN / Infinity / undefined text and no crash overlay anywhere on the page.
    ${text}=    Get Text    css=body
    Should Not Contain    ${text}    NaN
    Should Not Contain    ${text}    Infinity
    Should Not Contain    ${text}    undefined
    Page Should Have No Error Overlay

WS Level Should Match Engine
    [Documentation]    Both totals on the level equal the engine's, with no bad numbers on the page. With
    ...    ``${positive}`` the engine's total of the level must also be above 0 (the plan really cost something).
    ...    Retries because the store saves a moment after the last keystroke. Returns the engine result.
    [Arguments]    ${level_id}    ${positive}=${FALSE}
    ${expected}=    Wait Until Keyword Succeeds    120s    1s    Level Totals Should Match Engine    ${level_id}
    WS Page Should Have No Bad Numbers
    IF    ${positive}
        ${lvl}=    Expected Level    ${expected}    ${level_id}
        Should Be True    ${lvl}[total] > 0    msg=${level_id} total is ${lvl}[total]
    END
    RETURN    ${expected}

WS Total Of
    [Documentation]    The engine total of ``${level_id}`` inside an engine result ``${expected}``.
    [Arguments]    ${expected}    ${level_id}
    ${lvl}=    Expected Level    ${expected}    ${level_id}
    RETURN    ${lvl}[total]

WS Start Guest Project
    [Documentation]    Same as ``Start Guest Project`` (a new guest project, ``blank`` or ``sample``, with every level
    ...    before ``${unlock_until}`` done, opened on ``${path}``) but the new-project template is taken from the engine once
    ...    per suite and copied for every test. Each test still gets its own deep copy in its own browser context.
    ...    Saves two engine runs per test.
    [Arguments]    ${start}=blank    ${path}=/journey    ${unlock_until}=${EMPTY}
    ${project}=    WS New Project    ${start}
    IF    '${unlock_until}' != '${EMPTY}'
        ${project}=    Project With Levels Done    ${project}    ${unlock_until}
    END
    ${value}=    Guest Storage Value    ${project}
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    ${value}
    WS Go To Path    ${path}

WS Go To Path
    [Documentation]    Open ``${path}`` and wait for the page to settle (long timeouts: the dev server can be slow).
    [Arguments]    ${path}
    Go To    ${BASE_URL}${path}
    Wait For Load State    networkidle    timeout=180s

WS Go To Level
    [Documentation]    Open ``/journey/<level id>`` and wait for its bottom bar.
    [Arguments]    ${level_id}
    WS Go To Path    /journey/${level_id}
    WS Wait For Level Page

WS Confirm Level
    [Documentation]    Press the confirm button and wait (up to 3 min) for ``${next_level}``.
    [Arguments]    ${next_level}
    ${level_id}=    Current Level Id
    ${path}=    Landing Path After Confirm    ${level_id}    ${next_level}
    Click    ${CONFIRM_BUTTON}
    Wait For Condition    Url    should end with    ${path}    timeout=180s

WS New Project
    [Documentation]    A deep copy of ``createProject(start)`` (engine tool, computed once per suite).
    [Arguments]    ${start}
    ${cache}=    Get Variable Value    ${WS_CACHE}    ${None}
    IF    $cache is None
        VAR    &{cache}
        VAR    ${WS_CACHE}    ${cache}    scope=SUITE
    END
    IF    $start not in $cache
        ${created}=    Compute Expected For New Project    ${start}
        Set To Dictionary    ${cache}    ${start}=${created}[project]
    END
    ${copy}=    Evaluate    copy.deepcopy($cache['${start}'])    modules=copy
    RETURN    ${copy}

WS Level Total Should Be
    [Documentation]    "มูลค่าขั้นตอนนี้" shows ``${expected}`` baht (retries while the page renders).
    [Arguments]    ${expected}
    Wait Until Keyword Succeeds    8s    200ms    Level Total Should Be    ${expected}

WS Engine Level Total
    [Documentation]    The engine's total of ``${level_id}`` for what the app holds now.
    [Arguments]    ${level_id}
    ${expected}=    Expected For Current Guest Project
    ${lvl}=    Expected Level    ${expected}    ${level_id}
    RETURN    ${lvl}[total]

WS Wait For Engine Total
    [Documentation]    Wait until the saved project's engine total of ``${level_id}`` equals ``${total}`` (store
    ...    flushed).
    [Arguments]    ${level_id}    ${total}
    Wait Until Keyword Succeeds    15s    1s    WS Engine Total Should Be    ${level_id}    ${total}

WS Engine Total Should Be
    [Documentation]    The engine total of ``${level_id}`` for the stored project is ``${total}`` baht (one attempt).
    [Arguments]    ${level_id}    ${total}
    ${actual}=    WS Engine Level Total    ${level_id}
    Should Be True    abs(${actual} - ${total}) < 0.5    msg=engine total of ${level_id} is ${actual}, expected ${total}

WS Confirm Should Be Blocked Naming
    [Documentation]    Confirm stays on the level, "ยังต้องกรอก ``${count}`` รายการ" and the list names ``${text}``.
    [Arguments]    ${level_id}    ${count}    ${text}
    Confirm Level Should Be Blocked    ${level_id}    ${count}
    Get Text    css=[role="alert"]:has-text("ยังต้องกรอก")    contains    ${text}

WS Confirm Should Pass
    [Documentation]    Confirm moves on to ``${next_level}`` and the engine/journey marks the level done.
    [Arguments]    ${level_id}    ${next_level}
    WS Confirm Level    ${next_level}
    Level Mark Should Be    ${level_id}    done

WS Go To Locked Level
    [Documentation]    A level whose prerequisites are not passed shows the "ยังไม่พร้อมทำ" screen and no inputs.
    [Arguments]    ${level_id}    ${title}
    Go To Path    /journey/${level_id}
    Locked Screen Should Match Engine    ${level_id}    ${title}
    WS Page Should Have No Bad Numbers
    Get Element Count    ${CONFIRM_BUTTON}    ==    0
    Level Mark Should Be    ${level_id}    ${None}

WS Previous Arrow Should Lead To
    [Documentation]    The bottom-bar back arrow (named "ขั้นตอนก่อนหน้า: <title>") opens ``${level_id}``.
    [Arguments]    ${title}    ${level_id}
    Click    css=button[aria-label="ขั้นตอนก่อนหน้า: ${title}"]
    Wait For Condition    Url    should end with    /journey/${level_id}    timeout=180s

WS Wait For Level Page
    [Documentation]    The level page is up (bottom bar visible) and nothing crashed. Use right after ``Start Guest
    ...    Project``.
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=180s
    Page Should Have No Error Overlay

WS Reload And Wait
    [Documentation]    Reload the level page; wait until the bottom bar is back.
    Reload
    Wait For Elements State    css=button[aria-label="ภาพรวมขั้นตอน"]    visible    timeout=180s

WS Delete Card Confirm
    [Documentation]    Press the ``${index}``-th "ลบ" icon of a card and accept the "ลบ" popconfirm when one is asked.
    [Arguments]    ${index}=0    ${asks}=${TRUE}
    Click    css=button[aria-label="ลบ"] >> nth=${index}
    IF    ${asks}
        Click    css=.ant-popover:not(.ant-popover-hidden) .ant-popconfirm-buttons button >> text="ลบ"
    END

WS Seed Calculator Input
    [Documentation]    Write ``${value}`` (a dict) as the stored input of calculator ``${calc_id}`` into the guest
    ...    project and reload the level. Used for data the screen cannot produce (old saved lists, unknown
    ...    item text).
    [Arguments]    ${calc_id}    ${value}
    ${project}=    Read Guest Project
    ${calculators}=    Get From Dictionary    ${project}    calculators
    Set To Dictionary    ${calculators}    ${calc_id}=${value}
    ${text}=    Guest Storage Value    ${project}
    ${key}=    Guest Project Key
    LocalStorage Set Item    ${key}    ${text}
    WS Reload And Wait

# ───────────────────────────── 21 door-window ─────────────────────────────

WS Add Opening
    [Documentation]    Add a door (``doors``) or a window (``windows``) card.
    [Arguments]    ${block}
    IF    '${block}' == 'doors'
        WS Click Button    เพิ่มประตู
    ELSE
        WS Click Button    เพิ่มหน้าต่าง
    END

WS Opening Card Count Should Be
    [Documentation]    Number of door + window cards (every card has a width box).
    [Arguments]    ${count}
    Get Element Count    css=[aria-label="กว้าง (ม.)"]    ==    ${count}

WS Fill Opening
    [Documentation]    Fill card ``${index}`` (doors first, then windows): name, material, count, size, wall part,
    ...    wall type. ``${thickness}`` is ignored for a light wall (the button group is not shown).
    [Arguments]
    ...    ${index}
    ...    ${name}
    ...    ${material}
    ...    ${count}
    ...    ${width}
    ...    ${height}
    ...    ${wall_part}=ผนังรอบบ้าน
    ...    ${brick}=อิฐมอญ
    ...    ${thickness}=ครึ่งแผ่น
    Fill Text By Label    รหัส-รายการ (ตามตารางในแบบ)    ${name}    ${index}
    WS Choose Radio    วัสดุบาน    ${material}    ${index}
    Fill Number By Label    จำนวน (บาน)    ${count}    ${index}
    Fill Number By Label    กว้าง (ม.)    ${width}    ${index}
    Fill Number By Label    สูง (ม.)    ${height}    ${index}
    WS Choose Radio    ติดตั้งที่ผนัง    ${wall_part}    ${index}
    WS Choose Radio    ชนิดผนัง    ${brick}    ${index}
    IF    '${brick}' != 'ผนังเบา'
        WS Choose Radio    ความหนาผนัง    ${thickness}    ${index}
    END

Fill Door Window From Plan
    [Documentation]    Level 21. 2 door types (D1 x1, D2 x2) and 1 window type (W1 x5), see the resource
    ...    documentation.
    WS Add Opening    doors
    WS Fill Opening    0    D1-ประตูหน้าบ้าน    ไม้    1    1.0    2.1    ผนังรอบบ้าน
    WS Add Opening    doors
    WS Fill Opening    1    D2-ประตูห้องภายใน    ไม้    2    0.8    2.0    ผนังภายในบ้าน
    WS Add Opening    windows
    WS Fill Opening    2    W1-หน้าต่างบานเลื่อน    อลูมิเนียม    5    1.5    1.2    ผนังรอบบ้าน

# ───────────────────────────── 22 brick ─────────────────────────────

WS Add Wall
    [Documentation]    Add a wall card (the "เพิ่มผนัง" button of the empty state or the list).
    WS Click Button    เพิ่มผนัง

WS Wall Card Count Should Be
    [Documentation]    Number of wall cards (each has a length box).
    [Arguments]    ${count}
    Get Element Count    css=[aria-label="ความยาวผนัง (ม.)"]    ==    ${count}

WS Fill Wall
    [Documentation]    Fill wall card ``${index}``: wall part, brick, thickness, length (a sum such as 10+8+10+8 is
    ...    fine), height.
    [Arguments]    ${index}    ${wall_part}    ${length}    ${height}    ${brick}=อิฐมอญ    ${thickness}=ครึ่งแผ่น
    WS Choose Radio    ส่วนผนัง    ${wall_part}    ${index}
    WS Choose Radio    ชนิดอิฐ    ${brick}    ${index}
    WS Choose Radio    ความหนา    ${thickness}    ${index}
    Fill Number By Label    ความยาวผนัง (ม.)    ${length}    ${index}
    Fill Number By Label    ความสูงผนัง (ม.)    ${height}    ${index}

Fill Brick From Plan
    [Documentation]    Level 22. Exterior wall 10+8+10+8 = 36 m and interior wall 4+3+2 = 9 m, both 2.8 m high, brick
    ...    half thickness.
    WS Add Wall
    WS Fill Wall    0    ผนังรอบบ้าน    10+8+10+8    2.8
    WS Add Wall
    WS Fill Wall    1    ผนังภายในบ้าน    4+3+2    2.8

# ───────────────────────────── 23 plaster ─────────────────────────────

Fill Plaster From Plan
    [Documentation]    Level 23. Plaster areas come from the brick walls; the column/beam surface to plaster is
    ...    25+6.24 = 31.24 sqm per side, outside only (1 side).
    Fill Number By Label    พื้นที่ผิวเสา-คาน ต่อด้าน (ตร.ม.)    25+6.24
    WS Choose Radio    ผนังโครงสร้าง ฉาบด้านนอก กี่ด้าน    1 ด้าน

# ───────────────────────────── 24 electrical-pipe ─────────────────────────────

WS Add Circuit
    [Documentation]    Add a circuit of a kind by its label (ไฟแสงสว่าง, เต้ารับ, เต้ารับเหนือเคาน์เตอร์,
    ...    เครื่องทำน้ำอุ่น, เครื่องปรับอากาศ, ปั๊มน้ำ, อื่น ๆ): from the empty state or from the
    ...    quick-add chips.
    [Arguments]    ${kind}
    ${chips}=    Get Element Count    css=[role="group"][aria-label="เพิ่มวงจร"]
    IF    ${chips} == 0
        Click    css=button >> text='วงจร${kind}'
    ELSE
        Click    css=[role="group"][aria-label="เพิ่มวงจร"] >> css=button >> text='${kind}'
    END

WS Circuit Card Count Should Be
    [Documentation]    Number of circuit cards of the conduit level (each has a main-run box).
    [Arguments]    ${count}
    Get Element Count    css=[aria-label="ท่อสายเมน (ม.)"]    ==    ${count}

Fill Electrical Pipe From Plan
    [Documentation]    Level 24. 6 circuits: 2 light, 1 socket, 1 kitchen socket, 1 air-conditioner, 1 water heater.
    ...    Adding a circuit also suggests its cable in level 25.
    WS Add Circuit    ไฟแสงสว่าง
    Fill Text By Label    ชื่อวงจร (ตามตารางโหลด)    แสงสว่าง : ห้องนอน , ห้องน้ำ    0
    Fill Number By Label    ท่อสายเมน (ม.)    22.4    0
    Fill Number By Label    ท่อแยกเข้าโคม (ม.)    25.6    0
    Fill Number By Label    จำนวนสวิตช์ (จุด)    4    0
    WS Add Circuit    ไฟแสงสว่าง
    Fill Text By Label    ชื่อวงจร (ตามตารางโหลด)    แสงสว่าง : ห้องนั่งเล่น , ครัว , ภายนอก    1
    Fill Number By Label    ท่อสายเมน (ม.)    24.5    1
    Fill Number By Label    ท่อแยกเข้าโคม (ม.)    27.5    1
    Fill Number By Label    จำนวนสวิตช์ (จุด)    3    1
    WS Add Circuit    เต้ารับ
    Fill Text By Label    ชื่อวงจร (ตามตารางโหลด)    เต้ารับไฟฟ้า : ห้องนอน , ห้องนั่งเล่น    2
    Fill Number By Label    ท่อสายเมน (ม.)    27.4    2
    Fill Number By Label    จำนวนเต้ารับ (จุด)    5    0
    WS Add Circuit    เต้ารับเหนือเคาน์เตอร์
    Fill Number By Label    ท่อสายเมน (ม.)    5    3
    Fill Number By Label    จำนวนเต้ารับ (จุด)    3    1
    WS Add Circuit    เครื่องปรับอากาศ
    Fill Number By Label    ท่อสายเมน (ม.)    11    4
    WS Add Circuit    เครื่องทำน้ำอุ่น
    Fill Number By Label    ท่อสายเมน (ม.)    12    5

# ───────────────────────────── 25 electrical-cable ─────────────────────────────

Fill Electrical Cable From Plan
    [Documentation]    Level 25. Wire of the 6 circuits of ``Fill Electrical Pipe From Plan``: lights 2.5 + 1.5 sqmm /
    ...    2 wires, sockets 4 + 2.5 sqmm / 3 wires, air-conditioner and heater 4 sqmm / 3 wires.
    FOR    ${i}    IN    0    1
        WS Choose Radio    ขนาดสายเมนวงจร    2.5    ${i}
        WS Choose Radio    ขนาดสายเข้าโคม / จุด    1.5    ${i}
        WS Choose Radio    จำนวนสาย    2 เส้น    ${i}
    END
    FOR    ${i}    IN    2    3
        WS Choose Radio    ขนาดสายเมนวงจร    4    ${i}
        WS Choose Radio    ขนาดสายเข้าโคม / จุด    2.5    ${i}
        WS Choose Radio    จำนวนสาย    3 เส้น (มีสายดิน)    ${i}
    END
    FOR    ${i}    IN    4    5
        WS Choose Radio    ขนาดสายเมนวงจร    4    ${i}
        WS Choose Radio    จำนวนสาย    3 เส้น (มีสายดิน)    ${i}
    END

# ───────────────────────────── pick lists (26 27 30 31) ─────────────────────────────

WS Pick Box
    [Documentation]    Selector of the quantity box of a count-sheet line. ``${item}`` is a fragment of the item text;
    ...    ``${exact}`` takes the whole label (needed when one item name ends another's).
    [Arguments]    ${item}    ${exact}=${FALSE}
    IF    ${exact}
        RETURN    css=input[aria-label="จำนวน ${item}"], input[aria-label="ปริมาณ ${item} (ม.)"]
    END
    RETURN    css=input[aria-label^="จำนวน "][aria-label*="${item}"], input[aria-label^="ปริมาณ "][aria-label*="${item}"]

WS Set Pick Quantity
    [Documentation]    Type a quantity (a number or an expression such as =2*3) into the line of ``${item}``.
    [Arguments]    ${item}    ${value}    ${exact}=${FALSE}
    ${sel}=    WS Pick Box    ${item}    ${exact}
    Click    ${sel}
    Fill Text    ${sel}    ${value}
    Keyboard Key    press    Enter

WS Pick Quantity Should Be
    [Documentation]    The quantity box of the count-sheet line of ``${item}`` shows ``${expected}``.
    [Arguments]    ${item}    ${expected}    ${exact}=${FALSE}
    ${sel}=    WS Pick Box    ${item}    ${exact}
    WS Box Should Show    ${sel}    ${expected}

WS Step Pick Quantity
    [Documentation]    Press the + (``เพิ่ม``) or - (``ลด``) button of a counted line.
    [Arguments]    ${direction}    ${item}
    Click    css=button[aria-label^="${direction} จำนวน "][aria-label*="${item}"]

WS Minus Button Should Be Disabled
    [Documentation]    The "-" button of the line of ``${item}`` is disabled (quantity 0).
    [Arguments]    ${item}
    Get Element States    css=button[aria-label^="ลด จำนวน "][aria-label*="${item}"]    contains    disabled

Fill Load Center From Plan
    [Documentation]    Level 26. Consumer unit 1, main breaker 1, 16 A breaker 2, 20 A breaker 3, ELCB 20 A 1,
    ...    ground rod 1, main cable 15 m, ground cable 5 m.
    WS Set Pick Quantity    ${LC_CONSUMER_UNIT}    1
    WS Set Pick Quantity    ${LC_MAIN_CB}    1
    WS Set Pick Quantity    ${LC_CB16}    2
    WS Set Pick Quantity    ${LC_CB20}    3
    WS Set Pick Quantity    ${LC_ELCB}    1
    WS Set Pick Quantity    ${LC_GROUND_ROD}    1
    WS Set Pick Quantity    ${LC_MAIN_CABLE}    15
    WS Set Pick Quantity    ${LC_GROUND_CABLE}    5

Fill Electrical Equipment From Plan
    [Documentation]    Level 27. Downlight 6, ceiling lamp 2, waterproof fluorescent 1, socket 7, waterproof socket 1,
    ...    switch 7.
    WS Set Pick Quantity    ${EQ_DOWNLIGHT}    6
    WS Set Pick Quantity    ${EQ_CEILING_LAMP}    2
    WS Set Pick Quantity    ${EQ_FLUORESCENT_WP}    1
    WS Set Pick Quantity    ${EQ_SOCKET}    7
    WS Set Pick Quantity    ${EQ_SOCKET_WP}    1
    WS Set Pick Quantity    ${EQ_SWITCH}    7

Fill Sanitary System From Plan
    [Documentation]    Level 30. Septic tank 1, grease trap 1, manhole 2, drain pipe 10 m.
    WS Set Pick Quantity    ${SS_SEPTIC_TANK}    1
    WS Set Pick Quantity    ${SS_GREASE_TRAP}    1
    WS Set Pick Quantity    ${SS_MANHOLE}    2
    WS Set Pick Quantity    ${SS_AC_PIPE}    10

Fill Sanitary Ware From Plan
    [Documentation]    Level 31. One bathroom: the "เพิ่มชุดห้องน้ำ 1 ห้อง" set (toilet, bidet spray, basin, tap,
    ...    mirror, paper holder, towel rail, floor drain, soap dish, shower) and one more floor drain (2
    ...    in total).
    WS Click Button    เพิ่มชุดห้องน้ำ 1 ห้อง
    WS Set Pick Quantity    ${SW_FLOOR_DRAIN}    2

# ───────────────────────────── pipe runs (28 29) ─────────────────────────────

WS Fill Pipe Run
    [Documentation]    Fixed pipe row ``${index}`` (0 = first listed pipe size): horizontal and vertical length (sums
    ...    allowed).
    [Arguments]    ${index}    ${horizontal}    ${vertical}
    Fill Number By Label    แนวราบ (ม.)    ${horizontal}    ${index}
    Fill Number By Label    แนวดิ่ง (ม.)    ${vertical}    ${index}

Fill Waste Pipe From Plan
    [Documentation]    Level 28. Toilet pipe 4" 4+3.5 m + 2 m; basin / floor-drain pipe 2" 6+4.5 m + 3 m; tank vent 1"
    ...    3.5 m vertical.
    WS Fill Pipe Run    0    4+3.5    2
    WS Fill Pipe Run    1    6+4.5    3
    WS Fill Pipe Run    2    0    3.5

Fill Water Pipe From Plan
    [Documentation]    Level 29. Main pipe outside 3/4" 12+8 m + 0.5 m; branch pipes inside 1/2" 6 m + 4.5 m.
    WS Fill Pipe Run    0    12+8    0.5
    WS Fill Pipe Run    1    6    4.5

# ───────────────────────────── more helpers ─────────────────────────────

WS Edge Pick
    [Documentation]    Edge input on the quantity of one count-sheet line: reset to 1, type ``${typed}``, commit. The
    ...    box then shows ``${shown}`` (whole counts are rounded on screen, so the default tolerance is
    ...    0.5), totals equal the engine.
    [Arguments]    ${level_id}    ${item}    ${typed}    ${shown}    ${exact}=${FALSE}    ${tolerance}=0.5
    WS Set Pick Quantity    ${item}    1    ${exact}
    WS Pick Quantity Should Be    ${item}    1    ${exact}
    WS Set Pick Quantity    ${item}    ${typed}    ${exact}
    ${sel}=    WS Pick Box    ${item}    ${exact}
    WS Box Should Show    ${sel}    ${shown}    ${tolerance}
    WS Check Edge Result    ${level_id}    ${typed}

WS Pick Line Count Should Be
    [Documentation]    Number of count-sheet lines (quantity boxes) on a pick-list level.
    [Arguments]    ${count}
    Get Element Count    css=input[aria-label^="จำนวน "], input[aria-label^="ปริมาณ "]    ==    ${count}

WS Cable Card Count Should Be
    [Documentation]    Number of circuit cards of the cable level (each has a main-wire group).
    [Arguments]    ${count}
    Get Element Count    css=[role="radiogroup"][aria-label="ขนาดสายเมนวงจร"]    ==    ${count}

WS Clear Cable Wiring
    [Documentation]    Forget every wire choice of the cable level (as a project saved before the circuits were wired)
    ...    and reload.
    ${project}=    Read Guest Project
    ${calculators}=    Get From Dictionary    ${project}    calculators
    ${cable}=    Get From Dictionary    ${calculators}    electrical-cable    default=${{ {} }}
    Set To Dictionary    ${cable}    wiring=${{ {} }}
    WS Seed Calculator Input    electrical-cable    ${cable}

WS Seed Pick Items
    [Documentation]    Replace the list of a pick-list calculator with the given rows, each written ``item|qty|unit``,
    ...    e.g. an old saved project with an item that is not in the catalogue or an item listed twice.
    [Arguments]    ${calc_id}    @{rows}
    ${items}=    Evaluate
    ...    [dict(item=r.split('|')[0], qty=float(r.split('|')[1]), unit=r.split('|')[2], mat=None, lab=None) for r in $rows]
    VAR    &{value}    items=${items}
    WS Seed Calculator Input    ${calc_id}    ${value}

WS Extra Row Quantity Box
    [Documentation]    Selector of the quantity box of the ``${index}``-th row of the "รายการเพิ่มเติม" table (rows
    ...    that are not the first row of a catalogue item: duplicates and free text).
    [Arguments]    ${index}=0
    RETURN    css=input[aria-label="จำนวน"] >> nth=${index}
