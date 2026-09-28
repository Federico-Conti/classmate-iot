# MQTT v1 Contracts

The schemas define the UTF-8 JSON payloads carried by the ClassMate v1 topics:

| Topic | Schema | QoS | Retained |
| --- | --- | --- | --- |
| `classmate/v1/devices/{deviceId}/telemetry` | `telemetry.schema.json` | 1 | No |
| `classmate/v1/devices/{deviceId}/config` | `device-config.schema.json` | 1 | No |
| `classmate/v1/children/{childId}/events` | `event.schema.json` | 1 | Yes; only the latest event is retained |

An `entry` event represents current state `inside`; an `exit` event represents `outside`. SQLite stores the complete history, while MQTT retains only the latest event per child. Payloads intentionally contain no battery or device-availability fields.
Telemetry does not carry a wearable clock value. The Node-RED ingestion flow must assign `receivedAt` when it accepts a valid sample; this server-side value is the sole telemetry timestamp and is not part of the wearable MQTT payload.
