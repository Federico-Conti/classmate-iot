#include "telemetry.h"

Telemetry::Telemetry(RssiSource &source) : source_(source) {}

bool Telemetry::sample(uint32_t nowMs, RssiObservation &observation) {
  if (!schedule_.due(nowMs)) {
    return false;
  }
  observation = source_.observe(sampleIndex_++);
  return true;
}
