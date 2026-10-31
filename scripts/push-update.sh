#!/usr/bin/env bash
# Release publisher. Runs on the Mac from an extracted v0.0.18 ZIP.
# No secrets, VM runtime data, forced history changes, or server backups.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for tool in git gh node npm rsync mktemp shasum; do
  command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }
done
[[ "$(node -p "require('$SOURCE/package.json').version")" == '0.0.18' ]] || { echo 'Not a v0.0.18 release.' >&2; exit 1; }
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
if [[ "$CURRENT" == '0.0.18' ]]; then
  echo 'v0.0.18 already published. Nothing to do.'
  exit 0
fi
[[ "$CURRENT" == '0.0.16' || "$CURRENT" == '0.0.17' ]] || { echo "Unexpected GitHub version $CURRENT; refusing overwrite." >&2; exit 1; }

# Accept verified v0.0.16, or v0.0.17 only when it is the official
# fast-forward release commit and tag immediately following v0.0.16.
EXPECTED_BASE='bc66b905da56604e1bcf1642bcd5dc8c10e60d9a'
ACTUAL_BASE="$(git rev-parse HEAD)"
if [[ "$CURRENT" == '0.0.16' ]]; then
  [[ "$ACTUAL_BASE" == "$EXPECTED_BASE" ]] || { echo "Unexpected v0.0.16 GitHub commit ($ACTUAL_BASE). Aborting." >&2; exit 1; }
else
  TAGGED_BASE="$(git rev-parse 'refs/tags/v0.0.17^{commit}' 2>/dev/null || true)"
  PARENT="$(git rev-parse 'HEAD^' 2>/dev/null || true)"
  TITLE="$(git show -s --format=%s HEAD)"
  [[ "$ACTUAL_BASE" == "$TAGGED_BASE" && "$PARENT" == "$EXPECTED_BASE" && "$TITLE" == 'Release Sumcoin Helper v0.0.17: automatic hybrid AI, multilingual routing and answer provenance' ]] || {
    echo 'GitHub main is not the verified v0.0.17 release. Aborting.' >&2; exit 1;
  }
fi
if git ls-remote --tags origin 'refs/tags/v0.0.18' | grep -q .; then
  echo 'Tag v0.0.18 already exists on remote; investigate before publishing.' >&2
  exit 1
fi

echo '========== STAGE RELEASE FILES =========='
FILES=(README.md CHANGELOG.md package.json .env.example)
while IFS= read -r file; do FILES+=("$file"); done < <(cd "$SOURCE" && find src scripts knowledge test deploy docs -type f -print | sort)
(cd "$SOURCE" && rsync -a --relative "${FILES[@]}" "$STAGE/repo/")
git add -- "${FILES[@]}"
git diff --cached --check
[[ "$(node -p "require('./package.json').version")" == '0.0.18' ]] || exit 1
npm run check
if git diff --cached --quiet; then
  echo 'No release changes staged.' >&2; exit 1
fi

echo '========== PUBLISH =========='
git diff --cached --stat
git commit -m 'Release Sumcoin Helper v0.0.18: natural price questions, admin-safe quotes and hybrid AI'
git push origin HEAD:main
git tag -a v0.0.18 -m 'Telegram Sumcoin Helper v0.0.18'
git push origin v0.0.18
printf '\nPublished: https://github.com/sumcoinlabs/telegram-sum-helper\n'
git log -1 --oneline
