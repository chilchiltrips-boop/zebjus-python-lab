# ZEBJUS Python Lab v5.24 — Gradient Grid Dark IDE

v5.24 keeps the v5.21 stable kit connection architecture and the v5.22/v5.23 sensor features, then reorganizes the browser UI into a coding-first dark gradient grid. The editor receives most of the desktop viewport while live camera, plotting and upload tools remain visible in a narrow utility column.

## Stable kit connection retained

- Cached IP primary → physical Kit ID verification → mDNS fallback.
- 5 consecutive failures are required before the UI becomes Disconnected.
- Failures 1–4 keep the visible state Connected.
- Silent background reconnect; no routine Connecting ↔ Connected blinking.
- Successful reconnect/API/heartbeat resets the failure counter.
- New DHCP IP automatically updates the cached IP.
- Run heartbeat every 1 second.
- ESP output failsafe after 10 seconds without heartbeat.
- Temporary Wi-Fi/API misses do not immediately stop the Python program.
- `+ New Project` opens a blank editor; custom draft auto-save/restore is retained.

## v5.24 additions

- Physical `DHT11(pin=13)` API using `/api/input/dht11`.
- Direct temperature °C and humidity %RH methods.
- Legacy `get_values()` compatibility returns `[humidity×10, temperature×10]` so old projects that divide by 10 continue to work.
- DHT11 card in **Kit Output / Sensors**.
- Generic Python Serial Plotter: `plot(Temperature=t, Humidity=h)`.
- `SerialPlotter().plot(...)` and `clear_plot()` helpers.
- Serial Plotter works with future sensors too: ultrasonic, analog, light, gas, IMU values, etc.
- 5 DHT11 examples added; current Learning Example menu has **25 examples**.
- GPIO12 is additionally accepted for **Ultrasonic ECHO only** for users already using TRIG=14/ECHO=12. GPIO12 is a boot-strapping pin, so another ECHO GPIO is preferable for new builds.

## v5.24 coding-first layout

Desktop:

1. Project controls
2. Main workspace: large `main.py` editor (~80%+) + compact right utility column
   - Camera / MediaPipe
   - Serial Plotter
   - Image Upload
3. Second row: Kit Output / Sensors + OpenCV / `imshow` Output
4. Full-width Output / Terminal
5. Compact Quick Tools / Project Reference

The visual theme uses a dark neutral editor surface with subtle gradient accents on panels and controls. Tablet/mobile layouts stack progressively with the editor kept first. Quick Reference remains collapsible inside the editor panel.

## DHT11 Python API

```python
from zebjus import DHT11, sleep

dht = DHT11(13)

while True:
    print(dht.temperature(), "C", dht.humidity(), "%")
    sleep(1)
```

Legacy project style:

```python
from zebjus import DHT11, sleep

b = DHT11(13)

while True:
    vals = b.get_values()
    humidity = vals[0] / 10.0
    temperature = vals[1] / 10.0
    print(f"Humidity: {humidity:.1f}% | Temp: {temperature:.1f} °C")
    sleep(1)
```

Serial Plotter:

```python
from zebjus import DHT11, plot, sleep

dht = DHT11(13)

while True:
    t = dht.temperature()
    h = dht.humidity()
    plot(Temperature=t, Humidity=h)
    sleep(1)
```

## Recommended wiring

- RGB LED: GPIO25 / GPIO26 / GPIO27
- DHT11 DATA: GPIO13
- Ultrasonic: TRIG GPIO14 / ECHO GPIO12 is supported for the current user setup; TRIG GPIO18 / ECHO GPIO19 remains a safer general default.
- OLED: SDA GPIO21 / SCL GPIO22 / address `0x3C`

### DHT11 electrical note

Prefer powering a DHT11 module from **3.3V** when its DATA pull-up is tied to VCC. If a module is powered from 5V and its DATA line is pulled up to 5V, do not feed that directly into ESP32 GPIO; use a 3.3V pull-up or suitable level shifting.

### HC-SR04 electrical note

HC-SR04 ECHO is normally 5V. Use a voltage divider or level shifter before the ESP32 ECHO GPIO.

## Firmware

Upload:

`esp32_firmware/ZEBJUS_Kit_RGB_Input_OLED_Ultrasonic_DHT11_WiFi_v1_6.ino`

Required Arduino libraries for OLED:

- Adafruit SSD1306
- Adafruit GFX Library
- Adafruit BusIO

DHT11 support is implemented directly in the firmware, so no additional DHT library is required.


## v5.24 Layout
Desktop layout uses an approximately 80/20 main.py + utility-column workspace. Camera, Serial Plotter and Image Upload are stacked beside the editor. Below that, Kit Output/Sensors and OpenCV/imshow share a row; Output/Terminal is full-width, followed by Quick Tools / Project Reference. Responsive breakpoints stack panels on smaller screens.
