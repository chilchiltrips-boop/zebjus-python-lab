# ZEBJUS Python Lab v6.8.1 FINAL

## What changed

- Replaced direct wire curves with a shared pin-aware rounded router in Circuit Design and Schematic. Routes score pin keep-out collisions and expose zero-conflict diagnostics.
- Moved every wire label into a final opaque label layer so wire strokes cannot cover text.
- Fixed detached/broken wire endpoints after switching pages or using browser back/forward by measuring the actual rendered stage scale and reflowing wires on page visibility/layout restoration.
- Added correct directional current flow for power, ground/return, input, output, and bidirectional bus wires.
- Added customizable Interactive Simulation controls and live output for all 80 component types, including gas/air mixture, concentration, ventilation, humidity, environmental, motion, distance, load, motor, bus, display, and communication tests.
- Added LED/display/motor/servo/fan/buzzer visual behavior, optional motor/buzzer/relay/alarm sounds, live component meters, and button press feedback.
- Replaced the user-facing controller artwork and label with **ZEBJUS Custom Board 38-Pin Expansion**.
- Added 12V, 5V, 3.3V, and GND expansion supply terminals.
- Moved Circuit Design and Schematic wires to the visible front layer.
- Added Run/Stop working simulation to Python Lab, Circuit Design, and Schematic.
- Added animated current flow and changing simulated component values.
- Expanded the catalog from 45 to 80 real-part-style 2D components, including motor and robotics parts.
- Added matching Python runtime drivers and five new student examples (46 total).
- Refreshed Python Lab with an aurora-grid student workspace theme.
- Retained linked page state, generated Python, zoom/pan, drag, rotate/flip, validation, firmware center, offline simulation, and device-fault isolation.

## Release inventory

- 80 component definitions
- 80 component SVGs plus one custom-board SVG
- 38 physical controller pins plus four expansion power terminals
- 46 Python examples
- Browser app v6.8.1
- Firmware v2.5.0
- 80/80 interactive component simulation profiles
- 165 root-level project files plus one firmware sketch

`VERIFY_RELEASE.py` validates the JavaScript, embedded Python, examples, SVG/XML assets, component code generation, pin-safe routing, all 80 simulation profiles, gas/air response, page links, board metadata, regression tests, and optional Chromium UI test.
