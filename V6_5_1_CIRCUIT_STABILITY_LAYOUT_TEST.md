# v6.5.1 Circuit Designer Stability + Layout Test

Run from the release root:

```bash
python3 TEST_CIRCUIT_DESIGNER.py
python3 TEST_SENSOR_RUNTIME.py
python3 TEST_RUNTIME_NAMESPACE.py
python3 TEST_CONNECTION_STABILITY.py
python3 VERIFY_RELEASE.py
```

Current v6.8.1 circuit regression: 80/80 supported devices, 38-pin ZEBJUS Custom Board, UART/SPI/I²C combination rules, duplicate I²C address rejection, firmware slot limits, LIVE `while True` insertion, v1→v2 migration, generated Python compile/stub-execute and 81 valid 2D SVG/XML assets.

Manual UI smoke test:
- desktop: Inspector / canvas / component shelf must not overlap; fields align and remain inside panels;
- compact laptop/tablet: toolbar wraps without covering canvas;
- mobile: Inspector and shelf open as drawers; canvas remains usable;
- drag the resize handle at the canvas bottom-right to expand the drawing area;
- add multiple wires and confirm lanes/labels remain readable;
- schematic view must show the ESP32 pin block and wire endpoints at assigned pins;
- `Apply to main.py` must insert generated constructors before the first top-level `while True:`.
