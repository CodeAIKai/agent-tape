#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v moon >/dev/null; then
  export MOON_HOME="${MOON_HOME:-$HOME/.moon}"
  export PATH="$MOON_HOME/bin:$PATH"
fi
if ! command -v moon >/dev/null; then
  echo "MoonBit is required to rebuild the kernel. Install it from https://docs.moonbitlang.com/en/latest/ and add moon to PATH." >&2
  exit 1
fi
moon fmt
moon test --target js
moon build --target js --release
cp _build/js/release/build/agent_tape.js web/agent_tape.js
mkdir -p web/fixtures
cp fixtures/*.json web/fixtures/
node tests/host.mjs
