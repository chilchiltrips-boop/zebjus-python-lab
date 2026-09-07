# TM1637 / HW-069 and LCD1602 I2C — v6.3

## TM1637 / HW-069 4-digit display
Recommended direct ESP32 wiring:

- VCC → 3.3 V
- GND → GND
- CLK → GPIO13
- DIO → GPIO14

Python:

```python
from zebjus import TM1637, sleep

display = TM1637(clk=13, dio=14, brightness=6)
display.number(1234)
sleep(2)
display.text("HELP")
```

The firmware has a native TM1637 driver. DIO is released during the ACK phase, so the old `MODE input pin conflict: active output` problem is avoided. The browser also shows a live four-digit animation when the kit is offline.

## LCD1602 16x2 with PCF8574 I2C backpack
Typical address is `0x27`; some backpacks use `0x3F`. Default bus 0 is SDA GPIO21 / SCL GPIO22 and can be shared with other I2C devices using the same pins.

```python
from zebjus import LCD1602

lcd = LCD1602(sda=21, scl=22, address=0x27, bus=0)
lcd.line(0, "ZEBJUS")
lcd.line(1, "Python Lab")
```

The built-in driver targets the common PCF8574 backpack mapping (P0 RS, P1 RW, P2 EN, P3 backlight, P4-P7 D4-D7).

### Electrical note
ESP32 GPIO is 3.3 V logic. Many LCD1602 backpacks are powered from 5 V and may pull SDA/SCL up to 5 V. For a robust/safe 5 V LCD setup, use a bidirectional I2C level shifter or ensure the backpack bus pull-ups are to 3.3 V. Do not expose ESP32 SDA/SCL directly to 5 V pull-ups.
