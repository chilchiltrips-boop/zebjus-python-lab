# ZEBJUS Python Lab v3.1 Classic

This version returns to the clearer classic layout while keeping the newer learning features.

## Main page
- Large Python editor
- Run / Stop / Reset
- Small camera preview
- Visible LED / Motor / Servo graphics
- Compact output terminal
- Python / OpenCV / MediaPipe / kit examples
- Case-sensitive autocomplete
- Mobile responsive layout

## Separate Settings page
Settings are moved to `settings.html`:
- Camera index
- Auto-start camera
- Demo mode
- Kit ID
- Secure WebSocket URL
- Editor font size
- Auto-save
- Values for Python `input()`

## OpenCV
Pyodide 314.0.6 includes `opencv-python`. It loads only when an OpenCV example imports `cv2`.

Use browser camera through:

```python
from zebjus_cv import Camera, show
import cv2

frame = Camera(0).read()
gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
show(gray)
```

## MediaPipe
MediaPipe Tasks Vision 1.0.1 runs in the browser.

## GitHub update
Upload/replace all files in the repository root:

- index.html
- settings.html
- styles.css
- config.js
- app.js
- settings.js
- ai.js
- py-worker.js
- .nojekyll
- README.md

Commit example:
`Restore classic UI and add separate settings page`

Your GitHub Pages URL stays the same.

For Wix embedding, use:
`https://chilchiltrips-boop.github.io/zebjus-python-lab/`

Recommended iframe:
- width 100%
- height about 720px on desktop
- on mobile, allow the iframe to use full page width
