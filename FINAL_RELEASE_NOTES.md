# ZEBJUS Python Lab v6.3 FINAL

## Added
- Native TM1637/HW-069 driver (`/api/tm1637`) with bidirectional DIO ACK handling.
- `TM1637` Python class: number, text, raw segments, brightness, clear.
- Animated four-digit browser card; works in offline simulation and mirrors physical kit when connected.
- Native LCD1602 16x2 common PCF8574 I2C-backpack driver (`/api/lcd1602`).
- `LCD1602` Python class: clear, home, cursor, write/print, line, center, backlight, display.
- 16x2 LCD browser preview card.
- Add Component / autocomplete / pin validator / interface conflict support for both displays.
- LCD1602 shares the existing I2C bus when SDA/SCL match. Addresses such as 0x27 and 0x3F are supported.
- Two new examples (40 total): TM1637 display and LCD1602 display.
- Visible GitHub Actions workflow copy and root release-tool wrappers for easier macOS/GitHub upload.

## Fixed
- Generic HardwareTransaction can hand a transaction-owned output pin back to input for protocols that require bidirectional ACK phases.
- Old TM1637 `MODE input pin conflict: active output` path is therefore backward compatible.
- Browser cache-busters updated to v6.3.0.
- Arduino compile script and GitHub Actions now target firmware v2.3.

## Retained
All v6.2.2 real-sensor-sync, DHT11, ultrasonic, failsafe, Secure Mode, offline simulation, persistent live loop, I2C sharing and resource-manager fixes remain.
