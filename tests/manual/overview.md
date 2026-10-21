# 預覽總覽的手動檢查

這份檔案列出 [overview.md](../../docs/specs/overview.md) 裡需要手動檢查的情境。改到和這些情境有關的程式碼時，照下面的步驟檢查，並把結果寫在 PR 的「手動檢查」。

下面的步驟都用測試用的簡報，因為這些簡報的頁面名稱和 spec 的情境相同：

| 簡報 | 網站上的標題 | 頁面 |
| --- | --- | --- |
| `example` | 範例 | Intro、Agenda、Summary 三頁，都沒有頁內分步 |
| `annual-review` | 年度回顧 | Intro、Agenda、Recap、Thanks 四頁，都沒有頁內分步 |
| `demo` | 示範 | Intro、List（3 步）、Recap 等九頁，第六頁是有計數器的 Counter |
| `steps` | 分步 | Intro、List、Recap 等十六頁；List 的「First point」在第 1 步出現，「Second point」在第 2 步出現 |
| `seven-pages` | 七頁 | Page 1 到 Page 7 |
| `forty-pages` | 四十頁 | Page 1 到 Page 40 |

檢查之前先執行 `make build-site DECKS_DIR=tests/fixtures/decks`。步驟裡的「開啟 `<簡報>`」指用瀏覽器開啟 `dist/<簡報>/index.html`，「開啟 `<簡報>` 的 `<hash>`」指開啟網址加上這個 hash 的 `dist/<簡報>/index.html`。要從網站開啟簡報時，再執行 `make serve`，步驟裡的 `<Local 網址>` 指這個指令在終端機印出的 Local 網址，通常是 `http://localhost:4173/`。要在 iPad 或 iPhone 上檢查時，改執行 `pnpm exec vite preview --outDir dist --host`，並讓 iPad 或 iPhone 與電腦連上同一個網路；步驟裡的 `<Network 網址>` 指這個指令在終端機印出的 Network 網址。

開關總覽的動畫只有 300 毫秒。檢查動畫時，在 Chrome 的 DevTools 打開 Animations 面板，把播放速度調成 10%，動畫就會放慢十倍。

## OVW-R2.2 全螢幕時按 Esc

需要手動檢查的原因：全螢幕時，headless 的 Chromium 收到 Esc 不會離開全螢幕。

1. 用 Chrome 開啟 `example`。
2. 按 `F` 進入全螢幕。
3. 按 `G`。
4. 按 Esc。

預期：播放器離開全螢幕，總覽仍然開著。

## OVW-R3.6 瀏覽器不支援全螢幕

需要手動檢查的原因：E2E test 用的 Chromium、Firefox、WebKit 都支援讓網頁元素進入全螢幕，iPhone 的 Safari 則不支援。

1. 在 iPhone 的 Safari 開啟 `<Network 網址>/example/index.html`。
2. 用手指點一下畫面。

預期：右下角出現總覽按鈕，沒有出現全螢幕按鈕。

## OVW-R3.7 在平板上開啟與關閉總覽

需要手動檢查的原因：E2E test 只能送出模擬的 touch 與 pointer 事件，要在觸控裝置上用手指操作，才能確認真實的觸控會按下按鈕。

1. 在 iPad 的 Safari 開啟 `<Network 網址>/example/index.html`。
2. 確認畫面顯示 Intro。
3. 用手指點一下畫面，再點右下角的總覽按鈕。
4. 確認畫面顯示總覽。
5. 等 3 秒。
6. 確認總覽按鈕與全螢幕按鈕仍然顯示。
7. 再點一次總覽按鈕。

預期：步驟 4 與步驟 6 的結果成立；步驟 7 之後總覽關閉，畫面顯示 Intro。

## OVW-R8.5 在平板上點縮圖

需要手動檢查的原因：E2E test 只能送出模擬的 touch 與 pointer 事件，要在觸控裝置上用手指點縮圖，才能確認真實的點擊會跳頁。

1. 在 iPad 的 Safari 開啟 `<Network 網址>/example/index.html`。
2. 用手指點一下畫面，再點總覽按鈕。
3. 用手指點 Summary 的縮圖。

預期：總覽關閉，畫面顯示 Summary。

## OVW-R11.1 總覽開著時按 Tab 之後按 Enter

需要手動檢查的原因：E2E test 看得出焦點有沒有停在網頁裡的元素上，但看不出焦點有沒有移到瀏覽器的網址列或工具列。

1. 用 Chrome 開啟 `example`。
2. 按 `G`。
3. 按五次 Tab。
4. 確認網址列與工具列都沒有出現焦點框，總覽按鈕、全螢幕按鈕與縮圖上也都沒有焦點框。
5. 按 →，再按 Enter。
6. 在 Firefox 重複步驟 1 到 5。
7. 在 Safari 重複步驟 1 到 5，步驟 3 改按五次 Option+Tab。

預期：步驟 4 的結果成立；步驟 5 之後總覽關閉，畫面顯示 Agenda。

## OVW-R12.8 按 Backspace

需要手動檢查的原因：Playwright 的 WebKit 收到網頁沒有擋下的 Backspace 時，會回到上一頁，Safari 則不會，所以 E2E test 不在 WebKit 檢查這個情境，要在 Safari 上檢查。

1. 用 Safari 開啟 `example`。
2. 按 →，確認畫面顯示 Agenda。
3. 按 `G`。
4. 按 Backspace。

預期：總覽仍然開著，選取框仍然在 Agenda，網址的 hash 仍然是 `#/agenda`。

## OVW-R12.11 用翻頁器操作總覽

需要手動檢查的原因：E2E test 只能送出模擬的 keydown 事件，要接上翻頁器，才能確認翻頁器送出的按鍵在總覽裡的作用。

1. 把翻頁器接上電腦。
2. 用 Chrome 開啟 `forty-pages`。
3. 按 `F` 進入全螢幕，再按 `G`。
4. 按翻頁器的下一頁鍵。
5. 確認總覽往下捲動，選取框仍然在第 1 頁。
6. 按翻頁器的黑畫面鍵。

預期：步驟 5 的結果成立；步驟 6 之後畫面沒有變成黑畫面，總覽仍然開著。

## OVW-R14.3 在平板上捲動總覽

需要手動檢查的原因：E2E test 只能送出模擬的 touch 事件，這些事件不會經過瀏覽器處理捲動手勢的流程。

1. 在 iPad 的 Safari 開啟 `<Network 網址>/forty-pages/index.html`。
2. 用手指點一下畫面，再點總覽按鈕。
3. 用手指在總覽上往上滑。

預期：總覽往下捲動，總覽仍然開著，選取框仍然在第 1 頁。

## OVW-R16.2 離開簡報之後再回到簡報

需要手動檢查的原因：Playwright 的瀏覽器不一定會從 back-forward cache 還原網頁，所以 E2E test 不一定檢查得到從 back-forward cache 還原的情況。

1. 執行 `make serve`，用 Chrome 開啟 `<Local 網址>`，點「範例」。
2. 按 →，確認畫面顯示 Agenda。
3. 打開 DevTools 的 Console，執行 `addEventListener("pageshow", (event) => console.log("persisted", event.persisted))`。
4. 按 `G`。
5. 按瀏覽器的上一頁，確認瀏覽器顯示網站首頁。
6. 按瀏覽器的下一頁。
7. 確認 Console 印出 `persisted true`。沒有印出時，這一次是重新載入網頁，回到步驟 1 重做；Chrome 在 DevTools 開著時也會用 back-forward cache，但頁面有未完成的連線時不會用。
8. 在 Safari 重複步驟 1 到 7。

預期：步驟 6 之後總覽沒有開著，畫面顯示 Agenda。

## OVW-R17.12 講者視窗縮到最小時在觀眾視窗按 `G`

需要手動檢查的原因：Playwright 的每個視窗都在前景，E2E test 沒辦法把講者視窗縮到最小。

1. 用 Chrome 開啟 `annual-review`，按 `S` 開啟講者視窗。
2. 按講者視窗左上角的黃色按鈕（Windows 按右上角的最小化按鈕），把講者視窗縮到最小。
3. 點觀眾視窗，確認觀眾視窗顯示 Intro。
4. 按 `G`，再按 →。
5. 確認觀眾視窗仍然顯示 Intro，沒有顯示總覽。
6. 從 Dock（Windows 從工作列）把講者視窗還原。

預期：步驟 5 的結果成立；步驟 6 之後，講者視窗顯示總覽，選取框在 Agenda。

## OVW-R20.1 觀眾視窗的分頁不在前景

需要手動檢查的原因：Playwright 的每個分頁都在前景，E2E test 只能改寫 `document.visibilityState` 模擬分頁不在前景。

1. 用 Chrome 開啟 `annual-review`，按 `S` 開啟講者視窗。
2. 在觀眾視窗按 `G`。
3. 在觀眾視窗所在的瀏覽器視窗開一個新分頁。
4. 確認講者視窗仍然只顯示總覽，畫面上沒有「觀眾看不到簡報」。
5. 點講者視窗裡總覽的背景，按 `G`。

預期：步驟 4 的結果成立；步驟 5 之後講者視窗的目前頁上面疊著「觀眾看不到簡報」。

## OVW-R21.1 開啟時從目前的頁面縮小

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 用 Chrome 開啟 `seven-pages` 的 `#/page-6`。
2. 在 DevTools 的 Animations 面板把播放速度調成 10%。
3. 按 `G`。

預期：Page 6 的畫面縮小到總覽第二列第二張縮圖的位置，其他縮圖與總覽的背景同時淡入。

## OVW-R21.2 跳頁時從縮圖放大

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 用 Chrome 開啟 `seven-pages`，按 `G`。
2. 在 DevTools 的 Animations 面板把播放速度調成 10%。
3. 點 Page 6 的縮圖。

預期：Page 6 從它的縮圖的位置放大到畫布的位置，其他縮圖與總覽的背景同時淡出。

## OVW-R21.3 講者視窗的動畫

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 用 Chrome 開啟 `annual-review`，按 `S` 開啟講者視窗。
2. 在講者視窗與觀眾視窗的 DevTools 的 Animations 面板都把播放速度調成 10%。
3. 點講者視窗的備註區，按 `G`。

預期：講者視窗的目前頁那一格縮小到它在總覽裡那張縮圖的位置，資訊列、下一步、下一頁與備註區同時淡出；觀眾視窗的頁面一直以整頁大小顯示 Intro，沒有縮小。

## OVW-R21.4 講者視窗重新整理時不播放動畫

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 用 Chrome 開啟 `annual-review`，按 `S` 開啟講者視窗。
2. 在觀眾視窗按 `G`，確認講者視窗顯示總覽。
3. 在講者視窗按 Cmd+R（Windows 按 Ctrl+R）重新整理講者視窗。

預期：講者視窗載入完成之後，直接顯示目前頁、下一步、下一頁與備註區的版面，沒有播放縮放的動畫；觀眾視窗一直顯示 Intro，畫面沒有任何變化。

## OVW-R21.5 關閉總覽時保留互動元件的狀態

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫途中的畫面。

1. 用 Chrome 開啟 `demo` 的 `#/counter`。
2. 點三次 Counter 的按鈕，確認按鈕寫著 `Count: 3`。
3. 在 DevTools 的 Animations 面板把播放速度調成 10%。
4. 按 `G`，等總覽完全出現，再按一次 `G`。

預期：放大途中，按鈕一直寫著 `Count: 3`。

## OVW-R21.6 講者視窗恢復連線時總覽已經關閉

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 執行 `make serve`，用 Chrome 開啟 `<Local 網址>`，點「年度回顧」，按 `S` 開啟講者視窗。
2. 在觀眾視窗按 `G`。
3. 在觀眾視窗按瀏覽器的上一頁，確認講者視窗保留著總覽，上面疊著「連線中斷」。
4. 在觀眾視窗按瀏覽器的下一頁。

預期：講者視窗恢復連線之後，直接回到目前頁、下一步、下一頁與備註區的版面，沒有播放縮放的動畫。

## OVW-R21.7 從 back-forward cache 還原時不播放動畫

需要手動檢查的原因：Playwright 的瀏覽器不一定會從 back-forward cache 還原網頁，而且 E2E test 不檢查動畫的畫面。

1. 執行 `make serve`，用 Safari 開啟 `<Local 網址>`，點「範例」。
2. 按 →，確認畫面顯示 Agenda。
3. 打開網頁檢閱器的主控台，執行 `addEventListener("pageshow", (event) => console.log("persisted", event.persisted))`。
4. 按 `G`。
5. 按瀏覽器的上一頁，再按瀏覽器的下一頁。
6. 確認主控台印出 `persisted true`。沒有印出時，回到步驟 1 重做。

預期：步驟 5 回到簡報時，畫面直接顯示 Agenda，沒有播放縮放或淡出的動畫。

## OVW-R21.8 總覽開著時開啟講者視窗

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 用 Chrome 開啟 `seven-pages` 的 `#/page-6`，按 `G`。
2. 在 DevTools 的 Animations 面板把播放速度調成 10%。
3. 按 `S`。

預期：講者視窗連上之後，觀眾視窗的 Page 6 從總覽第二列第二張縮圖的位置放大到畫布的位置，其他縮圖與總覽的背景同時淡出；講者視窗直接顯示總覽，沒有播放縮放的動畫。

## OVW-R21.9 講者視窗連上時跳到其他頁面

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 用 Chrome 開啟 `annual-review`，按 `S` 開啟講者視窗。
2. 點講者視窗的備註區，按 `G`。
3. 在講者視窗與觀眾視窗的 DevTools 的 Animations 面板都把播放速度調成 10%。
4. 在講者視窗點 Recap 的縮圖。

預期：講者視窗的目前頁那一格從 Recap 的縮圖的位置放大回原本的位置；觀眾視窗直接顯示 Recap，沒有縮放，也沒有淡出。

## OVW-R22.1 開啟時維持目前的步驟

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫途中的畫面。

1. 用 Chrome 開啟 `steps`，按兩次 →，確認畫面顯示 List，「First point」出現，「Second point」還沒出現。
2. 在 DevTools 的 Animations 面板把播放速度調成 10%。
3. 按 `G`。

預期：縮小途中看得到「First point」，看不到「Second point」；縮到定位之後，List 的縮圖裡出現「Second point」。

## OVW-R22.2 跳到其他頁面時顯示第 0 步

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫途中的畫面。

1. 用 Chrome 開啟 `steps`，按 `G`。
2. 在 DevTools 的 Animations 面板把播放速度調成 10%。
3. 點 List 的縮圖。

預期：放大途中看不到「First point」與「Second point」。

## OVW-R22.3 關閉總覽時顯示原本的步驟

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫途中的畫面。

1. 用 Chrome 開啟 `steps`，按兩次 →，確認「First point」出現，「Second point」還沒出現。
2. 按 `G`，等總覽完全出現。
3. 在 DevTools 的 Animations 面板把播放速度調成 10%。
4. 按 `G`。

預期：放大途中看得到「First point」，看不到「Second point」。

## OVW-R22.4 頁面或步驟被總覽以外的操作改變時

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫途中的畫面。

1. 用 Chrome 開啟 `steps`，按兩次 →，確認網址的 hash 是 `#/list/1`。
2. 按 `G`，等總覽完全出現，確認 List 的縮圖完整出現在視窗裡。
3. 在 DevTools 的 Animations 面板把播放速度調成 10%。
4. 把網址的 hash 改成 `#/list/2`。

預期：List 從它的縮圖的位置放大成整頁，放大途中看得到「First point」與「Second point」。

## OVW-R23.1 輸入頁碼跳到視窗外的頁面

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 用 Chrome 開啟 `forty-pages`，把瀏覽器視窗調到第 40 頁的縮圖不在視窗裡的高度，按 `G`。
2. 確認第 40 頁的縮圖不在視窗裡。
3. 在 DevTools 的 Animations 面板把播放速度調成 10%。
4. 輸入 40，再按 Enter。

預期：總覽淡出，露出 Page 40，畫面沒有縮放。

## OVW-R23.2 按瀏覽器的上一頁回到視窗外的頁面

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 用 Chrome 開啟 `forty-pages`，按 End，再按 `G`。
2. 確認第 1 頁的縮圖不在視窗裡。
3. 在 DevTools 的 Animations 面板把播放速度調成 10%。
4. 按瀏覽器的上一頁。

預期：總覽淡出，露出 Page 1，畫面沒有縮放。

## OVW-R23.3 縮圖只露出一部分

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 用 Chrome 開啟 `forty-pages`，按 `G`。
2. 用滑鼠滾輪把總覽捲到視窗下緣切過第 17 頁的縮圖、它只有上半部在視窗裡的位置。
3. 在 DevTools 的 Animations 面板把播放速度調成 10%。
4. 輸入 17，再按 Enter。

預期：Page 17 從縮圖露出的位置放大成整頁，總覽沒有直接淡出。

## OVW-R23.5 在講者視窗跳到視窗外的頁面

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 用 Chrome 開啟 `forty-pages`，按 `S` 開啟講者視窗。
2. 點講者視窗的備註區，按 `G`。
3. 如果第 40 頁的縮圖在講者視窗裡，把講者視窗調矮，直到第 40 頁的縮圖不在講者視窗裡。
4. 在講者視窗的 DevTools 的 Animations 面板把播放速度調成 10%。
5. 在講者視窗輸入 40，再按 Enter。

預期：講者視窗的總覽淡出，露出目前頁、下一步、下一頁與備註區的版面，目前頁那一格沒有縮放；觀眾視窗顯示 Page 40。

## OVW-R25.1 開啟減少動態效果

需要手動檢查的原因：E2E test 只驗證播放器的狀態，不檢查動畫的畫面。

1. 打開 macOS「系統設定」裡「輔助使用」的「顯示器」，開啟「減少動態效果」。
2. 用 Chrome 開啟 `example`。
3. 在 DevTools 的 Animations 面板把播放速度調成 10%。
4. 按 `G`，等總覽完全出現，再按一次 `G`。
5. 關閉「減少動態效果」。

預期：步驟 4 裡，總覽淡入，再淡出，畫面沒有縮放。
