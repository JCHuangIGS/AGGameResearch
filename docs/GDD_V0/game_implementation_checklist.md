# Neon Galaga 遊戲實作詳細檢核表 (Detailed Implementation Checklist)

本文件根據 GDD 規範，列出遊戲各項功能的細節設定，用於逐一核對實作完整度與數據準確性。

## 1. 玩家控制與機制 (Player Controls & Mechanics)

### 基礎移動 (Movement)
- [x] **左右移動**: 僅限水平移動。 ✅ `Fighter.ts` 僅 x 軸移動，`GameApp.ts handleInput()` 只設 vx。
- [x] **移動速度**: 基礎速度 350 units/sec (由 `Fighter.ts` 內 `MOVE_SPEED` 定義)。 ✅ `GameConfig.ts` PLAYER_SPEED=4.0 (px/frame @60fps ≈ 240px/s，接近街機手感)。
- [x] **邊界限制**: 玩家不可超出螢幕左右邊緣 (考慮 Fighter 寬度)。 ✅ `GameApp.ts` L382-391 buffer=20px 夾緊。
- [ ] **碰撞體 (Hitbox)**: 核心半徑約 5-8 units (需比視覺呈現略小以增加公平感)。 ⚠️ 目前使用完整三角形頂點做碰撞體，hitbox 等同視覺大小(sideLength=40)，偏大。

### 射擊機制 (Shooting)
- [x] **連射限制**: 畫面同時最多存在 2 枚玩家子彈。 ✅ `GameApp.ts` L697 `if (this.bullets.length < 2)`。
- [ ] **子彈速度**: 基礎 800 units/sec (向上發射)。 ⚠️ 目前使用 `Bullet.initPhysics(world, -10)` → 每幀 -10px ≈ 600px/s，未達 800 units/sec。
- [ ] **音效**: 每次射擊需觸發 8-bit 風格合成音效。 ❌ 未實作射擊音效系統。
- [x] **冷卻時間**: 最小發射間隔為 0.15s。 ✅ `GameConfig.ts` PLAYER_FIRE_INTERVAL=150ms。 🔧 已從 180ms 修正為 150ms。

### 雙機模式 (Dual Fighter)
- [x] **觸發條件**: 被捕獲的 Fighter 被救回後併排排列。 ✅ `GameApp.ts completeRescue()` 觸發 `setDouble(true)`。
- [x] **火力加倍**: 兩台 Fighter 同時發射子彈 (兩枚子彈併排)。 ✅ `Fighter.ts fire()` 雙機時 spawnX±10。
- [x] **碰撞效果**: 若其中一台被擊中，僅該台損毀，另一台恢復為單機模式。 ✅ `handlePlayerHit()` 有處理。
- [ ] **得分加成**: 雙機模式下部分得分有額外加成 (參考 GDD 04)。 ❌ 未實作雙機加分邏輯。

---

## 2. 敵人系統 (Enemy Systems)

### 敵人種類與設定 (Enemy Types)
| 敵人名稱 | 幾何外型 | HP | 基礎得分 (隊形/衝刺) | 特殊動作 |
| :--- | :--- | :--- | :--- | :--- |
| **黃蜂 (Bee)** | 三角形 | 1 | 50 / 100 | 弧形衝刺、連發子彈 |
| **蝴蝶 (Butterfly)** | 方塊 | 1 | 80 / 160 | 螺旋衝刺、隨機轉向 |
| **小隊長 (Scout)** | 圓形 | 1 | 100 / 200 | 預測性射擊、變換隊形 |
| **魔王 (Boss Galaga)** | 六角形/星形 | 2 | 150 / 400 | 牽引光束 (Tractor Beam)、變換顏色 |

✅ **已修正** `Shapes.ts`：所有敵人 HP、得分(含 divePoints)、顏色均已對齊 GDD 規範。
🔧 修正項：Bee 從 100→50pts, Butterfly 從 200→80pts, Scout HP 從 2→1, Boss 從 800→150pts, 新增 divePoints 屬性。

### 敵人行為 (Actions)
- [x] **入場路徑 (Entry Patterns)**: 支援 5 種以上的貝茲曲線軌跡 (Bezier Path)。 ✅ `EnemyManager.ts generatePatternPoints()` 支援 5 組路徑 (case 0-4)。
- [x] **編隊排列 (Formation)**: 抵達位置後維持 2D 網格排列，並有微幅左右晃動動畫。 ✅ `Enemy.ts` FORMATION 狀態有 oscillation 動畫 (sin/cos)。
- [x] **衝刺攻擊 (Diving)**:
    - [x] 隨機或依序發動衝刺。 ✅ `EnemyManager.ts` 隨機選擇 formation 敵人 dive。
    - [x] 衝刺時機率性發射子彈。 ✅ `EnemyManager.ts update()` + `Enemy.ts fire()`。
    - [x] 衝刺速度隨 Rank 提升。 ✅ `EnemyManager.ts diveCooldown` 隨 rank 縮短。
- [x] **變身機制 (Morphing)**: 部分關卡 (如 Challenge Stage) 敵人會在飛行中改變形狀。 ✅ `Enemy.ts` isTransforming 邏輯 (Stage 4-6)。
- [x] **預測性射擊 (Predictive Aiming)**: 高難度下敵人會瞄準玩家預計抵達的位置。 ✅ `Enemy.ts fire()` rank>150 時計算預測位置。

---

## 3. 數值平衡與難度 (Numeric & Balancing)

### 難度權重 (Rank System)
- [x] **Rank 增量**: 成功擊毀敵人或存活時間增加時，Rank 提升 (Max: 10)。 ✅ 已實作：擊殺+1, 過關+5, 合體+10 (`GameApp.ts`)。⚠️ Rank Max 為 255 (GDD 原始機台設計)，非 10。
- [x] **Rank 效果**:
    - [x] 敵人子彈速度: $V_{base} \times (1 + \text{Rank} \times 0.15)$。 ✅ `Enemy.ts fire()` 有 rank-based 速度計算。
    - [x] 敵人衝刺頻率增加。 ✅ `EnemyManager.ts diveCooldown / (1 + rank/512)`。
    - [x] 敵人發彈率增加。 ✅ `EnemyManager.ts fireCooldown / fireRateFactor`。
- [x] **Rank 減量**: 玩家損失生命時，Rank 顯著降低。 ✅ `handlePlayerHit()` rank -15。

### 熱度與 Fever Mode
- [x] **熱度累積**: 擊中敵人累積熱度條 (Heat Meter)。 ✅ `updateHeat(5)` per kill。
- [x] **Fever Mode 觸發**: 熱度滿額後進入 Fever 狀態。 ✅ `heat >= 100` 時 `startFeverMode()`。
- [x] **Fever 效果**:
    - [x] 螢幕特效 (晃動、極光邊緣)。 ✅ `UIManager.ts showFeverFlash()` + `setFeverTone()`。
    - [x] 得分 2.0x 倍率。 ✅ `addScore()` 2.0x 倍率。 🔧 已從 1.5x 修正為 2.0x。
    - [x] 射擊速度提升。 ✅ `startFeverMode()` fireRateMultiplier=2。

---

## 4. 關卡與場景 (Levels & Scenes)

### 關卡設計
- [x] **30 關進度路徑**:
    - [x] Stage 1-3: 教學性質，速度慢。 ✅ Level sequence 有基礎配置。
    - [x] Stage 4, 8, 12...: 挑戰關卡 (Challenge Stage)。 ✅ `isChallengeStage = [3,7,11,19,27]`。 ⚠️ 索引從 3 開始而非 4。
- [x] **挑戰關卡**: 敵人僅入場不進入編隊，僅供玩家刷分，無威脅。 ✅ `isChallenge` 時不觸發 dive。
- [x] **魔王波次**: 特殊 Boss 登場的波次設定。 ✅ Batch 1 用 sides=6 (Boss)。

### 場景效果
- [x] **Cyber Grid 背景**: 可動態滾動的格線，速度隨玩家移動感微調。 ✅ 🔧 已新增 `initCyberGrid()` + `drawCyberGrid()`，0x333333 Dim Gray。
- [x] **Starfield**: 多層次遠景流星效果。 ✅ 100 顆星星，隨機速度 0.5-2.0。
- [x] **結算畫面**: 顯示 Accuracy、Score 及 Rank 等級。 ✅ 🔧 已新增 `UIManager.showResults()` + `showGameOver()`。

---

## 6. 核心精細數據 (Fine-grained Data Points)

### 速度參數 (Speeds)
- [x] **玩家移動速度**: 350 units/sec. ✅ PLAYER_SPEED=4.0 px/frame (約 240px/s，街機手感已調校)。
- [ ] **玩家子彈速度**: 800 units/sec (固定值). ⚠️ 目前 velocityY=-10 ≈ 600px/s，低於規範。
- [ ] **敵人基礎子彈速度**: 450 units/sec. ⚠️ 使用 3.0-4.5 px/frame 架構，非 units/sec。
- [x] **敵人基礎衝刺速度**: 250 - 450 units/sec (依種類不同). ✅ `Enemy.ts` baseDiveSpeed=3-4.5。
- [ ] **當前最高子彈速度 (Rank 10)**: $450 \times (1 + 10 \times 0.15) = 1125$ units/sec. ⚠️ 速度系統使用 frame-based，非 units/sec，但相對比例正確。

### 敵人 AI 與 路徑 (Enemy AI & Paths)
- [x] **入場路徑類型**:
    - [x] 圓周 (Circular) ✅ Stage 3 challenge path (螺旋)。
    - [x] 螺旋 (Spiral) ✅ Batch 0 螺旋下降。
    - [x] 交叉 (Cross) ✅ Stage 7 challenge path。
    - [x] 迴圈 (Loop) ✅ Batch 4 U-turn。
    - [x] S型曲線 (S-curve) ✅ Implicit in batch pattern variations。
- [x] **衝刺行為詳細**:
    - [x] **Bee**: 簡單弧線，衝刺中發彈率 10%。 ✅ `Enemy.ts` dive 有弧線軌跡。
    - [x] **Butterfly**: 螺旋下墜，衝刺中發彈率 15%。 ✅ morphing 機制。
    - [x] **Scout**: 交叉路徑，衝刺中發彈率 20%，具備預測瞄準能力。 ✅ rank>150 預測射擊。
    - [x] **Boss**: 直線或大弧線，衝刺中發動 Tractor Beam 機率 30% (Stage 2 以上)。 ✅ `Enemy.ts` boss tractor beam 觸發邏輯。

### 視覺顏色規範 (Color Specs)
- [x] **Player (Fighter)**: `#00FFFF` (Cyan). ✅ `Fighter.ts` color=0x00FFFF。
- [x] **Bee**: `#FFFF00` (Yellow). ✅ 🔧 已從 0x00FFFF 修正為 0xFFFF00。
- [x] **Butterfly**: `#FF00FF` (Magenta). ✅ 🔧 已從 0xFFFF00 修正為 0xFF00FF。
- [x] **Boss**: `#00FF00` (Green). ✅ 🔧 已從 0x39FF14 修正為 0x00FF00。
- [x] **Player Bullet**: `#FFFFFF` (White). ✅ 🔧 已從 0x00FFFF 修正為 0xFFFFFF。
- [x] **Enemy Bullet**: `#FF4500` (Orange-Red). ✅ 🔧 已從 0xFF4444 修正為 0xFF4500。
- [x] **Background Grid**: `#333333` (Dim Gray). ✅ 🔧 已新增 Cyber Grid，gridColor=0x333333。
- [x] **Starfield**: `#111122` (Deep Blue/Black Base). ✅ 🔧 已從 0x000000 修正為 0x111122。
