# CarMatch

Self-hosted used-car monitor. Scrapes Facebook Marketplace and supported dealership inventory pages every few minutes, deduplicates listings, sends Telegram alerts for new matches, and lets you parse CARFAX reports from a dashboard.

## Stack

| Layer | Choice |
|---|---|
| Backend + Dashboard | Next.js 14 App Router |
| Database | SQLite via Drizzle ORM |
| Scraper | Playwright (persistent FB session + dealership scraping) |
| Telegram bot | grammY (polling) |
| Scheduler | node-cron |
| Process manager | pm2 (two processes: `web` + `worker`) |

---

## Requirements

- Node.js 20 LTS
- pm2 (`npm i -g pm2`)
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- A DigitalOcean Droplet (or any Linux host with a desktop browser available for the FB login step)

---

## First-time setup

### 1. Clone and install

```bash
git clone <repo-url> car-match
cd car-match
npm ci
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | How to get it |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `DASHBOARD_PASSWORD` | Any password |
| `TELEGRAM_BOT_TOKEN` | Create a bot via [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_ALLOWED_USER_ID` | Send any message to [@userinfobot](https://t.me/userinfobot) |
| `SCRAPE_INTERVAL_MINUTES` | `5` is a safe default (floor is 3) |
| `DATABASE_URL` | Leave as `./data/car-match.db` |
| `FB_SESSION_PATH` | Leave as `./data/fb-session.json` |

### 3. Create the data directory and run migrations

```bash
mkdir -p data
npm run db:migrate
```

### 4. Log in to Facebook (one-time)

This opens a visible Chromium window. Log in normally, complete any 2FA, then wait for the script to save your session cookies and exit.

```bash
npm run fb:login
```

The session is saved to `data/fb-session.json`. The worker reuses and refreshes it automatically.

> **Re-login**: If the scraper starts reporting session errors, run `npm run fb:login` again while pm2 is stopped.

### 5. Start with pm2

```bash
pm2 start pm2.config.js
pm2 save              # persist across reboots
pm2 startup           # follow the printed instructions
```

This starts two processes:
- **web** — Next.js dashboard on port 3000
- **worker** — scraper cron + Telegram bot polling

### 6. Add search profiles

Open the dashboard (`http://<your-vps-ip>:3000`), go to **Profiles**, and create your first search profile. The scraper picks up active profiles on its next tick.

---

## Daily usage

### Dashboard

| Page | URL | Purpose |
|---|---|---|
| Listings | `/` | All scraped listings, filterable by status |
| Listing detail | `/listings/:id` | Full info, status change, CARFAX submit |
| Profiles | `/profiles` | Create / edit / pause search profiles |
| CARFAX History | `/carfax` | All parsed CARFAX reports |

### Telegram commands

| Command | Description |
|---|---|
| `/recent` | Last 5 new or interested listings |
| `/interested <id>` | Mark listing as interested |
| `/reject <id>` | Mark listing as rejected |
| `/contact <id>` | Mark listing as contacted |
| `/help` | Command list |

Alert messages include **Interested / Reject / Contact** inline buttons — tap to update status without typing a command.

### CARFAX reports

From a listing detail page, submit a CARFAX report by:
1. **URL** — paste the `https://api.carfax.shop/report/view?hash=…` link
2. **HTML file** — save the report page from your browser (File → Save as → Webpage, Complete) and upload it

The report is parsed locally (cheerio, no external API). Verdict logic:
- **FAIL** — title issues, odometer rollback in history, or CARFAX last reading > listing mileage
- **CAUTION** — one or more accidents
- **PASS** — none of the above

---

## Deployment (updates)

On the VPS, after pushing new code:

```bash
npm run deploy
```

This pulls, installs, migrates, builds, and does a zero-downtime pm2 reload.

---

## Useful pm2 commands

```bash
pm2 status            # process list
pm2 logs web          # Next.js logs
pm2 logs worker       # scraper + bot logs
pm2 restart worker    # restart just the worker
pm2 stop all          # stop everything
```

---

## Project structure

```
src/
  app/
    (dashboard)/      # Dashboard pages (listings, profiles, carfax)
    api/              # REST endpoints
    login/            # Login page
  bot/                # Telegram bot (grammY)
  db/                 # Drizzle schema + migrations
  jobs/               # Cron job registration
  lib/
    carfax/           # HTML parser + verdict builder
    telegram/         # Message formatters + keyboards
    types/            # Shared TypeScript types
  middleware.ts        # Auth middleware
  scraper/            # Playwright FB scraper
  worker.ts           # Worker entry point (pm2)
scripts/
  fb-login.ts         # Interactive FB login session saver
data/                 # Runtime data (gitignored)
  car-match.db        # SQLite database
  fb-session.json     # Facebook session cookies
```
