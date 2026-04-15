#!/usr/bin/env bash

# Runs any command from local source within `gitlab/` in the context
# of the cluster's toolbox pod via mirrord.
#
# Usage:
#   .gitlab/caproni/exec.sh rake gitlab:graphql:schema:dump
#   .gitlab/caproni/exec.sh rails runner 'puts User.count'
#   .gitlab/caproni/exec.sh $SHELL
#
# Prerequisites:
# - `scripts/prepare-dev-env.sh` was performed
# - `.gitlab/caproni/setup.sh` was performed

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <executable> <...>" >&2
  echo "Example: $0 bundle exec rake gitlab:graphql:schema:dump" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOLITH_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

CONFIG="$MONOLITH_DIR/.gitlab/caproni/.mirrord/exec.json"
TARGET_DEPLOYMENT="deploy/gitlab-toolbox"
TARGET="$TARGET_DEPLOYMENT/container/toolbox"
NAMESPACE="gitlab"
QUOTED_ARGS=$(printf '%q ' "$@")
COMMAND="cd $MONOLITH_DIR && mise exec -- $QUOTED_ARGS"

if [[ $OSTYPE == 'darwin'* ]]; then
  if command -v brew >/dev/null 2>&1; then
    libpq_prefix="$(brew --prefix libpq@16 2>/dev/null || brew --prefix libpq 2>/dev/null || true)"
    if [[ -n "$libpq_prefix" && -d "$libpq_prefix/bin" ]]; then
      export PATH="$libpq_prefix/bin:$PATH"
    fi
  fi
fi

kubectl wait --for=condition=Ready pod \
  -l app=toolbox \
  --namespace "$NAMESPACE" \
  --timeout=120s

mirrord exec \
  --config-file "$CONFIG" \
  --target "$TARGET" \
  --target-namespace "$NAMESPACE" \
  -- bash -c "$COMMAND"
