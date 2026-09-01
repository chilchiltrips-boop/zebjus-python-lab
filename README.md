# ZEBJUS Python Lab v2

Browser Python lab for Wix/GitHub Pages with Wi‑Fi kit commands and a MediaPipe hand-detection experiment.

## Features
- Monaco editor + autocomplete
- Pyodide in a Web Worker
- LED / Motor / Servo demo APIs
- secure WebSocket transport for future real kit control
- MediaPipe Hand Landmarker camera panel
- finger-count demo
- `from zebjus_ai import *` and `HandDetector().read()`
- GitHub Pages friendly relative paths and `.nojekyll`

## AI + LED example
```python
from zebjus import *
from zebjus_ai import *

led = LED(1)
result = HandDetector().read()

if result.detected and result.fingers >= 4:
    led.on()
else:
    led.off()
```

The AI bridge is snapshot-based in v2: MediaPipe runs continuously in JavaScript, and the newest camera state is copied into Python when Run is pressed. Continuous real-time Python loops will need a later async bridge.

## GitHub Pages files
Keep these in repository root:
`index.html`, `styles.css`, `config.js`, `app.js`, `ai.js`, `py-worker.js`, `.nojekyll`, `README.md`.

## Wix
Embed the GitHub Pages HTTPS URL using Wix Embed Site/iFrame. Camera permission may be blocked by an iframe/browser policy; if so, use an **Open Python Lab** button that opens the lab in a new tab.

## Production
Before real hardware control, add authenticated users, per-user Kit ID authorization, WSS/TLS, command validation/rate limits, emergency stop, and firmware command-timeout failsafe.
