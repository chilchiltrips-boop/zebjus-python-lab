import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/pyodide.mjs";

let pyodide=null,readyPromise=null;

async function initialize(){
  if(pyodide)return pyodide;
  if(readyPromise)return readyPromise;

  readyPromise=(async()=>{
    const base="https://cdn.jsdelivr.net/pyodide/v314.0.6/full/";
    pyodide=await loadPyodide({indexURL:base});
    pyodide.setStdout({batched:text=>postMessage({type:"stdout",text})});
    pyodide.setStderr({batched:text=>postMessage({type:"stderr",text})});

    await pyodide.runPythonAsync(`
import sys,types,time,io,base64,js,math
from js import postMessage
from pyodide.ffi import to_js

_ai_state={"detected":False,"fingers":0,"side":""}
_sensor_state={"ultrasonic_cm":45.0,"pot_value":128,"pot_raw":2056}
_current_frame=None
_loaded_image=None

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

class HandResult:
    def __init__(self,detected=False,fingers=0,side=""):
        self.detected=bool(detected);self.fingers=int(fingers);self.side=str(side)
    def __repr__(self): return f"HandResult(detected={self.detected}, fingers={self.fingers}, side='{self.side}')"

class HandDetector:
    def read(self): return HandResult(_ai_state["detected"],_ai_state["fingers"],_ai_state["side"])

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

z=types.ModuleType("zebjus")
for k,v in {
    "RGBLED":RGBLED,"LED":LED,"Motor":Motor,"Servo":Servo,
    "Ultrasonic":Ultrasonic,"Potentiometer":Potentiometer,"sleep":sleep
}.items(): setattr(z,k,v)
z.__all__=["RGBLED","LED","Motor","Servo","Ultrasonic","Potentiometer","sleep"]
sys.modules["zebjus"]=z

za=types.ModuleType("zebjus_ai")
za.HandDetector=HandDetector;za.HandResult=HandResult
za.__all__=["HandDetector","HandResult"]
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
  const needsCv=/\bimport\s+cv2\b|\bzebjus_cv\b|\bCamera\s*\(|\bload_image\s*\(|\bdraw_(?:rgb_led|potentiometer|ultrasonic)\s*\(/.test(code);

  if(needsCv){
    postMessage({type:"status",text:"Loading OpenCV…",mode:"warn"});
    await pyodide.loadPackage(["numpy","opencv-python"]);
  }
  await pyodide.loadPackagesFromImports(code);

  pyodide.globals.set("__stdin_text",String(m.stdin||""));
  pyodide.globals.set("__ai_detected",!!m.aiState?.detected);
  pyodide.globals.set("__ai_fingers",Number(m.aiState?.fingers)||0);
  pyodide.globals.set("__ai_side",String(m.aiState?.side||""));
  pyodide.globals.set("__ultra",Number(m.sensorState?.ultrasonicCm)||0);
  pyodide.globals.set("__pot",Math.max(0,Math.min(255,Number(m.sensorState?.potValue)||0)));
  pyodide.globals.set("__pot_raw",Math.max(0,Number(m.sensorState?.potRaw)||0));

  await pyodide.runPythonAsync(`
sys.stdin=io.StringIO(__stdin_text + ("\\n" if __stdin_text and not __stdin_text.endswith("\\n") else ""))
_ai_state={"detected":bool(__ai_detected),"fingers":int(__ai_fingers),"side":str(__ai_side)}
_sensor_state={"ultrasonic_cm":float(__ultra),"pot_value":int(__pot),"pot_raw":int(__pot_raw)}
_current_frame=None
_loaded_image=None
  `);

  if(needsCv){
    await frameToPython(m.frame,"camera");
    await frameToPython(m.imageFrame,"loaded");
  }
}

self.onmessage=async e=>{
  const m=e.data||{};
  if(m.type!=="run")return;
  try{
    await initialize();
    await prepareRun(m);
    await pyodide.runPythonAsync(m.code||"");
    postMessage({type:"done"});
  }catch(err){
    postMessage({type:"error",text:String(err)});
  }
};

initialize().catch(err=>postMessage({type:"error",text:"Python init failed: "+(err?.message||err)}));