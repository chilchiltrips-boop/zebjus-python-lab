(function(){
  const $=id=>document.getElementById(id),cfg=window.ZEBJUS_CONFIG||{};
  const video=$("cameraVideo"),overlay=$("cameraOverlay"),terminal=$("terminal");
  let editor=null,worker=null,ws=null,running=false,cameraRunning=false,currentCameraIndex=null,cameras=[];
  let aiState={detected:false,fingers:0,side:"",faces:[],landmarks:[]};
  let imageFrame=null,uploadedImages=[],activeUploadPath="";

  const isEmbedded=(()=>{try{return window.self!==window.top;}catch(e){return true;}})();
  const bridgeChannelName="zebjus-camera-"+Math.random().toString(36).slice(2);
  const bridgeChannel=("BroadcastChannel" in window)?new BroadcastChannel(bridgeChannelName):null;
  let bridgeWindow=null,bridgeWaiters=new Map();
  let sensorState={ultrasonicCm:45,potValue:128,potRaw:2056};

  const defaults={
    autoCamera:true,demoMode:true,kitId:"ZB-000123",wsUrl:"",
    cameraIndex:0,fontSize:14,autoSave:true,stdin:"",
    demoUltrasonic:45,demoPot:128
  };
  function getSettings(){let s={};try{s=JSON.parse(localStorage.getItem("zebjus.lab.settings")||"{}");}catch(e){}return {...defaults,...s};}
  let prefs=getSettings();
  sensorState.ultrasonicCm=Number(prefs.demoUltrasonic)||45;
  sensorState.potValue=Math.max(0,Math.min(255,Number(prefs.demoPot)||0));
  sensorState.potRaw=Math.round(sensorState.potValue*4095/255);

  const examples={
    hello:`print("Hello, ZEBJUS!")`,
    variables:`name = "Anna"\nage = 14\nscore = 92.5\n\nprint(name)\nprint(age)\nprint(score)`,
    input:`name = input("Enter your name: ")\nage = int(input("Enter your age: "))\n\nprint("Hello", name)\nprint("Next year you will be", age + 1)`,
    ifelse:`mark = 78\n\nif mark >= 80:\n    print("Excellent")\nelif mark >= 50:\n    print("Pass")\nelse:\n    print("Try again")`,
    forloop:`for i in range(1, 6):\n    print("Count:", i)`,
    whileloop:`count = 1\n\nwhile count <= 5:\n    print("Count:", count)\n    count += 1`,
    function:`def add(a, b):\n    return a + b\n\nprint("Answer =", add(10, 20))`,
    list:`fruits = ["apple", "orange", "mango"]\n\nfor fruit in fruits:\n    print(fruit)`,


    visionBlank:`# VISION AI Z — Student Project
# Type your program below.

`,
    visionOpenCvImage:`# VISION AI Z — OpenCV Image Test
import cv2

img = cv2.imread("Resources/lena.png")
print("Image shape:", img.shape)
cv2.imshow("Lena", img)
cv2.waitKey(1)`,
    visionOpenCvCamera:`# VISION AI Z — OpenCV Webcam Test
import cv2

cap = cv2.VideoCapture(0)
cap.set(3, 640)
cap.set(4, 480)

while True:
    success, img = cap.read()
    print("Camera frame:", success)
    cv2.imshow("Result", img)
    cv2.waitKey(1)`,
    visionLedSerial:`# VISION AI Z — RGB LED / SerialModule compatibility
from SerialModule import SerialObject
from time import sleep

arduino = SerialObject("ZEBJUS")
arduino.sendData([255, 0, 0])
sleep(0.3)
arduino.sendData([0, 255, 0])
sleep(0.3)
arduino.sendData([0, 0, 255])
print("RGB test complete")`,
    visionPotSerial:`# VISION AI Z — Potentiometer / SerialModule compatibility
from SerialModule import SerialObject

arduino = SerialObject("ZEBJUS")

while True:
    myData = arduino.getData()
    print("Potentiometer:", myData[0])`,
    visionPotGraphic:`# VISION AI Z — Potentiometer Graphics
from cvzone.SerialModule import SerialObject
import cv2
import numpy as np

arduino = SerialObject("ZEBJUS")

while True:
    myData = arduino.getData()
    val = int(myData[0])
    img = cv2.imread("../Resources/Potentiometer.jpg")

    cv2.putText(img, str(val).zfill(4), (260, 280),
                cv2.FONT_HERSHEY_PLAIN, 3, (255, 255, 255), 3)
    angle = np.interp(val, [0, 1023], [-90, 270])
    cv2.ellipse(img, (320, 265), (131, 131), 0, -90, angle,
                (255, 180, 0), 27)
    cv2.imshow("Potentiometer", img)
    cv2.waitKey(1)`,
    visionFaceBasic:`# VISION AI Z — Project: Face Detection Basics
import cv2
from cvzone.FaceDetectionModule import FaceDetector

cap = cv2.VideoCapture(0)
detector = FaceDetector()

while True:
    success, img = cap.read()
    img, bboxs = detector.findFaces(img)
    print("Faces:", len(bboxs))
    cv2.imshow("Image", img)
    cv2.waitKey(1)`,
    visionFaceLed:`# VISION AI Z — Project: Face Detection → LED
import cv2
from cvzone.FaceDetectionModule import FaceDetector
from SerialModule import SerialObject

cap = cv2.VideoCapture(0)
detector = FaceDetector()
arduino = SerialObject("ZEBJUS")

while True:
    success, img = cap.read()
    img, bboxs = detector.findFaces(img)

    if bboxs:
        arduino.sendData([100, 100, 100])
        print("Face detected → LED ON")
    else:
        arduino.sendData([0, 0, 0])
        print("No face → LED OFF")

    cv2.imshow("Image", img)
    cv2.waitKey(1)`,
    visionFaceRgb:`# VISION AI Z — Project: Face Detection → RGB
import cv2
from cvzone.FaceDetectionModule import FaceDetector
from SerialModule import SerialObject

cap = cv2.VideoCapture(0)
detector = FaceDetector()
arduino = SerialObject("ZEBJUS")

while True:
    success, img = cap.read()
    img, bboxs = detector.findFaces(img)

    if bboxs:
        arduino.sendData([255, 0, 0])
        print("Face detected → RED")
    else:
        arduino.sendData([0, 255, 0])
        print("No face → GREEN")

    cv2.imshow("Image", img)
    cv2.waitKey(1)`,
    visionGripperSerial:`# VISION AI Z — Project: Hand Gripper (Serial style)
import cv2
import numpy as np
import HandTrackingModule as htm
import math
from SerialModule import SerialObject

arduino = SerialObject("ZEBJUS")
cap = cv2.VideoCapture(0)
detector = htm.handDetector(detectionCon=0.7)
per = 0

while True:
    success, img = cap.read()
    img = detector.findHands(img, draw=False)
    lmList, bbox = detector.findPosition(img, draw=False)

    if len(lmList) != 0:
        x1, y1 = lmList[4][1], lmList[4][2]
        x2, y2 = lmList[8][1], lmList[8][2]
        length = math.hypot(x2 - x1, y2 - y1)
        per = int(np.interp(length, (15, 170), (0, 90)))
        arduino.sendData([0, 0, 255, per])
        print("Gripper angle:", per)

    cv2.imshow("Gripper", img)
    cv2.waitKey(1)`,
    visionGripperWifi:`# VISION AI Z — Project: Hand Gripper (Wi-Fi style)
import cv2
import numpy as np
import HandTrackingModule as htm
import math
from zebjus_wifi import WifiBridge

b = WifiBridge()
b.start()
b.set_format(digits=3, count=1)
cap = cv2.VideoCapture(0)
detector = htm.handDetector(detectionCon=0.7)

while True:
    success, img = cap.read()
    img = detector.findHands(img, draw=False)
    lmList, bbox = detector.findPosition(img, draw=False)

    if len(lmList) != 0:
        x1, y1 = lmList[4][1], lmList[4][2]
        x2, y2 = lmList[8][1], lmList[8][2]
        length = math.hypot(x2 - x1, y2 - y1)
        per = int(np.interp(length, (15, 170), (0, 90)))
        b.send_values([per])
        print("Wi-Fi gripper angle:", per)

    cv2.imshow("Gripper", img)
    cv2.waitKey(1)`,

    hand:`from zebjus_ai import HandDetector\n\nresult = HandDetector().read()\nprint("Detected:", result.detected)\nprint("Fingers:", result.fingers)\nprint("Side:", result.side)`,
    handRgb:`from zebjus import RGBLED\nfrom zebjus_ai import HandDetector\n\nrgb = RGBLED(1)\nresult = HandDetector().read()\n\nprint("Hand detected:", result.detected)\nprint("Fingers:", result.fingers)\nprint("Side:", result.side)\n\n# Open palm can briefly read 4 or 5, so >= 4 is more stable.\nif result.detected and result.fingers >= 4:\n    rgb.write(0, 255, 0)\n    print("RGB LED GREEN")\nelse:\n    rgb.off()\n    print("RGB LED OFF")`,

    faceCvzone:`from zebjus_cv import Camera, show\nfrom cvzone.FaceDetectionModule import FaceDetector\nimport cv2\nimport cvzone\nimport mediapipe as mp\n\nimg = Camera(0).read()\ndetector = FaceDetector(minDetectionCon=0.5)\nimg, bboxs = detector.findFaces(img, draw=False)\n\nprint("Faces:", len(bboxs))\nfor face in bboxs:\n    x, y, w, h = face["bbox"]\n    score = face["score"]\n    center = face["center"]\n    cv2.circle(img, center, 5, (255, 0, 255), cv2.FILLED)\n    cvzone.putTextRect(img, f"{score}%", (x, max(25, y - 10)))\n    cvzone.cornerRect(img, (x, y, w, h))\n\nshow(img, "MediaPipe + CVZone Face Detection")`,

    cvGray:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\nshow(gray, "Grayscale")`,
    cvEdges:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\nedges = cv2.Canny(gray, 80, 160)\nshow(edges, "Canny Edges")`,
    cvBlur:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\nblurred = cv2.GaussianBlur(frame, (15, 15), 0)\nshow(blurred, "Gaussian Blur")`,
    cvThreshold:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\n_, binary = cv2.threshold(gray, 120, 255, cv2.THRESH_BINARY)\nshow(binary, "Threshold")`,

    imgRgb:`from zebjus_cv import load_image, draw_rgb_led, show\n\nimg = load_image()\ndraw_rgb_led(img, 90, 90, 255, 0, 0, 30)\ndraw_rgb_led(img, 170, 90, 0, 255, 0, 30)\ndraw_rgb_led(img, 250, 90, 0, 0, 255, 30)\nshow(img, "RGB LED Graphics")`,
    imgPot:`from zebjus import Potentiometer\nfrom zebjus_cv import load_image, draw_potentiometer, show\n\npot = Potentiometer(1)\nimg = load_image()\ndraw_potentiometer(img, 120, 120, pot.read(), 42)\nshow(img, "Potentiometer Graphic")`,
    imgDashboard:`from zebjus import Potentiometer, Ultrasonic\nfrom zebjus_cv import load_image, draw_rgb_led, draw_potentiometer, draw_ultrasonic, show\n\nimg = load_image()\npot = Potentiometer(1).read()\ndistance = Ultrasonic(1).read()\n\ndraw_rgb_led(img, 80, 80, 0, 255, 0, 28)\ndraw_potentiometer(img, 180, 80, pot, 34)\ndraw_ultrasonic(img, 260, 65, distance, 400, 180, 20)\nshow(img, "ZEBJUS Kit Dashboard")`,

    rgb:`from zebjus import RGBLED, sleep\n\nrgb = RGBLED(1)\n\nrgb.write(255, 0, 0)   # Red\nsleep(1)\nrgb.write(0, 255, 0)   # Green\nsleep(1)\nrgb.write(0, 0, 255)   # Blue\nsleep(1)\nrgb.write(255, 120, 0) # Orange\nsleep(1)\nrgb.off()`,
    sensors:`from zebjus import Ultrasonic, Potentiometer\n\nultra = Ultrasonic(1)\npot = Potentiometer(1)\n\nprint("Distance:", ultra.read(), "cm")\nprint("Pot value:", pot.read(), "/ 255")\nprint("Pot raw:", pot.raw())`,
    servo:`from zebjus import Servo, sleep\n\nservo = Servo(1)\nfor angle in [0, 45, 90, 135, 180, 90]:\n    servo.write(angle)\n    sleep(0.5)`,
    motor:`from zebjus import Motor, sleep\n\nmotor = Motor(1)\nmotor.forward(50)\nsleep(2)\nmotor.stop()\nprint("Motor stopped")`
  };

  const libraries=[
    ["cv2","module","OpenCV"],["mediapipe","module","MediaPipe compatibility"],["cvzone","module","CVZone compatibility"],["numpy","module","NumPy"],["math","module","Math"],["random","module","Random"],
    ["zebjus","module","ZEBJUS hardware"],["zebjus_ai","module","MediaPipe AI"],["zebjus_cv","module","Camera/Image OpenCV bridge"],
    ["SerialModule","module","VISION AI serial compatibility"],["HandTrackingModule","module","VISION AI hand tracking compatibility"],["zebjus_wifi","module","ZEBJUS Wi-Fi compatibility"]
  ];
  const base=[
    ["and","keyword"],["as","keyword"],["break","keyword"],["class","keyword"],["continue","keyword"],["def","keyword"],["elif","keyword"],["else","keyword"],["except","keyword"],["False","keyword"],["for","keyword"],["from","keyword"],["if","keyword"],["import","keyword"],["in","keyword"],["None","keyword"],["not","keyword"],["or","keyword"],["pass","keyword"],["return","keyword"],["True","keyword"],["try","keyword"],["while","keyword"],["with","keyword"],
    ["print()","function","print()","Output"],["input()","function","input()","Program input"],["range()","function","range()","Range"],["len()","function","len()","Length"],["int()","function","int()","Integer"],["float()","function","float()","Float"],["str()","function","str()","String"],
    ["RGBLED()","class","RGBLED()","RGB LED 0–255"],["LED()","class","LED()","White compatibility LED"],["Ultrasonic()","class","Ultrasonic()","Distance cm"],["Potentiometer()","class","Potentiometer()","0–255 pot"],["Motor()","class","Motor()","Motor"],["Servo()","class","Servo()","Servo"],["Camera()","class","Camera()","Camera"],["HandDetector()","class","HandDetector()","MediaPipe Hand"],["FaceDetector()","class","FaceDetector()","MediaPipe Face"],["sleep()","function","sleep()","Delay"],["load_image()","function","load_image()","Loaded image"],["show()","function","show()","Show image"],["draw_rgb_led()","function","draw_rgb_led()","Draw RGB LED"],["draw_potentiometer()","function","draw_potentiometer()","Draw pot"],["draw_ultrasonic()","function","draw_ultrasonic()","Draw distance bar"],
    ["cv2","module","cv2","OpenCV"],["mp","module","mp","MediaPipe"],["cvzone","module","cvzone","CVZone"],["np","module","np","NumPy"],
    ["SerialObject()","class","SerialObject()","VISION AI serial bridge"],["handDetector()","class","handDetector()","VISION AI hand tracker"],["WifiBridge()","class","WifiBridge()","ZEBJUS Wi-Fi bridge"]
  ];

  const moduleMembers={
    zebjus:[
      ["RGBLED","class","RGBLED","RGB LED"],["LED","class","LED","LED"],["Ultrasonic","class","Ultrasonic","Ultrasonic"],
      ["Potentiometer","class","Potentiometer","Potentiometer"],["Motor","class","Motor","Motor"],["Servo","class","Servo","Servo"],["sleep","function","sleep","Delay"]
    ],
    zebjus_ai:[["HandDetector","class","HandDetector","Hand detector"],["HandResult","class","HandResult","Hand result"],["FaceDetector","class","FaceDetector","Face detector"],["FaceResult","class","FaceResult","Face result"]],
    cvzone:[["putTextRect","function","putTextRect","Text box"],["cornerRect","function","cornerRect","Corner rectangle"],["FaceDetectionModule","module","FaceDetectionModule","Face detector module"]],
    mediapipe:[["solutions","module","solutions","MediaPipe solutions compatibility"]],
    zebjus_cv:[
      ["Camera","class","Camera","Camera"],["load_image","function","load_image","Loaded image"],["show","function","show","Show image"],
      ["draw_rgb_led","function","draw_rgb_led","Draw LED"],["draw_potentiometer","function","draw_potentiometer","Draw pot"],["draw_ultrasonic","function","draw_ultrasonic","Draw ultrasonic"]
    ],
    SerialModule:[["SerialObject","class","SerialObject","VISION AI serial bridge"]],
    HandTrackingModule:[["handDetector","class","handDetector","VISION AI hand tracker"]],
    zebjus_wifi:[["WifiBridge","class","WifiBridge","ZEBJUS Wi-Fi bridge"]]
    };

  const members={
    cv2:[["cvtColor()","function","cvtColor()","Color conversion"],["Canny()","function","Canny()","Edges"],["threshold()","function","threshold()","Threshold"],["resize()","function","resize()","Resize"],["GaussianBlur()","function","GaussianBlur()","Blur"],["rectangle()","function","rectangle()","Rectangle"],["circle()","function","circle()","Circle"],["putText()","function","putText()","Text"],["COLOR_BGR2GRAY","constant","COLOR_BGR2GRAY","Gray"],["THRESH_BINARY","constant","THRESH_BINARY","Binary"]],
    RGBLED:[["write()","method","write()","write(r,g,b) 0–255"],["set()","method","set()","set(r,g,b)"],["red()","method","red()","Red"],["green()","method","green()","Green"],["blue()","method","blue()","Blue"],["white()","method","white()","White"],["off()","method","off()","Off"]],
    LED:[["on()","method","on()","On"],["off()","method","off()","Off"],["blink()","method","blink()","Blink"]],
    Ultrasonic:[["read()","method","read()","Distance cm"],["distance_cm","property","distance_cm","Distance cm"]],
    Potentiometer:[["read()","method","read()","0–255"],["raw()","method","raw()","Raw ADC"],["value","property","value","0–255"]],
    Motor:[["forward()","method","forward()","Forward"],["backward()","method","backward()","Backward"],["stop()","method","stop()","Stop"]],
    Servo:[["write()","method","write()","Angle"]],
    HandDetector:[["read()","method","read()","Stable hand snapshot"]],
    HandResult:[["detected","property","detected","Detected"],["fingers","property","fingers","0–5"],["side","property","side","Side"]],
    Camera:[["read()","method","read()","Camera frame"]],
    FaceDetector:[["read()","method","read()","Face snapshot"],["findFaces()","method","findFaces()","Detect faces"]],
    FaceResult:[["detected","property","detected","Detected"],["count","property","count","Face count"],["faces","property","faces","Faces"]],
    SerialObject:[["getData()","method","getData()","Read input data"],["sendData()","method","sendData()","Send kit data"]],
    handDetector:[["findHands()","method","findHands()","Find hand landmarks"],["findPosition()","method","findPosition()","Get landmark coordinates"]],
    WifiBridge:[["start()","method","start()","Start bridge"],["set_format()","method","set_format()","Set value format"],["send_values()","method","send_values()","Send values"]]
  };

  function inferType(code,name){
    const esc=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    for(const type of ["RGBLED","LED","Ultrasonic","Potentiometer","Motor","Servo","Camera","HandDetector","FaceDetector","SerialObject","handDetector","WifiBridge"]){
      if(new RegExp("\\b"+esc+"\\s*=\\s*"+type+"\\s*\\(").test(code))return type;
    }
    if(new RegExp("\\b"+esc+"\\s*=\\s*(?:HandDetector\\s*\\(\\s*\\)|\\w+)\\.read\\s*\\(").test(code))return "HandResult";
    if(name==="rgb")return "RGBLED";if(name==="led")return "LED";if(name==="ultra")return "Ultrasonic";if(name==="pot")return "Potentiometer";
    if(name==="motor")return "Motor";if(name==="servo")return "Servo";if(name==="cam")return "Camera";if(name==="hand")return "HandDetector";if(name==="result")return "HandResult";
    if(name==="cv2")return "cv2";
    return null;
  }

  function hintItem(e){const [label,type,text,info]=e;return{text:text||label,displayText:label+(info?"   — "+info:""),className:"hint-"+type};}
  function filterItems(items,prefix){return items.filter(x=>x[0].replace(/\(\)$/,"").startsWith(prefix)).map(hintItem);}

  function hintProvider(cm){
    const cur=cm.getCursor(),line=cm.getLine(cur.line).slice(0,cur.ch),full=cm.getValue();
    let m,prefix="",items=[];

    m=line.match(/^\s*(?:import|from)\s+([A-Za-z_]\w*)?$/);
    if(m){prefix=m[1]||"";return{list:filterItems(libraries,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};}

    m=line.match(/^\s*from\s+(zebjus|zebjus_ai|zebjus_cv|cvzone|mediapipe|SerialModule|HandTrackingModule|zebjus_wifi)\s+import\s+([A-Za-z_]\w*)?$/);
    if(m){prefix=m[2]||"";return{list:filterItems(moduleMembers[m[1]]||[],prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};}

    m=line.match(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/);
    if(m){
      prefix=m[2]||"";items=members[inferType(full,m[1])]||[];
      return{list:filterItems(items,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};
    }

    m=line.match(/([A-Za-z_]\w*)$/);prefix=m?.[1]||"";
    return{list:filterItems(base,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};
  }

  function initEditor(){
    if(typeof CodeMirror==="undefined"){$("editorLoadError").hidden=false;return;}
    CodeMirror.registerHelper("hint","zebjusPython",hintProvider);
    $("codeEditor").value=(prefs.autoSave?localStorage.getItem("zebjus.lab.code"):null)||examples.hello;
    editor=CodeMirror.fromTextArea($("codeEditor"),{
      mode:"python",theme:"zebjus",lineNumbers:true,indentUnit:4,tabSize:4,indentWithTabs:false,
      matchBrackets:true,autoCloseBrackets:true,styleActiveLine:true,
      extraKeys:{
        "Ctrl-Space":cm=>cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false}),
        "Cmd-Space":cm=>cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false}),
        "Tab":cm=>cm.replaceSelection("    ","end","+input")
      }
    });
    editor.getWrapperElement().style.fontSize=(prefs.fontSize||14)+"px";
    editor.on("change",(cm,ch)=>{
      if(prefs.autoSave){clearTimeout(window.__save);$("saveState").textContent="Saving…";window.__save=setTimeout(()=>{localStorage.setItem("zebjus.lab.code",cm.getValue());$("saveState").textContent="Saved";},220);}
      if((ch.origin==="+input"||ch.origin==="paste")&&!cm.state.completionActive){
        const typed=(ch.text||[]).join("\n"),cur=cm.getCursor(),left=cm.getLine(cur.line).slice(0,cur.ch);
        if(/[A-Za-z0-9_.]$/.test(typed)||/\b(?:import|from)\s+$/.test(left))setTimeout(()=>cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false}),0);
      }
    });
  }

  function getCode(){return editor?editor.getValue():$("codeEditor").value;}
  function setCode(t){if(editor){editor.setValue(t);editor.focus();}}
  function log(t){terminal.textContent+=(terminal.textContent?"\n":"")+String(t);terminal.scrollTop=terminal.scrollHeight;}
  function badge(el,t,m=""){el.textContent=t;el.className="badge"+(m?" "+m:"");}

  function createWorker(){
    if(worker)worker.terminate();
    worker=new Worker("./py-worker.js",{type:"module"});
    badge($("pythonStatus"),"Python loading…","warn");
    worker.onmessage=e=>{
      const m=e.data||{};
      if(m.type==="ready"){badge($("pythonStatus"),"Python ready","ok");log("Python ready.");}
      else if(m.type==="status")badge($("pythonStatus"),m.text,m.mode||"warn");
      else if(m.type==="stdout"&&m.text!=="")log(m.text);
      else if(m.type==="stderr"&&m.text!=="")log("ERROR: "+m.text);
      else if(m.type==="error"){running=false;log("ERROR: "+m.text);badge($("pythonStatus"),"Python ready","ok");}
      else if(m.type==="done"){running=false;log("Program finished.");badge($("pythonStatus"),"Python ready","ok");}
      else if(m.type==="kit-command")handleKit(m.payload);
      else if(m.type==="image")showImage(m.dataUrl);
    };
    worker.onerror=e=>{running=false;log("Worker error: "+e.message);badge($("pythonStatus"),"Python error");};
  }

  function setupCameraBridge(){
    if(!bridgeChannel)return;
    bridgeChannel.onmessage=e=>{
      const m=e.data||{};
      if(m.type==="camera-snapshot"&&m.requestId&&bridgeWaiters.has(m.requestId)){
        const waiter=bridgeWaiters.get(m.requestId);
        bridgeWaiters.delete(m.requestId);
        waiter.resolve(m);
      }else if(m.type==="bridge-error"){
        log("Camera Bridge error: "+(m.message||"Unknown error"));
      }
    };
    if(isEmbedded&&$("embedCameraNotice"))$("embedCameraNotice").hidden=false;
  }

  function openCameraBridge(cameraIndex=0){
    if(!bridgeChannel)throw new Error("This browser does not support BroadcastChannel.");
    if(bridgeWindow&&!bridgeWindow.closed){
      try{bridgeWindow.focus();}catch(e){}
      return bridgeWindow;
    }
    const url=`./camera-bridge.html?channel=${encodeURIComponent(bridgeChannelName)}&camera=${encodeURIComponent(cameraIndex)}`;
    bridgeWindow=window.open(url,"zebjusCameraBridge","width=520,height=690,resizable=yes,scrollbars=yes");
    if(!bridgeWindow)throw new Error("Camera popup was blocked. Allow popups for this site and Run again.");
    return bridgeWindow;
  }

  function requestBridgeSnapshot(cameraIndex=0,timeoutMs=30000,needsFace=false){
    return new Promise((resolve,reject)=>{
      if(!bridgeChannel){reject(new Error("BroadcastChannel unavailable."));return;}
      const requestId="req-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      const timer=setTimeout(()=>{
        if(bridgeWaiters.has(requestId))bridgeWaiters.delete(requestId);
        reject(new Error("Camera Bridge timed out. Allow camera permission in the Camera Bridge window."));
      },timeoutMs);

      bridgeWaiters.set(requestId,{
        resolve:m=>{clearTimeout(timer);resolve(m);},
        reject:e=>{clearTimeout(timer);reject(e);}
      });

      // Give a newly opened bridge a short moment to subscribe.
      setTimeout(()=>{
        bridgeChannel.postMessage({type:"request-snapshot",requestId,cameraIndex,needsFace});
      },500);
    });
  }

  async function enumerateCameras(){
    try{
      const ds=await navigator.mediaDevices?.enumerateDevices?.()||[];
      cameras=ds.filter(d=>d.kind==="videoinput");
      $("cameraIndexText").textContent="Camera "+(currentCameraIndex ?? (Number(prefs.cameraIndex)||0));
    }catch(e){}
  }

  function requestedCamera(src){const m=src.match(/\bCamera\s*\(\s*(\d+)\s*\)/);return m?Number(m[1]):null;}

  async function startCamera(index=null){
    const i=index!==null?index:Number(prefs.cameraIndex)||0,deviceId=cameras[i]?.deviceId||"";
    try{
      badge($("aiStatus"),"Camera starting…","warn");
      await ZebjusAI.start(video,overlay,deviceId);
      cameraRunning=true;currentCameraIndex=i;$("cameraPlaceholder").style.display="none";$("cameraToggleBtn").textContent="Stop";$("cameraIndexText").textContent="Camera "+i;
      badge($("aiStatus"),"Camera + AI","ok");await enumerateCameras();return true;
    }catch(e){cameraRunning=false;badge($("aiStatus"),"Camera error");log("Camera error: "+(e?.message||e));return false;}
  }
  function stopCamera(){ZebjusAI?.stop(video,overlay);cameraRunning=false;currentCameraIndex=null;$("cameraPlaceholder").style.display="grid";$("cameraToggleBtn").textContent="Start";badge($("aiStatus"),"Camera off");}

  function captureFrame(){
    if(!cameraRunning||video.readyState<2)return null;
    const c=document.createElement("canvas"),w=cfg.cameraCaptureWidth||320,h=cfg.cameraCaptureHeight||240;c.width=w;c.height=h;
    const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(video,0,0,w,h);
    return{width:w,height:h,data:Array.from(x.getImageData(0,0,w,h).data)};
  }

  function safeUploadName(name){
    const clean=String(name||"image").replace(/[\\/:*?"<>|]/g,"_").trim()||"image";
    const dot=clean.lastIndexOf("."),base=dot>0?clean.slice(0,dot):clean,ext=dot>0?clean.slice(dot):"";
    let candidate=clean,n=2;
    const used=new Set(uploadedImages.map(x=>x.name.toLowerCase()));
    while(used.has(candidate.toLowerCase()))candidate=`${base}_${n++}${ext}`;
    return candidate;
  }

  async function copyText(text){
    try{await navigator.clipboard.writeText(text);return true;}
    catch(_){
      try{
        const t=document.createElement("textarea");t.value=text;t.style.position="fixed";t.style.opacity="0";
        document.body.appendChild(t);t.focus();t.select();const ok=document.execCommand("copy");t.remove();return ok;
      }catch(e){return false;}
    }
  }

  function setActiveUpload(item){
    if(!item)return;
    activeUploadPath=item.path;imageFrame=item.frame;
    $("sourceImagePreview").src=item.dataUrl;$("sourceImagePreview").style.display="block";$("sourceImagePlaceholder").style.display="none";
    $("sourceImageInfo").textContent=`${item.name} • ${item.width}×${item.height} • ${item.path}`;
    renderUploadedFiles();
  }

  function renderUploadedFiles(){
    const box=$("uploadedFileList");
    if(!uploadedImages.length){box.innerHTML='<div class="uploaded-empty">Uploaded image paths will appear here.</div>';return;}
    box.innerHTML=uploadedImages.map((item,i)=>`
      <div class="uploaded-file-row ${item.path===activeUploadPath?"active":""}" data-upload-index="${i}">
        <div class="uploaded-file-main" title="Click to preview this image">
          <div class="uploaded-file-name">${escapeHtml(item.name)}</div>
          <div class="uploaded-file-path">${escapeHtml(item.path)}</div>
        </div>
        <button class="copy-path-btn" data-copy-path="${escapeHtml(item.path)}" type="button">Copy Path</button>
      </div>`).join("");
  }

  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

  async function loadImageFiles(files){
    const list=Array.from(files||[]).filter(f=>f&&String(f.type||"").startsWith("image/")).slice(0,10);
    if(!list.length)return;
    for(const file of list){
      if(file.size>5*1024*1024){log(`Skipped ${file.name}: maximum image size is 5 MB.`);continue;}
      const name=safeUploadName(file.name),path=`uploads/${name}`;
      const buffer=await file.arrayBuffer(),bytes=Array.from(new Uint8Array(buffer));
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
      const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=dataUrl;});
      const maxW=720,maxH=520,scale=Math.min(1,maxW/img.width,maxH/img.height),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
      const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(img,0,0,w,h);
      const frame={width:w,height:h,data:Array.from(x.getImageData(0,0,w,h).data)};
      const item={name,path,data:bytes,dataUrl,width:w,height:h,frame};
      uploadedImages.push(item);setActiveUpload(item);
      log(`Image uploaded: ${path}`);
    }
    $("imageInput").value="";
    renderUploadedFiles();
  }

  function clearLoadedImage(){
    imageFrame=null;uploadedImages=[];activeUploadPath="";$("imageInput").value="";
    $("sourceImagePreview").removeAttribute("src");$("sourceImagePreview").style.display="none";$("sourceImagePlaceholder").style.display="block";
    $("sourceImageInfo").textContent="Upload an image, copy its path, then use cv2.imread().";
    renderUploadedFiles();
  }

  async function runCode(){
    if(running){log("Program already running. Press Stop first.");return;}

    const src=getCode();
    const needsHand=/\bzebjus_ai\b|\bHandDetector\b|\bHandTrackingModule\b|\bhandDetector\s*\(/.test(src);
    const needsFace=/\bFaceDetector\b|\bFaceDetectionModule\b|\bface_detection\b|\bmp\.solutions\.face_detection\b/.test(src);
    const needsCamera=needsHand||needsFace||/\bCamera\s*\(|\bcv2\.VideoCapture\s*\(/.test(src);
    const idx=requestedCamera(src);
    const requestedIdx=idx!==null?idx:(Number(prefs.cameraIndex)||0);

    terminal.textContent="";
    running=true;

    let runFrame=null;
    let directCameraOk=false;

    // First try camera INSIDE the Wix page.
    if(needsCamera && prefs.autoCamera){
      if(!cameraRunning || requestedIdx!==currentCameraIndex){
        if(cameraRunning)stopCamera();
        directCameraOk=await startCamera(requestedIdx);
      }else{
        directCameraOk=true;
      }
    }else if(cameraRunning){
      directCameraOk=true;
    }

    if(needsCamera && directCameraOk){
      let snap=ZebjusAI?.getSnapshot?.()||aiState;
      if(needsFace){snap=await ZebjusAI.waitForFaces(1500);log(`Face snapshot → faces=${Number(snap.faceCount)||0}`);}
      if(needsHand){snap=await ZebjusAI.waitForStable(1500);log(`Hand snapshot → detected=${!!snap.detected}, fingers=${Number(snap.fingers)||0}, side=${snap.side||"-"}`);}
      aiState={detected:!!snap.detected,fingers:Number(snap.fingers)||0,side:snap.side||"",faces:Array.isArray(snap.faces)?snap.faces:[],landmarks:Array.isArray(snap.landmarks)?snap.landmarks:[]};
      runFrame=captureFrame();
    }

    // Open Camera Bridge only if direct camera access is blocked.
    if(needsCamera && !directCameraOk){
      if(!isEmbedded){
        running=false;
        log("Program stopped because this project needs a camera.");
        return;
      }

      try{
        log("Direct camera blocked → opening Camera Bridge fallback…");
        openCameraBridge(requestedIdx);

        const snap=await requestBridgeSnapshot(requestedIdx,30000,needsFace);
        aiState=snap.aiState||{detected:false,fingers:0,side:"",faces:[],landmarks:[]};
        runFrame=snap.frame||null;

        $("handDetected").textContent=aiState.detected?"Yes":"No";
        $("fingerCount").textContent=Number(aiState.fingers)||0;
        $("handSide").textContent=aiState.side||"—";
        $("faceCount").textContent=Array.isArray(aiState.faces)?aiState.faces.length:0;

        log(`AI snapshot → detected=${!!aiState.detected}, fingers=${Number(aiState.fingers)||0}, side=${aiState.side||"-"}`);
      }catch(e){
        running=false;
        log("Camera error: "+(e?.message||e));
        return;
      }
    }

    if(prefs.demoMode){
      sensorState.ultrasonicCm=Number(prefs.demoUltrasonic)||45;
      sensorState.potValue=Math.max(0,Math.min(255,Number(prefs.demoPot)||0));
      sensorState.potRaw=Math.round(sensorState.potValue*4095/255);
      updateSensorGraphics();
    }

    badge($("pythonStatus"),"Running…","warn");
    worker.postMessage({
      type:"run",
      code:src,
      stdin:prefs.stdin||"",
      aiState,
      sensorState,
      frame:runFrame,
      imageFrame,
      uploadedFiles:uploadedImages.map(x=>({name:x.name,path:x.path,data:x.data}))
    });
  }

  function stopProgram(){running=false;createWorker();stopCamera();applyDemo({command:"RGB_LED_SET",id:1,r:0,g:0,b:0});applyDemo({command:"MOTOR_SET",id:1,speed:0});log("Stopped.");}

  function updateSensorGraphics(){
    const d=Math.max(0,Number(sensorState.ultrasonicCm)||0),p=Math.max(0,Math.min(255,Number(sensorState.potValue)||0));
    $("ultraLabel").textContent=d.toFixed(1)+" cm";$("ultraMeter").style.width=Math.min(100,d/400*100)+"%";
    $("potLabel").textContent=p+" / 255";$("potNeedle").style.transform=`rotate(${-135+(p/255)*270}deg)`;
  }

  function updateRgb(r,g,b){
    r=Math.max(0,Math.min(255,+r||0));g=Math.max(0,Math.min(255,+g||0));b=Math.max(0,Math.min(255,+b||0));
    $("rgbLed").style.background=`rgb(${r},${g},${b})`;
    const glow=Math.max(r,g,b)>0?`0 0 18px rgba(${r},${g},${b},.95), inset 0 0 0 2px #ffffff66`:"inset 0 0 0 2px #4a5262";
    $("rgbLed").style.boxShadow=glow;$("rgbLabel").textContent=`R${r} G${g} B${b}`;
  }

  function applyDemo(p){
    if(p.command==="RGB_LED_SET"&&+p.id===1)updateRgb(p.r,p.g,p.b);
    if(p.command==="LED_SET"&&+p.id===1)updateRgb(+p.value?255:0,+p.value?255:0,+p.value?255:0);
    if(p.command==="MOTOR_SET"&&+p.id===1){const s=Math.max(-100,Math.min(100,+p.speed||0));$("motorMeter").style.width=Math.abs(s)+"%";$("motorLabel").textContent=s===0?"Stopped":`${s>0?"Forward":"Backward"} ${Math.abs(s)}%`;}
    if(p.command==="SERVO_SET"&&+p.id===1){const a=Math.max(0,Math.min(180,+p.angle||0));$("servoNeedle").style.transform=`rotate(${a-90}deg)`;$("servoLabel").textContent=a+"°";}
  }

  function updateSensorPacket(data){
    const sensor=String(data.sensor||data.name||"").toUpperCase();
    if(sensor==="ULTRASONIC"||data.distanceCm!==undefined||data.ultrasonicCm!==undefined){
      sensorState.ultrasonicCm=Number(data.distanceCm??data.ultrasonicCm??sensorState.ultrasonicCm);
    }
    if(sensor==="POT"||sensor==="POTENTIOMETER"||data.potValue!==undefined||data.value255!==undefined){
      sensorState.potValue=Math.max(0,Math.min(255,Number(data.potValue??data.value255??data.value??sensorState.potValue)));
      sensorState.potRaw=Number(data.raw??data.potRaw??Math.round(sensorState.potValue*4095/255));
    }
    updateSensorGraphics();
  }

  function handleKit(p){
    if(!p)return;
    if(prefs.demoMode){applyDemo(p);log("DEMO → "+JSON.stringify(p));}
    else if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"command",kitId:prefs.kitId,...p}));
    else log("Kit not connected.");
  }

  function connectRealKit(){
    if(prefs.demoMode)return;
    if(!prefs.wsUrl?.startsWith("wss://")){log("Set WebSocket URL in Settings.");return;}
    try{
      ws=new WebSocket(prefs.wsUrl);
      ws.onopen=()=>{ws.send(JSON.stringify({type:"hello",kitId:prefs.kitId}));badge($("kitStatus"),"Kit connected","ok");};
      ws.onmessage=e=>{
        try{
          const d=JSON.parse(e.data);
          if(d.type==="sensor"||d.type==="sensors")updateSensorPacket(d);
          else log("KIT → "+e.data);
        }catch(_){log("KIT → "+e.data);}
      };
      ws.onerror=()=>log("WebSocket error.");ws.onclose=()=>badge($("kitStatus"),"Kit disconnected");
    }catch(e){log("Kit connection error: "+e.message);}
  }

  function showImage(url){$("resultImage").src=url;$("resultImage").style.display="block";$("imagePlaceholder").style.display="none";switchOutput("imageOutput");}
  function switchOutput(id){document.querySelectorAll(".output-view").forEach(x=>x.classList.toggle("active",x.id===id));document.querySelectorAll(".output-tab").forEach(x=>x.classList.toggle("active",x.dataset.view===id));}

  window.addEventListener("zebjus-ai-state",e=>{
    const d=e.detail||{};aiState={detected:!!d.detected,fingers:Number(d.fingers)||0,side:d.side||"",faces:Array.isArray(d.faces)?d.faces:[],landmarks:Array.isArray(d.landmarks)?d.landmarks:[]};
    $("handDetected").textContent=aiState.detected?"Yes":"No";$("fingerCount").textContent=aiState.fingers;$("handSide").textContent=aiState.side||"—";$("faceCount").textContent=aiState.faces.length;
  });

  $("loadExampleBtn").onclick=()=>setCode(examples[$("exampleSelect").value]||examples.hello);
  $("resetBtn").onclick=()=>setCode(examples.hello);$("runBtn").onclick=runCode;$("stopBtn").onclick=stopProgram;$("clearBtn").onclick=()=>terminal.textContent="";
  $("cameraToggleBtn").onclick=()=>cameraRunning?stopCamera():startCamera();
  $("autocompleteBtn").onclick=()=>editor?.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false});
  $("imageInput").onchange=e=>loadImageFiles(e.target.files).catch(err=>log("Image upload error: "+err.message));
  $("uploadedFileList").onclick=async e=>{
    const copy=e.target.closest("[data-copy-path]");
    if(copy){
      const path=copy.dataset.copyPath||"";
      const ok=await copyText(path);
      copy.textContent=ok?"Copied!":"Copy failed";
      if(ok)log(`Copied image path: ${path}`);
      setTimeout(()=>copy.textContent="Copy Path",900);
      return;
    }
    const row=e.target.closest("[data-upload-index]");
    if(row)setActiveUpload(uploadedImages[Number(row.dataset.uploadIndex)]);
  };
  $("clearImageBtn").onclick=clearLoadedImage;
  document.querySelectorAll(".output-tab").forEach(b=>b.onclick=()=>switchOutput(b.dataset.view));

  document.documentElement.style.setProperty("--editor-font",(prefs.fontSize||14)+"px");
  $("kitNameText").textContent=prefs.kitId||"ZB-000123";$("kitStatus").textContent=prefs.demoMode?"Demo mode":"Kit disconnected";
  updateRgb(0,0,0);updateSensorGraphics();setupCameraBridge();initEditor();createWorker();enumerateCameras();connectRealKit();
})();