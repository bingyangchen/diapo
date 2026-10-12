# 頁內分步的手動檢查

這份檔案列出 [steps.md](../../docs/specs/steps.md) 裡需要手動檢查的情境。改到和這些情境有關的程式碼時，照下面的步驟檢查，並把結果寫在 PR 的「手動檢查」。

下面的步驟都用 `decks/example`。檢查之前先執行 `make build`。

## STEP-R9.4 往回時停在上一頁的最後一步

需要手動檢查的原因：E2E test 用 `MutationObserver` 確認 DOM 從來沒有出現上一頁第 0 步的內容，但畫面上有沒有閃過上一頁的第 0 步，只能人工確認。

1. 用 Chrome 開啟 `dist/example/index.html#/step-hook`。
2. 確認畫面顯示「用 useStep 替換內容」。
3. 按 ←。
4. 在 Firefox 與 Safari 重複步驟 1 到 3。

預期：畫面直接顯示「頁內分步」這一頁的第 3 步，左邊的三個項目與右邊的方塊都已經出現，中間沒有閃過三個項目都還沒出現的第 0 步；網址的 hash 變成 `#/steps/3`。
