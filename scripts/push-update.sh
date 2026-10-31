#!/usr/bin/env bash
# Release publisher. Runs on the Mac from an extracted v0.0.16 ZIP.
# No secrets, VM runtime data, forced history changes, or server backups.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for tool in git gh node npm rsync mktemp shasum; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
[[ "$(node -p "require('$SOURCE/package.json').version")" == '0.0.16' ]] || { echo 'Not a v0.0.16 release.' >&2; exit 1; }
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
if [[ "$CURRENT" == '0.0.16' ]]; then
  echo 'v0.0.16 already published. Nothing to do.'
  exit 0
fi
[[ "$CURRENT" == '0.0.15' ]] || { echo "Unexpected GitHub version $CURRENT; refusing overwrite." >&2; exit 1; }

# Compare against the exact previously verified GitHub release, not hand-written
# file SHA-256 values (which caused false positives in v0.0.12).
EXPECTED_BASE='56432fb3f678a634d072ced17a3d5c83071f4700'
ACTUAL_BASE="$(git rev-parse HEAD)"
[[ "$ACTUAL_BASE" == "$EXPECTED_BASE" ]] || {
  echo "GitHub main differs from verified v0.0.15 ($ACTUAL_BASE). Aborting." >&2
  exit 1
}
if git ls-remote --tags origin 'refs/tags/v0.0.16' | grep -q .; then
  echo 'Tag v0.0.16 already exists on remote; investigate before publishing.' >&2
  exit 1
fi

echo '========== STAGE RELEASE FILES =========='
FILES=(README.md CHANGELOG.md package.json .env.example)
while IFS= read -r file; do FILES+=("$file"); done < <(cd "$SOURCE" && find src scripts knowledge test deploy docs -type f -print | sort)
(cd "$SOURCE" && rsync -a --relative "${FILES[@]}" "$STAGE/repo/")
git add -- "${FILES[@]}"
git diff --cached --check
[[ "$(node -p "require('./package.json').version")" == '0.0.16' ]] || exit 1
npm run check
if git diff --cached --quiet; then
  echo 'No release changes staged.' >&2; exit 1
fi

echo '========== PUBLISH =========='
git diff --cached --stat
git commit -m 'Release Sumcoin Helper v0.0.16: French price routing and safe Groq permission diagnostics'
git push origin HEAD:main
git tag -a v0.0.16 -m 'Telegram Sumcoin Helper v0.0.16'
git push origin v0.0.16
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
git log -1 --oneline
