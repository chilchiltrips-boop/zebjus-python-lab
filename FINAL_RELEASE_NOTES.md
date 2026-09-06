# ZEBJUS Python Lab v6.0 FINAL

This release changes the kit into a Universal Hardware Bridge so most future modules can be supported with Python drivers rather than a dedicated firmware route.

## Final core

- Generic GPIO / ADC / PWM
- I2C, UART, SPI
- Pulse / frequency and interrupt-backed counters
- ESP32-local timing transactions
- Dynamic GPIO/bus resource allocation
- Dynamic Kit Output / Sensors dashboard
- Generic Serial Plotter and custom `dashboard(...)` cards
- Existing RGB, LED, OLED, DHT11, Ultrasonic, inputs and 38 examples retained
- Cached IP + Kit-ID verification + mDNS fallback + 5-failure UI threshold
- 1-second active-run heartbeat + 10-second ESP32 safe-off failsafe

## Firmware

`esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_0.ino`

OLED compatibility requires Adafruit SSD1306, Adafruit GFX and Adafruit BusIO.

## Validation

Web/worker/example syntax and static firmware integrity checks passed. Arduino IDE compilation was not available in the packaging environment, so compile/upload on the target ESP32 remains the final hardware verification step.
