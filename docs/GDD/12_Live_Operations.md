## 11. 社交與營運設計 (Social & Live Operations)

由於遊戲為單機遊玩體驗 (H5 Web Game)，故我們以「非同步排行榜 (Asynchronous Leaderboards)」與「成就分享」作為主要的社群動力。

### 11.1 本地與全球排行榜 (Leaderboards)
*   **本機最高分 (Local Hi-Score)**：儲存在瀏覽器 `localStorage` 中，隨時可與自己競賽。
*   **全球榜 (Global Leaderboard)**：透過輕量後端 API (如 Firebase) 更新前 100 名玩家的最高得分與突破的最高關卡。

### 11.2 社交分享 (Social Sharing)
*   玩家死亡並進入排行榜結算時，提供快速生成「戰績圖」的按鈕 (使用 `canvas.toDataURL` 匯出)，可直接分享至各大主流社群平台或通訊軟體。
*   分享圖案會列出「雙機合體次數」、「最高挑戰全滅次數」與「最終分數」。
