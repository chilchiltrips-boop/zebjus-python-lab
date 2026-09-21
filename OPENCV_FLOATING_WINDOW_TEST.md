# ZEBJUS Python Lab v5.9 — OpenCV + Terminal Test

## 1. Upload an image
Use **Upload Images** and copy its path, e.g.

```text
uploads/test.jpg
```

## 2. Run

```python
import cv2

print("Loading image...")

img = cv2.imread("uploads/test.jpg")
print("Shape:", img.shape)

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
print("Converted to grayscale")

cv2.imshow("My OpenCV Window", gray)
cv2.waitKey(1)

print("Image displayed")
```

Expected:
- Terminal stays visible.
- All `print()` messages appear in Terminal.
- OpenCV image appears in a floating window.
- The image window can be dragged, resized, minimized, or closed.

## Live camera / AI
For live hand/vision code, the floating image window and Terminal can be visible at the same time.
