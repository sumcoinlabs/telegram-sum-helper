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
| `data/learning.json` | Hashed patterns, moderator drafts and approved answers | **Never** |
| `data/escalations.json` | Review queue and verified reviewer registration | **Never** |
| `data/group-index.json` | Privacy-filtered new group excerpts (90-day / 5,000 cap) | **Never** |
| `data/synced.json` | Approved public docs snapshot | **Never** (regenerated) |
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

Download the versioned ZIP to the Mac and run its `scripts/push-update.sh` from the extracted root. It clones the existing repository into a temporary directory under `~/Documents`, verifies the approved base version and key checksums, runs the regression suite, stages only public source files, then commits and tags the new version. It neither force-pushes nor includes `data/` or `.env`. Deploy on VM using `git pull --ff-only origin main`, tests and a user-service restart.

See [CHANGELOG.md](../CHANGELOG.md) for all historical changes.
