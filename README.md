# Telegram Sum Helper

**v0.0.8 — natural-language, free Sumcoin community support with human review.**

The bot now assists ordinary group conversations without requiring `/ask`. It answers recognized Sumcoin support questions using reviewed sources, avoids administrator messages and ordinary chat, and sends unfamiliar questions to a verified `@SumcoinAdmin` account for private review. It remains a **retrieval-based help system, not a trained LLM**. OpenAI remains completely optional. The existing 14-language UI, P2P rates, read-only blockchain lookups, and historical-data safeguards are retained.

## v0.0.8 activation — important order

1. **Deploy** v0.0.8 as existing `electrumbtc1`. The existing persisted `observe` mode stays off until you deliberately enable it.
2. For dependable admin exclusion, **make `@SumcoinHelperBot` a group administrator with the minimum available privileges**. Telegram does not guarantee `getChatMember` for other users unless the bot is an administrator. An alternative is disabling BotFather group privacy (`/setprivacy`) and removing/re-adding the bot, but the implementation intentionally skips automatic answers if it cannot verify a member's admin status. The bot needs to see ordinary messages; Telegram's default privacy mode blocks them. Do not grant dangerous moderation permissions.
3. From the real group-admin account `@SumcoinAdmin`, open a **private** chat with `@SumcoinHelperBot` and send `/start`. The bot checks this handle and current group-administrator status, then registers the *numeric Telegram account ID* for private notifications. The bot cannot initiate a private chat with an account that has not started it.
4. From an administrator account inside `@sumcoins`, send `/mode reply`. Only after this will ordinary support questions receive automatic replies. `/mode observe` returns it to observation.

An ordinary member can now write **“Why are my Sumcoin coins not showing?”**, **“How does staking work in Sumcoin?”** or **“What's the current Sumcoin price today?”** without a command. Informal conversations, non-support chatter, bot messages, messages posted as a channel/anonymous admin, and regular admin posts are excluded. Explicit commands remain available.

### No unwanted replies

A member can **reply directly to an assistant message with `No thanks`**, `No gracias` or `Não preciso`, or use `/stop@SumcoinHelperBot`. The assistant then stops replying proactively to that member for 24 hours (stored in memory). `/resume@SumcoinHelperBot` reenables help immediately. Manual `/ask` or other explicit commands still work. The bot doesn't interpret an unrelated person's “no thanks” in a normal chat as an opt-out.

### Human escalation and unattended fallback

If the bot cannot verify a specific technical answer, it queues a **short, sanitized question**, sends a short acknowledgement, and privately notifies the verified `@SumcoinAdmin` account with a queue number. Only the account that enrolled and is still an active group admin can receive these messages. Private review commands:

```
/review
/answer 12 | Verified answer here | https://github.com/sumcoinlabs/sumcoin
/skip 12
```

The answer is admitted to the approved fact library only if the existing source/domain and safety filters accept it. The bot then posts that approved answer as a reply to the member's original group message. **Messages are not auto-trained as facts.** If a question remains unanswered for **20 minutes**, a timer based on Telegram polling posts the closest *verified* guidance with an explicit note that the exact answer is not yet confirmed. The review remains open for an admin. If nothing is verified, the bot provides an official reference instead of pretending to know. Notifications are deduplicated and capped; normal automatic replies have short per-user and per-topic cooldowns.

For privacy, the queue persists the redacted question (up to 240 characters), group/chat message identifiers, status, and timestamps for up to seven days, **not the group member's Telegram user ID**. Review-member cooldown identifiers exist in process memory only. The reviewer's numeric Telegram ID is saved locally in `data/escalations.json` with private file permissions. `.env` and `data/` are never committed.

### Knowledge expansion and YouTube transcripts

The reviewed FAQ library expands to **52 topics**, adding current Core/mobile distinctions, UTXO concepts, confirmed/unconfirmed explorer data, sumcoinlib transaction-format compatibility, witness activation caveats, RPC security, and source age/history. Existing `npm run sync` sources stay in place.

The submitted video [`_dq55ykFDHs`](https://youtu.be/_dq55ykFDHs) can be indexed **once its transcript is supplied**. This release intentionally does **not** assert any video facts: YouTube's transcript could not be reliably retrieved and verified. Save your copied YouTube transcript as a plain-text UTF-8 `.txt` file, copy it to a path on the VM, then run:

```
cd /home/electrumbtc1/telegram-sum-helper
npm run import:video -- /home/electrumbtc1/transcripts/sumcoin-video.txt
systemctl --user restart telegram-sum-helper.service
```

This imports transcript excerpts as **unreviewed reference material**, attributed to the video, and lets `/find` discover them. It does not automatically promote claims (possibly describing older software) into trusted current facts. A verified administrator can promote specific sourced statements through the normal approval workflow.

### Releasing v0.0.8

On your Mac after downloading the ZIP to Downloads:

```
mkdir -p ~/Documents/telegram-sum-helper-v0.0.8 && \
unzip -oq ~/Downloads/telegram-sum-helper-v0.0.8.zip -d ~/Documents/telegram-sum-helper-v0.0.8 && \
cd ~/Documents/telegram-sum-helper-v0.0.8/telegram-sum-helper && \
bash scripts/push-update.sh
```

On the VM as `electrumbtc1`, once the GitHub push completes:

```
bash <<'SH'
set -Eeuo pipefail
cd /home/electrumbtc1/telegram-sum-helper
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 24 >/dev/null
git pull --ff-only origin main
test "$(node -p "require('./package.json').version")" = '0.0.8'
npm run check
npm run sync
systemctl --user restart telegram-sum-helper.service
systemctl --user --no-pager status telegram-sum-helper.service
journalctl --user -u telegram-sum-helper.service -n 15 --no-pager
SH
```

The bot starts in the *persisted* previous mode; the release does not automatically enable unsolicited replies. Existing state, learning, and API credentials remain unchanged.

---

## Earlier version: v0.0.7

## New in v0.0.7 — clearer peer-to-peer rates, localized currencies, and less repetition

Normal answers now describe SUM as a peer-to-peer cryptocurrency and the Sumcoin Index as its **reference rate for direct trades**. A typical `/price` answer is: **“Sumcoin peer-to-peer reference rate — 1 SUM ≈ [live value] [currency]. People agree on the final rate directly when trading.”** Scam/recovery warnings remain where they actually belong; `/ask` stops automatically adding unrelated related-topic cautions. `/more` still provides deeper source-backed context.

**Currency is not the same thing as language.** `/price` uses a helpful default based on Telegram's language preference; if a regional locale like `es-MX`, `pt-PT`, or `en-GB` is available, that region determines the default. Otherwise generic Spanish stays in USD (no assumption that everyone speaks Spanish in Spain), Portuguese defaults to BRL, German to EUR, Japanese to JPY, and so on. The bot uses the corresponding **real record** from the existing approved 31-currency rate feed; it does not synthesize FX rates. If an automatically suggested currency is missing from the feed, it uses the explicitly labeled USD rate instead. An explicitly selected unavailable currency reports unavailable rather than silently changing currencies.

**New commands:**

```
/price@SumcoinHelperBot             # Suggested local currency, based on locale
/price@SumcoinHelperBot BRL         # One-time currency override
/price@SumcoinHelperBot EUR         # One-time currency override
/currency@SumcoinHelperBot MXN      # Save a preference for 24h (in memory)
/currency@SumcoinHelperBot auto     # Return to automatic selection
/language@SumcoinHelperBot es       # Choose reply language
/guide@SumcoinHelperBot pending    # Troubleshooting guide
```

**14 languages for the key support paths:** English, Spanish, Portuguese, French, German, Italian, Russian, Arabic, Hindi, Chinese, Japanese, Korean, Turkish and Indonesian. Price display, eight troubleshooting guides, basic blockchain/explorer output, and 12 high-frequency knowledge topics now have authored translations. More specialized technical topics are **not falsely claimed to be translated**: English details are clearly identified when no reviewed translation exists. Language detection uses message text first and Telegram locale as a fallback. More language coverage can be added incrementally without a paid API.

**No extra services or billing:** uses the existing rate endpoint, fixed HTTPS hosts, Node.js built-ins, Telegram Bot API and existing user-level systemd unit. No new dependency, server port, automatic group reply, admin privilege, wallet key, or database. No `.env` changes. Rate and explorer lookup tests use mocked API responses; validate them against the live endpoints after upgrading.

### Publish v0.0.7 on your Mac

Download `telegram-sum-helper-v0.0.7.zip` to Downloads, then:

```bash
mkdir -p ~/Documents/telegram-sum-helper-v0.0.7 && \
unzip -oq ~/Downloads/telegram-sum-helper-v0.0.7.zip -d ~/Documents/telegram-sum-helper-v0.0.7 && \
cd ~/Documents/telegram-sum-helper-v0.0.7/telegram-sum-helper && \
bash scripts/push-update.sh
```

The publisher checks the GitHub `main` base, runs all regression tests and stages only release files; no force-push.

### Deploy on the existing VM as `electrumbtc1`

```bash
bash <<'SH'
set -Eeuo pipefail
[ "$(whoami)" = 'electrumbtc1' ]
cd /home/electrumbtc1/telegram-sum-helper
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 24 >/dev/null
git pull --ff-only origin main
test "$(node -p "require('./package.json').version")" = '0.0.7'
npm run check
systemctl --user restart telegram-sum-helper.service
systemctl --user is-active telegram-sum-helper.service
journalctl --user -u telegram-sum-helper.service -n 12 --no-pager
SH
```

---

## v0.0.6 — SUM/USD price compatibility hotfix

The production rates API returns an array of currency records, each with `code`, `price`, `n`, and `name`. `/price` now selects the row labeled `USD` and reads the numeric `n` field. Bad, missing, duplicate or implausible USD entries are rejected; all 94 earlier tests and 2 new regressions pass. The broader knowledge improvements below were introduced in v0.0.5.

## New in v0.0.5 — richer free knowledge and read-only diagnostics

This release adds **40 curated knowledge topics**, eight step-by-step guides (`/guide`), expanded Spanish/Brazilian Portuguese explanations, and four `sumcoinlib` official GitHub sources. The official document sync grows from 13 to **17 fixed sources**; actual imported chunks depend on current source availability.

**New Telegram commands (available in `observe` mode):**

```
/price@SumcoinHelperBot
/tx@SumcoinHelperBot 64_CHARACTER_PUBLIC_HEX_TXID
/address@SumcoinHelperBot PUBLIC_SUMCOIN_ADDRESS
/guide@SumcoinHelperBot zero
/guide@SumcoinHelperBot restore
/guide@SumcoinHelperBot pending
/guide@SumcoinHelperBot staking
/guide@SumcoinHelperBot connect
/guide@SumcoinHelperBot migration
/guide@SumcoinHelperBot fees
/guide@SumcoinHelperBot trade
```

- `/price` requests a current SUM/USD **reference** rate from `https://rate.slicewallet.org/api/rates`. The code accepts only explicitly USD-labeled numeric results. If the API has changed shape or becomes unavailable it explains that the quote could not be verified; the bot never invents a value. The **live endpoint and response mapping have not been validated against the VM**: test `/price` after deployment before announcing it as operational.
- `/tx` requests read-only public confirmation information from `https://sumcoin.space/api/tx/<txid>`, validating a 64-hex-character txid and confirming the returned txid matches the requested one. `/address` reads a public Insight address summary from the same fixed official explorer. Real deployed route availability must be confirmed after deployment. If the endpoint fails or reports unknown fields, the bot says the lookup is unavailable and shows the link rather than inventing network state. **All addresses submitted in Telegram are visible to group members.**
- The code rejects redirects, uses short network timeouts, caps response bytes, and never accepts arbitrary hosts from members. It does **not** query or expose local Core RPC, touch wallet keys, sign transactions, or write to the chain.
- Natural-language questions such as `/ask What is the current Sumcoin price?` use the live price path, while `/ask How is the index calculated?` retains documented methodology rather than implying a current bid.
- New synced raw GitHub documents are still **only references** until facts are separately reviewed. Historical PoW documents are not promoted automatically. The old index FAQ (`www.sumcoinindex.com/page/faq`) is **not** in the new sync allowlist pending inspection of a suspicious PHP snippet found in web-indexed content.
- Nothing changes your `.env`, systemd unit, existing `data/` folder, `INITIAL_MODE=observe`, NVM installation, or OpenAI usage (still zero without a key).

## New in 0.0.4 — free answer improvements

- `/ask` now builds a more useful answer from the most relevant **curated, reviewed facts**, a topic-specific clarification, and related curated context, citing official sources. It is deterministic source-grounded text, **not a local LLM or generative AI**. It uses zero OpenAI calls when no API key is set.
- `/more` expands the member's latest support topic; an explicit reply/mention like **“Can you explain that in more detail?”** may reuse the last topic. Only a topic identifier and detected language are kept in RAM, for at most 30 minutes per member+chat (500-record upper bound). No conversation text is saved for this feature.
- Better **Brazilian Portuguese** reviewed answers for the index, wallet, staking, missing balances, migration, fees, chain and more. Spanish follow-up explanations expanded. Improved Portuguese-vs-Spanish detection for index questions. Untranslated languages remain explicitly limited rather than pretending scraped English text was translated.
- Synced official pages are linked as additional reading, but **their unreviewed text is not automatically asserted as fact**. The older white paper and other historic PoW-era documents may not match current PoS network settings.
- Automatic unsolicited answers stay short and require admin `/mode reply`; existing credentials, persisted mode, cooldowns, Telegram 429 retry logic, and non-root systemd installation remain unchanged.
- `/more` is included in Telegram command menus, including Spanish and Portuguese descriptions. New deterministic regression tests cover localization, follow-up isolation, offline sources and legacy-document precautions.
- Ordinary announcements that mention `@SumcoinHelperBot` are ignored unless they directly address the bot or ask it a question; explicit `/ask` and `/help` continue to work in observation mode.

**Try in `@sumcoins`:**

```
/ask@SumcoinHelperBot How does Sumcoin calculate its value?
/more@SumcoinHelperBot
/ask@SumcoinHelperBot ¿Cómo puedo retirar mis Sumcoin a una cuenta bancaria?
/ask@SumcoinHelperBot Como posso sacar meus Sumcoin para uma conta bancária?
/ask@SumcoinHelperBot Como o valor do Sumcoin é calculado pelo índice?
```

Do not share recovery phrases or keys. All bot replies in the group are public.

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

## Publish v0.0.4 on the existing GitHub repository

Download `telegram-sum-helper-v0.0.4.zip` to your Mac's Downloads folder, then run:

```bash
mkdir -p ~/Documents/telegram-sum-helper-v0.0.4 && \
unzip -oq ~/Downloads/telegram-sum-helper-v0.0.4.zip -d ~/Documents/telegram-sum-helper-v0.0.4 && \
cd ~/Documents/telegram-sum-helper-v0.0.4/telegram-sum-helper && \
bash scripts/push-update.sh
```

The publisher checks the current known `main` base, requires GitHub CLI login `sumcoinlabs`, tests the release, copies only the changed release files into a temporary staging clone, and fast-forward pushes a normal commit and tag `v0.0.4`. **No force-push.** If GitHub changes unexpectedly, it stops rather than overwrite subsequent work.

On the VM, run as `electrumbtc1` (never root):

```bash
cd /home/electrumbtc1/telegram-sum-helper && \
export NVM_DIR="$HOME/.nvm" && \
source "$NVM_DIR/nvm.sh" && \
nvm use 24 >/dev/null && \
git pull --ff-only origin main && \
npm run check && \
systemctl --user restart telegram-sum-helper.service && \
systemctl --user --no-pager -l status telegram-sum-helper.service
```

The server's `.env` and `data/` (including the existing 71 cached documents, learning and mode state) are untracked and preserved. The VM needs no new ports, paid model, or background daemon.

## Install, run, and connect

1. Create a new Telegram bot using `https://t.me/BotFather`, keep its API token private. Copy `.env.example` to `.env` and set `TELEGRAM_BOT_TOKEN`, `ALLOWED_CHAT_USERNAME=sumcoins` (ideally also exact `ALLOWED_CHAT_ID` after adding the bot). Keep `.env` mode 600. Do not publish tokens, seed words, or Telegram exports.
2. Start with `INITIAL_MODE=observe`, which sends **no unsolicited answers**. Verified admin commands and explicit `/ask` still work. To read normal group messages, bot privacy mode must be disabled in BotFather, or the bot given the minimal administrator access needed; do **not** grant deletion/ban permissions.
3. On Node.js 20+, run `npm test`, then optionally `npm run sync` (requires internet; fetches allowlisted official documentation), then `npm start`. Run `npm run sync` again and restart the bot when refreshing a cached index. A hardened systemd example is in `deploy/telegram-sum-helper.service`.
4. Use admin `/stats` and `/learn` to inspect observed topics/languages; review the messages in Telegram for errors before `/mode reply`. **`state.json` persists old mode** if upgrading a running instance: explicitly run `/mode observe` before testing a v0.0.4 upgrade if v0.0.1 was previously in reply mode.
5. For AI responses, add `OPENAI_API_KEY` and an available `OPENAI_MODEL` (example `gpt-4.1-mini`); verify model availability and pricing for your API account. Without a key, `/ask` performs local retrieval and replies with approved information. Personal message text sent through `/ask` is sent to the external AI provider **only when an API key is enabled**, with best-effort local secret detection and `store:false`. Do not post private recovery data to Telegram at all.

### Commands

**Members:** `/help`, `/ask <question>`, `/more` (last topic), `/language en|es|pt|fr|de|it|ru|ar|hi|zh|ja|ko|tr|id|auto`, `/cashout`, `/wallet`, `/migration`, `/staking`, `/security`, `/index`, `/fees`, `/find <keywords>`, `/github <keywords>`, `/sources`, `/rules`, `/feedback` (reply to bot answer).

**Verified Sumcoin group admins:** `/chatid`, `/mode observe|reply`, `/stats`, `/feedbacks`, `/learn`, `/review`, `/teach QUESTION | ANSWER | OFFICIAL_URL`, `/approve NUMBER`, `/reject NUMBER`. Only official domains from a fixed allowlist are permitted as learning sources, but admins must **actually verify the source supports the proposed answer** before approval; an official URL alone does not make a claim true.

**Learning/import:** `npm run analyze -- /path/to/result.json` prints aggregated topics/languages. `npm run ingest -- /path/to/result.json` seeds hashed support-question patterns from Telegram Desktop exports. Both operate locally; neither uploads the export. Import only when group notices/consent and applicable privacy requirements are met.

## Official knowledge and GitHub references

Initial curated knowledge is in `knowledge/curated.json`; synchronization is restricted to allowlisted URLs in `src/sync.js`. Index references include:

- https://www.sumcoin.org/about/
- https://www.sumcoin.org/faq/
- https://www.sumcoin.org/migrations/
- https://www.sumcoin.org/sumcoin-marketplace/
- https://sumcoinwallet.org/
- https://www.sumcoinindex.com/white-paper.html
- https://github.com/sumcoinlabs/sumcoin
- https://github.com/sumcoinlabs/sumcoin_flutter
- https://github.com/sumcoinlabs/insight-sum-api
- https://github.com/sumcoinlabs/insight-sum-ui
- https://github.com/sumcoinlabs/electrumx

`/github` searches **allowlisted repository file paths**, not every line of GitHub source, and may be rate-limited. `/find` searches curated facts and locally synced official documents (which may contain outdated information). Neither feature searches arbitrary third-party links. Do not publish old fixed-rate claims, wallet-migration eligibility, exchange listing claims or live prices without fresh verification. AI can still hallucinate despite grounding; citations are appended by the application, not invented by the model.

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
