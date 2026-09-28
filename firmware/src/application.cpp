#include <Arduino.h>

#include "application.h"
#include "device_config.h"
#include "telemetry.h"

namespace {
Telemetry telemetry(selectedRssiSource());
}

void initializeApplication() {
  Serial.begin(115200);
  pinMode(device_config::redPin, OUTPUT);
  pinMode(device_config::greenPin, OUTPUT);
  digitalWrite(device_config::redPin, HIGH);
  digitalWrite(device_config::greenPin, LOW);
  Serial.printf("ClassMate target: %s\r\n", device_config::deviceId);
}

void runApplication() {
  telemetry.sample(millis());
  delay(100);
}
