# ZEBJUS Python Lab v6.3.1 — Display Sync Test

## TM1637 / HW-069
Use CLK GPIO13 and DIO GPIO14. Run the bundled TM1637 example. The Kit Output / Sensors seven-segment preview must change immediately with the printed `Display:` value. When a physical kit is connected, the label may briefly show `SYNCING` and then `KIT`; it must not accumulate seconds of lag.

## LCD1602 I2C
Use SDA GPIO21, SCL GPIO22 and address 0x27 (or 0x3F if your backpack uses it). `line()`, `center()`, `clear()`, backlight, and display state must update the browser preview immediately and physical writes must stay ordered.

## Stop
Press Stop during a fast display update. The ESP display must clear through end-run/failsafe and a stale queued frame must not reappear afterward.
