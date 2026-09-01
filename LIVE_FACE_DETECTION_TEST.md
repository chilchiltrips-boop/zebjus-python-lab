# ZEBJUS Python Lab v5.11.1 — Live Face Detection Test

Type/run:

```python
import cv2
from cvzone.FaceDetectionModule import FaceDetector
from SerialModule import SerialObject

cap = cv2.VideoCapture(0)
detector = FaceDetector()
arduino = SerialObject("ZEBJUS")

while True:
    success, img = cap.read()
    img, bboxs = detector.findFaces(img)

    print("Faces:", len(bboxs))

    if bboxs:
        arduino.sendData([255, 0, 0])
        print("Face detected → RED")
    else:
        arduino.sendData([0, 255, 0])
        print("No face → GREEN")

    cv2.imshow("Image", img)
    cv2.waitKey(1)
```

Expected:
- Put a face clearly in camera view.
- `Faces: 1` (or more) should appear.
- Terminal should print `Face detected → RED`.
- Move face out of view.
- `Faces: 0` and `No face → GREEN` should appear.
- OpenCV floating window should show the face bounding box.

For first testing, keep the face roughly within 0.5–2 m of the camera and reasonably well lit.
