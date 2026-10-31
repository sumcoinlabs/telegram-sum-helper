<p align="center">
  <a href="https://sumcoin.org/">
    <img src="https://sumcoin.org/wp-content/uploads/2019/07/sumcoin_400x400.png" alt="Official Sumcoin logo" width="120" height="120">
  </a>
</p>

<h1 align="center">Sumcoin Helper</h1>

<p align="center">Source-grounded, multilingual Telegram community support for <a href="https://sumcoin.org/">Sumcoin (SUM)</a>.</p>

<p align="center">
  <a href="https://github.com/sumcoinlabs/telegram-sum-helper/actions/workflows/test.yml"><img alt="Tests" src="https://github.com/sumcoinlabs/telegram-sum-helper/actions/workflows/test.yml/badge.svg"></a>
  <a href="https://github.com/sumcoinlabs/telegram-sum-helper/releases/tag/v0.0.13"><img alt="Version 0.0.12" src="https://img.shields.io/badge/version-0.0.13-blue"></a>
  <img alt="Node.js 20.11 or newer" src="https://img.shields.io/badge/Node.js-%3E%3D20.11-339933?logo=nodedotjs&logoColor=white">
  <img alt="14 supported locales" src="https://img.shields.io/badge/locales-14-0A73B7">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-green"></a>
</p>

**Telegram:** [@SumcoinHelperBot](https://t.me/SumcoinHelperBot) · **Community:** [@sumcoins](https://t.me/sumcoins)

## Features

- **Automatic help:** Replies to relevant, ordinary group questions; ignores general chat, announcements, and admin posts.
- **Follow-up conversations:** “Can you tell me more?” expands *your own* recent bot answer. Reply directly to any bot answer to continue **that specific** topic. `/more` works too.
- **14 localized support flows:** English, Spanish, Portuguese, French, German, Italian, Russian, Arabic, Hindi, Chinese, Japanese, Korean, Turkish, and Indonesian. Specialized topics may fall back to reviewed English text.
- **Live SUM reference rates:** Currency names and codes (including yen/JPY); public read-only blockchain lookup via `/tx` and `/address`.
- **Verified knowledge:** Reviewed FAQs, official documentation, dated podcast transcripts, project updates, public GitHub documentation, news references, and optional X archives. Unreviewed sources are not automatically treated as current facts.
- **Ongoing learning:** Privacy-filtered *new* group excerpts are stored on the VM; verified admin/developer answers become drafts until explicitly sourced and approved.
- **Free offline answering:** The OpenAI API is optional; without a key answers use reviewed retrieval, not open-ended generation.

## Install or update

Run on the existing VM as `electrumbtc1` in `/home/electrumbtc1/telegram-sum-helper`:

```bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
cd /home/electrumbtc1/telegram-sum-helper
git pull --ff-only origin main
npm run check
npm run sync:all
systemctl --user restart telegram-sum-helper.service
```

`/mode reply` enables automatic answers; `/mode observe` records support activity without unsolicited replies. Commands and setup details are in [Operations](docs/OPERATIONS.md).

## Common commands

| Command | Purpose |
|---|---|
| `/ask QUESTION` | Ask explicitly, including as an admin |
| `/more` | Expand your last reviewed answer |
| `/price JPY` · `/currency EUR` | Live rate · preferred display currency |
| `/guide TOPIC` | Wallet and migration walkthroughs |
| `/tx TXID` · `/address PUBLIC_ADDRESS` | Read-only blockchain checks |
| `/find QUERY` · `/podcast QUERY` · `/news` | Search source material |
| `/stop` · `/resume` · `/privacy` | Control automatic replies and see data policy |
| `/mode reply` · `/status` · `/drafts` | Group-admin controls and diagnostics |

## Data and trust

- Live state, approved community answers and the private, 90-day group index are stored under `data/` on the VM. **`.env` and `data/` are Git-ignored and must never be pushed to GitHub.**
- Reviewed public facts are versioned under `knowledge/`; historical podcasts, social posts, news, and scraped sources remain attributable and unreviewed until confirmed.
- The daily `telegram-sum-helper-sync.timer` updates **public** knowledge sources on the VM; it does not publish member conversations.
- For older history, stream an authorized Telegram Desktop export to the private VM importer. The bot cannot retrieve earlier messages through the Bot API.
- Never share seed phrases, private keys, authentication codes, or wallet passwords with the bot.

See [Operations](docs/OPERATIONS.md) for deployment, source synchronization, admin approval, storage paths and privacy details; see [CHANGELOG.md](CHANGELOG.md) for the full version history.
