#include <cstring>

#include "synthetic_profiles.h"

namespace {
template <size_t size>
RssiObservation repeating(const int16_t (&values)[size], uint32_t index) {
  return {true, values[index % size], false};
}
}

SyntheticProfile syntheticProfileByName(const char *name) {
  if (std::strcmp(name, "inside") == 0) return SyntheticProfile::inside;
  if (std::strcmp(name, "target-not-observed") == 0) return SyntheticProfile::targetNotObserved;
  if (std::strcmp(name, "interruption") == 0) return SyntheticProfile::interruption;
  return SyntheticProfile::outside;
}

RssiObservation syntheticObservation(SyntheticProfile profile, uint32_t sampleIndex) {
  switch (profile) {
    case SyntheticProfile::outside: {
      constexpr int16_t values[] = {-90, -88, -91, -89};
      return repeating(values, sampleIndex);
    }
    case SyntheticProfile::inside: {
      constexpr int16_t values[] = {-57, -55, -58, -54};
      return repeating(values, sampleIndex);
    }
    case SyntheticProfile::targetNotObserved:
      return {false, 0, false};
    case SyntheticProfile::interruption:
      if (sampleIndex >= 3) return {false, 0, true};
      return {true, -55, false};
  }
  return {false, 0, true};
}
