# ZEBJUS Python Lab v5.13.1 — Camera Panel imshow Test

Run:

```python
import cv2
from cvzone.FaceDetectionModule import FaceDetector

cap = cv2.VideoCapture(0)
detector = FaceDetector()

while True:
    success, img = cap.read()
    img, faces = detector.findFaces(img)

    print("Faces:", len(faces))

    cv2.imshow("Face Detection", img)
    cv2.waitKey(1)
```

Expected:

1. Camera permission works normally.
2. No floating OpenCV popup appears.
3. The processed face-detection image appears inside **Camera / MediaPipe**.
4. Terminal stays available separately for `Faces: ...`.
5. Press **End**:
   - program stops
   - processed image disappears
   - camera preview/placeholder returns
6. `cv2.destroyAllWindows()` clears the processed image without creating a popup.
