#!/usr/bin/env bash
# Safely publishes v0.0.4 on top of the currently deployed GitHub repository.
# Runs on the user's Mac, never on the production VM. No force pushes.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for tool in git gh node npm rsync mktemp; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
if [[ "$(node -p "require('$SOURCE/package.json').version")" != '0.0.4' ]]; then
  echo 'Unexpected package version; expected 0.0.4.' >&2; exit 1
fi
printf '========== LOCAL REGRESSION TESTS ==========\n'
(cd "$SOURCE" && npm run check)
gh auth status >/dev/null
LOGIN="$(gh api user -q .login)"
if [[ "$LOGIN" != 'sumcoinlabs' ]]; then
  echo "Signed in as $LOGIN; expected sumcoinlabs." >&2; exit 1
fi
[[ -d "$HOME/Documents" ]] || { echo 'Missing ~/Documents' >&2; exit 1; }
STAGE="$(mktemp -d "$HOME/Documents/.telegram-sum-helper-release.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
printf '\n========== FETCH CURRENT MAIN ==========\n'
gh repo clone sumcoinlabs/telegram-sum-helper "$STAGE/repo" -- --branch main --single-branch
cd "$STAGE/repo"
CURRENT="$(node -p "require('./package.json').version")"
if [[ "$CURRENT" == '0.0.4' ]]; then
  echo 'GitHub main already reports v0.0.4; checking release tag.'
elif [[ "$CURRENT" == '0.0.3' && "$(git rev-parse --short=7 HEAD)" == '7d0c7e5' ]]; then
  printf '\n========== APPLY ONLY RELEASE FILES ==========\n'
  FILES=(
    README.md CHANGELOG.md package.json
    src/bot.js src/index.js src/languages.js src/offline.js src/telegram.js src/sync.js
    test/offline-v004.test.js scripts/push-update.sh
  )
  (cd "$SOURCE" && rsync -a --relative "${FILES[@]}" "$STAGE/repo/")
  git add -- "${FILES[@]}"
  git diff --cached --check
  printf '\n========== VERIFY STAGED TESTS ==========\n'
  npm run check
  printf '\n========== COMMIT AND PUSH ==========\n'
  git diff --cached --stat
  git commit -m 'Release telegram-sum-helper v0.0.4: richer offline answers and multilingual follow-ups'
  git push origin HEAD:main
else
  echo "GitHub main is version $CURRENT at $(git rev-parse --short HEAD), not the tested base 7d0c7e5." >&2
  echo 'No changes pushed. Merge/reconcile newer changes before publishing.' >&2
  exit 1
fi
printf '\n========== RELEASE TAG ==========\n'
if git ls-remote --tags origin 'refs/tags/v0.0.4' | grep -q .; then
  echo 'Remote v0.0.4 tag exists; leaving it unchanged.'
else
  git tag -a v0.0.4 -m 'telegram-sum-helper v0.0.4'
  git push origin v0.0.4
fi
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
git log -1 --oneline
