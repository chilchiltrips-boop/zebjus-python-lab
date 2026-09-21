# ZEBJUS Python Lab v5.25 — Dynamic Sensor Layout Test

Checks for this build:

1. Desktop top workspace: main.py editor is the large left pane; Camera / MediaPipe and Image Upload are stacked at right.
2. Kit Output / Sensors is full width below the editor workspace.
3. OpenCV / imshow is the large lower-left panel.
4. Serial Plotter and Output / Terminal are stacked as two rows in the lower-right column.
5. No supported hardware in main.py -> default hardware cards are shown.
6. `from zebjus import Switch, OLED, Potentiometer` -> cards are ordered Switch, OLED, Potentiometer.
7. Multiple constructors such as `sw1=Switch(32)` and `sw2=Switch(33)` -> separate cards.
8. Multiple analog, ultrasonic, DHT11, and rotary instances map live values by their selected pins.
9. OLED preview is enlarged and uses pixelated/crisp scaling.
10. Real-kit sensors without a read packet show WAITING until live data arrives.
