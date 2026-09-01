# ZEBJUS Python Lab v5.5 — Image Upload Test

## Test 1 — Upload + Copy Path

1. Open Image Lab.
2. Click **Upload Images**.
3. Select `cat.jpg`.
4. Confirm the list shows:

```text
uploads/cat.jpg
```

5. Click **Copy Path**.
6. Paste into the editor:

```python
import cv2

img = cv2.imread("uploads/cat.jpg")
print("Image shape:", img.shape)
cv2.imshow("Uploaded Image", img)
cv2.waitKey(1)
```

7. Press **Run**.
8. Output should print the image shape.
9. The processed image should appear under **OpenCV Image**.

## Test 2 — Multiple images

Upload two or more files. Each file should have its own `uploads/...` path.
Click a file row to make it the active preview image.

## Test 3 — Duplicate names

Upload the same filename twice.
Expected paths:

```text
uploads/cat.jpg
uploads/cat_2.jpg
```

## Student workflow

```text
Upload Image → Copy Path → Paste into cv2.imread() → Write code → Run
```
