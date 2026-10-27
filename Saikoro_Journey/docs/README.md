# SaikoroJourney — Project Docs Index

**Language:** 中文 / English / 日本語（日文偏用來解釋概念與術語）  
**Status:** Design docs + **Z1 prototype brief locked** (`prototype-z1.md`); code by SJ Dev.  
**Reference infra:** [Hot Springs Idle](https://stopsign.github.io/Hot_Springs_Idle/)（vanilla JS、github.io、engine / view 分離）

---

## 這是什麼 / What / 何か

玩家扮演 **Saikoro（骰子）**，在廢土世界經營火車：跑線貿易賺金、擴建列車、後期用 **信使（courier / 使い）** 自動化，並以 **特產** 解鎖新地點。開場可選名字與外觀，之後揭示「身體被神換走」——最終以 **威望（prestige）** 重開。

Tone: **cozy in a wasteland**，風味文字帶幽默；幾乎無對話，主要靠 description / flavour text。

---

## 文件地圖 / Doc map

| File | 內容 |
|------|------|
| [README.md](./README.md) | 本索引、範圍、技術方向 |
| [systems.md](./systems.md) | 地圖階層、火車、信使、可視化、安全網 |
| [economy.md](./economy.md) | 核心循環、各地市價、特產、運送委託、雙貨幣 |
| [story.md](./story.md) | 開場鏡子、結局換身揭示、威望獎勵 |
| [map-area1.md](./map-area1.md) | Area1 永夜沙漠風味＋乾糧／油／水（站名 TBD） |
| [tech.md](./tech.md) | github.io 託管、vanilla JS、engine／view 切分 |
| [prototype-z1.md](./prototype-z1.md) | **LOCKED** 第一刀：Z1 原型規格（給 SJ Dev） |

---

## 已拍板決策（摘要）

1. **核心玩法：** 親自跑線為主；Zone1 支線 → Zone1-only 信使；**約 Zone3 支線 → universal courier（all Areas）**；其間靠本體。
2. **價格：** 各地 × 各商品有不同 market price，並隨時間波動；差價是利潤來源。
3. **特產：** 僅該地可買／產量極高；用於解鎖新地點。
4. **地圖：** 不定總站數；規則為 **分區 + 特產解鎖**。結構：**1 zone = 3 locations**，**1 area = 4 zones**；Area property 含 **氣候／地形、路線門檻、經濟修正**；地圖 UI 為 **2D 節點圖**。
5. **火車擴建：** 主卡 **容量** 與 **速度／成本**；部分區域卡路線；信使席位在第一區後解鎖。
6. **信使：** 獨立單位（不佔本體貨廂）；玩家指定買賣清單 + 設定路線，由他們執行。
7. **失敗：** 幾乎不會死，最差變慢。
8. **運送委託（quest）：** A→B 運貨，純賺但利潤很低。
10. **商品：** 每站 1–2 特產；每 Zone 1–2 共通品。
11. **價格：** 慢飄；短時間買 >100 推價；賣壓較弱且門檻更高。
12. **解鎖：** 交固定數量特產；quest 僅本體；gold + 任務共通材料（擴建／特殊車廂／支線通路）。
13. **可視化：** map／train／player／courier；地圖 **2D 節點圖**，實作 **HTML 節點＋SVG 連線**。

---

## 技術方向（暫定，對齊參考）

- Host: **GitHub Pages** (`*.github.io`)
- Stack 參考：vanilla **JavaScript**（無 React/Vue/TS 亦可作為第一版約束）、`engine`（tick／數值）與 `view`（DOM）分離、local save
- 細節待 `tech.md`；**目前禁止寫遊戲程式**，只維護 docs

---

## Next docs

核心文件已齊（README／systems／economy／tech／story）；之後可補 map-data 或文案表。
