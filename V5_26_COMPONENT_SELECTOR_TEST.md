# ZEBJUS Python Lab v5.27 — Component Selector / Import Autocomplete Test

## Import autocomplete
Type each line and confirm suggestions appear:

```python
from zebjus import 
from zebjus import o
from zebjus import OLED, d
from zebjus import DHT11, Switch, r
```

Expected: full zebjus member list, then OLED, then DHT11/DigitalInput, then RGBLED/RotaryEncoder as appropriate. Matching is case-insensitive.

## Component selector
In **Kit Output / Sensors**, choose a component and press **+ Add**. The Lab must:

1. Add the class to one `from zebjus import ...` line without duplicating it.
2. Insert a starter instance before the main program body.
3. Use numbered names for repeated instances: `sw1`, `sw2`, `dht1`, `dht2`, `ultra1`, `ultra2`.
4. Pick free supported pins and avoid pins already used by other detected hardware.
5. Disable an item when its current maximum/pin capacity is reached.
6. Show interface and current limit in the selector.

## Current selector limits

| Component | Interface | Current UI limit* |
|---|---|---:|
| RGBLED | 3 × PWM OUT | 1 active |
| LED compatibility | kit RGB compatibility | 1 active |
| OLED 128×64 | I²C SDA/SCL | 1 active |
| DHT11 | 1 DATA GPIO | 15 |
| Ultrasonic | 1 OUT + 1 IN | 10 |
| AnalogInput / Potentiometer | ADC1 IN | 6 total ADC1 pins |
| DigitalInput / Switch | Digital IN | 19 digital-input pins |
| RotaryEncoder | 2–3 Digital IN | 4 firmware slots |

*These are standalone/current firmware limits. A mixed project can run out of free GPIOs sooner.

Servo, Motor Driver, PWM Signal Sensor and true multi-LED Digital Output are shown as **planned** and are intentionally disabled until direct ESP firmware support is added.
