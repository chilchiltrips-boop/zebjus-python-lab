window.ZEBJUS_CONFIG = {
  pyodideBase: "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/",
  mediaPipe: {
    moduleUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm",
    wasmRoot: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
    modelUrl: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
  },
  cameraCaptureWidth: 320,
  cameraCaptureHeight: 240
};
