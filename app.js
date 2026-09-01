(function(){
  const $=id=>document.getElementById(id),cfg=window.ZEBJUS_CONFIG||{};
  const video=$("cameraVideo"),overlay=$("cameraOverlay"),terminal=$("terminal");
  let editor=null,worker=null,ws=null,running=false,cameraRunning=false,currentCameraIndex=null,cameras=[];
  let aiState={detected:false,fingers:0,side:""};
  let imageFrame=null;
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

    hand:`from zebjus_ai import HandDetector\n\nresult = HandDetector().read()\nprint("Detected:", result.detected)\nprint("Fingers:", result.fingers)\nprint("Side:", result.side)`,
    handRgb:`from zebjus import RGBLED\nfrom zebjus_ai import HandDetector\n\nrgb = RGBLED(1)\nresult = HandDetector().read()\n\nprint("Hand detected:", result.detected)\nprint("Fingers:", result.fingers)\nprint("Side:", result.side)\n\n# Open palm can briefly read 4 or 5, so >= 4 is more stable.\nif result.detected and result.fingers >= 4:\n    rgb.write(0, 255, 0)\n    print("RGB LED GREEN")\nelse:\n    rgb.off()\n    print("RGB LED OFF")`,

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
    ["cv2","module","OpenCV"],["numpy","module","NumPy"],["math","module","Math"],["random","module","Random"],
    ["zebjus","module","ZEBJUS hardware"],["zebjus_ai","module","MediaPipe AI"],["zebjus_cv","module","Camera/Image OpenCV bridge"]
  ];
  const base=[
    ["and","keyword"],["as","keyword"],["break","keyword"],["class","keyword"],["continue","keyword"],["def","keyword"],["elif","keyword"],["else","keyword"],["except","keyword"],["False","keyword"],["for","keyword"],["from","keyword"],["if","keyword"],["import","keyword"],["in","keyword"],["None","keyword"],["not","keyword"],["or","keyword"],["pass","keyword"],["return","keyword"],["True","keyword"],["try","keyword"],["while","keyword"],["with","keyword"],
    ["print()","function","print()","Output"],["input()","function","input()","Program input"],["range()","function","range()","Range"],["len()","function","len()","Length"],["int()","function","int()","Integer"],["float()","function","float()","Float"],["str()","function","str()","String"],
    ["RGBLED()","class","RGBLED()","RGB LED 0–255"],["LED()","class","LED()","White compatibility LED"],["Ultrasonic()","class","Ultrasonic()","Distance cm"],["Potentiometer()","class","Potentiometer()","0–255 pot"],["Motor()","class","Motor()","Motor"],["Servo()","class","Servo()","Servo"],["Camera()","class","Camera()","Camera"],["HandDetector()","class","HandDetector()","MediaPipe"],["sleep()","function","sleep()","Delay"],["load_image()","function","load_image()","Loaded image"],["show()","function","show()","Show image"],["draw_rgb_led()","function","draw_rgb_led()","Draw RGB LED"],["draw_potentiometer()","function","draw_potentiometer()","Draw pot"],["draw_ultrasonic()","function","draw_ultrasonic()","Draw distance bar"],
    ["cv2","module","cv2","OpenCV"],["np","module","np","NumPy"]
  ];

  const moduleMembers={
    zebjus:[
      ["RGBLED","class","RGBLED","RGB LED"],["LED","class","LED","LED"],["Ultrasonic","class","Ultrasonic","Ultrasonic"],
      ["Potentiometer","class","Potentiometer","Potentiometer"],["Motor","class","Motor","Motor"],["Servo","class","Servo","Servo"],["sleep","function","sleep","Delay"]
    ],
    zebjus_ai:[["HandDetector","class","HandDetector","Hand detector"],["HandResult","class","HandResult","Hand result"]],
    zebjus_cv:[
      ["Camera","class","Camera","Camera"],["load_image","function","load_image","Loaded image"],["show","function","show","Show image"],
      ["draw_rgb_led","function","draw_rgb_led","Draw LED"],["draw_potentiometer","function","draw_potentiometer","Draw pot"],["draw_ultrasonic","function","draw_ultrasonic","Draw ultrasonic"]
    ]
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
    Camera:[["read()","method","read()","Camera frame"]]
  };

  function inferType(code,name){
    const esc=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    for(const type of ["RGBLED","LED","Ultrasonic","Potentiometer","Motor","Servo","Camera","HandDetector"]){
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

    m=line.match(/^\s*from\s+(zebjus|zebjus_ai|zebjus_cv)\s+import\s+([A-Za-z_]\w*)?$/);
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

  async function loadImageFile(file){
    if(!file)return;
    const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
    const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=dataUrl;});
    const maxW=720,maxH=520,scale=Math.min(1,maxW/img.width,maxH/img.height),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
    const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(img,0,0,w,h);
    imageFrame={width:w,height:h,data:Array.from(x.getImageData(0,0,w,h).data)};
    $("sourceImagePreview").src=dataUrl;$("sourceImagePreview").style.display="block";$("sourceImagePlaceholder").style.display="none";
    $("sourceImageInfo").textContent=`${file.name} • ${w}×${h}`;
  }

  function clearLoadedImage(){imageFrame=null;$("imageInput").value="";$("sourceImagePreview").removeAttribute("src");$("sourceImagePreview").style.display="none";$("sourceImagePlaceholder").style.display="block";$("sourceImageInfo").textContent="Use OpenCV Image Graphics examples.";}

  async function runCode(){
    if(running){log("Program already running. Press Stop first.");return;}
    const src=getCode(),needsCamera=/\bzebjus_ai\b|\bHandDetector\b|\bCamera\s*\(/.test(src),needsAI=/\bzebjus_ai\b|\bHandDetector\b/.test(src),idx=requestedCamera(src);
    terminal.textContent="";running=true;

    if(prefs.autoCamera){
      if(!cameraRunning || (idx!==null&&idx!==currentCameraIndex)){
        if(cameraRunning)stopCamera();
        const ok=await startCamera(idx);
        if(!ok&&needsCamera){running=false;log("Program stopped because this project needs a camera.");return;}
      }
    }
    if(needsAI&&cameraRunning){
      const stable=await ZebjusAI.waitForStable(1500);
      aiState={detected:!!stable.detected,fingers:Number(stable.fingers)||0,side:stable.side||""};
      log(`AI snapshot → detected=${aiState.detected}, fingers=${aiState.fingers}, side=${aiState.side||"-"}`);
    }else aiState=ZebjusAI?.getSnapshot?.()||aiState;

    if(prefs.demoMode){
      sensorState.ultrasonicCm=Number(prefs.demoUltrasonic)||45;
      sensorState.potValue=Math.max(0,Math.min(255,Number(prefs.demoPot)||0));
      sensorState.potRaw=Math.round(sensorState.potValue*4095/255);
      updateSensorGraphics();
    }

    badge($("pythonStatus"),"Running…","warn");
    worker.postMessage({type:"run",code:src,stdin:prefs.stdin||"",aiState,sensorState,frame:captureFrame(),imageFrame});
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
    const d=e.detail||{};aiState={detected:!!d.detected,fingers:Number(d.fingers)||0,side:d.side||""};
    $("handDetected").textContent=aiState.detected?"Yes":"No";$("fingerCount").textContent=aiState.fingers;$("handSide").textContent=aiState.side||"—";
  });

  $("loadExampleBtn").onclick=()=>setCode(examples[$("exampleSelect").value]||examples.hello);
  $("resetBtn").onclick=()=>setCode(examples.hello);$("runBtn").onclick=runCode;$("stopBtn").onclick=stopProgram;$("clearBtn").onclick=()=>terminal.textContent="";
  $("cameraToggleBtn").onclick=()=>cameraRunning?stopCamera():startCamera();
  $("autocompleteBtn").onclick=()=>editor?.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false});
  $("imageInput").onchange=e=>loadImageFile(e.target.files?.[0]).catch(err=>log("Image load error: "+err.message));
  $("clearImageBtn").onclick=clearLoadedImage;
  document.querySelectorAll(".output-tab").forEach(b=>b.onclick=()=>switchOutput(b.dataset.view));

  document.documentElement.style.setProperty("--editor-font",(prefs.fontSize||14)+"px");
  $("kitNameText").textContent=prefs.kitId||"ZB-000123";$("kitStatus").textContent=prefs.demoMode?"Demo mode":"Kit disconnected";
  updateRgb(0,0,0);updateSensorGraphics();initEditor();createWorker();enumerateCameras();connectRealKit();
})();