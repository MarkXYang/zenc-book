#ifndef SENSOR_HAL_H
#define SENSOR_HAL_H

#define HAL_MAX_CHANNELS 8
#define HAL_STATUS_OK    0

typedef struct {
    int channel;
    double scale;
    double offset;
} HalCalibration;

static inline double hal_apply_calibration(HalCalibration cal, int raw_adc) {
    return ((double)raw_adc * cal.scale) + cal.offset;
}

#endif

