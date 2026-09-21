# ZEBJUS Python Lab v5.8.1 — Live Hand Verification

After uploading all files to GitHub Pages, refresh the Wix page.

Use:

```python
from zebjus import RGBLED, sleep
from zebjus_ai import HandDetector

rgb = RGBLED(1)
hand = HandDetector()

while True:
    result = hand.read()
    fingers = result.fingers

    print("Detected:", result.detected, "| Fingers:", fingers)

    if not result.detected:
        rgb.off()
    elif fingers == 1:
        rgb.write(255, 0, 0)
    elif fingers == 2:
        rgb.write(0, 255, 0)
    elif fingers == 3:
        rgb.write(0, 0, 255)
    elif fingers == 4:
        rgb.write(255, 255, 0)
    elif fingers >= 5:
        rgb.write(255, 0, 255)
    else:
        rgb.write(255, 255, 255)

    sleep(0.10)
```

Expected first Terminal lines:

```text
ZEBJUS Python Lab v5.8.1
LIVE MODE started — press Stop to end.
LIVE initial state → ...
```

Then finger results continue until **Stop**.

If you still see:

```text
Student test mode: desktop while True adapted to one browser cycle per Run.
Program finished.
```

the deployed page is still serving old files.
