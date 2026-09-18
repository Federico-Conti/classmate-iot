# Local Secrets

Keep runtime credentials in this directory using the extensionless filenames described by the templates. Git ignores every file here except this README and `*.example` templates.

Use restrictive permissions before creating local values:

```sh
umask 077
```

Run `./infra/scripts/prepare-mqtt-secrets.sh` to generate the three local MQTT passwords used by Compose:

- `mqtt_wearable_password` for the configured wearable username (default `esp32-001`)
- `mqtt_nodered_password` for the `node-red` service principal
- `mqtt_parent_password` for the shared read-only `parent-poc` POC principal

The wearable username must match its device ID because the generated Mosquitto ACL restricts publishing to `classmate/v1/devices/{deviceId}/telemetry`. The ParentApp credential is shared and read-only across child event topics; it is unsuitable for Internet or production deployment because it does not isolate families.

Do not commit passwords, tokens, private keys, or generated Mosquitto password files.
