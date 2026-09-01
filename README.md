# ZEBJUS Python Lab — FULL v4

This is a fresh complete project. You can delete the old GitHub repository contents and upload **all files from this ZIP**.

## Why this version fixes the editor problem

Previous builds used CodeMirror 6 through ES-module imports. If one module import failed, syntax colors and autocomplete could disappear.

This build uses **CodeMirror 5.65.21 classic scripts** loaded in a fixed order:
- CodeMirror core
- Python mode
- show-hint autocomplete
- auto-close brackets
- bracket matching
- active-line highlighting

The editor uses a custom PyCharm-inspired dark theme.

## Editor features

- Python syntax colors
- keywords orange
- strings green
- numbers blue
- comments gray italic
- function definitions yellow
- line numbers
- active line
- bracket matching
- auto-close brackets
- Tab = 4 spaces
- autosave
- case-sensitive autocomplete
- autocomplete while typing
- Ctrl+Space / Cmd+Space shows suggestions
- Suggestions button

### Autocomplete examples

Type:
- `pri` → `print()`
- `imp` → `import`
- `import c` → `cv2`
- `from zebjus import ` → `LED`, `Motor`, `Servo`, `sleep`
- `from zebjus_ai import ` → `HandDetector`
- `from zebjus_cv import ` → `Camera`, `show`
- `cv2.` → OpenCV functions/constants
- `np.` → NumPy functions
- `math.` → math functions
- `random.` → random functions

Object inference also works for common assignments:

```python
myled = LED(1)
myled.
```

suggests LED methods.

```python
camera = Camera(0)
camera.
```

suggests `read()`.

## Python runtime

Pyodide is pinned to **314.0.6** and is run in a **module-type Web Worker**, as required by current Pyodide.

OpenCV is loaded only when needed.

Pyodide includes:
- NumPy
- opencv-python
- many standard scientific Python packages

## Camera and MediaPipe

MediaPipe Tasks Vision is pinned to 1.0.1.

Run automatically starts the camera when Auto Camera is enabled in Settings.

Camera projects can use:

```python
from zebjus_cv import Camera, show
import cv2

frame = Camera(0).read()
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
show(gray)
```

MediaPipe:

```python
from zebjus_ai import HandDetector

result = HandDetector().read()
print(result.detected)
print(result.fingers)
print(result.side)
```

## Kit demo

```python
from zebjus import LED, Motor, Servo, sleep

led = LED(1)
led.on()

motor = Motor(1)
motor.forward(50)

servo = Servo(1)
servo.write(90)
```

Demo mode updates the visible LED, motor and servo graphics.

## Separate Settings page

`settings.html` contains:
- Camera selection
- Allow camera / detect devices
- Auto camera
- Demo mode
- Kit ID
- WSS URL
- Editor font size
- Autosave
- input() values

## Diagnostics

Open:

`diagnostics.html`

It checks:
- HTTPS
- CodeMirror load
- Camera API
- Worker API
- Pyodide worker

## GitHub upload

Delete the old files and upload ALL of these:

```text
index.html
settings.html
diagnostics.html
styles.css
config.js
ai.js
app.js
settings.js
py-worker.js
README.md
.nojekyll
```

Commit message:

`Install complete ZEBJUS Python Lab v4`

GitHub Pages URL remains:

`https://chilchiltrips-boop.github.io/zebjus-python-lab/`

After upload, hard refresh:
- macOS Chrome: Cmd + Shift + R
- Windows Chrome: Ctrl + Shift + R

## First test

1. Open the GitHub Pages URL.
2. Confirm Python keywords/strings have different colors.
3. Type `pri` and confirm `print()` suggestion.
4. Type `cv2.` and confirm OpenCV suggestions.
5. Run:

```python
print("Hello")
```

6. Run the LED example.
7. Run the Hand Detection example.
8. Run OpenCV Grayscale.

## Wix embed

Embed the GitHub Pages URL.

Recommended desktop height: 700–760 px.

On mobile, the layout automatically stacks the editor, small camera preview and kit output.
