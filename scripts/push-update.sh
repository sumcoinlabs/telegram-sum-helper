#!/usr/bin/env bash
# Stage only validated v0.0.7 source files on the user's Mac, never on the VM.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for tool in git gh node npm rsync mktemp cmp; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool" >&2; exit 1; }
done
[[ "$(node -p "require('$SOURCE/package.json').version")" == '0.0.7' ]] || { echo 'Unexpected local version' >&2; exit 1; }
echo '========== VERIFY LOCAL RELEASE =========='
(cd "$SOURCE" && npm run check)
gh auth status >/dev/null
LOGIN="$(gh api user -q .login)"
[[ "$LOGIN" == 'sumcoinlabs' ]] || { echo "Expected sumcoinlabs GitHub login, found $LOGIN" >&2; exit 1; }
[[ -d "$HOME/Documents" ]] || { echo 'Missing ~/Documents' >&2; exit 1; }
STAGE="$(mktemp -d "$HOME/Documents/.telegram-sum-helper-release.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
echo '========== FETCH GITHUB MAIN =========='
gh repo clone sumcoinlabs/telegram-sum-helper "$STAGE/repo" -- --branch main --single-branch
cd "$STAGE/repo"
CURRENT="$(node -p "require('./package.json').version")"
FILES=(
  CHANGELOG.md README.md package.json scripts/push-update.sh
  knowledge/curated.json
  src/bot.js src/facts-localized.js src/guides-localized.js src/guides.js
  src/index.js src/languages.js src/live.js src/locale-ui.js src/offline.js src/telegram.js
  test/bot.test.js test/multilingual.test.js test/offline-v004.test.js test/v005.test.js test/v007.test.js
)
if [[ "$CURRENT" == '0.0.7' ]]; then
  echo 'GitHub already reports v0.0.7; verifying exact release contents.'
  for file in "${FILES[@]}"; do
    cmp -s "$SOURCE/$file" "$file" || { echo "Mismatch in published file: $file" >&2; exit 1; }
  done
elif [[ "$CURRENT" == '0.0.6' && "$(git rev-parse --short=7 HEAD)" == '86c5cd0' ]]; then
  echo '========== APPLY RELEASE FILES =========='
  (cd "$SOURCE" && rsync -a --relative "${FILES[@]}" "$STAGE/repo/")
  git add -- "${FILES[@]}"
  git diff --cached --check
  echo '========== TEST STAGED VERSION =========='
  npm run check
  echo '========== COMMIT AND PUSH =========='
  git diff --cached --stat
  git commit -m 'Release Sumcoin Helper v0.0.7: clearer P2P rates and multilingual currencies'
  git push origin HEAD:main
else
  echo "GitHub main is $CURRENT ($(git rev-parse --short HEAD)); expected v0.0.6 at 86c5cd0." >&2
  echo 'No changes were pushed. Reconcile unexpected updates before publishing.' >&2
  exit 1
fi
echo '========== RELEASE TAG =========='
if git ls-remote --tags origin 'refs/tags/v0.0.7' | grep -q .; then
  echo 'v0.0.7 tag already exists; keeping existing tag.'
else
  git tag -a v0.0.7 -m 'telegram-sum-helper v0.0.7'
  git push origin v0.0.7
fi
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
git log -1 --oneline
