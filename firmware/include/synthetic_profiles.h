#pragma once

#include <stdint.h>

#include "rssi_source.h"

enum class SyntheticProfile {
  outside,
  inside,
  targetNotObserved,
  interruption,
};

SyntheticProfile syntheticProfileByName(const char *name);
RssiObservation syntheticObservation(SyntheticProfile profile, uint32_t sampleIndex);
