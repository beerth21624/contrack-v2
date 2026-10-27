# Robot Framework E2E reference (Next.js 16 / React 19 / AntD 6, Thai UI, Windows 11, Node 24, Python 3.12)

Legend: [V] = verified this session (PyPI JSON / official page, URL given). [K] = established Robot/Playwright knowledge,
NOT re-fetched (the Browser keyword-doc page is a JS app and could not be fetched). Confirm exact signatures with
`python -m robot.libdoc Browser show "Keyword Name"` before coding.

## 0. Versions found (PyPI JSON, queried 2026-10-27)
| Package | Version | Date | Notes | Source |
|---|---|---|---|---|
| robotframework | 7.5 | 2026-09-14 | Python >=3.8 | https://pypi.org/pypi/robotframework/7.5/json |
| robotframework-browser | 20.6.0 | current PyPI latest (date not shown) | Python >=3.10; needs RF >=7.1.1,<9; deps pinned by it: grpcio 1.84.0, protobuf 7.35.1, assertion-engine 5.0.1, pythonlibcore 4.6.0 | https://pypi.org/pypi/robotframework-browser/20.6.0/json |
| robotframework-requests (RequestsLibrary) | 0.9.7 stable (2024-04-07); 1.0a14 pre-release (2024-11-07) | | pin 0.9.7 | https://pypi.org/pypi/robotframework-requests/json |
| robotframework-pabot | 5.2.2 | 2026-02-18 | | https://pypi.org/pypi/robotframework-pabot/5.2.2/json |
| robotframework-robocop | 9.1.2 | 2026-10-23 | Python >=3.10; includes formatter (`robocop format`) | https://pypi.org/pypi/robotframework-robocop/9.1.2/json |
| robotframework-tidy | 4.18.0 | 2025-07-03 | DEPRECATED; merged into Robocop 6+ | https://pypi.org/pypi/robotframework-tidy/json |

Other sources: Browser install README (Node 22/24/26 LTS supported) https://github.com/MarketSquare/robotframework-browser ;
keyword docs https://marketsquare.github.io/robotframework-browser/Browser.html ;
style guide (v0.10b) https://docs.robotframework.org/docs/style_guide ;
user guide https://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html ; Robocop docs https://robocop.dev

---------------------------------------------------------------------
## 1. Robot Framework conventions

### 1.1 Official style guide [V]
- Section order: `*** Comments ***`, `*** Settings ***`, `*** Variables ***`, `*** Test Cases ***`, `*** Keywords ***`.
- Headers left-aligned; 2 blank lines after each section (1 after the last).
- Separator: at least 4 spaces; indent 4 spaces; line length ~120; no trailing whitespace.
- Assignment: `${var}    value` or `${var} =    value` (one space before `=`); avoid `${var}=`.
- Continuation: `...` at the start of the new line, one argument per line, not indented.
- Variable case by scope: GLOBAL/SUITE/TEST `${UPPER CASE}`; LOCAL and arguments `${lower case}`.
- Keywords: Title Case With Spaces; alphabetize in resource files. Tests: descriptive Title Case sentence.
- Settings order: Documentation, Metadata, Library, Resource, Variables, Suite Setup, Suite Teardown, Test Setup, Test Teardown, Test Template, Test Timeout, Default Tags, Test Tags.
- In a test: `[Documentation]`, `[Tags]`, `[Timeout]`, `[Setup]`, `[Template]`, body, `[Teardown]`.
- In a keyword: `[Documentation]`, `[Tags]`, `[Arguments]`, `[Timeout]`, `[Setup]`, body, `[Teardown]`.
- 1 blank line between tests/keywords; none between templated data rows.
- Tags lowercase-hyphenated (`smoke`, `boq-edit`). Resource files `.resource`, suites `.robot`.

### 1.2 Skeleton
```robot
*** Settings ***
Documentation       BOQ page smoke tests.
Resource            ../resources/common.resource
Resource            ../resources/pages/boq_page.resource
Suite Setup         Open Application
Suite Teardown      Close Browser    ALL
Test Setup          Start Clean Page
Test Teardown       Capture Evidence On Failure
Test Tags           boq    regression


*** Variables ***
${BASE URL}         http://localhost:3000


*** Test Cases ***
User Can Add A BOQ Row
    [Documentation]    Adds a row and checks that the total updates.
    [Tags]    smoke
    Open BOQ Page
    Add Row With Quantity    10
    Total Should Be    1,000.00


*** Keywords ***
Start Clean Page
    New Context    viewport={'width': 1440, 'height': 900}    locale=th-TH
    New Page    ${BASE URL}
```
`Test Tags` (RF 6.0+) replaced `Force Tags`. `[Tags]` on a test ADDS to Test Tags; `[Tags]    -smoke` removes one.

### 1.3 Resource files vs libraries
- Resource (`.resource`): Robot keywords + variables via `Resource`; use for page objects and flows.
- Library (Python): `Library`; for logic awkward in Robot (data generation, math, DB).
- Variable files: `Variables    vars/env.py` (Python, computable) or YAML/JSON.
- Paths resolve relative to the importing file; use `${CURDIR}` for robustness.

### 1.4 Tags and selection [K]
```
robot --include smoke --exclude wip tests
robot -i regressionANDboq tests        # AND / OR / NOT in tag patterns
robot --test "Name*" --suite name tests
robot --rerunfailed results/output.xml tests
```
Reserved tags: `robot:skip`, `robot:exclude`, `robot:continue-on-failure`, `robot:stop-on-failure`.

### 1.5 Setup / Teardown
- `Suite Setup/Teardown` once per file (or in `__init__.robot` for a directory); `Test Setup/Teardown` per test; `[Setup]/[Teardown]` override per test.
- Teardown always runs, all its keywords execute even if one fails. If Suite Setup fails, all tests in the suite fail.

### 1.6 Data-driven [Template]
```robot
*** Test Cases ***
Invalid Quantity Is Rejected
    [Template]    Quantity Should Be Rejected
    abc
    -5
    0

Row Totals
    [Template]    Row Total Should Be
    10    100    1,000.00
    2     50     100.00
```
Or `Test Template    Keyword` in Settings. Failing rows do not stop later rows.

### 1.7 Control flow (RF 7) [K]
```robot
FOR    ${row}    IN    @{ROWS}
    Fill Row    ${row}
END
FOR    ${i}    IN RANGE    3
    Click    id=add
END
WHILE    ${count} < 5    limit=10    on_limit=FAIL
    ${count} =    Evaluate    ${count} + 1
END
IF    ${x} > 3
    Log    big
ELSE IF    ${x} == 3
    Log    three
ELSE
    Log    small
END
TRY
    Click    text=ปิด    timeout=1s
EXCEPT    *Timeout*    type=GLOB
    Log    no popup
EXCEPT    AS    ${err}
    Log    ${err}
ELSE
    Log    clicked
FINALLY
    Log    always
END
```
`BREAK`, `CONTINUE`, `RETURN`; inline `IF    ${x}    BREAK`.
`Run Keyword And Expect Error    *Timeout*    Click    id=missing` (glob default; prefixes `EQUALS:`, `STARTS:`, `REGEXP:`). Prefer TRY/EXCEPT.
Also `Run Keyword And Ignore Error`, `Run Keyword And Return Status`, `Run Keyword If Test Failed` (teardown only), `Wait Until Keyword Succeeds    5x    500ms    Kw`.

### 1.7a VAR syntax (RF 7.0+) [K]
```robot
VAR    ${name}      Alice
VAR    @{items}     a    b    c
VAR    &{cfg}       url=http://x    port=3000
VAR    ${SHARED}    value    scope=SUITE      # TEST (default), SUITE, SUITES, GLOBAL, LOCAL
```
Replaces most `Set Suite Variable` / `Set Test Variable` / `Create List` uses. RF 7 also supports typed args `[Arguments]    ${n: int}`.

### 1.8 Output / rerun / parallel [K]
```
robot -d results --output output.xml --log log.html --report report.html tests
robot -d results --rerunfailed results/output.xml --output rerun.xml tests
rebot -d results --merge results/output.xml results/rerun.xml
robot -d results -v BASE_URL:http://localhost:3000 --variablefile variables/env.py tests
robot --loglevel DEBUG --consolecolors off --console dotted --xunit xunit.xml tests
```
- Exit code = number of failed tests (max 250). `--nostatusrc` forces 0 (do not use in CI).
- `--skiponfailure flaky` marks failing tests tagged `flaky` as SKIP.
- pabot 5.2.2: `pabot --processes 4 --outputdir results tests`; `--testlevelsplit` parallelises per test; `Library    pabot.PabotLib` for locks.
  Each process starts its own Playwright node process; only use if tests have isolated data. Accepts normal robot options.

### 1.9 Lint / format
- `robotframework-tidy` is deprecated; its formatter is part of Robocop >= 6.0. Use `robotframework-robocop` 9.1.2 only.
- `robocop check tests resources`, `robocop check --fix`, `robocop format tests resources`, CI: `robocop format --check --diff`.
- Config in `pyproject.toml` or `robocop.toml` (key names indicative; check `robocop check --help`, `robocop list rules`, https://robocop.dev):
```toml
[tool.robocop]
include = ["tests", "resources"]

[tool.robocop.lint]
select = ["ALL"]
ignore = ["DOC01"]          # example: do not force documentation on every keyword

[tool.robocop.format]
space-count = 4
line-length = 120
```

---------------------------------------------------------------------
## 2. Browser library (robotframework-browser 20.6.0)

### 2.1 Install on Windows [V README]
```
py -3.12 -m venv .venv
.venv\Scripts\activate
python -m pip install -U pip
pip install robotframework==7.5 robotframework-browser==20.6.0
rfbrowser init chromium          # node deps + Chromium only (plain `rfbrowser init` = all 3 browsers, >700 MB)
python -m Browser.entry init     # if rfbrowser is not on PATH
```
Needs Node 22/24/26 LTS (Node 24 fine). No-Node alternative: `pip install robotframework-browser[bb]` then `rfbrowser install`.
`rfbrowser init --skip-browsers` skips browser binaries. Node 26/npm 12: approve post-install scripts first.
Offline keyword docs: `python -m robot.libdoc Browser Browser.html`.

### 2.2 Concepts
- Browser -> Context -> Page. `New Browser` launches; `New Context` = isolated profile (cookies/localStorage); `New Page url` opens a tab. `New Page` auto-creates browser+context if missing.
- `Close Browser ALL|CURRENT`, `Close Context`, `Close Page`, `Switch Page`.
- Auto-waiting: actions (`Click`, `Fill Text`, `Type Text`, `Check Checkbox`, `Select Options By`) wait for attached/visible/stable/enabled up to the timeout (default 10 s). `force=True` skips checks (avoid).
- Retrying assertions: a getter WITH an operator retries until it passes or `retry_assertions_for` (default 1 s) runs out. `Get Text    css=.x    ==    Done` retries; without operator it returns at once.
  `Set Retry Assertions For    5s` (global, returns old value).
- Timeouts: `Set Browser Timeout    15s`; most keywords accept `timeout=`.

### 2.3 Startup template
```robot
*** Settings ***
Library    Browser    auto_closing_level=TEST    retry_assertions_for=5s    timeout=15s
# auto_closing_level SUITE|TEST|MANUAL. Default run_on_failure = Take Screenshot (saved under ${OUTPUT DIR}/browser/screenshot)

*** Keywords ***
Open Application
    New Browser    chromium    headless=${HEADLESS}
    New Context    viewport={'width': 1440, 'height': 900}    locale=th-TH    timezoneId=Asia/Bangkok
    ...    recordVideo={'dir': '${OUTPUT DIR}/video', 'size': {'width': 1280, 'height': 720}}
    New Page    ${BASE URL}
```
[K] `New Browser    browser=chromium|firefox|webkit    headless=True    args=[...]    slowMo=0:00:00.2    channel=chrome|msedge`.
`New Context    acceptDownloads=True    ignoreHTTPSErrors=True    storageState=auth.json    tracing=${OUTPUT DIR}/trace.zip    permissions=[...]    colorScheme=light`.
Trace viewer: `rfbrowser show-trace trace.zip` or `npx playwright show-trace trace.zip`. Video is written when the context closes. `Save Storage State` reuses a logged-in session.
Already-running dev server: nothing special; Browser launches its own Chromium and navigates to `http://localhost:3000`. No `webServer` auto-start like Playwright Test; verify reachability in Suite Setup (RequestsLibrary or `Wait Until Keyword Succeeds`).
Headed: `-v HEADLESS:False`. Other browser: `-v BROWSER:firefox` (if you parametrise it).

### 2.4 Key keywords [K]
Navigation: `Go To    url`, `Reload`, `Go Back`, `Get Url    ==    expected`, `Get Title`, `Wait For Load State    load|domcontentloaded|networkidle`.
Actions:
- `Click    selector    [button]    [clickCount]    [force]    [trial]    [timeout]`, `Hover`, `Focus`, `Check Checkbox`, `Uncheck Checkbox`.
- `Fill Text    selector    txt` (clears then sets, one input event); `Clear Text    selector`.
- `Type Text    selector    txt    delay=0:00:00    clear=True` (real key events).
- `Press Keys    selector    *keys` e.g. `Press Keys    ${sel}    Control+a    Backspace`, `Press Keys    ${sel}    Tab`, `Press Keys    ${sel}    Enter`.
- `Keyboard Key    press|down|up    Escape` (focused element), `Keyboard Input    type    text`.
- `Select Options By    selector    value|label|text|index    *values` (native `<select>` only; AntD Select is not native).
- `Scroll To Element    selector`, `Scroll By`.
- `Upload File By Selector    selector    path` (selector of `input[type=file]`).
- `Handle Future Dialogs    action=accept|dismiss    [prompt_input]` - call BEFORE the action that opens alert/confirm.
- Download: `${p} =    Promise To    Download    ${url}` or `Promise To Wait For Download    ${OUTPUT DIR}/x.xlsx`, then `Click`, then `Wait For    ${p}`.
Getters (optional operator, expected, `message=`):
`Get Text`, `Get Element Count    sel    ==    3`, `Get Attribute    sel    attr    ==    v`, `Get Property    sel    value|innerText|checked`, `Get Classes`, `Get Element States    sel    *=    visible enabled`, `Get Checkbox State`, `Get Element`, `Get Elements`, `Get Table Cell Element    table_selector    column    row`, `Get Style`, `Get BoundingBox`. `Get Text` on `<input>` returns its value.
Waiting: `Wait For Elements State    selector    visible|hidden|attached|detached|enabled|disabled|editable|readonly|checked|unchecked|focused|stable    timeout=5s`, `Wait For Condition`, `Wait For Function`, `Wait For Response`, `Wait For Request`, `Wait Until Network Is Idle`.
Promises:
```robot
${promise} =    Promise To    Wait For Response    matcher=**/api/boq/save    timeout=10s
Click    text=บันทึก
${resp} =    Wait For    ${promise}
Should Be Equal As Integers    ${resp}[status]    200
```
(Create the promise before the triggering action to avoid races. `HTTP    url    method=POST    body=...` makes requests from the page context.)
Storage/JS: `LocalStorage Set Item    key    value`, `LocalStorage Get Item    key`, `LocalStorage Remove Item    key`, `LocalStorage Clear`, `SessionStorage Set Item`, `Get Cookies`, `Delete All Cookies`.
`Evaluate JavaScript    ${None}    () => localStorage.clear()`; with element: `Evaluate JavaScript    css=.x    (e) => e.innerText`.
Screenshots: `Take Screenshot    filename=boq-{index}    selector=css=.ant-modal    fullPage=True`.
Other: `Set Strict Mode    False` (global), `Set Viewport Size    1440    900`, `Highlight Elements`.

### 2.5 Selector strategies [K]
- Engines: `css=`, `xpath=` (or leading `//`), `text=` (case-insensitive substring; quoted `"Exact"` = exact; `text=/regex/i`), `id=foo`, `role=button[name="บันทึก"]`, plus `data-testid` via `css=[data-testid="x"]` (works everywhere; library may also support `data-testid=x` through testIdAttribute - verify).
- Chaining: `css=.ant-modal >> text=บันทึก`; iframe: `iframe#f >>> css=button`; open shadow DOM pierced.
- Positional: `css=.ant-table-row >> nth=0` (0-based, `nth=-1` last).
- Playwright CSS extras: `:has-text("x")`, `:text("x")`, `:text-is("x")`, `:has(sel)`, `:visible`, `:nth-match(.x, 3)` (1-based). Example `css=tr:has-text("ค่าแรง")`.
- Quoting: inside CSS attribute selectors use single quotes if the Robot value contains double quotes.
- Strict mode (default on): actions and `Get Text` fail if the selector matches >1 element. Fix by narrowing, `>> nth=0`, `:visible`, `Get Elements` + loop; `Get Element Count` is never strict. `Set Strict Mode    False` is a global last resort.
- Thai text: keep files UTF-8; use `contains`/`*=`; beware Thai vs Arabic digits and Buddhist-era years.

### 2.6 Assertion operators (assertion-engine 5.0.1) [K]
`==` / `equal` / `should be`; `!=`; `<` `>` `<=` `>=`; `*=` / `contains`; `^=` starts with; `$=` ends with; `matches` (regex); `validate` (Python expr using `value`); `then` / `evaluate` (transform value); `not contains`; `length`-style variants.
```robot
Get Text            css=.total              ==          1,000.00
Get Text            css=.total              contains    1,000
Get Text            css=.total              validate    float(value.replace(',', '')) > 500
Get Element Count   css=.ant-table-row      >=          1
Get Element States  css=button#save         *=          enabled
Get Url             *=    /boq
Get Attribute       css=input    value      ==          10
${text} =           Get Text    css=.x      # no operator: returns immediately
```

### 2.7 Browser vs SeleniumLibrary
| | Browser (Playwright) | SeleniumLibrary |
|---|---|---|
| Waiting | actionability auto-wait + retrying assertions | explicit `Wait Until ...` |
| Speed | faster, cheap contexts | slower, new browser/profile |
| Selectors | text/role/css/xpath, chaining, nth | css/xpath/id/name/link |
| Debug | trace, video, screenshots | screenshots |
| Setup | Node + browser download | driver (Selenium Manager) |
Recommendation: Browser library for a React/AntD SPA. Dynamic rendering, portal overlays, animations and re-renders are what auto-wait, strict mode and retry assertions handle; selectors re-resolve on every call (no stale elements); trace/video help CI debugging. Use SeleniumLibrary only for legacy browsers/grids.

---------------------------------------------------------------------
## 3. Project structure and helpers

```
e2e/
  requirements.txt
  robot.toml                  # RF 7 default options
  .gitignore                  # results/ .venv/ node_modules/ __pycache__/
  variables/env.py            # BASE_URL, API_URL, HEADLESS from os.environ
  resources/
    common.resource           # setup/teardown, evidence on failure
    api.resource              # RequestsLibrary session + helpers
    components/antd.resource  # AntD helper keywords
    pages/login_page.resource
    pages/boq_page.resource
    pages/planning_page.resource
  libraries/
    data_factory.py
    thai_utils.py
  tests/
    __init__.robot            # optional suite setup/teardown
    smoke/01_login.robot
    regression/boq_calculations.robot
  results/                    # git-ignored
```
`robot.toml` [K]:
```toml
outputdir = "results"
variablefile = ["variables/env.py"]
pythonpath = ["libraries", "."]
exclude = ["wip"]
```
Run: `robot -d results tests/`, `robot -d results -i smoke tests`, `robot -A args.txt tests`.

### 3.1 Variables
- CLI: `-v NAME:value` (first colon splits; `-v BASE_URL:http://localhost:3000` is fine).
- Variable file: `--variablefile variables/env.py` (optionally `env.py:staging` -> `get_variables(arg)`).
- Environment: `%{E2E_BASE_URL=http://localhost:3000}` in Variables; or `os.environ` in the variable file.
- Precedence: CLI > Settings-imported variable files > Variables section.
```python
# variables/env.py
import os
BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:3000")
API_URL = os.environ.get("E2E_API_URL", "http://localhost:8000")
HEADLESS = os.environ.get("E2E_HEADLESS", "true").lower() == "true"
```

### 3.2 Python keyword library
```python
# libraries/boq_helpers.py
from robot.api import logger
from robot.api.deco import keyword, library

@library(scope="GLOBAL", auto_keywords=False)
class BoqHelpers:
    @keyword("Calculate Row Total")
    def calculate_row_total(self, qty: float, unit_price: float) -> str:
        total = round(qty * unit_price, 2)
        logger.info(f"total={total}")
        return f"{total:,.2f}"

    @keyword(name="Make Unique Name", tags=["data"])
    def unique_name(self, prefix: str = "AUTO") -> str:
        import time
        return f"{prefix}-{int(time.time())}"
```
Import: `Library    ${CURDIR}/../libraries/boq_helpers.py` or add `libraries` to `--pythonpath` and `Library    boq_helpers`.
Plain module functions also work (`def calculate_row_total` -> "Calculate Row Total"). Fail by raising `AssertionError`. Type hints drive argument conversion.

### 3.3 RequestsLibrary (robotframework-requests 0.9.7) [K usage]
```robot
*** Settings ***
Library    RequestsLibrary
Library    Collections

*** Test Cases ***
Create Item Via API
    Create Session    api    ${API URL}    headers=${HEADERS}    verify=${TRUE}
    ${body} =    Create Dictionary    name=Test    qty=${5}
    ${resp} =    POST On Session    api    /items    json=${body}    expected_status=201
    Should Be Equal    ${resp.json()}[name]    Test
    ${resp} =    GET On Session    api    /items/${resp.json()}[id]    expected_status=200
    ${resp} =    GET On Session    api    /missing    expected_status=404
    DELETE On Session    api    /items/1    expected_status=any
    Status Should Be    200    ${resp}
    Delete All Sessions
```
- `expected_status`: int, `any`, or string; default raises on 4xx/5xx. Other args: `params=`, `data=`, `json=`, `headers=`, `timeout=`, `files=`.
- Response is `requests.Response`: `${resp.status_code}`, `${resp.json()}`, `${resp.text}`.
- Auth via `headers=` (`Authorization=Bearer ...`) or `auth=`. 1.0 is still alpha; pin 0.9.7.
- Use API calls for data seed/teardown; UI only for what is under test.

---------------------------------------------------------------------
## 4. Ant Design with Playwright selectors

AntD prefix is `ant-` by default (check the DOM once for v6; ConfigProvider can change it). Overlays render in a portal under `<body>`; do not scope them inside the page container.
```robot
*** Keywords ***
Select Antd Option
    [Arguments]    ${select}    ${option text}
    Click    ${select} >> .ant-select-selector
    Click    css=.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title='${option text}']
    # alt: ... >> role=option[name="${option text}"]
    Wait For Elements State    css=.ant-select-dropdown:not(.ant-select-dropdown-hidden)    detached    timeout=3s

Set Antd Input Number
    [Arguments]    ${selector}    ${value}
    Fill Text    ${selector} >> .ant-input-number-input    ${value}
    Press Keys    ${selector} >> .ant-input-number-input    Tab
    Get Attribute    ${selector} >> .ant-input-number-input    aria-valuenow    ==    ${value}

Antd Message Should Contain
    [Arguments]    ${text}
    Get Text    css=.ant-message-notice-content    contains    ${text}
```
- InputNumber: `<input class="ant-input-number-input">` inside `.ant-input-number`. Formatter/precision/parser applied on blur, so displayed value may be formatted ("1" -> "1.00", thousands separators); `aria-valuenow` has the raw value. Fill, then `Tab` or `Enter` to commit.
- Select: click `.ant-select-selector`. Options are virtualised (only ~10 in DOM): type to filter if `showSearch`, or scroll. Option text in `title` and `.ant-select-item-option-content`. Chosen value `.ant-select-selection-item` (title). Multi: one `.ant-select-selection-item` per tag. Use `:not(.ant-select-dropdown-hidden)` because closed dropdowns linger in DOM.
- Modal: `.ant-modal` content, `.ant-modal-wrap` container, `.ant-modal-title`, `.ant-modal-footer button`, `.ant-modal-close`. Animated: wait for hidden/detached. `Modal.confirm` -> `.ant-modal-confirm`, OK = `.ant-btn-primary`. Stale hidden modals cause strict-mode errors; scope with `:visible`.
- Message/notification: `.ant-message-notice` (auto-dismiss ~3 s - assert right after the action with a retrying getter); `.ant-notification-notice`.
- Table: `.ant-table-row` (also `tr[data-row-key="..."]`, a stable hook), cells `td.ant-table-cell`, header `.ant-table-thead th`. Scroll/fixed-header tables split header and body into separate `<table>`s, so `Get Table Cell Element` may fail; use `css=.ant-table-row >> nth=2 >> td >> nth=1`. Skip `.ant-table-measure-row` and `.ant-table-placeholder`. Pagination `.ant-pagination-next`, `.ant-pagination-item-2`.
- Tabs: `.ant-tabs-tab` (role=tab); active `.ant-tabs-tab-active`; `Click    role=tab[name="งบประมาณ"]`, then `Get Attribute    role=tab[name="..."]    aria-selected    ==    true`; panel `.ant-tabs-tabpane-active`.
- Checkbox: the real input is visually hidden; click the wrapper (`Click    css=.ant-checkbox-wrapper >> text=ยอมรับ`), assert with `Get Checkbox State    css=.ant-checkbox-wrapper >> input    ==    checked`. Row selection: `tr[data-row-key=1] .ant-checkbox-input`.
- Switch: `button.ant-switch` (role=switch); `Get Attribute    css=.ant-switch    aria-checked    ==    true` or class `ant-switch-checked`.
- Radio: `.ant-radio-wrapper`. Drawer: `.ant-drawer-content-wrapper`, `.ant-drawer-body`, `.ant-drawer-close` (animated). Collapse: `.ant-collapse-header` to toggle, `.ant-collapse-item-active` when open.
- Popconfirm: `.ant-popconfirm .ant-btn-primary`. Dropdown: `.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item`.
- DatePicker: type into `.ant-picker input` + Enter, or click `.ant-picker-cell[title="2026-10-27"]`; mind locale/Buddhist year.
- Loading button: `.ant-btn-loading` - wait for `detached`. Form errors: `.ant-form-item-explain-error`; field ids come from Form `name` (`#boq_qty`).
- Upload: `Upload File By Selector    css=.ant-upload input[type=file]    ${path}`.

### 4.1 Typing into controlled React inputs
- `Fill Text` is the default: clears, sets value, dispatches `input` event; works with React controlled inputs.
- `Type Text` (`clear=True`) when the app depends on key events (search-as-you-type, masks, `onKeyDown`); add `delay=50ms` for debounced search.
- If a field will not clear: `Press Keys    sel    Control+a    Backspace`.
- Commit-on-blur / on-Enter (InputNumber, editable table cells): follow with `Press Keys    sel    Tab` or `Enter`, then assert the dependent value with a retrying `Get Text ... ==`.
- Not for contenteditable / rich editors with `Fill Text`; use `Type Text`.

---------------------------------------------------------------------
## 5. Robustness best practices

### 5.1 Selectors
- Add stable `data-testid` to key controls in the app. Priority: `data-testid` > role+name > placeholder/label > AntD class > text > xpath/nth.
- AntD forwards `data-*` to the root element (Select: wrapper, not the input): `[data-testid="unit"] >> .ant-select-selector`.
- Keep locators as per-page variables:
```robot
*** Variables ***
${BOQ ADD ROW}      css=[data-testid="boq-add-row"]
${BOQ ROW}          css=[data-testid^="boq-row-"]
```
- Keep Thai strings in one variables file; set `PYTHONUTF8=1` on Windows.

### 5.2 Isolation and determinism
- Fresh context per test (`New Context` in Test Setup; `auto_closing_level=TEST`).
- localStorage is per origin: `New Page` first, then `LocalStorage Clear`, or seed via `LocalStorage Set Item` and `Reload`, or `storageState=`.
- Seed via API; unique names (`${{ uuid.uuid4().hex[:8] }}` needs `modules=uuid` via `Evaluate`); clean up in Teardown. Tests must be order-independent.
- `next dev` compiles routes on first hit (slow): warm up routes in Suite Setup, `Set Browser Timeout    30s` for first loads, avoid `networkidle` (HMR websocket stays open); wait for a concrete element. Prefer `next build && next start` for stable runs.

### 5.3 No sleeps
Use retrying assertions, `Wait For Elements State`, `Promise To  Wait For Response`, `Wait For Function`, `Wait Until Keyword Succeeds    5x    500ms`. For animations wait for `detached`/`hidden`. Raise `Set Retry Assertions For    5s` deliberately.

### 5.4 Evidence on failure
```robot
*** Keywords ***
Capture Evidence On Failure
    Run Keyword If Test Failed    Take Screenshot    fullPage=True    filename=failure-{index}
    Close Context
```
Browser's default `run_on_failure=Take Screenshot` already fires on Browser keyword failures (`run_on_failure=None` disables). Add `tracing=` and `recordVideo`; keep artifacts as CI outputs. Avoid Thai or path characters in filenames; use `{index}`.

### 5.5 Tagging
`smoke` (<5 min critical path), `regression`, feature tags (`boq`, `planning`), `api`, `slow`, `wip`, `flaky`. `Test Tags` per file, `[Tags]` for exceptions. Quarantine: `--exclude flaky` or `--skiponfailure flaky`. Reruns: `--rerunfailed` + `rebot --merge`.

### 5.6 CI output
`robot -d results --xunit xunit.xml --consolecolors off --consolewidth 120 --console dotted tests`; archive `log.html`, `report.html`, `output.xml`, `browser/` (screenshots), video, trace. Keep exit code on. Gate with `robocop check` + `robocop format --check --diff`. Health check: `Wait Until Keyword Succeeds    60s    2s    GET    ${BASE URL}    expected_status=200` (RequestsLibrary session or `Evaluate`-based).

### 5.7 Flake checklist
1. Strict violations: fix selector, never `force=True`. 2. Animations: wait detached, scope to visible overlay. 3. Toasts vanish: assert immediately with retry. 4. Debounced inputs: promise on API response. 5. Dev-server compile delays: warm-up/prod build. 6. Fix viewport, `locale=th-TH`, `timezoneId=Asia/Bangkok`. 7. No pixel comparisons.

---------------------------------------------------------------------
## 6. Recommended stack for this project

Pins (PyPI, checked 2026-10-27; Python 3.12 OK; Node 24 within Browser's supported 22/24/26):
- robotframework==7.5 (2026-09-14)
- robotframework-browser==20.6.0 (current latest; RF >=7.1.1,<9)
- robotframework-requests==0.9.7 (2024-04-07; last stable)
- robotframework-pabot==5.2.2 (2026-02-18; optional)
- robotframework-robocop==9.1.2 (2026-10-23; replaces deprecated robotframework-tidy 4.18.0)
Browser's own pins (grpcio, protobuf, assertion-engine, pythonlibcore) install automatically; do not pin separately.

`requirements.txt`:
```
robotframework==7.5
robotframework-browser==20.6.0
robotframework-requests==0.9.7
robotframework-pabot==5.2.2
robotframework-robocop==9.1.2
```
Setup:
```
py -3.12 -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
rfbrowser init chromium
set PYTHONUTF8=1
robot -d results -v BASE_URL:http://localhost:3000 -i smoke tests
```
Decisions: Browser library (not Selenium); page-object resources under resources/pages; one AntD helper resource; add `data-testid` in the app for core controls; API seeding via RequestsLibrary; context per test; no sleeps; Robocop for lint/format.

Caveats: [K] sections were written from established knowledge because the Browser keyword docs (JS-rendered) and Robocop config pages could not be fetched. Verify argument names with `python -m robot.libdoc Browser show "<Keyword>"` first (esp. Get Table Cell Element, Wait For Response matcher forms, tracing args, Robocop TOML keys).
