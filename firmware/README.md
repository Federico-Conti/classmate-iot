# Firmware

The PlatformIO project builds the ESP32 application only for the Wokwi simulator. Synthetic RSSI profiles drive the simulated school Wi-Fi observations; no physical-device build or field calibration is included.

The `wokwi` environment is the only target. 

Build outputs live under `firmware/.pio/build/`; they are not committed. Its RSSI observations are synthetic, not ESP32 Wi-Fi measurements. 
Select a simulation profile by changing `syntheticProfile` in `firmware/include/wokwi_config.h`: `outside`, `approach`, `inside`, `oscillation`, `exit`, `target-not-observed`, or `interruption`. 
Samples are scheduled every 5 seconds (up to 100 ms loop tolerance).

The firmware currently starts with a red monitoring LED and prints observations to serial.


How to build the firmware for Wokwi:

- Install PlatformIO Core VsCode Plugin
- open `firmware/` as the workspace, build `wokwi`, then run **Wokwi: Start Simulator**.

`diagram.json` models the ESP32 DevKit C V4 and a common-cathode RGB LED with 220-ohm resistors; its TX/RX connections to `$serialMonitor` route `Serial` output to the **Wokwi Terminal** in VS Code. Keep the simulator tab visible so the simulation does not pause. The terminal should show `ClassMate target: esp32-wokwi-001` and then `RSSI observation: -90 dBm` (with a timestamp), followed by another sample every 5 seconds. `wokwi.toml` points to the PlatformIO binary and ELF.
