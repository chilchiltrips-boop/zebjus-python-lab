# ZEBJUS Python Lab v6.1 — Safety + Runtime Bridge FIXED

v6.1 keeps the v6 Universal Hardware Bridge architecture and fixes the safety, live-runtime and resource-allocation issues found during the full v6.0 review.

## Critical fixes

- Active-low `DigitalOutput` / relay failsafe now stores the correct physical safe state. A heartbeat timeout will not force every digital output LOW.
- `HardwareTransaction` `WRITE` and `PULSEOUT` operations register outputs in the firmware safe-output registry.
- GPIO and PWM bridge APIs now fail cleanly when safe-output/PWM slots are exhausted.
- `DigitalOutput.toggle()` now toggles the logical state correctly for both active-high and active-low devices.
- Persistent `while True` runtime: code before the top-level live loop initializes once per Run session; loop variables, filters, counters and objects persist between browser cycles.
- Exact source line layout is retained by the live-loop transformer so runtime errors continue to point to the student's original line.

## I²C / bus fixes

- OLED, `I2C`, `I2CDevice` and `MPU6050` can share I²C bus 0 when SDA/SCL are the same.
- If an I²C object omits SDA/SCL after the bus has already been configured, it inherits that bus's existing SDA/SCL pair.
- `InterfaceConflictError` is produced only when the same hardware bus number is explicitly requested with a different pin pair.
- Firmware independently enforces the same rule, so browser validation cannot be bypassed by dynamic Python code.
- SPI buses can share SCK/MISO/MOSI across devices with separate CS pins.
- UART ports reject accidental reconfiguration to different RX/TX or baud settings during the same run.

## GPIO / resource fixes

- Firmware now has a central resource manager covering outputs, OLED/I²C, generic I²C, UART, SPI, rotary encoders and interrupt counters.
- `CounterInput` editor/runtime pins now match firmware. GPIO36/39 and GPIO12 are not offered as counter pins.
- GPIO12 remains available only for selected explicit input/pulse uses and is moved out of normal auto-suggestion priority because it is a classic ESP32 boot-strapping pin.
- Legacy `Motor()` and `Servo()` are labelled as simulator/legacy APIs; physical projects should use `MotorDriver(...)` and `PWMServo(pin)`.

## Connection / browser behavior retained

- Cached IP primary + Kit-ID verification
- mDNS fallback
- 5 consecutive failures before the UI changes to disconnected
- silent background reconnect and no connection-state blinking
- 1-second active-run heartbeat
- 10-second ESP32 failsafe
- Wix/embedded-browser Local Network Access failure now gives a clear new-tab fallback message

## Firmware

Use:

`esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_1.ino`

Firmware/status/mDNS metadata are aligned at **2.1**.

OLED support requires Adafruit SSD1306, Adafruit GFX and Adafruit BusIO.

## Validation

- JavaScript syntax: passed
- 38/38 embedded Python examples: passed Python syntax compilation
- Pyodide worker embedded Python blocks: passed Python syntax compilation
- I²C sharing/conflict regression tests: passed
- Persistent live-loop state regression test: passed
- HTML duplicate ID and local-reference checks: passed
- Firmware delimiter/static route/safety checks: passed

See `BUILD_CHECK.json` for the packaged check result and `V6_1_SAFETY_RUNTIME_FIXES.md` for focused regression cases.

### Hardware compile note

The packaging runtime did not contain Arduino CLI, and its network/DNS sandbox prevented downloading the toolchain. Firmware syntax/delimiter/static route checks were run, and the Arduino-ESP32 API calls used by this sketch were cross-checked against current official API documentation. A final Arduino IDE/CLI compile on the target ESP32 environment is still required before flashing production kits.
