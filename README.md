# Telegram Sum Helper

**Version 0.0.1 — source-grounded Sumcoin community assistant**

A Telegram support assistant for the official `@sumcoins` community. Built with Node.js 20+ using the official Telegram Bot API, a curated Sumcoin knowledge library, optional live indexing of allowlisted official documentation, live GitHub repository-file search, and optional AI-supported conversations. It learns recurring question patterns, but unreviewed community claims cannot become authoritative answers.

**Not deployed by this source package.** The default operating mode is `observe` (no unsolicited replies). The bot has no wallet access, no token transfer rights, no moderation delete/ban privileges, and no authority to redeem Sumcoin for USD.

## What is genuinely intelligent?

1. **Offline grounded search:** 15+ carefully written support articles in `knowledge/curated.json`. `/find` and `/ask` work without an AI key and provide official source URLs.
2. **Documentation retrieval:** `npm run sync` retrieves and indexes **13 explicitly allowlisted URLs** on `sumcoin.org`, `sumcoinwallet.org`, the project white paper and public `sumcoinlabs` GitHub docs. It writes a locally searchable snapshot to `data/synced.json`. The snapshot is optional; the curated baseline works offline. No user-provided URL can be crawled.
3. **Live GitHub search:** `/github wallet restore` searches the **paths of public files** in six allowlisted `sumcoinlabs` repositories via the GitHub API and returns relevant file links. This is not arbitrary code-search across GitHub; `/find` covers indexed README/documentation content.
4. **Conversational replies:** With `OPENAI_API_KEY` configured, `/ask` or `@BotUsername` asks a model to synthesize an answer **only from retrieved context**, with source links appended by code. Without a key, the bot returns extractive, grounded answers. Conversation memory is in RAM for at most 30 minutes; API requests set `store:false`.
5. **Learning:** The bot counts recurring, redacted question patterns and automatically recognizes repeated phrasing (three or more matching questions with a known topic). Verified admin answers containing an official URL are queued for moderation. `/teach`, `/review`, `/approve` and `/reject` let administrators expand the FAQ. **It NEVER learns factual claims from arbitrary group members as truth.**
6. **Multilingual:** Common Spanish help requests are recognized (including *Como puedo retirar 100 dolares de mi wallet sumcoin?*), and an AI model can handle broader multilingual nuance. The group remains English-speaking.

## Verified project information included

| Area | Coverage |
| --- | --- |
| What SUM is | P2P Layer 1 currency, index reference valuation, PoS transition |
| Cashing out | Not a bank deposit, index rate vs tradeable USD price, counterparty liquidity |
| Wallets | Self-custody, Electrum, compatible mobile wallet, sending and receiving |
| Recovery | 24-word BIP39, avoiding seed exposure, legacy format incompatibility |
| Migration | PoW/Slice to PoS, current migration source, no unverified promises |
| Staking | PoS and the distinction between Core staking and non-minting mobile wallet |
| Blockchain | Confirmation, transaction IDs, transfers, reversals, network fees |
| Troubleshooting | Empty/zero balance, pending transfers, stale Electrum backends |
| Marketplace | Peer-to-peer payments/trade, kiosk availability is not guaranteed |
| Engineering | Source code, Insight API/UI, Flutter wallet, ElectrumX, Core docs |
| Security | Seed phrase scams, fake exchange offers, fraudulent withdrawal fees |

Primary sources checked for the initial release (October 31, 2026):

- https://www.sumcoin.org/about/
- https://www.sumcoin.org/faq/
- https://www.sumcoin.org/migrations/
- https://www.sumcoin.org/sumcoin-marketplace/
- https://sumcoinwallet.org/
- https://sumcoinindex.com/white-paper.html
- https://github.com/sumcoinlabs/sumcoin
- https://github.com/sumcoinlabs/sumcoin_flutter
- https://github.com/sumcoinlabs/insight-sum-api
- https://github.com/sumcoinlabs/insight-sum-ui
- https://github.com/sumcoinlabs/electrumx
- https://github.com/sumcoinlabs/sumcore

**Editorial caution:** Some public pages still mix legacy proof-of-work mining with current proof-of-stake information; the migration page contains date/fee/eligibility-specific terms that may change. This bot points to current official pages rather than quoting potentially stale rules or promising transactions. The index figure is *not* a guaranteed cashout price. The bot does not certify factual claims solely because they appear on a website. External material remains untrusted input for AI.

## Publish to GitHub (Mac)

The `scripts/publish-github.sh` script verifies that **GitHub CLI is signed in as `sumcoinlabs`**, runs local tests, initializes `main`, and creates `sumcoinlabs/telegram-sum-helper` as a **public repository** without force-pushing or overwriting an existing repository. It needs `git`, `gh`, and a configured git username/email. Your Mac previously used `gh`.

```bash
cd /path/to/telegram-sum-helper
bash scripts/publish-github.sh
```

The script does **not** deploy the bot. Commit only source code; never commit `.env`, Telegram BotFather tokens, OpenAI keys, or group chat exports.

## Install / configure / run

```bash
# Node.js 20+; no external npm packages are required.
cp .env.example .env
# Edit .env locally to add your BotFather token, official group and optional AI key.
# Ensure .env is owner-only readable (chmod 600 .env).
npm test
npm run sync                         # optional but recommended; requires outbound HTTPS
npm run search -- "withdraw USD"  # inspect what the knowledge base knows
npm start
```

Use `@BotFather` in Telegram to create a bot. Save its secret token in `TELEGRAM_BOT_TOKEN`. Enter `ALLOWED_CHAT_USERNAME=sumcoins` and preferably `ALLOWED_CHAT_ID=-100...` for a stable, exact group binding. **To learn from ordinary group messages, make the bot an administrator with minimal permissions OR disable its privacy mode in BotFather and re-add it.** Telegram privacy mode otherwise filters most normal group messages. Do not grant delete/ban rights.

Running `/chatid` as a group admin prints the numeric Telegram chat ID. Start in observe mode and verify `/stats` and `/learn`. Run `/mode reply` only after evaluating behavior; the selected mode is persisted in `data/state.json`. In reply mode the bot responds conservatively to confident FAQs and to explicit `/ask` and mentions. `AUTO_AI=false` by default so normal group conversation does not automatically trigger paid model calls. Set `AUTO_AI=true` only after testing, with `OPENAI_API_KEY` configured. The `/ask` command can use the AI in either mode.

`OPENAI_API_KEY` is an optional key for the Responses API. `OPENAI_MODEL` is configurable and defaults to `gpt-4.1-mini` (check that it is available to your API account). OpenAI usage may incur fees. Without a key, this is still a functioning deterministic knowledge bot, but **not** a general conversational AI. When configured, user questions and retrieved public snippets are sent to that external model; do not send private wallet details to it.

`GITHUB_TOKEN` is optional for higher rate limits on public GitHub file-path searches. Any token should be read-only and stored in `.env`.

### Telegram commands

Public: `/help`, `/ask How can I withdraw $100?`, `/find wallet restore`, `/github Electrum wallet`, `/sources`, `/cashout`, `/wallet`, `/migration`, `/staking`, `/security`, `/index`, `/fees`, `/rules`.

Verified group admins only: `/mode observe`, `/mode reply`, `/stats`, `/chatid`, `/learn`, `/review`, `/teach Question | Verified answer | https://sumcoin.org/...`, `/approve 4`, `/reject 4`.

Use `/teach` to propose a new fact and cite one of the explicitly approved official hosts. The proposal has no effect until an admin reviews it with `/review` and runs `/approve ID`. New repetitive *phrasings* can be learned automatically without permitting Telegram members to invent factual knowledge.

### Automatic learning, privacy and abuse controls

- Observes only help-style messages related to Sumcoin; not general chat or DMs.
- Keeps only redacted question examples, fingerprints, counts and last-seen timestamps for up to 30 days in `data/learning.json` (not committed). Filtering is best-effort, **not a guarantee of anonymization**; set `LEARNING_ENABLED=false` if storing any question excerpts is unacceptable. Do not ingest historical chats without appropriate group notice/consent.
- Does not store member IDs in knowledge or learning files. In-memory message cooldowns and short-lived AI context use Telegram IDs for routing and expire on restart or timeout.
- Excludes identified seed/recovery key questions from the learner and warns about secret disclosure. Never posts credentials or requests money, seed words or private keys.
- Automatically prevents repeated responses per user and topic, and has a group-level throttle. No auto-delete or banning.
- An administrator's public reply containing an official source URL becomes a **pending suggestion**, not a verified fact. An admin must review and approve it.
- Synchronized websites can contain stale or malicious text. Requests are limited to a fixed HTTPS allowlist, with strict size/time limits and no redirects. Information is treated as untrusted text; it cannot alter bot policy or execute code.
- AI answers can still make mistakes. Review a representative sample before allowing automatic replies and never use this for custody advice.

### Exports and tests

```bash
npm test
npm run analyze -- /path/to/telegram-export/result.json
npm run ingest -- /path/to/telegram-export/result.json
```

`analyze` prints only aggregate topic/language counts from a Telegram Desktop JSON export; `ingest` learns redacted question patterns for local future classification. Neither command uploads the export or saves member IDs. In Telegram Desktop, open the group, choose Export chat history, select machine-readable JSON, and review consent/privacy requirements before importing. Add a README section or GitHub issue for missing support topics before trusting them as factual answers.

### Systemd deployment

An example hardened systemd service is provided in `deploy/telegram-sum-helper.service`. It assumes an unprivileged `telegrambot` service account, `/opt/telegram-sum-helper` deployment directory and `/usr/bin/node`; adapt the Node path and permissions to your server. Make `data/` writable by that user, but not by the public web server. **Do not deploy onto a production blockchain or explorer node until you have reviewed resource isolation and security.**

## Implementation summary

- Direct official Telegram Bot API long polling via Node.js `fetch` — not forked from third-party Telegram bot repositories.
- Optional OpenAI Responses API for source-grounded answers; `store:false` and short-lived in-memory conversational context.
- Local lexical retrieval over verified human-authored support articles and optionally refreshed official documents.
- Limited live GitHub repository-tree search over the official `sumcoinlabs` account.
- Admin-approval learning pipeline and conservative, explicitly scoped group behavior.
- Zero runtime npm dependencies. Continuous integration runs `npm test` on GitHub Actions.

MIT licensed. No affiliation with Telegram or OpenAI is implied. This tool is intended for Sumcoin community information, not as an exchange, custodian, or security guarantee.
