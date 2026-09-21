# ZEBJUS Python Lab v5.11 — Runtime UI Test

## Test 1 — Clean Terminal

Run repeatedly:

```python
import cv2
import numpy as np

print("Only my print should matter")
```

Expected:
- Student print is visible.
- No repeated:
  - `No new packages to load`
  - `opencv-python already loaded from default channel`
  - `numpy already loaded from default channel`

## Test 2 — Run / End buttons

Start a live program.

Expected:
- Run button becomes faded and disabled.
- End button becomes active/bright.
- Press End.
- Program stops.
- Run becomes bright/enabled again.

## Test 3 — OpenCV floating window

```python
import cv2

img = cv2.imread("uploads/test.jpg")
print("Showing image")
cv2.imshow("Test Window", img)
cv2.waitKey(1)
```

Expected:
- Terminal remains visible.
- OpenCV image appears in floating window.
- If a live program is running and you click X on the floating OpenCV window, the program ends.
- Pressing End closes the OpenCV window/image output.

## Test 4 — destroyAllWindows

```python
import cv2

img = cv2.imread("uploads/test.jpg")
cv2.imshow("Test", img)
cv2.waitKey(1)
cv2.destroyAllWindows()
print("Window closed")
```

Expected:
- Floating window closes.
- Program can continue to print after `destroyAllWindows()`.
