# 技術架構

<!-- 只寫 `main` branch 上已經實作的架構。設計理由寫在相關段落旁，寫出理由與放棄的做法，並連結到 archive 裡的 plan。 -->

## 技術選型

| 項目 | 選擇 |
| --- | --- |
| 頁面 | React 元件（TSX），用 Vite build |
| 樣式 | Tailwind CSS |
| 語言 | TypeScript 6.0 |
| 執行環境 | Node 24，版本寫在 `.nvmrc` |
| 套件管理 | pnpm，版本寫在 `package.json` 的 `packageManager` |
| Lint 與格式 | 程式碼用 ESLint 與 Prettier，Markdown 用 markdownlint |
| 測試 | Vitest 跑 unit test 與 integration test，Playwright 跑 E2E test |

講者與 AI agent 都從 `Makefile` 執行指令，指令列表見 `README.md`。

### 頁面

> 設計理由：每頁寫成 React 元件，AI 修改一頁時只需要讀寫一個檔案。曾考慮每頁是一份獨立的 HTML，由播放器用 iframe 載入，但預覽總覽要同時開幾十個 iframe，播放器也只能透過 `postMessage` 控制頁內分步；也考慮過把 HTML 片段注入 Shadow DOM，但片段裡的 `<script>` 不會自動執行，也沒有型別檢查。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### 樣式

> 設計理由：主流模型都熟悉 Tailwind，skill 不必說明樣式怎麼寫。CSS Modules 讓 AI 每改一頁都要讀寫兩個檔案；只透過框架元件的 props 設定樣式的話，框架要設計一整套樣式 API，並寫進每次都會載入的 skill。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### 語言

> 設計理由：TypeScript 7 改用 Go 實作，型別檢查比較快，但 typescript-eslint 的 type-aware 規則還不支援 TypeScript 7，所以 TypeScript 固定在 6.0。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### 執行環境

`src/build/` 的 build script 用 TypeScript 撰寫，由 Node 24 直接執行。Node 只會移除型別註記，不會轉譯程式碼，所以這些檔案不能用 `enum`、`namespace` 這類需要轉譯的語法，relative import 也要寫出 `.ts` 副檔名；`tsconfig.node.json` 開啟 `erasableSyntaxOnly` 與 `allowImportingTsExtensions`，所以 `make typecheck` 會擋下需要轉譯的語法，以及沒有寫出 `.ts` 副檔名的 relative import。瀏覽器端的程式碼由 Vite 轉譯，型別檢查用 `tsconfig.app.json`。

> 設計理由：Node 24 本身就能執行 TypeScript，所以不安裝 `tsx`。之後需要 decorator 或 path alias 時再改用 `tsx`。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### Lint 與格式

> 設計理由：曾考慮用 Biome 處理 lint 與格式化，但 ESLint 的 plugin 選擇比較多。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

`make lint` 先執行 `make lint-md`，用 markdownlint 檢查 Markdown，再用 ESLint 與 Prettier 檢查其他檔案；`make format` 用這三個工具自動修正能修正的問題。Prettier 不處理 Markdown，原因寫在 `.prettierignore` 的註解。markdownlint 的規則寫在 `.markdownlint.json`，要檢查哪些檔案寫在 `.markdownlint-cli2.jsonc`：markdownlint 檢查 repo 裡所有的 Markdown，但不檢查 `docs/plans/archive/` 與 `.gitignore` 排除的檔案。

### 測試

`make check` 依序執行 lint、`make check-scenarios`、型別檢查與 Vitest 的測試，E2E test 另外由 `make e2e` 執行。

> 設計理由：E2E test 要先 build 測試用的簡報，執行時間也比較長，所以不放進 `make check`。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

驗證 spec 情境的測試，標題以情境 ID 開頭；需要手動檢查的情境，步驟寫在 `tests/manual/` 裡和 spec 同名的檔案，規則寫在 sdd skill 的「Spec Conventions」。`make check-scenarios` 執行 `scripts/check-scenarios.ts`，確認每個情境都有測試或手動檢查的步驟，而且測試標題與 `tests/manual/` 寫的情境 ID 都存在於 spec。這個 script 從測試的程式碼讀出標題，不執行測試，也只用 Node 內建的模組，所以不必安裝套件就能執行。

以下是實測過的 Playwright 行為與限制，寫 plan 決定情境用 E2E test 還是手動檢查時，不必重新查證：

- 在 Playwright 裡按 F5 或 Shift+F5 時，Chromium、Firefox、WebKit 都不會重新載入網頁，所以 E2E test 驗證不了按 F5 會不會重新載入網頁。
- 全螢幕時，headless 的 Chromium 收到 Esc 不會離開全螢幕。
- E2E test 只能送出模擬的 touch 與 pointer 事件，這些事件不會經過瀏覽器處理手勢的流程，所以真實手勢的行為要在觸控裝置上手動檢查。
- 全螢幕時用瀏覽器的上一頁回到同一份文件的另一個 hash，headless 的 Chromium、Firefox、WebKit 都維持全螢幕。
- 在 Playwright 裡按 Cmd+R 或 Ctrl+R 也不會重新載入網頁。
- Playwright 預設關掉 Chromium 與 Firefox 的彈出視窗攔截，`playwright.config.ts` 把這兩個瀏覽器的攔截都打開，E2E test 裡的瀏覽器才會和真正的瀏覽器一樣，擋下沒有使用者操作就開啟的視窗。打開攔截之後，網頁在 keydown 事件裡用 `window.open` 開視窗，三個瀏覽器都不會擋下。Playwright 的 WebKit 不論怎麼設定都不會擋下彈出視窗，所以真正的 Safari 會不會擋下講者視窗，要手動檢查。
- Playwright 的每個 page 都在前景，`document.visibilityState` 一直是 `visible`，在同一個 browser context 開了新的分頁也一樣，所以 E2E test 改寫 `document.visibilityState` 並送出 `visibilitychange`，模擬觀眾視窗的分頁不在前景。
- 網頁呼叫另一個視窗的 `focus()` 時，headless 的 Chromium 與 WebKit 不會在那個視窗觸發 `focus` 事件，只有 Firefox 會，所以 E2E test 看不出視窗有沒有移到最前面，只能從同源的網頁改寫那個視窗的 `window.focus`，確認播放器呼叫了它。
- Firefox 只讓有焦點的視窗進入全螢幕，所以 E2E test 在沒有焦點的視窗按全螢幕的快捷鍵之前，先呼叫那個視窗的 `page.bringToFront()`。
- 在 macOS 上，兩個 WebKit process 同時讓彈出視窗進入全螢幕時，WebKit 會 crash；browser context 裡的彈出視窗還在全螢幕時，關閉這個 browser context 也會花掉大部分的 test timeout。所以讓講者視窗進入全螢幕的 E2E test 放在同一個 serial 的 `test.describe` 裡依序執行，每個 test 結束時也先離開全螢幕。
- `page.clock` 作用在整個 browser context，彈出視窗也用同一個時鐘；網頁重新整理之後，時鐘從重新整理前的時間接著計算。
- Chromium 的上一頁按鈕會略過標成要略過的瀏覽紀錄（見「講者視窗」一節），但 Playwright 的 `page.goBack()` 與網頁呼叫的 `history.back()` 不會略過，所以 E2E test 要在 Chromium 載入擴充功能，用和上一頁按鈕一樣會略過這些紀錄的 `chrome.tabs.goBack()`，才驗證得了上一頁按鈕的行為。而且 Chromium 把 Playwright 的 `page.evaluate()` 與 locator 的 `textContent()` 這類在網頁裡執行程式的 API 算成使用者操作，呼叫這些 API 之後，Chromium 會取消這些標記。

## 模組劃分

```text
.
├── decks/
│   └── <deck-id>/
│       ├── deck.json           標題、publish、頁面順序
│       ├── slides/
│       │   └── <slide-id>.tsx  每一頁一個 TSX 檔
│       └── assets/             圖片、影片等素材
├── scripts/                    開發用的檢查 script
├── src/
│   ├── build/                  Build script、dev server 與 Vite plugin
│   ├── framework/              頁面 import 的元件與 hook
│   ├── player/                 播放器
│   └── site/                   網站首頁
├── tests/
│   ├── unit/                   Vitest 的 unit test
│   ├── integration/            Vitest 的 integration test
│   ├── e2e/                    Playwright 的 E2E test
│   ├── manual/                 需要手動檢查的情境的步驟
│   └── fixtures/
│       └── decks/              測試用的簡報
└── dist/                       Build 出來的檔案，不 commit 進 git
    ├── index.html              網站首頁
    ├── _assets/                網站首頁的 JS 與 CSS
    └── <deck-id>/              一份簡報的 slidetray
```

所有測試集中在 `tests/`，依種類分成 `unit/`、`integration/`、`e2e/`，需要手動檢查的情境的步驟寫在 `manual/`；測試用的簡報放在 `tests/fixtures/decks/`。

> 設計理由：測試集中在 `tests/`，瀏覽專案時程式碼與測試不會混在一起。曾考慮把 unit test 放在被測的程式碼旁邊，方便找到某個模組的測試，但測試的名稱以需求 ID 開頭，用需求 ID 一樣找得到測試；而且 integration test 與 E2E test 跑的是完整的 build，不屬於任何一個模組，只能放在獨立的目錄，三種測試會變成兩套放法。測試用的簡報不放進 `decks/`，部署用的 build 才不會把這些簡報發布到網站上。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### 簡報目錄

所有簡報都和框架的程式碼放在本 repo，每份簡報是 `decks/` 底下的一個目錄，目錄的格式寫在 [framework.md](framework.md)。

> 設計理由：改框架時，型別檢查會一起檢查所有簡報。曾考慮把框架發布成 npm 套件，讓每份簡報各自放在一個 repo；也考慮過把所有簡報集中放在另一個 repo。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

圖片、影片等素材放在簡報目錄的 `assets/`，直接 commit 進 git，單一檔案的大小上限寫在 [distribution.md](distribution.md) 的 DIST-R6。

> 設計理由：曾考慮用 Git LFS 存放素材，但不論素材有沒有用 Git LFS 存放，GitHub Pages 的網站大小上限都是 1 GB，而且每次部署時 GitHub Actions 下載 Git LFS 的檔案都會消耗 Git LFS 的頻寬額度。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### 程式碼

- `src/build/cli.ts` 是 `make build`、`make build-site` 與 `make dev` 的入口。
- `src/build/plugins.ts` 的 Vite plugin 提供兩個 virtual module：`virtual:deck` 依 `deck.json` 的順序匯入一份簡報的每一頁，`virtual:site` 提供網站首頁要列出的 deck ID 與標題。
- `src/framework/` 是頁面 import 的元件與 hook，例如 `Step` 與 `useStep`。
- `src/player/` 是 Vite 的入口 HTML 與播放器。
- `src/player/presenter/` 是講者模式，包括觀眾視窗與講者視窗之間的連線，以及講者視窗的畫面。
- `src/site/` 是網站首頁的入口 HTML 與 React 元件。

> 設計理由：網站首頁用 React 與 Vite build，因為 roadmap 的「網站首頁」要沿用簡報的主題，首頁之後一定要經過 Vite build；曾考慮由 build script 直接產生靜態 HTML。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

頁面從 `#diapo` import `src/framework/` 的元件與 hook，`package.json` 的 `imports` 欄位把 `#diapo` 對應到 `src/framework/index.ts`。

> 設計理由：頁面從 `#diapo` import，因為 `#` 開頭的名稱不會被當成 npm 套件，`decks/` 與 `tests/fixtures/decks/` 裡的頁面也都寫同一個路徑。曾考慮用 Vite 的 `resolve.alias` 加上 tsconfig 的 `paths`，讓頁面從 `diapo` import，但 `diapo` 看起來像 npm 套件，AI 可能會去 npm 找這個套件；也考慮過用相對路徑 import，但 `decks/` 與 `tests/fixtures/decks/` 的深度不同，兩個目錄裡的頁面要寫不同的路徑。完整討論見 [0003](../plans/archive/0003-steps.md)。

`make dev DECK=<deck-id>` 啟動的 Vite dev server 只預覽一份簡報，和 build 這份簡報時用同一份 Vite 設定。`Makefile` 的 `DECKS_DIR` 變數預設是 `decks`；開發播放器時，執行 `make dev DECKS_DIR=tests/fixtures/decks DECK=<deck-id>`，用測試用的簡報預覽。

> 設計理由：每次 Vite build 只處理一份簡報，如果要讓一個 dev server 包含所有簡報，得另外寫 middleware 把 `/<deck-id>/` 對應到各自的入口，這段程式碼在 build 裡沒有對應的部分，所以 dev server 一次只預覽一份。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### 播放器的狀態

播放器把目前的頁面與步驟記錄在網址的 hash（NAV-R1、STEP-R11），黑畫面與輸入中的頁碼只存在記憶體。講者模式的經過時間開始計時的時刻（PRES-R9），以及觀眾視窗替講者視窗取的視窗名稱，存在觀眾視窗的 `sessionStorage`，因為 `sessionStorage` 每個分頁各自一份，重新整理之後仍然保留。網站上的簡報屬於同一個 origin，共用同一份 `sessionStorage`，所以經過時間以 deck ID 區分。瀏覽器拒絕存取 `sessionStorage` 時，例如講者封鎖了所有 cookie，播放器照常播放，只是經過時間與視窗名稱在重新整理之後不會保留。播放器不使用 `localStorage`，因為 `localStorage` 在 Chromium 與 WebKit 由所有 `file://` 網頁共用（見「從 `file://` 開啟 Slidetray」）。

播放器用 React context 把目前的步驟交給 `Step` 與 `useStep`，`Step` 與 `useStep` 也透過同一個 context 向播放器登記步驟。頁面只透過這個 context 讀出目前的步驟，所以任何 render 頁面的元件都能提供這個 context，指定頁面顯示哪一步，不必修改頁面。

播放器要等頁面 render 之後才知道步數（STEP-R5）。從下一頁往回，或 hash 指定了步驟時，播放器先用要求的步驟 render 頁面，也就是往回換頁時的最後一步，或 hash 寫的步驟；接著照下圖，在瀏覽器畫出畫面之前校正步驟。

```mermaid
sequenceDiagram
  participant player as 播放器
  participant page as 頁面的 Step 與 useStep
  participant browser as 瀏覽器
  player->>page: 用要求的步驟 render 頁面
  Note over page: useStep 回傳要求的步驟與<br/>自己參數裡的最大值兩者中較小的那個
  page->>player: 在 layout effect 裡登記步驟
  Note over player: 在 layout effect 裡算出步數，把步驟改成<br/>要求的步驟與步數兩者中較小的那個，<br/>再把 hash 改成這一步（往回換頁時，hash 在這裡才改變）
  player->>page: 用校正後的步驟再 render 一次
  Note over browser: 畫出畫面
```

頁面的 effect 也會用校正前的值執行一次。

> 設計理由：校正前的那次 render，`useStep` 最多只回傳自己參數裡的最大值，因為元件只在參數列出的步驟有變化（STEP-R4），在大於最大值的步驟畫出的內容和在最大值那一步相同，而且元件讀到的步驟不會超過自己寫過的步驟。曾考慮直接把要求的步驟交給頁面，但往回換頁時，播放器在 render 之前不知道最後一步是第幾步，只能用 `Infinity` 表示，hash 也可能寫了極大的數字；頁面寫了 `Array.from({ length: step })` 這類程式碼時，這兩種值都會讓它丟出 `RangeError`，而播放器沒有 error boundary，所以整個畫面會變成空白。完整討論見 [0003](../plans/archive/0003-steps.md)。

### 講者視窗

講者視窗載入同一份 slidetray 的 `index.html`，網址加上 `?presenter`；網址帶有這段 query string 時，`src/player/main.tsx` render 講者視窗，所以 slidetray 仍然只有一個 JS 檔與一個入口 HTML。講者視窗載入時沒有 `window.opener`，或 `window.opener` 已經關閉時，只顯示提示（PRES-R14）。兩個視窗用 `window.open` 與 `postMessage` 通訊，觀眾視窗是目前位置的 source of truth：換頁、步驟的校正與瀏覽紀錄都只在觀眾視窗執行，講者視窗把快捷鍵轉成指令送給觀眾視窗，再顯示觀眾視窗傳回的狀態，不讀取也不改寫網址的 hash。

```mermaid
sequenceDiagram
  participant presenter as 講者視窗
  participant audience as 觀眾視窗
  presenter->>audience: 載入後每 100 毫秒送出連線請求，附上 deck ID 與 build ID，直到觀眾視窗回覆
  audience->>presenter: 回覆目前的狀態：頁面、步驟、步數、黑畫面、分頁在不在前景、經過時間開始計時的時刻、deck ID 與 build ID
  Note over presenter: 講者按 →
  presenter->>audience: 下一步
  Note over audience: 照 STEP-R9 前進一步，改寫 hash
  audience->>presenter: 送出目前的狀態
  Note over audience: 重新整理
  audience->>presenter: 離開的通知（pagehide）
  Note over presenter: 顯示「連線中斷」
  presenter->>audience: 每 100 毫秒送出連線請求，直到觀眾視窗回覆
  audience->>presenter: 重新載入的網頁回覆目前的狀態
```

> 設計理由：目前的位置以觀眾視窗為準。曾考慮讓兩個視窗對等，各自有 hash 與瀏覽紀錄，任一邊換頁時另一邊照做一次，但這樣要另外規定 NAV-R6 的瀏覽紀錄在兩個視窗之間怎麼對應，以及兩邊幾乎同時換頁時以哪一邊為準；而且往回換頁時，兩個視窗各自 render 上一頁、各自算出最後一步，講者在觀眾視窗操作過互動元件時（STEP-R14），兩邊可能停在不同的步驟。完整討論見 [0004](../plans/archive/0004-presenter-mode.md)。

觀眾視窗執行講者視窗送來的跳頁指令時，觀眾視窗自己沒有收到使用者的操作，所以觀眾視窗重新載入簡報之後，Chromium 的上一頁按鈕可能略過這份簡報的所有頁面（PRES-R3）。下圖是在 Playwright 的 Chromium 實測的結果，從 `file://` 與 `http://` 開啟都一樣，上一頁與下一頁按鈕用擴充功能的 `chrome.tabs.goBack()` 與 `chrome.tabs.goForward()` 代替（見「測試」一節）：

```mermaid
stateDiagram-v2
  state "沒有收到過使用者操作" as idle
  state "收到過使用者操作" as active
  [*] --> idle: 網頁載入，包括重新整理，以及離開簡報之後用下一頁回到簡報
  idle --> idle: 新增瀏覽紀錄時，把新增之前這份簡報的所有紀錄都標成要略過，重新整理之前的紀錄也算
  idle --> active: 點畫面，或按下 Esc 與修飾鍵以外的按鍵，並取消這份簡報的紀錄上的標記
  active --> active: 新增瀏覽紀錄時不標記
```

上一頁與下一頁按鈕都會略過標成要略過的紀錄，所以點上一頁按鈕回到開啟簡報之前的網頁之後，再點下一頁按鈕，觀眾視窗會直接顯示跳頁之後的頁面；開啟簡報之前沒有其他網頁時，上一頁按鈕不能按。瀏覽器回到上一頁的快捷鍵與滑鼠的上一頁側鍵不會略過這些紀錄：實測觀眾視窗收到 Cmd+← 或 Alt+← 的 keydown 時，Chromium 就取消標記，而瀏覽器處理這兩個快捷鍵之前，網頁會先收到 keydown，例如在輸入框裡按 Cmd+← 只會移動游標；用 DevTools protocol 送出滑鼠的上一頁側鍵時，觀眾視窗也回到跳頁之前的頁面。觸控與 macOS 觸控板回到上一頁的手勢沒有實測。講者視窗在自己的 keydown 事件裡直接改觀眾視窗的網址時，Chromium 仍然把新增之前的紀錄標成要略過，因為 Chromium 只看新增紀錄的那個視窗有沒有收到使用者操作。在 Safari 手動實測，觀眾視窗重新整理之後在講者視窗跳頁，上一頁按鈕仍然回到跳頁之前的頁面；Firefox 沒有實測。

> 設計理由：觀眾視窗重新載入簡報之後，講者要先點一下觀眾視窗的畫面，點上一頁按鈕才會回到跳頁之前的頁面，PRES-R3 把這個情況寫成已知限制。曾考慮由講者視窗直接改觀眾視窗的網址，讓 Chromium 把講者在講者視窗按下的按鍵算成新增瀏覽紀錄時的使用者操作，但實測 Chromium 的上一頁按鈕仍然略過跳頁之前的頁面。完整討論見 [0004](../plans/archive/0004-presenter-mode.md)。

連線請求一律由講者視窗送出，因為觀眾視窗沒辦法在載入時用 `window.open('', name)` 找講者視窗：講者視窗不存在時，Chromium 與 Firefox 會擋下這個彈出視窗，沒擋的瀏覽器則會多開一個空白視窗。連線時兩個視窗比對 deck ID 與 build ID，deck ID 不同時，講者視窗關掉自己（PRES-R13）；build ID 不同時，講者視窗照 PRES-R12 顯示版本不同的提示。`diapo:deck` plugin 每次 build 與每次啟動 dev server 時都產生新的 build ID，寫進 `virtual:deck`。

連線另有以下規則：

- 觀眾視窗與講者視窗重新整理、關閉或離開網頁時，都在 `pagehide` 送出離開的通知。另一個視窗收到這種在網頁卸載時送出的訊息時，`event.source` 可能是 `null`，在 headless 的 Chromium、Firefox、WebKit 都出現過這種情況，所以兩個視窗收到來源是 `null` 的離開通知時，也當成另一個視窗離開。
- 觀眾視窗送出離開的通知之後就不再回覆連線請求，因為正在卸載的網頁仍然收得到訊息，會回覆講者視窗收到通知後立刻送出的連線請求，講者視窗收到這個回覆，就會把連線當成沒有中斷。網頁從 back-forward cache 還原時，觀眾視窗再恢復回覆。
- 講者視窗每 200 毫秒檢查 `window.opener`，變成 `null` 或已經關閉時，講者視窗用 `window.close()` 關掉自己（PRES-R13）。

講者在觀眾視窗按 `S` 時，觀眾視窗照下圖決定把哪個視窗當成講者視窗（PRES-R1）。觀眾視窗替講者視窗取的視窗名稱存在 `sessionStorage`，每個分頁各自一個（PRES-R15），所以觀眾視窗重新整理之後，還沒收到講者視窗的連線請求時，也能用這個名稱找到原本的講者視窗（PRES-R1.3）。

```mermaid
flowchart TD
  press("講者在觀眾視窗按 S") --> known{"觀眾視窗開過講者視窗，或收過連線請求，<br/>而且那個講者視窗還沒關閉？"}
  known -- 是 --> front("把講者視窗移到最前面")
  known -- 否 --> lookup("用 window.open('', name) 找同名的視窗")
  lookup --> blank{"找到的是新開的空白視窗？"}
  blank -- 是 --> navigate("把空白視窗導向講者視窗的網址")
  navigate --> front
  blank -- 否 --> opener{"那個視窗的 window.opener 是這個觀眾視窗？"}
  opener -- 是 --> front
  opener -- 否 --> rename("換一個新的視窗名稱，用 window.open(url, name) 開啟講者視窗")
  rename --> front
```

找到的視窗的 `window.opener` 不是這個觀眾視窗時，找到的視窗可能是瀏覽器還原的講者視窗（PRES-R14），也可能是原分頁的講者視窗，因為講者複製分頁時，瀏覽器一併複製了 `sessionStorage` 裡的視窗名稱（PRES-R15）。

從觀眾視窗開啟的講者視窗和觀眾視窗共用同一個 event loop。從 `http://` 開啟時，兩個視窗同源，HTML 規範要求同源的網頁共用 event loop；從 `file://` 開啟時，兩個視窗的 origin 不同，實測的結果也一樣：在 headless 的 Chromium、Firefox、WebKit，不論從 `file://` 還是 `http://` 開啟，觀眾視窗連續執行 3 秒的 JS 時，講者視窗的計時器一次都沒有觸發，所以講者視窗 render 頁面的時間也會讓觀眾視窗的換頁變慢。兩個視窗既然在同一個執行緒上執行，觀眾視窗所在的 process crash 時，講者視窗也一起 crash：在 Chromium 用 DevTools protocol 的 `Page.crash`、在 Firefox 開啟 `about:crashcontent` 實測都是這樣，WebKit 沒有從 Playwright 讓分頁 crash 的方式，沒有實測。

> 設計理由：講者視窗不會定時確認觀眾視窗有沒有回應。曾考慮讓講者視窗每秒向觀眾視窗送出確認，超過 2 秒沒有收到回覆就當成連線中斷，但觀眾視窗卡住或 crash 時，講者視窗自己也跟著停住或 crash，沒辦法顯示連線中斷。完整討論見 [0004](../plans/archive/0004-presenter-mode.md)。

講者視窗另外 render 目前頁、下一步與下一頁，其中目前頁與下一步是同一頁的兩份，所以目前這一頁的 effect 會在講者視窗再執行兩次，下一頁的 effect 也會在觀眾視窗換到下一頁之前，就先在講者視窗執行，所以講者視窗裡的影片聲音與圖表動畫，留給之後「圖片與影片」與「ECharts 圖表」的 plan 處理。講者視窗替這三份頁面各自提供步驟的 context，指定要顯示哪一步，但不記錄頁面登記的步驟，因為步數以觀眾視窗傳回的為準。這三份頁面放在 `inert` 的元素裡，所以講者點不到，裡面的元素也不會取得焦點；講者視窗在 render 任何頁面之前，就在 window 的 capture 階段攔下所有 keydown、keyup 與 keypress，處理完之後停止傳遞，所以講者視窗裡的頁面收不到鍵盤事件（PRES-R6）。資訊列的時鐘與經過時間各自在自己的元件裡每 200 毫秒更新，講者視窗的其他部分，包括三份頁面，不會跟著重新 render。

### 講者備註

`virtual:deck` 用 namespace import 匯入每一頁，讀出頁面匯出的 `notes`，所以講者在 `make dev` 執行時替頁面加上 `notes`，`virtual:deck` 的內容不會改變。講者視窗播放時用 `mdast-util-from-markdown` 把備註解析成 Markdown 的語法樹，再由播放器自己把語法樹 render 成 React 元素：HTML 照原文當成文字顯示，圖片改成替代文字，`#/` 開頭的連結 render 成不帶 `href` 的元素，其他連結顯示文字與網址（PRES-R10）。`mdast-util-from-markdown` 底層是 micromark，通過 CommonMark 全部的規範測試。

> 設計理由：播放器在播放時才把備註 render 成 React 元素。曾考慮在 build 時從 TSX 檔抽出 `notes` 轉成 HTML，再從頁面的模組拿掉這個匯出，由 `virtual:deck` 提供轉好的 HTML，但這樣 Vite plugin 要改寫頁面的程式碼，還要自己解析 `export { default, notes } from "./agenda"` 這種從其他檔案重新匯出的備註；而且改備註時 `virtual:deck` 跟著改變，`make dev` 和現在一樣會整頁重新載入，只有修改頁面、沒改備註時才能熱更新。完整討論見 [0004](../plans/archive/0004-presenter-mode.md)。

### 選擇備註的 Markdown Library

> 設計理由：用 `mdast-util-from-markdown` 解析備註，因為播放器要自己決定每種 node 怎麼顯示，而語法樹 render 成 React 元素時，不必用 `dangerouslySetInnerHTML`，打包後也只增加約 40 KB（minified）。曾考慮 `markdown-it` 的 `commonmark` preset，但它輸出 HTML 字串，要套用 PRES-R10 的規則得改寫它的 renderer，而且打包後約 100 KB，多出來的是 `entities`、`punycode` 與 `linkify-it`。完整討論見 [0004](../plans/archive/0004-presenter-mode.md)。

### Build 時檢查備註

`diapo:deck` plugin 在 transform hook 用 Vite 的 `parseSync`（oxc parser）解析 `slides/` 裡的每個 TSX 檔，`notes` 不符合 FRAME-R7 時丟出 `BuildError`；重新匯出的 `notes` 指向哪個檔案，plugin 用 Vite 的 `this.resolve` 解析。Vite 的 bundler Rolldown 只 transform 沿著 `virtual:deck` 的 import 關係找得到的檔案，所以檢查的範圍和 FRAME-R5 打包進 slidetray 的範圍相同。Rolldown 用檔案的實際路徑命名模組，所以 plugin 比對 `slides/` 目錄時也用實際路徑，從 symlink 連到的簡報目錄一樣會檢查。Rolldown 把 plugin 丟出的錯誤包在另一個錯誤裡，`src/build/dist.ts` 再把 `BuildError` 取出來，讓 build 只印出錯誤訊息，不印 stack trace。

## 資料流

本機 build 與部署用的 build 共用下圖的流程。

```mermaid
flowchart TD
  start("讀取 decks/ 底下每份簡報的 deck.json") --> valid{"deck.json 格式正確？"}
  valid -- 否 --> fail("Build 失敗")
  valid -- 是 --> deploy1{"部署用的 build？"}
  deploy1 -- 是 --> filter("排除 publish: false 的簡報")
  deploy1 -- 否 --> size{"有檔案超過 25 MiB？"}
  filter --> size
  size -- 是 --> fail
  size -- 否 --> vite("每份簡報各跑一次 Vite build，輸出 IIFE")
  vite --> notes{"打包進 slidetray 的頁面，<br/>notes 都符合 FRAME-R7？"}
  notes -- 否 --> fail
  notes -- 是 --> rewrite("改寫 HTML 的 script 與 link 標籤")
  rewrite --> index("用 Vite build 網站首頁 dist/index.html")
  index --> deploy2{"部署用的 build？"}
  deploy2 -- 是 --> total("網站超過 800 MiB 時顯示警告")
  deploy2 -- 否 --> done("完成")
  total --> done
```

每份簡報各跑一次 Vite build，所以 slidetray 之間不共用任何檔案，任何一個 slidetray 都能單獨複製到隨身碟。網站首頁的 JS 與 CSS 放在 `dist/_assets/`；deck ID 不能包含 `_`（FRAME-R3），所以 `dist/_assets/` 不會和任何 slidetray 同名。

每份簡報跑 Vite build 時，Tailwind 只掃描 `src/player/` 與這份簡報的目錄，所以 slidetray 的 CSS 不會混入其他簡報用到的 class。Tailwind 依檔案掃描、不看 import 關係，所以 `slides/` 裡沒有列在 `deck.json` 的頁面雖然不會打包進 slidetray 的 JS，用到的 class 仍會寫進 CSS。

> 設計理由：曾考慮在 build 時沿著 `virtual:deck` 的 import 關係，只讓 Tailwind 掃描打包進 slidetray 的檔案，但 `diapo:deck` plugin 要先載入所有頁面，才能決定要在 player 的 stylesheet 加上哪些 `@source`；而且 dev server 如果照舊掃描整個簡報目錄，dev 與 build 的 CSS 會不一致。沒有列在 `deck.json` 的頁面用到的 class 通常只會讓 CSS 多出幾條規則，只有 `content-['…']` 這類 arbitrary value 裡的文字會被 Tailwind 寫進 CSS，而頁面的程式碼本來就公開在 repo 裡。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

## 部署方式

同一個 slidetray 可以部署在 GitHub Pages、用 `make serve` 在本機的 static server 播放，或直接用瀏覽器開啟 `file://` 的 `index.html`。

### 從 `file://` 開啟 Slidetray

從 `file://` 開啟的網頁 origin 是 `null`，所以 build 照下面的方式產生 slidetray：

- Vite 輸出 IIFE 格式的單一 JS 檔，再把 HTML 裡的 `<script type="module" crossorigin>` 改寫成 `<script defer>`，並移除 `<link>` 標籤的 `crossorigin` 屬性。
- Vite 在 IIFE 格式下預設會把 CSS 寫進 JS，由 JS 在執行時把 CSS 插入頁面，這時 CSS 裡 `url()` 的相對路徑會改以 HTML 的位置計算，所以 build 把 CSS 輸出成獨立的檔案。
- 所有資源都用相對路徑（Vite 的 `base` 是 `./`），所以 slidetray 搬到其他位置，或網站部署在子路徑下時，瀏覽器都能載入這些資源。
- HTML 設定空的 favicon，讓瀏覽器不會對 slidetray 以外的 `/favicon.ico` 送出 request。

> 設計理由：曾考慮用 `vite-plugin-singlefile` 把所有檔案內嵌進一個 HTML，但 `vite-plugin-singlefile` 會把影片轉成 base64 塞進 HTML。IIFE 格式的代價是不能使用 `import.meta` 與 top-level await，也不能做 code splitting。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

以下是在 Chromium、Firefox、WebKit 實測過的 `file://` 行為，之後寫 plan 時不必重新查證：

- 外部的 `<script type="module">`、`import()`、`fetch()`，以及帶 `crossorigin` 屬性的 script 與 stylesheet 都會被擋下。
- 字型用相對路徑可以載入。
- `localStorage` 在 Chromium 與 WebKit 由所有 `file://` 網頁共用，在 Firefox 則每個檔案路徑各自有一份。
- 兩個視窗之間用 `window.open` 加 `postMessage` 可以通訊，`BroadcastChannel` 在 WebKit 收不到訊息。
- 只改 hash 時，`location.hash =`、`location.replace()`、`history.pushState()` 與 `history.replaceState()` 都可以使用。
- 任一個視窗重新整理之後，用 `window.open` 開啟的兩個視窗仍然能用 `postMessage` 通訊。講者視窗重新整理之後，`window.opener` 仍然指向觀眾視窗；觀眾視窗重新整理之後，可以用講者視窗送來的訊息的 `event.source` 回覆。
- 觀眾視窗關閉之後，講者視窗的 `window.opener` 變成 `null`。任一個視窗關閉或重新整理時，在 `pagehide` 送出的訊息都來得及送到另一個視窗。
- 觀眾視窗用 `window.open('', name)` 可以取得同名的講者視窗，講者視窗不會重新載入；觀眾視窗重新整理之後也一樣。
- `file://` 的網址可以帶 query string，`location.search` 讀得到。
- 觀眾視窗在全螢幕時開啟新視窗，Chromium、Firefox、WebKit 都會讓觀眾視窗離開全螢幕；把既有的視窗移到最前面時，Chromium 與 Firefox 會讓觀眾視窗離開全螢幕，WebKit 不會。這是 Playwright 在 headless 模式下的結果（PRES-R1）。
- 觀眾視窗把畫面直接 render 進 `about:blank` 的彈出視窗時，任一邊重新整理之後，觀眾視窗就存取不到彈出視窗，或彈出視窗的內容消失，所以講者視窗要自己載入 `index.html`。

`make dev` 用 Vite 的 dev server 透過 HTTP 載入 ES module，載入方式和 build 出來的檔案不同，所以 E2E test 一律測 build 出來的檔案。Playwright 內建的 Firefox 預設把 `security.fileuri.strict_origin_policy` 設成 `false`，和正式版的 Firefox 相反，所以 `playwright.config.ts` 把這個設定改回 `true`。

### GitHub Actions 的 Workflow

GitHub Actions 的 workflow 放在 `.github/workflows/`：

| Workflow | 觸發時機 | 做什麼 |
| --- | --- | --- |
| `ci.yml` | PR 開啟或更新時 | `check` job 依序執行 `make install`、`make check`、`make build-site`、`make e2e`，PR 只改 `.md` 檔時跳過；`lint-md` job 在每個 PR 都依序執行 `pnpm install`、`make lint-md`；`check-scenarios` job 在每個 PR 都執行 `make check-scenarios` |
| `deploy.yml` | Merge 到 `main` 時 | 依序執行 `pnpm install`、`make build-site`，再透過 GitHub Actions 的 Pages 部署流程把 `dist/` 部署到 GitHub Pages |

> 設計理由：Markdown 由 `lint-md` 與 `check-scenarios` 兩個 job 在每個 PR 檢查，`check` job 其他的步驟都不檢查 Markdown，所以只改 `.md` 檔的 PR 跳過 `check` job。改到其他檔案的 PR 每次更新都跑 E2E test，因為 E2E test 在本機跑完不到 10 秒，CI 上比較花時間的是下載瀏覽器，而且 public repo 用 GitHub Actions 的標準 runner 不用付費。曾考慮用 PR 的 label 觸發 E2E test，並把 E2E test 設成 merge 的條件，但 merge 條件看的是 PR 最新的 commit，所以開 PR 的人每次 push 之後都要重新加一次 label；GitHub 的 merge queue 能在 merge 前才跑 E2E test，但只開放給 organization 擁有的 repo。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

`make e2e` 會自己 build `tests/fixtures/decks/`，所以 `ci.yml` 裡的 `make build-site` 只負責確認 `decks/` 的部署用 build 能成功。`deploy.yml` 與 `ci.yml` 的 `lint-md` job 用 `pnpm install` 安裝套件，不執行 `make install`，所以不會下載 Playwright 的瀏覽器；`check-scenarios` job 只安裝 Node，不安裝任何套件。

> 設計理由：`deploy.yml` 不再跑一次測試，因為同樣的測試已經在 PR 上跑過。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。
