# Srecets

Create the following three files manually before starting the services. Compose reads their contents as fixed MQTT passwords and never generates or modifies them:

- `mqtt_wearable_password` for the configured wearable username (default `esp32-001`)
- `mqtt_nodered_password` for the `node-red` service principal
- `mqtt_parent_password` for the shared read-only `parent-poc` POC principal
