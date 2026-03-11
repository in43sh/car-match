# CarMatch — Architectural Decisions Record (ADR)

---

## Decision 1 — Language: TypeScript

**Chosen:** TypeScript (strict mode) throughout, including scraper, bot, backend, and dashboard.
**Date:** Project kickoff

### Alternatives Considered

| Option | Pros | Cons | Complexity |
|---|---|---|---|
| **TypeScript** | Playwright is native TS/JS; grammY is TS-first; single language across entire stack; excellent type safety | Requires build step; slightly more setup | Low |
| **Python** | Excellent Playwright support; rich scraping/bot ecosystem; simpler typing for scripts | Separate language from Next.js dashboard; no clean way to share types; two ecosystems to maintain | Medium |
| **Go** | High performance; small binaries; great for long-running daemons | No official Playwright support; much higher implementation effort for scraping | High |

### Why TypeScript
- Playwright is a first-class TypeScript library — no language boundary between scraper and app
- grammY (chosen bot library) is TypeScript-first with excellent type inference for handler context
- Shared types across scraper, bot, API, and UI without serialization — `Listing`, `SearchProfile`, `CarfaxReport` are defined once and used everywhere
- Next.js App Router is TypeScript-native — no friction in the API layer
- Single `tsconfig.json`, single `package.json`, no polyglot complexity

### When to Reconsider
- If the scraper needs to run in a truly isolated process with memory constraints that Node.js can't meet
- If a Python-specific ML/NLP library is needed for listing parsing (e.g., price extraction from free-text)

---

## Decision 2 — FB Marketplace Scraping: Playwright (Self-Managed)

**Chosen:** Playwright with a persistent browser context, dedicated FB account, randomized delays.
**Date:** Project kickoff

### Alternatives Considered

| Option | Pros | Cons | Complexity |
|---|---|---|---|
| **Playwright (self-managed)** | Full control; no recurring per-scrape cost; most flexible; handles JS-heavy pages | Requires session maintenance; risk of being blocked; needs Chromium on VPS | Medium |
| **Apify (hosted scraping)** | Managed infrastructure; auto-rotation of proxies/sessions | ~$50+/month at scale; external dependency; less control over timing | Low to build, High to operate |
| **Unofficial FB Marketplace API** | Simple HTTP calls | Breaks without warning; reverse-engineered; no reliability guarantees | Medium to build, High to maintain |
| **Commercial FB data APIs** | Stable, structured data | Expensive; overkill for single-user tool | Low |

### Why Playwright
- Apify costs money and adds an external dependency not in the user's control
- Unofficial APIs have historically broken with FB updates — unacceptable for an alerting-critical tool
- For a single user with low scrape volume (one search per profile every 5 minutes), the block risk is manageable with basic rate limiting, randomized delays, and a dedicated FB account
- Playwright persistent context means cookies survive across scrape cycles — no repeated logins

### When to Reconsider
- If FB aggressively blocks the session more than once per week (session refresh becomes too costly)
- If search coverage needs to expand to dozens of simultaneous profiles (scraper throughput becomes a bottleneck)
- If a reliable, affordable third-party FB Marketplace data API emerges

---

## Decision 3 — Database: SQLite + Drizzle ORM

**Chosen:** SQLite via `better-sqlite3`, schema managed with Drizzle ORM.
**Date:** Project kickoff

### Alternatives Considered

| Option | Pros | Cons | Complexity |
|---|---|---|---|
| **SQLite + Drizzle** | Zero ops; file on disk; TypeScript-native schema; perfect for low-write workloads; easy to backup (copy file) | Not suitable for multi-process write concurrency; single file means no replication | Low |
| **PostgreSQL** | Robust; handles concurrent writes; production-grade | Requires a running process; Docker or system install; backup setup; overkill for one user | Medium-High |
| **PlanetScale / Turso (libSQL)** | Managed SQLite-compatible cloud DB; branching | External dependency; adds latency; unnecessary for VPS-hosted tool | Low to use, adds external dep |
| **JSON files** | Simplest possible persistence | No querying; no transactions; corruption risk | Very Low |

### Why SQLite + Drizzle
- Single-user, single-VPS tool with low write volume (a few inserts per scrape cycle) — SQLite handles this trivially
- Drizzle ORM is TypeScript-native with a schema-as-code approach — the schema file IS the source of truth, no separate migration files to hand-author
- `better-sqlite3` is synchronous, which actually simplifies code in a Node.js context (no async DB calls)
- Backup is a single `cp carmatch.db carmatch.db.bak`
- Migration to PostgreSQL later requires only changing the Drizzle adapter and driver — the schema and query code stays identical

### When to Reconsider
- If multi-process write concurrency is needed (e.g., Next.js deployed with multiple workers)
- If the database grows beyond ~1GB (unlikely for this use case)
- If you add a second user and need auth/row-level security

---

## Decision 4 — Backend + Dashboard: Next.js App Router

**Chosen:** Next.js 14 App Router — handles both the API layer and the React UI.
**Date:** Project kickoff

### Alternatives Considered

| Option | Pros | Cons | Complexity |
|---|---|---|---|
| **Next.js App Router** | API routes + UI in one project; one build step; one pm2 process; excellent TypeScript support; shadcn/ui is built for it | App Router has a learning curve; slightly heavy for a simple dashboard | Low |
| **FastAPI (Python) + separate React app** | Clean separation; Python great for scripting | Two languages; two repos or complex monorepo; shared type problem | High |
| **Hono + React (Vite)** | Lightweight; fast; modern | Less convention; more decisions to make; shadcn/ui less straightforward | Medium |
| **HTMX + server-rendered HTML** | Minimal JavaScript; very simple server | Limited interactivity; worse DX for data-heavy tables; harder to integrate shadcn | Medium |
| **Express + React** | Familiar; flexible | More boilerplate than Next.js; no file-based routing | Medium |

### Why Next.js App Router
- One project, one `package.json`, one build step — no separate frontend/backend coordination
- API routes live alongside UI code — database types flow directly from schema to API handler to React component without serialization
- shadcn/ui is designed for Next.js + Tailwind — zero friction in component setup
- App Router Server Components reduce client-side JS for mostly-read views like the listings table
- pm2 runs `next start` — deployment is `npm run build && pm2 restart web`

### When to Reconsider
- If the dashboard becomes a mobile app or a CLI — Next.js UI value disappears
- If the API needs to scale independently of the UI

---

## Decision 5 — Telegram Bot Library: grammY

**Chosen:** grammY in polling mode.
**Date:** Project kickoff

### Alternatives Considered

| Option | Pros | Cons | Complexity |
|---|---|---|---|
| **grammY** | TypeScript-first; modern async API; excellent middleware system; active maintenance; great docs | Smaller community than older libs | Low |
| **node-telegram-bot-api** | Widely used; lots of examples | Older design; callback-heavy; poor TypeScript types | Low to use, worse DX |
| **telegraf** | Popular; good TS support | Less actively maintained than grammY; similar feature set | Low |
| **Webhook mode (any library)** | No polling overhead | Requires public HTTPS endpoint; more VPS configuration (nginx, SSL) | Medium |

### Why grammY
- TypeScript-first design means handler context is fully typed — `ctx.message.text` is typed correctly without casting
- Middleware pattern is clean for the auth check (owner ID filter applied once, all handlers protected)
- Polling mode requires zero infrastructure — no nginx, no SSL cert setup, no webhook URL — just `bot.start()` in the worker process
- Most actively maintained Telegram bot library for Node.js as of 2024

### When to Reconsider
- If Telegram adds rate limits that make polling impractical (currently not an issue for single-user bots)
- If a public HTTPS endpoint is set up for other reasons — then webhooks are marginally more efficient

---

## Decision 6 — Job Scheduler: node-cron

**Chosen:** node-cron, running in-process inside the worker.
**Date:** Project kickoff

### Alternatives Considered

| Option | Pros | Cons | Complexity |
|---|---|---|---|
| **node-cron** | Simple; in-process; no dependencies; cron syntax | In-process — if worker crashes, jobs stop (same as bot stopping, both restart via pm2) | Very Low |
| **Celery + Redis** | Robust; distributed; retries; monitoring | Redis dependency; two more processes; massive overkill for one scheduled task | Very High |
| **Bull/BullMQ** | Good queue features; Redis-backed | Redis dependency; more complexity than needed | High |
| **System cron (VPS crontab)** | OS-level; runs even if app is down | Harder to share config; no in-process state sharing; awkward to pass DB connection | Low |
| **APScheduler (Python)** | Python-native; good for mixed workloads | Wrong language | N/A |

### Why node-cron
- Single dependency, in-process execution means the scraper has direct access to the DB client and Telegram bot instance — no IPC needed
- The scraper crashing is caught by try/catch in the job — next cycle starts fresh regardless
- pm2 restarts the worker process if it exits — node-cron restarts with it
- Cron syntax allows per-profile interval configuration if needed later
- No Redis, no separate queue process, no deployment complexity

### When to Reconsider
- If scrape jobs need retry logic with exponential backoff and dead letter queues
- If scrape duration approaches the cron interval (jobs overlapping — add a mutex lock first, then consider a proper queue)

---

## Decision 7 — Hosting: DigitalOcean Droplet (Basic 1GB)

**Chosen:** DigitalOcean Basic Droplet (1 vCPU, 1GB RAM), ~$6/month.
**Date:** Project kickoff

### Alternatives Considered

| Option | Pros | Cons | Complexity |
|---|---|---|---|
| **DigitalOcean Droplet** | Affordable always-on workloads; full control; no cold starts; simple setup | Manual setup; no auto-scaling; SSH to manage | Medium (one-time) |
| **Railway / Render** | Easy deploy; Git push deploy | Sleep on idle (free tier); billed per CPU-second; bad fit for persistent polling; $5–20/mo for always-on | Low |
| **AWS EC2 (t3.micro)** | Powerful ecosystem; reliability | More expensive; more complex IAM/security setup | High |
| **Fly.io** | Easy containerized deploy; auto-scaling | Not free; containers sleep; Playwright needs custom Dockerfile | Medium |
| **Local machine (always-on Mac)** | Free; fast setup | Tied to home internet/power; no redundancy; not accessible remotely | Low |

### Why DigitalOcean Droplet

- Always-on polling workloads are a terrible fit for platforms that sleep on idle or charge per invocation
- ~$6/month keeps total infra cost under the $10/month target
- One Droplet runs everything: Next.js web server, worker (bot + scheduler), Playwright Chromium, SQLite file
- Full root access — easy to install Chromium, configure pm2, set up cron for backups

### When to Reconsider

- If the Droplet goes down frequently and uptime matters more (move to a managed platform with auto-restart)
- If Playwright's Chromium memory usage causes OOM on 1GB RAM — upgrade to 2GB Droplet (~$12/mo)

---

## Decision 8 — Carfax Parsing: Playwright DOM Extraction (carfax.shop)

**Chosen:** Load `carfax.shop` URLs with Playwright, extract fields from DOM.
**Date:** Project kickoff

### Alternatives Considered

| Option | Pros | Cons | Complexity |
|---|---|---|---|
| **Playwright + DOM extraction (carfax.shop)** | Free; no API key; handles JS-rendered content | Fragile — selectors break with site updates; manual selector maintenance | Medium |
| **Official Carfax API** | Stable; structured data | Expensive ($30–50+/report or subscription); requires dealer/business account | Low to use, High cost |
| **HTTP fetch + HTML parsing** | Faster than Playwright; no browser overhead | Only works if carfax.shop is server-rendered; may not work if JS-rendered | Low |
| **PDF parsing (fallback)** | Useful if link format breaks | Requires manual PDF download; much harder to parse; no automation path | High |

### Why Playwright + DOM Extraction
- Official Carfax API costs are prohibitive for a personal tool
- `carfax.shop` provides the same data for free via a web interface
- Playwright is already a dependency for the FB scraper — no additional dependency
- DOM extraction is sufficient for the 5 fields needed (accidents, owners, title, odometer, rollback)
- Selectors are documented in `docs/carfax.md` and can be updated in minutes when they break

### When to Reconsider
- If `carfax.shop` shuts down or starts blocking scrapers — need alternative Carfax viewer
- If selector maintenance becomes frequent (> once/month) — evaluate PDF fallback or a paid API

---

## Decision 9 — Repo Structure: Single Package

**Chosen:** One repo, one `package.json`, clear internal directory boundaries.
**Date:** Project kickoff

### Alternatives Considered

| Option | Pros | Cons | Complexity |
|---|---|---|---|
| **Single package** | Simplest; one `npm install`; shared types without publishing; easy refactor | All code in one build context; no independent versioning | Very Low |
| **Monorepo (npm/pnpm workspaces)** | Independent packages; separate build caches; cleaner dependency isolation | Overkill for a one-person project; more config; shared types require a `packages/shared` sub-package | High |
| **Separate repos (web + worker)** | Maximum isolation | Type sharing requires publishing packages; two deploy scripts; two git histories | Very High |

### Why Single Package
- The bot, scraper, and dashboard share types, DB schema, and utility functions — separating them creates friction without benefit
- Solo developer project with no team coordination needs
- Internal directory structure (`src/bot/`, `src/scraper/`, `src/jobs/`) provides logical separation without build-system complexity

### When to Reconsider
- If a second developer joins and needs to work on isolated parts independently
- If the bot and scraper need to be deployed to separate machines

---

## Decision 10 — Dashboard Auth: Single Secret Token (Cookie-Based)

**Chosen:** Single `DASHBOARD_SECRET` env var, set as HttpOnly cookie on login.
**Date:** Project kickoff

### Alternatives Considered

| Option | Pros | Cons | Complexity |
|---|---|---|---|
| **Single secret + cookie** | Zero deps; no user DB; appropriate for single user | One compromised secret = full access; no MFA | Very Low |
| **NextAuth / Auth.js** | Full auth system; OAuth providers; session management | Overkill for one user; adds several dependencies | Medium |
| **IP allowlist (nginx)** | No UI auth needed; VPS-level security | Not suitable if IP changes (mobile, travel); requires nginx setup | Medium |
| **HTTP Basic Auth (nginx)** | Simple; no code needed | Credentials sent on every request; less flexible | Low |
| **No auth (VPS firewall only)** | Zero config | Dashboard exposed if VPS IP is ever shared or probed | Very Low |

### Why Single Secret Token
- Single user means no per-user account management needed
- HttpOnly cookie protects the token from XSS
- SameSite=Strict blocks CSRF
- Simple enough to audit and understand completely — no auth library magic
- Appropriate security level for a personal tool on a VPS

### When to Reconsider
- If a second user needs access to the dashboard — switch to NextAuth with proper accounts
- If the dashboard is exposed to a public IP and the secret is weak — enforce minimum length in setup docs

---

## Summary Table

| # | Decision | Choice | Revisit Trigger |
|---|---|---|---|
| 1 | Language | TypeScript throughout | ML/NLP scraping needs arise |
| 2 | Scraper | Playwright (self-managed) | Blocked > 1×/week or scale > 10 profiles |
| 3 | Database | SQLite + Drizzle ORM | Multi-process writes or DB > 1GB |
| 4 | Backend + UI | Next.js App Router | Dashboard becomes mobile/CLI |
| 5 | Telegram bot | grammY (polling mode) | HTTPS endpoint available for webhooks |
| 6 | Scheduler | node-cron (in-process) | Jobs need retry queues or overlap |
| 7 | Hosting | DigitalOcean Droplet (Basic 1GB) | OOM issues → upgrade to 2GB Droplet |
| 8 | Carfax parsing | Playwright + carfax.shop DOM | Site shuts down or blocks; selector rot > 1×/mo |
| 9 | Repo structure | Single package | Second developer or separate deployments |
| 10 | Dashboard auth | Single secret + HttpOnly cookie | Second user needed; OAuth required |

---

## Philosophy

> Choose the simplest option that solves the problem reliably — add complexity only when a concrete limitation demands it.
