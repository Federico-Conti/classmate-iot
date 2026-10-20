#!/bin/sh

set -eu

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command=${1:-}

run_database_tool() {
    "$script_directory/compose.sh" run --rm --no-deps --entrypoint node database-tools "$@"
}

case "$command" in
    provision)
        seed=${2:-database/poc.example.json}
        case "$seed" in
            /*) echo "Seed must be a repository-relative path" >&2; exit 2 ;;
        esac
        run_database_tool /workspace/database/provision.mjs \
            --database /data/sqlite/classmate.db \
            --seed "/workspace/$seed"
        ;;
    *)
        echo "Usage: $0 provision [seed]" >&2
        exit 2
        ;;
esac
