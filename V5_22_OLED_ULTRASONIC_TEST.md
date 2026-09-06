# ZEBJUS Python Lab v5.22 — OLED + Ultrasonic Test

## 1. Firmware

Upload `esp32_firmware/ZEBJUS_Kit_RGB_Input_OLED_Ultrasonic_WiFi_v1_5.ino` after installing Adafruit SSD1306, Adafruit GFX Library and Adafruit BusIO.

Expected Serial header:

`ZEBJUS KIT RGB + INPUT + OLED + ULTRASONIC WiFi v1.5`

## 2. OLED wiring test

Connect SSD1306 128×64 I2C:

- SDA → GPIO21
- SCL → GPIO22
- address `0x3C`

Load **OLED Text Display** and Run. The same text should appear in the browser OLED preview and physical OLED.

## 3. Ultrasonic wiring test

Connect HC-SR04:

- TRIG → GPIO18
- ECHO → GPIO19 through a 5V→3.3V divider/level shifter

Load **Ultrasonic Distance**. Move an object in front of the sensor and verify the printed distance changes.

## 4. Combined test

Load **Ultrasonic → OLED Text**, then **Ultrasonic Radar Animation**. Browser OLED preview and physical OLED should track the sensor.

## 5. Pin validation

Try these intentional errors:

```python
from zebjus import OLED, Switch
OLED(21, 22)
Switch(21)
```

Expected: exact-line `PinConflictError` on the switch line.

```python
from zebjus import Ultrasonic
Ultrasonic(34, 19)
```

Expected: `PinError` because GPIO34 cannot drive TRIG.

## 6. Connection/failsafe regression

Retest cached-IP → mDNS fallback and temporary Wi-Fi misses. During an active OLED/radar run, disconnect Wi-Fi long enough to exceed 10 seconds. Firmware should end the run, turn RGB off and clear the OLED as a failsafe.
