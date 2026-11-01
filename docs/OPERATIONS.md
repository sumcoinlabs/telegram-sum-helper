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

## Optional free-tier Groq conversational responses (v0.0.15)

`AI_PROVIDER=groq`, `AI_MODEL=openai/gpt-oss-120b`, `AI_ENABLED=true`, and a private `GROQ_API_KEY` in VM `.env` activate Groq for `/ask`, direct mentions and replies to the bot. No provider key belongs in GitHub, chat, or documentation. Ordinary group replies and live price calculations stay code-driven. The free-tier is subject to provider request and token limits; HTTP 429/other errors fall back to offline reviewed answers. The local 4/hour, 12/day, and 60/month caps are deliberately more conservative than Groq's published free-tier caps. `/privacy` discloses the chosen provider. The integration does not send `store` to Groq, which presently rejects that option. When using direct OpenAI, set `AI_PROVIDER=openai`, `AI_MODEL=gpt-6-luna`, and `OPENAI_API_KEY`. Set `AI_ENABLED=false` to disable paid/hosted AI instantly after restarting.

For a live check, use `/ask Why is Sumcoin proof-of-stake today?` as an administrator. Never test by posting your API key into Telegram.

## Groq account diagnostics (v0.0.16)

Run on the bot VM after pulling v0.0.16:

```bash
cd /home/electrumbtc1/telegram-sum-helper
python3 scripts/setup-groq.py
```

The script prompts privately for the Groq key. First it checks the permitted-model list; then it tries `openai/gpt-oss-120b` and, if blocked, `openai/gpt-oss-20b`. A 403 may indicate model permission restrictions at the Groq organization or project level; use the printed safe provider error code and the Groq Limits settings. The private `.env` is replaced only after successful inference. Never paste the API key into Telegram, GitHub or a support conversation. Restart `telegram-sum-helper.service` after success.

## v0.0.18 live-price and admin tests

Natural questions like “What’s Sumcoins price right now” need no question mark or currency code.
The strict live-rate path selects the approved currency feed, never a generated AI amount.
Group admins may ask clear natural price questions; other admin posts and anonymous admin messages stay quiet.
`/engine`, when used by a group admin as a reply to a bot message, identifies live, local, or Groq origin while the in-memory provenance is available.
`AUTO_AI=true` is required for automatic *explanatory* Groq answers; no key changes needed when upgrading from v0.0.17.
The private Groq installer specifies `User-Agent: SumcoinHelper/0.0.18` to avoid Python-urllib Cloudflare 403 responses.

## v0.0.19 SumcoinPrice integration

- `/chart` points to https://sumcoinprice.com/ (public interactive SUM historical chart).
- `/priceapi` lists the documented public JSON endpoints: `https://sumcoinprice.com/market.php`, `https://sumcoinprice.com/api/history.php?range=1d` and `https://sumcoinprice.com/api/history.php?range=1d&pair=btc`.
- `/sources` includes the site. Natural chart/history/API questions route to these fixed URLs with no Groq call; `rate.slicewallet.org/api/rates` remains primary for live multicurrency quotes.
- The bot does not parse or assert historical datapoints or all-time-high numbers, because live history-feed response schemas/freshness have not been verified in this release. Do not silently synthesize or guess historical values.
- To check live endpoint health after deployment, run `curl -fLsS -o /dev/null -w '%{http_code}\n' 'https://sumcoinprice.com/market.php'` and the history URL; no endpoint availability is assumed at build time.
- No changes to `.env`, `data/`, model quotas, or services are necessary beyond the normal `git pull` and user-service restart.

## v0.0.20 historical pricing and member-export audits

- Public history: `https://sumcoinprice.com/api/history.php?range=all&pair=usd` (read-only, validated full OHLC highs). For performance only supported periods `1d`, `1w`, `1m`, `3m`, `6m`, `1y`, `5y`, `all` and USD/BTC pairs are queried. The bot will never invent a historical value when the API is unavailable. Check the live endpoint after VM deployment because network access in release construction did not verify the current JSON response.
- Each group member has a temporary in-memory subject context; it expires after 20 minutes, is scoped by chat and member, or by a direct reply to the specific bot answer. It contains no raw chat text, history archives, keys or personal profile.
- **Never upload Telegram Desktop exports or author lists into the bot or GitHub.** To inspect your own export on your Mac, run `python3 scripts/audit-telegram-members.py /path/to/result.json.zip` for aggregate counts. `--private-csv /path/to/authors.csv` writes a local CSV (mode 0600), containing only observed message authors, not a full participant roster or membership status. Do not assume removal records prove voluntary departure. The Bot API does not support adding members without their participation or contacting users who have not started the bot. Share a normal opt-in join link instead.

## v0.0.21 verified market follow-ups

A successfully delivered live-price response creates a 20-minute in-memory market context for the same member, enabling natural follow-ups such as “what was the all time high”. A narrowly phrased standalone English ATH question is recognized in the dedicated Sumcoin group. Historical values are calculated from SumcoinPrice's validated OHLC history. The bot does not infer another asset's ATH or share a member's vague conversation context across members.

## v0.0.23 conversational routing and Groq transparency

- "whats the change over the last day" after a price quote resolves to verified trailing-24-hour performance for the same member, without a Groq call. Other recognized periods remain deterministic.
- When `AUTO_AI=true` and model credentials are configured, only unclear, genuinely market-related questions can use a single quota-counted model request to classify intent. Model output is an enum, not a market fact. All historical figures and live prices continue to come exclusively from the validated public APIs. If the model is unavailable or uncertain, the bot asks a simple clarification without inventing figures.
- Group admins can send `/diagnostics` to inspect model configuration, quota use and last attempted model call. Reply to a group message with `/why` to inspect ephemeral routing (one hour / max 500 decisions); reply to a bot answer with `/engine` for answer provenance. Neither inspection stores raw message text.
- Model-generated Markdown emphasis and fake numbered `Sources` lines are cleaned up; approved source URLs are appended by the application. Optional Groq still requires `AI_ENABLED=true` and `AUTO_AI=true` in the private `.env` for automatic use. Direct `/ask` can use AI even with `AUTO_AI=false`.

## v0.0.22 group conversational routing

A clearly worded daily SUM market-status question routes to `range=1d&pair=usd`, reports trailing-24-hour index performance and verifies the response. A casual check-in without a command responds only if the same member has received a bot answer in the past 90 seconds, or explicitly mentions/replies to the bot. Never respond to generic chat among other group members. These paths do not invoke Groq. Admin messages still suppress unsolicited chatter.
