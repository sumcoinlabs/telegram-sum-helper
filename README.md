# Telegram Sum Helper

**v0.0.3 — multilingual Sumcoin community support bot (Node.js 20+).**

**0.0.3 hotfix:** Telegram HTTP 429 flood-control responses now automatically retry the rejected send after Telegram's `retry_after` delay (up to two retries, 120 seconds each). Group replies are sent through a queue paced at 3.1 seconds, without charging Telegram Stars or changing the optional AI configuration. Unlike a rejected 429, network timeouts are never blindly retried because delivery may have succeeded. This is a local-test-verified change; the production service must be updated and restarted.


`telegram-sum-helper` is a source-grounded first-line assistant for the Sumcoin Telegram community. It is **not a bank, exchange, wallet recovery service, blockchain node, or human administrator**. It cannot send or access coins. It never guarantees that Sumcoin's index-derived USD reference value can be converted into cash. Source code uses the official Telegram Bot API over native Node.js `fetch`, **no third-party runtime packages**, and optional OpenAI Responses API. This repository was **not forked from any Telegram bot GitHub repository**.

**Status:** local test suite included. Do not call this production-validated until you test in the live group. It starts in observation mode and never automatically deletes, mutes or bans people.

## New in 0.0.2

- Welcome legitimate questions in members' own languages; **no English-only reprimands**. Admin commands still use English. A group can keep English for official announcements.
- Detect message language first, with Telegram `from.language_code` as a fallback when ambiguous. This locale code reflects a UI preference, not proof of the message language. `/language CODE` temporarily chooses response language for the member; `/language auto` restores detection. Preferences last 24 hours in RAM and are not saved.
- Translated common Sumcoin facts in English, Spanish, Portuguese, French, German, Italian, Russian, Arabic, Hindi, Chinese, Japanese and Korean. Translations cover the core USD/cash-out distinction and seed-safety warning. Expanded troubleshooting translations exist for several languages. **Not every article has a human-reviewed translation.** Without an AI key, untranslated details are presented in English with a notice; the bot never silently claims to translate them.
- Optional AI uses the user's chosen/detected language to answer **source-grounded** questions. AI can usually handle additional languages (including Turkish and Indonesian), but quality varies and an active supported model/API key is required.
- Localized support intent recognition for cash-out, scam reports, missing balances, pending transfers, migration, staking, index, and other common topics; more careful avoidance of unsolicited replies to ordinary conversation.
- Telegram command menus localized for Spanish, Portuguese, French, German, Italian, Russian and Chinese, using Telegram's `language_code` command-menu feature.
- Questions from different users no longer unnecessarily share the same `/ask` throttle.
- Optional automatic AI replies can be enabled deliberately, but **`AUTO_AI=false` by default**. Explicit `/ask` and bot mentions work in `observe` mode.
- `AI_DAILY_LIMIT=100` default request ceiling, `ALLOW_PRIVATE_CHATS=false` by default. AI requests use `store:false` and short-lived conversation context in memory.
- Learning now records **SHA-256 fingerprints, topic, language, timestamps and aggregate counts** instead of member text by default. Set `LEARNING_STORE_EXAMPLES=true` only if administrators have informed the group and knowingly accept the privacy tradeoff. Group member statements cannot create factual answers without a reviewed official source and explicit admin approval.
- `/feedback` (reply to a bot answer) stores a bot message ID only, and `/feedbacks` shows recently flagged bot messages to administrators. Neither command stores the reporting member's message.
- Includes an upgrade script that pushes v0.0.2 onto an existing `sumcoinlabs/telegram-sum-helper` repository without force-pushing.

## Why this is useful

A message such as **“Como puedo retirar 100 dolares de mi wallet sumcoin?”** is answered in Spanish: the wallet holds SUM, not deposited dollars; the displayed USD index is a reference, not an amount available for withdrawal. Likewise for Portuguese, French, Russian, Arabic, Chinese, Japanese and other recognized messages. It provides an official source rather than marketing promises. The bot should never imply that a buyer, exchange, kiosk or cash withdrawal is guaranteed.

**Scope:** official curated support knowledge about SUM/index valuation versus liquidity, Proof-of-Stake, wallets/BIP39, Slice migration, staking, sending/receiving, Electrum sync, pending transfers, public explorer checks, fees, scam avoidance, and GitHub repositories. Synchronized public documents can contain obsolete facts; conflicting legacy PoW/PoS and migration terms must be escalated rather than guessed. The bot is not a general-purpose multilingual translation engine and cannot diagnose an individual user's wallet account.

## Publish v0.0.3 over the existing v0.0.2 repository

Download **`telegram-sum-helper-v0.0.3.zip`** into your Mac's Downloads folder, then run **one block**:

```bash
mkdir -p ~/Documents/telegram-sum-helper-v0.0.3 && \
unzip -oq ~/Downloads/telegram-sum-helper-v0.0.3.zip -d ~/Documents/telegram-sum-helper-v0.0.3 && \
cd ~/Documents/telegram-sum-helper-v0.0.3/telegram-sum-helper && \
bash scripts/push-update.sh
```

This verifies local tests and `gh` login `sumcoinlabs`, clones the existing `main` branch into a temporary staging directory under `~/Documents`, applies the release files, creates a normal commit, pushes it to `main`, and tags `v0.0.3`. No force push, no backup archives, no production server modifications. **The repository must exist first.** Use this updater on the existing repository; it is not a first-time repository creation script.

## Install, run, and connect

1. Create a new Telegram bot using `https://t.me/BotFather`, keep its API token private. Copy `.env.example` to `.env` and set `TELEGRAM_BOT_TOKEN`, `ALLOWED_CHAT_USERNAME=sumcoins` (ideally also exact `ALLOWED_CHAT_ID` after adding the bot). Keep `.env` mode 600. Do not publish tokens, seed words, or Telegram exports.
2. Start with `INITIAL_MODE=observe`, which sends **no unsolicited answers**. Verified admin commands and explicit `/ask` still work. To read normal group messages, bot privacy mode must be disabled in BotFather, or the bot given the minimal administrator access needed; do **not** grant deletion/ban permissions.
3. On Node.js 20+, run `npm test`, then optionally `npm run sync` (requires internet; fetches allowlisted official documentation), then `npm start`. Run `npm run sync` again and restart the bot when refreshing a cached index. A hardened systemd example is in `deploy/telegram-sum-helper.service`.
4. Use admin `/stats` and `/learn` to inspect observed topics/languages; review the messages in Telegram for errors before `/mode reply`. **`state.json` persists old mode** if upgrading a running instance: explicitly run `/mode observe` before testing a v0.0.3 upgrade if v0.0.1 was previously in reply mode.
5. For AI responses, add `OPENAI_API_KEY` and an available `OPENAI_MODEL` (example `gpt-4.1-mini`); verify model availability and pricing for your API account. Without a key, `/ask` performs local retrieval and replies with approved information. Personal message text sent through `/ask` is sent to the external AI provider **only when an API key is enabled**, with best-effort local secret detection and `store:false`. Do not post private recovery data to Telegram at all.

### Commands

**Members:** `/help`, `/ask <question>`, `/language en|es|pt|fr|de|it|ru|ar|hi|zh|ja|ko|tr|id|auto`, `/cashout`, `/wallet`, `/migration`, `/staking`, `/security`, `/index`, `/fees`, `/find <keywords>`, `/github <keywords>`, `/sources`, `/rules`, `/feedback` (reply to bot answer).

**Verified Sumcoin group admins:** `/chatid`, `/mode observe|reply`, `/stats`, `/feedbacks`, `/learn`, `/review`, `/teach QUESTION | ANSWER | OFFICIAL_URL`, `/approve NUMBER`, `/reject NUMBER`. Only official domains from a fixed allowlist are permitted as learning sources, but admins must **actually verify the source supports the proposed answer** before approval; an official URL alone does not make a claim true.

**Learning/import:** `npm run analyze -- /path/to/result.json` prints aggregated topics/languages. `npm run ingest -- /path/to/result.json` seeds hashed support-question patterns from Telegram Desktop exports. Both operate locally; neither uploads the export. Import only when group notices/consent and applicable privacy requirements are met.

## Official knowledge and GitHub references

Initial curated knowledge is in `knowledge/curated.json`; synchronization is restricted to allowlisted URLs in `src/sync.js`. Index references include:

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

`/github` searches **allowlisted repository file paths**, not every line of GitHub source, and may be rate-limited. `/find` searches curated and locally synced approved documents. Neither feature searches arbitrary third-party links. Do not publish old fixed-rate claims, wallet-migration eligibility, exchange listing claims or live prices without fresh verification. AI can still hallucinate despite grounding; citations are appended by the application, not invented by the model.

## Security and limits

The bot needs a **Telegram API token**, not any Sumcoin wallet key, and no blockchain RPC credentials. Admin commands verify status via Telegram. It ignores arbitrary groups and private chats by default, respects group cooldowns, rejects declared seed exposures as best it can, and uses official HTTPS allowlists. The learner cannot turn unreviewed member posts into facts. The daily AI quota is aggregate, not a billing guarantee; review your API account's independent spending caps. Conversation history and language preferences are in memory (lost on restart). The learner's fingerprint hashes are privacy-minimizing, not mathematically anonymous: do not treat them as sufficient for unrestricted collection of chat data. `data/` and `.env` are ignored by Git.

## Tests

```bash
npm test
npm run check
npm run search -- "retirar dólares de Sumcoin"
```

Tests use mocks and local fixtures; they do not contact or exercise the real Telegram community, real OpenAI account, or production blockchain.

MIT license. Unofficial Telegram/OpenAI integration built for the Sumcoin community.
