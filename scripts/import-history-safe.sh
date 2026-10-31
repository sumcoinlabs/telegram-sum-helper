#!/usr/bin/env bash
# On the VM: import JSON from stdin WITHOUT writing raw Telegram messages to disk.
# Stop the bot while another process updates data/learning.json, then restore it.
set -Eeuo pipefail
cd /home/electrumbtc1/telegram-sum-helper
[[ "$(id -un)" == 'electrumbtc1' ]] || { echo 'Run as electrumbtc1.' >&2; exit 1; }
[[ -d "$HOME/.nvm" ]] || { echo 'Missing nvm installation.' >&2; exit 1; }
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 24 >/dev/null
# Historic import is strictly fingerprint-only regardless of service preferences.
export LEARNING_STORE_EXAMPLES=false
SERVICE=telegram-sum-helper.service
# If not running, leave it stopped. If running, ensure it starts even on import error.
was_active=0
if systemctl --user is-active --quiet "$SERVICE"; then was_active=1; fi
restore(){
  if [[ "$was_active" == 1 ]]; then
    if ! systemctl --user start "$SERVICE"; then
      echo 'CRITICAL: failed to restart Telegram bot. Inspect systemctl --user status.' >&2
      return 1
    fi
  fi
}
trap restore EXIT
echo 'Pausing Telegram bot while merging historical question fingerprints...'
if [[ "$was_active" == 1 ]]; then systemctl --user stop "$SERVICE"; fi
node scripts/learn-export.mjs -
echo 'History imported. Original group messages were not saved or published.'
