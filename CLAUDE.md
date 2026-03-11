# CarMatch — Claude Context

## Production server
- **IP:** 167.71.84.246
- **User:** root
- **App dir:** /root/car-match
- **GitHub:** https://github.com/in43sh/car-match

## Deploy
```bash
# From the server (after pushing to main):
ssh root@167.71.84.246
cd /root/car-match && npm run deploy
```
The deploy script pulls, installs, migrates, builds (with `NODE_OPTIONS=--max-old-space-size=1536`), and does a zero-downtime pm2 reload.

## PM2 processes
| Name   | What it does |
|--------|-------------|
| web    | Next.js dashboard on port 3000 |
| worker | Telegram bot polling + scraper cron |

```bash
pm2 status                   # show both processes
pm2 logs web                 # Next.js logs
pm2 logs worker              # scraper + bot logs
pm2 restart worker           # restart just the worker
pm2 reload pm2.config.js     # zero-downtime reload of both
pm2 stop all                 # stop everything
pm2 save                     # persist process list across reboots
```

## Known gotchas
- **Build needs extra heap:** 1GB droplet OOMs on `next build` without `NODE_OPTIONS='--max-old-space-size=1536'` (already in deploy.sh)
- **Swap file:** 2GB swap at /swapfile is set up on the droplet
- **Session cookie:** `secure: false` in `src/app/api/auth/route.ts` — site runs over HTTP, not HTTPS
- **FB session:** must be generated on a Mac (headed browser), then `scp`'d to the server. Check for `c_user` cookie to confirm it's valid.

## Refreshing FB session (when scraper reports "FB session invalid")
```bash
# On your Mac:
cd /Users/sergey/webdev/car-match
npm run fb:login          # log in manually in the browser window
scp data/fb-session.json root@167.71.84.246:/root/car-match/data/fb-session.json

# Then restart the worker:
ssh root@167.71.84.246 "source ~/.nvm/nvm.sh && pm2 restart worker"
```

## Other useful commands

```bash
# Check if FB session is valid (must have c_user cookie)
ssh root@167.71.84.246 "python3 -c \"import json; [print(c['name']) for c in json.load(open('/root/car-match/data/fb-session.json'))]\""

# Run DB migrations manually
ssh root@167.71.84.246 "cd /root/car-match && npm run db:migrate"

# Open DB studio locally
npm run db:studio

# SSH shortcut
ssh root@167.71.84.246
```

## npm scripts

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run deploy` | Full deploy (run on server) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run fb:login` | Interactive FB login (Mac only, headed browser) |

## Environment variables (on server: /root/car-match/.env)
- `AUTH_SECRET` — dashboard session cookie secret
- `DASHBOARD_PASSWORD` — login password
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `TELEGRAM_ALLOWED_USER_ID` — your Telegram user ID
- `DATABASE_URL` — ./data/car-match.db
- `FB_SESSION_PATH` — ./data/fb-session.json
- `SCRAPE_INTERVAL_MINUTES` — default 5
