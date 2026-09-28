#include "rssi_source.h"
#include "synthetic_profiles.h"
#include "device_config.h"

class SyntheticRssiSource final : public RssiSource {
 public:
  RssiObservation observe(uint32_t sampleIndex) override {
    return syntheticObservation(syntheticProfileByName(device_config::syntheticProfile), sampleIndex);
  }
};

RssiSource &selectedRssiSource() {
  static SyntheticRssiSource source;
  return source;
}
