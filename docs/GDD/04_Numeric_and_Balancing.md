# Galaga 技術規格書：04_數值設計與平衡 (Numeric & Balancing)

## 1. 得分精確數值表 (Scoring Table)
程式內之 `ScoreManager` 模組需嚴格比照下表進行運算：

### 1.1 敵機得分 (Enemy Base Values)
| 敵機類型 | 編隊狀態 (Formation) | 進攻狀態 (Diving) | 備註 |
| :--- | :---: | :---: | :--- |
| 雜魚 (Bee) | 50 | 100 | - |
| 護衛 (Butterfly) | 80 | 160 | - |
| 大首領 (Boss Galaga) | 150 | 400 | 單機俯衝 |
| 大首領 (+1 護衛) | - | 800 | 需先擊破首領 |
| 大首領 (+2 護衛) | - | 1,600 | 難度最高獎勵 |

### 1.2 其他獎勵
- **被俘戰機**: 若玩家誤擊，扣除該機。
- **特殊變形機**: 160 ~ 320 分（依變形階段而定）。
- **Extra Life**: 30,000 / 70,000 / 每 70,000 分。

---

## 2. 物件速度參數 (Physics Parameters)
解析度基準為 288x224。

| 物件名稱 | 基礎速度 (px/frame) | 最大速限 | 備註 |
| :--- | :---: | :---: | :--- |
| 玩家戰機 | 2.0 | 2.0 | 固定值 |
| 玩家子彈 | 4.0 | 4.0 | 固定值 |
| 敵機子彈 | 1.0 | 2.5 | 隨 Rank 提升 |
| 敵機俯衝 | 1.5 | 3.0 | 隨 Rank 提升 |

---

## 3. 難度計算法 (Difficulty Rank Math)
系統為平衡高手與新手，應導入動態 Rank 機制：
*   **Rank 增加項目**: 
    - 關卡完成 (+5)。
    - 雙機合體 (+10)。
    - 平均命中率 > 80% (+5)。
*   **Rank 減少項目**: 
    - 玩家被擊落 (-15)。
    - 關卡卡關超過 2 分鐘 (-2)。

---

## 4. 狂熱模式運算 (Fever Mode Mechanics)
*   **熱量累積 (Heat Gain)**: 
    - 擊落 Bee/Butterfly: +5 pts
    - 擊落 Boss Galaga: +15 pts
    - 完成挑戰關卡: +25 pts
*   **熱量衰減 (Heat Decay)**: 
    - 非戰鬥狀態 (Formation 靜止): 每秒 -1 pt
    - 被擊落: 清空為 0
*   **觸發條件**: Heat Gauge 滿值 (100 pts)。
*   **持續時間**: 10 秒（UI 需顯示倒數或過濾器閃爍）。
*   **Fever 效果**: 
    - 所有移動速度 (Player & Enemy) x 1.5。
    - 得分倍率: x2.0。

---

## 5. 敵機生命值與防禦 (Enemy HP)
*   **Bee/Butterfly**: 1 HP (一擊必殺)。
*   **Boss Galaga**: 2 HP。
    - 第一擊：顏色轉為紫色/深色，表示受損。
    - 第二擊：摧毀。
    - *註*: 若 Boss 攜帶戰機時被擊中，判斷邏輯見 [02_Gameplay_Mechanics.md](file:///d:/Antigravity/GameResearch/docs/GDD/02_Gameplay_Mechanics.md)。

---
> 🎮 **Balance Note**: 確保在 Rank 達到最大值 (255) 時，遊戲依然具有可通過性。測試時需檢查是否有「不可避開」的死局。
