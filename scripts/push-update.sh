#!/usr/bin/env bash
# Release publisher. Runs on the Mac from an extracted v0.0.11 ZIP.
# No secrets, VM runtime data, forced history changes, or server backups.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for tool in git gh node npm rsync mktemp shasum; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
[[ "$(node -p "require('$SOURCE/package.json').version")" == '0.0.11' ]] || { echo 'Not a v0.0.11 release.' >&2; exit 1; }
(cd "$SOURCE" && npm run check)
gh auth status >/dev/null
LOGIN="$(gh api user -q .login)"
[[ "$LOGIN" == 'sumcoinlabs' ]] || { echo "Unexpected GitHub login: $LOGIN" >&2; exit 1; }
[[ -d "$HOME/Documents" ]] || { echo 'Missing ~/Documents.' >&2; exit 1; }
STAGE="$(mktemp -d "$HOME/Documents/.telegram-sum-helper-release.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

echo '========== FETCH MAIN =========='
gh repo clone sumcoinlabs/telegram-sum-helper "$STAGE/repo" -- --branch main --single-branch
cd "$STAGE/repo"
CURRENT="$(node -p "require('./package.json').version")"
if [[ "$CURRENT" == '0.0.11' ]]; then
  echo 'v0.0.11 already published. Nothing to do.'
  exit 0
fi
[[ "$CURRENT" == '0.0.10' ]] || { echo "Unexpected GitHub version $CURRENT; refusing overwrite." >&2; exit 1; }

# Verify the exact v0.0.10 source used to build this release; do not silently
# overwrite independent GitHub edits even if package.json's version is unchanged.
while read -r file expected; do
  actual="$(shasum -a 256 "$file" | cut -d' ' -f1)"
  [[ "$actual" == "$expected" ]] || { echo "GitHub has unexpected edits in $file. Aborting before changes." >&2; exit 1; }
done <<'BASE'
README.md ee3a613bf61a1693cc7db968105dac928c76b0bb43ad2ae9df6533c5b0270464
CHANGELOG.md 423b11bc09d6b87aca97d1a9ef8d954a681a52884e2aef1d3eeafc6f15f836bb
package.json 94c7ae6d7a2ddbb12fd95a519be61707cb056c0a51d2433d0cd639858d6f07d4
src/bot.js 51589d01e712b4e2b0f2938a2a871b4131bd9c732d663104a4d58f9d025098a5
src/offline.js daa5b6549d89b949d18281cc3ff1e8214ffccc1a36718dfde9cbb7639c140995
scripts/push-update.sh b8a282482fd11c44f3e671ccd390c1c905267079daa11b6ad0a8897937d263f1
BASE
if git ls-remote --tags origin 'refs/tags/v0.0.11' | grep -q .; then
  echo 'Tag v0.0.11 already exists on remote; investigate before publishing.' >&2
  exit 1
fi

echo '========== STAGE RELEASE FILES =========='
FILES=(README.md CHANGELOG.md package.json .env.example)
while IFS= read -r file; do FILES+=("$file"); done < <(cd "$SOURCE" && find src scripts knowledge test deploy docs -type f -print | sort)
(cd "$SOURCE" && rsync -a --relative "${FILES[@]}" "$STAGE/repo/")
git add -- "${FILES[@]}"
git diff --cached --check
[[ "$(node -p "require('./package.json').version")" == '0.0.11' ]] || exit 1
npm run check
if git diff --cached --quiet; then
  echo 'No release changes staged.' >&2; exit 1
fi

echo '========== PUBLISH =========='
git diff --cached --stat
git commit -m 'Release Sumcoin Helper v0.0.11: contextual replies and concise branded README'
git push origin HEAD:main
git tag -a v0.0.11 -m 'Telegram Sumcoin Helper v0.0.11'
git push origin v0.0.11
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
git log -1 --oneline
