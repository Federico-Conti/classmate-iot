#!/bin/sh

set -eu

infra_directory=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
repository_root=$(CDPATH= cd -- "$infra_directory/.." && pwd)
defaults_file="$infra_directory/config/defaults.env"
local_file="$infra_directory/config/local.env"

if [ -f "$local_file" ]; then
    exec docker compose \
        --project-directory "$repository_root" \
        --env-file "$defaults_file" \
        --env-file "$local_file" \
        -f "$infra_directory/compose.yaml" \
        "$@"
fi

exec docker compose \
    --project-directory "$repository_root" \
    --env-file "$defaults_file" \
    -f "$infra_directory/compose.yaml" \
    "$@"
