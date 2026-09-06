# ZEBJUS Python Lab v5.27 — Live GPIO Allocator Test

## Numbered LED autocomplete
1. Type `from zebjus import LED` and open autocomplete. First numbered suggestion should be `LED1`.
2. Accept/import `LED1`; invoke import completion again after a comma. The next numbered suggestion should be `LED2`.
3. `led1 = LED1(4)` must create a Single LED card in Kit Output / Sensors.
4. Add `led2 = LED2(13)`; a second independent LED card must appear.

## Resource math
- Safe OUT pool = 15 GPIOs.
- Add `RGBLED1(25,26,27)` and `RGBLED2(32,33,14)`: 6 OUT pins used, 9 OUT pins remain.
- Add four numbered LEDs: 10 OUT pins used total, 5 OUT pins remain.
- Adding DHT11/OLED/Ultrasonic TRIG must reduce OUT availability according to their actual pin use.
- Switch / compatible digital inputs should prefer free input-only GPIO34/35/36/39 when possible.

## Failsafe
With LEDs/RGB active, stop browser heartbeat for >10 s. All registered PWM outputs must go to safe OFF and OLED must clear.
