# 驗證紀錄

日期：2026-10-30。測試資料均為合成資料，不含使用者的真實訓練或健康紀錄。

## 自動檢查

- Node：16 個案例，涵蓋原版最小跑量回歸、10,000 組可重現參數組合、零基準、停課、黃燈、單次距離、里程與時間加總、品質課資格、心率、日誌日期、UTF-8 行事曆、舊資料遷移、儲存損壞／配額失敗與備份驗證。
- Playwright：8 個端對端案例，分別在 Chromium 與 WebKit 專案執行。涵蓋 320／375／390／430／844 CSS px、來源搜尋、WCAG A／AA axe 掃描、疼痛／熱天、資料保存、備份／還原、備註注入、心率輸入、行事曆、前景計時與子路徑離線使用。
- `npm run check`：主要程式與 service worker 的語法檢查。
- GitHub Actions：每次 main push／PR 執行以上檢查並安裝 Chromium／WebKit；失敗時保留測試報告。

本機已可執行 Chromium 手機模擬。此雲端環境封鎖 Playwright WebKit 下載網域，因此本機沒有 WebKit 執行結果；請以 [GitHub Actions](https://github.com/jasoart/S/actions/workflows/verify.yml) 對該 commit 的結果為準。測試不能建立醫療有效性，也不能取代 iPhone 實機驗收。

## 人工檢查

- 已檢視手機版畫面、修正不可聚焦的橫向課表及自訂開關的點擊區。
- 所有必要離線資產隨專案提供；部署沒有外部 CDN、網路字型或第三方追蹤需求。
- 研究來源採連結與原創摘要，沒有複製整篇文章或宣稱專家為產品背書。

尚待實機檢查的清單見 [IOS.md](IOS.md)。
