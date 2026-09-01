# ZEBJUS Python Lab

A browser-based Python playground for training courses and Wi‑Fi hardware kits.

## Included

- Monaco code editor
- Python autocomplete and ZEBJUS kit suggestions
- Pyodide running in a Web Worker
- Run / Stop / Reset / Clear Output
- `from zebjus import *`
- `LED`, `Motor`, `Servo`, `sleep`
- Demo hardware simulator
- Real hardware mode over secure WebSocket (`wss://`)

## Run locally

Because the app uses a Web Worker, do not open `index.html` directly with `file://`.

From this folder run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Example Python

```python
from zebjus import *

led = LED(1)

for i in range(5):
    led.on()
    sleep(0.5)
    led.off()
    sleep(0.5)
```

## Real kit WebSocket protocol

When the browser connects it sends:

```json
{"type":"hello","kitId":"ZB-000123"}
```

LED ON:

```json
{"type":"command","kitId":"ZB-000123","command":"LED_SET","id":1,"value":1}
```

Motor:

```json
{"type":"command","kitId":"ZB-000123","command":"MOTOR_SET","id":1,"speed":60}
```

Servo:

```json
{"type":"command","kitId":"ZB-000123","command":"SERVO_SET","id":1,"angle":90}
```

Your cloud relay/server should authenticate the logged-in user, verify that they own/are allowed to control the supplied Kit ID, then forward the command to the correct physical kit.

## Wix use

Recommended deployment:

1. Host this folder on an HTTPS host such as your own server, Cloudflare Pages, Netlify, Vercel or GitHub Pages.
2. Embed the hosted HTTPS URL in your Wix Online Program using an HTML/iFrame element.
3. Use only a secure WebSocket endpoint (`wss://`) for real hardware mode.

Embedding a full playground as a hosted page is more reliable than pasting all JavaScript directly into a lesson HTML block.

## Important production additions

Before real students use this with hardware:

- User authentication
- Per-user Kit ID authorization
- WSS/TLS
- Rate limiting
- Emergency stop
- Command timeout/failsafe in the kit firmware
- Server-side audit logs
- Restrict allowed commands and ranges
- Never expose server secrets in the browser
