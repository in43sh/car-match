# CarMatch — Setup & Operations Guide

## Production server

| | |
|---|---|
| IP | 167.71.84.246 |
| User | root |
| App dir | /root/car-match |
| Dashboard | http://167.71.84.246:3000 |
| GitHub | https://github.com/in43sh/car-match |

---

## First-time server setup (already done)

These steps were completed when the droplet was provisioned. Documented here for reference if you ever need to start fresh.

```bash
# 1. Install nvm + Node 20
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20

# 2. Install PM2
npm install -g pm2
pm2 startup   # run the printed command to enable auto-start on reboot

# 3. Install Playwright system deps
npx playwright install --with-deps chromium

# 4. Add 2GB swap (needed for Next.js builds on 1GB RAM droplet)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 5. Clone repo
git clone https://github.com/in43sh/car-match /root/car-match
cd /root/car-match

# 6. Create .env
cp .env.example .env
nano .env   # fill in real values (see Environment Variables below)

# 7. First deploy
npm run deploy

# 8. Copy FB session (see FB Session section below)
```

---

## Deploying updates

After pushing code changes to GitHub:

```bash
ssh root@167.71.84.246
cd /root/car-match && npm run deploy
```

The deploy script:
1. `git pull origin main`
2. `npm ci`
3. `npm run db:migrate`
4. `npm run build` (with `NODE_OPTIONS=--max-old-space-size=1536`)
5. `pm2 reload` (zero-downtime for web, restart for worker)

---

## PM2 process management

```bash
pm2 status                    # show both processes and their state
pm2 logs web                  # Next.js dashboard logs
pm2 logs worker               # scraper + bot logs
pm2 restart worker            # restart just the worker (e.g. after FB session refresh)
pm2 reload pm2.config.js      # zero-downtime reload of both processes
pm2 stop all                  # stop everything
pm2 save                      # persist process list across reboots
```

Two processes run under PM2:

| Name | What it does |
| ---- | ------------ |
| web | Next.js dashboard on port 3000 |
| worker | Telegram bot polling + scraper cron (every 5 min) |

---

## FB session refresh

The scraper uses a saved Facebook session. Sessions expire every 30–90 days. When the worker logs `FB session invalid`, refresh it:

```bash
# 1. Run on your Mac (opens a browser window):
cd /Users/sergey/webdev/car-match
npm run fb:login
# Log in to Facebook manually. Script auto-saves when login completes.

# 2. Verify the session has c_user (confirms login succeeded):
python3 -c "import json; [print(c['name']) for c in json.load(open('data/fb-session.json'))]"
# Should include: c_user, xs, datr, sb, fr, wd

# 3. Copy to server:
scp data/fb-session.json root@167.71.84.246:/root/car-match/data/fb-session.json

# 4. Restart worker:
ssh root@167.71.84.246 "source ~/.nvm/nvm.sh && pm2 restart worker"
```

---

## npm scripts (run locally)

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run deploy` | Full deploy (run on server, not locally) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:studio` | Open Drizzle Studio (local DB browser) |
| `npm run fb:login` | Interactive FB login — Mac only, headed browser |

---

## Environment variables

File location on server: `/root/car-match/.env`

| Variable | Description |
| -------- | ----------- |
| `AUTH_SECRET` | Dashboard session cookie secret — generate with `openssl rand -base64 32` |
| `DASHBOARD_PASSWORD` | Login password for the dashboard |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_ALLOWED_USER_ID` | Your Telegram user ID (from @userinfobot) |
| `DATABASE_URL` | Path to SQLite file — `./data/car-match.db` |
| `FB_SESSION_PATH` | Path to FB session cookies — `./data/fb-session.json` |
| `SCRAPE_INTERVAL_MINUTES` | How often the scraper runs — default `5` |

---

## Known issues & gotchas

- **Build OOM:** `next build` kills itself on 1GB RAM without extra heap. The deploy script already sets `NODE_OPTIONS='--max-old-space-size=1536'`. The 2GB swap file is what makes this work.
- **HTTP only:** The dashboard runs over plain HTTP. The session cookie has `secure: false` in `src/app/api/auth/route.ts` — if you ever add HTTPS/nginx, change this back to `true`.
- **FB session format:** Only sessions with `c_user` cookie are valid. Pre-login sessions (4 cookies: datr, sb, fr, wd) will fail — re-run `npm run fb:login` and complete the full login.
