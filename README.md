# ZEBJUS Python Lab v3 — Student IDE

A compact, responsive browser Python IDE intended for Wix embedding and student learning.

## Why CodeMirror instead of Monaco

Monaco is excellent on desktop but its official documentation says mobile browsers are not supported. v3 uses CodeMirror 6, which supports mobile native selection/editing, syntax highlighting, line numbers and autocomplete.

## Main features

- Compact Wix-friendly layout
- Desktop + tablet + mobile responsive UI
- Mobile-friendly CodeMirror 6 editor
- Case-sensitive Python autocomplete
- Python keyword and built-in suggestions
- ZEBJUS kit autocomplete
- OpenCV autocomplete
- MediaPipe/ZEBJUS AI autocomplete
- Local autosave of student code
- Program input box for `input()`
- Run / Stop / Reset
- Camera device/index selector
- `Camera(0)`, `Camera(1)` style camera selection
- Camera auto-start on Run
- MediaPipe hand detection
- OpenCV `cv2` support through Pyodide
- OpenCV image output with `show(image)`
- Demo LED / motor / servo
- Real kit WSS structure retained
- Python Basics / OpenCV / MediaPipe / Hardware examples

## Upload to GitHub

Replace the old repository files with all files from this ZIP:

```text
index.html
styles.css
config.js
app.js
ai.js
py-worker.js
.nojekyll
README.md
```

Commit example:

```text
Upgrade ZEBJUS Python Lab to v3 responsive student IDE
```

Your existing GitHub Pages URL remains the same.

## Wix embed

Recommended URL:

```text
https://chilchiltrips-boop.github.io/zebjus-python-lab/?embed=1
```

Use an Embed Site / iframe element and give it as much width as practical.

Recommended desktop iframe:
- width: 100%
- height: 650–750 px

On phones, allow the embedded element to use most of the page width. The app automatically switches to its mobile layout.

### Camera note for Wix

Camera APIs require HTTPS, which GitHub Pages provides. Some parent iframe configurations can still block camera permission. If a browser/Wix combination blocks it, the top-right ↗ button opens the same lab directly in a new tab, where camera permission can be granted normally.

## Camera index

The Camera tab lists browser cameras as Camera 0, Camera 1, etc.

Student OpenCV examples use:

```python
from zebjus_cv import Camera, show
import cv2

cam = Camera(0)
frame = cam.read()
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
show(gray)
```

If the code contains `Camera(1)`, the web app attempts to select browser camera index 1 before running.

This intentionally uses `zebjus_cv.Camera()` instead of `cv2.VideoCapture()` because normal OpenCV desktop camera capture is not available inside a browser sandbox.

## OpenCV loading

OpenCV is only loaded when code imports `cv2` or `zebjus_cv`, which avoids making Python basics wait for the large OpenCV package.

## MediaPipe

MediaPipe runs in JavaScript/WASM and its newest hand snapshot is exposed to student Python:

```python
from zebjus_ai import HandDetector

result = HandDetector().read()
print(result.detected)
print(result.fingers)
print(result.side)
```

## Current live-loop limitation

`HandDetector().read()` returns the latest snapshot at the moment Run begins. A blocking Python `while True` loop does not continuously receive new MediaPipe states in this static/Wix-compatible version. Press Stop to terminate accidental infinite loops.

## Real kit

Edit `config.js` to set your future secure relay:

```js
websocketUrl: "wss://lab-api.zebjus.com/ws"
```

Before real internet-controlled hardware use, add authenticated users, per-kit authorization, TLS/WSS, command validation, rate limiting, command timeout/failsafe, emergency stop and server-side logs.
