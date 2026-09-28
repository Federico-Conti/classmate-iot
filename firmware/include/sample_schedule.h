#pragma once

#include <stdint.h>

class SampleSchedule {
 public:
  static constexpr uint32_t periodMs = 5000;

  bool due(uint32_t nowMs) {
    if (static_cast<int32_t>(nowMs - nextMs_) < 0) return false;
    nextMs_ = nowMs + periodMs;
    return true;
  }

 private:
  uint32_t nextMs_ = 0;
};
