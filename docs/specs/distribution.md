---
prefix: DIST
---

# Build 與部署

講者用這項能力把簡報 build 成可以帶到任何場地播放的 slidetray，並把發布的簡報部署成網站。Build 分成兩種：本機 build 由講者在自己的電腦上執行；部署用的 build 由 GitHub Actions 在部署到網站之前執行，講者也可以先在本機執行，確認部署的結果。

## 需求

### DIST-R1 每份簡報各有一個 Slidetray

Build 時，`decks/` 底下的每份簡報各自產生一個 slidetray，播放時瀏覽器只讀取這個 slidetray 裡的檔案。

- 情境：離線播放
  - 前提：簡報已經 build 好，電腦沒有網路連線
  - 動作：用 static server 開啟 slidetray 裡的 `index.html`
  - 結果：畫面顯示第一頁，樣式與圖片都已載入，瀏覽器沒有對 slidetray 以外的位置送出 request

### DIST-R2 直接開啟檔案就能播放

用瀏覽器直接開啟 slidetray 裡的 `index.html`（`file://` URL）時，畫面顯示簡報設定檔 `deck.json` 裡頁面順序的第一頁，樣式與圖片都已載入。

- 情境：在 Chromium 開啟
  - 前提：簡報已經 build 好
  - 動作：在 Chromium 開啟 `index.html`
  - 結果：畫面顯示第一頁，樣式與圖片都已載入
- 情境：在 Firefox 開啟
  - 前提：簡報已經 build 好，Firefox 使用預設的安全設定
  - 動作：在 Firefox 開啟 `index.html`
  - 結果：畫面顯示第一頁，樣式與圖片都已載入
- 情境：在 WebKit 開啟
  - 前提：簡報已經 build 好
  - 動作：在 WebKit 開啟 `index.html`
  - 結果：畫面顯示第一頁，樣式與圖片都已載入
- 情境：在 Safari 開啟
  - 前提：簡報已經 build 好
  - 動作：在 macOS 的 Safari 開啟 `index.html`
  - 結果：畫面顯示第一頁，樣式與圖片都已載入
- 情境：slidetray 搬到其他位置
  - 前提：簡報已經 build 好
  - 動作：把 slidetray 複製到其他位置，再開啟其中的 `index.html`
  - 結果：畫面顯示第一頁，樣式與圖片都已載入

### DIST-R3 網站首頁列出發布的簡報

網站首頁列出所有發布的簡報標題，點選標題會開啟那份簡報。

- 情境：列出簡報
  - 前提：`decks/` 底下有兩份發布的簡報
  - 動作：開啟網站首頁
  - 結果：首頁列出兩份簡報的標題
- 情境：從首頁開啟簡報
  - 前提：首頁列出一份標題為「範例」的簡報
  - 動作：點選「範例」
  - 結果：開啟這份簡報，畫面顯示第一頁

> 設計理由：網站首頁是講者在現場開啟簡報的入口，也是觀眾在演講後找到簡報的地方。這一版只列出標題，用來驗證網站有入口，以及子路徑下的連結正確；卡片、第一頁預覽與分頁留給 roadmap 的「網站首頁」，因為首頁的設計要沿用之後才會完成的主題。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### DIST-R4 網站部署在子路徑下也能播放

網站部署在網域的子路徑下（例如 GitHub Pages 把 repo 的網站放在 `https://<user>.github.io/<repo>/`）時，首頁與每份簡報都能正常開啟。

- 情境：在子路徑下開啟
  - 前提：網站的檔案放在 static server 的 `/diapo/` 路徑下
  - 動作：開啟 `/diapo/`，再點選一份簡報
  - 結果：首頁列出簡報標題，點選後畫面顯示那份簡報的第一頁
- 情境：部署到 GitHub Pages
  - 前提：網站已經部署到 GitHub Pages
  - 動作：開啟 GitHub Pages 上的網站首頁，再點選一份簡報
  - 結果：首頁列出簡報標題，點選後畫面顯示那份簡報的第一頁

### DIST-R5 不發布的簡報不出現在網站上

`deck.json` 把 `publish` 設成 `false` 的簡報（沒有設定時視為 `true`），不會出現在部署用的 build 產生的檔案與首頁裡，本機 build 則照常產生這份簡報的 slidetray。

- 情境：部署時排除
  - 前提：一份簡報的 `deck.json` 設定 `publish: false`
  - 動作：執行部署用的 build
  - 結果：網站的檔案裡沒有這份簡報的 slidetray，首頁也沒有列出這份簡報
- 情境：本機 build 時保留
  - 前提：一份簡報的 `deck.json` 設定 `publish: false`
  - 動作：執行本機 build
  - 結果：產生這份簡報的 slidetray，首頁也列出這份簡報
- 情境：沒有設定 publish
  - 前提：一份簡報的 `deck.json` 沒有 `publish` 欄位
  - 動作：執行部署用的 build
  - 結果：網站包含這份簡報的 slidetray，首頁也列出這份簡報

> 設計理由：GitHub Free 只能從 public repo 發布 Pages，而 private repo 發布出去的 Pages 仍然是公開網站，只有 Enterprise Cloud 能限制存取，所以目前所有簡報都公開部署。之後有不能公開的簡報時，把 repo 改成 private，再設定 `publish: false`。曾考慮部署到有存取控制的主機，例如 Cloudflare Pages 搭配 Cloudflare Access，目前沒有需要保密的簡報，所以不採用。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### DIST-R6 拒絕超過 25 MiB 的單一檔案

簡報目錄裡任何一個檔案超過 25 MiB（26,214,400 bytes）時 build 失敗，錯誤訊息寫出檔案路徑與大小。

- 情境：檔案超過上限
  - 前提：簡報目錄裡有一個 26 MiB 的影片檔
  - 動作：Build
  - 結果：Build 失敗，錯誤訊息寫出影片檔的路徑與大小
- 情境：檔案剛好在上限內
  - 前提：簡報目錄裡最大的檔案剛好是 25 MiB
  - 動作：Build
  - 結果：Build 成功

> 設計理由：單檔上限定在 25 MiB，是因為 Cloudflare Pages 的單檔上限也是 25 MiB，之後網站超過 GitHub Pages 的 1 GB 上限、要換主機時，所有素材都能直接搬過去。完整討論見 [0001](../plans/archive/0001-project-foundation.md)。

### DIST-R7 網站超過 800 MiB 時顯示警告

執行部署用的 build 時，如果網站的檔案總共超過 800 MiB，build 照常完成，但會顯示警告，寫出網站的總大小與 GitHub Pages 的 1 GB 上限。

- 情境：網站超過 800 MiB
  - 前提：所有發布簡報的 slidetray 加起來是 850 MiB
  - 動作：執行部署用的 build
  - 結果：Build 成功，並顯示警告
- 情境：網站在 800 MiB 以內
  - 前提：所有發布簡報的 slidetray 加起來是 100 MiB
  - 動作：執行部署用的 build
  - 結果：Build 成功，沒有警告
