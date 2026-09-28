#include <Arduino.h>
#include <MQTT.h>
#include <WiFi.h>

#include "application.h"
#include "device_config.h"
#include "telemetry.h"

#if __has_include("secrets.h")
#include "secrets.h"
#else
namespace device_secrets {
constexpr const char *mqttPassword = "";
}
#endif

namespace {
Telemetry telemetry(selectedRssiSource());
WiFiClient networkClient;
MQTTClient mqttClient(512);
constexpr uint32_t maximumRetryMs = 30000;
constexpr uint32_t telemetryTimeoutMs = SampleSchedule::periodMs * 2;
uint32_t nextRetryMs = 0;
uint32_t retryDelayMs = 1000;
uint32_t lastPublishMs = 0;
uint32_t sequence = 0;
char bootId[17] = {};
bool operational = false;
bool wifiConnected = false;
bool wifiOutageStarted = false;
bool wifiOutageFinished = false;
uint32_t wifiOutageStartedMs = 0;

void setOperational(bool value) {
  if (operational == value) return;
  operational = value;
  digitalWrite(device_config::redPin, value ? LOW : HIGH);
  digitalWrite(device_config::greenPin, value ? HIGH : LOW);
}

void scheduleRetry(uint32_t nowMs) {
  nextRetryMs = nowMs + retryDelayMs;
  retryDelayMs = retryDelayMs >= maximumRetryMs / 2 ? maximumRetryMs : retryDelayMs * 2;
}

void newBootId() {
  snprintf(bootId, sizeof(bootId), "%08lx%08lx",
           static_cast<unsigned long>(esp_random()), static_cast<unsigned long>(esp_random()));
  sequence = 0;
}

bool simulateWifiOutage(uint32_t nowMs) {
  if (!device_config::simulateWifiOutage || wifiOutageFinished) return false;
  if (!wifiOutageStarted && operational && sequence >= 3) {
    wifiOutageStarted = true;
    wifiOutageStartedMs = nowMs;
    networkClient.stop();
    WiFi.disconnect(true);
    wifiConnected = false;
    setOperational(false);
    Serial.println("Simulated Wi-Fi outage started");
  }
  if (!wifiOutageStarted) return false;
  if (static_cast<uint32_t>(nowMs - wifiOutageStartedMs) <
      device_config::simulatedWifiOutageDurationMs) return true;
  wifiOutageFinished = true;
  WiFi.mode(WIFI_STA);
  nextRetryMs = 0;
  retryDelayMs = 1000;
  Serial.println("Simulated Wi-Fi outage ended; reconnecting");
  return false;
}

bool publishObservation(uint32_t nowMs, const RssiObservation &observation) {
  char topic[96];
  snprintf(topic, sizeof(topic), "classmate/v1/devices/%s/telemetry", device_config::deviceId);
  char rssiValue[8];
  snprintf(rssiValue, sizeof(rssiValue), "%d", observation.rssiDbm);
  char payload[384];
  const int length = snprintf(
      payload, sizeof(payload),
      "{\"schemaVersion\":1,\"deviceId\":\"%s\",\"bootId\":\"%s\","
      "\"sequence\":%lu,\"deviceUptimeMs\":%lu,"
      "\"wifi\":{\"targetObserved\":%s,\"rssiDbm\":%s}}",
      device_config::deviceId, bootId, static_cast<unsigned long>(sequence),
      static_cast<unsigned long>(nowMs),
      observation.targetObserved ? "true" : "false",
      observation.targetObserved ? rssiValue : "null");
  if (length < 0 || static_cast<size_t>(length) >= sizeof(payload) ||
      !mqttClient.publish(topic, payload, false, 1)) return false;
  Serial.printf("Published %s sequence %lu: %s\r\n", bootId,
                static_cast<unsigned long>(sequence), payload);
  ++sequence;
  lastPublishMs = nowMs;
  setOperational(true);
  return true;
}
}

void initializeApplication() {
  Serial.begin(115200);
  pinMode(device_config::redPin, OUTPUT);
  pinMode(device_config::greenPin, OUTPUT);
  digitalWrite(device_config::redPin, HIGH);
  digitalWrite(device_config::greenPin, LOW);
  Serial.printf("ClassMate target: %s\r\n", device_config::deviceId);
  if (device_secrets::mqttPassword[0] == '\0') {
    Serial.println("Missing local MQTT password; monitoring disabled");
    return;
  }
  WiFi.mode(WIFI_STA);
  networkClient.setTimeout(2000);
  mqttClient.begin(device_config::mqttHost, device_config::mqttPort, networkClient);
  mqttClient.setOptions(15, true, 2000);
  newBootId();
}

void runApplication() {
  if (device_secrets::mqttPassword[0] == '\0') {
    delay(100);
    return;
  }
  const uint32_t nowMs = millis();
  if (simulateWifiOutage(nowMs)) {
    delay(100);
    return;
  }
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) networkClient.stop();
    wifiConnected = false;
    setOperational(false);
    if (static_cast<int32_t>(nowMs - nextRetryMs) >= 0) {
      WiFi.begin(device_config::transportSsid);
      scheduleRetry(nowMs);
    }
  } else {
    if (!wifiConnected) {
      wifiConnected = true;
      nextRetryMs = 0;
      retryDelayMs = 1000;
    }
    if (!mqttClient.connected()) {
      setOperational(false);
      if (static_cast<int32_t>(nowMs - nextRetryMs) >= 0) {
        if (mqttClient.connect(device_config::deviceId, device_config::mqttUsername,
                               device_secrets::mqttPassword)) {
          newBootId();
          retryDelayMs = 1000;
          nextRetryMs = 0;
        } else {
          scheduleRetry(millis());
        }
      }
    } else {
      mqttClient.loop();
      if (static_cast<uint32_t>(nowMs - lastPublishMs) >= telemetryTimeoutMs)
        setOperational(false);
      RssiObservation observation;
      if (telemetry.sample(nowMs, observation)) {
        if (observation.interrupted || !publishObservation(nowMs, observation)) {
          setOperational(false);
          Serial.println("Monitoring interrupted or telemetry unavailable");
        }
      }
    }
  }
  delay(100);
}
