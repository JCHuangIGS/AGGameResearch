## 8. 使用者體驗與介面 (UX & UI)

完全針對手機直式 (Portrait 9:16) 進行排版與最佳化。

### 8.1 畫面佈局 (HUD Layout)
為了完美重現街機的視覺排列，同時適配手機直式 (Portrait 9:16) 視角，我們保留了經典街機螢幕的資訊佈局分區。

*   **頂部儀表板 (Top Dashboard)**:
    - **左上區域 (Top-Left)**: 標題顯示紅色的 `1UP`，其下方顯示當前玩家分數 (白色數字)。
    - **正中區域 (Top-Center)**: 標題顯示紅色的 `HIGH SCORE`，其下方顯示歷史最高紀錄 (白色數字)。
    - **右上區域 (Top-Right)**: 熱度量表 (Heat Bar)，寬 100px、高 10px 的水平進度條。平時為青藍色 (Cyan)，FEVER 期間切換為紫紅色 (Magenta) 脈動。位於 High Score 數字右方更靠邊的安全區域，避免與分數文字重疊。
*   **中央戰區與彈出訊息 (Combat Zone & Floating Texts)**: 垂直長條型的戰鬥空間，過場或特殊事件時正中央會浮現紅色大字體跑馬提示（如 `"FIGHTER CAPTURED"`, `"STAGE X"`, `"PERFECT"`, `"CHALLENGING STAGE"`）。FEVER 觸發時全畫面閃爍紫色 (Magenta Flash)，持續期間疊加半透明紫紅色調以提示玩家當前處於增益狀態。
*   **底部資訊 (Bottom Indicators)**:
    - **左下方 (Bottom-Left)**: 以「玩家迷你戰機圖示」橫排並列顯示剩餘的備用生命數 (Lives)。
    - **右下方 (Bottom-Right)**: 以黃色、紅色、藍色的小型「勳章/旗幟 (Badges)」圖騰橫排顯示目前的過關數 (Stage Indicators)。

### 8.2 新手引導 (FTUE)
*   **Minute 0**: 開啟網頁直接進入標題，點擊螢幕任何一處開始。
*   **Minute 0.1**: 畫面上浮現閃爍的大字體提示："滑動以移動 / 滑動自動連發 (Drag to Move & Auto-Fire)"。
*   **Minute 0.5**: 第一波敵機飛入，教學提示透明度逐漸降至 0，引導玩家投入實戰。
*   **Minute 1.5**: 第一次陣亡時，給予強烈的畫面碎裂特效與裝置震動（若瀏覽器支援），2 秒內於底端極速重生。

### 8.3 無障礙與跨平台適配 (Accessibility)
*   H5 Canvas 動態縮放，自動適配各種 16:9 或 21:9 手機螢幕。
*   針對手指拖曳範圍外的盲區，優化子彈特效發光度，確保在手指導航時依舊具有清晰辨識度。
