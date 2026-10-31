#!/usr/bin/env bash
# Safe v0.0.10 publisher. Runs from an extracted release folder on Mac.
# Public code/docs only. Never copies .env or data/ into GitHub.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for tool in git gh node npm rsync mktemp shasum cmp; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
[[ "$(node -p "require('$SOURCE/package.json').version")" == '0.0.10' ]] || { echo 'Incorrect release.' >&2; exit 1; }
(cd "$SOURCE" && npm run check)
gh auth status >/dev/null
LOGIN="$(gh api user -q .login)"
[[ "$LOGIN" == 'sumcoinlabs' ]] || { echo "Wrong GitHub login: $LOGIN" >&2; exit 1; }
[[ -d "$HOME/Documents" ]] || { echo 'Missing ~/Documents' >&2; exit 1; }
STAGE="$(mktemp -d "$HOME/Documents/.telegram-sum-helper-release.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

echo '========== FETCH GITHUB MAIN =========='
gh repo clone sumcoinlabs/telegram-sum-helper "$STAGE/repo" -- --branch main --single-branch
cd "$STAGE/repo"
CURRENT="$(node -p "require('./package.json').version")"
HEAD="$(git rev-parse HEAD)"
if [[ "$CURRENT" == '0.0.10' ]]; then
  echo 'v0.0.10 already published. Refusing duplicate commit.'
  exit 0
elif [[ "$CURRENT" == '0.0.8' ]]; then
  [[ "$HEAD" == '0d7712e9f51041674fb900ecccbdd740fbb7b7c1' ]] || {
    echo 'Unexpected v0.0.8 GitHub HEAD. No files published.' >&2; exit 1;
  }
elif [[ "$CURRENT" == '0.0.9' ]]; then
  # Verify all central v0.0.9 files have not been modified independently.
  # User changes must be reconciled, not silently overwritten by a release.
  while read -r file sha; do
    [[ "$(shasum -a 256 "$file" | cut -d' ' -f1)" == "$sha" ]] || {
      echo "GitHub has unexpected changes in $file; aborting safely." >&2; exit 1;
    }
  done <<'BASE'
src/bot.js be2201b39e76f5e43fb6529df0dd9fcd3e8afcea1409604c4b6c895d5d9d8e2b
src/knowledge.js b69d6a8620b83ca76493b609e81211ee7c6c4593ae201d6ad2187335958c783a
src/index.js e45eb0ba725069ff162860cd6f203bd691c188d47c1537c41b11daee3e13fad6
src/learning.js 06a0d7361ccb2f33990413316f3d0428966bf99fe1c9333d22d15da005ebf031
README.md 231b2d66ee924682c0192716b167c5adb5b63f70f072366e18dafe52de9c5be2
CHANGELOG.md cffd92fdd29a296ca995b781747987b3ca2bf10009efea659b8ebaf20f3592ec
package.json dafcb4aa3107fc1922e3002d6bda29e5d48a1bfdfe94a6086c9fa51b05dff309
BASE
else
  echo "Unknown GitHub version $CURRENT at $HEAD; no files published." >&2; exit 1
fi

echo '========== COPY RELEASE SOURCE ONLY =========='
FILES=(README.md CHANGELOG.md package.json .env.example)
while IFS= read -r file; do FILES+=("$file"); done < <(cd "$SOURCE" && find src scripts knowledge test deploy -type f -print | sort)
(cd "$SOURCE" && rsync -a --relative "${FILES[@]}" "$STAGE/repo/")
git add -- "${FILES[@]}"
git diff --cached --check
[[ "$(node -p "require('./package.json').version")" == '0.0.10' ]] || exit 1
npm run check
if git diff --cached --quiet; then echo 'No changes staged.'; exit 1; fi

echo '========== COMMIT AND PUSH =========='
git diff --cached --stat
git commit -m 'Release Sumcoin Helper v0.0.10: private group learning and source discovery'
git push origin HEAD:main

echo '========== TAG =========='
if git ls-remote --tags origin 'refs/tags/v0.0.10' | grep -q .; then
  echo 'Tag v0.0.10 already exists; leaving it unchanged.'
else
  git tag -a v0.0.10 -m 'telegram-sum-helper v0.0.10'
  git push origin v0.0.10
fi
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
git log -1 --oneline
