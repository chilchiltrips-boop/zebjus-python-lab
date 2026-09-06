# ZEBJUS Python Lab v5.22 — OLED + Ultrasonic + Stable Kit Connection

v5.22 keeps the complete v5.21 stable-connection architecture and adds a real HC-SR04 ultrasonic input API plus an extensible SSD1306 128×64 OLED drawing interface controlled directly from student Python.

## Retained from v5.21

- Cached IP primary → mDNS fallback.
- Physical Kit ID verification before accepting a cached address.
- 5 consecutive failures required before UI becomes Disconnected.
- Failures 1–4 keep the visible state Connected.
- Silent background reconnect; no routine `Connecting ↔ Connected` blinking.
- Successful status/API/heartbeat resets the failure counter.
- New DHCP IP updates the cached IP.
- Run heartbeat every 1 second.
- ESP output failsafe after 10 seconds without heartbeat.
- Temporary Wi-Fi/API miss does not immediately stop Python.
- `+ New Project` opens a blank editor.
- Custom project draft autosave/restore, Undo/Redo, exact error line, Pin Assist, camera/OpenCV/MediaPipe and existing input APIs retained.

## Added in v5.22

- Physical `Ultrasonic(trig, echo, max_cm=...)` support using `/api/input/ultrasonic`.
- Default HC-SR04 pins: TRIG GPIO18, ECHO GPIO19.
- Extensible `OLED` Python class for SSD1306 128×64 I2C displays.
- Default OLED: SDA GPIO21, SCL GPIO22, address `0x3C`.
- Browser OLED 128×64 preview mirrors Python OLED commands.
- OLED primitives: clear, show, text, pixel, line, rectangle, circle, invert and contrast.
- OLED convenience screens: text display, scrolling text, distance bar and ultrasonic radar frame.
- OLED and Ultrasonic are integrated into autocomplete, Pin Assist, duplicate-pin checks and exact-line validation.
- Learning Example menu expanded from 13 to **20 examples**.
- Camera/JS cache references aligned to v5.22.

## Python examples

```python
from zebjus import Ultrasonic, OLED, sleep

ultra = Ultrasonic(18, 19)
oled = OLED(21, 22, 0x3C)

while True:
    cm = ultra.read()
    oled.distance_bar(cm, max_cm=400, title="ULTRASONIC")
    sleep(0.12)
```

Generic custom OLED screens can be built from primitives:

```python
from zebjus import OLED

oled = OLED()
oled.clear()
oled.rect(0, 0, 128, 64)
oled.line(0, 0, 127, 63)
oled.circle(64, 32, 18)
oled.text("Z", 61, 28)
oled.show()
```

## Hardware safety

HC-SR04 ECHO is normally a 5V signal. ESP32 GPIO is 3.3V logic, so use a voltage divider or level shifter on ECHO. Do not wire HC-SR04 ECHO directly to GPIO19.

## Firmware

Upload:

`esp32_firmware/ZEBJUS_Kit_RGB_Input_OLED_Ultrasonic_WiFi_v1_5.ino`

Required Arduino libraries:

- Adafruit SSD1306
- Adafruit GFX Library
- Adafruit BusIO

Expected Serial header:

`ZEBJUS KIT RGB + INPUT + OLED + ULTRASONIC WiFi v1.5`

For wiring and the complete display API see `OLED_ULTRASONIC_GUIDE.md`.
