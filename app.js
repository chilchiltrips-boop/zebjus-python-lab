import {EditorState} from "https://esm.sh/@codemirror/state@6.5.2";
import {EditorView,keymap} from "https://esm.sh/@codemirror/view@6.38.1";
import {basicSetup} from "https://esm.sh/codemirror@6.0.2";
import {python} from "https://esm.sh/@codemirror/lang-python@6.2.1";
import {autocompletion,completionKeymap} from "https://esm.sh/@codemirror/autocomplete@6.18.6";
import {indentWithTab} from "https://esm.sh/@codemirror/commands@6.8.1";
import "./ai.js";

const $=id=>document.getElementById(id),cfg=window.ZEBJUS_CONFIG||{};
const terminal=$("consoleView"),video=$("cameraVideo"),overlay=$("cameraOverlay"),placeholder=$("cameraPlaceholder");
let view,worker,ws=null,running=false,cameraRunning=false,cameras=[],aiState={detected:false,fingers:0,side:""};

const examples={
hello:`print("Hello, ZEBJUS!")`,
variables:`name = "Anna"\nage = 14\nscore = 92.5\n\nprint(name)\nprint(age)\nprint(score)`,
input:`name = input("Enter your name: ")\nage = int(input("Enter your age: "))\n\nprint("Hello", name)\nprint("Next year you will be", age + 1)`,
ifelse:`mark = 78\n\nif mark >= 80:\n    print("Excellent")\nelif mark >= 50:\n    print("Pass")\nelse:\n    print("Try again")`,
forloop:`for i in range(1, 6):\n    print("Count:", i)`,
function:`def add(a, b):\n    return a + b\n\nanswer = add(10, 20)\nprint("Answer =", answer)`,
list:`fruits = ["apple", "orange", "mango"]\n\nfor fruit in fruits:\n    print(fruit)`,
cvGray:`from zebjus_cv import Camera, show\nimport cv2\n\ncam = Camera(0)\nframe = cam.read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\nshow(gray, "Grayscale")`,
cvEdges:`from zebjus_cv import Camera, show\nimport cv2\n\ncam = Camera(0)\nframe = cam.read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\nedges = cv2.Canny(gray, 80, 160)\nshow(edges, "Canny Edges")`,
cvThreshold:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\n_, binary = cv2.threshold(gray, 120, 255, cv2.THRESH_BINARY)\nshow(binary, "Threshold")`,
hand:`from zebjus_ai import HandDetector\n\nhand = HandDetector()\nresult = hand.read()\n\nprint("Detected:", result.detected)\nprint("Fingers:", result.fingers)\nprint("Side:", result.side)`,
handLed:`from zebjus import LED\nfrom zebjus_ai import HandDetector\n\nled = LED(1)\nresult = HandDetector().read()\n\nif result.detected and result.fingers >= 4:\n    led.on()\n    print("LED ON")\nelse:\n    led.off()\n    print("LED OFF")`,
led:`from zebjus import LED, sleep\n\nled = LED(1)\n\nfor i in range(5):\n    led.on()\n    sleep(0.5)\n    led.off()\n    sleep(0.5)\n\nprint("Blink complete")`,
servo:`from zebjus import Servo, sleep\n\nservo = Servo(1)\n\nfor angle in [0, 45, 90, 135, 180, 90]:\n    servo.write(angle)\n    sleep(0.5)`,
motor:`from zebjus import Motor, sleep\n\nmotor = Motor(1)\nmotor.forward(50)\nsleep(2)\nmotor.stop()\nprint("Motor stopped")`
};

const generic=[
["and","keyword"],["as","keyword"],["assert","keyword"],["async","keyword"],["await","keyword"],["break","keyword"],["class","keyword"],["continue","keyword"],["def","keyword"],["del","keyword"],["elif","keyword"],["else","keyword"],["except","keyword"],["False","keyword"],["finally","keyword"],["for","keyword"],["from","keyword"],["global","keyword"],["if","keyword"],["import","keyword"],["in","keyword"],["is","keyword"],["lambda","keyword"],["None","keyword"],["not","keyword"],["or","keyword"],["pass","keyword"],["raise","keyword"],["return","keyword"],["True","keyword"],["try","keyword"],["while","keyword"],["with","keyword"],["yield","keyword"],
["print","function","print(${1})"],["input","function",'input("${1:Prompt: }")'],["range","function","range(${1:5})"],["len","function","len(${1})"],["int","function","int(${1})"],["float","function","float(${1})"],["str","function","str(${1})"],["list","function","list(${1})"],["dict","function","dict(${1})"],["sum","function","sum(${1})"],["min","function","min(${1})"],["max","function","max(${1})"],["enumerate","function","enumerate(${1})"],
["LED","class","LED(${1:1})"],["Motor","class","Motor(${1:1})"],["Servo","class","Servo(${1:1})"],["Camera","class","Camera(${1:0})"],["HandDetector","class","HandDetector()"],["sleep","function","sleep(${1:1})"],
["cv2","module"],["np","module"]
];

const dotted={
cv2:[
["cvtColor","function","cvtColor(${1:src}, ${2:cv2.COLOR_BGR2GRAY})"],["Canny","function","Canny(${1:image}, ${2:80}, ${3:160})"],["threshold","function","threshold(${1:src}, ${2:120}, ${3:255}, ${4:cv2.THRESH_BINARY})"],["resize","function","resize(${1:image}, (${2:320}, ${3:240}))"],["GaussianBlur","function","GaussianBlur(${1:image}, (${2:5}, ${3:5}), ${4:0})"],["rectangle","function","rectangle(${1:image}, (${2:x1}, ${3:y1}), (${4:x2}, ${5:y2}), (${6:0}, ${7:255}, ${8:0}), ${9:2})"],["putText","function"],["COLOR_BGR2GRAY","constant"],["COLOR_BGR2RGB","constant"],["THRESH_BINARY","constant"],["RETR_EXTERNAL","constant"],["CHAIN_APPROX_SIMPLE","constant"]
],
led:[["on","method","on()"],["off","method","off()"],["blink","method","blink(${1:5}, ${2:0.5})"]],
motor:[["forward","method","forward(${1:50})"],["backward","method","backward(${1:50})"],["stop","method","stop()"]],
servo:[["write","method","write(${1:90})"]],
hand:[["read","method","read()"]],
result:[["detected","property"],["fingers","property"],["side","property"]],
cam:[["read","method","read()"]]
};

function completionSource(context){
  const pos=context.pos,line=context.state.doc.lineAt(pos),before=line.text.slice(0,pos-line.from);
  const dot=before.match(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/);
  let prefix="",items=generic;
  if(dot){const base=dot[1],p=dot[2]||"";prefix=p;items=dotted[base]||[];}
  else{const m=before.match(/([A-Za-z_]\w*)$/);if(!m&&!context.explicit)return null;prefix=m?.[1]||"";}
  const filtered=items.filter(x=>x[0].startsWith(prefix));
  if(!filtered.length)return null;
  return{
    from:pos-prefix.length,
    filter:false,
    options:filtered.map(([label,type,apply])=>({label,type,apply:apply||label,detail:type}))
  };
}

const theme=EditorView.theme({
  "&":{height:"100%",backgroundColor:"#0a101c",color:"#edf3ff"},
  ".cm-content":{caretColor:"#ffffff"},
  "&.cm-focused .cm-cursor":{borderLeftColor:"#ffffff"},
  ".cm-selectionBackground,.cm-content ::selection":{backgroundColor:"#294675!important"},
  ".cm-tooltip":{backgroundColor:"#111a2d",color:"#edf3ff",border:"1px solid #2a3959"},
  ".cm-tooltip-autocomplete ul li[aria-selected]":{backgroundColor:"#294675",color:"#fff"}
},{dark:true});

function initEditor(){
  const saved=localStorage.getItem("zebjus.lab.code")||examples.hello;
  view=new EditorView({
    state:EditorState.create({
      doc:saved,
      extensions:[
        basicSetup,python(),theme,
        autocompletion({override:[completionSource],activateOnTyping:true,maxRenderedOptions:14}),
        keymap.of([...completionKeymap,indentWithTab]),
        EditorView.updateListener.of(u=>{
          if(u.docChanged){
            $("saveState").textContent="Saving…";
            clearTimeout(window.__saveTimer);
            window.__saveTimer=setTimeout(()=>{localStorage.setItem("zebjus.lab.code",u.state.doc.toString());$("saveState").textContent="Saved";},250);
          }
        })
      ]
    }),
    parent:$("editor")
  });
}

function code(){return view.state.doc.toString();}
function setCode(text){view.dispatch({changes:{from:0,to:view.state.doc.length,insert:text}});view.focus();}
function log(text){terminal.textContent+=(terminal.textContent?"\n":"")+String(text);terminal.scrollTop=terminal.scrollHeight;}
function badge(el,text,mode=""){el.textContent=text;el.className="badge"+(mode?" "+mode:"");}

function createWorker(){
  if(worker)worker.terminate();
  const v=cfg.pyodideVersion||"314.0.6";
  worker=new Worker("./py-worker.js");
  worker.postMessage({type:"init",pyodideVersion:v});
  badge($("pythonStatus"),"Python loading…","warn");
  worker.onmessage=e=>{
    const m=e.data||{};
    if(m.type==="ready"){badge($("pythonStatus"),"Python ready","ok");log("Python ready.");}
    else if(m.type==="status"){badge($("pythonStatus"),m.text,m.mode||"warn");}
    else if(m.type==="stdout"&&m.text!=="")log(m.text);
    else if(m.type==="stderr"&&m.text!=="")log("ERROR: "+m.text);
    else if(m.type==="error"){running=false;log("ERROR: "+m.text);badge($("pythonStatus"),"Python ready","ok");}
    else if(m.type==="done"){running=false;log("Program finished.");badge($("pythonStatus"),"Python ready","ok");}
    else if(m.type==="kit-command")handleKit(m.payload);
    else if(m.type==="image")showImage(m.dataUrl,m.title);
  };
  worker.onerror=e=>{running=false;log("Worker error: "+e.message);badge($("pythonStatus"),"Python error");};
}

async function enumerateCameras(){
  try{
    const devices=await navigator.mediaDevices?.enumerateDevices?.()||[];
    cameras=devices.filter(d=>d.kind==="videoinput");
    const select=$("cameraSelect"),selected=select.value;
    select.innerHTML="";
    if(!cameras.length){
      const o=document.createElement("option");o.value="";o.textContent="Camera 0 (default)";select.appendChild(o);
    }else cameras.forEach((d,i)=>{
      const o=document.createElement("option");o.value=d.deviceId;o.dataset.index=i;o.textContent=`Camera ${i}${d.label?" — "+d.label:""}`;select.appendChild(o);
    });
    if([...select.options].some(o=>o.value===selected))select.value=selected;
    updateCameraLabel();
  }catch(e){log("Camera list: "+e.message);}
}

function indexFromCode(text){
  const m=text.match(/\bCamera\s*\(\s*(\d+)\s*\)/);
  return m?Number(m[1]):null;
}

function selectCameraIndex(i){
  if(!Number.isInteger(i)||i<0)return;
  if(cameras[i])$("cameraSelect").value=cameras[i].deviceId;
  updateCameraLabel(i);
}

function updateCameraLabel(forced=null){
  let idx=forced;
  if(idx===null){
    const o=$("cameraSelect").selectedOptions[0];
    idx=o?.dataset?.index!==undefined?Number(o.dataset.index):0;
  }
  $("cameraIndexLabel").textContent="Index "+(Number.isInteger(idx)?idx:0);
}

async function startCamera(index=null){
  if(index!==null)selectCameraIndex(index);
  const deviceId=$("cameraSelect").value||"";
  try{
    badge($("aiStatus"),"Starting camera…","warn");
    await window.ZebjusAI.start(video,overlay,deviceId);
    cameraRunning=true;placeholder.style.display="none";badge($("aiStatus"),"Camera + AI","ok");
    await enumerateCameras();
    if(index!==null)selectCameraIndex(index);
    log("Camera started.");
    return true;
  }catch(e){
    cameraRunning=false;badge($("aiStatus"),"Camera error");
    log("Camera error: "+(e?.message||e));
    return false;
  }
}

function stopCamera(){
  window.ZebjusAI?.stop(video,overlay);cameraRunning=false;placeholder.style.display="grid";badge($("aiStatus"),"Camera off");
}

function captureFrame(){
  if(!cameraRunning||video.readyState<2)return null;
  const w=cfg.cameraCaptureWidth||320,h=cfg.cameraCaptureHeight||240,c=document.createElement("canvas");
  c.width=w;c.height=h;
  const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(video,0,0,w,h);
  const im=x.getImageData(0,0,w,h);
  return{width:w,height:h,data:Array.from(im.data)};
}

async function runCode(){
  if(running){log("Program is already running. Press Stop first.");return;}
  const src=code(),needsCamera=/\bzebjus_ai\b|\bHandDetector\b|\bzebjus_cv\b|\bCamera\s*\(/.test(src);
  const requested=indexFromCode(src);
  terminal.textContent="";running=true;

  if($("autoCamera").checked){
    const ok=cameraRunning?(requested!==null?(stopCamera(),await startCamera(requested)):true):await startCamera(requested);
    if(!ok&&needsCamera){running=false;log("Program stopped because this example needs a camera.");return;}
  }else if(requested!==null&&cameras[requested])selectCameraIndex(requested);

  if(cameraRunning)await new Promise(r=>setTimeout(r,180));
  aiState=window.ZebjusAI?.getSnapshot?.()||aiState;
  const frame=captureFrame();

  badge($("pythonStatus"),"Running…","warn");
  worker.postMessage({
    type:"run",code:src,stdin:$("stdinBox").value||"",aiState,frame
  });
}

function stopProgram(){
  running=false;createWorker();stopCamera();
  applyDemo({command:"LED_SET",id:1,value:0});applyDemo({command:"MOTOR_SET",id:1,speed:0});
  log("Stopped. Camera off.");
}

function connectKit(){
  if($("demoMode").checked){badge($("kitStatus"),"Demo kit","ok");log("Demo kit connected.");return;}
  const url=$("wsUrl").value.trim(),kitId=$("kitId").value.trim();
  if(!url.startsWith("wss://")){log("Use a secure wss:// WebSocket URL.");return;}
  try{
    ws=new WebSocket(url);
    ws.onopen=()=>{ws.send(JSON.stringify({type:"hello",kitId}));badge($("kitStatus"),"Kit connected","ok");};
    ws.onmessage=e=>log("KIT → "+e.data);
    ws.onerror=()=>log("WebSocket error.");
    ws.onclose=()=>badge($("kitStatus"),"Kit disconnected");
  }catch(e){log("Connection error: "+e.message);}
}
function disconnectKit(){if(ws){ws.close();ws=null;}badge($("kitStatus"),"Kit disconnected");}
function handleKit(p){if(!p)return;if($("demoMode").checked){applyDemo(p);log("DEMO → "+JSON.stringify(p));}else if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify({type:"command",kitId:$("kitId").value.trim(),...p}));}}
function applyDemo(p){
  if(p.command==="LED_SET"&&+p.id===1)$("demoLed").classList.toggle("on",+p.value===1);
  if(p.command==="MOTOR_SET"&&+p.id===1){const s=Math.max(-100,Math.min(100,+p.speed||0));$("motorMeter").style.width=Math.abs(s)+"%";$("motorLabel").textContent=`Motor ${s}%`;}
  if(p.command==="SERVO_SET"&&+p.id===1){const a=Math.max(0,Math.min(180,+p.angle||0));$("servoNeedle").style.transform=`rotate(${a-90}deg)`;$("servoLabel").textContent=`Servo ${a}°`;}
}

function showImage(dataUrl,title="Image"){
  $("resultImage").src=dataUrl;$("resultImage").style.display="block";
  document.querySelector(".image-placeholder").style.display="none";
  switchOutput("imageView");
}

function switchOutput(id){
  document.querySelectorAll(".output-view").forEach(x=>x.classList.toggle("active",x.id===id));
  document.querySelectorAll(".output-tab").forEach(x=>x.classList.toggle("active",x.dataset.output===id));
}

function setupPanels(){
  document.querySelectorAll(".side-tab").forEach(b=>b.onclick=()=>{
    document.querySelectorAll(".side-tab").forEach(x=>x.classList.toggle("active",x===b));
    document.querySelectorAll(".side-panel").forEach(x=>x.classList.toggle("active",x.id===b.dataset.panel));
  });
  document.querySelectorAll(".output-tab").forEach(b=>b.onclick=()=>switchOutput(b.dataset.output));
  document.querySelectorAll("[data-mobile]").forEach(b=>b.onclick=()=>{
    const side=$(".sidebar");
  });
}

function openMobilePanel(panelId){
  const sidebar=document.querySelector(".sidebar"),dock=document.querySelector(".camera-dock");
  if(panelId==="cameraPanel"){
    sidebar.classList.remove("mobile-open");dock.classList.toggle("mobile-camera-open");return;
  }
  dock.classList.remove("mobile-camera-open");sidebar.classList.add("mobile-open");
  document.querySelectorAll(".side-panel").forEach(x=>x.classList.toggle("mobile-active",x.id===panelId));
}

window.addEventListener("zebjus-ai-state",e=>{
  const d=e.detail||{};aiState={detected:!!d.detected,fingers:+d.fingers||0,side:d.side||""};
  $("handDetected").textContent=aiState.detected?"Yes":"No";$("fingerCount").textContent=aiState.fingers;$("handSide").textContent=aiState.side||"—";
});

$("loadExampleBtn").onclick=()=>setCode(examples[$("exampleSelect").value]||examples.hello);
$("resetBtn").onclick=()=>setCode(examples.hello);
$("runBtn").onclick=runCode;$("mobileRun").onclick=runCode;$("stopBtn").onclick=stopProgram;
$("clearBtn").onclick=()=>terminal.textContent="";
$("refreshCameraBtn").onclick=enumerateCameras;$("startCameraBtn").onclick=()=>startCamera();$("stopCameraBtn").onclick=stopCamera;
$("cameraSelect").onchange=updateCameraLabel;
$("connectBtn").onclick=connectKit;$("disconnectBtn").onclick=disconnectKit;
$("fullscreenBtn").onclick=()=>window.open(location.href.split("?")[0],"_blank","noopener");
document.querySelectorAll("[data-mobile]").forEach(b=>b.onclick=()=>openMobilePanel(b.dataset.mobile));
document.addEventListener("click",e=>{
  if(innerWidth>800)return;
  const sidebar=document.querySelector(".sidebar");
  if(sidebar.classList.contains("mobile-open")&&!sidebar.contains(e.target)&&!e.target.closest("[data-mobile]"))sidebar.classList.remove("mobile-open");
});

if(new URLSearchParams(location.search).get("embed")==="1")document.body.classList.add("embed");
$("kitId").value=cfg.defaultKitId||"ZB-000123";$("wsUrl").value=cfg.websocketUrl||"";
initEditor();createWorker();enumerateCameras();
