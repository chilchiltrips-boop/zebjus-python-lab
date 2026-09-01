import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/pyodide.mjs";

let pyodide=null,readyPromise=null,opencvReady=false,importLoadCache=new Set();

async function initialize(){
  if(pyodide)return pyodide;
  if(readyPromise)return readyPromise;

  readyPromise=(async()=>{
    const base="https://cdn.jsdelivr.net/pyodide/v314.0.6/full/";
    pyodide=await loadPyodide({indexURL:base});
    pyodide.setStdout({batched:text=>postMessage({type:"runtime-stdout",text})});
    pyodide.setStderr({batched:text=>postMessage({type:"stderr",text})});

    await pyodide.runPythonAsync(`
import sys,types,time,io,base64,js,math,json,traceback
from js import postMessage
from pyodide.ffi import to_js

_ai_state={"detected":False,"fingers":0,"side":"","landmarks":[]}
_face_state=[]
_hand_landmarks=[]
_sensor_state={"ultrasonic_cm":45.0,"pot_value":128,"pot_raw":2056}
_current_frame=None
_loaded_image=None

class _ZebjusTerminalStream:
    def __init__(self,kind="stdout"): self.kind=kind
    def write(self,text):
        text=str(text)
        if text:
            postMessage(to_js({"type":self.kind,"text":text},dict_converter=js.Object.fromEntries))
        return len(text)
    def flush(self): pass
    def isatty(self): return False
    @property
    def encoding(self): return "utf-8"

_zebjus_stdout=_ZebjusTerminalStream("stdout")
_zebjus_stderr=_ZebjusTerminalStream("stderr")

def _clamp255(v): return max(0,min(255,int(v)))

def _send(command,**kwargs):
    postMessage(to_js(
        {"type":"kit-command","payload":{"command":command,**kwargs}},
        dict_converter=js.Object.fromEntries
    ))

class RGBLED:
    def __init__(self,id=1): self.id=int(id)
    def write(self,r=0,g=0,b=0):
        r,g,b=_clamp255(r),_clamp255(g),_clamp255(b)
        _send("RGB_LED_SET",id=self.id,r=r,g=g,b=b)
    def set(self,r=0,g=0,b=0): self.write(r,g,b)
    def red(self,value=255): self.write(value,0,0)
    def green(self,value=255): self.write(0,value,0)
    def blue(self,value=255): self.write(0,0,value)
    def white(self,value=255): self.write(value,value,value)
    def off(self): self.write(0,0,0)

# Backward-compatible LED API maps to the RGB LED.
class LED:
    def __init__(self,id=1): self.rgb=RGBLED(id)
    def on(self): self.rgb.white(255)
    def off(self): self.rgb.off()
    def blink(self,count=3,interval=.5):
        for _ in range(int(count)):
            self.on();time.sleep(float(interval));self.off();time.sleep(float(interval))

class Motor:
    def __init__(self,id=1): self.id=int(id)
    def forward(self,speed=50): _send("MOTOR_SET",id=self.id,speed=max(0,min(100,int(speed))))
    def backward(self,speed=50): _send("MOTOR_SET",id=self.id,speed=-max(0,min(100,int(speed))))
    def stop(self): _send("MOTOR_SET",id=self.id,speed=0)

class Servo:
    def __init__(self,id=1): self.id=int(id)
    def write(self,angle=90): _send("SERVO_SET",id=self.id,angle=max(0,min(180,int(angle))))

class Ultrasonic:
    def __init__(self,id=1): self.id=int(id)
    def read(self): return float(_sensor_state.get("ultrasonic_cm",0.0))
    @property
    def distance_cm(self): return self.read()

class Potentiometer:
    def __init__(self,id=1): self.id=int(id)
    def read(self): return int(_sensor_state.get("pot_value",0))
    def raw(self): return int(_sensor_state.get("pot_raw",self.read()*4095//255))
    @property
    def value(self): return self.read()

def sleep(seconds): time.sleep(float(seconds))

def _close_cv_windows():
    postMessage(to_js({"type":"close-images"},dict_converter=js.Object.fromEntries))

class HandResult:
    def __init__(self,detected=False,fingers=0,side="",landmarks=None):
        self.detected=bool(detected);self.fingers=int(fingers);self.side=str(side);self.landmarks=list(landmarks or [])
    def __repr__(self): return f"HandResult(detected={self.detected}, fingers={self.fingers}, side='{self.side}')"

class HandDetector:
    def read(self): return HandResult(_ai_state["detected"],_ai_state["fingers"],_ai_state["side"],_hand_landmarks)

class FaceResult:
    def __init__(self,faces=None): self.faces=list(faces or []);self.count=len(self.faces);self.detected=self.count>0
    def __repr__(self): return f"FaceResult(detected={self.detected}, count={self.count})"

class FaceDetector:
    def __init__(self,minDetectionCon=0.5,modelSelection=0): self.minDetectionCon=float(minDetectionCon);self.modelSelection=int(modelSelection)
    def read(self): return FaceResult([f.copy() for f in _face_state if float(f.get("score",0))>=self.minDetectionCon])
    def findFaces(self,img,draw=True): return _cvzone_find_faces(img,draw,self.minDetectionCon,score_as_percent=False)

class Camera:
    def __init__(self,index=0): self.index=int(index)
    def read(self):
        if _current_frame is None: raise RuntimeError("No camera frame available.")
        return _current_frame.copy()

def load_image():
    if _loaded_image is None: raise RuntimeError("No image loaded. Use Image Lab → Load Image first.")
    return _loaded_image.copy()

def show(image,title="OpenCV Output"):
    import cv2
    ok,buf=cv2.imencode(".png",image)
    if not ok: raise RuntimeError("Could not encode image")
    data="data:image/png;base64,"+base64.b64encode(bytes(buf)).decode()
    postMessage(to_js({"type":"image","dataUrl":data,"title":str(title)},dict_converter=js.Object.fromEntries))

def draw_rgb_led(image,x,y,r=255,g=0,b=0,radius=28):
    import cv2
    x,y,radius=int(x),int(y),max(6,int(radius))
    r,g,b=_clamp255(r),_clamp255(g),_clamp255(b)
    cv2.circle(image,(x,y),radius+4,(225,225,225),2,cv2.LINE_AA)
    cv2.circle(image,(x,y),radius,(b,g,r),-1,cv2.LINE_AA)
    cv2.circle(image,(x-radius//3,y-radius//3),max(2,radius//6),(255,255,255),-1,cv2.LINE_AA)
    return image

def draw_potentiometer(image,x,y,value=128,radius=34):
    import cv2,math
    x,y,radius=int(x),int(y),max(10,int(radius));value=_clamp255(value)
    cv2.circle(image,(x,y),radius,(75,75,75),-1,cv2.LINE_AA)
    cv2.circle(image,(x,y),radius,(200,200,200),2,cv2.LINE_AA)
    angle=math.radians(-135.0+(value/255.0)*270.0)
    px=int(x+math.cos(angle)*radius*.72);py=int(y+math.sin(angle)*radius*.72)
    cv2.line(image,(x,y),(px,py),(0,190,255),3,cv2.LINE_AA)
    cv2.putText(image,str(value),(x-radius,y+radius+18),cv2.FONT_HERSHEY_SIMPLEX,.45,(230,230,230),1,cv2.LINE_AA)
    return image

def draw_ultrasonic(image,x,y,distance_cm=50,max_cm=400,width=180,height=20):
    import cv2
    x,y,width,height=int(x),int(y),max(60,int(width)),max(8,int(height))
    d=max(0.0,float(distance_cm));m=max(1.0,float(max_cm));ratio=min(1.0,d/m)
    cv2.rectangle(image,(x,y),(x+width,y+height),(180,180,180),2)
    cv2.rectangle(image,(x+2,y+2),(x+2+int((width-4)*ratio),y+height-2),(220,170,60),-1)
    cv2.putText(image,f"{d:.1f} cm",(x,y-8),cv2.FONT_HERSHEY_SIMPLEX,.45,(230,230,230),1,cv2.LINE_AA)
    return image


# ---------------- Browser compatibility: MediaPipe + CVZone ----------------
class _RelativeBoundingBox:
    def __init__(self,f): self.xmin=float(f.get("xmin",0));self.ymin=float(f.get("ymin",0));self.width=float(f.get("width",0));self.height=float(f.get("height",0))
class _LocationData:
    def __init__(self,f): self.relative_bounding_box=_RelativeBoundingBox(f)
class _MPDetection:
    def __init__(self,f): self.score=[float(f.get("score",0))];self.location_data=_LocationData(f)
class _MPFaceResults:
    def __init__(self,faces): self.detections=[_MPDetection(f) for f in faces] or None
class _MPFaceDetection:
    def __init__(self,min_detection_confidence=0.5,model_selection=0,**kwargs): self.min_detection_confidence=float(min_detection_confidence);self.model_selection=int(model_selection)
    def process(self,img): return _MPFaceResults([f for f in _face_state if float(f.get("score",0))>=self.min_detection_confidence])
    def close(self): pass

def _draw_detection(img,detection):
    import cv2
    if img is None:return img
    h,w=img.shape[:2];b=detection.location_data.relative_bounding_box
    x,y,bw,bh=int(b.xmin*w),int(b.ymin*h),int(b.width*w),int(b.height*h)
    cv2.rectangle(img,(x,y),(x+bw,y+bh),(255,0,255),2);return img

def _cvzone_putTextRect(img,text,pos,scale=2,thickness=2,colorR=(255,255,255),colorT=(255,255,255),colorB=(0,255,0),offset=10,border=None,colorBorder=(255,0,255),font=None):
    import cv2
    font=cv2.FONT_HERSHEY_PLAIN if font is None else font;x,y=int(pos[0]),int(pos[1]);scale=float(scale);thickness=int(thickness);offset=int(offset)
    (tw,th),base=cv2.getTextSize(str(text),font,scale,thickness);x1,y1=x-offset,y+offset;x2,y2=x+tw+offset,y-th-offset
    cv2.rectangle(img,(x1,y1),(x2,y2),tuple(map(int,colorR)),-1)
    if border is not None: cv2.rectangle(img,(x1,y1),(x2,y2),tuple(map(int,colorBorder)),int(border))
    cv2.putText(img,str(text),(x,y),font,scale,tuple(map(int,colorT)),thickness)
    return img,(x1,y2,x2-x1,y1-y2)

def _cvzone_cornerRect(img,bbox,l=30,t=5,rt=1,colorR=(255,0,255),colorC=(0,255,0)):
    import cv2
    x,y,w,h=map(int,bbox);l,t,rt=int(l),int(t),int(rt)
    if rt: cv2.rectangle(img,(x,y),(x+w,y+h),tuple(map(int,colorR)),rt)
    c=tuple(map(int,colorC))
    for a,b in [((x,y),(x+l,y)),((x,y),(x,y+l)),((x+w,y),(x+w-l,y)),((x+w,y),(x+w,y+l)),((x,y+h),(x+l,y+h)),((x,y+h),(x,y+h-l)),((x+w,y+h),(x+w-l,y+h)),((x+w,y+h),(x+w,y+h-l))]: cv2.line(img,a,b,c,t)
    return img

def _cvzone_find_faces(img,draw=True,min_con=0.5,score_as_percent=True):
    import cv2
    if img is None:return img,[]
    ih,iw=img.shape[:2];bboxs=[]
    for idx,f in enumerate(_face_state):
        score=float(f.get("score",0))
        if score<float(min_con):continue
        x=int(float(f.get("xmin",0))*iw);y=int(float(f.get("ymin",0))*ih);w=int(float(f.get("width",0))*iw);h=int(float(f.get("height",0))*ih);cx,cy=x+w//2,y+h//2
        bboxs.append({"id":idx,"bbox":(x,y,w,h),"score":int(score*100) if score_as_percent else [score],"center":(cx,cy)})
        if draw:
            cv2.rectangle(img,(x,y),(x+w,y+h),(255,0,255),2);_cvzone_putTextRect(img,f"{int(score*100)}%",(x,max(20,y-10)),scale=1.2,thickness=1)
    return img,bboxs

class _CVZoneFaceDetector:
    def __init__(self,minDetectionCon=0.5,modelSelection=0): self.minDetectionCon=float(minDetectionCon);self.modelSelection=int(modelSelection)
    def findFaces(self,img,draw=True): return _cvzone_find_faces(img,draw,self.minDetectionCon,score_as_percent=True)

# ---------------- VISION AI Z legacy-course compatibility ----------------
def _hand_points(img):
    if img is None or not _hand_landmarks: return []
    h,w=img.shape[:2]
    return [[i,int(float(p.get("x",0))*w),int(float(p.get("y",0))*h)] for i,p in enumerate(_hand_landmarks)]

class _LegacyHandDetector:
    def __init__(self,mode=False,maxHands=1,detectionCon=0.5,trackCon=0.5,**kwargs):
        self.mode=mode;self.maxHands=maxHands;self.detectionCon=detectionCon;self.trackCon=trackCon
    def findHands(self,img,draw=True):
        if draw and img is not None:
            import cv2
            pts=_hand_points(img)
            for _,x,y in pts: cv2.circle(img,(x,y),3,(255,0,255),cv2.FILLED)
            for a,b in [(0,1),(1,2),(2,3),(3,4),(0,5),(5,6),(6,7),(7,8),(5,9),(9,10),(10,11),(11,12),(9,13),(13,14),(14,15),(15,16),(13,17),(17,18),(18,19),(19,20),(0,17)]:
                if len(pts)>max(a,b): cv2.line(img,(pts[a][1],pts[a][2]),(pts[b][1],pts[b][2]),(0,255,0),2)
        return img
    def findPosition(self,img,handNo=0,draw=True):
        pts=_hand_points(img)
        if not pts:return [],()
        xs=[p[1] for p in pts];ys=[p[2] for p in pts]
        bbox=(min(xs),min(ys),max(xs),max(ys))
        if draw:
            import cv2
            for _,x,y in pts: cv2.circle(img,(x,y),4,(255,0,255),cv2.FILLED)
            cv2.rectangle(img,(bbox[0]-10,bbox[1]-10),(bbox[2]+10,bbox[3]+10),(0,255,0),2)
        return pts,bbox

class SerialObject:
    def __init__(self,port=None,*args,**kwargs): self.port=str(port or "ZEBJUS")
    def getData(self):
        raw=int(round(max(0,min(4095,int(_sensor_state.get("pot_raw",0))))*1023/4095))
        return [str(raw)]
    def sendData(self,data):
        vals=list(data) if hasattr(data,"__iter__") and not isinstance(data,(str,bytes)) else [data]
        if len(vals)>=3:
            rgb=[max(0,min(255,int(float(v)))) for v in vals[:3]]
            if max(rgb)<=1: rgb=[v*255 for v in rgb]
            _send("RGB_LED_SET",id=1,r=rgb[0],g=rgb[1],b=rgb[2])
        if len(vals)>=4: _send("SERVO_SET",id=1,angle=max(0,min(180,int(float(vals[3])))))
        return True

class WifiBridge:
    def __init__(self,*args,**kwargs): self.digits=3;self.count=1;self.started=False
    def start(self): self.started=True;return True
    def set_format(self,digits=3,count=1): self.digits=int(digits);self.count=int(count);return self
    def send_values(self,values):
        vals=list(values)
        if vals: _send("SERVO_SET",id=1,angle=max(0,min(180,int(float(vals[0])))))
        return True

mp_face=types.ModuleType("mediapipe.solutions.face_detection");mp_face.FaceDetection=_MPFaceDetection
mp_draw=types.ModuleType("mediapipe.solutions.drawing_utils");mp_draw.draw_detection=_draw_detection
mp_solutions=types.ModuleType("mediapipe.solutions");mp_solutions.face_detection=mp_face;mp_solutions.drawing_utils=mp_draw
mp=types.ModuleType("mediapipe");mp.solutions=mp_solutions
sys.modules["mediapipe"]=mp;sys.modules["mediapipe.solutions"]=mp_solutions;sys.modules["mediapipe.solutions.face_detection"]=mp_face;sys.modules["mediapipe.solutions.drawing_utils"]=mp_draw

cvz=types.ModuleType("cvzone");cvz.putTextRect=_cvzone_putTextRect;cvz.cornerRect=_cvzone_cornerRect
cvz_fd=types.ModuleType("cvzone.FaceDetectionModule");cvz_fd.FaceDetector=_CVZoneFaceDetector
cvz.FaceDetectionModule=cvz_fd
sys.modules["cvzone"]=cvz;sys.modules["cvzone.FaceDetectionModule"]=cvz_fd

serial_mod=types.ModuleType("SerialModule");serial_mod.SerialObject=SerialObject
cvz_serial=types.ModuleType("cvzone.SerialModule");cvz_serial.SerialObject=SerialObject
cvz.SerialModule=cvz_serial
htm_mod=types.ModuleType("HandTrackingModule");htm_mod.handDetector=_LegacyHandDetector
wifi_mod=types.ModuleType("zebjus_wifi");wifi_mod.WifiBridge=WifiBridge
sys.modules["SerialModule"]=serial_mod;sys.modules["cvzone.SerialModule"]=cvz_serial
sys.modules["HandTrackingModule"]=htm_mod;sys.modules["zebjus_wifi"]=wifi_mod

z=types.ModuleType("zebjus")
for k,v in {
    "RGBLED":RGBLED,"LED":LED,"Motor":Motor,"Servo":Servo,
    "Ultrasonic":Ultrasonic,"Potentiometer":Potentiometer,"sleep":sleep
}.items(): setattr(z,k,v)
z.__all__=["RGBLED","LED","Motor","Servo","Ultrasonic","Potentiometer","sleep"]
sys.modules["zebjus"]=z

za=types.ModuleType("zebjus_ai")
za.HandDetector=HandDetector;za.HandResult=HandResult;za.FaceDetector=FaceDetector;za.FaceResult=FaceResult
za.__all__=["HandDetector","HandResult","FaceDetector","FaceResult"]
sys.modules["zebjus_ai"]=za

zc=types.ModuleType("zebjus_cv")
for k,v in {
    "Camera":Camera,"load_image":load_image,"show":show,
    "draw_rgb_led":draw_rgb_led,"draw_potentiometer":draw_potentiometer,
    "draw_ultrasonic":draw_ultrasonic
}.items(): setattr(zc,k,v)
zc.__all__=["Camera","load_image","show","draw_rgb_led","draw_potentiometer","draw_ultrasonic"]
sys.modules["zebjus_cv"]=zc
    `);

    postMessage({type:"ready"});
    return pyodide;
  })();

  return readyPromise;
}

async function syncUploadedFiles(files){
  try{
    pyodide.FS.mkdirTree("/home/pyodide/uploads");
    for(const f of (files||[])){
      const name=String(f?.name||"image").replace(/[\\/:*?"<>|]/g,"_");
      if(!name||!Array.isArray(f?.data))continue;
      pyodide.FS.writeFile(`/home/pyodide/uploads/${name}`,new Uint8Array(f.data));
    }
  }catch(e){
    postMessage({type:"stdout",text:"Image upload sync error: "+String(e?.message||e)});
  }
}



async function frameToPython(frame,targetName){
  if(!(frame?.data&&frame?.width&&frame?.height))return;
  pyodide.globals.set("__iw",Number(frame.width));
  pyodide.globals.set("__ih",Number(frame.height));
  pyodide.globals.set("__idata",frame.data);
  pyodide.globals.set("__target_name",targetName);
  await pyodide.runPythonAsync(`
import numpy as np,cv2
_raw=__idata.to_py() if hasattr(__idata,"to_py") else list(__idata)
_arr=np.asarray(_raw,dtype=np.uint8).reshape(int(__ih),int(__iw),4)
_img=cv2.cvtColor(_arr,cv2.COLOR_RGBA2BGR)
if __target_name=="camera": _current_frame=_img
elif __target_name=="loaded": _loaded_image=_img
del _raw,_arr,_img
  `);
}

async function prepareRun(m){
  const code=m.code||"";
  const needsCv=/\bimport\s+cv2\b|\bzebjus_cv\b|\bCamera\s*\(|\bload_image\s*\(|\bdraw_(?:rgb_led|potentiometer|ultrasonic)\s*\(|\bcvzone\b|\bmediapipe\b|\bFaceDetector\b|\bHandTrackingModule\b/.test(code);

  if(needsCv&&!opencvReady){
    postMessage({type:"status",text:"Loading OpenCV…",mode:"warn"});
    await pyodide.loadPackage(["numpy","opencv-python"]);
    await pyodide.runPythonAsync(`
import cv2
class _BrowserVideoCapture:
    def __init__(self,index=0): self.index=int(index);self.opened=_current_frame is not None
    def isOpened(self): return bool(self.opened and _current_frame is not None)
    def read(self):
        if _current_frame is None:return False,None
        return True,_current_frame.copy()
    def set(self,prop,value): return True
    def get(self,prop): return 0.0
    def release(self): self.opened=False

def _browser_imshow(title,img): show(img,str(title))
def _browser_waitKey(delay=1): return -1
cv2.VideoCapture=_BrowserVideoCapture
cv2.imshow=_browser_imshow
cv2.waitKey=_browser_waitKey
cv2.destroyAllWindows=_close_cv_windows
    `);
    opencvReady=true;
  }
  // Browser compatibility modules are local shims, not PyPI wheels.
  const scanCode=code.replace(/^\s*(?:from|import)\s+(?:zebjus(?:_ai|_cv)?|mediapipe|cvzone|SerialModule|HandTrackingModule|zebjus_wifi)(?:[.\w]*)?.*$/gm,"");
  if(scanCode.trim()&&!importLoadCache.has(scanCode)){
    await pyodide.loadPackagesFromImports(scanCode);
    importLoadCache.add(scanCode);
  }

  pyodide.globals.set("__stdin_text",String(m.stdin||""));
  pyodide.globals.set("__ai_detected",!!m.aiState?.detected);
  pyodide.globals.set("__ai_fingers",Number(m.aiState?.fingers)||0);
  pyodide.globals.set("__ai_side",String(m.aiState?.side||""));
  pyodide.globals.set("__faces_json",JSON.stringify(m.aiState?.faces||[]));
  pyodide.globals.set("__hand_landmarks_json",JSON.stringify(m.aiState?.landmarks||[]));
  pyodide.globals.set("__ultra",Number(m.sensorState?.ultrasonicCm)||0);
  pyodide.globals.set("__pot",Math.max(0,Math.min(255,Number(m.sensorState?.potValue)||0)));
  pyodide.globals.set("__pot_raw",Math.max(0,Number(m.sensorState?.potRaw)||0));

  await pyodide.runPythonAsync(`
sys.stdin=io.StringIO(__stdin_text + ("\\n" if __stdin_text and not __stdin_text.endswith("\\n") else ""))
sys.stdout=_zebjus_stdout
sys.stderr=_zebjus_stderr
_hand_landmarks=json.loads(str(__hand_landmarks_json)) if str(__hand_landmarks_json) else []
_ai_state={"detected":bool(__ai_detected),"fingers":int(__ai_fingers),"side":str(__ai_side),"landmarks":_hand_landmarks}
_face_state=json.loads(str(__faces_json)) if str(__faces_json) else []
_sensor_state={"ultrasonic_cm":float(__ultra),"pot_value":int(__pot),"pot_raw":int(__pot_raw)}
_current_frame=None
_loaded_image=None
  `);
if(Array.isArray(m.uploadedFiles)&&m.uploadedFiles.length)await syncUploadedFiles(m.uploadedFiles);

  if(needsCv){
    await frameToPython(m.frame,"camera");
    await frameToPython(m.imageFrame,"loaded");
  }

  let execCode=code;
  const legacyLoop=/\bwhile\s+True\s*:/.test(code)&&/\bcv2\.VideoCapture\s*\(|\bSerialObject\s*\(|\bHandTrackingModule\b|\bWifiBridge\s*\(|\bHandDetector\s*\(|\bFaceDetector\s*\(/.test(code);
  if(legacyLoop){
    execCode=code.replace(/\bwhile\s+True\s*:/,"for __zebjus_browser_cycle in range(1):");
  }
  return execCode;
}

function parsePythonError(err,code=""){
  const text=String(err?.message||err||"Python error");
  const lines=text.split(/\r?\n/).filter(Boolean);
  let errorType="PythonError",message=lines[lines.length-1]||text,line=1,offset=1;

  const last=message.match(/^([A-Za-z_]\w*(?:Error|Exception)):\s*(.*)$/);
  if(last){errorType=last[1];message=last[2]||last[1];}

  const fileMatches=[...text.matchAll(/File "(?:<exec>|<string>|main\.py)", line (\d+)/g)];
  if(fileMatches.length)line=Number(fileMatches[fileMatches.length-1][1])||1;

  const syntaxLine=text.match(/line (\d+)\s*\n[\s\S]*?\n\s*\^/);
  if(syntaxLine)line=Number(syntaxLine[1])||line;

  return {errorType,message,line,offset,text};
}

async function lintCode(code,requestId){
  await initialize();
  pyodide.globals.set("__lint_code",String(code||""));
  try{
    const raw=await pyodide.runPythonAsync(`
import json
try:
    compile(str(__lint_code),"main.py","exec")
    json.dumps({"ok":True})
except (SyntaxError,IndentationError,TabError) as e:
    json.dumps({
        "ok":False,
        "errorType":e.__class__.__name__,
        "message":str(getattr(e,"msg",e)),
        "line":int(getattr(e,"lineno",1) or 1),
        "offset":int(getattr(e,"offset",1) or 1)
    })
    `);
    const result=JSON.parse(String(raw||'{"ok":true}'));
    postMessage({type:"lint-result",requestId,...result});
  }catch(err){
    postMessage({type:"lint-result",requestId,ok:true});
  }
}

self.onmessage=async e=>{
  const m=e.data||{};

  if(m.type==="lint"){
    await lintCode(m.code||"",m.requestId||"");
    return;
  }
  if(m.type!=="run")return;

  try{
    await initialize();
    const execCode=await prepareRun(m);
    await pyodide.runPythonAsync(execCode||"");
    postMessage({type:"done"});
  }catch(err){
    const info=parsePythonError(err,m.code||"");
    postMessage({type:"error",...info});
  }
};

initialize().catch(err=>postMessage({type:"error",text:"Python init failed: "+(err?.message||err)}));