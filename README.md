# ZEBJUS Python Lab v5.20 — Pin Assist + Universal Inputs

This stage keeps the RGB LED, editor, exact error-line highlighting, Undo/Redo, OpenCV/MediaPipe engine, Wi-Fi kit naming, saved Wi-Fi profiles, kit auto-reconnect, Run heartbeat and output failsafe.

## Added in v5.20

- Context-aware GPIO suggestions inside `RGBLED(...)`, `AnalogInput(...)`, `Potentiometer(...)`, `DigitalInput(...)`, `Switch(...)`, and `RotaryEncoder(...)`.
- Pins already used elsewhere in the same program are removed from the suggestion list.
- Pins already entered earlier in the same constructor are not suggested again.
- Unsupported GPIO selection is reported as `PinError` on the exact editor line before Run.
- Reusing the same physical GPIO for two roles is reported as `PinConflictError` on the second conflicting line.
- Pin validation runs both while editing and again before the program starts.

## Universal Inputs retained from v5.19

- Generic `AnalogInput(pin)` API.
- Backward-compatible `Potentiometer(pin)` alias.
- Generic `DigitalInput(pin, pullup=..., active_low=...)` API.
- `Switch(pin)` API with push-button-friendly defaults.
- `RotaryEncoder(clk, dt, switch)` API.
- ESP32 continuously tracks rotary encoder movement.
- Python can process `raw`, `value`, `percent`, switch state, rotary position, delta and direction.
- Current example list contains only RGB LED + currently implemented input projects.
- Generic input monitor cards for analog, switch and rotary values.

## Python input API

```python
from zebjus import AnalogInput, Potentiometer, DigitalInput, Switch, RotaryEncoder

analog = AnalogInput(34)
pot = Potentiometer(34)
sensor = DigitalInput(32, pullup=False, active_low=False)
button = Switch(32)
encoder = RotaryEncoder(32, 33, 14)
```

Analog methods:

- `read()` → 0–255
- `raw()` → 0–4095
- `percent()` → 0–100
- `millivolts()`

Digital methods:

- `state()` → raw 0/1
- `read()` / `active()` → Boolean
- `Switch.pressed()` → Boolean

Rotary methods:

- `position()`
- `delta()`
- `direction()` → `CW`, `CCW`, `NONE`
- `pressed()`
- `switch_state()`

## Safe analog pins while Wi-Fi is active

`32, 33, 34, 35, 36, 39`

## Supported digital input pins

`4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39`

GPIO34/35/36/39 require an external pull resistor when used as switches/encoder inputs.

## ESP32 firmware

Upload:

`esp32_firmware/ZEBJUS_Kit_RGB_UniversalInput_WiFi_v1_3.ino`

Expected Serial header:

`ZEBJUS KIT RGB + INPUT WiFi v1.3`
