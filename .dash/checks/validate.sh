#!/usr/bin/env bash
# validate: what this repo's CI checks (DASH-111). Bots run it as a
# repo check ({ kind: "repo", name: "validate" }); by hand:
#   npx -p @trops/dash-core dash-check validate
set -o pipefail
echo "+ ./scripts/ci.sh"
./scripts/ci.sh || { echo '{"reason": "./scripts/ci.sh failed: see the output above"}'; exit 1; }
echo '{"reason": "./scripts/ci.sh passed"}'
