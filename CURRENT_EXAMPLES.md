# ZEBJUS Python Lab v5.18 — Current Examples

Only the hardware examples currently being developed are shown in the Learning Example menu.

1. RGB LED — Basic Colors
2. RGB LED — Blink
3. RGB LED — Animation
4. RGB LED — Indication & Effects
5. RGB LED — Fade / Breathing
6. Potentiometer — Read
7. Potentiometer — Monitor
8. Potentiometer → RGB Brightness
9. Potentiometer → LED Effects

Future examples should be added only when the corresponding hardware/software feature is implemented and tested.

## RGB output pins
Safe selectable outputs in the current firmware:

`4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33`

Default: `RGBLED(25, 26, 27)`.

## Potentiometer input pins
Use ESP32 ADC1 pins while Wi-Fi is active:

`32, 33, 34, 35, 36, 39`

Recommended default: `Potentiometer(34)`.

GPIO34/35/36/39 are input-only, so they are especially suitable for potentiometer/sensor inputs.
