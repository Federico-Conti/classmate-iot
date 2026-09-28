#pragma once

#include <stdint.h>

#include "rssi_source.h"

enum class SyntheticProfile {
  outside,
  approach,
  inside,
  oscillation,
  exit,
  targetNotObserved,
  interruption,
};

SyntheticProfile syntheticProfileByName(const char *name);
RssiObservation syntheticObservation(SyntheticProfile profile, uint32_t sampleIndex);
