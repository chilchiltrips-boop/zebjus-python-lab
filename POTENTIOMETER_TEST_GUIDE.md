# Potentiometer Test — ESP32 + ZEBJUS Python Lab

## Wiring

For a normal 3-pin potentiometer:

- One outside pin → ESP32 `3.3V`
- Other outside pin → ESP32 `GND`
- Middle/wiper pin → `GPIO34`

Do not feed 5V into an ESP32 ADC pin.

## Firmware

Upload:

`esp32_firmware/ZEBJUS_Kit_RGB_Pot_WiFi_v1_2.ino`

The firmware accepts potentiometer input pins:

`32, 33, 34, 35, 36, 39`

These are ADC1 pins and remain usable while Wi-Fi is active.

## Basic Python test

```python
import cv2
from zebjus import Potentiometer

pot = Potentiometer(34)

while True:
    print("Value:", pot.read(), "Raw:", pot.raw(), "Percent:", pot.percent())
    cv2.waitKey(250)
```

`read()` returns 0–255. `raw()` returns 0–4095.

## Potentiometer controls RGB

```python
import cv2
from zebjus import Potentiometer, RGBLED

pot = Potentiometer(34)
rgb = RGBLED(25, 26, 27)

while True:
    value = pot.read()
    rgb.write(value, 0, 255 - value)
    cv2.waitKey(80)
```

Do not select the same GPIO as both a potentiometer input and an RGB output.

## Live behavior

When a program contains `Potentiometer(...)` inside `while True`, the Lab repeatedly reads `/api/analog` from the selected kit and feeds the newest ADC value into the Python cycle.
