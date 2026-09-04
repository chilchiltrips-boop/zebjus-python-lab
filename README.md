# ZEBJUS Python Lab v5.18 — RGB + Potentiometer Stage

This build keeps the existing Python/OpenCV/MediaPipe engine, but the Learning Example menu is intentionally limited to the hardware features currently being developed: RGB LED and potentiometer.

## Added in v5.18

- Visible Undo and Redo buttons in the editor.
- Keyboard undo/redo: Cmd/Ctrl+Z and Cmd+Shift+Z / Ctrl+Y.
- More robust physical-kit verification before Run.
- Automatic reconnect retries after a temporary ESP32 reset, power dip, stale IP, or mDNS interruption.
- Reconnect uses the saved kit name and physical chip ID to reduce the chance of connecting to the wrong kit.
- RGB command recovery: if the ESP32 restarted during a program, the Lab re-opens the run session and retries the RGB command.
- ESP32 ADC1 potentiometer support with Python-selectable input pins.
- `Potentiometer(34).read()` → 0–255.
- `Potentiometer(34).raw()` → 0–4095.
- `percent()`, `millivolts()` and `.pin` helpers.
- Potentiometer values update continuously in `while True` programs.
- Example list cleaned to the current RGB + potentiometer development stage only.

## Firmware

Upload:

`esp32_firmware/ZEBJUS_Kit_RGB_Pot_WiFi_v1_2.ino`

Board target: classic ESP32 DevKit / ESP32-WROOM-32 / ESP32-WROOM-DA.

## RGB pins

Safe output list:

`4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33`

Default:

```python
rgb = RGBLED(25, 26, 27)
```

## Potentiometer pins

Wi-Fi-safe ADC1 list:

`32, 33, 34, 35, 36, 39`

Recommended:

```python
pot = Potentiometer(34)
```

Avoid using the same GPIO simultaneously as RGB output and potentiometer input.

## Kit reconnect behavior

The web app now verifies `/api/status` before each hardware Run. If the selected kit temporarily disappears, it retries the saved IP and `<kit-name>.local`. The saved chip ID is checked after reconnect so a different physical kit should not silently take over the session.

The app also checks kit health periodically while idle. During an active Run, the existing heartbeat continues to keep outputs fail-safe.
