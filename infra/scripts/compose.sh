#!/bin/sh

set -eu

infra_directory=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
repository_root=$(CDPATH= cd -- "$infra_directory/.." && pwd)
defaults_file="$infra_directory/config/defaults.env"

exec docker compose \
    --project-directory "$repository_root" \
    --env-file "$defaults_file" \
    -f "$infra_directory/compose.yaml" \
    "$@"
