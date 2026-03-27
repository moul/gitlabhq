#!/usr/bin/env bash

# Runs `rake db:migrate` from local source within `gitlab/` in the context of
# cluster's database.
#
# Prerequisites:
# - Cluster is up with healthy webservice container in gitlab-webservice-default pod
# - `caproni run` is NOT running
# - `.gitlab/caproni/setup.sh` was performed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOLITH_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_DIR="$(cd "$MONOLITH_DIR/.." && pwd)"

CONFIG="$MONOLITH_DIR/.gitlab/caproni/.mirrord/db_migrate.json"
TARGET_DEPLOYMENT="deploy/gitlab-toolbox"
TARGET="$TARGET_DEPLOYMENT/container/toolbox"
NAMESPACE="gitlab"
COMMAND="cd $MONOLITH_DIR && mise exec -- bundle exec rake db:migrate"

echo "REPO_DIR: ${REPO_DIR}"
echo "MONOLITH_DIR: ${MONOLITH_DIR}"
echo "CONFIG: ${CONFIG}"

kubectl wait -n "$NAMESPACE" --for=condition=Available "${TARGET_DEPLOYMENT}" --timeout=60s

mirrord exec \
  --config-file "$CONFIG" \
  --target "$TARGET" \
  --target-namespace "$NAMESPACE" \
  -- bash -c "$COMMAND"
