#pragma once

#include <stdint.h>

struct RssiObservation {
  bool targetObserved;
  int16_t rssiDbm;
  bool interrupted;
};

class RssiSource {
 public:
  virtual ~RssiSource() = default;
  virtual RssiObservation observe(uint32_t sampleIndex) = 0;
};

RssiSource &selectedRssiSource();
