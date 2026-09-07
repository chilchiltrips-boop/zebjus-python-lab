# ZEBJUS release tools

These files are development/release helpers. The website can load without them, but keep them in GitHub so releases and firmware can be checked.

- `verify_release.py` – checks JS, HTML, Pyodide blocks, examples and runtime regressions.
- `test_sensor_runtime.py` – browser/Python hardware runtime stub tests, including displays.
- `compile_esp32_firmware.sh` – real Arduino CLI compile for the ESP32 firmware.

Visible root wrappers `VERIFY_RELEASE.py` and `COMPILE_ESP32_FIRMWARE.sh` are also included for easier use on macOS.

`tools/` is optional for the deployed website. Standalone copies are provided at the project root, so the site still works if this helper folder is not uploaded.
