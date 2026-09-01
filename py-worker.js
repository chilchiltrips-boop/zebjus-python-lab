importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");

let pyodide;

async function init(){
  pyodide = await loadPyodide();

  pyodide.setStdout({
    batched: (text) => postMessage({type:"stdout", text})
  });

  pyodide.setStderr({
    batched: (text) => postMessage({type:"stderr", text})
  });

  await pyodide.runPythonAsync(`
import sys, types, time, js
from js import postMessage
from pyodide.ffi import to_js

def _send(command, **kwargs):
    payload = {"command": command, **kwargs}
    postMessage(to_js({"type": "kit-command", "payload": payload}, dict_converter=js.Object.fromEntries))

class LED:
    def __init__(self, id=1):
        self.id = int(id)

    def on(self):
        _send("LED_SET", id=self.id, value=1)

    def off(self):
        _send("LED_SET", id=self.id, value=0)

    def blink(self, count=3, interval=0.5):
        for _ in range(int(count)):
            self.on()
            time.sleep(float(interval))
            self.off()
            time.sleep(float(interval))

class Motor:
    def __init__(self, id=1):
        self.id = int(id)

    def forward(self, speed=50):
        speed = max(0, min(100, int(speed)))
        _send("MOTOR_SET", id=self.id, speed=speed)

    def backward(self, speed=50):
        speed = max(0, min(100, int(speed)))
        _send("MOTOR_SET", id=self.id, speed=-speed)

    def stop(self):
        _send("MOTOR_SET", id=self.id, speed=0)

class Servo:
    def __init__(self, id=1):
        self.id = int(id)

    def write(self, angle=90):
        angle = max(0, min(180, int(angle)))
        _send("SERVO_SET", id=self.id, angle=angle)

def sleep(seconds):
    time.sleep(float(seconds))

mod = types.ModuleType("zebjus")
mod.LED = LED
mod.Motor = Motor
mod.Servo = Servo
mod.sleep = sleep
mod.__all__ = ["LED", "Motor", "Servo", "sleep"]
sys.modules["zebjus"] = mod
  `);

  postMessage({type:"ready"});
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  if(msg.type !== "run" || !pyodide) return;

  try{
    await pyodide.runPythonAsync(msg.code);
    postMessage({type:"done"});
  }catch(err){
    postMessage({type:"error", text:String(err)});
  }
};

init().catch(err => postMessage({type:"error", text:"Pyodide init failed: " + err}));
