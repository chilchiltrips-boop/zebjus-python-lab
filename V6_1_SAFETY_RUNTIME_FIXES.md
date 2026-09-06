# v6.1 Safety + Runtime Regression Guide

## 1. Same I²C bus sharing must pass

```python
from zebjus import OLED, MPU6050

oled = OLED(21, 22)
imu = MPU6050()          # inherits bus 0 SDA21/SCL22
```

Expected: no `InterfaceConflictError`.

This must also pass:

```python
from zebjus import I2C, I2CDevice

bus = I2C(21, 22, 400000, 0)
sensor = I2CDevice(0x68, 21, 22, 400000, 0)
```

## 2. Genuine same-bus conflict must fail

```python
from zebjus import I2C

a = I2C(21, 22, 400000, 0)
b = I2C(18, 19, 400000, 0)
```

Expected: `InterfaceConflictError` in the editor, or a matching runtime/firmware conflict if constructed dynamically.

Use `bus=1` for the second independent I²C controller.

## 3. Persistent live state

```python
counter = 0

while True:
    counter += 1
    print(counter)
```

Expected: `1, 2, 3...`, not repeated `1` on every browser cycle.

## 4. Active-low relay failsafe

```python
from zebjus import DigitalOutput

relay = DigitalOutput(4, active_high=False)
relay.on()
```

Expected physical behavior: ON drives GPIO LOW. Stop/heartbeat timeout applies the registered logical OFF state, GPIO HIGH.

## 5. Transaction output safety

```python
from zebjus import HardwareTransaction

t = HardwareTransaction("safe-test")
t.run([
    ("MODE", 4, "OUT"),
    ("WRITE", 4, 1, 0),   # fourth field is safe value
])
```

Expected: GPIO4 is tracked by the firmware output registry and returns to safe LOW when the run ends or the heartbeat expires.

## 6. Counter pin validation

Valid `CounterInput` pool in v6.1:

`4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35`

GPIO36 and GPIO39 are intentionally excluded from the interrupt-counter API in this firmware. GPIO12 is also not suggested for counters.

## 7. Wix / embedded connection fallback

If the kit is powered and on the same Wi-Fi but the embedded Wix page cannot access the local kit, open the Python Lab page directly in a new browser tab and allow Local Network Access when the browser asks. The app now prints this fallback when an embedded connection attempt fails.
