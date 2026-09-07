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
