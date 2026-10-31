#!/usr/bin/env bash
# Safe release publisher: runs from the extracted ZIP on the user's Mac.
# Does not mutate production VM state or overwrite user-managed data files.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for tool in git gh node npm rsync mktemp cmp; do
  command -v "$tool" >/dev/null || { echo "Missing required command: $tool" >&2; exit 1; }
done
[[ "$(node -p "require('$SOURCE/package.json').version")" == '0.0.9' ]] || { echo 'Source version is not 0.0.9' >&2; exit 1; }
(cd "$SOURCE" && npm run check)
gh auth status >/dev/null
LOGIN="$(gh api user -q .login)"
[[ "$LOGIN" == 'sumcoinlabs' ]] || { echo "Expected GitHub account sumcoinlabs, found $LOGIN" >&2; exit 1; }
[[ -d "$HOME/Documents" ]] || { echo 'Missing ~/Documents' >&2; exit 1; }
STAGE="$(mktemp -d "$HOME/Documents/.telegram-sum-helper-release.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

echo '========== FETCH CURRENT GITHUB MAIN =========='
gh repo clone sumcoinlabs/telegram-sum-helper "$STAGE/repo" -- --branch main --single-branch
cd "$STAGE/repo"
CURRENT="$(node -p "require('./package.json').version")"
HEAD="$(git rev-parse HEAD)"
FILES=(
 CHANGELOG.md README.md package.json scripts/push-update.sh scripts/import-social.mjs
 knowledge/curated.json knowledge/podcast-1.json
 src/bot.js src/intent.js src/live.js src/knowledge.js src/social.js src/index.js
 test/v009.test.js
)
if [[ "$CURRENT" == '0.0.9' ]]; then
  echo 'GitHub already reports v0.0.9. Checking source files match.'
  for file in "${FILES[@]}"; do
    cmp -s "$SOURCE/$file" "$file" || { echo "Mismatch in already published file: $file" >&2; exit 1; }
  done
elif [[ "$CURRENT" == '0.0.8' && "$HEAD" == '0d7712e9f51041674fb900ecccbdd740fbb7b7c1' ]]; then
  echo '========== APPLY ONLY RELEASE FILES =========='
  (cd "$SOURCE" && rsync -a --relative "${FILES[@]}" "$STAGE/repo/")
  git add -- "${FILES[@]}"
  git diff --cached --check
  npm run check
  echo '========== COMMIT AND PUSH =========='
  git diff --cached --stat
  git commit -m 'Release Sumcoin Helper v0.0.9: improved language routing and sourced knowledge'
  git push origin HEAD:main
else
  echo "Unexpected GitHub base: $CURRENT at $HEAD; expected v0.0.8 at 0d7712e. No changes pushed." >&2
  exit 1
fi

echo '========== CREATE RELEASE TAG =========='
if git ls-remote --tags origin 'refs/tags/v0.0.9' | grep -q .; then
  echo 'v0.0.9 tag already exists; preserving.'
else
  git tag -a v0.0.9 -m 'telegram-sum-helper v0.0.9'
  git push origin v0.0.9
fi
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
git log -1 --oneline
