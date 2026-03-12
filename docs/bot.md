# Telegram Bot Reference

Bot token is set via `TELEGRAM_BOT_TOKEN`. Only the user in `TELEGRAM_ALLOWED_USER_ID` can interact with it.

---

## Commands

| Command | Description |
|---------|-------------|
| `/status` | Scraper health: last run, next run, error if any |
| `/recent` | 5 most recent New/Interested listings |
| `/interested <id>` | Mark listing as Interested |
| `/reject <id>` | Mark listing as Rejected |
| `/contact <id>` | Mark listing as Contacted |
| `/help` | Show all commands |

### Inline buttons on listing alerts

Every new listing alert includes three quick-action buttons:

```text
[ ✅ Interested ]  [ ❌ Reject ]  [ 📞 Contact ]
```

Tapping a button is equivalent to typing `/interested <id>`, `/reject <id>`, or `/contact <id>`.

---

## Proactive Alerts

The worker sends alerts automatically — no action needed. These fire to the same chat as your commands.

| Trigger | Message |
|---------|---------|
| Worker starts (or restarts) | `🟢 CarMatch worker started` |
| FB session expired / login required | `⚠️ FB session invalid — re-run npm run fb:login` |
| Scraper cycle fails | `❌ Scraper error: <error message>` |
| Unhandled worker crash | `🔴 Scraper crashed: <error message>` |

**Session alert deduplication:** the session-invalid alert fires once per invalid session, not every cycle. It resets automatically when the session becomes valid again.

---

## Getting Your Telegram User ID

Send a message to [@userinfobot](https://t.me/userinfobot) on Telegram. It replies with your numeric user ID. Put that in `TELEGRAM_ALLOWED_USER_ID`.
