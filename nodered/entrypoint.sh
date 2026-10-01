#!/bin/sh
set -eu

node - <<'CREDENTIALS'
const fs = require('node:fs');

const username = process.env.MQTT_USERNAME;
const passwordFile = process.env.MQTT_PASSWORD_FILE;
if (!username || !passwordFile) {
    throw new Error('MQTT credentials are not configured');
}
const password = fs.readFileSync(passwordFile, 'utf8').replace(/\r?\n$/, '');
if (!password) {
    throw new Error('MQTT password is empty');
}
const credentials = {
    'telemetry-broker': { user: username, password },
};
fs.writeFileSync('/data/flows_cred.json', JSON.stringify(credentials), { mode: 0o600 });
CREDENTIALS

exec /usr/src/node-red/entrypoint.sh "$@"
