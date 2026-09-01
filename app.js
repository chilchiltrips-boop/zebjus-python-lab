import {EditorState} from "https://esm.sh/@codemirror/state@6.5.2";
import {EditorView,keymap} from "https://esm.sh/@codemirror/view@6.38.1";
import {basicSetup} from "https://esm.sh/codemirror@6.0.2";
import {python} from "https://esm.sh/@codemirror/lang-python@6.2.1";
import {autocompletion,completionKeymap} from "https://esm.sh/@codemirror/autocomplete@6.18.6";
import {indentWithTab} from "https://esm.sh/@codemirror/commands@6.8.1";
import {HighlightStyle,syntaxHighlighting} from "https://esm.sh/@codemirror/language@6.11.3";
import {tags} from "https://esm.sh/@lezer/highlight@1.2.1";
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

const libraryCompletions=[
  ["cv2","module","OpenCV image processing"],
  ["numpy","module","Numerical arrays and mathematics"],
  ["math","module","Python mathematics"],
  ["random","module","Random numbers and choices"],
  ["time","module","Time utilities"],
  ["statistics","module","Statistics functions"],
  ["json","module","JSON encoding / decoding"],
  ["re","module","Regular expressions"],
  ["zebjus","module","ZEBJUS hardware library"],
  ["zebjus_ai","module","ZEBJUS MediaPipe AI library"],
  ["zebjus_cv","module","ZEBJUS browser camera/OpenCV bridge"]
];

const baseCompletions=[
  ["and","keyword"],["as","keyword"],["assert","keyword"],["async","keyword"],["await","keyword"],
  ["break","keyword"],["class","keyword"],["continue","keyword"],["def","keyword"],["del","keyword"],
  ["elif","keyword"],["else","keyword"],["except","keyword"],["False","keyword"],["finally","keyword"],
  ["for","keyword"],["from","keyword"],["global","keyword"],["if","keyword"],["import","keyword"],
  ["in","keyword"],["is","keyword"],["lambda","keyword"],["None","keyword"],["not","keyword"],
  ["or","keyword"],["pass","keyword"],["raise","keyword"],["return","keyword"],["True","keyword"],
  ["try","keyword"],["while","keyword"],["with","keyword"],["yield","keyword"],

  ["print","function","print(${1})","Display a value in Output"],
  ["input","function",'input("${1:Enter value: }")',"Read text from Program Input"],
  ["range","function","range(${1:5})","Generate a sequence of integers"],
  ["len","function","len(${1})","Length of a collection"],
  ["int","function","int(${1})","Convert to integer"],
  ["float","function","float(${1})","Convert to floating-point"],
  ["str","function","str(${1})","Convert to string"],
  ["list","function","list(${1})","Create a list"],
  ["dict","function","dict(${1})","Create a dictionary"],
  ["set","function","set(${1})","Create a set"],
  ["tuple","function","tuple(${1})","Create a tuple"],
  ["sum","function","sum(${1})","Sum values"],
  ["min","function","min(${1})","Minimum value"],
  ["max","function","max(${1})","Maximum value"],
  ["abs","function","abs(${1})","Absolute value"],
  ["round","function","round(${1:value}, ${2:2})","Round a number"],
  ["enumerate","function","enumerate(${1})","Loop with index"],
  ["zip","function","zip(${1:a}, ${2:b})","Combine iterables"],
  ["sorted","function","sorted(${1})","Return sorted values"],
  ["type","function","type(${1})","Get object type"],

  ["LED","class","LED(${1:1})","ZEBJUS LED output"],
  ["Motor","class","Motor(${1:1})","ZEBJUS motor output"],
  ["Servo","class","Servo(${1:1})","ZEBJUS servo output"],
  ["Camera","class","Camera(${1:0})","Browser camera by index"],
  ["HandDetector","class","HandDetector()","MediaPipe hand detector"],
  ["sleep","function","sleep(${1:1})","Pause for seconds"],
  ["show","function","show(${1:image}, ${2:'Output'})","Display OpenCV image"],

  ["cv2","module","cv2","OpenCV module"],
  ["np","module","np","NumPy alias"],
  ["math","module","math","Python math module"],
  ["random","module","random","Python random module"],

  ["for loop","snippet","for ${1:i} in range(${2:5}):\\n    ${3:print(i)}","Python for loop"],
  ["while loop","snippet","while ${1:True}:\\n    ${2:pass}","Python while loop"],
  ["if / else","snippet","if ${1:condition}:\\n    ${2:pass}\\nelse:\\n    ${3:pass}","Python condition"],
  ["function","snippet","def ${1:function_name}(${2}):\\n    ${3:pass}","Create a function"],
  ["class template","snippet","class ${1:MyClass}:\\n    def __init__(self):\\n        ${2:pass}","Create a class"],
  ["try / except","snippet","try:\\n    ${1:pass}\\nexcept Exception as e:\\n    print(e)","Exception handling"]
];

const moduleMembers={
  zebjus:[
    ["LED","class","LED","LED output class"],
    ["Motor","class","Motor","Motor output class"],
    ["Servo","class","Servo","Servo output class"],
    ["sleep","function","sleep","Pause function"]
  ],
  zebjus_ai:[
    ["HandDetector","class","HandDetector","MediaPipe hand detector"],
    ["HandResult","class","HandResult","Hand result object"]
  ],
  zebjus_cv:[
    ["Camera","class","Camera","Browser camera wrapper"],
    ["show","function","show","Display OpenCV image"]
  ]
};

const dotted={
  cv2:[
    ["cvtColor","function","cvtColor(${1:src}, ${2:cv2.COLOR_BGR2GRAY})","Convert color space"],
    ["Canny","function","Canny(${1:image}, ${2:80}, ${3:160})","Canny edge detector"],
    ["threshold","function","threshold(${1:src}, ${2:120}, ${3:255}, ${4:cv2.THRESH_BINARY})","Image threshold"],
    ["resize","function","resize(${1:image}, (${2:320}, ${3:240}))","Resize image"],
    ["GaussianBlur","function","GaussianBlur(${1:image}, (${2:5}, ${3:5}), ${4:0})","Gaussian blur"],
    ["medianBlur","function","medianBlur(${1:image}, ${2:5})","Median blur"],
    ["rectangle","function","rectangle(${1:image}, (${2:x1}, ${3:y1}), (${4:x2}, ${5:y2}), (${6:0}, ${7:255}, ${8:0}), ${9:2})","Draw rectangle"],
    ["circle","function","circle(${1:image}, (${2:x}, ${3:y}), ${4:20}, (${5:0}, ${6:255}, ${7:0}), ${8:2})","Draw circle"],
    ["line","function","line(${1:image}, (${2:x1}, ${3:y1}), (${4:x2}, ${5:y2}), (${6:255}, ${7:0}, ${8:0}), ${9:2})","Draw line"],
    ["putText","function","putText(${1:image}, ${2:'Text'}, (${3:20}, ${4:40}), cv2.FONT_HERSHEY_SIMPLEX, ${5:1}, (${6:255}, ${7:255}, ${8:255}), ${9:2})","Draw text"],
    ["findContours","function","findContours(${1:image}, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)","Find contours"],
    ["contourArea","function","contourArea(${1:contour})","Contour area"],
    ["boundingRect","function","boundingRect(${1:contour})","Contour bounding box"],
    ["imencode","function","imencode(${1:'.png'}, ${2:image})","Encode image"],
    ["COLOR_BGR2GRAY","constant","COLOR_BGR2GRAY","BGR to grayscale"],
    ["COLOR_BGR2RGB","constant","COLOR_BGR2RGB","BGR to RGB"],
    ["COLOR_RGB2BGR","constant","COLOR_RGB2BGR","RGB to BGR"],
    ["THRESH_BINARY","constant","THRESH_BINARY","Binary threshold"],
    ["THRESH_BINARY_INV","constant","THRESH_BINARY_INV","Inverse binary threshold"],
    ["RETR_EXTERNAL","constant","RETR_EXTERNAL","External contours"],
    ["RETR_TREE","constant","RETR_TREE","Contour hierarchy"],
    ["CHAIN_APPROX_SIMPLE","constant","CHAIN_APPROX_SIMPLE","Contour compression"],
    ["FONT_HERSHEY_SIMPLEX","constant","FONT_HERSHEY_SIMPLEX","OpenCV font"]
  ],
  np:[
    ["array","function","array(${1})","Create NumPy array"],
    ["asarray","function","asarray(${1})","Convert to array"],
    ["zeros","function","zeros((${1:3}, ${2:3}))","Array of zeros"],
    ["ones","function","ones((${1:3}, ${2:3}))","Array of ones"],
    ["arange","function","arange(${1:0}, ${2:10}, ${3:1})","Numeric range"],
    ["linspace","function","linspace(${1:0}, ${2:1}, ${3:50})","Evenly spaced values"],
    ["mean","function","mean(${1})","Mean"],
    ["sum","function","sum(${1})","Sum"],
    ["min","function","min(${1})","Minimum"],
    ["max","function","max(${1})","Maximum"],
    ["sqrt","function","sqrt(${1})","Square root"],
    ["clip","function","clip(${1:a}, ${2:min}, ${3:max})","Clip values"],
    ["uint8","type","uint8","8-bit unsigned integer"],
    ["float32","type","float32","32-bit floating point"]
  ],
  math:[
    ["sqrt","function","sqrt(${1})","Square root"],
    ["sin","function","sin(${1})","Sine"],
    ["cos","function","cos(${1})","Cosine"],
    ["tan","function","tan(${1})","Tangent"],
    ["radians","function","radians(${1})","Degrees to radians"],
    ["degrees","function","degrees(${1})","Radians to degrees"],
    ["floor","function","floor(${1})","Floor"],
    ["ceil","function","ceil(${1})","Ceiling"],
    ["pi","constant","pi","Pi constant"],
    ["e","constant","e","Euler constant"]
  ],
  random:[
    ["randint","function","randint(${1:1}, ${2:10})","Random integer"],
    ["random","function","random()","Random float"],
    ["choice","function","choice(${1:list})","Random item"],
    ["shuffle","function","shuffle(${1:list})","Shuffle list"]
  ],
  led:[
    ["on","method","on()","Turn LED on"],
    ["off","method","off()","Turn LED off"],
    ["blink","method","blink(${1:5}, ${2:0.5})","Blink LED"]
  ],
  motor:[
    ["forward","method","forward(${1:50})","Motor forward"],
    ["backward","method","backward(${1:50})","Motor backward"],
    ["stop","method","stop()","Stop motor"]
  ],
  servo:[
    ["write","method","write(${1:90})","Set servo angle 0–180°"]
  ],
  result:[
    ["detected","property","detected","True when hand is detected"],
    ["fingers","property","fingers","Detected finger count"],
    ["side","property","side","Left / Right hand"]
  ],
  hand:[
    ["read","method","read()","Read latest MediaPipe result"]
  ],
  cam:[
    ["read","method","read()","Capture latest browser camera frame"]
  ]
};

function makeOptions(items,prefix,from){
  return items
    .filter(x=>x[0].startsWith(prefix))
    .map(([label,type,apply,info])=>({
      label,
      type,
      apply:apply||label,
      detail:type,
      info:info||"",
      boost:type==="snippet"?2:1
    }));
}

function completionSource(context){
  const pos=context.pos;
  const line=context.state.doc.lineAt(pos);
  const before=line.text.slice(0,pos-line.from);

  // import <library>
  let m=before.match(/^\s*import\s+([A-Za-z_]\w*)?$/);
  if(m){
    const prefix=m[1]||"";
    return {from:pos-prefix.length,filter:false,options:makeOptions(libraryCompletions,prefix,pos-prefix.length)};
  }

  // from <library>
  m=before.match(/^\s*from\s+([A-Za-z_]\w*)?$/);
  if(m){
    const prefix=m[1]||"";
    return {from:pos-prefix.length,filter:false,options:makeOptions(libraryCompletions,prefix,pos-prefix.length)};
  }

  // from zebjus import <member>
  m=before.match(/^\s*from\s+(zebjus|zebjus_ai|zebjus_cv)\s+import\s+([A-Za-z_]\w*)?$/);
  if(m){
    const prefix=m[2]||"";
    return {from:pos-prefix.length,filter:false,options:makeOptions(moduleMembers[m[1]]||[],prefix,pos-prefix.length)};
  }

  // object/module dot completion
  m=before.match(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/);
  if(m){
    const base=m[1],prefix=m[2]||"";
    const items=dotted[base]||[];
    if(items.length)return {from:pos-prefix.length,filter:false,options:makeOptions(items,prefix,pos-prefix.length)};
  }

  // Standard case-sensitive Python completion
  m=before.match(/([A-Za-z_]\w*)$/);
  if(!m&&!context.explicit)return null;
  const prefix=m?.[1]||"";
  const options=makeOptions(baseCompletions,prefix,pos-prefix.length);
  return options.length?{from:pos-prefix.length,filter:false,options}:null;
}

const pycharmHighlight=HighlightStyle.define([
  {tag:tags.keyword,color:"#ff9d57",fontWeight:"600"},
  {tag:[tags.bool,tags.null],color:"#ff9d57",fontWeight:"600"},
  {tag:[tags.string,tags.special(tags.string)],color:"#6aab73"},
  {tag:[tags.number,tags.integer,tags.float],color:"#2aacb8"},
  {tag:tags.comment,color:"#7a7e85",fontStyle:"italic"},
  {tag:[tags.function(tags.variableName),tags.function(tags.propertyName)],color:"#56a8f5"},
  {tag:[tags.className,tags.typeName],color:"#ffc66d"},
  {tag:tags.definition(tags.variableName),color:"#c9d1d9"},
  {tag:tags.variableName,color:"#c9d1d9"},
  {tag:tags.propertyName,color:"#c9d1d9"},
  {tag:tags.operator,color:"#d7ba7d"},
  {tag:tags.punctuation,color:"#a9b7c6"},
  {tag:tags.meta,color:"#bbb529"},
  {tag:tags.selfName,color:"#94558d"},
  {tag:tags.invalid,color:"#ff6b68",textDecoration:"underline"}
]);

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
      extensions:[basicSetup,python(),darkTheme,syntaxHighlighting(pycharmHighlight),autocompletion({override:[completionSource],activateOnTyping:true,maxRenderedOptions:14}),keymap.of([...completionKeymap,indentWithTab]),
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
  worker=new Worker("./py-worker.js",{type:"module"});
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
