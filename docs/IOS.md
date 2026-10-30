# iPhone / iOS 支援與驗收

目標：Safari 17 以上的 iPhone／iPad，含加入主畫面的 standalone 模式。保留 `viewport-fit=cover` 與四邊安全區。主要控制項至少 44 CSS px，文字輸入至少 16px，允許捏合放大與 reduced motion。

## 已實作

- 相對路徑 manifest、180px Apple touch icon、192／512px PWA 圖示，可部署於 GitHub Pages 的 `/S/`。
- 所有必要 HTML／JS／CSS／圖示預先快取；完整安裝後才使用新版本。外部文獻不離線下載。
- 新版本先等待，使用者按「儲存並套用新版本」才切換；儲存失敗則不繼續重載。
- 前景計時以單調時鐘計算經過時間；`visibilitychange`／`pagehide` 時暫停。返回後需明確繼續。
- Screen Wake Lock 僅在使用者勾選且前景計時時要求；不支援或拒絕時有退路。
- 分享檔案可用時交由系統分享選單；否則使用下載與可點擊的檔案連結。取消分享不視為失敗。
- `.ics` 採本機日期的全天事件，結束日為隔日，不指定可能錯位的 UTC 開跑時間。中文依 UTF-8 位元組折行。
- Storage API 持久儲存僅為請求，無法保證授權或永久保存。提供 JSON 備份與還原。
- 螢幕鍵盤輸入時隱藏底部快速操作列，避免遮住輸入區；每頁皆可保留放大能力。

## 實機驗收（仍需完成）

雲端瀏覽器模擬不能代替真實 iPhone 硬體與 iOS 系統行為。

1. iPhone SE、一般尺寸與含動態島機型：直／橫向、Safari 工具列展開與收合、安全區、放大文字與 VoiceOver。
2. Safari 分享 → 加入主畫面；新安裝及重新開啟時圖示、名稱與 scope 正確。
3. 線上載入一次後開飛航模式；重啟 PWA 可計算、讀來源摘要、新增日誌。外部文獻需要連線。
4. 鎖屏、切換 App、來電、中途返回後，計時不應偷偷繼續或發送背景聲音；按繼續才恢復。
5. 低耗電模式下亮屏要求可能拒絕；拒絕不得阻止主功能。
6. 分享 JSON 到「檔案」，再用「匯入備份」還原；試驗取消分享與格式錯誤，原資料不變。
7. `.ics` 可先存到「檔案」後用支援的行事曆方式匯入；不同 iOS／行事曆版本未必直接接收 Safari 下載。
8. 私密瀏覽、儲存滿載、網站資料被清除與更新時，核對錯誤訊息與備份還原。

## 平台限制

不是原生 App，不能直接讀取 HealthKit。沒有背景定位、Apple Watch 同步、背景工作或鎖屏通知；加入主畫面不會自動取得這些能力。Safari 分頁與主畫面模式的儲存隔離可能因系統版本不同，必要時使用備份移轉。

依據：[Apple 加入主畫面](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios)、[WebKit 安全區](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)、[儲存政策](https://webkit.org/blog/14403/updates-to-storage-policy/)、[Safari 16.4 能力](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)。
