# Live Hand RGB Test

```python
from zebjus import RGBLED, sleep
from zebjus_ai import HandDetector

rgb = RGBLED(1)
hand = HandDetector()

while True:
    result = hand.read()
    fingers = result.fingers

    print("Hand:", result.detected, "Fingers:", fingers)

    if not result.detected:
        rgb.off()
    elif fingers == 0:
        rgb.write(255, 255, 255)
    elif fingers == 1:
        rgb.write(255, 0, 0)
    elif fingers == 2:
        rgb.write(0, 255, 0)
    elif fingers == 3:
        rgb.write(0, 0, 255)
    elif fingers == 4:
        rgb.write(255, 255, 0)
    else:
        rgb.write(255, 0, 255)

    sleep(0.10)
```

Press Run once, then change hand gestures. Press Stop to finish.
