# Tech — Hosting / Stack / Module Split

**言語:** 中／英／日混寫。  
**Status:** Design only — **do not implement game code yet.**  
**Reference:** [Hot Springs Idle](https://stopsign.github.io/Hot_Springs_Idle/) · source under [StopSign/stopsign.github.io](https://github.com/StopSign/stopsign.github.io)（同作者其他 idle 專案亦採類似切分）

---

## 1. Goals（技術目標）

| Goal | Note |
|------|------|
| Host on **GitHub Pages** (`username.github.io/...`) | 靜態站即可 |
| 可長期掛機／重開瀏覽器續玩 | 需 **local save** |
| 單人、無後端 | 無帳號伺服器（v1） |
| 對齊參考專案的可維護切分 | engine ↔ view 分離 |

---

## 2. Recommended stack（v1 建議）

對齊參考專案精神（可再議，但文件先鎖方向）：

| 層 | 建議 | 刻意不做（v1） |
|----|------|----------------|
| Language | **Vanilla JavaScript**（ES modules 可） | React / Vue / Angular |
| Types | 可選 JSDoc；**不強制 TypeScript**（參考專案明確 NO TS） | 全面 TS 重寫 |
| UI | HTML + CSS；DOM 更新集中在 view 層 | 大型 UI framework |
| Build | 可先 **零 build**（直接靜態檔）；需要時再加 Vite | 一開始就上複雜打包 |
| Deploy | GitHub Pages | 自架 Node server |

> 若之後堅持 TS／小框架，另開 ADR；預設跟 Hot Springs Idle：**NO FRAMEWORKS**。

---

## 3. Architectural rules（架構規則）

從參考專案歸納、適用本遊戲：

1. **`engine`（或 tick loop）** — 只做資料／數值／模擬：移動進度、價格漂移、courier AI、解鎖檢查。**禁止**直接操作 DOM。
2. **`view`（viewUpdating / render）** — 只做 DOM／畫布更新：地圖節點、火車／courier 標記、報價表。**禁止**塞進複雜經濟公式。
3. **`events` / input** — 點擊、拖路線、確認買賣；改的是 game state，再讓 engine／view 反應。
4. **`data` / tables** — Location、商品、特產門檻、Area property 等靜態表與初始 state。
5. **`saving`** — 任何進度欄位新增都必須進存檔／讀檔。

```
input/events → mutate state → engine tick → view render
                     ↕
                   saving
```

---

## 4. Suggested repo layout（建議目錄，未實作）

```
SaikoroJourney/
  docs/                 # 本設計文件
  index.html            # 入口（未來）
  css/
  js/
    main.js             # boot
    state.js            # initial globals / state
    engine.js           # tick: move, prices, couriers
    view.js             # DOM / map render
    events.js           # UI handlers
    map-data.js         # areas/zones/locations edges
    economy-data.js     # goods, base prices, unlock costs
    saving.js
  assets/               # icons for train / courier / nodes
```

實際檔名可調；重點是 **engine ≠ view ≠ data ≠ save**。

---

## 5. Runtime features（執行期需求）

| Feature | Approach（概念） |
|---------|------------------|
| Game loop | `requestAnimationFrame` 或固定 interval tick；邏輯 dt 與繪製可分開 |
| Map UI | **2D 節點圖**：**HTML 節點**（站點／火車／courier 標記）＋ **SVG 連線**（rails）；對齊 Hot Springs Idle 的 DOM＋SVG 路層 |
| Prices | Engine 每 tick 慢飄；買賣事件觸發有限衝擊（見 economy.md） |
| Couriers | 獨立 state 機器：沿 route 移動、到站執行 buy/sell list |
| Persist | `localStorage`（或 file download backup）；版本號＋migration |
| Offline tab | 可選：用 timestamp 結算離線漂移（economy open Q） |

---

## 6. GitHub Pages（託管）

1. Repo 名可為 `SaikoroJourney` 或 `username.github.io` 子路徑。
2. 根目錄或 `/docs` 或 `gh-pages` branch 提供 `index.html`。
3. 路徑注意：相對路徑 asset，避免硬編碼 repo 名錯誤。
4. HTTPS、快取：改 `saving` schema 時 bump `SAVE_VERSION`。

---

## 7. Non-goals（v1 不做）

- 多人／即時伺服器權威
- 原生手機商店包（可之後 PWA）
- 完整英文／日文 i18n 管線（風味文字可先單語＋註記）
- 自動平衡 CI（可後加表驅動測試）

---

## 8. Alignment checklist vs reference

| Reference idea | SaikoroJourney |
|----------------|----------------|
| Vanilla JS | ✓ 預設 |
| engine vs view split | ✓ |
| Static github.io | ✓ |
| Heavy data files | ✓ map-data / economy-data |
| Saving discipline | ✓ |
| Idle comfort | 部分 idle（courier）；主軸仍是主動跑線 |

---

## 9. Open questions（tech）

1. ~~地圖繪製~~ → **已定：HTML 節點＋SVG 連線**（非 Canvas）
2. ES modules + 本地 `file://` 不便時，是否早期就用極簡 local server／Vite？
3. Save 要不要雲端（手動匯出 JSON）？
4. 是否允許之後 Electron／Steam（參考專案有）——僅預留，不實作。

---

## 10. Next after docs freeze

實作順序建議（仍須你說「可以寫 code」）：

1. 靜態殼：`index.html` + 空地圖節點  
2. State + 單站買賣  
3. 移動與價格漂移  
4. 特產解鎖  
5. Zone1 courier  
6. Universal courier  
7. Polish save / balance
