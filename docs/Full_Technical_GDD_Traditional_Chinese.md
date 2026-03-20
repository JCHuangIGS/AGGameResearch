# 《大蜜蜂》(Galaga) 完整技術設計文件 (Technical GDD)
**版本**: 1.2 (全規格補強版)  
**對象**: 程式設計師、美術設計、數值策劃

---

## 📄 檔案與章節索引
1. [系統架構與狀態機 (01_System_Architecture.md)](GDD/01_System_Architecture.md)
2. [遊戲機制與雙機詳解 (02_Gameplay_Mechanics.md)](GDD/02_Gameplay_Mechanics.md)
3. [關卡進場、30 關進程與過關流程 (03_Level_and_Enemy_Design.md)](GDD/03_Level_and_Enemy_Design.md)
4. [得分、速度與難度公式 (04_Numeric_and_Balancing.md)](GDD/04_Numeric_and_Balancing.md)
5. [渲染、色盤與音效規範 (05_Art_and_Audio_Specs.md)](GDD/05_Art_and_Audio_Specs.md)
6. [UI 與 UX 互動流程 (06_UI_and_UX_Flow.md)](GDD/06_UI_and_UX_Flow.md)

---

## 🚀 專案核心開發目標 (Production Focus)

### 程式開發 (Programming)
*   **過關狀態機**: 實作從清空敵機到計算 Bonus 及標誌更新的無縫轉換。
*   **幀同步控制**: 模擬 Z80 在 3.072MHz 下的非同步處理感。
*   **座標系統**: 所有的移動與碰撞需嚴格遵守 288x224 網格。

### 關卡策劃 (Level Design)
*   **30 關難度階梯**: 定義入門、進階、大師階級的子彈速率與 AI 修正權重。
*   **挑戰關卡週期**: 每 4 關循環一次（Stage 3, 7, 11...），共計 7 場挑戰賽。
*   **五組進場規跡**: 精確模仿原版的螺旋、U 型進場模式。

### 美術與數值 (Art & Numerics)
*   **色盤與精靈規範**: BB-GGG-RRR (3-3-2 bit mix) 與 16x16 網格對齊。
*   **Rank 動態難度**: 根據命中率、存活時間即時調整 Rank (0-255)。

---
> 🎮 **Production Note**: 本文件版本 v1.1 已包含完整的 30 關卡進度與過關流程描述。
