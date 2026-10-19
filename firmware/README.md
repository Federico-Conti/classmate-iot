# Firmware

The PlatformIO project builds the ESP32 application only for the Wokwi simulator. Synthetic RSSI profiles drive the simulated school Wi-Fi observations.

## Bheavior

Samples RSSI are scheduled every 5 seconds and firmware starts with a red LED.
Green means transport Wi-Fi and MQTT are connected and a telemetry publish has succeeded recently.
A failed publish, broker/Wi-Fi outage, or synthetic interruption returns it to red.

## MQTT telemetry payload

The ESP32 publishes JSON to `classmate/v1/devices/esp32-001/telemetry` (QoS 1, not retained). The payload follows the [telemetry schema](../contracts/mqtt/schemas/telemetry.schema.json):

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Payload contract version; currently `1`. |
| `deviceId` | Device identifier (`esp32-001` in this simulation); also appears in the MQTT topic. |
| `bootId` | Random identifier for the current publishing session. It changes when MQTT reconnects. |
| `sequence` | Message counter, starting at `0` for each `bootId` and incrementing after a successful publish. |
| `deviceUptimeMs` | Milliseconds since the ESP32 started (`millis()`); it does not reset on MQTT reconnection. |
| `wifi.targetObserved` | Whether the synthetic observation sees the target school Wi-Fi network. |
| `wifi.rssiDbm` | Observed signal strength in dBm (`-127` to `0`) when `targetObserved` is `true`; `null` when it is `false`. |

For example, an observed target produces:

```json
{"schemaVersion":1,"deviceId":"esp32-001","bootId":"8b210baef3b139ac","sequence":2,"deviceUptimeMs":12805,"wifi":{"targetObserved":true,"rssiDbm":-91}}
```

## Simulation profiles

Profiles are RSSI sequences that represent the wearable's observation of the school network. Each profile is a sequence of RSSI samples, with `targetObserved` true when the wearable sees the target network and false otherwise.
The firmware publishes each sample to the broker at 5-second intervals, along with `targetObserved` and other telemetry.

Choose `syntheticProfile` in `include/wokwi_config.h`, rebuild the `wokwi` environment, and restart the simulator. Each run starts the selected sequence from its first sample. While publication works, samples appear about every five seconds on `classmate/v1/devices/esp32-001/telemetry` and the LED is green.

| Profile | Expected telemetry and LED |
| --- | --- |
| `outside` | Repeats `-90, -88, -91, -89` dBm with `targetObserved: true`; LED green. Represents a consistently weak signal. |
| `inside` | Repeats `-42, -40, -43, -41` dBm; LED green. All values exceed the POC's `-45` dBm presence threshold. |
| `entry-exit` | Starts with 30 `inside` samples, then 30 `outside` samples, and repeats indefinitely (about 150 seconds per phase). Telemetry continues every five seconds; the confirmed entry/exit events follow after the RSSI window and stability checks. |
| `target-not-observed` | Continues publishing `targetObserved: false` and `rssiDbm: null` every interval; LED green because MQTT monitoring still works. This observation alone must not confirm an exit. |
| `interruption` | Publishes three `-55` dBm samples, then stops publishing; LED turns red at the next sample interval. Missing telemetry alone must not confirm an exit. |

How to build the firmware for Wokwi:

- Install PlatformIO and Wokwi for VS Code; open `firmware/` as the workspace and build `wokwi`.
- Select a simulation profile by changing `syntheticProfile` in `firmware/include/wokwi_config.h`: `entry-exit` (selected by default), `outside`, `inside`, `target-not-observed`, or `interruption`.
- Copy `include/secrets.example.h` to the ignored `include/secrets.h`, then set `mqttPassword` to the same password as `infra/secrets/mqtt_wearable_password`.
- Start the backend with `sh infra/scripts/up.sh` from the repository root. Wokwi for VS Code includes its private IoT gateway; start **Wokwi: Start Simulator** with the simulator tab visible. The firmware uses `Wokwi-GUEST` solely for transport and connects to the broker at the LAN address in `include/wokwi_config.h` (default `192.168.1.49:1883`). Keep it in sync with `POC_BIND_ADDRESS` in `infra/config/defaults.env`; the broker is not exposed on the simulator host's `localhost`.
- The broker's configured wearable username and the seeded device ID must both be `esp32-001`. The default Compose configuration and seed use that dedicated simulated identity.

To verify broker delivery while the simulator runs, execute from the repository root:

```sh
sh /home/conti/classmate-iot/infra/scripts/compose.sh exec -T mosquitto \
  sh -c 'mosquitto_sub -h 127.0.0.1 -p 1883 -u "$MQTT_NODERED_USERNAME" -P "$(cat /run/secrets/mqtt_nodered_password)" -t classmate/v1/devices/esp32-001/telemetry -v'
```
