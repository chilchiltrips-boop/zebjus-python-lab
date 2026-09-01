let pyodide=null,initialized=false,version="314.0.6";
async function initialize(){
  if(initialized)return;
  importScripts(`https://cdn.jsdelivr.net/pyodide/v${version}/full/pyodide.js`);
  pyodide=await loadPyodide({indexURL:`https://cdn.jsdelivr.net/pyodide/v${version}/full/`});
  pyodide.setStdout({batched:text=>postMessage({type:"stdout",text})});pyodide.setStderr({batched:text=>postMessage({type:"stderr",text})});
  await pyodide.runPythonAsync(`
import sys,types,time,io,base64,js
from js import postMessage
from pyodide.ffi import to_js
_ai_state={"detected":False,"fingers":0,"side":""}
_current_frame=None
def _send(command,**kwargs): postMessage(to_js({"type":"kit-command","payload":{"command":command,**kwargs}},dict_converter=js.Object.fromEntries))
class LED:
    def __init__(self,id=1): self.id=int(id)
    def on(self): _send("LED_SET",id=self.id,value=1)
    def off(self): _send("LED_SET",id=self.id,value=0)
    def blink(self,count=3,interval=.5):
        for _ in range(int(count)): self.on();time.sleep(float(interval));self.off();time.sleep(float(interval))
class Motor:
    def __init__(self,id=1): self.id=int(id)
    def forward(self,speed=50): _send("MOTOR_SET",id=self.id,speed=max(0,min(100,int(speed))))
    def backward(self,speed=50): _send("MOTOR_SET",id=self.id,speed=-max(0,min(100,int(speed))))
    def stop(self): _send("MOTOR_SET",id=self.id,speed=0)
class Servo:
    def __init__(self,id=1): self.id=int(id)
    def write(self,angle=90): _send("SERVO_SET",id=self.id,angle=max(0,min(180,int(angle))))
def sleep(seconds): time.sleep(float(seconds))
class HandResult:
    def __init__(self,detected=False,fingers=0,side=""): self.detected=bool(detected);self.fingers=int(fingers);self.side=str(side)
class HandDetector:
    def read(self): return HandResult(_ai_state["detected"],_ai_state["fingers"],_ai_state["side"])
class Camera:
    def __init__(self,index=0): self.index=int(index)
    def read(self):
        if _current_frame is None: raise RuntimeError("No camera frame available.")
        return _current_frame.copy()
def show(image,title="OpenCV Output"):
    import cv2
    ok,buf=cv2.imencode(".png",image)
    if not ok: raise RuntimeError("Could not encode image")
    postMessage(to_js({"type":"image","dataUrl":"data:image/png;base64,"+base64.b64encode(bytes(buf)).decode(),"title":str(title)},dict_converter=js.Object.fromEntries))
z=types.ModuleType("zebjus");z.LED=LED;z.Motor=Motor;z.Servo=Servo;z.sleep=sleep;z.__all__=["LED","Motor","Servo","sleep"];sys.modules["zebjus"]=z
za=types.ModuleType("zebjus_ai");za.HandDetector=HandDetector;za.HandResult=HandResult;za.__all__=["HandDetector","HandResult"];sys.modules["zebjus_ai"]=za
zc=types.ModuleType("zebjus_cv");zc.Camera=Camera;zc.show=show;zc.__all__=["Camera","show"];sys.modules["zebjus_cv"]=zc
  `);
  initialized=true;postMessage({type:"ready"});
}
async function prepare(m){
  const code=m.code||"";
  if(/\b(import\s+cv2|from\s+zebjus_cv\s+import|import\s+zebjus_cv)\b/.test(code)){postMessage({type:"status",text:"Loading OpenCV…",mode:"warn"});await pyodide.loadPackage(["numpy","opencv-python"]);}
  await pyodide.loadPackagesFromImports(code);
  pyodide.globals.set("__stdin_text",String(m.stdin||""));pyodide.globals.set("__ai_detected",!!m.aiState?.detected);pyodide.globals.set("__ai_fingers",Number(m.aiState?.fingers)||0);pyodide.globals.set("__ai_side",String(m.aiState?.side||""));
  await pyodide.runPythonAsync(`sys.stdin=io.StringIO(__stdin_text + ("\\n" if __stdin_text and not __stdin_text.endswith("\\n") else ""));_ai_state={"detected":bool(__ai_detected),"fingers":int(__ai_fingers),"side":str(__ai_side)};_current_frame=None`);
  const f=m.frame;
  if(f?.data&&f?.width&&f?.height){
    pyodide.globals.set("__fw",Number(f.width));pyodide.globals.set("__fh",Number(f.height));pyodide.globals.set("__fd",f.data);
    await pyodide.runPythonAsync(`import numpy as np,cv2\n_raw=__fd.to_py() if hasattr(__fd,"to_py") else list(__fd)\n_arr=np.asarray(_raw,dtype=np.uint8).reshape(int(__fh),int(__fw),4)\n_current_frame=cv2.cvtColor(_arr,cv2.COLOR_RGBA2BGR)\ndel _raw,_arr`);
  }
}
self.onmessage=async e=>{
  const m=e.data||{};
  if(m.type==="init"){version=m.pyodideVersion||version;try{await initialize();}catch(err){postMessage({type:"error",text:"Python init failed: "+err});}}
  if(m.type==="run"){try{if(!initialized)await initialize();await prepare(m);await pyodide.runPythonAsync(m.code||"");postMessage({type:"done"});}catch(err){postMessage({type:"error",text:String(err)});}}
};
