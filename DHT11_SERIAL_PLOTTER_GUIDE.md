# DHT11 + Serial Plotter Guide — v5.26

## Wiring

Recommended DHT11 module wiring:

- VCC → ESP32 3.3V
- GND → GND
- DATA → GPIO13

If using a bare DHT11 sensor, add a typical 4.7k–10k pull-up from DATA to 3.3V. Many 3-pin DHT11 modules already include a pull-up.

## Basic API

```python
from zebjus import DHT11

dht = DHT11(13)
print(dht.temperature())
print(dht.humidity())
```

`dht.read()` returns a dictionary with temperature, humidity, valid status and pin.

For older ZEBJUS-style projects:

```python
vals = dht.get_values()
humidity = vals[0] / 10.0
temperature = vals[1] / 10.0
```

## Serial Plotter

Use named values:

```python
from zebjus import plot
plot(Temperature=28.5, Humidity=63.0)
```

Or use the helper object:

```python
from zebjus import SerialPlotter
p = SerialPlotter()
p.plot(Sensor1=10, Sensor2=20)
```

The plotter is intentionally generic. Future sensors can use the same API without changing the graph UI.

## UI order

The Lab is arranged as Editor → Kit Output/Sensors → Camera → Terminal → OpenCV Output → Serial Plotter → Image Upload.
