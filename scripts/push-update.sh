#!/usr/bin/env bash
# Release publisher. Runs on the Mac from an extracted v0.0.12 ZIP.
# No secrets, VM runtime data, forced history changes, or server backups.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for tool in git gh node npm rsync mktemp shasum; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
[[ "$(node -p "require('$SOURCE/package.json').version")" == '0.0.12' ]] || { echo 'Not a v0.0.12 release.' >&2; exit 1; }
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
if [[ "$CURRENT" == '0.0.12' ]]; then
  echo 'v0.0.12 already published. Nothing to do.'
  exit 0
fi
[[ "$CURRENT" == '0.0.11' ]] || { echo "Unexpected GitHub version $CURRENT; refusing overwrite." >&2; exit 1; }

# Verify the exact v0.0.11 source used to build this release; do not silently
# overwrite independent GitHub edits even if package.json's version is unchanged.
EXPECTED_BASE="6a28109a710a3444f608303bf8a56f69679eae06"
ACTUAL_BASE="$(git rev-parse HEAD)"

[[ "$ACTUAL_BASE" == "$EXPECTED_BASE" ]] || {
  echo "GitHub main changed from verified v0.0.11. Aborting." >&2
  exit 1
}
if git ls-remote --tags origin 'refs/tags/v0.0.12' | grep -q .; then
  echo 'Tag v0.0.12 already exists on remote; investigate before publishing.' >&2
  exit 1
fi

echo '========== STAGE RELEASE FILES =========='
FILES=(README.md CHANGELOG.md package.json .env.example)
while IFS= read -r file; do FILES+=("$file"); done < <(cd "$SOURCE" && find src scripts knowledge test deploy docs -type f -print | sort)
(cd "$SOURCE" && rsync -a --relative "${FILES[@]}" "$STAGE/repo/")
git add -- "${FILES[@]}"
git diff --cached --check
[[ "$(node -p "require('./package.json').version")" == '0.0.12' ]] || exit 1
npm run check
if git diff --cached --quiet; then
  echo 'No release changes staged.' >&2; exit 1
fi

echo '========== PUBLISH =========='
git diff --cached --stat
git commit -m 'Release Sumcoin Helper v0.0.12: consensus accuracy and historical community insights'
git push origin HEAD:main
git tag -a v0.0.12 -m 'Telegram Sumcoin Helper v0.0.12'
git push origin v0.0.12
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
git log -1 --oneline
