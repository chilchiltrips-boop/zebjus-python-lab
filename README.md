# ZEBJUS Python Lab v6.0 — Universal Hardware Bridge

v6.0 changes the kit from a fixed list of sensor APIs into a **universal hardware-interface platform**. Existing RGB, LED, OLED, DHT11, Ultrasonic, AnalogInput, Switch, RotaryEncoder, Camera/MediaPipe, OpenCV, Serial Plotter, reconnect/heartbeat and dynamic sensor dashboard features are retained.

## Main architecture

The ESP32 firmware v2.0 exposes reusable low-level interfaces instead of requiring a new firmware route for every sensor:

- Digital GPIO input/output
- ADC1 analog input
- Generic LEDC PWM output
- 2 × I²C buses
- 2 × UART hardware ports
- 2 × SPI buses
- Pulse width input/output and frequency measurement
- Local microsecond GPIO/pulse transaction VM
- Existing OLED / DHT11 / Ultrasonic / Rotary / RGB / LED compatibility APIs

This means future modules can normally be added with a Python driver only.

## Python universal APIs

```python
from zebjus import (
    DigitalOutput, GPIOInput, ADC, PWM,
    I2C, I2CDevice, UART, SPI,
    PulseInput, PulseOutput, HardwareTransaction,
    PWMServo, MotorDriver, GPS, MPU6050,
    dashboard, plot, sleep
)
```

### I²C custom sensor

```python
from zebjus import I2CDevice, dashboard, sleep

sensor = I2CDevice(0x76, 21, 22)

while True:
    data = sensor.read_registers(0xD0, 1)
    chip_id = data[0] if data else 0
    dashboard("My I2C Sensor", Chip_ID=hex(chip_id))
    sleep(0.5)
```

### UART / GPS

```python
from zebjus import GPS, sleep

gps = GPS(rx=34, tx=16, baud=9600, port=1)

while True:
    d = gps.read()
    print(d)
    sleep(0.2)
```

### SPI

```python
from zebjus import SPI

spi = SPI(sck=18, miso=19, mosi=23, cs=4, frequency=1000000, mode=0, bus=1)
rx = spi.transfer([0x00, 0x00])
```

### PWM servo

```python
from zebjus import PWMServo

servo = PWMServo(18)
servo.write(90)
```

### Motor driver

```python
from zebjus import MotorDriver

motor = MotorDriver(16, 17, 18)
motor.forward(60)
```

## Live resource allocator

The editor tracks both pins and hardware buses.

Safe classic ESP32 DevKit pool used by this project:

- Output / PWM: GPIO 4, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33
- Digital input: the above plus GPIO 34, 35, 36, 39; GPIO12 is permitted for selected input/pulse uses
- Wi-Fi-safe ADC1: GPIO 32, 33, 34, 35, 36, 39
- I²C controllers: 2
- UART hardware ports exposed: 1 and 2
- SPI buses exposed: 1 and 2

I²C and SPI shared bus lines are counted once. Example: OLED and MPU6050 can both use SDA21/SCL22 on I²C bus 0 without consuming four pins. Assigning different SDA/SCL pairs to the same I²C bus number produces an editor `InterfaceConflictError`.

## Custom sensor dashboard

Any Python driver can publish values to **Kit Output / Sensors** without adding browser code:

```python
from zebjus import dashboard

dashboard("Air Quality", CO2=612, Temperature=28.4, Status="OK")
```

The card is generated dynamically. The same values can also be graphed with `plot(...)`.

## Timing-sensitive custom modules

`HardwareTransaction` runs GPIO and pulse operations locally on the ESP32, so microsecond delays are not executed over Wi-Fi:

```python
from zebjus import HardwareTransaction

txn = HardwareTransaction("sensor")
result = txn.run([
    ("MODE", 34, "IN"),
    ("PULSEIN", 34, 1, 100000),
])
```

Supported transaction operations in firmware v2.0: `MODE`, `WRITE`, `READ`, `ADC`, `DELAYUS`, `DELAYMS`, `PULSEIN`, `PULSEOUT`.

## Important runtime model

Browser Python is isolated in a Pyodide worker. Generic read calls use a non-blocking cached-response model: the Python call requests the next ESP32 read and returns the most recent value. In `while True` live projects, the next browser cycle receives the new result. This avoids freezing the editor/UI because of Wi-Fi latency. Existing dedicated DHT11/Ultrasonic/Analog/Digital APIs continue using their optimized polling path.

## Connection safety retained

- Cached IP primary
- Physical Kit ID verification
- mDNS fallback
- 5 consecutive failures before UI becomes disconnected
- Silent background reconnect
- No Connecting ↔ Connected blink during temporary misses
- 1-second browser heartbeat while a hardware run is active
- 10-second ESP32 failsafe
- Registered PWM/digital/RGB outputs safe OFF on heartbeat timeout
- Bridge UART/SPI/I²C run resources released as applicable
- OLED cleared on heartbeat timeout

## Firmware

Use:

`esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_0.ino`

Required Arduino libraries for the retained OLED API:

- Adafruit SSD1306
- Adafruit GFX Library
- Adafruit BusIO

Target: classic ESP32 / ESP32-WROOM-32 style DevKit with Arduino-ESP32 3.x.

## Examples

v6.0 contains 38 selectable examples, including legacy projects plus Universal Digital Output, ADC plotting, PWM Servo, Motor Driver, I²C scanner, custom I²C register device, GPS/UART, MPU6050, SPI, pulse/frequency, interrupt counter/flow/RPM and custom timing transaction projects.
