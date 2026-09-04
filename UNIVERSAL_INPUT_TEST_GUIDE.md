# ZEBJUS Universal Input Test Guide — v5.20

## 1. Analog input / potentiometer

Recommended test wiring:

- 3.3V → potentiometer outer pin
- GND → other outer pin
- GPIO34 → middle/wiper

```python
import cv2
from zebjus import AnalogInput

analog = AnalogInput(34)

while True:
    print(analog.raw(), analog.read(), analog.percent(), analog.millivolts())
    cv2.waitKey(200)
```

Never feed more than 3.3V into an ESP32 GPIO.

## 2. Push switch

Recommended wiring:

- GPIO32 → push button → GND
- `Switch(32)` uses the ESP32 internal pull-up.

```python
import cv2
from zebjus import Switch

button = Switch(32)

while True:
    print("state", button.state(), "pressed", button.pressed())
    cv2.waitKey(80)
```

For GPIO34/35/36/39, use an external pull resistor because those pins have no internal pull-up.

## 3. Generic digital sensor

```python
import cv2
from zebjus import DigitalInput

sensor = DigitalInput(32, pullup=False, active_low=False)

while True:
    print("state", sensor.state(), "active", sensor.read())
    cv2.waitKey(80)
```

## 4. Rotary encoder with push switch

Typical module labels: `CLK`, `DT`, `SW`, `+`, `GND`.

Example wiring:

- CLK → GPIO32
- DT → GPIO33
- SW → GPIO14
- + → 3.3V
- GND → GND

```python
import cv2
from zebjus import RotaryEncoder

encoder = RotaryEncoder(32, 33, 14)

while True:
    print(
        "position", encoder.position(),
        "delta", encoder.delta(),
        "direction", encoder.direction(),
        "pressed", encoder.pressed()
    )
    cv2.waitKey(60)
```

The ESP32 firmware continuously decodes CLK/DT and retains the position between browser reads during the active Run session.

## 5. Input → RGB processing

```python
import cv2
from zebjus import RotaryEncoder, RGBLED

encoder = RotaryEncoder(32, 33, 14)
rgb = RGBLED(25, 26, 27)

while True:
    value = encoder.position() * 15
    value = max(0, min(255, value))

    if encoder.pressed():
        rgb.color("white")
    else:
        rgb.write(value, 0, 255 - value)

    cv2.waitKey(60)
```

Do not assign the same GPIO to an input and RGB output in the same program. The Lab checks this before Run.
