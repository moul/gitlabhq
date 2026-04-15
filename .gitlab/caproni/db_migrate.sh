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
exec "$SCRIPT_DIR/exec.sh" bundle exec rake db:migrate
