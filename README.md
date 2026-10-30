# PacerIQ Coach 2

以使用者提供的 `index.html` 為基礎強化的繁體中文跑步 Web App，針對 iPhone Safari／主畫面模式設計。保留原本米色與綠色的介面，將計算、資料儲存與畫面分離，免帳號、免外部 API、免建置即可使用。

## 功能

- **可檢查的週課表**：以 0.1 km 分配總量，逐次限制距離；低跑量不再被最小值強迫加量。新手、回鍋、疼痛、熱濕與恢復不足會限制品質課；警訊直接停課。
- **30 份來源庫**：26 份運動／健康研究與指引、4 份 Apple／WebKit 文件，可依專家、主題與關鍵字搜尋。每份都有原始連結、研究類型及轉譯限制。
- **本機訓練日誌**：記錄距離、時間、整堂 RPE、備註；比較近七天與前七天已記錄負荷。不是受傷預測模型。
- **iPhone 工具**：加入主畫面、完整離線快取、安全區、可放大文字、前景課程計時與可選亮屏、系統分享、全天 `.ics` 行事曆匯出。
- **資料可靠性**：自動儲存、舊版設定遷移、損壞／配額錯誤提示、JSON 備份與驗證還原、跨分頁寫入衝突提示。
- **補給與恢復**：依估計時間提示碳水演練、汗率計算、心率估式或實測值、談話測試與 REDs 教育資訊。

## 開啟

GitHub Pages 設定若使用 `main` 根目錄，網站位址為 <https://jasoart.github.io/S/>。離線安裝需要 HTTPS；先線上開啟一次並看到「離線檔案已備妥」，再從 Safari 分享選單加入主畫面。

本機開發：

```sh
python3 -m http.server 8000
# 瀏覽 http://localhost:8000
```

測試會刻意使用 `/S/` 子路徑，確保不是只在網站根目錄可用。

```sh
npm ci
npm run check
npm test
npx playwright install --with-deps chromium webkit
npm run test:browser
```

若要使用環境已有的 Chromium：

```sh
PACER_CHROMIUM_PATH=/usr/bin/chromium npx playwright test --project=iphone-chromium
```

## 文件

- [研究來源、專家與轉譯限制](docs/RESEARCH.md)
- [演算法、修正與資料格式](docs/ENGINE.md)
- [iPhone 支援範圍與實機驗收](docs/IOS.md)
- [驗證方法與已知限制](docs/VALIDATION.md)
- [GitHub 自動檢查](../../actions/workflows/verify.yml)

## 使用邊界

目標瀏覽器為 iOS／iPadOS Safari 17 以上及現代桌面瀏覽器。這是 PWA，不是原生 iOS App；沒有 HealthKit、背景 GPS、背景持續計時或鎖屏通知。個人資料只留在瀏覽器及使用者主動匯出的檔案；瀏覽器清理或移除網站資料可能造成遺失。

初次開啟為**示範參數**。恢復分數、增量上限、配速與賽前減量均為明確標示的產品啟發式，不是經臨床驗證的個人處方；文獻作者與機構沒有背書本系統。身體警訊、醫療建議與個別狀態優先。

## 維護

修改任何離線資產後，請同時更新 `service-worker.js` 的 `VERSION`。新版本完整快取後才會提示使用者儲存並更新，避免新舊檔案混用。新增離線必要檔案時也要加入 `SHELL`。
