# ZEBJUS Python Lab v6.8.0 — Custom Board Simulation

Student-focused browser lab with three linked pages:

- **Python Lab** — write/run Python, use 46 examples, view simulated or connected hardware output.
- **Circuit Design** — arrange 80 recognizable 2D parts, drag pins/wires, zoom/pan, and run a live visual simulation.
- **Schematic** — view the same saved design as a logical diagram and run the same simulation.

## ZEBJUS Custom Board

The circuit pages use the **ZEBJUS Custom Board 38-Pin Expansion** artwork and name. Its expansion power terminals expose **12V**, **5V**, **3.3V**, and **GND**. The board metadata contains exactly 38 physical controller pins plus the four expansion power terminals.

The browser interface does not present the controller as a generic development board. The retained firmware folder uses its technical toolchain naming only because it is the low-level firmware target.

## Circuit Design highlights

- 80 realistic top-view 2D components; no 3D mode or 3D assets.
- Wires render in a high front layer, with white underlay and readable labels, so they stay visible across part artwork.
- Component and board dragging, pin-hotspot wiring, mouse-wheel zoom, canvas pan, fit, resize, rotate, flip, undo, redo, validation, and auto-wiring.
- Live Run/Stop simulation animates wire current and shows changing values for motors, LEDs, displays, environment sensors, IMUs, distance sensors, counters, buses, keypad, RTC, and more.
- Circuit state and generated Python remain shared between Circuit Design, Schematic, and Python Lab.

## Component/runtime expansion

v6.8.0 adds 35 components, including DC and TT motors, stepper motor, BLDC ESC, fan, pump, solenoid, vibration motor, PCA9685, LSM6DS3, BME280, BMP280, ADXL345, BH1750, VL53L0X, DS18B20, HX711, RC522, MicroSD, MAX7219, NeoPixel, keypad, DS3231, LoRa, CAN, and 7-segment output.

Matching `zebjus` Python classes are available to generated/student code. The browser simulation supplies changing values without a connected kit; generic bridge operations are retained for connected hardware.

## Power and safety

- Use the rail that matches the actual module: 12V, 5V, or 3.3V.
- Controller logic inputs are 3.3V. Use a divider or level shifter for 5V signals such as many HC-SR04 ECHO outputs.
- Motors, pumps, servos, solenoids, and high-current loads require the correct driver and external supply. Always share GND with the controller.
- The Circuit Designer validates incompatible GPIO directions, ADC-only pins, shared bus ownership, duplicate I²C addresses, and resource limits.

## Start

Serve this folder with a local HTTP server, then open `index.html`. Opening pages directly with `file://` is not supported by all browser features.

Run the release verification with:

```bash
python3 VERIFY_RELEASE.py
```

Firmware stays at v2.5.0. The browser application version is v6.8.0.
