## 16. 開發路線圖 (Development Roadmap)

考量為 H5 輕量化專案，整體開發週期預計為 6 週。

### 16.1 里程碑定義
*   **Week 1 (Prototype / 核心驗證)**:
    - 實作相對觸控移動與自動連發。
    - 實作基本敵人類型與矩形碰撞盒。
    - **成功標準**：在 iPhone 15 及基礎 Android 機型以 60 FPS 流暢滑動射擊。
*   **Week 2-3 (Alpha / 遊戲循環建構)**:
    - 加入 Boss 牽引光束與俘虜邏輯。
    - 實作雙機合體機制。
    - 實作敵機複雜的 Bezier 曲線入場飛行軌跡。
*   **Week 4 (Beta / 關卡與功能齊全)**:
    - 加入 Challenge Stage (挑戰關卡)。
    - 完成進階難度擴展（無盡關卡邏輯）。
    - 接入 UI、特效與所有音效檔案。
*   **Week 5 (Polishing / 平衡打磨)**:
    - 實作無障礙邊界阻擋 (`touch-action: none`) 調整。
    - 連發速度、敵方子彈速度進行盲測 Playtest 驗證。
*   **Week 6 (Gold / 發布部署)**:
    - Firebase 輕量排行榜接入。
    - 激勵廣告 API 接入測試。
    - 壓縮圖檔並完成 PWA 產出，上線發布。
