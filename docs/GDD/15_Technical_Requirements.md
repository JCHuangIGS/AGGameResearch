## 14. 技術規格與需求 (Technical Requirements)

### 14.1 核心技術堆疊 (Tech Stack)
*   **引擎選用**: HTML5 Canvas / WebGL (建議使用輕量級的 PixiJS 或 Phaser 框架，此以 Phaser 3 尤佳，能完美處理物理碰撞與精靈圖管理)。
*   **語言**: TypeScript (為遊戲邏輯與敵機陣型提供強型別支援)。
*   **發布格式**: PWA (Progressive Web App) / 手機瀏覽器相容 H5 遊戲。

### 14.2 硬體與效能目標
*   **目標幀率**: 60 FPS (行動裝置瀏覽器最高標準)
*   **載入時間 (Load Time)**: 小於 3 秒 (不含音效檔案應控制在 5MB 以下)
*   **螢幕適配**: 根據 `window.innerHeight` 與 `innerWidth` 鎖定在直立比例 (Aspect Ratio 9:16 到 10:21)，左右強制加上 Letterbox 黑邊處理超出範圍，以確保敵人移動路徑的一致性。

### 14.3 技術風險與緩解策略
*   **技術風險**: 螢幕觸控延遲與多點觸控衝突。
*   **緩解方案**: 禁用瀏覽器的手勢翻頁 (如 iOS 的邊緣滑動上一頁) 與雙擊放大 (`touch-action: none;`)。
*   **技術風險**: 大量子彈與敵軍同時出現時的 Garbage Collection (GC) 停頓。
*   **緩解方案**: 使用對象池 (Object Pooling) 技術預先載入約 100 顆子彈物件，發射與回收僅改變活性，不進行新建或刪除 (`new` / `destroy`)。
