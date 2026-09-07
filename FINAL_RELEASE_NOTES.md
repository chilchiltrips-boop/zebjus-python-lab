# ZEBJUS Python Lab v6.4.5 Stable Status + Debug Trace FINAL

## v6.4.5 Stable Status / Debug Trace
- TM1637/LCD cards no longer show per-command `SYNCING`; connected output stays visually `KIT`.
- Background queue/ACK activity is hidden from the user-facing mode label, preventing clock projects from blinking.
- `🐞 Copy Debug` captures current main.py, terminal tail, timestamps, kit identity/IP, failure counter, heartbeat/API latency, display queue state, and recent runtime/network errors. Security tokens are excluded.
- Diagnostics page stores and copies the latest snapshot.
- Added built-in `Clock + Connection Stability Test` example for reproducible long-run testing.



## v6.4.5 Stable Local Link / No-Blink Connection Fix

- Fixed false `KIT ↔ SIMULATION` switching when one local ESP32 HTTP request times out.
- Cached IP, base URL, status and kit identity remain active through the first 1–4 consecutive local misses.
- Hard offline/simulation transition occurs only on the 5th consecutive health/heartbeat failure.
- Any successful heartbeat, status read or hardware command resets the failure counter immediately.
- Local HTTP requests retry the same cached target once without clearing the connection; DHCP/mDNS recovery remains a single background reconnect process.
- Display queues pause on a transient LAN failure and preserve the latest TM1637/LCD state instead of dropping it or replaying a large stale backlog.
- Reconnect success unpauses the queues and mirrors the latest pending display state automatically.
- Local Network Access fetch capability is detected once instead of potentially retrying every failed request twice.
- ESP32 firmware remains v2.4.0; hardware commands already refresh the firmware 10-second run heartbeat.
## v6.4.3 Bootstrap Recovery Hotfix
- Fixed LCD1602 `spinner()` generated-Python escaping for the backslash frame.
- Pyodide templates are now tested after real JavaScript template-string decoding, not only as raw JS source.
- Python runtime is marked ready only after the complete bootstrap succeeds.
- A failed bootstrap clears the pending-ready state so Run/Reset cannot fall through to missing `_zebjus_reset_student_namespace`.
- A run session is marked prepared only after student-namespace reset succeeds.
- ESP32 firmware remains v2.4.0; this is a browser/Pyodide runtime hotfix.


## v6.4.3 Protected Runtime
- Student `main.py` now executes in a separate persistent namespace instead of the Pyodide runtime global namespace.
- Fixes `_zebjus_stdout is not defined` and prevents user variables such as `io`, `time`, `json`, `math`, or private-looking names from corrupting runtime helpers.
- LIVE MODE variables still persist across cycles; a new Run session gets a clean student namespace.
- stdin/stdout/stderr bootstrap is revalidated every cycle.
- ESP32 firmware remains v2.4.0; this update is browser/runtime-only.

## v6.4.3 Runtime IO hotfix
- Fixes `NameError: name 'io' is not defined` in Run/LIVE MODE.
- The per-cycle stdin/runtime refresh now imports `sys`, `io`, and `json` locally before use.
- Browser cache-busters are v6.4.3. ESP32 firmware remains v2.4.0; no reflashing is required for this hotfix.

## Display preview / sync fixes
- TM1637 **Kit Output / Sensors** card now matches commands by actual CLK/DIO pins, with a single-card fallback for expression-based constructors.
- LCD1602 card now matches by I2C bus/address and mirrors both 16-character rows.
- TM1637/LCD browser preview updates immediately; it does not wait for the ESP32 HTTP ACK.
- Ordered display-effect frames preserve scroll/bounce/typewriter/blink animation order.
- Normal rapid TM1637/LCD state changes still use low-latency coalescing to avoid Wi-Fi backlog.
- Stale HTTP acknowledgements cannot roll the browser preview back to an older frame.

## LCD1602 v2 effects
- `center()`, `left()`, `right()` and `align()` can auto-scroll text longer than 16 characters.
- Added `scroll()`, `marquee()`, `bounce()`, `typewriter()`, `blink_text()`, `progress()`, `spinner()`, `clear_line()` and `lines()`.
- Added physical/browser cursor and cursor-blink control with `cursor()`.
- Firmware direct `write` is constrained to the remaining visible columns of the selected row instead of continuing into hidden DDRAM.

## TM1637 / HW-069 v2 effects
- Added `decimal()`, `clock()`, `scroll()`, `marquee()`, `blink()`, `count()` and `pulse()`.
- Expanded approximate seven-segment alphabet coverage.
- Native bidirectional DIO ACK driver retained; old transaction-mode ACK conflict remains fixed.

## Other output helpers
- RGB: `fade()`, `pulse()`, `rainbow()`.
- LED: `fade()`, `pulse()`.
- PWM Servo: `sweep()`.
- MotorDriver: `ramp()`.
- Buzzer: `beep()`, `sweep()`.

## Versions / tooling
- Browser/UI: **v6.4.3**.
- ESP32 firmware: **v2.4.0**.
- Arduino sketch folder, root compile helper, GitHub Actions workflow and visible workflow copy all target v2.4.0.
- `VERIFY_RELEASE.py` and `TEST_SENSOR_RUNTIME.py` cover the new display effects and long-text behavior.

## Retained
All v6.2.2/v6.3.1 real-sensor sync, DHT11, ultrasonic, failsafe, Secure Mode, offline simulation, reconnect, persistent live loop, I2C sharing and central resource-manager fixes remain.
