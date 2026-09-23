#!/bin/sh

set -eu

password_file=/tmp/classmate-mosquitto-passwords
acl_file=/tmp/classmate-mosquitto-acl

read_secret() {
    secret_file=$1
    if [ ! -s "$secret_file" ]; then
        echo "Missing or empty MQTT secret: $secret_file" >&2
        exit 1
    fi
    tr -d '\r\n' < "$secret_file"
}

umask 077
case "$MQTT_WEARABLE_USERNAME" in
    ''|*[!a-z0-9-]*)
        echo "MQTT_WEARABLE_USERNAME must contain only lowercase letters, digits, and hyphens" >&2
        exit 1
        ;;
esac

{
    printf '%s:%s\n' "$MQTT_WEARABLE_USERNAME" "$(read_secret /run/secrets/mqtt_wearable_password)"
    printf '%s:%s\n' "$MQTT_NODERED_USERNAME" "$(read_secret /run/secrets/mqtt_nodered_password)"
    printf '%s:%s\n' "$MQTT_PARENT_USERNAME" "$(read_secret /run/secrets/mqtt_parent_password)"
} > "$password_file"

mosquitto_passwd -U "$password_file"
cat /mosquitto/config/acl.base.conf > "$acl_file"
{
    printf '\nuser %s\n' "$MQTT_WEARABLE_USERNAME"
    printf 'topic write classmate/v1/devices/%s/telemetry\n' "$MQTT_WEARABLE_USERNAME"
    printf 'topic read classmate/v1/devices/%s/config\n' "$MQTT_WEARABLE_USERNAME"
} >> "$acl_file"
chown mosquitto:mosquitto "$password_file" "$acl_file"
exec /usr/sbin/mosquitto -c /mosquitto/config/mosquitto.conf
