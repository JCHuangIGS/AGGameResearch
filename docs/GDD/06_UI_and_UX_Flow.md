# Galaga 技術規格書：06_UI 與 UX 流程 (UI & UX Flow)

## 1. 遊戲選單結構 (Menu Structure)

### 1.1 主選單 (Main Menu)
*   **背景**: 動態賽博網格滾動，標題 "NEON GALAGA" 帶有 RGB 呼吸燈效果。
*   **選項**:
    - `START GAME`: 進入關卡 1。
    - `CONTROLS`: 顯示按鍵說明（WASD / Arrows）。
    - `SETTINGS`: 音量與發光強度 (Glow Intensity) 調節。

### 1.2 暫停選單 (Pause Menu)
*   **觸發**: 按下 `ESC` 或 `P` 鍵。
*   **視覺**: 畫面灰階處理 (Desaturation 0.5)，疊加半透明覆蓋層。
*   **按鈕**: `RESUME`, `RESTART`, `QUIT TO MENU`。

### 1.3 遊戲結束 (Game Over)
*   **觸發**: 生命值 = 0 且動畫結束。
*   **視覺**: 緩慢縮放的 "GAME OVER" 字樣，背景網格停止。
*   **動作**: 顯示結算畫面 (Accuracy / Score / Rank)，並提供 **RETRY** 按鈕讓玩家可以重新挑戰。
*   **RETRY 按鈕**: 按下後重置所有狀態 (Score, Lives, Rank, Level)，從 Level 1 重新開始。

---

## 2. 輸入映射 (Input Mapping)

| 輸入類型 | 實體按鍵 | 行動端手勢 |
| :--- | :--- | :--- |
| **移動 (Left)** | A / Left Arrow | 螢幕左半部虛擬搖桿 |
| **移動 (Right)** | D / Right Arrow | 螢幕右半部虛擬搖桿 |
| **射擊 (Fire)** | Space / K | 點擊螢幕右側按鈕 |
| **暫停 (Pause)** | ESC / P | 點擊右上角懸浮按鈕 |

---

## 3. 性能優化規範 (Performance & Optimization)
*   **物件池 (Object Pooling)**: 
    - `BulletPool`: 最大容量 30（玩家 + 敵機）。
    - `ParticlePool`: 最大容量 200（碎屑粒子）。
*   **資源管理**: 
    - 使用 PixiJS `Loader` 預載 `Orbitron` 字體與 Web Audio 緩衝。
    - 定期執行 Matter.js `Composite.remove()` 清理超出畫面的剛體。

---
> 🎮 **UX Note**: 所有的選單切換需伴隨 200ms 的淡入淡出，確保視覺流暢性而不產生突兀感。
