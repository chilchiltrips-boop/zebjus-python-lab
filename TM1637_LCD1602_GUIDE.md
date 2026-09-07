# TM1637 / HW-069 and LCD1602 I2C — v6.4.1

## TM1637 / HW-069 4-digit display
Recommended direct ESP32 wiring:

- VCC → 3.3 V
- GND → GND
- CLK → GPIO13
- DIO → GPIO14

Basic Python:

```python
from zebjus import TM1637, sleep

display = TM1637(clk=13, dio=14, brightness=6)
display.number(1234)
sleep(1)
display.decimal(12.3)
sleep(1)
display.clock(12, 34, colon=True)
```

Effects:

```python
display.scroll("ZEBJUS", speed=0.2, loops=1)
display.marquee("PYTHON", speed=0.2, loops=2)
display.blink(2026, times=3, speed=0.2)
display.count(0, 99, speed=0.08)
display.pulse("HELP", times=2)
```

The firmware has a native TM1637 driver. DIO is released during ACK, avoiding the old `MODE input pin conflict: active output` problem. The browser preview now binds by the actual CLK/DIO pair, so physical output and **Kit Output / Sensors** stay matched even if source parsing is delayed.

TM1637 is a seven-segment display, so alphabet support is approximate. Digits and common letters are supported; unsupported characters appear blank.

## LCD1602 16×2 with PCF8574 I2C backpack
Typical address is `0x27`; some backpacks use `0x3F`. Default I2C bus 0 is SDA GPIO21 / SCL GPIO22 and can be shared with other I2C devices using the same pins.

```python
from zebjus import LCD1602

lcd = LCD1602(sda=21, scl=22, address=0x27, bus=0)
lcd.line(0, "ZEBJUS")
lcd.center(1, "Python Lab")
```

### Long text
A 16×2 LCD can physically show only 16 characters per row at one time. In v6.4.1, long text passed to `center()`, `left()`, `right()` or `align()` can auto-scroll instead of being silently truncated.

```python
lcd.center(1, "Python Lab BINU K JOSE", speed=0.18, loops=1)
```

### Alignment

```python
lcd.left(0, "READY")
lcd.center(0, "ZEBJUS")
lcd.right(1, "100%")
lcd.align(1, "CONNECTED", align="center")
```

### Text effects

```python
lcd.marquee(1, "ZEBJUS PYTHON LAB", speed=0.2, loops=2)
lcd.bounce(0, "HELLO", speed=0.15, loops=2)
lcd.typewriter(0, "Python Ready", speed=0.07, align="center")
lcd.blink_text(1, "CONNECTED", times=3)
lcd.progress(1, 75, label="LOAD")
lcd.spinner(row=1, col=15, cycles=3)
```

### Cursor / display control

```python
lcd.cursor(True, blink=True)
lcd.set_cursor(5, 1)
lcd.backlight(False)
lcd.backlight(True)
lcd.display(False)
lcd.display(True)
lcd.clear_line(1)
```

Effect frames use an ordered display queue, while normal fast updates keep the low-latency latest-state/coalescing behavior. The browser LCD preview binds by I2C bus/address and mirrors the two physical rows, backlight, display state, cursor and active effect.

The built-in driver targets the common PCF8574 backpack mapping: P0 RS, P1 RW, P2 EN, P3 backlight, P4–P7 D4–D7.

## Output effect helpers
The same release adds useful animation helpers for other outputs:

```python
rgb.fade(255, 0, 100, duration=0.6)
rgb.pulse("blue", times=3)
rgb.rainbow(cycles=2)

led.fade(0, 255, duration=0.5)
servo.sweep(0, 180, step=3)
motor.ramp(80, duration=0.6)
buzzer.beep(1000, duration=0.15)
buzzer.sweep(300, 2000, duration=0.8)
```

These still animate in **Kit Output / Sensors** when no kit is connected; when the kit is connected they also mirror to the physical outputs.

### Electrical note
ESP32 GPIO is 3.3 V logic. Many LCD1602 backpacks are powered from 5 V and may pull SDA/SCL up to 5 V. For a robust/safe 5 V LCD setup, use a bidirectional I2C level shifter or ensure the backpack bus pull-ups are to 3.3 V. Do not expose ESP32 SDA/SCL directly to 5 V pull-ups.
