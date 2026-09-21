# ZEBJUS Python Lab v6.7.0 — Student Circuit Studio

This release gives students three clear, linked workspaces: **Python Lab**, **Circuit Design**, and **Schematic**. They share one saved circuit and generated `main.py` block while retaining the proven Python runtime, same-Wi-Fi kit connection, diagnostics, and firmware tools.

## v6.7.0 highlights
- Common top tabs switch directly between Python Lab, Circuit Design, and Schematic.
- Circuit Design is now **2D-only** with 45 recognizable top-view physical-part illustrations plus a pin-labelled ESP32 DevKit; no 3D assets or mode remain.
- Real-part cues include HC-SR04 transducers, a vented DHT11 body, SG90 servo horn, L298N-style driver, relay block, MQ gas can, PIR dome, GPS patch antenna, displays, probes, terminals, and PCB hardware.
- Components and the ESP32 board are draggable; connected wires follow continuously and positions snap to a 10 px grid on release.
- Mouse wheel zoom is anchored under the pointer. Dragging empty canvas space pans both Circuit Design and Schematic.
- Circuit/Schematic changes propagate through shared storage plus `BroadcastChannel`; every valid change refreshes the generated circuit block in `main.py`.
- Student Settings keeps camera, kit connection, and editor options clear; Wi-Fi, security, renaming, and legacy controls are folded under **Advanced kit settings**.
- Reconnect-safe TM1637/LCD hardware queues: transport-paused output resumes automatically without clearing genuine device faults.
- Stable Firmware Center kit targeting, matched Secure Mode token injection and `Uint8Array` USB recovery data.
- Circuit board edge coordinates are preserved, and Circuit → `main.py` updates are queued safely while code is running.
- Full release verification now includes targeted bugfix checks plus the Chromium Circuit/Schematic browser test.
- Circuit Designer wiring attaches to **rendered physical pin hotspots**, not hard-coded wire coordinates.
- Components can also be rotated 90° left/right and flipped horizontally/vertically; labels/text remain upright.
- Curved, color-coded wiring with a white underlay keeps crossings readable on the bright student canvas.
- 46 root-level SVG files are included: 45 realistic component top views and one ESP32 DevKit top view.
- New **Firmware Center**: kit detection, firmware info, `.bin` import, upload progress, Wi-Fi OTA, verify/reboot/reconnect monitor, and USB recovery UI.
- ESP32 firmware **v2.5.0** adds `/api/firmware/info`, `/api/firmware/update`, and `/api/reboot`. Updates/reboots are blocked while a Python program is running.
- GitHub package is flat: website files/assets live in one root folder; only `esp32_firmware/` is a subfolder.

## Browser UI test

Run `python3 TEST_CIRCUIT_UI_BROWSER.py`. A separate Chromium install is not required when normal Google Chrome or Microsoft Edge is installed. The test auto-detects standard macOS app locations, Windows Chrome locations, and Linux Chrome/Chromium commands. To use a custom binary, run with `CHROMIUM=/full/path/to/browser`.

# ZEBJUS Python Lab v6.5.1 — Circuit Designer Stability + Layout Polish FINAL

## v6.5.1 Circuit Designer Stability / Schematic

This release retains the stable v6.4.6 browser/runtime and ESP32 firmware v2.4.0 base, and adds a pin-aware circuit-design workflow.

- New **2D Circuit Designer** with drag/drop components, board/component movement, zoom, fit and expandable canvas.
- New **Schematic** page sharing the same saved design.
- **45 supported physical/runtime component definitions** covering displays, sensors, analog/digital inputs, outputs, PWM, I²C, UART, SPI, counters, motors, servo, GPS and IMU.
- **46 validated SVG assets** in the current package: 45 recognizable component top views plus one ESP32 DevKit top view.
- Firmware-aligned pin rules: ADC1-only analog pins, output/PWM-safe GPIOs, input-only GPIO protection, counter-capable pins, shared I²C, UART/SPI direction rules and boot-sensitive GPIO12 warning.
- Invalid pin connections are blocked before a wire is created. GPIO conflicts are reported by the validator.
- I²C devices can share the same SDA/SCL bus; exclusive GPIO functions cannot collide with that bus.
- Overlapping wires use separated routing lanes, dark underlay, signal colors and labels for readability.
- Circuit design can generate a protected `main.py` block with correct `zebjus` imports and constructors.
- Circuit-to-main sync is stored in the existing autosave key and can update another open Python Lab tab through the storage event.
- LIVE-mode-safe main.py sync inserts the generated circuit block before the first top-level `while True:` so hardware constructors always execute.
- UART ports 1/2 and SPI buses 1/2 are allocated explicitly; SPI bus lines are shared with unique CS pins.
- I²C address conflicts and firmware slot limits (TM1637/LCD1602/counters) are validated before sync.
- Component properties are editable in the Inspector; Undo/Redo, pointer/touch dragging and drag-resizable canvas are included.
- Responsive compact layouts cover desktop, smaller laptops, tablets and mobile drawer panels; schematic wiring terminates on real board-pin symbols.
- Connected-kit bridge capabilities can refine the offline v2.4.0 pin/resource profile.
- Dedicated `TEST_CIRCUIT_DESIGNER.py` verifies all 45 components, multi-device bus/resource combinations, LIVE insertion, migration, generated Python compilation/stub execution and all 46 2D SVG/XML files.

### Circuit Designer pages

- `circuit.html` — drag/drop 2D wiring canvas and realistic top-view component shelf.
- `schematic.html` — logical schematic view using the same saved circuit design.
- `component-library.js` — board capabilities and all 45 component definitions.
- `circuit-sync.js` — validation, auto-wire, code generation, save/load and main.py sync.

ESP32 firmware remains **v2.4.0**; no firmware reflash is required for the Circuit Designer UI itself.


## v6.4.6 Bootstrap Recovery Hotfix
- Fixed LCD1602 `spinner()` generated-Python escaping for the backslash frame.
- Pyodide templates are now tested after real JavaScript template-string decoding, not only as raw JS source.
- Python runtime is marked ready only after the complete bootstrap succeeds.
- A failed bootstrap clears the pending-ready state so Run/Reset cannot fall through to missing `_zebjus_reset_student_namespace`.
- A run session is marked prepared only after student-namespace reset succeeds.
- ESP32 firmware remains v2.4.0; this is a browser/Pyodide runtime hotfix.


## v6.4.6 Protected runtime namespace
Student code runs in its own persistent globals dictionary. This protects Python Lab internals from accidental variable-name collisions while preserving LIVE MODE state. Runtime stdin/stdout/stderr are reinstalled before every cycle. ESP32 firmware remains v2.4.0.

## v6.4.6 runtime hotfix
`py-worker.js` now self-imports `sys`, `io`, and `json` on every execution refresh. This prevents `io.StringIO` NameError even if student code or a previous live cycle changes global names. Firmware remains v2.4.0.

## v6.4.6 display/output update

- TM1637 **Kit Output / Sensors** preview now binds by actual CLK/DIO pins, fixing cases where the physical HW-069 worked but the browser card stayed at `----`.
- LCD1602 preview now binds by I2C bus/address and mirrors rows, backlight, display state, cursor/blink and active effect.
- `lcd.center()` / `left()` / `right()` / `align()` automatically scroll long text when requested; a physical 16×2 LCD still shows 16 characters per row at any instant.
- New LCD effects: `scroll`, `marquee`, `bounce`, `typewriter`, `blink_text`, `progress`, `spinner`, `cursor`, `clear_line`, `lines`.
- New TM1637 helpers: `decimal`, `clock`, `scroll`, `marquee`, `blink`, `count`, `pulse`.
- Animation frames use an ordered queue; normal rapid display updates keep low-latency coalescing.
- Additional output helpers: RGB fade/pulse/rainbow, LED fade/pulse, servo sweep, motor ramp, buzzer beep/sweep.
- Firmware v2.4.0 adds LCD cursor/blink control and keeps direct writes inside the visible 16-column row.

See `TM1637_LCD1602_GUIDE.md` for examples.

This release extends v6.2.2 with native **TM1637/HW-069 4-digit display** support and **LCD1602 16x2 PCF8574 I2C** support across firmware, Python library, browser animation, Add Component, autocomplete, offline simulation and GitHub release tooling.

See `TM1637_LCD1602_GUIDE.md` and `GITHUB_UPLOAD_GUIDE.md`.

The retained v6.2.2 base keeps the Universal Hardware Bridge architecture and adds three major upgrades: **offline hardware simulation**, **automatic sensor/module visual cards**, and **optional per-kit Secure Mode**. The v6.1 safety/runtime fixes remain in place, including active-low failsafe handling, persistent top-level `while True` state, shared I²C buses, central pin/resource ownership, 5-failure reconnect logic and the 10-second ESP32 output failsafe.

## Run with or without a physical kit

A valid Python program can run even when the ESP32 kit is disconnected.

- **Kit connected:** commands animate in **Kit Output / Sensors** and are also sent to the physical kit.
- **Kit disconnected:** the same code continues in **Offline Simulation**; visual outputs still animate and sensor cards use simulated/cached values.
- **Kit reconnects during a live run:** the browser automatically starts/resumes the ESP32 run session, the heartbeat restarts, and later hardware commands are mirrored physically without restarting the Python program.

This is especially useful for RGB effects, LEDs, servos, motors and classroom projects where students may write/test code before connecting hardware.


## DHT11 real-hardware behavior in v6.2.2

DHT11 no longer uses a `pulseIn()` response sequence that can miss the first sensor response pulse. Firmware 2.4.0 retains the direct microsecond transition timing for the full 40-bit frame, validates the checksum and enforces a 1.2-second minimum hardware-read interval.

- **Kit connected + valid DHT11:** terminal and **Kit Output / Sensors** show the same real temperature/humidity.
- **Kit connected + failed read:** the card shows `READ ERROR` plus a diagnostic such as `sensor did not pull DATA low`, `checksum mismatch` or `bit timeout`; no demo temperature/humidity is substituted.
- **Kit disconnected:** values are animated and explicitly marked `SIMULATION`.
- For a raw 4-pin DHT11, use VCC, DATA, NC, GND and a 4.7k–10k pull-up from DATA to **3.3V**. Many 3-pin DHT11 modules already contain the pull-up resistor.

## Kit Output / Sensors — automatic cards

Cards are auto-arranged from `main.py` imports/instances and live commands. Supported visual families include:

- RGB LED / single LED
- OLED preview
- Servo (`PWMServo`) with angle animation
- Motor driver (`MotorDriver`) with direction/speed animation
- Ultrasonic distance
- DHT11 temperature + humidity
- Potentiometer / ADC
- Rotary encoder / switch / digital input
- GPS/GNSS with fix state, satellite count and coordinates
- MPU6050 IMU with live orientation/tilt visualization
- LDR / light
- Soil moisture
- Gas / air-quality analog modules
- Voltage sensor
- Sound sensor
- Rain sensor
- Water-level sensor
- Thermistor
- PIR motion
- Reed switch
- Touch sensor
- Flame sensor
- Flow sensor
- RPM / frequency / counter / pulse input
- Buzzer
- Joystick
- Generic I²C / UART / SPI activity cards
- Any future/custom Python driver using `dashboard(...)`

The generic bridge remains the foundation, so future modules usually need a Python driver and dashboard metadata rather than new firmware endpoints.

## Python universal APIs

```python
from zebjus import (
    RGBLED, LED, OLED, DHT11, Ultrasonic,
    AnalogInput, Potentiometer, DigitalInput, Switch, RotaryEncoder,
    DigitalOutput, Relay, GPIOInput, ADC, PWM,
    PWMServo, MotorDriver,
    I2C, I2CDevice, UART, SPI,
    PulseInput, PulseOutput, CounterInput, HardwareTransaction,
    GPS, MPU6050,
    LDR, SoilMoisture, GasSensor, VoltageSensor, SoundSensor,
    RainSensor, WaterLevelSensor, Thermistor,
    PIRSensor, ReedSwitch, TouchSensor, FlameSensor,
    FlowSensor, RPMSensor, Buzzer, Joystick,
    dashboard, plot, sleep
)
```

### Servo

```python
from zebjus import PWMServo, sleep

servo = PWMServo(18)
while True:
    servo.write(30)
    sleep(0.5)
    servo.write(150)
    sleep(0.5)
```

The servo moves physically when the kit is connected and the dashboard servo animates in both connected and offline modes.

### Motor driver

```python
from zebjus import MotorDriver, sleep

motor = MotorDriver(16, 17, 18)
while True:
    motor.forward(60)
    sleep(1)
    motor.backward(40)
    sleep(1)
    motor.stop()
    sleep(0.5)
```

### GPS / GNSS

```python
from zebjus import GPS, sleep

gps = GPS(rx=34, tx=16, baud=9600, port=1)
while True:
    print(gps.read())
    sleep(0.2)
```

### MPU6050

```python
from zebjus import MPU6050, sleep

imu = MPU6050(21, 22, 0x68, 0)
while True:
    print(imu.read())
    sleep(0.1)
```

### Custom sensor dashboard

```python
from zebjus import dashboard

dashboard("Air Quality", CO2=612, Temperature=28.4, Status="OK")
```

## I²C sharing and conflict rules

OLED, `I2C`, `I2CDevice` and `MPU6050` can share the same I²C controller when they use the same SDA/SCL pair. Example: OLED + MPU6050 can share bus 0 on SDA21/SCL22.

If a later I²C object omits SDA/SCL, it inherits the already-claimed pins for that bus. `InterfaceConflictError` is raised only when the same bus number is explicitly requested with a different SDA/SCL pair.

## Runtime fixes retained

- Pyodide initialization template is syntax-checked; the GPS parser no longer generates a broken string literal.
- `_close_cv_windows` is defined inside the worker initialization before cleanup is used, preventing the previous live-mode `NameError`.
- A top-level `while True:` is transformed into one-time initialization plus repeated live cycles; variables and object state persist.
- Error line positions remain aligned with the student's original source.
- Generic bridge reads use the existing non-blocking cached-response model so Wi-Fi latency does not freeze the editor.

## Connection and hardware safety

- Cached IP primary + physical Kit-ID verification
- mDNS fallback
- 5 consecutive failures before visible disconnect
- silent background reconnect / no Connected↔Connecting blink
- 1-second active-run heartbeat
- 10-second ESP32 failsafe
- active-low relay safe state is preserved
- transaction `WRITE` / `PULSEOUT` outputs are registered for failsafe
- central resource manager covers outputs, I²C, UART, SPI, rotary and counter resources
- GPIO12 is kept out of normal auto-priority because it is a classic ESP32 strapping pin
- counter pins are aligned between editor/runtime/firmware

## Optional per-kit Secure Mode

The default remains **Trusted LAN** so the normal same-Wi-Fi classroom workflow does not change.

Secure Mode can be enabled from **Settings**. The browser generates/stores a per-kit token and sends it as `X-Zebjus-Token`. When Secure Mode is enabled, control, bridge, Wi-Fi and naming APIs require the token. Setup AP/recovery remains accessible so a kit cannot be locked out of Wi-Fi provisioning.

Secure Mode can also be disabled again from Settings using the saved token.

## Firmware

Use:

`esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_3_1.ino`

Target: classic ESP32 / ESP32-WROOM-32 style DevKit with Arduino-ESP32 3.x.

OLED support requires:

- Adafruit SSD1306
- Adafruit GFX Library
- Adafruit BusIO

The sketch includes explicit forward declarations for `CounterSlot`, `RotarySlot` and other bridge structs so Arduino's automatic prototype generator does not reproduce the earlier `does not name a type` compile error.

## Firmware compile verification helpers

This package includes:

- `tools/compile_esp32_firmware.sh` — one-command Arduino CLI compile helper
- `.github/workflows/esp32-firmware-compile.yml` — GitHub Actions compile check for the ESP32 firmware
- `tools/verify_release.py` — package/static regression verifier

The packaging environment used to build this ZIP did not contain Arduino CLI, so a real ESP32 toolchain compile could not be executed locally here. The included GitHub workflow/local script performs the real compile in an environment where Arduino CLI and the ESP32 core can be installed.

## Examples

The package now contains 40 selectable examples, including RGB, camera/AI, OLED, DHT11, ultrasonic, analog/digital inputs, PWM Servo, Motor Driver, I²C scanner/device, GPS/UART, MPU6050, SPI, pulse/frequency, interrupt counter/flow/RPM and hardware transaction projects.


## v6.2.2 sensor-source rule

- **Kit connected:** input values come from the physical ESP32 endpoints. Missing/invalid reads are shown as `READ ERROR` or `STALE`; demo constants are never substituted.
- **Kit disconnected:** Python continues and visuals use changing, clearly labelled `SIMULATION` values.
- **Kit reconnects:** simulated input/bridge snapshots are cleared and physical mirroring resumes automatically.
