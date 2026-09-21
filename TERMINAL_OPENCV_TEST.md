# Terminal + OpenCV Separate Output Test

Upload an image and copy its path.

```python
import cv2

print("Program started")

img = cv2.imread("uploads/test.jpg")
print("Image loaded:", img.shape)

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
print("Gray image ready")

cv2.imshow("Gray Preview", gray)
cv2.waitKey(1)

print("imshow executed")
print("Terminal must remain visible")
```

Expected:

1. Terminal continues showing all `print()` lines.
2. `cv2.imshow()` opens a floating image window.
3. The floating OpenCV window can be dragged, resized, minimized and closed.
4. The bottom OpenCV Image tab is still available, but the app does not force-switch to it.
5. Demo hardware commands do not fill the Terminal with internal send messages.
