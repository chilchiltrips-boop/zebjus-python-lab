(function(){
  const $=id=>document.getElementById(id),cfg=window.ZEBJUS_CONFIG||{};
  const video=$("cameraVideo"),overlay=$("cameraOverlay"),terminal=$("terminal");
  let editor=null,worker=null,ws=null,running=false,cameraRunning=false,currentCameraIndex=null,cameras=[],liveMode=false,liveCode="",liveNeedsHand=false,liveNeedsFace=false,liveNeedsCamera=false,liveTimer=null,lintTimer=null,lintSeq=0,lintWaiters=new Map(),editorIssue=null;
  const kitClient=window.ZebjusKit?new window.ZebjusKit.KitClient():null;
  let kitCommandErrorShown=false,kitHeartbeatTimer=null,kitHealthTimer=null,currentRunUsesKit=false,kitReconnectBusy=false,kitHeartbeatPingBusy=false,activePotPin=34;
  const KIT_FAILURE_LIMIT=5;
  let kitFailureCount=0,kitEverConnected=false,lastHardwareWarning="",lastHardwareWarningAt=0;
  let aiState={detected:false,fingers:0,side:"",faces:[],landmarks:[]};
  let imageFrame=null,uploadedImages=[],activeUploadPath="";
  let oledBuffer=null,oledBufferCtx=null,oledVisibleCtx=null,oledInverted=false;

  const isEmbedded=(()=>{try{return window.self!==window.top;}catch(e){return true;}})();
  const bridgeChannelName="zebjus-camera-"+Math.random().toString(36).slice(2);
  const bridgeChannel=("BroadcastChannel" in window)?new BroadcastChannel(bridgeChannelName):null;
  let bridgeWindow=null,bridgeWaiters=new Map();
  let sensorState={ultrasonicCm:45,potValue:128,potRaw:2056,potPin:34,potPercent:50,potMillivolts:0,inputs:{analog:{},digital:{},rotary:{},ultrasonic:{}}};

  const defaults={
    autoCamera:true,demoMode:true,kitName:"",kitId:"",kitChipId:"",kitIp:"",wsUrl:"",
    cameraIndex:0,fontSize:14,autoSave:true,stdin:"",
    demoUltrasonic:45,demoPot:128
  };
  function getSettings(){let s={};try{s=JSON.parse(localStorage.getItem("zebjus.lab.settings")||"{}");}catch(e){}return {...defaults,...s};}
  let prefs=getSettings();
  if(!prefs.kitName&&prefs.kitId&&!/^ZB-/i.test(prefs.kitId))prefs.kitName=prefs.kitId;
  if(kitClient){kitClient.name=prefs.kitName||"";kitClient.ipHint=prefs.kitIp||"";kitClient.chipId=String(prefs.kitChipId||"");}
  sensorState.ultrasonicCm=Number(prefs.demoUltrasonic)||45;
  sensorState.potValue=Math.max(0,Math.min(255,Number(prefs.demoPot)||0));
  sensorState.potRaw=Math.round(sensorState.potValue*4095/255);

  const examples={
    ledBasic:`# RGB LED Basic Colors
import cv2
from zebjus import RGBLED

rgb = RGBLED(25, 26, 27)

while True:
    rgb.color("red")
    cv2.waitKey(700)
    rgb.color("green")
    cv2.waitKey(700)
    rgb.color("blue")
    cv2.waitKey(700)
    rgb.color("yellow")
    cv2.waitKey(700)
    rgb.color("purple")
    cv2.waitKey(700)`,

    ledBlink:`# RGB LED Blink
import cv2
from zebjus import RGBLED

rgb = RGBLED(25, 26, 27)

while True:
    rgb.color("red")
    cv2.waitKey(300)
    rgb.off()
    cv2.waitKey(300)`,

    ledAnimation:`# RGB LED Animation
import cv2
from zebjus import RGBLED

rgb = RGBLED(25, 26, 27)
colors = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"]

while True:
    for color in colors:
        rgb.color(color)
        cv2.waitKey(250)`,

    ledEffects:`# RGB LED Indication Effects
import cv2
from zebjus import RGBLED

rgb = RGBLED(25, 26, 27)

while True:
    # Warning: 3 red flashes
    for i in range(3):
        rgb.color("red")
        cv2.waitKey(150)
        rgb.off()
        cv2.waitKey(150)

    # Connected: blue double flash
    for i in range(2):
        rgb.color("blue")
        cv2.waitKey(120)
        rgb.off()
        cv2.waitKey(120)

    # Success: green hold
    rgb.color("green")
    cv2.waitKey(700)
    rgb.off()
    cv2.waitKey(400)`,

    ledFade:`# RGB LED Fade / Breathing
import cv2
from zebjus import RGBLED

rgb = RGBLED(25, 26, 27)

while True:
    for value in range(0, 256, 10):
        rgb.write(value, 0, 255 - value)
        cv2.waitKey(30)

    for value in range(255, -1, -10):
        rgb.write(value, 0, 255 - value)
        cv2.waitKey(30)`,

    analogRead:`# Generic Analog Input Read
import cv2
from zebjus import AnalogInput

# ADC1 pins while Wi-Fi is active: 32, 33, 34, 35, 36, 39
# Works with potentiometers and other 0-3.3V analog sensors.
analog = AnalogInput(34)

while True:
    print("GPIO:", analog.pin,
          "Raw:", analog.raw(),
          "Value:", analog.read(),
          "Percent:", analog.percent(),
          "mV:", analog.millivolts())
    cv2.waitKey(200)`,

    potRead:`# Potentiometer / Analog Knob
import cv2
from zebjus import Potentiometer

# Potentiometer is an easy alias for AnalogInput.
pot = Potentiometer(34)

while True:
    value = pot.read()
    print("Pot:", value, "/ 255", "Raw:", pot.raw(), "Percent:", pot.percent(), "%")
    cv2.waitKey(200)`,

    digitalRead:`# Generic Digital Input
import cv2
from zebjus import DigitalInput

# For a digital sensor output. Configure pullup/active_low as required.
sensor = DigitalInput(32, pullup=False, active_low=False)

while True:
    print("GPIO:", sensor.pin, "State:", sensor.state(), "Active:", sensor.read())
    cv2.waitKey(80)`,

    switchRead:`# Push Switch Input
import cv2
from zebjus import Switch

# Default wiring: GPIO32 ---- button ---- GND
# Internal pull-up is enabled, so pressed = True when pin goes LOW.
button = Switch(32)

while True:
    print("GPIO:", button.pin,
          "State:", button.state(),
          "Pressed:", button.pressed())
    cv2.waitKey(80)`,

    switchLed:`# Switch Controls RGB LED
import cv2
from zebjus import Switch, RGBLED

button = Switch(32)
rgb = RGBLED(25, 26, 27)

while True:
    if button.pressed():
        rgb.color("green")
        print("BUTTON PRESSED")
    else:
        rgb.color("red", 40)
        print("Button released")

    cv2.waitKey(60)`,

    rotaryRead:`# Rotary Encoder + Push Switch
import cv2
from zebjus import RotaryEncoder

# Typical encoder module: CLK=32, DT=33, SW=14
encoder = RotaryEncoder(32, 33, 14)

while True:
    print("Position:", encoder.position(),
          "Delta:", encoder.delta(),
          "Direction:", encoder.direction(),
          "Pressed:", encoder.pressed())
    cv2.waitKey(60)`,

    rotaryLed:`# Rotary Encoder Controls RGB LED
import cv2
from zebjus import RotaryEncoder, RGBLED

encoder = RotaryEncoder(32, 33, 14)
rgb = RGBLED(25, 26, 27)

while True:
    position = encoder.position()

    # Keep brightness between 0 and 255.
    brightness = position * 15
    if brightness < 0:
        brightness = 0
    if brightness > 255:
        brightness = 255

    if encoder.pressed():
        rgb.color("white")
    elif encoder.direction() == "CW":
        rgb.write(0, brightness, 255 - brightness)
    elif encoder.direction() == "CCW":
        rgb.write(brightness, 0, 255 - brightness)

    print("Position:", position,
          "Brightness:", brightness,
          "Direction:", encoder.direction(),
          "Switch:", encoder.pressed())
    cv2.waitKey(60)`,

    analogLed:`# Analog Input Controls RGB LED
import cv2
from zebjus import AnalogInput, RGBLED

analog = AnalogInput(34)
rgb = RGBLED(25, 26, 27)

while True:
    value = analog.read()
    rgb.write(value, 255 - value, 80)
    print("Analog:", value, "Raw:", analog.raw())
    cv2.waitKey(60)`,

    ultrasonicRead:`# HC-SR04 Ultrasonic Distance
from zebjus import Ultrasonic, sleep

# TRIG=GPIO18, ECHO=GPIO19
# IMPORTANT: HC-SR04 ECHO is 5V. Use a voltage divider / level shifter to ESP32 ECHO GPIO.
ultra = Ultrasonic(18, 19)

while True:
    distance = ultra.read()
    print("Distance:", round(distance, 1), "cm")
    sleep(0.2)`,

    oledText:`# OLED Text Display
from zebjus import OLED

# SSD1306 128x64 I2C: SDA=21, SCL=22, address=0x3C
oled = OLED(21, 22, 0x3C)
oled.display_text("Hello ZEBJUS!", 10, 24, 1)`,

    oledTextAnimation:`# OLED Text Animation
from zebjus import OLED, sleep

oled = OLED(21, 22, 0x3C)

while True:
    oled.display_text("ZEBJUS", 38, 12, 1)
    sleep(0.4)
    oled.display_text("PYTHON LAB", 24, 30, 1)
    sleep(0.4)
    oled.scroll_text("LEARN  BUILD  CREATE", y=28, speed=0.08, step=6)`,

    oledShapes:`# OLED Drawing Primitives
from zebjus import OLED

oled = OLED()
oled.clear()
oled.rect(0, 0, 128, 64)
oled.line(0, 0, 127, 63)
oled.line(127, 0, 0, 63)
oled.circle(64, 32, 18)
oled.text("Z", 61, 28)
oled.show()`,

    ultrasonicOled:`# Ultrasonic Reading on OLED
from zebjus import Ultrasonic, OLED, sleep

ultra = Ultrasonic(18, 19)
oled = OLED(21, 22, 0x3C)

while True:
    cm = ultra.read()
    oled.display_text("Distance\\n%.1f cm" % cm, 12, 14, 1)
    print("Distance:", round(cm, 1), "cm")
    sleep(0.15)`,

    ultrasonicRadar:`# Ultrasonic Radar OLED Animation
import time
from zebjus import Ultrasonic, OLED, sleep

ultra = Ultrasonic(18, 19, max_cm=200)
oled = OLED(21, 22, 0x3C)

while True:
    cm = ultra.read()
    # Time-based sweep keeps moving even when browser refreshes each sensor cycle.
    phase = int(time.time() * 90) % 360
    angle = phase if phase <= 180 else 360 - phase
    oled.radar(angle, cm, max_cm=200, title="RADAR")
    sleep(0.07)`,

    ultrasonicDistanceBar:`# Ultrasonic OLED Distance Bar
from zebjus import Ultrasonic, OLED, sleep

ultra = Ultrasonic(18, 19, max_cm=400)
oled = OLED()

while True:
    cm = ultra.read()
    oled.distance_bar(cm, max_cm=400, title="ULTRASONIC")
    sleep(0.12)`
  };

  const libraries=[
    ["cv2","module","OpenCV"],["mediapipe","module","MediaPipe compatibility"],["cvzone","module","CVZone compatibility"],["numpy","module","NumPy"],["math","module","Math"],["random","module","Random"],
    ["zebjus","module","ZEBJUS hardware"],["zebjus_ai","module","MediaPipe AI"],["zebjus_cv","module","Camera/Image OpenCV bridge"],
    ["SerialModule","module","VISION AI serial compatibility"],["HandTrackingModule","module","VISION AI hand tracking compatibility"],["zebjus_wifi","module","ZEBJUS Wi-Fi compatibility"]
  ];
  const base=[
    ["and","keyword"],["as","keyword"],["break","keyword"],["class","keyword"],["continue","keyword"],["def","keyword"],["elif","keyword"],["else","keyword"],["except","keyword"],["False","keyword"],["for","keyword"],["from","keyword"],["if","keyword"],["import","keyword"],["in","keyword"],["None","keyword"],["not","keyword"],["or","keyword"],["pass","keyword"],["return","keyword"],["True","keyword"],["try","keyword"],["while","keyword"],["with","keyword"],
    ["print()","function","print()","Output"],["input()","function","input()","Program input"],["range()","function","range()","Range"],["len()","function","len()","Length"],["int()","function","int()","Integer"],["float()","function","float()","Float"],["str()","function","str()","String"],
    ["RGBLED()","class","RGBLED(25,26,27)","RGB LED pins + 0–255 color"],["LED()","class","LED()","White compatibility LED"],["OLED()","class","OLED(21,22,0x3C)","SSD1306 128x64 I2C display"],["Ultrasonic()","class","Ultrasonic(18,19)","HC-SR04 distance cm"],["AnalogInput()","class","AnalogInput(34)","Generic analog ADC1 input"],["Potentiometer()","class","Potentiometer(34)","Analog knob alias"],["DigitalInput()","class","DigitalInput(32)","Generic digital sensor input"],["Switch()","class","Switch(32)","Digital push switch input"],["RotaryEncoder()","class","RotaryEncoder(32,33,14)","Rotary encoder CLK/DT/SW"],["Motor()","class","Motor()","Motor"],["Servo()","class","Servo()","Servo"],["Camera()","class","Camera()","Camera"],["HandDetector()","class","HandDetector()","MediaPipe Hand"],["FaceDetector()","class","FaceDetector()","MediaPipe Face"],["sleep()","function","sleep()","Delay"],["load_image()","function","load_image()","Loaded image"],["show()","function","show()","Show image"],["draw_rgb_led()","function","draw_rgb_led()","Draw RGB LED"],["draw_potentiometer()","function","draw_potentiometer()","Draw pot"],["draw_ultrasonic()","function","draw_ultrasonic()","Draw distance bar"],
    ["cv2","module","cv2","OpenCV"],["mp","module","mp","MediaPipe"],["cvzone","module","cvzone","CVZone"],["np","module","np","NumPy"],
    ["SerialObject()","class","SerialObject()","VISION AI serial bridge"],["handDetector()","class","handDetector()","VISION AI hand tracker"],["WifiBridge()","class","WifiBridge()","ZEBJUS Wi-Fi bridge"]
  ];

  const moduleMembers={
    zebjus:[
      ["RGBLED","class","RGBLED","RGB LED: RGBLED(25,26,27)"],["LED","class","LED","LED"],["OLED","class","OLED","SSD1306 OLED: OLED(21,22,0x3C)"],["Ultrasonic","class","Ultrasonic","HC-SR04: Ultrasonic(18,19)"],
      ["AnalogInput","class","AnalogInput","Generic analog input"],["Potentiometer","class","Potentiometer","Potentiometer / analog knob"],["DigitalInput","class","DigitalInput","Generic digital input"],["Switch","class","Switch","Digital switch input"],["RotaryEncoder","class","RotaryEncoder","Rotary encoder input"],["Motor","class","Motor","Motor"],["Servo","class","Servo","Servo"],["sleep","function","sleep","Delay"]
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
    OLED:[["clear()","method","clear()","Clear OLED buffer"],["show()","method","show()","Display buffered drawing"],["text()","method","text()","Draw text"],["display_text()","method","display_text()","Clear + show text"],["line()","method","line()","Draw line"],["rect()","method","rect()","Draw rectangle"],["circle()","method","circle()","Draw circle"],["pixel()","method","pixel()","Draw pixel"],["scroll_text()","method","scroll_text()","Scrolling text animation"],["distance_bar()","method","distance_bar()","Distance gauge"],["radar()","method","radar()","Ultrasonic radar frame"],["invert()","method","invert()","Invert display"],["contrast()","method","contrast()","Set contrast"]],
    Ultrasonic:[["read()","method","read()","Distance cm"],["centimeters()","method","centimeters()","Distance cm"],["distance_cm","property","distance_cm","Distance cm"],["trig","property","trig","TRIG GPIO"],["echo","property","echo","ECHO GPIO"]],
    AnalogInput:[["read()","method","read()","Scaled 0–255"],["raw()","method","raw()","Raw ADC 0–4095"],["percent()","method","percent()","0–100 percent"],["millivolts()","method","millivolts()","ADC millivolts"],["pin","property","pin","Selected ADC GPIO"],["value","property","value","0–255"]],
    Potentiometer:[["read()","method","read()","Scaled 0–255"],["raw()","method","raw()","Raw ADC 0–4095"],["percent()","method","percent()","0–100 percent"],["millivolts()","method","millivolts()","ADC millivolts"],["pin","property","pin","Selected ADC GPIO"],["value","property","value","0–255"]],
    DigitalInput:[["read()","method","read()","True when active"],["active()","method","active()","Same as read"],["state()","method","state()","Raw digital 0/1"],["pin","property","pin","Selected GPIO"],["value","property","value","Boolean active state"]],
    Switch:[["read()","method","read()","True when active"],["pressed()","method","pressed()","True when switch is pressed"],["state()","method","state()","Raw digital 0/1"],["pin","property","pin","Selected GPIO"],["value","property","value","Boolean active state"]],
    RotaryEncoder:[["position()","method","position()","Accumulated rotary position"],["delta()","method","delta()","Change since latest read"],["direction()","method","direction()","CW / CCW / NONE"],["pressed()","method","pressed()","Rotary push switch"],["switch_state()","method","switch_state()","Raw switch 0/1"],["value","property","value","Same as position"]],
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
    for(const type of ["RGBLED","LED","OLED","Ultrasonic","AnalogInput","Potentiometer","DigitalInput","Switch","RotaryEncoder","Motor","Servo","Camera","HandDetector","FaceDetector","SerialObject","handDetector","WifiBridge"]){
      if(new RegExp("\\b"+esc+"\\s*=\\s*"+type+"\\s*\\(").test(code))return type;
    }
    if(new RegExp("\\b"+esc+"\\s*=\\s*(?:HandDetector\\s*\\(\\s*\\)|\\w+)\\.read\\s*\\(").test(code))return "HandResult";
    if(name==="rgb")return "RGBLED";if(name==="led")return "LED";if(name==="oled"||name==="display")return "OLED";if(name==="ultra")return "Ultrasonic";if(name==="analog")return "AnalogInput";if(name==="pot")return "Potentiometer";if(name==="sensor"||name==="din")return "DigitalInput";if(name==="button"||name==="sw")return "Switch";if(name==="encoder"||name==="rotary")return "RotaryEncoder";
    if(name==="motor")return "Motor";if(name==="servo")return "Servo";if(name==="cam")return "Camera";if(name==="hand")return "HandDetector";if(name==="result")return "HandResult";
    if(name==="cv2")return "cv2";
    return null;
  }

  function hintItem(e){const [label,type,text,info]=e;return{text:text||label,displayText:label+(info?"   — "+info:""),className:"hint-"+type};}
  function filterItems(items,prefix){return items.filter(x=>x[0].replace(/\(\)$/,"").startsWith(prefix)).map(hintItem);}

  // ---------- GPIO pin assistance / validation ----------
  const RGB_OUTPUT_PINS=[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33];
  const ANALOG_INPUT_PINS=[32,33,34,35,36,39];
  const DIGITAL_INPUT_PINS=[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39];
  const PIN_HINT_ORDER={
    RGBLED:[25,26,27,32,33,4,13,14,16,17,18,19,21,22,23],
    AnalogInput:[34,35,36,39,32,33],Potentiometer:[34,35,36,39,32,33],
    DigitalInput:[32,33,14,27,26,25,4,13,16,17,18,19,21,22,23,34,35,36,39],
    Switch:[32,33,14,27,26,25,4,13,16,17,18,19,21,22,23,34,35,36,39],
    RotaryEncoder:[32,33,14,27,26,25,4,13,16,17,18,19,21,22,23,34,35,36,39],
    Ultrasonic:[18,19,16,17,21,22,23,25,26,27,32,33,4,13,14],
    OLED:[21,22,18,19,16,17,23,25,26,27,32,33,4,13,14]
  };

  function pinEntries(src){
    const out=[];
    const lines=String(src||"").split(/\r?\n/);
    const add=(pin,line,role,kind,valid,offset=1)=>{if(Number.isFinite(pin))out.push({pin:Number(pin),line,role,kind,valid,offset});};
    lines.forEach((text,i)=>{
      let m;
      const rgb=/\bRGBLED\s*\(([^)]*)\)/g;
      while((m=rgb.exec(text))){
        const args=m[1],hasNamed=/\b(?:red|green|blue)\s*=/.test(args);
        const positional=args.split(",").map(x=>x.trim()).filter(x=>x&&!x.includes("="));
        // RGBLED(), RGBLED(1) use the kit default physical RGB pins.
        if(!hasNamed&&positional.length<=1){
          add(25,i+1,"RGB red","RGBLED",RGB_OUTPUT_PINS,m.index+1);add(26,i+1,"RGB green","RGBLED",RGB_OUTPUT_PINS,m.index+1);add(27,i+1,"RGB blue","RGBLED",RGB_OUTPUT_PINS,m.index+1);
        }else{
          const r=parseNumberArg(args,"red",0,null),g=parseNumberArg(args,"green",1,null),b=parseNumberArg(args,"blue",2,null);
          if(r!==null)add(r,i+1,"RGB red","RGBLED",RGB_OUTPUT_PINS,m.index+1);
          if(g!==null)add(g,i+1,"RGB green","RGBLED",RGB_OUTPUT_PINS,m.index+1);
          if(b!==null)add(b,i+1,"RGB blue","RGBLED",RGB_OUTPUT_PINS,m.index+1);
        }
      }
      const analog=/\b(AnalogInput|Potentiometer)\s*\(([^)]*)\)/g;
      while((m=analog.exec(text))){const pin=parseNumberArg(m[2],"pin",0,34);add(pin,i+1,m[1]+" input",m[1],ANALOG_INPUT_PINS,m.index+1);}
      const digital=/\b(DigitalInput|Switch)\s*\(([^)]*)\)/g;
      while((m=digital.exec(text))){const pin=parseNumberArg(m[2],"pin",0,32);add(pin,i+1,m[1]+" input",m[1],DIGITAL_INPUT_PINS,m.index+1);}
      const rotary=/\bRotaryEncoder\s*\(([^)]*)\)/g;
      while((m=rotary.exec(text))){
        const args=m[1],clk=parseNumberArg(args,"clk",0,32),dt=parseNumberArg(args,"dt",1,33),sw=parseNumberArg(args,"switch",2,-1);
        add(clk,i+1,"Rotary CLK","RotaryEncoder",DIGITAL_INPUT_PINS,m.index+1);
        add(dt,i+1,"Rotary DT","RotaryEncoder",DIGITAL_INPUT_PINS,m.index+1);
        if(sw>=0)add(sw,i+1,"Rotary switch","RotaryEncoder",DIGITAL_INPUT_PINS,m.index+1);
      }
      const ultrasonic=/\bUltrasonic\s*\(([^)]*)\)/g;
      while((m=ultrasonic.exec(text))){
        const args=m[1],pos=args.split(",").map(x=>x.trim()).filter(x=>x&&!x.includes("="));
        let trig=parseNumberArg(args,"trig",0,18),echo=parseNumberArg(args,"echo",1,19);
        if(pos.length===1&&!/\b(?:trig|echo)\s*=/.test(args)){trig=18;echo=19;}
        add(trig,i+1,"Ultrasonic TRIG","Ultrasonic",RGB_OUTPUT_PINS,m.index+1);
        add(echo,i+1,"Ultrasonic ECHO","Ultrasonic",DIGITAL_INPUT_PINS,m.index+1);
      }
      const oled=/\bOLED\s*\(([^)]*)\)/g;
      while((m=oled.exec(text))){
        const args=m[1],sda=parseNumberArg(args,"sda",0,21),scl=parseNumberArg(args,"scl",1,22);
        add(sda,i+1,"OLED SDA","OLED",RGB_OUTPUT_PINS,m.index+1);
        add(scl,i+1,"OLED SCL","OLED",RGB_OUTPUT_PINS,m.index+1);
      }
    });
    return out;
  }

  function hardwarePinValidation(src){
    const entries=pinEntries(src);
    for(const e of entries){
      if(!e.valid.includes(e.pin)){
        const allowed=e.valid.map(p=>"GPIO"+p).join(", ");
        return {errorType:"PinError",line:e.line,offset:e.offset,message:`GPIO${e.pin} is not valid for ${e.role}.`,suggestion:`Choose a supported pin: ${allowed}.`};
      }
    }
    const used=new Map();
    for(const e of entries){
      if(used.has(e.pin)){
        const first=used.get(e.pin);
        return {errorType:"PinConflictError",line:e.line,offset:e.offset,message:`GPIO${e.pin} is already used by ${first.role} on line ${first.line}.`,suggestion:`Use a different GPIO for ${e.role}. The same physical pin cannot be assigned twice in one program.`};
      }
      used.set(e.pin,e);
    }
    return null;
  }

  function pinHintContext(cm){
    const cur=cm.getCursor(),left=cm.getLine(cur.line).slice(0,cur.ch),full=cm.getValue();
    const m=left.match(/\b(RGBLED|AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder|Ultrasonic|OLED)\s*\(([^()]*)$/);
    if(!m)return null;
    const type=m[1],args=m[2],parts=args.split(","),argIndex=Math.max(0,parts.length-1);
    // OLED third argument is I2C address; Ultrasonic third argument is max_cm — neither is a GPIO.
    if((type==="OLED"||type==="Ultrasonic")&&argIndex>1)return null;
    const currentPart=parts[parts.length-1]||"";
    const prefix=(currentPart.match(/(?:^|=)\s*(\d*)$/)||[])[1];
    if(prefix===undefined)return null;
    const alreadyHere=[...args.matchAll(/\b(\d+)\b/g)].map(x=>Number(x[1]));
    const usedElsewhere=pinEntries(full).map(x=>x.pin);
    let pins=PIN_HINT_ORDER[type]||DIGITAL_INPUT_PINS;
    if(type==="Ultrasonic"&&argIndex===1)pins=DIGITAL_INPUT_PINS;
    if(type==="Ultrasonic"&&argIndex===0)pins=RGB_OUTPUT_PINS;
    if(type==="OLED")pins=RGB_OUTPUT_PINS;
    pins=pins.filter(p=>!alreadyHere.includes(p)&&!usedElsewhere.includes(p));
    const list=pins.filter(p=>String(p).startsWith(prefix)).map(p=>({text:String(p),displayText:`GPIO${p}   — available ${type} pin`,className:"hint-constant"}));
    return {list,from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};
  }


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

    const pinHints=pinHintContext(cm);
    if(pinHints)return pinHints;

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
    const savedDraft=prefs.autoSave?localStorage.getItem("zebjus.lab.code"):null;
    $("codeEditor").value=savedDraft!==null?savedDraft:examples.ledBasic;
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
        if(/[A-Za-z0-9_.(,=]$/.test(typed)||/\b(?:import|from)\s+$/.test(left))setTimeout(()=>cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false}),0);
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
  function setCode(t){if(editor){editor.setValue(String(t??""));editor.focus();}}
  function saveDraftNow(){if(!prefs.autoSave)return;localStorage.setItem("zebjus.lab.code",getCode());if($("saveState"))$("saveState").textContent="Saved";}
  async function newProject(){
    if(running)await stopProgram();
    setCode("");clearEditorIssue();terminal.textContent="";saveDraftNow();
    badge($("pythonStatus"),"Python ready","ok");
  }
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
    worker=new Worker("./py-worker.js?v=5.22",{type:"module"});
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
          if(result.ok){
            const pinIssue=hardwarePinValidation(waiter.code);
            if(pinIssue)Object.assign(result,{ok:false,...pinIssue});
          }
          if(!result.ok){
            result.suggestion=result.suggestion||errorSuggestion(result.errorType,result.message,waiter.code);
            if(waiter.show)showEditorIssue(result);
          }else if(waiter.show){
            clearEditorIssue();
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
          endHardwareRun().finally(()=>log("Program finished. RGB/motor outputs are OFF; OLED keeps the last displayed frame."));
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
  function parseBoolToken(text,name,defaultValue=true){
    const m=String(text||"").match(new RegExp("\\b"+name+"\\s*=\\s*(True|False|true|false|1|0)","i"));
    if(!m)return defaultValue;
    return /^(true|1)$/i.test(m[1]);
  }
  function parseNumberArg(args,name,index,defaultValue=null){
    const named=String(args||"").match(new RegExp("\\b"+name+"\\s*=\\s*(-?\\d+)","i"));
    if(named)return Number(named[1]);
    const positional=String(args||"").split(",").map(x=>x.trim()).filter(x=>!x.includes("="));
    if(index<positional.length&&/^-?\d+$/.test(positional[index]))return Number(positional[index]);
    return defaultValue;
  }
  function requestedInputs(src){
    const out={analog:[],digital:[],rotary:[],ultrasonic:[]};let m;
    const analogRe=/\b(AnalogInput|Potentiometer)\s*\(([^)]*)\)/g;
    while((m=analogRe.exec(src))){const pin=parseNumberArg(m[2],"pin",0,34);if(pin!==null)out.analog.push({pin});}

    const switchRe=/\b(DigitalInput|Switch)\s*\(([^)]*)\)/g;
    while((m=switchRe.exec(src))){
      const kind=m[1],args=m[2],pin=parseNumberArg(args,"pin",0,32),isSwitch=kind==="Switch";
      out.digital.push({pin,pullup:parseBoolToken(args,"pullup",isSwitch),activeLow:parseBoolToken(args,"active_low",isSwitch)});
    }

    const rotaryRe=/\bRotaryEncoder\s*\(([^)]*)\)/g;
    while((m=rotaryRe.exec(src))){
      const args=m[1],clk=parseNumberArg(args,"clk",0,32),dt=parseNumberArg(args,"dt",1,33),sw=parseNumberArg(args,"switch",2,-1);
      out.rotary.push({clk,dt,sw,pullup:parseBoolToken(args,"pullup",true)});
    }
    const ultraRe=/\bUltrasonic\s*\(([^)]*)\)/g;
    while((m=ultraRe.exec(src))){
      const args=m[1],pos=args.split(",").map(x=>x.trim()).filter(x=>x&&!x.includes("="));
      let trig=parseNumberArg(args,"trig",0,18),echo=parseNumberArg(args,"echo",1,19);
      if(pos.length===1&&!/\b(?:trig|echo)\s*=/.test(args)){trig=18;echo=19;} // legacy Ultrasonic(1)
      out.ultrasonic.push({trig,echo,maxCm:parseNumberArg(args,"max_cm",2,400)});
    }
    return out;
  }
  function requestedRgbPins(src){
    const m=src.match(/\bRGBLED\s*\(([^)]*)\)/);if(!m)return [25,26,27];
    const args=m[1],hasNamed=/\b(?:red|green|blue)\s*=/.test(args);
    const positional=args.split(",").map(x=>x.trim()).filter(x=>x&&!x.includes("="));
    if(!hasNamed&&positional.length<=1)return [25,26,27];
    const r=parseNumberArg(args,"red",0,25),g=parseNumberArg(args,"green",1,26),b=parseNumberArg(args,"blue",2,27);
    return [r,g,b];
  }
  async function refreshInputsFromKit(src,showError=false){
    if(prefs.demoMode)return true;
    const specs=requestedInputs(src);
    try{
      for(const a of specs.analog){
        const d=await kitClient.analog(a.pin);updateSensorPacket(d);
      }
      for(const sw of specs.digital){
        const d=await kitClient.digital(sw.pin,{pullup:sw.pullup,activeLow:sw.activeLow});updateSensorPacket(d);
      }
      for(const r of specs.rotary){
        const d=await kitClient.rotary(r.clk,r.dt,r.sw,{pullup:r.pullup});updateSensorPacket(d);
      }
      for(const u of specs.ultrasonic){
        const d=await kitClient.ultrasonic(u.trig,u.echo,{maxCm:u.maxCm});updateSensorPacket(d);
      }
      markKitSuccess(kitClient.status);
      return true;
    }catch(e){
      if(showError)log("Input read error: "+(e?.message||e));
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
    if(!prefs.demoMode&&/\b(?:AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder|Ultrasonic)\s*\(/.test(liveCode)){
      const ok=await refreshInputsFromKit(liveCode,false);if(!ok)scheduleSilentReconnect();
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
    const needsPhysicalKit=/\b(?:RGBLED|LED|Motor|Servo|OLED|Ultrasonic|AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder)\s*\(/.test(src);
    const inputSpecs=requestedInputs(src),rgbPins=/\bRGBLED\s*\(/.test(src)?requestedRgbPins(src):[];
    const inputPins=[...inputSpecs.analog.map(x=>x.pin),...inputSpecs.digital.map(x=>x.pin),...inputSpecs.rotary.flatMap(x=>[x.clk,x.dt,...(x.sw>=0?[x.sw]:[])]),...inputSpecs.ultrasonic.flatMap(x=>[x.trig,x.echo])];
    const conflict=inputPins.find(pin=>rgbPins.includes(pin));
    if(conflict!==undefined){terminal.textContent="";log(`Pin conflict: GPIO${conflict} is selected for both an input and RGB output.`);badge($("pythonStatus"),"Pin conflict","warn");return;}
    const seenPins=new Set(),duplicateInput=inputPins.find(pin=>seenPins.has(pin)?true:(seenPins.add(pin),false));
    if(duplicateInput!==undefined){terminal.textContent="";log(`Pin conflict: GPIO${duplicateInput} is assigned to more than one input device.`);badge($("pythonStatus"),"Pin conflict","warn");return;}
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
    liveMode=/\bwhile\s+True\s*:/.test(src)&&(needsCamera||/\bSerialObject\b|\bWifiBridge\b|\b(?:AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder|Ultrasonic)\s*\(/.test(src));
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
        if(/\b(?:AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder|Ultrasonic)\s*\(/.test(src))await refreshInputsFromKit(src,true);
      }
      catch(e){running=false;updateRunControls();log("Could not start kit run session: "+(e?.message||e));badge($("pythonStatus"),"Kit not ready","warn");return;}
    }else{currentRunUsesKit=false;}

    badge($("pythonStatus"),liveMode?"Live running…":"Running…","warn");
    postProgramToWorker(src,runFrame);
  }

  function persistKitIdentity(st){
    if(!st)return;
    prefs.kitName=st.name||prefs.kitName||prefs.kitId||"";
    prefs.kitId=prefs.kitName; // legacy field kept for compatibility
    prefs.kitChipId=String(st.chipId||prefs.kitChipId||"");
    if(st.ip)prefs.kitIp=st.ip; // DHCP/new-IP cache update
    localStorage.setItem("zebjus.lab.settings",JSON.stringify(prefs));
    if(kitClient){kitClient.name=prefs.kitName;kitClient.ipHint=prefs.kitIp||"";kitClient.chipId=prefs.kitChipId||"";}
    if($("kitNameText"))$("kitNameText").textContent=prefs.kitName||"No kit selected";
  }

  function markKitSuccess(st=null){
    kitFailureCount=0;kitEverConnected=true;kitCommandErrorShown=false;
    if(st)persistKitIdentity(st);
    if(!prefs.demoMode)badge($("kitStatus"),"Kit connected","ok");
  }

  function markKitFailure(reason=""){
    kitFailureCount=Math.min(KIT_FAILURE_LIMIT,kitFailureCount+1);
    if(kitEverConnected&&kitFailureCount<KIT_FAILURE_LIMIT){
      // v5.22 no-blink rule: 1–4 misses keep the visible state Connected.
      return false;
    }
    badge($("kitStatus"),"Kit disconnected");
    if(kitFailureCount===KIT_FAILURE_LIMIT&&reason&&!kitCommandErrorShown){
      log("Kit connection lost after 5 consecutive checks. Program is kept running; ESP outputs fail safe after 10 s without heartbeat.");
      kitCommandErrorShown=true;
    }
    return true;
  }

  async function resumeRunSessionAfterReconnect(){
    if(!running||!currentRunUsesKit)return;
    try{await kitClient.pingRun();markKitSuccess(kitClient.status);}
    catch(e){
      if(e?.status===409){await kitClient.beginRun();markKitSuccess(kitClient.status);}
      else throw e;
    }
  }

  function scheduleSilentReconnect(){
    if(prefs.demoMode||!kitClient||kitReconnectBusy||!(prefs.kitName||prefs.kitId))return;
    kitReconnectBusy=true;
    Promise.resolve().then(async()=>{
      try{
        if(!kitClient.name)kitClient.name=prefs.kitName||prefs.kitId||"";
        kitClient.ipHint=prefs.kitIp||kitClient.ipHint||"";
        kitClient.chipId=String(prefs.kitChipId||kitClient.chipId||"");
        const st=await kitClient.reconnect(2);
        markKitSuccess(st);
        if(running&&currentRunUsesKit)await resumeRunSessionAfterReconnect();
      }catch(_){/* failure counter is driven by health/heartbeat cycles, not every fallback address */}
      finally{kitReconnectBusy=false;}
    });
  }

  function stopKitHeartbeat(){if(kitHeartbeatTimer){clearInterval(kitHeartbeatTimer);kitHeartbeatTimer=null;}kitHeartbeatPingBusy=false;}

  async function heartbeatTick(){
    if(!running||!currentRunUsesKit||prefs.demoMode||kitHeartbeatPingBusy)return;
    if(!kitClient?.base){markKitFailure("heartbeat");scheduleSilentReconnect();return;}
    kitHeartbeatPingBusy=true;
    try{await kitClient.pingRun();markKitSuccess(kitClient.status);}
    catch(e){
      if(e?.status===409){
        try{await kitClient.beginRun();markKitSuccess(kitClient.status);}
        catch(_){markKitFailure("heartbeat");scheduleSilentReconnect();}
      }else{markKitFailure("heartbeat");scheduleSilentReconnect();}
    }finally{kitHeartbeatPingBusy=false;}
  }

  async function beginHardwareRun(){
    if(prefs.demoMode||!kitClient?.connected){currentRunUsesKit=false;return true;}
    await kitClient.beginRun();markKitSuccess(kitClient.status);
    currentRunUsesKit=true;stopKitHeartbeat();
    kitHeartbeatTimer=setInterval(heartbeatTick,1000);
    return true;
  }

  async function endHardwareRun(){
    stopKitHeartbeat();
    const used=currentRunUsesKit;currentRunUsesKit=false;
    const stopRgb={command:"RGB_LED_SET",id:1,r:0,g:0,b:0};
    if(used&&!prefs.demoMode&&kitClient?.connected){
      try{await kitClient.flushCommands();await kitClient.endRun();kitCommandErrorShown=false;}
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
    log("Stopped. RGB/motor outputs are OFF; OLED animation is stopped.");
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

  function initOledPreview(){
    const canvas=$("oledCanvas");if(!canvas)return false;
    if(!oledBuffer){
      oledBuffer=document.createElement("canvas");oledBuffer.width=128;oledBuffer.height=64;
      oledBufferCtx=oledBuffer.getContext("2d");oledVisibleCtx=canvas.getContext("2d");
      oledBufferCtx.imageSmoothingEnabled=false;oledVisibleCtx.imageSmoothingEnabled=false;
      oledBufferCtx.fillStyle="#000";oledBufferCtx.fillRect(0,0,128,64);commitOledPreview();
    }
    return true;
  }
  function commitOledPreview(){
    if(!oledBufferCtx||!oledVisibleCtx)return;
    oledVisibleCtx.save();oledVisibleCtx.setTransform(1,0,0,1,0,0);oledVisibleCtx.fillStyle="#000";oledVisibleCtx.fillRect(0,0,128,64);oledVisibleCtx.drawImage(oledBuffer,0,0);oledVisibleCtx.restore();
  }
  function oledColor(on=true){return on===false||on===0||on==="0"?"#000":"#fff";}
  function drawOledText(ctx,text,x,y,size=1,on=true){
    size=Math.max(1,Math.min(4,Number(size)||1));ctx.fillStyle=oledColor(on);ctx.font=`${7*size}px monospace`;ctx.textBaseline="top";
    String(text??"").split(/\n/).forEach((line,i)=>ctx.fillText(line,Number(x)||0,(Number(y)||0)+i*8*size));
  }
  function applyOledCommand(p){
    if(!p||!String(p.command||"").startsWith("OLED_"))return;
    if(!initOledPreview())return;
    const ctx=oledBufferCtx,cmd=String(p.command||"");
    const show=p.show===true||p.show===1||p.show==="1"||p.show==="true";
    if(cmd==="OLED_INIT"){$("oledLabel").textContent=`SSD1306 · SDA ${p.sda??21} · SCL ${p.scl??22} · 0x${Number(p.address??60).toString(16).toUpperCase()}`;return;}
    if(cmd==="OLED_CLEAR"){ctx.fillStyle="#000";ctx.fillRect(0,0,128,64);if(show)commitOledPreview();return;}
    if(cmd==="OLED_SHOW"){commitOledPreview();return;}
    if(cmd==="OLED_TEXT"){drawOledText(ctx,p.text,p.x,p.y,p.size,p.on!==false);if(show)commitOledPreview();return;}
    if(cmd==="OLED_DISPLAY_TEXT"){
      if(p.clear!==false&&p.clear!==0&&p.clear!=="0"){ctx.fillStyle="#000";ctx.fillRect(0,0,128,64);}drawOledText(ctx,p.text,p.x,p.y,p.size,true);commitOledPreview();return;
    }
    ctx.strokeStyle=oledColor(p.on!==false);ctx.fillStyle=oledColor(p.on!==false);ctx.lineWidth=1;
    if(cmd==="OLED_PIXEL"){ctx.fillRect(Number(p.x)||0,Number(p.y)||0,1,1);}
    else if(cmd==="OLED_LINE"){ctx.beginPath();ctx.moveTo(Number(p.x1)||0,Number(p.y1)||0);ctx.lineTo(Number(p.x2)||0,Number(p.y2)||0);ctx.stroke();}
    else if(cmd==="OLED_RECT"){
      const x=Number(p.x)||0,y=Number(p.y)||0,w=Number(p.w)||0,h=Number(p.h)||0;if(p.fill===true||p.fill===1||p.fill==="1"||p.fill==="true")ctx.fillRect(x,y,w,h);else ctx.strokeRect(x+.5,y+.5,Math.max(0,w-1),Math.max(0,h-1));
    }else if(cmd==="OLED_CIRCLE"){
      ctx.beginPath();ctx.arc(Number(p.x)||0,Number(p.y)||0,Math.max(0,Number(p.r)||0),0,Math.PI*2);if(p.fill===true||p.fill===1||p.fill==="1"||p.fill==="true")ctx.fill();else ctx.stroke();
    }else if(cmd==="OLED_INVERT"){
      oledInverted=p.enabled===true||p.enabled===1||p.enabled==="1"||p.enabled==="true";$("oledCanvas").classList.toggle("oled-invert",oledInverted);return;
    }else if(cmd==="OLED_CONTRAST"){$("oledLabel").textContent=`OLED contrast ${Math.max(0,Math.min(255,Number(p.value)||0))}`;return;}
    else if(cmd==="OLED_DISTANCE_BAR"){
      ctx.fillStyle="#000";ctx.fillRect(0,0,128,64);drawOledText(ctx,p.title||"Distance",2,2,1,true);
      const d=Math.max(0,Number(p.distance)||0),mx=Math.max(1,Number(p.maxCm)||400),ratio=Math.min(1,d/mx);drawOledText(ctx,`${d.toFixed(1)} cm`,34,20,1,true);
      ctx.strokeStyle="#fff";ctx.strokeRect(8.5,42.5,111,12);ctx.fillStyle="#fff";ctx.fillRect(11,45,Math.round(106*ratio),7);commitOledPreview();return;
    }else if(cmd==="OLED_RADAR"){
      ctx.fillStyle="#000";ctx.fillRect(0,0,128,64);drawOledText(ctx,p.title||"RADAR",2,1,1,true);
      const cx=64,cy=61,r=42,ang=Math.max(0,Math.min(180,Number(p.angle)||0)),rad=Math.PI-ang*Math.PI/180;
      ctx.strokeStyle="#fff";for(const rr of [14,28,42]){ctx.beginPath();ctx.arc(cx,cy,rr,Math.PI,0);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.stroke();
      const ex=cx+Math.cos(rad)*r,ey=cy-Math.sin(rad)*r;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ex,ey);ctx.stroke();
      const d=Math.max(0,Number(p.distance)||0),mx=Math.max(1,Number(p.maxCm)||200),dr=r*Math.min(1,d/mx),dx=cx+Math.cos(rad)*dr,dy=cy-Math.sin(rad)*dr;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(dx,dy,2,0,Math.PI*2);ctx.fill();drawOledText(ctx,`${d.toFixed(0)}cm`,91,1,1,true);commitOledPreview();return;
    }
    if(show)commitOledPreview();
  }

  function applyDemo(p){
    if(p.command&&String(p.command).startsWith("OLED_"))applyOledCommand(p);
    if(p.command==="RGB_LED_SET"&&+p.id===1)updateRgb(p.r,p.g,p.b);
    if(p.command==="LED_SET"&&+p.id===1)updateRgb(+p.value?255:0,+p.value?255:0,+p.value?255:0);
    if(p.command==="MOTOR_SET"&&+p.id===1){const s=Math.max(-100,Math.min(100,+p.speed||0));$("motorMeter").style.width=Math.abs(s)+"%";$("motorLabel").textContent=s===0?"Stopped":`${s>0?"Forward":"Backward"} ${Math.abs(s)}%`;}
    if(p.command==="SERVO_SET"&&+p.id===1){const a=Math.max(0,Math.min(180,+p.angle||0));$("servoNeedle").style.transform=`rotate(${a-90}deg)`;$("servoLabel").textContent=a+"°";}
  }

  function updateSensorPacket(data){
    const sensor=String(data.sensor||data.name||"").toUpperCase();
    sensorState.inputs=sensorState.inputs||{analog:{},digital:{},rotary:{},ultrasonic:{}};
    if(sensor==="ULTRASONIC"||data.distanceCm!==undefined||data.ultrasonicCm!==undefined){
      sensorState.ultrasonicCm=Number(data.distanceCm??data.ultrasonicCm??sensorState.ultrasonicCm);
      const key=`${Number(data.trig??18)},${Number(data.echo??19)}`;sensorState.inputs.ultrasonic[key]={...data};
    }
    if(sensor==="ANALOG"||sensor==="POT"||sensor==="POTENTIOMETER"||data.value255!==undefined){
      const pin=Number(data.pin??34),d={...data,pin};sensorState.inputs.analog[String(pin)]=d;
      sensorState.potValue=Math.max(0,Math.min(255,Number(data.potValue??data.value255??data.value??sensorState.potValue)));
      sensorState.potRaw=Number(data.raw??data.potRaw??Math.round(sensorState.potValue*4095/255));
      sensorState.potPin=pin;sensorState.potPercent=Number(data.percent??Math.round(sensorState.potValue*100/255));sensorState.potMillivolts=Number(data.millivolts??sensorState.potMillivolts??0);
      if($("potTitle"))$("potTitle").textContent="Analog Input";
    }
    if(sensor==="DIGITAL"){
      const pin=Number(data.pin);sensorState.inputs.digital[String(pin)]={...data,pin};
      if($("switchLabel"))$("switchLabel").textContent=`GPIO${pin} · ${data.active?"ACTIVE / PRESSED":"released"} · state ${data.state}`;
    }
    if(sensor==="ROTARY"){
      const key=`${Number(data.clk)},${Number(data.dt)},${Number(data.sw??-1)}`;sensorState.inputs.rotary[key]={...data};
      if($("rotaryLabel"))$("rotaryLabel").textContent=`Pos ${data.position} · ${data.direction||"NONE"} · Δ${data.delta||0} · SW ${data.pressed?"pressed":"released"}`;
    }
    updateSensorGraphics();
  }

  function warnHardwareCommand(message){
    const text=String(message||"Hardware command failed"),now=Date.now();
    if(text!==lastHardwareWarning||now-lastHardwareWarningAt>3000){log("Kit hardware error: "+text);lastHardwareWarning=text;lastHardwareWarningAt=now;}
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
            if(running&&e?.status===409&&/not running|run session/i.test(String(e?.message||""))){await kitClient.beginRun();currentRunUsesKit=true;result=await kitClient.rgb(p);}
            else throw e;
          }
          if(!result?.skipped)applyDemo(p); // Mirror only after ESP32 acknowledges: screen and kit stay synchronized.
          markKitSuccess(kitClient.status);
        }else if(String(p.command||"").startsWith("OLED_")){
          let result;
          try{result=await kitClient.oled(p);}
          catch(e){
            if(running&&e?.status===409&&/not running|run session/i.test(String(e?.message||""))){await kitClient.beginRun();currentRunUsesKit=true;result=await kitClient.oled(p);}
            else throw e;
          }
          if(!result?.skipped)applyOledCommand(p);
          markKitSuccess(kitClient.status);
        }else if(ws?.readyState===WebSocket.OPEN){
          ws.send(JSON.stringify({type:"command",kitId:prefs.kitName||prefs.kitId,...p}));
          applyDemo(p);
        }else{
          applyDemo(p);
        }
      }catch(e){
        // A temporary API miss must not stop the Python program or blink the UI. Hardware 4xx errors are shown but also do not stop Python.
        if(e?.status>=400&&e?.status<500)warnHardwareCommand(e?.message||e);else scheduleSilentReconnect();
      }
      return;
    }

    if(ws?.readyState===WebSocket.OPEN){
      ws.send(JSON.stringify({type:"command",kitId:prefs.kitName||prefs.kitId,...p}));
      applyDemo(p);
    }else scheduleSilentReconnect();
  }

  async function ensureKitConnected(showError=true,{silent=false}={}){
    if(prefs.demoMode)return true;
    const name=(prefs.kitName||prefs.kitId||"").trim();
    if(!name||!kitClient){if(showError)log("No physical kit selected. Open Settings → Kit Connection.");return false;}
    try{
      if(!silent&&!kitEverConnected)badge($("kitStatus"),"Connecting kit…","warn");
      kitClient.name=name;kitClient.ipHint=prefs.kitIp||kitClient.ipHint||"";kitClient.chipId=String(prefs.kitChipId||kitClient.chipId||"");
      let st;
      if(kitClient.connected)st=await kitClient.refresh();
      else{
        try{st=await kitClient.connect(name,prefs.kitIp||"");}
        catch(_){st=await kitClient.reconnect(2);}
      }
      markKitSuccess(st);return true;
    }catch(e){
      markKitFailure("health");scheduleSilentReconnect();
      if(!kitEverConnected)badge($("kitStatus"),"Kit disconnected");
      if(showError)log("Kit connection failed: "+(e?.message||e)+" Background reconnect will continue. Check kit power and Wi-Fi.");
      return false;
    }
  }

  function startKitHealthMonitor(){
    if(kitHealthTimer)clearInterval(kitHealthTimer);
    kitHealthTimer=setInterval(async()=>{
      if(prefs.demoMode||running||!(prefs.kitName||prefs.kitId))return;
      if(kitClient?.connected){
        try{const st=await kitClient.refresh();markKitSuccess(st);}
        catch(_){markKitFailure("health");scheduleSilentReconnect();}
      }else{
        markKitFailure("health");scheduleSilentReconnect();
      }
    },4000);
  }

  function connectRealKit(){
    if(prefs.demoMode)return;
    ensureKitConnected(false).then(ok=>{
      if(ok)return;
      if(!prefs.wsUrl?.startsWith("wss://"))return;
      try{
        ws=new WebSocket(prefs.wsUrl);
        ws.onopen=()=>{ws.send(JSON.stringify({type:"hello",kitId:prefs.kitName||prefs.kitId}));markKitSuccess(kitClient?.status||null);};
        ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.type==="sensor"||d.type==="sensors")updateSensorPacket(d);}catch(_){}};
        ws.onclose=()=>{markKitFailure("websocket");scheduleSilentReconnect();};
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
  $("newProjectBtn").onclick=newProject;
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
  $("kitNameText").textContent=prefs.kitName||prefs.kitId||"No kit selected";$("kitStatus").textContent=prefs.demoMode?"Demo mode":"Kit disconnected";initOledPreview();
  window.addEventListener("pagehide",()=>{stopKitHeartbeat();if(currentRunUsesKit&&kitClient?.connected)kitClient.endRun().catch(()=>{});});
  updateRgb(0,0,0);updateSensorGraphics();setupCameraBridge();initEditor();createWorker();enumerateCameras();connectRealKit();startKitHealthMonitor();
})();