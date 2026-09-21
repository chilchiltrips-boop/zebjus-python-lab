# ZEBJUS Python Lab v6.7.0 FINAL

## v6.7.0 reliability fixes
- Display hardware queues paused by a confirmed LAN disconnect are tagged as transport pauses and automatically resumed after reconnect; device/wiring fault pauses remain isolated.
- Firmware Center uses a stable chip-ID/name key instead of a mutable sorted-array index, preventing the selected kit from changing after `lastSeen` reordering.
- Firmware Center loads the Secure Mode token from the matching saved Kit Settings identity before protected firmware-info, OTA and reboot calls.
- USB recovery passes firmware bytes to esptool-js as `Uint8Array`.
- Circuit Designer preserves valid board coordinates `x=0` and `y=0` during save/load normalization.
- Circuit → `main.py` changes received while a program is running are queued, visibly reported and applied after stop/completion instead of being silently lost.
- The release verifier now runs targeted v6.7.0 regressions and the real Chromium Circuit/Schematic UI test; when Chromium is unavailable it reports the browser test explicitly as `SKIPPED` instead of presenting it as passed.

ESP32 firmware remains **v2.5.0**; this release changes the browser application and test tooling only.

## Reference adoption
The supplied F450 V18.3.16 project was used as a **reference**, not as a replacement architecture. Adopted patterns include the centered engineering workspace, stronger card/status hierarchy, readable form spacing, pin-focused 2D wiring behavior, curved route presentation, and staged firmware-update UX. Drone-specific flight/assembly logic was not imported into Python Lab.

## Circuit Designer
- Python Lab, Circuit Design, and Schematic now use one common top-tab workspace.
- 2D-only, bright student canvas inspired by familiar educational circuit editors.
- 45 recognizable real-part-style top views plus a pin-labelled ESP32 DevKit; all 3D artwork and the 3D switch were removed.
- Physical pin-hotspot wiring on both components and ESP32 board.
- Wire endpoints follow component/board drag continuously; release snaps positions to a 10 px grid.
- Mouse-wheel pointer zoom and empty-canvas drag pan work in Circuit Design and Schematic.
- Shared storage plus `BroadcastChannel` keeps Circuit/Schematic pages current; valid schematic changes also update `main.py`.
- Rotate left/right and horizontal/vertical flip; component text stays upright.
- Curved, color-coded wiring with a high-contrast underlay and labels.
- 45 supported devices, 46 root-level 2D SVG assets.
- Analog/digital/PWM/I2C/UART/SPI/counter/resource validation retained.
- Circuit → main.py live-loop-safe generated block retained.

## Student Settings
- Camera, kit connection, and editor choices remain visible and simple.
- Kit rename, Wi-Fi profile, Secure Mode, RGB reference, and legacy WebSocket controls are grouped under one collapsed Advanced section.

## Firmware Center
- Detects saved same-Wi-Fi kit and reads current firmware/board info.
- Imports compiled application `.bin`, calculates SHA-256, uploads with progress, verifies, reboots and monitors reconnect.
- USB recovery path uses Web Serial/esptool-js when browser/network support is available.
- Firmware v2.5.0 adds protected firmware-info/update/reboot APIs.
- OTA and reboot are blocked while a Python program is running.
- The source package includes the `.ino`; a compiled `.bin` is not produced in this environment.

## Packaging
GitHub upload package is intentionally flat. All website HTML/JS/CSS/SVG/docs/tests are in the root. The only subfolder is `esp32_firmware/`, containing one v2.5.0 `.ino`.
