#!/usr/bin/env bash
# Smoke-check the built sandbox image (T7, FR-004): every runtime the fix agent
# and the verification pass rely on must answer --version. Run after
# `npx sandcastle docker build-image`.
set -euo pipefail

IMAGE_NAME="${1:-sandcastle-loop}"

fail=0
check() {
  local label="$1"; shift
  if docker run --rm --entrypoint bash "$IMAGE_NAME" -lc "$*"; then
    echo "ok: $label"
  else
    echo "FAIL: $label ($*)" >&2
    fail=1
  fi
}

check "python" 'python --version'
check "pytest" 'pytest --version'
check "node" 'node --version'
check "git" 'git --version'
check "gh" 'gh --version'
check "claude" 'claude --version'
check "codex" 'codex --version'
check "opencode" 'opencode --version'
check "non-root agent user" '[[ "$(id -un)" == "agent" ]]'

exit $fail
