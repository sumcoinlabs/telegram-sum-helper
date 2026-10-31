# Changelog

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
