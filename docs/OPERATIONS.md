# Operations and administration

## Runtime

The bot runs as a **systemd user service** under `electrumbtc1`, not as root:

```bash
cd /home/electrumbtc1/telegram-sum-helper
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
npm run check
systemctl --user restart telegram-sum-helper.service
systemctl --user --no-pager -l status telegram-sum-helper.service
```

Group setup: make `@SumcoinHelperBot` a minimal-permission group admin so it receives ordinary group messages and can reliably check member roles. Do not grant moderation powers. From the real `@SumcoinAdmin` account, open a private bot chat, issue `/start`, and verify its registration; then enable `/mode reply` in `@sumcoins`. `/mode observe` stops unsolicited replies but retains opt-in commands and permitted public-question indexing.

## Context and follow-ups

Natural auto-replies remember only their **reviewed topic identifier and response language** for up to 30 minutes in process memory. Within five minutes, a short, unmentioned “tell me more” or its supported language equivalent follows **only the same member's** recent bot answer. Replying directly to a specific bot message uses that message's topic identifier, even if another member asks; no user-to-user private context is transferred. Explicit `/more` uses the member's 30-minute context, while `/ask` works for authorized admins too. Unrelated chat is ignored. All topic memory disappears on process restart; source data is unaffected.

## Knowledge storage

| Location | Content | GitHub publication |
|---|---|---|
| `knowledge/` | Reviewed FAQs, podcast chapters, founder update, news seed references | Yes, public and sourced |
| `data/state.json` | Group mode and aggregate statistics | **Never** |
| `data/learning.json` | Hashed patterns (including historical fingerprints), moderator drafts and approved answers | **Never** |
| `data/escalations.json` | Review queue and verified reviewer registration | **Never** |
| `data/group-index.json` | Privacy-filtered new group excerpts (90-day / 5,000 cap) | **Never** |
| `data/synced.json` | Unreviewed public docs snapshot | **Never** (regenerated) |
| `data/github-docs.json` · `data/news.json` | Unreviewed public documentation and news metadata | **Never** (regenerated) |
| `data/social-posts.json` | Optional imported public X archive | **Never** |
| `.env` | Telegram and optional AI credentials; developer ID allowlist | **Never** |

The indexing feature does not fetch older Telegram history. It skips unrelated talk and known secret/PII patterns; no filter can guarantee that all sensitive information has been detected. Public-group members should be informed via `/privacy` and a pinned notice. Reply `/forget` to your own message to remove a saved excerpt; `/stop` pauses automatic responses, not Telegram's retention.

## Admin review and publication

Verified group admins and explicitly allowlisted non-admin developers can contribute candidate answers to a queue. None becomes a verified fact automatically. After checking the answer against an official source:

```text
/drafts
/source 12 | https://www.sumcoin.org/about/
/approve 12
/reject 12
```

`@SumcoinAdmin` can use the private review chat's `/review`, `/answer ID | ANSWER | URL` and `/skip ID`. Do not approve an answer merely because it was posted by an admin or found in a transcript/news article.

## Public source refresh

```bash
npm run sync:all
systemctl --user enable --now telegram-sum-helper-sync.timer
systemctl --user list-timers --all
```

The timer refreshes allowlisted public documentation, GitHub text and attributed news metadata. It does not push any files to GitHub. Stale/inaccessible sources remain unreviewed; not every historical technical claim is a current network rule. X account posts require a legitimate archive, e.g. `npm run import:social -- /home/electrumbtc1/tweets.js --account sumcoinindex`. Avoid generic `$SUM` results since the ticker is ambiguous.

## Publishing a code release

Download the versioned ZIP to the Mac and run its `scripts/push-update.sh` from the extracted root. It clones the existing repository into a temporary directory under `~/Documents`, verifies the approved base version and exact GitHub base commit, runs the regression suite, stages only public source files, then commits and tags the new version. It neither force-pushes nor includes `data/` or `.env`. Deploy on VM using `git pull --ff-only origin main`, tests and a user-service restart.

See [CHANGELOG.md](../CHANGELOG.md) for all historical changes.

## Import historical Telegram exports privately

After deploying this release, run **on your Mac** with the authorized `result.json.zip` in Downloads:

```bash
cd /home/electrumbtc1/telegram-sum-helper
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
bash scripts/import-history-safe.sh < /secure/local/path/result.json
```

Or send the exported JSON directly through an SSH pipe from a trusted Mac:

```bash
unzip -p "$HOME/Downloads/result.json.zip" result.json | ssh electrumbtc1@YOUR_VM_HOST 'bash /home/electrumbtc1/telegram-sum-helper/scripts/import-history-safe.sh'
```

Replace `YOUR_VM_HOST` with your actual SSH destination and change the ZIP path if saved elsewhere. This briefly pauses the bot so a concurrent save cannot overwrite imported data, then restarts it. It stores privacy-filtered question-pattern fingerprints only, not the raw transcript, users or messages. The importer prints an aggregate count. Do not commit or push the original export or `data/learning.json`. The published, anonymized aggregate summary is in `docs/COMMUNITY-INSIGHTS.md`.


## v0.0.14: source hierarchy and optional conversational AI

Authoritative behavior starts with the **running bot implementation and live read-only chain/rate responses**. Reviewed current Sumcoin FAQs and specifically approved corrections are the next source of facts. The assistant may show official GitHub docs, older podcasts, social posts, and news articles as *attributed background*, but it never automatically turns that material into current network claims. Human approval must accompany a verified source before an admin correction overrides a reviewed FAQ.

The OpenAI API is **not free by default** and does not come with ChatGPT Plus. `AI_ENABLED=false` blocks calls even when a key is present. If a user independently has eligible API promotional credits or deliberately enables billing, use `AI_ENABLED=true`, `OPENAI_API_KEY=...`, `OPENAI_MODEL=gpt-6-luna` and low `AI_HOURLY_LIMIT`, `AI_DAILY_LIMIT`, `AI_MONTHLY_LIMIT`. The default caps are 4/hour, 12/day, and 60/month. These are *request caps*, not a guaranteed financial ceiling; additionally configure an API project spend limit and monitor actual bills. Rate limits and depleted credits trigger the original reviewed free replies. API use is reserved for explicit `/ask`, @mentions, and direct replies, not passive group chatter. Never put credentials in GitHub. When enabled, the bot sends sanitized, explicitly directed questions and reviewed knowledge snippets to the OpenAI API; members are informed via `/privacy`. Do not enable this without considering member expectations and privacy.

An authorized admin can reply to a bot message within 30 minutes with `/correct Corrected, verified answer | https://sumcoin.org/relevant-page`. This creates a **pending** correction, not an automatic change. `/drafts` allows review; `/approve ID` installs it, superseding its exact topic; `/revoke ID` removes it and restores the baseline source. An approved correction is saved privately to `data/learning.json` and never published to GitHub without a separate public code review. `/weekly` shows aggregate outcomes for the last seven days, without group member identities. Optional `WEEKLY_REPORT_ENABLED=true` sends that report privately to a verified registered SumcoinAdmin each Monday after 10:00 UTC. It is off by default.

The historical import still requires the **local authorized Telegram export**. `scripts/import-history-safe.sh` reads a piped JSON stream, pauses the service to prevent overwrite races, imports only anonymized fingerprints, then restarts. The import is idempotent by export digest. No raw transcript is retained on the VM or committed to GitHub. The operator must run the Mac-to-VM SSH command once after deployment; simply updating code does not transfer the 743 historical patterns.
