# ZEBJUS Pin Assist Test Guide — v5.20

## 1. RGB suggestions

Type:

```python
from zebjus import RGBLED
rgb = RGBLED(
```

The editor should suggest supported RGB output pins. After choosing `25` and typing a comma, GPIO25 must not be suggested again.

```python
rgb = RGBLED(25, 26, 27)
```

## 2. Analog suggestions

Type:

```python
from zebjus import AnalogInput
analog = AnalogInput(
```

Only ADC1 pins should be suggested: `34, 35, 36, 39, 32, 33` (used pins are hidden).

## 3. Rotary suggestions

```python
from zebjus import RotaryEncoder
encoder = RotaryEncoder(32, 33, 14)
```

After `RotaryEncoder(32,` GPIO32 must disappear from suggestions. After `RotaryEncoder(32, 33,` both GPIO32 and GPIO33 must be absent.

## 4. Invalid-pin exact-line error

```python
from zebjus import AnalogInput
analog = AnalogInput(25)
```

Expected: red gutter marker on line 2 with `PinError`, because GPIO25 is not a supported Wi-Fi-safe ADC1 input.

## 5. Repeated-pin error

```python
from zebjus import RGBLED, Switch
rgb = RGBLED(25, 26, 27)
button = Switch(25)
```

Expected: red marker on line 3 with `PinConflictError`; GPIO25 is already used by RGB red on line 2.

## 6. Same RGB pin twice

```python
from zebjus import RGBLED
rgb = RGBLED(25, 25, 27)
```

Expected: `PinConflictError` on line 2.

## 7. Valid mixed program

```python
from zebjus import RGBLED, AnalogInput, Switch, RotaryEncoder
rgb = RGBLED(25, 26, 27)
analog = AnalogInput(34)
button = Switch(14)
encoder = RotaryEncoder(32, 33, 16)
```

Expected: no pin error.
