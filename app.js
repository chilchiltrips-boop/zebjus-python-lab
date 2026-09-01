import {EditorState} from "https://esm.sh/@codemirror/state@6.5.2";
import {EditorView,keymap} from "https://esm.sh/@codemirror/view@6.38.1";
import {basicSetup} from "https://esm.sh/codemirror@6.0.2";
import {python} from "https://esm.sh/@codemirror/lang-python@6.2.1";
import {autocompletion,completionKeymap} from "https://esm.sh/@codemirror/autocomplete@6.18.6";
import {indentWithTab} from "https://esm.sh/@codemirror/commands@6.8.1";
import "./ai.js";

const $=id=>document.getElementById(id),cfg=window.ZEBJUS_CONFIG||{};
const video=$("cameraVideo"),overlay=$("cameraOverlay"),terminal=$("terminal");
let view,worker,ws=null,running=false,cameraRunning=false,cameras=[],aiState={detected:false,fingers:0,side:""};

const defaults={autoCamera:true,demoMode:true,kitId:"ZB-000123",wsUrl:"",cameraIndex:0,fontSize:14,autoSave:true,stdin:""};
function settings(){
  let s={};try{s=JSON.parse(localStorage.getItem("zebjus.lab.settings")||"{}");}catch(e){}
  return {...defaults,...s};
}
let prefs=settings();
document.documentElement.style.setProperty("--editor-font",`${prefs.fontSize||14}px`);
$("kitNameText").textContent=prefs.kitId||"ZB-000123";
$("kitStatus").textContent=prefs.demoMode?"Demo mode":"Kit disconnected";

const examples={
hello:`print("Hello, ZEBJUS!")`,
variables:`name = "Anna"\nage = 14\nscore = 92.5\n\nprint(name)\nprint(age)\nprint(score)`,
input:`name = input("Enter your name: ")\nage = int(input("Enter your age: "))\n\nprint("Hello", name)\nprint("Next year you will be", age + 1)`,
ifelse:`mark = 78\n\nif mark >= 80:\n    print("Excellent")\nelif mark >= 50:\n    print("Pass")\nelse:\n    print("Try again")`,
forloop:`for i in range(1, 6):\n    print("Count:", i)`,
function:`def add(a, b):\n    return a + b\n\nprint("Answer =", add(10, 20))`,
list:`fruits = ["apple", "orange", "mango"]\n\nfor fruit in fruits:\n    print(fruit)`,
cvGray:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\nshow(gray, "Grayscale")`,
cvEdges:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\nedges = cv2.Canny(gray, 80, 160)\nshow(edges, "Canny Edges")`,
cvThreshold:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\n_, binary = cv2.threshold(gray, 120, 255, cv2.THRESH_BINARY)\nshow(binary, "Threshold")`,
hand:`from zebjus_ai import HandDetector\n\nresult = HandDetector().read()\nprint("Detected:", result.detected)\nprint("Fingers:", result.fingers)\nprint("Side:", result.side)`,
handLed:`from zebjus import LED\nfrom zebjus_ai import HandDetector\n\nled = LED(1)\nresult = HandDetector().read()\n\nif result.detected and result.fingers >= 4:\n    led.on()\n    print("LED ON")\nelse:\n    led.off()\n    print("LED OFF")`,
led:`from zebjus import LED, sleep\n\nled = LED(1)\n\nfor i in range(5):\n    led.on()\n    sleep(0.5)\n    led.off()\n    sleep(0.5)\n\nprint("Blink complete")`,
servo:`from zebjus import Servo, sleep\n\nservo = Servo(1)\nfor angle in [0, 45, 90, 135, 180, 90]:\n    servo.write(angle)\n    sleep(0.5)`,
motor:`from zebjus import Motor, sleep\n\nmotor = Motor(1)\nmotor.forward(50)\nsleep(2)\nmotor.stop()\nprint("Motor stopped")`
};

const baseCompletions=[
["and","keyword"],["as","keyword"],["assert","keyword"],["async","keyword"],["await","keyword"],["break","keyword"],["class","keyword"],["continue","keyword"],["def","keyword"],["del","keyword"],["elif","keyword"],["else","keyword"],["except","keyword"],["False","keyword"],["finally","keyword"],["for","keyword"],["from","keyword"],["global","keyword"],["if","keyword"],["import","keyword"],["in","keyword"],["is","keyword"],["lambda","keyword"],["None","keyword"],["not","keyword"],["or","keyword"],["pass","keyword"],["raise","keyword"],["return","keyword"],["True","keyword"],["try","keyword"],["while","keyword"],["with","keyword"],["yield","keyword"],
["print","function","print(${1})"],["input","function",'input("${1:Prompt: }")'],["range","function","range(${1:5})"],["len","function","len(${1})"],["int","function","int(${1})"],["float","function","float(${1})"],["str","function","str(${1})"],["list","function","list(${1})"],["dict","function","dict(${1})"],["sum","function","sum(${1})"],["min","function","min(${1})"],["max","function","max(${1})"],["enumerate","function","enumerate(${1})"],
["LED","class","LED(${1:1})"],["Motor","class","Motor(${1:1})"],["Servo","class","Servo(${1:1})"],["Camera","class","Camera(${1:0})"],["HandDetector","class","HandDetector()"],["sleep","function","sleep(${1:1})"],["cv2","module"],["np","module"]
];
const dotted={
cv2:[["cvtColor","function","cvtColor(${1:src}, ${2:cv2.COLOR_BGR2GRAY})"],["Canny","function","Canny(${1:image}, ${2:80}, ${3:160})"],["threshold","function","threshold(${1:src}, ${2:120}, ${3:255}, ${4:cv2.THRESH_BINARY})"],["resize","function","resize(${1:image}, (${2:320}, ${3:240}))"],["GaussianBlur","function","GaussianBlur(${1:image}, (${2:5}, ${3:5}), ${4:0})"],["COLOR_BGR2GRAY","constant"],["COLOR_BGR2RGB","constant"],["THRESH_BINARY","constant"]],
led:[["on","method","on()"],["off","method","off()"],["blink","method","blink(${1:5}, ${2:0.5})"]],
motor:[["forward","method","forward(${1:50})"],["backward","method","backward(${1:50})"],["stop","method","stop()"]],
servo:[["write","method","write(${1:90})"]],
result:[["detected","property"],["fingers","property"],["side","property"]],
hand:[["read","method","read()"]],
cam:[["read","method","read()"]]
};

function completionSource(context){
  const pos=context.pos,line=context.state.doc.lineAt(pos),before=line.text.slice(0,pos-line.from);
  const dot=before.match(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/);
  let prefix="",items=baseCompletions;
  if(dot){prefix=dot[2]||"";items=dotted[dot[1]]||[];}
  else{const m=before.match(/([A-Za-z_]\w*)$/);if(!m&&!context.explicit)return null;prefix=m?.[1]||"";}
  const filtered=items.filter(x=>x[0].startsWith(prefix));
  if(!filtered.length)return null;
  return{from:pos-prefix.length,filter:false,options:filtered.map(([label,type,apply])=>({label,type,apply:apply||label,detail:type}))};
}

const darkTheme=EditorView.theme({
  "&":{height:"100%",backgroundColor:"#090f1b",color:"#eef4ff"},
  ".cm-content":{caretColor:"#fff"},
  "&.cm-focused .cm-cursor":{borderLeftColor:"#fff"},
  ".cm-selectionBackground,.cm-content ::selection":{backgroundColor:"#294675!important"},
  ".cm-tooltip":{backgroundColor:"#111a2d",color:"#eef4ff",border:"1px solid #2a3959"}
},{dark:true});

function initEditor(){
  const saved=prefs.autoSave?localStorage.getItem("zebjus.lab.code"):null;
  view=new EditorView({
    state:EditorState.create({
      doc:saved||examples.hello,
      extensions:[basicSetup,python(),darkTheme,autocompletion({override:[completionSource],activateOnTyping:true,maxRenderedOptions:14}),keymap.of([...completionKeymap,indentWithTab]),
        EditorView.updateListener.of(u=>{
          if(u.docChanged&&prefs.autoSave){
            $("saveState").textContent="Saving…";
            clearTimeout(window.__saveTimer);
            window.__saveTimer=setTimeout(()=>{localStorage.setItem("zebjus.lab.code",u.state.doc.toString());$("saveState").textContent="Saved";},250);
          }
        })]
    }),
    parent:$("editor")
  });
}
function getCode(){return view.state.doc.toString();}
function setCode(t){view.dispatch({changes:{from:0,to:view.state.doc.length,insert:t}});view.focus();}
function log(t){terminal.textContent+=(terminal.textContent?"\n":"")+String(t);terminal.scrollTop=terminal.scrollHeight;}
function badge(el,t,m=""){el.textContent=t;el.className="badge"+(m?" "+m:"");}

function createWorker(){
  if(worker)worker.terminate();
  worker=new Worker("./py-worker.js");
  worker.postMessage({type:"init",pyodideVersion:cfg.pyodideVersion||"314.0.6"});
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

async function enumerateCameras(){
  try{
    const ds=await navigator.mediaDevices?.enumerateDevices?.()||[];
    cameras=ds.filter(d=>d.kind==="videoinput");
    const i=Math.max(0,Math.min(Number(prefs.cameraIndex)||0,Math.max(0,cameras.length-1)));
    $("cameraIndexText").textContent="Camera "+i;
  }catch(e){console.warn(e);}
}
function requestedCamera(src){const m=src.match(/\bCamera\s*\(\s*(\d+)\s*\)/);return m?Number(m[1]):null;}
async function startCamera(index=null){
  const i=index!==null?index:Number(prefs.cameraIndex)||0,deviceId=cameras[i]?.deviceId||"";
  try{
    badge($("aiStatus"),"Camera starting…","warn");
    await window.ZebjusAI.start(video,overlay,deviceId);cameraRunning=true;$("cameraPlaceholder").style.display="none";
    $("cameraToggleBtn").textContent="Stop";$("cameraIndexText").textContent="Camera "+i;badge($("aiStatus"),"Camera + AI","ok");
    await enumerateCameras();return true;
  }catch(e){cameraRunning=false;badge($("aiStatus"),"Camera error");log("Camera error: "+(e?.message||e));return false;}
}
function stopCamera(){
  window.ZebjusAI?.stop(video,overlay);cameraRunning=false;$("cameraPlaceholder").style.display="grid";$("cameraToggleBtn").textContent="Start";badge($("aiStatus"),"Camera off");
}
function captureFrame(){
  if(!cameraRunning||video.readyState<2)return null;
  const c=document.createElement("canvas"),w=cfg.cameraCaptureWidth||320,h=cfg.cameraCaptureHeight||240;c.width=w;c.height=h;
  const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(video,0,0,w,h);return{width:w,height:h,data:Array.from(x.getImageData(0,0,w,h).data)};
}
async function runCode(){
  if(running){log("Program already running. Press Stop first.");return;}
  const src=getCode(),needCam=/\bzebjus_ai\b|\bHandDetector\b|\bzebjus_cv\b|\bCamera\s*\(/.test(src),idx=requestedCamera(src);
  terminal.textContent="";running=true;
  if(prefs.autoCamera&&needCam){
    if(cameraRunning)stopCamera();
    const ok=await startCamera(idx);
    if(!ok){running=false;log("Program stopped because this project needs a camera.");return;}
    await new Promise(r=>setTimeout(r,220));
  }
  aiState=window.ZebjusAI?.getSnapshot?.()||aiState;
  badge($("pythonStatus"),"Running…","warn");
  worker.postMessage({type:"run",code:src,stdin:prefs.stdin||"",aiState,frame:captureFrame()});
}
function stopProgram(){
  running=false;createWorker();stopCamera();applyDemo({command:"LED_SET",id:1,value:0});applyDemo({command:"MOTOR_SET",id:1,speed:0});log("Stopped.");
}
function handleKit(p){
  if(!p)return;
  if(prefs.demoMode){applyDemo(p);log("DEMO → "+JSON.stringify(p));}
  else if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"command",kitId:prefs.kitId,...p}));
  else log("Kit not connected.");
}
function applyDemo(p){
  if(p.command==="LED_SET"&&+p.id===1){const on=+p.value===1;$("demoLed").classList.toggle("on",on);$("ledLabel").textContent=on?"ON":"OFF";}
  if(p.command==="MOTOR_SET"&&+p.id===1){const s=Math.max(-100,Math.min(100,+p.speed||0));$("motorMeter").style.width=Math.abs(s)+"%";$("motorLabel").textContent=s===0?"Stopped":`${s>0?"Forward":"Backward"} ${Math.abs(s)}%`;}
  if(p.command==="SERVO_SET"&&+p.id===1){const a=Math.max(0,Math.min(180,+p.angle||0));$("servoNeedle").style.transform=`rotate(${a-90}deg)`;$("servoLabel").textContent=a+"°";}
}
function connectRealKit(){
  if(prefs.demoMode)return;
  if(!prefs.wsUrl?.startsWith("wss://")){log("Set secure WebSocket URL in Settings.");return;}
  try{
    ws=new WebSocket(prefs.wsUrl);
    ws.onopen=()=>{ws.send(JSON.stringify({type:"hello",kitId:prefs.kitId}));badge($("kitStatus"),"Kit connected","ok");};
    ws.onmessage=e=>log("KIT → "+e.data);ws.onerror=()=>log("WebSocket error.");ws.onclose=()=>badge($("kitStatus"),"Kit disconnected");
  }catch(e){log("Kit connection error: "+e.message);}
}
function showImage(url){
  $("resultImage").src=url;$("resultImage").style.display="block";$("imagePlaceholder").style.display="none";switchOutput("imageOutput");
}
function switchOutput(id){
  document.querySelectorAll(".output-view").forEach(x=>x.classList.toggle("active",x.id===id));
  document.querySelectorAll(".output-tab").forEach(x=>x.classList.toggle("active",x.dataset.view===id));
}

window.addEventListener("zebjus-ai-state",e=>{
  const d=e.detail||{};aiState={detected:!!d.detected,fingers:+d.fingers||0,side:d.side||""};
  $("handDetected").textContent=aiState.detected?"Yes":"No";$("fingerCount").textContent=aiState.fingers;$("handSide").textContent=aiState.side||"—";
});
$("loadExampleBtn").onclick=()=>setCode(examples[$("exampleSelect").value]||examples.hello);
$("resetBtn").onclick=()=>setCode(examples.hello);$("runBtn").onclick=runCode;$("stopBtn").onclick=stopProgram;$("clearBtn").onclick=()=>terminal.textContent="";
$("cameraToggleBtn").onclick=()=>cameraRunning?stopCamera():startCamera();
document.querySelectorAll(".output-tab").forEach(b=>b.onclick=()=>switchOutput(b.dataset.view));

initEditor();createWorker();enumerateCameras();connectRealKit();
