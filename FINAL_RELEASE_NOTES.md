# ZEBJUS Python Lab v6.4.0 FINAL

## Display preview / sync fixes
- TM1637 **Kit Output / Sensors** card now matches commands by actual CLK/DIO pins, with a single-card fallback for expression-based constructors.
- LCD1602 card now matches by I2C bus/address and mirrors both 16-character rows.
- TM1637/LCD browser preview updates immediately; it does not wait for the ESP32 HTTP ACK.
- Ordered display-effect frames preserve scroll/bounce/typewriter/blink animation order.
- Normal rapid TM1637/LCD state changes still use low-latency coalescing to avoid Wi-Fi backlog.
- Stale HTTP acknowledgements cannot roll the browser preview back to an older frame.

## LCD1602 v2 effects
- `center()`, `left()`, `right()` and `align()` can auto-scroll text longer than 16 characters.
- Added `scroll()`, `marquee()`, `bounce()`, `typewriter()`, `blink_text()`, `progress()`, `spinner()`, `clear_line()` and `lines()`.
- Added physical/browser cursor and cursor-blink control with `cursor()`.
- Firmware direct `write` is constrained to the remaining visible columns of the selected row instead of continuing into hidden DDRAM.

## TM1637 / HW-069 v2 effects
- Added `decimal()`, `clock()`, `scroll()`, `marquee()`, `blink()`, `count()` and `pulse()`.
- Expanded approximate seven-segment alphabet coverage.
- Native bidirectional DIO ACK driver retained; old transaction-mode ACK conflict remains fixed.

## Other output helpers
- RGB: `fade()`, `pulse()`, `rainbow()`.
- LED: `fade()`, `pulse()`.
- PWM Servo: `sweep()`.
- MotorDriver: `ramp()`.
- Buzzer: `beep()`, `sweep()`.

## Versions / tooling
- Browser/UI: **v6.4.0**.
- ESP32 firmware: **v2.4.0**.
- Arduino sketch folder, root compile helper, GitHub Actions workflow and visible workflow copy all target v2.4.0.
- `VERIFY_RELEASE.py` and `TEST_SENSOR_RUNTIME.py` cover the new display effects and long-text behavior.

## Retained
All v6.2.2/v6.3.1 real-sensor sync, DHT11, ultrasonic, failsafe, Secure Mode, offline simulation, reconnect, persistent live loop, I2C sharing and central resource-manager fixes remain.
