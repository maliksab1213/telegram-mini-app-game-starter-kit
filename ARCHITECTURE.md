# ARCHITECTURE.md — Machine-Readable Reference

Purpose: this file is written so an AI assistant (or a developer skimming fast) can answer "where does X happen" and "what does function Y do" without reading every file. Organized by layer, then by file, with signatures and one-line behavior notes.

---

## Layer Map

```
Telegram Client
   │
   ▼
telegram-bot.js  (bot commands, HMAC token issuance)
   │  generates gameUrl with ?uid=&token=
   ▼
public/*.html + *.js  (frontend, runs inside Telegram WebView)
   │  fetch('/api/...')
   ▼
index.js  (HTTP server — not shown in handoff, but routes/* register onto it)
   │  dispatches by pathname to routes/*.routes.js
   ▼
routes/*.routes.js  (auth check via apis.checkUserAccess, parse body, call API layer)
   │
   ▼
apis.js / level_apis.js / task_apis.js / trading_handler.js / etc. (business logic layer)
   │
   ▼
database.js  (aggregator) → database/*.js (SQLite access via better-sqlite3)
```

Two background-running systems exist outside the request/response cycle:
- **`casino_modules/*.js`** — self-scheduling `EventEmitter` classes, instantiated once, referenced via `global.<name>Game`
- **`trading_engine.js`** — `setInterval`-based price updater, also a singleton
- **`task_manager.js`** — hourly cron-like check that rotates task IDs at midnight

---

## Auth Primitive (used everywhere)

```js
// apis.js
checkUserAccess(telegramId, token, botHandler) → boolean
  - looks up user via getUserByTelegramId(telegramId)
  - delegates to botHandler.checkToken(telegramId, token)

// telegram-bot.js (TelegramBotHandler class)
createToken(userId) → string
  - HMAC-SHA256(config.server.secret_key, String(userId)), hex digest
checkToken(uid, token) → boolean
  - re-derives createToken(uid), compares to given token
```

Every route file starts with:
```js
if (!uid || !token || !await checkUserAccess(uid, token, botHandler)) {
    res.writeHead(403, ...); return res.end(JSON.stringify({error:"Access denied"}));
}
```
This is the ONLY authorization mechanism. There is no session/cookie system, no rate limiting visible in the provided files, and no per-route permission levels (all authenticated users have equal access to all endpoints).

---

## Database Layer (`database/*.js`)

Each file exports a class instantiated once by `database.js` (aggregator, not shown but inferable — pattern is `this.users = new UsersDB(db); this.coins = new CoinsDB(db); ...` then re-exported flat, e.g. `db.getUser()`, `db.addCoins()`, plus namespaced access `db.games.getSession()`, `db.casino.saveBet()`).

| File | Class | Key methods | Notes |
|---|---|---|---|
| `users.js` | `UsersDB` | `getUser`, `getUserByUniqueCode`, `createUser`, `updateUserName` | Base user table: `telegram_id`, `unique_code`, `name`, `referred_by`, `new_user` flag |
| `coins.js` | `CoinsDB` | `getCoins`, `setCoins`, `addCoins`, `getLeaderboard` | Primary currency. `getLeaderboard` joins `users`+`user_coins`, sorted by coins DESC |
| `inventory.js` | `InventoryDB` | `getInventory`, `updateInventory`, `createStarterInventoryWithEnergyDrink` | Inventory = JSON blob (`slots` array) stored in one row, parsed/stringified on read/write. New users get pen+book+ink+1 energy drink |
| `selected.js` | `SelectedDB` | `getSelected`, `updateSelected` | Tracks which pen/book/ink slot is "equipped" for writing, plus progress counters (`book_words`, `ink_remaining`) |
| `wallet.js` | `WalletDB` | `getWallet`, `activateWallet`, `deposit`, `withdraw`, `upgrade` | Bank/online wallet. 5 levels, capacity 10k→250k. Activation costs 100 coins (enforced in `phone_api.js`, not here) |
| `writestory.js` | `WriteStoryDB` | `performWrite(telegramId, wordsToWrite)` | THE core game loop. Wrapped in `db.transaction()`. Computes writable words = min(requested, book space left, ink left), adds coins 1:1 with words written, auto-unequips book when full / ink when empty |
| `level.js` | `LevelDB` | `getOrCreate`, `setLevel`, `addTaskCompleted`, `addCoinsEarned` | Simple level counter + lifetime stats, config-driven thresholds live in `control/levels.json` |
| `task.js` | `TaskDB` | `getUserTask`, `createUserTask`, `updateTaskProgress`, `claimTask`, `startSocialTimer`, `getSocialTimer` | Daily task completion state. Separate `task_social_timers` table for social-task cooldowns (server does NOT enforce social timer expiry itself — see `task_apis.js` note below) |
| `rewards.js` | `RewardsDB` | `getDailyReward`, `collectDailyReward`, `resetExpiredDailyRewards` | 7-day streak reward. ⚠️ `collectDailyReward` builds SQL with template-literal interpolation of `telegramId` directly into `db.exec()` — **not parameterized, should be fixed before production** even though `telegramId` currently only comes from validated internal calls |
| `spins.js` | `SpinsDB` | `getDailySpin`, `collectFreeSpinTicket`, `performSpin` | Daily spin wheel. Free ticket grants +3 tickets once/day |
| `friends.js` | `FriendsDB` | `addFriend`, `getFriends`, `getFriendCount`, `getReferrals` | Referral system, populated on registration if `?ref=` param present |
| `transactions.js` | `TransactionsDB` | `createTransaction`, `getTransactions`, `cleanupOldTransactions` | Shop purchase history, auto-trims to last 20 per user |
| `travelsystem.js` | `TravelSystemDB` | `getTravelInfo`, `setTravelEnergy`, `addTravelEnergy`, `deductEnergyForTravel`, `setVehicleMap` | Energy 0–100%, gates map travel. `deductEnergyForTravel` is the atomic spend-guard (checks-then-deducts with a WHERE clause safety net) |
| `tournament.js` | `TournamentDB` | `saveTournamentSelection`, `updateTournamentUserResult`, `saveTournamentTicket`, `getUserTicket` | Player's pick per round + win/lose result. Ticket system gates entry (1 ticket/day implied) |
| `tournament_rewards.js` | `TournamentRewardsDB` | `getUserTournamentRewards`, `updateRoundRewardStatus`, `collectRoundReward` | Tracks reward-claim status per round (`round1_status`...`round3_status`, `roundN_collected` flags) |

---

## Business Logic Layer (root-level `*_api*.js` / `*_handler.js`)

| File | Purpose | Key exports |
|---|---|---|
| `apis.js` | Central API + 5-second TTL in-memory cache (`SmartCache` class) wrapping most DB reads | `getUserByTelegramId`, `saveUser`, `updateUserName`, `getUserCoins`, `updateUserCoins`, `addCoinsToUser`, `getUserInventory`, `addToInventory`, `removeFromInventory`, `getSelectedItems`, `updateSelectedItems`, `performWrite`, `getStore`, `purchaseItem`, `getLeaderboard`, `checkUserAccess`, `getUserPublicData` |
| `level_apis.js` | Reads `control/levels.json`, computes progress %, gates level-up on tasks+coins thresholds | `getUserLevelInfo(telegramId)`, `levelUpUser(telegramId)`, `addTaskCompleted`, `addCoinsEarned` (stub, no-op — real coin tracking is via `user_coins` table directly) |
| `task_apis.js` | Reads `control/tasks.json`. Distinguishes **live-tracked** tasks (game/casino — progress read directly from play tables) vs **social** tasks (client-driven timer, server just stores completed flag) | `getUserTasks`, `markSocialCompleted`, `claimTaskReward`, `startSocialTask` |
| `reward_spin_apis.js` | Daily reward schedule (`[100,150,200,250,300,350,500]` coins for days 1–7) + spin reward pool (`[100,200,400,700]`) | `getDailyRewardData`, `collectDailyReward`, `getDailySpinData`, `collectFreeSpinTicket`, `performSpin` |
| `leaderboard_api.js` | Top-20 + individual rank via SQL rank-counting subquery | `getTopLeaderboard(limit)`, `getUserRankInfo(telegramId)` |
| `tournament_api.js` | Reads `control/tournament.json` (today's active tournament + schedule times), maps map-locations → tournament types (`stadium`→horseRace, `boxing`→boxing, `carrace`→carRace) | `getTournamentByLocation`, `getRoundStatus`, `getCurrentDate/Time` |
| `phone_api.js` | Wraps `WalletDB`, adds the 100-coin activation cost and 1% deposit/withdraw fee logic | `getWalletData`, `activateWallet`, `depositToWallet`, `withdrawFromWallet`, `upgradeWallet` |
| `trading_handler.js` | Wraps a *second* wallet (trading wallet, separate from bank wallet) with 1% fee on deposit/withdraw, buy/sell logic against `control/trading.json` asset prices | `getTradingWallet`, `depositToTradingWallet`, `withdrawFromTradingWallet`, `buyAsset`, `sellPosition`, `getUserPositions` |
| `trading_engine.js` | Background price simulator. On boot, seeds 8 fake assets with random walk history; every 5 min checks if any asset is due for a price update (each asset has its own random 5–60 min interval) | `start()`, `updateAssetPrice(asset)` — delegates next-move % to **`chart_engine.js` (NOT INCLUDED in handoff)** |
| `map_api.js` | Static registry of map locations (only "bank" defined in this version — `mapsystem.routes.js` has a newer/larger registry with 6 locations, treat that as canonical) | `getAvailableLocations`, `validateLocationAccess`, `createLocationToken`, `getLocationUrl` |
| `games_api.js` | Reads/writes `control/games.json` (per-game on/off toggle), returns the 9-game catalog with icons | `getAvailableGames`, `isGameAvailable`, `toggleGame` |
| `casino_api.js` | Same pattern as `games_api.js` but for the 4 casino games (`control/casino.json`) | `getAvailableGames`, `isGameAvailable`, `toggleGame` |
| `task_manager.js` | Singleton, started once. Every hour checks if the date rolled over; if so, appends today's date suffix to every task ID (so task completion resets daily without deleting history) and triggers `TaskDB.cleanupOldData()` | `start()`, `checkAndUpdate()`, `rotateTasks()`, `manualUpdate(date)` (admin) |

---

## Route Layer (`routes/*.routes.js`)

All follow the same shape: `async function handleXRoutes(req, res, parsed, botHandler) → boolean`. Returns `true` if the route matched and was handled, `false` to let the dispatcher try the next handler (this is how `index.js`, not included, presumably chains them: `for (const handler of handlers) if (await handler(...)) return;`).

| Route file | Mounts | Endpoints (method + path) |
|---|---|---|
| `user.routes.js` | `/api/user*` | GET `/api/user`, POST `/api/user/name` |
| `coins.routes.js` | `/api/user/coins`, `/api/user/write` | GET coins, POST write (tap-to-earn) |
| `inventory.routes.js` | `/api/inventory`, `/api/user/selected` | GET/POST inventory, GET/POST selected items |
| `store.routes.js` | `/api/store`, `/api/purchase/wallet` | GET store catalog, POST purchase (wallet-funded only) |
| `phone.routes.js` | `/api/wallet*` | GET wallet, POST activate/deposit/withdraw/upgrade |
| `transactions.routes.js` | `/api/transactions` | GET purchase history |
| `trading.routes.js` | `/api/trading/*` | config, wallet, deposit, withdraw, buy, sell, positions, transactions |
| `casino.routes.js` | `/api/casino/games`, `/api/casino/overview` | catalog + stats (per-game bet routes are separate files, see below) |
| `games.routes.js` | `/api/games/list`, `/api/games/overview` | mini-game catalog + stats |
| `tasks.routes.js` | `/api/tasks*` | GET list, POST claim, POST social/start, POST social/complete |
| `level.routes.js` | `/api/level*` | GET info, POST level/up |
| `leaderboard.routes.js` | `/api/leaderboard` | GET top20 + own rank — **⚠️ duplicate file exists**: a second, older `leaderboard.routes.js` (doc source "leaderboard.routes.js") returns a flat top-100 via `db.getLeaderboard(100)` instead of the top20+rank shape. **The newer one (`leaderboard_routes.js` using `leaderboard_api.js`) is canonical** — do not mount both. |
| `rewards.routes.js` | `/api/daily-reward*`, `/api/daily-spin*` | GET/POST reward collect, GET spin data, POST collect-ticket, POST perform spin |
| `new.routes.js` | `/api/new/*`, `/api/friends` | GET check, POST register, GET friends list |
| `mapsystem.routes.js` | `/api/mapsystem/*` | GET locations, POST calculate-cost, POST execute-travel (supports energy OR flat 450-coin cash travel) |
| `travelsystem.routes.js` | `/api/travelsystem/*` | GET info, POST use-drink, POST select-vehicle |

### Per-game routes (mini-games, all identical shape)
Mounted at `/api/games/<id>/*`. Files: `rockpaper.routes.js`, `coinflip.routes.js`, `headtails.routes.js`, `glassball.routes.js`, `football.routes.js`, `holemole.routes.js`, `memorygame.routes.js`, `sequencematch.routes.js`, `shootout.routes.js`.
Common endpoints: `can-play` (GET), `start` (POST), `session` (GET), a play-action endpoint (varies: `play`/`toss`/`guess`/`hit`/`flip`/`generate`+`validate`), `stats` (GET). All read the live instance via `global.gamesManager.getGame('<id>')`.

### Per-game routes (casino, all identical shape)
Mounted at `/api/casino/<id>/*`. Files: `tigervsdragon.routes.js`, `roulette.routes.js`, `blackvsred.routes.js`, `bankervs.routes.js`.
Common endpoints: `round` (GET — current round state + user's bets), `bet` (POST — place bet, validates against fixed chip list `[10,20,100,200,500,1000,2000,5000]`), `stats` (GET). Reads live instance via `global.<name>Game`.
**⚠️ Bug found:** `blackvsred.routes.js`'s file content is an exact duplicate of `roulette.routes.js` (wrong game instance/paths — uses `global.rouletteGame` and `/api/casino/roulette/*` paths instead of blackvsred). **Needs rewriting to match the `bankervs.routes.js` pattern before use.**

---

## Mini-Game Engines (`games_modules/*.js`)

All share: `MAX_MATCHES = 3`, `COOLDOWN_HOURS = 1`, cooldown tracked via `db.games.getCooldown/setCooldown/resetCooldown/incrementPlays` (this table isn't in the provided `database/*.js` files — implied to live in a `games.js` DB module not included in this handoff, referenced as `db.games.*` throughout).

| Game | File | Mechanic | Win condition |
|---|---|---|---|
| Rock Paper Scissors | `rockpaper.js` | Best of up to 5 rounds (ties don't count) | First to 2 round-wins |
| Coin Flip | `coinflip.js` | Single flip, no session (one-shot) | Choice matches flip result |
| Head & Tails | `headtails.js` | (Routes reference toss/choose/play — cricket-style mini game, full logic file not included in this handoff, only its routes) | — |
| Glass Ball | `glassball.js` | Guess ball position (0/1/2), one-shot | Guess === hidden position |
| Football | `football.js` | Best of up to 5 games (draws don't count) | First to 2 game-wins |
| Hole Mole | `holemole.js` | Timed whack-a-mole, 30s, difficulty sets target score (15/20/25) | Score ≥ target before time runs out |
| Memory Game | `memorygame.js` | Card-pair matching, timed (30–60s depending on difficulty), 8 pairs | All 8 pairs matched before time runs out |
| Sequence Match | `sequencematch.js` | Simon-says color sequence, 5 levels, speed increases with difficulty | Complete all 5 levels without a wrong input |
| Shootout | `shootout.js` | Best of up to... (checkGameOver triggers at first to 2, no round cap) | First to 2 goals OR opponent 2 saves |

---

## Casino Engines (`casino_modules/*.js`)

All share identical timing: round starts on the minute, betting window 0–35s, results at 40s, next round at 60s. All use `EventEmitter` (`roundStart`, `bettingClosed`, `results` events) for the frontend to sync via polling/websocket (poll pattern implied — no websocket code was provided, frontend likely polls `/round` endpoint).

| Game | File | Card/number logic | Payouts |
|---|---|---|---|
| Tiger vs Dragon | `tigervsdragon.js` | 1 card each side, higher value wins (A=1...K=13) | Tiger/Dragon 2x, Tie 5x |
| Roulette | `roulette.js` | European+American hybrid wheel (0, 00, 1-36) | Straight 36x, red/black/odd/even/high/low 2x, dozens/columns 3x |
| Black vs Red | `blackvsred.js` | 3 cards each side, sum of values, suits split black(♠♣)/red(♥♦) | Black/Red 2x, Tie 8x, Golden (3-of-a-kind either side) 10x |
| Banker vs Player | `bankervs.js` | Simplified Baccarat (2-card deal, 3rd-card draw rule if ≤5, mod-10 scoring) | Banker 1.95x (5% commission), Player 2x, Tie 8x |

---

## Frontend Structure (`public/`)

### App shell
- `index.html` (not shown but implied) loads `app.js` (main `App` class — screen routing between loading/welcome/game-interface), `styles.css` (theme variables: `--accent-color: #ffd700` gold theme throughout)
- `new.html`/`new.js`/`new.css` — separate registration mini-page, redirects to `/game` on success

### Section controllers (`public/sections/*` inferred from class names)
Each is a self-contained class with `activate()`/`deactivate()` lifecycle, instantiated once by `app.js`, attached to `window.<name>Instance`:
- `HomeSection` (`home.js`) — coin display, level bar, launches Write Story / Daily Reward / Daily Spin modals
- `TasksSection` (`tasks.js`) — 3-tab task list with live client-side countdown timers for social tasks
- `ShoppingSection` (`shopping.js`) — wallet-funded store UI, 2% delivery fee shown at checkout
- `LeaderboardSection` (`leaderboard.js`) — podium (top 3) + list (4-20) + "your position" card if outside top 20
- `LevelInterface` (`level.js`) — modal, separate from HomeSection but synced via `updateHomeBar()`
- `DailyRewardInterface` (`daily_reward.js`) / `DailySpinInterface` (`spin.js`) — modals with congratulations popup pattern

### Phone sub-system (`phone.js` + apps)
`PhoneInterface` class renders a fake-phone UI overlay with an app grid. Two apps currently wired: `OnlineWalletApp` (`online_wallet.js`) and `TradingApp` (`tradingapp.js`, not shown in full but referenced). Apps are lazy-instantiated on first tap.

### Shared utilities
- `NotificationSystem` (`notification-system.js`) — toast notifications, dedupes by `type-title-message` key to prevent spam
- `ConfirmationModal` (`confirmation-modal.js`) — promise-based confirm dialogs with shorthand methods (`confirmPurchase`, `confirmSell`, etc.)
- `InventoryManager` — referenced everywhere (`window.InventoryManager`, `window.inventoryManagerInstance` — **two different global names used inconsistently across files**, worth normalizing) but full file not included in this handoff

### Location sub-apps (`public/locations/*`)
Each is a **fully separate HTML page** (own `<head>`, own script tags) that the Map system navigates to via `window.location.href` with `uid`/`token`/`loc_token` query params. Not single-page-app routes — real page loads.
- `bank/` — deposit/withdraw/upgrade wallet UI, styled as a retro "computer terminal"
- `casino/` — hosts all 4 casino games as sub-views within one page (`casinoscript.js` manages view switching, per-game client scripts self-register to `window.<name>Client`)
- `games/` — same pattern for the 9 mini-games (`gamesscript.js` + per-game client scripts), also loads Phaser.js from CDN (used by at least Glass Ball, possibly Football — canvas-based games)
- `stadium/`, `boxing/`, `carrace/` — near-identical 3-round tournament UIs (selection phase → live phase → results), differ mainly in theme (horses/boxers/cars) and colors

---

## Known Issues To Fix Before Production Use

1. **SQL injection risk** — `database/rewards.js` `collectDailyReward()` interpolates `telegramId` and a hardcoded (safe) column name directly into `db.exec()` instead of using a parameterized prepared statement. Low risk today (telegramId is always numeric from validated auth), but any buyer extending this pattern elsewhere could introduce a real vulnerability. **Fix: convert to `db.prepare(...).run(telegramId)`.**
2. **Duplicate/conflicting leaderboard route files** — two versions of `leaderboard.routes.js` exist with different response shapes. Only mount the one built on `leaderboard_api.js` (top20 + userInfo shape); the other (flat top-100 via `db.getLeaderboard(100)`) is stale.
3. **`blackvsred.routes.js` is a copy-paste bug** — its entire content is the Roulette route file (wrong global instance, wrong paths). Needs to be rewritten to mirror `bankervs.routes.js`'s structure but targeting `global.blackVsRedGame` and `/api/casino/blackvsred/*`.
4. **Missing `chart_engine.js`** — required by `trading_engine.js` (`chartEngine.calculateNextMove(...)`), not included in this handoff. Trading system will crash on boot without it unless recreated.
5. **Inconsistent global naming** — `window.InventoryManager` vs `window.inventoryManagerInstance` used in different files for what appears to be the same object. Needs auditing/normalizing.
6. **No rate limiting visible** anywhere in the route layer — casino/mini-game bet endpoints in particular should have server-side spam/flood protection before real-money-adjacent use.
7. **Secrets must never ship** — `botconfig.json`, `ngrokconfig.json`, and the SQLite `.db` file (if it contains real user data) must never be committed to the public repo. Add them to `.gitignore` and only commit `.example` templates instead.

---

## Quick Answers For Common Questions

- **"Where's the write/tap-to-earn logic?"** → `database/writestory.js` → `performWrite()`, called via `apis.js` → `performWrite()`, exposed at `POST /api/user/write` (`routes/coins.routes.js`).
- **"How does someone get money into the shop?"** → Coins → `POST /api/wallet/deposit` (bank, 1% fee) → wallet balance → `POST /api/purchase/wallet` (2% delivery fee added client-side, see `shopping.js`).
- **"How do casino games know whose turn/round it is?"** → They don't have turns — it's a shared, server-clock-driven round every 60 seconds. All players in that round share the same cards/result.
- **"Where do tournament winners get decided?"** → Not in the files provided — `tournament_api.js` manages schedule/status only; actual winner-selection logic likely lives in files not included (probably per-location `stadium.js`/`boxing.js`/`carrace.js` backend logic, separate from the frontend files of the same name that were shared).
- **"Is there a websocket?"** → No evidence of one in any provided file. All real-time-feeling updates (casino timers, task countdowns) are done via client-side `setInterval` + periodic `fetch()` polling.
