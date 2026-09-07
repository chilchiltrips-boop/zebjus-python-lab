(function(){
  const $=id=>document.getElementById(id),cfg=window.ZEBJUS_CONFIG||{};
  const hasFiniteValue=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
  const video=$("cameraVideo"),overlay=$("cameraOverlay"),terminal=$("terminal");
  let editor=null,worker=null,ws=null,running=false,cameraRunning=false,currentCameraIndex=null,cameras=[],liveMode=false,liveCode="",liveNeedsHand=false,liveNeedsFace=false,liveNeedsCamera=false,liveTimer=null,liveSessionId=0,lintTimer=null,lintSeq=0,lintWaiters=new Map(),editorIssue=null;
  const kitClient=window.ZebjusKit?new window.ZebjusKit.KitClient():null;
  let kitCommandErrorShown=false,kitHeartbeatTimer=null,kitHealthTimer=null,currentRunUsesKit=false,currentRunNeedsKit=false,kitReconnectBusy=false,kitHeartbeatPingBusy=false,activePotPin=34;
  const KIT_FAILURE_LIMIT=5;
  let kitFailureCount=0,kitEverConnected=false,lastHardwareWarning="",lastHardwareWarningAt=0;
  let aiState={detected:false,fingers:0,side:"",faces:[],landmarks:[]};
  let imageFrame=null,uploadedImages=[],activeUploadPath="";
  let oledBuffer=null,oledBufferCtx=null,oledInverted=false;
  let activeHardwareCards=[],hardwareLayoutSignature="",hardwareLayoutTimer=null;
  const displayHardwareQueues=new Map();let displayCommandSeq=0;

  const isEmbedded=(()=>{try{return window.self!==window.top;}catch(e){return true;}})();
  const bridgeChannelName="zebjus-camera-"+Math.random().toString(36).slice(2);
  const bridgeChannel=("BroadcastChannel" in window)?new BroadcastChannel(bridgeChannelName):null;
  let bridgeWindow=null,bridgeWaiters=new Map();
  let sensorState={simulationMode:true,ultrasonicCm:null,dhtTemperature:null,dhtHumidity:null,dhtPin:13,potValue:null,potRaw:null,potPin:34,potPercent:null,potMillivolts:null,inputs:{analog:{},digital:{},rotary:{},ultrasonic:{},dht11:{}},bridge:{gpio:{},adc:{},pwm:{},i2c:{},uart:{},spi:{},pulse:{},counter:{},transaction:{}},special:{}};
  const customDashboardCards=new Map();
  const plotter={series:new Map(),maxPoints:180,seq:0};
  const DEBUG_EVENT_LIMIT=900;
  const debugEvents=[];
  const debugStartedAt=Date.now();
  function debugEvent(kind,message,data=null){
    const item={ts:new Date().toISOString(),ms:Date.now()-debugStartedAt,kind:String(kind||"event"),message:String(message||"")};
    if(data!==null&&data!==undefined){try{item.data=JSON.parse(JSON.stringify(data));}catch(_){item.data=String(data);}}
    debugEvents.push(item);if(debugEvents.length>DEBUG_EVENT_LIMIT)debugEvents.splice(0,debugEvents.length-DEBUG_EVENT_LIMIT);
  }
  function sanitizedKitStatus(){const st={...(kitClient?.status||{})};delete st.token;delete st.secureToken;delete st.password;return st;}
  function displayQueueSnapshot(){return [...displayHardwareQueues.entries()].map(([key,q])=>({key,busy:!!q.busy,paused:!!q.paused,pauseReason:String(q.pauseReason||""),pending:Number(q.pending?.length||0),hasLatest:!!q.latest,deviceError:String(q.deviceError||""),retryInMs:q.retryAfter?Math.max(0,Math.round(q.retryAfter-Date.now())):0}));}
  function buildDebugReport(){
    const now=Date.now(),code=getCode?.()||"";
    return {report:"ZEBJUS Python Lab Debug Report",uiVersion:"6.4.6",createdAt:new Date().toISOString(),traceUptimeMs:now-debugStartedAt,
      page:{url:location.href,protocol:location.protocol,embedded:isEmbedded,visibility:document.visibilityState,userAgent:navigator.userAgent,online:navigator.onLine},
      run:{running,liveMode,currentRunUsesKit,currentRunNeedsKit,liveSessionId},
      kit:{name:prefs.kitName||prefs.kitId||"",chipId:String(prefs.kitChipId||""),cachedIp:prefs.kitIp||"",base:kitClient?.base||"",connected:!!kitClient?.connected,lastGoodAgeMs:Number.isFinite(kitClient?.lastGoodAgeMs)?Math.round(kitClient.lastGoodAgeMs):null,failureCount:kitFailureCount,failureLimit:KIT_FAILURE_LIMIT,everConnected:kitEverConnected,reconnectBusy:kitReconnectBusy,heartbeatBusy:kitHeartbeatPingBusy,status:sanitizedKitStatus()},
      mode:{demoMode:!!prefs.demoMode,simulationMode:!!sensorState.simulationMode},displays:displayQueueSnapshot(),hardwareCards:activeHardwareCards.map(x=>({...x})),recentEvents:debugEvents.slice(-DEBUG_EVENT_LIMIT),terminal:String(terminal?.textContent||"").slice(-18000),mainPy:code};
  }
  function saveDebugReport(){try{localStorage.setItem("zebjus.lab.lastDebugReport",JSON.stringify(buildDebugReport()));}catch(_){}}
  async function copyDebugReport(){const text=JSON.stringify(buildDebugReport(),null,2);saveDebugReport();const ok=await copyText(text);if(ok){debugEvent("debug","Debug report copied");log("Debug report copied. Paste it into ChatGPT when KIT/display blinking or a hardware issue happens.");}else log("Could not copy debug report. Open Diagnostics and copy the report manually.");return ok;}

  const defaults={
    autoCamera:true,demoMode:false,kitName:"",kitId:"",kitChipId:"",kitIp:"",kitToken:"",wsUrl:"",
    cameraIndex:0,fontSize:14,autoSave:true,stdin:"",
    demoUltrasonic:45,demoPot:128,demoDhtTemp:28,demoDhtHumidity:65
  };
  function getSettings(){let s={};try{s=JSON.parse(localStorage.getItem("zebjus.lab.settings")||"{}");}catch(e){}return {...defaults,...s};}
  let prefs=getSettings();
  if(!prefs.kitName&&prefs.kitId&&!/^ZB-/i.test(prefs.kitId))prefs.kitName=prefs.kitId;
  if(prefs.kitName&&prefs.demoMode===true&&!localStorage.getItem("zebjus.lab.v621DemoMigrated")){prefs.demoMode=false;localStorage.setItem("zebjus.lab.v621DemoMigrated","1");localStorage.setItem("zebjus.lab.settings",JSON.stringify(prefs));}
  if(kitClient){kitClient.name=prefs.kitName||"";kitClient.ipHint=prefs.kitIp||"";kitClient.chipId=String(prefs.kitChipId||"");kitClient.token=String(prefs.kitToken||"");}

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

    dht11Read:`# DHT11 Temperature + Humidity — legacy get_values() style
from zebjus import DHT11, sleep

# DATA -> GPIO13
b = DHT11(13)

print("Listening for humidity/temp...")
while True:
    data = b.read()
    if data["valid"] or data["stale"]:
        print(f"Humidity: {data['humidity']:.1f}% | Temp: {data['temperature']:.1f} °C" + (" · STALE" if data["stale"] else ""))
    else:
        print("DHT11 READ ERROR:", data.get("message", "No sensor response"))
    sleep(1.5)`,

    dht11Plotter:`# DHT11 Live Serial Plotter
from zebjus import DHT11, plot, sleep

dht = DHT11(13)

while True:
    data = dht.read()
    if data["valid"] or data["stale"]:
        temperature, humidity = data["temperature"], data["humidity"]
        print(f"Temp: {temperature:.1f} °C | Humidity: {humidity:.1f} %" + (" · STALE" if data["stale"] else ""))
        plot(Temperature=temperature, Humidity=humidity)
    else:
        print("DHT11 READ ERROR:", data.get("message", "No sensor response"))
    sleep(1.5)`,

    dht11Oled:`# DHT11 Temperature + Humidity on OLED
from zebjus import DHT11, OLED, sleep

dht = DHT11(13)
oled = OLED(21, 22, 0x3C)

while True:
    t = dht.temperature()
    h = dht.humidity()
    oled.display_text("TEMP  %.1f C\\nHUM   %.1f %%" % (t, h), 8, 14, 1)
    sleep(1)`,

    dht11Rgb:`# DHT11 Temperature Alert with RGB LED
from zebjus import DHT11, RGBLED, sleep

dht = DHT11(13)
rgb = RGBLED(25, 26, 27)

while True:
    data = dht.read()
    if data["valid"] or data["stale"]:
        t, h = data["temperature"], data["humidity"]
        if t >= 32:
            rgb.color("red")
        elif t >= 28:
            rgb.color("yellow")
        else:
            rgb.color("green")
        print(f"{t:.1f} °C | {h:.1f} %RH" + (" · STALE" if data["stale"] else ""))
    else:
        rgb.off()
        print("DHT11 READ ERROR:", data.get("message", "No sensor response"))
    sleep(1.5)`,

    dht11Dashboard:`# DHT11 OpenCV Gauge Dashboard
import cv2
import numpy as np
from zebjus import DHT11, plot, sleep

dht = DHT11(13)

def draw_temp(img, value):
    cx, cy, radius = 210, 205, 95
    cv2.circle(img, (cx, cy), radius, (90, 90, 90), 5, cv2.LINE_AA)
    angle = max(0, min(360, int(360 * value / 50.0)))
    cv2.ellipse(img, (cx, cy), (radius, radius), -90, 0, angle,
                (255, 200, 255), 16, cv2.LINE_AA)
    cv2.putText(img, f"{value:.1f} C", (cx-62, cy+12),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 220, 255), 2, cv2.LINE_AA)

def draw_hum(img, value):
    x, y, w, h = 465, 100, 90, 220
    filled = int(h * max(0, min(100, value)) / 100.0)
    cv2.rectangle(img, (x, y), (x+w, y+h), (90, 90, 90), 4)
    cv2.rectangle(img, (x, y+h-filled), (x+w, y+h), (100, 200, 255), -1)
    cv2.putText(img, f"{value:.1f} %", (x-5, y-18),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (150, 220, 255), 2, cv2.LINE_AA)

current_hum, current_temp = 0.0, 0.0
alpha = 0.12

while True:
    img = np.zeros((400, 700, 3), dtype=np.uint8)
    target_hum = dht.humidity()
    target_temp = dht.temperature()
    current_hum += alpha * (target_hum - current_hum)
    current_temp += alpha * (target_temp - current_temp)
    cv2.putText(img, "DHT11 ENVIRONMENT DASHBOARD", (105, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (230, 230, 230), 2, cv2.LINE_AA)
    draw_temp(img, current_temp)
    draw_hum(img, current_hum)
    cv2.imshow("DHT11 Dashboard", img)
    plot(Temperature=target_temp, Humidity=target_hum)
    sleep(0.15)`,

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
    sleep(0.12)`,

    universalDigitalOutput:`# Universal Digital Output / Relay
from zebjus import DigitalOutput, sleep

out = DigitalOutput(4)

while True:
    out.on()
    sleep(0.5)
    out.off()
    sleep(0.5)`,

    universalAdcPlot:`# Any Analog Sensor -> Serial Plotter
from zebjus import ADC, plot, sleep

sensor = ADC(34)

while True:
    raw = sensor.raw()
    mv = sensor.millivolts()
    plot(Raw=raw, Millivolts=mv)
    print("ADC:", raw, "|", mv, "mV")
    sleep(0.15)`,

    pwmServo:`# Physical Servo through Universal PWM
from zebjus import PWMServo, sleep

servo = PWMServo(18)

while True:
    servo.write(20)
    sleep(0.7)
    servo.write(90)
    sleep(0.7)
    servo.write(160)
    sleep(0.7)`,

    motorDriverUniversal:`# L298N / TB6612-style Motor Driver
from zebjus import MotorDriver, sleep

motor = MotorDriver(16, 17, 18)

while True:
    motor.forward(65)
    sleep(1)
    motor.stop()
    sleep(0.5)
    motor.backward(45)
    sleep(1)
    motor.stop()
    sleep(0.5)`,

    i2cScan:`# Universal I2C Scanner
from zebjus import I2C, sleep

bus = I2C(21, 22, 400000, 0)

while True:
    addresses = bus.scan()
    print("I2C addresses:", [hex(x) for x in addresses])
    sleep(1)`,

    customI2cDevice:`# Custom I2C Register Device
# Change ADDRESS / registers using your sensor datasheet.
from zebjus import I2CDevice, dashboard, sleep

ADDRESS = 0x76
sensor = I2CDevice(ADDRESS, 21, 22)

while True:
    # Example: read one identification register.
    chip_id = sensor.read_registers(0xD0, 1)
    value = chip_id[0] if chip_id else 0
    print("Chip ID:", hex(value))
    dashboard("Custom I2C Sensor", Address=hex(ADDRESS), Chip_ID=hex(value))
    sleep(0.5)`,

    gpsUniversal:`# GPS / GNSS over UART (NEO-6M / NEO-7M / M8N NMEA)
from zebjus import GPS, plot, sleep

# GPS TX -> ESP32 RX34, GPS RX -> ESP32 TX16
gps = GPS(rx=34, tx=16, baud=9600, port=1)

while True:
    data = gps.read()
    print("Fix:", data["fix"], "Lat:", data["latitude"], "Lon:", data["longitude"], "Sats:", data["satellites"])
    plot(Satellites=data["satellites"], Speed_kmh=data["speed"])
    sleep(0.2)`,

    mpu6050Universal:`# MPU6050 IMU over Universal I2C
from zebjus import MPU6050, plot, sleep

imu = MPU6050(21, 22, 0x68, 0)

while True:
    d = imu.read()
    print("Accel:", round(d["accel_x"], 3), round(d["accel_y"], 3), round(d["accel_z"], 3))
    plot(AccX=d["accel_x"], AccY=d["accel_y"], AccZ=d["accel_z"])
    sleep(0.08)`,

    uartUniversal:`# Generic UART Serial Module
from zebjus import UART, sleep

serial = UART(rx=34, tx=16, baud=9600, port=1)

while True:
    line = serial.readline()
    if line:
        print("UART:", line)
    sleep(0.1)`,

    spiUniversal:`# Generic SPI Transfer
# Edit pins, mode, frequency and command bytes for your module datasheet.
from zebjus import SPI, sleep

spi = SPI(sck=18, miso=19, mosi=23, cs=4, frequency=1000000, mode=0, bus=1)

while True:
    response = spi.transfer([0x00, 0x00])
    print("SPI RX:", list(response))
    sleep(0.5)`,

    pulseFrequency:`# Pulse Width / Frequency Sensor
from zebjus import PulseInput, plot, sleep

pulse = PulseInput(34, state=1, timeout_us=100000)

while True:
    width = pulse.read_us()
    hz = pulse.frequency()
    print("Pulse:", width, "us |", round(hz, 2), "Hz")
    plot(Pulse_us=width, Frequency=hz)
    sleep(0.15)`,

    counterInput:`# Interrupt Counter - Flow / Hall / RPM Sensor
from zebjus import CounterInput, plot, sleep

counter = CounterInput(34, edge="rising", pullup=False)

while True:
    count = counter.read()
    hz = counter.frequency()
    print("Count:", count, "| Frequency:", round(hz, 2), "Hz")
    plot(Count=count, Frequency=hz)
    sleep(0.25)`,

    tm1637Display:`# HW-069 / TM1637 4-Digit Display + Effects
from zebjus import TM1637, sleep

display = TM1637(clk=13, dio=14, brightness=6)

display.scroll("ZEBJUS", speed=0.22, loops=1)
display.clock(12, 34, colon=True)
sleep(1)
display.blink(2026, times=2, speed=0.2)

while True:
    display.count(0, 99, speed=0.08)
    display.scroll("PYTHON", speed=0.2, loops=1)`,

    lcd1602Display:`# LCD1602 16x2 I2C Display + Text Effects
from zebjus import LCD1602, sleep

lcd = LCD1602(sda=21, scl=22, address=0x27, bus=0)
lcd.clear()
lcd.center(0, "ZEBJUS")
# Text longer than 16 characters automatically scrolls.
lcd.center(1, "Python Lab BINU K JOSE", speed=0.18, loops=1)
lcd.typewriter(0, "Python Ready", speed=0.07, align="center")
lcd.progress(1, 75, label="LOAD")
sleep(1)

while True:
    lcd.marquee(1, "ZEBJUS PYTHON LAB", speed=0.2, loops=1)`,

    diagnosticClock:`# Clock + Connection Stability Test
from zebjus import TM1637, LCD1602, sleep
from js import Date

tm = TM1637(clk=13, dio=14, brightness=6)
lcd = LCD1602(sda=21, scl=22, address=0x27, bus=0)

while True:
    now = Date.new()
    h, m, sec = now.getHours(), now.getMinutes(), now.getSeconds()
    tm.clock(h, m, colon=(sec % 2 == 0))
    lcd.line(0, f"ZEBJUS {h:02d}:{m:02d}:{sec:02d}")
    lcd.line(1, "LINK STABILITY")
    print(f"CLOCK {h:02d}:{m:02d}:{sec:02d}")
    sleep(0.5)`,

    customTransaction:`# Custom Timing Sensor - Local ESP32 Transaction VM
from zebjus import HardwareTransaction, sleep

txn = HardwareTransaction("my_sensor")

while True:
    # Operations run locally on ESP32, so microsecond timing is not affected by Wi-Fi.
    result = txn.run([
        ("MODE", 34, "IN"),
        ("PULSEIN", 34, 1, 100000),
    ])
    if result:
        print("Captured pulse:", result[0], "us")
    sleep(0.15)`
  };

  const libraries=[
    ["cv2","module","OpenCV"],["mediapipe","module","MediaPipe compatibility"],["cvzone","module","CVZone compatibility"],["numpy","module","NumPy"],["math","module","Math"],["random","module","Random"],
    ["zebjus","module","ZEBJUS hardware"],["zebjus_ai","module","MediaPipe AI"],["zebjus_cv","module","Camera/Image OpenCV bridge"],
    ["SerialModule","module","VISION AI serial compatibility"],["HandTrackingModule","module","VISION AI hand tracking compatibility"],["zebjus_wifi","module","ZEBJUS Wi-Fi compatibility"]
  ];
  const base=[
    ["and","keyword"],["as","keyword"],["break","keyword"],["class","keyword"],["continue","keyword"],["def","keyword"],["elif","keyword"],["else","keyword"],["except","keyword"],["False","keyword"],["for","keyword"],["from","keyword"],["if","keyword"],["import","keyword"],["in","keyword"],["None","keyword"],["not","keyword"],["or","keyword"],["pass","keyword"],["return","keyword"],["True","keyword"],["try","keyword"],["while","keyword"],["with","keyword"],
    ["print()","function","print()","Output"],["input()","function","input()","Program input"],["range()","function","range()","Range"],["len()","function","len()","Length"],["int()","function","int()","Integer"],["float()","function","float()","Float"],["str()","function","str()","String"],
    ["RGBLED()","class","RGBLED(25,26,27)","RGB LED pins + 0–255 color"],["TM1637()","class","TM1637(13,14)","HW-069 4-digit 7-segment display"],["LCD1602()","class","LCD1602(21,22,0x27,0)","16x2 LCD with I2C backpack"],["DHT11()","class","DHT11(13)","Temperature + humidity sensor"],["SerialPlotter()","class","SerialPlotter()","Live graph helper"],["plot()","function","plot(Temperature=t)","Send values to Serial Plotter"],["LED()","class","LED()","White compatibility LED"],["OLED()","class","OLED(21,22,0x3C)","SSD1306 128x64 I2C display"],["Ultrasonic()","class","Ultrasonic(18,19)","HC-SR04 distance cm"],["AnalogInput()","class","AnalogInput(34)","Generic analog ADC1 input"],["Potentiometer()","class","Potentiometer(34)","Analog knob alias"],["DigitalInput()","class","DigitalInput(32)","Generic digital sensor input"],["Switch()","class","Switch(32)","Digital push switch input"],["RotaryEncoder()","class","RotaryEncoder(32,33,14)","Rotary encoder CLK/DT/SW"],["Motor()","class","Motor()","Motor"],["Servo()","class","Servo()","Servo"],["Camera()","class","Camera()","Camera"],["HandDetector()","class","HandDetector()","MediaPipe Hand"],["FaceDetector()","class","FaceDetector()","MediaPipe Face"],["sleep()","function","sleep()","Delay"],["load_image()","function","load_image()","Loaded image"],["show()","function","show()","Show image"],["draw_rgb_led()","function","draw_rgb_led()","Draw RGB LED"],["draw_potentiometer()","function","draw_potentiometer()","Draw pot"],["draw_ultrasonic()","function","draw_ultrasonic()","Draw distance bar"],
    ["cv2","module","cv2","OpenCV"],["mp","module","mp","MediaPipe"],["cvzone","module","cvzone","CVZone"],["np","module","np","NumPy"],
    ["SerialObject()","class","SerialObject()","VISION AI serial bridge"],["handDetector()","class","handDetector()","VISION AI hand tracker"],["WifiBridge()","class","WifiBridge()","ZEBJUS Wi-Fi bridge"]
  ];

  const moduleMembers={
    zebjus:[
      ["RGBLED","class","RGBLED","Legacy/default RGB LED API"],["LED","class","LED","Legacy RGB-white compatibility API"],["TM1637","class","TM1637","HW-069 / TM1637 4-digit display"],["LCD1602","class","LCD1602","16x2 I2C LCD backpack"],["DHT11","class","DHT11","DHT11: DHT11(13)"],["SerialPlotter","class","SerialPlotter","Live graph helper"],["plot","function","plot","Serial Plotter values"],["clear_plot","function","clear_plot","Clear Serial Plotter"],["OLED","class","OLED","SSD1306 OLED: OLED(21,22,0x3C)"],["Ultrasonic","class","Ultrasonic","HC-SR04: Ultrasonic(18,19)"],
      ["AnalogInput","class","AnalogInput","Generic analog input"],["Potentiometer","class","Potentiometer","Potentiometer / analog knob"],["DigitalInput","class","DigitalInput","Generic digital input"],["Switch","class","Switch","Digital switch input"],["RotaryEncoder","class","RotaryEncoder","Rotary encoder input"],
      ["DigitalOutput","class","DigitalOutput","Universal digital output"],["Relay","class","Relay","Relay / digital output"],["GPIOInput","class","GPIOInput","Universal GPIO input"],["ADC","class","ADC","Raw ADC1 interface"],["PWM","class","PWM","Generic LEDC PWM output"],["PWMServo","class","PWMServo","Physical servo using generic PWM"],["MotorDriver","class","MotorDriver","2 direction pins + PWM"],
      ["I2C","class","I2C","Generic I²C bus; custom sensor drivers"],["I2CDevice","class","I2CDevice","Generic addressed I²C device"],["UART","class","UART","Generic UART for GPS/RFID/serial modules"],["SPI","class","SPI","Generic SPI bus"],["PulseInput","class","PulseInput","Pulse width / frequency sensor"],["PulseOutput","class","PulseOutput","Precise pulse output"],["CounterInput","class","CounterInput","Interrupt-backed pulse counter / flow / RPM"],["HardwareTransaction","class","HardwareTransaction","Local GPIO/pulse transaction VM"],
      ["GPS","class","GPS","NMEA GPS over UART"],["MPU6050","class","MPU6050","I²C IMU driver"],["LDR","class","LDR","ADC light sensor"],["SoilMoisture","class","SoilMoisture","ADC soil sensor"],["GasSensor","class","GasSensor","ADC gas sensor"],["VoltageSensor","class","VoltageSensor","ADC voltage sensor"],["SoundSensor","class","SoundSensor","ADC sound level sensor"],["RainSensor","class","RainSensor","ADC rain sensor"],["WaterLevelSensor","class","WaterLevelSensor","ADC water level sensor"],["Thermistor","class","Thermistor","ADC thermistor input"],["PIRSensor","class","PIRSensor","Digital motion sensor"],["ReedSwitch","class","ReedSwitch","Magnetic reed switch"],["TouchSensor","class","TouchSensor","Digital touch module"],["FlameSensor","class","FlameSensor","Digital flame module"],["FlowSensor","class","FlowSensor","Pulse flow sensor"],["RPMSensor","class","RPMSensor","Pulse RPM sensor"],["Buzzer","class","Buzzer","PWM buzzer output"],["Joystick","class","Joystick","Dual ADC joystick + switch"],["dashboard","function","dashboard","Show custom live sensor card"],
      ["Motor","class","Motor","Legacy bridge API"],["Servo","class","Servo","Legacy bridge API"],["sleep","function","sleep","Delay"]
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
    RGBLED:[["write()","method","write()","write(r,g,b) 0–255"],["set()","method","set()","set(r,g,b)"],["color()","method","color()","Named color: red, green, blue, purple…"],["fade()","method","fade()","Smooth RGB fade"],["pulse()","method","pulse()","Pulse a named color"],["rainbow()","method","rainbow()","Rainbow animation"],["red()","method","red()","Red"],["green()","method","green()","Green"],["blue()","method","blue()","Blue"],["white()","method","white()","White"],["off()","method","off()","Off"]],
    LED:[["on()","method","on()","On"],["off()","method","off()","Off"],["blink()","method","blink()","Blink"],["fade()","method","fade()","Smooth brightness fade"],["pulse()","method","pulse()","Brightness pulse"]],
    SingleLED:[["on()","method","on()","On"],["off()","method","off()","Off"],["write()","method","write()","Brightness 0–255"],["brightness()","method","brightness()","Brightness 0–255"],["blink()","method","blink()","Blink"],["fade()","method","fade()","Smooth brightness fade"],["pulse()","method","pulse()","Brightness pulse"],["pin","property","pin","Selected GPIO"]],
    OLED:[["clear()","method","clear()","Clear OLED buffer"],["show()","method","show()","Display buffered drawing"],["text()","method","text()","Draw text"],["display_text()","method","display_text()","Clear + show text"],["line()","method","line()","Draw line"],["rect()","method","rect()","Draw rectangle"],["circle()","method","circle()","Draw circle"],["pixel()","method","pixel()","Draw pixel"],["scroll_text()","method","scroll_text()","Scrolling text animation"],["distance_bar()","method","distance_bar()","Distance gauge"],["radar()","method","radar()","Ultrasonic radar frame"],["invert()","method","invert()","Invert display"],["contrast()","method","contrast()","Set contrast"]],
    TM1637:[["number()","method","number()","Display integer -999..9999"],["text()","method","text()","Display up to four characters"],["clock()","method","clock()","Show HH:MM with colon"],["decimal()","method","decimal()","Show a decimal using the segment dot"],["scroll()","method","scroll()","Scroll long text across four digits"],["marquee()","method","marquee()","Left marquee text effect"],["blink()","method","blink()","Blink a value/text"],["count()","method","count()","Animated number counter"],["pulse()","method","pulse()","Brightness pulse effect"],["segments()","method","segments()","Write four raw segment bytes"],["brightness()","method","brightness()","Brightness 0–7"],["clear()","method","clear()","Blank all digits"],["show()","method","show()","Show number or text"]],
    LCD1602:[["write()","method","write()","Write text at col,row"],["line()","method","line()","Replace one 16-character row"],["lines()","method","lines()","Write both LCD rows"],["align()","method","align()","Left/center/right alignment"],["center()","method","center()","Center short text; auto-scroll long text"],["left()","method","left()","Left-align text"],["right()","method","right()","Right-align text"],["scroll()","method","scroll()","Scroll long text"],["marquee()","method","marquee()","Marquee long text"],["bounce()","method","bounce()","Bounce text across the LCD"],["typewriter()","method","typewriter()","Typewriter text effect"],["blink_text()","method","blink_text()","Blink a line of text"],["progress()","method","progress()","16-char progress/status bar"],["spinner()","method","spinner()","Animated spinner"],["clear_line()","method","clear_line()","Clear one row"],["cursor()","method","cursor()","Cursor/blink mode"],["clear()","method","clear()","Clear LCD"],["home()","method","home()","Cursor home"],["set_cursor()","method","set_cursor()","Set cursor col,row"],["backlight()","method","backlight()","Backlight on/off"],["display()","method","display()","Display on/off"]],
    Ultrasonic:[["read()","method","read()","Distance cm"],["centimeters()","method","centimeters()","Distance cm"],["distance_cm","property","distance_cm","Distance cm"],["trig","property","trig","TRIG GPIO"],["echo","property","echo","ECHO GPIO"]],
    DHT11:[["read()","method","read()","Return temperature/humidity object"],["temperature()","method","temperature()","Temperature °C"],["humidity()","method","humidity()","Relative humidity %"],["get_values()","method","get_values()","Legacy [humidity×10,temp×10]"],["pin","property","pin","DATA GPIO"]],
    SerialPlotter:[["plot()","method","plot()","Plot named values"],["clear()","method","clear()","Clear graph"]],
    AnalogInput:[["read()","method","read()","Scaled 0–255"],["raw()","method","raw()","Raw ADC 0–4095"],["percent()","method","percent()","0–100 percent"],["millivolts()","method","millivolts()","ADC millivolts"],["pin","property","pin","Selected ADC GPIO"],["value","property","value","0–255"]],
    Potentiometer:[["read()","method","read()","Scaled 0–255"],["raw()","method","raw()","Raw ADC 0–4095"],["percent()","method","percent()","0–100 percent"],["millivolts()","method","millivolts()","ADC millivolts"],["pin","property","pin","Selected ADC GPIO"],["value","property","value","0–255"]],
    DigitalInput:[["read()","method","read()","True when active"],["active()","method","active()","Same as read"],["state()","method","state()","Raw digital 0/1"],["pin","property","pin","Selected GPIO"],["value","property","value","Boolean active state"]],
    Switch:[["read()","method","read()","True when active"],["pressed()","method","pressed()","True when switch is pressed"],["state()","method","state()","Raw digital 0/1"],["pin","property","pin","Selected GPIO"],["value","property","value","Boolean active state"]],
    RotaryEncoder:[["position()","method","position()","Accumulated rotary position"],["delta()","method","delta()","Change since latest read"],["direction()","method","direction()","CW / CCW / NONE"],["pressed()","method","pressed()","Rotary push switch"],["switch_state()","method","switch_state()","Raw switch 0/1"],["value","property","value","Same as position"]],
    Motor:[["forward()","method","forward()","Forward"],["backward()","method","backward()","Backward"],["stop()","method","stop()","Stop"]],
    Servo:[["write()","method","write()","Angle"]],
    DigitalOutput:[["on()","method","on()","HIGH / active"],["off()","method","off()","LOW / inactive"],["write()","method","write()","Write boolean"],["toggle()","method","toggle()","Toggle output"]],
    Relay:[["on()","method","on()","Relay on"],["off()","method","off()","Relay off"],["write()","method","write()","Set relay"]],
    GPIOInput:[["read()","method","read()","Boolean input"],["state()","method","state()","Raw 0/1"]],
    ADC:[["raw()","method","raw()","0–4095"],["millivolts()","method","millivolts()","mV"],["percent()","method","percent()","0–100%"]],
    PWM:[["write()","method","write()","Raw PWM duty"],["percent()","method","percent()","0–100%"],["off()","method","off()","PWM off"]],
    PWMServo:[["write()","method","write()","Angle 0–180"],["angle()","method","angle()","Angle"],["sweep()","method","sweep()","Smooth servo sweep animation"],["write_us()","method","write_us()","Pulse microseconds"],["detach()","method","detach()","Output off"]],
    MotorDriver:[["forward()","method","forward()","Forward"],["backward()","method","backward()","Reverse"],["ramp()","method","ramp()","Smooth speed ramp"],["stop()","method","stop()","Coast/stop"],["brake()","method","brake()","Brake"]],
    Buzzer:[["tone()","method","tone()","Play a frequency"],["beep()","method","beep()","Timed beep"],["sweep()","method","sweep()","Frequency sweep effect"],["no_tone()","method","no_tone()","Stop sound"]],
    I2C:[["scan()","method","scan()","Find I²C addresses"],["readfrom()","method","readfrom()","Read bytes"],["writeto()","method","writeto()","Write bytes"],["read_registers()","method","read_registers()","Read register bytes"],["write_register()","method","write_register()","Write register"]],
    I2CDevice:[["read()","method","read()","Read bytes"],["write()","method","write()","Write bytes"],["read_registers()","method","read_registers()","Read registers"],["write_register()","method","write_register()","Write register"]],
    UART:[["read()","method","read()","Read bytes"],["readline()","method","readline()","Read serial line"],["write()","method","write()","Write bytes"],["print()","method","print()","Write text"],["available()","method","available()","Buffered bytes"]],
    SPI:[["transfer()","method","transfer()","Full-duplex SPI transfer"],["write()","method","write()","SPI write"]],
    PulseInput:[["read_us()","method","read_us()","Pulse width µs"],["frequency()","method","frequency()","Frequency Hz"]],
    CounterInput:[["snapshot()","method","snapshot()","Count + delta + frequency"],["read()","method","read()","Total pulse count"],["count()","method","count()","Total pulse count"],["frequency()","method","frequency()","Recent pulse frequency Hz"],["delta()","method","delta()","Pulses since previous read"],["reset()","method","reset()","Reset counter"]],
    PulseOutput:[["pulse_us()","method","pulse_us()","Output pulse"]],
    HardwareTransaction:[["run()","method","run()","Run local timing operations"]],
    GPS:[["read()","method","read()","GPS fix dictionary"],["latitude","property","latitude","Latitude"],["longitude","property","longitude","Longitude"]],
    MPU6050:[["read()","method","read()","Accel/gyro/temp dictionary"]],
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
    for(const type of ["RGBLED","LED","TM1637","LCD1602","DHT11","SerialPlotter","OLED","Ultrasonic","AnalogInput","Potentiometer","DigitalInput","Switch","RotaryEncoder","DigitalOutput","Relay","GPIOInput","ADC","PWM","PWMServo","MotorDriver","I2C","I2CDevice","UART","SPI","PulseInput","PulseOutput","CounterInput","HardwareTransaction","GPS","MPU6050","LDR","SoilMoisture","GasSensor","VoltageSensor","SoundSensor","RainSensor","WaterLevelSensor","Thermistor","PIRSensor","ReedSwitch","TouchSensor","FlameSensor","FlowSensor","RPMSensor","Buzzer","Joystick","Motor","Servo","Camera","HandDetector","FaceDetector","SerialObject","handDetector","WifiBridge"]){
      if(new RegExp("\\b"+esc+"\\s*=\\s*"+type+"\\s*\\(").test(code))return type;
    }
    if(new RegExp("\\b"+esc+"\\s*=\\s*LED\\d+\\s*\\(").test(code))return "SingleLED";
    if(new RegExp("\\b"+esc+"\\s*=\\s*RGBLED\\d+\\s*\\(").test(code))return "RGBLED";
    if(new RegExp("\\b"+esc+"\\s*=\\s*(?:HandDetector\\s*\\(\\s*\\)|\\w+)\\.read\\s*\\(").test(code))return "HandResult";
    if(name==="tm"||name==="tm1637")return "TM1637";if(name==="lcd"||name==="lcd1602")return "LCD1602";if(name==="rgb")return "RGBLED";if(name==="dht"||name==="dht11")return "DHT11";if(name==="plotter")return "SerialPlotter";if(name==="led")return "LED";if(name==="oled"||name==="display")return "OLED";if(name==="ultra")return "Ultrasonic";if(name==="analog")return "AnalogInput";if(name==="pot")return "Potentiometer";if(name==="sensor"||name==="din")return "DigitalInput";if(name==="button"||name==="sw")return "Switch";if(name==="encoder"||name==="rotary")return "RotaryEncoder";
    if(name==="motor")return "Motor";if(name==="servo")return "Servo";if(name==="cam")return "Camera";if(name==="hand")return "HandDetector";if(name==="result")return "HandResult";
    if(name==="cv2")return "cv2";
    return null;
  }

  function hintItem(e){const [label,type,text,info]=e;return{text:text||label,displayText:label+(info?"   — "+info:""),className:"hint-"+type};}
  function filterItems(items,prefix){const p=String(prefix||"").toLowerCase();return items.filter(x=>x[0].replace(/\(\)$/,"").toLowerCase().startsWith(p)).map(hintItem);}

  // ---------- GPIO pin assistance / validation ----------
  // v6.2 uses one live resource model for autocomplete, shared buses, Add Component, linting and dashboard order.
  // Classic ESP32 DevKit: 15 safe output/PWM pins; 19 general digital inputs; 6 Wi-Fi-safe ADC1 pins.
  const RGB_OUTPUT_PINS=[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33];
  const ANALOG_INPUT_PINS=[32,33,34,35,36,39];
  const DIGITAL_INPUT_PINS=[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39];
  const INPUT_ONLY_PINS=[34,35,36,39];
  const ULTRASONIC_ECHO_PINS=[...DIGITAL_INPUT_PINS,12]; // GPIO12 allowed only when explicitly chosen; boot-strapping sensitive.
  const COUNTER_INPUT_PINS=[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33,34,35];
  const MAX_PWM_CHANNELS=15; // this project intentionally exposes at most the 15 safe output pins.

  const COMPONENT_CATALOG=[
    {className:"SingleLED",label:"Single LED",group:"Outputs",interface:"1 × PWM/Digital OUT",max:15,prefix:"led",status:"ready",numberedBase:"LED",pinCost:{out:1}},
    {className:"RGBLED",label:"RGB LED",group:"Outputs",interface:"3 × PWM OUT",max:5,prefix:"rgb",status:"ready",numberedBase:"RGBLED",pinCost:{out:3}},
    {className:"TM1637",label:"4-Digit 7-Segment (TM1637 / HW-069)",group:"Displays",interface:"CLK + bidirectional DIO",max:4,prefix:"tm",status:"ready",pinCost:{out:2}},
    {className:"LCD1602",label:"LCD1602 16×2 + I²C Backpack",group:"Displays",interface:"I²C · SDA/SCL shared",max:4,prefix:"lcd",status:"ready",pinCost:{out:2}},
    {className:"OLED",label:"OLED 128×64",group:"I²C",interface:"I²C · 2 GPIO",max:1,prefix:"oled",status:"ready",pinCost:{out:2}},
    {className:"DHT11",label:"DHT11",group:"Sensors",interface:"1 × bidirectional DATA GPIO",max:15,prefix:"dht",status:"ready",pinCost:{out:1}},
    {className:"Ultrasonic",label:"Ultrasonic HC-SR04",group:"Sensors",interface:"1 OUT + 1 IN",max:10,prefix:"ultra",status:"ready",pinCost:{out:1,input:1}},
    {className:"Potentiometer",label:"Potentiometer",group:"Inputs",interface:"ADC1 IN",max:6,prefix:"pot",status:"ready",pinCost:{adc:1}},
    {className:"AnalogInput",label:"Analog Input",group:"Inputs",interface:"ADC1 IN",max:6,prefix:"analog",status:"ready",pinCost:{adc:1}},
    {className:"Switch",label:"Switch",group:"Inputs",interface:"Digital IN",max:19,prefix:"sw",status:"ready",pinCost:{input:1}},
    {className:"DigitalInput",label:"Digital Input",group:"Inputs",interface:"Digital IN",max:19,prefix:"din",status:"ready",pinCost:{input:1}},
    {className:"RotaryEncoder",label:"Rotary Encoder",group:"Inputs",interface:"2–3 × Digital IN",max:4,prefix:"encoder",status:"ready",pinCost:{input:3}},
    {className:"Servo",label:"Servo (legacy simulator)",group:"Legacy",interface:"Demo/WebSocket only",max:0,prefix:"servo",status:"planned",note:"For a physical kit use PWMServo(pin)."},
    {className:"Motor",label:"Motor (legacy simulator)",group:"Legacy",interface:"Demo/WebSocket only",max:0,prefix:"motor",status:"planned",note:"For a physical kit use MotorDriver(in1, in2, pwm_pin)."},
    {className:"PWMInput",label:"PWM Signal Sensor",group:"Future / bridge",interface:"Pulse / Digital IN",max:0,prefix:"pwm",status:"planned",note:"Use PulseInput in v6"},
    {className:"DigitalOutput",label:"Digital Output / LED / Relay",group:"Universal Bridge",interface:"1 × Digital OUT",max:15,prefix:"out",status:"ready",pinCost:{out:1}},
    {className:"Relay",label:"Relay",group:"Universal Bridge",interface:"1 × Digital OUT",max:15,prefix:"relay",status:"ready",pinCost:{out:1}},
    {className:"GPIOInput",label:"GPIO Input",group:"Universal Bridge",interface:"1 × Digital IN",max:20,prefix:"gin",status:"ready",pinCost:{input:1}},
    {className:"ADC",label:"ADC Sensor",group:"Universal Bridge",interface:"ADC1 IN",max:6,prefix:"adc",status:"ready",pinCost:{adc:1}},
    {className:"PWM",label:"PWM Output",group:"Universal Bridge",interface:"1 × PWM OUT",max:15,prefix:"pwm",status:"ready",pinCost:{out:1}},
    {className:"PWMServo",label:"Servo",group:"Universal Bridge",interface:"1 × PWM OUT",max:15,prefix:"servo",status:"ready",pinCost:{out:1}},
    {className:"MotorDriver",label:"Motor Driver",group:"Universal Bridge",interface:"2 DIR + 1 PWM OUT",max:5,prefix:"motor",status:"ready",pinCost:{out:3}},
    {className:"I2C",label:"I²C Bus",group:"Universal Buses",interface:"2 shared GPIO · 2 buses",max:2,prefix:"i2c",status:"ready",pinCost:{out:2}},
    {className:"UART",label:"UART Serial Bus",group:"Universal Buses",interface:"RX + TX · 2 ports",max:2,prefix:"uart",status:"ready",pinCost:{out:1,input:1}},
    {className:"SPI",label:"SPI Bus",group:"Universal Buses",interface:"SCK/MISO/MOSI/CS · 2 buses",max:2,prefix:"spi",status:"ready",pinCost:{out:3,input:1}},
    {className:"PulseInput",label:"Pulse / Frequency Input",group:"Universal Bridge",interface:"1 × Digital IN",max:20,prefix:"pulse",status:"ready",pinCost:{input:1}},
    {className:"CounterInput",label:"Interrupt Counter / Flow / RPM",group:"Universal Bridge",interface:"1 × interrupt Digital IN",max:8,prefix:"counter",status:"ready",pinCost:{input:1}},
    {className:"PulseOutput",label:"Pulse Output",group:"Universal Bridge",interface:"1 × Digital OUT",max:15,prefix:"pulseOut",status:"ready",pinCost:{out:1}},
    {className:"HardwareTransaction",label:"Custom Timing Transaction",group:"Universal Buses",interface:"GPIO/pulse local VM",max:8,prefix:"txn",status:"ready",pinCost:{}},
    {className:"GPS",label:"GPS / GNSS (NMEA)",group:"Ready Drivers",interface:"UART RX + TX",max:2,prefix:"gps",status:"ready",pinCost:{out:1,input:1}},
    {className:"MPU6050",label:"MPU6050 IMU",group:"Ready Drivers",interface:"I²C shared bus",max:2,prefix:"imu",status:"ready",pinCost:{out:2}},
    {className:"LDR",label:"LDR / Light Sensor",group:"Ready Drivers",interface:"ADC1 IN",max:6,prefix:"ldr",status:"ready",pinCost:{adc:1}},
    {className:"SoilMoisture",label:"Soil Moisture",group:"Ready Drivers",interface:"ADC1 IN",max:6,prefix:"soil",status:"ready",pinCost:{adc:1}},
    {className:"GasSensor",label:"Analog Gas Sensor",group:"Ready Drivers",interface:"ADC1 IN",max:6,prefix:"gas",status:"ready",pinCost:{adc:1}},
    {className:"VoltageSensor",label:"Voltage Sensor",group:"Ready Drivers",interface:"ADC1 IN",max:6,prefix:"voltage",status:"ready",pinCost:{adc:1}},
    {className:"SoundSensor",label:"Sound Sensor",group:"Ready Drivers",interface:"ADC1 IN",max:6,prefix:"sound",status:"ready",pinCost:{adc:1}},
    {className:"RainSensor",label:"Rain Sensor",group:"Ready Drivers",interface:"ADC1 IN",max:6,prefix:"rain",status:"ready",pinCost:{adc:1}},
    {className:"WaterLevelSensor",label:"Water Level Sensor",group:"Ready Drivers",interface:"ADC1 IN",max:6,prefix:"water",status:"ready",pinCost:{adc:1}},
    {className:"Thermistor",label:"Thermistor",group:"Ready Drivers",interface:"ADC1 IN",max:6,prefix:"thermistor",status:"ready",pinCost:{adc:1}},
    {className:"PIRSensor",label:"PIR Motion Sensor",group:"Ready Drivers",interface:"Digital IN",max:10,prefix:"pir",status:"ready",pinCost:{input:1}},
    {className:"ReedSwitch",label:"Reed Switch",group:"Ready Drivers",interface:"Digital IN",max:10,prefix:"reed",status:"ready",pinCost:{input:1}},
    {className:"TouchSensor",label:"Touch Sensor Module",group:"Ready Drivers",interface:"Digital IN",max:10,prefix:"touch",status:"ready",pinCost:{input:1}},
    {className:"FlameSensor",label:"Flame Sensor Module",group:"Ready Drivers",interface:"Digital IN",max:10,prefix:"flame",status:"ready",pinCost:{input:1}},
    {className:"FlowSensor",label:"Flow Sensor",group:"Ready Drivers",interface:"Counter / pulse IN",max:8,prefix:"flow",status:"ready",pinCost:{input:1}},
    {className:"RPMSensor",label:"RPM / Tachometer Sensor",group:"Ready Drivers",interface:"Counter / pulse IN",max:8,prefix:"rpm",status:"ready",pinCost:{input:1}},
    {className:"Buzzer",label:"Buzzer",group:"Outputs",interface:"PWM OUT",max:15,prefix:"buzzer",status:"ready",pinCost:{out:1}},
    {className:"Joystick",label:"2-Axis Joystick",group:"Inputs",interface:"2 × ADC1 + optional switch",max:3,prefix:"joystick",status:"ready",pinCost:{adc:2,input:1}}
  ];
  const PIN_HINT_ORDER={
    SingleLED:[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33],
    RGBLED:[25,26,27,32,33,4,13,14,16,17,18,19,21,22,23],
    TM1637:[13,14,18,19,16,17,25,26,27,32,33,4,21,22,23],
    LCD1602:[21,22,25,26,18,19,16,17,23,27,32,33,4,13,14],
    AnalogInput:[34,35,36,39,32,33],Potentiometer:[34,35,36,39,32,33],
    DigitalInput:[34,35,36,39,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],
    Switch:[34,35,36,39,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],
    RotaryEncoder:[32,33,14,27,26,25,4,13,16,17,18,19,21,22,23,34,35,36,39],
    Ultrasonic:[14,18,16,17,21,22,23,25,26,27,32,33,4,13,19],
    DHT11:[13,4,14,16,17,18,19,23,25,26,27,32,33,21,22],
    OLED:[21,22,18,19,16,17,23,25,26,27,32,33,4,13,14],
    DigitalOutput:[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33],Relay:[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33],PWM:[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33],PWMServo:[18,19,16,17,25,26,27,32,33,4,13,14,21,22,23],PulseOutput:[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33],
    ADC:[34,35,36,39,32,33],LDR:[34,35,36,39,32,33],SoilMoisture:[34,35,36,39,32,33],GasSensor:[34,35,36,39,32,33],VoltageSensor:[34,35,36,39,32,33],SoundSensor:[34,35,36,39,32,33],RainSensor:[34,35,36,39,32,33],WaterLevelSensor:[34,35,36,39,32,33],Thermistor:[34,35,36,39,32,33],Joystick:[34,35,36,39,32,33],
    GPIOInput:[34,35,36,39,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],PIRSensor:[34,35,36,39,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],ReedSwitch:[34,35,36,39,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],TouchSensor:[34,35,36,39,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],FlameSensor:[34,35,36,39,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],PulseInput:[34,35,36,39,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],CounterInput:[34,35,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],FlowSensor:[34,35,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],RPMSensor:[34,35,32,33,14,27,26,25,4,13,16,17,18,19,21,22,23],Buzzer:[4,13,14,16,17,18,19,21,22,23,25,26,27,32,33]
  };

  function numberedTokenInfo(token){
    const m=String(token||"").match(/^(LED|RGBLED)(\d+)$/i);if(!m)return null;
    return {base:m[1].toUpperCase()==="LED"?"LED":"RGBLED",index:Number(m[2])};
  }
  function canonicalHardwareClass(token){
    const n=numberedTokenInfo(token);if(n)return n.base==="LED"?"SingleLED":"RGBLED";
    return ["RGBLED","LED","TM1637","LCD1602","DHT11","Ultrasonic","OLED","AnalogInput","Potentiometer","DigitalInput","Switch","RotaryEncoder","DigitalOutput","Relay","GPIOInput","ADC","PWM","PWMServo","MotorDriver","I2C","I2CDevice","UART","SPI","PulseInput","PulseOutput","CounterInput","HardwareTransaction","GPS","MPU6050","LDR","SoilMoisture","GasSensor","VoltageSensor","SoundSensor","RainSensor","WaterLevelSensor","Thermistor","PIRSensor","ReedSwitch","TouchSensor","FlameSensor","FlowSensor","RPMSensor","Buzzer","Joystick","Motor","Servo"].includes(token)?token:null;
  }
  function sequenceNumbers(src,base){
    const nums=new Set();const re=new RegExp("\\b"+base+"(\\d+)\\b","g");let m;
    while((m=re.exec(String(src||""))))nums.add(Number(m[1]));return nums;
  }
  function nextSequenceNumber(src,base,max){
    const used=sequenceNumbers(src,base);for(let i=1;i<=max;i++)if(!used.has(i))return i;return null;
  }
  function gpioResourceState(src){
    const entries=allPinEntries(src),used=new Set(entries.map(x=>x.pin));
    const freeOut=RGB_OUTPUT_PINS.filter(p=>!used.has(p));
    const freeDigital=DIGITAL_INPUT_PINS.filter(p=>!used.has(p));
    const freeAdc=ANALOG_INPUT_PINS.filter(p=>!used.has(p));
    const freeEcho=ULTRASONIC_ECHO_PINS.filter(p=>!used.has(p));
    return {entries,used,freeOut,freeDigital,freeAdc,freeEcho,usedOut:RGB_OUTPUT_PINS.length-freeOut.length,usedPins:used.size};
  }
  function dynamicZebjusMembers(src){
    const out=[];const state=gpioResourceState(src);
    const nextLed=nextSequenceNumber(src,"LED",15),nextRgb=nextSequenceNumber(src,"RGBLED",5);
    if(nextLed!==null&&state.freeOut.length>=1)out.push([`LED${nextLed}`,"class",`LED${nextLed}`,`Single LED #${nextLed} · 1 OUT pin · ${state.freeOut.length}/${RGB_OUTPUT_PINS.length} OUT free`]);
    if(nextRgb!==null&&state.freeOut.length>=3)out.push([`RGBLED${nextRgb}`,"class",`RGBLED${nextRgb}`,`RGB LED #${nextRgb} · 3 OUT pins · ${state.freeOut.length}/${RGB_OUTPUT_PINS.length} OUT free`]);
    return [...out,...moduleMembers.zebjus];
  }

  function pinEntries(src){
    const out=[];const lines=String(src||"").split(/\r?\n/);
    const add=(pin,line,role,kind,valid,offset=1)=>{if(Number.isFinite(pin))out.push({pin:Number(pin),line,role,kind,valid,offset});};
    lines.forEach((text,i)=>{
      const clean=text.replace(/#.*$/,"");let m;
      const single=/\b(LED\d+)\s*\(([^)]*)\)/g;
      while((m=single.exec(clean))){const pin=parseNumberArg(m[2],"pin",0,null);if(pin!==null)add(pin,i+1,`${m[1]} output`,"SingleLED",RGB_OUTPUT_PINS,m.index+1);}
      const rgb=/\b(RGBLED(?:\d+)?)\s*\(([^)]*)\)/g;
      while((m=rgb.exec(clean))){
        const token=m[1],args=m[2],hasNamed=/\b(?:red|green|blue)\s*=/.test(args),positional=args.split(",").map(x=>x.trim()).filter(x=>x&&!x.includes("="));
        if(token==="RGBLED"&&!hasNamed&&positional.length<=1){
          add(25,i+1,"RGB red","RGBLED",RGB_OUTPUT_PINS,m.index+1);add(26,i+1,"RGB green","RGBLED",RGB_OUTPUT_PINS,m.index+1);add(27,i+1,"RGB blue","RGBLED",RGB_OUTPUT_PINS,m.index+1);
        }else{
          const r=parseNumberArg(args,"red",0,null),g=parseNumberArg(args,"green",1,null),b=parseNumberArg(args,"blue",2,null);
          if(r!==null)add(r,i+1,`${token} red`,"RGBLED",RGB_OUTPUT_PINS,m.index+1);if(g!==null)add(g,i+1,`${token} green`,"RGBLED",RGB_OUTPUT_PINS,m.index+1);if(b!==null)add(b,i+1,`${token} blue`,"RGBLED",RGB_OUTPUT_PINS,m.index+1);
        }
      }
      const tm1637=/\bTM1637\s*\(([^)]*)\)/g;
      while((m=tm1637.exec(clean))){const a=m[1],clk=parseNumberArg(a,"clk",0,13),dio=parseNumberArg(a,"dio",1,14);add(clk,i+1,"TM1637 CLK","TM1637",RGB_OUTPUT_PINS,m.index+1);add(dio,i+1,"TM1637 DIO","TM1637",RGB_OUTPUT_PINS,m.index+1);}
      const analog=/\b(AnalogInput|Potentiometer)\s*\(([^)]*)\)/g;
      while((m=analog.exec(clean))){const pin=parseNumberArg(m[2],"pin",0,34);add(pin,i+1,m[1]+" input",m[1],ANALOG_INPUT_PINS,m.index+1);}
      const digital=/\b(DigitalInput|Switch)\s*\(([^)]*)\)/g;
      while((m=digital.exec(clean))){const pin=parseNumberArg(m[2],"pin",0,32);add(pin,i+1,m[1]+" input",m[1],DIGITAL_INPUT_PINS,m.index+1);}
      const rotary=/\bRotaryEncoder\s*\(([^)]*)\)/g;
      while((m=rotary.exec(clean))){const args=m[1],clk=parseNumberArg(args,"clk",0,32),dt=parseNumberArg(args,"dt",1,33),sw=parseNumberArg(args,"switch",2,-1);add(clk,i+1,"Rotary CLK","RotaryEncoder",DIGITAL_INPUT_PINS,m.index+1);add(dt,i+1,"Rotary DT","RotaryEncoder",DIGITAL_INPUT_PINS,m.index+1);if(sw>=0)add(sw,i+1,"Rotary switch","RotaryEncoder",DIGITAL_INPUT_PINS,m.index+1);}
      const ultrasonic=/\bUltrasonic\s*\(([^)]*)\)/g;
      while((m=ultrasonic.exec(clean))){const args=m[1],pos=args.split(",").map(x=>x.trim()).filter(x=>x&&!x.includes("="));let trig=parseNumberArg(args,"trig",0,18),echo=parseNumberArg(args,"echo",1,19);if(pos.length===1&&!/\b(?:trig|echo)\s*=/.test(args)){trig=18;echo=19;}add(trig,i+1,"Ultrasonic TRIG","Ultrasonic",RGB_OUTPUT_PINS,m.index+1);add(echo,i+1,"Ultrasonic ECHO","Ultrasonic",ULTRASONIC_ECHO_PINS,m.index+1);}
      const dht=/\bDHT11\s*\(([^)]*)\)/g;while((m=dht.exec(clean))){const pin=parseNumberArg(m[1],"pin",0,13);add(pin,i+1,"DHT11 DATA","DHT11",RGB_OUTPUT_PINS,m.index+1);}
      const oled=/\bOLED\s*\(([^)]*)\)/g;while((m=oled.exec(clean))){const args=m[1],sda=parseNumberArg(args,"sda",0,21),scl=parseNumberArg(args,"scl",1,22);add(sda,i+1,"OLED SDA","OLED",RGB_OUTPUT_PINS,m.index+1);add(scl,i+1,"OLED SCL","OLED",RGB_OUTPUT_PINS,m.index+1);}
    });return out;
  }

  function allPinEntries(src){
    const base=pinEntries(src),out=[...base],lines=String(src||"").split(/\r?\n/);
    const add=(pin,line,role,kind,valid,offset=1,shareKey="",shareChannel="")=>{if(Number.isFinite(pin))out.push({pin:Number(pin),line,role,kind,valid,offset,shareKey,shareChannel});};
    const i2cConfigured=new Map();
    const argProvided=(args,name,pos)=>{if(new RegExp(`\\b${name}\\s*=`).test(args))return true;const positional=String(args||"").split(",").map(x=>x.trim()).filter(x=>x&&!x.includes("="));return positional.length>pos;};
    const i2cPins=(args,bus,sdaPos,sclPos)=>{
      const known=i2cConfigured.get(bus)||{sda:bus===1?25:21,scl:bus===1?26:22};
      const sda=parseNumberArg(args,"sda",sdaPos,argProvided(args,"sda",sdaPos)?(bus===1?25:21):known.sda);
      const scl=parseNumberArg(args,"scl",sclPos,argProvided(args,"scl",sclPos)?(bus===1?26:22):known.scl);
      return {sda,scl};
    };
    lines.forEach((text,i)=>{
      const clean=text.replace(/#.*$/,"").trimEnd(),line=i+1;let m;
      // OLED owns/shares hardware I2C bus 0. A later generic I2C object with omitted pins inherits this pair.
      const oled=/\bOLED\s*\(([^)]*)\)/g;while((m=oled.exec(clean))){const a=m[1],sda=parseNumberArg(a,"sda",0,21),scl=parseNumberArg(a,"scl",1,22),key=`i2c:0:${sda}:${scl}`;for(const e of out.filter(x=>x.kind==="OLED"&&x.line===line)){e.shareKey=key;e.shareChannel=/SDA/.test(e.role)?"sda":"scl";}if(!i2cConfigured.has(0))i2cConfigured.set(0,{sda,scl,line});}

      const dout=/\b(DigitalOutput|Relay|PWM|PWMServo|PulseOutput|Buzzer)\s*\(([^)]*)\)/g;while((m=dout.exec(clean))){const pin=parseNumberArg(m[2],"pin",0,null);if(pin!==null)add(pin,line,m[1]+" output",m[1],RGB_OUTPUT_PINS,m.index+1);}
      const adc=/\b(ADC|LDR|SoilMoisture|GasSensor|VoltageSensor|SoundSensor|RainSensor|WaterLevelSensor|Thermistor)\s*\(([^)]*)\)/g;while((m=adc.exec(clean))){const pin=parseNumberArg(m[2],"pin",0,null);if(pin!==null)add(pin,line,m[1]+" ADC",m[1],ANALOG_INPUT_PINS,m.index+1);}
      const gin=/\b(GPIOInput|PIRSensor|ReedSwitch|TouchSensor|FlameSensor|PulseInput|CounterInput|FlowSensor|RPMSensor)\s*\(([^)]*)\)/g;while((m=gin.exec(clean))){const pin=parseNumberArg(m[2],"pin",0,null),valid=["CounterInput","FlowSensor","RPMSensor"].includes(m[1])?COUNTER_INPUT_PINS:ULTRASONIC_ECHO_PINS;if(pin!==null)add(pin,line,m[1]+" input",m[1],valid,m.index+1);}
      const joystick=/\bJoystick\s*\(([^)]*)\)/g;while((m=joystick.exec(clean))){const a=m[1],xp=parseNumberArg(a,"x_pin",0,34),yp=parseNumberArg(a,"y_pin",1,35),sw=parseNumberArg(a,"switch_pin",2,-1);add(xp,line,"Joystick X","Joystick",ANALOG_INPUT_PINS,m.index+1);add(yp,line,"Joystick Y","Joystick",ANALOG_INPUT_PINS,m.index+1);if(sw>=0)add(sw,line,"Joystick switch","Joystick",DIGITAL_INPUT_PINS,m.index+1);}
      const motor=/\bMotorDriver\s*\(([^)]*)\)/g;while((m=motor.exec(clean))){const a=m[1],p1=parseNumberArg(a,"in1",0,null),p2=parseNumberArg(a,"in2",1,null),pwm=parseNumberArg(a,"pwm_pin",2,null);if(p1!==null)add(p1,line,"Motor IN1","MotorDriver",RGB_OUTPUT_PINS,m.index+1);if(p2!==null)add(p2,line,"Motor IN2","MotorDriver",RGB_OUTPUT_PINS,m.index+1);if(pwm!==null)add(pwm,line,"Motor PWM","MotorDriver",RGB_OUTPUT_PINS,m.index+1);}

      const lcd1602=/\bLCD1602\s*\(([^)]*)\)/g;while((m=lcd1602.exec(clean))){const a=m[1],bus=parseNumberArg(a,"bus",3,0)===1?1:0,pins=i2cPins(a,bus,0,1),key=`i2c:${bus}:${pins.sda}:${pins.scl}`;add(pins.sda,line,"LCD1602 SDA","LCD1602",RGB_OUTPUT_PINS,m.index+1,key,"sda");add(pins.scl,line,"LCD1602 SCL","LCD1602",RGB_OUTPUT_PINS,m.index+1,key,"scl");if(!i2cConfigured.has(bus))i2cConfigured.set(bus,{...pins,line});}
      const i2c=/\b(I2C|MPU6050)\s*\(([^)]*)\)/g;while((m=i2c.exec(clean))){const a=m[2],bus=parseNumberArg(a,"bus",3,0)===1?1:0,pins=i2cPins(a,bus,0,1),key=`i2c:${bus}:${pins.sda}:${pins.scl}`;add(pins.sda,line,m[1]+" SDA",m[1],RGB_OUTPUT_PINS,m.index+1,key,"sda");add(pins.scl,line,m[1]+" SCL",m[1],RGB_OUTPUT_PINS,m.index+1,key,"scl");if(!i2cConfigured.has(bus))i2cConfigured.set(bus,{...pins,line});}
      const i2cd=/\bI2CDevice\s*\(([^)]*)\)/g;while((m=i2cd.exec(clean))){const a=m[1],bus=parseNumberArg(a,"bus",4,0)===1?1:0,pins=i2cPins(a,bus,1,2),key=`i2c:${bus}:${pins.sda}:${pins.scl}`;add(pins.sda,line,"I2CDevice SDA","I2CDevice",RGB_OUTPUT_PINS,m.index+1,key,"sda");add(pins.scl,line,"I2CDevice SCL","I2CDevice",RGB_OUTPUT_PINS,m.index+1,key,"scl");if(!i2cConfigured.has(bus))i2cConfigured.set(bus,{...pins,line});}
      const uart=/\b(UART|GPS)\s*\(([^)]*)\)/g;while((m=uart.exec(clean))){const a=m[2],rx=parseNumberArg(a,"rx",0,16),tx=parseNumberArg(a,"tx",1,17);add(rx,line,m[1]+" RX",m[1],ULTRASONIC_ECHO_PINS,m.index+1);add(tx,line,m[1]+" TX",m[1],RGB_OUTPUT_PINS,m.index+1);}
      const spi=/\bSPI\s*\(([^)]*)\)/g;while((m=spi.exec(clean))){const a=m[1],sck=parseNumberArg(a,"sck",0,18),miso=parseNumberArg(a,"miso",1,19),mosi=parseNumberArg(a,"mosi",2,23),cs=parseNumberArg(a,"cs",3,4),bus=parseNumberArg(a,"bus",6,1),key=`spi:${bus}:${sck}:${miso}:${mosi}`;add(sck,line,"SPI SCK","SPI",RGB_OUTPUT_PINS,m.index+1,key,"sck");add(miso,line,"SPI MISO","SPI",ULTRASONIC_ECHO_PINS,m.index+1,key,"miso");add(mosi,line,"SPI MOSI","SPI",RGB_OUTPUT_PINS,m.index+1,key,"mosi");add(cs,line,"SPI CS","SPI",RGB_OUTPUT_PINS,m.index+1);}
    });
    return out;
  }

  function hardwarePinValidation(src){
    const entries=allPinEntries(src);
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
        const shared=first.shareKey&&e.shareKey&&first.shareKey===e.shareKey&&first.shareChannel===e.shareChannel;
        if(!shared)return {errorType:"PinConflictError",line:e.line,offset:e.offset,message:`GPIO${e.pin} is already used by ${first.role} on line ${first.line}.`,suggestion:`Use a different GPIO for ${e.role}. I²C/SPI bus lines may be shared only when the bus and signal match.`};
      }else used.set(e.pin,e);
    }
    const busSeen=new Map(),busDeclSeen=new Set();
    for(const e of entries.filter(x=>x.shareKey)){
      const parts=String(e.shareKey).split(":"),family=parts[0],bus=parts[1],k=`${family}:${bus}`,decl=`${e.line}:${e.shareKey}`;
      if(busDeclSeen.has(decl))continue;busDeclSeen.add(decl);
      const cfg=e.shareKey;
      if(busSeen.has(k)&&busSeen.get(k).cfg!==cfg){const first=busSeen.get(k),pins=parts.slice(2).join("/")||"different pins",firstPins=String(first.cfg).split(":").slice(2).join("/");return {errorType:"InterfaceConflictError",line:e.line,offset:e.offset,message:`${family.toUpperCase()} bus ${bus} uses ${firstPins} on line ${first.line}, but this device requests ${pins}.`,suggestion:`Devices may share ${family.toUpperCase()} bus ${bus} when the bus pins match. Reuse the first pin pair or select the other hardware bus.`};}
      if(!busSeen.has(k))busSeen.set(k,{cfg,line:e.line});
    }
    const uartSeen=new Map(),lines=String(src||"").split(/\r?\n/);
    lines.forEach((text,i)=>{let m;const re=/\b(UART|GPS)\s*\(([^)]*)\)/g,clean=text.replace(/#.*$/,"");while((m=re.exec(clean))){const a=m[2],rx=parseNumberArg(a,"rx",0,16),tx=parseNumberArg(a,"tx",1,17),port=parseNumberArg(a,"port",3,1),cfg=`${rx}:${tx}`;if(uartSeen.has(port)&&uartSeen.get(port).cfg!==cfg)uartSeen.set(`conflict:${i+1}`,{port,first:uartSeen.get(port),line:i+1,offset:m.index+1});else if(!uartSeen.has(port))uartSeen.set(port,{cfg,line:i+1});}});
    for(const [k,v] of uartSeen)if(String(k).startsWith("conflict:"))return {errorType:"InterfaceConflictError",line:v.line,offset:v.offset,message:`UART port ${v.port} is already assigned to different RX/TX pins on line ${v.first.line}.`,suggestion:"Use UART port 1 and 2 for two independent serial modules, or share one UART object when devices use the same connection."};
    return null;
  }

  function pinHintContext(cm){
    const cur=cm.getCursor(),left=cm.getLine(cur.line).slice(0,cur.ch),full=cm.getValue();
    const m=left.match(/\b(RGBLED(?:\d+)?|LED\d+|DHT11|AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder|Ultrasonic|OLED|TM1637|LCD1602|DigitalOutput|Relay|GPIOInput|ADC|PWM|PWMServo|PulseInput|PulseOutput|CounterInput|LDR|SoilMoisture|GasSensor|VoltageSensor)\s*\(([^()]*)$/);if(!m)return null;
    const token=m[1],type=/^LED\d+$/.test(token)?"SingleLED":/^RGBLED\d+$/.test(token)?"RGBLED":token,args=m[2],parts=args.split(","),argIndex=Math.max(0,parts.length-1);
    if(type==="SingleLED"&&argIndex>0)return null;if((type==="OLED"||type==="Ultrasonic"||type==="TM1637"||type==="LCD1602")&&argIndex>1)return null;if(type==="DHT11"&&argIndex>0)return null;if(["DigitalOutput","Relay","GPIOInput","ADC","PWM","PWMServo","PulseInput","PulseOutput","CounterInput","LDR","SoilMoisture","GasSensor","VoltageSensor"].includes(type)&&argIndex>0)return null;
    const currentPart=parts[parts.length-1]||"",prefix=(currentPart.match(/(?:^|=)\s*(\d*)$/)||[])[1];if(prefix===undefined)return null;
    const alreadyHere=[...args.matchAll(/\b(\d+)\b/g)].map(x=>Number(x[1])),usedElsewhere=allPinEntries(full).map(x=>x.pin);
    let pins=PIN_HINT_ORDER[type]||DIGITAL_INPUT_PINS;if(type==="CounterInput")pins=COUNTER_INPUT_PINS;if(type==="Ultrasonic"&&argIndex===1)pins=ULTRASONIC_ECHO_PINS;if(type==="Ultrasonic"&&argIndex===0)pins=RGB_OUTPUT_PINS;if(type==="OLED"||type==="LCD1602"||type==="TM1637"||type==="DHT11"||type==="SingleLED")pins=RGB_OUTPUT_PINS;
    pins=pins.filter(p=>!alreadyHere.includes(p)&&!usedElsewhere.includes(p));
    const list=pins.filter(p=>String(p).startsWith(prefix)).map(p=>({text:String(p),displayText:`GPIO${p}   — free ${type} pin · ${pins.length} compatible free`,className:"hint-constant"}));
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

    // v6.2: import-member completion also works after commas and with partial names.
    m=line.match(/^\s*from\s+(zebjus|zebjus_ai|zebjus_cv|cv2|cvzone|mediapipe|SerialModule|HandTrackingModule|zebjus_wifi)\s+import\s*(.*)$/);
    if(m){
      const moduleName=m[1],tail=m[2]||"",segment=(tail.split(",").pop()||"").replace(/^\s*\(?\s*/,"");
      const pm=segment.match(/([A-Za-z_]\w*)?$/);prefix=pm?.[1]||"";
      const already=new Set(tail.replace(/[()]/g,"").split(",").map(x=>x.trim().split(/\s+as\s+/i)[0]).filter(Boolean));
      const sourceMembers=moduleName==="zebjus"?dynamicZebjusMembers(full):(moduleMembers[moduleName]||[]);
      const available=sourceMembers.filter(x=>!already.has(x[0])||x[0]===prefix);
      return{list:filterItems(available,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};
    }

    m=line.match(/([A-Za-z_]\w*)\.([A-Za-z_]\w*)?$/);
    if(m){
      prefix=m[2]||"";
      if(m[1]==="cv2") items=members.cv2||[];
      else items=members[inferType(full,m[1])]||[];
      return{list:filterItems(items,prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};
    }

    m=line.match(/([A-Za-z_]\w*)$/);prefix=m?.[1]||"";
    const userSymbols=collectUserSymbols(full);
    const seqHints=dynamicZebjusMembers(full).filter(x=>/^(?:LED|RGBLED)\d+$/.test(x[0]));
    return{list:filterItems([...userSymbols,...seqHints,...base],prefix),from:CodeMirror.Pos(cur.line,cur.ch-prefix.length),to:cur};
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
      scheduleHardwareCards(cm.getValue());
      updateHardwarePickerInfo();
      if(prefs.autoSave){clearTimeout(window.__save);$("saveState").textContent="Saving…";window.__save=setTimeout(()=>{localStorage.setItem("zebjus.lab.code",cm.getValue());$("saveState").textContent="Saved";},220);}
      if((ch.origin==="+input"||ch.origin==="paste")&&!cm.state.completionActive){
        const typed=(ch.text||[]).join("\n"),cur=cm.getCursor(),left=cm.getLine(cur.line).slice(0,cur.ch);
        if(/[A-Za-z0-9_.(,=]$/.test(typed)||/\b(?:import|from)\s+$/.test(left)||/^\s*from\s+[A-Za-z_]\w*\s+import\s*(?:[A-Za-z_]\w*\s*,\s*)?[A-Za-z_]*$/.test(left))setTimeout(()=>cm.showHint({hint:CodeMirror.hint.zebjusPython,completeSingle:false}),0);
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
  function log(t){const text=String(t);terminal.textContent+=(terminal.textContent?"\n":"")+text;terminal.scrollTop=terminal.scrollHeight;debugEvent("terminal",text);}
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
    worker=new Worker("./py-worker.js?v=6.4.6",{type:"module"});
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
      else if(m.type==="plot")handlePlotPacket(m);
      else if(m.type==="plot-clear")clearPlotter();
      else if(m.type==="sensor-card"){updateCustomSensorCard(m.name,m.json);}
      else if(m.type==="sensor-live"){let data={};try{data=JSON.parse(String(m.json||"{}"));}catch(_){data={};}updateSensorPacket({sensor:m.sensor||data.sensor||"",...data});}
      else if(m.type==="image"){
        // Keep Camera / MediaPipe as the live camera panel. cv2.imshow()/show() belongs in the dedicated output panel below Terminal.
        showImage(m.dataUrl);
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
    const out={analog:[],digital:[],rotary:[],ultrasonic:[],dht11:[]};let m;
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
    const dhtRe=/\bDHT11\s*\(([^)]*)\)/g;
    while((m=dhtRe.exec(src))){const pin=parseNumberArg(m[1],"pin",0,13);out.dht11.push({pin});}
    const ultraRe=/\bUltrasonic\s*\(([^)]*)\)/g;
    while((m=ultraRe.exec(src))){
      const args=m[1],pos=args.split(",").map(x=>x.trim()).filter(x=>x&&!x.includes("="));
      let trig=parseNumberArg(args,"trig",0,18),echo=parseNumberArg(args,"echo",1,19);
      if(pos.length===1&&!/\b(?:trig|echo)\s*=/.test(args)){trig=18;echo=19;} // legacy Ultrasonic(1)
      out.ultrasonic.push({trig,echo,maxCm:parseNumberArg(args,"max_cm",2,400)});
    }
    return out;
  }
  function requestedRgbPins(src){return pinEntries(src).filter(x=>x.kind==="RGBLED"||x.kind==="SingleLED").map(x=>x.pin);}


  function componentByClass(className){return COMPONENT_CATALOG.find(x=>x.className===className)||null;}
  function constructorCount(src,className){
    const patterns=className==="SingleLED"?["LED\\d+"]:className==="RGBLED"?["RGBLED(?:\\d+)?"]:[String(className).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")];
    return patterns.reduce((n,p)=>n+[...String(src||"").matchAll(new RegExp("(?:^|\\n)\\s*[A-Za-z_]\\w*\\s*=\\s*(?:zebjus\\.)?"+p+"\\s*\\(","g"))].length,0);
  }
  function nextHardwareVariable(src,item){const re=new RegExp("\\b"+item.prefix+"(\\d+)\\b","gi");let max=0,m;while((m=re.exec(String(src||""))))max=Math.max(max,Number(m[1])||0);return item.prefix+(max+1);}
  function firstFree(list,used){return list.find(p=>!used.has(p));}
  function suggestedHardwareArgs(item,src){
    const state=gpioResourceState(src),used=state.used;
    if(item.className==="SingleLED"){const p=firstFree(PIN_HINT_ORDER.SingleLED,used);return p==null?null:String(p);}
    if(item.className==="RGBLED"){const pref=PIN_HINT_ORDER.RGBLED.filter(p=>!used.has(p));return pref.length>=3?`${pref[0]}, ${pref[1]}, ${pref[2]}`:null;}
    if(item.className==="OLED"){const pref=PIN_HINT_ORDER.OLED.filter(p=>!used.has(p));return pref.length>=2?`${pref[0]}, ${pref[1]}, 0x3C`:null;}
    if(item.className==="TM1637"){const pref=PIN_HINT_ORDER.TM1637.filter(p=>!used.has(p));return pref.length>=2?`${pref[0]}, ${pref[1]}, 6`:null;}
    if(item.className==="LCD1602"){const existing=allPinEntries(src).find(e=>e.shareKey&&String(e.shareKey).startsWith("i2c:0:"));if(existing){const parts=existing.shareKey.split(":");return `${parts[2]}, ${parts[3]}, 0x27, 0`;}const pref=PIN_HINT_ORDER.LCD1602.filter(p=>!used.has(p));return pref.length>=2?`${pref[0]}, ${pref[1]}, 0x27, 0`:null;}
    if(item.className==="DHT11"){const p=firstFree(PIN_HINT_ORDER.DHT11,used);return p==null?null:String(p);}
    if(item.className==="Ultrasonic"){const trig=firstFree(PIN_HINT_ORDER.Ultrasonic,used);if(trig==null)return null;const used2=new Set(used);used2.add(trig);const echo=firstFree([34,35,36,39,19,18,17,16,33,32,27,26,25,23,22,21,14,13,4,12],used2);return echo==null?null:`${trig}, ${echo}`;}
    if(item.className==="AnalogInput"||item.className==="Potentiometer"){const p=firstFree(PIN_HINT_ORDER[item.className],used);return p==null?null:String(p);}
    if(item.className==="Switch"||item.className==="DigitalInput"){const p=firstFree(PIN_HINT_ORDER[item.className],used);return p==null?null:String(p);}
    if(item.className==="RotaryEncoder"){const free=PIN_HINT_ORDER.RotaryEncoder.filter(p=>!used.has(p));return free.length>=3?`${free[0]}, ${free[1]}, ${free[2]}`:null;}
    if(["DigitalOutput","Relay","PWM","PWMServo","PulseOutput","Buzzer"].includes(item.className)){const p=firstFree(PIN_HINT_ORDER[item.className]||RGB_OUTPUT_PINS,used);return p==null?null:String(p);}
    if(["ADC","LDR","SoilMoisture","GasSensor","VoltageSensor","SoundSensor","RainSensor","WaterLevelSensor","Thermistor"].includes(item.className)){const p=firstFree(PIN_HINT_ORDER[item.className]||ANALOG_INPUT_PINS,used);return p==null?null:String(p);}
    if(["GPIOInput","PIRSensor","ReedSwitch","TouchSensor","FlameSensor","PulseInput","CounterInput","FlowSensor","RPMSensor"].includes(item.className)){const p=firstFree(PIN_HINT_ORDER[item.className]||DIGITAL_INPUT_PINS,used);return p==null?null:String(p);}
    if(item.className==="Joystick"){const free=ANALOG_INPUT_PINS.filter(p=>!used.has(p));if(free.length<2)return null;const u2=new Set(used);u2.add(free[0]);u2.add(free[1]);const sw=firstFree(DIGITAL_INPUT_PINS,u2);return `${free[0]}, ${free[1]}${sw==null?"":`, ${sw}`}`;}
    if(item.className==="MotorDriver"){const free=RGB_OUTPUT_PINS.filter(p=>!used.has(p));return free.length>=3?`${free[0]}, ${free[1]}, ${free[2]}`:null;}
    if(item.className==="I2C"||item.className==="MPU6050"){const existing=allPinEntries(src).find(e=>e.shareKey&&String(e.shareKey).startsWith("i2c:0:"));if(item.className==="MPU6050"&&existing){const parts=existing.shareKey.split(":");return `${parts[2]}, ${parts[3]}, 0x68, 0`;}if(item.className==="I2C"&&constructorCount(src,"I2C")===0&&existing){const parts=existing.shareKey.split(":");return `${parts[2]}, ${parts[3]}, 400000, 0`;}const free=PIN_HINT_ORDER.OLED.filter(p=>!used.has(p));if(free.length<2)return null;const bus=item.className==="I2C"&&constructorCount(src,"I2C")>0?1:0;return item.className==="MPU6050"?`${free[0]}, ${free[1]}, 0x68, ${bus}`:`${free[0]}, ${free[1]}, 400000, ${bus}`; }
    if(item.className==="UART"||item.className==="GPS"){const rx=firstFree([34,35,36,39,32,33,19,18,16,17,14,13,4,21,22,23,25,26,27],used);if(rx==null)return null;const u2=new Set(used);u2.add(rx);const tx=firstFree(RGB_OUTPUT_PINS,u2);if(tx==null)return null;const port=Math.min(2,constructorCount(src,"UART")+constructorCount(src,"GPS")+1);return `${rx}, ${tx}, 9600, ${port}`;}
    if(item.className==="SPI"){const freeOut=RGB_OUTPUT_PINS.filter(p=>!used.has(p));if(freeOut.length<3)return null;const sck=freeOut[0],mosi=freeOut[1],cs=freeOut[2],u2=new Set(used);u2.add(sck);u2.add(mosi);u2.add(cs);const miso=firstFree([34,35,36,39,19,18,32,33,14,13,4,16,17,21,22,23,25,26,27],u2);if(miso==null)return null;const bus=Math.min(2,constructorCount(src,"SPI")+1);return `${sck}, ${miso}, ${mosi}, ${cs}, 1000000, 0, ${bus}`;}
    if(item.className==="HardwareTransaction")return `"custom${constructorCount(src,"HardwareTransaction")+1}"`;
    return "1";
  }
  function importTokenForComponent(item,src){
    if(item.numberedBase){const n=nextSequenceNumber(src,item.numberedBase,item.max);return n===null?null:`${item.numberedBase}${n}`;}return item.className;
  }
  function ensureZebjusImport(src,className){
    src=String(src||"");const paren=/from\s+zebjus\s+import\s*\(([\s\S]*?)\)/m.exec(src);
    if(paren){const tokens=paren[1].split(",").map(x=>x.trim()).filter(Boolean);if(tokens.includes(className))return src;const body=paren[1],indent=(body.match(/\n([ \t]*)\S/)||[])[1]||"    ";const replacement=`from zebjus import (${body.replace(/\s*$/ ,"")}${body.trim()?",":""}\n${indent}${className}\n)`;return src.slice(0,paren.index)+replacement+src.slice(paren.index+paren[0].length);}
    const one=/^[ \t]*from\s+zebjus\s+import\s+([^\n#]+)/m.exec(src);if(one){const tokens=one[1].split(",").map(x=>x.trim()).filter(Boolean);if(tokens.includes(className))return src;return src.slice(0,one.index)+one[0].replace(one[1],one[1].trim()+", "+className)+src.slice(one.index+one[0].length);}
    const lines=src.split("\n");let at=0;while(at<lines.length&&(lines[at].trim()===""||/^\s*#/.test(lines[at])))at++;lines.splice(at,0,`from zebjus import ${className}`,"");return lines.join("\n");
  }
  function insertHardwareConstructor(src,line){
    const lines=String(src||"").split("\n");let lastImport=-1;for(let i=0;i<lines.length;i++)if(/^\s*(?:from\s+\S+\s+import\b|import\s+\S+)/.test(lines[i]))lastImport=i;let at=lastImport+1;while(at<lines.length&&lines[at].trim()==="")at++;
    while(at<lines.length&&/^\s*[A-Za-z_]\w*\s*=\s*(?:zebjus\.)?(?:RGBLED(?:\d+)?|LED\d+|LED|TM1637|LCD1602|DHT11|Ultrasonic|OLED|AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder|DigitalOutput|Relay|GPIOInput|ADC|PWM|PWMServo|MotorDriver|I2C|I2CDevice|UART|SPI|PulseInput|PulseOutput|CounterInput|HardwareTransaction|GPS|MPU6050|LDR|SoilMoisture|GasSensor|VoltageSensor|SoundSensor|RainSensor|WaterLevelSensor|Thermistor|PIRSensor|ReedSwitch|TouchSensor|FlameSensor|FlowSensor|RPMSensor|Buzzer|Joystick|Motor|Servo)\s*\(/.test(lines[at]))at++;
    lines.splice(at,0,line);if(at+1<lines.length&&lines[at+1].trim()!=="")lines.splice(at+1,0,"");return lines.join("\n");
  }
  function allocatorSummary(src){const st=gpioResourceState(src);return `GPIO free · OUT ${st.freeOut.length}/${RGB_OUTPUT_PINS.length} · Digital ${st.freeDigital.length}/${DIGITAL_INPUT_PINS.length} · ADC1 ${st.freeAdc.length}/${ANALOG_INPUT_PINS.length}`;}
  function updateHardwarePickerInfo(){
    const sel=$("hardwarePicker"),info=$("hardwareLimitInfo");if(!sel||!info)return;const src=getCode(),state=gpioResourceState(src);
    for(const o of sel.querySelectorAll("option[value]")){if(!o.value)continue;const it=componentByClass(o.value);if(!it)continue;if(it.status!=="ready"){o.disabled=true;o.textContent=`${it.label} · ${it.interface} · planned`;continue;}const used=constructorCount(src,it.className),hasPins=suggestedHardwareArgs(it,src)!==null,seqOk=!it.numberedBase||nextSequenceNumber(src,it.numberedBase,it.max)!==null,available=used<it.max&&hasPins&&seqOk;o.disabled=!available;o.textContent=`${it.label} · ${it.interface} · ${used}/${it.max}${available?"":" · no resources"}`;}
    const item=componentByClass(sel.value);info.textContent=item?`${item.interface} · ${constructorCount(src,item.className)}/${item.max} used · ${allocatorSummary(src)}`:allocatorSummary(src);
  }
  function populateHardwarePicker(){const sel=$("hardwarePicker");if(!sel)return;sel.innerHTML='<option value="">+ Add component to main.py…</option>';const groups=new Map();for(const item of COMPONENT_CATALOG){if(!groups.has(item.group)){const g=document.createElement("optgroup");g.label=item.group;groups.set(item.group,g);sel.appendChild(g);}const o=document.createElement("option");o.value=item.className;o.disabled=item.status!=="ready";o.textContent=item.status==="ready"?`${item.label} · ${item.interface} · max ${item.max}`:`${item.label} · ${item.interface} · planned`;groups.get(item.group).appendChild(o);}updateHardwarePickerInfo();}
  function addSelectedHardware(){
    const sel=$("hardwarePicker"),item=componentByClass(sel?.value);if(!item||item.status!=="ready")return;let src=getCode(),count=constructorCount(src,item.className);if(count>=item.max){$("hardwareLimitInfo").textContent=`${item.label}: current maximum ${item.max} reached`;return;}const args=suggestedHardwareArgs(item,src);if(args===null){$("hardwareLimitInfo").textContent=`${item.label}: no conflict-free GPIO resources left`;return;}const token=importTokenForComponent(item,src);if(!token){$("hardwareLimitInfo").textContent=`${item.label}: sequence limit reached`;return;}const variable=nextHardwareVariable(src,item);src=ensureZebjusImport(src,token);src=insertHardwareConstructor(src,`${variable} = ${token}(${args})`);setCode(src);scheduleHardwareCards(src);updateHardwarePickerInfo();$("hardwareLimitInfo").textContent=`Added ${variable} = ${token}(${args}) · ${allocatorSummary(src)}`;
  }


  // v6.2: Build the Kit Output / Sensors dashboard

  // v6.2: Build the Kit Output / Sensors dashboard from the student's source code.
  // Import order controls card order. Multiple constructor instances become separate cards.
  const HARDWARE_CLASSES=new Set(["RGBLED","LED","SingleLED","TM1637","LCD1602","DHT11","Ultrasonic","OLED","AnalogInput","Potentiometer","DigitalInput","Switch","RotaryEncoder","DigitalOutput","Relay","GPIOInput","ADC","PWM","PWMServo","MotorDriver","I2C","I2CDevice","UART","SPI","PulseInput","PulseOutput","CounterInput","HardwareTransaction","GPS","MPU6050","LDR","SoilMoisture","GasSensor","VoltageSensor","SoundSensor","RainSensor","WaterLevelSensor","Thermistor","PIRSensor","ReedSwitch","TouchSensor","FlameSensor","FlowSensor","RPMSensor","Buzzer","Joystick","Motor","Servo"]);
  const DEFAULT_HARDWARE_CLASSES=["RGBLED","DHT11","Ultrasonic","OLED","AnalogInput","Switch","RotaryEncoder"];

  function parseCtorNumber(args,name,index,defaultValue=null){
    const text=String(args||"");
    const named=text.match(new RegExp("\\b"+name+"\\s*=\\s*(-?0x[0-9a-fA-F]+|-?\\d+)","i"));
    const toNum=v=>/^[-+]?0x/i.test(String(v))?parseInt(v,16):Number(v);
    if(named)return toNum(named[1]);
    const positional=text.split(",").map(x=>x.trim()).filter(x=>x&&!x.includes("="));
    if(index<positional.length&&/^-?(?:0x[0-9a-fA-F]+|\d+)$/.test(positional[index]))return toNum(positional[index]);
    return defaultValue;
  }

  function hardwareSpec(className,args="",variable="",sourceIndex=0,token=""){
    const c=String(className||""),meta=componentByClass(c),spec={className:c,token:token||c,args:String(args||""),variable:String(variable||""),sourceIndex,interface:meta?.interface||"",maxCount:meta?.max||0};
    if(c==="SingleLED"){
      spec.type="led";spec.title="Single LED";spec.pin=parseCtorNumber(args,"pin",0,null);spec.identity=spec.pin==null?(spec.token||variable||"unassigned"):String(spec.pin);
    }else if(c==="RGBLED"||c==="LED"){
      spec.type="rgb";spec.title=c==="LED"?"LED / RGB Output":"RGB LED";const numbered=/^RGBLED\d+$/.test(spec.token);
      spec.r=parseCtorNumber(args,"red",0,numbered?null:25);spec.g=parseCtorNumber(args,"green",1,numbered?null:26);spec.b=parseCtorNumber(args,"blue",2,numbered?null:27);
      if(c==="LED"){spec.r=25;spec.g=26;spec.b=27;}else if(!numbered&&String(args).split(",").filter(x=>x.trim()).length<=1){spec.r=25;spec.g=26;spec.b=27;}
      spec.identity=`${spec.r??"?"},${spec.g??"?"},${spec.b??"?"}`;
    }else if(c==="TM1637"){
      spec.type="tm1637";spec.title="TM1637 4-Digit Display";spec.clk=parseCtorNumber(args,"clk",0,13);spec.dio=parseCtorNumber(args,"dio",1,14);spec.brightness=parseCtorNumber(args,"brightness",2,7);spec.identity=`${spec.clk},${spec.dio}`;spec.detail=`CLK ${spec.clk} · DIO ${spec.dio}`;
    }else if(c==="LCD1602"){
      spec.type="lcd1602";spec.title="LCD1602 16×2";spec.sda=parseCtorNumber(args,"sda",0,21);spec.scl=parseCtorNumber(args,"scl",1,22);spec.address=parseCtorNumber(args,"address",2,0x27);spec.bus=parseCtorNumber(args,"bus",3,0)===1?1:0;spec.identity=`${spec.bus}:${spec.sda},${spec.scl},${spec.address}`;spec.detail=`I²C${spec.bus} · SDA ${spec.sda} · SCL ${spec.scl} · 0x${Number(spec.address).toString(16).toUpperCase()}`;
    }else if(c==="DHT11"){
      spec.type="dht11";spec.title="DHT11";spec.pin=parseCtorNumber(args,"pin",0,13);spec.identity=String(spec.pin);
    }else if(c==="Ultrasonic"){
      spec.type="ultrasonic";spec.title="Ultrasonic";
      const pos=String(args).split(",").map(x=>x.trim()).filter(x=>x&&!x.includes("="));
      spec.trig=parseCtorNumber(args,"trig",0,18);spec.echo=parseCtorNumber(args,"echo",1,19);spec.maxCm=parseCtorNumber(args,"max_cm",2,400);
      if(pos.length===1&&!/\b(?:trig|echo)\s*=/.test(args)){spec.trig=18;spec.echo=19;}
      spec.identity=`${spec.trig},${spec.echo}`;
    }else if(c==="OLED"){
      spec.type="oled";spec.title="OLED 128×64";spec.sda=parseCtorNumber(args,"sda",0,21);spec.scl=parseCtorNumber(args,"scl",1,22);spec.address=parseCtorNumber(args,"address",2,0x3C);spec.identity=`${spec.sda},${spec.scl},${spec.address}`;
    }else if(c==="AnalogInput"||c==="Potentiometer"){
      spec.type="analog";spec.title=c==="Potentiometer"?"Potentiometer":"Analog Input";spec.pin=parseCtorNumber(args,"pin",0,34);if(c==="Potentiometer"&&spec.pin===1)spec.pin=34;spec.identity=String(spec.pin);
    }else if(c==="DigitalInput"||c==="Switch"){
      spec.type="digital";spec.title=c==="Switch"?"Switch":"Digital Input";spec.pin=parseCtorNumber(args,"pin",0,32);spec.identity=String(spec.pin);
    }else if(c==="RotaryEncoder"){
      spec.type="rotary";spec.title="Rotary Encoder";spec.clk=parseCtorNumber(args,"clk",0,32);spec.dt=parseCtorNumber(args,"dt",1,33);spec.sw=parseCtorNumber(args,"switch",2,-1);spec.identity=`${spec.clk},${spec.dt},${spec.sw}`;
    }else if(c==="Motor"){
      spec.type="motor";spec.title="Motor";spec.id=parseCtorNumber(args,"id",0,1);spec.identity=String(spec.id);
    }else if(c==="Servo"){
      spec.type="servo";spec.title="Servo";spec.id=parseCtorNumber(args,"id",0,1);spec.identity=String(spec.id);
    }else if(c==="DigitalOutput"||c==="Relay"){spec.type=c==="Relay"?"relay":"digital_output";spec.title=c;spec.pin=parseCtorNumber(args,"pin",0,null);spec.identity=String(spec.pin);spec.detail=`GPIO${spec.pin}`;
    }else if(c==="PWM"||c==="PulseOutput"||c==="Buzzer"){spec.type=c==="Buzzer"?"buzzer":"pwm_output";spec.title=c;spec.pin=parseCtorNumber(args,"pin",0,null);spec.identity=String(spec.pin);spec.detail=`GPIO${spec.pin}`;
    }else if(c==="GPIOInput"||c==="PIRSensor"||c==="ReedSwitch"||c==="TouchSensor"||c==="FlameSensor"){spec.type={PIRSensor:"motion",ReedSwitch:"reed",TouchSensor:"touch",FlameSensor:"flame"}[c]||"bridge_input";spec.title={PIRSensor:"PIR Motion",ReedSwitch:"Reed Switch",TouchSensor:"Touch Sensor",FlameSensor:"Flame Sensor"}[c]||c;spec.pin=parseCtorNumber(args,"pin",0,c==="PIRSensor"?27:32);spec.identity=String(spec.pin);spec.detail=`GPIO${spec.pin}`;
    }else if(c==="PulseInput"||c==="CounterInput"||c==="FlowSensor"||c==="RPMSensor"){spec.type=c==="FlowSensor"?"flow":(c==="RPMSensor"?"rpm":(c==="CounterInput"?"counter":"pulse"));spec.title={FlowSensor:"Flow Sensor",RPMSensor:"RPM Sensor"}[c]||c;spec.pin=parseCtorNumber(args,"pin",0,null);spec.identity=String(spec.pin);spec.detail=`GPIO${spec.pin}`;
    }else if(["ADC","LDR","SoilMoisture","GasSensor","VoltageSensor","SoundSensor","RainSensor","WaterLevelSensor","Thermistor"].includes(c)){const types={LDR:"light",SoilMoisture:"soil",GasSensor:"gas",VoltageSensor:"voltage",SoundSensor:"sound",RainSensor:"rain",WaterLevelSensor:"water",Thermistor:"temperature"};spec.type=types[c]||"bridge_analog";spec.title={LDR:"Light Sensor",SoilMoisture:"Soil Moisture",GasSensor:"Gas Sensor",VoltageSensor:"Voltage Sensor",SoundSensor:"Sound Sensor",RainSensor:"Rain Sensor",WaterLevelSensor:"Water Level",Thermistor:"Thermistor"}[c]||c;spec.pin=parseCtorNumber(args,"pin",0,null);spec.identity=String(spec.pin);spec.detail=`ADC GPIO${spec.pin}`;
    }else if(c==="Joystick"){spec.type="joystick";spec.title="2-Axis Joystick";spec.xPin=parseCtorNumber(args,"x_pin",0,34);spec.yPin=parseCtorNumber(args,"y_pin",1,35);spec.sw=parseCtorNumber(args,"switch_pin",2,-1);spec.identity=`${spec.xPin},${spec.yPin},${spec.sw}`;
    }else if(c==="PWMServo"){spec.type="servo";spec.title="PWM Servo";spec.pin=parseCtorNumber(args,"pin",0,null);spec.id=spec.pin;spec.identity=String(spec.pin);
    }else if(c==="MotorDriver"){spec.type="motor";spec.title="Motor Driver";spec.in1=parseCtorNumber(args,"in1",0,null);spec.in2=parseCtorNumber(args,"in2",1,null);spec.pwm=parseCtorNumber(args,"pwm_pin",2,null);spec.id=spec.pwm;spec.identity=`${spec.in1},${spec.in2},${spec.pwm}`;
    }else if(c==="MPU6050"){spec.type="imu";spec.title="MPU6050 IMU";spec.sda=parseCtorNumber(args,"sda",0,21);spec.scl=parseCtorNumber(args,"scl",1,22);spec.bus=parseCtorNumber(args,"bus",3,0);spec.identity=`${spec.bus}:${spec.sda},${spec.scl}`;spec.detail=`I²C bus ${spec.bus} · SDA ${spec.sda} · SCL ${spec.scl}`;
    }else if(c==="I2C"||c==="I2CDevice"){spec.type="i2c";spec.title=c;const off=c==="I2CDevice"?1:0;spec.sda=parseCtorNumber(args,"sda",off,21);spec.scl=parseCtorNumber(args,"scl",off+1,22);spec.bus=parseCtorNumber(args,"bus",c==="I2CDevice"?4:3,0);spec.identity=`${spec.bus}:${spec.sda},${spec.scl}`;spec.detail=`I²C bus ${spec.bus} · SDA ${spec.sda} · SCL ${spec.scl}`;
    }else if(c==="GPS"){spec.type="gps";spec.title="GPS / GNSS";spec.rx=parseCtorNumber(args,"rx",0,16);spec.tx=parseCtorNumber(args,"tx",1,17);spec.port=parseCtorNumber(args,"port",3,1);spec.identity=`${spec.port}:${spec.rx},${spec.tx}`;spec.detail=`UART${spec.port} · RX ${spec.rx} · TX ${spec.tx}`;
    }else if(c==="UART"){spec.type="uart";spec.title="UART";spec.rx=parseCtorNumber(args,"rx",0,16);spec.tx=parseCtorNumber(args,"tx",1,17);spec.port=parseCtorNumber(args,"port",3,1);spec.identity=`${spec.port}:${spec.rx},${spec.tx}`;spec.detail=`UART${spec.port} · RX ${spec.rx} · TX ${spec.tx}`;
    }else if(c==="SPI"){spec.type="spi";spec.title="SPI";spec.sck=parseCtorNumber(args,"sck",0,18);spec.miso=parseCtorNumber(args,"miso",1,19);spec.mosi=parseCtorNumber(args,"mosi",2,23);spec.cs=parseCtorNumber(args,"cs",3,4);spec.bus=parseCtorNumber(args,"bus",6,1);spec.identity=`${spec.bus}:${spec.sck},${spec.miso},${spec.mosi},${spec.cs}`;spec.detail=`SPI${spec.bus} · SCK ${spec.sck} · MISO ${spec.miso} · MOSI ${spec.mosi} · CS ${spec.cs}`;
    }else if(c==="HardwareTransaction"){spec.type="bridge";spec.title="Custom Hardware Transaction";spec.identity=variable||"custom";spec.detail="Local GPIO / pulse timing VM";
    }else return null;
    return spec;
  }

  function detectHardwareCards(src){
    src=String(src||"");
    const imports=[],aliasMap=new Map();let starImport=false,m;
    const importRe=/^[ \t]*from\s+zebjus\s+import\s+(?:\(([^)]*)\)|([^\n#]+))/gm;
    while((m=importRe.exec(src))){
      const body=(m[1]??m[2]??"");let offset=0;
      for(const raw of body.split(",")){
        const token=raw.replace(/#.*/,"").trim();if(!token)continue;
        if(token==="*"){starImport=true;continue;}
        const parts=token.split(/\s+as\s+/i).map(x=>x.trim()),original=parts[0],alias=parts[1]||original;
        const canonical=canonicalHardwareClass(original);
        if(canonical&&HARDWARE_CLASSES.has(canonical)){imports.push({className:canonical,token:original,alias,pos:m.index+offset});aliasMap.set(alias,{className:canonical,token:original});}
        offset+=raw.length+1;
      }
    }
    const constructors=[];
    const ctorRe=/(?:^|\n)\s*([A-Za-z_]\w*)\s*=\s*(?:(?:zebjus)\.)?([A-Za-z_]\w*)\s*\(([^)]*)\)/gm;
    while((m=ctorRe.exec(src))){
      const variable=m[1],token=m[2],mapped=aliasMap.get(token),className=mapped?.className||canonicalHardwareClass(token),sourceToken=mapped?.token||token;
      if(!className||!HARDWARE_CLASSES.has(className))continue;const spec=hardwareSpec(className,m[3],variable,m.index,sourceToken);if(spec)constructors.push(spec);
    }
    const result=[],used=new Set();
    if(starImport&&!imports.length)return DEFAULT_HARDWARE_CLASSES.map((c,i)=>hardwareSpec(c,"","",i));
    if(imports.length){
      for(const imp of imports.sort((a,b)=>a.pos-b.pos)){
        const numbered=!!numberedTokenInfo(imp.token);const matches=constructors.filter((x,i)=>(numbered?x.token===imp.token:x.className===imp.className)&&!used.has(i)).sort((a,b)=>a.sourceIndex-b.sourceIndex);
        if(matches.length){
          for(const sp of matches){const idx=constructors.indexOf(sp);used.add(idx);result.push(sp);}
        }else result.push(hardwareSpec(imp.className,"","",imp.pos,imp.token));
      }
      constructors.forEach((sp,i)=>{if(!used.has(i))result.push(sp);});
    }else if(constructors.length)result.push(...constructors.sort((a,b)=>a.sourceIndex-b.sourceIndex));
    else result.push(...DEFAULT_HARDWARE_CLASSES.map((c,i)=>hardwareSpec(c,"","",i)));

    const counts={};
    result.forEach((sp,i)=>{
      counts[sp.className]=(counts[sp.className]||0)+1;
      const suffix=counts[sp.className];
      sp.instance=suffix;
      sp.key=`${sp.type}:${sp.variable||sp.className+suffix}:${sp.identity}`;
    });
    return result;
  }

  function hardwareCardHtml(sp,index){
    const name=escapeHtml(sp.variable||((sp.instance>1)?`${sp.className}${sp.instance}`:"default"));
    const title=escapeHtml(sp.title),key=escapeHtml(sp.key);
    const iface=escapeHtml(sp.interface||"");
    const head=`<div class="card-title-row"><span class="sensor-status-dot"></span><strong>${title}</strong><span class="instance-name">${name}</span>${iface?`<span class="interface-badge">${iface}</span>`:""}</div>`;
    if(sp.type==="led")return `<div class="demo-card hardware-card single-led-card" data-hw-key="${key}" data-hw-type="led"><div class="single-led-visual"><i data-role="single-led-glow"></i></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="single-led-label">${sp.pin==null?"PIN NOT ASSIGNED":"OFF"}</span><div class="analog-bar"><i data-role="single-led-fill"></i></div><span class="sensor-secondary">${sp.pin==null?`Use ${escapeHtml(sp.token||"LED1")}(GPIO)`:`GPIO${sp.pin}`}</span></div></div>`;
    if(sp.type==="rgb")return `<div class="demo-card hardware-card rgb-card" data-hw-key="${key}" data-hw-type="rgb"><div class="rgb-shell"><div class="rgb-led" data-role="rgb-led"></div></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="rgb-label">R0 G0 B0</span><span class="sensor-secondary">${sp.r==null||sp.g==null||sp.b==null?`Assign 3 pins in ${escapeHtml(sp.token||"RGBLED1")}(R,G,B)`:`GPIO ${sp.r}/${sp.g}/${sp.b}`}</span></div></div>`;
    if(sp.type==="tm1637")return `<div class="demo-card hardware-card tm1637-card" data-hw-key="${key}" data-hw-type="tm1637" data-tm-clk="${sp.clk}" data-tm-dio="${sp.dio}"><div class="tm-display" data-role="tm-display">${[0,1,2,3].map(i=>`<span class="tm-digit" data-role="tm-digit-${i}"><i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><i class="e"></i><i class="f"></i><i class="g"></i><i class="dp"></i></span>`).join("")}<b class="tm-colon" data-role="tm-colon">:</b></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="tm-label">---- · brightness ${sp.brightness}</span><span class="sensor-secondary" data-role="tm-detail">CLK ${sp.clk} · DIO ${sp.dio} · native ACK driver</span></div></div>`;
    if(sp.type==="lcd1602")return `<div class="demo-card hardware-card lcd1602-card" data-hw-key="${key}" data-hw-type="lcd1602" data-lcd-bus="${sp.bus}" data-lcd-address="${sp.address}" data-lcd-sda="${sp.sda}" data-lcd-scl="${sp.scl}"><div class="lcd1602-screen" data-role="lcd-screen"><pre data-role="lcd-line-0">                </pre><pre data-role="lcd-line-1">                </pre><i class="lcd-cursor" data-role="lcd-cursor"></i></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="lcd-label">16×2 LCD · READY</span><span class="sensor-secondary">${escapeHtml(sp.detail||"")}</span></div></div>`;
    if(sp.type==="dht11")return `<div class="demo-card hardware-card dht-card" data-hw-key="${key}" data-hw-type="dht11"><div class="dht-visual"><div class="thermo"><i data-role="temp-fill"></i></div><div class="humidity-gauge"><i data-role="hum-fill"></i><b data-role="hum-mini">--%</b></div></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="dht-main">--.- °C · --.- %RH</span><span class="sensor-secondary" data-role="dht-detail">DATA GPIO${sp.pin}</span></div></div>`;
    if(sp.type==="ultrasonic")return `<div class="demo-card hardware-card" data-hw-key="${key}" data-hw-type="ultrasonic"><div class="ultra-visual"><div class="ultra-face"><i></i><i></i></div><div class="ultra-beam" data-role="ultra-beam"></div></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="ultra-label">--.- cm</span><div class="ultra-range"><i data-role="ultra-fill"></i></div><span class="sensor-secondary">TRIG ${sp.trig} · ECHO ${sp.echo}</span></div></div>`;
    if(sp.type==="oled")return `<div class="demo-card hardware-card oled-card" data-hw-key="${key}" data-hw-type="oled"><canvas ${index===0?'id="oledCanvas" ':''}class="oled-canvas" width="128" height="64" aria-label="OLED 128 by 64 preview"></canvas><div class="demo-grow">${head}<span class="sensor-primary">Live OLED Preview</span><span class="sensor-secondary" data-role="oled-label">SDA ${sp.sda} · SCL ${sp.scl} · 0x${Number(sp.address).toString(16).toUpperCase()}</span></div></div>`;
    if(sp.type==="analog")return `<div class="demo-card hardware-card" data-hw-key="${key}" data-hw-type="analog"><div class="pot-knob"><div class="pot-needle" data-role="pot-needle"></div></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="analog-label">-- / 255</span><div class="analog-bar"><i data-role="analog-fill"></i></div><span class="sensor-secondary" data-role="analog-detail">GPIO${sp.pin}</span></div></div>`;
    if(sp.type==="digital")return `<div class="demo-card hardware-card" data-hw-key="${key}" data-hw-type="digital"><div class="switch-visual" data-role="switch-visual"><i></i></div><div class="demo-grow">${head}<span class="sensor-primary switch-state-text" data-role="switch-label">WAITING</span><span class="sensor-secondary">GPIO${sp.pin}</span></div></div>`;
    if(sp.type==="rotary")return `<div class="demo-card hardware-card" data-hw-key="${key}" data-hw-type="rotary"><div class="rotary-visual"><div class="rotary-dial" data-role="rotary-dial"></div><div class="rotary-press" data-role="rotary-press"></div></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="rotary-label">Position 0</span><span class="sensor-secondary" data-role="rotary-detail">CLK ${sp.clk} · DT ${sp.dt}${sp.sw>=0?` · SW ${sp.sw}`:""}</span></div></div>`;
    if(sp.type==="motor")return `<div class="demo-card hardware-card" data-hw-key="${key}" data-hw-type="motor"><div class="motor-visual" data-role="motor-visual">M</div><div class="demo-grow">${head}<span class="sensor-primary" data-role="motor-label">Stopped</span><div class="analog-bar"><i data-role="motor-fill"></i></div><span class="sensor-secondary">Motor ID ${sp.id}</span></div></div>`;
    if(sp.type==="servo")return `<div class="demo-card hardware-card" data-hw-key="${key}" data-hw-type="servo"><div class="servo-visual"><i data-role="servo-needle"></i></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="servo-label">90°</span><span class="sensor-secondary">${sp.pin!=null?`GPIO${sp.pin}`:`Servo ID ${sp.id}`}</span></div></div>`;
    if(sp.type==="gps")return `<div class="demo-card hardware-card sensor-studio-card gps-card" data-hw-key="${key}" data-hw-type="gps"><div class="studio-icon gps-icon">⌖<i></i></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="gps-fix">NO FIX · 0 SAT</span><span class="sensor-secondary" data-role="gps-coords">Latitude — · Longitude —</span><div class="studio-meter"><i data-role="gps-meter"></i></div></div></div>`;
    if(sp.type==="imu")return `<div class="demo-card hardware-card sensor-studio-card imu-card" data-hw-key="${key}" data-hw-type="imu"><div class="imu-scene"><div class="imu-cube" data-role="imu-cube"><i></i><b></b></div></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="imu-main">LEVEL · waiting</span><span class="sensor-secondary" data-role="imu-detail">Acc — · Gyro —</span></div></div>`;
    if(["light","soil","gas","voltage","sound","rain","water","temperature","bridge_analog"].includes(sp.type))return `<div class="demo-card hardware-card sensor-studio-card" data-hw-key="${key}" data-hw-type="${sp.type}"><div class="studio-icon ${sp.type}-icon">${({light:"☀",soil:"♒",gas:"◌",voltage:"⚡",sound:"♪",rain:"☂",water:"≈",temperature:"℃",bridge_analog:"A"})[sp.type]}</div><div class="demo-grow">${head}<span class="sensor-primary" data-role="studio-value">WAITING</span><div class="studio-meter"><i data-role="studio-fill"></i></div><span class="sensor-secondary" data-role="studio-detail">${escapeHtml(sp.detail||"")}</span></div></div>`;
    if(["motion","reed","touch","flame","bridge_input"].includes(sp.type))return `<div class="demo-card hardware-card sensor-studio-card" data-hw-key="${key}" data-hw-type="${sp.type}"><div class="studio-icon digital-studio-icon" data-role="digital-studio-icon">${({motion:"◉",reed:"⊣",touch:"☝",flame:"♨",bridge_input:"I"})[sp.type]}</div><div class="demo-grow">${head}<span class="sensor-primary" data-role="digital-studio-value">WAITING</span><span class="sensor-secondary">${escapeHtml(sp.detail||"")}</span></div></div>`;
    if(["flow","rpm","counter","pulse"].includes(sp.type))return `<div class="demo-card hardware-card sensor-studio-card" data-hw-key="${key}" data-hw-type="${sp.type}"><div class="studio-icon pulse-icon" data-role="pulse-icon">↻</div><div class="demo-grow">${head}<span class="sensor-primary" data-role="pulse-value">WAITING</span><span class="sensor-secondary" data-role="pulse-detail">${escapeHtml(sp.detail||"")}</span></div></div>`;
    if(sp.type==="buzzer")return `<div class="demo-card hardware-card sensor-studio-card" data-hw-key="${key}" data-hw-type="buzzer"><div class="studio-icon buzzer-icon" data-role="buzzer-icon">◖))</div><div class="demo-grow">${head}<span class="sensor-primary" data-role="buzzer-value">OFF</span><div class="studio-meter"><i data-role="buzzer-fill"></i></div><span class="sensor-secondary">GPIO${sp.pin}</span></div></div>`;
    if(sp.type==="digital_output"||sp.type==="relay"||sp.type==="pwm_output")return `<div class="demo-card hardware-card sensor-studio-card" data-hw-key="${key}" data-hw-type="${sp.type}"><div class="studio-icon output-icon" data-role="output-icon">${sp.type==="relay"?"⏻":"⇥"}</div><div class="demo-grow">${head}<span class="sensor-primary" data-role="output-value">OFF</span><div class="studio-meter"><i data-role="output-fill"></i></div><span class="sensor-secondary">${escapeHtml(sp.detail||"")}</span></div></div>`;
    if(sp.type==="joystick")return `<div class="demo-card hardware-card sensor-studio-card" data-hw-key="${key}" data-hw-type="joystick"><div class="joystick-pad"><i data-role="joystick-stick"></i></div><div class="demo-grow">${head}<span class="sensor-primary" data-role="joystick-value">X — · Y —</span><span class="sensor-secondary" data-role="joystick-detail">ADC ${sp.xPin}/${sp.yPin}${sp.sw>=0?` · SW ${sp.sw}`:""}</span></div></div>`;
    if(["i2c","uart","spi"].includes(sp.type))return `<div class="demo-card hardware-card bridge-card bus-card" data-hw-key="${key}" data-hw-type="${sp.type}"><div class="bridge-icon">${sp.type==="i2c"?"I²C":sp.type==="uart"?"TX":"SPI"}</div><div class="demo-grow">${head}<span class="sensor-primary" data-role="bus-label">READY</span><span class="sensor-secondary">${escapeHtml(sp.detail||"Universal hardware interface")}</span></div></div>`;
    if(sp.type==="bridge")return `<div class="demo-card hardware-card bridge-card" data-hw-key="${key}" data-hw-type="bridge"><div class="bridge-icon">↔</div><div class="demo-grow">${head}<span class="sensor-primary" data-role="bridge-label">READY</span><span class="sensor-secondary">${escapeHtml(sp.detail||"Universal hardware interface")}</span></div></div>`;
    return "";
  }

  function findHardwareCard(sp){
    return [...document.querySelectorAll("#sensorGrid .hardware-card")].find(el=>el.dataset.hwKey===sp.key)||null;
  }

  function renderHardwareCards(src){
    const grid=$("sensorGrid");if(!grid)return;
    const cards=detectHardwareCards(src);
    const signature=JSON.stringify(cards.map(x=>[x.key,x.className,x.variable,x.identity]));
    if(signature===hardwareLayoutSignature)return;
    hardwareLayoutSignature=signature;activeHardwareCards=cards;
    grid.innerHTML=cards.map((sp,i)=>hardwareCardHtml(sp,i)).join("");
    initOledPreview();updateSensorGraphics();renderCustomDashboardCards();
    // Re-apply current per-output RGB states after a layout refresh.
    if(sensorState.rgbOutputs)Object.values(sensorState.rgbOutputs).forEach(updateRgbCommand);else if(sensorState.rgb)updateRgb(sensorState.rgb.r,sensorState.rgb.g,sensorState.rgb.b);
    if(sensorState.special?.tm1637)Object.values(sensorState.special.tm1637).forEach(paintTM1637);
    if(sensorState.special?.lcd1602)Object.values(sensorState.special.lcd1602).forEach(paintLCD1602);
  }

  function scheduleHardwareCards(src){
    clearTimeout(hardwareLayoutTimer);
    hardwareLayoutTimer=setTimeout(()=>renderHardwareCards(src),90);
  }
  async function refreshInputsFromKit(src,showError=false){
    if(prefs.demoMode)return true;
    if(!kitClient?.connected)return false;
    const specs=requestedInputs(src);let networkOk=true;
    const readOne=async(label,fn,onError)=>{
      try{const d=await fn();updateSensorPacket(d);return true;}
      catch(e){
        const msg=String(e?.message||e);if(typeof onError==="function")onError(e);
        if(e?.status>=400&&e?.status<500){if(showError)log(`${label}: ${msg}`);return true;}
        networkOk=false;if(showError)log(`${label}: ${msg}`);return false;
      }
    };
    for(const a of specs.analog)await readOne(`Analog GPIO${a.pin}`,()=>kitClient.analog(a.pin),e=>updateSensorPacket({sensor:"ANALOG",pin:a.pin,valid:false,message:String(e?.message||e)}));
    for(const sw of specs.digital)await readOne(`Digital GPIO${sw.pin}`,()=>kitClient.digital(sw.pin,{pullup:sw.pullup,activeLow:sw.activeLow}),e=>updateSensorPacket({sensor:"DIGITAL",pin:sw.pin,valid:false,message:String(e?.message||e)}));
    for(const r of specs.rotary)await readOne(`Rotary ${r.clk}/${r.dt}`,()=>kitClient.rotary(r.clk,r.dt,r.sw,{pullup:r.pullup}),e=>updateSensorPacket({sensor:"ROTARY",clk:r.clk,dt:r.dt,sw:r.sw,valid:false,message:String(e?.message||e)}));
    for(const u of specs.ultrasonic)await readOne(`Ultrasonic ${u.trig}/${u.echo}`,()=>kitClient.ultrasonic(u.trig,u.echo,{maxCm:u.maxCm}),e=>updateSensorPacket({sensor:"ULTRASONIC",trig:u.trig,echo:u.echo,valid:false,maxCm:u.maxCm,message:String(e?.message||e)}));
    for(const dht of specs.dht11)await readOne(`DHT11 GPIO${dht.pin}`,()=>kitClient.dht11(dht.pin),e=>updateSensorPacket({sensor:"DHT11",pin:dht.pin,valid:false,message:String(e?.message||e)}));

    // Prefetch direct Universal Bridge sensor classes so their first Python read is real, not an empty one-cycle cache.
    const cards=detectHardwareCards(src),seen=new Set();
    for(const sp of cards){
      if(["light","soil","gas","voltage","sound","rain","water","temperature","bridge_analog"].includes(sp.type)&&sp.pin!=null){
        const k=`adc:${sp.pin}`;if(seen.has(k))continue;seen.add(k);await readOne(`ADC GPIO${sp.pin}`,async()=>{const d=await kitClient.adc(sp.pin);updateBridgeState("adc",k,{...d,valid:true,simulated:false});return {sensor:"BRIDGE_PREFETCH"};});
      }else if(["motion","reed","touch","flame","bridge_input"].includes(sp.type)&&sp.pin!=null){
        const k=`gpio:${sp.pin}`;if(seen.has(k))continue;seen.add(k);const mode=sp.className==="ReedSwitch"?"pullup":"input";await readOne(`GPIO${sp.pin}`,async()=>{const d=await kitClient.gpioRead(sp.pin,{mode});updateBridgeState("gpio",k,{...d,valid:true,simulated:false});return {sensor:"BRIDGE_PREFETCH"};});
      }else if(sp.type==="joystick"){
        for(const pin of [sp.xPin,sp.yPin]){const k=`adc:${pin}`;if(seen.has(k))continue;seen.add(k);await readOne(`Joystick ADC GPIO${pin}`,async()=>{const d=await kitClient.adc(pin);updateBridgeState("adc",k,{...d,valid:true,simulated:false});return {sensor:"BRIDGE_PREFETCH"};});}
      }else if(["counter","flow","rpm"].includes(sp.type)&&sp.pin!=null){
        const k=`counter:${sp.pin}:rising`;if(seen.has(k))continue;seen.add(k);await readOne(`Counter GPIO${sp.pin}`,async()=>{const d=await kitClient.counter({op:"read",pin:sp.pin,edge:"rising",pullup:false});updateBridgeState("counter",k,{...d,valid:true,simulated:false});return {sensor:"BRIDGE_PREFETCH"};});
      }else if(sp.type==="pulse"&&sp.pin!=null){
        const k=`pulse:${sp.pin}:1`;if(seen.has(k))continue;seen.add(k);await readOne(`Pulse GPIO${sp.pin}`,async()=>{const d=await kitClient.pulse({op:"frequency",pin:sp.pin,state:1,timeoutUs:100000});updateBridgeState("pulse",k,{...d,valid:true,simulated:false});return {sensor:"BRIDGE_PREFETCH"};});
      }
    }
    if(networkOk)markKitSuccess(kitClient.status);
    return networkOk;
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
    sensorState.simulationMode=!!prefs.demoMode||!kitClient?.connected;
    worker.postMessage({
      type:"run",
      code,
      liveSessionId,
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
      sensorState.dhtTemperature=Number(prefs.demoDhtTemp)||28;sensorState.dhtHumidity=Number(prefs.demoDhtHumidity)||65;
      sensorState.potValue=Math.max(0,Math.min(255,Number(prefs.demoPot)||0));
      sensorState.potRaw=Math.round(sensorState.potValue*4095/255);
      updateSensorGraphics();
    }
    if(!prefs.demoMode&&kitClient?.connected&&/\b(?:TM1637|LCD1602|DHT11|AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder|Ultrasonic|GPIOInput|ADC|I2C|I2CDevice|UART|SPI|PulseInput|CounterInput|HardwareTransaction|GPS|MPU6050|LDR|SoilMoisture|GasSensor|VoltageSensor|SoundSensor|RainSensor|WaterLevelSensor|Thermistor|PIRSensor|ReedSwitch|TouchSensor|FlameSensor|FlowSensor|RPMSensor|Buzzer|Joystick)\s*\(/.test(liveCode)){
      const ok=await refreshInputsFromKit(liveCode,false);if(!ok)scheduleSilentReconnect();
    }else if(!prefs.demoMode&&!kitClient?.connected){scheduleSilentReconnect();}
    const frame=await refreshLiveAI();
    if(!liveMode||!running)return;
    postProgramToWorker(liveCode,frame);
  }


  function ensureCvFloatWindow(){ return null; }
  function showCvFloatingImage(frame,title="OpenCV Image"){ return; }
  function showCvFloatingUrl(url,title="OpenCV Image"){ return; }



  async function runCode(){
    customDashboardCards.clear();renderCustomDashboardCards();
    if(running){log("Program already running. Press Stop first.");return;}

    const src=getCode();
    renderHardwareCards(src);
    clearEditorIssue();
    const lint=await requestLint(src,true);
    if(!lint.ok){
      terminal.textContent="";
      log(`${lint.errorType} · line ${lint.line}: ${lint.message}`);
      if(lint.suggestion)log("Suggestion: "+lint.suggestion);
      badge($("pythonStatus"),"Fix code error","warn");
      return;
    }
    const needsPhysicalKit=/\b(?:RGBLED(?:\d+)?|LED(?:\d+)?|Motor|Servo|OLED|TM1637|LCD1602|DHT11|Ultrasonic|AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder|DigitalOutput|Relay|GPIOInput|ADC|PWM|PWMServo|MotorDriver|I2C|I2CDevice|UART|SPI|PulseInput|PulseOutput|CounterInput|HardwareTransaction|GPS|MPU6050|LDR|SoilMoisture|GasSensor|VoltageSensor|SoundSensor|RainSensor|WaterLevelSensor|Thermistor|PIRSensor|ReedSwitch|TouchSensor|FlameSensor|FlowSensor|RPMSensor|Buzzer|Joystick)\s*\(/.test(src);
    currentRunNeedsKit=needsPhysicalKit;
    const inputSpecs=requestedInputs(src),rgbPins=requestedRgbPins(src);
    const inputPins=[...inputSpecs.analog.map(x=>x.pin),...inputSpecs.digital.map(x=>x.pin),...inputSpecs.rotary.flatMap(x=>[x.clk,x.dt,...(x.sw>=0?[x.sw]:[])]),...inputSpecs.ultrasonic.flatMap(x=>[x.trig,x.echo]),...inputSpecs.dht11.map(x=>x.pin)];
    const conflict=inputPins.find(pin=>rgbPins.includes(pin));
    if(conflict!==undefined){terminal.textContent="";log(`Pin conflict: GPIO${conflict} is selected for both an input and RGB output.`);badge($("pythonStatus"),"Pin conflict","warn");return;}
    const seenPins=new Set(),duplicateInput=inputPins.find(pin=>seenPins.has(pin)?true:(seenPins.add(pin),false));
    if(duplicateInput!==undefined){terminal.textContent="";log(`Pin conflict: GPIO${duplicateInput} is assigned to more than one input device.`);badge($("pythonStatus"),"Pin conflict","warn");return;}
    let physicalKitAvailable=!!kitClient?.connected;
    if(needsPhysicalKit&&!prefs.demoMode&&!physicalKitAvailable){
      physicalKitAvailable=await ensureKitConnected(false,{silent:true});
      if(!physicalKitAvailable){log("Kit not connected — Offline Simulation is active. Python and Kit Output / Sensors will run; physical hardware will resume after reconnect.");badge($("kitStatus"),"Simulation · kit offline","warn");}
    }
    const needsHand=/\bzebjus_ai\b|\bHandDetector\b|\bHandTrackingModule\b|\bhandDetector\s*\(/.test(src);
    const needsFace=/\bFaceDetector\b|\bFaceDetectionModule\b|\bface_detection\b|\bmp\.solutions\.face_detection\b/.test(src);
    const needsCamera=needsHand||needsFace||/\bCamera\s*\(|\bcv2\.VideoCapture\s*\(/.test(src);
    const idx=requestedCamera(src);
    const requestedIdx=idx!==null?idx:(Number(prefs.cameraIndex)||0);

    terminal.textContent="";clearPlotter();
    running=true;liveSessionId++;updateRunControls();
    liveMode=/\bwhile\s+True\s*:/.test(src)&&(needsCamera||/\bSerialObject\b|\bWifiBridge\b|\b(?:TM1637|LCD1602|DHT11|AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder|Ultrasonic|GPIOInput|ADC|I2C|I2CDevice|UART|SPI|PulseInput|CounterInput|HardwareTransaction|GPS|MPU6050|LDR|SoilMoisture|GasSensor|VoltageSensor|SoundSensor|RainSensor|WaterLevelSensor|Thermistor|PIRSensor|ReedSwitch|TouchSensor|FlameSensor|FlowSensor|RPMSensor|Buzzer|Joystick)\s*\(/.test(src));
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
      sensorState.dhtTemperature=Number(prefs.demoDhtTemp)||28;sensorState.dhtHumidity=Number(prefs.demoDhtHumidity)||65;
      sensorState.potValue=Math.max(0,Math.min(255,Number(prefs.demoPot)||0));
      sensorState.potRaw=Math.round(sensorState.potValue*4095/255);
      updateSensorGraphics();
    }

    if(needsPhysicalKit&&!prefs.demoMode&&kitClient?.connected){
      try{
        await beginHardwareRun();
        if(/\b(?:TM1637|LCD1602|DHT11|AnalogInput|Potentiometer|DigitalInput|Switch|RotaryEncoder|Ultrasonic|GPIOInput|ADC|I2C|I2CDevice|UART|SPI|PulseInput|CounterInput|HardwareTransaction|GPS|MPU6050|LDR|SoilMoisture|GasSensor|VoltageSensor|SoundSensor|RainSensor|WaterLevelSensor|Thermistor|PIRSensor|ReedSwitch|TouchSensor|FlameSensor|FlowSensor|RPMSensor|Buzzer|Joystick)\s*\(/.test(src))await refreshInputsFromKit(src,false);
      }
      catch(e){currentRunUsesKit=false;log("Physical kit session unavailable — continuing in Offline Simulation: "+(e?.message||e));scheduleSilentReconnect();}
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
    if(kitClient){kitClient.name=prefs.kitName;kitClient.ipHint=prefs.kitIp||"";kitClient.chipId=prefs.kitChipId||"";kitClient.token=String(prefs.kitToken||"");}
    if($("kitNameText"))$("kitNameText").textContent=prefs.kitName||"No kit selected";
  }

  function clearSimulatedSensorState(){
    for(const group of Object.values(sensorState.inputs||{}))for(const [k,v] of Object.entries(group||{}))if(v?.simulated)delete group[k];
    for(const group of Object.values(sensorState.bridge||{}))for(const [k,v] of Object.entries(group||{}))if(v?.simulated)delete group[k];
    for(const [k,v] of Object.entries(sensorState.special||{}))if(String(v?.Mode||"").toUpperCase()==="SIMULATION"||v?.simulated)delete sensorState.special[k];
  }
  function markKitSuccess(st=null){
    if(sensorState.simulationMode)clearSimulatedSensorState();sensorState.simulationMode=false;
    const recovered=kitFailureCount>0;kitFailureCount=0;kitEverConnected=true;kitCommandErrorShown=false;if(recovered)debugEvent("kit-recovered","Local kit response restored",{base:kitClient?.base||""});
    if(st)persistKitIdentity(st);
    if(!prefs.demoMode)badge($("kitStatus"),"Kit connected","ok");
    for(const [key,q] of displayHardwareQueues){
      // A healthy status/heartbeat only resumes queues paused by a LAN transport miss.
      // Device faults (for example LCD address/wiring NACK) use their own cooldown and must not flood reconnect/run-start.
      if(q.pauseReason==="transport"){q.paused=false;q.pauseReason="";if(q.latest||q.pending?.length)runDisplayHardwareQueue(key,q);}
    }
  }

  function markKitFailure(reason=""){
    kitFailureCount=Math.min(KIT_FAILURE_LIMIT,kitFailureCount+1);debugEvent("kit-miss",`Local kit response missed (${kitFailureCount}/${KIT_FAILURE_LIMIT})`,{reason,lastGoodAgeMs:Number.isFinite(kitClient?.lastGoodAgeMs)?Math.round(kitClient.lastGoodAgeMs):null});
    if(kitEverConnected&&kitFailureCount<KIT_FAILURE_LIMIT){
      // Stable-link hysteresis: 1–4 local HTTP misses keep the cached kit session alive.
      // Do not switch Python to simulation, clear the cached IP, or blink the UI.
      return false;
    }
    if(kitFailureCount>=KIT_FAILURE_LIMIT){
      sensorState.simulationMode=true;
      for(const q of displayHardwareQueues.values())q.paused=true;
      if(kitClient?.connected)kitClient.disconnect({forgetIdentity:false});
    }
    badge($("kitStatus"),"Kit disconnected");
    if(kitFailureCount===KIT_FAILURE_LIMIT&&reason&&!kitCommandErrorShown){
      log("Kit connection lost after 5 consecutive checks. Python continues in Simulation; background reconnect keeps the cached kit identity/IP and restores physical output automatically.");
      kitCommandErrorShown=true;
    }
    return true;
  }

  async function resumeRunSessionAfterReconnect(){
    if(!running||!currentRunUsesKit)return;
    try{const t0=performance.now();await kitClient.pingRun();debugEvent("heartbeat","Heartbeat OK",{latencyMs:Math.round(performance.now()-t0)});markKitSuccess(kitClient.status);}
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
        if(running&&currentRunNeedsKit){await beginHardwareRun();}
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
    for(const q of displayHardwareQueues.values()){q.latest=null;if(q.pending)q.pending.length=0;}
    await flushDisplayHardwareQueues();
    const used=currentRunUsesKit;currentRunUsesKit=false;currentRunNeedsKit=false;
    const stopRgb={command:"RGB_LED_SET",id:1,r:0,g:0,b:0};
    if(used&&!prefs.demoMode&&kitClient?.connected){
      try{await kitClient.flushCommands();await kitClient.endRun();kitCommandErrorShown=false;}
      catch(e){if(!kitCommandErrorShown){log("Kit OFF error: "+(e?.message||e));kitCommandErrorShown=true;}}
    }
    for(const sp of activeHardwareCards.filter(x=>x.type==="rgb"))applyDemo({command:"RGB_LED_SET",id:Number((String(sp.token||"").match(/RGBLED(\d+)/)||[])[1]||1),rPin:sp.r,gPin:sp.g,bPin:sp.b,r:0,g:0,b:0});
    for(const sp of activeHardwareCards.filter(x=>x.type==="led"&&x.pin!=null))applyDemo({command:"LED_SET",pin:sp.pin,value:0});
    applyDemo({command:"MOTOR_SET",id:1,speed:0});
    for(const sp of activeHardwareCards.filter(x=>x.type==="tm1637"))applyDemo({command:"TM1637_SET",action:"clear",clk:sp.clk,dio:sp.dio,brightness:sp.brightness??7,segments:[0,0,0,0]});
    for(const sp of activeHardwareCards.filter(x=>x.type==="lcd1602"))applyDemo({command:"LCD1602_SET",action:"clear",bus:sp.bus,sda:sp.sda,scl:sp.scl,address:sp.address,backlight:true});
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
    log("Stopped. Outputs are safe; TM1637/LCD/OLED animations are stopped.");
  }

  function updateSensorGraphics(){
    for(const sp of activeHardwareCards){
      const card=findHardwareCard(sp);if(!card)continue;
      const role=n=>card.querySelector(`[data-role="${n}"]`);
      if(sp.type==="tm1637"){const d=sensorState.special?.tm1637?.[`${sp.clk},${sp.dio}`];if(d)paintTM1637(d);
      }else if(sp.type==="lcd1602"){const d=sensorState.special?.lcd1602?.[`${sp.bus}:${sp.address}`];if(d)paintLCD1602(d);
      }else if(sp.type==="analog"){
        const d=sensorState.inputs?.analog?.[String(sp.pin)]||{},hasData=Object.keys(d).length>0;
        const fallback=prefs.demoMode&&sp.pin===(sensorState.potPin||34);
        const value=Math.max(0,Math.min(255,Number(d.value255??d.value??(fallback?sensorState.potValue:0))||0));
        const raw=Number(d.raw??(fallback?sensorState.potRaw:Math.round(value*4095/255)))||0;
        const percent=Math.max(0,Math.min(100,Number(d.percent??Math.round(value*100/255))||0));
        const invalid=hasData&&d.valid===false,simulation=!!d.simulated;
        if(role("analog-label"))role("analog-label").textContent=invalid?"READ ERROR":(!hasData?"WAITING":`${value} / 255 · ${percent}%`);
        if(role("analog-detail"))role("analog-detail").textContent=!hasData?`GPIO${sp.pin} · waiting`:`GPIO${sp.pin} · raw ${raw}${d.millivolts!==undefined?` · ${Number(d.millivolts)} mV`:""}${simulation?" · SIMULATION":""}`;
        if(role("pot-needle"))role("pot-needle").style.transform=`rotate(${-135+(value/255)*270}deg)`;
        if(role("analog-fill"))role("analog-fill").style.width=percent+"%";
        card.classList.toggle("live",hasData&&d.valid!==false);card.classList.toggle("sensor-error",hasData&&d.valid===false);
      }else if(sp.type==="digital"){
        const d=sensorState.inputs?.digital?.[String(sp.pin)]||{};
        const active=!!d.active,state=Number(d.state??(active?1:0));
        if(role("switch-visual"))role("switch-visual").classList.toggle("active",active);
        if(role("switch-label")){role("switch-label").textContent=d.valid===false?"READ ERROR":(Object.keys(d).length?(active?"ACTIVE / PRESSED":"RELEASED")+(d.simulated?" · SIM":""):"WAITING");role("switch-label").style.color=active?"#62e9a2":"";}
        card.classList.toggle("live",Object.keys(d).length>0&&d.valid!==false);card.classList.toggle("sensor-error",d.valid===false);
      }else if(sp.type==="rotary"){
        const key=`${sp.clk},${sp.dt},${sp.sw}`,d=sensorState.inputs?.rotary?.[key]||{};
        const pos=Number(d.position??0),delta=Number(d.delta??0),dir=String(d.direction||"NONE"),pressed=!!d.pressed;
        if(role("rotary-dial"))role("rotary-dial").style.transform=`rotate(${pos*18}deg)`;
        if(role("rotary-press"))role("rotary-press").classList.toggle("active",pressed);
        if(role("rotary-label"))role("rotary-label").textContent=d.valid===false?"READ ERROR":`Position ${pos} · ${dir}${d.simulated?" · SIM":""}`;
        if(role("rotary-detail"))role("rotary-detail").textContent=`Δ${delta} · CLK ${sp.clk} · DT ${sp.dt}${sp.sw>=0?` · SW ${pressed?"pressed":"released"}`:""}`;
        card.classList.toggle("live",Object.keys(d).length>0&&d.valid!==false);card.classList.toggle("sensor-error",d.valid===false);
      }else if(sp.type==="ultrasonic"){
        const key=`${sp.trig},${sp.echo}`,data=sensorState.inputs?.ultrasonic?.[key]||{},hasData=Object.keys(data).length>0,simulation=!!data.simulated;
        const rawDistance=data.distanceCm??data.ultrasonicCm,hasValue=hasFiniteValue(rawDistance),valid=data.valid!==false&&hasValue,stale=!!data.stale&&hasValue,hardError=hasData&&!valid&&!stale;
        const d=hasValue?Math.max(0,Number(rawDistance)):0,max=Math.max(1,Number(data.maxCm??sp.maxCm)||400),pct=Math.min(100,d/max*100);
        if(role("ultra-label"))role("ultra-label").textContent=hardError?"READ ERROR":(!hasData?"WAITING":`${d.toFixed(1)} cm${simulation?" · SIM":""}`);
        if(role("ultra-fill"))role("ultra-fill").style.width=(hasValue?pct:0)+"%";
        if(role("ultra-beam")){role("ultra-beam").style.transform=`scaleX(${hasValue?Math.max(.18,pct/100):.18})`;role("ultra-beam").style.opacity=String(hasValue?.35+.65*Math.min(1,pct/100):.2);}
        card.classList.toggle("live",(valid||stale||simulation)&&!hardError);card.classList.toggle("sensor-error",hardError);
      }else if(sp.type==="dht11"){
        const data=sensorState.inputs?.dht11?.[String(sp.pin)]||{},hasData=Object.keys(data).length>0,simulation=!!data.simulated;
        const hasValues=hasFiniteValue(data.temperature)&&hasFiniteValue(data.humidity),valid=data.valid!==false&&hasValues,stale=!!data.stale&&hasValues,hardError=hasData&&!valid&&!stale;
        const t=hasValues?Number(data.temperature):0,h=hasValues?Math.max(0,Math.min(100,Number(data.humidity))):0;
        if(role("dht-main"))role("dht-main").textContent=hardError?"READ ERROR":(!hasData?"WAITING":`${t.toFixed(1)} °C · ${h.toFixed(1)} %RH`);
        if(role("dht-detail")){const why=String(data.error||"").trim();let suffix=simulation?" · SIMULATION":(stale?" · STALE":(hardError?` · ${why?why.toUpperCase():"NO RESPONSE"}`:" · HARDWARE"));role("dht-detail").textContent=`DATA GPIO${sp.pin}${suffix}`;role("dht-detail").title=String(data.message||"");}
        if(role("temp-fill"))role("temp-fill").style.height=hasValues?Math.max(4,Math.min(100,t/50*100))+"%":"4%";
        if(role("hum-fill"))role("hum-fill").style.height=(hasValues?h:0)+"%";
        if(role("hum-mini"))role("hum-mini").textContent=hardError?"ERR":(hasValues?Math.round(h)+"%":"—");
        card.classList.toggle("live",(valid||stale||simulation)&&!hardError);card.classList.toggle("sensor-error",hardError);
      }else if(["light","soil","gas","voltage","sound","rain","water","temperature","bridge_analog"].includes(sp.type)){
        const d=sensorState.bridge?.adc?.[`adc:${sp.pin}`]||{},raw=Math.max(0,Math.min(4095,Number(d.raw??0)||0)),pct=Math.max(0,Math.min(100,raw*100/4095)),mv=Math.max(0,Number(d.millivolts??0)||0),has=Object.keys(d).length>0;
        const labelMap={light:`${Math.round(pct)}% light`,soil:`${Math.round(pct)}% moisture`,gas:`${Math.round(pct)}% level`,voltage:mv?`${(mv/1000).toFixed(2)} V`:`${Math.round(pct)}%`,sound:`${Math.round(pct)}% sound`,rain:`${Math.round(pct)}% wet`,water:`${Math.round(pct)}% level`,temperature:`${Math.round(pct)}% raw`,bridge_analog:`${raw} raw`};
        if(role("studio-value"))role("studio-value").textContent=has?`${labelMap[sp.type]}${d.simulated?" · SIM":""}`:"WAITING";if(role("studio-fill"))role("studio-fill").style.width=pct+"%";if(role("studio-detail"))role("studio-detail").textContent=`ADC GPIO${sp.pin}${has?` · ${raw} · ${mv} mV`:""}`;card.classList.toggle("live",has);
      }else if(["motion","reed","touch","flame","bridge_input"].includes(sp.type)){
        const d=sensorState.bridge?.gpio?.[`gpio:${sp.pin}`]||{},has=Object.keys(d).length>0,state=!!Number(d.value??0),labels={motion:state?"MOTION":"CLEAR",reed:state?"OPEN / HIGH":"CLOSED / LOW",touch:state?"TOUCHED":"IDLE",flame:state?"DETECTED":"CLEAR",bridge_input:state?"HIGH":"LOW"};
        if(role("digital-studio-value"))role("digital-studio-value").textContent=has?`${labels[sp.type]}${d.simulated?" · SIM":""}`:"WAITING";if(role("digital-studio-icon"))role("digital-studio-icon").classList.toggle("active",has&&state);card.classList.toggle("live",has&&state);
      }else if(["flow","rpm","counter","pulse"].includes(sp.type)){
        const all=sp.type==="pulse"?(sensorState.bridge?.pulse||{}):(sensorState.bridge?.counter||{});const d=Object.entries(all).find(([k])=>k.includes(`:${sp.pin}:`)||k===`counter:${sp.pin}`)?.[1]||{},hz=Number(d.hz??0)||0,count=Number(d.count??0)||0,has=Object.keys(d).length>0;
        const special=sensorState.special?.[sp.type==="flow"?"flow sensor":sp.type==="rpm"?"rpm sensor":""]||{};let sim=!!d.simulated;let main=sp.type==="flow"&&special.Flow_L_min!==undefined?`${Number(special.Flow_L_min).toFixed(2)} L/min`:sp.type==="rpm"&&special.RPM!==undefined?`${Number(special.RPM).toFixed(0)} RPM`:has?`${hz.toFixed(2)} Hz`:"WAITING";
        if(role("pulse-value"))role("pulse-value").textContent=main+(sim?" · SIM":"");if(role("pulse-detail"))role("pulse-detail").textContent=`GPIO${sp.pin}${has?` · count ${count}`:""}`;if(role("pulse-icon"))role("pulse-icon").style.transform=`rotate(${(Date.now()/18)*(hz?1:0)}deg)`;card.classList.toggle("live",has||!!Object.keys(special).length);
      }else if(sp.type==="digital_output"||sp.type==="relay"){
        const d=sensorState.bridge?.gpio?.[`gpio:${sp.pin}`]||{},has=Object.keys(d).length>0,on=!!Number(d.value??0);if(role("output-value"))role("output-value").textContent=has?(on?"ON / HIGH":"OFF / LOW"):"OFF";if(role("output-fill"))role("output-fill").style.width=on?"100%":"0%";if(role("output-icon"))role("output-icon").classList.toggle("active",on);card.classList.toggle("live",on);
      }else if(sp.type==="pwm_output"){
        const d=sensorState.bridge?.pwm?.[`pwm:${sp.pin}`]||{},duty=Math.max(0,Number(d.duty??0)||0),bits=Math.max(1,Number(d.resolution??8)||8),pct=Math.min(100,duty/((1<<Math.min(bits,16))-1)*100),has=Object.keys(d).length>0;if(role("output-value"))role("output-value").textContent=has?`${Math.round(pct)}% PWM`:"OFF";if(role("output-fill"))role("output-fill").style.width=pct+"%";card.classList.toggle("live",pct>0);
      }else if(sp.type==="buzzer"){
        const u=sensorState.special?.[`buzzer:${sp.pin}`]||{},d=sensorState.bridge?.pwm?.[`pwm:${sp.pin}`]||{},active=(Number(u.frequency)||Number(d.duty)||0)>0,f=Number(u.frequency||d.frequency||0),vol=Number(u.volume??0);if(role("buzzer-value"))role("buzzer-value").textContent=active?`${Math.round(f)} Hz${vol?` · ${Math.round(vol)}%`:""}`:"OFF";if(role("buzzer-fill"))role("buzzer-fill").style.width=(active?Math.max(10,Math.min(100,vol||50)):0)+"%";if(role("buzzer-icon"))role("buzzer-icon").classList.toggle("active",active);card.classList.toggle("live",active);
      }else if(sp.type==="joystick"){
        const dx=sensorState.bridge?.adc?.[`adc:${sp.xPin}`]||{},dy=sensorState.bridge?.adc?.[`adc:${sp.yPin}`]||{},x=Number(dx.raw??2048),y=Number(dy.raw??2048),has=Object.keys(dx).length>0||Object.keys(dy).length>0,nx=Math.max(-1,Math.min(1,(x-2048)/2048)),ny=Math.max(-1,Math.min(1,(y-2048)/2048));if(role("joystick-stick"))role("joystick-stick").style.transform=`translate(${nx*22}px,${ny*22}px)`;if(role("joystick-value"))role("joystick-value").textContent=has?`X ${Math.round(x)} · Y ${Math.round(y)}`:"WAITING";card.classList.toggle("live",has);
      }else if(sp.type==="gps"){
        const d=sensorState.special?.gps||{},fix=d.Fix===true||String(d.Fix).toLowerCase()==="true",sat=Number(d.Satellites??0)||0,lat=d.Latitude,lon=d.Longitude,has=Object.keys(d).length>0;if(role("gps-fix"))role("gps-fix").textContent=has?`${fix?"FIX":"NO FIX"} · ${sat} SAT${String(d.Mode||"").toUpperCase()==="SIMULATION"?" · SIM":""}`:"WAITING FOR GPS";if(role("gps-coords"))role("gps-coords").textContent=(lat!=null&&lon!=null)?`${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}${d.Speed_kmh!==undefined?` · ${Number(d.Speed_kmh).toFixed(1)} km/h`:""}`:"Latitude — · Longitude —";if(role("gps-meter"))role("gps-meter").style.width=Math.min(100,sat/12*100)+"%";card.classList.toggle("live",has&&fix);
      }else if(sp.type==="imu"){
        const d=sensorState.special?.mpu6050||{},ax=Number(d.AccX??0),ay=Number(d.AccY??0),az=Number(d.AccZ??1),gx=Number(d.GyroX??0),gy=Number(d.GyroY??0),gz=Number(d.GyroZ??0),has=Object.keys(d).length>0,roll=Math.atan2(ay,az)*180/Math.PI,pitch=Math.atan2(-ax,Math.sqrt(ay*ay+az*az))*180/Math.PI;if(role("imu-cube"))role("imu-cube").style.transform=`rotateX(${pitch.toFixed(1)}deg) rotateZ(${-roll.toFixed(1)}deg)`;if(role("imu-main"))role("imu-main").textContent=has?`Roll ${roll.toFixed(1)}° · Pitch ${pitch.toFixed(1)}°${String(d.Mode||"").toUpperCase()==="SIMULATION"?" · SIM":""}`:"LEVEL · waiting";if(role("imu-detail"))role("imu-detail").textContent=has?`Acc ${ax.toFixed(2)},${ay.toFixed(2)},${az.toFixed(2)} · Gyro ${gx.toFixed(1)},${gy.toFixed(1)},${gz.toFixed(1)}`:"Acc — · Gyro —";card.classList.toggle("live",has);
      }else if(["i2c","uart","spi"].includes(sp.type)){
        const group=sp.type,all=sensorState.bridge?.[group]||{},vals=Object.values(all),has=vals.length>0,sim=has&&vals.every(x=>x?.simulated);if(role("bus-label"))role("bus-label").textContent=has?(sim?"SIMULATION":"ACTIVE"):"READY";card.classList.toggle("live",has);
      }
    }
  }

  function clearPlotter(){
    plotter.series.clear();plotter.seq=0;drawSerialPlotter();
  }
  function handlePlotPacket(m){
    let values={};try{values=m.json?JSON.parse(m.json):(m.values||{});}catch(_){values={};}
    const numeric=Object.entries(values).filter(([,v])=>Number.isFinite(Number(v)));
    if(!numeric.length)return;
    plotter.seq++;
    for(const [name,val] of numeric){
      if(!plotter.series.has(name))plotter.series.set(name,[]);
      const arr=plotter.series.get(name);arr.push({x:plotter.seq,y:Number(val)});if(arr.length>plotter.maxPoints)arr.splice(0,arr.length-plotter.maxPoints);
    }
    drawSerialPlotter();
  }
  function drawSerialPlotter(){
    const c=$("serialPlotterCanvas"),legend=$("serialPlotterLegend");if(!c||!legend)return;
    const ctx=c.getContext("2d"),w=c.width,h=c.height,padL=54,padR=16,padT=14,padB=30;
    ctx.clearRect(0,0,w,h);ctx.fillStyle="#070c15";ctx.fillRect(0,0,w,h);
    const series=[...plotter.series.entries()].filter(([,a])=>a.length);
    ctx.strokeStyle="#1d2a40";ctx.lineWidth=1;for(let i=0;i<=5;i++){const y=padT+(h-padT-padB)*i/5;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke();}
    if(!series.length){ctx.fillStyle="#75839d";ctx.font="24px system-ui";ctx.textAlign="center";ctx.fillText("plot(Temperature=t, Humidity=h)",w/2,h/2);legend.innerHTML="<span>No plot data yet</span>";return;}
    let ys=[];series.forEach(([,a])=>a.forEach(p=>ys.push(p.y)));let min=Math.min(...ys),max=Math.max(...ys);if(min===max){min-=1;max+=1;}const margin=(max-min)*.08;min-=margin;max+=margin;
    const colors=["#59a5ff","#ffb65c","#65d98b","#d58cff","#ff7082","#5de1da","#d9d35f","#a7b4cc"];
    ctx.fillStyle="#8290a9";ctx.font="18px ui-monospace,monospace";ctx.textAlign="right";for(let i=0;i<=5;i++){const y=padT+(h-padT-padB)*i/5,val=max-(max-min)*i/5;ctx.fillText(val.toFixed(Math.abs(max-min)<10?1:0),padL-8,y+6);}
    series.forEach(([name,a],idx)=>{const color=colors[idx%colors.length],n=Math.max(2,plotter.maxPoints);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();a.forEach((p,i)=>{const x=padL+(w-padL-padR)*(i/(n-1)),y=padT+(h-padT-padB)*(1-(p.y-min)/(max-min));if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();});
    legend.innerHTML=series.map(([name,a],idx)=>`<span class="plot-key" style="color:${colors[idx%colors.length]}"><i class="plot-dot"></i>${escapeHtml(name)} <span class="plot-value">${a[a.length-1].y.toFixed(2)}</span></span>`).join("");
  }

  function paintRgbCard(card,r,g,b){
    if(!card)return;r=Math.max(0,Math.min(255,+r||0));g=Math.max(0,Math.min(255,+g||0));b=Math.max(0,Math.min(255,+b||0));
    const led=card.querySelector('[data-role="rgb-led"]'),label=card.querySelector('[data-role="rgb-label"]'),glow=Math.max(r,g,b)>0?`0 0 22px rgba(${r},${g},${b},.82), inset 0 0 0 2px #ffffff66`:"inset 0 0 0 2px #4a5262";
    if(led){led.style.background=`rgb(${r},${g},${b})`;led.style.boxShadow=glow;}if(label)label.textContent=`R${r} G${g} B${b}`;card.classList.toggle("live",Math.max(r,g,b)>0);
  }
  function updateRgbCommand(p={}){
    const r=Math.max(0,Math.min(255,+p.r||0)),g=Math.max(0,Math.min(255,+p.g||0)),b=Math.max(0,Math.min(255,+p.b||0)),id=Number(p.id||1);
    sensorState.rgbOutputs=sensorState.rgbOutputs||{};const hasPins=[p.rPin,p.gPin,p.bPin].every(v=>v!==undefined&&v!==null),key=hasPins?`${Number(p.rPin)},${Number(p.gPin)},${Number(p.bPin)}`:`id:${id}`;sensorState.rgbOutputs[key]={...p,r,g,b,id};
    let matched=0;for(const sp of activeHardwareCards.filter(x=>x.type==="rgb")){
      const byPins=hasPins&&Number(sp.r)===Number(p.rPin)&&Number(sp.g)===Number(p.gPin)&&Number(sp.b)===Number(p.bPin);const tokenId=Number((String(sp.token||"").match(/RGBLED(\d+)/)||[])[1]||1),byId=!hasPins&&tokenId===id;
      if(byPins||byId){paintRgbCard(findHardwareCard(sp),r,g,b);matched++;}
    }
    if(!matched&&activeHardwareCards.filter(x=>x.type==="rgb").length===1)paintRgbCard(findHardwareCard(activeHardwareCards.find(x=>x.type==="rgb")),r,g,b);
  }
  function updateRgb(r,g,b){sensorState.rgb={r,g,b};for(const sp of activeHardwareCards.filter(x=>x.type==="rgb"))paintRgbCard(findHardwareCard(sp),r,g,b);}

  function initOledPreview(){
    const canvases=[...document.querySelectorAll(".oled-canvas")];
    if(!oledBuffer){
      oledBuffer=document.createElement("canvas");oledBuffer.width=128;oledBuffer.height=64;
      oledBufferCtx=oledBuffer.getContext("2d");oledBufferCtx.imageSmoothingEnabled=false;
      oledBufferCtx.fillStyle="#000";oledBufferCtx.fillRect(0,0,128,64);
    }
    commitOledPreview();
    return canvases.length>0;
  }
  function commitOledPreview(){
    if(!oledBufferCtx)return;
    document.querySelectorAll(".oled-canvas").forEach(canvas=>{
      const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=false;
      ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle="#000";ctx.fillRect(0,0,128,64);ctx.drawImage(oledBuffer,0,0);ctx.restore();
      canvas.classList.toggle("oled-invert",oledInverted);
    });
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
    if(cmd==="OLED_INIT"){document.querySelectorAll('[data-role="oled-label"]').forEach(el=>el.textContent=`SSD1306 · SDA ${p.sda??21} · SCL ${p.scl??22} · 0x${Number(p.address??60).toString(16).toUpperCase()}`);return;}
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
      oledInverted=p.enabled===true||p.enabled===1||p.enabled==="1"||p.enabled==="true";document.querySelectorAll(".oled-canvas").forEach(c=>c.classList.toggle("oled-invert",oledInverted));return;
    }else if(cmd==="OLED_CONTRAST"){document.querySelectorAll('[data-role="oled-label"]').forEach(el=>el.textContent=`OLED contrast ${Math.max(0,Math.min(255,Number(p.value)||0))}`);return;}
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

  function displayCardsByPins(type,attrs){
    const cards=[...document.querySelectorAll(`#sensorGrid .hardware-card[data-hw-type="${type}"]`)];
    const exact=cards.filter(card=>Object.entries(attrs).every(([k,v])=>String(card.dataset[k]??"")===String(v)));
    if(exact.length)return exact;
    // If source parsing was delayed or a constructor used expressions, a single card is still unambiguous.
    return cards.length===1?cards:[];
  }
  function normalizeSegmentArray(raw){
    if(Array.isArray(raw))return raw.slice(0,4).map(v=>Number(v)||0);
    if(raw&&typeof raw==="object"){
      try{return Array.from(raw).slice(0,4).map(v=>Number(v)||0);}catch(_){}
      const vals=Object.values(raw).slice(0,4);if(vals.length)return vals.map(v=>Number(v)||0);
    }
    return [0,0,0,0];
  }

  function tmSegmentBits(card,index,bits){
    const digit=card?.querySelector(`[data-role="tm-digit-${index}"]`);if(!digit)return;const names=["a","b","c","d","e","f","g"];
    names.forEach((name,bit)=>{const el=digit.querySelector(`.${name}`);if(el)el.classList.toggle("on",!!(Number(bits)&(1<<bit)));});const dp=digit.querySelector(".dp");if(dp)dp.classList.toggle("on",!!(Number(bits)&0x80));
  }
  function paintTM1637(p={}){
    const clk=Number(p.clk??13),dio=Number(p.dio??14),key=`${clk},${dio}`;sensorState.special=sensorState.special||{};sensorState.special.tm1637=sensorState.special.tm1637||{};sensorState.special.tm1637[key]={...sensorState.special.tm1637[key],...p,clk,dio};const state=sensorState.special.tm1637[key],seg=normalizeSegmentArray(state.segments);while(seg.length<4)seg.push(0);
    const cards=new Set();for(const sp of activeHardwareCards.filter(x=>x.type==="tm1637"&&Number(x.clk)===clk&&Number(x.dio)===dio)){const c=findHardwareCard(sp);if(c)cards.add(c);}for(const c of displayCardsByPins("tm1637",{tmClk:clk,tmDio:dio}))cards.add(c);
    for(const card of cards){for(let i=0;i<4;i++)tmSegmentBits(card,i,seg[i]||0);const colon=card.querySelector('[data-role="tm-colon"]');if(colon)colon.classList.toggle("on",!!(seg[1]&0x80));const label=card.querySelector('[data-role="tm-label"]'),detail=card.querySelector('[data-role="tm-detail"]');if(label){const shown=String(state.text??"").replace(/\s+$/g,"")||"----",mode=state.simulated?"SIMULATION":"KIT",effect=String(state.effect||"").toUpperCase();label.textContent=`${shown} · brightness ${Number(state.brightness??7)} · ${effect?effect+" · ":""}${mode}`;}if(detail)detail.textContent=`CLK ${clk} · DIO ${dio} · native driver${state.simulated?" · offline preview":""}`;card.dataset.effect=String(state.effect||"");card.classList.toggle("live",seg.some(v=>Number(v)&0x7F));}
  }
  function lcdBlank(){return " ".repeat(16);}
  function paintLCD1602(p={}){
    const bus=Number(p.bus??0)===1?1:0,address=Number(p.address??0x27),key=`${bus}:${address}`;sensorState.special=sensorState.special||{};sensorState.special.lcd1602=sensorState.special.lcd1602||{};const prev=sensorState.special.lcd1602[key]||{lines:[lcdBlank(),lcdBlank()],backlight:true,enabled:true,cursor:false,blink:false};let lines=Array.isArray(prev.lines)?prev.lines.slice(0,2):[lcdBlank(),lcdBlank()];while(lines.length<2)lines.push(lcdBlank());const action=String(p.action||"").toLowerCase();
    let cursorCol=Number(prev.cursorCol??0),cursorRow=Number(prev.cursorRow??0);
    if(action==="clear"){lines=[lcdBlank(),lcdBlank()];cursorCol=0;cursorRow=0;}else if(action==="home"){cursorCol=0;cursorRow=0;}else if(action==="cursor"){cursorCol=Math.max(0,Math.min(15,Number(p.col)||0));cursorRow=Math.max(0,Math.min(1,Number(p.row)||0));}else if(action==="write"){const row=Math.max(0,Math.min(1,Number(p.row)||0)),col=Math.max(0,Math.min(15,Number(p.col)||0)),text=String(p.text??"");const chars=lines[row].padEnd(16).slice(0,16).split("");for(let i=0;i<text.length&&col+i<16;i++)chars[col+i]=text[i];lines[row]=chars.join("");cursorRow=row;cursorCol=Math.max(0,Math.min(15,col+Math.min(text.length,16-col)));}
    const state={...prev,...p,bus,address,lines,cursorCol,cursorRow,backlight:p.backlight===undefined?prev.backlight:!!p.backlight,enabled:p.enabled===undefined?prev.enabled:!!p.enabled,cursor:p.cursor===undefined?prev.cursor:!!p.cursor,blink:p.blink===undefined?prev.blink:!!p.blink};sensorState.special.lcd1602[key]=state;
    const cards=new Set();for(const sp of activeHardwareCards.filter(x=>x.type==="lcd1602"&&Number(x.bus)===bus&&Number(x.address)===address)){const c=findHardwareCard(sp);if(c)cards.add(c);}for(const c of displayCardsByPins("lcd1602",{lcdBus:bus,lcdAddress:address}))cards.add(c);
    for(const card of cards){for(let r=0;r<2;r++){const el=card.querySelector(`[data-role="lcd-line-${r}"]`);if(el)el.textContent=(state.enabled===false?lcdBlank():lines[r]).padEnd(16).slice(0,16);}const screen=card.querySelector('[data-role="lcd-screen"]');if(screen){screen.classList.toggle("backlight-off",state.backlight===false);screen.classList.toggle("display-off",state.enabled===false);screen.classList.toggle("cursor-on",!!state.cursor);screen.classList.toggle("cursor-blink",!!state.cursor&&!!state.blink);}const cursorEl=card.querySelector('[data-role="lcd-cursor"]');if(cursorEl){cursorEl.style.transform=`translate(${Math.max(0,Math.min(15,Number(state.cursorCol)||0))*11.1}px,${Math.max(0,Math.min(1,Number(state.cursorRow)||0))*23.4}px)`;cursorEl.style.opacity=state.cursor&&state.enabled!==false?"1":"0";}card.dataset.effect=String(state.effect||"");const label=card.querySelector('[data-role="lcd-label"]');if(label){const mode=state.simulated?"SIM":"KIT",effect=String(state.effect||"").toUpperCase();const fault=String(state.hardwareError||"");label.textContent=fault?`16×2 LCD · DEVICE ERROR · ${mode}`:`16×2 LCD · ${effect?effect+" · ":""}${state.backlight===false?"BACKLIGHT OFF":"ACTIVE"} · ${mode}`;label.title=fault;}card.classList.add("live");}
  }

  function applyDemo(p){
    if(String(p.command||"").startsWith("BRIDGE_")){
      const map={BRIDGE_GPIO_READ:"gpio",BRIDGE_GPIO_WRITE:"gpio",BRIDGE_ADC_READ:"adc",BRIDGE_PWM_SET:"pwm",BRIDGE_I2C:"i2c",BRIDGE_UART:"uart",BRIDGE_SPI:"spi",BRIDGE_PULSE:"pulse",BRIDGE_COUNTER:"counter",BRIDGE_TRANSACTION:"transaction"},group=map[p.command]||"gpio",key=String(p.key||p.command),prev=sensorState.bridge?.[group]?.[key]||{},phase=Date.now()/1000+Number(p.pin||0)*.17;let d={ok:true,valid:true,simulated:true};
      if(p.command==="BRIDGE_GPIO_READ")d={...d,value:(Math.floor(phase/1.5)%2),pin:Number(p.pin)};
      if(p.command==="BRIDGE_GPIO_WRITE")d={...d,value:Number(p.value?1:0),safeValue:Number(p.safeValue?1:0),pin:Number(p.pin)};
      if(p.command==="BRIDGE_ADC_READ"){const raw=Math.max(0,Math.min(4095,Math.round(2048+1850*Math.sin(phase*.7))));d={...d,raw,millivolts:Math.round(raw*3300/4095),pin:Number(p.pin)};}
      if(p.command==="BRIDGE_PWM_SET")d={...d,pin:Number(p.pin),duty:Number(p.duty)||0,frequency:Number(p.frequency)||1000,resolution:Number(p.resolution)||8,safeDuty:Number(p.safeDuty)||0};
      if(p.command==="BRIDGE_I2C"){if(p.op==="scan")d.addresses=[60,104];else if(String(p.op||"").includes("read"))d.data=Array.from({length:Math.max(0,Number(p.length)||0)},(_,i)=>(Math.floor(phase*13)+i*17)&255);}
      if(p.command==="BRIDGE_UART")d={...d,text:"",data:[],available:0};if(p.command==="BRIDGE_SPI")d.data=Array.isArray(p.data)?p.data:[];
      if(p.command==="BRIDGE_PULSE")d={...d,microseconds:Math.round(900+250*Math.sin(phase)),hz:Number((12+4*Math.sin(phase*.6)).toFixed(2)),pin:Number(p.pin)};
      if(p.command==="BRIDGE_COUNTER")d={...d,count:Number(prev.count??0)+2,delta:2,hz:Number((8+3*Math.sin(phase*.5)).toFixed(2)),pin:Number(p.pin)};if(p.command==="BRIDGE_TRANSACTION")d.results=[];updateBridgeState(group,key,d);return;
    }
    if(p.command==="TM1637_SET"){paintTM1637(p);return;}
    if(p.command==="LCD1602_SET"){paintLCD1602(p);return;}
    if(p.command&&String(p.command).startsWith("OLED_")){applyOledCommand(p);document.querySelectorAll('.hardware-card[data-hw-type="oled"]').forEach(c=>c.classList.add("live"));}
    if(p.command==="RGB_LED_SET")updateRgbCommand(p);
    if(p.command==="LED_SET"){
      const pin=Number(p.pin),value=Math.max(0,Math.min(255,Number(p.value??0)));
      for(const sp of activeHardwareCards.filter(x=>x.type==="led"&&(x.pin==null||Number(x.pin)===pin))){const card=findHardwareCard(sp);if(!card)continue;const glow=card.querySelector('[data-role="single-led-glow"]'),label=card.querySelector('[data-role="single-led-label"]'),fill=card.querySelector('[data-role="single-led-fill"]');if(glow){glow.style.opacity=String(.18+.82*value/255);glow.style.filter=`drop-shadow(0 0 ${Math.round(4+14*value/255)}px rgba(80,220,255,.95))`;}if(label)label.textContent=value===0?"OFF":`Brightness ${value}`;if(fill)fill.style.width=(value/255*100)+"%";card.classList.toggle("live",value>0);}
    }
    if(p.command==="MOTOR_SET"||p.command==="UI_MOTOR_SET"){
      const speed=Math.max(-100,Math.min(100,+p.speed||0));
      for(const sp of activeHardwareCards.filter(x=>x.type==="motor"&&Number(x.id)===Number(p.id||1))){
        const card=findHardwareCard(sp);if(!card)continue;const fill=card.querySelector('[data-role="motor-fill"]'),label=card.querySelector('[data-role="motor-label"]'),visual=card.querySelector('[data-role="motor-visual"]');
        if(fill)fill.style.width=Math.abs(speed)+"%";if(label)label.textContent=speed===0?"Stopped":`${speed>0?"Forward":"Backward"} ${Math.abs(speed)}%`;if(visual)visual.style.transform=`rotate(${speed*1.8}deg)`;card.classList.toggle("live",speed!==0);
      }
    }
    if(p.command==="SERVO_SET"||p.command==="UI_SERVO_SET"){
      const angle=Math.max(0,Math.min(180,+p.angle||0));
      for(const sp of activeHardwareCards.filter(x=>x.type==="servo"&&Number(x.id)===Number(p.id||1))){
        const card=findHardwareCard(sp);if(!card)continue;const needle=card.querySelector('[data-role="servo-needle"]'),label=card.querySelector('[data-role="servo-label"]');
        if(needle)needle.style.transform=`rotate(${angle-90}deg)`;if(label)label.textContent=p.detached?"Detached":angle+"°";card.classList.toggle("live",!p.detached);
      }
    }
    if(p.command==="UI_BUZZER_SET"){sensorState.special=sensorState.special||{};sensorState.special[`buzzer:${Number(p.pin)}`]={frequency:Number(p.frequency)||0,volume:Number(p.volume)||0};updateSensorGraphics();}
  }

  function renderCustomDashboardCards(){
    const grid=$("sensorGrid");if(!grid)return;
    grid.querySelectorAll(".custom-dashboard-card").forEach(x=>x.remove());
    for(const [name,values] of customDashboardCards){const card=document.createElement("div");card.className="demo-card hardware-card bridge-card custom-dashboard-card live";const rows=Object.entries(values||{}).slice(0,8).map(([k,v])=>`<span class="custom-sensor-row"><b>${escapeHtml(k)}</b><em>${escapeHtml(v===null||v===undefined?"—":v)}</em></span>`).join("");card.innerHTML=`<div class="bridge-icon">◆</div><div class="demo-grow"><div class="card-title-row"><span class="sensor-status-dot"></span><strong>${escapeHtml(name)}</strong><span class="interface-badge">Python driver</span></div><div class="custom-sensor-values">${rows||'<span class="sensor-secondary">Waiting for values…</span>'}</div></div>`;grid.appendChild(card);}
  }
  function updateCustomSensorCard(name,jsonText){let values={};try{values=JSON.parse(String(jsonText||"{}"));}catch(_){values={value:String(jsonText||"")};}const n=String(name||"Sensor"),key=n.trim().toLowerCase();sensorState.special=sensorState.special||{};sensorState.special[key]=values;if(key==="gps"||key==="mpu6050"||key==="flow sensor"||key==="rpm sensor"||key==="joystick"){updateSensorGraphics();return;}customDashboardCards.set(n,values);renderCustomDashboardCards();}
  function ensureBridgeState(){sensorState.bridge=sensorState.bridge||{gpio:{},adc:{},pwm:{},i2c:{},uart:{},spi:{},pulse:{},counter:{},transaction:{}};for(const k of ["gpio","adc","pwm","i2c","uart","spi","pulse","counter","transaction"])sensorState.bridge[k]=sensorState.bridge[k]||{};return sensorState.bridge;}
  function updateBridgeState(group,key,data){const b=ensureBridgeState();b[group][String(key||group)]={...(data||{})};updateSensorGraphics();}

  function updateSensorPacket(data){
    const sensor=String(data.sensor||data.name||"").toUpperCase();
    sensorState.inputs=sensorState.inputs||{analog:{},digital:{},rotary:{},ultrasonic:{},dht11:{}};
    if(sensor==="ULTRASONIC"||data.distanceCm!==undefined||data.ultrasonicCm!==undefined){
      if(hasFiniteValue(data.distanceCm??data.ultrasonicCm))sensorState.ultrasonicCm=Number(data.distanceCm??data.ultrasonicCm);
      const key=`${Number(data.trig??18)},${Number(data.echo??19)}`;sensorState.inputs.ultrasonic[key]={...data};
    }
    if(sensor==="DHT11"||data.temperature!==undefined||data.humidity!==undefined){
      const pin=Number(data.pin??13),key=String(pin),prev=sensorState.inputs.dht11[key]||{};sensorState.dhtPin=pin;
      const hasT=hasFiniteValue(data.temperature),hasH=hasFiniteValue(data.humidity);
      if(hasT&&hasH){sensorState.dhtTemperature=Number(data.temperature);sensorState.dhtHumidity=Number(data.humidity);sensorState.inputs.dht11[key]={...prev,...data,pin,temperature:Number(data.temperature),humidity:Number(data.humidity)};}
      else if(data.valid===false&&hasFiniteValue(prev.temperature)&&hasFiniteValue(prev.humidity)){sensorState.inputs.dht11[key]={...prev,...data,pin,temperature:Number(prev.temperature),humidity:Number(prev.humidity),stale:true};}
      else sensorState.inputs.dht11[key]={...data,pin};
    }
    if(sensor==="ANALOG"||sensor==="POT"||sensor==="POTENTIOMETER"||data.value255!==undefined){
      const pin=Number(data.pin??34),d={...data,pin};sensorState.inputs.analog[String(pin)]=d;
      if(hasFiniteValue(data.potValue??data.value255??data.value))sensorState.potValue=Math.max(0,Math.min(255,Number(data.potValue??data.value255??data.value)));
      sensorState.potRaw=hasFiniteValue(data.raw??data.potRaw)?Number(data.raw??data.potRaw):Math.round((Number(sensorState.potValue)||0)*4095/255);
      sensorState.potPin=pin;sensorState.potPercent=Number(data.percent??Math.round(sensorState.potValue*100/255));sensorState.potMillivolts=Number(data.millivolts??sensorState.potMillivolts??0);
      if($("potTitle"))$("potTitle").textContent="Analog Input";
    }
    if(sensor==="DIGITAL"){
      const pin=Number(data.pin);sensorState.inputs.digital[String(pin)]={...data,pin};
    }
    if(sensor==="ROTARY"){
      const key=`${Number(data.clk)},${Number(data.dt)},${Number(data.sw??-1)}`;sensorState.inputs.rotary[key]={...data};
    }
    updateSensorGraphics();
  }

  function warnHardwareCommand(message){
    const text=String(message||"Hardware command failed"),now=Date.now();
    if(text!==lastHardwareWarning||now-lastHardwareWarningAt>3000){log("Kit hardware error: "+text);lastHardwareWarning=text;lastHardwareWarningAt=now;}
  }

  async function handleUniversalBridge(p){
    const key=String(p.key||p.command||"bridge");let r=null,group="gpio";
    if(p.command==="BRIDGE_GPIO_READ"){group="gpio";r=await kitClient.gpioRead(p.pin,{mode:p.mode||"input"});}
    else if(p.command==="BRIDGE_GPIO_WRITE"){group="gpio";r=await kitClient.gpioWrite(p.pin,p.value,{safeValue:p.safeValue??0});}
    else if(p.command==="BRIDGE_ADC_READ"){group="adc";r=await kitClient.adc(p.pin);}
    else if(p.command==="BRIDGE_PWM_SET"){group="pwm";r=await kitClient.pwm(p.pin,p.duty,{frequency:p.frequency,resolution:p.resolution,safeDuty:p.safeDuty??0});}
    else if(p.command==="BRIDGE_I2C"){group="i2c";r=await kitClient.i2c(p);}
    else if(p.command==="BRIDGE_UART"){group="uart";r=await kitClient.uart(p);}
    else if(p.command==="BRIDGE_SPI"){group="spi";r=await kitClient.spi(p);}
    else if(p.command==="BRIDGE_PULSE"){group="pulse";r=await kitClient.pulse(p);}
    else if(p.command==="BRIDGE_COUNTER"){group="counter";r=await kitClient.counter(p);}
    else if(p.command==="BRIDGE_TRANSACTION"){group="transaction";r=await kitClient.transaction(p.ops);}
    else return false;
    updateBridgeState(group,key,r||{});markKitSuccess(kitClient.status);return true;
  }

  function displayHardwareKey(p){
    if(p?.command==="TM1637_SET")return `tm:${Number(p.clk??13)},${Number(p.dio??14)}`;
    if(p?.command==="LCD1602_SET")return `lcd:${Number(p.bus??0)===1?1:0}:${Number(p.address??0x27)}`;
    return "";
  }

  function isLatestDisplayVisual(p){
    if(p?.command==="TM1637_SET"){
      const key=`${Number(p.clk??13)},${Number(p.dio??14)}`,state=sensorState.special?.tm1637?.[key];
      return Number(state?.__displaySeq??-1)===Number(p.__displaySeq??-2);
    }
    if(p?.command==="LCD1602_SET"){
      const key=`${Number(p.bus??0)===1?1:0}:${Number(p.address??0x27)}`,state=sensorState.special?.lcd1602?.[key];
      return Number(state?.__displaySeq??-1)===Number(p.__displaySeq??-2);
    }
    return false;
  }

  async function sendDisplayHardwareOnce(p){
    if(!kitClient?.connected)return;
    if(running&&currentRunNeedsKit&&!currentRunUsesKit)await beginHardwareRun();
    const send=async()=>p.command==="TM1637_SET"?kitClient.tm1637(p):kitClient.lcd1602(p);
    let result;
    try{result=await send();}
    catch(e){
      if(running&&e?.status===409&&/not running|run session/i.test(String(e?.message||""))){await kitClient.beginRun();currentRunUsesKit=true;result=await send();}
      else throw e;
    }
    if(!result?.skipped&&isLatestDisplayVisual(p)){
      if(p.command==="TM1637_SET")paintTM1637({...p,simulated:false,pending:false,hardwareSynced:true});
      else paintLCD1602({...p,simulated:false,pending:false,hardwareSynced:true});
    }
    markKitSuccess(kitClient.status);
  }

  async function runDisplayHardwareQueue(key,q){
    if(q.busy||q.paused||!kitClient?.connected)return q.runner||null;q.busy=true;
    q.runner=(async()=>{
      try{
        while(kitClient?.connected&&!q.paused){
          let next=null;
          if(key.startsWith("tm:")){next=q.pending.shift()||q.latest||null;if(next===q.latest)q.latest=null;}
          else next=q.pending.shift()||null;
          if(!next)break;
          try{await sendDisplayHardwareOnce(next);}
          catch(e){
            if(e?.status){
              // ESP32 replied: the kit link is healthy. This is a module/application fault, not a reconnect event.
              markKitSuccess(kitClient.status);warnHardwareCommand(e?.message||e);
              q.paused=true;q.pauseReason="device";q.deviceError=String(e?.message||e);q.retryAfter=Date.now()+5000;
              debugEvent("display-device-error","Display device fault isolated from kit connection",{key,status:e.status,message:q.deviceError,retryAfterMs:5000});
              if(next.command==="LCD1602_SET")paintLCD1602({...next,simulated:false,pending:false,hardwareSynced:false,hardwareError:q.deviceError});
              else if(next.command==="TM1637_SET")paintTM1637({...next,simulated:false,pending:false,hardwareSynced:false,hardwareError:q.deviceError});
            }else{
              // Preserve the latest physical frame instead of dropping it on a genuine LAN timeout.
              q.paused=true;q.pauseReason="transport";debugEvent("display-queue","Display hardware queue paused after transport failure",{key,message:String(e?.message||e)});
              if(key.startsWith("tm:")){if(next.ordered)q.pending.unshift(next);else if(!q.latest)q.latest=next;}
              else{
                const action=String(next.action||"").toLowerCase();
                const newer=action==="write"&&q.pending.some(x=>!x.ordered&&String(x.action||"").toLowerCase()==="write"&&Number(x.row||0)===Number(next.row||0)&&Number(x.col||0)===Number(next.col||0));
                if(!newer)q.pending.unshift(next);
              }
              scheduleSilentReconnect();
            }
            break;
          }
        }
      }finally{
        q.busy=false;q.runner=null;
        if(!q.paused&&(q.latest||q.pending.length)&&kitClient?.connected)setTimeout(()=>runDisplayHardwareQueue(key,q),0);
      }
    })();
    return q.runner;
  }

  async function flushDisplayHardwareQueues(){
    const active=[...displayHardwareQueues.values()].map(q=>q.runner).filter(Boolean);
    if(active.length)await Promise.allSettled(active);
  }

  function queueDisplayHardware(p){
    const key=displayHardwareKey(p);if(!key)return;
    let q=displayHardwareQueues.get(key);if(!q){q={busy:false,runner:null,latest:null,pending:[],paused:false,pauseReason:"",retryAfter:0,deviceError:""};displayHardwareQueues.set(key,q);}
    // Device faults are circuit-broken: new frames keep the browser preview fresh but physical retries are limited to once per cooldown.
    if(q.pauseReason==="device"&&Date.now()>=Number(q.retryAfter||0)){q.paused=false;q.pauseReason="";q.deviceError="";}
    if(p.command==="TM1637_SET"){
      if(p.ordered){q.pending.push({...p});if(q.pending.length>64)q.pending=q.pending.slice(-64);}else{q.pending=[];q.latest={...p};}
    }else{
      const item={...p},action=String(item.action||"").toLowerCase();
      if(action==="clear")q.pending=[];
      if(item.ordered)q.pending.push(item);
      else if(action==="write"){
        const idx=q.pending.findIndex(x=>!x.ordered&&String(x.action||"").toLowerCase()==="write"&&Number(x.row||0)===Number(item.row||0)&&Number(x.col||0)===Number(item.col||0));
        if(idx>=0)q.pending[idx]=item;else q.pending.push(item);
      }else q.pending.push(item);
      if(q.pending.length>64)q.pending=q.pending.slice(-64);
    }
    if(kitClient?.connected&&!q.paused)runDisplayHardwareQueue(key,q);
  }

  async function handleKit(p){
    if(!p)return;
    const uiOnly=String(p.command||"").startsWith("UI_");
    if(uiOnly){applyDemo(p);return;}
    if(prefs.demoMode){applyDemo(p);return;}

    if(kitClient?.connected){
      try{
        if(p.command==="TM1637_SET"||p.command==="LCD1602_SET"){
          const dp={...p,__displaySeq:++displayCommandSeq,simulated:false,pending:true};
          applyDemo(dp);queueDisplayHardware(dp);return;
        }
        if(running&&currentRunNeedsKit&&!currentRunUsesKit)await beginHardwareRun();
        if(String(p.command||"").startsWith("BRIDGE_")){await handleUniversalBridge(p);}
        else if(p.command==="LED_SET"){
          let result;try{result=await kitClient.led(p);}catch(e){if(running&&e?.status===409&&/not running|run session/i.test(String(e?.message||""))){await kitClient.beginRun();currentRunUsesKit=true;result=await kitClient.led(p);}else throw e;}if(!result?.skipped)applyDemo(p);markKitSuccess(kitClient.status);
        }else if(p.command==="RGB_LED_SET"){
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
        // Any HTTP response means the ESP32 is reachable; isolate module/application errors from LAN transport recovery.
        if(e?.status){markKitSuccess(kitClient.status);warnHardwareCommand(e?.message||e);}
        else scheduleSilentReconnect();
      }
      return;
    }

    // Offline Simulation: valid Python keeps running and every output is mirrored in Kit Output / Sensors.
    // Physical transmission resumes automatically after the saved kit reconnects.
    if(p.command==="TM1637_SET"||p.command==="LCD1602_SET"){const dp={...p,__displaySeq:++displayCommandSeq,simulated:true,pending:false};applyDemo(dp);queueDisplayHardware(dp);}else applyDemo(p);
    if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"command",kitId:prefs.kitName||prefs.kitId,...p}));
    else scheduleSilentReconnect();
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
      if(showError){
        log("Kit connection failed: "+(e?.message||e)+" Background reconnect will continue. Check kit power and Wi-Fi.");
        if(isEmbedded)log("Browser/Wix note: if Local Network Access is blocked inside the embedded page, open this Python Lab page in a new tab and allow Local Network Access for the site.");
      }
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

  window.addEventListener("zebjus-kit-diagnostic",e=>{const d=e.detail||{};debugEvent(d.kind||"kit-http",d.message||d.path||"Kit HTTP",d);});
  window.addEventListener("error",e=>debugEvent("window-error",e.message||"Window error",{file:e.filename||"",line:e.lineno||0,col:e.colno||0}));
  window.addEventListener("unhandledrejection",e=>debugEvent("promise-error",String(e.reason?.message||e.reason||"Unhandled promise rejection")));

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
  populateHardwarePicker();
  if($("hardwarePicker"))$("hardwarePicker").onchange=updateHardwarePickerInfo;
  if($("addHardwareBtn"))$("addHardwareBtn").onclick=addSelectedHardware;
  if($("undoBtn"))$("undoBtn").onclick=undoEditor;if($("redoBtn"))$("redoBtn").onclick=redoEditor;
  if($("copyDebugBtn"))$("copyDebugBtn").onclick=copyDebugReport;
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
  $("clearImageBtn").onclick=clearLoadedImage;if($("clearPlotterBtn"))$("clearPlotterBtn").onclick=clearPlotter;
  document.querySelectorAll(".output-tab").forEach(b=>b.onclick=()=>switchOutput(b.dataset.view));

  document.documentElement.style.setProperty("--editor-font",(prefs.fontSize||14)+"px");
  $("kitNameText").textContent=prefs.kitName||prefs.kitId||"No kit selected";$("kitStatus").textContent=prefs.demoMode?"Demo mode":"Kit disconnected";
  window.addEventListener("pagehide",()=>{saveDebugReport();stopKitHeartbeat();if(currentRunUsesKit&&kitClient?.connected)kitClient.endRun().catch(()=>{});});
  setInterval(saveDebugReport,5000);
  initEditor();renderHardwareCards(getCode());initOledPreview();updateRgb(0,0,0);updateSensorGraphics();drawSerialPlotter();setupCameraBridge();createWorker();enumerateCameras();connectRealKit();startKitHealthMonitor();
})();