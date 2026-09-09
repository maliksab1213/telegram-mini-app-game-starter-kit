# StoryVibe — Telegram Mini App Game (Open Source)

> ⚠️ **This is an unfinished starter kit, not a complete or polished game.** Do not expect a ready-to-launch product. Several pieces are missing, some are half-built, and some working code has known bugs (see [§5.1 Incomplete / Broken Features](#51-incomplete--broken-features-read-this-first) below). This is meant as a foundation to learn from and build on top of — not something to deploy to real users as-is.

A full-stack Telegram Mini App (Web App) game backend + frontend. Players tap/write to earn coins, then spend those coins across a wallet, shop, casino, trading simulator, and tournament system. Built with **Node.js + better-sqlite3** on the backend and **vanilla JS + Bootstrap** on the frontend (no build step required for the frontend).

> **Status:** Released free and open source. Backend has been run in production before (idle RAM usage ~5MB) but this exact repo snapshot has NOT been re-tested end-to-end after assembly — some pieces referenced in code were not carried over into this release (see below). Some game UIs are functional but not fully visually polished. This project is no longer maintained by the original author — use, fork, and modify at your own discretion. See [LICENSE](./LICENSE) for terms.

---

## 1. What This Game Actually Is

Players open the game through a **Telegram bot** (`/start` or `/play`), which launches a **Telegram Web App (Mini App)** — a website that renders inside Telegram itself. From there:

1. **New players** register a display name (`/new` screen)
2. **Core loop:** tap/"write" using pens, notebooks, and ink from inventory to earn coins + words
3. Coins can be spent in the **Shop** (buy pens/books/ink/energy drinks/vehicles/bagpacks)
4. Coins can be moved into a **Bank Wallet** (visited via the in-game Map) for shopping-only spending
5. Players can gamble/play in the **Casino** (4 games) and **Mini Games Zone** (9 games)
6. Players can **trade** fake stocks in a simulated market
7. Players complete **Tasks** (social/game/casino) for rewards
8. Players climb a **Level** system, collect **Daily Rewards** (7-day streak) and **Daily Spins**
9. Players compete on a **Leaderboard** and enter randomized **Tournaments** (Boxing / Horse Racing / Car Racing) at 3 map locations
10. A **Travel/Energy system** gates movement between map locations (walking vs. vehicles)

---

## 2. Directory Structure

This is the intended structure once fully assembled (some paths are inferred from `require()` calls and route registrations found in the code — see `ARCHITECTURE.md` for exact file-by-file detail):

```
project-root/
├── index.js                      # Main HTTP server entrypoint, route dispatcher
├── telegram-bot.js               # Telegram bot (node-telegram-bot-api), /start /play handlers
├── database.js                   # Central DB manager — aggregates all *DB modules below
├── apis.js                       # Core API layer: users, coins, inventory, store, cache
├── botconfig.json                # (NOT INCLUDED — must be created) bot token, secret key, domain
├── ngrokconfig.json              # (NOT INCLUDED — must be created) tunnel config for domain switching
│
├── games_manager.js              # Instantiates all 9 mini-games
├── games_api.js                  # Mini-games availability/config (games.json)
├── casino_api.js                 # Casino games availability/config (casino.json)
│
├── level_apis.js                 # Level system business logic
├── task_apis.js                  # Daily tasks business logic
├── reward_spin_apis.js           # Daily reward + daily spin business logic
├── leaderboard_api.js            # Leaderboard queries
├── tournament_api.js             # Tournament schedule/state logic
├── phone_api.js                  # Online wallet (bank) business logic
├── trading_handler.js            # Trading wallet + buy/sell business logic
├── trading_engine.js             # Background price-update engine for trading assets
├── chart_engine.js               # (referenced, not shown) price movement calculator
├── map_api.js                    # Map location registry (bank, casino, stadium, etc.)
├── newdomain.js                  # ngrok tunnel switcher admin page (optional/dev tool)
│
├── database/                     # Per-feature DB modules (all required by database.js)
│   ├── users.js
│   ├── coins.js
│   ├── inventory.js
│   ├── selected.js
│   ├── wallet.js                 # online/bank wallet
│   ├── writestory.js             # write/tap transaction logic
│   ├── level.js
│   ├── task.js
│   ├── rewards.js                # daily rewards
│   ├── spins.js                  # daily spin
│   ├── friends.js                # referrals
│   ├── transactions.js           # shop purchase history
│   ├── travelsystem.js           # energy + vehicle selection
│   ├── tournament.js             # tournament bet selections
│   └── tournament_rewards.js     # tournament reward collection state
│
├── routes/                       # HTTP route handlers, one per feature (all mounted in index.js)
│   ├── user.routes.js
│   ├── coins.routes.js
│   ├── inventory.routes.js
│   ├── store.routes.js
│   ├── phone.routes.js           # wallet routes
│   ├── transactions.routes.js
│   ├── trading.routes.js
│   ├── casino.routes.js
│   ├── games.routes.js
│   ├── tasks.routes.js
│   ├── level.routes.js
│   ├── leaderboard.routes.js
│   ├── rewards.routes.js         # daily reward + spin
│   ├── new.routes.js             # new-user registration + friends
│   ├── mapsystem.routes.js
│   ├── travelsystem.routes.js
│   └── casino_games/ , games_modules/routes  # per-game route files (see below)
│
├── games_modules/                # 9 mini-game engines (server-side logic)
│   ├── rockpaper.js  coinflip.js  headtails.js  glassball.js
│   ├── football.js   holemole.js  memorygame.js sequencematch.js
│   └── shootout.js
│   # + matching *.routes.js for each (rockpaper.routes.js, etc.)
│
├── casino_modules/                # 4 casino games (server-side, round-based, background loop)
│   ├── tigervsdragon.js  roulette.js  blackvsred.js  bankervs.js
│   # + matching *.routes.js for each
│
├── control/                       # Runtime JSON config (auto-created on first run)
│   ├── tasks.json  force_tasks.json  levels.json  games.json  casino.json
│   ├── trading.json  tournament.json  store.json
│
└── public/                        # Frontend static files
    ├── index.html                 # Main game shell
    ├── app.js  styles.css         # Main app controller
    ├── new.html / new.js / new.css                # registration screen
    ├── sections/                  # home, tasks, shopping, leaderboard, settings
    │   ├── home.js/.css  tasks.js/.css  shopping.js/.css
    │   ├── leaderboard.js/.css  level.js/.css  settings.js/.css
    │   ├── writestory.js/.css   daily_reward.js/.css  spin.js/.css
    ├── inventory-manager.js / inventory.css
    ├── phone.js / phone.css                        # in-game phone UI (holds wallet + trading apps)
    ├── online_wallet.js/.css      # phone "app": bank wallet
    ├── tradingapp.js / trading.css # phone "app": trading simulator
    ├── notification-system.js/.css
    ├── confirmation-modal.js/.css
    └── locations/                 # separate mini sub-apps, each own index.html
        ├── bank/          (bank.html, bank.js, bank.css)
        ├── casino/        (index.html, casinoscript.js, + 4 game scripts/css)
        ├── games/          (index.html, gamesscript.js, + 9 game scripts/css)
        ├── stadium/        (index.html, stadium.js, stadium.css)   — horse racing tournament
        ├── boxing/         (index.html, boxing.js, boxing.css)     — boxing tournament
        └── carrace/        (index.html, carrace.js, carrace.css)   — car race tournament
```

**⚠️ Known gaps in the current package** (confirm with seller what's included):
- `chart_engine.js` is referenced by `trading_engine.js` but was not included in this handoff
- Some `hole-mole_assets/*.png` sprite images (character, hammer, ground) referenced by `holemole.css` are not included
- `botconfig.json` / `ngrokconfig.json` are config templates you must create yourself (see Setup)

---

## 3. Core Concepts

### Authentication model
There is no traditional login. Instead:
1. Telegram bot generates an **HMAC-SHA256 token** from the user's Telegram ID + a server secret key (`telegram-bot.js` → `createToken()`)
2. Every game URL carries `?uid=<telegramId>&token=<hmac>`
3. Every API route calls `checkUserAccess(uid, token, botHandler)` which re-derives the HMAC and compares — this is the entire auth system
4. Location pages (bank, casino, stadium, etc.) additionally use a **location token** (`map_api.js` → `createLocationToken()`) tied to a timestamp, for extra scoping

### Data storage
- **SQLite** via `better-sqlite3`, accessed through prepared statements in each `database/*.js` module
- **JSON config files** in `/control/` for anything an admin might want to hand-edit without touching code (tasks, store items, trading assets, tournament schedule, feature toggles)
- **In-memory Maps** for ephemeral game state that doesn't need persistence (casino round bets, some mini-game sessions)

### Currency model
- **Coins** — earned by writing/tapping, used to buy from shop indirectly (see below), used to bet in mini-games/casino
- **Wallet balance** — a *separate* balance inside the in-game "Bank." Coins must be manually deposited into the wallet; the **Shop only accepts wallet balance**, not raw coins. This is a deliberate friction/economy design (see `shopping.js`: "Payment from wallet only. Your coins will NOT change.")
- **Trading wallet** — a third, separate balance used only for the trading simulator, funded by transferring from the online wallet

### Game session pattern (mini games)
Every one of the 9 mini-games (`games_modules/*.js`) follows the same shape:
- `canPlay(telegramId)` — checks cooldown (max 3 plays per hour, then 1-hour lockout)
- `startGame(telegramId, [challenge])` — creates a session row, some games pick difficulty first
- Play/round-specific methods (`playRound`, `flipCard`, `makeGuess`, `recordHit`, etc.)
- Session state is persisted via `db.games.getSession/updateSession/deleteSession` so a page refresh doesn't lose progress
- On game end: stats updated, `incrementPlays()` called, cooldown set if limit reached

### Casino game pattern (different from mini-games)
The 4 casino games (`casino_modules/*.js`) are **continuous, round-based, timer-driven**, not player-initiated:
- Each game is a singleton `EventEmitter`-based class that runs a round every 60 seconds on a real clock (aligned to the minute)
- Betting window: first 35s of each round; results shown at 40s; new round starts at 60s
- Bets are stored in an in-memory `Map` keyed by `telegramId`, cleared each round
- These run as **global background processes** (`global.tigerVsDragonGame` etc.) started once at server boot — routes just read from the live instance

---

## 4. Setup Instructions

### Requirements
- Node.js 18+ (uses `better-sqlite3`, a native module — needs build tools on some systems: `python3`, `make`, and a C++ compiler. On Debian/Ubuntu: `sudo apt install python3 make g++`)
- A Telegram bot token (create via [@BotFather](https://t.me/BotFather))
- A public HTTPS URL for the Web App to be served from (ngrok for dev, real domain for production)

### Dependencies
This project only uses two third-party npm packages — everything else is Node's built-in modules (`http`, `fs`, `path`, `crypto`, `events`, `url`):

| Package | Purpose |
|---|---|
| [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3) | Synchronous SQLite driver — used by every file in `database/` |
| [`node-telegram-bot-api`](https://www.npmjs.com/package/node-telegram-bot-api) | Telegram Bot API client — used by `telegram-bot.js` |

A ready-to-use `package.json` is included in this repo. Install with:
```bash
npm install
```

### Steps
```json
{
  "bot": {
    "token": "YOUR_BOT_TOKEN_FROM_BOTFATHER",
    "button_text": "Play Now"
  },
  "server": {
    "domain": "https://your-public-domain.com",
    "secret_key": "GENERATE_A_LONG_RANDOM_STRING_HERE"
  },
  "commands": {
    "start": { "button_text": "🎮 Play StoryVibe" },
    "play": { "button_text": "▶️ Play" }
  },
  "messages": {
    "welcome": "Welcome to StoryVibe! Tap below to start writing your story.",
    "play_prompt": "Ready to continue?"
  },
  "game": {
    "max_name_length": 15,
    "allowed_name_pattern": "^[a-zA-Z\\s]+$"
  }
}
```

2. **Generate `secret_key`** with something like:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Never reuse a key you've shared publicly, including any key that may have shipped in a demo of this kit.

3. **(Optional) `ngrokconfig.json`** — only needed if using the domain-switcher dev tool (`newdomain.js`):
```json
{ "switchdomain": true }
```

4. **First run** — SQLite tables and `/control/*.json` config files are auto-created on first boot by each `database/*.js` module and API module (`createTables()`, `saveConfig()` patterns throughout).

5. **Start the server:**
```bash
node index.js
```

6. **Register your bot's Web App** with BotFather (`/newapp` or `/setmenubutton`) pointing to your domain.

### Production notes
- Idle memory footprint observed at ~5MB (Node + better-sqlite3 is lightweight when idle)
- No horizontal scaling support out of the box — in-memory game state (casino bets, some sessions) lives in a single process; running multiple instances behind a load balancer will break active games
- SQLite is fine for small-to-medium player counts; migrate to Postgres/MySQL if you expect heavy concurrent write load

---

## 5. What You Need To Finish Before Launch

### 5.1 Incomplete / Broken Features (read this first)

This section exists so nobody assumes this is a finished, tested product. It isn't. Treat everything below as a known gap, not a surprise.

**Backend — missing or broken:**
- [ ] **`chart_engine.js` is not included** in this repo, but `trading_engine.js` calls `chartEngine.calculateNextMove(...)` and will crash on boot unless you write a replacement or stub it out. The trading simulator will not run without this.
- [ ] **`blackvsred.routes.js` is a copy-paste bug** — its actual content is a duplicate of `roulette.routes.js` (wrong game instance, wrong URL paths). It needs to be rewritten to match the working pattern in `bankervs.routes.js` before Black vs Red casino betting will function at all.
- [ ] **`index.js` (the main HTTP server / route dispatcher) is not fully included** in this handoff in its final form — you will need to wire up the route handlers listed in `ARCHITECTURE.md` yourself, in the pattern `for (const handler of handlers) if (await handler(req, res, parsed, botHandler)) return;`
- [ ] **`ngrok-manager.js` and `demo.js`** are referenced by `newdomain.js` but not included — the domain-switcher dev tool will not work without them (this is an optional admin convenience feature, not core gameplay, so it's safe to skip if you don't need it)
- [ ] **A `games.js` database module (`db.games.*`)** is referenced constantly by every mini-game (cooldowns, sessions, stats) but was not included as a standalone file in this handoff — it must exist for any mini-game to function. Check the `database/` folder in your copy; if missing, it needs to be written from scratch using the calling patterns shown in `games_modules/*.js` as a spec.
- [ ] **No rate limiting anywhere** in the route layer — casino and mini-game betting endpoints in particular have zero spam/flood protection. Do not treat this as production-safe against abuse.
- [ ] **SQL injection risk in `database/rewards.js`** (`collectDailyReward`) — uses raw string interpolation into `db.exec()` instead of a parameterized query. Low real-world risk today, but should be fixed before any serious use.
- [ ] **No websocket / real-time layer** — casino round timers and task countdowns are all done via client-side polling, not push updates. Fine for small scale, will not hold up under real concurrent load without rework.

**Frontend — missing or unpolished:**
- [ ] **Hole Mole sprite assets are not included** (`hole-mole_assets/chractor.png`, `hammer.png`, `ground.png`, `after_hit.png`) — the game's CSS references them but the images themselves were not part of this handoff.
- [ ] **Casino and mini-games UI is functional but visually unpolished** — these work, but were never given the same design pass as the Home/Tasks/Shop/Leaderboard screens. Expect to reskin them.
- [ ] **`InventoryManager` referenced under two different global names** (`window.InventoryManager` vs `window.inventoryManagerInstance`) across different files — this is a bug/inconsistency, not intentional. Needs auditing and normalizing to one name before inventory-dependent features are fully reliable.
- [ ] **The full `InventoryManager` source file itself was not included** in this handoff — only referenced by other files. Needed for inventory UI (open/close modal, item use/discard) to work.
- [ ] **`TradingApp` (phone "app" for the trading simulator) is large and was only partially reviewed** — treat it as untested until you've run it yourself.
- [ ] **No mobile-device testing performed for this specific handoff** — CSS is responsive by design (media queries throughout), but hasn't been verified across real low-end Android devices.

**General:**
- [ ] Nothing in this repo has been re-tested end-to-end as a single assembled project. It was documented and organized from a working prior deployment, but file gaps above mean **it will not run out of the box**. Budget real time to fill gaps before expecting anything playable.

### 5.2 Other Things To Do Before Any Real Launch

- [ ] Polish casino/mini-games UI further beyond just making it functional
- [ ] Replace all placeholder branding ("StoryVibe") with your own
- [ ] Review the economy numbers (coin rewards, prices, casino payout multipliers) for your target audience
- [ ] Decide your jurisdiction's stance on the casino/gambling-style mechanics before going live with real users
- [ ] Set up a real reverse proxy / TLS termination for production (the code assumes plain `http` module + an external tunnel/proxy)

---

## 6. License & Contributions

This project is released under the [MIT License](./LICENSE) — free to use, modify, and distribute, with attribution and no warranty (see LICENSE for full terms).

This is **not an actively maintained project**. It's shared as-is for anyone who wants to learn from it, build on it, or use it as a base for their own Telegram Mini App. No support, no issue triage, and no guarantee of future updates from the original author. Forks and community contributions are welcome but won't necessarily be reviewed or merged back here.

If you build something with it, you're welcome to credit the original repo, but you're not obligated to.
