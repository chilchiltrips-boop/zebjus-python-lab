importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");
let pyodide;
async function init(){
  pyodide=await loadPyodide();
  pyodide.setStdout({batched:text=>postMessage({type:"stdout",text})});
  pyodide.setStderr({batched:text=>postMessage({type:"stderr",text})});
  await pyodide.runPythonAsync(`
import sys,types,time,js,json
from js import postMessage
from pyodide.ffi import to_js
_ai_state={"detected":False,"fingers":0,"side":""}
def _send(command,**kwargs):
    postMessage(to_js({"type":"kit-command","payload":{"command":command,**kwargs}},dict_converter=js.Object.fromEntries))
def _set_ai_state(state):
    global _ai_state
    if isinstance(state,str): state=json.loads(state)
    _ai_state={"detected":bool(state.get("detected",False)),"fingers":int(state.get("fingers",0)),"side":str(state.get("side",""))}
class LED:
    def __init__(self,id=1): self.id=int(id)
    def on(self): _send("LED_SET",id=self.id,value=1)
    def off(self): _send("LED_SET",id=self.id,value=0)
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
def sleep(seconds): time.sleep(float(seconds))
class HandResult:
    def __init__(self,detected=False,fingers=0,side=""): self.detected=bool(detected);self.fingers=int(fingers);self.side=str(side)
    def __repr__(self): return f"HandResult(detected={self.detected}, fingers={self.fingers}, side='{self.side}')"
class HandDetector:
    def read(self): return HandResult(_ai_state.get("detected",False),_ai_state.get("fingers",0),_ai_state.get("side",""))
z=types.ModuleType("zebjus");z.LED=LED;z.Motor=Motor;z.Servo=Servo;z.sleep=sleep;z.__all__=["LED","Motor","Servo","sleep"];sys.modules["zebjus"]=z
za=types.ModuleType("zebjus_ai");za.HandDetector=HandDetector;za.HandResult=HandResult;za.__all__=["HandDetector","HandResult"];sys.modules["zebjus_ai"]=za
  `); postMessage({type:"ready"});
}
self.onmessage=async e=>{const m=e.data||{};if(m.type!=="run"||!pyodide)return;try{pyodide.globals.set("__ai",JSON.stringify(m.aiState||{}));await pyodide.runPythonAsync("_set_ai_state(__ai)");pyodide.globals.delete("__ai");await pyodide.runPythonAsync(m.code);postMessage({type:"done"});}catch(err){postMessage({type:"error",text:String(err)});}};
init().catch(err=>postMessage({type:"error",text:"Pyodide init failed: "+err}));
