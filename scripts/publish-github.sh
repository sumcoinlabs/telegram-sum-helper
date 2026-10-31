#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

for cmd in git gh; do
  command -v "$cmd" >/dev/null || { echo "Missing required command: $cmd" >&2; exit 1; }
done

# Refuse to publish a failing source tree.
if command -v node >/dev/null 2>&1; then node --test >/dev/null && echo 'All automated tests passed.'; else echo 'Node.js 20+ required to run tests before publishing.' >&2; exit 1; fi
gh auth status >/dev/null
login="$(gh api user -q .login)"
if [[ "$login" != 'sumcoinlabs' ]]; then
  echo "GitHub is signed in as '$login', not 'sumcoinlabs'. Switch accounts with gh auth switch before publishing." >&2
  exit 1
fi

if gh repo view sumcoinlabs/telegram-sum-helper >/dev/null 2>&1; then
  echo 'Repository sumcoinlabs/telegram-sum-helper already exists. Refusing to overwrite or force-push.' >&2
  exit 1
fi

if [[ -d .git ]]; then
  echo 'This directory already contains a Git repository. Inspect it before publishing.' >&2
  exit 1
fi

if [[ -e .env ]]; then
  echo 'Warning: A local .env exists. It is ignored by .gitignore and will not be committed.'
fi

git init -b main
git add .
if git ls-files | grep -Eq '(^|/)(\.env|result\.json|.*\.log)$'; then
  echo 'Refusing to publish secret or exported data.' >&2
  exit 1
fi

RELEASE_VERSION="$(node -p 'require("./package.json").version')"
git commit -m "Initial telegram-sum-helper v${RELEASE_VERSION} — grounded Sumcoin AI bot"
gh repo create sumcoinlabs/telegram-sum-helper --public --source=. --remote=origin --push
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
