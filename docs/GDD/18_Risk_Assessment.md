## 17. 風險與營運評估 (Risk Assessment)

| 風險項目 | 類別 | 發生機率 | 衝擊程度 | 緩解策略 (Mitigation Strategy) |
|---|---|---|---|---|
| **觸控事件相容性** | 技術 | High | High | Safari 與 Chrome 的 Touch Events 行為不同，可能導致滑屏異常。開發時強制導入統一的 Pointer Events 指標。 |
| **單局平均時長過長** | 市場 | Med | Med | 原作高手平均時長 7~8 分。我們在 H5 將透過第 10 關之後的高階曲線提高彈幕速度與同屏數量，強制淘汰多數玩家以控制時間心流在 3-5 鐘內。 |
| **效能掉幀 (Frame Drop)**| 技術 | Low | High | 網頁載入資源過多導致遊戲卡頓。嚴格採用 Sprite Atlas 減少 Draw Call，並利用 Object Pooling 回收子彈。 |
| **作弊與外掛得分** | 市場 | Low | Med | H5 遊戲容易被篡改 Javascript 送出假分數排行榜。我們將對發送 API 進行最基本的防護 (Hash Check)，但不耗費大量資源做完全隔離。 |
