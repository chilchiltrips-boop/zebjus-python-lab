(function(){
  const $=id=>document.getElementById(id),cfg=window.ZEBJUS_CONFIG||{};
  const video=$("cameraVideo"),overlay=$("cameraOverlay"),terminal=$("terminal");
  let editor=null,worker=null,ws=null,running=false,cameraRunning=false,currentCameraIndex=null,cameras=[],liveMode=false,liveCode="",liveNeedsHand=false,liveNeedsFace=false,liveNeedsCamera=false,liveTimer=null,lintTimer=null,lintSeq=0,lintWaiters=new Map(),editorIssue=null;
  const kitClient=window.ZebjusKit?new window.ZebjusKit.KitClient():null;
  let kitCommandErrorShown=false,kitHeartbeatTimer=null,kitHealthTimer=null,currentRunUsesKit=false,kitReconnectBusy=false,activePotPin=34;
  let aiState={detected:false,fingers:0,side:"",faces:[],landmarks:[]};
  let imageFrame=null,uploadedImages=[],activeUploadPath="";

  const isEmbedded=(()=>{try{return window.self!==window.top;}catch(e){return true;}})();
  const bridgeChannelName="zebjus-camera-"+Math.random().toString(36).slice(2);
  const bridgeChannel=("BroadcastChannel" in window)?new BroadcastChannel(bridgeChannelName):null;
  let bridgeWindow=null,bridgeWaiters=new Map();
  let sensorState={ultrasonicCm:45,potValue:128,potRaw:2056,potPin:34,potPercent:50,potMillivolts:0};

  const defaults={
    autoCamera:true,demoMode:true,kitName:"",kitId:"",kitIp:"",wsUrl:"",
    cameraIndex:0,fontSize:14,autoSave:true,stdin:"",
    demoUltrasonic:45,demoPot:128
  };
  function getSettings(){let s={};try{s=JSON.parse(localStorage.getItem("zebjus.lab.settings")||"{}");}catch(e){}return {...defaults,...s};}
  let prefs=getSettings();
  if(!prefs.kitName&&prefs.kitId&&!/^ZB-/i.test(prefs.kitId))prefs.kitName=prefs.kitId;
  sensorState.ultrasonicCm=Number(prefs.demoUltrasonic)||45;
  sensorState.potValue=Math.max(0,Math.min(255,Number(prefs.demoPot)||0));
  sensorState.potRaw=Math.round(sensorState.potValue*4095/255);

  const examples={
    ledBasic:`# RGB LED Basic Colors
import cv2
from zebjus import RGBLED

# Output pins: Red=25, Green=26, Blue=27
rgb = RGBLED(25, 26, 27)

while True:
    rgb.color("red")
    cv2.waitKey(1000)
    rgb.color("green")
    cv2.waitKey(1000)
    rgb.color("blue")
    cv2.waitKey(1000)`,

    ledBlink:`# RGB LED Blink
import cv2
from zebjus import RGBLED

rgb = RGBLED(25, 26, 27)

while True:
    rgb.color("white")
    cv2.waitKey(300)
    rgb.off()
    cv2.waitKey(300)`,

    ledAnimation:`# RGB LED Animation
import cv2
from zebjus import RGBLED

rgb = RGBLED(25, 26, 27)
colors = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink", "white"]

while True:
    for color in colors:
        rgb.color(color)
        cv2.waitKey(250)

    rgb.off()
    cv2.waitKey(400)`,

    ledEffects:`# RGB LED Indication + Effects Demo
import cv2
from zebjus import RGBLED

rgb = RGBLED(25, 26, 27)

while True:
    # Basic indication colors
    for color in ["red", "green", "blue", "yellow", "cyan", "purple", "orange", "white"]:
        rgb.color(color)
        cv2.waitKey(400)

    # Warning blink
    for i in range(3):
        rgb.color("red")
        cv2.waitKey(180)
        rgb.off()
        cv2.waitKey(180)

    # Success indication
    for i in range(2):
        rgb.color("green")
        cv2.waitKey(150)
        rgb.off()
        cv2.waitKey(120)
    rgb.color("green")
    cv2.waitKey(700)

    # Connection indication
    for i in range(3):
        rgb.color("blue")
        cv2.waitKey(100)
        rgb.off()
        cv2.waitKey(100)

    # Red / blue alternating
    for i in range(5):
        rgb.color("red")
        cv2.waitKey(130)
        rgb.color("blue")
        cv2.waitKey(130)

    # Heartbeat effect
    rgb.color("red")
    cv2.waitKey(100)
    rgb.off()
    cv2.waitKey(90)
    rgb.color("red")
    cv2.waitKey(220)
    rgb.off()
    cv2.waitKey(600)

    # Custom colors
    custom = [
        (255, 0, 120),
        (0, 120, 255),
        (120, 255, 0),
        (150, 0, 255),
        (255, 60, 0),
        (0, 255, 150)
    ]
    for r, g, b in custom:
        rgb.write(r, g, b)
        cv2.waitKey(300)

    rgb.off()
    cv2.waitKey(500)`,

    ledFade:`# RGB LED Fade / Breathing Effects
import cv2
from zebjus import RGBLED

rgb = RGBLED(25, 26, 27)

while True:
    # Red fade in/out
    for value in range(0, 256, 10):
        rgb.write(value, 0, 0)
        cv2.waitKey(30)
    for value in range(255, -1, -10):
        rgb.write(value, 0, 0)
        cv2.waitKey(30)

    # Green breathing
    for value in range(0, 256, 10):
        rgb.write(0, value, 0)
        cv2.waitKey(30)
    for value in range(255, -1, -10):
        rgb.write(0, value, 0)
        cv2.waitKey(30)

    # Blue breathing
    for value in range(0, 256, 10):
        rgb.write(0, 0, value)
        cv2.waitKey(30)
    for value in range(255, -1, -10):
        rgb.write(0, 0, value)
        cv2.waitKey(30)

    rgb.off()
    cv2.waitKey(400)`,

    potRead:`# Potentiometer Read
import cv2
from zebjus import Potentiometer

# Reliable ESP32 Wi-Fi ADC1 pins: 32, 33, 34, 35, 36, 39
# Connection: 3.3V -> POT end, GND -> POT end, GPIO34 -> middle pin
pot = Potentiometer(34)

while True:
    print("GPIO:", pot.pin, "Value:", pot.read(), "/ 255", "Raw:", pot.raw(), "/ 4095", "Percent:", pot.percent(), "%")
    cv2.waitKey(250)`,

    potMonitor:`# Potentiometer Monitor
import cv2
from zebjus import Potentiometer

pot = Potentiometer(34)

while True:
    value = pot.read()

    if value < 64:
        level = "LOW"
    elif value < 128:
        level = "MEDIUM"
    elif value < 192:
        level = "HIGH"
    else:
        level = "MAX"

    print("Pot:", value, "Raw:", pot.raw(), "Level:", level)
    cv2.waitKey(200)`,

    potLedBrightness:`# Potentiometer Controls RGB Brightness
import cv2
from zebjus import Potentiometer, RGBLED

pot = Potentiometer(34)      # Input pin
rgb = RGBLED(25, 26, 27)    # Output pins

while True:
    value = pot.read()
    rgb.write(value, 0, 255 - value)
    print("Pot:", value, "RGB: R", value, "B", 255 - value)
    cv2.waitKey(80)`,

    potLedEffects:`# Potentiometer Controls LED Indications
import cv2
from zebjus import Potentiometer, RGBLED

pot = Potentiometer(34)
rgb = RGBLED(25, 26, 27)

while True:
    value = pot.read()

    if value < 50:
        rgb.color("blue")
    elif value < 100:
        rgb.color("cyan")
    elif value < 150:
        rgb.color("green")
    elif value < 200:
        rgb.color("yellow")
    elif value < 240:
        rgb.color("orange")
    else:
        # Maximum zone warning blink
        rgb.color("red")
        cv2.waitKey(100)
        rgb.off()

    print("Pot value:", value, "Raw:", pot.raw())
    cv2.waitKey(100)`
  };

  const libraries=[
    ["cv2","module","OpenCV"],["mediapipe","module","MediaPipe compatibility"],["cvzone","module","CVZone compatibility"],["numpy","module","NumPy"],["math","module","Math"],["random","module","Random"],
    ["zebjus","module","ZEBJUS hardware"],["zebjus_ai","module","MediaPipe AI"],["zebjus_cv","module","Camera/Image OpenCV bridge"],
    ["SerialModule","module","VISION AI serial compatibility"],["HandTrackingModule","module","VISION AI hand tracking compatibility"],["zebjus_wifi","module","ZEBJUS Wi-Fi compatibility"]
  ];
  const base=[
    ["and","keyword"],["as","keyword"],["break","keyword"],["class","keyword"],["continue","keyword"],["def","keyword"],["elif","keyword"],["else","keyword"],["except","keyword"],["False","keyword"],["for","keyword"],["from","keyword"],["if","keyword"],["import","keyword"],["in","keyword"],["None","keyword"],["not","keyword"],["or","keyword"],["pass","keyword"],["return","keyword"],["True","keyword"],["try","keyword"],["while","keyword"],["with","keyword"],
    ["print()","function","print()","Output"],["input()","function","input()","Program input"],["range()","function","range()","Range"],["len()","function","len()","Length"],["int()","function","int()","Integer"],["float()","function","float()","Float"],["str()","function","str()","String"],
    ["RGBLED()","class","RGBLED(25,26,27)","RGB LED pins + 0–255 color"],["LED()","class","LED()","White compatibility LED"],["Ultrasonic()","class","Ultrasonic()","Distance cm"],["Potentiometer()","class","Potentiometer(34)","ADC1 input pin 32/33/34/35/36/39"],["Motor()","class","Motor()","Motor"],["Servo()","class","Servo()","Servo"],["Camera()","class","Camera()","Camera"],["HandDetector()","class","HandDetector()","MediaPipe Hand"],["FaceDetector()","class","FaceDetector()","MediaPipe Face"],["sleep()","function","sleep()","Delay"],["load_image()","function","load_image()","Loaded image"],["show()","function","show()","Show image"],["draw_rgb_led()","function","draw_rgb_led()","Draw RGB LED"],["draw_potentiometer()","function","draw_potentiometer()","Draw pot"],["draw_ultrasonic()","function","draw_ultrasonic()","Draw distance bar"],
    ["cv2","module","cv2","OpenCV"],["mp","module","mp","MediaPipe"],["cvzone","module","cvzone","CVZone"],["np","module","np","NumPy"],
    ["SerialObject()","class","SerialObject()","VISION AI serial bridge"],["handDetector()","class","handDetector()","VISION AI hand tracker"],["WifiBridge()","class","WifiBridge()","ZEBJUS Wi-Fi bridge"]
  ];

  const moduleMembers={
    zebjus:[
      ["RGBLED","class","RGBLED","RGB LED: RGBLED(25,26,27)"],["LED","class","LED","LED"],["Ultrasonic","class","Ultrasonic","Ultrasonic"],
      ["Potentiometer","class","Potentiometer","Potentiometer ADC input"],["Motor","class","Motor","Motor"],["Servo","class","Servo","Servo"],["sleep","function","sleep","Delay"]
    ],
    zebjus_ai:[["HandDetector","class","HandDetector","Hand detector"],["HandResult","class","HandResult","Hand result"],["FaceDetector","class","FaceDetector","Face detector"],["FaceResult","class","FaceResult","Face result"]],
    cvzone:[["putTextRect","function","putTextRect","Text box"],["cornerRect","function","cornerRect","Corner rectangle"],["FaceDetectionModule","module","FaceDetectionModule","Face detector module"]],
    mediapipe:[["solutions","module","solutions","MediaPipe solutions compatibility"]],
    zebjus_cv:[
      ["Camera","class","Camera","Camera"],["load_image","function","load_image","Loaded image"],["show","function","show","Show image"],
      ["draw_rgb_led","function","draw_rgb_led","Draw LED"],["draw_potentiometer","function","draw_potentiometer","Draw pot"],["draw_ultrasonic","function","draw_ultrasonic","Draw ultrasonic"]
    ],
    SerialModule:[["SerialObject","class","SerialObject","VISION AI serial bridge"]],
    HandTrackingModule:[["handDetector","class","handDetector","VISION AI hand tracker"]],
    zebjus_wifi:[["WifiBridge","class","WifiBridge","ZEBJUS Wi-Fi bridge"]]
    };

  const members={
    cv2:[
      ["waitKey()","function","waitKey()","Delay/event wait in milliseconds"],
      ["imshow()","function","imshow()","Show image in OpenCV output"],
      ["destroyAllWindows()","function","destroyAllWindows()","Close OpenCV output windows"],
      ["VideoCapture()","class","VideoCapture()","Open browser camera"],
      ["imread()","function","imread()","Read uploaded image"],
      ["imwrite()","function","imwrite()","Encode/write image"],
      ["cvtColor()","function","cvtColor()","Color conversion"],
      ["Canny()","function","Canny()","Edge detection"],
      ["threshold()","function","threshold()","Threshold"],
      ["resize()","function","resize()","Resize"],
      ["GaussianBlur()","function","GaussianBlur()","Gaussian blur"],
      ["rectangle()","function","rectangle()","Rectangle"],
      ["circle()","function","circle()","Circle"],
      ["line()","function","line()","Line"],
      ["putText()","function","putText()","Draw text"],
      ["getTextSize()","function","getTextSize()","Measure text"],
      ["COLOR_BGR2GRAY","constant","COLOR_BGR2GRAY","BGR to grayscale"],
      ["COLOR_BGR2RGB","constant","COLOR_BGR2RGB","BGR to RGB"],
      ["COLOR_RGB2BGR","constant","COLOR_RGB2BGR","RGB to BGR"],
      ["THRESH_BINARY","constant","THRESH_BINARY","Binary threshold"],
      ["FONT_HERSHEY_SIMPLEX","constant","FONT_HERSHEY_SIMPLEX","OpenCV font"],
      ["FILLED","constant","FILLED","Filled drawing"]
    ],
    RGBLED:[["write()","method","write()","write(r,g,b) 0–255"],["set()","method","set()","set(r,g,b)"],["color()","method","color()","Named color: red, green, blue, purple…"],["red()","method","red()","Red"],["green()","method","green()","Green"],["blue()","method","blue()","Blue"],["white()","method","white()","White"],["off()","method","off()","Off"]],
    LED:[["on()","method","on()","On"],["off()","method","off()","Off"],["blink()","method","blink()","Blink"]],
    Ultrasonic:[["read()","method","read()","Distance cm"],["distance_cm","property","distance_cm","Distance cm"]],
    Potentiometer:[["read()","method","read()","Scaled 0–255"],["raw()","method","raw()","Raw ADC 0–4095"],["percent()","method","percent()","0–100 percent"],["millivolts()","method","millivolts()","ADC millivolts"],["pin","property","pin","Selected ADC GPIO"],["value","property","value","0–255"]],
    Motor:[["forward()","method","forward()","Forward"],["backward()","method","backward()","Backward"],["stop()","method","stop()","Stop"]],
    Servo:[["write()","method","write()","Angle"]],
    HandDetector:[["read()","method","read()","Stable hand snapshot"]],
    HandResult:[["detected","property","detected","Detected"],["fingers","property","fingers","0–5"],["side","property","side","Side"]],
    Camera:[["read()","method","read()","Camera frame"]],
    FaceDetector:[["read()","method","read()","Face snapshot"],["findFaces()","method","findFaces()","Detect faces"]],
    FaceResult:[["detected","property","detected","Detected"],["count","property","count","Face count"],["faces","property","faces","Faces"]],
    SerialObject:[["getData()","method","getData()","Read input data"],["sendData()","method","sendData()","Send kit data"]],
    handDetector:[["findHands()","method","findHands()","Find hand landmarks"],["findPosition()","method","findPosition()","Get landmark coordinates"]],
    WifiBridge:[["start()","method","start()","Start bridge"],["set_format()","method","set_format()","Set value format"],["send_values()","method","send_values()","Send values"]]
  };

  function inferType(code,name){
    const esc=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    for(const type of ["RGBLED","LED","Ultrasonic","Potentiometer","Motor","Servo","Camera","HandDetector","FaceDetector","SerialObject","handDetector","WifiBridge"]){
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


  function collectUserSymbols(code){
    const found=new Map();
    const add=(name,type="variable",info="Student variable")=>{
      if(!name||/^(?:True|False|None)$/.test(name))return;
      if(!found.has(name))found.set(name,[name,type,name,info]);
    };

    const lines=String(code||"").split(/\r?\n/);
    for(const raw of lines){
      const line=raw.replace(/#.*$/,"");

      let m=line.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
      if(m){
        add(m[1],"function","Student function");
        for(const p of m[2].split(",")){
          const n=p.trim().replace(/^\*{1,2}/,"").split(/[=:]/)[0].trim();
          if(/^[A-Za-z_]\w*$/.test(n))add(n,"variable","Function parameter");
        }
      }

      m=line.match(/^\s*class\s+([A-Za-z_]\w*)/);
      if(m)add(m[1],"class","Student class");

      m=line.match(/^\s*for\s+(.+?)\s+in\b/);
      if(m){
        for(const n of m[1].split(",")){
          const v=n.trim();
          if(/^[A-Za-z_]\w*$/.test(v))add(v,"variable","Loop variable");
        }
      }

      m=line.match(/^\s*(?:with\b.*?\bas|except\b.*?\bas)\s+([A-Za-z_]\w*)/);
      if(m)add(m[1],"variable","Context variable");

      m=line.match(/^\s*import\s+([A-Za-z_][\w.]*)\s+as\s+([A-Za-z_]\w*)/);
      if(m)add(m[2],"module","Imported module");

      m=line.match(/^\s*import\s+([A-Za-z_]\w*)\b/);
      if(m)add(m[1],"module","Imported module");

      m=line.match(/^\s*from\s+[A-Za-z_][\w.]*\s+import\s+(.+)$/);
      if(m){
        for(const part of m[1].split(",")){
          const bit=part.trim();
          const alias=bit.match(/\bas\s+([A-Za-z_]\w*)$/);
          const name=alias?alias[1]:(bit.match(/^([A-Za-z_]\w*)/)||[])[1];
          if(name)add(name,"variable","Imported name");
        }
      }

      m=line.match(/^\s*([A-Za-z_]\w*)\s*(?::[^=]+)?=(?!=)/);
      if(m)add(m[1],"variable","Student variable");

      m=line.match(/^\s*\(([^)]+)\)\s*=/);
      if(m){
        for(const n of m[1].split(",")){
          const v=n.trim();
          if(/^[A-Za-z_]\w*$/.test(v))add(v,"variable","Student variable");
        }
      }
    }
    return [...found.values()];
  }

  function closeNames(target,names){
    target=String(target||"").toLowerCase();
    const score=(a,b)=>{
      const dp=Array.from({length:b.length+1},(_,j)=>j);
      for(let i=1;i<=a.length;i++){
        let prev=dp[0];dp[0]=i;
        for(let j=1;j<=b.length;j++){
          const old=dp[j];
          dp[j]=Math.min(dp[j]+1,dp[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
          prev=old;
        }
      }
      return dp[b.length];
    };
    return names
      .map(n=>({n,d:score(target,String(n).toLowerCase())}))
      .filter(x=>x.d<=Math.max(2,Math.floor(target.length/3)))
      .sort((a,b)=>a.d-b.d||a.n.localeCompare(b.n))
      .slice(0,3).map(x=>x.n);
  }

  function errorSuggestion(type,message,code){
    type=String(type||"Error");message=String(message||"");
    const symbols=collectUserSymbols(code).map(x=>x[0]);

    if(type==="SyntaxError"){
      if(/expected ':'/.test(message))return 'Add ":" at the end of the if/elif/else/for/while/def/class line.';
      if(/was never closed|unexpected EOF|unterminated/.test(message))return "Check brackets, quotes, and parentheses on this line and the line above.";
      if(/invalid syntax/.test(message))return "Check spelling, missing operators/commas, brackets, and the previous line.";
      return "Check Python syntax on this line and the line immediately above it.";
    }
    if(type==="IndentationError"||type==="TabError")return "Use consistent 4-space indentation. Check the block after lines ending with ':'.";
    if(type==="NameError"){
      const m=message.match(/name ['"]([^'"]+)['"] is not defined/);
      if(m){
        const near=closeNames(m[1],symbols);
        if(near.length)return `Did you mean ${near.map(x=>"'"+x+"'").join(" or ")}?`;
        return `Define '${m[1]}' before using it, or check its spelling.`;
      }
      return "Check the variable/function name and make sure it is defined before this line.";
    }
    if(type==="TypeError"){
      if(/can only concatenate str/.test(message))return "Convert values to the same type, e.g. str(value) for text or int()/float() for numbers.";
      if(/unsupported operand type/.test(message))return "Check the data types on both sides of the operator; convert them if necessary.";
      if(/not callable/.test(message))return "This value is not a function. Remove () or call the correct function/method.";
      if(/missing .*required positional argument/.test(message))return "The function/method needs another argument. Check its parameter list.";
      return "Check the value types and the arguments passed on this line.";
    }
    if(type==="AttributeError"){
      const m=message.match(/has no attribute ['"]([^'"]+)['"]/);
      return m?`Check method/property spelling: '${m[1]}' is not available on this object.`:"Check the object's method/property name.";
    }
    if(type==="IndexError")return "Check the list/array length before accessing this index.";
    if(type==="KeyError")return "Check that this dictionary key exists before reading it.";
    if(type==="ValueError")return "The value format is not valid for this operation. Check conversion/input data.";
    if(type==="ModuleNotFoundError"||type==="ImportError")return "Check the library/module name. Some desktop-only Python packages are not available in browser Pyodide.";
    if(type==="ZeroDivisionError")return "Check the divisor before division and make sure it is not 0.";
    return "Check the highlighted line and the error message in Terminal.";
  }

  function clearEditorIssue(){
    if(!editor||!editorIssue)return;
    const {line,mark}=editorIssue;
    editor.setGutterMarker(line,"zebjus-errors",null);
    editor.removeLineClass(line,"background","zebjus-error-line");
    try{mark?.clear?.();}catch(_){}
    editorIssue=null;
    const bar=$("editorIssueBar");
    if(bar){bar.hidden=true;bar.innerHTML="";}
  }

  function showEditorIssue(issue){
    if(!editor||!issue)return;
    clearEditorIssue();
    const total=Math.max(1,editor.lineCount());
    const line=Math.max(0,Math.min(total-1,(Number(issue.line)||1)-1));
    const ch=Math.max(0,Number(issue.offset||1)-1);
    const text=editor.getLine(line)||"";
    const suggestion=issue.suggestion||errorSuggestion(issue.errorType,issue.message,getCode());

    const marker=document.createElement("span");
    marker.className="zebjus-error-gutter";
    marker.textContent="●";
    marker.title=`${issue.errorType||"Error"}: ${issue.message||""}${suggestion?"\nSuggestion: "+suggestion:""}`;
    editor.setGutterMarker(line,"zebjus-errors",marker);
    editor.addLineClass(line,"background","zebjus-error-line");

    const start=Math.min(ch,Math.max(0,text.length-1));
    const end=Math.max(start+1,text.length);
    const mark=editor.markText(
      {line,ch:start},
      {line,ch:end},
      {className:"zebjus-error-underline",title:marker.title}
    );
    editorIssue={line,mark};

    const bar=$("editorIssueBar");
    if(bar){
      bar.hidden=false;
      bar.innerHTML=`<strong>${escapeHtml(issue.errorType||"Error")}</strong> · Line ${line+1}: ${escapeHtml(issue.message||"")}
        ${suggestion?`<span class="issue-suggestion">Suggestion: ${escapeHtml(suggestion)}</span>`:""}`;
    }
  }

  function requestLint(code,show=true){
    if(!worker)return Promise.resolve({ok:true});
    const requestId="lint-"+(++lintSeq)+"-"+Date.now();
    return new Promise(resolve=>{
      const timeout=setTimeout(()=>{lintWaiters.delete(requestId);resolve({ok:true,timeout:true});},2500);
      lintWaiters.set(requestId,{resolve,timeout,show,code});
      worker.postMessage({type:"lint",requestId,code:String(code||"")});
    });
  }

  function hintProvider(cm){
    const cur=cm.getCursor(),line=cm.getLine(cur.line).slice(0,cur.ch),full=cm.getValue();
    let m,prefix="",items=[];

    m=line.match(/^\s*(?:import|from)\s+([A-Za-z_]\w*)?$/);
    if(m){prefix=m[1]||"";return{list:filterItems(libraries,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};}

    m=line.match(/^\s*from\s+(zebjus|zebjus_ai|zebjus_cv|cv2|cvzone|mediapipe|SerialModule|HandTrackingModule|zebjus_wifi)\s+import\s+([A-Za-z_]\w*)?$/);
    if(m){prefix=m[2]||"";return{list:filterItems(moduleMembers[m[1]]||[],prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};}

    m=line.match(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/);
    if(m){
      prefix=m[2]||"";
      if(m[1]==="cv2") items=members.cv2||[];
      else items=members[inferType(full,m[1])]||[];
      return{list:filterItems(items,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};
    }

    m=line.match(/([A-Za-z_]\w*)$/);prefix=m?.[1]||"";
    const userSymbols=collectUserSymbols(full);
    return{list:filterItems([...userSymbols,...base],prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};
  }

  function initEditor(){
    if(typeof CodeMirror==="undefined"){$("editorLoadError").hidden=false;return;}
    CodeMirror.registerHelper("hint","zebjusPython",hintProvider);
    $("codeEditor").value=(prefs.autoSave?localStorage.getItem("zebjus.lab.code"):null)||examples.ledBasic;
    editor=CodeMirror.fromTextArea($("codeEditor"),{
      mode:"python",theme:"zebjus",lineNumbers:true,gutters:["CodeMirror-linenumbers","zebjus-errors"],indentUnit:4,tabSize:4,indentWithTabs:false,
      matchBrackets:true,autoCloseBrackets:true,styleActiveLine:true,
      extraKeys:{
        "Ctrl-Space":cm=>cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false}),
        "Cmd-Space":cm=>cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false}),
        "Cmd-Z":"undo","Ctrl-Z":"undo","Cmd-Shift-Z":"redo","Ctrl-Y":"redo",
        "Tab":cm=>cm.replaceSelection("    ","end","+input")
      }
    });
    editor.getWrapperElement().style.fontSize=(prefs.fontSize||14)+"px";
    editor.on("change",(cm,ch)=>{
      updateHistoryButtons();
      if(prefs.autoSave){clearTimeout(window.__save);$("saveState").textContent="Saving…";window.__save=setTimeout(()=>{localStorage.setItem("zebjus.lab.code",cm.getValue());$("saveState").textContent="Saved";},220);}
      if((ch.origin==="+input"||ch.origin==="paste")&&!cm.state.completionActive){
        const typed=(ch.text||[]).join("\n"),cur=cm.getCursor(),left=cm.getLine(cur.line).slice(0,cur.ch);
        if(/[A-Za-z0-9_.]$/.test(typed)||/\b(?:import|from)\s+$/.test(left))setTimeout(()=>cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false}),0);
      }
      clearTimeout(lintTimer);
      if(!running){
        lintTimer=setTimeout(async()=>{
          const result=await requestLint(cm.getValue(),true);
          if(result.ok)clearEditorIssue();
        },500);
      }
    });
    updateHistoryButtons();
  }

  function getCode(){return editor?editor.getValue():$("codeEditor").value;}
  function setCode(t){if(editor){editor.setValue(t);editor.focus();}}
  function updateHistoryButtons(){
    if(!editor)return;const h=editor.historySize();
    if($("undoBtn"))$("undoBtn").disabled=!h.undo;if($("redoBtn"))$("redoBtn").disabled=!h.redo;
  }
  function undoEditor(){if(editor){editor.undo();editor.focus();updateHistoryButtons();}}
  function redoEditor(){if(editor){editor.redo();editor.focus();updateHistoryButtons();}}
  function log(t){terminal.textContent+=(terminal.textContent?"\n":"")+String(t);terminal.scrollTop=terminal.scrollHeight;}
  function writeTerminalChunk(t){
    const s=String(t??"");
    if(!s)return;
    terminal.textContent+=s;
    if(terminal.textContent.length>60000)terminal.textContent=terminal.textContent.slice(-45000);
    terminal.scrollTop=terminal.scrollHeight;
  }
  function badge(el,t,m=""){el.textContent=t;el.className="badge"+(m?" "+m:"");}

  function updateRunControls(){
    const run=$("runBtn"),end=$("stopBtn");
    if(!run||!end)return;
    run.disabled=!!running;
    end.disabled=!running;
    run.classList.toggle("run-faded",!!running);
    end.classList.toggle("end-active",!!running);
    run.setAttribute("aria-pressed",running?"true":"false");
  }

  function showCameraProcessedImage(url,title="OpenCV Output"){
    const img=$("cameraResultImage");
    if(!img||!url)return;
    img.src=url;
    img.style.display="block";

    const video=$("cameraVideo");
    const overlay=$("cameraOverlay");
    const placeholder=$("cameraPlaceholder");
    const label=$("cameraResultLabel");

    if(video)video.style.visibility="hidden";
    if(overlay)overlay.style.visibility="hidden";
    if(placeholder)placeholder.style.display="none";
    if(label){
      label.hidden=false;
      label.textContent=title||"OpenCV Output";
    }
  }

  function clearCameraProcessedImage(){
    const img=$("cameraResultImage");
    const video=$("cameraVideo");
    const overlay=$("cameraOverlay");
    const placeholder=$("cameraPlaceholder");
    const label=$("cameraResultLabel");

    if(img){
      img.removeAttribute("src");
      img.style.display="none";
    }
    if(video)video.style.visibility="";
    if(overlay)overlay.style.visibility="";
    if(label)label.hidden=true;

    if(placeholder){
      placeholder.style.display=cameraRunning?"none":"flex";
    }
  }

  function closeAllCvWindows(){
    clearCameraProcessedImage();
    document.querySelectorAll(".opencv-float-window").forEach(win=>{
      win.classList.remove("show","minimized");
      const c=win.querySelector("canvas");
      if(c){
        const ctx=c.getContext("2d");
        if(ctx)ctx.clearRect(0,0,c.width,c.height);
      }
    });
    const result=$("resultImage");
    if(result){
      result.removeAttribute("src");
      result.style.display="none";
    }
    const ph=$("imagePlaceholder");
    if(ph)ph.style.display="block";
  }


  function createWorker(){
    if(worker)worker.terminate();
    worker=new Worker("./py-worker.js?v=5.17",{type:"module"});
    badge($("pythonStatus"),"Python loading…","warn");
    worker.onmessage=e=>{
      const m=e.data||{};
      if(m.type==="ready"){
        badge($("pythonStatus"),"Python ready","ok");updateRunControls();
        setTimeout(()=>requestLint(getCode(),true),120);
      }
      else if(m.type==="lint-result"){
        const waiter=lintWaiters.get(m.requestId);
        if(waiter){
          lintWaiters.delete(m.requestId);clearTimeout(waiter.timeout);
          const result={ok:!!m.ok,errorType:m.errorType||"",message:m.message||"",line:m.line||1,offset:m.offset||1};
          if(!result.ok){
            result.suggestion=errorSuggestion(result.errorType,result.message,waiter.code);
            if(waiter.show)showEditorIssue(result);
          }
          waiter.resolve(result);
        }
      }
      else if(m.type==="status")badge($("pythonStatus"),m.text,m.mode||"warn");
      else if(m.type==="stdout"&&m.text!=="")writeTerminalChunk(m.text);
      else if(m.type==="runtime-stdout"){ /* Pyodide/package internal output hidden from student terminal */ }
      else if(m.type==="stderr"&&m.text!=="")log("ERROR: "+m.text);
      else if(m.type==="close-images")closeAllCvWindows();
      else if(m.type==="error"){
        liveMode=false;if(liveTimer){clearTimeout(liveTimer);liveTimer=null;}
        running=false;updateRunControls();endHardwareRun().catch(()=>{});
        const issue={
          errorType:m.errorType||"PythonError",
          message:m.message||m.text||"Unknown error",
          line:Number(m.line)||1,
          offset:Number(m.offset)||1
        };
        issue.suggestion=errorSuggestion(issue.errorType,issue.message,getCode());
        showEditorIssue(issue);
        log(`${issue.errorType} · line ${issue.line}: ${issue.message}`);
        if(issue.suggestion)log("Suggestion: "+issue.suggestion);
        badge($("pythonStatus"),"Python ready","ok");
      }
      else if(m.type==="done"){
        if(liveMode&&running){
          liveTimer=setTimeout(()=>runLiveCycle().catch(err=>{
            liveMode=false;running=false;updateRunControls();endHardwareRun().catch(()=>{});log("Live loop error: "+(err?.message||err));badge($("pythonStatus"),"Python ready","ok");
          }),70);
        }else{
          running=false;updateRunControls();clearEditorIssue();
          endHardwareRun().finally(()=>log("Program finished. Kit outputs OFF."));
          badge($("pythonStatus"),"Python ready","ok");
        }
      }
      else if(m.type==="kit-command")handleKit(m.payload);
      else if(m.type==="image"){
        showImage(m.dataUrl);
        showCameraProcessedImage(m.dataUrl,m.title||"OpenCV Output");
      }
    };
    worker.onerror=e=>{running=false;updateRunControls();endHardwareRun().catch(()=>{});log("Worker error: "+e.message);badge($("pythonStatus"),"Python error");};
  }

  function setupCameraBridge(){
    if(!bridgeChannel)return;
    bridgeChannel.onmessage=e=>{
      const m=e.data||{};
      if(m.type==="camera-snapshot"&&m.requestId&&bridgeWaiters.has(m.requestId)){
        const waiter=bridgeWaiters.get(m.requestId);
        bridgeWaiters.delete(m.requestId);
        waiter.resolve(m);
      }else if(m.type==="bridge-error"){
        log("Camera Bridge error: "+(m.message||"Unknown error"));
      }
    };
    if(isEmbedded&&$("embedCameraNotice"))$("embedCameraNotice").hidden=false;
  }

  function openCameraBridge(cameraIndex=0){
    if(!bridgeChannel)throw new Error("This browser does not support BroadcastChannel.");
    if(bridgeWindow&&!bridgeWindow.closed){
      try{bridgeWindow.focus();}catch(e){}
      return bridgeWindow;
    }
    const url=`./camera-bridge.html?channel=${encodeURIComponent(bridgeChannelName)}&camera=${encodeURIComponent(cameraIndex)}`;
    bridgeWindow=window.open(url,"zebjusCameraBridge","width=520,height=690,resizable=yes,scrollbars=yes");
    if(!bridgeWindow)throw new Error("Camera popup was blocked. Allow popups for this site and Run again.");
    return bridgeWindow;
  }

  function requestBridgeSnapshot(cameraIndex=0,timeoutMs=30000,needsFace=false){
    return new Promise((resolve,reject)=>{
      if(!bridgeChannel){reject(new Error("BroadcastChannel unavailable."));return;}
      const requestId="req-"+Date.now()+"-"+Math.random().toString(36).slice(2);
      const timer=setTimeout(()=>{
        if(bridgeWaiters.has(requestId))bridgeWaiters.delete(requestId);
        reject(new Error("Camera Bridge timed out. Allow camera permission in the Camera Bridge window."));
      },timeoutMs);

      bridgeWaiters.set(requestId,{
        resolve:m=>{clearTimeout(timer);resolve(m);},
        reject:e=>{clearTimeout(timer);reject(e);}
      });

      // Give a newly opened bridge a short moment to subscribe.
      setTimeout(()=>{
        bridgeChannel.postMessage({type:"request-snapshot",requestId,cameraIndex,needsFace});
      },500);
    });
  }

  async function enumerateCameras(){
    try{
      const ds=await navigator.mediaDevices?.enumerateDevices?.()||[];
      cameras=ds.filter(d=>d.kind==="videoinput");
      $("cameraIndexText").textContent="Camera "+(currentCameraIndex ?? (Number(prefs.cameraIndex)||0));
    }catch(e){}
  }

  function requestedCamera(src){const m=src.match(/\bCamera\s*\(\s*(\d+)\s*\)/);return m?Number(m[1]):null;}
  function requestedPotPin(src){
    const m=src.match(/\bPotentiometer\s*\(\s*(\d+)?/);if(!m)return null;
    const pin=Number(m[1]||34);return pin===1?34:pin;
  }
  function requestedRgbPins(src){
    const m=src.match(/\bRGBLED\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    return m?[Number(m[1]),Number(m[2]),Number(m[3])]:[25,26,27];
  }
  async function refreshPotFromKit(src,showError=false){
    const pin=requestedPotPin(src);if(pin===null||prefs.demoMode)return true;
    activePotPin=pin;
    try{
      const d=await kitClient.analog(pin);updateSensorPacket(d);return true;
    }catch(e){
      if(showError)log("Potentiometer read error: "+(e?.message||e));
      return false;
    }
  }

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

  function safeUploadName(name){
    const clean=String(name||"image").replace(/[\\/:*?"<>|]/g,"_").trim()||"image";
    const dot=clean.lastIndexOf("."),base=dot>0?clean.slice(0,dot):clean,ext=dot>0?clean.slice(dot):"";
    let candidate=clean,n=2;
    const used=new Set(uploadedImages.map(x=>x.name.toLowerCase()));
    while(used.has(candidate.toLowerCase()))candidate=`${base}_${n++}${ext}`;
    return candidate;
  }

  async function copyText(text){
    try{await navigator.clipboard.writeText(text);return true;}
    catch(_){
      try{
        const t=document.createElement("textarea");t.value=text;t.style.position="fixed";t.style.opacity="0";
        document.body.appendChild(t);t.focus();t.select();const ok=document.execCommand("copy");t.remove();return ok;
      }catch(e){return false;}
    }
  }

  function setActiveUpload(item){
    if(!item)return;
    activeUploadPath=item.path;imageFrame=item.frame;
    $("sourceImagePreview").src=item.dataUrl;$("sourceImagePreview").style.display="block";$("sourceImagePlaceholder").style.display="none";
    $("sourceImageInfo").textContent=`${item.name} • ${item.width}×${item.height} • ${item.path}`;
    renderUploadedFiles();
  }

  function renderUploadedFiles(){
    const box=$("uploadedFileList");
    if(!uploadedImages.length){box.innerHTML='<div class="uploaded-empty">Uploaded image paths will appear here.</div>';return;}
    box.innerHTML=uploadedImages.map((item,i)=>`
      <div class="uploaded-file-row ${item.path===activeUploadPath?"active":""}" data-upload-index="${i}">
        <div class="uploaded-file-main" title="Click to preview this image">
          <div class="uploaded-file-name">${escapeHtml(item.name)}</div>
          <div class="uploaded-file-path">${escapeHtml(item.path)}</div>
        </div>
        <button class="copy-path-btn" data-copy-path="${escapeHtml(item.path)}" type="button">Copy Path</button>
      </div>`).join("");
  }

  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

  async function loadImageFiles(files){
    const list=Array.from(files||[]).filter(f=>f&&String(f.type||"").startsWith("image/")).slice(0,10);
    if(!list.length)return;
    for(const file of list){
      if(file.size>5*1024*1024){log(`Skipped ${file.name}: maximum image size is 5 MB.`);continue;}
      const name=safeUploadName(file.name),path=`uploads/${name}`;
      const buffer=await file.arrayBuffer(),bytes=Array.from(new Uint8Array(buffer));
      const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
      const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=dataUrl;});
      const maxW=720,maxH=520,scale=Math.min(1,maxW/img.width,maxH/img.height),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
      const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(img,0,0,w,h);
      const frame={width:w,height:h,data:Array.from(x.getImageData(0,0,w,h).data)};
      const item={name,path,data:bytes,dataUrl,width:w,height:h,frame};
      uploadedImages.push(item);setActiveUpload(item);
      log(`Image uploaded: ${path}`);
    }
    $("imageInput").value="";
    renderUploadedFiles();
  }

  function clearLoadedImage(){
    imageFrame=null;uploadedImages=[];activeUploadPath="";$("imageInput").value="";
    $("sourceImagePreview").removeAttribute("src");$("sourceImagePreview").style.display="none";$("sourceImagePlaceholder").style.display="block";
    $("sourceImageInfo").textContent="Upload an image, copy its path, then use cv2.imread().";
    renderUploadedFiles();
  }

  function postProgramToWorker(code,frame){
    worker.postMessage({
      type:"run",
      code,
      stdin:prefs.stdin||"",
      aiState,
      sensorState,
      frame,
      imageFrame,
      uploadedFiles:uploadedImages.map(x=>({name:x.name,path:x.path,data:x.data}))
    });
  }

  async function refreshLiveAI(){
    let frame=null;
    if(liveNeedsCamera&&cameraRunning){
      if(liveNeedsFace){
        try{await ZebjusAI.enableFaceDetection();}catch(_){}
      }
      const snap=ZebjusAI?.getSnapshot?.()||aiState;
      aiState={
        detected:!!snap.detected,
        fingers:Number(snap.fingers)||0,
        side:snap.side||"",
        faces:Array.isArray(snap.faces)?snap.faces:[],
        landmarks:Array.isArray(snap.landmarks)?snap.landmarks:[]
      };
      frame=captureFrame();
      $("handDetected").textContent=aiState.detected?"Yes":"No";
      $("fingerCount").textContent=aiState.fingers;
      $("handSide").textContent=aiState.side||"—";
      $("faceCount").textContent=aiState.faces.length;
    }
    return frame;
  }

  async function runLiveCycle(){
    if(!liveMode||!running)return;
    if(prefs.demoMode){
      sensorState.ultrasonicCm=Number(prefs.demoUltrasonic)||45;
      sensorState.potValue=Math.max(0,Math.min(255,Number(prefs.demoPot)||0));
      sensorState.potRaw=Math.round(sensorState.potValue*4095/255);
      updateSensorGraphics();
    }
    if(!prefs.demoMode&&/\bPotentiometer\s*\(/.test(liveCode)){
      const ok=await refreshPotFromKit(liveCode,false);if(!ok){await ensureKitConnected(false);await refreshPotFromKit(liveCode,false);}
    }
    const frame=await refreshLiveAI();
    if(!liveMode||!running)return;
    postProgramToWorker(liveCode,frame);
  }


  function ensureCvFloatWindow(){ return null; }
  function showCvFloatingImage(frame,title="OpenCV Image"){ return; }
  function showCvFloatingUrl(url,title="OpenCV Image"){ return; }



  async function runCode(){
    if(running){log("Program already running. Press Stop first.");return;}

    const src=getCode();
    clearEditorIssue();
    const lint=await requestLint(src,true);
    if(!lint.ok){
      terminal.textContent="";
      log(`${lint.errorType} · line ${lint.line}: ${lint.message}`);
      if(lint.suggestion)log("Suggestion: "+lint.suggestion);
      badge($("pythonStatus"),"Fix code error","warn");
      return;
    }
    const needsPhysicalKit=/\b(?:RGBLED|LED|Motor|Servo|Ultrasonic|Potentiometer)\s*\(/.test(src);
    const potPin=requestedPotPin(src);
    if(potPin!==null&&/\bRGBLED\s*\(/.test(src)&&requestedRgbPins(src).includes(potPin)){
      terminal.textContent="";log(`Pin conflict: GPIO${potPin} cannot be used for Potentiometer input and RGB output at the same time.`);badge($("pythonStatus"),"Pin conflict","warn");return;
    }
    if(needsPhysicalKit&&!prefs.demoMode){
      const connected=await ensureKitConnected(true);
      if(!connected){badge($("pythonStatus"),"Kit not connected","warn");return;}
    }
    const needsHand=/\bzebjus_ai\b|\bHandDetector\b|\bHandTrackingModule\b|\bhandDetector\s*\(/.test(src);
    const needsFace=/\bFaceDetector\b|\bFaceDetectionModule\b|\bface_detection\b|\bmp\.solutions\.face_detection\b/.test(src);
    const needsCamera=needsHand||needsFace||/\bCamera\s*\(|\bcv2\.VideoCapture\s*\(/.test(src);
    const idx=requestedCamera(src);
    const requestedIdx=idx!==null?idx:(Number(prefs.cameraIndex)||0);

    terminal.textContent="";
    running=true;updateRunControls();
    liveMode=/\bwhile\s+True\s*:/.test(src)&&(needsCamera||/\bSerialObject\b|\bWifiBridge\b|\bPotentiometer\s*\(/.test(src));
    liveCode=src;liveNeedsHand=needsHand;liveNeedsFace=needsFace;liveNeedsCamera=needsCamera;
    if(liveTimer){clearTimeout(liveTimer);liveTimer=null;}
    if(liveMode)log("LIVE MODE started — press Stop to end.");

    let runFrame=null;
    let directCameraOk=false;

    // First try camera INSIDE the Wix page.
    if(needsCamera && prefs.autoCamera){
      if(!cameraRunning || requestedIdx!==currentCameraIndex){
        if(cameraRunning)stopCamera();
        directCameraOk=await startCamera(requestedIdx);
      }else{
        directCameraOk=true;
      }
    }else if(cameraRunning){
      directCameraOk=true;
    }

    if(needsCamera && directCameraOk){
      // Face detection is not started by the normal camera start path.
      // Enable it explicitly before live FaceDetector loops begin.
      if(needsFace){
        try{
          await ZebjusAI.enableFaceDetection();
          if(liveMode){
            // Give MediaPipe a few video frames to produce the first face result.
            await new Promise(r=>setTimeout(r,220));
          }
        }catch(e){
          log("Face detector error: "+(e?.message||e));
        }
      }

      let snap=ZebjusAI?.getSnapshot?.()||aiState;
      if(liveMode){
        log(`LIVE initial state → faces=${Array.isArray(snap.faces)?snap.faces.length:0}, hand=${!!snap.detected}, fingers=${Number(snap.fingers)||0}`);
      }else{
        if(needsFace){snap=await ZebjusAI.waitForFaces(1500);log(`Face snapshot → faces=${Number(snap.faceCount)||0}`);}
        if(needsHand){snap=await ZebjusAI.waitForStable(1500);log(`Hand snapshot → detected=${!!snap.detected}, fingers=${Number(snap.fingers)||0}, side=${snap.side||"-"}`);}
      }
      aiState={detected:!!snap.detected,fingers:Number(snap.fingers)||0,side:snap.side||"",faces:Array.isArray(snap.faces)?snap.faces:[],landmarks:Array.isArray(snap.landmarks)?snap.landmarks:[]};
      runFrame=captureFrame();
    }

    // Open Camera Bridge only if direct camera access is blocked.
    if(needsCamera && !directCameraOk){
      if(!isEmbedded){
        running=false;updateRunControls();
        log("Program stopped because this project needs a camera.");
        return;
      }

      try{
        log("Direct camera blocked → opening Camera Bridge fallback…");
        openCameraBridge(requestedIdx);

        const snap=await requestBridgeSnapshot(requestedIdx,30000,needsFace);
        aiState=snap.aiState||{detected:false,fingers:0,side:"",faces:[],landmarks:[]};
        runFrame=snap.frame||null;

        $("handDetected").textContent=aiState.detected?"Yes":"No";
        $("fingerCount").textContent=Number(aiState.fingers)||0;
        $("handSide").textContent=aiState.side||"—";
        $("faceCount").textContent=Array.isArray(aiState.faces)?aiState.faces.length:0;

        log(`AI snapshot → detected=${!!aiState.detected}, fingers=${Number(aiState.fingers)||0}, side=${aiState.side||"-"}`);
      }catch(e){
        running=false;updateRunControls();
        log("Camera error: "+(e?.message||e));
        return;
      }
    }

    if(prefs.demoMode){
      sensorState.ultrasonicCm=Number(prefs.demoUltrasonic)||45;
      sensorState.potValue=Math.max(0,Math.min(255,Number(prefs.demoPot)||0));
      sensorState.potRaw=Math.round(sensorState.potValue*4095/255);
      updateSensorGraphics();
    }

    if(needsPhysicalKit&&!prefs.demoMode){
      try{
        await beginHardwareRun();
        if(/\bPotentiometer\s*\(/.test(src))await refreshPotFromKit(src,true);
      }
      catch(e){running=false;updateRunControls();log("Could not start kit run session: "+(e?.message||e));badge($("pythonStatus"),"Kit not ready","warn");return;}
    }else{currentRunUsesKit=false;}

    badge($("pythonStatus"),liveMode?"Live running…":"Running…","warn");
    postProgramToWorker(src,runFrame);
  }

  function stopKitHeartbeat(){if(kitHeartbeatTimer){clearInterval(kitHeartbeatTimer);kitHeartbeatTimer=null;}}

  async function beginHardwareRun(){
    if(prefs.demoMode||!kitClient?.connected){currentRunUsesKit=false;return true;}
    await kitClient.beginRun();
    currentRunUsesKit=true;stopKitHeartbeat();
    kitHeartbeatTimer=setInterval(()=>{
      if(!running||!currentRunUsesKit||kitReconnectBusy)return;
      kitClient.pingRun().catch(async()=>{
        if(kitReconnectBusy)return;kitReconnectBusy=true;badge($("kitStatus"),"Reconnecting kit…","warn");
        try{await kitClient.reconnect(4);await kitClient.beginRun();badge($("kitStatus"),"Kit connected","ok");kitCommandErrorShown=false;}
        catch(_){badge($("kitStatus"),"Kit disconnected");}
        finally{kitReconnectBusy=false;}
      });
    },1000);
    return true;
  }

  async function endHardwareRun(){
    stopKitHeartbeat();
    const used=currentRunUsesKit;currentRunUsesKit=false;
    const stopRgb={command:"RGB_LED_SET",id:1,r:0,g:0,b:0};
    if(used&&!prefs.demoMode&&kitClient?.connected){
      try{await kitClient.endRun();kitCommandErrorShown=false;}
      catch(e){if(!kitCommandErrorShown){log("Kit OFF error: "+(e?.message||e));kitCommandErrorShown=true;}}
    }
    applyDemo(stopRgb);
    applyDemo({command:"MOTOR_SET",id:1,speed:0});
  }

  async function stopProgram(){
    liveMode=false;liveCode="";
    if(liveTimer){clearTimeout(liveTimer);liveTimer=null;}
    clearTimeout(lintTimer);
    running=false;
    closeAllCvWindows();
    stopCamera();
    if(worker){worker.terminate();worker=null;}
    updateRunControls();
    await endHardwareRun();
    createWorker();
    log("Stopped. Kit outputs OFF.");
  }

  function updateSensorGraphics(){
    const d=Math.max(0,Number(sensorState.ultrasonicCm)||0),p=Math.max(0,Math.min(255,Number(sensorState.potValue)||0));
    $("ultraLabel").textContent=d.toFixed(1)+" cm";$("ultraMeter").style.width=Math.min(100,d/400*100)+"%";
    $("potLabel").textContent=`${p} / 255 · GPIO${sensorState.potPin||34} · raw ${sensorState.potRaw||0}`;$("potNeedle").style.transform=`rotate(${-135+(p/255)*270}deg)`;
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
      sensorState.potPin=Number(data.pin??sensorState.potPin??34);sensorState.potPercent=Number(data.percent??Math.round(sensorState.potValue*100/255));sensorState.potMillivolts=Number(data.millivolts??sensorState.potMillivolts??0);
    }
    updateSensorGraphics();
  }

  async function handleKit(p){
    if(!p)return;
    if(prefs.demoMode){applyDemo(p);return;}

    if(kitClient?.connected){
      try{
        if(p.command==="RGB_LED_SET"){
          let result;
          try{result=await kitClient.rgb(p);}
          catch(e){
            if(running&&e?.status===409){await kitClient.beginRun();currentRunUsesKit=true;result=await kitClient.rgb(p);}
            else throw e;
          }
          if(!result?.skipped)applyDemo(p); // Mirror only after ESP32 acknowledges: screen and kit stay synchronized.
          kitCommandErrorShown=false;
        }else if(ws?.readyState===WebSocket.OPEN){
          ws.send(JSON.stringify({type:"command",kitId:prefs.kitName||prefs.kitId,...p}));
          applyDemo(p);
        }else{
          applyDemo(p);
        }
      }catch(e){
        badge($("kitStatus"),"Kit error");
        if(!kitCommandErrorShown){log("Kit command error: "+(e?.message||e));kitCommandErrorShown=true;}
      }
      return;
    }

    if(ws?.readyState===WebSocket.OPEN){
      ws.send(JSON.stringify({type:"command",kitId:prefs.kitName||prefs.kitId,...p}));
      applyDemo(p);
    }
  }

  async function ensureKitConnected(showError=true){
    if(prefs.demoMode)return true;
    const name=(prefs.kitName||prefs.kitId||"").trim();
    if(!name||!kitClient){if(showError)log("No physical kit selected. Open Settings → Kit Connection.");return false;}
    try{
      badge($("kitStatus"),kitClient.connected?"Checking kit…":"Connecting kit…","warn");
      let st;
      if(kitClient.connected)st=await kitClient.ensureLive();
      else{
        kitClient.name=name;kitClient.ipHint=prefs.kitIp||"";
        try{st=await kitClient.connect(name,prefs.kitIp||"");}
        catch(_){st=await kitClient.reconnect(4);}
      }
      prefs.kitName=st.name||name;prefs.kitId=prefs.kitName;prefs.kitIp=st.ip||prefs.kitIp||"";
      localStorage.setItem("zebjus.lab.settings",JSON.stringify(prefs));
      $("kitNameText").textContent=prefs.kitName;badge($("kitStatus"),"Kit connected","ok");kitCommandErrorShown=false;return true;
    }catch(e){
      badge($("kitStatus"),"Kit disconnected");
      if(showError)log("Kit connection failed: "+(e?.message||e)+" Auto-reconnect was attempted. Check kit power and Wi-Fi.");
      return false;
    }
  }

  function startKitHealthMonitor(){
    if(kitHealthTimer)clearInterval(kitHealthTimer);
    kitHealthTimer=setInterval(async()=>{
      if(prefs.demoMode||running||kitReconnectBusy||!(prefs.kitName||prefs.kitId))return;
      kitReconnectBusy=true;
      try{await ensureKitConnected(false);}catch(_){}
      finally{kitReconnectBusy=false;}
    },4000);
  }

  function connectRealKit(){
    if(prefs.demoMode)return;
    ensureKitConnected(false).then(ok=>{
      if(ok)return;
      if(!prefs.wsUrl?.startsWith("wss://"))return;
      try{
        ws=new WebSocket(prefs.wsUrl);
        ws.onopen=()=>{ws.send(JSON.stringify({type:"hello",kitId:prefs.kitName||prefs.kitId}));badge($("kitStatus"),"Kit connected","ok");};
        ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.type==="sensor"||d.type==="sensors")updateSensorPacket(d);}catch(_){}};
        ws.onclose=()=>badge($("kitStatus"),"Kit disconnected");
      }catch(_){/* optional legacy connection */}
    });
  }

  function showImage(url){
    $("resultImage").src=url;
    $("resultImage").style.display="block";
    $("imagePlaceholder").style.display="none";
    // Keep the student's current output tab unchanged.
    // cv2.imshow() is shown in the floating OpenCV window.
  }
  function switchOutput(id){document.querySelectorAll(".output-view").forEach(x=>x.classList.toggle("active",x.id===id));document.querySelectorAll(".output-tab").forEach(x=>x.classList.toggle("active",x.dataset.view===id));}

  window.addEventListener("zebjus-ai-state",e=>{
    const d=e.detail||{};aiState={detected:!!d.detected,fingers:Number(d.fingers)||0,side:d.side||"",faces:Array.isArray(d.faces)?d.faces:[],landmarks:Array.isArray(d.landmarks)?d.landmarks:[]};
    $("handDetected").textContent=aiState.detected?"Yes":"No";$("fingerCount").textContent=aiState.fingers;$("handSide").textContent=aiState.side||"—";$("faceCount").textContent=aiState.faces.length;
  });

  $("loadExampleBtn").onclick=()=>setCode(examples[$("exampleSelect").value]||examples.ledBasic);
  $("resetBtn").onclick=()=>setCode(examples.ledBasic);$("runBtn").onclick=runCode;$("stopBtn").onclick=stopProgram;$("clearBtn").onclick=()=>terminal.textContent="";
  updateRunControls();
  $("cameraToggleBtn").onclick=()=>cameraRunning?stopCamera():startCamera();
  $("autocompleteBtn").onclick=()=>editor?.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false});
  if($("undoBtn"))$("undoBtn").onclick=undoEditor;if($("redoBtn"))$("redoBtn").onclick=redoEditor;
  $("imageInput").onchange=e=>loadImageFiles(e.target.files).catch(err=>log("Image upload error: "+err.message));
  $("uploadedFileList").onclick=async e=>{
    const copy=e.target.closest("[data-copy-path]");
    if(copy){
      const path=copy.dataset.copyPath||"";
      const ok=await copyText(path);
      copy.textContent=ok?"Copied!":"Copy failed";
      if(ok)log(`Copied image path: ${path}`);
      setTimeout(()=>copy.textContent="Copy Path",900);
      return;
    }
    const row=e.target.closest("[data-upload-index]");
    if(row)setActiveUpload(uploadedImages[Number(row.dataset.uploadIndex)]);
  };
  $("clearImageBtn").onclick=clearLoadedImage;
  document.querySelectorAll(".output-tab").forEach(b=>b.onclick=()=>switchOutput(b.dataset.view));

  document.documentElement.style.setProperty("--editor-font",(prefs.fontSize||14)+"px");
  $("kitNameText").textContent=prefs.kitName||prefs.kitId||"No kit selected";$("kitStatus").textContent=prefs.demoMode?"Demo mode":"Kit disconnected";
  window.addEventListener("pagehide",()=>{stopKitHeartbeat();if(currentRunUsesKit&&kitClient?.connected)kitClient.endRun().catch(()=>{});});
  updateRgb(0,0,0);updateSensorGraphics();setupCameraBridge();initEditor();createWorker();enumerateCameras();connectRealKit();startKitHealthMonitor();
})();