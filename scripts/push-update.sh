#!/usr/bin/env bash
# Validate and publish release from the user's Mac, not from the production VM.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for tool in git gh node npm rsync mktemp cmp; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool" >&2; exit 1; }
done
[[ "$(node -p "require('$SOURCE/package.json').version")" == '0.0.8' ]] || { echo 'Unexpected local package version' >&2; exit 1; }
echo '========== VALIDATE LOCAL RELEASE =========='
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
 .env.example CHANGELOG.md README.md package.json scripts/push-update.sh scripts/import-transcript.mjs
 knowledge/curated.json src/bot.js src/index.js src/telegram.js src/knowledge.js
 src/escalations.js src/video.js src/support-ui.js test/v008.test.js
)
if [[ "$CURRENT" == '0.0.8' ]]; then
  echo 'GitHub already reports v0.0.8; verifying exact release contents.'
  for file in "${FILES[@]}"; do
    cmp -s "$SOURCE/$file" "$file" || { echo "Mismatch in published file: $file" >&2; exit 1; }
  done
elif [[ "$CURRENT" == '0.0.7' && "$(git rev-parse --short=7 HEAD)" == '3658912' ]]; then
  echo '========== APPLY RELEASE FILES =========='
  (cd "$SOURCE" && rsync -a --relative "${FILES[@]}" "$STAGE/repo/")
  git add -- "${FILES[@]}"
  git diff --cached --check
  echo '========== TEST STAGED VERSION =========='
  npm run check
  echo '========== COMMIT AND PUSH =========='
  git diff --cached --stat
  git commit -m 'Release Sumcoin Helper v0.0.8: natural-language support and admin review'
  git push origin HEAD:main
else
  echo "GitHub main is $CURRENT ($(git rev-parse --short HEAD)); expected v0.0.7 at 3658912." >&2
  echo 'No changes were pushed. Reconcile unexpected updates before publishing.' >&2
  exit 1
fi
echo '========== RELEASE TAG =========='
if git ls-remote --tags origin 'refs/tags/v0.0.8' | grep -q .; then
  echo 'v0.0.8 tag already exists; keeping existing tag.'
else
  git tag -a v0.0.8 -m 'telegram-sum-helper v0.0.8'
  git push origin v0.0.8
fi
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
git log -1 --oneline
