# ZEBJUS Python Lab FULL v5 — RGB + Sensors + AI + Image Graphics

Fresh complete build for the current ZEBJUS kit.

## Main fixes

### Hand → RGB LED stability
The MediaPipe result is now stabilized across several frames before Python starts.

When an AI example is Run:
1. camera is started if needed
2. MediaPipe gathers several frames
3. a stable hand/finger snapshot is selected
4. that snapshot is passed to Python

The Output also shows the AI snapshot used by Python.

Example:

```python
from zebjus import RGBLED
from zebjus_ai import HandDetector

rgb = RGBLED(1)
result = HandDetector().read()

if result.detected and result.fingers >= 4:
    rgb.write(0, 255, 0)
else:
    rgb.off()
```

Using `>= 4` is intentional because an open hand can briefly fluctuate between 4 and 5.

## RGB LED API — 0 to 255 per channel

```python
from zebjus import RGBLED

rgb = RGBLED(1)
rgb.write(255, 0, 0)       # red
rgb.write(0, 255, 0)       # green
rgb.write(0, 0, 255)       # blue
rgb.write(255, 120, 0)     # orange
rgb.off()
```

WebSocket command:

```json
{"type":"command","kitId":"ZB-000123","command":"RGB_LED_SET","id":1,"r":255,"g":0,"b":0}
```

Old `LED(1).on()` remains supported and maps to RGB white.

## Ultrasonic

```python
from zebjus import Ultrasonic

distance = Ultrasonic(1).read()
print(distance, "cm")
```

Expected real-kit sensor packet:

```json
{"type":"sensor","sensor":"ULTRASONIC","id":1,"distanceCm":34.7}
```

## Potentiometer

Beginner value is normalized to 0–255:

```python
from zebjus import Potentiometer

pot = Potentiometer(1)
print(pot.read())   # 0 to 255
print(pot.raw())    # raw ADC if supplied by kit
```

Expected packet:

```json
{"type":"sensor","sensor":"POT","id":1,"value255":128,"raw":2056}
```

## Demo sensor values

Settings → Demo Sensors:
- Ultrasonic: 2–400 cm
- Potentiometer: 0–255

These values are returned to Python in Demo mode.

## Image Lab + OpenCV graphics

Load a JPG/PNG from the **Image Lab** panel.

Then:

```python
from zebjus_cv import load_image, draw_rgb_led, show

img = load_image()
draw_rgb_led(img, 100, 100, 255, 0, 0)
show(img)
```

Pot graphic:

```python
from zebjus import Potentiometer
from zebjus_cv import load_image, draw_potentiometer, show

img = load_image()
value = Potentiometer(1).read()
draw_potentiometer(img, 120, 120, value)
show(img)
```

Full dashboard:

```python
from zebjus import Potentiometer, Ultrasonic
from zebjus_cv import load_image, draw_rgb_led, draw_potentiometer, draw_ultrasonic, show

img = load_image()
draw_rgb_led(img, 80, 80, 0, 255, 0)
draw_potentiometer(img, 180, 80, Potentiometer(1).read())
draw_ultrasonic(img, 260, 65, Ultrasonic(1).read())
show(img)
```

## Browser graphics

Main page now always shows:
- RGB LED preview
- Ultrasonic distance bar
- Potentiometer dial
- Motor graphic
- Servo graphic
- small camera / MediaPipe preview
- image upload preview

## Editor autocomplete

Suggestions include:
- `RGBLED`
- `Ultrasonic`
- `Potentiometer`
- `draw_rgb_led`
- `draw_potentiometer`
- `draw_ultrasonic`
- OpenCV functions
- MediaPipe
- existing Python basics

## Important AI limitation

`HandDetector().read()` is a stable snapshot taken immediately before Python starts. A blocking Python `while True` loop still does not receive continuously changing MediaPipe frames in this static browser architecture.

## GitHub upload

Delete old project files and upload ALL files from this ZIP.

Commit:

`Install ZEBJUS Python Lab v5 RGB sensors image graphics`

Hard refresh after Pages deploy:
- Mac: Cmd + Shift + R
- Windows: Ctrl + Shift + R
