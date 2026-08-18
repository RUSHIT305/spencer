#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="RUSHIT305/spencer"
INSTALL_DIR="${SPENCER_INSTALL_DIR:-${HOME}/.spencer/bin}"
BASE_RELEASE_URL="${SPENCER_RELEASE_BASE_URL:-https://github.com/${REPOSITORY}/releases/download}"

fail() {
  printf 'Spencer installer error: %s\n' "$1" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || fail 'curl is required. Install curl and run the installer again.'
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || fail 'sha256sum or shasum is required.'

case "$(uname -s)" in
  Linux) platform="linux" ;;
  Darwin) platform="macos" ;;
  *) fail "unsupported operating system: $(uname -s). Use install.ps1 on Windows." ;;
esac

case "$(uname -m)" in
  x86_64|amd64) architecture="x64" ;;
  arm64|aarch64)
    if [ "$platform" = "macos" ]; then architecture="arm64"; else fail 'Linux ARM64 releases are not available yet.'; fi
    ;;
  *) fail "unsupported architecture: $(uname -m)" ;;
esac

version="${SPENCER_VERSION:-}"
if [ -z "$version" ]; then
  latest_url="$(curl -fsSL -o /dev/null -w '%{url_effective}' "https://github.com/${REPOSITORY}/releases/latest")"
  version="${latest_url##*/v}"
fi
[ -n "$version" ] || fail 'could not determine the latest Spencer release.'

asset="spencer-${version}-${platform}-${architecture}"
release_url="${BASE_RELEASE_URL}/v${version}"
tmp_dir="$(mktemp -d 2>/dev/null || mktemp -d -t spencer)"
trap 'rm -rf "$tmp_dir"' EXIT
binary_tmp="${tmp_dir}/${asset}"
sums_tmp="${tmp_dir}/SHA256SUMS"

printf 'Downloading Spencer %s for %s-%s...\n' "$version" "$platform" "$architecture"
curl -fsSL "${release_url}/${asset}" -o "$binary_tmp"
curl -fsSL "${release_url}/SHA256SUMS" -o "$sums_tmp"

expected="$(awk -v file="$asset" '$2 == file || $2 == "*" file { print $1; exit }' "$sums_tmp")"
[ -n "$expected" ] || fail "checksum entry missing for ${asset}."
if command -v sha256sum >/dev/null 2>&1; then actual="$(sha256sum "$binary_tmp" | awk '{print $1}')"; else actual="$(shasum -a 256 "$binary_tmp" | awk '{print $1}')"; fi
[ "$expected" = "$actual" ] || fail "checksum verification failed for ${asset}."

mkdir -p "$INSTALL_DIR"
chmod 0755 "$binary_tmp"
install -m 0755 "$binary_tmp" "${INSTALL_DIR}/spencer"

case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) path_ready=true ;;
  *) path_ready=false ;;
esac
if [ "$path_ready" = false ]; then
  profile="${SPENCER_SHELL_PROFILE:-}"
  if [ -z "$profile" ]; then
    if [ "${SHELL##*/}" = "zsh" ]; then profile="${ZDOTDIR:-${HOME}}/.zshrc"; else profile="${HOME}/.bashrc"; fi
  fi
  mkdir -p "$(dirname "$profile")"
  touch "$profile"
  if ! grep -Fqx "export PATH=\"${INSTALL_DIR}:\$PATH\"" "$profile"; then
    printf '\n# Spencer CLI\nexport PATH="%s:$PATH"\n' "$INSTALL_DIR" >> "$profile"
  fi
fi

printf '\nSpencer %s installed at %s/spencer\n' "$version" "$INSTALL_DIR"
if [ "$path_ready" = false ]; then printf 'Run: export PATH="%s:$PATH" or open a new terminal.\n' "$INSTALL_DIR"; fi
printf 'Then: cd /path/to/your/project && spencer\n'
