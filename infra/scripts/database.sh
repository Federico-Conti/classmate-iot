#!/bin/sh

set -eu

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command=${1:-}

run_database_tool() {
    "$script_directory/compose.sh" run --rm --no-deps --entrypoint node database-tools "$@"
}

case "$command" in
    migrate)
        run_database_tool /workspace/database/scripts/migrate.mjs \
            --database /data/sqlite/classmate.db
        ;;
    provision)
        seed=${2:-database/seeds/poc.example.json}
        case "$seed" in
            /*) echo "Seed must be a repository-relative path" >&2; exit 2 ;;
        esac
        run_database_tool /workspace/database/scripts/provision.mjs \
            --database /data/sqlite/classmate.db \
            --seed "/workspace/$seed"
        ;;
    *)
        echo "Usage: $0 {migrate|provision [seed]}" >&2
        exit 2
        ;;
esac
