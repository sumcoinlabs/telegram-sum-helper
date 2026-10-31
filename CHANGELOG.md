# Changelog

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
