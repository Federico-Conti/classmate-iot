#pragma once

#include <stdint.h>

#include "rssi_source.h"
#include "sample_schedule.h"

class Telemetry {
 public:
  explicit Telemetry(RssiSource &source);
  bool sample(uint32_t nowMs);

 private:
  RssiSource &source_;
  SampleSchedule schedule_;
  uint32_t sampleIndex_ = 0;
};
