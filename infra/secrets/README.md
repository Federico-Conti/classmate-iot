# Local Secrets

Keep runtime credentials in this directory using the extensionless filenames described by the templates. Git ignores every file here except this README and `*.example` templates.

Use restrictive permissions before creating local values:

```sh
umask 077
```

Create the following three files manually before starting the services. Compose reads their contents as fixed MQTT passwords and never generates or modifies them:

- `mqtt_wearable_password` for the configured wearable username (default `esp32-001`)
- `mqtt_nodered_password` for the `node-red` service principal
- `mqtt_parent_password` for the shared read-only `parent-poc` POC principal

You can initialize them from the tracked templates and then replace the example values:

```sh
cp infra/secrets/mqtt_wearable_password.example infra/secrets/mqtt_wearable_password
cp infra/secrets/mqtt_nodered_password.example infra/secrets/mqtt_nodered_password
cp infra/secrets/mqtt_parent_password.example infra/secrets/mqtt_parent_password
chmod 600 infra/secrets/mqtt_wearable_password infra/secrets/mqtt_nodered_password infra/secrets/mqtt_parent_password
```

The wearable username must match its device ID because the generated Mosquitto ACL restricts publishing to `classmate/v1/devices/{deviceId}/telemetry`. The ParentApp credential is shared and read-only across child event topics; it is unsuitable for Internet or production deployment because it does not isolate families.

Do not commit passwords, tokens, private keys, or generated Mosquitto password files.
