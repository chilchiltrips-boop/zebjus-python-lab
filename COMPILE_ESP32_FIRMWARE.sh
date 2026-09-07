#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SKETCH="$ROOT/esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_4_0"
FQBN="${FQBN:-esp32:esp32:esp32}"
if ! command -v arduino-cli >/dev/null 2>&1; then
  echo "arduino-cli is not installed. Install it from https://arduino.github.io/arduino-cli/" >&2
  exit 2
fi
arduino-cli config init --overwrite >/dev/null 2>&1 || true
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json >/dev/null 2>&1 || true
arduino-cli core update-index
arduino-cli core install esp32:esp32
arduino-cli lib install "Adafruit SSD1306" "Adafruit GFX Library" "Adafruit BusIO"
arduino-cli compile --fqbn "$FQBN" "$SKETCH"
