# Galaga 技術規格書：05_美術與音效規格 (Art & Audio Specs)

## 1. 視覺資產規範 (Visual Assets - Neon Polygon Style)

### 1.1 幾何形狀規格 (Geometric Shape Specs)
*   **渲染方式**: 使用 Canvas 2D / WebGL 向量繪製，而非點陣精靈圖。
*   **單位構成**: 
    - 基礎敵機與玩家均由**正多邊形 (Regular Polygons)** 組成。
    - 邊數 (Sides): 從三角形 (3) 到 十一邊形 (11) 隨等級提升。
*   **視覺特徵**:
    - **霓虹發光 (Neon Glow)**: 使用 `shadowBlur` (28-40px) 產生發光效果。
    - **雙層線條**: 外層為主要顏色導向的發光線條（粗度 6px），內層為淡色輔助線（粗度 3px，半徑約 55%）。
    - **中心數字**: 幾何圖形中心需顯示數值，使用 `Orbitron` 字體。

### 1.2 霓虹色盤規範 (Neon Color Palette)
遊戲使用高飽和度的霓虹色系：
| 等級/類型 | 形狀 | 主要顏色 (HEX) | 視覺效果 |
| :--- | :--- | :--- | :--- |
| LV 1 | 三角形 | `#00FFFF` (Cyan) | 核心霓虹 |
| LV 2 | 正方形 | `#FFFF00` (Yellow) | 亮黃警告 |
| LV 3 | 五邊形 | `#FF6B6B` (Coral) | 珊瑚紅 |
| LV 4 | 六邊形 | `#39FF14` (Lime) | 螢光綠 |
| 特殊 (Fever) | - | `#FF00FF` (Magenta) | 狂熱模式發光 |

### 1.3 標準字體 (Typography)
*   **標題與數字**: `Orbitron` (權重 900/700/400) - 幾何感強的現代科技字體。
*   **輔助 UI**: `Rajdhani` - 窄體技術感，適合 HUD 資訊顯示。

---

## 2. 音效與音樂邏輯 (Audio & SFX Map)

### 2.1 音訊風格
*   **風格定義**: 基於合成器 (Synthesizer) 的電子音效，強調「數位化」與「共振感」。
*   **關鍵通道分布**:
    - **BGM**: 帶有低音節奏感的 Synth-wave 風格。
    - **SFX (Merge/Fire)**: 頻率掃描 (Frequency Sweep) 的電子振盪聲音。

### 2.2 關鍵音效描述
- **Fire/Drop**: 指數衰減的高頻脈衝波。
- **Merge (進階)**: 多個交疊正弦波 (Chords)，頻率隨形狀邊數增加而提高。
- **Bomb/Explosion**: 帶有重低音感的低通濾波噪音 (Low-pass Filtered Noise)，伴隨螢幕震動。

---

## 3. 環境渲染：賽博網格 (Cyber Grid Environment)
取代傳統星空，使用動態 3D 透視網格：
*   **背景底色**: 深色漸層 (Dark Blue/Purple) `#0d0d1a` -> `#0a0a0f`。
*   **地表網格 (Floor Grid)**: 
    - **顏色**: 青色 `#00ffff` (透明度 0.2 - 0.7)。
    - **效果**: 具備 3D 透視感的動態滾動線條，營造空間深度。
*   **動態粒子**: 合體或爆炸時產生的「形狀碎屑 (Shards)」與「發光環 (Rings)」。
    - **碎屑 (Shards)**: 
        - 數量: 8-12 / 爆炸。
        - 生命週期: 45 幀 (0.75s) 漸隱。
        - 物理: 隨 Matter.js 衝力擴散。
    - **發光環 (Rings)**: 
        - 初始半徑: 4px，擴張至 48px。
        - 邊框漸細: 4px -> 0px。

### 3.1 玩家死亡動畫 (Player Destruction)
當玩家 HP 歸零時，觸發以下序列：
1.  **機體解體**: 原本的多邊形拆解為三個獨立的三角形，依旋轉路徑向外噴射。
2.  **核心閃光**: 中心點產生一個持續 0.2s 的高亮度白色圓形閃光。
3.  **大範圍碎片**: 噴射出比敵機更多的碎屑 (20-30 片)，且顏色隨機在 Cyan/White 之間切換。

### 3.2 子彈特效 (Bullet Animation)
*   **出彈閃爍 (Muzzle Flash)**: 槍口位置產生極短的 (1-2 幀) 菱形擴張效果。
*   **擊中火花 (Impact Sparks)**: 子彈接觸敵機時，產生 3-5 個細小的向後噴射粒子（顏色與敵機一致），代表動能衝擊。
*   **穿透效果 (Piercing - Fever Mode)**: 子彈呈現更長的三角形，且具備半透明的動態外殼，擊中敵機時不消失而是產生波紋漣漪。

---

## 4. HUD 佈局佈置 (HUD Layout & UI Elements)
渲染解析度基準為 **960×720**，所有 UI 置於 `uiLayer`:

| UI 元素 | 座標 (X, Y) | 對齊方式 | 內容 / 備註 |
| :--- | :--- | :--- | :--- |
| **P1 Score** | (16, 8) | Top-Left | `000000` (Orbitron) |
| **High Score** | (144, 8) | Top-Center | 歷史最高紀錄 |
| **Heat Gauge** | (16, 208) | Bottom-Left | 水平進度條 (Cyan/Magenta) |
| **Lives Icon** | (240, 208) | Bottom-Right | 正多邊形戰機圖標 (縮小版) |
| **Stage Icon** | (272, 208) | Bottom-Right | 挑戰標籤或關卡條紋 |

---

---
> 🎨 **Artist Note**: 所有的幾何體在移動與旋轉時應保持其向量發光邊緣的清晰度。Fever 模式下，所有的發光顏色需動態切換至 Magenta/Cyan 交替。
