# v6.2.2 DHT11 Real Hardware Test

1. Flash firmware **2.2.2** from `esp32_firmware/ZEBJUS_Kit_Universal_Hardware_Bridge_WiFi_v2_2.ino`.
2. Keep **Demo mode OFF** and connect the kit.
3. Recommended first test: DHT11 DATA on GPIO13. For a 3-pin module connect `+` to 3.3V, `-` to GND, `S/DATA` to GPIO13. For a raw 4-pin sensor add a 4.7k–10k DATA-to-3.3V pull-up.
4. Run:

```python
from zebjus import DHT11, sleep
dht = DHT11(13)
while True:
    data = dht.read()
    print(f"Temp: {data['temperature']} °C | Humidity: {data['humidity']} % | valid={data['valid']}")
    sleep(1.5)
```

Expected: real values change slowly and the DHT11 card matches the terminal. If wiring/pin is wrong, the card shows `READ ERROR` and a diagnostic instead of demo values.
