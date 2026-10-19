#pragma once

namespace device_config {
constexpr const char *deviceId = "esp32-001";
constexpr const char *transportSsid = "Wokwi-GUEST";
constexpr const char *mqttHost = "192.168.1.49";
constexpr uint16_t mqttPort = 1883;
constexpr const char *mqttUsername = deviceId;
constexpr const char *syntheticProfile = "entry-exit";
constexpr int redPin = 25;
constexpr int greenPin = 26;
}
