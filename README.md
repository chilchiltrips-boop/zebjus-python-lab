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


## v5.6 — Manual Uploads Only

Bundled course image/resource folders were removed.

Students or instructors upload the required images manually from **Image Lab**.
Each uploaded image receives a path such as:

```text
uploads/lena.png
uploads/Potentiometer.jpg
uploads/LedOn.jpg
```

Student code uses the copied path directly:

```python
import cv2

img = cv2.imread("uploads/lena.png")
cv2.imshow("Image", img)
cv2.waitKey(1)
```

There is no preloaded `Resources` or `vision-assets` folder in this build.


## v5.7 — Real-Time `print()` Terminal

Student Python output is now streamed directly to the Terminal while the program runs.

Supported examples:

```python
print("Hello")

name = "ZEBJUS"
print(name)

if True:
    print("Inside if")

for i in range(3):
    print(i)

print("A", end=" ")
print("B")
```

`print()` can be placed anywhere valid Python allows it: top level, functions, `if`, loops, OpenCV/AI projects, and hardware projects.

The terminal bridge preserves Python output chunks, including `end=""` / `end=" "` behavior.


## v5.8 — Live Hand / Vision while True

Camera/AI programs containing `while True:` now run repeatedly in browser live mode.
The latest MediaPipe hand state is supplied on every cycle.

- No hand: RGB OFF
- Fist / 0 fingers: White
- 1 finger: Red
- 2 fingers: Green
- 3 fingers: Blue
- 4 fingers: Yellow
- 5 fingers: Purple

Press **Stop** to end live mode. Stop also turns the RGB demo output off.


## v5.8.1 — Live Hand Cache Fix

This build cache-busts `app.js`, `ai.js`, `config.js`, and `py-worker.js`.

When the correct build is loaded, Terminal starts with:

```text
ZEBJUS Python Lab v5.8.1
LIVE MODE started — press Stop to end.
```

The old message below must **not** appear:

```text
Student test mode: desktop while True adapted to one browser cycle per Run.
```

Live hand loops now start immediately from the latest MediaPipe state and continue cycling until **Stop**.


## v5.9 — Cleaner Student Output + OpenCV Floating Window

### Hardware command noise hidden
When the physical kit is not connected, browser demo graphics continue to update, but student Terminal no longer needs to show internal Arduino/Wi-Fi command-send lines such as `DEMO → ...` or `SEND → ...`.

Student `print()` output remains visible.

### `cv2.imshow()` floating window
When Python calls:

```python
cv2.imshow("Image", img)
```

the browser opens a PyCharm-style floating OpenCV window over the lab. The Terminal remains visible and continues receiving `print()` output.

The floating window can be:
- dragged
- resized
- minimized
- closed

`cv2.imshow()` does not stop the running Python program.


## v5.9.1 — Terminal and OpenCV shown separately

- Student `print()` output stays in **Terminal**.
- `cv2.imshow("Window Name", image)` opens/updates a floating OpenCV image window.
- OpenCV output no longer automatically switches the bottom output tab away from Terminal.
- Demo hardware commands still update RGB/Motor/Servo graphics, but internal Arduino/Wi-Fi command messages are hidden until real-kit work is needed.


## v5.10 — Editor diagnostics + dynamic autocomplete

### Live syntax diagnostics
While the student types, Python syntax is checked after a short pause.

Syntax/indentation problems show:
- red `●` in the editor gutter
- red highlighted/underlined line
- error type and line number
- a short correction suggestion

### Runtime diagnostics
Errors such as `TypeError`, `NameError`, `AttributeError`, `IndexError`, `ValueError`, and `ZeroDivisionError` are shown in Terminal and highlighted on the source line.

### Student variable/function autocomplete
Names created in the current script are added to autocomplete automatically:

```python
distance = 25
student_name = "Asha"

def calculate_total():
    pass
```

Typing `dis`, `stu`, or `cal` can show these names in Suggestions.


## v5.11 — Clean runtime + synchronized Run/End/OpenCV UI

- Pyodide package chatter is hidden from the student Terminal.
- OpenCV and NumPy are initialized only once per worker.
- Repeated live-loop cycles no longer repeatedly initialize OpenCV packages.
- Student `print()` output, errors, upload/path messages, and useful app events remain visible.
- The Wix camera notice was removed from the page.
- `cv2.imshow()` remains a floating OpenCV window.
- Clicking the floating OpenCV window **X** ends a running program.
- Clicking **End** closes all OpenCV floating/image outputs and stops the camera/program.
- While a program runs, **Run** fades and is disabled; **End** becomes active.
- After program end/error/End, **Run** becomes bright and usable again.
- `cv2.destroyAllWindows()` closes browser OpenCV image windows.


## v5.11.1 — Live FaceDetector fix

Fixed `cvzone.FaceDetectionModule.FaceDetector` inside camera `while True` programs.

Previously, normal camera startup enabled the hand detector but live face programs skipped the call that initializes MediaPipe FaceDetector. This caused:

```text
bboxs = []
No face → GREEN
```

even when a face was visible.

Live face programs now explicitly enable the MediaPipe face detector before the first cycle and keep it enabled during subsequent cycles.
