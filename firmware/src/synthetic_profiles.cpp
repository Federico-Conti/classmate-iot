#include <cstring>

#include "synthetic_profiles.h"

namespace {
constexpr int16_t outsideValues[] = {-90, -88, -91, -89};
constexpr int16_t insideValues[] = {-42, -40, -43, -41};

template <size_t size>
RssiObservation repeating(const int16_t (&values)[size], uint32_t index) {
  return {true, values[index % size], false};
}
}

SyntheticProfile syntheticProfileByName(const char *name) {
  if (std::strcmp(name, "inside") == 0) return SyntheticProfile::inside;
  if (std::strcmp(name, "entry-exit") == 0) return SyntheticProfile::entryExit;
  if (std::strcmp(name, "target-not-observed") == 0) return SyntheticProfile::targetNotObserved;
  if (std::strcmp(name, "interruption") == 0) return SyntheticProfile::interruption;
  return SyntheticProfile::outside;
}

RssiObservation syntheticObservation(SyntheticProfile profile, uint32_t sampleIndex) {
  switch (profile) {
    case SyntheticProfile::outside:
      return repeating(outsideValues, sampleIndex);
    case SyntheticProfile::inside:
      return repeating(insideValues, sampleIndex);
    case SyntheticProfile::entryExit: {
      constexpr uint32_t phaseSamples = 30;
      return sampleIndex % (phaseSamples * 2) < phaseSamples
                 ? repeating(insideValues, sampleIndex)
                 : repeating(outsideValues, sampleIndex);
    }
    case SyntheticProfile::targetNotObserved:
      return {false, 0, false};
    case SyntheticProfile::interruption:
      if (sampleIndex >= 3) return {false, 0, true};
      return {true, -55, false};
  }
  return {false, 0, true};
}
