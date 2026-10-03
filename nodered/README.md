# Node-RED presence processing

The telemetry flow validates MQTT payloads, resolves the active device assignment, and accepts only a sequence newer than the last one stored for that device and boot. Rejected samples can be inspected with the optional debug node, which is disabled by default.

`RSSI_WINDOW_SIZE` sets the number of observed RSSI samples in each device's moving window (default `4`, supported values `2` through `64`). Set it in the Compose environment before starting Node-RED. The flow stores only the most recent samples for each device. Until the window has that many samples, it reports no weighted RSSI. Once complete, it weights samples from oldest to newest with `1, 2, ..., RSSI_WINDOW_SIZE` and divides by the sum of those weights. For example, `[-90, -80, -70, -60]` produces `-70` dBm.

Samples with `targetObserved: false` do not add RSSI or produce a weighted value. A new boot or a changed child assignment starts a fresh window. Confirmed presence transitions, interruption recovery, and attendance events are separate later tasks; a weighted RSSI is not an attendance state.

