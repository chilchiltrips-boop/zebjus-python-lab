# ZEBJUS Python Lab v5.27 — OLED + Ultrasonic Guide

## Default wiring

### HC-SR04 ultrasonic

- VCC → 5V
- GND → GND
- TRIG → GPIO18
- ECHO → GPIO19 **through a 5V→3.3V divider / level shifter**

Do not connect the HC-SR04 ECHO pin directly to an ESP32 GPIO. A simple divider can use 1 kΩ from ECHO to GPIO and 2 kΩ from GPIO to GND.

Python:

```python
from zebjus import Ultrasonic
ultra = Ultrasonic(18, 19)
print(ultra.read())
```

### SSD1306 OLED 128×64 I2C

- VCC → 3.3V
- GND → GND
- SDA → GPIO21
- SCL → GPIO22
- Address → `0x3C`

Python:

```python
from zebjus import OLED
oled = OLED(21, 22, 0x3C)
oled.display_text("Hello ZEBJUS!", 10, 24, 1)
```

## OLED API

The OLED interface is drawing-primitive based so future projects can be built in Python without adding a new firmware endpoint for every screen design.

```python
oled.clear()                         # clear buffer
oled.text("Hello", 0, 0, 1)         # draw into buffer
oled.pixel(10, 10)
oled.line(0, 0, 127, 63)
oled.rect(5, 5, 40, 20)
oled.rect(5, 5, 40, 20, fill=True)
oled.circle(64, 32, 15)
oled.show()                          # push buffer to display
```

Convenience functions:

```python
oled.display_text("Ready")
oled.scroll_text("ZEBJUS PYTHON LAB", y=24)
oled.distance_bar(75.5, max_cm=400)
oled.radar(angle=90, distance_cm=75.5, max_cm=200)
oled.invert(True)
oled.contrast(180)
```

The same commands are mirrored in the browser **OLED 128×64 preview** and on the physical OLED attached to the kit.

## Ultrasonic + OLED

```python
from zebjus import Ultrasonic, OLED, sleep

ultra = Ultrasonic(18, 19)
oled = OLED(21, 22, 0x3C)

while True:
    cm = ultra.read()
    oled.display_text("Distance\n%.1f cm" % cm, 12, 14, 1)
    sleep(0.15)
```

## Radar screen

```python
import time
from zebjus import Ultrasonic, OLED, sleep

ultra = Ultrasonic(18, 19, max_cm=200)
oled = OLED()

while True:
    cm = ultra.read()
    phase = int(time.time() * 90) % 360
    angle = phase if phase <= 180 else 360 - phase
    oled.radar(angle, cm, max_cm=200)
    sleep(0.07)
```

This is an OLED radar animation. A future physical scanning radar can reuse the same OLED API and add a servo angle source without redesigning the display protocol.

## Pin Assist

v5.27 validates and suggests pins for:

- `RGBLED(...)`
- `AnalogInput(...)`
- `Potentiometer(...)`
- `DigitalInput(...)`
- `Switch(...)`
- `RotaryEncoder(...)`
- `Ultrasonic(trig, echo)`
- `OLED(sda, scl, address)`

OLED SDA/SCL and ultrasonic TRIG require output-capable GPIOs. The editor detects duplicate physical-pin use before Run.

## Arduino libraries required by firmware v1.7

Install from Arduino Library Manager:

- **Adafruit SSD1306**
- **Adafruit GFX Library**
- **Adafruit BusIO** (dependency, normally installed automatically)

The firmware file is:

`esp32_firmware/ZEBJUS_Kit_MultiGPIO_RGB_LED_Input_OLED_Ultrasonic_DHT11_WiFi_v1_7.ino`
