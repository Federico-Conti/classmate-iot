#include <Arduino.h>

#include "telemetry.h"

Telemetry::Telemetry(RssiSource &source) : source_(source) {}

bool Telemetry::sample(uint32_t nowMs) {
  if (!schedule_.due(nowMs)) {
    return false;
  }
  const RssiObservation observation = source_.observe(sampleIndex_++);
  if (observation.interrupted) {
    return false;
  }
  if (observation.targetObserved) {
    Serial.printf("RSSI observation: %d dBm at %lu ms\r\n", observation.rssiDbm,
                  static_cast<unsigned long>(nowMs));
  } else {
    Serial.printf("Target not observed at %lu ms\r\n",
                  static_cast<unsigned long>(nowMs));
  }
  return true;
}
