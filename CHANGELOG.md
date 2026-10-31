## v0.0.17 — Hybrid automatic AI and language quality (2026-10-31)

- Opt-in `AUTO_AI=true` lets naturally worded, explanation-heavy group support questions invoke Groq automatically when reviewed sources match. Ordinary rate quotes, consensus and simple FAQs still use deterministic local paths. No AI call for unrelated chatter, unsupported claims or sensitive input.
- Expanded language-detection cues for short French explanations and common German, Italian, Turkish and Indonesian requests; preserves all 14 localized reviewed FAQ and price templates.
- Add `/engine` for group admins replying to a recent bot answer: identifies Groq, verified local, or live rate source without exposing a key or user data. In-memory answer provenance resets on restart.
- Weekly reports count live deterministic answers and local FAQ answers. Existing monthly/daily/hourly model caps, admin review, optional Groq and offline fallback remain.
- Reinstalls preserve `.env`, private group-index, historic fingerprints, pending moderation and all other runtime data.

## 0.0.16 — 2026-10-31

- Correct French natural-language live-price routing: “Combien vaut un SUM en Euro ?”, “Combien valent 5 SUM en euros ?” and “Quelle est la valeur de 1 SUM en EUR ?” now fetch an EUR rate from the read-only, approved rates API, with French interface copy. English prices and nonquestions retain their behavior.
- Add a private, repeatable `scripts/setup-groq.py` installer that differentiates HTTP 401/403/429 and prints only safe error codes/messages, not keys; model-permission failures do not change `.env`.
- On account-permission denial for GPT-OSS 120B, test GPT-OSS 20B as a free-tier fallback; only enable AI after a real model response. Existing secrets, learning and moderator data remain on the VM.
- Keep the 201 established regression tests plus French price intent and Groq setup security checks. No historical transcript, runtime data, credentials or server backups packaged.

## 0.0.15 — 2026-10-31

- Add optional Groq-hosted OpenAI GPT-OSS 120B Responses API, with fixed endpoint, separate API key and existing quota-protected offline fallback. Direct OpenAI remains supported; neither provider is enabled by default.
- Preserve Sumcoin's deterministic live prices and reviewed project documentation as the authority; Groq never receives raw Telegram history or unreviewed synced pages as authoritative material.
- Clarify ambiguous “pesos” questions and remember the same member's answer for five minutes, then resolve via the official live rate API; other members cannot hijack it.
- Expand provider disclosures, operations and regression tests. No production VM data or credentials packaged.

# Changelog

## v0.0.14 — code-first intelligence and guarded conversational mode

- Project code and reviewed current facts remain primary; historical and unreviewed sources stay nonauthoritative.
- Optional OpenAI reasoning is opt-in with hourly, daily and monthly request ceilings, plus automatic no-key, budget-exhaustion and API-error fallback. No guarantee of zero API charges.
- Added source-linked, approval-required admin corrections, reversible with `/revoke`, and seven-day privacy-preserving `/weekly` quality reporting.
- Added an opt-in weekly admin DM after verifying administrator role; no raw group messages are reported.
- Kept the v0.0.13 historical import stream unchanged and idempotent, so the 743 patterns can be installed privately when the user runs it.


## 0.0.13 — 2026-10-31

- Fail closed for privileged group commands when Telegram administrator verification fails, while still suppressing uncertain automatic replies (prevents accidental privilege escalation during API outages).
- Derive the startup version from `package.json` instead of a stale hardcoded banner; add admin-only `/status` reporting version, response engine, source freshness, retained historical patterns and news failures without exposing secrets.
- Improve unattended public-news synchronization: print source-level failures, preserve previously fetched publisher metadata with a visible stale flag, and never treat news as reviewed protocol truth.
- Safely import historical Telegram questions by streaming the owner's export through SSH without storing raw messages on the VM; pause and restart the bot around the atomic learning database merge to prevent concurrent-save loss.
- Keep imported anonymized historical question fingerprints across the 30-day new-question rolling window, with the existing 1,000-pattern cap and no promotion of unapproved claims to facts.
- Select specific reviewed FAQs over broad categories for common historical questions, including mobile staking, legacy-wallet balances, liquidity versus reference pricing, and migration payments. Exact export re-imports are idempotent by one-way file digest.
- Replace fragile file-hash GitHub publishing checks with an exact verified v0.0.12 base-commit check. No forced push, backups, `.env` or VM runtime data in the release.
- Add regression tests for historical import persistence, fresh/news-cache fallback, version reporting and safe publisher behavior.


## 0.0.12 — 2026-10-31

- Fix contradictory consensus replies: *Is SUM PoS?* receives **Yes**, *Is SUM PoW?* receives **No**, *Was Sumcoin originally PoW?* receives **Yes**, and ambiguous/negative questions receive neutral, dated context. Localized responses for all 14 supported languages.
- Resolve *so it is PoS* as a short confirmation of that member's recent consensus answer, without interrupting unrelated chatter or admin announcements. Preserve safe group modes, member opt-outs, the review queue and previous follow-up behavior.
- Analyze the 2019–2026 Telegram Desktop history privately: 9,531 events and 6,573 text messages. Publish only anonymous, overlapping category totals and editorial priorities, **not member posts, handles, addresses, or chat transcript**.
- Add five reviewed, sourced support topics motivated by recurring historical questions: old-chain balances, migration fee payment method, third-party trading safety, faucet compatibility, and old/new wallet balance mismatch. Improve common-language search phrases for existing topics.
- Allow `npm run ingest -- -` to read a Telegram Desktop JSON export via standard input. This merges privacy-filtered recurring question fingerprints into local `data/learning.json` without retaining the raw archive on the VM. It never treats historical member statements as verified facts.
- Regression tests for exact conversation from the Oct 31 screenshot, historical-vs-current consensus, multilingual answers, role/opt-out restrictions, private export ingestion, and history-derived FAQ retrieval. Existing tests retained.

## 0.0.11 — 2026-10-31

- Fix natural follow-ups after **automatic** bot answers: remember curated topic identifiers upon successful delivery, support short multilingual “tell me more” requests for the same member for five minutes, and let a direct reply to a bot message follow that specific answer for up to 30 minutes. Keep context in memory only; do not retain member message text or share private context between members.
- Preserve admin exclusion (fresh role verification on automatic follow-ups), group authorization, opted-out members, observation mode, and normal conversation silence. Maintain `/more`, `/ask`, explicit mentions, currency and consensus handling.
- Prefer the dedicated reviewed fees topic for clear transaction-fee questions explicitly addressed to the bot.
- Replace the 36K-character historical README with a short project overview, the **exact official Sumcoin logo URL**, CI/version/Node/locales/license badges, and a separate [operations manual](docs/OPERATIONS.md). History remains in this changelog.
- Add end-to-end regressions reproducing the Telegram screenshot and testing context isolation, bot-message replies, multiple languages, price explanations and unchanged commands. All existing tests retained.


## 0.0.10 — 2026-10-31

- Private bounded indexing of relevant *new* group messages, with 90-day/5000-excerpt limits, secret/PII filters, no Telegram member account identifiers, and `/privacy` and `/forget`.
- Verified admin and explicitly allowlisted developer replies become source-required, human-reviewed draft knowledge; private `/drafts`, `/source`, `/approve`, `/reject`. Never promote unverified answers to facts.
- Added Sumcoin Podcast 2 (22 chapters) and the July 8, 2024 founder update (8 chapters), both marked historical and unreviewed, with a `/podcast` excerpt lookup.
- Added allowlisted GitHub docs discovery and attributed article headline/metadata index, plus three bundled news pointers, with public-only daily `sync:all` timer. Running bot refreshes external indexes without a restart.
- Private VM `data/` remains excluded from Git; no automated uploads or pushes of group discussions. Preserved 14 native supported locales and Unicode search support; no claim of universal translation without an LLM.
- Added regression tests and retained existing v0.0.9 behavioral coverage.


## 0.0.9 — 2026-10-31

### Improved
- Resolve natural-language SUM reference rate questions in requested currencies (JPY/yen, EUR, BRL, MXN, CAD, etc.); support quantities while preserving API source and reference-rate distinction.
- Answer current Sumcoin proof-of-work / proof-of-stake questions without unnecessary @SumcoinAdmin escalation, in 14 languages; keep migration and historical network questions distinct.
- Reduce incorrect silence from shared/group-wide price cooldowns and repeated explicit commands, while retaining Telegram outbound pacing and member opt-out.
- Keep admins excluded from unsolicited replies; avoid common casual/rhetorical messages.
- Expand curated knowledge from 52 to 57 topics and clarify the currently published migration service fee tiers as official program terms subject to eligibility.

### Sources
- Include the eight-chapter, user-provided Sumcoin Podcast 1 transcript as attributed, unreviewed data. Flag podcast claims that conflict with current network history.
- Introduce private X/Twitter archive importer for @SumcoinIndex or attributed community posts with source URL validation and relevance filtering. Unreviewed social posts are **not** automatically factual answers.
- No claim of full historical X coverage without an authorized export or API. No paid social API or LLM.

### Validation
- 138/138 automated tests, including regression tests for natural language currencies, consensus history, source provenance and safe review handling.

## 0.0.8 — 2026-10-31

- Natural-language support in the authorized Sumcoin group, enabled deliberately by `/mode reply`, not by installation.
- Verified admin exclusion and anonymous/channel-message exclusion. Reviewer enrollment for `@SumcoinAdmin` through a private `/start` with current group-admin authorization.
- Bounded redacted review queue, private notifications, `/review`, `/answer` and `/skip`. Reviewed source-backed answers become approved knowledge and reply to the original group message.
- Nonintrusive opt-out by replying “no thanks” to the bot or `/stop`, with `/resume` available.
- Twenty-minute unanswered-question fallback shares only reviewed related information or an official link; it never invents the missing answer.
- Reviewed knowledge base expanded from 40 to 52 topics with developer/UTXO/explorer/security detail; 14-language support-workflow messages.
- Strict manual YouTube transcript import for the supplied video; video evidence remains unreviewed until a verified administrator approves specific claims. The video transcript was not retrievable at build time.
- Existing 14-language rate handling, Telegram 429 pacing, privacy filters, and no-paid-API behavior retained.


## 0.0.7 — 2026-10-31

- Rewrote high-traffic answers to describe the Sumcoin Index as a **peer-to-peer reference rate**: trades are arranged directly between participants. Removed repeating generic liquidity, bank and withdrawal cautions from unrelated queries while preserving recovery-key and scam protections where relevant.
- `/price [CURRENCY]` uses exact currency records from the approved existing rate service (numeric `n`, matching ISO `code`), localized formatting and 14-language display. No synthetic conversion or guessed prices. Automatic currency defaults respect available regional locale tags; ambiguous generic languages are handled conservatively. Unsupported automatic currencies fall back to the explicitly sourced USD record, while explicitly selected unavailable currencies report the limitation.
- `/currency CODE|auto` sets a member-only, in-memory 24-hour currency preference, separate from `/language`. A `/price CODE` one-time override doesn't alter the preference.
- Added reviewed concise FAQs for 12 popular topics and eight wallet guides in 14 languages: English, Spanish, Portuguese, French, German, Italian, Russian, Arabic, Hindi, Chinese, Japanese, Korean, Turkish and Indonesian. Localized core `/help`, live price output and `/tx`/`/address` output. Specialized technical articles still display English when unreviewed translations are missing.
- Expanded natural-language live-price detection across the 14 languages, including Korean script normalization. General index formula explanations still avoid accidentally triggering a live price request.
- Retained observation mode, group restrictions, security filters, approved sources, no paid AI, non-root deployment, and current Telegram 429 retry behavior. Existing v0.0.6 tests remain, with updated assertions for intentional editorial improvements and new localization/FX/security regressions.

## 0.0.6 — 2026-10-31

- Fixed `/price` to parse the live official `https://rate.slicewallet.org/api/rates` response: an array of currency records (`code`, `price`, `n`, `name`), selecting only the USD row's numeric `n` field.
- Also supports array records wrapped in `rates` or `data.rates`, while retaining supported object-form responses.
- Rejects missing, duplicate, malformed, or implausible USD prices instead of guessing, without parsing formatted currency strings.
- Added realistic regression tests for the production API's array schema, preserved read-only security controls, and kept all other commands, settings and curated content unchanged.


## 0.0.5 — 2026-10-31

- Expanded reviewed support knowledge from 16 to **40 topics**, including wallet restore/connection/send/receive, index data and market-cap explanations, transaction confirmation, migration compatibility, staking diagnostics, developer APIs, privacy, and release compatibility.
- Added eight reviewed, source-linked troubleshooting guides (`/guide`) in English, Spanish and Brazilian Portuguese.
- Added free, read-only public queries `/price`, `/tx <64-hex-txid>`, `/address <public-address>`. Queries use hardcoded HTTPS hosts, strict input validation, timeouts, redirect rejection and bounded response sizes. Missing or unfamiliar source data is **not** guessed; live API behavior requires verification against production endpoints.
- Natural-language requests for the **current SUM price** route to the read-only price lookup rather than an undated educational answer; questions about how the index is calculated continue to use curated documentation.
- New curated Spanish and Portuguese information on wallet, index, explorer, staking and library topics. Never automatically claim scraped content is current or translated.
- Added `sumcoinlib` (README, changelog, migration, validation) to the fixed approved synchronization set; public GitHub file search includes that repository.
- The Sumcoin Index FAQ is intentionally **not** ingested because a web-indexed copy contained suspicious executable PHP text; an administrator should inspect the source before adding it.
- No token changes, new ports, database, root process, auto-reply activation, or paid API use. Added test coverage for API response validation, no invented values, multilingual guides, and old index Q&A regressions.


## 0.0.4 — 2026-10-31

- Richer, structured **free** `/ask` answers combining the reviewed topic explanation, a precise editorial clarification, and related vetted facts; source URLs included. No paid API and no LLM required.
- `/more` extends the previous answer; non-topic-specific mentions can reuse the prior topic for 30 minutes per chat/member. Only last topic and language are held in a bounded in-memory map, no raw text.
- Expanded human-authored Portuguese and Spanish topic explanations; improved Portuguese index-question detection and restored original language for contextual follow-ups.
- Synced documentation contributes references but not unreviewed factual assertions, reducing the risk of treating old PoW-era white-paper content as current PoS configuration.
- `/more` added to Telegram's default and localized command menus. Previous 429 flood control, rate limiting, group authorization and observe-mode semantics preserved.
- Additional tests for grounded answers, multilingual content, group context isolation, current-vs-historical material, and command menus.
- Ignore incidental bot mentions in community announcements (including messages that recommend `/help`), while preserving direct mentions, questions, and explicit command replies.
- Carries forward the 2026-10-31 canonical `www.sumcoinindex.com/white-paper.html` sync URL correction on `main`.


## 0.0.3 — 2026-10-31

- Retry Telegram sendMessage HTTP 429 failures using the official `retry_after` delay (plus one second), with bounded attempts.
- Pace outbound messages to a group at approximately one every 3.1 seconds and serialize competing replies.
- Do not retry uncertain network delivery outcomes or HTTP errors without a verified retry delay.
- Regression tests for flood control, pacing, and non-retryable failures.

## 0.0.2 — 2026-10-31

- Multilingual support questions: message-language detection, optional per-member language override, and localized core USD/cashout and scam-safety answers in 12 languages.
- Optional source-grounded multilingual AI with context-sensitive follow-ups; partial offline language support disclosed explicitly.
- Expanded multilingual topic detection, avoided English-only notices and fixed missed pending-transfer reporting.
- Localized Telegram command menus in seven languages, group-level daily AI request ceiling and private-chat access disabled by default.
- Question-pattern learning now stores hashes and counts rather than raw example text unless explicitly opted in.
- User feedback on bot reply IDs with administrator review command, localized usage guidance, and safer per-user explicit question cooldowns.
- New `scripts/push-update.sh` safely commits/pushes v0.0.2 to an existing repository and adds a release tag.
- Expanded automated tests, plus multilingual Telegram export analysis/import.


## 0.0.1 — 2026-10-31

- Initial ground-up public release of `telegram-sum-helper`.
- Curated official Sumcoin knowledge including withdrawals, index valuation, wallets, PoS, legacy migration, safety, support, explorer, fees and code repositories.
- Optional official-docs and GitHub README refresh into a local searchable index.
- Online file-path search of official `sumcoinlabs` GitHub repositories.
- Optional AI conversational answers grounded in retrieved sources; deterministic offline fallback.
- Automatic learning of repeated question patterns, with moderator approval required for new facts.
- Telegram authorization, observe mode, cooldowns, admin commands, safety redaction and audit tests.
