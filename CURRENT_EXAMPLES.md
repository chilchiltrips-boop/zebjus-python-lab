# ZEBJUS Python Lab v5.20 — Current Examples

The Learning Example menu is intentionally limited to the hardware features currently developed and tested.

1. RGB LED — Basic Colors
2. RGB LED — Blink
3. RGB LED — Animation
4. RGB LED — Indication & Effects
5. RGB LED — Fade / Breathing
6. Generic Analog Input
7. Potentiometer / Analog Knob
8. Generic Digital Input
9. Push Switch Input
10. Switch → RGB LED
11. Rotary Encoder + Push Switch
12. Rotary Encoder → RGB LED
13. Analog Input → RGB LED

## Analog input pins

With ESP32 Wi-Fi active, use ADC1 pins:

`GPIO32, GPIO33, GPIO34, GPIO35, GPIO36, GPIO39`

Use `AnalogInput(pin)` for generic analog sensors. `Potentiometer(pin)` is a convenience alias.

## Digital input pins

Supported input pins:

`GPIO4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39`

GPIO34/35/36/39 do not have internal pull-up resistors. Use an external resistor when a switch or encoder requires a pull-up.

## Rotary encoder

Typical example:

```python
from zebjus import RotaryEncoder
encoder = RotaryEncoder(32, 33, 14)  # CLK, DT, SW
```

The ESP32 continuously tracks rotation so steps are not dependent only on browser polling.
