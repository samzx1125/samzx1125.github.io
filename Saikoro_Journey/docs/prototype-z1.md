# Prototype Z1 — Build Brief

**Status:** RE-SCOPED 2026-10-14 (user)  
**Owner (plan):** SJ System planner  
**Owner (code):** SJ Dev  

## Current slice (LOCKED 2026-10-27)

**Map + train + static trade + unlock.**

| In | Out (defer) |
|----|-------------|
| HTML nodes + SVG rails + train move | Price drift / impact |
| Naming v2 ids (`loc_` / `goods_`), display = id | Courier, save, story |
| Static quotes + buy/sell at docked station | Condition / preserve |
| Unlock `loc_a01z01l003_star_ash` via oil×5 + dry_food×10 | Auto deploy Action |
| HUD: gold / cargo / loc | |

### IDs in use
- Locs: `loc_a01z01l001_broken_lamp`, `loc_a01z01l002_drywind_depot`, `loc_a01z01l003_star_ash` (1+2 start unlocked)
- Goods: `goods_a01z01i001_dry_food`, `goods_a01z01i002_oil_speciality`, `goods_a01z01i003_water_speciality`

### Acceptance (this slice)
1. Open static root → 3 nodes + edges; loc3 locked until unlock.
2. Train starts at `loc_a01z01l001_broken_lamp`.
3. Travel between unlocked neighbors; cannot double-travel.
4. Docked buy/sell with static prices; gold/cargo HUD.
5. Hand in oil×5 + dry_food×10 unlocks loc3.




### Item IDs include area (user 2026-10-14)
Goods are **not** traded across Areas. Prefix every item id with `area_<A>_`:
- `area_1_item_1_dry_food`
- `area_1_item_2_oil_speciality_1`
- `area_1_item_3_water_speciality_1`
Unlock costs / BASE_PRICES keys must use the same ids. Display may still equal id until i18n.

### Labels vs IDs (user 2026-10-14)
- Keep **code ids** (`area_1_…`, `item_1_…`) stable.
- **Display labels** may diverge later (i18n); do not assume label === id forever.
- Current UI showing raw ids is temporary.

### Prices (user 2026-10-14)
- Use **static** base prices only for now (no drift, no buy/sell impact).
- Variable / drifting prices = later pass.


### Naming v2 — goods compact ids (spec-only, user 2026-10-14)

**Code still uses** `area_1_item_*` until a later rename slice.

**Target pattern:** `goods_a<AA>z<ZZ>i<III>_<slug>`
- Example: `goods_a01z01i001_dry_pineapple`
- `a01` area, `z01` zone (`z00` = area-wide common if needed), `i001` sequence in that scope, `_slug` English kind
- Specialty: either distinct `i` + slug, or slug suffix `_speciality` (TBD at rename)
- Locations (suggested same style later): `loc_a01z01l001`
- Keep **id ≠ future i18n label**; ids stay stable machine keys

Planned Z1 mapping (when rename lands):
- `area_1_item_1_dry_food` → `goods_a01z01i001_dry_food` (or zone-common `z00` if we classify that way)
- `area_1_item_2_oil_speciality_1` → `goods_a01z01i002_oil_speciality`
- `area_1_item_3_water_speciality_1` → `goods_a01z01i003_water_speciality`


### Naming v2 — entity prefixes (spec-only, user 2026-10-14)

Compact typed ids; **code not renamed yet**. Pattern: `<type>_<scopeDigits>_<slug?>`

| Type | Prefix | Example | Notes |
|------|--------|---------|-------|
| Area | `area_` | `area_a01_evernight_desert` | `a01` + `_slug` |
| Zone | `zone_` | `zone_a01z01_edge_oasis` | area + zone + `_slug` |
| Location | `loc_` | `loc_a01z01l001_broken_lamp` | area + zone + loc seq + `_slug` |
| Goods (trade) | `goods_` | `goods_a01z01i001_dry_pineapple` | area + zone + item seq + slug |
| Item (consumable) | `item_` | `item_a01i001_repair_kit` | consumables; scope TBD (area or global `a00`) |
| Key item | `key_` | `key_a01k001_star_map_lead` | quest / unlock leads |
| Material | `mat_` | `mat_a01m001_scrap_ingot` | common materials from quests |
| Follower / courier | `follower_` | `follower_a01f001_zone1_apprentice` | independent units |

Rules:
- Digits zero-padded (`a01`, `z01`, `l001`, `i001`…).
- Trailing `_slug` English, stable; display labels / i18n separate later.
- Goods stay area-scoped (no cross-area trade); other types follow table scope.
- Current runtime still uses `area_1_zone_1_location_*` / `area_1_item_*` until rename slice.

### Next (planner queue)
1. User confirm specialty naming (oil/water kind words)
2. Trade UI + prices
3. Unlock gating
4. Courier / save / opening

---

## Appendix — earlier full Z1 economy brief

# Prototype Z1 — Build Brief (locked for SJ Dev)

**Status:** LOCKED for first code slice  
**Owner (plan):** SJ System planner  
**Owner (code):** SJ Dev  
**Out of scope this slice:** courier、開場鏡子／選角、威望、CoC 事件、倉庫、跨 Zone、存檔（可預留 hook，不實作）

---

## Goal

可玩的 **Zone1 only**：3 站節點圖上移動、買賣、價格慢飄、交特產解鎖下一站。

---

## Map (placeholders)

Area1 / Zone1 — 永夜沙漠邊緣（假名可換）

| ID | Name (placeholder) | Links |
|----|--------------------|-------|
| `z1a` | 破燈綠洲 Oasis Lamp | ↔ z1b |
| `z1b` | 乾風貨棧 Drywind Depot | ↔ z1a, z1c |
| `z1c` | 星灰站 Star-Ash Halt | ↔ z1b（初始鎖） |

- UI：HTML 節點＋SVG 連線；本體標記在當前站／移動中邊上。
- 起始：在 `z1a`，已解鎖 `z1a`+`z1b`；`z1c` 鎖到特產門檻完成。

---

## Goods (placeholders)

| ID | Name | Role | Tags |
|----|------|------|------|
| `water` | 水 Water | specialty pillar | liquid |
| `oil` | 油 Oil | specialty pillar | volatile |
| `dry_ration` | 乾糧 Dry ration | zone common | — |

**Availability (soft):**

| Loc | Buy focus | Notes |
|-----|-----------|-------|
| z1a | dry_ration 高產、water 貴 | 教學站 |
| z1b | oil 高產、water 中 | 差價站 |
| z1c | water 相對便宜（解鎖後） | 套利閉環 |

每站顯示該站有報價的貨即可（未上市可隱藏或灰掉）。

---

## Economy (prototype numbers — tunable)

| Param | v0 |
|-------|-----|
| Start gold | `200` |
| Capacity | `20` slots（1 good = 1 slot） |
| Travel time z1a↔z1b / z1b↔z1c | `8s` / `10s`（可調） |
| Price drift | 每 ~5s 對每 (loc,good) ±0～2% 隨機慢飄 |
| Buy impact | 同站同貨 **10s 窗內累計買 >100** → 推價（上限偏離基價 +25%） |
| Sell impact | 同窗累計賣 **>150** → 弱壓價（上限 −15%） |
| Condition | v0 **可先關掉**（全部 100% MP）；下一輪再接 liquid/volatile |

**Base prices (placeholder MP):**

| Good | z1a | z1b | z1c |
|------|-----|-----|-----|
| dry_ration | 8 | 12 | 14 |
| oil | 40 | 22 | 35 |
| water | 55 | 45 | 28 |

買賣：點站 → 報價表 → 買／賣數量（受 gold／capacity／庫存限制）。

---

## Unlock

解鎖 `z1c`：在**任意已解鎖站**交出：

- `oil` × **5**
- `dry_ration` × **10**

交貨後節點亮起、邊可走。UI：簡單「Unlock」面板即可。

---

## Train (minimal)

| Track | v0 |
|-------|-----|
| Speed | 固定（用上面 travel time；升級 UI 不做） |
| Capacity | 固定 20 |
| Preserve | 不做 |

移動：點相鄰已解鎖站 → 進入 travel → 到站可交易。旅行中不可買賣。

---

## Tech slice

對齊 `tech.md`：

```
index.html
css/
js/main.js, state.js, engine.js, view.js, events.js,
   map-data.js, economy-data.js
```

- engine：tick（移動進度、價格飄、衝擊衰减）
- view：地圖＋HUD（gold／cargo／當前站）＋報價
- **不做** `saving.js` 本輪（註解 TODO 即可）
- 零 build；靜態檔；路徑相對

**Code location：** `/workspace/SaikoroJourney/`（與 docs 同 repo 根）

---

## Acceptance

1. 開 `index.html`（或極簡 local server）看到 3 節點，z1c 鎖。
2. 可在 z1a↔z1b 移動並買賣三種貨。
3. 價格會慢飄；大量買會推價（可 console／UI 觀察）。
4. 湊齊油×5＋乾糧×10 可解鎖 z1c，並跑出水價差套利。
5. 無 courier／無存檔／無劇情殼。

---

## Next slices (planner queue — not this PR)

1. Condition／preserve／quest 保底  
2. Zone1 courier  
3. localStorage save  
4. 開場選名＋鏡子殼  
5. Z2+ 骨架


---

## Naming convention (user-locked 2026-10-14)

All placeholder IDs must be **obvious machine names**. Display labels = same as ID for now (no fancy 中文站名).

### Locations / map
- `area_<A>_zone_<Z>_location_<L>` — 1-indexed
- Z1 three stops:
  - `area_1_zone_1_location_1` (start, unlocked)
  - `area_1_zone_1_location_2` (unlocked)
  - `area_1_zone_1_location_3` (locked until unlock costs)

### Goods / items
- `item_<N>_<kind>` for zone commons
- `item_<N>_<kind>_speciality_<S>` for specialties
- Z1 v0 mapping (pending user confirm on oil/water form):
  - `area_1_item_1_dry_food` — zone common
  - `area_1_item_2_oil_speciality_1` — oil specialty
  - `area_1_item_3_water_speciality_1` — water specialty

### Unlock costs (IDs)
- `area_1_item_2_oil_speciality_1` × 5
- `area_1_item_1_dry_food` × 10
- target: `area_1_zone_1_location_3`
