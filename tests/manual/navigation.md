# 換頁與操作的手動檢查

這份檔案列出 [navigation.md](../../docs/specs/navigation.md) 裡需要手動檢查的情境。改到和這些情境有關的程式碼時，照下面的步驟檢查，並把結果寫在 PR 的「手動檢查」。

下面的步驟都用 `decks/example`。檢查之前先執行 `make build`。要在 iPad 或 iPhone 上檢查時，再執行 `pnpm exec vite preview --outDir dist --host`，並讓 iPad 或 iPhone 與電腦連上同一個網路；步驟裡的 `<Network 網址>` 指這個指令在終端機印出的 Network 網址。

## NAV-R6.5 全螢幕時回到跳頁之前的頁面

需要手動檢查的原因：E2E test 只能在 headless 的瀏覽器執行。在 headless 的 Chromium、Firefox、WebKit 裡，E2E test 用瀏覽器的上一頁回到另一個 hash 時，播放器都維持全螢幕，但一般的瀏覽器不一定也會維持全螢幕。

1. 用 Chrome 開啟 `dist/example/index.html`。
2. 按 →。
3. 確認畫面顯示「操作方式」。
4. 按 `F` 進入全螢幕。
5. 按 End。
6. 確認畫面顯示「謝謝觀看」。
7. 按瀏覽器回到上一頁的快捷鍵，macOS 是 Cmd+←，Windows 是 Alt+←。
8. 在 Firefox 與 Safari 重複步驟 1 到 7。

預期：步驟 7 之後畫面顯示「操作方式」，播放器仍然在全螢幕。

## NAV-R8.7 拖曳 range input

需要手動檢查的原因：E2E test 只能送出模擬的 touch 與 pointer 事件，這些事件不會經過瀏覽器處理手勢的流程，所以要在觸控裝置上用手指操作，確認播放器遇到真實的手勢時怎麼反應。

1. 在 iPad 的 Safari 開啟 `<Network 網址>/example/index.html#/touch`。
2. 確認畫面顯示「觸控」。
3. 用手指從頁面上的 range input（標示「滑桿」的那一條）開始往左拖曳約 200 px。

預期：Range input 的值改變，畫面仍然顯示「觸控」。

## NAV-R8.11 在 iPad 上滑動

需要手動檢查的原因：E2E test 只能送出模擬的 touch 與 pointer 事件，這些事件不會經過瀏覽器處理手勢的流程，所以要在觸控裝置上用手指操作，確認播放器遇到真實的手勢時怎麼反應。

1. 在 iPad 的 Safari 開啟 `<Network 網址>/example/index.html`。
2. 確認畫面顯示有「diapo」標題的第一頁。
3. 用手指在畫面中央往左滑。

預期：畫面顯示「操作方式」。

## NAV-R10.4 用 Esc 離開全螢幕

需要手動檢查的原因：E2E test 在全螢幕時按 Esc，headless 的 Chromium 不會離開全螢幕。

1. 用 Chrome 開啟 `dist/example/index.html`。
2. 按 `F` 進入全螢幕。
3. 按 Esc。

預期：播放器離開全螢幕。

## NAV-R10.5 用翻頁器播放

需要手動檢查的原因：E2E test 只能送出模擬的 keydown 事件，所以要接上翻頁器，才能確認按下翻頁器的每個鍵時都觸發對應的快捷鍵。

1. 把翻頁器接上電腦。
2. 用 Chrome 開啟 `dist/example/index.html`。
3. 確認畫面顯示有「diapo」標題的第一頁，播放器不在全螢幕。
4. 按翻頁器的播放鍵。
5. 按翻頁器的下一頁鍵。
6. 按翻頁器的黑畫面鍵。
7. 再按一次翻頁器的黑畫面鍵。
8. 再按一次翻頁器的播放鍵。

預期：步驟 4 之後播放器進入全螢幕，網頁沒有重新載入；步驟 5 之後畫面顯示「操作方式」；步驟 6 之後畫面變成黑畫面；步驟 7 之後畫面顯示「操作方式」；步驟 8 之後播放器離開全螢幕。

## NAV-R11.8 瀏覽器不支援全螢幕

需要手動檢查的原因：E2E test 用的 Chromium、Firefox、WebKit 都支援讓網頁元素進入全螢幕，iPhone 的 Safari 則不支援，所以要在 iPhone 的 Safari 上檢查。

1. 在 iPhone 的 Safari 開啟 `<Network 網址>/example/index.html`。
2. 用手指點一下畫面。

預期：畫面上沒有全螢幕按鈕。
