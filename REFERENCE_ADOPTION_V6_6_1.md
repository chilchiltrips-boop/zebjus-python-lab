# Reference Adoption — v6.7.0

Source reference: `ZEBJUS_F450_Drone_Lab_V18_3_16_BOARD_AUTO_FW_UI.zip`.

Adopted:
- engineering-workstation visual hierarchy and spacing
- large firmware workflow cards/status/progress stages
- pin-centric wiring interaction and curved routes
- firmware detection/import/upload/reboot/reconnect workflow

Not copied:
- drone flight-control architecture
- F450-specific motor/ESC/assembly state
- transmitter/arming logic
- simulator-specific 3D scene logic

Python Lab keeps its own same-Wi-Fi KitClient, protected Pyodide runtime, 41 examples, device fault isolation, Circuit Designer resource rules and ESP32 universal hardware bridge.
