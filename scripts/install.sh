#!/usr/bin/env sh
set -eu

PACKAGE="${SPENCER_PACKAGE:-spencer-agent}"

printf '%s\n' "Installing ${PACKAGE}..."

if command -v uv >/dev/null 2>&1; then
  uv tool install --upgrade "$PACKAGE"
elif command -v pipx >/dev/null 2>&1; then
  pipx install --force "$PACKAGE"
elif command -v python3 >/dev/null 2>&1; then
  python3 -m pip install --user --upgrade "$PACKAGE"
else
  printf '%s\n' "Python 3.10+ is required. Install Python or uv, then run this script again." >&2
  exit 1
fi

printf '\nSpencer is installed. Verify it with:\n  spencer --version\n'
