#!/usr/bin/env bash
# Publishes v0.0.2 over an existing sumcoinlabs/telegram-sum-helper main branch.
# Uses a fresh staging clone; NEVER force-pushes or touches your production servers.
set -Eeuo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
for command in git gh node rsync mktemp; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done
if [[ "$(node -p "require('$SOURCE/package.json').version")" != "0.0.2" ]]; then
  echo 'Refusing: source is not version 0.0.2.' >&2;exit 1
fi
printf '========== VERIFY TESTS =========='; echo
(cd "$SOURCE" && npm test)
gh auth status >/dev/null
LOGIN="$(gh api user -q .login)"
if [[ "$LOGIN" != 'sumcoinlabs' ]]; then echo "Signed into GitHub as $LOGIN, expected sumcoinlabs." >&2;exit 1;fi
if ! gh repo view sumcoinlabs/telegram-sum-helper >/dev/null 2>&1; then
  echo 'The repository does not exist. Publish v0.0.1 first with its publish-github.sh script.' >&2;exit 1
fi
STAGE="$(mktemp -d "$HOME/Documents/.telegram-sum-helper-publish.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
printf '\n========== CLONE LATEST MAIN ==========\n'
gh repo clone sumcoinlabs/telegram-sum-helper "$STAGE/repo" -- --branch main --single-branch
printf '\n========== APPLY V0.0.2 SOURCE ==========\n'
rsync -a --delete --exclude='.git/' --exclude='.env' --exclude='data/' --exclude='node_modules/' \
  "$SOURCE/" "$STAGE/repo/"
cd "$STAGE/repo"
git add -A
if git ls-files | grep -Eq '(^|/)(\.env|result\.json|.*\.log)$'; then
  echo 'Aborted: a secret or chat export would be committed.' >&2;exit 1
fi
if git diff --cached --quiet; then
  echo 'No changes detected. Repository already matches the local v0.0.2 release.'
  exit 0
fi
printf '\n========== COMMIT AND PUSH ==========\n'
git diff --cached --stat
git commit -m 'Release telegram-sum-helper v0.0.2: multilingual support and safety improvements'
git push origin HEAD:main
if ! git ls-remote --tags origin 'refs/tags/v0.0.2' | grep -q .; then
  git tag -a v0.0.2 -m 'telegram-sum-helper v0.0.2'
  git push origin v0.0.2
fi
printf '\nPublished version 0.0.2: https://github.com/sumcoinlabs/telegram-sum-helper\n'
