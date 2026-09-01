# ZEBJUS Python Lab v5.6 — Manual Image Upload

No course image folder is bundled with the website.

## Student workflow

1. Open **Image Lab**.
2. Click **Upload Images**.
3. Select the image supplied by the instructor.
4. Copy the displayed path, for example:

```text
uploads/lena.png
```

5. Paste it into the Python script:

```python
import cv2

img = cv2.imread("uploads/lena.png")
print(img.shape)

cv2.imshow("Image", img)
cv2.waitKey(1)
```

6. Press **Run**.

Every student uploads their own image into their own browser session.
