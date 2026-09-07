# ZEBJUS Python Lab v6.2.2 — DHT11 Real Hardware Fix

## Fixed in v6.2.2

- DHT11 firmware reader changed from the old `pulseIn()` response sequence to direct microsecond edge timing, preventing first-response pulse misalignment on ESP32.
- DHT11 40-bit payload checksum and decoded range are validated before values are exposed to Python.
- Added explicit DHT11 error reasons: response-low timeout, response-high timeout, bit timeout, checksum mismatch and range error.
- DHT11 hardware polls are limited to one new transaction every 1.2 seconds; faster Python calls reuse the current sample instead of over-polling the sensor.
- DHT11 browser card shows the firmware diagnostic reason and never substitutes `28 °C / 65 %RH` while a physical kit is connected.
- Ultrasonic code path is retained from v6.2.1; the reported earlier ultrasonic issue was a pin-selection issue, not a sensor-runtime defect.
- All v6.2.1 real-sensor sync, offline simulation, Servo/Motor/Sensor Studio, Secure Mode and safety fixes are retained.
- Firmware metadata is now `2.2.2`; UI is `v6.2.2`.

---

# ZEBJUS Python Lab v6.2.1 — Real Sensor Sync Fix

## Fixed in v6.2.1

- Physical kit mode no longer substitutes the old demo defaults `28.0 °C / 65.0 %RH / 45 cm` when a DHT11 or ultrasonic read is missing.
- Demo mode now defaults OFF. If a kit was already configured with the older default Demo setting, v6.2.1 migrates it to physical-kit mode once.
- Offline operation still works automatically: when the kit is disconnected, sensor/output visuals run in clearly labelled `SIMULATION` mode.
- DHT11 invalid reads show `READ ERROR`; after a valid sample, a temporary missed read may show the last valid sample as `STALE`.
- HC-SR04 echo timeout no longer reports `maxCm` as if it were a measured distance. It reports an invalid read; the browser can retain the last valid sample as `STALE`.
- JavaScript `null -> 0` coercion is blocked for sensor numeric fields.
- One bad sensor no longer aborts refresh of all other sensors.
- Common Universal Bridge input sensors are prefetched before the first Python live cycle to reduce first-cycle zero/stale readings.
- Simulated bridge/input snapshots are cleared when the physical kit reconnects.
- MPU6050 no longer pads a missing/short I²C response with zeros and presents it as a valid IMU sample. Offline MPU6050/GPS remain animated and explicitly labelled simulation.
- Firmware metadata is `2.2.1`; the `CounterSlot` / `RotarySlot` Arduino preprocessor forward declarations and v6.1/v6.2 safety fixes remain.

---

# ZEBJUS Python Lab v6.2 — Offline Simulation + Sensor Studio + Secure Mode

## New in v6.2

- Programs that use kit hardware no longer fail just because the kit is offline. Valid Python runs in **Offline Simulation** and keeps the browser visual output active.
- When a live program starts offline and the saved kit later reconnects, the ESP32 run session and heartbeat start automatically; subsequent commands are mirrored physically without restarting the Python program.
- `PWMServo` now drives a dedicated servo-angle visualization while still using physical bridge PWM.
- `MotorDriver` now drives direction/speed visualization while still using physical GPIO + PWM.
- GPS gets a dedicated fix/satellite/coordinate visual card.
- MPU6050 gets a dedicated live orientation/tilt visual card.
- Added visual families for LDR, soil moisture, gas, voltage, sound, rain, water level, thermistor, PIR, reed, touch, flame, flow, RPM/counter/pulse, buzzer and joystick.
- Generic I²C/UART/SPI modules keep activity cards; future custom modules can publish arbitrary live cards through `dashboard(...)`.
- Kit Output / Sensors is generated from source instances/imports and live command metadata rather than requiring a fixed page layout.

## Python/runtime bug fixes

- Fixed the Pyodide startup `SyntaxError: unterminated string literal` caused by generated GPS parser escaping.
- Fixed the live-mode `_close_cv_windows is not defined` path by defining the cleanup helper within worker initialization before cleanup use.
- Persistent top-level `while True` behavior from v6.1 is retained.
- I²C same-bus/same-pins sharing and inherited bus pins are retained.

## Firmware / security

- Firmware version is **2.2** and mDNS/status metadata are aligned to 2.2.
- Arduino sketch forward declarations for `CounterSlot`, `RotarySlot` and bridge structs are retained to avoid Arduino auto-prototype type-order errors.
- Added optional per-kit **Secure Mode** using `X-Zebjus-Token`.
- Trusted LAN remains the default, preserving the existing same-Wi-Fi setup flow.
- Setup AP/recovery remains available even when Secure Mode is enabled.
- Existing 1-second heartbeat, 10-second failsafe, active-low safe state, transaction output registry and central resource manager remain enabled.

## Validation performed for this package

- JavaScript syntax: pass for all 7 JavaScript files.
- Pyodide initialization Python source: pass (796 lines compiled by Python parser).
- HTML duplicate IDs: pass.
- Local HTML asset references: pass.
- v2.2 firmware forward declarations/security/version markers: pass.
- ZIP integrity is checked after packaging.

A real Arduino-ESP32 compile was not executable in the packaging sandbox because Arduino CLI/core were unavailable. `tools/compile_esp32_firmware.sh` and `.github/workflows/esp32-firmware-compile.yml` are included so the sketch can be compiled with the real ESP32 toolchain locally or automatically in GitHub Actions.
