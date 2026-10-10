---
prefix: FRAME
---

# 框架

講者用框架撰寫簡報。每份簡報是 `decks/` 底下的一個目錄，目錄名稱就是這份簡報的 deck ID，目錄裡放這些東西：

- `deck.json`：簡報的設定檔，欄位寫在 FRAME-R2。
- `slides/`：每一頁寫成一個 TSX 檔，檔名是 `<slide-id>.tsx`，檔名去掉 `.tsx` 就是這一頁的 slide ID。TSX 檔用 default export 匯出一個沒有 props 的 React 元件，元件撐滿 1920×1080 的畫布。
- `assets/`：放圖片、影片等素材，TSX 檔用 `import` 取得素材的網址。

> 設計理由：每頁用 default export 匯出沒有 props 的 React 元件，因為這是 AI 最熟悉的 React 寫法。講者備註、換頁效果這類每頁的設定，由各自的 plan 決定寫法。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

簡報目錄不符合本 spec 的規則時 build 失敗，錯誤訊息寫出 deck ID 與原因。

## 需求

### FRAME-R1 頁面順序寫在 `deck.json`

`deck.json` 的 `slides` 依播放順序列出 slide ID，至少要有一頁，每個 slide ID 都要有對應的 `slides/<slide-id>.tsx`。

- 情境：頁面的 TSX 檔不存在
  - 前提：`deck.json` 的 `slides` 列出 `agenda`，但 `slides/` 目錄底下沒有 `agenda.tsx`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `agenda`
- 情境：沒有任何頁面
  - 前提：`deck.json` 的 `slides` 是 `[]`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `slides`

> 設計理由：頁面順序寫在 `deck.json`，而不是用檔名的編號前綴決定，因為 roadmap 的「預覽總覽與排序」會在本機把拖曳排序的結果寫回簡報，用編號前綴的話，dev server 每次排序都要一次改好幾個檔名。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### FRAME-R2 `deck.json` 只接受定義過的欄位

`deck.json` 的內容是一個 JSON object，欄位如下。JSON 不合法、缺少必填欄位、欄位的值不符合下表，或出現下表以外的欄位時，build 失敗。

| 欄位 | 必填 | 內容 |
| --- | --- | --- |
| `title` | 是 | 簡報標題，不能是空字串，也不能只有空白 |
| `publish` | 否 | `true` 或 `false`。設成 `false` 時，部署用的 build 會排除這份簡報（DIST-R5）；沒有設定時視為 `true` |
| `slides` | 是 | Slide ID 的陣列，規則寫在 FRAME-R1 與 FRAME-R4 |

- 情境：欄位名稱拼錯
  - 前提：`deck.json` 把 `publish: false` 寫成 `pubish: false`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `pubish`
- 情境：JSON 格式錯誤
  - 前提：`deck.json` 最後一個元素後面多了逗號
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `deck.json` 不是合法的 JSON
- 情境：缺少必填欄位
  - 前提：`deck.json` 沒有 `title`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `title`
- 情境：`publish` 寫成字串
  - 前提：`deck.json` 把 `publish` 寫成 `"false"`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `publish`
- 情境：標題是空字串
  - 前提：`deck.json` 的 `title` 是 `""`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `title`
- 情境：標題只有空白
  - 前提：`deck.json` 的 `title` 是 `"   "`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `title`

> 設計理由：曾考慮忽略無法辨識的欄位，但 `publish` 拼錯時，不能公開的簡報會部署到網站上；只顯示警告、照常完成 build 也一樣，因為警告只出現在 GitHub Actions 的 log 裡，CI 仍然會通過。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### FRAME-R3 Deck ID 與 Slide ID 只能用小寫 Kebab-case

Deck ID 與 slide ID 只能用小寫英數字與 `-`，而且 `-` 不能出現在開頭、結尾，也不能連續出現。

- 情境：Deck ID 格式不符
  - 前提：`decks/` 底下有一個叫 `_assets` 的簡報目錄
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `_assets`
- 情境：Slide ID 格式不符
  - 前提：`deck.json` 的 `slides` 列出 `Intro`，`slides/` 目錄底下也有 `Intro.tsx`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `Intro`

> 設計理由：Deck ID 與 slide ID 會出現在網址與檔名裡，而 macOS 的檔案系統不分大小寫、GitHub Actions 的 Linux 有分，如果允許大寫，本機 build 成功的簡報可能在 GitHub Actions 上失敗，所以 ID 只能用小寫。不允許 `_`，是為了讓 deck ID 不會和網站首頁放 JS 與 CSS 的 `_assets/` 目錄同名。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### FRAME-R4 同一個 Slide ID 在 `slides` 裡只能出現一次

同一個 slide ID 在 `deck.json` 的 `slides` 裡只能出現一次。同一頁要在簡報裡出現兩次時，另外建一個 TSX 檔重新匯出那一頁，例如 `agenda` 要出現兩次時，新增 `slides/agenda-recap.tsx`，內容寫成 `export { default } from "./agenda";`，再把 `agenda-recap` 列進 `slides`。

- 情境：Slide ID 重複
  - 前提：`deck.json` 的 `slides` 是 `["intro", "agenda", "intro"]`
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出 `intro`

> 設計理由：Roadmap 的「換頁與操作」會把 slide ID 寫進網址的 hash，讓指向某一頁的連結在頁面順序調整後仍然指向同一頁，所以一個 slide ID 只能對應一頁。曾考慮允許重複，不過現在先禁止重複，之後要放寬時既有的簡報不受影響；反過來先允許重複，之後才禁止時，已經有重複 slide ID 的簡報就會 build 失敗。等「換頁與操作」的 plan 決定網址怎麼記錄目前的頁面、「預覽總覽與排序」的 plan 決定現場隱藏的頁面怎麼存進瀏覽器時，再評估要不要允許重複。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### FRAME-R5 沒有用到的頁面不會打包進 Slidetray

`slides/` 目錄裡沒有列在 `deck.json` 的 `slides`、也沒有被列出的頁面 import 的 TSX 檔，不會打包進 slidetray。

- 情境：沒有列在 `slides` 的頁面
  - 前提：`slides/` 目錄底下有 `draft.tsx`，但 `deck.json` 的 `slides` 沒有列出 `draft`
  - 動作：Build
  - 結果：Build 成功，slidetray 裡沒有 `draft.tsx` 的內容
- 情境：沒有列在 `slides` 但被其他頁面 import 的頁面
  - 前提：`deck.json` 的 `slides` 列出 `recap`、沒有列出 `summary`，而 `slides/recap.tsx` 的內容是 `export { default } from "./summary";`
  - 動作：Build
  - 結果：Build 成功，slidetray 裡有 `summary.tsx` 的內容
