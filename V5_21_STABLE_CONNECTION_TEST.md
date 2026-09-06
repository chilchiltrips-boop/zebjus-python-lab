# ZEBJUS Python Lab v5.21 — Stable Connection Test

## Expected connection order
1. Saved/cached IP is tried first.
2. If it fails or Kit ID does not match, mDNS `kit-name.local` is tried.
3. A previously known IP may be used as a final local fallback.
4. Every accepted device must be a ZEBJUS kit and must match the saved physical `kitChipId` when one is available.
5. A successful response updates the cached IP and resets the consecutive-failure counter.

## UI state test
- Start with a connected kit: badge shows **Kit connected**.
- Cause 1, 2, 3, or 4 consecutive status/heartbeat misses: badge must remain **Kit connected**.
- Restore the kit before the 5th miss: badge stays connected and failure counter resets to 0.
- Cause 5 consecutive misses: badge changes to **Kit disconnected**.
- Restore Wi-Fi/power: background reconnect must return the badge directly to **Kit connected** without repeated `Connecting ↔ Connected` blinking.

## Run heartbeat/failsafe test
- Browser sends `/api/run/ping` every 1 second while a physical-kit program is running.
- Temporary API/Wi-Fi misses do not stop the Python program.
- If ESP32 receives no run heartbeat for more than 10 seconds, firmware calls `forceOutputsOff()` and RGB/output goes safe OFF.
- If the kit reconnects while the browser program is still running, the run session is resumed; the failure counter resets.

## DHCP/new-IP test
- Connect once and note the cached IP.
- Reboot router/kit so DHCP assigns a different IP.
- Cached IP should fail Kit/status access, mDNS should find the same physical Kit ID, and the new IP should replace the old cached IP automatically.

## New Project/draft test
- Click **+ New Project**: editor must be completely blank.
- Type custom Python code and refresh: the custom draft must restore when Auto-save is enabled.
- Click **+ New Project** again and leave the editor empty; refresh: the intentionally blank draft must remain blank.
- Undo/Redo, suggestions, pin validation, RGBLED, AnalogInput, Switch, RotaryEncoder and all existing examples remain available.
