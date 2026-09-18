#!/bin/sh

set -eu

infra_directory=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
secret_directory="$infra_directory/secrets"

umask 077
mkdir -p "$secret_directory"

for role in wearable nodered parent; do
    secret_file="$secret_directory/mqtt_${role}_password"
    if [ ! -s "$secret_file" ]; then
        openssl rand -base64 24 | tr -d '\n' > "$secret_file"
        printf '\n' >> "$secret_file"
        echo "Created local MQTT password: $secret_file"
    fi
done
