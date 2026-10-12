# Build 與部署的手動檢查

這份檔案列出 [distribution.md](../../docs/specs/distribution.md) 裡需要手動檢查的情境。改到和這些情境有關的程式碼時，照下面的步驟檢查，並把結果寫在 PR 的「手動檢查」。

## DIST-R2.4 在 Safari 開啟

需要手動檢查的原因：E2E test 用的是 Playwright 自己 build 的 WebKit，DIST-R2.3 在這個 WebKit 通過，不代表 macOS 的 Safari 也能開啟 `file://` 的 `index.html`。不過專案擁有者先在 Safari 設定的「開發者」分頁開啟「允許遠端自動化」之後，agent 也能透過 `safaridriver` 控制 Safari，自己執行這項檢查。

1. 執行 `make build`。
2. 執行 `open -a Safari dist/example/index.html`。

預期：畫面顯示第一頁，樣式與圖片都已載入。範例簡報的第一頁有「diapo」標題與一張幻燈片盒的圖片。

## DIST-R4.2 部署到 GitHub Pages

需要手動檢查的原因：`deploy.yml` 要在 PR merge 到 `main` 之後，才會把網站部署到 GitHub Pages。

1. PR merge 到 `main` 之後，確認 `deploy.yml` 的 workflow run 已經執行完成。
2. 開啟 <https://bingyangchen.github.io/diapo/>。
3. 點選「diapo 範例簡報」。

預期：首頁列出「diapo 範例簡報」，步驟 3 之後畫面顯示這份簡報有「diapo」標題的第一頁。
