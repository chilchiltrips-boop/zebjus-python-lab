# ZEBJUS Python Lab v6.1 — Universal Hardware Bridge Guide

The ESP32 firmware is now interface-aware instead of sensor-aware. Most future modules can be added with a Python driver without adding a new firmware route for every sensor.

## Generic hardware interfaces

| Interface | Python API | Typical modules |
|---|---|---|
| Digital output | `DigitalOutput`, `Relay` | LEDs, relays, logic control |
| Digital input | `GPIOInput` | switches, PIR, limit sensors, digital alarms |
| ADC | `ADC` | LDR, soil moisture, gas/voltage/current analog outputs |
| PWM | `PWM`, `PWMServo`, `MotorDriver` | LED dimming, servo pulses, DC motor speed |
| I2C | `I2C`, `I2CDevice` | OLED, MPU6050, BME/BMP, INA219, ADS1115, RTC, magnetometer, ToF |
| UART | `UART`, `GPS` | GPS, serial RFID, CO2/fingerprint/serial modules |
| SPI | `SPI` | RC522, SPI displays, ADC/DAC, radio modules with Python drivers |
| Pulse | `PulseInput`, `PulseOutput` | ultrasonic timing, PWM pulse measurement, short pulse generation |
| Interrupt counter | `CounterInput` | flow meters, Hall/RPM, reed switches, frequency-output sensors |
| Transaction | `HardwareTransaction` | custom short GPIO/ADC/pulse timing sequences executed on ESP32 |

The table describes interface compatibility, not a guarantee that every named module already has a ready-made Python driver. Unknown modules can be implemented from their datasheet using the generic interface APIs.

## Shared buses

I2C devices may share the same SDA/SCL pair when their addresses do not conflict. The browser resource allocator treats the shared bus pins as one resource. Two different I2C pin pairs must use different bus numbers.

UART ports are allocated independently. A single UART port cannot be assigned to two different RX/TX pairs at the same time.

SPI devices may share SCK/MISO/MOSI on the same configured bus while using separate CS pins. Devices that require incompatible bus configuration should use another SPI bus or reconfigure deliberately.

## Example — unknown I2C sensor

```python
from zebjus import I2C

i2c = I2C(21, 22, bus=0)
print(i2c.scan())

# Read two bytes from register 0x00 at address 0x40
raw = i2c.read_registers(0x40, 0x00, 2)
print(raw)
```

A project-specific driver can be written directly in `main.py`:

```python
from zebjus import I2C, dashboard, sleep

class MySensor:
    def __init__(self, sda=21, scl=22, address=0x40):
        self.bus = I2C(sda, scl)
        self.address = address

    def read(self):
        data = self.bus.read_registers(self.address, 0x00, 2)
        if len(data) < 2:
            return None
        return (data[0] << 8) | data[1]

sensor = MySensor()

while True:
    value = sensor.read()
    if value is not None:
        print(value)
        dashboard("My Sensor", Value=value)
    sleep(0.2)
```

## Example — GPS over UART

```python
from zebjus import GPS, sleep

gps = GPS(rx=16, tx=17, baud=9600, port=1)

while True:
    data = gps.read()
    print(data["latitude"], data["longitude"], data["satellites"])
    sleep(0.5)
```

## Example — custom SPI transfer

```python
from zebjus import SPI

spi = SPI(sck=18, miso=19, mosi=23, cs=5, bus=1, frequency=1000000)
reply = spi.transfer([0x9F, 0x00, 0x00, 0x00])
print(reply)
```

## Example — custom hardware transaction

`HardwareTransaction` lets a short sequence execute on the ESP32 instead of paying one network round-trip per tiny operation.

```python
from zebjus import HardwareTransaction

t = HardwareTransaction("sample")
result = t.run([
    ("MODE", 4, "OUT"),
    ("WRITE", 4, 1),
    ("DELAYUS", 20),
    ("WRITE", 4, 0),
    ("ADC", 34),
])
print(result)
```

## Example — flow / Hall / RPM counter

```python
from zebjus import CounterInput, plot, sleep

counter = CounterInput(34, edge="rising")

while True:
    count = counter.read()
    hz = counter.frequency()
    print(count, hz)
    plot(Count=count, Frequency=hz)
    sleep(0.25)
```

The pulse count is accumulated on the ESP32 interrupt engine, so short pulses are not dependent on the Python loop timing.

## Dynamic Kit Output / Sensors

Built-in component instances are discovered from Python code and shown as dashboard cards. A custom driver can publish arbitrary numeric/text values with:

```python
dashboard("Air Quality", CO2=612, Temperature=27.4)
```

The Serial Plotter remains generic, so any numeric value can be plotted:

```python
plot(CO2=co2, Temperature=temp)
```

## Resource and safety model

- Safe output pool is tracked by the browser allocator; shared bus pins are counted once.
- Input-only GPIOs are preferred for suitable input devices to preserve output-capable pins.
- Pin conflicts and incompatible bus re-use are reported before running when they can be determined statically.
- Run heartbeat remains 1 second.
- ESP32 output failsafe remains 10 seconds.
- On failsafe, registered outputs are forced safe OFF, bridge bus state is released, and OLED output is cleared.

## Important limit

This architecture removes the need for firmware changes for a large class of GPIO, ADC, PWM, I2C, SPI, UART and pulse-based modules. A future device that requires a hardware peripheral or timing protocol not exposed by the bridge may still require a firmware extension. Ready-made high-level Python drivers can be added without changing the firmware as long as the required low-level interface already exists.
