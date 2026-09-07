# ZEBJUS Python Lab v6.2 — Offline Simulation + Sensor Studio + Optional Secure Mode

v6.2 keeps the Universal Hardware Bridge architecture and adds three major upgrades: **offline hardware simulation**, **automatic sensor/module visual cards**, and **optional per-kit Secure Mode**. The v6.1 safety/runtime fixes remain in place, including active-low failsafe handling, persistent top-level `while True` state, shared I²C buses, central pin/resource ownership, 5-failure reconnect logic and the 10-second ESP32 output failsafe.

## Run with or without a physical kit

A valid Python program can run even when the ESP32 kit is disconnected.

- **Kit connected:** commands animate in **Kit Output / Sensors** and are also sent to the physical kit.
- **Kit disconnected:** the same code continues in **Offline Simulation**; visual outputs still animate and sensor cards use simulated/cached values.
- **Kit reconnects during a live run:** the browser automatically starts/resumes the ESP32 run session, the heartbeat restarts, and later hardware commands are mirrored physically without restarting the Python program.

This is especially useful for RGB effects, LEDs, servos, motors and classroom projects where students may write/test code before connecting hardware.

## Kit Output / Sensors — automatic cards

Cards are auto-arranged from `main.py` imports/instances and live commands. Supported visual families include:

- RGB LED / single LED
- OLED preview
- Servo (`PWMServo`) with angle animation
- Motor driver (`MotorDriver`) with direction/speed animation
- Ultrasonic distance
- DHT11 temperature + humidity
- Potentiometer / ADC
- Rotary encoder / switch / digital input
- GPS/GNSS with fix state, satellite count and coordinates
- MPU6050 IMU with live orientation/tilt visualization
- LDR / light
- Soil moisture
- Gas / air-quality analog modules
- Voltage sensor
- Sound sensor
- Rain sensor
- Water-level sensor
- Thermistor
- PIR motion
- Reed switch
- Touch sensor
- Flame sensor
- Flow sensor
- RPM / frequency / counter / pulse input
- Buzzer
- Joystick
- Generic I²C / UART / SPI activity cards
- Any future/custom Python driver using `dashboard(...)`

The generic bridge remains the foundation, so future modules usually need a Python driver and dashboard metadata rather than new firmware endpoints.

## Python universal APIs

```python
from zebjus import (
    RGBLED, LED, OLED, DHT11, Ultrasonic,
    AnalogInput, Potentiometer, DigitalInput, Switch, RotaryEncoder,
    DigitalOutput, Relay, GPIOInput, ADC, PWM,
    PWMServo, MotorDriver,
    I2C, I2CDevice, UART, SPI,
    PulseInput, PulseOutput, CounterInput, HardwareTransaction,
    GPS, MPU6050,
    LDR, SoilMoisture, GasSensor, VoltageSensor, SoundSensor,
    RainSensor, WaterLevelSensor, Thermistor,
    PIRSensor, ReedSwitch, TouchSensor, FlameSensor,
    FlowSensor, RPMSensor, Buzzer, Joystick,
    dashboard, plot, sleep
)
```

### Servo

```python
from zebjus import PWMServo, sleep

servo = PWMServo(18)
while True:
    servo.write(30)
    sleep(0.5)
    servo.write(150)
    sleep(0.5)
```

The servo moves physically when the kit is connected and the dashboard servo animates in both connected and offline modes.

### Motor driver

```python
from zebjus import MotorDriver, sleep

motor = MotorDriver(16, 17, 18)
while True:
    motor.forward(60)
    sleep(1)
    motor.backward(40)
    sleep(1)
    motor.stop()
    sleep(0.5)
```

### GPS / GNSS

```python
from zebjus import GPS, sleep

gps = GPS(rx=34, tx=16, baud=9600, port=1)
while True:
    print(gps.read())
    sleep(0.2)
```

### MPU6050

```python
from zebjus import MPU6050, sleep

imu = MPU6050(21, 22, 0x68, 0)
while True:
    print(imu.read())
    sleep(0.1)
```

### Custom sensor dashboard

```python
from zebjus import dashboard

dashboard("Air Quality", CO2=612, Temperature=28.4, Status="OK")
```

## I²C sharing and conflict rules

OLED, `I2C`, `I2CDevice` and `MPU6050` can share the same I²C controller when they use the same SDA/SCL pair. Example: OLED + MPU6050 can share bus 0 on SDA21/SCL22.

If a later I²C object omits SDA/SCL, it inherits the already-claimed pins for that bus. `InterfaceConflictError` is raised only when the same bus number is explicitly requested with a different SDA/SCL pair.

## Runtime fixes retained

- Pyodide initialization template is syntax-checked; the GPS parser no longer generates a broken string literal.
- `_close_cv_windows` is defined inside the worker initialization before cleanup is used, preventing the previous live-mode `NameError`.
- A top-level `while True:` is transformed into one-time initialization plus repeated live cycles; variables and object state persist.
- Error line positions remain aligned with the student's original source.
- Generic bridge reads use the existing non-blocking cached-response model so Wi-Fi latency does not freeze the editor.

## Connection and hardware safety

- Cached IP primary + physical Kit-ID verification
- mDNS fallback
- 5 consecutive failures before visible disconnect
- silent background reconnect / no Connected↔Connecting blink
- 1-second active-run heartbeat
- 10-second ESP32 failsafe
- active-low relay safe state is preserved
- transaction `WRITE` / `PULSEOUT` outputs are registered for failsafe
- central resource manager covers outputs, I²C, UART, SPI, rotary and counter resources
- GPIO12 is kept out of normal auto-priority because it is a classic ESP32 strapping pin
- counter pins are aligned between editor/runtime/firmware

## Optional per-kit Secure Mode

The default remains **Trusted LAN** so the normal same-Wi-Fi classroom workflow does not change.

Secure Mode can be enabled from **Settings**. The browser generates/stores a per-kit token and sends it as `X-Zebjus-Token`. When Secure Mode is enabled, control, bridge, Wi-Fi and naming APIs require the token. Setup AP/recovery remains accessible so a kit cannot be locked out of Wi-Fi provisioning.

Secure Mode can also be disabled again from Settings using the saved token.

## Firmware

Use:

`esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_2.ino`

Target: classic ESP32 / ESP32-WROOM-32 style DevKit with Arduino-ESP32 3.x.

OLED support requires:

- Adafruit SSD1306
- Adafruit GFX Library
- Adafruit BusIO

The sketch includes explicit forward declarations for `CounterSlot`, `RotarySlot` and other bridge structs so Arduino's automatic prototype generator does not reproduce the earlier `does not name a type` compile error.

## Firmware compile verification helpers

This package includes:

- `tools/compile_esp32_firmware.sh` — one-command Arduino CLI compile helper
- `.github/workflows/esp32-firmware-compile.yml` — GitHub Actions compile check for the ESP32 firmware
- `tools/verify_release.py` — package/static regression verifier

The packaging environment used to build this ZIP did not contain Arduino CLI, so a real ESP32 toolchain compile could not be executed locally here. The included GitHub workflow/local script performs the real compile in an environment where Arduino CLI and the ESP32 core can be installed.

## Examples

The package retains the 38 selectable examples from v6.1, including RGB, camera/AI, OLED, DHT11, ultrasonic, analog/digital inputs, PWM Servo, Motor Driver, I²C scanner/device, GPS/UART, MPU6050, SPI, pulse/frequency, interrupt counter/flow/RPM and hardware transaction projects.
