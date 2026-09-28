#pragma once

namespace device_config {
constexpr const char *deviceId = "esp32-001";
constexpr const char *transportSsid = "Wokwi-GUEST";
constexpr const char *mqttHost = "host.wokwi.internal";
constexpr uint16_t mqttPort = 1883;
constexpr const char *mqttUsername = deviceId;
constexpr const char *syntheticProfile = "outside";
constexpr bool simulateWifiOutage = false;
constexpr uint32_t simulatedWifiOutageDurationMs = 20000;
constexpr int redPin = 25;
constexpr int greenPin = 26;
}
