(function(){
  const $=id=>document.getElementById(id);
  const cfg=window.ZEBJUS_CONFIG||{};
  const video=$("cameraVideo"),overlay=$("cameraOverlay"),terminal=$("terminal");
  let editor=null,worker=null,ws=null,running=false,cameraRunning=false,cameras=[],aiState={detected:false,fingers:0,side:""};

  const defaults={autoCamera:true,demoMode:true,kitId:"ZB-000123",wsUrl:"",cameraIndex:0,fontSize:14,autoSave:true,stdin:""};
  function getSettings(){let s={};try{s=JSON.parse(localStorage.getItem("zebjus.lab.settings")||"{}");}catch(e){}return {...defaults,...s};}
  let prefs=getSettings();

  const examples={
    hello:`print("Hello, ZEBJUS!")`,
    variables:`name = "Anna"\nage = 14\nscore = 92.5\n\nprint(name)\nprint(age)\nprint(score)`,
    input:`name = input("Enter your name: ")\nage = int(input("Enter your age: "))\n\nprint("Hello", name)\nprint("Next year you will be", age + 1)`,
    ifelse:`mark = 78\n\nif mark >= 80:\n    print("Excellent")\nelif mark >= 50:\n    print("Pass")\nelse:\n    print("Try again")`,
    forloop:`for i in range(1, 6):\n    print("Count:", i)`,
    whileloop:`count = 1\n\nwhile count <= 5:\n    print("Count:", count)\n    count += 1`,
    function:`def add(a, b):\n    return a + b\n\nanswer = add(10, 20)\nprint("Answer =", answer)`,
    list:`fruits = ["apple", "orange", "mango"]\n\nfor fruit in fruits:\n    print(fruit)`,
    cvGray:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\nshow(gray, "Grayscale")`,
    cvEdges:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\nedges = cv2.Canny(gray, 80, 160)\nshow(edges, "Canny Edges")`,
    cvBlur:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\nblurred = cv2.GaussianBlur(frame, (15, 15), 0)\nshow(blurred, "Gaussian Blur")`,
    cvThreshold:`from zebjus_cv import Camera, show\nimport cv2\n\nframe = Camera(0).read()\ngray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)\n_, binary = cv2.threshold(gray, 120, 255, cv2.THRESH_BINARY)\nshow(binary, "Threshold")`,
    hand:`from zebjus_ai import HandDetector\n\nresult = HandDetector().read()\nprint("Detected:", result.detected)\nprint("Fingers:", result.fingers)\nprint("Side:", result.side)`,
    handLed:`from zebjus import LED\nfrom zebjus_ai import HandDetector\n\nled = LED(1)\nresult = HandDetector().read()\n\nif result.detected and result.fingers >= 4:\n    led.on()\n    print("LED ON")\nelse:\n    led.off()\n    print("LED OFF")`,
    led:`from zebjus import LED, sleep\n\nled = LED(1)\n\nfor i in range(5):\n    led.on()\n    sleep(0.5)\n    led.off()\n    sleep(0.5)\n\nprint("Blink complete")`,
    servo:`from zebjus import Servo, sleep\n\nservo = Servo(1)\nfor angle in [0, 45, 90, 135, 180, 90]:\n    servo.write(angle)\n    sleep(0.5)`,
    motor:`from zebjus import Motor, sleep\n\nmotor = Motor(1)\nmotor.forward(50)\nsleep(2)\nmotor.stop()\nprint("Motor stopped")`
  };

  const libraries=[
    ["cv2","module","OpenCV image processing"],
    ["numpy","module","Numerical arrays and mathematics"],
    ["math","module","Python mathematics"],
    ["random","module","Random numbers"],
    ["statistics","module","Statistics"],
    ["json","module","JSON"],
    ["re","module","Regular expressions"],
    ["time","module","Time utilities"],
    ["zebjus","module","ZEBJUS hardware"],
    ["zebjus_ai","module","MediaPipe AI bridge"],
    ["zebjus_cv","module","Browser camera/OpenCV bridge"]
  ];

  const base=[
    ["and","keyword"],["as","keyword"],["assert","keyword"],["async","keyword"],["await","keyword"],["break","keyword"],["class","keyword"],["continue","keyword"],["def","keyword"],["del","keyword"],["elif","keyword"],["else","keyword"],["except","keyword"],["False","keyword"],["finally","keyword"],["for","keyword"],["from","keyword"],["global","keyword"],["if","keyword"],["import","keyword"],["in","keyword"],["is","keyword"],["lambda","keyword"],["None","keyword"],["not","keyword"],["or","keyword"],["pass","keyword"],["raise","keyword"],["return","keyword"],["True","keyword"],["try","keyword"],["while","keyword"],["with","keyword"],["yield","keyword"],
    ["print()","function","print()","Display output"],["input()","function","input()","Read Program Input"],["range()","function","range()","Integer sequence"],["len()","function","len()","Length"],["int()","function","int()","Integer conversion"],["float()","function","float()","Float conversion"],["str()","function","str()","String conversion"],["list()","function","list()","List"],["dict()","function","dict()","Dictionary"],["set()","function","set()","Set"],["tuple()","function","tuple()","Tuple"],["sum()","function","sum()","Sum"],["min()","function","min()","Minimum"],["max()","function","max()","Maximum"],["abs()","function","abs()","Absolute value"],["round()","function","round()","Round"],["enumerate()","function","enumerate()","Index + value"],["zip()","function","zip()","Combine iterables"],["sorted()","function","sorted()","Sorted list"],["type()","function","type()","Object type"],
    ["LED()","class","LED()","ZEBJUS LED"],["Motor()","class","Motor()","ZEBJUS motor"],["Servo()","class","Servo()","ZEBJUS servo"],["Camera()","class","Camera()","Browser camera"],["HandDetector()","class","HandDetector()","MediaPipe hand detector"],["sleep()","function","sleep()","Pause program"],["show()","function","show()","Display OpenCV image"],
    ["cv2","module","cv2","OpenCV module"],["np","module","np","NumPy alias"],["math","module","math","Math module"],["random","module","random","Random module"],
    ["for loop","snippet","for i in range(5):\n    print(i)","For loop template"],
    ["while loop","snippet","while True:\n    pass","While loop template"],
    ["if / else","snippet","if condition:\n    pass\nelse:\n    pass","Condition template"],
    ["function","snippet","def function_name():\n    pass","Function template"],
    ["try / except","snippet","try:\n    pass\nexcept Exception as e:\n    print(e)","Exception template"]
  ];

  const moduleMembers={
    zebjus:[["LED","class","LED","LED class"],["Motor","class","Motor","Motor class"],["Servo","class","Servo","Servo class"],["sleep","function","sleep","Pause function"]],
    zebjus_ai:[["HandDetector","class","HandDetector","Hand detector"],["HandResult","class","HandResult","Hand result"]],
    zebjus_cv:[["Camera","class","Camera","Browser camera"],["show","function","show","Display image"]],
    cv2:[["cvtColor","function","cvtColor","Convert color"],["Canny","function","Canny","Canny edges"],["threshold","function","threshold","Threshold"],["resize","function","resize","Resize"],["GaussianBlur","function","GaussianBlur","Blur"],["rectangle","function","rectangle","Draw rectangle"],["circle","function","circle","Draw circle"],["putText","function","putText","Draw text"]],
    numpy:[["array","function","array","Create array"],["zeros","function","zeros","Zeros"],["ones","function","ones","Ones"],["arange","function","arange","Range"],["mean","function","mean","Mean"]]
  };

  const members={
    cv2:[
      ["cvtColor()","function","cvtColor()","Convert color space"],["Canny()","function","Canny()","Canny edge detector"],["threshold()","function","threshold()","Threshold"],["resize()","function","resize()","Resize"],["GaussianBlur()","function","GaussianBlur()","Gaussian blur"],["medianBlur()","function","medianBlur()","Median blur"],["rectangle()","function","rectangle()","Rectangle"],["circle()","function","circle()","Circle"],["line()","function","line()","Line"],["putText()","function","putText()","Text"],["findContours()","function","findContours()","Find contours"],["contourArea()","function","contourArea()","Contour area"],["boundingRect()","function","boundingRect()","Bounding box"],
      ["COLOR_BGR2GRAY","constant","COLOR_BGR2GRAY","BGR → Gray"],["COLOR_BGR2RGB","constant","COLOR_BGR2RGB","BGR → RGB"],["THRESH_BINARY","constant","THRESH_BINARY","Binary threshold"],["THRESH_BINARY_INV","constant","THRESH_BINARY_INV","Inverse threshold"],["RETR_EXTERNAL","constant","RETR_EXTERNAL","External contours"],["RETR_TREE","constant","RETR_TREE","Contour tree"],["CHAIN_APPROX_SIMPLE","constant","CHAIN_APPROX_SIMPLE","Contour approximation"],["FONT_HERSHEY_SIMPLEX","constant","FONT_HERSHEY_SIMPLEX","Font"]
    ],
    np:[["array()","function","array()","Create array"],["asarray()","function","asarray()","Convert array"],["zeros()","function","zeros()","Zeros"],["ones()","function","ones()","Ones"],["arange()","function","arange()","Range"],["linspace()","function","linspace()","Even spacing"],["mean()","function","mean()","Mean"],["sum()","function","sum()","Sum"],["min()","function","min()","Min"],["max()","function","max()","Max"],["sqrt()","function","sqrt()","Square root"],["clip()","function","clip()","Clip"],["uint8","constant","uint8","8-bit type"],["float32","constant","float32","Float type"]],
    math:[["sqrt()","function","sqrt()","Square root"],["sin()","function","sin()","Sine"],["cos()","function","cos()","Cosine"],["tan()","function","tan()","Tangent"],["radians()","function","radians()","Degrees → radians"],["degrees()","function","degrees()","Radians → degrees"],["floor()","function","floor()","Floor"],["ceil()","function","ceil()","Ceiling"],["pi","constant","pi","Pi"],["e","constant","e","Euler"]],
    random:[["randint()","function","randint()","Random integer"],["random()","function","random()","Random float"],["choice()","function","choice()","Random item"],["shuffle()","function","shuffle()","Shuffle"]],
    LED:[["on()","method","on()","Turn LED on"],["off()","method","off()","Turn LED off"],["blink()","method","blink()","Blink LED"]],
    Motor:[["forward()","method","forward()","Forward"],["backward()","method","backward()","Backward"],["stop()","method","stop()","Stop"]],
    Servo:[["write()","method","write()","Set angle"]],
    HandDetector:[["read()","method","read()","Latest AI snapshot"]],
    HandResult:[["detected","property","detected","Detected"],["fingers","property","fingers","Finger count"],["side","property","side","Left/Right"]],
    Camera:[["read()","method","read()","Camera frame"]]
  };

  function inferType(code,name){
    const esc=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const patterns=[
      ["LED",new RegExp("\\b"+esc+"\\s*=\\s*LED\\s*\\(")],
      ["Motor",new RegExp("\\b"+esc+"\\s*=\\s*Motor\\s*\\(")],
      ["Servo",new RegExp("\\b"+esc+"\\s*=\\s*Servo\\s*\\(")],
      ["Camera",new RegExp("\\b"+esc+"\\s*=\\s*Camera\\s*\\(")],
      ["HandDetector",new RegExp("\\b"+esc+"\\s*=\\s*HandDetector\\s*\\(")],
      ["HandResult",new RegExp("\\b"+esc+"\\s*=\\s*(?:HandDetector\\s*\\(\\s*\\)|\\w+)\\.read\\s*\\(")]
    ];
    for(const [type,re] of patterns)if(re.test(code))return type;
    if(name==="cv2"||name==="np"||name==="math"||name==="random")return name;
    if(name==="led")return "LED";if(name==="motor")return "Motor";if(name==="servo")return "Servo";if(name==="hand")return "HandDetector";if(name==="result")return "HandResult";if(name==="cam")return "Camera";
    return null;
  }

  function hintItem(entry){
    const [label,type,text,info]=entry;
    return {text:text||label,displayText:label+(info?"   — "+info:""),className:"hint-"+type};
  }

  function filterItems(items,prefix){
    return items.filter(x=>{
      const label=x[0].replace(/\(\)$/,"");
      return label.startsWith(prefix);
    }).map(hintItem);
  }

  function hintProvider(cm){
    const cur=cm.getCursor();
    const line=cm.getLine(cur.line).slice(0,cur.ch);
    const full=cm.getValue();
    let m,prefix="",items=[];

    m=line.match(/^\s*import\s+([A-Za-z_]\w*)?$/);
    if(m){prefix=m[1]||"";items=libraries;return {list:filterItems(items,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};}

    m=line.match(/^\s*from\s+([A-Za-z_]\w*)?$/);
    if(m){prefix=m[1]||"";items=libraries;return {list:filterItems(items,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};}

    m=line.match(/^\s*from\s+(zebjus|zebjus_ai|zebjus_cv|cv2|numpy)\s+import\s+([A-Za-z_]\w*)?$/);
    if(m){prefix=m[2]||"";items=moduleMembers[m[1]]||[];return {list:filterItems(items,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};}

    m=line.match(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/);
    if(m){
      const obj=m[1];prefix=m[2]||"";
      const type=inferType(full,obj);
      items=members[type]||[];
      return {list:filterItems(items,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};
    }

    m=line.match(/([A-Za-z_]\w*)$/);
    prefix=m?.[1]||"";
    items=filterItems(base,prefix);
    return {list:items,from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};
  }

  function initEditor(){
    if(typeof window.CodeMirror==="undefined"){
      $("editorLoadError").hidden=false;
      return false;
    }

    CodeMirror.registerHelper("hint","zebjusPython",hintProvider);
    const saved=prefs.autoSave?localStorage.getItem("zebjus.lab.code"):null;
    $("codeEditor").value=saved||examples.hello;

    editor=CodeMirror.fromTextArea($("codeEditor"),{
      mode:"python",
      theme:"zebjus",
      lineNumbers:true,
      indentUnit:4,
      tabSize:4,
      indentWithTabs:false,
      smartIndent:true,
      lineWrapping:false,
      matchBrackets:true,
      autoCloseBrackets:true,
      styleActiveLine:true,
      extraKeys:{
        "Ctrl-Space":function(cm){cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false});},
        "Cmd-Space":function(cm){cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false});},
        "Tab":function(cm){
          if(cm.somethingSelected())cm.indentSelection("add");
          else cm.replaceSelection("    ","end","+input");
        }
      }
    });

    editor.getWrapperElement().style.setProperty("--editor-font",(prefs.fontSize||14)+"px");
    editor.getWrapperElement().style.fontSize=(prefs.fontSize||14)+"px";

    editor.on("change",function(cm,change){
      if(prefs.autoSave){
        $("saveState").textContent="Saving…";
        clearTimeout(window.__zSave);
        window.__zSave=setTimeout(()=>{localStorage.setItem("zebjus.lab.code",cm.getValue());$("saveState").textContent="Saved";},250);
      }

      if(change.origin!=="+input" && change.origin!=="paste")return;
      const typed=(change.text||[]).join("\n");
      const cur=cm.getCursor();
      const left=cm.getLine(cur.line).slice(0,cur.ch);
      const trigger=/[A-Za-z0-9_.]$/.test(typed)||/\b(?:import|from)\s+$/.test(left)||/\bimport\s+$/.test(left);
      if(trigger && !cm.state.completionActive){
        setTimeout(()=>cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false}),0);
      }
    });
    return true;
  }

  function getCode(){return editor?editor.getValue():$("codeEditor").value;}
  function setCode(t){if(editor){editor.setValue(t);editor.focus();}else $("codeEditor").value=t;}
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
    const i=index!==null?index:Number(prefs.cameraIndex)||0;
    const deviceId=cameras[i]?.deviceId||"";
    try{
      badge($("aiStatus"),"Camera starting…","warn");
      await window.ZebjusAI.start(video,overlay,deviceId);
      cameraRunning=true;
      $("cameraPlaceholder").style.display="none";
      $("cameraToggleBtn").textContent="Stop";
      $("cameraIndexText").textContent="Camera "+i;
      badge($("aiStatus"),"Camera + AI","ok");
      await enumerateCameras();
      return true;
    }catch(e){
      cameraRunning=false;
      badge($("aiStatus"),"Camera error");
      log("Camera error: "+(e?.message||e));
      return false;
    }
  }

  function stopCamera(){
    window.ZebjusAI?.stop(video,overlay);
    cameraRunning=false;
    $("cameraPlaceholder").style.display="grid";
    $("cameraToggleBtn").textContent="Start";
    badge($("aiStatus"),"Camera off");
  }

  function captureFrame(){
    if(!cameraRunning||video.readyState<2)return null;
    const c=document.createElement("canvas"),w=cfg.cameraCaptureWidth||320,h=cfg.cameraCaptureHeight||240;
    c.width=w;c.height=h;
    const x=c.getContext("2d",{willReadFrequently:true});
    x.drawImage(video,0,0,w,h);
    return {width:w,height:h,data:Array.from(x.getImageData(0,0,w,h).data)};
  }

  async function runCode(){
    if(running){log("Program already running. Press Stop first.");return;}
    const src=getCode();
    const needsCamera=/\bzebjus_ai\b|\bHandDetector\b|\bzebjus_cv\b|\bCamera\s*\(|\bimport\s+cv2\b/.test(src);
    const idx=requestedCamera(src);
    terminal.textContent="";
    running=true;

    if(prefs.autoCamera){
      if(cameraRunning)stopCamera();
      const ok=await startCamera(idx);
      if(!ok&&needsCamera){running=false;log("Program stopped because this project needs the camera.");return;}
      if(ok)await new Promise(r=>setTimeout(r,220));
    }

    aiState=window.ZebjusAI?.getSnapshot?.()||aiState;
    badge($("pythonStatus"),"Running…","warn");
    worker.postMessage({type:"run",code:src,stdin:prefs.stdin||"",aiState,frame:captureFrame()});
  }

  function stopProgram(){
    running=false;
    createWorker();
    stopCamera();
    applyDemo({command:"LED_SET",id:1,value:0});
    applyDemo({command:"MOTOR_SET",id:1,speed:0});
    log("Stopped.");
  }

  function handleKit(p){
    if(!p)return;
    if(prefs.demoMode){applyDemo(p);log("DEMO → "+JSON.stringify(p));}
    else if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"command",kitId:prefs.kitId,...p}));
    else log("Kit not connected.");
  }

  function applyDemo(p){
    if(p.command==="LED_SET"&&+p.id===1){
      const on=+p.value===1;
      $("demoLed").classList.toggle("on",on);
      $("ledLabel").textContent=on?"ON":"OFF";
    }
    if(p.command==="MOTOR_SET"&&+p.id===1){
      const s=Math.max(-100,Math.min(100,+p.speed||0));
      $("motorMeter").style.width=Math.abs(s)+"%";
      $("motorLabel").textContent=s===0?"Stopped":`${s>0?"Forward":"Backward"} ${Math.abs(s)}%`;
    }
    if(p.command==="SERVO_SET"&&+p.id===1){
      const a=Math.max(0,Math.min(180,+p.angle||0));
      $("servoNeedle").style.transform=`rotate(${a-90}deg)`;
      $("servoLabel").textContent=a+"°";
    }
  }

  function connectRealKit(){
    if(prefs.demoMode)return;
    if(!prefs.wsUrl?.startsWith("wss://")){log("Set the secure WebSocket URL in Settings.");return;}
    try{
      ws=new WebSocket(prefs.wsUrl);
      ws.onopen=()=>{ws.send(JSON.stringify({type:"hello",kitId:prefs.kitId}));badge($("kitStatus"),"Kit connected","ok");};
      ws.onmessage=e=>log("KIT → "+e.data);
      ws.onerror=()=>log("WebSocket error.");
      ws.onclose=()=>badge($("kitStatus"),"Kit disconnected");
    }catch(e){log("Kit connection error: "+e.message);}
  }

  function showImage(url){
    $("resultImage").src=url;
    $("resultImage").style.display="block";
    $("imagePlaceholder").style.display="none";
    switchOutput("imageOutput");
  }

  function switchOutput(id){
    document.querySelectorAll(".output-view").forEach(x=>x.classList.toggle("active",x.id===id));
    document.querySelectorAll(".output-tab").forEach(x=>x.classList.toggle("active",x.dataset.view===id));
  }

  window.addEventListener("zebjus-ai-state",e=>{
    const d=e.detail||{};
    aiState={detected:!!d.detected,fingers:+d.fingers||0,side:d.side||""};
    $("handDetected").textContent=aiState.detected?"Yes":"No";
    $("fingerCount").textContent=aiState.fingers;
    $("handSide").textContent=aiState.side||"—";
  });

  $("loadExampleBtn").onclick=()=>setCode(examples[$("exampleSelect").value]||examples.hello);
  $("resetBtn").onclick=()=>setCode(examples.hello);
  $("runBtn").onclick=runCode;
  $("stopBtn").onclick=stopProgram;
  $("clearBtn").onclick=()=>terminal.textContent="";
  $("cameraToggleBtn").onclick=()=>cameraRunning?stopCamera():startCamera();
  $("autocompleteBtn").onclick=()=>editor?.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false});
  document.querySelectorAll(".output-tab").forEach(b=>b.onclick=()=>switchOutput(b.dataset.view));

  document.documentElement.style.setProperty("--editor-font",(prefs.fontSize||14)+"px");
  $("kitNameText").textContent=prefs.kitId||"ZB-000123";
  $("kitStatus").textContent=prefs.demoMode?"Demo mode":"Kit disconnected";

  initEditor();
  createWorker();
  enumerateCameras();
  connectRealKit();
})();