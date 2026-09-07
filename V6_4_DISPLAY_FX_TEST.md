# ZEBJUS Python Lab v6.4.2 — Display FX / Preview Sync Test

Checks in `VERIFY_RELEASE.py` + `TEST_SENSOR_RUNTIME.py`:

- TM1637 physical/browser card binding by actual CLK/DIO pins.
- LCD1602 physical/browser card binding by bus/address.
- Long `lcd.center()` text auto-scrolls instead of silently truncating.
- Ordered animation frames for TM1637 scroll/count/blink and LCD scroll/bounce/typewriter.
- TM1637 decimal-point output.
- LCD cursor + blink command reaches firmware.
- Direct LCD writes stay within the visible 16-column row.
- RGB fade/pulse/rainbow, LED fade/pulse, servo sweep, motor ramp and buzzer beep/sweep helpers compile.
