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
| `inside` | Repeats `-57, -55, -58, -54` dBm; LED green. Represents a consistently strong signal. |
| `target-not-observed` | Continues publishing `targetObserved: false` and `rssiDbm: null` every interval; LED green because MQTT monitoring still works. This observation alone must not confirm an exit. |
| `interruption` | Publishes three `-55` dBm samples, then stops publishing; LED turns red at the next sample interval. Missing telemetry alone must not confirm an exit. |

## Simulated transport Wi-Fi outage

This test disables the simulated ESP32's transport Wi-Fi, not the synthetic school-network observation. Leave Mosquitto running throughout:

1. Stop Wokwi. In `include/wokwi_config.h`, set `syntheticProfile = "outside"` and `simulateWifiOutage = true`; leave `simulatedWifiOutageDurationMs = 20000`.
2. Build the `wokwi` PlatformIO environment and start Wokwi again. Keep its terminal visible; do not restart the simulator or Mosquitto during the test.
3. Expect three normal `Published` messages (`-90`, `-88`, `-91` dBm) and a green LED. The firmware then prints `Simulated Wi-Fi outage started`, turns the LED red, and publishes nothing for 20 seconds.
4. Expect `Simulated Wi-Fi outage ended; reconnecting`. After automatic Wi-Fi and MQTT recovery, the next `Published` message uses a different boot ID and `sequence 0`; `deviceUptimeMs` continues increasing and the LED turns green. Allow additional time beyond the 20-second outage for reconnection.
5. Compare the last message before the outage with the first after it. No telemetry should appear between the two simulator messages announcing outage start and end. When finished, set `simulateWifiOutage = false`, rebuild, and restart Wokwi to restore normal operation.

To also observe delivery at the broker, start the `mosquitto_sub` command below **before** starting Wokwi, adding `-C 5 -W 90` after `-v`. It should capture three messages before the outage and two after recovery, with the same boot-ID and sequence behavior shown in the Wokwi terminal.

How to build the firmware for Wokwi:

- Install PlatformIO and Wokwi for VS Code; open `firmware/` as the workspace and build `wokwi`.
- Select a simulation profile by changing `syntheticProfile` in `firmware/include/wokwi_config.h`: `outside`, `inside`, `target-not-observed`, or `interruption`.
- Copy `include/secrets.example.h` to the ignored `include/secrets.h`, then set `mqttPassword` to the same password as `infra/secrets/mqtt_wearable_password`.
- Start the backend with `sh infra/scripts/up.sh` from the repository root. Wokwi for VS Code includes its private IoT gateway; start **Wokwi: Start Simulator** with the simulator tab visible. The firmware uses `Wokwi-GUEST` solely for transport and `host.wokwi.internal:1883` to reach the broker on the simulator host.
- The broker's configured wearable username and the seeded device ID must both be `esp32-001`. The default Compose configuration and seed use that dedicated simulated identity.

To verify broker delivery while the simulator runs, execute from the repository root:

```sh
sh /home/conti/classmate-iot/infra/scripts/compose.sh exec -T mosquitto \
  sh -c 'mosquitto_sub -h 127.0.0.1 -p 1883 -u "$MQTT_NODERED_USERNAME" -P "$(cat /run/secrets/mqtt_nodered_password)" -t classmate/v1/devices/esp32-001/telemetry -v'
```
