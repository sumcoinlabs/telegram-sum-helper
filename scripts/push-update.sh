#!/usr/bin/env bash
# Protected v0.0.20 publisher, built from verified v0.0.19 production release.
# No forced pushes, no private runtime files, no server backups.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for tool in git gh node npm rsync mktemp; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
[[ "$(node -p "require('$SOURCE/package.json').version")" == '0.0.20' ]] || { echo 'Not a v0.0.20 release.' >&2; exit 1; }
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
if [[ "$CURRENT" == '0.0.20' ]]; then
  echo 'v0.0.20 is already published. Nothing to do.'
  exit 0
fi
# This publisher requires the exact v0.0.19 deployment to protect prior releases.
[[ "$CURRENT" == '0.0.19' ]] || { echo "Unexpected GitHub version $CURRENT. Refusing overwrite." >&2; exit 1; }
EXPECTED_BASE='cca163d3b46ae5608ab55f5c8cee795f0e890e38'
ACTUAL_BASE="$(git rev-parse HEAD)"
[[ "$ACTUAL_BASE" == "$EXPECTED_BASE" ]] || { echo "GitHub main changed unexpectedly ($ACTUAL_BASE). Aborting." >&2; exit 1; }
TAGGED_BASE="$(git rev-parse 'refs/tags/v0.0.19^{commit}' 2>/dev/null || true)"
[[ "$TAGGED_BASE" == "$EXPECTED_BASE" ]] || { echo 'v0.0.19 tag disagrees with main. Aborting.' >&2; exit 1; }
if git ls-remote --tags origin 'refs/tags/v0.0.20' | grep -q .; then
  echo 'Tag v0.0.20 already exists on remote; investigate before publishing.' >&2
  exit 1
fi

echo '========== STAGE SOURCE-ONLY RELEASE =========='
FILES=(README.md CHANGELOG.md package.json .env.example)
while IFS= read -r file; do FILES+=("$file"); done < <(cd "$SOURCE" && find src scripts knowledge test deploy docs -type f -print | sort)
(cd "$SOURCE" && rsync -a --relative "${FILES[@]}" "$STAGE/repo/")
git add -- "${FILES[@]}"
git diff --cached --check
[[ "$(node -p "require('./package.json').version")" == '0.0.20' ]] || exit 1
npm run check
if git diff --cached --quiet; then echo 'No release changes staged.' >&2; exit 1; fi

echo '========== PUBLISH v0.0.20 =========='
git diff --cached --stat
git commit -m 'Release Sumcoin Helper v0.0.20: natural multilingual history, verified ATH and market conversations'
git push origin HEAD:main
git tag -a v0.0.20 -m 'Telegram Sumcoin Helper v0.0.20'
git push origin v0.0.20
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
git log -1 --oneline
