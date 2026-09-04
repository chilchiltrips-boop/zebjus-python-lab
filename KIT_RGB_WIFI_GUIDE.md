# ZEBJUS Kit v1.3 — Wi-Fi, RGB and Universal Inputs

## Firmware

Upload:

`esp32_firmware/ZEBJUS_Kit_RGB_UniversalInput_WiFi_v1_3.ino`

Expected Serial header:

```text
ZEBJUS KIT RGB + INPUT WiFi v1.3
```

The existing kit Wi-Fi workflow remains the same:

- Up to 5 Wi-Fi profiles are saved in ESP32 NVS.
- Kit auto-connects to a known network.
- If none is available, the setup AP opens.
- Each physical kit has a unique chip ID.
- Same-network kit names are unique (`zebjus_kit_1`, `zebjus_kit_2`, ...).
- Web software can rename the kit and manage saved Wi-Fi profiles.

## Current hardware APIs

### RGB output

```python
from zebjus import RGBLED
rgb = RGBLED(25, 26, 27)
```

### Generic analog input

```python
from zebjus import AnalogInput
analog = AnalogInput(34)
```

### Potentiometer alias

```python
from zebjus import Potentiometer
pot = Potentiometer(34)
```

### Generic digital input

```python
from zebjus import DigitalInput
sensor = DigitalInput(32, pullup=False, active_low=False)
```

### Push switch

```python
from zebjus import Switch
button = Switch(32)
```

### Rotary encoder with push switch

```python
from zebjus import RotaryEncoder
encoder = RotaryEncoder(32, 33, 14)
```

## Run safety

RGB output is active only during a Web Lab Run session. Program finish, End, error, or missed heartbeat forces RGB OFF.
