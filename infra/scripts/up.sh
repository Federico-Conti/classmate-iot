#!/bin/sh

set -eu

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"$script_directory/prepare-mqtt-secrets.sh"
"$script_directory/compose.sh" up --detach --build --wait
"$script_directory/compose.sh" exec -T mosquitto \
    sh -c 'mosquitto_sub -h 127.0.0.1 -p 1883 -u "$MQTT_NODERED_USERNAME" -P "$(cat /run/secrets/mqtt_nodered_password)" -t "\$SYS/broker/uptime" -C 1 -W 5' >/dev/null
curl --fail --silent --show-error --max-time 5 \
    http://127.0.0.1:1880/healthz >/dev/null
"$script_directory/compose.sh" ps

echo "ClassMate backend is running and healthy."
