---
prefix: FRAME
---

# 框架

講者用框架撰寫簡報。每份簡報是 `decks/` 底下的一個目錄，目錄名稱就是這份簡報的 deck ID，目錄裡放這些東西：

- `deck.json`：簡報的設定檔，欄位寫在 FRAME-R2。
- `slides/`：每一頁寫成一個 TSX 檔，檔名是 `<slide-id>.tsx`，檔名去掉 `.tsx` 就是這一頁的 slide ID。TSX 檔用 default export 匯出一個沒有 props 的 React 元件，元件撐滿 1920×1080 的畫布。TSX 檔也可以用 `notes` 匯出這一頁的講者備註（FRAME-R6）。
- `assets/`：放圖片、影片等素材，TSX 檔用 `import` 取得素材的網址。

> 設計理由：每頁用 default export 匯出沒有 props 的 React 元件，因為這是 AI 最熟悉的 React 寫法。換頁效果這類每頁的設定，由各自的 plan 決定寫法。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

簡報目錄不符合本 spec 的規則時 build 失敗，錯誤訊息寫出 deck ID 與原因。

## 需求

### FRAME-R1 頁面順序寫在 `deck.json`

`deck.json` 的 `slides` 依播放順序列出 slide ID，至少要有一頁，每個 slide ID 都要有對應的 `slides/<slide-id>.tsx`。

- FRAME-R1.1 頁面的 TSX 檔不存在
  - 前提：`deck.json` 的 `slides` 列出 `agenda`，但 `slides/` 目錄底下沒有 `agenda.tsx`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`
- FRAME-R1.2 沒有任何頁面
  - 前提：`deck.json` 的 `slides` 是 `[]`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `slides`

> 設計理由：頁面順序寫在 `deck.json`，而不是用檔名的編號前綴決定，因為 roadmap 的「排序與隱藏」會在本機把拖曳排序的結果寫回簡報，用編號前綴的話，dev server 每次排序都要一次改好幾個檔名。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### FRAME-R2 `deck.json` 只接受定義過的欄位

`deck.json` 的內容是一個 JSON object，欄位如下。JSON 不合法、缺少必填欄位、欄位的值不符合下表，或出現下表以外的欄位時，build 失敗。

| 欄位 | 必填 | 內容 |
| --- | --- | --- |
| `title` | 是 | 簡報標題，不能是空字串，也不能只有空白 |
| `publish` | 否 | `true` 或 `false`。設成 `false` 時，部署用的 build 會排除這份簡報（DIST-R5）；沒有設定時視為 `true` |
| `slides` | 是 | Slide ID 的陣列，規則寫在 FRAME-R1 與 FRAME-R4 |

- FRAME-R2.1 欄位名稱拼錯
  - 前提：`deck.json` 把 `publish: false` 寫成 `pubish: false`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `pubish`
- FRAME-R2.2 JSON 格式錯誤
  - 前提：`deck.json` 最後一個元素後面多了逗號
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `deck.json` 不是合法的 JSON
- FRAME-R2.3 缺少必填欄位
  - 前提：`deck.json` 沒有 `title`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `title`
- FRAME-R2.4 `publish` 寫成字串
  - 前提：`deck.json` 把 `publish` 寫成 `"false"`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `publish`
- FRAME-R2.5 標題是空字串
  - 前提：`deck.json` 的 `title` 是 `""`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `title`
- FRAME-R2.6 標題只有空白
  - 前提：`deck.json` 的 `title` 是 `"   "`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `title`

> 設計理由：曾考慮忽略無法辨識的欄位，但 `publish` 拼錯時，不能公開的簡報會部署到網站上；只顯示警告、照常完成 build 也一樣，因為警告只出現在 GitHub Actions 的 log 裡，CI 仍然會通過。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### FRAME-R3 Deck ID 與 Slide ID 只能用小寫 Kebab-case

Deck ID 與 slide ID 只能用小寫英數字與 `-`，而且 `-` 不能出現在開頭、結尾，也不能連續出現。

- FRAME-R3.1 Deck ID 格式不符
  - 前提：`decks/` 底下有一個叫 `_assets` 的簡報目錄
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `_assets`
- FRAME-R3.2 Slide ID 格式不符
  - 前提：`deck.json` 的 `slides` 列出 `Intro`，`slides/` 目錄底下也有 `Intro.tsx`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `Intro`

> 設計理由：Deck ID 與 slide ID 會出現在網址與檔名裡，而 macOS 的檔案系統不分大小寫、GitHub Actions 的 Linux 有分，如果允許大寫，本機 build 成功的簡報可能在 GitHub Actions 上失敗，所以 ID 只能用小寫。不允許 `_`，是為了讓 deck ID 不會和網站首頁放 JS 與 CSS 的 `_assets/` 目錄同名。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### FRAME-R4 同一個 Slide ID 在 `slides` 裡只能出現一次

同一個 slide ID 在 `deck.json` 的 `slides` 裡只能出現一次。同一頁要在簡報裡出現兩次時，另外建一個 TSX 檔重新匯出那一頁，例如 `agenda` 要出現兩次時，新增 `slides/agenda-recap.tsx`，內容寫成 `export { default } from "./agenda";`，再把 `agenda-recap` 列進 `slides`。這兩頁顯示同一個元件，所以修改 `agenda.tsx` 時，兩次出現的地方會一起改變。

- FRAME-R4.1 Slide ID 重複
  - 前提：`deck.json` 的 `slides` 是 `["intro", "agenda", "intro"]`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `intro`，並寫出讓同一頁出現兩次的做法：另外建一個 TSX 檔，內容寫成 `export { default } from "./intro";`

> 設計理由：播放器把 slide ID 寫進網址的 hash（[navigation.md](navigation.md) 的 NAV-R1），讓指向某一頁的連結在頁面順序調整後仍然指向同一頁，所以一個 slide ID 只能對應一頁。允許重複的話，hash 要另外記錄這是第幾次出現，例如 `#/agenda~2`，而在第二個 `agenda` 之前再插入一次 `agenda` 之後，舊連結的 `~2` 就會指到另一次出現的位置。錯誤訊息寫出重新匯出的做法，因為 AI 製作簡報時通常不會先讀 spec，而是從 build 的錯誤訊息知道怎麼修正。「排序與隱藏」的 plan 決定現場隱藏的頁面怎麼存進瀏覽器時，再評估一次要不要允許重複；現在先禁止重複，之後要放寬時，既有的簡報不受影響。完整討論見 [0001](../plans/archive/0001-project-foundation.md) 與 [0002](../plans/archive/0002-navigation.md)。

### FRAME-R5 沒有用到的頁面不會打包進 Slidetray

`slides/` 目錄裡沒有列在 `deck.json` 的 `slides`、也沒有被列出的頁面直接或間接 import 的 TSX 檔，不會打包進 slidetray。

- FRAME-R5.1 沒有列在 `slides` 的頁面
  - 前提：`slides/` 目錄底下有 `draft.tsx`，但 `deck.json` 的 `slides` 沒有列出 `draft`
  - 動作：Build
  - 結果：Build 成功，slidetray 裡沒有 `draft.tsx` 的內容
- FRAME-R5.2 沒有列在 `slides` 但被其他頁面 import 的頁面
  - 前提：`deck.json` 的 `slides` 列出 `recap`、沒有列出 `summary`，而 `slides/recap.tsx` 的內容是 `export { default } from "./summary";`
  - 動作：Build
  - 結果：Build 成功，slidetray 裡有 `summary.tsx` 的內容
- FRAME-R5.3 隔兩層 import 的頁面
  - 前提：`deck.json` 的 `slides` 只列出 `recap`；`recap.tsx` 的內容是 `export { default } from "./summary";`，`summary.tsx` 的內容是 `export { default } from "./summary-v1";`
  - 動作：Build
  - 結果：Build 成功，slidetray 裡有 `summary-v1.tsx` 的內容

### FRAME-R6 用 `notes` 匯出講者備註

頁面的 TSX 檔可以用 `export const notes` 匯出這一頁的講者備註，內容是 CommonMark 格式的 Markdown，講者在講者視窗的備註區看到的就是這段內容（[presenter.md](presenter.md) 的 PRES-R10）。

```tsx
export const notes = `
- 先問觀眾有沒有用過 Keynote
- 強調 \`useStep\` 的參數要列出每一步
`;

export default function Agenda() {
  // ...
}
```

備註通常寫成 template literal，這時 Markdown 的反引號要寫成 `` \` ``，`${` 要寫成 `\${`，反斜線要寫成 `\\`，例如 Markdown 的 `\*` 要寫成 `\\*`。只有一行的備註也可以寫成引號字串，例如 `export const notes = "先問觀眾";`，這時反斜線一樣要寫成 `\\`，和外層相同的引號要寫成 `\"` 或 `\'`，另一種引號直接寫；引號字串不能換行，所以要換行的備註都寫成 template literal。`notes` 的其他規則寫在 FRAME-R7。照 FRAME-R4 讓同一頁出現兩次時，`export { default } from "./agenda";` 不會帶上 `agenda` 的備註；要沿用 `agenda` 的備註時，寫成 `export { default, notes } from "./agenda";`。

備註會打包進 slidetray，所以發布到網站的簡報，任何人開啟後按 `S` 都看得到備註。

> 設計理由：部署到網站時不拿掉備註，因為部署網站的 repo 是公開的（DIST-R5 的設計理由），備註寫在 repo 的 TSX 檔裡，拿掉 slidetray 裡的備註也擋不住別人在 GitHub 上讀到，而且講者從網站播放簡報時就沒有備註可看。備註有不能公開的內容時，照 DIST-R5 的設計理由把 repo 改成 private，並設定 `publish: false`。完整討論見 [0004](../plans/archive/0004-presenter-mode.md)。

- FRAME-R6.1 備註裡的反引號
  - 前提：`agenda` 的 `notes` 寫了 `` 強調 \`useStep\` ``
  - 動作：Build，在觀眾視窗顯示 `agenda` 時按 `S`
  - 結果：Build 成功，講者視窗的備註區把 `useStep` 顯示成行內程式碼
- FRAME-R6.2 重新匯出時不帶備註
  - 前提：`agenda` 有備註，`agenda-recap.tsx` 的內容是 `export { default } from "./agenda";`
  - 動作：在觀眾視窗顯示 `agenda-recap` 時按 `S`
  - 結果：講者視窗的備註區寫著「這一頁沒有備註」
- FRAME-R6.3 重新匯出時一起匯出備註
  - 前提：`agenda` 有備註，`agenda-recap.tsx` 的內容是 `export { default, notes } from "./agenda";`
  - 動作：在觀眾視窗顯示 `agenda-recap` 時按 `S`
  - 結果：講者視窗的備註區顯示 `agenda` 的備註

> 設計理由：備註寫成具名匯出的字串，要換行的備註寫成 template literal，因為 JSX 會把文字裡的換行與縮排併成一個空白，而 Markdown 的清單與段落都靠換行。曾考慮用 `<Notes>` 元件把備註寫在頁面的 JSX 裡，但 template literal 會跟著 JSX 縮排，而 Markdown 把縮排 4 格以上的行當成程式碼區塊，AI 容易寫錯，播放器也要先 render 那一頁才讀得到備註；也考慮過寫成元件的屬性，例如 `Agenda.notes = ...`，但這不是常見的 React 寫法。具名匯出的代價是 `@vitejs/plugin-react` 只在檔案匯出的全都是元件時才熱更新，所以用 `make dev` 修改有 `notes` 的頁面時，整頁會重新載入。完整討論見 [0004](../plans/archive/0004-presenter-mode.md)。

### FRAME-R7 `notes` 的寫法不符規則時 build 失敗

`deck.json` 列出的頁面，以及這些頁面直接或間接 import 的 `slides/` 目錄裡的 TSX 檔，也就是 `slides/` 目錄裡會打包進 slidetray 的 TSX 檔（FRAME-R5），匯出 `notes` 時只能用下列寫法：

1. 用 `export const notes` 宣告，值是用引號寫成的字串，或沒有 `${...}` 的 template literal。其他運算式，例如字串相加或其他檔案的常數，都不符合規則。字串裡的跳脫寫法只能是 `\\`、template literal 裡的 `` \` `` 與 `\$`，以及引號字串裡跳脫外層引號的寫法，也就是雙引號字串裡的 `\"` 與單引號字串裡的 `\'`。`notes` 後面可以加上 TypeScript 的型別註記 `: string`，值的後面也可以加上 `as const` 或 `satisfies string`，這些寫法不影響檢查；用 `export let` 或 `export var` 宣告則不符合規則。
2. 從 `slides/` 目錄裡的其他 TSX 檔重新匯出：在 `export { ... } from "./<檔名>"` 的清單裡直接列出 `notes`，例如 `export { notes } from "./agenda"` 或 `export { default, notes } from "./agenda"`，不能把其他名稱改名成 `notes`。被匯出的檔案也可以再用這種寫法，從另一個檔案重新匯出。

不符合這些規則時 build 失敗，錯誤訊息寫出不符合規則的那個 TSX 檔，另有以下規則：

- 被重新匯出的檔案沒有匯出 `notes` 時，錯誤訊息寫出寫了 `export { notes } from` 的那個檔案。
- 用 `export * from` 帶上其他檔案的 `notes` 時，錯誤訊息寫出寫了 `export *` 的那個檔案，並說明要改寫成 `export { notes } from`。
- Template literal 裡有 `${...}` 時，錯誤訊息另外說明要把 `${` 寫成 `\${`。
- 引號字串裡出現 `\n`、`\r`、`\t`，或有一行以 `\` 結尾時，錯誤訊息另外說明要改寫成 template literal，直接在字串裡換行或寫空白。
- Template literal 裡出現 `\n`、`\r` 或 `\t` 時，錯誤訊息另外說明直接換行或寫空白。
- 跳脫了不需要跳脫的字元時，也就是引號字串裡的 `` \` ``、`\$` 與和外層不同的引號，例如雙引號字串裡的 `\'`，以及 template literal 裡的 `\"` 與 `\'`，錯誤訊息另外說明這個字元直接寫，不用跳脫。
- 出現其他跳脫寫法時，例如 `\*`、template literal 裡行尾的 `\` 或 `\u`，錯誤訊息另外說明要把 `\` 寫成 `\\`。

- FRAME-R7.1 Template literal 裡有 `${`
  - 前提：`agenda` 的 `notes` 寫了 `範例：${name}`，`${` 沒有跳脫
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明要把 `${` 寫成 `\${`
- FRAME-R7.2 `notes` 不是字串
  - 前提：`agenda` 寫了 `export const notes = 42;`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`
- FRAME-R7.3 `notes` 是其他檔案的常數
  - 前提：`agenda` 寫了 `import { script } from "../shared";` 與 `export const notes = script;`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`
- FRAME-R7.4 `${` 已經跳脫
  - 前提：`agenda` 的 `notes` 寫了 `\${name}`
  - 動作：Build，在觀眾視窗顯示 `agenda` 時按 `S`
  - 結果：Build 成功，講者視窗的備註區顯示 `${name}`
- FRAME-R7.5 `notes` 是字串相加
  - 前提：`agenda` 寫了 `export const notes = "第一段" + "第二段";`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`
- FRAME-R7.6 重新匯出沒有列在 `slides` 的頁面
  - 前提：`deck.json` 的 `slides` 列出 `recap`、沒有列出 `summary`；`recap.tsx` 寫了 `export { default, notes } from "./summary";`，`summary` 的 `notes` 寫了 `範例：${name}`，`${` 沒有跳脫
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `summary`，並說明要把 `${` 寫成 `\${`
- FRAME-R7.7 被重新匯出的頁面沒有備註
  - 前提：`intro` 沒有匯出 `notes`，`agenda-recap.tsx` 寫了 `export { default, notes } from "./intro";`，`deck.json` 的 `slides` 列出 `agenda-recap`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda-recap`
- FRAME-R7.8 用 `export *` 帶上備註
  - 前提：`agenda` 有備註，`agenda-recap.tsx` 寫了 `export * from "./agenda";` 與 `export { default } from "./agenda";`，`deck.json` 的 `slides` 列出 `agenda-recap`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda-recap`，並說明要改寫成 `export { notes } from`
- FRAME-R7.9 多層重新匯出
  - 前提：`agenda` 有備註，`agenda-recap.tsx` 寫了 `export { default, notes } from "./agenda";`，`agenda-again.tsx` 寫了 `export { default, notes } from "./agenda-recap";`，`deck.json` 的 `slides` 只列出 `agenda-again`
  - 動作：Build，在觀眾視窗顯示 `agenda-again` 時按 `S`
  - 結果：Build 成功，講者視窗的備註區顯示 `agenda` 的備註
- FRAME-R7.10 先宣告再匯出 `notes`
  - 前提：`agenda` 寫了 `const notes = "先問觀眾";` 與 `export { notes };`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`
- FRAME-R7.11 改名成 `notes` 重新匯出
  - 前提：`agenda-recap.tsx` 寫了 `export { default, agendaNotes as notes } from "./agenda";`，`deck.json` 的 `slides` 列出 `agenda-recap`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda-recap`
- FRAME-R7.12 從 `slides/` 以外的檔案重新匯出
  - 前提：`agenda` 寫了 `export { notes } from "../shared/notes";`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`
- FRAME-R7.13 只重新匯出 `default` 的頁面
  - 前提：`deck.json` 的 `slides` 列出 `recap`、沒有列出 `summary`；`recap.tsx` 寫了 `export { default } from "./summary";`，`summary` 的 `notes` 寫了 `範例：${name}`，`${` 沒有跳脫
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `summary`，並說明要把 `${` 寫成 `\${`
- FRAME-R7.14 沒有用到的頁面
  - 前提：`slides/` 目錄底下有 `draft.tsx`，`deck.json` 的 `slides` 沒有列出 `draft`，也沒有其他頁面 import `draft`；`draft` 的 `notes` 寫了 `範例：${name}`，`${` 沒有跳脫
  - 動作：Build
  - 結果：Build 成功
- FRAME-R7.15 隔兩層 import 的頁面
  - 前提：`deck.json` 的 `slides` 只列出 `recap`；`recap.tsx` 寫了 `export { default } from "./summary";`，`summary.tsx` 寫了 `export { default } from "./summary-v1";`，`summary-v1` 的 `notes` 寫了 `範例：${name}`，`${` 沒有跳脫
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `summary-v1`，並說明要把 `${` 寫成 `\${`
- FRAME-R7.16 Markdown 的跳脫只寫了一個反斜線
  - 前提：`agenda` 的 `notes` 寫了 `示範 \_\_init\_\_ 方法`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明要把 `\` 寫成 `\\`
- FRAME-R7.17 Template literal 裡行尾的反斜線
  - 前提：`agenda` 的 `notes` 是 template literal，其中一行以 `\` 結尾
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明要把 `\` 寫成 `\\`
- FRAME-R7.18 路徑裡的反斜線
  - 前提：`agenda` 的 `notes` 寫了 `範例在 C:\users\demo`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明要把 `\` 寫成 `\\`
- FRAME-R7.19 反斜線寫成兩個
  - 前提：`agenda` 的 `notes` 寫了 `示範 \\_\\_init\\_\\_ 方法`
  - 動作：Build，在觀眾視窗顯示 `agenda` 時按 `S`
  - 結果：Build 成功，講者視窗的備註區顯示 `示範 __init__ 方法`，底線照原文顯示，沒有變成粗體
- FRAME-R7.20 引號字串裡跳脫引號
  - 前提：`agenda` 寫了 `export const notes = "示範 \"引號\"";`
  - 動作：Build，在觀眾視窗顯示 `agenda` 時按 `S`
  - 結果：Build 成功，講者視窗的備註區顯示 `示範 "引號"`
- FRAME-R7.21 加了型別註記
  - 前提：`agenda` 寫了 `` export const notes: string = `- 先問觀眾`; ``
  - 動作：Build
  - 結果：Build 成功
- FRAME-R7.22 用 `export let` 宣告
  - 前提：`agenda` 寫了 `` export let notes = `- 先問觀眾`; ``
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`
- FRAME-R7.23 引號字串裡寫了 `\n`
  - 前提：`agenda` 寫了 `export const notes = "第一點\n第二點";`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明要改寫成 template literal，直接在字串裡換行
- FRAME-R7.24 雙引號字串裡直接寫單引號
  - 前提：`agenda` 寫了 `export const notes = "講者's 重點";`
  - 動作：Build，在觀眾視窗顯示 `agenda` 時按 `S`
  - 結果：Build 成功，講者視窗的備註區顯示 `講者's 重點`
- FRAME-R7.25 雙引號字串裡跳脫單引號
  - 前提：`agenda` 寫了 `export const notes = "講者\'s 重點";`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明單引號直接寫，不用跳脫
- FRAME-R7.26 加了 `as const`
  - 前提：`agenda` 寫了 `` export const notes = `- 先問觀眾` as const; ``
  - 動作：Build
  - 結果：Build 成功
- FRAME-R7.27 加了 `satisfies string`
  - 前提：`agenda` 寫了 `` export const notes = `- 先問觀眾` satisfies string; ``
  - 動作：Build
  - 結果：Build 成功
- FRAME-R7.28 用 `export var` 宣告
  - 前提：`agenda` 寫了 `` export var notes = `- 先問觀眾`; ``
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`
- FRAME-R7.29 用 `String.raw` 寫備註
  - 前提：`agenda` 寫了 `` export const notes = String.raw`- 先問觀眾`; ``
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`
- FRAME-R7.30 引號字串裡行尾的反斜線
  - 前提：`agenda` 的 `notes` 是雙引號字串，第一行以 `\` 結尾，下一行接著寫字串的其餘部分
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明要改寫成 template literal，直接在字串裡換行
- FRAME-R7.31 Template literal 裡寫了 `\n`
  - 前提：`agenda` 寫了 `` export const notes = `第一點\n第二點`; ``
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明直接換行
- FRAME-R7.32 引號字串裡跳脫反引號
  - 前提：`agenda` 寫了 ``export const notes = "強調 \`useStep\` 的參數";``
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明反引號直接寫，不用跳脫
- FRAME-R7.33 Template literal 裡跳脫雙引號
  - 前提：`agenda` 寫了 `` export const notes = `示範 \"引號\"`; ``
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明雙引號直接寫，不用跳脫
- FRAME-R7.34 引號字串裡跳脫 `$`
  - 前提：`agenda` 寫了 `export const notes = "價格是 \$100";`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明 `$` 直接寫，不用跳脫
- FRAME-R7.35 Template literal 裡跳脫單引號
  - 前提：`agenda` 寫了 `` export const notes = `It\'s 重點`; ``
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`，並說明單引號直接寫，不用跳脫

> 設計理由：Build 時檢查 `notes`，不只靠型別檢查，因為 `make build` 本身不做型別檢查，而且有些漏掉的跳脫連型別檢查都擋不下來。備註漏掉 `${` 的跳脫時，`${user}` 這種沒有宣告的名稱只有 `make check` 的型別檢查擋得下來，講者只跑 `make build` 的話，build 會成功，播放時整份簡報的 JS 一載入就出錯，畫面一片空白，因為所有頁面都打包在同一個 JS 檔裡。`${name}`、`${status}` 這種剛好是瀏覽器全域變數的名稱，連型別檢查都會通過，播放時備註裡的這段文字直接消失。反斜線也一樣，Markdown 的 `\_` 經過 JS 字串的跳脫之後只剩 `_`，`\u` 則讓 build 因為 JS 的語法錯誤而失敗，錯誤訊息也沒有寫出要改成什麼。曾考慮改用 `` String.raw`...` `` 寫備註，讓反斜線照原樣保留，但這樣 `` \` `` 也會連反斜線一起保留，Markdown 把它當成跳脫的反引號，行內程式碼就寫不出來。完整討論見 [0004](../plans/archive/0004-presenter-mode.md)。
