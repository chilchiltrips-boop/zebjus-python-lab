# v6.0 Universal Hardware Bridge validation

Validated in the project package:

- JavaScript syntax: all JS files pass `node --check`
- Pyodide embedded Python bootstrap: Python syntax compile passes
- Student examples: 38/38 Python syntax compile passes
- Example dropdown: 38/38 keys match example definitions
- Existing `2 RGB + 4 LED` resource test: 10 safe output pins used, 5 remain
- OLED + MPU6050 on I²C0 SDA21/SCL22: shared bus passes, only 2 physical pins counted
- Same I²C bus number with different pin pairs: `InterfaceConflictError`
- UART1 + UART2 with separate modules: passes
- Same UART port with different RX/TX configurations: `InterfaceConflictError`
- Universal component selector can propose conflict-free GPIO / ADC / bus resources
- 10-second firmware heartbeat failsafe retained
- Firmware v2.0 contains GPIO, ADC, PWM, I²C, UART, SPI, pulse and local transaction endpoints

Hardware upload/compile must still be confirmed in Arduino IDE on the target ESP32 installation because the build environment used to package the web project does not contain the user's Arduino ESP32 toolchain/libraries.
