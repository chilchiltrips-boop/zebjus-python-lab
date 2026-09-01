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


## v5.1 — Wix Online Programs Camera Bridge

Wix Online Programs can sandbox embedded content so the browser never shows a camera permission prompt inside the iframe.

This build detects embedded mode. When camera-dependent code is Run:
1. the embedded editor stays inside Wix
2. a small `camera-bridge.html` popup/new tab opens
3. camera permission is requested in that top-level window
4. MediaPipe runs there
5. the latest AI state and 320×240 camera frame are sent back to the embedded lab using `BroadcastChannel`
6. Python runs inside the embedded lab with that camera snapshot

This works for:
- `HandDetector`
- MediaPipe hand examples
- `Camera(0).read()` OpenCV examples

The Camera Bridge window can remain open for later Runs.

If a browser blocks the popup, allow popups for the Wix/GitHub lab and press Run again.


## v5.2 — Normal Wix Page Direct Camera

Use this Velo Page Code on the normal Wix page:

```js
$w.onReady(function () {
    $w("#html1").allow = "camera; fullscreen";
});
```

The lab now:
1. tries camera access inside the Wix page first
2. uses the normal browser camera permission prompt
3. keeps the camera preview inside the embedded lab
4. opens Camera Bridge only if direct iframe access is blocked


## v5.3 — MediaPipe Face Detection + CVZone compatibility

Added browser-compatible imports used by common CVZone tutorials:

```python
import cv2
import mediapipe as mp
import cvzone
from cvzone.FaceDetectionModule import FaceDetector
```

Supported Face Detection APIs include:
- `mp.solutions.face_detection.FaceDetection(...)`
- `cvzone.putTextRect(...)`
- `cvzone.cornerRect(...)`
- `cvzone.FaceDetectionModule.FaceDetector(...).findFaces(...)`
- `zebjus_ai.FaceDetector().read()`

Important: `mediapipe` and `cvzone` here are ZEBJUS browser compatibility modules. The face inference itself runs with MediaPipe Tasks Vision in JavaScript because the normal native MediaPipe Python wheel is not a browser/Pyodide wheel.

The browser lab remains snapshot-based for Python camera programs. Desktop-style infinite webcam loops such as `while True: cap.read(); cv2.imshow(...)` should be adapted to `Camera(0).read()` + `show(...)` in this version.

Desktop OpenCV tutorial compatibility:
- `cv2.VideoCapture(0)` reads the browser camera snapshot.
- `cv2.imshow(...)` is redirected to the OpenCV Image output panel.
- a `while True` webcam loop used with `cv2.VideoCapture` is adapted to one frame per Run so the Pyodide worker does not lock up.


## v5.4 — VISION AI Z Student Projects

This build is prepared so students can type and test the VISION AI Z course projects in the browser.

Added browser compatibility:
- `SerialModule.SerialObject`
- `cvzone.SerialModule.SerialObject`
- `HandTrackingModule.handDetector`
- `zebjus_wifi.WifiBridge`
- existing `cv2`, `mediapipe`, `cvzone`, ZEBJUS kit APIs

Desktop `while True` tutorial loops are automatically converted to one cycle per Run in student test mode. This prevents a browser Python worker from being locked forever.

Project resources from VISION AI Z are included under `vision-assets/` and preloaded for `cv2.imread()` examples.

### Student workflow
1. Choose **Blank Student Project** or clear the editor.
2. Student types the lesson code manually.
3. Press **Run**.
4. Camera/AI code uses the current camera snapshot.
5. Hardware code updates the demo kit graphics or the assigned real kit.
6. Re-run after changing code/input/hand position.

For a final live-stream course mode, add a cooperative repeated-run scheduler instead of a blocking Python infinite loop.


## v5.5 — Student Image Upload Paths

Students can upload one or more images from Image Lab. Each image receives a browser project path:

```text
uploads/cat.jpg
uploads/test-image.png
```

Use the **Copy Path** button and paste it into Python:

```python
import cv2

img = cv2.imread("uploads/cat.jpg")
print(img.shape)
cv2.imshow("My Image", img)
cv2.waitKey(1)
```

Notes:
- Up to 10 images can be selected at once.
- Maximum 5 MB per image.
- Duplicate filenames are renamed automatically (`cat_2.jpg`, etc.).
- Uploaded files belong to that student's current browser tab/session.
- Files are copied into Pyodide at `/home/pyodide/uploads/`.
- The visible student path stays simple: `uploads/<filename>`.
